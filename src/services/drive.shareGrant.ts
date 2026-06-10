import driveApi, { DriveServiceError, unwrapDriveBody } from "api/driveAxios";
import { getKeyBundleRef } from "../contexts/MasterKeyContext";
import {
  wrapKeyForGrantee,
  unwrapKeyForSelf,
  verifyPubkey,
} from "./crypto/shareGrant";
import { unwrapFileKey } from "./crypto/aead";

// R3 #5 §1.2 + §1.5 + §1.9 — share grant service helpers (UI integration
// defer R3 housekeeping per R3 #1-#4 precedent).
//
// All helpers operate on cleartext key material in-memory; caller (UI or
// store) is responsible for not persisting unwrapped keys past their use.
//
// Per Default 1 (this dispatch): thumb_key is co-granted with file_key for
// file resources (so grantee can render thumbnails without separate trip).

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

export interface SharePayloadInput {
  resourceType: "file" | "folder";
  resourceId: number;
  granteeId: number;
  granteePubkeyB64: string;
  permission: "read" | "write";
  expiresAt?: string;
  // Required for resource decrypt — caller supplies from listFiles / getFile.
  ownKeyWrapB64: string;
  // file-only: thumb wrap (Default 1 — co-grant ON when present).
  ownThumbKeyWrapB64?: string;
}

export interface SharePayloadOutput {
  resource_type: "file" | "folder";
  resource_id: number;
  grantee_id: number;
  permission: "read" | "write";
  expires_at?: string;
  wrapped_key_for_grantee: string;        // base64 sealed-box(80 bytes)
  wrapped_thumb_key_for_grantee?: string;
  // sha256(grantee_pubkey)[:8] base64 — backend can sanity-check the
  // caller saw the same pubkey it now stores (defense against grantee
  // re-keyed between search and submit).
  grantee_pubkey_fingerprint?: string;
}

/**
 * R3 #5 §1.1/§1.2 — assemble the POST /drive/shares payload for a single
 * file or folder. Unwraps the caller's own key_wrap (under master_privkey)
 * then re-wraps under grantee_pubkey via X25519 sealed-box.
 *
 * Throws DriveServiceError on:
 *   KEYS_MISSING   — master_privkey absent (not logged in)
 *   INVALID_PUBKEY — verifyPubkey fail (grantee not migrated / corrupt)
 *   WRAP_DECRYPT   — own unwrapFileKey throws
 */
export async function buildShareGrantPayload(
  input: SharePayloadInput,
): Promise<SharePayloadOutput> {
  const { masterPrivkey, masterPubkey } = getKeyBundleRef();
  if (!masterPrivkey || !masterPubkey) {
    throw new DriveServiceError("KEYS_MISSING", "尚未登入或金鑰已失效");
  }

  const granteePubkey = base64ToBytes(input.granteePubkeyB64);
  if (!verifyPubkey(granteePubkey)) {
    throw new DriveServiceError(
      "INVALID_PUBKEY",
      "該使用者尚未升級 E2EE 系統，請等待 migration 完成",
    );
  }

  // Unwrap own file_key / folder_key.
  let ownKey: Uint8Array;
  try {
    ownKey = await unwrapFileKey(
      base64ToBytes(input.ownKeyWrapB64),
      masterPubkey,
      masterPrivkey,
    );
  } catch {
    throw new DriveServiceError("WRAP_DECRYPT", "金鑰解封失敗 — 無法分享");
  }

  // Re-wrap under grantee pubkey.
  const wrappedForGrantee = await wrapKeyForGrantee(ownKey, granteePubkey);

  const out: SharePayloadOutput = {
    resource_type: input.resourceType,
    resource_id: input.resourceId,
    grantee_id: input.granteeId,
    permission: input.permission,
    expires_at: input.expiresAt,
    wrapped_key_for_grantee: bytesToBase64(wrappedForGrantee),
  };

  // R3 #5 Default 1 — co-grant thumb_key for file resources.
  if (input.resourceType === "file" && input.ownThumbKeyWrapB64) {
    try {
      const ownThumbKey = await unwrapFileKey(
        base64ToBytes(input.ownThumbKeyWrapB64),
        masterPubkey,
        masterPrivkey,
      );
      const wrappedThumbForGrantee = await wrapKeyForGrantee(ownThumbKey, granteePubkey);
      out.wrapped_thumb_key_for_grantee = bytesToBase64(wrappedThumbForGrantee);
    } catch {
      // Don't fail the whole share for missing/broken thumb wrap — grantee
      // will just lose thumb preview, full file unwrap path still works.
    }
  }

  return out;
}

// ───── R3 #5 §1.3 — incoming-share unwrap helper ─────

export interface IncomingSharePayload {
  share_id: number;
  resource_type: "file" | "folder";
  resource_id: number;
  // Server-stored sealed boxes for me (the grantee).
  wrapped_key_for_grantee: string;
  wrapped_thumb_key_for_grantee?: string | null;
}

export interface IncomingShareUnwrapped {
  share_id: number;
  resource_id: number;
  fileKey: Uint8Array;
  thumbKey?: Uint8Array;
}

/**
 * Unwrap a single incoming share (for me as grantee). Returns cleartext
 * file_key + optional thumb_key. Stored only in sharedWithMeStore in-memory.
 */
