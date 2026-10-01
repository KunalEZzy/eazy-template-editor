import { describe, it, expect, beforeEach } from "vitest";
import { useEditorStore } from "../src/store/editorStore";
import {
  applySetBackgroundImageMessage,
  applySetBackgroundImageEvent,
  getDefaultBackgroundImageBoundary,
  type MasterBackgroundImageBoundary,
} from "../src/integration/masterBootstrap";
import {
  isSetBackgroundImageMessage,
  EDITOR_PROTOCOL_VERSION,
} from "../src/integration/editorProtocol";
import { mockTemplate } from "../src/domain/template/template.mock";
import { createEmptyTemplate } from "../src/domain/template/template.empty";

const PARENT_ORIGIN = "https://admin.eazyweb.dev";

const CDN_URL =
  "https://dt4l9bx31tioh.cloudfront.net/eazymedia/dynamic_poster/abc123.jpg";

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

function setBackgroundImage(
  payload: Record<string, unknown> = { imageUrl: CDN_URL }
) {
  return {
    type: "SET_BACKGROUND_IMAGE" as const,
    version: EDITOR_PROTOCOL_VERSION,
    payload,
  };
}

function recordingBoundary(
  overrides: Partial<MasterBackgroundImageBoundary> = {}
) {
  const posted: Array<{ message: unknown; targetOrigin: string }> = [];
  // A distinct object from `window.parent` so source-mismatch stays detectable.
  const parentWindow = {};
  const boundary: MasterBackgroundImageBoundary = {
    parentOrigin: PARENT_ORIGIN,
    parentWindow,
    postMessage: (message, targetOrigin) => {
      posted.push({ message, targetOrigin });
    },
    ...overrides,
  };
  return { boundary, posted, parentWindow };
}

describe("SET_BACKGROUND_IMAGE protocol guard", () => {
  it("accepts a valid message carrying a CDN url", () => {
    expect(isSetBackgroundImageMessage(setBackgroundImage())).toBe(true);
  });

  it("accepts the optional path and fileName echoes the parent sends", () => {
    expect(
      isSetBackgroundImageMessage(
        setBackgroundImage({
          imageUrl: CDN_URL,
          path: CDN_URL,
          fileName: "abc123.jpg",
        })
      )
    ).toBe(true);
  });

  it("rejects a missing imageUrl", () => {
    expect(isSetBackgroundImageMessage(setBackgroundImage({}))).toBe(false);
  });

  it("rejects an undefined imageUrl", () => {
    expect(
      isSetBackgroundImageMessage(setBackgroundImage({ imageUrl: undefined }))
    ).toBe(false);
  });

  it("rejects an empty or whitespace-only imageUrl", () => {
    expect(
      isSetBackgroundImageMessage(setBackgroundImage({ imageUrl: "" }))
    ).toBe(false);
    expect(
      isSetBackgroundImageMessage(setBackgroundImage({ imageUrl: "   " }))
    ).toBe(false);
  });

  it("rejects a non-string imageUrl", () => {
    expect(
      isSetBackgroundImageMessage(setBackgroundImage({ imageUrl: 42 }))
    ).toBe(false);
    expect(
      isSetBackgroundImageMessage(setBackgroundImage({ imageUrl: null }))
    ).toBe(false);
  });

  it("rejects a missing or non-object payload", () => {
    expect(
      isSetBackgroundImageMessage({
        type: "SET_BACKGROUND_IMAGE",
        version: EDITOR_PROTOCOL_VERSION,
      })
    ).toBe(false);
  });

  it("rejects an unsupported protocol version", () => {
    expect(
      isSetBackgroundImageMessage({ ...setBackgroundImage(), version: 2 })
    ).toBe(false);
  });

  it("rejects an unrelated message type", () => {
    expect(
      isSetBackgroundImageMessage({
        type: "EDITOR_INIT",
        version: EDITOR_PROTOCOL_VERSION,
        payload: { imageUrl: CDN_URL },
      })
    ).toBe(false);
  });
});

describe("applySetBackgroundImageMessage", () => {
  beforeEach(() => {
    useEditorStore.getState().resetEditor();
  });

  it("updates template.background.imageUrl", () => {
    useEditorStore.getState().setTemplate(createEmptyTemplate());
    expect(useEditorStore.getState().template?.background.imageUrl).toBeNull();

    applySetBackgroundImageMessage(setBackgroundImage());

    expect(useEditorStore.getState().template?.background.imageUrl).toBe(
      CDN_URL
    );
  });

  it("increments templateLoadVersion, which drives the canvas redraw", () => {
    useEditorStore.getState().setTemplate(createEmptyTemplate());
    const before = useEditorStore.getState().templateLoadVersion;

    applySetBackgroundImageMessage(setBackgroundImage());

    expect(useEditorStore.getState().templateLoadVersion).toBe(before + 1);
  });

  it("mirrors the url onto temporaryBackgroundImageUrl", () => {
    useEditorStore.getState().setTemplate(createEmptyTemplate());

    applySetBackgroundImageMessage(setBackgroundImage());

    expect(useEditorStore.getState().temporaryBackgroundImageUrl).toBe(CDN_URL);
  });

  it("marks the template dirty so the change is persisted on save", () => {
    useEditorStore.getState().setTemplate(createEmptyTemplate());

    applySetBackgroundImageMessage(setBackgroundImage());

    expect(useEditorStore.getState().isDirty).toBe(true);
  });

  it("applies during master-create", () => {
    useEditorStore.getState().setTemplate(createEmptyTemplate());
    useEditorStore.getState().setEditorMode("master-create");

    applySetBackgroundImageMessage(setBackgroundImage());

    expect(useEditorStore.getState().template?.background.imageUrl).toBe(
      CDN_URL
    );
  });

  it("can replace a previously uploaded background", () => {
    useEditorStore.getState().setTemplate(createEmptyTemplate());
    applySetBackgroundImageMessage(
      setBackgroundImage({ imageUrl: "https://cdn/first.jpg" })
    );
    const afterFirst = useEditorStore.getState().templateLoadVersion;

    applySetBackgroundImageMessage(
      setBackgroundImage({ imageUrl: "https://cdn/second.jpg" })
    );

    const state = useEditorStore.getState();
    expect(state.template?.background.imageUrl).toBe("https://cdn/second.jpg");
    expect(state.templateLoadVersion).toBe(afterFirst + 1);
  });

  describe("master-edit lock", () => {
    beforeEach(() => {
      useEditorStore.getState().setTemplate(clone(mockTemplate));
      useEditorStore.getState().setEditorMode("master-edit");
    });

    it("throws instead of silently reporting a successful apply", () => {
      expect(() => applySetBackgroundImageMessage(setBackgroundImage())).toThrow();
    });

    it("leaves the existing background untouched", () => {
      const original = useEditorStore.getState().template?.background.imageUrl;

      expect(() => applySetBackgroundImageMessage(setBackgroundImage())).toThrow();

      const state = useEditorStore.getState();
      expect(state.template?.background.imageUrl).toBe(original);
      expect(state.temporaryBackgroundImageUrl).toBeNull();
      expect(state.isDirty).toBe(false);
    });
  });
});

