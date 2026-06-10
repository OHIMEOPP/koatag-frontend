import driveApi, { DriveServiceError, unwrapDriveBody } from "api/driveAxios";
import { getKeyBundleRef } from "../contexts/MasterKeyContext";
import {
  unwrapFileKey,
  chunkAad,
  sha256,
} from "./crypto/aead";
import { decryptChunkCapped } from "./crypto/decryptClient";
import type { DriveFile } from "./drive.service";

// R3 #4 §1.2 — encrypted file download pipeline.
//
// Flow (per dispatch §1.2 + R2 #4 §2.2.2):
//   1. unwrapFileKey from file.key_wrap (X25519 sealed-box open)
//   2. GET /drive/files/{id}/chunks/manifest → per-chunk {iv, sig, exp, hash}
//   3. Parallel: fetch unlimited + decrypt cap 2-3 (per §3.15 LOCKED via
//      decryptChunkCapped semaphore)
//   4. Per-chunk: fetch ciphertext → verify SHA-256 vs manifest hash →
//      decryptWorker.decryptChunk + AAD chunkAad(account, chunk_index)
//   5. Assemble plaintext Blob (chunks in index order — preserved by
//      decryptChunkParallel even on out-of-order completion)
//
// AAD = chunkAad(account, chunk_index) per R3 #3 3-way lock (#1635) —
// Catch 13 resolved Option A keep R3 #3 land helper (#1666).
//
// 4-layer failure differentiation per §3.8 LOCKED, surfaced via
// DriveServiceError code:
//   - KEYS_MISSING   = master_privkey absent or file.key_wrap missing
//   - WRAP_DECRYPT   = unwrapFileKey throws (X25519 sealed-box bad)
//   - CHUNK_HASH     = SHA-256 mismatch (data corruption / wrong manifest)
//   - CHUNK_DECRYPT  = AEAD auth tag fail (key/AAD/tamper)
//   - MANIFEST_FAIL  = manifest fetch error
//   - FETCH_FAIL     = chunk fetch error (network)

interface ManifestChunk {
  chunk_index: number;
  chunk_iv: string;       // base64
  chunk_sig: string;
  chunk_exp: number;
  chunk_hash_sha256: string; // base64
  chunk_size?: number;
}

interface ManifestResponse {
  chunks: ManifestChunk[];
  total_size_plaintext: number;
  total_size_ciphertext: number;
  // Optional refresh hint per §3.16 LOCKED — manifest_exp - 30s prefetch refresh
  manifest_exp?: number;
}

interface DownloadOpts {
  signal?: AbortSignal;
  onProgress?: (loaded: number, total: number) => void;
}

function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function getCurrentAccount(): string {
  try {
    const raw = localStorage.getItem("user");
    if (!raw) return "";
    const u = JSON.parse(raw);
    return u.account || u.email || "";
  } catch {
    return "";
  }
}

function chunkFetchUrl(fileId: number, chunkIndex: number, sig: string, exp: number): string {
  const base = process.env.REACT_APP_API_URL || "/api";
  return `${base}/drive/files/${fileId}/chunks/${chunkIndex}?sig=${encodeURIComponent(sig)}&exp=${exp}`;
}

/**
 * R3 #4 §1.2 — download an encrypted file and return its plaintext as a Blob.
 *
 * Caller passes a DriveFile decoded by listFiles / getFile (already has
 * is_encrypted + key_wrap fields). The Blob mime is derived from
 * mime_claimed (per R3 #2 decryptDriveFile pattern). Caller wires the Blob
 * into showSaveFilePicker / anchor download / video src as appropriate.
 *
 * Per §3.8 LOCKED — any chunk failure aborts the entire download (no silent
 * partial). Throws DriveServiceError with a code mapping to the 4-layer fail
 * UX (UI layer maps code → user-facing copy).
 */