export async function unwrapIncomingShare(
  share: IncomingSharePayload,
): Promise<IncomingShareUnwrapped> {
  const { masterPrivkey, masterPubkey } = getKeyBundleRef();
  if (!masterPrivkey || !masterPubkey) {
    throw new DriveServiceError("KEYS_MISSING", "尚未登入或金鑰已失效");
  }

  const myKeypair = { publicKey: masterPubkey, privateKey: masterPrivkey };
  let fileKey: Uint8Array;
  try {
    fileKey = await unwrapKeyForSelf(base64ToBytes(share.wrapped_key_for_grantee), myKeypair);
  } catch {
    throw new DriveServiceError(
      "WRAP_DECRYPT",
      `Share ${share.share_id} 金鑰解封失敗`,
    );
  }

  const out: IncomingShareUnwrapped = {
    share_id: share.share_id,
    resource_id: share.resource_id,
    fileKey,
  };
  if (share.wrapped_thumb_key_for_grantee) {
    try {
      out.thumbKey = await unwrapKeyForSelf(
        base64ToBytes(share.wrapped_thumb_key_for_grantee),
        myKeypair,
      );
    } catch {
      // Same fallthrough as buildShareGrantPayload — don't fail share for
      // thumb. Caller renders generic icon when thumbKey absent.
    }
  }
  return out;
}

// ───── R3 #5 §1.5 — folder share recursive batch wrap ─────

export interface FolderShareBatchInput {
  resourceType: "folder";
  resourceId: number;
  granteeId: number;
  granteePubkeyB64: string;
  permission: "read" | "write";
  expiresAt?: string;
  folderKeyWrapB64: string;
  // Inner files (per backend §1.5 batch endpoint): { file_id, file_key_wrap }
  innerFiles: Array<{ file_id: number; key_wrap: string; thumb_key_wrap?: string | null }>;
  onProgress?: (completed: number, total: number) => void;
}

export interface FolderShareBatchOutput {
  share: SharePayloadOutput;
  inner_file_wraps: Array<{
    file_id: number;
    wrapped_key_for_grantee: string;
    wrapped_thumb_key_for_grantee?: string;
  }>;
}

/**
 * R3 #5 §1.5 — build batch wrap payload for folder share. Folder_key wraps
 * under grantee pubkey + each inner file_key wraps under grantee pubkey
 * (per R2 #2 §3.11 — files don't cascade-wrap under folder_key; they remain
 * under master, so sharing requires re-wrapping each).
 *
 * Uses Promise.all with caller-supplied progress callback. Per Default 2,
 * UI shows progress bar when innerFiles.length > 50.
 */
export async function buildFolderShareWraps(
  input: FolderShareBatchInput,
): Promise<FolderShareBatchOutput> {
  // Folder-level wrap.
  const folderShare = await buildShareGrantPayload({
    resourceType: input.resourceType,
    resourceId: input.resourceId,
    granteeId: input.granteeId,
    granteePubkeyB64: input.granteePubkeyB64,
    permission: input.permission,
    expiresAt: input.expiresAt,
    ownKeyWrapB64: input.folderKeyWrapB64,
  });

  // Per-file re-wraps. Each file is independent — no AAD chain. Parallel
  // (sealed-box wrap is fast; rate-limit only if needed).
  const total = input.innerFiles.length;
  let completed = 0;
  const inner = await Promise.all(
    input.innerFiles.map(async (f) => {
      const wrap = await buildShareGrantPayload({
        resourceType: "file",
        resourceId: f.file_id,
        granteeId: input.granteeId,
        granteePubkeyB64: input.granteePubkeyB64,
        permission: input.permission,
        ownKeyWrapB64: f.key_wrap,
        ownThumbKeyWrapB64: f.thumb_key_wrap ?? undefined,
      });
      completed++;
      input.onProgress?.(completed, total);
      return {
        file_id: f.file_id,
        wrapped_key_for_grantee: wrap.wrapped_key_for_grantee,
        wrapped_thumb_key_for_grantee: wrap.wrapped_thumb_key_for_grantee,
      };
    }),
  );

  return { share: folderShare, inner_file_wraps: inner };
}

// ───── R3 #5 §1.9 — folder share gap diff + rebuild ─────

interface FolderShareGapsResponse {
  missing_file_ids: number[];
}

/**
 * R3 #5 §1.9 — list files inside a shared folder that aren't yet
 * re-wrapped for a given grantee (because they were uploaded after the
 * folder share was created).
 *
 * Default 3 — two-endpoint stance (GET gap + POST rebuild). Swap to single
 * endpoint if backend impl chose §1.14 single-endpoint stance.
 */
export async function listFolderShareGaps(
  folderId: number,
  shareId: number,
): Promise<FolderShareGapsResponse> {
  const resp: any = await driveApi.get(
    `/drive/folders/${folderId}/shares/${shareId}/gaps`,
  );
  const { data } = unwrapDriveBody<FolderShareGapsResponse>(resp.data);
  return data;
}

interface RebuildResponse {
  added: number;
  updated: number;
}

export async function rebuildFolderShare(
  folderId: number,
  shareId: number,
  inner_file_wraps: Array<{
    file_id: number;
    wrapped_key_for_grantee: string;
    wrapped_thumb_key_for_grantee?: string;
  }>,
): Promise<RebuildResponse> {
  const resp: any = await driveApi.post(
    `/drive/folders/${folderId}/shares/${shareId}/rebuild`,
    { inner_file_wraps },
  );
  const { data } = unwrapDriveBody<RebuildResponse>(resp.data);
  return data;
}
