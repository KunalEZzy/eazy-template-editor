import { describe, it, expect, beforeEach } from "vitest";
import { useEditorStore } from "../store/editorStore";
import { applyEditorInitMessage } from "./masterBootstrap";
import { EDITOR_PROTOCOL_VERSION } from "./editorProtocol";
import { mockTemplate } from "../domain/template/template.mock";
import { mockPreviewData } from "../domain/variables/preview.mock";
import { isTemplate } from "../domain/template/template.validation";

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

    it("sets previewData when provided", () => {
      applyEditorInitMessage(validTemplateInit());

      const state = useEditorStore.getState();
      expect(state.previewData).toEqual(clone(mockPreviewData));
    });

    it("clears any prior error", () => {
      useEditorStore.getState().setError("old error");
      applyEditorInitMessage(validTemplateInit());

      expect(useEditorStore.getState().error).toBeNull();
    });
  });
});