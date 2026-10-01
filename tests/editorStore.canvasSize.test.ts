import { describe, it, expect, beforeEach } from "vitest";
import { useEditorStore } from "../src/store/editorStore";
import { mockTemplate } from "../src/domain/template/template.mock";

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

describe("matchCanvasToBackground", () => {
  beforeEach(() => {
    useEditorStore.getState().resetEditor();
    useEditorStore.getState().setTemplate(clone(mockTemplate));
  });

  it("adopts the background image's aspect ratio", () => {
    // Real legacy artwork: 5400x10800 (1:2) in a 1200x1600 (3:4) document.
    useEditorStore.getState().matchCanvasToBackground(5400, 10800);

    const { canvasWidth, canvasHeight } =
      useEditorStore.getState().template!.settings;

    expect(canvasWidth / canvasHeight).toBeCloseTo(0.5, 2);
  });

  it("runs for a template that already has boxes", () => {
    expect(mockTemplate.boxes.length).toBeGreaterThan(0);

    const before =
      useEditorStore.getState().template!.settings.canvasWidth /
      useEditorStore.getState().template!.settings.canvasHeight;

    useEditorStore.getState().matchCanvasToBackground(5400, 10800);

    const after =
      useEditorStore.getState().template!.settings.canvasWidth /
      useEditorStore.getState().template!.settings.canvasHeight;

    expect(after).not.toBeCloseTo(before, 2);
  });

  it("applies in master-edit so saved templates open at the right size", () => {
    useEditorStore.getState().setEditorMode("master-edit");

    useEditorStore.getState().matchCanvasToBackground(5400, 10800);

    expect(
      useEditorStore.getState().template!.settings.canvasWidth /
        useEditorStore.getState().template!.settings.canvasHeight
    ).toBeCloseTo(0.5, 2);
  });

  it("never alters the background image in master-edit", () => {
    useEditorStore.getState().setEditorMode("master-edit");
    const backgroundBefore = {
      ...useEditorStore.getState().template!.background,
    };

    useEditorStore.getState().matchCanvasToBackground(5400, 10800);

    expect(useEditorStore.getState().template!.background).toEqual(
      backgroundBefore
    );
  });

  it("leaves font sizes untouched because the resize preserves area", () => {
    const fontsBefore = useEditorStore
      .getState()
      .template!.boxes.filter((b) => b.type === "text")
      .map((b) => (b.type === "text" ? b.fontSize : 0));

    useEditorStore.getState().matchCanvasToBackground(5400, 10800);

    const fontsAfter = useEditorStore
      .getState()
      .template!.boxes.filter((b) => b.type === "text")
      .map((b) => (b.type === "text" ? b.fontSize : 0));

    expect(fontsAfter).toEqual(fontsBefore);
  });

  it("preserves box geometry so nothing moves", () => {
    const boxesBefore = clone(useEditorStore.getState().template!.boxes);

    useEditorStore.getState().matchCanvasToBackground(5400, 10800);

    expect(useEditorStore.getState().template!.boxes).toEqual(boxesBefore);
  });

  it("is idempotent, so repeated loads cannot accumulate", () => {
    useEditorStore.getState().matchCanvasToBackground(5400, 10800);
    const first = clone(useEditorStore.getState().template);

    useEditorStore.getState().matchCanvasToBackground(5400, 10800);
    useEditorStore.getState().matchCanvasToBackground(5400, 10800);

    expect(useEditorStore.getState().template).toEqual(first);
  });

  it("does not mark the template dirty for a view-time resize", () => {
    useEditorStore.getState().matchCanvasToBackground(5400, 10800);

    expect(useEditorStore.getState().isDirty).toBe(false);
  });

  it("is a no-op when the document already matches the image", () => {
    const templateBefore = useEditorStore.getState().template;

    useEditorStore
      .getState()
      .matchCanvasToBackground(
        templateBefore!.settings.canvasWidth,
        templateBefore!.settings.canvasHeight
      );

    expect(useEditorStore.getState().template).toBe(templateBefore);
  });

  it("ignores an invalid image size", () => {
    const templateBefore = useEditorStore.getState().template;

    useEditorStore.getState().matchCanvasToBackground(0, 100);
    useEditorStore.getState().matchCanvasToBackground(100, 0);

    expect(useEditorStore.getState().template).toBe(templateBefore);
  });

  it("does nothing without a template", () => {
    useEditorStore.getState().resetEditor();

    useEditorStore.getState().matchCanvasToBackground(5400, 10800);

    expect(useEditorStore.getState().template).toBeNull();
  });

  it("leaves the document and fonts alone for pathological artwork", () => {
    // Capture the reference, not a copy: the point is that the store emits no
    // update at all.
    const templateBefore = useEditorStore.getState().template;

    useEditorStore.getState().matchCanvasToBackground(1080, 20000);

    expect(useEditorStore.getState().template).toBe(templateBefore);
  });

  it("keeps both axes inside the export budget for real artwork", () => {
    useEditorStore.getState().matchCanvasToBackground(5400, 10800);

    const { canvasWidth, canvasHeight } =
      useEditorStore.getState().template!.settings;

    expect(Math.max(canvasWidth, canvasHeight)).toBeLessThanOrEqual(4000);
  });
});
