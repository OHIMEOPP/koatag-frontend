// R3 #7 §2.2.1 — Drive client-side MIME whitelist (E2EE era).
//
// Per R3 #7 §3 sub-decision #2 (USER LOCKED 2026-05-25): drive uses a *wider*
// client-side whitelist (~24 entries spanning image/video/audio/doc/text) for
// the pre-encrypt UX gate — NOT the narrow 12-entry image-module whitelist
// (too restrictive for general file storage), and NOT no-whitelist (no type
// protection at all).
//
// Layering note (§2.3.3): this is a CLIENT-SIDE gate only. The server cannot
// inspect ciphertext (encrypted era), so it stores blobs opaquely + keeps the
// legacy *blacklist* (config/drive.php executable block) for the plaintext
// branch. The two layers are complementary, not redundant.
//
// The values here are magic-byte-detected MIME strings (file-type lib output),
// with a small set of text/* types that have NO magic signature and can only
// be vouched for by the browser-claimed mime (see mimeCheck.ts text fallback).

/** Magic-byte-detectable types (file-type lib produces these on success). */
export const DRIVE_MIME_WHITELIST: ReadonlySet<string> = new Set<string>([
  // image
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/bmp",
  "image/tiff",
  "image/heic",
  "image/heif",
  "image/avif",
  // video
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "video/x-matroska",
  // audio
  "audio/mpeg",
  "audio/wav",
  "audio/ogg",
  "audio/flac",
  "audio/mp4",
  // documents / archives
  "application/pdf",
  "application/zip",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
]);

/**
 * text/* family has NO magic-byte signature — file-type returns undefined for
 * a plain .txt/.csv/.md. Magic detection alone would wrongly reject every text
 * upload, so when detection yields nothing we fall back to the browser-claimed
 * mime and allow it only if it is one of these low-risk text types.
 * (Implementation note raised to wiki: pure-text files are unverifiable by
 * magic bytes by nature — the same E2EE-era trust limitation the disclosure UI
 * §2.2.5 communicates.)
 */
export const DRIVE_TEXT_CLAIMED_WHITELIST: ReadonlySet<string> = new Set<string>([
  "text/plain",
  "text/csv",
  "text/markdown",
  "application/json",
]);

export function isWhitelistedDetectedMime(mime: string): boolean {
  return DRIVE_MIME_WHITELIST.has(mime);
}

export function isWhitelistedTextClaim(mime: string): boolean {
  return DRIVE_TEXT_CLAIMED_WHITELIST.has(mime);
}
