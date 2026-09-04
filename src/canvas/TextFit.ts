import { Textbox } from "fabric";
import type { TextBox } from "../domain/box/box.types";

interface TextFitOptions {
  text: string;

  width: number;
  height: number;

  fontFamily: string;
  fontWeight: number;

  fontSize: number;
  lineHeight: number;

  letterSpacing: number;

  minFontSize?: number;
}

export interface TextFitResult {
  fontSize: number;

  fits: boolean;

  overflow: boolean;
}

export function calculateTextFit(
  options: TextFitOptions
): TextFitResult {
  const {
    text,
    width,
    height,
    fontFamily,
    fontWeight,
    fontSize,
    lineHeight,
    letterSpacing,
    minFontSize = 12,
  } = options;

  if (width <= 0 || height <= 0) {
    return {
      fontSize,
      fits: false,
      overflow: true,
    };
  }

  if (!text.trim()) {
    return {
      fontSize,
      fits: true,
      overflow: false,
    };
  }

  let currentFontSize = fontSize;

  while (currentFontSize >= minFontSize) {
    const textbox = new Textbox(text, {
      width,

      fontFamily,

      fontWeight,

      fontSize: currentFontSize,

      lineHeight,

      charSpacing: letterSpacing,
    });

    if (textbox.height <= height) {
      return {
        fontSize: currentFontSize,

        fits: true,

        overflow: false,
      };
    }

    currentFontSize -= 1;
  }

  return {
    fontSize: minFontSize,

    fits: false,

    overflow: true,
  };
}

export function applyTextTransform(
  text: string,
  transform: TextBox["textTransform"]
): string {
  switch (transform) {
    case "uppercase":
      return text.toUpperCase();

    case "lowercase":
      return text.toLowerCase();

    case "capitalize":
      return text.replace(
        /\b\w/g,
        (character) => character.toUpperCase()
      );

    case "none":
    default:
      return text;
  }
}