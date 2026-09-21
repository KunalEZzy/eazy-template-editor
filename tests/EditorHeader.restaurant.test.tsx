import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
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
      isDirty={true}
      isSaving={false}
      submitStatus="idle"
      submitMessage={null}
      tokens={tokens()}
      onSave={() => {}}
      onSubmit={() => {}}
    />
  );
}

function setMode(mode: EditorRuntimeMode | null) {
  if (mode === null) {
    useEditorStore.getState().setEditorMode(null);
  } else {
    useEditorStore.getState().setEditorMode(mode);
  }
}

describe("EditorHeader Save/Submit visibility (Phase 3D)", () => {
  beforeEach(() => {
    useEditorStore.getState().resetEditor();
  });

  afterEach(() => {
    cleanup();
  });

  it("restaurant does not expose Save Template", () => {
    setMode("restaurant");
    renderHeader();

    expect(screen.queryByRole("button", { name: /save template/i })).toBeNull();
  });

  it("restaurant does not expose Submit Template", () => {
    setMode("restaurant");
    renderHeader();

    expect(
      screen.queryByRole("button", { name: /submit template/i })
    ).toBeNull();
  });

  it("master-create still exposes Save Template and Submit Template", () => {
    setMode("master-create");
    renderHeader();

    expect(
      screen.getByRole("button", { name: /save template/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /submit template/i })
    ).toBeInTheDocument();
  });

  it("master-edit still exposes Save Template and Submit Template", () => {
    setMode("master-edit");
    renderHeader();

    expect(
      screen.getByRole("button", { name: /save template/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /submit template/i })
    ).toBeInTheDocument();
  });

  it("null/standalone behaves as before: Save and Submit remain visible", () => {
    setMode(null);
    renderHeader();

    expect(
      screen.getByRole("button", { name: /save template/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /submit template/i })
    ).toBeInTheDocument();
  });

  it("restaurant Download gating is unchanged: Download PNG/PDF still visible", () => {
    setMode("restaurant");
    renderHeader();

    expect(
      screen.getByRole("button", { name: /download png/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /download pdf/i })
    ).toBeInTheDocument();
  });
});