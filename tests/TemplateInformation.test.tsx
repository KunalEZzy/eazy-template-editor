import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { useEditorStore } from "../src/store/editorStore";
import { mockTemplate } from "../src/domain/template/template.mock";
import { LeftSidebar } from "../src/components/layout/LeftSidebar";
import { TemplateInformation } from "../src/components/layout/TemplateInformation";
import type { DesignTokens } from "../src/components/layout/EditorHeader";

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

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

// Mirrors the real EditorLayout wiring: TemplateInformation receives the
// current store template as a prop, so name/campaign edits re-render.
function Harness() {
  const template = useEditorStore((state) => state.template)!;
  return <TemplateInformation template={template} tokens={tokens()} />;
}

describe("TemplateInformation (replaces Quick Tools)", () => {
  beforeEach(() => {
    useEditorStore.getState().resetEditor();
    useEditorStore.getState().setTemplate(clone(mockTemplate));
  });

  afterEach(() => {
    cleanup();
  });

  it("left sidebar renders Template Information instead of Quick Tools", () => {
    render(
      <LeftSidebar
        template={clone(mockTemplate)}
        selectedBoxId={null}
        tokens={tokens()}
        onSelectBox={() => {}}
        onDeleteBox={() => {}}
      />
    );

    expect(screen.queryByText("Quick Tools")).not.toBeInTheDocument();
    expect(screen.getByText("Template Information")).toBeInTheDocument();
  });

  it("populates fields from existing template metadata", () => {
    render(<Harness />);

    expect(screen.getByDisplayValue(mockTemplate.name)).toBeInTheDocument();

    const [campaignSelect, statusSelect] = screen.getAllByRole("combobox");
    expect(campaignSelect).toHaveValue(mockTemplate.campaign);
    expect(statusSelect).toHaveValue("active");
  });

  it("campaign options use only the supported campaign values", () => {
    render(<Harness />);

    const select = screen.getAllByRole("combobox")[0];
    const options = Array.from(
      select.querySelectorAll("option")
    ).map((option) => option.textContent);

    expect(options).toEqual([
      "PayEazy TentCard",
      "PayEazy Standee",
      "Eatout",
      "Foodie Awards",
    ]);
    expect(select.querySelectorAll("option").length).toBe(4);
  });

  it("edits the template name without losing other template metadata", () => {
    const before = useEditorStore.getState().template!;
    const beforeBoxes = clone(before.boxes);

    render(<Harness />);

    fireEvent.change(screen.getByDisplayValue(mockTemplate.name), {
      target: { value: "Renamed Campaign" },
    });

    const state = useEditorStore.getState();
    expect(state.template!.name).toBe("Renamed Campaign");
    expect(state.template!.id).toBe(before.id);
    expect(state.template!.code).toBe(before.code);
    expect(state.template!.campaign).toBe(before.campaign);
    expect(state.template!.boxes).toEqual(beforeBoxes);
    expect(state.isDirty).toBe(true);
  });

  it("changes the campaign to a supported value", () => {
    render(<Harness />);

    fireEvent.change(screen.getAllByRole("combobox")[0], {
      target: { value: "foodie-awards" },
    });

    expect(useEditorStore.getState().template!.campaign).toBe(
      "foodie-awards"
    );
    expect(useEditorStore.getState().isDirty).toBe(true);
  });

  it("changes the status through the dropdown", () => {
    render(<Harness />);

    const statusSelect = screen.getAllByRole("combobox")[1];
    fireEvent.change(statusSelect, {
      target: { value: "inactive" },
    });

    const state = useEditorStore.getState();
    expect(state.template!.active).toBe(false);
    expect(state.isDirty).toBe(true);
  });

  it("keeps creator as editor-only state separate from the template", () => {
    render(<Harness />);

    fireEvent.change(screen.getByDisplayValue(""), {
      target: { value: "Designer One" },
    });

    const state = useEditorStore.getState();
    expect(state.creator).toBe("Designer One");
    expect(state.template!.name).toBe(mockTemplate.name);
    expect(state.isDirty).toBe(false);
  });

  it("shows a name validation error only after the field is touched", () => {
    render(<Harness />);

    expect(
      screen.queryByText("Template name is required.")
    ).not.toBeInTheDocument();

    fireEvent.change(screen.getByDisplayValue(mockTemplate.name), {
      target: { value: "   " },
    });

    expect(
      screen.getByText("Template name is required.")
    ).toBeInTheDocument();
  });
});