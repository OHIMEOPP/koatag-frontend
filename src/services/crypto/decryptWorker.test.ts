// R3 #4 §1.1 — decryptWorker handler tests. Worker live-path / Worker client
// (decryptClient.ts uses import.meta.url) untested in jest, per R3 #3 pattern
// — fallback path is just decryptChunk passthrough already covered.
import sodium from 'libsodium-wrappers';
import { handleDecryptMessage, type DecryptChunkRequest } from './decryptWorker';
import {
  encryptChunk,
  decryptChunk,
  chunkAad,
  generateFileKey,
  freshChunkIv,
} from './aead';

beforeAll(async () => {
  await sodium.ready;
});

describe('decryptWorker.handleDecryptMessage (R3 #4 §1.1)', () => {
  it('decrypts chunk produced by encryptChunk; plaintext round-trips', async () => {
    const fileKey = await generateFileKey();
    const iv = await freshChunkIv();
    const aad = chunkAad('alice', 0);
    const plaintext = new Uint8Array(2048).fill(0x55);
    const ciphertext = await encryptChunk(plaintext, iv, fileKey, aad);

    const req: DecryptChunkRequest = {
      cmd: 'decrypt-chunk',
      id: 42,
      ciphertext,
      chunkIv: iv,
      aad,
      fileKey,
    };
    const resp = await handleDecryptMessage(req);

    expect(resp.id).toBe(42);
    expect(resp.error).toBeUndefined();
    expect(resp.plaintext).toBeInstanceOf(Uint8Array);
    expect(Array.from(resp.plaintext!)).toEqual(Array.from(plaintext));
  });

  it('returns error response for unknown cmd', async () => {
    const resp = await handleDecryptMessage({
      cmd: 'bogus' as 'decrypt-chunk',
      id: 1,
      ciphertext: new Uint8Array(),
      chunkIv: new Uint8Array(24),
      aad: new Uint8Array(),
      fileKey: new Uint8Array(32),
    });
    expect(resp.error).toMatch(/unknown cmd/);
    expect(resp.plaintext).toBeUndefined();
    expect(resp.reason).toBe('other');
  });

  it('reports reason=mac on AEAD auth tag mismatch (R3 #4 §3.8 hint)', async () => {
    const fileKey = await generateFileKey();
    const iv = await freshChunkIv();
    const aad = chunkAad('alice', 0);
    const plaintext = new Uint8Array(64).fill(0x77);
    const ciphertext = await encryptChunk(plaintext, iv, fileKey, aad);

    // Decrypt with wrong AAD → MAC fail
    const resp = await handleDecryptMessage({
      cmd: 'decrypt-chunk',
      id: 99,
      ciphertext,
      chunkIv: iv,
      aad: chunkAad('alice', 1), // wrong chunk_index
      fileKey,
    });
    expect(resp.id).toBe(99);
    expect(resp.error).toBeDefined();
    expect(resp.reason).toBe('mac');
    expect(resp.plaintext).toBeUndefined();
  });

  it('preserves request id in all responses (caller routes by id)', async () => {
    const resp = await handleDecryptMessage({
      cmd: 'decrypt-chunk',
      id: 13579,
      ciphertext: new Uint8Array([0]),
      chunkIv: new Uint8Array(24),
      aad: new Uint8Array(),
      fileKey: new Uint8Array(32),
    });
    expect(resp.id).toBe(13579);
  });
});

// Direct test of underlying decryptChunk + parallel pattern (decryptClient
// import blocked by import.meta.url in jest; reproduce the parallel cap
// behavior at the bare decryptChunk layer to verify semaphore-style cap is
// not needed for correctness — only for CPU throttling.)
describe('Parallel decrypt correctness (R3 #4 §3.15)', () => {
  it('Promise.all over independent chunks recovers plaintext in order', async () => {
    const fileKey = await generateFileKey();
    const chunks = await Promise.all(
      [0, 1, 2, 3].map(async (i) => {
        const iv = await freshChunkIv();
        const aad = chunkAad('alice', i);
        const plaintext = new Uint8Array(64).fill(i);
        const ciphertext = await encryptChunk(plaintext, iv, fileKey, aad);
        return { i, iv, aad, plaintext, ciphertext };
      }),
    );
    const recovered = await Promise.all(
      chunks.map((c) => decryptChunk(c.ciphertext, c.iv, fileKey, c.aad)),
    );
    for (let i = 0; i < chunks.length; i++) {
      expect(Array.from(recovered[i])).toEqual(Array.from(chunks[i].plaintext));
    }
  });
});
