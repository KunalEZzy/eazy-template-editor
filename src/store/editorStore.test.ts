import { describe, it, expect, beforeEach } from "vitest";
import { useEditorStore } from "./editorStore";
import { mockTemplate } from "../domain/template/template.mock";
import { isTemplate } from "../domain/template/template.validation";
import type { QRBox } from "../domain/box/box.types";

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

function stateTemplate() {
  const template = useEditorStore.getState().template;
  if (!template) {
    throw new Error("store template is null");
  }
  return template;
}

function boxById(id: string) {
  const box = stateTemplate().boxes.find((b) => b.id === id);
  if (!box) {
    throw new Error(`box ${id} not found`);
  }
  return box;
}

describe("editor store P0", () => {
  beforeEach(() => {
    useEditorStore.getState().resetEditor();
    useEditorStore.getState().setTemplate(clone(mockTemplate));
  });

  describe("setTemplate reset semantics", () => {
    it("resets dirty, history, selection and error when a new template is set", () => {
      useEditorStore.getState().updateBoxTransform("box-restaurant-name", {
        x: 5,
      });
      useEditorStore.getState().selectBox("box-restaurant-name");
      useEditorStore.getState().setError("boom");

      let state = useEditorStore.getState();
      expect(state.isDirty).toBe(true);
      expect(state.past.length).toBeGreaterThan(0);
      expect(state.selectedBoxId).toBe("box-restaurant-name");
      expect(state.error).toBe("boom");

      const next = clone(mockTemplate);
      useEditorStore.getState().setTemplate(next);

      state = useEditorStore.getState();
      expect(state.template).toEqual(next);
      expect(state.isDirty).toBe(false);
      expect(state.past).toEqual([]);
      expect(state.future).toEqual([]);
      expect(state.selectedBoxId).toBeNull();
      expect(state.error).toBeNull();
    });

    it("does not mutate the supplied template", () => {
      const fixture = clone(mockTemplate);
      useEditorStore.getState().setTemplate(fixture);

      useEditorStore.getState().updateBoxTransform("box-restaurant-name", {
        x: 99,
        rotation: 45,
      });

      const stored = boxById("box-restaurant-name");
      expect(stored.x).toBe(99);
      expect(stored.rotation).toBe(45);
      expect(fixture.boxes[0].x).not.toBe(99);
      expect(fixture.boxes[0].rotation).toBe(0);
    });
  });

  describe("updateBoxTransform", () => {
    it("updates geometry including rotation", () => {
      const before = clone(stateTemplate());
      const beforeUpdatedAt = before.updatedAt;

      useEditorStore.getState().updateBoxTransform("box-restaurant-name", {
        x: 30,
        y: 40,
        width: 50,
        height: 15,
        rotation: 45,
      });

      const box = boxById("box-restaurant-name");
      expect(box.x).toBe(30);
      expect(box.y).toBe(40);
      expect(box.width).toBe(50);
      expect(box.height).toBe(15);
      expect(box.rotation).toBe(45);

      const state = useEditorStore.getState();
      expect(state.isDirty).toBe(true);
      expect(state.template!.updatedAt).not.toBe(beforeUpdatedAt);
      expect(Number.isNaN(Date.parse(state.template!.updatedAt))).toBe(false);
    });

    it("preserves unrelated box properties and other boxes", () => {
      const before = clone(stateTemplate());

      useEditorStore.getState().updateBoxTransform("box-restaurant-name", {
        x: 1,
        rotation: 45,
      });

      const box = boxById("box-restaurant-name");
      const beforeBox = before.boxes.find((b) => b.id === box.id)!;

      expect(box.y).toBe(beforeBox.y);
      expect(box.width).toBe(beforeBox.width);
      expect(box.height).toBe(beforeBox.height);
      expect(box.opacity).toBe(beforeBox.opacity);
      expect(box.zIndex).toBe(beforeBox.zIndex);
      expect(box.locked).toBe(beforeBox.locked);
      expect(box.visible).toBe(beforeBox.visible);

      if (box.type === "text" && beforeBox.type === "text") {
        expect(box.fontFamily).toBe(beforeBox.fontFamily);
        expect(box.fontSize).toBe(beforeBox.fontSize);
        expect(box.color).toBe(beforeBox.color);
        expect(box.textTransform).toBe(beforeBox.textTransform);
      }

      const beforeOther = before.boxes.find((b) => b.id === "box-discount");
      const other = stateTemplate().boxes.find(
        (b) => b.id === "box-discount"
      );
      expect(other).toEqual(beforeOther);
    });

    it("records a history snapshot of the pre-update template", () => {
      const before = clone(stateTemplate());

      useEditorStore.getState().updateBoxTransform("box-restaurant-name", {
        x: 20,
        rotation: 45,
      });

      const state = useEditorStore.getState();
      expect(state.past.length).toBe(1);
      expect(state.past[0]).toEqual(before);
    });

    it("clears the future stack on a new edit and records history", () => {
      useEditorStore.getState().updateBoxTransform("box-restaurant-name", {
        x: 10,
      });
      useEditorStore.getState().undo();
      expect(useEditorStore.getState().future.length).toBe(1);

      useEditorStore.getState().updateBoxTransform("box-restaurant-name", {
        x: 14,
        rotation: 45,
      });

      const state = useEditorStore.getState();
      expect(state.future).toEqual([]);
      expect(state.past.length).toBe(1);
    });
  });

  describe("updateTextBox", () => {
    it("updates text properties and preserves base and unrelated properties", () => {
      const before = clone(stateTemplate());

      useEditorStore.getState().updateTextBox("box-restaurant-name", {
        fontSize: 24,
        color: "#112233",
      });

      const box = boxById("box-restaurant-name");
      expect(box.type).toBe("text");
      if (box.type === "text") {
        expect(box.fontSize).toBe(24);
        expect(box.color).toBe("#112233");
        expect(box.fontWeight).toBe(700);
        expect(box.fontFamily).toBe("Arial");
        expect(box.lineHeight).toBe(1.2);
        expect(box.letterSpacing).toBe(0);
        expect(box.textAlign).toBe("center");
        expect(box.textTransform).toBe("none");
        expect(box.x).toBe(10);
        expect(box.y).toBe(10);
        expect(box.width).toBe(80);
        expect(box.height).toBe(10);
        expect(box.rotation).toBe(0);
        expect(box.opacity).toBe(1);
        expect(box.zIndex).toBe(1);
        expect(box.locked).toBe(false);
        expect(box.visible).toBe(true);
      }

      const state = useEditorStore.getState();
      expect(state.isDirty).toBe(true);
      expect(state.template!.updatedAt).not.toBe(before.updatedAt);
      expect(state.past.length).toBe(1);

      const beforeOther = before.boxes.find(
        (b) => b.id === "box-restaurant-qr"
      );
      const other = stateTemplate().boxes.find(
        (b) => b.id === "box-restaurant-qr"
      );
      expect(other).toEqual(beforeOther);
    });

    it("color-only text changes do not record history", () => {
      useEditorStore.getState().updateTextBox("box-restaurant-name", {
        color: "#ff0000",
      });

      const state = useEditorStore.getState();
      expect(state.isDirty).toBe(true);
      expect(state.template!.boxes[0].rotation).toBe(0);
      expect(state.past).toEqual([]);
    });
  });

  describe("updateQRBox", () => {
    it("updates QR properties including optional logoUrl and preserves base properties", () => {
      const before = clone(stateTemplate());

      useEditorStore.getState().updateQRBox("box-restaurant-qr", {
        foregroundColor: "#0000FF",
        logoUrl: "https://example.com/logo.png",
        height: 25,
      });

      const box = boxById("box-restaurant-qr");
      expect(box.type).toBe("qr");
      if (box.type === "qr") {
        expect(box.foregroundColor).toBe("#0000FF");
        expect(box.backgroundColor).toBe("#FFFFFF");
        expect(box.logoUrl).toBe("https://example.com/logo.png");
        expect(box.x).toBe(35);
        expect(box.y).toBe(65);
        expect(box.width).toBe(30);
        expect(box.height).toBe(25);
        expect(box.rotation).toBe(0);
        expect(box.zIndex).toBe(4);
        expect(box.locked).toBe(false);
        expect(box.visible).toBe(true);
      }

      const state = useEditorStore.getState();
      expect(state.isDirty).toBe(true);
      expect(state.template!.updatedAt).not.toBe(before.updatedAt);
      expect(state.past.length).toBe(1);

      const beforeOther = before.boxes.find(
        (b) => b.id === "box-location"
      );
      const other = stateTemplate().boxes.find(
        (b) => b.id === "box-location"
      );
      expect(other).toEqual(beforeOther);
    });

    it("color-only QR changes do not record history", () => {
      useEditorStore.getState().updateQRBox("box-restaurant-qr", {
        backgroundColor: "#000000",
      });

      const state = useEditorStore.getState();
      expect(state.isDirty).toBe(true);
      expect(state.past).toEqual([]);
    });
  });

  describe("addVariable", () => {
    it("adds a valid text box with a unique id, marks dirty and selects it", () => {
      const beforeIds = stateTemplate().boxes.map((b) => b.id);

      useEditorStore.getState().addVariable("discount");

      const state = useEditorStore.getState();
      const boxes = stateTemplate().boxes;
      expect(boxes.length).toBe(beforeIds.length + 1);

      const added = boxes[boxes.length - 1];
      expect(added.type).toBe("text");
      expect(beforeIds).not.toContain(added.id);
      expect(new Set(boxes.map((b) => b.id)).size).toBe(boxes.length);

      expect(isTemplate(state.template)).toBe(true);
      expect(state.isDirty).toBe(true);
      expect(state.selectedBoxId).toBe(added.id);
      expect(state.past.length).toBeGreaterThan(0);
    });

    it("adds a valid QR box for a QR variable", () => {
      useEditorStore.getState().addVariable("resQR");

      const state = useEditorStore.getState();
      const added = stateTemplate().boxes[stateTemplate().boxes.length - 1];
      expect(added.type).toBe("qr");
      if (added.type === "qr") {
        expect(added.foregroundColor).toBe("#000000");
        expect(added.backgroundColor).toBe("#FFFFFF");
      }

      expect(isTemplate(state.template)).toBe(true);
      expect(state.isDirty).toBe(true);
    });
  });

  describe("updateQRBox regeneration trigger", () => {
    const contentCases: Array<{
      label: string;
      changes: Partial<Omit<QRBox, "id" | "type">>;
    }> = [
      { label: "foregroundColor", changes: { foregroundColor: "#123456" } },
      { label: "backgroundColor", changes: { backgroundColor: "#FEDCBA" } },
      { label: "logoUrl", changes: { logoUrl: "https://example.com/logo.png" } },
      { label: "variable", changes: { variable: "resQRPayEazy" } },
    ];

    it.each(contentCases)(
      "increments templateLoadVersion when $label changes",
      ({ changes }) => {
        const before = useEditorStore.getState().templateLoadVersion;
        useEditorStore.getState().updateQRBox("box-restaurant-qr", changes);
        expect(useEditorStore.getState().templateLoadVersion).toBe(before + 1);
      }
    );

    it("does not increment templateLoadVersion for geometry-only QR edits", () => {
      const before = useEditorStore.getState().templateLoadVersion;
      useEditorStore.getState().updateQRBox("box-restaurant-qr", {
        height: 25,
      });
      expect(useEditorStore.getState().templateLoadVersion).toBe(before);
    });

    it("does not increment templateLoadVersion for box transform edits", () => {
      const before = useEditorStore.getState().templateLoadVersion;
      useEditorStore.getState().updateBoxTransform("box-restaurant-qr", {
        x: 42,
        rotation: 45,
      });
      expect(useEditorStore.getState().templateLoadVersion).toBe(before);
    });
  });
});