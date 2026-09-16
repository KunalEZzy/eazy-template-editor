import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { EditorLayout } from "../src/components/layout/EditorLayout";
import { useEditorStore } from "../src/store/editorStore";
import { mockTemplate } from "../src/domain/template/template.mock";
import { mockPreviewData } from "../src/domain/variables/preview.mock";
import { Canvas as FabricCanvas } from "fabric";

const LOGICAL_WIDTH = mockTemplate.settings.canvasWidth;
const LOGICAL_HEIGHT = mockTemplate.settings.canvasHeight;

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

function setDisplayScale(width: number, height: number) {
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
    width,
    height,
    top: 0,
    left: 0,
    right: width,
    bottom: height,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  } as DOMRect);
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

describe("CanvasEditor export dimensions", () => {
  it("documents the PNG multiplier contract: logical 1200x1600 canvas at multiplier 3, independent of display scale", () => {
    const fabricToDataUrl = vi.spyOn(FabricCanvas.prototype, "toDataURL");
    const exportCalls: unknown[][] = [];

    setDisplayScale(1600, 1700); // available ~1536x1636 → scale ~1.02
    render(<EditorLayout />);
    dispatchExport("png");
    exportCalls.push([...fabricToDataUrl.mock.calls.at(-1)!]);

    cleanup();

    setDisplayScale(464, 600); // available ~400x536 → scale ~0.33
    render(<EditorLayout />);
    dispatchExport("png");
    exportCalls.push([...fabricToDataUrl.mock.calls.at(-1)!]);

    expect(exportCalls).toEqual([
      [{ format: "png", multiplier: 3 }],
      [{ format: "png", multiplier: 3 }],
    ]);
  });

  it("renders the export PNG at 3600x4800 pixels (logical 1200x1600 × 3) regardless of display scale", () => {
    const exportedPixels: Array<{ width: number; height: number }> = [];

    toDataUrlSpy.mockImplementation(function (this: HTMLCanvasElement) {
      if (this.width >= 3000 && this.height >= 3000) {
        exportedPixels.push({ width: this.width, height: this.height });
      }
      return EXPORT_IMAGE;
    });

    setDisplayScale(1600, 1700); // scale ~1.02
    render(<EditorLayout />);
    dispatchExport("png");

    cleanup();

    setDisplayScale(464, 600); // scale ~0.33
    render(<EditorLayout />);
    dispatchExport("png");

    expect(exportedPixels).toEqual([
      { width: 3600, height: 4800 },
      { width: 3600, height: 4800 },
    ]);
  });

  it("keeps PDF page dimensions logical (1200x1600) regardless of display scale", () => {
    const pdfs: PdfInstance[] = [];

    setDisplayScale(1600, 1700); // scale ~1.02
    render(<EditorLayout />);
    dispatchExport("pdf");
    pdfs.push(pdfMock.instances.at(-1)!);

    cleanup();

    setDisplayScale(464, 600); // scale ~0.33
    render(<EditorLayout />);
    dispatchExport("pdf");
    pdfs.push(pdfMock.instances.at(-1)!);

    for (const pdf of pdfs) {
      expect(pdf.unit).toBe("px");
      expect(pdf.format).toEqual([LOGICAL_WIDTH, LOGICAL_HEIGHT]);
      expect(pdf.addImageCalls).toHaveLength(1);
      expect(pdf.addImageCalls[0]).toEqual([
        EXPORT_IMAGE,
        "PNG",
        0,
        0,
        LOGICAL_WIDTH,
        LOGICAL_HEIGHT,
      ]);
    }
  });
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