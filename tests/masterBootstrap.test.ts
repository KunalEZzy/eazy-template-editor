import { describe, it, expect, beforeEach } from "vitest";
import { useEditorStore } from "../src/store/editorStore";
import { applyEditorInitMessage } from "../src/integration/masterBootstrap";
import { EDITOR_PROTOCOL_VERSION } from "../src/integration/editorProtocol";
import { mockTemplate } from "../src/domain/template/template.mock";
import { mockPreviewData } from "../src/domain/variables/preview.mock";
import { isTemplate } from "../src/domain/template/template.validation";

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

function nullTemplateInit() {
  return {
    type: "EDITOR_INIT" as const,
    version: EDITOR_PROTOCOL_VERSION,
    payload: {
      mode: "master" as const,
      template: null,
      capabilities: { canSave: true },
    },
  };
}

function validTemplateInit() {
  return {
    type: "EDITOR_INIT" as const,
    version: EDITOR_PROTOCOL_VERSION,
    payload: {
      mode: "master" as const,
      template: clone(mockTemplate),
      previewData: clone(mockPreviewData),
      createdBy: "Designer One",
      capabilities: { canSave: true },
    },
  };
}

/**
 * Mimics the exact Laravel blade payload for Master EDIT: it carries only
 * mode/template/createdBy/capabilities and never a previewData field.
 */
function legacyEditTemplateInit() {
  return {
    type: "EDITOR_INIT" as const,
    version: EDITOR_PROTOCOL_VERSION,
    payload: {
      mode: "master" as const,
      template: clone(mockTemplate),
      createdBy: "Designer One",
      capabilities: { canSave: true },
    },
  };
}

