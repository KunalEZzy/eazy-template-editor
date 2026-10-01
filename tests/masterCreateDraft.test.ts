import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { useEditorStore } from "../src/store/editorStore";
import {
  MASTER_CREATE_DRAFT_KEY,
  saveMasterCreateDraft,
  loadMasterCreateDraft,
  clearMasterCreateDraft,
} from "../src/integration/masterCreateDraft";
import { applyEditorInitMessage } from "../src/integration/masterBootstrap";
import { applySaveSuccessMessage } from "../src/integration/masterSubmit";
import { EDITOR_PROTOCOL_VERSION } from "../src/integration/editorProtocol";
import { createEmptyTemplate } from "../src/domain/template/template.empty";
import { mockTemplate } from "../src/domain/template/template.mock";

const CDN_URL =
  "https://d3i73ruu2t7lui.cloudfront.net/eazymedia/dynamic_poster/abc.jpg";

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

describe("master create draft", () => {
  beforeEach(() => {
    localStorage.clear();
    useEditorStore.getState().resetEditor();
  });

  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  describe("storage round trip", () => {
    it("returns null when nothing is stored", () => {
      expect(loadMasterCreateDraft()).toBeNull();
    });

    it("persists and reads back a valid template", () => {
      const template = createEmptyTemplate();
      template.background.imageUrl = CDN_URL;

      saveMasterCreateDraft(template);

      expect(loadMasterCreateDraft()?.background.imageUrl).toBe(CDN_URL);
    });

    it("stores under its own key, not the local template repository key", () => {
      saveMasterCreateDraft(createEmptyTemplate());

      expect(localStorage.getItem(MASTER_CREATE_DRAFT_KEY)).not.toBeNull();
      expect(localStorage.getItem("eazy-template-editor:templates")).toBeNull();
    });

    it("discards corrupt JSON instead of throwing", () => {
      localStorage.setItem(MASTER_CREATE_DRAFT_KEY, "{not json");

      expect(loadMasterCreateDraft()).toBeNull();
    });

    it("disards a draft that is not a valid template shape", () => {
      localStorage.setItem(MASTER_CREATE_DRAFT_KEY, JSON.stringify({ nope: true }));

      expect(loadMasterCreateDraft()).toBeNull();
    });

    it("clears the draft", () => {
      saveMasterCreateDraft(createEmptyTemplate());
      clearMasterCreateDraft();

      expect(loadMasterCreateDraft()).toBeNull();
    });

    it("never throws when localStorage rejects the write (quota/private mode)", () => {
      const spy = vi
        .spyOn(Storage.prototype, "setItem")
        .mockImplementation(() => {
          throw new DOMException("QuotaExceededError");
        });

      expect(() => saveMasterCreateDraft(createEmptyTemplate())).not.toThrow();
      expect(spy).toHaveBeenCalled();
    });

    it("never throws when reading localStorage throws", () => {
      vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
        throw new DOMException("SecurityError");
      });

      expect(loadMasterCreateDraft()).toBeNull();
    });
  });

  describe("restore on bootstrap", () => {
    it("restores the draft instead of a blank template on master-create", () => {
      const draft = createEmptyTemplate();
      draft.background.imageUrl = CDN_URL;
      saveMasterCreateDraft(draft);

      applyEditorInitMessage(nullTemplateInit());

      const state = useEditorStore.getState();
      expect(state.editorMode).toBe("master-create");
      expect(state.template?.background.imageUrl).toBe(CDN_URL);
    });

    it("falls back to a blank template when no draft exists", () => {
      applyEditorInitMessage(nullTemplateInit());

      const state = useEditorStore.getState();
      expect(state.template?.background.imageUrl).toBeNull();
      expect(state.template?.boxes).toEqual([]);
    });

    it("ignores a stale draft when editing a persisted template", () => {
      const draft = createEmptyTemplate();
      draft.background.imageUrl = CDN_URL;
      saveMasterCreateDraft(draft);

      applyEditorInitMessage({
        type: "EDITOR_INIT" as const,
        version: EDITOR_PROTOCOL_VERSION,
        payload: {
          mode: "master" as const,
          template: clone(mockTemplate),
          capabilities: { canSave: true },
        },
      });

      const state = useEditorStore.getState();
      // The persisted row wins...
      expect(state.template?.background.imageUrl).toBe(
        mockTemplate.background.imageUrl
      );
      // ...and the draft is cleared so it cannot leak into the next CREATE.
      expect(loadMasterCreateDraft()).toBeNull();
    });
  });

  it("clears the draft once the template is successfully submitted", () => {
    saveMasterCreateDraft(createEmptyTemplate());

    applySaveSuccessMessage({
      type: "SAVE_SUCCESS" as const,
      version: EDITOR_PROTOCOL_VERSION,
      payload: { template: clone(mockTemplate), id: "42" },
    });

    expect(loadMasterCreateDraft()).toBeNull();
  });
});
