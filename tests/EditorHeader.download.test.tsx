import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  render,
  screen,
  fireEvent,
  cleanup,
} from "@testing-library/react";
import { EditorHeader, type DesignTokens } from "../src/components/layout/EditorHeader";
import { mockTemplate } from "../src/domain/template/template.mock";
import { useEditorStore } from "../src/store/editorStore";
import type { EditorRuntimeMode } from "../src/store/editor.types";

function tokens(): DesignTokens {
  return {
    bg: "#f3f4f6",
    panelBg: "#ffffff",
    border: "#e5e7eb",
    text: "#4b5563",
    textActive: "#111827",
    gridDot: "#d1d5db",
    accent: "#7c3aed",
    accentHover: "#6d28d9",
    accentLight: "#f3e8ff",
    accentText: "#6d28d9",
    cardBg: "#ffffff",
    toolBtnBg: "#f3f4f6",
    toolBtnBorder: "#e5e7eb",
    shadow: "none",
  };
}

function renderHeader() {
  render(
    <EditorHeader
      template={mockTemplate}
      selectedBoxId={null}
      isDirty={false}
      isSaving={false}
      submitStatus="idle"
      submitMessage={null}
      tokens={tokens()}
      onSave={() => {}}
      onSubmit={() => {}}
    />
  );
}

function setMode(mode: EditorRuntimeMode) {
  useEditorStore.getState().setEditorMode(mode);
}

describe("EditorHeader download visibility (Phase 3C)", () => {
  beforeEach(() => {
    useEditorStore.getState().resetEditor();
  });

  afterEach(() => {
    cleanup();
  });

  it("master-create does not expose Download PNG or Download PDF", () => {
    setMode("master-create");
    renderHeader();

    expect(screen.queryByRole("button", { name: /download png/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /download pdf/i })).toBeNull();
  });

  it("master-edit does not expose Download PNG or Download PDF", () => {
    setMode("master-edit");
    renderHeader();

    expect(screen.queryByRole("button", { name: /download png/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /download pdf/i })).toBeNull();
  });

  it("restaurant exposes both Download PNG and Download PDF", () => {
    setMode("restaurant");
    renderHeader();

    expect(
      screen.getByRole("button", { name: /download png/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /download pdf/i })
    ).toBeInTheDocument();
  });

  it("clicking Download PNG still dispatches the export event with format png", () => {
    setMode("restaurant");
    renderHeader();

    const details: unknown[] = [];
    const listener = (event: Event) => {
      details.push((event as CustomEvent).detail);
    };
    window.addEventListener("eazy:export-canvas", listener);

    fireEvent.click(
      screen.getByRole("button", { name: /download png/i })
    );

    window.removeEventListener("eazy:export-canvas", listener);

    expect(details).toEqual([{ format: "png" }]);
  });

  it("clicking Download PDF still dispatches the export event with format pdf", () => {
    setMode("restaurant");
    renderHeader();

    const details: unknown[] = [];
    const listener = (event: Event) => {
      details.push((event as CustomEvent).detail);
    };
    window.addEventListener("eazy:export-canvas", listener);

    fireEvent.click(
      screen.getByRole("button", { name: /download pdf/i })
    );

    window.removeEventListener("eazy:export-canvas", listener);

    expect(details).toEqual([{ format: "pdf" }]);
  });

  it("Save Template and Submit Template controls remain in master modes", () => {
    setMode("master-edit");
    renderHeader();

    expect(
      screen.getByRole("button", { name: /save template/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /submit template/i })
    ).toBeInTheDocument();
  });
});