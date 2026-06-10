import sodium from 'libsodium-wrappers';
import {
  decryptName,
  unwrapKey,
  encryptName,
  encryptChunk,
  decryptChunk,
  generateFileKey,
  generateThumbKey,
  wrapFileKey,
  freshChunkIv,
  chunkAad,
  sha256,
} from './aead';

beforeAll(async () => {
  await sodium.ready;
});

// ───── R3 #2 decryptName / unwrapKey ─────

describe('unwrapKey (X25519 sealed_box_open)', () => {
  it('recovers file_key from sealed box under correct recipient master keypair', async () => {
    const recipient = sodium.crypto_box_keypair();
    const fileKey = sodium.randombytes_buf(32);
    const sealed = sodium.crypto_box_seal(fileKey, recipient.publicKey);

    const recovered = await unwrapKey(sealed, recipient.publicKey, recipient.privateKey);
    expect(Array.from(recovered)).toEqual(Array.from(fileKey));
  });

  it('rejects sealed box opened with wrong recipient privkey', async () => {
    const recipient = sodium.crypto_box_keypair();
    const other = sodium.crypto_box_keypair();
    const fileKey = sodium.randombytes_buf(32);
    const sealed = sodium.crypto_box_seal(fileKey, recipient.publicKey);
    await expect(unwrapKey(sealed, other.publicKey, other.privateKey)).rejects.toThrow();
  });

  it('rejects tampered ciphertext', async () => {
    const recipient = sodium.crypto_box_keypair();
    const fileKey = sodium.randombytes_buf(32);
    const sealed = sodium.crypto_box_seal(fileKey, recipient.publicKey);
    const tampered = new Uint8Array(sealed);
    tampered[tampered.length - 1] ^= 0x01;
    await expect(unwrapKey(tampered, recipient.publicKey, recipient.privateKey)).rejects.toThrow();
  });
});

describe('decryptName (XChaCha20-Poly1305 decrypt)', () => {
  function encrypt(plaintext: string, key: Uint8Array): { ciphertext: Uint8Array; iv: Uint8Array } {
    const iv = sodium.randombytes_buf(24);
    const pt = Uint8Array.from(new TextEncoder().encode(plaintext));
    const ciphertext = sodium.crypto_aead_xchacha20poly1305_ietf_encrypt(pt, null, null, iv, key);
    return { ciphertext, iv };
  }

  it('round-trips UTF-8 plaintext', async () => {
    const fileKey = sodium.randombytes_buf(32);
    const { ciphertext, iv } = encrypt('photo.jpg', fileKey);
    expect(await decryptName(ciphertext, iv, fileKey)).toBe('photo.jpg');
  });

  it('round-trips unicode filenames', async () => {
    const fileKey = sodium.randombytes_buf(32);
    const { ciphertext, iv } = encrypt('家族旅遊 2026.jpg', fileKey);
    expect(await decryptName(ciphertext, iv, fileKey)).toBe('家族旅遊 2026.jpg');
  });

  it('rejects wrong fileKey', async () => {
    const fileKey = sodium.randombytes_buf(32);
    const { ciphertext, iv } = encrypt('photo.jpg', fileKey);
    await expect(decryptName(ciphertext, iv, sodium.randombytes_buf(32))).rejects.toThrow();
  });

  it('rejects tampered ciphertext', async () => {
    const fileKey = sodium.randombytes_buf(32);
    const { ciphertext, iv } = encrypt('photo.jpg', fileKey);
    const tampered = new Uint8Array(ciphertext);
    tampered[0] ^= 0x01;
    await expect(decryptName(tampered, iv, fileKey)).rejects.toThrow();
  });

  it('rejects wrong nonce', async () => {
    const fileKey = sodium.randombytes_buf(32);
    const { ciphertext } = encrypt('photo.jpg', fileKey);
    await expect(decryptName(ciphertext, sodium.randombytes_buf(24), fileKey)).rejects.toThrow();
  });
});

