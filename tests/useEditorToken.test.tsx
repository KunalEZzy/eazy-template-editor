import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, waitFor, cleanup } from "@testing-library/react";
import { useEditorStore } from "../src/store/editorStore";
import { useEditorToken } from "../src/hooks/useEditorToken";
import { mockPreviewData } from "../src/domain/variables/preview.mock";

function tokenFor(restaurantId: string): string {
  return btoa(JSON.stringify({ restaurant_id: restaurantId }));
}

function RestaurantFlowHarness() {
  useEditorToken();
  return null;
}

function setSearch(search: string) {
  window.history.replaceState({}, "", `/${search}`);
}

describe("useEditorToken runtime mode", () => {
  beforeEach(() => {
    useEditorStore.getState().resetEditor();
    setSearch("");
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    useEditorStore.getState().resetEditor();
  });

  it("assigns editorMode 'restaurant' when a valid token flow starts", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockPreviewData,
    });
    vi.stubGlobal("fetch", fetchMock);

    const token = tokenFor("123");
    setSearch(`?token=${encodeURIComponent(token)}`);

    render(<RestaurantFlowHarness />);

    await waitFor(() => {
      expect(useEditorStore.getState().editorMode).toBe("restaurant");
    });

    const calledUrl = String(fetchMock.mock.calls[0][0]);
    expect(calledUrl).toContain(`/editor/variables/123?token=${encodeURIComponent(token)}`);
  });

  it("does not assign restaurant and keeps template mock-less state when the token is invalid", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    setSearch("?token=not-a-valid-token-json");

    render(<RestaurantFlowHarness />);

    await waitFor(() => {
      expect(useEditorStore.getState().error).not.toBeNull();
    });

    expect(useEditorStore.getState().editorMode).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does not assign restaurant when no token is present (standalone demo unaffected)", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    render(<RestaurantFlowHarness />);

    await waitFor(() => {
      expect(useEditorStore.getState().error).not.toBeNull();
    });

    expect(useEditorStore.getState().editorMode).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});