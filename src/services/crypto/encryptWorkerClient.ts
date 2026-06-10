import { encryptChunk } from './aead';
import type { EncryptChunkResponse } from './encryptWorker';

// R3 #3 §1.3 — Main-thread client for encryptWorker. Spawns the Worker
// lazily on first call, multiplexes concurrent encrypt requests by request
// id. Falls back to inline `encryptChunk` if Worker construction throws
// (e.g. jest jsdom — `import.meta.url` + Worker constructor unsupported).

interface Pending {
  resolve: (ciphertext: Uint8Array) => void;
  reject: (err: Error) => void;
}

let worker: Worker | null = null;
let workerInitFailed = false;
let nextId = 1;
const pending = new Map<number, Pending>();

function tryCreateWorker(): Worker | null {
  if (workerInitFailed) return null;
  if (worker) return worker;
  try {
    // CRA 5 webpack handles `new URL(...)` + Worker as worker bundle.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const url = new URL('./encryptWorker.ts', (import.meta as any).url);
    worker = new Worker(url);
    worker.onmessage = (e: MessageEvent<EncryptChunkResponse>) => {
      const resp = e.data;
      const handler = pending.get(resp.id);
      if (!handler) return;
      pending.delete(resp.id);
      if (resp.error) handler.reject(new Error(resp.error));
      else if (resp.ciphertext) handler.resolve(resp.ciphertext);
      else handler.reject(new Error('encryptWorker: empty response'));
    };
    worker.onerror = (e: ErrorEvent) => {
      // Catastrophic worker error — reject all pending and reset.
      pending.forEach((p) => p.reject(new Error(`encryptWorker fatal: ${e.message}`)));
      pending.clear();
      worker?.terminate();
      worker = null;
      workerInitFailed = true;
    };
    return worker;
  } catch {
    workerInitFailed = true;
    worker = null;
    return null;
  }
}

export async function encryptChunkOffloaded(
  plaintext: Uint8Array,
  chunkIv: Uint8Array,
  fileKey: Uint8Array,
  aad: Uint8Array,
): Promise<Uint8Array> {
  const w = tryCreateWorker();
  if (!w) {
    // Fallback path — call encryptChunk synchronously on main thread.
    // Used in tests + browsers without Worker support.
    return encryptChunk(plaintext, chunkIv, fileKey, aad);
  }
  const id = nextId++;
  return new Promise<Uint8Array>((resolve, reject) => {
    pending.set(id, { resolve, reject });
    w.postMessage(
      { cmd: 'encrypt-chunk', id, plaintext, chunkIv, fileKey, aad },
      // Transfer underlying buffer to avoid copy. plaintext is consumed.
      [plaintext.buffer],
    );
  });
}

// Tear down the worker — call on logout to release memory + clear pending.
export function terminateEncryptWorker(): void {
  if (worker) {
    worker.terminate();
    worker = null;
  }
  workerInitFailed = false;
  pending.forEach((p) => p.reject(new Error('encryptWorker terminated')));
  pending.clear();
}
