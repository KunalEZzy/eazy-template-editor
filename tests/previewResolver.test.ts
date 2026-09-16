import { describe, it, expect } from "vitest";
import {
  resolveTextVariable,
  resolveQRVariable,
} from "./previewResolver";
import type { PreviewData } from "./preview.types";

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

describe("previewResolver master template mode", () => {
  it("returns the variable identity when no preview data exists", () => {
    expect(resolveTextVariable("resNameNL", null)).toBe("resNameNL");
    expect(resolveTextVariable("discount", null)).toBe("discount");
    expect(resolveTextVariable("resLoc", undefined)).toBe("resLoc");
    expect(resolveQRVariable("resQR", null)).toBe("resQR");
  });

  it("returns static custom text even without preview data", () => {
    expect(resolveTextVariable("resNameNL", null, "My Poster Title")).toBe(
      "My Poster Title"
    );
  });

  it("resolves preview values when preview data exists", () => {
    expect(resolveTextVariable("resNameNL", previewData)).toBe(
      "11 East Indian Street Restaurant and Bar"
    );
    expect(resolveQRVariable("resQR", previewData)).toBe(
      "https://example.com/restaurant"
    );
  });
});