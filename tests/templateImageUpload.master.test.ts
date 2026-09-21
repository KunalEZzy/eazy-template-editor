import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { uploadTemplateImage } from "../src/integration/templateImageUpload";
import {
  uploadImageThroughMaster,
} from "../src/integration/masterImageUpload";

vi.mock("../src/integration/masterSubmit", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../src/integration/masterSubmit")>();
  return {
    ...actual,
    getDefaultSubmitBoundary: () => ({
      parentOrigin: "https://admin.eazyweb.dev",
      parentWindow: {},
      isEmbedded: true,
      postMessage: () => undefined,
    }),
  };
});

vi.mock("../src/integration/masterImageUpload", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../src/integration/masterImageUpload")>();
  return {
    ...actual,
    uploadImageThroughMaster: vi.fn(),
  };
});

function makeFile(): File {
  return new File(["image-bytes"], "poster.jpg", { type: "image/jpeg" });
}

describe("uploadTemplateImage (Master/embedded routing)", () => {
  const bridge = vi.mocked(uploadImageThroughMaster);

  beforeEach(() => {
    bridge.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("routes through the Master bridge without any direct fetch", async () => {
    bridge.mockResolvedValue({
      path: "eazymedia/dynamic_poster/bg-1234.jpg",
      fileName: "bg-1234.jpg",
    });
    const fetchMock = vi.fn().mockImplementation(() => {
      throw new Error("fetch must not be called in Master mode");
    });
    vi.stubGlobal("fetch", fetchMock);

    const file = makeFile();
    const result = await uploadTemplateImage(file);

    expect(result).toEqual({
      path: "eazymedia/dynamic_poster/bg-1234.jpg",
      fileName: "bg-1234.jpg",
    });
    expect(bridge).toHaveBeenCalledTimes(1);
    expect(bridge).toHaveBeenCalledWith(file);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("surfaces a relayed upload error from the parent", async () => {
    bridge.mockRejectedValue(new Error("The image is too large."));
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(() => {
        throw new Error("fetch must not be called in Master mode");
      })
    );

    await expect(uploadTemplateImage(makeFile())).rejects.toThrow(
      "The image is too large."
    );
  });
});