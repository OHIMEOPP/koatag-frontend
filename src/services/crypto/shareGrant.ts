import sodium from 'libsodium-wrappers';

// R3 #5 §1.2 — X25519 sealed-box wrap helpers for share grant.
//
// libsodium `crypto_box_seal` allows anyone with recipient's master_pubkey to
// encrypt a key for them; only the recipient (master_privkey holder) can
// open. This is the share-grant primitive: file_key (or thumb_key) sealed
// under grantee.master_pubkey, server passes through opaquely.
//
// Wire size: ephemeral_pubkey(32) + ciphertext + auth_tag(16). For a 32-byte
// payload (file_key / thumb_key) → 32 + 32 + 16 = 80 bytes. Fits backend
// VARBINARY(120) cap with 40-byte headroom.

let initialized = false;
async function ensureReady(): Promise<typeof sodium> {
  if (!initialized) {
    await sodium.ready;
    initialized = true;
  }
  return sodium;
}

export async function wrapKeyForGrantee(
  plainKey: Uint8Array,
  granteePubkey: Uint8Array,
): Promise<Uint8Array> {
  if (!verifyPubkey(granteePubkey)) {
    throw new Error('wrapKeyForGrantee: invalid grantee pubkey (length != 32 or all-zero)');
  }
  const s = await ensureReady();
  return s.crypto_box_seal(plainKey, granteePubkey);
}

export interface MyKeypair {
  publicKey: Uint8Array;
  privateKey: Uint8Array;
}

export async function unwrapKeyForSelf(
  sealed: Uint8Array,
  myKeypair: MyKeypair,
): Promise<Uint8Array> {
  const s = await ensureReady();
  return s.crypto_box_seal_open(sealed, myKeypair.publicKey, myKeypair.privateKey);
}

// Sanity check before submitting to backend — surface 「該使用者尚未升級
// E2EE 系統」UI per §1.6 LOCKED. Length 32 + at least one non-zero byte
// (all-zero pubkey is the sentinel for legacy non-migrated users).
export function verifyPubkey(pubkey: Uint8Array | null | undefined): boolean {
  if (!pubkey || pubkey.length !== 32) return false;
  for (let i = 0; i < 32; i++) {
    if (pubkey[i] !== 0) return true;
  }
  return false;
}
