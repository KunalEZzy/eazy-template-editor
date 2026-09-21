import { describe, it, expect, beforeEach } from "vitest";
import { useEditorStore } from "../src/store/editorStore";
import { mockTemplate } from "../src/domain/template/template.mock";

const ORIGINAL_BACKGROUND =
  "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1200&q=80";

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

describe("editor store background lock (Phase 3E)", () => {
  beforeEach(() => {
    useEditorStore.getState().resetEditor();
    useEditorStore.getState().setTemplate(clone(mockTemplate));
  });

  describe("master-edit rejects background mutations", () => {
    it("setTemporaryBackgroundImage does not change background.imageUrl", () => {
      useEditorStore.getState().setEditorMode("master-edit");

      useEditorStore
        .getState()
        .setTemporaryBackgroundImage("eazymedia/dynamic_poster/uploaded-new.jpg");

      const template = useEditorStore.getState().template;
      expect(template?.background.imageUrl).toBe(ORIGINAL_BACKGROUND);
    });

    it("does not create an unintended temporary background state", () => {
      useEditorStore.getState().setEditorMode("master-edit");

      useEditorStore
        .getState()
        .setTemporaryBackgroundImage("eazymedia/dynamic_poster/uploaded-new.jpg");

      const state = useEditorStore.getState();
      expect(state.temporaryBackgroundImageUrl).toBeNull();
      expect(state.isDirty).toBe(false);
      expect(state.past).toEqual([]);
      expect(state.future).toEqual([]);
    });

    it("no unrelated template fields are affected", () => {
      useEditorStore.getState().setEditorMode("master-edit");
      const snapshot = clone(useEditorStore.getState().template);

      useEditorStore
        .getState()
        .setTemporaryBackgroundImage("eazymedia/dynamic_poster/uploaded-new.jpg", {
          width: 900,
          height: 700,
        });

      const template = useEditorStore.getState().template;
      expect(template).toEqual(snapshot);
    });

    it("existing background stays intact through undo/redo", () => {
      useEditorStore.getState().setEditorMode("master-edit");

      // A background mutation in master-edit is rejected and records no history.
      useEditorStore
        .getState()
        .setTemporaryBackgroundImage("eazymedia/dynamic_poster/attempted.jpg");

      // A normal box edit still records history carrying the existing background.
      useEditorStore.getState().updateTextBox("box-restaurant-name", {
        content: "Edited in master-edit",
      });

      let template = useEditorStore.getState().template;
      expect(template?.background.imageUrl).toBe(ORIGINAL_BACKGROUND);
      expect(template?.boxes[0].content).toBe("Edited in master-edit");

      useEditorStore.getState().undo();

      template = useEditorStore.getState().template;
      expect(template?.background.imageUrl).toBe(ORIGINAL_BACKGROUND);

      useEditorStore.getState().redo();

      template = useEditorStore.getState().template;
      expect(template?.background.imageUrl).toBe(ORIGINAL_BACKGROUND);
      expect(template?.boxes[0].content).toBe("Edited in master-edit");
    });
  });

  describe("non-master-edit modes keep existing behavior", () => {
    it("master-create background mutation still works", () => {
      useEditorStore.getState().setEditorMode("master-create");

      useEditorStore
        .getState()
        .setTemporaryBackgroundImage("eazymedia/dynamic_poster/uploaded-new.jpg");

      const state = useEditorStore.getState();
      expect(state.template?.background.imageUrl).toBe(
        "eazymedia/dynamic_poster/uploaded-new.jpg"
      );
      expect(state.temporaryBackgroundImageUrl).toBe(
        "eazymedia/dynamic_poster/uploaded-new.jpg"
      );
      expect(state.isDirty).toBe(true);
    });

    it("restaurant existing behavior remains unchanged", () => {
      useEditorStore.getState().setEditorMode("restaurant");

      useEditorStore
        .getState()
        .setTemporaryBackgroundImage("eazymedia/dynamic_poster/restaurant.jpg");

      const state = useEditorStore.getState();
      expect(state.template?.background.imageUrl).toBe(
        "eazymedia/dynamic_poster/restaurant.jpg"
      );
      expect(state.temporaryBackgroundImageUrl).toBe(
        "eazymedia/dynamic_poster/restaurant.jpg"
      );
    });

    it("null/standalone existing behavior remains unchanged", () => {
      useEditorStore.getState().setEditorMode(null);

      useEditorStore
        .getState()
        .setTemporaryBackgroundImage("eazymedia/dynamic_poster/standalone.jpg");

      const state = useEditorStore.getState();
      expect(state.template?.background.imageUrl).toBe(
        "eazymedia/dynamic_poster/standalone.jpg"
      );
      expect(state.temporaryBackgroundImageUrl).toBe(
        "eazymedia/dynamic_poster/standalone.jpg"
      );
    });
  });
});