export async function downloadEncryptedFile(
  file: DriveFile,
  opts: DownloadOpts = {},
): Promise<Blob> {
  const { signal, onProgress } = opts;
  const { masterPrivkey, masterPubkey } = getKeyBundleRef();

  if (!masterPrivkey || !masterPubkey) {
    throw new DriveServiceError("KEYS_MISSING", "尚未登入或金鑰已失效，請重新登入");
  }
  if (!file.is_encrypted) {
    throw new DriveServiceError(
      "NOT_ENCRYPTED",
      "此檔案未加密，請改用 downloadUrl()",
    );
  }
  if (!file.key_wrap) {
    throw new DriveServiceError("KEYS_MISSING", "檔案 key_wrap 缺失");
  }

  const account = getCurrentAccount();
  if (!account) {
    throw new DriveServiceError("ACCOUNT_MISSING", "找不到 account — 請重新登入");
  }

  // Step 1: unwrap file_key (X25519 sealed-box open).
  let fileKey: Uint8Array;
  try {
    fileKey = await unwrapFileKey(
      base64ToBytes(file.key_wrap),
      masterPubkey,
      masterPrivkey,
    );
  } catch {
    throw new DriveServiceError(
      "WRAP_DECRYPT",
      "金鑰解封失敗 — 密碼或 master_privkey 異常",
    );
  }

  // Step 2: fetch manifest.
  let manifest: ManifestResponse;
  try {
    const resp: any = await driveApi.get(
      `/drive/files/${file.id}/chunks/manifest`,
      { signal },
    );
    const { data } = unwrapDriveBody<ManifestResponse>(resp.data);
    manifest = data;
  } catch (err: any) {
    if (err?.name === "AbortError" || err?.code === "ERR_CANCELED") {
      throw new DriveServiceError("DOWNLOAD_ABORTED", "下載已取消");
    }
    throw new DriveServiceError("MANIFEST_FAIL", "無法取得 chunk manifest");
  }

  const { chunks, total_size_plaintext } = manifest;
  const sorted = [...chunks].sort((a, b) => a.chunk_index - b.chunk_index);

  // Step 3 + 4: parallel fetch + cap-bounded decrypt.
  let bytesDecrypted = 0;
  const plaintextChunks: Uint8Array[] = new Array(sorted.length);

  await Promise.all(
    sorted.map(async (m) => {
      // Fetch ciphertext from chunk endpoint. fetch unlimited per §3.15.
      let ciphertext: Uint8Array;
      try {
        const url = chunkFetchUrl(file.id, m.chunk_index, m.chunk_sig, m.chunk_exp);
        const response = await fetch(url, { signal });
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        ciphertext = new Uint8Array(await response.arrayBuffer());
      } catch (err: any) {
        if (err?.name === "AbortError") {
          throw new DriveServiceError("DOWNLOAD_ABORTED", "下載已取消");
        }
        throw new DriveServiceError(
          "FETCH_FAIL",
          `Chunk ${m.chunk_index} 下載失敗 (網路中斷)`,
        );
      }

      // Verify SHA-256 vs manifest (per backend §3.14 default verify).
      const computed = await sha256(ciphertext);
      if (bytesToBase64(computed) !== m.chunk_hash_sha256) {
        throw new DriveServiceError(
          "CHUNK_HASH",
          `Chunk ${m.chunk_index} 完整性檢查失敗 — 資料損毀`,
          { chunk_index: m.chunk_index },
        );
      }

      // Decrypt with concurrency cap (§3.15 LOCKED via decryptChunkCapped).
      let plaintext: Uint8Array;
      try {
        const iv = base64ToBytes(m.chunk_iv);
        const aad = chunkAad(account, m.chunk_index);
        plaintext = await decryptChunkCapped(ciphertext, iv, fileKey, aad);
      } catch {
        throw new DriveServiceError(
          "CHUNK_DECRYPT",
          `Chunk ${m.chunk_index} 解密失敗 — 金鑰/AAD/篡改 (per §3.8)`,
          { chunk_index: m.chunk_index },
        );
      }

      plaintextChunks[m.chunk_index] = plaintext;
      bytesDecrypted += plaintext.length;
      onProgress?.(bytesDecrypted, total_size_plaintext);
    }),
  );

  // Step 5: assemble Blob.
  const mime = file.mime_claimed || file.mime || "application/octet-stream";
  return new Blob(plaintextChunks, { type: mime });
}

/**
 * R3 #4 §1.9 — refresh manifest sig before exp.
 *
 * Backend `GET /api/drive/files/{id}/chunks/refresh` returns a new manifest
 * (same chunks, fresh sig+exp). For long video playback (§1.5 MSE), the
 * MSE feed pre-empts at manifest_exp - 30s to avoid mid-playback fetch
 * 401 (signed URL expired).
 */
export async function refreshChunkManifest(
  fileId: number,
  signal?: AbortSignal,
): Promise<ManifestResponse> {
  const resp: any = await driveApi.get(
    `/drive/files/${fileId}/chunks/refresh`,
    { signal },
  );
  const { data } = unwrapDriveBody<ManifestResponse>(resp.data);
  return data;
}

export type { ManifestChunk, ManifestResponse };
