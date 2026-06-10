import { decryptChunk } from './aead';
import type { DecryptChunkResponse } from './decryptWorker';

// R3 #4 §1.1 — main-thread client for decryptWorker.
//   - Lazy Worker construction (mirror encryptWorkerClient pattern)
//   - Semaphore concurrency cap (§3.15 LOCKED: decrypt cap 2-3, fetch unlimited)
//   - Inline fallback when Worker construction fails (jest jsdom etc.)

interface PendingDecrypt {
  resolve: (plaintext: Uint8Array) => void;
  reject: (err: Error) => void;
}

let worker: Worker | null = null;
let workerInitFailed = false;
let nextId = 1;
const pending = new Map<number, PendingDecrypt>();

// R3 #4 §3.15 LOCKED — decrypt concurrency cap.
const DECRYPT_CONCURRENCY = 2;

// Tiny FIFO semaphore. No external lib (avoid bundle bloat).
class Semaphore {
  private available: number;
  private queue: Array<() => void> = [];
  constructor(capacity: number) {
    this.available = capacity;
  }
  async acquire(): Promise<void> {
    if (this.available > 0) {
      this.available--;
      return;
    }
    await new Promise<void>((resolve) => {
      this.queue.push(() => {
        this.available--;
        resolve();
      });
    });
  }
  release(): void {
    this.available++;
    const next = this.queue.shift();
    if (next) next();
  }
}

const decryptSemaphore = new Semaphore(DECRYPT_CONCURRENCY);

function tryCreateWorker(): Worker | null {
  if (workerInitFailed) return null;
  if (worker) return worker;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const url = new URL('./decryptWorker.ts', (import.meta as any).url);
    worker = new Worker(url);
    worker.onmessage = (e: MessageEvent<DecryptChunkResponse>) => {
      const resp = e.data;
      const handler = pending.get(resp.id);
      if (!handler) return;
      pending.delete(resp.id);
      if (resp.error) handler.reject(new Error(resp.error));
      else if (resp.plaintext) handler.resolve(resp.plaintext);
      else handler.reject(new Error('decryptWorker: empty response'));
    };
    worker.onerror = (e: ErrorEvent) => {
      pending.forEach((p) => p.reject(new Error(`decryptWorker fatal: ${e.message}`)));
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

async function decryptChunkOffloaded(
  ciphertext: Uint8Array,
  chunkIv: Uint8Array,
  fileKey: Uint8Array,
  aad: Uint8Array,
): Promise<Uint8Array> {
  const w = tryCreateWorker();
  if (!w) {
    return decryptChunk(ciphertext, chunkIv, fileKey, aad);
  }
  const id = nextId++;
  return new Promise<Uint8Array>((resolve, reject) => {
    pending.set(id, { resolve, reject });
    w.postMessage(
      { cmd: 'decrypt-chunk', id, ciphertext, chunkIv, fileKey, aad },
      [ciphertext.buffer],
    );
  });
}

/**
 * Decrypt one chunk with concurrency cap. Use this for download pipeline —
 * pure decryptChunk would saturate CPU on parallel manifest dispatch.
 */
export async function decryptChunkCapped(
  ciphertext: Uint8Array,
  chunkIv: Uint8Array,
  fileKey: Uint8Array,
  aad: Uint8Array,
): Promise<Uint8Array> {
  await decryptSemaphore.acquire();
  try {
    return await decryptChunkOffloaded(ciphertext, chunkIv, fileKey, aad);
  } finally {
    decryptSemaphore.release();
  }
}

export interface ChunkInput {
  ciphertext: Uint8Array;
  chunkIv: Uint8Array;
  aad: Uint8Array;
  chunkIndex: number;
}

/**
 * Parallel decrypt with caller-supplied input list. Preserves chunk_index
 * ordering in returned array (regardless of completion order).
 */
export async function decryptChunkParallel(
  chunks: ChunkInput[],
  fileKey: Uint8Array,
): Promise<Uint8Array[]> {
  const out: Uint8Array[] = new Array(chunks.length);
  await Promise.all(
    chunks.map(async (c) => {
      out[c.chunkIndex] = await decryptChunkCapped(c.ciphertext, c.chunkIv, fileKey, c.aad);
    }),
  );
  return out;
}

export function terminateDecryptWorker(): void {
  if (worker) {
    worker.terminate();
    worker = null;
  }
  workerInitFailed = false;
  pending.forEach((p) => p.reject(new Error('decryptWorker terminated')));
  pending.clear();
}
