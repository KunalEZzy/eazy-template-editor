import { describe, it, expect } from "vitest";
import { isTemplate } from "./template.validation";
import { mockTemplate } from "./template.mock";

function clone(): Record<string, unknown> {
  return JSON.parse(JSON.stringify(mockTemplate)) as Record<string, unknown>;
}

function boxesOf(
  template: Record<string, unknown>
): Record<string, unknown>[] {
  return template.boxes as Record<string, unknown>[];
}

describe("isTemplate", () => {
  it("accepts the existing mockTemplate", () => {
    expect(isTemplate(mockTemplate)).toBe(true);
  });

  it("accepts a valid template", () => {
    expect(isTemplate(clone())).toBe(true);
  });

  it("rejects null", () => {
    expect(isTemplate(null)).toBe(false);
  });

  it("rejects primitives and arrays", () => {
    expect(isTemplate(42)).toBe(false);
    expect(isTemplate("template")).toBe(false);
    expect(isTemplate(true)).toBe(false);
    expect(isTemplate([])).toBe(false);
  });

  it("rejects a template with missing boxes", () => {
    const template = clone();
    delete template.boxes;
    expect(isTemplate(template)).toBe(false);
  });

  it("rejects boxes = null", () => {
    const template = clone();
    template.boxes = null;
    expect(isTemplate(template)).toBe(false);
  });

  it("rejects an invalid box type", () => {
    const template = clone();
    boxesOf(template)[0].type = "video";
    expect(isTemplate(template)).toBe(false);
  });

  it("rejects a box with missing dimensions", () => {
    const template = clone();
    delete boxesOf(template)[0].width;
    expect(isTemplate(template)).toBe(false);
  });

  it("rejects NaN and Infinity values", () => {
    const nan = clone();
    boxesOf(nan)[0].width = NaN;
    expect(isTemplate(nan)).toBe(false);

    const infinity = clone();
    (infinity.settings as Record<string, unknown>).canvasHeight = Infinity;
    expect(isTemplate(infinity)).toBe(false);
  });

  it("rejects non-positive dimensions", () => {
    const template = clone();
    boxesOf(template)[0].width = 0;
    expect(isTemplate(template)).toBe(false);
  });

  it("rejects duplicate box ids", () => {
    const template = clone();
    const boxes = boxesOf(template);
    boxes[1] = { ...boxes[0] };
    expect(isTemplate(template)).toBe(false);
  });

  it("rejects malformed background", () => {
    const nullBackground = clone();
    nullBackground.background = null;
    expect(isTemplate(nullBackground)).toBe(false);

    const badImageUrl = clone();
    (badImageUrl.background as Record<string, unknown>).imageUrl = 123;
    expect(isTemplate(badImageUrl)).toBe(false);
  });

  it("rejects malformed settings", () => {
    const missingSettings = clone();
    missingSettings.settings = {};
    expect(isTemplate(missingSettings)).toBe(false);

    const zeroWidth = clone();
    (zeroWidth.settings as Record<string, unknown>).canvasWidth = 0;
    expect(isTemplate(zeroWidth)).toBe(false);
  });
});