// ───── R3 #3 encrypt counterparts ─────

describe('generateFileKey / generateThumbKey (R3 #3 Default 2)', () => {
  it('produces 32-byte CSPRNG output', async () => {
    const k = await generateFileKey();
    expect(k).toBeInstanceOf(Uint8Array);
    expect(k).toHaveLength(32);
  });

  it('produces unique keys on each call', async () => {
    const a = await generateFileKey();
    const b = await generateFileKey();
    expect(Array.from(a)).not.toEqual(Array.from(b));
  });

  it('generateThumbKey is independent from generateFileKey calls (defense-in-depth)', async () => {
    const fileKey = await generateFileKey();
    const thumbKey = await generateThumbKey();
    expect(Array.from(fileKey)).not.toEqual(Array.from(thumbKey));
  });
});

describe('wrapFileKey (X25519 sealed box)', () => {
  it('round-trips with unwrapKey', async () => {
    const recipient = sodium.crypto_box_keypair();
    const fileKey = await generateFileKey();
    const wrapped = await wrapFileKey(fileKey, recipient.publicKey);
    expect(wrapped).toBeInstanceOf(Uint8Array);
    // crypto_box_seal output = 32-byte ephemeral pubkey + plaintext + 16-byte tag
    // For 32-byte fileKey: 32 + 32 + 16 = 80 bytes.
    expect(wrapped.length).toBe(80);

    const recovered = await unwrapKey(wrapped, recipient.publicKey, recipient.privateKey);
    expect(Array.from(recovered)).toEqual(Array.from(fileKey));
  });

  it('different recipient cannot unwrap (cross-user binding via pubkey)', async () => {
    const recipient = sodium.crypto_box_keypair();
    const stranger = sodium.crypto_box_keypair();
    const fileKey = await generateFileKey();
    const wrapped = await wrapFileKey(fileKey, recipient.publicKey);
    await expect(unwrapKey(wrapped, stranger.publicKey, stranger.privateKey)).rejects.toThrow();
  });
});

describe('encryptName round-trip', () => {
  it('round-trips with decryptName under same fileKey', async () => {
    const fileKey = await generateFileKey();
    const { ciphertext, iv } = await encryptName('photo.jpg', fileKey);
    expect(iv).toHaveLength(24);
    expect(ciphertext.length).toBeGreaterThan(9); // plaintext 9 + tag 16
    const recovered = await decryptName(ciphertext, iv, fileKey);
    expect(recovered).toBe('photo.jpg');
  });

  it('uses fresh IV per call (probabilistic uniqueness)', async () => {
    const fileKey = await generateFileKey();
    const a = await encryptName('a.txt', fileKey);
    const b = await encryptName('a.txt', fileKey);
    expect(Array.from(a.iv)).not.toEqual(Array.from(b.iv));
    expect(Array.from(a.ciphertext)).not.toEqual(Array.from(b.ciphertext));
  });

  it('handles unicode plaintext', async () => {
    const fileKey = await generateFileKey();
    const { ciphertext, iv } = await encryptName('機密文件.pdf', fileKey);
    expect(await decryptName(ciphertext, iv, fileKey)).toBe('機密文件.pdf');
  });
});

