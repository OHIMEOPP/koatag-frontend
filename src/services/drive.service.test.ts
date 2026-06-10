// R3 #2 §1.2 + §1.5 — drive.service decrypt + per-row error handling tests.
//
// Tests the exported internals `_decryptDriveFile` / `_decryptDriveFolder`
// directly (mocking axios is out of scope; these helpers contain all the
// E2EE-specific logic). Backend integration is exercised separately when
// dual-mode endpoint ships (deferred per dispatch §2).
import sodium from 'libsodium-wrappers';
import {
  _decryptDriveFile,
  _decryptDriveFolder,
  _parseNamePayload,
  _placeholders,
  _sortAndFilterEncrypted,
  DriveFile,
  DriveFolder,
} from './drive.service';
import { setKeyBundleRef } from '../contexts/MasterKeyContext';

function bytesToB64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function utf8ToBytes(s: string): Uint8Array {
  return Uint8Array.from(new TextEncoder().encode(s));
}

// Build a fully-formed encrypted DriveFile + cleartext recipient key bundle.
// R3 #7 §2.2.4 — the encrypted name field now wraps a JSON {name, mime} payload
// (set `rawName` to encrypt a bare string instead, to exercise the legacy /
// parse-fail fallback path).
function buildEncryptedFile(opts: {
  name: string;
  payloadMime?: string;
  mime_claimed?: string;
  rawName?: boolean;
  recipientPubkey: Uint8Array;
}): DriveFile {
  const fileKey = sodium.randombytes_buf(32);
  const iv = sodium.randombytes_buf(24);
  const plaintext = opts.rawName
    ? opts.name
    : JSON.stringify({
        name: opts.name,
        mime: opts.payloadMime ?? 'application/octet-stream',
      });
  const nameCiphertext = sodium.crypto_aead_xchacha20poly1305_ietf_encrypt(
    utf8ToBytes(plaintext),
    null,
    null,
    iv,
    fileKey,
  );
  const keyWrap = sodium.crypto_box_seal(fileKey, opts.recipientPubkey);

  return {
    id: 1,
    owner_id: 1,
    folder_id: null,
    name: '',
    mime: 'application/octet-stream',
    size_bytes: 1024,
    checksum_sha1: 'x',
    thumb_path: null,
    image_data_id: null,
    created_at: '2026-05-27',
    updated_at: '2026-05-27',
    deleted_at: null,
    name_encrypted: bytesToB64(nameCiphertext),
    name_iv: bytesToB64(iv),
    key_wrap: bytesToB64(keyWrap),
    mime_claimed: opts.mime_claimed ?? null,
    is_encrypted: true,
  };
}

beforeAll(async () => {
  await sodium.ready;
});

beforeEach(() => {
  // Default: no keys (force unauthenticated path). Tests that need a real
  // bundle call setKeyBundleRef explicitly.
  setKeyBundleRef({ masterKey: null, masterPrivkey: null, masterPubkey: null });
});

describe('_decryptDriveFile (R3 #2 §1.2 + §1.5)', () => {
  it('passes through plaintext rows unchanged (is_encrypted=false)', async () => {
    const plain: DriveFile = {
      id: 1,
      owner_id: 1,
      folder_id: null,
      name: 'photo.jpg',
      mime: 'image/jpeg',
      size_bytes: 1024,
      checksum_sha1: 'x',
      thumb_path: null,
      image_data_id: null,
      created_at: '2026-05-27',
      updated_at: '2026-05-27',
      deleted_at: null,
      is_encrypted: false,
    };
    const result = await _decryptDriveFile(plain);
    expect(result).toBe(plain); // same reference — no copy for plaintext
  });

  it('returns SCHEMA_INCOMPLETE placeholder when encrypted row missing key_wrap', async () => {
    const recipient = sodium.crypto_box_keypair();
    setKeyBundleRef({
      masterKey: new Uint8Array(32),
      masterPrivkey: recipient.privateKey,
      masterPubkey: recipient.publicKey,
    });
    const broken = buildEncryptedFile({
      name: 'x.txt',
      recipientPubkey: recipient.publicKey,
    });
    delete broken.key_wrap;
    const result = await _decryptDriveFile(broken);
    expect(result.name).toBe(_placeholders.schemaIncomplete);
  });

  it('returns KEYS_MISSING placeholder when master_privkey absent (not logged in)', async () => {
    const recipient = sodium.crypto_box_keypair();
    const enc = buildEncryptedFile({ name: 'x.txt', recipientPubkey: recipient.publicKey });
    // bundle ref is empty (per beforeEach reset)
    const result = await _decryptDriveFile(enc);
    expect(result.name).toBe(_placeholders.keysMissing);
  });

  it('returns DECRYPT placeholder when wrong master keypair (cross-user)', async () => {
    const recipient = sodium.crypto_box_keypair();
    const stranger = sodium.crypto_box_keypair();
    setKeyBundleRef({
      masterKey: new Uint8Array(32),
      masterPrivkey: stranger.privateKey,
      masterPubkey: stranger.publicKey,
    });
    const enc = buildEncryptedFile({ name: 'x.txt', recipientPubkey: recipient.publicKey });
    const result = await _decryptDriveFile(enc);
    expect(result.name).toBe(_placeholders.decrypt);
  });

  it('decrypts name + mime from ciphertext JSON payload, ignoring mime_claimed', async () => {
    const recipient = sodium.crypto_box_keypair();
    setKeyBundleRef({
      masterKey: new Uint8Array(32),
      masterPrivkey: recipient.privateKey,
      masterPubkey: recipient.publicKey,
    });
    // R3 #7 §2.2.4 — decoy mime_claimed proves the UI uses the payload mime, not
    // the low-trust audit column.
    const enc = buildEncryptedFile({
      name: '家族旅遊 2026.jpg',
      payloadMime: 'image/jpeg',
      mime_claimed: 'application/x-decoy',
      recipientPubkey: recipient.publicKey,
    });
    const result = await _decryptDriveFile(enc);
    expect(result.name).toBe('家族旅遊 2026.jpg');
    expect(result.mime).toBe('image/jpeg');
  });

  it('legacy/parse-fail: bare-string name → raw name + octet-stream mime', async () => {
    const recipient = sodium.crypto_box_keypair();
    setKeyBundleRef({
      masterKey: new Uint8Array(32),
      masterPrivkey: recipient.privateKey,
      masterPubkey: recipient.publicKey,
    });
    const enc = buildEncryptedFile({
      name: 'x.txt',
      rawName: true, // not JSON — exercises the §2.3.5 #5 fallback
      mime_claimed: 'image/jpeg',
      recipientPubkey: recipient.publicKey,
    });
    const result = await _decryptDriveFile(enc);
    expect(result.name).toBe('x.txt');
    expect(result.mime).toBe('application/octet-stream');
  });
});

