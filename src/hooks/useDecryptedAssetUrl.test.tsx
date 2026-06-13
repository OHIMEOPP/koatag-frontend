import { renderHook, waitFor } from "@testing-library/react";
import { useDecryptedAssetUrl } from "./useDecryptedAssetUrl";
import { DriveFile } from "services/drive.service";

// R2 #4 enforce 後 inline 解密 hook — 驗分支：明文走 signed URL、加密走解密+cache。
jest.mock("services/drive.service", () => ({
  streamUrl: jest.fn(),
  thumbUrl: jest.fn(),
  invalidateSigCache: jest.fn(),
}));
jest.mock("services/drive.download", () => ({
  downloadEncryptedFile: jest.fn(),
}));
jest.mock("services/drive.errorMap", () => ({
  mapDriveError: (e: any) => e?.message ?? "error",
}));
jest.mock("stores/decryptedAssetStore", () => ({
  decryptedAssetStore: {
    get: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
  },
}));

import { streamUrl, thumbUrl } from "services/drive.service";
import { downloadEncryptedFile } from "services/drive.download";
import { decryptedAssetStore } from "stores/decryptedAssetStore";

const mockStream = streamUrl as jest.Mock;
const mockThumb = thumbUrl as jest.Mock;
const mockDownloadEnc = downloadEncryptedFile as jest.Mock;
const mockGet = decryptedAssetStore.get as jest.Mock;
const mockPut = decryptedAssetStore.put as jest.Mock;

function makeFile(over: Partial<DriveFile>): DriveFile {
  return {
    id: 42,
    name: "x.jpg",
    mime: "image/jpeg",
    size_bytes: 100,
    thumb_path: null,
    ...over,
  } as DriveFile;
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe("useDecryptedAssetUrl", () => {
  it("null file → undefined url, no fetch/decrypt", () => {
    const { result } = renderHook(() => useDecryptedAssetUrl(null, "stream"));
    expect(result.current.url).toBeUndefined();
    expect(mockStream).not.toHaveBeenCalled();
    expect(mockDownloadEnc).not.toHaveBeenCalled();
  });

  it("明文檔 stream → 走 streamUrl signed URL，不解密", async () => {
    mockStream.mockResolvedValue("https://api/drive/files/42/download?sig=a");
    const file = makeFile({ is_encrypted: false });
    const { result } = renderHook(() => useDecryptedAssetUrl(file, "stream"));
    await waitFor(() =>
      expect(result.current.url).toBe("https://api/drive/files/42/download?sig=a"),
    );
    expect(mockStream).toHaveBeenCalledWith(42);
    expect(mockDownloadEnc).not.toHaveBeenCalled();
  });

  it("明文檔 thumb → 走 thumbUrl", async () => {
    mockThumb.mockResolvedValue("https://api/thumb");
    const file = makeFile({ is_encrypted: false, thumb_path: "/t/42" });
    const { result } = renderHook(() => useDecryptedAssetUrl(file, "thumb"));
    await waitFor(() => expect(result.current.url).toBe("https://api/thumb"));
    expect(mockThumb).toHaveBeenCalledWith(42);
  });

  it("加密檔 → downloadEncryptedFile → store.put → object URL，不打 signed URL", async () => {
    mockGet.mockReturnValue(undefined);
    const blob = new Blob(["plain"], { type: "image/jpeg" });
    mockDownloadEnc.mockResolvedValue(blob);
    mockPut.mockReturnValue("blob:decrypted-42");
    const file = makeFile({ is_encrypted: true, key_wrap: "kw" });
    const { result } = renderHook(() => useDecryptedAssetUrl(file, "thumb"));
    await waitFor(() => expect(result.current.url).toBe("blob:decrypted-42"));
    expect(mockDownloadEnc).toHaveBeenCalledWith(file, expect.any(Object));
    // 統一 cache 在 'full' key（thumb 與 full 共用一次解密）
    expect(mockPut).toHaveBeenCalledWith(42, "full", blob);
    expect(mockStream).not.toHaveBeenCalled();
    expect(mockThumb).not.toHaveBeenCalled();
  });

  it("加密檔 cache 命中 → 直接回 object URL，不重複解密", async () => {
    mockGet.mockReturnValue("blob:cached-42");
    const file = makeFile({ is_encrypted: true, key_wrap: "kw" });
    const { result } = renderHook(() => useDecryptedAssetUrl(file, "stream"));
    await waitFor(() => expect(result.current.url).toBe("blob:cached-42"));
    expect(mockDownloadEnc).not.toHaveBeenCalled();
  });

  it("加密檔解密失敗 → error 透過 mapDriveError 暴露", async () => {
    mockGet.mockReturnValue(undefined);
    mockDownloadEnc.mockRejectedValue({ code: "CHUNK_DECRYPT", message: "解密失敗" });
    const file = makeFile({ is_encrypted: true, key_wrap: "kw" });
    const { result } = renderHook(() => useDecryptedAssetUrl(file, "stream"));
    await waitFor(() => expect(result.current.error).toBe("解密失敗"));
    expect(result.current.url).toBeUndefined();
  });
});
