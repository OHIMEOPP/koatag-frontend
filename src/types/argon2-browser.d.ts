declare module 'argon2-browser' {
  export const ArgonType: {
    Argon2d: 0;
    Argon2i: 1;
    Argon2id: 2;
  };

  export interface HashOptions {
    pass: string | Uint8Array;
    salt: string | Uint8Array;
    type?: 0 | 1 | 2;
    hashLen?: number;
    mem?: number;
    time?: number;
    parallelism?: number;
    secret?: Uint8Array;
    ad?: Uint8Array;
  }

  export interface HashResult {
    hash: Uint8Array;
    hashHex: string;
    encoded: string;
  }

  export function hash(opts: HashOptions): Promise<HashResult>;
  export function verify(opts: { pass: string | Uint8Array; encoded: string }): Promise<void>;
  export function unloadRuntime(): void;

  const argon2: {
    hash: typeof hash;
    verify: typeof verify;
    unloadRuntime: typeof unloadRuntime;
    ArgonType: typeof ArgonType;
  };
  export default argon2;
}

declare module 'argon2-browser/dist/argon2-bundled.min.js' {
  export * from 'argon2-browser';
  export { default } from 'argon2-browser';
}