describe("applySetBackgroundImageEvent", () => {
  beforeEach(() => {
    useEditorStore.getState().resetEditor();
    useEditorStore.getState().setTemplate(createEmptyTemplate());
  });

  it("applies a valid message from the trusted parent", () => {
    const { boundary, posted, parentWindow } = recordingBoundary();

    const outcome = applySetBackgroundImageEvent(
      { origin: PARENT_ORIGIN, source: parentWindow, data: setBackgroundImage() },
      boundary
    );

    expect(outcome).toBe("applied");
    expect(useEditorStore.getState().template?.background.imageUrl).toBe(
      CDN_URL
    );
    expect(posted).toHaveLength(1);
  });

  it("acknowledges with BACKGROUND_IMAGE_APPLIED to the parent origin", () => {
    const { boundary, posted, parentWindow } = recordingBoundary();

    applySetBackgroundImageEvent(
      { origin: PARENT_ORIGIN, source: parentWindow, data: setBackgroundImage() },
      boundary
    );

    expect(posted[0]).toEqual({
      message: { type: "BACKGROUND_IMAGE_APPLIED", version: 1 },
      targetOrigin: PARENT_ORIGIN,
    });
  });

  it("reports BACKGROUND_IMAGE_APPLY_ERROR and stays silent about success in master-edit", () => {
    useEditorStore.getState().setTemplate(clone(mockTemplate));
    useEditorStore.getState().setEditorMode("master-edit");
    const { boundary, posted, parentWindow } = recordingBoundary();

    const outcome = applySetBackgroundImageEvent(
      { origin: PARENT_ORIGIN, source: parentWindow, data: setBackgroundImage() },
      boundary
    );

    expect(outcome).toBe("error");
    expect(posted).toHaveLength(1);
    const ack = posted[0].message as { type: string; payload: { message: string } };
    expect(ack.type).toBe("BACKGROUND_IMAGE_APPLY_ERROR");
    expect(ack.payload.message).toMatch(/cannot be replaced/i);
    expect(posted[0].targetOrigin).toBe(PARENT_ORIGIN);
  });

  it("never acknowledges a message from a foreign origin", () => {
    const { boundary, posted, parentWindow } = recordingBoundary();

    const outcome = applySetBackgroundImageEvent(
      { origin: "https://evil.example.com", source: parentWindow, data: setBackgroundImage() },
      boundary
    );

    expect(outcome).toBe("ignored");
    expect(posted).toHaveLength(0);
    expect(useEditorStore.getState().template?.background.imageUrl).toBeNull();
  });

  it("never acknowledges a message from a different window", () => {
    const { boundary, posted } = recordingBoundary();

    const outcome = applySetBackgroundImageEvent(
      { origin: PARENT_ORIGIN, source: { not: "the parent" }, data: setBackgroundImage() },
      boundary
    );

    expect(outcome).toBe("ignored");
    expect(posted).toHaveLength(0);
    expect(useEditorStore.getState().template?.background.imageUrl).toBeNull();
  });

  it("ignores a malformed message and does not acknowledge it", () => {
    const { boundary, posted, parentWindow } = recordingBoundary();

    const outcome = applySetBackgroundImageEvent(
      {
        origin: PARENT_ORIGIN,
        source: parentWindow,
        data: setBackgroundImage({ imageUrl: "" }),
      },
      boundary
    );

    expect(outcome).toBe("ignored");
    expect(posted).toHaveLength(0);
  });

  it("ignores an EDITOR_INIT so the bootstrap handler can take it", () => {
    const { boundary, parentWindow } = recordingBoundary();

    const outcome = applySetBackgroundImageEvent(
      {
        origin: PARENT_ORIGIN,
        source: parentWindow,
        data: {
          type: "EDITOR_INIT",
          version: EDITOR_PROTOCOL_VERSION,
          payload: {
            mode: "master",
            template: clone(mockTemplate),
            capabilities: { canSave: true },
          },
        },
      },
      boundary
    );

    expect(outcome).toBe("ignored");
  });
});

describe("getDefaultBackgroundImageBoundary", () => {
  it("targets the configured parent origin", () => {
    expect(getDefaultBackgroundImageBoundary().parentOrigin).toBe(
      PARENT_ORIGIN
    );
  });
});