describe('_parseNamePayload (R3 #7 §2.2.4 + §2.3.5 #5)', () => {
  it('parses a well-formed JSON {name, mime} payload', () => {
    expect(_parseNamePayload('{"name":"a.png","mime":"image/png"}')).toEqual({
      name: 'a.png',
      mime: 'image/png',
    });
  });

  it('defaults mime to octet-stream when payload omits it', () => {
    expect(_parseNamePayload('{"name":"a.bin"}')).toEqual({
      name: 'a.bin',
      mime: 'application/octet-stream',
    });
  });

  it('falls back to the raw string when not JSON (legacy bare name)', () => {
    expect(_parseNamePayload('家族旅遊.jpg')).toEqual({
      name: '家族旅遊.jpg',
      mime: 'application/octet-stream',
    });
  });

  it('falls back when JSON parses to a non-object (e.g. a numeric filename)', () => {
    expect(_parseNamePayload('123')).toEqual({
      name: '123',
      mime: 'application/octet-stream',
    });
  });
});

describe('_decryptDriveFolder (R3 #2 §1.2 + §1.5)', () => {
  function buildEncryptedFolder(opts: {
    name: string;
    recipientPubkey: Uint8Array;
  }): DriveFolder {
    const folderKey = sodium.randombytes_buf(32);
    const iv = sodium.randombytes_buf(24);
    const nameCiphertext = sodium.crypto_aead_xchacha20poly1305_ietf_encrypt(
      utf8ToBytes(opts.name),
      null,
      null,
      iv,
      folderKey,
    );
    const keyWrap = sodium.crypto_box_seal(folderKey, opts.recipientPubkey);
    return {
      id: 1,
      owner_id: 1,
      parent_id: null,
      name: '',
      created_at: '2026-05-27',
      updated_at: '2026-05-27',
      deleted_at: null,
      name_encrypted: bytesToB64(nameCiphertext),
      name_iv: bytesToB64(iv),
      key_wrap: bytesToB64(keyWrap),
      is_encrypted: true,
    };
  }

  it('passes through plaintext folders', async () => {
    const plain: DriveFolder = {
      id: 1,
      owner_id: 1,
      parent_id: null,
      name: 'Documents',
      created_at: '2026-05-27',
      updated_at: '2026-05-27',
      deleted_at: null,
      is_encrypted: false,
    };
    const result = await _decryptDriveFolder(plain);
    expect(result).toBe(plain);
  });

  it('decrypts folder name with own folder_key (not master_key)', async () => {
    const recipient = sodium.crypto_box_keypair();
    setKeyBundleRef({
      masterKey: new Uint8Array(32),
      masterPrivkey: recipient.privateKey,
      masterPubkey: recipient.publicKey,
    });
    const enc = buildEncryptedFolder({
      name: '相簿',
      recipientPubkey: recipient.publicKey,
    });
    const result = await _decryptDriveFolder(enc);
    expect(result.name).toBe('相簿');
  });

  it('placeholder on wrong privkey', async () => {
    const recipient = sodium.crypto_box_keypair();
    const stranger = sodium.crypto_box_keypair();
    setKeyBundleRef({
      masterKey: new Uint8Array(32),
      masterPrivkey: stranger.privateKey,
      masterPubkey: stranger.publicKey,
    });
    const enc = buildEncryptedFolder({ name: '相簿', recipientPubkey: recipient.publicKey });
    const result = await _decryptDriveFolder(enc);
    expect(result.name).toBe(_placeholders.decrypt);
  });
});

