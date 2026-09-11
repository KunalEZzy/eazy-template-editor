import { useEffect } from "react";
import { useEditorStore } from "../store/editorStore";
import { mockTemplate } from "../domain/template/template.mock";
import type { PreviewData } from "../domain/variables/preview.types";

const API_BASE = import.meta.env.VITE_EDITOR_API_BASE ?? "";

interface DecodedToken {
  restaurant_id: string;
}

export function useEditorToken() {
  const setTemplate = useEditorStore((s) => s.setTemplate);
  const setPreviewData = useEditorStore((s) => s.setPreviewData);
  const setLoading = useEditorStore((s) => s.setLoading);
  const setError = useEditorStore((s) => s.setError);

  useEffect(() => {
    async function load() {
      const token = new URLSearchParams(window.location.search).get("token");

      if (!token) {
        setError("Missing editor link. Please reopen this editor from the admin panel.");
        return;
      }

      let restaurantId: string;
      try {
        const decoded = JSON.parse(atob(token)) as DecodedToken;
        restaurantId = decoded.restaurant_id;
        if (!restaurantId) throw new Error("no restaurant_id");
      } catch {
        setError("This editor link is invalid. Please reopen it from the admin panel.");
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const res = await fetch(
          `${API_BASE}/editor/variables/${restaurantId}?token=${encodeURIComponent(token)}`
        );

        if (res.status === 401) {
          setError("This editor link has expired. Please reopen it from the admin panel.");
          return;
        }
        if (res.status === 403) {
          setError("This editor link is not valid for this restaurant.");
          return;
        }
        if (!res.ok) {
          setError("Could not load your template data. Please try again.");
          return;
        }

        const previewData = (await res.json()) as PreviewData;

        // Stage 3/4 test scope: one bundled base design, real per-restaurant variables.
        // Revisit if/when multiple template designs are needed (plan.md 2.3).
        setTemplate(mockTemplate);
        setPreviewData(previewData);
      } catch {
        setError("Could not reach the server. Check your connection and try again.");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [setTemplate, setPreviewData, setLoading, setError]);
}