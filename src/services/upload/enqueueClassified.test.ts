import { enqueueWithMimeCheck } from "./enqueueClassified";
import { classifyUpload } from "./mimeCheck";

// Security follow-up — verify the fail-CLOSED behavior: a classifier throw must
// block (enqueue with MIME_CHECK_FAILED), not silently fail-open.
jest.mock("./mimeCheck", () => ({ classifyUpload: jest.fn() }));

const mockClassify = classifyUpload as jest.Mock;

function makeFile(): File {
  return new File([new Uint8Array([1, 2, 3])], "x.bin", { type: "" });
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, "warn").mockImplementation(() => {});
});

describe("enqueueWithMimeCheck", () => {
  it("accept → enqueue with detectedMime, no reject/warn code", async () => {
    mockClassify.mockResolvedValue({ detectedMime: "image/png", decision: "accept" });
    const enqueue = jest.fn();
    await enqueueWithMimeCheck(makeFile(), 7, enqueue);
    expect(enqueue).toHaveBeenCalledWith(expect.any(File), 7, { detectedMime: "image/png" });
  });

  it("reject → enqueue with rejectCode", async () => {
    mockClassify.mockResolvedValue({
      detectedMime: "application/x-msdownload",
      decision: "reject",
      code: "UNSUPPORTED_MIME",
    });
    const enqueue = jest.fn();
    await enqueueWithMimeCheck(makeFile(), null, enqueue);
    expect(enqueue).toHaveBeenCalledWith(expect.any(File), null, {
      detectedMime: "application/x-msdownload",
      rejectCode: "UNSUPPORTED_MIME",
    });
  });

  it("warn → enqueue with warnCode (still uploads)", async () => {
    mockClassify.mockResolvedValue({
      detectedMime: "image/png",
      decision: "warn",
      code: "POLYGLOT_WARN",
    });
    const enqueue = jest.fn();
    await enqueueWithMimeCheck(makeFile(), null, enqueue);
    expect(enqueue).toHaveBeenCalledWith(expect.any(File), null, {
      detectedMime: "image/png",
      warnCode: "POLYGLOT_WARN",
    });
  });

  it("classifier throws → FAIL-CLOSED：enqueue with MIME_CHECK_FAILED reject, 不靜默放行", async () => {
    mockClassify.mockRejectedValue(new ReferenceError("Buffer is not defined"));
    const enqueue = jest.fn();
    await enqueueWithMimeCheck(makeFile(), 3, enqueue);
    expect(enqueue).toHaveBeenCalledTimes(1);
    expect(enqueue).toHaveBeenCalledWith(expect.any(File), 3, {
      detectedMime: "application/octet-stream",
      rejectCode: "MIME_CHECK_FAILED",
    });
    // 絕不能是「無 opts 直接放行」的舊 fail-open 形態
    expect(enqueue).not.toHaveBeenCalledWith(expect.any(File), 3);
  });
});
