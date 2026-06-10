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
 * Fail-open: if the checker itself throws (e.g. file unreadable, file-type
 * import failure) we still enqueue the file plainly rather than block the user.
 * This is a UX gate, not the trust boundary — the trust boundary is the user
 * choosing to upload (communicated by the §2.2.5 disclosure), and the server
 * keeps its plaintext-branch blacklist regardless.
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
    console.warn("[mimeCheck] classify failed, enqueuing without gate:", err);
    enqueue(file, folderId);
  }
}
