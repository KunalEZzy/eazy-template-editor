import { describe, it, expect } from "vitest";
import {
  resolveTextVariable,
  resolveQRVariable,
} from "../src/domain/variables/previewResolver";
import { mockPreviewData } from "../src/domain/variables/preview.mock";
import type { PreviewData } from "../src/domain/variables/preview.types";
import { VARIABLE_DEFINITIONS } from "../src/domain/variables/variable.definitions";

const previewData: PreviewData = {
  resNameNL: "11 East Indian Street Restaurant and Bar",
  resNameL: "11 East Indian Street Restaurant and Bar",
  discount: "20% OFF",
  resLoc: "Gurgaon",
  foodCat: "Italian",
  resQR: "https://example.com/restaurant",
  resQRPayEazy: "https://example.com/payeazy",
  foodQR: "https://example.com/food",
};

const textVariables = VARIABLE_DEFINITIONS.filter(
  (definition) => definition.type === "text"
).map((definition) => definition.key);

const qrVariables = VARIABLE_DEFINITIONS.filter(
  (definition) => definition.type === "qr"
).map((definition) => definition.key);

describe("previewResolver — Master mode (previewData absent)", () => {
  it("A: resolves each text variable to its canonical variable key when previewData is null", () => {
    for (const variable of textVariables) {
      expect(resolveTextVariable(variable, null)).toBe(variable);
    }
  });

  it("A: resolves each text variable to its canonical variable key when previewData is undefined", () => {
    for (const variable of textVariables) {
      expect(resolveTextVariable(variable, undefined)).toBe(variable);
    }
  });

  it("A: resolves each QR variable to its canonical variable key when previewData is null", () => {
    for (const variable of qrVariables) {
      expect(resolveQRVariable(variable, null)).toBe(variable);
    }
  });

  it("B: never leaks a mock preview value for any text variable", () => {
    for (const variable of textVariables) {
      const resolved = resolveTextVariable(variable, null);
      expect(resolved).toBe(variable);
      expect(mockPreviewData[variable]).not.toBe(variable);
      expect(resolved).not.toBe(mockPreviewData[variable]);
    }
  });

  it("B: never leaks a mock preview value for any QR variable", () => {
    for (const variable of qrVariables) {
      const resolved = resolveQRVariable(variable, null);
      expect(resolved).toBe(variable);
      expect(mockPreviewData[variable]).not.toBe(variable);
      expect(resolved).not.toBe(mockPreviewData[variable]);
    }
  });

  it("C: static text is unchanged even without previewData", () => {
    expect(resolveTextVariable("resNameNL", null, "My Poster Title")).toBe(
      "My Poster Title"
    );
    expect(resolveTextVariable("discount", null, "Flat 10%")).toBe("Flat 10%");
  });

  it("C: static text is unchanged even when previewData IS present", () => {
    expect(resolveTextVariable("resNameNL", previewData, "My Poster Title")).toBe(
      "My Poster Title"
    );
    expect(resolveTextVariable("resLoc", previewData, "Fixed Location")).toBe(
      "Fixed Location"
    );
  });

  it("D: QR variables ignore mock preview data when previewData is null", () => {
    for (const variable of qrVariables) {
      const resolved = resolveQRVariable(variable, null);
      expect(resolved).not.toBe(mockPreviewData[variable]);
      expect(resolved).toBe(variable);
    }
  });
});

describe("previewResolver — real preview data (previewData present)", () => {
  it("E: resolves text variables to preview values", () => {
    expect(resolveTextVariable("resNameNL", previewData)).toBe(
      "11 East Indian Street Restaurant and Bar"
    );
    expect(resolveTextVariable("discount", previewData)).toBe("20% OFF");
  });

  it("E: resolves QR variables to preview values", () => {
    expect(resolveQRVariable("resQR", previewData)).toBe(
      "https://example.com/restaurant"
    );
  });
});

describe("previewResolver — standalone mock preview (unchanged)", () => {
  it("F: text variables resolve to mock preview values when mockPreviewData is fed", () => {
    for (const variable of textVariables) {
      expect(resolveTextVariable(variable, mockPreviewData)).toBe(
        mockPreviewData[variable]
      );
    }
  });

  it("F: QR variables resolve to mock preview values when mockPreviewData is fed", () => {
    for (const variable of qrVariables) {
      expect(resolveQRVariable(variable, mockPreviewData)).toBe(
        mockPreviewData[variable]
      );
    }
  });
});