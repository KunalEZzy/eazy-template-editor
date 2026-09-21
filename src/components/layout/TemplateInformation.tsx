import { useState } from "react";
import type { Template, CampaignType } from "../../domain/template/template.types";
import { CAMPAIGN_OPTIONS } from "../../domain/template/template.types";
import { validateTemplateMetadata } from "../../domain/template/templateMetadata.validation";
import { useEditorStore } from "../../store/editorStore";
import type { DesignTokens } from "./EditorHeader";

interface TemplateInformationProps {
  template: Template;
  tokens: DesignTokens;
}

const ERROR_STYLE: React.CSSProperties = {
  display: "block",
  fontSize: "10px",
  color: "#dc2626",
  marginTop: "4px",
  textAlign: "left",
};

export function TemplateInformation({
  template,
  tokens,
}: TemplateInformationProps) {
  const creator = useEditorStore((state) => state.creator);
  const updateTemplateInfo = useEditorStore(
    (state) => state.updateTemplateInfo
  );
  const setCreator = useEditorStore((state) => state.setCreator);

  const [touched, setTouched] = useState<{
    name: boolean;
    campaign: boolean;
  }>({ name: false, campaign: false });

  const validation = validateTemplateMetadata({
    name: template.name,
    campaign: template.campaign,
  });

  return (
    <div style={{ padding: "16px" }}>
      <h2
        style={{
          fontSize: "11px",
          fontWeight: 700,
          textTransform: "uppercase",
          color: tokens.text,
          marginBottom: "12px",
          letterSpacing: "0.5px",
        }}
      >
        Template Information
      </h2>

      <div
        style={{
          background: tokens.cardBg,
          borderRadius: "8px",
          padding: "12px",
          border: `1px solid ${tokens.border}`,
          display: "flex",
          flexDirection: "column",
          gap: "10px",
        }}
      >
        {/* Template Name */}
        <div>
          <span
            style={{
              display: "block",
              fontSize: "9px",
              fontWeight: 700,
              color: tokens.text,
              marginBottom: "4px",
              textAlign: "left",
            }}
          >
            TEMPLATE NAME
          </span>

          <input
            type="text"
            className="prop-input"
            value={template.name}
            onChange={(event) => {
              updateTemplateInfo({ name: event.target.value });
              setTouched((prev) => ({ ...prev, name: true }));
            }}
            style={{ textAlign: "left" }}
          />
          {touched.name && validation.errors.name && (
            <span style={ERROR_STYLE}>{validation.errors.name}</span>
          )}
        </div>

        {/* Created By */}
        <div>
          <span
            style={{
              display: "block",
              fontSize: "9px",
              fontWeight: 700,
              color: tokens.text,
              marginBottom: "4px",
              textAlign: "left",
            }}
          >
            CREATED BY
          </span>

          <input
            type="text"
            className="prop-input"
            value={creator}
            onChange={(event) => setCreator(event.target.value)}
            style={{ textAlign: "left" }}
          />
        </div>

        {/* Campaign */}
        <div>
          <span
            style={{
              display: "block",
              fontSize: "9px",
              fontWeight: 700,
              color: tokens.text,
              marginBottom: "4px",
              textAlign: "left",
            }}
          >
            CAMPAIGN
          </span>

          <select
            className="prop-select"
            value={template.campaign}
            onChange={(event) => {
              updateTemplateInfo({
                campaign: event.target.value as CampaignType,
              });
              setTouched((prev) => ({ ...prev, campaign: true }));
            }}
            style={{
              width: "100%",
              padding: "6px 8px",
              border: "1px solid var(--border)",
              borderRadius: "6px",
              background: "var(--input-bg)",
              color: "var(--input-text)",
              fontSize: "12px",
              fontWeight: 500,
              boxSizing: "border-box",
              outline: "none",
              textAlign: "left",
              textAlignLast: "left",
            }}
          >
            {CAMPAIGN_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          {touched.campaign && validation.errors.campaign && (
            <span style={ERROR_STYLE}>{validation.errors.campaign}</span>
          )}
        </div>

        {/* Status */}
        <div>
          <span
            style={{
              display: "block",
              fontSize: "9px",
              fontWeight: 700,
              color: tokens.text,
              marginBottom: "4px",
              textAlign: "left",
            }}
          >
            STATUS
          </span>

          <select
            className="prop-select"
            value={template.active ? "active" : "inactive"}
            onChange={(event) =>
              updateTemplateInfo({
                active: event.target.value === "active",
              })
            }
            style={{
              width: "100%",
              padding: "6px 8px",
              border: "1px solid var(--border)",
              borderRadius: "6px",
              background: "var(--input-bg)",
              color: "var(--input-text)",
              fontSize: "12px",
              fontWeight: 500,
              boxSizing: "border-box",
              outline: "none",
              textAlign: "left",
              textAlignLast: "left",
            }}
          >
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>

        {!validation.valid && (
          <span
            style={{
              display: "block",
              fontSize: "10px",
              color: tokens.text,
              marginTop: "2px",
              textAlign: "left",
            }}
          >
            Complete the required metadata to enable Submit Template.
          </span>
        )}
      </div>
    </div>
  );
}