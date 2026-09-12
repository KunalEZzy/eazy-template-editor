import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { EditorLayout } from "../components/layout/EditorLayout";
import { useEditorStore } from "../store/editorStore";
import { mockTemplate } from "../domain/template/template.mock";
import { mockPreviewData } from "../domain/variables/preview.mock";

interface PdfInstance {
  orientation: string;
  unit: string;
  format: number[];
  addImageCalls: unknown[][];
  savedName: string | null;
}

const pdfMock = vi.hoisted(() => ({
  instances: [] as PdfInstance[],
}));

vi.mock("jspdf", () => {
  class MockJsPdf {
    orientation: string;
    unit: string;
    format: number[];
    addImageCalls: unknown[][] = [];
    savedName: string | null = null;

    constructor(options: {
      orientation: string;
      unit: string;
      format: number[];
    }) {
      this.orientation = options.orientation;
      this.unit = options.unit;
      this.format = options.format;
      pdfMock.instances.push(this as unknown as PdfInstance);
    }

    addImage(...args: unknown[]) {
      this.addImageCalls.push(args);
    }

    save(filename: string) {
      this.savedName = filename;
    }
  }

  return { default: MockJsPdf };
});

const EXPORT_IMAGE = "data:image/png;base64,AA==";

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

function dispatchExport(format: "png" | "pdf") {
  return window.dispatchEvent(
    new CustomEvent("eazy:export-canvas", { detail: { format } })
  );
}

let toDataUrlSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  pdfMock.instances.length = 0;
  toDataUrlSpy = vi
    .spyOn(HTMLCanvasElement.prototype, "toDataURL")
    .mockReturnValue(EXPORT_IMAGE);
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});

  vi.stubGlobal(
    "ResizeObserver",
    class ResizeObserverMock {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  );

  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
    width: 1600,
    height: 1700,
    top: 0,
    left: 0,
    right: 1600,
    bottom: 1700,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  } as DOMRect);

  useEditorStore.getState().resetEditor();
  useEditorStore.getState().setTemplate(clone(mockTemplate));
  useEditorStore.getState().setPreviewData(clone(mockPreviewData));
  useEditorStore.getState().markDirty();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("CanvasEditor export", () => {
  it("PNG export reaches the handler, reads the live fabric canvas, and does not require Save", () => {
    render(<EditorLayout />);
    expect(
      screen.getByRole("button", { name: /save template/i })
    ).toBeInTheDocument();

    dispatchExport("png");

    expect(toDataUrlSpy).toHaveBeenCalled();
    expect(useEditorStore.getState().isDirty).toBe(true);
    expect(
      screen.getByRole("button", { name: /save template/i })
    ).toBeInTheDocument();
  });

  it("PDF export feeds the generated canvas image into jsPDF at canvas dimensions", () => {
    render(<EditorLayout />);

    dispatchExport("pdf");

    const pdf = pdfMock.instances[pdfMock.instances.length - 1];
    expect(pdf).toBeTruthy();
    expect(pdf.orientation).toBe("portrait");
    expect(pdf.unit).toBe("px");
    expect(pdf.format).toEqual([
      mockTemplate.settings.canvasWidth,
      mockTemplate.settings.canvasHeight,
    ]);
    expect(pdf.addImageCalls).toHaveLength(1);
    expect(pdf.addImageCalls[0]).toEqual([
      EXPORT_IMAGE,
      "PNG",
      0,
      0,
      mockTemplate.settings.canvasWidth,
      mockTemplate.settings.canvasHeight,
    ]);
    expect(pdf.savedName).toContain(
      `${mockTemplate.settings.canvasWidth}x${mockTemplate.settings.canvasHeight}.pdf`
    );
  });

  it("export failure reports an error without destroying the editor and allows a retry", () => {
    render(<EditorLayout />);

    toDataUrlSpy.mockRestore();
    vi.spyOn(HTMLCanvasElement.prototype, "toDataURL").mockImplementation(() => {
      throw new Error("canvas tainted");
    });

    const reported: unknown[] = [];
    const onError = (event: ErrorEvent) => reported.push(event.error);
    window.addEventListener("error", onError);

    dispatchExport("png");

    expect(reported.length).toBeGreaterThan(0);
    expect((reported[0] as Error).message).toBe("canvas tainted");
    expect(document.querySelector("canvas")).toBeTruthy();
    expect(useEditorStore.getState().isDirty).toBe(true);
    window.removeEventListener("error", onError);

    vi.restoreAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
    const retrySpy = vi
      .spyOn(HTMLCanvasElement.prototype, "toDataURL")
      .mockReturnValue(EXPORT_IMAGE);
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

    dispatchExport("png");

    expect(retrySpy).toHaveBeenCalled();
    expect(
      screen.getByRole("button", { name: /save template/i })
    ).toBeInTheDocument();
  });
});