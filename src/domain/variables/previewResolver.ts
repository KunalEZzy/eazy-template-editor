import type {
  TextVariable,
  QRVariable,
} from "./variables.types";

import type { PreviewData } from "./preview.types";

export function resolveTextVariable(
  variable: TextVariable,
  previewData: PreviewData
): string {
  return previewData[variable];
}

export function resolveQRVariable(
  variable: QRVariable,
  previewData: PreviewData
): string {
  return previewData[variable];
}