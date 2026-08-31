import { useState } from "react";

import {
  VARIABLE_DEFINITIONS,
} from "../../domain/variables/variable.definitions";

import {
  useEditorStore,
} from "../../store/editorStore";

export function VariablePicker() {
  const [selectedVariable, setSelectedVariable] =
    useState("");

  const addVariable = useEditorStore(
    (state) => state.addVariable
  );

  const handleAddVariable = () => {
    if (!selectedVariable) {
      return;
    }

    addVariable(
      selectedVariable as Parameters<
        typeof addVariable
      >[0]
    );

    setSelectedVariable("");
  };

  return (
    <div
      style={{
        padding: "12px",
        border: "1px solid var(--border)",
        borderRadius: "8px",
        background: "var(--panel-bg)",
      }}
    >
      <h3
        style={{
          margin: "0 0 10px",
          fontSize: "11px",
          fontWeight: 700,
          color: "var(--text-h)",
          textTransform: "uppercase",
          letterSpacing: "0.5px",
        }}
      >
        Add Variable
      </h3>

      <select
        value={selectedVariable}
        onChange={(event) =>
          setSelectedVariable(
            event.target.value
          )
        }
        style={{
          width: "100%",
          padding: "8px",
          boxSizing: "border-box",
          marginBottom: "8px",
        }}
      >
        <option value="">
          Select Variable
        </option>

        {VARIABLE_DEFINITIONS.map(
          (definition) => (
            <option
              key={definition.key}
              value={definition.key}
            >
              {definition.label} (
              {definition.type.toUpperCase()})
            </option>
          )
        )}
      </select>

      <button
        type="button"
        onClick={handleAddVariable}
        disabled={!selectedVariable}
        style={{
          width: "100%",
          padding: "8px",
          cursor: selectedVariable
            ? "pointer"
            : "not-allowed",
        }}
      >
        + Add Variable
      </button>
    </div>
  );
}