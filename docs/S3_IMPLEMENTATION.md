# S3 Implementation — Background Image Upload via Laravel

This document explains what we audited, what each file does, what changed during
each work phase, and the current state of the S3 background-upload integration —
in plain words.

---

## 1. The Audit (what we found first)

Before writing any code, we inspected the whole background-image path in the
React editor. Here is what we found.

### 1.1 How the background is stored

A template's background lives in `Template.background.imageUrl` (a `string` or
`null`). This is the **persistent** value — the URL that exists on an already
loaded/saved template.

### 1.2 The "staging" mechanism

The editor also has a separate piece of state called
`temporaryBackgroundImageUrl`. It works like this:

- You pick a background → its URL goes into the **temporary** slot first.
- The canvas renders `temporary ??? saved` (temporary wins while set).
- When you press **Save**, `EditorLayout.handleSave` copies the temporary value
  into the real `template.background.imageUrl`.
- After a successful save, `setTemplate()` clears the temporary slot.

This "stage-then-commit" flow already existed and we kept it.

### 1.3 The OLD local-only upload path (removed)

Before this step, `BackgroundSection.tsx` did **not** talk to any server. It:

1. Read the chosen file with `FileReader.readAsDataURL()` → produced a huge
   base64 `data:` URL.
2. Loaded that data URL into a hidden `Image` to read the image's natural
   width/height.
3. Called `setTemporaryBackgroundImage(dataUrl, { width, height })`.

Because the dimensions were passed, the store **resized the logical canvas** to
match the uploaded image (e.g. a 1080×1920 phone photo would change the 1200×1600
canvas). This was the "temporary background dimension-changing behavior" the
task told us not to trigger anymore.

### 1.4 The existing Laravel upload contract

Laravel already had a working image-upload endpoint used by the legacy editor:

| Item        | Value                                      |
| ----------- | ------------------------------------------ |
| Endpoint    | `POST marketing/template/upload-image`     |
| Field name  | `image` (multipart/form-data)              |
| Response    | `{ path, fileName }`                       |
| S3 key      | `eazymedia/dynamic_poster/<filename>.jpg`  |
| CDN resolve | `dynamic_poster/<filename>` → S3 CDN URL   |
| Controller  | `DynamicPosterController::uploadImage()`   |

No Authorization token is needed for this master-editor flow.

### 1.5 Environment / API configuration

The project already had a base-URL environment variable — `VITE_EDITOR_API_BASE`
— used by `useEditorToken.ts` for Laravel calls. It is defined in `.env.local`
and `.env.production`. We reused it and added **no** new environment variable.

### 1.6 Where the canvas renders the background

`src/canvas/CanvasEditor.tsx` picks the background from
`temporaryBackgroundImageUrl ?? template.background.imageUrl`
and loads it into the Fabric canvas. Existing loaded templates (whose
`imageUrl` is a real CDN URL) already rendered fine — we must not break them.

---

## 2. What each file does now

### 2.1 `src/integration/templateImageUpload.ts` (NEW)

The only place in the whole app that knows about the Laravel upload endpoint.
It is the "integration layer" — the bridge between React and Laravel/S3.

- `UPLOAD_IMAGE_ENDPOINT = "/marketing/template/upload-image"`
- `TemplateImageUploadResult` — typed return `{ path, fileName }`
- `uploadTemplateImage(file: File)`:
  - builds a `FormData`, appends the file under the field name **`image`**
  - POSTs to `VITE_EDITOR_API_BASE + /marketing/template/upload-image`
  - sends **no** Authorization header / token
  - on HTTP error (non-200) → throws a clean `Error` with the status
  - on network failure → throws a clean "could not reach the server" error
  - on a malformed JSON/body → throws "invalid response"
  - on success → validates `path` and `fileName` are strings, returns them

Why this file matters: no `fetch` lives in any React component, and no Laravel
or S3 detail leaks into the domain, canvas, store, or repository layers.

### 2.2 `src/components/properties/BackgroundSection.tsx` (MODIFIED)

The background upload UI. Before, it produced a local data URL. Now it:

1. Validates a file was selected.
2. Rejects non-image files with a visible error (no upload attempted).
3. Sets an **uploading** state → disables the button, shows "Uploading...".
4. Calls `uploadTemplateImage(file)`.
5. **Only on success** → `setTemporaryBackgroundImage(result.path)` — and
   deliberately passes **no dimensions** so the canvas stays 1200×1600.
6. On failure → shows the error in a `role="alert"` box and leaves the previous
   background untouched (both the temporary slot and the saved URL).
7. "Remove" button still works — it clears the temporary background.

### 2.3 Unchanged files that still matter

| File                                    | Role                                                  |
| --------------------------------------- | ----------------------------------------------------- |
| `src/store/editorStore.ts`              | `setTemporaryBackgroundImage` — stages the URL, only resizes canvas **if dimensions are passed** (we no longer pass them) |
| `src/canvas/CanvasEditor.tsx`           | Renders `temporaryBackgroundImageUrl ?? template.background.imageUrl` |
| `src/components/layout/EditorLayout.tsx`| Save button commits temporary background → `template.background.imageUrl` |
| `src/domain/template/template.types.ts` | `Template.background.imageUrl: string \| null`       |
| `src/domain/template/template.empty.ts` | `createEmptyTemplate()` — canvas 1200×1600, no background |
| `src/hooks/useEditorToken.ts`           | Existing example of the `VITE_EDITOR_API_BASE` pattern |

