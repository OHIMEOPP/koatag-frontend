// R3 #7 §2.2.2 — shared orchestration for "run the pre-encrypt magic-byte check,
// then enqueue with the right verdict". Both enqueue sites (UploadDropzone
// drag-drop + DrivePage file-picker) call this so the accept/reject/warn policy
// lives in exactly one place.

import type { EnqueueOpts } from "stores/uploadQueueStore";
import { classifyUpload } from "./mimeCheck";

type EnqueueFn = (
  file: File,
  folderId: number | null,
  opts?: EnqueueOpts,
) => string;

/**
 * Magic-byte check (§2.2.2) runs BEFORE the file enters the queue so it is
 * always pre-encrypt (§3 #1 — never waste encrypt CPU on a doomed file).
 *
 * Fail-CLOSED (security follow-up): after DRIVE_ENFORCE_ENCRYPTED_UPLOAD=true the
 * server stores opaque ciphertext and its encrypted path skips magic + blacklist
 * (DriveFileController), so this client gate is the *only* content-MIME / polyglot
 * defense — there is no server fallback to lean on. If the checker itself throws
 * we therefore BLOCK the file (queue it as an error) rather than silently letting
 * it through; a silent fail-open here means an unverified upload. The Buffer-shim
 * fix in mimeCheck.ts removes the previously-common throw, so in practice this
 * only fires on genuinely unreadable files.
 */
export async function enqueueWithMimeCheck(
  file: File,
  folderId: number | null,
  enqueue: EnqueueFn,
): Promise<void> {
  try {
    const c = await classifyUpload(file);
    if (c.decision === "reject") {
      enqueue(file, folderId, { detectedMime: c.detectedMime, rejectCode: c.code });
    } else if (c.decision === "warn") {
      enqueue(file, folderId, { detectedMime: c.detectedMime, warnCode: c.code });
    } else {
      enqueue(file, folderId, { detectedMime: c.detectedMime });
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn("[mimeCheck] classify failed — blocking (fail-closed):", err);
    enqueue(file, folderId, {
      detectedMime: "application/octet-stream",
      rejectCode: "MIME_CHECK_FAILED",
    });
  }
}
