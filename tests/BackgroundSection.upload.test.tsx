import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  render,
  screen,
  fireEvent,
  cleanup,
  waitFor,
  act,
} from "@testing-library/react";
import { useEditorStore } from "../src/store/editorStore";
import { mockTemplate } from "../src/domain/template/template.mock";
import { BackgroundSection } from "../src/components/properties/BackgroundSection";

vi.mock("../src/integration/templateImageUpload", () => ({
  uploadTemplateImage: vi.fn(),
}));

import { uploadTemplateImage } from "../src/integration/templateImageUpload";

const mockedUpload = vi.mocked(uploadTemplateImage);

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

function makeFile(): File {
  return new File(["image-bytes"], "new-background.jpg", {
    type: "image/jpeg",
  });
}

function renderBackgroundSection() {
  const result = render(<BackgroundSection />);
  const input = result.container.querySelector(
    'input[type="file"]'
  ) as HTMLInputElement;
  return { ...result, input };
}

describe("BackgroundSection (Laravel S3 upload integration)", () => {
  beforeEach(() => {
    useEditorStore.getState().resetEditor();
    useEditorStore.getState().setTemplate(clone(mockTemplate));
    mockedUpload.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it("existing loaded background still renders normally", () => {
    renderBackgroundSection();

    const img = screen.getByAltText("Template background");
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute("src", mockTemplate.background.imageUrl);
  });

  it("failed upload does NOT replace the existing background", async () => {
    mockedUpload.mockRejectedValueOnce(
      new Error("Image upload failed. Please try again.")
    );

    const { input } = renderBackgroundSection();

    await act(async () => {
      fireEvent.change(input, { target: { files: [makeFile()] } });
    });

    const state = useEditorStore.getState();
    expect(state.template?.background.imageUrl).toBe(
      mockTemplate.background.imageUrl
    );
    expect(state.temporaryBackgroundImageUrl).toBeNull();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Image upload failed. Please try again."
    );
    expect(screen.getByAltText("Template background")).toHaveAttribute(
      "src",
      mockTemplate.background.imageUrl
    );
  });

  it("existing background remains intact while upload is in progress", async () => {
    let resolveUpload!: (value: {
      path: string;
      fileName: string;
    }) => void;
    mockedUpload.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveUpload = resolve;
      })
    );

    const { input } = renderBackgroundSection();

    fireEvent.change(input, { target: { files: [makeFile()] } });

    await waitFor(() => {
      expect(screen.getByText("Uploading...")).toBeInTheDocument();
    });

    const state = useEditorStore.getState();
    expect(state.template?.background.imageUrl).toBe(
      mockTemplate.background.imageUrl
    );
    expect(state.temporaryBackgroundImageUrl).toBeNull();

    await act(async () => {
      resolveUpload({
        path: "eazymedia/dynamic_poster/new.jpg",
        fileName: "new.jpg",
      });
    });
  });

  it("successful upload updates the background image reference", async () => {
    mockedUpload.mockResolvedValueOnce({
      path: "eazymedia/dynamic_poster/uploaded.jpg",
      fileName: "uploaded.jpg",
    });

    const { input } = renderBackgroundSection();

    await act(async () => {
      fireEvent.change(input, { target: { files: [makeFile()] } });
    });

    const state = useEditorStore.getState();
    expect(mockedUpload).toHaveBeenCalledOnce();
    expect(state.temporaryBackgroundImageUrl).toBe(
      "eazymedia/dynamic_poster/uploaded.jpg"
    );
    expect(state.template?.background.imageUrl).toBe(
      "eazymedia/dynamic_poster/uploaded.jpg"
    );
    expect(screen.getByAltText("Template background")).toHaveAttribute(
      "src",
      "eazymedia/dynamic_poster/uploaded.jpg"
    );
  });

  it("logical canvas dimensions (1200 x 1600) are not changed by the upload", async () => {
    mockedUpload.mockResolvedValueOnce({
      path: "eazymedia/dynamic_poster/dims.jpg",
      fileName: "dims.jpg",
    });

    const { input } = renderBackgroundSection();

    await act(async () => {
      fireEvent.change(input, { target: { files: [makeFile()] } });
    });

    const state = useEditorStore.getState();
    expect(state.template?.settings.canvasWidth).toBe(1200);
    expect(state.template?.settings.canvasHeight).toBe(1600);
  });

  it("rejects non-image files without uploading", async () => {
    const { input } = renderBackgroundSection();
    const textFile = new File(["text"], "notes.txt", { type: "text/plain" });

    await act(async () => {
      fireEvent.change(input, { target: { files: [textFile] } });
    });

    expect(mockedUpload).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Please choose an image file."
    );
  });
});