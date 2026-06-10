import {
  generateKeypair,
  aeadWrap,
  aeadUnwrap,
  packWrap,
  unpackWrap,
  userIdToAad,
} from './keypair';
import sodium from 'libsodium-wrappers';

beforeAll(async () => {
  await sodium.ready;
});

describe('generateKeypair', () => {
  it('produces a 32-byte X25519 keypair', async () => {
    const kp = await generateKeypair();
    expect(kp.privateKey).toBeInstanceOf(Uint8Array);
    expect(kp.publicKey).toBeInstanceOf(Uint8Array);
    expect(kp.privateKey).toHaveLength(32);
    expect(kp.publicKey).toHaveLength(32);
  });

  it('produces unique keypairs on each call', async () => {
    const a = await generateKeypair();
    const b = await generateKeypair();
    expect(Array.from(a.privateKey)).not.toEqual(Array.from(b.privateKey));
    expect(Array.from(a.publicKey)).not.toEqual(Array.from(b.publicKey));
  });
});

describe('aeadWrap / aeadUnwrap round-trip (Design A — wrap master_privkey by master_key)', () => {
  const key = new Uint8Array(32).fill(0x42);
  const aad = userIdToAad('alice@example.com');

  it('round-trips arbitrary plaintext under same key + AAD', async () => {
    const plaintext = new Uint8Array(32).fill(0x77);
    const wrapped = await aeadWrap(plaintext, key, aad);
    expect(wrapped.ciphertext.length).toBeGreaterThan(plaintext.length);
    expect(wrapped.nonce).toHaveLength(24);

    const recovered = await aeadUnwrap(wrapped, key, aad);
    expect(Array.from(recovered)).toEqual(Array.from(plaintext));
  });

  it('rejects unwrap with wrong key (AEAD auth tag fails)', async () => {
    const plaintext = new Uint8Array(32).fill(0x77);
    const wrapped = await aeadWrap(plaintext, key, aad);
    const wrongKey = new Uint8Array(32).fill(0x99);
    await expect(aeadUnwrap(wrapped, wrongKey, aad)).rejects.toThrow();
  });

  it('rejects unwrap with wrong AAD (cross-user swap防護)', async () => {
    const plaintext = new Uint8Array(32).fill(0x77);
    const wrapped = await aeadWrap(plaintext, key, userIdToAad('alice'));
    await expect(aeadUnwrap(wrapped, key, userIdToAad('bob'))).rejects.toThrow();
  });

  it('rejects tampered ciphertext', async () => {
    const plaintext = new Uint8Array(32).fill(0x77);
    const wrapped = await aeadWrap(plaintext, key, aad);
    const tampered = { ...wrapped, ciphertext: new Uint8Array(wrapped.ciphertext) };
    tampered.ciphertext[0] ^= 0x01;
    await expect(aeadUnwrap(tampered, key, aad)).rejects.toThrow();
  });
});

describe('packWrap / unpackWrap (wire format: nonce(24) || ciphertext)', () => {
  it('round-trips through wire format', async () => {
    const key = new Uint8Array(32).fill(0x42);
    const aad = userIdToAad('alice');
    const privkey = (await generateKeypair()).privateKey;

    const wrapped = await aeadWrap(privkey, key, aad);
    const packed = packWrap(wrapped);
    // backend #1490 lock: 80-byte VARBINARY column, payload = 24 + 32 + 16 tag = 72.
    expect(packed.length).toBe(72);
    expect(Array.from(packed.slice(0, 24))).toEqual(Array.from(wrapped.nonce));

    const unpacked = unpackWrap(packed);
    const recovered = await aeadUnwrap(unpacked, key, aad);
    expect(Array.from(recovered)).toEqual(Array.from(privkey));
  });
});

describe('userIdToAad', () => {
  it('encodes account UTF-8 as Uint8Array', () => {
    const bytes = userIdToAad('user');
    expect(bytes).toEqual(new Uint8Array([117, 115, 101, 114]));
  });

  it('handles unicode account strings', () => {
    const bytes = userIdToAad('王小明');
    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(bytes.length).toBeGreaterThan(3);
  });
});
