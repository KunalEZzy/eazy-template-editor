import type {
  TextVariable,
  QRVariable,
} from "./variables.types";

import type { PreviewData } from "./preview.types";

export function resolveTextVariable(
  variable: TextVariable,
  previewData: PreviewData | null | undefined,
  customText?: string
): string {
  if (customText !== undefined && customText !== null) {
    return customText;
  }
  if (!previewData) {
    return variable;
  }
  return previewData[variable] ?? "";
}

export function resolveQRVariable(
  variable: QRVariable,
  previewData: PreviewData | null | undefined
): string {
  if (!previewData) {
    return variable;
  }
  return previewData[variable] ?? "";
}