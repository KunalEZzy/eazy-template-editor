import { describe, it, expect, beforeEach } from "vitest";
import { useEditorStore } from "../src/store/editorStore";
import {
  buildSaveRequestMessage,
  requestTemplateSubmit,
  applySaveSuccessMessage,
  applySaveErrorMessage,
  applySaveResponseEvent,
  canSubmitTemplate,
  type TemplateSubmitBoundary,
} from "../src/integration/masterSubmit";
import { EDITOR_PROTOCOL_VERSION } from "../src/integration/editorProtocol";
import { mockTemplate } from "../src/domain/template/template.mock";
import { createEmptyTemplate } from "../src/domain/template/template.empty";

const PARENT_ORIGIN = "https://admin.eazyweb.dev";

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

function recordingBoundary(overrides: Partial<TemplateSubmitBoundary> = {}) {
  const posted: unknown[] = [];
  const boundary: TemplateSubmitBoundary = {
    parentOrigin: PARENT_ORIGIN,
    // A distinct object from `window.parent` so source-mismatch is detectable.
    parentWindow: {},
    isEmbedded: true,
    postMessage: (message) => {
      posted.push(message);
    },
    ...overrides,
  };
  return { boundary, posted };
}

function saveSuccess(template = mockTemplate, id = "42") {
  return {
    type: "SAVE_SUCCESS" as const,
    version: EDITOR_PROTOCOL_VERSION,
    payload: { template, id },
  };
}

function saveError(message = "Database unavailable.") {
  return {
    type: "SAVE_ERROR" as const,
    version: EDITOR_PROTOCOL_VERSION,
    payload: { message },
  };
}

describe("canSubmitTemplate gate", () => {
  beforeEach(() => {
    useEditorStore.getState().resetEditor();
  });

  it("returns false for a null template", () => {
    expect(canSubmitTemplate(null)).toBe(false);
  });

  it("returns false when required metadata is missing", () => {
    expect(canSubmitTemplate({ ...mockTemplate, name: "", campaign: "" })).toBe(
      false
    );
  });

  it("returns true for a template with valid required metadata", () => {
    expect(canSubmitTemplate(mockTemplate)).toBe(true);
  });
});

describe("buildSaveRequestMessage", () => {
  it("emits a valid-versioned SAVE_REQUEST for CREATE with the placeholder id", () => {
    const message = buildSaveRequestMessage(createEmptyTemplate());

    expect(message.type).toBe("SAVE_REQUEST");
    expect(message.version).toBe(EDITOR_PROTOCOL_VERSION);
    expect(message.payload.template.id).toBe("new-template");
  });

  it("carries the existing id for EDIT so Laravel updates the same row", () => {
    const message = buildSaveRequestMessage(mockTemplate);

    expect(message.payload.template.id).toBe("template-001");
  });

  it("carries the canonical template unchanged", () => {
    const message = buildSaveRequestMessage(mockTemplate);

    expect(message.payload.template).toEqual(mockTemplate);
  });
});

describe("requestTemplateSubmit", () => {
  beforeEach(() => {
    useEditorStore.getState().resetEditor();
  });

  it("refuses to submit when metadata is invalid and posts nothing", () => {
    const { boundary, posted } = recordingBoundary();

    const result = requestTemplateSubmit(
      { ...mockTemplate, name: "" },
      boundary
    );

    expect(result).toBe(false);
    expect(posted).toEqual([]);
    expect(useEditorStore.getState().submitStatus).toBe("error");
  });

  it("posts a SAVE_REQUEST for a valid CREATE and enters the saving state", () => {
    const template = createEmptyTemplate();
    const { boundary, posted } = recordingBoundary();

    const result = requestTemplateSubmit(template, boundary);

    expect(result).toBe(true);
    expect(posted).toHaveLength(1);
    expect(posted[0]).toEqual(buildSaveRequestMessage(template));
    expect(useEditorStore.getState().submitStatus).toBe("saving");
  });

  it("posts a SAVE_REQUEST for a valid EDIT carrying the existing id", () => {
    const { boundary, posted } = recordingBoundary();

    requestTemplateSubmit(mockTemplate, boundary);

    const message = posted[0] as { payload: { template: { id: string } } };
    expect(message.payload.template.id).toBe("template-001");
  });

  it("does not post when not embedded inside the parent portal", () => {
    const { boundary, posted } = recordingBoundary({ isEmbedded: false });

    const result = requestTemplateSubmit(mockTemplate, boundary);

    expect(result).toBe(false);
    expect(posted).toEqual([]);
    expect(useEditorStore.getState().submitStatus).toBe("error");
  });
});

