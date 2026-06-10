import { decryptChunk } from './aead';

// R3 #4 §1.1 — Web Worker decrypt offload. Mirrors encryptWorker pattern
// (R3 #3 §1.3). Stateless per-call: one chunk in, plaintext out. AAD is
// supplied by caller — packAad scheme decided by Catch 13 wiki resolve
// (Worker code is AAD-format-agnostic; just passes bytes through).
//
// Message contract (postMessage + transferable):
//   request : { cmd: 'decrypt-chunk', id, ciphertext, chunkIv, aad, fileKey }
//   response: { id, plaintext } | { id, error }

export interface DecryptChunkRequest {
  cmd: 'decrypt-chunk';
  id: number;
  ciphertext: Uint8Array;
  chunkIv: Uint8Array;
  aad: Uint8Array;
  fileKey: Uint8Array;
}

export interface DecryptChunkResponse {
  id: number;
  plaintext?: Uint8Array;
  error?: string;
  // R3 #4 §3.8 LOCKED — failure differentiation reason:
  //   'mac' = AEAD auth tag mismatch (key wrong, data tampered, or AAD mismatch)
  //   'other' = libsodium threw for non-MAC reason (length etc.)
  reason?: 'mac' | 'other';
}

export async function handleDecryptMessage(
  req: DecryptChunkRequest,
): Promise<DecryptChunkResponse> {
  if (req.cmd !== 'decrypt-chunk') {
    return { id: req.id, error: `unknown cmd: ${req.cmd}`, reason: 'other' };
  }
  try {
    const plaintext = await decryptChunk(req.ciphertext, req.chunkIv, req.fileKey, req.aad);
    return { id: req.id, plaintext };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    // libsodium AEAD decrypt throws a generic Error with no structured code.
    // Heuristic: any failure at this layer is treated as 'mac' (which covers
    // key/AAD/tamper indistinguishably — per §3.8 caller maps to 4-layer UX
    // based on whether AAD inputs differ from expected).
    return { id: req.id, error: msg, reason: 'mac' };
  }
}

// Worker entry — guarded by Worker scope detection.
// eslint-disable-next-line @typescript-eslint/no-explicit-any, no-restricted-globals
const _self: any = typeof self !== 'undefined' ? self : undefined;
if (_self && typeof _self.importScripts === 'function') {
  _self.onmessage = async (e: MessageEvent<DecryptChunkRequest>) => {
    const resp = await handleDecryptMessage(e.data);
    const transfer = resp.plaintext ? [resp.plaintext.buffer] : [];
    _self.postMessage(resp, transfer);
  };
}
