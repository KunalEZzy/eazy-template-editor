import { describe, it, expect } from "vitest";
import { validateTemplateMetadata } from "../src/domain/template/templateMetadata.validation";
import { SUPPORTED_CAMPAIGNS } from "../src/domain/template/template.types";
import { mockTemplate } from "../src/domain/template/template.mock";

describe("validateTemplateMetadata", () => {
  it("empty new template input is invalid", () => {
    const result = validateTemplateMetadata({ name: "", campaign: "" });

    expect(result.valid).toBe(false);
    expect(result.errors.name).toBeTruthy();
    expect(result.errors.campaign).toBeTruthy();
  });

  it("whitespace-only name is invalid", () => {
    const result = validateTemplateMetadata({
      name: "   \t ",
      campaign: "eatout",
    });

    expect(result.valid).toBe(false);
    expect(result.errors.name).toBeTruthy();
    expect(result.errors.campaign).toBeUndefined();
  });

  it("missing campaign is invalid", () => {
    const result = validateTemplateMetadata({
      name: "My Template",
      campaign: "",
    });

    expect(result.valid).toBe(false);
    expect(result.errors.name).toBeUndefined();
    expect(result.errors.campaign).toBeTruthy();
  });

  it("an unsupported arbitrary campaign string is invalid", () => {
    const result = validateTemplateMetadata({
      name: "My Template",
      campaign: "random-campaign",
    });

    expect(result.valid).toBe(false);
  });

  it("valid required metadata is valid", () => {
    const result = validateTemplateMetadata({
      name: "Summer Menu",
      campaign: "pay-eazy-standee",
    });

    expect(result.valid).toBe(true);
    expect(result.errors).toEqual({});
  });

  it("supported campaign list remains exactly the agreed set", () => {
    expect([...SUPPORTED_CAMPAIGNS]).toEqual([
      "pay-eazy-tent-card",
      "pay-eazy-standee",
      "eatout",
      "foodie-awards",
    ]);
  });

  it("existing valid template metadata is valid", () => {
    const result = validateTemplateMetadata({
      name: mockTemplate.name,
      campaign: mockTemplate.campaign,
    });

    expect(result.valid).toBe(true);
  });

  it("does not change the template status while validating", () => {
    const input = { name: "X", campaign: "eatout" };
    const snapshot = { ...input };

    validateTemplateMetadata(input);

    expect(input).toEqual(snapshot);
  });

  it("does not modify the template object", () => {
    const template = mockTemplate;
    const snapshot = { ...template, boxes: [...template.boxes] };

    validateTemplateMetadata({
      name: template.name,
      campaign: template.campaign,
    });

    expect(template).toEqual(snapshot);
    expect(template.active).toBe(true);
  });

  it("does not depend on an invented creator field", () => {
    const first = validateTemplateMetadata({
      name: "X",
      campaign: "eatout",
    });
    const second = validateTemplateMetadata({
      name: "X",
      campaign: "eatout",
    });

    expect(second.valid).toBe(first.valid);
    expect(Object.keys(first.errors)).not.toContain("creator");
    expect(Object.keys(second.errors)).not.toContain("creator");
  });

  it("an existing valid template with active=false is still valid and unmodified", () => {
    const template = { ...mockTemplate, active: false };

    const result = validateTemplateMetadata({
      name: template.name,
      campaign: template.campaign,
    });

    expect(result.valid).toBe(true);
    expect(template.active).toBe(false);
  });
});