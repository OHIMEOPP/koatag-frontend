// R3 #7 §2.2.1 — client-side magic-byte MIME verification (E2EE era).
//
// In the encrypted era the server only ever sees opaque ciphertext, so it can
// no longer run PHP fileinfo magic-byte detection. The client becomes the
// primary trust point (R3 #7 §0 / §3 #1 USER LOCKED). This module reads the
// first 4KB of a File and uses the `file-type` lib (USER LOCKED §3 #9 —
// battle-tested, not self-written) to derive the true content MIME, then
// classifies the upload into accept / reject / warn per §2.2.2.
//
// Decision table (§2.2.2 + §3 #1/#3):
//   - magic detected & whitelisted, claim agrees      → accept
//   - magic detected & whitelisted, claim disagrees    → warn  (polyglot/loose;
//       E2EE-era false-positives are high so we still enqueue — §3 #3 LOCKED)
//   - magic detected & NOT whitelisted                 → reject (strict block)
//   - no magic signature, claim is a text/* type       → accept (text fallback)
//   - no magic signature, claim not text               → reject
//
// `mime_claimed` stored alongside ciphertext is the *detected* mime (not
// file.type) — file.type is trivially forgeable via extension, the magic-byte
// result is harder to fake (§2.3.5 #1).

import {
  isWhitelistedDetectedMime,
  isWhitelistedTextClaim,
} from "./driveMimeWhitelist";

const MAGIC_BYTE_READ_LEN = 4096;

export interface MimeCheckResult {
  /** True content mime from magic bytes; '' if no signature (e.g. plain text). */
  detectedMime: string;
  /** Browser-claimed mime from extension (file.type); weak, forgeable. */
  claimedMime: string;
  /** detected === claimed (after light normalisation). */
  match: boolean;
}

export type UploadDecision = "accept" | "reject" | "warn";

export interface UploadClassification {
  /**
   * Mime to persist as mime_claimed + inside the ciphertext {name, mime}
   * payload. For magic-detected files this is the detected mime; for the text
   * fallback it is the claimed text mime; for rejects it is best-effort.
   */
  detectedMime: string;
  claimedMime: string;
  decision: UploadDecision;
  /** drive.errorMap code when decision !== 'accept'. */
  code?: "UNSUPPORTED_MIME" | "POLYGLOT_WARN";
}

// Some browsers report legacy/variant mimes; fold them to the canonical form
// file-type emits so a genuine match isn't reported as a polyglot mismatch.
function normaliseMime(mime: string): string {
  const m = mime.trim().toLowerCase();
  if (m === "image/jpg") return "image/jpeg";
  if (m === "image/x-png") return "image/png";
  if (m === "audio/mp3" || m === "audio/mpeg3") return "audio/mpeg";
  if (m === "video/mov") return "video/quicktime";
  return m;
}

/**
 * Lazy-import file-type (mirrors aead.ts @noble/hashes pattern) to keep it out
 * of the initial bundle — magic detection only runs at drag-drop time. Tolerant
 * of both the v16 (`fromBuffer`) and v17+ (`fileTypeFromBuffer`) APIs so a dep
 * bump doesn't silently break detection.
 */
async function detectFromBytes(bytes: Uint8Array): Promise<string> {
  // Import the `/core` entry, NOT the package root. The root pulls
  // strtok3/lib/index → node `fs`, which webpack 5 (react-scripts, no eject)
  // cannot resolve and the build fails. `/core` uses strtok3/lib/core (no fs),
  // which is the browser-safe path. Same LOCKED `file-type` dep (§3 #9), just
  // its bundler-friendly entry.
  const mod: any = await import("file-type/core");
  const fn =
    mod.fileTypeFromBuffer ?? mod.fromBuffer ?? mod.default?.fromBuffer;
  if (typeof fn !== "function") return "";
  const res = await fn(bytes);
  return res?.mime ? normaliseMime(res.mime) : "";
}

/**
 * §2.2.1 detectMimeFromBytes — read first 4KB, magic-detect, compare to claim.
 */
export async function detectMimeFromBytes(file: File): Promise<MimeCheckResult> {
  const head = file.slice(0, MAGIC_BYTE_READ_LEN);
  const bytes = new Uint8Array(await head.arrayBuffer());
  const detectedMime = await detectFromBytes(bytes);
  const claimedMime = normaliseMime(file.type || "");
  return {
    detectedMime,
    claimedMime,
    match: detectedMime !== "" && detectedMime === claimedMime,
  };
}

/**
 * §2.2.2 classify — single entry point the dropzone calls per file. Encapsulates
 * the accept/reject/warn decision so UploadDropzone + the DrivePage file-input
 * stay DRY.
 */
export async function classifyUpload(file: File): Promise<UploadClassification> {
  const { detectedMime, claimedMime, match } = await detectMimeFromBytes(file);

  if (detectedMime) {
    if (!isWhitelistedDetectedMime(detectedMime)) {
      // Strict block — content type not in the drive whitelist (§3 #1).
      return { detectedMime, claimedMime, decision: "reject", code: "UNSUPPORTED_MIME" };
    }
    if (claimedMime && !match) {
      // Loose warn — extension/claim disagrees with content (§3 #3). Still
      // enqueue; E2EE makes this unverifiable server-side and false-positives
      // are high, so we inform rather than block.
      return { detectedMime, claimedMime, decision: "warn", code: "POLYGLOT_WARN" };
    }
    return { detectedMime, claimedMime, decision: "accept" };
  }

  // No magic signature (plain text, csv, json, …). Magic bytes cannot vouch for
  // these by nature, so allow only the low-risk text/* family via the claim.
  if (claimedMime && isWhitelistedTextClaim(claimedMime)) {
    return { detectedMime: claimedMime, claimedMime, decision: "accept" };
  }
  return {
    detectedMime: detectedMime || claimedMime || "application/octet-stream",
    claimedMime,
    decision: "reject",
    code: "UNSUPPORTED_MIME",
  };
}
