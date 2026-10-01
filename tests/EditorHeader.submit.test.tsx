import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { EditorHeader } from "../src/components/layout/EditorHeader";
import { mockTemplate } from "../src/domain/template/template.mock";
import type { Template } from "../src/domain/template/template.types";
import type { DesignTokens } from "../src/components/layout/EditorHeader";

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

function renderHeader(
  template: Template,
  props: {
    submitStatus?: "idle" | "saving" | "success" | "error";
    onSubmit?: () => void;
  } = {}
) {
  const { submitStatus = "idle", onSubmit = () => {} } = props;
  render(
    <EditorHeader
      template={template}
      selectedBoxId={null}
      isDirty={true}
      isSaving={false}
      submitStatus={submitStatus}
      submitMessage={submitStatus === "error" ? "boom" : null}
      tokens={tokens()}
      onSave={() => {}}
      onSubmit={onSubmit}
    />
  );
}

function submitButton(name: string | RegExp = "Submit Template") {
  return screen.getByRole("button", { name });
}

describe("Submit Template button gating", () => {
  afterEach(() => {
    cleanup();
  });

  it("disabled when required metadata is invalid", () => {
    renderHeader({
      ...mockTemplate,
      name: "",
      campaign: "",
    });

    expect(submitButton()).toBeDisabled();
  });

  it("disabled for whitespace-only template name", () => {
    renderHeader({ ...mockTemplate, name: "   " });

    expect(submitButton()).toBeDisabled();
  });

  it("enabled when required metadata is valid", () => {
    renderHeader(mockTemplate);

    expect(submitButton()).toBeEnabled();
  });

  it("does not mutate an existing template's status when gating submit", () => {
    const template = { ...mockTemplate, active: false };

    renderHeader(template);

    expect(template.active).toBe(false);
  });
});

describe("Submit Template button submit states", () => {
  afterEach(() => {
    cleanup();
  });

  it("shows a pending state and disables the button while a submit is in flight", () => {
    renderHeader(mockTemplate, { submitStatus: "saving" });

    expect(screen.getByRole("button", { name: /Submitting…/ })).toBeDisabled();
  });

  it("shows a submitted state once the parent relays SAVE_SUCCESS", () => {
    renderHeader(mockTemplate, { submitStatus: "success" });

    expect(screen.getByRole("button", { name: "Submitted ✓" })).toBeEnabled();
  });

  it("invokes onSubmit when the valid submit button is clicked", () => {
    let submitted = false;
    renderHeader(mockTemplate, {
      onSubmit: () => {
        submitted = true;
      },
    });

    submitButton().click();

    expect(submitted).toBe(true);
  });

  it("keeps the button disabled for invalid metadata even when not saving", () => {
    renderHeader(
      { ...mockTemplate, name: "" },
      { submitStatus: "idle" }
    );

    expect(submitButton()).toBeDisabled();
  });
});