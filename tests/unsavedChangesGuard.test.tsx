import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { useEditorStore } from "../src/store/editorStore";
import { useUnsavedChangesGuard } from "../src/hooks/useUnsavedChangesGuard";
import { applySetBackgroundImageMessage } from "../src/integration/masterBootstrap";
import { EDITOR_PROTOCOL_VERSION } from "../src/integration/editorProtocol";
import { createEmptyTemplate } from "../src/domain/template/template.empty";
import { loadMasterCreateDraft } from "../src/integration/masterCreateDraft";
import { mockTemplate } from "../src/domain/template/template.mock";

const CDN_URL =
  "https://d3i73ruu2t7lui.cloudfront.net/eazymedia/dynamic_poster/abc.jpg";

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

function setBackground(imageUrl: unknown = CDN_URL) {
  return {
    type: "SET_BACKGROUND_IMAGE" as const,
    version: EDITOR_PROTOCOL_VERSION,
    payload: { imageUrl },
  };
}

/**
 * The store exposes no `setIsDirty`. `isDirty` is a derived flag flipped by
 * real mutations, so drive it the way the app does: applying a background is
 * a genuine master-create edit and sets the flag.
 */
function makeDirtyInMasterCreate() {
  useEditorStore.getState().setTemplate(createEmptyTemplate());
  useEditorStore.getState().setEditorMode("master-create");
  applySetBackgroundImageMessage(setBackground());
}

describe("beforeunload guard", () => {
  beforeEach(() => {
    localStorage.clear();
    useEditorStore.getState().resetEditor();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function fireBeforeUnload() {
    const event = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(event);
    return event;
  }

  it("prompts when a master-create session is dirty", () => {
    makeDirtyInMasterCreate();

    const { unmount } = renderHook(() => useUnsavedChangesGuard());

    expect(fireBeforeUnload().defaultPrevented).toBe(true);
    unmount();
  });

  it("does not prompt once the session is clean", () => {
    useEditorStore.getState().setTemplate(createEmptyTemplate());
    useEditorStore.getState().setEditorMode("master-create");

    const { unmount } = renderHook(() => useUnsavedChangesGuard());

    expect(fireBeforeUnload().defaultPrevented).toBe(false);
    unmount();
  });

  it("does not prompt in master-edit (the row is already persisted)", () => {
    useEditorStore.getState().setTemplate(clone(mockTemplate));
    useEditorStore.getState().setEditorMode("master-edit");
    // Dirty via a real mutation that master-edit still allows: editing a box
    // sets isDirty without touching the (locked) background.
    const boxId = mockTemplate.boxes[0]?.id ?? "box1";
    useEditorStore.getState().updateTextBox(boxId, { content: "changed" });
    expect(useEditorStore.getState().isDirty).toBe(true);

    const { unmount } = renderHook(() => useUnsavedChangesGuard());

    expect(fireBeforeUnload().defaultPrevented).toBe(false);
    unmount();
  });

  it("detaches the listener on unmount", () => {
    makeDirtyInMasterCreate();

    const { unmount } = renderHook(() => useUnsavedChangesGuard());
    unmount();

    expect(fireBeforeUnload().defaultPrevented).toBe(false);
  });
});

describe("background apply checkpoints a draft", () => {
  beforeEach(() => {
    localStorage.clear();
    useEditorStore.getState().resetEditor();
    useEditorStore.getState().setTemplate(createEmptyTemplate());
    useEditorStore.getState().setEditorMode("master-create");
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("saves the uploaded background so a refresh cannot orphan the S3 object", () => {
    applySetBackgroundImageMessage(setBackground());

    expect(loadMasterCreateDraft()?.background.imageUrl).toBe(CDN_URL);
  });

  it("marks the session dirty, which is what arms the refresh warning", () => {
    applySetBackgroundImageMessage(setBackground());

    expect(useEditorStore.getState().isDirty).toBe(true);
  });

  it("does not write a draft in master-edit", () => {
    useEditorStore.getState().setEditorMode("master-edit");

    expect(() => applySetBackgroundImageMessage(setBackground())).toThrow();
    expect(loadMasterCreateDraft()).toBeNull();
  });
});
