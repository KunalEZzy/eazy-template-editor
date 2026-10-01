import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { useEditorStore } from "../src/store/editorStore";
import { mockTemplate } from "../src/domain/template/template.mock";
import { mockPreviewData } from "../src/domain/variables/preview.mock";
import { EditorLayout } from "../src/components/layout/EditorLayout";
import { MASTER_CREATE_DRAFT_KEY } from "../src/integration/masterCreateDraft";

const mockSaveTemplate = vi.hoisted(() => vi.fn());

vi.mock("../src/editor/editor.service", () => {
  class MockEditorService {
    saveTemplate = mockSaveTemplate;
  }
  return {
    EditorService:
      MockEditorService as unknown as typeof import("../src/editor/editor.service").EditorService,
  };
});

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

describe("EditorLayout save checkpoints the master-create draft", () => {
  beforeEach(() => {
    mockSaveTemplate.mockReset();

    vi.stubGlobal(
      "ResizeObserver",
      class ResizeObserverMock {
        observe() {}
        unobserve() {}
        disconnect() {}
      }
    );

    vi.spyOn(console, "error").mockImplementation(() => {});

    window.localStorage.clear();
    useEditorStore.getState().resetEditor();
    useEditorStore.getState().setTemplate(clone(mockTemplate));
    useEditorStore.getState().setPreviewData(mockPreviewData);
    useEditorStore.getState().setEditorMode("master-create");
    useEditorStore.getState().markDirty();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    window.localStorage.clear();
  });

  it("persists the working template with its variables into the draft on Save", async () => {
    const saved = {
      ...clone(mockTemplate),
      version: mockTemplate.version + 1,
      updatedAt: new Date().toISOString(),
    };
    mockSaveTemplate.mockResolvedValueOnce(saved);

    render(<EditorLayout />);

    const saveButton = screen.getByRole("button", { name: /save template/i });
    expect(saveButton).toBeEnabled();
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(useEditorStore.getState().isDirty).toBe(false);
    });

    const raw = window.localStorage.getItem(MASTER_CREATE_DRAFT_KEY);
    expect(raw).toBeTruthy();

    const draft = JSON.parse(raw as string);
    expect(draft).toBeTruthy();
    expect(draft.boxes).toHaveLength(mockTemplate.boxes.length);

    const variables = draft.boxes.map(
      (box: { variable?: string }) => box.variable
    );
    expect(variables).toContain("resNameNL");
    expect(variables).toContain("discount");
    expect(variables).toContain("resQR");
  });
});