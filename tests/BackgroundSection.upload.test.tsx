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

vi.mock("../src/integration/masterBootstrap", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../src/integration/masterBootstrap")>();
  return {
    ...actual,
    requestBackgroundUpload: vi.fn(() => "sent"),
  };
});

import { requestBackgroundUpload } from "../src/integration/masterBootstrap";

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

describe("BackgroundSection (Phase 3A: Master Create action label)", () => {
  beforeEach(() => {
    useEditorStore.getState().resetEditor();
    useEditorStore.getState().setTemplate(clone(mockTemplate));
    mockedUpload.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it("master-create presents the action as 'Upload Image'", () => {
    useEditorStore.getState().setEditorMode("master-create");

    renderBackgroundSection();

    expect(
      screen.getByRole("button", { name: "Upload Image" })
    ).toBeInTheDocument();
  });

  it("master-create still shows 'Upload Image' (not 'Change Image') when a background exists", () => {
    useEditorStore.getState().setEditorMode("master-create");
    useEditorStore.getState().setTemporaryBackgroundImage(
      "eazymedia/dynamic_poster/new.jpg"
    );

    renderBackgroundSection();

    expect(
      screen.getByRole("button", { name: "Upload Image" })
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Change Image" })).toBeNull();
  });

  it("null and restaurant modes keep the existing label behavior", async () => {
    renderBackgroundSection();

    expect(
      screen.getByRole("button", { name: "Change Image" })
    ).toBeInTheDocument();

    cleanup();

    useEditorStore.getState().setEditorMode("restaurant");
    renderBackgroundSection();
    expect(
      screen.getByRole("button", { name: "Change Image" })
    ).toBeInTheDocument();
  });

  it("master-create delegates the upload to the parent instead of uploading itself", () => {
    useEditorStore.getState().setEditorMode("master-create");
    useEditorStore.getState().setTemporaryBackgroundImage(
      "eazymedia/dynamic_poster/existing.jpg"
    );

    const { input } = renderBackgroundSection();

    // The editor holds no admin session, so it must never post the file itself.
    expect(input).toBeNull();
    expect(mockedUpload).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Upload Image" }));

    expect(requestBackgroundUpload).toHaveBeenCalledOnce();
    expect(mockedUpload).not.toHaveBeenCalled();
    // The existing background is untouched until the parent pushes the new URL
    // back as SET_BACKGROUND_IMAGE.
    expect(useEditorStore.getState().temporaryBackgroundImageUrl).toBe(
      "eazymedia/dynamic_poster/existing.jpg"
    );
  });
});

describe("BackgroundSection (Phase 3B: Master Edit background lock)", () => {
  beforeEach(() => {
    useEditorStore.getState().resetEditor();
    useEditorStore.getState().setTemplate(clone(mockTemplate));
    useEditorStore.getState().setEditorMode("master-edit");
    mockedUpload.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it("master-edit with a background does not expose Upload/Change Image", () => {
    renderBackgroundSection();

    expect(
      screen.queryByRole("button", { name: "Upload Image" })
    ).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Change Image" })
    ).toBeNull();
    expect(screen.queryByRole("button", { name: /Upload|Change/ })).toBeNull();
  });

  it("master-edit does not expose Remove", () => {
    renderBackgroundSection();

    expect(screen.queryByRole("button", { name: "Remove" })).toBeNull();
  });

  it("master-edit keeps the existing background rendered", () => {
    renderBackgroundSection();

    const img = screen.getByAltText("Template background");
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute("src", mockTemplate.background.imageUrl);
  });
});