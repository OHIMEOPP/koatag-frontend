// R3 #1 §2.2 — keyDerivation unit tests.
//
// Mock @noble/hashes/argon2 to keep tests fast (pure-JS argon2id at
// m=64MB/t=3/p=2 takes ~80s per derive in jest+jsdom; real-browser pure-JS
// estimate ~5-10s, real-browser WASM target <200ms — see R3 #1 Catch 8 for
// perf trade-off raised to wiki).
//
// Note: CRA jest preset sets `resetMocks: true` — impl declared inside the
// jest.mock factory is wiped before each test. We re-apply impl in beforeEach.
jest.mock('@noble/hashes/argon2.js', () => ({
  __esModule: true,
  argon2idAsync: jest.fn(),
}));

import { argon2idAsync } from '@noble/hashes/argon2.js';
import {
  deriveAuthBundle,
  assertKdfParams,
  bytesToBase64,
} from './keyDerivation';

beforeEach(() => {
  (argon2idAsync as jest.Mock).mockImplementation(
    (_pass: unknown, salt: Uint8Array, opts: { dkLen: number }) => {
      const out = new Uint8Array(opts.dkLen);
      for (let i = 0; i < opts.dkLen; i++) {
        out[i] = (salt[0] ?? 0) ^ i;
      }
      return Promise.resolve(out);
    },
  );
});

describe('deriveAuthBundle', () => {
  it('decodes base64 salts and calls argon2idAsync twice with correct params', async () => {
    const authSaltB64 = bytesToBase64(new Uint8Array(16).fill(0xaa));
    const masterSaltB64 = bytesToBase64(new Uint8Array(16).fill(0xbb));

    const result = await deriveAuthBundle('correct horse battery staple', {
      auth_kdf_salt: authSaltB64,
      master_key_kdf_salt: masterSaltB64,
    });

    expect(argon2idAsync).toHaveBeenCalledTimes(2);
    expect(result.auth_password_hash).toBeInstanceOf(Uint8Array);
    expect(result.master_key).toBeInstanceOf(Uint8Array);
    expect(result.auth_password_hash).toHaveLength(32);
    expect(result.master_key).toHaveLength(32);
    // Different salts produce different mock hashes.
    expect(result.auth_password_hash[0]).not.toBe(result.master_key[0]);
  });

  it('passes Argon2id baseline cost params (m=64MB, t=3, p=1, dkLen=32)', async () => {
    const salt = bytesToBase64(new Uint8Array(16));
    await deriveAuthBundle('pw', { auth_kdf_salt: salt, master_key_kdf_salt: salt });

    const firstCall = (argon2idAsync as jest.Mock).mock.calls[0];
    const opts = firstCall[2];
    expect(opts.m).toBe(65536);
    expect(opts.t).toBe(3);
    // R4 (#2046/#2048) — p realigned 2→1 to match backend libsodium enroll wrap.
    expect(opts.p).toBe(1);
    expect(opts.dkLen).toBe(32);
  });
});

describe('assertKdfParams', () => {
  it('accepts the locked Argon2id baseline params', () => {
    expect(() =>
      assertKdfParams({ m: 65536, t: 3, p: 1, algorithm: 'argon2id' }),
    ).not.toThrow();
  });

  it('rejects downgraded params', () => {
    expect(() =>
      assertKdfParams({ m: 4096, t: 1, p: 1, algorithm: 'argon2id' }),
    ).toThrow(/kdf_params mismatch/);
  });

  it('rejects mismatched parallelism (now p=1; server still declaring p=2)', () => {
    expect(() =>
      assertKdfParams({ m: 65536, t: 3, p: 2, algorithm: 'argon2id' }),
    ).toThrow(/kdf_params mismatch/);
  });

  it('rejects wrong algorithm', () => {
    expect(() =>
      assertKdfParams({ m: 65536, t: 3, p: 1, algorithm: 'pbkdf2' as 'argon2id' }),
    ).toThrow(/kdf_params mismatch/);
  });
});

describe('bytesToBase64', () => {
  it('round-trips through atob', () => {
    const bytes = new Uint8Array([1, 2, 3, 4, 255]);
    const b64 = bytesToBase64(bytes);
    expect(b64).toBe('AQIDBP8=');
  });
});
