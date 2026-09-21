import { describe, it, expect, afterEach, vi } from "vitest";
import {
  buildImageUploadRequestMessage,
  uploadImageThroughMaster,
  IMAGE_UPLOAD_TIMEOUT_MS,
  type MasterImageUploadBoundary,
} from "../src/integration/masterImageUpload";
import { EDITOR_PROTOCOL_VERSION } from "../src/integration/editorProtocol";

const PARENT_ORIGIN = "https://admin.eazyweb.dev";

function recordingBoundary(overrides: Partial<MasterImageUploadBoundary> = {}) {
  const posted: unknown[] = [];
  const boundary: MasterImageUploadBoundary = {
    parentOrigin: PARENT_ORIGIN,
    // A distinct object from `window` so a source mismatch is detectable.
    parentWindow: {},
    isEmbedded: true,
    postMessage: (message) => {
      posted.push(message);
    },
    ...overrides,
  };
  return { boundary, posted };
}

function makeFile(): File {
  return new File(["image-bytes"], "poster.jpg", { type: "image/jpeg" });
}

function uploadSuccess(overrides: Record<string, unknown> = {}) {
  return {
    type: "IMAGE_UPLOAD_SUCCESS" as const,
    version: EDITOR_PROTOCOL_VERSION,
    payload: {
      path: "eazymedia/dynamic_poster/bg-1234.jpg",
      fileName: "bg-1234.jpg",
      ...overrides,
    },
  };
}

function uploadError(message = "Upload failed.") {
  return {
    type: "IMAGE_UPLOAD_ERROR" as const,
    version: EDITOR_PROTOCOL_VERSION,
    payload: { message },
  };
}

function reply(source: unknown, data: unknown, origin = PARENT_ORIGIN) {
  window.dispatchEvent(
    new MessageEvent("message", { data, origin, source })
  );
}

describe("buildImageUploadRequestMessage", () => {
  it("carries the raw File, never JSON or base64", () => {
    const file = makeFile();
    const message = buildImageUploadRequestMessage(file);

    expect(message.type).toBe("IMAGE_UPLOAD_REQUEST");
    expect(message.version).toBe(EDITOR_PROTOCOL_VERSION);
    expect(message.payload.file).toBe(file);
    expect(message.payload.file).toBeInstanceOf(File);
    expect(typeof message.payload.file).toBe("object");
  });
});

describe("uploadImageThroughMaster", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("rejects when not running embedded", async () => {
    const { boundary } = recordingBoundary({ isEmbedded: false });

    await expect(uploadImageThroughMaster(makeFile(), boundary)).rejects.toThrow(
      /admin portal/
    );
  });

  it("posts IMAGE_UPLOAD_REQUEST with the raw File to the parent origin", async () => {
    const { boundary, posted } = recordingBoundary();
    const file = makeFile();

    const promise = uploadImageThroughMaster(file, boundary);

    reply(boundary.parentWindow, uploadSuccess());
    await promise;

    expect(posted).toHaveLength(1);
    const message = posted[0] as {
      type: string;
      version: unknown;
      payload: { file: File };
    };
    expect(message.type).toBe("IMAGE_UPLOAD_REQUEST");
    expect(message.version).toBe(EDITOR_PROTOCOL_VERSION);
    expect(message.payload.file).toBe(file);
  });

  it("resolves with the relayed { path, fileName } on IMAGE_UPLOAD_SUCCESS", async () => {
    const { boundary } = recordingBoundary();

    const promise = uploadImageThroughMaster(makeFile(), boundary);
    reply(boundary.parentWindow, uploadSuccess());

    await expect(promise).resolves.toEqual({
      path: "eazymedia/dynamic_poster/bg-1234.jpg",
      fileName: "bg-1234.jpg",
    });
  });

  it("rejects with the parent message on IMAGE_UPLOAD_ERROR", async () => {
    const { boundary } = recordingBoundary();

    const promise = uploadImageThroughMaster(makeFile(), boundary);
    reply(boundary.parentWindow, uploadError("The image is too large."));

    await expect(promise).rejects.toThrow("The image is too large.");
  });

  it("ignores an invalid success payload and keeps waiting", async () => {
    vi.useFakeTimers();
    const { boundary } = recordingBoundary();

    const promise = uploadImageThroughMaster(makeFile(), boundary);
    reply(boundary.parentWindow, uploadSuccess({ path: "" }));

    const assertion = expect(promise).rejects.toThrow(/timed out/);
    await vi.advanceTimersByTimeAsync(IMAGE_UPLOAD_TIMEOUT_MS);
    await assertion;
  });

  it("ignores messages from an untrusted origin", async () => {
    const { boundary } = recordingBoundary();

    const promise = uploadImageThroughMaster(makeFile(), boundary);
    reply(boundary.parentWindow, uploadSuccess(), "https://evil.example");
    reply(boundary.parentWindow, uploadSuccess());

    await expect(promise).resolves.toEqual({
      path: "eazymedia/dynamic_poster/bg-1234.jpg",
      fileName: "bg-1234.jpg",
    });
  });

  it("ignores messages from a different source window", async () => {
    const { boundary } = recordingBoundary();

    const promise = uploadImageThroughMaster(makeFile(), boundary);
    reply({}, uploadSuccess());
    reply(boundary.parentWindow, uploadSuccess());

    await expect(promise).resolves.toEqual({
      path: "eazymedia/dynamic_poster/bg-1234.jpg",
      fileName: "bg-1234.jpg",
    });
  });

  it("ignores unrelated message types", async () => {
    const { boundary } = recordingBoundary();

    const promise = uploadImageThroughMaster(makeFile(), boundary);
    reply(boundary.parentWindow, {
      type: "SAVE_SUCCESS",
      version: EDITOR_PROTOCOL_VERSION,
      payload: {},
    });
    reply(boundary.parentWindow, uploadSuccess());

    await expect(promise).resolves.toEqual({
      path: "eazymedia/dynamic_poster/bg-1234.jpg",
      fileName: "bg-1234.jpg",
    });
  });

  it("rejects after the timeout and removes the message listener", async () => {
    vi.useFakeTimers();
    const { boundary } = recordingBoundary();
    const removeSpy = vi.spyOn(window, "removeEventListener");

    const promise = uploadImageThroughMaster(makeFile(), boundary);
    const assertion = expect(promise).rejects.toThrow(/timed out/);
    await vi.advanceTimersByTimeAsync(IMAGE_UPLOAD_TIMEOUT_MS);
    await assertion;

    expect(removeSpy).toHaveBeenCalledWith("message", expect.any(Function));
  });

  it("removes the message listener after a successful reply", async () => {
    const { boundary } = recordingBoundary();
    const removeSpy = vi.spyOn(window, "removeEventListener");

    const promise = uploadImageThroughMaster(makeFile(), boundary);
    reply(boundary.parentWindow, uploadSuccess());
    await promise;

    expect(removeSpy).toHaveBeenCalledWith("message", expect.any(Function));
  });
});