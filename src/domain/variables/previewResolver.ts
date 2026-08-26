import type { TextVariable } from "./variables.types";
import type { PreviewData } from "./preview.types";

export function resolveTextVariable(
  variable: TextVariable,
  previewData: PreviewData
): string {
  return previewData[variable];
}