// R3 #7 §2.2.1 — the `file-type/core` subpath (browser-safe, fs-free entry; see
// mimeCheck.ts) ships no type declarations. We consume it via `const mod: any`
// + a tolerant runtime API probe, so a minimal ambient declaration is enough to
// satisfy the dynamic import() type.
declare module "file-type/core";
