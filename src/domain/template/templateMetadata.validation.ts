import { SUPPORTED_CAMPAIGNS } from "./template.types";

export interface TemplateMetadataFields {
  name: string;
  campaign: string;
}

export interface TemplateMetadataValidationResult {
  valid: boolean;
  errors: Partial<Record<keyof TemplateMetadataFields, string>>;
}

/**
 * Pure, side-effect-free validation of the metadata required for template
 * submission. Creator is intentionally NOT part of this validation: it is
 * editor-only state (see Step 5.5) and not a persisted field yet, so it must
 * never gate submission.
 *
 * Status is intentionally NOT part of this validation either: it is preserved
 * as-is for both new and existing templates and must never be changed merely
 * by validating.
 */
export function validateTemplateMetadata(
  input: TemplateMetadataFields
): TemplateMetadataValidationResult {
  const errors: TemplateMetadataValidationResult["errors"] = {};

  if (typeof input.name !== "string" || input.name.trim().length === 0) {
    errors.name = "Template name is required.";
  }

  if (
    typeof input.campaign !== "string" ||
    !(SUPPORTED_CAMPAIGNS as readonly string[]).includes(input.campaign)
  ) {
    errors.campaign = "Campaign is required.";
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}