import type { Template } from "../domain/template/template.types";
import { isTemplate } from "../domain/template/template.validation";

/**
 * Local draft for an in-progress Master CREATE session.
 *
 * A Master CREATE template is not persisted anywhere until "Submit Template"
 * reaches Laravel. The parent renders `EDITOR_INIT` with `template: null` on
 * every page load, so reloading before submitting restores a blank canvas even
 * though the background was already uploaded to S3. That leaves the uploaded
 * object orphaned in the bucket with nothing referencing it.
 *
 * This draft keeps the working template (including the uploaded background) in
 * this browser's localStorage so a refresh resumes where the user left off. It
 * is deliberately local and per-browser: it is a crash/refresh safety net, not
 * a second source of truth. It is cleared as soon as Submit succeeds.
 */
const DRAFT_KEY = "eazy-template-editor:master-create-draft";

function getStorage(): Storage | null {
  try {
    // Absent in SSR/tests without a DOM, and access throws in some privacy modes.
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function saveMasterCreateDraft(template: Template): void {
  const storage = getStorage();

  if (!storage) {
    return;
  }

  try {
    storage.setItem(DRAFT_KEY, JSON.stringify(template));
  } catch {
    // Quota exceeded or storage disabled. Losing the draft must never break
    // editing, so this is intentionally silent - the beforeunload guard is
    // what warns the user.
  }
}

/**
 * Return the stored draft, or null when there is nothing usable. A draft that
 * fails validation (corrupt JSON, or a shape from an older build) is discarded
 * rather than allowed to crash the bootstrap.
 */
export function loadMasterCreateDraft(): Template | null {
  const storage = getStorage();

  if (!storage) {
    return null;
  }

  let raw: string | null;

  try {
    raw = storage.getItem(DRAFT_KEY);
  } catch {
    return null;
  }

  if (!raw) {
    return null;
  }

  try {
    const parsed: unknown = JSON.parse(raw);

    return isTemplate(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function clearMasterCreateDraft(): void {
  const storage = getStorage();

  if (!storage) {
    return;
  }

  try {
    storage.removeItem(DRAFT_KEY);
  } catch {
    // Nothing actionable; a stale draft is harmless because it is validated
    // on read and replaced on the next edit.
  }
}

export const MASTER_CREATE_DRAFT_KEY = DRAFT_KEY;
