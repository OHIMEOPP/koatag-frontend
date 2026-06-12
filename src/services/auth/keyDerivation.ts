// @noble/hashes 2.x exports paths require the `.js` suffix
// (per node_modules/@noble/hashes/package.json `exports` field).
import { argon2idAsync } from '@noble/hashes/argon2.js';

// Argon2id KDF params. Round 1 baseline B was m=64MB t=3 p=2, but R4 (mailbox
// #2046/#2048) realigned parallelism to p=1: backend server-side enroll wraps
// master_privkey using libsodium crypto_pwhash, which hard-locks parallelism=1
// and cannot do p=2. Since no real p=2 wrap exists in the system (0 real
// frontend-registered users per #2015; ephemeral test users carry clear
// privkeys; id=1,2 enrolled at p=1), the whole system aligns to p=1 — verified
// by decrypting id=1's real wrap (p=1 ✓, p=2 ✗). Security-equivalent: p is
// lanes, p=1 is the common default (Bitcoin/MetaMask); m/t unchanged.
//
// Lib choice: @noble/hashes/argon2 (pure JS) instead of argon2-browser (WASM).
// argon2-browser main entry requires Node's `path` module which webpack 5
// (CRA 5) no longer polyfills; its bundled UMD entry still expects external
// .wasm fetch that CRA doesn't bundle by default. @noble/hashes is already
// in deps for SHA256 helpers, ships clean ESM, and runs fine in jest+jsdom.
// Performance trade-off captured as R3 #1 Catch 8 — flag to wiki for review.
const KDF_PARAMS = {
  t: 3,
  m: 65536,
  p: 1,
  dkLen: 32,
  asyncTick: 10,
} as const;

export interface DeriveBundleSalts {
  auth_kdf_salt: string;
  master_key_kdf_salt: string;
}

export interface KdfParams {
  m: number;
  t: number;
  p: number;
  algorithm: 'argon2id';
}

// R3 #1 Design A FINAL (wiki #1492 retract #1489) — KDF outputs both keys
// directly. master_key is the AEAD key used to wrap master_privkey; it is
// deterministically derived from password+master_key_kdf_salt, NOT random.
//   - auth_password_hash → posted to /login to prove identity
//   - master_key         → AEAD key for master_privkey wrap chain
export interface AuthBundle {
  auth_password_hash: Uint8Array;
  master_key: Uint8Array;
}

function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// Derive auth_password_hash + master_key from password + per-purpose salts.
// Caller must verify backend-supplied kdf_params match KDF_PARAMS (guard
// against downgrade attack). Use assertKdfParams() before calling derive.
export async function deriveAuthBundle(
  password: string,
  salts: DeriveBundleSalts,
): Promise<AuthBundle> {
  const authSalt = base64ToBytes(salts.auth_kdf_salt);
  const masterSalt = base64ToBytes(salts.master_key_kdf_salt);

  const [authHash, masterKey] = await Promise.all([
    argon2idAsync(password, authSalt, KDF_PARAMS),
    argon2idAsync(password, masterSalt, KDF_PARAMS),
  ]);

  return { auth_password_hash: authHash, master_key: masterKey };
}

export function assertKdfParams(params: KdfParams): void {
  if (
    params.algorithm !== 'argon2id' ||
    params.m !== KDF_PARAMS.m ||
    params.t !== KDF_PARAMS.t ||
    params.p !== KDF_PARAMS.p
  ) {
    throw new Error(
      `kdf_params mismatch: expected argon2id m=${KDF_PARAMS.m} t=${KDF_PARAMS.t} p=${KDF_PARAMS.p}, got ${params.algorithm} m=${params.m} t=${params.t} p=${params.p}`,
    );
  }
}