describe('encryptChunk / decryptChunk round-trip with AAD (R3 #3 §1.1)', () => {
  it('round-trips chunk plaintext with same key + IV + AAD', async () => {
    const fileKey = await generateFileKey();
    const iv = await freshChunkIv();
    const aad = chunkAad('alice@example.com', 0);
    const plaintext = new Uint8Array(1024).fill(0x77);

    const ciphertext = await encryptChunk(plaintext, iv, fileKey, aad);
    expect(ciphertext.length).toBe(plaintext.length + 16); // 16-byte Poly1305 tag

    const recovered = await decryptChunk(ciphertext, iv, fileKey, aad);
    expect(Array.from(recovered)).toEqual(Array.from(plaintext));
  });

  it('rejects decrypt with wrong AAD (cross-user / chunk-reorder防護)', async () => {
    const fileKey = await generateFileKey();
    const iv = await freshChunkIv();
    const plaintext = new Uint8Array(1024).fill(0x77);

    const ciphertext = await encryptChunk(plaintext, iv, fileKey, chunkAad('alice', 0));
    await expect(decryptChunk(ciphertext, iv, fileKey, chunkAad('alice', 1))).rejects.toThrow();
    await expect(decryptChunk(ciphertext, iv, fileKey, chunkAad('bob', 0))).rejects.toThrow();
  });

  it('rejects decrypt with wrong fileKey', async () => {
    const fileKey = await generateFileKey();
    const iv = await freshChunkIv();
    const aad = chunkAad('alice', 0);
    const plaintext = new Uint8Array(64).fill(0x55);
    const ciphertext = await encryptChunk(plaintext, iv, fileKey, aad);
    await expect(
      decryptChunk(ciphertext, iv, await generateFileKey(), aad),
    ).rejects.toThrow();
  });

  it('freshChunkIv yields 24-byte unique nonces', async () => {
    const a = await freshChunkIv();
    const b = await freshChunkIv();
    expect(a).toHaveLength(24);
    expect(b).toHaveLength(24);
    expect(Array.from(a)).not.toEqual(Array.from(b));
  });
});

describe('chunkAad encoding (R3 #3 Default 3)', () => {
  it('encodes account UTF-8 || uint32BE(chunk_index)', () => {
    const aad = chunkAad('ab', 0x01020304);
    // 'a','b' = 0x61, 0x62 + 0x01 0x02 0x03 0x04 BE
    expect(Array.from(aad)).toEqual([0x61, 0x62, 0x01, 0x02, 0x03, 0x04]);
  });

  it('big-endian for chunk_index 1', () => {
    const aad = chunkAad('', 1);
    expect(Array.from(aad)).toEqual([0, 0, 0, 1]);
  });

  it('handles unicode accounts', () => {
    const aad = chunkAad('用戶', 0);
    // 用戶 in UTF-8 = 6 bytes + 4 = 10 bytes total
    expect(aad.length).toBe(10);
  });
});

describe('sha256 (R3 #3 Catch 12 Path C X-Chunk-Hash header)', () => {
  it('produces 32-byte digest', async () => {
    const digest = await sha256(new Uint8Array([1, 2, 3]));
    expect(digest).toBeInstanceOf(Uint8Array);
    expect(digest).toHaveLength(32);
  });

  it('empty input has known digest (e3b0c4...)', async () => {
    const digest = await sha256(new Uint8Array(0));
    // SHA-256("") = e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
    const hex = Array.from(digest)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
    expect(hex).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
  });

  it('is deterministic for the same input', async () => {
    const input = new Uint8Array(64).fill(0x42);
    const a = await sha256(input);
    const b = await sha256(input);
    expect(Array.from(a)).toEqual(Array.from(b));
  });
});

describe('Full chain: unwrapKey → decryptName (R3 #2 + #3 round-trip)', () => {
  it('encryptName/wrapFileKey produces server-storable blobs that decrypt back', async () => {
    const recipient = sodium.crypto_box_keypair();
    const fileKey = await generateFileKey();
    const { ciphertext, iv } = await encryptName('secret.pdf', fileKey);
    const keyWrap = await wrapFileKey(fileKey, recipient.publicKey);

    // Server stores: keyWrap (sealed box) + ciphertext (encrypted name) + iv (nonce).
    // Client recovers:
    const recoveredKey = await unwrapKey(keyWrap, recipient.publicKey, recipient.privateKey);
    const recoveredName = await decryptName(ciphertext, iv, recoveredKey);
    expect(recoveredName).toBe('secret.pdf');
    expect(Array.from(recoveredKey)).toEqual(Array.from(fileKey));
  });
});
