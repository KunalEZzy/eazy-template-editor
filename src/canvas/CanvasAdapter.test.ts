import { describe, it, expect } from "vitest";
import { percentageToPixels, pixelsToPercentage } from "./CanvasAdapter";

describe("CanvasAdapter coordinate conversion", () => {
  const documentWidth = 1200;
  const documentHeight = 1600;

  it("converts percentage to document pixels correctly", () => {
    expect(percentageToPixels(50, documentWidth)).toBe(600);
    expect(percentageToPixels(25, documentHeight)).toBe(400);
    expect(percentageToPixels(0, documentWidth)).toBe(0);
    expect(percentageToPixels(100, documentHeight)).toBe(1600);
  });

  it("converts document pixels to percentage correctly", () => {
    expect(pixelsToPercentage(600, documentWidth)).toBe(50);
    expect(pixelsToPercentage(400, documentHeight)).toBe(25);
    expect(pixelsToPercentage(0, documentWidth)).toBe(0);
    expect(pixelsToPercentage(1600, documentHeight)).toBe(100);
  });

  it("is reversible between percentage and pixels", () => {
    const originalPercentage = 37.5;
    const pixels = percentageToPixels(originalPercentage, documentWidth);
    const convertedBack = pixelsToPercentage(pixels, documentWidth);
    expect(convertedBack).toBeCloseTo(originalPercentage, 5);
  });
});