---

## 3. The phases and the changes made in each

### Phase 7A — Audit (no code changed)

Read and mapped:
- `BackgroundSection.tsx` — found the FileReader data-URL flow + dimension change
- `editorStore.ts` — found `setTemporaryBackgroundImage` and its resize-on-dimensions behavior
- `CanvasEditor.tsx` — found temp-vs-saved background selection
- `EditorLayout.tsx` — found the save-time commit of the temp background
- `template.types.ts` / `template.empty.ts` / `template.mock.ts` — the data model and canonical 1200×1600 canvas
- `useEditorToken.ts` + `.env.local` / `.env.production` — confirmed `VITE_EDITOR_API_BASE` exists
- searched for any `fetch`/axios/API-utility usage — only `useEditorToken.ts`

**Conclusion:** the uploaded image can be represented simply as
`template.background.imageUrl` via the existing staging mechanism; no new model
field is needed.

### Phase 7B — Upload service (new file)

Created `src/integration/templateImageUpload.ts`:
- multipart/form-data with field name exactly `image`
- POST to the existing Laravel endpoint
- parses `{ path, fileName }` with validation
- clean errors for HTTP + network + bad payload
- no Authorization token

### Phase 7C — Connect the UI

Rewrote `BackgroundSection.tsx`:
- file validation (image types only)
- upload goes through `uploadTemplateImage`
- background is replaced **only after** server success
- failures keep the old background and show a visible error
- "Uploading..." state disables the buttons so you cannot double-upload

### Phase 7D — Preserve existing behavior

- Existing loaded templates already have `background.imageUrl` — unchanged and
  still rendered by `CanvasEditor`.
- The staging (`temporaryBackgroundImageUrl`) flow is kept, so Save still works.
- The **local-only** FileReader/data-URL preview was proven obsolete (the new
  preview is the server-returned CDN path) and removed as the minimum obsolete code.
- The "Remove" and "Unsaved background" UI are retained.

### Phase 7E — Dimension rule

- The upload calls `setTemporaryBackgroundImage(result.path)` **without**
  dimensions, so the canonical 1200×1600 logical canvas never changes.
- Viewport/display scaling was not touched at all.

### Phase 7F — Tests

New test files:
- `tests/templateImageUpload.test.ts` (5 tests) — multipart field `image`,
  success parse, HTTP failure, network failure, **no Authorization token**.
- `tests/BackgroundSection.upload.test.tsx` (6 tests) — failed upload keeps old
  background, background intact while uploading, successful upload updates the
  reference, **canvas dimensions unchanged**, existing background still renders,
  non-image rejection.

All network calls are mocked — no real Laravel/S3 requests in Vitest.

### Phase 7G — Verification

- `npm run test` → **134 passed (16 files)**
- `npm run lint` → **clean**
- `npm run build` → **success**

---

## 4. Current state of the S3 implementation (easy words)

- When the admin picks a background image, the React editor **uploads that file
  straight to the existing Laravel endpoint**, which puts it on S3 and returns a
  CDN path.
- The editor shows "Uploading..." while that happens and disables the buttons.
- **Only if the upload succeeds** does the new image replace the background on
  the canvas and in the editor state.
- If it fails (bad connection, server error, wrong file type), the old background
  stays, and a red error message explains why.
- The canvas **never changes size** because of an upload — it stays at the
  canonical 1200×1600.
- The new image is stored as a **staged/unsaved** background until the admin
  clicks **Save Template**, which is exactly how backgrounds worked before.
- Templates already loaded from Laravel keep rendering their existing background
  exactly as before — nothing about them changed.
- The image itself is **not** yet persisted to the `poster_template` database row.
  That is deliberately left for the later **Master Submit** step, which will read
  this already-uploaded reference and save it.

### Done and not done

| Thing                                                  | Status |
| ------------------------------------------------------ | ------ |
| Reuse existing Laravel upload endpoint                | ✅ Done |
| Multipart field name `image` exactly                  | ✅ Done |
| No Authorization token in master flow                 | ✅ Done |
| Upload service in the integration layer only          | ✅ Done |
| Replace background only after success                 | ✅ Done |
| Visible error + keep old background on failure        | ✅ Done |
| Loading / disabled state while uploading              | ✅ Done |
| Canvas stays 1200×1600                                | ✅ Done |
| Existing loaded backgrounds keep rendering            | ✅ Done |
| No canvas geometry / export / QR / validation changes| ✅ Done |
| Persist image reference to Laravel DB                 | ❌ Left for Master Submit step |
| SAVE_REQUEST / SAVE_SUCCESS protocol                  | ❌ Left for Master Submit step |
| New upload endpoint (did not add one)                 | ✅ Reused existing |
| Tokens/authentication added to React                  | ✅ Not added (not needed) |