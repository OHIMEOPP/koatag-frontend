import sodium from 'libsodium-wrappers';
import {
  handleEncryptMessage,
  type EncryptChunkRequest,
} from './encryptWorker';
import { decryptChunk, chunkAad, generateFileKey, freshChunkIv } from './aead';
// NOTE: encryptWorkerClient.ts uses `import.meta.url` for webpack 5 worker
// bundling — jest CJS parser barfs on the syntax. Client fallback is just
// `encryptChunk` passthrough (already tested in aead.test.ts), so we test
// only the pure handler contract here. Browser integration smoke covers the
// Worker live path (deferred per dispatch §2).

beforeAll(async () => {
  await sodium.ready;
});

describe('encryptWorker.handleEncryptMessage (R3 #3 §1.3 message contract)', () => {
  it('encrypts chunk via message contract; ciphertext decrypts back', async () => {
    const fileKey = await generateFileKey();
    const iv = await freshChunkIv();
    const aad = chunkAad('alice', 0);
    const plaintext = new Uint8Array(2048).fill(0x55);

    const req: EncryptChunkRequest = {
      cmd: 'encrypt-chunk',
      id: 42,
      plaintext,
      chunkIv: iv,
      fileKey,
      aad,
    };
    const resp = await handleEncryptMessage(req);

    expect(resp.id).toBe(42);
    expect(resp.error).toBeUndefined();
    expect(resp.ciphertext).toBeInstanceOf(Uint8Array);
    expect(resp.ciphertext!.length).toBe(plaintext.length + 16);

    const recovered = await decryptChunk(resp.ciphertext!, iv, fileKey, aad);
    expect(Array.from(recovered)).toEqual(Array.from(plaintext));
  });

  it('returns error response for unknown cmd', async () => {
    const resp = await handleEncryptMessage({
      cmd: 'bogus' as 'encrypt-chunk',
      id: 1,
      plaintext: new Uint8Array(),
      chunkIv: new Uint8Array(24),
      fileKey: new Uint8Array(32),
      aad: new Uint8Array(),
    });
    expect(resp.error).toMatch(/unknown cmd/);
    expect(resp.ciphertext).toBeUndefined();
  });

  it('preserves request id in error responses (so caller can route)', async () => {
    // Force an internal throw by passing a wrong-length fileKey
    const resp = await handleEncryptMessage({
      cmd: 'encrypt-chunk',
      id: 99,
      plaintext: new Uint8Array(10),
      chunkIv: new Uint8Array(24),
      fileKey: new Uint8Array(31), // wrong length — libsodium will throw
      aad: new Uint8Array(),
    });
    expect(resp.id).toBe(99);
    expect(resp.error).toBeDefined();
  });
});