describe('_sortAndFilterEncrypted (R3 #2 §1.4 dual-mode)', () => {
  function f(id: number, name: string, is_encrypted: boolean): DriveFile {
    return {
      id,
      owner_id: 1,
      folder_id: null,
      name,
      mime: 'text/plain',
      size_bytes: 0,
      checksum_sha1: '',
      thumb_path: null,
      image_data_id: null,
      created_at: '',
      updated_at: '',
      deleted_at: null,
      is_encrypted,
    };
  }

  it('passes through unchanged when no encrypted rows (server-side authoritative)', () => {
    const items = [f(1, 'b.txt', false), f(2, 'a.txt', false)];
    const out = _sortAndFilterEncrypted(items, 'name', 'asc', undefined);
    expect(out).toBe(items);
  });

  it('re-sorts client-side by name asc when any encrypted row present', () => {
    const items = [f(1, 'c.txt', true), f(2, 'a.txt', true), f(3, 'b.txt', false)];
    const out = _sortAndFilterEncrypted(items, 'name', 'asc', undefined);
    expect(out.map((x) => x.name)).toEqual(['a.txt', 'b.txt', 'c.txt']);
  });

  it('re-sorts desc when order=desc', () => {
    const items = [f(1, 'a.txt', true), f(2, 'c.txt', true)];
    const out = _sortAndFilterEncrypted(items, 'name', 'desc', undefined);
    expect(out.map((x) => x.name)).toEqual(['c.txt', 'a.txt']);
  });

  it('uses zh-Hant + numeric collation (檔名常帶數字)', () => {
    const items = [
      f(1, '檔案 10', true),
      f(2, '檔案 2', true),
      f(3, '檔案 1', true),
    ];
    const out = _sortAndFilterEncrypted(items, 'name', 'asc', undefined);
    expect(out.map((x) => x.name)).toEqual(['檔案 1', '檔案 2', '檔案 10']);
  });

  it('client-side filter by q when any encrypted row present', () => {
    const items = [
      f(1, 'photo-summer.jpg', true),
      f(2, 'photo-winter.jpg', true),
      f(3, 'doc.pdf', true),
    ];
    const out = _sortAndFilterEncrypted(items, 'name', 'asc', 'photo');
    expect(out.map((x) => x.name)).toEqual(['photo-summer.jpg', 'photo-winter.jpg']);
  });

  it('case-insensitive filter', () => {
    const items = [f(1, 'PHOTO.jpg', true), f(2, 'doc.pdf', true)];
    const out = _sortAndFilterEncrypted(items, 'name', 'asc', 'photo');
    expect(out.map((x) => x.name)).toEqual(['PHOTO.jpg']);
  });

  it('skips sort/filter for non-name sort keys (server already sorted)', () => {
    const items = [f(1, 'b.txt', true), f(2, 'a.txt', true)];
    const out = _sortAndFilterEncrypted(items, 'created_at', 'asc', undefined);
    expect(out).toBe(items); // unchanged — server authoritative for created_at
  });
});

describe('Batch decrypt isolation (R3 #2 §1.5: per-row failure preserves others)', () => {
  it('mixed plain + encrypted + broken rows produce mixed results without throw', async () => {
    const recipient = sodium.crypto_box_keypair();
    setKeyBundleRef({
      masterKey: new Uint8Array(32),
      masterPrivkey: recipient.privateKey,
      masterPubkey: recipient.publicKey,
    });
    const goodEnc = buildEncryptedFile({ name: 'good.txt', recipientPubkey: recipient.publicKey });
    const stranger = sodium.crypto_box_keypair();
    const badEnc = buildEncryptedFile({ name: 'bad.txt', recipientPubkey: stranger.publicKey });
    const plain: DriveFile = {
      id: 9,
      owner_id: 1,
      folder_id: null,
      name: 'legacy.txt',
      mime: 'text/plain',
      size_bytes: 0,
      checksum_sha1: '',
      thumb_path: null,
      image_data_id: null,
      created_at: '',
      updated_at: '',
      deleted_at: null,
      is_encrypted: false,
    };
    const results = await Promise.all(
      [goodEnc, badEnc, plain].map(_decryptDriveFile),
    );
    expect(results[0].name).toBe('good.txt');
    expect(results[1].name).toBe(_placeholders.decrypt);
    expect(results[2].name).toBe('legacy.txt');
  });
});
