const fs = require("fs");
const path = require("path");

const FIXTURES_DIR = path.join(__dirname, "build");
if (!fs.existsSync(FIXTURES_DIR)) fs.mkdirSync(FIXTURES_DIR, { recursive: true });

// 1mb.jpg — 從 public 複製真 jpg fixture（425KB，當「< 50MB」happy path 用）
const src = path.join(__dirname, "..", "..", "..", "public", "0cb1e35c2f8c081dd671f519eb78fc63668182ae.jpg");
const dst1 = path.join(FIXTURES_DIR, "1mb.jpg");
if (fs.existsSync(src)) {
  fs.copyFileSync(src, dst1);
  console.log(`✓ ${dst1} (${fs.statSync(dst1).size} bytes)`);
} else {
  console.warn(`source 1mb fixture missing: ${src}`);
}

// 60mb.bin — zero fill 60MB，測「> 50MB 前端 reject」
const dst2 = path.join(FIXTURES_DIR, "60mb.bin");
const SIZE = 60 * 1024 * 1024;
fs.writeFileSync(dst2, Buffer.alloc(SIZE));
console.log(`✓ ${dst2} (${fs.statSync(dst2).size} bytes)`);

// TODO (R3 #7 §2.2.6 — deferred to R2 #9 e2e housekeeping batch, per前 step 紀律):
// add MIME-gate fixtures + smoke specs for the §2.2.2 pre-encrypt check —
//   - legit.jpg     真 JPG valid magic → upload happy path
//   - polyglot.jpg  JPG header + 嵌入 ZIP → §3.3 warn-but-allow (POLYGLOT_WARN)
//   - disguised.exe .txt ext + EXE magic → whitelist mismatch → reject (UNSUPPORTED_MIME)
//   - unknown.xyz   random binary 無 magic → reject
// wire into drive.smoke.spec.ts (S8 mime smoke) + drive.onerror.spec.ts.
// NOT generated here yet — whole e2e suite is being redesigned in R2 #9.
