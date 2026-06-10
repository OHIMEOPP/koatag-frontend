import sodium from 'libsodium-wrappers';

// R3 #2 §1.3 + R3 #3 §1.1 — crypto helpers for drive_files / drive_folders
// ciphertext columns + upload pipeline.
//
// Wrap chain per R2 #2 §2.1.1 + §2.1.2:
//   drive_files.key_wrap  = crypto_box_seal(file_key, owner.master_pubkey)
//   drive_files.name_iv   = 24-byte XChaCha20 nonce
//   drive_files.name_encrypted = crypto_aead_xchacha20poly1305_ietf_encrypt(name, null, name_iv, file_key)
//
// Per-chunk pattern (R2 #3 §2.1.9 chunk-then-encrypt):
//   drive_file_chunks.chunk_iv = 24-byte per-chunk independent XChaCha20 nonce
//   chunk_ciphertext = crypto_aead_xchacha20poly1305_ietf_encrypt(plaintext, aad, null, chunk_iv, file_key)
//   AAD = account UTF-8 || uint32BE(chunk_index) (R3 #3 Default 3 — defense-in-depth
//   against cross-user swap + chunk reorder).

let initialized = false;
async function ensureReady(): Promise<typeof sodium> {
  if (!initialized) {
    await sodium.ready;
    initialized = true;
  }
  return sodium;
}

// ───── R3 #2: Decrypt helpers ─────

export async function unwrapKey(
  keyWrap: Uint8Array,
  recipientPubkey: Uint8Array,
  recipientPrivkey: Uint8Array,
): Promise<Uint8Array> {
  const s = await ensureReady();
  return s.crypto_box_seal_open(keyWrap, recipientPubkey, recipientPrivkey);
}

// R3 #4 §1.1 — semantic aliases over generic unwrapKey. file_key vs
// thumb_key are separate AEAD keys (defense-in-depth per R3 #3 Default 2)
// so distinct names at the call site improves grep-ability + intent docs.
export const unwrapFileKey = unwrapKey;
export const unwrapThumbKey = unwrapKey;

export async function decryptName(
  nameCiphertext: Uint8Array,
  iv: Uint8Array,
  fileKey: Uint8Array,
): Promise<string> {
  const s = await ensureReady();
  const bytes = s.crypto_aead_xchacha20poly1305_ietf_decrypt(
    null,
    nameCiphertext,
    null,
    iv,
    fileKey,
  );
  return new TextDecoder().decode(bytes);
}

// ───── R3 #3 §1.1: Encrypt counterparts ─────

// Generate a fresh random 32-byte key (CSPRNG). Used for file_key + thumb_key
// (both 32-byte XChaCha20-Poly1305 AEAD keys). Default 2 lock — thumb_key is
// independent of file_key for defense-in-depth (XSS on thumb-decrypt doesn't
// leak file_key).
export async function generateFileKey(): Promise<Uint8Array> {
  const s = await ensureReady();
  return s.randombytes_buf(32);
}

// Alias for readability — generateThumbKey === generateFileKey (same algo,
// separate key).
export const generateThumbKey = generateFileKey;

// X25519 sealed-box wrap. Encrypts a 32-byte key for the holder of
// recipientPubkey (anyone can seal; only privkey holder can open). Used to
// wrap file_key / thumb_key / folder_key under owner.master_pubkey.
export async function wrapFileKey(
  fileKey: Uint8Array,
  recipientPubkey: Uint8Array,
): Promise<Uint8Array> {
  const s = await ensureReady();
  return s.crypto_box_seal(fileKey, recipientPubkey);
}

// Mirror of decryptName.
export async function encryptName(
  plaintext: string,
  fileKey: Uint8Array,
): Promise<{ ciphertext: Uint8Array; iv: Uint8Array }> {
  const s = await ensureReady();
  const iv = s.randombytes_buf(24);
  const ciphertext = s.crypto_aead_xchacha20poly1305_ietf_encrypt(
    Uint8Array.from(new TextEncoder().encode(plaintext)),
    null,
    null,
    iv,
    fileKey,
  );
  return { ciphertext, iv };
}

// Path B single-blob ciphertext (< 50MB). Same AEAD as encryptName but binary
// payload (file bytes) and null AAD — cross-user binding is provided by
// key_wrap (X25519 sealed-box under master_pubkey).
export async function encryptBlob(
  plaintext: Uint8Array,
  fileKey: Uint8Array,
): Promise<{ ciphertext: Uint8Array; iv: Uint8Array }> {
  const s = await ensureReady();
  const iv = s.randombytes_buf(24);
  const ciphertext = s.crypto_aead_xchacha20poly1305_ietf_encrypt(
    plaintext,
    null,
    null,
    iv,
    fileKey,
  );
  return { ciphertext, iv };
}

export async function decryptBlob(
  ciphertext: Uint8Array,
  iv: Uint8Array,
  fileKey: Uint8Array,
): Promise<Uint8Array> {
  const s = await ensureReady();
  return s.crypto_aead_xchacha20poly1305_ietf_decrypt(null, ciphertext, null, iv, fileKey);
}

// Per-chunk encrypt with caller-provided IV + AAD. Independent per chunk so
// finalize order is enforced by file_chunks.chunk_index, not by AEAD streaming
// state. Caller MUST use a fresh 24-byte nonce per chunk (chunkIvFor helper).
export async function encryptChunk(
  plaintext: Uint8Array,
  chunkIv: Uint8Array,
  fileKey: Uint8Array,
  aad: Uint8Array,
): Promise<Uint8Array> {
  const s = await ensureReady();
  return s.crypto_aead_xchacha20poly1305_ietf_encrypt(plaintext, aad, null, chunkIv, fileKey);
}

export async function decryptChunk(
  ciphertext: Uint8Array,
  chunkIv: Uint8Array,
  fileKey: Uint8Array,
  aad: Uint8Array,
): Promise<Uint8Array> {
  const s = await ensureReady();
  return s.crypto_aead_xchacha20poly1305_ietf_decrypt(null, ciphertext, aad, chunkIv, fileKey);
}

export async function freshChunkIv(): Promise<Uint8Array> {
  const s = await ensureReady();
  return s.randombytes_buf(24);
}

// R3 #3 Default 3 AAD encoding: account UTF-8 bytes || uint32 big-endian
// chunk_index. Backend must use identical encoding to verify.
export function chunkAad(account: string, chunkIndex: number): Uint8Array {
  const accountBytes = Uint8Array.from(new TextEncoder().encode(account));
  const out = new Uint8Array(accountBytes.length + 4);
  out.set(accountBytes, 0);
  new DataView(out.buffer).setUint32(accountBytes.length, chunkIndex, false);
  return out;
}

// SHA-256 helper — used for chunk integrity (Path C `X-Chunk-Hash` header
// per R2 #3 §2.1.1 chunk_hash BINARY(32) column / Catch 12 mixed pattern).
// libsodium-wrappers default build omits crypto_hash_sha256 (sumo-only); use
// @noble/hashes (already in deps for KDF) for clean SHA-256 access.
export async function sha256(bytes: Uint8Array): Promise<Uint8Array> {
  // Lazy import to keep aead.ts startup light. @noble/hashes/sha2.js is ESM;
  // transformIgnorePatterns allowlists it.
  const { sha256: nobleSha256 } = await import('@noble/hashes/sha2.js');
  return Uint8Array.from(nobleSha256(bytes));
}
