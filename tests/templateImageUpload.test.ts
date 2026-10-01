import { describe, it, expect, afterEach, vi } from "vitest";
import {
  uploadTemplateImage,
  UPLOAD_IMAGE_ENDPOINT,
} from "../src/integration/templateImageUpload";

describe("uploadTemplateImage (Laravel S3 upload contract)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function stubFetch(response: Partial<Response>) {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue({
        path: "eazymedia/dynamic_poster/bg-1234.jpg",
        fileName: "bg-1234.jpg",
      }),
      ...response,
    });

    vi.stubGlobal("fetch", fetchMock);

    return fetchMock;
  }

  function makeFile(): File {
    return new File(["image-bytes"], "poster.jpg", { type: "image/jpeg" });
  }

  it("sends multipart/form-data using the field name `image`", async () => {
    const fetchMock = stubFetch({});
    const file = makeFile();

    await uploadTemplateImage(file);

    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain(UPLOAD_IMAGE_ENDPOINT);
    expect(init.method).toBe("POST");
    expect(init.body).toBeInstanceOf(FormData);
    expect((init.body as FormData).get("image")).toBe(file);
  });

  it("parses a successful Laravel `{ path, fileName }` response", async () => {
    stubFetch({});
    const file = makeFile();

    const result = await uploadTemplateImage(file);

    expect(result).toEqual({
      path: "eazymedia/dynamic_poster/bg-1234.jpg",
      fileName: "bg-1234.jpg",
    });
  });

  it("surfaces an HTTP failure cleanly", async () => {
    stubFetch({
      ok: false,
      status: 502,
      json: vi.fn().mockResolvedValue({ message: "upload failed" }),
    });

    await expect(uploadTemplateImage(makeFile())).rejects.toMatchObject({
      message: /failed/i,
      status: 502,
    });
  });

  it("surfaces a network failure cleanly", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new TypeError("Failed to fetch"))
    );

    await expect(uploadTemplateImage(makeFile())).rejects.toMatchObject({
      message: /server/i,
    });
  });

  it("does not send an Authorization token", async () => {
    const fetchMock = stubFetch({});
    const file = makeFile();

    await uploadTemplateImage(file);

    const [, init] = fetchMock.mock.calls[0];
    expect(init.headers?.Authorization).toBeUndefined();
    expect(
      Object.keys((init.headers as Record<string, string>) ?? {}).some(
        (key) => key.toLowerCase() === "authorization"
      )
    ).toBe(false);
    expect(String(fetchMock.mock.calls[0][0])).not.toContain("token=");
  });
});