describe("applyEditorInitMessage", () => {
  beforeEach(() => {
    useEditorStore.getState().resetEditor();
  });

  describe("Master CREATE (template: null)", () => {
    it("marks the editor initialized", () => {
      expect(useEditorStore.getState().isInitialized).toBe(false);

      applyEditorInitMessage(nullTemplateInit());

      expect(useEditorStore.getState().isInitialized).toBe(true);
    });

    it("materializes a blank working template so the full editor UI renders", () => {
      applyEditorInitMessage(nullTemplateInit());

      const state = useEditorStore.getState();
      expect(state.template).not.toBeNull();
      expect(isTemplate(state.template)).toBe(true);
      expect(state.template?.boxes).toEqual([]);
    });

    it("never loads the mockTemplate (no boxes, no mock background, no demo data)", () => {
      applyEditorInitMessage(nullTemplateInit());

      const state = useEditorStore.getState();
      expect(state.template).not.toEqual(mockTemplate);
      expect(state.template?.boxes).toEqual([]);
      expect(state.template?.background.imageUrl).toBeNull();
      expect(state.template?.name).not.toBe(mockTemplate.name);
    });

    it("does not populate previewData (no mock variable data)", () => {
      applyEditorInitMessage(nullTemplateInit());

      expect(useEditorStore.getState().previewData).toBeNull();
    });

    it("clears any prior error", () => {
      useEditorStore.getState().setError("old error");
      applyEditorInitMessage(nullTemplateInit());

      expect(useEditorStore.getState().error).toBeNull();
    });

    it("assigns editorMode 'master-create'", () => {
      applyEditorInitMessage(nullTemplateInit());

      expect(useEditorStore.getState().editorMode).toBe("master-create");
    });
  });

  describe("Master EDIT (template provided)", () => {
    it("hydrates the provided template", () => {
      applyEditorInitMessage(validTemplateInit());

      const state = useEditorStore.getState();
      expect(state.template).not.toBeNull();
      expect(isTemplate(state.template)).toBe(true);
      expect(state.template?.id).toBe(mockTemplate.id);
    });

    it("does not set previewData when the Laravel payload carries no previewData field", () => {
      applyEditorInitMessage(legacyEditTemplateInit());

      const state = useEditorStore.getState();
      expect(state.template?.id).toBe(mockTemplate.id);
      expect(state.previewData).toBeNull();
    });

    it("sets previewData when provided", () => {
      applyEditorInitMessage(validTemplateInit());

      const state = useEditorStore.getState();
      expect(state.previewData).toEqual(clone(mockPreviewData));
    });

    it("shows the original creator in the info box when the parent provides one", () => {
      applyEditorInitMessage(legacyEditTemplateInit());

      expect(useEditorStore.getState().creator).toBe("Designer One");
    });

    it("keeps creator empty when the parent does not provide a createdBy", () => {
      applyEditorInitMessage({
        type: "EDITOR_INIT" as const,
        version: EDITOR_PROTOCOL_VERSION,
        payload: {
          mode: "master" as const,
          template: clone(mockTemplate),
          capabilities: { canSave: true },
        },
      });

      expect(useEditorStore.getState().creator).toBe("");
    });

    it("keeps creator empty for Master CREATE with no persisted template", () => {
      applyEditorInitMessage(nullTemplateInit());

      expect(useEditorStore.getState().creator).toBe("");
    });

    it("clears any prior error", () => {
      useEditorStore.getState().setError("old error");
      applyEditorInitMessage(validTemplateInit());

      expect(useEditorStore.getState().error).toBeNull();
    });

    it("assigns editorMode 'master-edit'", () => {
      applyEditorInitMessage(validTemplateInit());

      expect(useEditorStore.getState().editorMode).toBe("master-edit");
    });

    it("assigns editorMode 'master-edit' also for the legacy Laravel payload", () => {
      applyEditorInitMessage(legacyEditTemplateInit());

      expect(useEditorStore.getState().editorMode).toBe("master-edit");
    });
  });

  describe("Master EDIT restores this browser's newer Save Template copy", () => {
    const STORAGE_KEY = "eazy-template-editor:templates";

    function storeLocally(template: unknown) {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify([template])
      );
    }

    beforeEach(() => {
      window.localStorage.clear();
    });

    it("hydrates the local copy and keeps it dirty when it is newer than the row", () => {
      const persisted = {
        ...clone(mockTemplate),
        name: "Database version",
        updatedAt: "2026-02-01T10:00:00.000Z",
      };
      storeLocally({
        ...clone(mockTemplate),
        name: "Saved in this browser",
        updatedAt: "2026-02-01T11:00:00.000Z",
      });

      applyEditorInitMessage({
        type: "EDITOR_INIT" as const,
        version: EDITOR_PROTOCOL_VERSION,
        payload: {
          mode: "master" as const,
          template: persisted,
          createdBy: "Designer One",
          capabilities: { canSave: true },
        },
      });

      const state = useEditorStore.getState();
      expect(state.template?.name).toBe("Saved in this browser");
      expect(state.restoredLocalCopy).toBe(true);
      expect(state.isDirty).toBe(true);
      expect(state.editorMode).toBe("master-edit");
    });

    it("keeps the database row when the local copy is older", () => {
      const persisted = {
        ...clone(mockTemplate),
        name: "Database version",
        updatedAt: "2026-02-01T12:00:00.000Z",
      };
      storeLocally({
        ...clone(mockTemplate),
        name: "Older local copy",
        updatedAt: "2026-02-01T11:00:00.000Z",
      });

      applyEditorInitMessage({
        type: "EDITOR_INIT" as const,
        version: EDITOR_PROTOCOL_VERSION,
        payload: {
          mode: "master" as const,
          template: persisted,
          capabilities: { canSave: true },
        },
      });

      const state = useEditorStore.getState();
      expect(state.template?.name).toBe("Database version");
      expect(state.restoredLocalCopy).toBe(false);
      expect(state.isDirty).toBe(false);
    });

    it("keeps the database row when the local copy belongs to another template", () => {
      const persisted = {
        ...clone(mockTemplate),
        name: "Database version",
        updatedAt: "2026-02-01T10:00:00.000Z",
      };
      storeLocally({
        ...clone(mockTemplate),
        id: "some-other-template",
        name: "Unrelated copy",
        updatedAt: "2026-02-01T11:00:00.000Z",
      });

      applyEditorInitMessage({
        type: "EDITOR_INIT" as const,
        version: EDITOR_PROTOCOL_VERSION,
        payload: {
          mode: "master" as const,
          template: persisted,
          capabilities: { canSave: true },
        },
      });

      expect(useEditorStore.getState().template?.name).toBe(
        "Database version"
      );
      expect(useEditorStore.getState().restoredLocalCopy).toBe(false);
    });

    it("never restores a local copy for Master CREATE", () => {
      storeLocally({
        ...clone(mockTemplate),
        name: "Stale local copy",
        updatedAt: "2026-02-01T11:00:00.000Z",
      });

      applyEditorInitMessage(nullTemplateInit());

      const state = useEditorStore.getState();
      expect(state.editorMode).toBe("master-create");
      expect(state.restoredLocalCopy).toBe(false);
      expect(state.template?.boxes).toEqual([]);
    });

    it("keeps the flag after another local Save, because the row is still not persisted", () => {
      storeLocally({
        ...clone(mockTemplate),
        name: "Saved in this browser",
        updatedAt: "2026-02-01T11:00:00.000Z",
      });

      applyEditorInitMessage({
        type: "EDITOR_INIT" as const,
        version: EDITOR_PROTOCOL_VERSION,
        payload: {
          mode: "master" as const,
          template: {
            ...clone(mockTemplate),
            updatedAt: "2026-02-01T10:00:00.000Z",
          },
          capabilities: { canSave: true },
        },
      });

      expect(useEditorStore.getState().restoredLocalCopy).toBe(true);

      useEditorStore.getState().setTemplate(clone(mockTemplate));

      expect(useEditorStore.getState().restoredLocalCopy).toBe(true);
    });
  });
});