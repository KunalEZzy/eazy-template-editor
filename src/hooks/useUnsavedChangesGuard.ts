import { useEffect } from "react";
import { useEditorStore } from "../store/editorStore";

/**
 * Warn before a refresh or tab close discards an unsubmitted Master CREATE
 * session.
 *
 * An in-page toast cannot do this job: it only renders *after* the page has
 * already reloaded and the canvas is blank again. The browser's own
 * beforeunload prompt is the only signal that reaches the user at the moment
 * they are actually about to lose the work.
 *
 * Scoped to master-create on purpose:
 *   - master-edit starts from a persisted row, so a refresh loses only the
 *     in-flight edits, not the stored template or its background.
 *   - restaurant mode persists through the local template repository.
 *
 * Browsers deliberately show generic wording for beforeunload ("Leave site?"),
 * so any explanation has to live in the page - see the notice rendered by
 * EditorLayout.
 */
export function useUnsavedChangesGuard(): void {
  const isDirty = useEditorStore((state) => state.isDirty);
  const editorMode = useEditorStore((state) => state.editorMode);

  useEffect(() => {
    if (!isDirty || editorMode !== "master-create") {
      return;
    }

    function handleBeforeUnload(event: BeforeUnloadEvent) {
      // preventDefault + returnValue are both required: modern browsers use
      // preventDefault, older ones only honour returnValue.
      event.preventDefault();
      event.returnValue = "";
    }

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [isDirty, editorMode]);
}
