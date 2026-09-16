import { describe, it, expect } from "vitest";
import { isEditorInitMessage, EDITOR_PROTOCOL_VERSION } from "./editorProtocol";
import { mockTemplate } from "../domain/template/template.mock";

function validInit(overrides?: Partial<Record<string, unknown>>) {
  return {
    type: "EDITOR_INIT",
    version: EDITOR_PROTOCOL_VERSION,
    payload: {
      mode: "master",
      template: null,
      capabilities: { canSave: true },
    },
    ...overrides,
  };
}

describe("isEditorInitMessage", () => {
  it("accepts a master CREATE message with template: null", () => {
    expect(isEditorInitMessage(validInit())).toBe(true);
  });

  it("accepts a master EDIT message carrying a valid template", () => {
    const msg = validInit({
      payload: {
        mode: "master",
        template: mockTemplate,
        capabilities: { canSave: true },
      },
    });
    expect(isEditorInitMessage(msg)).toBe(true);
  });

  it("rejects null and non-objects", () => {
    expect(isEditorInitMessage(null)).toBe(false);
    expect(isEditorInitMessage(42)).toBe(false);
    expect(isEditorInitMessage("EDITOR_INIT")).toBe(false);
  });

  it("rejects missing version", () => {
    const msg = validInit({ version: 99 });
    expect(isEditorInitMessage(msg)).toBe(false);
  });

  it("rejects missing type", () => {
    const msg = validInit({ type: "OTHER" });
    expect(isEditorInitMessage(msg)).toBe(false);
  });

  it("rejects mode !== master", () => {
    const msg = validInit({
      payload: { mode: "restaurant", template: null, capabilities: { canSave: true } },
    });
    expect(isEditorInitMessage(msg)).toBe(false);
  });

  it("rejects capabilities missing canSave", () => {
    const msg = validInit({
      payload: { mode: "master", template: null, capabilities: {} },
    });
    expect(isEditorInitMessage(msg)).toBe(false);
  });

  it("rejects capabilities not an object", () => {
    const msg = validInit({
      payload: { mode: "master", template: null, capabilities: "yes" },
    });
    expect(isEditorInitMessage(msg)).toBe(false);
  });

  it("rejects a malformed template when one is provided (missing boxes)", () => {
    const bad = { ...mockTemplate, boxes: undefined };
    const msg = validInit({
      payload: { mode: "master", template: bad, capabilities: { canSave: true } },
    });
    expect(isEditorInitMessage(msg)).toBe(false);
  });

  it("rejects a malformed template when one is provided (missing settings)", () => {
    const bad = { ...mockTemplate, settings: undefined };
    const msg = validInit({
      payload: { mode: "master", template: bad, capabilities: { canSave: true } },
    });
    expect(isEditorInitMessage(msg)).toBe(false);
  });

  it("rejects a malformed template when one is provided (invalid campaign)", () => {
    const bad = { ...mockTemplate, campaign: "invalid-campaign" };
    const msg = validInit({
      payload: { mode: "master", template: bad, capabilities: { canSave: true } },
    });
    expect(isEditorInitMessage(msg)).toBe(false);
  });
});
