import { encryptChunk } from './aead';

// R3 #3 §1.3 — Web Worker encrypt offload. Keeps main thread responsive
// during > 50MB chunked uploads (libsodium AEAD is fast but per-chunk loops
// still cumulatively block UI).
//
// This module is loaded two ways:
//   - As Worker via `new Worker(new URL('./encryptWorker.ts', import.meta.url))`
//     (CRA 5 webpack worker bundling) — `self.onmessage` runs
//   - As regular import for testing handleEncryptMessage — Worker entry skipped
//
// Message contract (postMessage + transferable):
//   request : { cmd: 'encrypt-chunk', id, plaintext, chunkIv, fileKey, aad }
//   response: { id, ciphertext } | { id, error }

export interface EncryptChunkRequest {
  cmd: 'encrypt-chunk';
  id: number;
  plaintext: Uint8Array;
  chunkIv: Uint8Array;
  fileKey: Uint8Array;
  aad: Uint8Array;
}

export interface EncryptChunkResponse {
  id: number;
  ciphertext?: Uint8Array;
  error?: string;
}

// Pure message handler — testable without spawning a real Worker.
export async function handleEncryptMessage(
  req: EncryptChunkRequest,
): Promise<EncryptChunkResponse> {
  if (req.cmd !== 'encrypt-chunk') {
    return { id: req.id, error: `unknown cmd: ${req.cmd}` };
  }
  try {
    const ciphertext = await encryptChunk(req.plaintext, req.chunkIv, req.fileKey, req.aad);
    return { id: req.id, ciphertext };
  } catch (err) {
    return { id: req.id, error: err instanceof Error ? err.message : String(err) };
  }
}

// Worker entry — only runs when this module is loaded as a Web Worker.
// Detected via `importScripts` global (only exposed inside Worker scope; not
// in main thread `window` nor jest jsdom). tsconfig.json doesn't include the
// "webworker" lib so we type-cast `self` via `any` to access Worker-only
// postMessage signature.
// eslint-disable-next-line @typescript-eslint/no-explicit-any, no-restricted-globals
const _self: any = typeof self !== 'undefined' ? self : undefined;
if (_self && typeof _self.importScripts === 'function') {
  _self.onmessage = async (e: MessageEvent<EncryptChunkRequest>) => {
    const resp = await handleEncryptMessage(e.data);
    // Transfer ciphertext buffer to avoid copy across boundary.
    const transfer = resp.ciphertext ? [resp.ciphertext.buffer] : [];
    _self.postMessage(resp, transfer);
  };
}
