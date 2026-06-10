import sodium from 'libsodium-wrappers';
import { userIdToAad } from './aad';

export { userIdToAad };

// R3 #1 §2.3 + Design A FINAL (wiki #1492) — X25519 keypair + generic AEAD
// helpers. AEAD primitive locked to crypto_aead_xchacha20poly1305_ietf_encrypt
// (R2 #2 §2.1 + R2 #3 §3.1 + R2 #4 §3 cipher lock).
//
// Design A uses these helpers for ONE wrap chain:
//   - aeadWrap(master_privkey, master_key, aad) → master_privkey_wrap_by_master_key
// master_key is KDF-derived from password (see keyDerivation.ts), not wrapped.

let initialized = false;
async function ensureReady(): Promise<typeof sodium> {
  if (!initialized) {
    await sodium.ready;
    initialized = true;
  }
  return sodium;
}

export interface Keypair {
  privateKey: Uint8Array;
  publicKey: Uint8Array;
}

export interface AeadCiphertext {
  ciphertext: Uint8Array;
  nonce: Uint8Array;
}

export async function generateKeypair(): Promise<Keypair> {
  const s = await ensureReady();
  const kp = s.crypto_box_keypair();
  return { privateKey: kp.privateKey, publicKey: kp.publicKey };
}

// XChaCha20-Poly1305-IETF AEAD encrypt. `aad` is bound into the auth tag —
// caller supplies account-UTF8 bytes per Catch 7 lock to prevent cross-user
// ciphertext swap.
export async function aeadWrap(
  plaintext: Uint8Array,
  key: Uint8Array,
  aad: Uint8Array,
): Promise<AeadCiphertext> {
  const s = await ensureReady();
  const nonce = s.randombytes_buf(s.crypto_aead_xchacha20poly1305_ietf_NPUBBYTES);
  const ciphertext = s.crypto_aead_xchacha20poly1305_ietf_encrypt(
    plaintext,
    aad,
    null,
    nonce,
    key,
  );
  return { ciphertext, nonce };
}

export async function aeadUnwrap(
  wrapped: AeadCiphertext,
  key: Uint8Array,
  aad: Uint8Array,
): Promise<Uint8Array> {
  const s = await ensureReady();
  return s.crypto_aead_xchacha20poly1305_ietf_decrypt(
    null,
    wrapped.ciphertext,
    aad,
    wrapped.nonce,
    key,
  );
}

// Wire format per backend #1490 lock — single VARBINARY(80) column stores
// nonce(24) || ciphertext(48) concatenated. Use packWrap/unpackWrap to
// move between AeadCiphertext object and the on-wire byte layout.
export function packWrap(wrap: AeadCiphertext): Uint8Array {
  const out = new Uint8Array(wrap.nonce.length + wrap.ciphertext.length);
  out.set(wrap.nonce, 0);
  out.set(wrap.ciphertext, wrap.nonce.length);
  return out;
}

export function unpackWrap(packed: Uint8Array): AeadCiphertext {
  const NONCE_LEN = 24;
  return {
    nonce: packed.slice(0, NONCE_LEN),
    ciphertext: packed.slice(NONCE_LEN),
  };
}
