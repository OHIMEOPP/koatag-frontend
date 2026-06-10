// R3 #1 Catch 7 lock — AEAD AAD encoding contract.
//
// account UTF-8 bytes is the AAD source bound into ciphertext for master_privkey
// wrap (and any future per-user ciphertext binding). Backend PHP side uses the
// same encoding: a PHP string IS bytes, so `$account` is the AAD as-is.
//
// account is chosen over user_id because:
//   - users.account is UNIQUE (per koatag users table reality)
//   - frontend knows account at register-time (no chicken-egg pre user_id)
//   - account is stable across login (rename is a separate flow if ever added)
//
// MUST match backend `userIdToAad($account)` byte-for-byte.

export function userIdToAad(account: string): Uint8Array {
  // Re-wrap as plain Uint8Array — under Node test runtime TextEncoder may
  // return a Buffer subclass which fails strict structural equality in jest.
  return Uint8Array.from(new TextEncoder().encode(account));
}
