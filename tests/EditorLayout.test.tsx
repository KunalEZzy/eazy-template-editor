import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { useEditorStore } from "../../store/editorStore";
import { mockTemplate } from "../../domain/template/template.mock";
import { mockPreviewData } from "../../domain/variables/preview.mock";
import { EditorLayout } from "./EditorLayout";

const mockSaveTemplate = vi.hoisted(() => vi.fn());

vi.mock("../../editor/editor.service", () => {
  class MockEditorService {
    saveTemplate = mockSaveTemplate;
  }
  return {
    EditorService:
      MockEditorService as unknown as typeof import("../../editor/editor.service").EditorService,
  };
});

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

describe("EditorLayout save failure recovery", () => {
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

    useEditorStore.getState().resetEditor();
    useEditorStore.getState().setTemplate(clone(mockTemplate));
    useEditorStore.getState().setPreviewData(mockPreviewData);
    useEditorStore.getState().markDirty();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("shows a recoverable inline error on save failure", async () => {
    mockSaveTemplate.mockRejectedValueOnce(
      new Error("Storage quota exceeded")
    );

    render(<EditorLayout />);

    const saveButton = screen.getByRole("button", {
      name: /save template/i,
    });
    expect(saveButton).toBeEnabled();

    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(screen.getByText(/save failed/i)).toBeInTheDocument();
    });

    expect(
      screen.getByText(/storage quota exceeded/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/your changes are still on the canvas/i)
    ).toBeInTheDocument();

    expect(useEditorStore.getState().error).toBeNull();
    expect(useEditorStore.getState().isDirty).toBe(true);

    expect(
      screen.getByRole("button", { name: /save template/i })
    ).toBeEnabled();
  });

  it("clears the error on successful retry", async () => {
    mockSaveTemplate.mockRejectedValueOnce(new Error("Quota exceeded"));

    render(<EditorLayout />);

    const saveButton = screen.getByRole("button", {
      name: /save template/i,
    });

    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(screen.getByText(/save failed/i)).toBeInTheDocument();
    });

    expect(useEditorStore.getState().isDirty).toBe(true);

    const saved = {
      ...clone(mockTemplate),
      version: mockTemplate.version + 1,
      updatedAt: new Date().toISOString(),
    };
    mockSaveTemplate.mockResolvedValueOnce(saved);

    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(useEditorStore.getState().isDirty).toBe(false);
    });

    expect(screen.queryByText(/save failed/i)).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /save template/i })
    ).toBeInTheDocument();
  });
});