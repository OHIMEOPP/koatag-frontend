import { argon2idAsync } from '@noble/hashes/argon2.js';
import { aeadUnwrap, type AeadCiphertext } from '../auth/keypair';

// R3 #4 §1.7 — share-link password-derived key + file_key unwrap.
//
// Flow (per R2 #2 §3.12 + R3 #4 §1.7):
//   1. user types password on share-link landing page
//   2. linkKey = Argon2id(password, link_kdf_salt)
//   3. fileKey = AEAD.decrypt(wrapped_key_for_link, linkKey)
//   4. proceed with chunked decrypt using fileKey
//
// AAD for link-wrapped file_key — per R2 spec: link share_link.id+salt-based
// binding (server doesn't see fileKey). Caller supplies AAD bytes; default
// scheme uses no AAD (link_kdf_salt+nonce provides binding). Wire format
// matches R3 #1 packWrap (nonce || ciphertext).
//
// KDF params lock per R3 #1 Argon2id baseline:
//   m=64MB (65536 KiB), t=3, p=2, dkLen=32

const LINK_KDF_PARAMS = {
  t: 3,
  m: 65536,
  p: 2,
  dkLen: 32,
  asyncTick: 10,
} as const;

function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/**
 * Derive a 32-byte link-key from password + per-link salt (Argon2id).
 *
 * Per UX expectation (~1s under R3 #1 Catch 8 @noble pure-JS path), caller
 * shows "驗證中... 約 1 秒" phase text. Wrong password fails at AEAD decrypt
 * (next step) — KDF itself always succeeds.
 */
export async function deriveLinkKey(
  password: string,
  linkKdfSalt: Uint8Array,
): Promise<Uint8Array> {
  return argon2idAsync(password, linkKdfSalt, LINK_KDF_PARAMS);
}

/**
 * Unwrap file_key from wrapped_key_for_link using the password-derived
 * linkKey. Wire format: packed nonce(24) || ciphertext(48) matching R3 #1
 * Design A `packWrap` output.
 */
export async function unwrapFileKeyFromLink(
  wrappedKeyForLink: Uint8Array,
  linkKey: Uint8Array,
  account: string = "",
): Promise<Uint8Array> {
  // account AAD — empty string by default for share-link path (the link
  // token + link_kdf_salt provides per-link binding; AAD bound to account
  // would prevent share since grantee is anonymous).
  const aad = Uint8Array.from(new TextEncoder().encode(account));
  // Wire: nonce(24) || ciphertext+tag(48) per packWrap layout.
  const NONCE_LEN = 24;
  const wrap: AeadCiphertext = {
    nonce: wrappedKeyForLink.slice(0, NONCE_LEN),
    ciphertext: wrappedKeyForLink.slice(NONCE_LEN),
  };
  return aeadUnwrap(wrap, linkKey, aad);
}

/**
 * Convenience: derive linkKey + unwrap file_key in one shot.
 *
 * Caller flow (post-Catch 14 UI wire deferred to R3 housekeeping):
 *   const fileKey = await deriveAndUnwrapFromLink(
 *     password,
 *     base64ToBytes(meta.link_kdf_salt),
 *     base64ToBytes(meta.wrapped_key_for_link),
 *   );
 *   // then GET chunks manifest with session_token + decrypt loop
 */
export async function deriveAndUnwrapFromLink(
  password: string,
  linkKdfSalt: Uint8Array,
  wrappedKeyForLink: Uint8Array,
  account: string = "",
): Promise<Uint8Array> {
  const linkKey = await deriveLinkKey(password, linkKdfSalt);
  return unwrapFileKeyFromLink(wrappedKeyForLink, linkKey, account);
}

export { base64ToBytes as _base64ToBytes };
