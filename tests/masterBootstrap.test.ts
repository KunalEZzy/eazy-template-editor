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
  });
});