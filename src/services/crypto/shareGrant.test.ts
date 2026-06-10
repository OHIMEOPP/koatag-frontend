import sodium from 'libsodium-wrappers';
import { wrapKeyForGrantee, unwrapKeyForSelf, verifyPubkey } from './shareGrant';

beforeAll(async () => {
  await sodium.ready;
});

describe('wrapKeyForGrantee / unwrapKeyForSelf (R3 #5 §1.2)', () => {
  it('round-trips a 32-byte file_key through X25519 sealed-box under grantee pubkey', async () => {
    const grantee = sodium.crypto_box_keypair();
    const fileKey = sodium.randombytes_buf(32);

    const sealed = await wrapKeyForGrantee(fileKey, grantee.publicKey);
    // Sealed = 32 (ephemeral pubkey) + 32 (file_key) + 16 (Poly1305 tag) = 80 bytes
    // — fits backend VARBINARY(120) cap with 40-byte headroom.
    expect(sealed.length).toBe(80);

    const recovered = await unwrapKeyForSelf(sealed, {
      publicKey: grantee.publicKey,
      privateKey: grantee.privateKey,
    });
    expect(Array.from(recovered)).toEqual(Array.from(fileKey));
  });

  it('round-trips a 32-byte thumb_key independently of file_key', async () => {
    const grantee = sodium.crypto_box_keypair();
    const thumbKey = sodium.randombytes_buf(32);

    const sealedThumb = await wrapKeyForGrantee(thumbKey, grantee.publicKey);
    const recovered = await unwrapKeyForSelf(sealedThumb, {
      publicKey: grantee.publicKey,
      privateKey: grantee.privateKey,
    });
    expect(Array.from(recovered)).toEqual(Array.from(thumbKey));
  });

  it('different recipients cannot unwrap each other (cross-grantee防護)', async () => {
    const aliceKp = sodium.crypto_box_keypair();
    const bobKp = sodium.crypto_box_keypair();
    const fileKey = sodium.randombytes_buf(32);

    const sealedForAlice = await wrapKeyForGrantee(fileKey, aliceKp.publicKey);
    await expect(
      unwrapKeyForSelf(sealedForAlice, {
        publicKey: bobKp.publicKey,
        privateKey: bobKp.privateKey,
      }),
    ).rejects.toThrow();
  });

  it('rejects wrap to invalid grantee pubkey (length != 32)', async () => {
    const fileKey = sodium.randombytes_buf(32);
    await expect(wrapKeyForGrantee(fileKey, new Uint8Array(16))).rejects.toThrow(/invalid grantee pubkey/);
  });

  it('rejects wrap to zero pubkey (sentinel for non-migrated user)', async () => {
    const fileKey = sodium.randombytes_buf(32);
    await expect(wrapKeyForGrantee(fileKey, new Uint8Array(32))).rejects.toThrow(/invalid grantee pubkey/);
  });

  it('rejects tampered sealed ciphertext', async () => {
    const grantee = sodium.crypto_box_keypair();
    const fileKey = sodium.randombytes_buf(32);
    const sealed = await wrapKeyForGrantee(fileKey, grantee.publicKey);

    const tampered = new Uint8Array(sealed);
    tampered[tampered.length - 1] ^= 0x01;
    await expect(
      unwrapKeyForSelf(tampered, { publicKey: grantee.publicKey, privateKey: grantee.privateKey }),
    ).rejects.toThrow();
  });
});

describe('verifyPubkey (R3 #5 §1.6 LOCKED — pre-submit sanity)', () => {
  it('accepts valid 32-byte non-zero pubkey', () => {
    const kp = sodium.crypto_box_keypair();
    expect(verifyPubkey(kp.publicKey)).toBe(true);
  });

  it('rejects null / undefined', () => {
    expect(verifyPubkey(null)).toBe(false);
    expect(verifyPubkey(undefined)).toBe(false);
  });

  it('rejects wrong length', () => {
    expect(verifyPubkey(new Uint8Array(16))).toBe(false);
    expect(verifyPubkey(new Uint8Array(64))).toBe(false);
  });

  it('rejects all-zero pubkey (non-migrated user sentinel)', () => {
    expect(verifyPubkey(new Uint8Array(32))).toBe(false);
  });

  it('accepts pubkey with a single non-zero byte', () => {
    const pk = new Uint8Array(32);
    pk[31] = 1;
    expect(verifyPubkey(pk)).toBe(true);
  });
});