describe("SAVE_SUCCESS handling", () => {
  beforeEach(() => {
    useEditorStore.getState().resetEditor();
  });

  it("clears the saving state and marks the submit as successful", () => {
    const { boundary } = recordingBoundary();
    requestTemplateSubmit(mockTemplate, boundary);
    expect(useEditorStore.getState().submitStatus).toBe("saving");

    applySaveSuccessMessage(saveSuccess());

    expect(useEditorStore.getState().submitStatus).toBe("success");
  });

  it("hydrates a freshly-persisted id back into the editor for CREATE", () => {
    const { boundary } = recordingBoundary();
    requestTemplateSubmit(createEmptyTemplate(), boundary);

    const persisted = { ...mockTemplate, id: "42", name: "My Poster" };
    applySaveSuccessMessage(saveSuccess(persisted, "42"));

    const state = useEditorStore.getState();
    expect(state.template?.id).toBe("42");
    expect(state.template?.name).toBe("My Poster");
    expect(state.isDirty).toBe(false);
  });

  it("preserves the existing id and hydrates the persisted name for EDIT", () => {
    useEditorStore.getState().setTemplate(mockTemplate);
    useEditorStore.getState().updateTemplateInfo({ name: "Unsaved rename" });
    expect(useEditorStore.getState().template?.id).toBe("template-001");

    const persisted = { ...mockTemplate, name: "Saved name" };
    applySaveSuccessMessage(saveSuccess(persisted, "template-001"));

    const state = useEditorStore.getState();
    expect(state.template?.id).toBe("template-001");
    expect(state.template?.name).toBe("Saved name");
  });

  it("keeps the creator visible in the info box after a successful save", () => {
    useEditorStore.getState().setTemplate(mockTemplate);
    useEditorStore.getState().setCreator("Designer One");

    const persisted = { ...mockTemplate, version: mockTemplate.version + 1 };
    applySaveSuccessMessage(saveSuccess(persisted, "template-001"));

    expect(useEditorStore.getState().creator).toBe("Designer One");
  });
});

describe("SAVE_ERROR handling", () => {
  beforeEach(() => {
    useEditorStore.getState().resetEditor();
  });

  it("clears the saving state and surfaces the failure", () => {
    const { boundary } = recordingBoundary();
    requestTemplateSubmit(mockTemplate, boundary);
    expect(useEditorStore.getState().submitStatus).toBe("saving");

    applySaveErrorMessage(saveError("Duplicate name."));

    expect(useEditorStore.getState().submitStatus).toBe("error");
    expect(useEditorStore.getState().submitMessage).toBe("Duplicate name.");
  });

  it("preserves the working template so every unsaved edit is kept", () => {
    useEditorStore.getState().setTemplate(mockTemplate);
    useEditorStore.getState().updateTemplateInfo({ name: "Unsaved edits" });

    applySaveErrorMessage(saveError());

    const state = useEditorStore.getState();
    expect(state.submitStatus).toBe("error");
    expect(state.template?.name).toBe("Unsaved edits");
    expect(state.isDirty).toBe(true);
  });
});

describe("applySaveResponseEvent guards", () => {
  beforeEach(() => {
    useEditorStore.getState().resetEditor();
  });

  it("ignores messages from an untrusted origin", () => {
    const { boundary } = recordingBoundary();

    const outcome = applySaveResponseEvent(
      { origin: "https://evil.example", source: boundary.parentWindow, data: saveSuccess() },
      boundary
    );

    expect(outcome).toBe("ignored");
    expect(useEditorStore.getState().submitStatus).toBe("idle");
  });

  it("ignores messages from an untrusted source window", () => {
    const { boundary } = recordingBoundary();

    const outcome = applySaveResponseEvent(
      { origin: PARENT_ORIGIN, source: {}, data: saveSuccess() },
      boundary
    );

    expect(outcome).toBe("ignored");
    expect(useEditorStore.getState().submitStatus).toBe("idle");
  });

  it("rejects messages with an unsupported protocol version", () => {
    const { boundary } = recordingBoundary();

    const outcome = applySaveResponseEvent(
      {
        origin: PARENT_ORIGIN,
        source: boundary.parentWindow,
        data: { ...saveSuccess(), version: 99 },
      },
      boundary
    );

    expect(outcome).toBe("ignored");
    expect(useEditorStore.getState().submitStatus).toBe("idle");
  });

  it("ignores a malformed SAVE_ERROR payload with no message", () => {
    const { boundary } = recordingBoundary();

    const outcome = applySaveResponseEvent(
      {
        origin: PARENT_ORIGIN,
        source: boundary.parentWindow,
        data: { type: "SAVE_ERROR", version: EDITOR_PROTOCOL_VERSION, payload: {} },
      },
      boundary
    );

    expect(outcome).toBe("ignored");
    expect(useEditorStore.getState().submitStatus).toBe("idle");
  });

  it("applies a trusted SAVE_SUCCESS and returns 'saved'", () => {
    const { boundary } = recordingBoundary();

    const outcome = applySaveResponseEvent(
      { origin: PARENT_ORIGIN, source: boundary.parentWindow, data: saveSuccess() },
      boundary
    );

    expect(outcome).toBe("saved");
    expect(useEditorStore.getState().submitStatus).toBe("success");
  });

  it("applies a trusted SAVE_ERROR and returns 'error'", () => {
    const { boundary } = recordingBoundary();

    const outcome = applySaveResponseEvent(
      { origin: PARENT_ORIGIN, source: boundary.parentWindow, data: saveError() },
      boundary
    );

    expect(outcome).toBe("error");
    expect(useEditorStore.getState().submitStatus).toBe("error");
  });

  it("ignores unrelated protocol messages", () => {
    useEditorStore.getState().setTemplate(mockTemplate);
    const { boundary } = recordingBoundary();

    const outcome = applySaveResponseEvent(
      {
        origin: PARENT_ORIGIN,
        source: boundary.parentWindow,
        data: { type: "EDITOR_INIT", version: EDITOR_PROTOCOL_VERSION, payload: null },
      },
      boundary
    );

    expect(outcome).toBe("ignored");
    expect(clone(useEditorStore.getState().template)).toEqual(clone(mockTemplate));
  });
});