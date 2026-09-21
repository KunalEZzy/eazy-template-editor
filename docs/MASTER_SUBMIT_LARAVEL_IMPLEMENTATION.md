# Phase: Master Template Submit — React ↔ Laravel Persistence (STEP 8)

This document captures everything implemented in this phase: the full chain
that takes a template edited in the React Master editor and persists it into
the existing Laravel `poster_template` table, plus the reverse path that feeds
the saved row back into the editor.

It covers:

1. [Architecture at a glance](#architecture-at-a-glance)
2. [Files changed — React project](#files-changed--react-project)
3. [Files changed — Laravel (PHP) project, in detail](#files-changed--laravel-php-project-in-detail)
4. [Flow: React → PHP (submit / save)](#flow-react--php-submit--save)
5. [Flow: PHP → React (init, save success, save error)](#flow-php--react-init-save-success-save-error)
6. [Protocol specification](#protocol-specification)
7. [CREATE vs EDIT resolution](#create-vs-edit-resolution)
8. [React Template ↔ legacy poster_template mapping](#react-template--legacy-poster_template-mapping)
9. [Error handling & guards](#error-handling--guards)
10. [Verification results](#verification-results)

---

## Architecture at a glance

```
┌──────────────────────────────  React editor (iframe)  ──────────────────────────────┐
│                                                                                      │
│  src/integration/masterSubmit.ts                                                     │
│    requestTemplateSubmit(template)  ── postMessage(SaveRequestMessage, PARENT_ORIGIN) │
│    SAVE_SUCCESS / SAVE_ERROR  ◄──────────── window message listener                  │
│  store: submitStatus (idle|saving|success|error), submitMessage                      │
│  store: setTemplate() hydrate, updateTemplateInfo() mark dirty                       │
└──────────────────────────────────────────┬───────────────────────────────────────────┘
                                           │  window.postMessage (same window.parent)
                                           ▼
┌──────────────────────────────  Laravel Blade parent (details.blade.php)  ────────────┐
│                                                                                      │
│  SAVE_REQUEST  →  validate origin/source/version/shape                                │
│                →  $.ajax POST '/marketing/template/submit-editor' (+ X-CSRF-TOKEN)   │
│  SAVE_SUCCESS/SAVE_ERROR  ◄── JSON response → postMessage back to iframe             │
└──────────────────────────────────────────┬───────────────────────────────────────────┘
                                           ▼   authenticated admin session
┌──────────────────────────────  Laravel persistence (DynamicPosterController)  ───────┐
│                                                                                      │
│  submitFromEditor()                                                                   │
│    LegacyTemplateAdapter::toLegacyTemplate(reactTemplate)   (React → legacy)          │
│    poster_templateRepository->create() / ->update()         (same as store/update)   │
│    processLog()                                           (update log, existing)     │
│    LegacyTemplateAdapter::toReactTemplate(savedRow)           (legacy → React)       │
│    respond { id, template }                                                          │
└──────────────────────────────────────────────────────────────────────────────────────┘
```

Key rule (STEP 8A): **the React editor never talks to Laravel directly.** The
parent Blade page owns the authenticated admin session and CSRF token; the
editor only communicates with the parent via `postMessage` and carries no
tokens, no Laravel routes and no knowledge of `poster_template` columns.

---

## Files changed — React project

Project root: `/home/eazydiner/eazy-template-editor`

| File | Change |
| --- | --- |
| `src/integration/editorProtocol.ts` | Added the submit half of the editor protocol: `EditorSaveRequestMessage`, `EditorSaveSuccessMessage`, `EditorSaveErrorMessage` and the guard functions `isSaveRequestMessage`, `isSaveSuccessMessage`, `isSaveErrorMessage`. Protocol version remains `EDITOR_PROTOCOL_VERSION = 1`. |
| `src/integration/masterSubmit.ts` **(new)** | The integration boundary that mirrors `masterBootstrap.ts`: posts `SAVE_REQUEST`, listens for `SAVE_SUCCESS`/`SAVE_ERROR`, and applies them to the store. Exports `canSubmitTemplate` (metadata gate), `buildSaveRequestMessage`, `requestTemplateSubmit`, `applySaveSuccessMessage`, `applySaveErrorMessage`, `applySaveResponseEvent` (pure + testable), `useMasterSubmit` (window listener hook). |
| `src/store/editor.types.ts` | Added `submitStatus: "idle" \| "saving" \| "success" \| "error"` and `submitMessage: string \| null` to `EditorState`. |
| `src/store/editor.actions.ts` | Added `setSubmitStatus(status, message?)` to `EditorActions`. |
| `src/store/editorStore.ts` | Added `submitStatus: "idle"` / `submitMessage: null` to `initialState`, the `setSubmitStatus` implementation, and resetting both inside `setTemplate` (a hydrated template always clears the previous submit state). |
| `src/components/layout/EditorHeader.tsx` | Submit Template button is now live: new props `submitStatus`, `submitMessage`, `onSubmit`. Disabled while `saving`; shows spinner + "Submitting…"; shows "Submitted ✓" after success; tooltip updated. |
| `src/components/layout/EditorLayout.tsx` | Wires `handleSubmit` → `requestTemplateSubmit(template)` (mirroring `handleSave`'s temporary-background stitching), calls `useMasterSubmit()`, and renders a green success banner (`role="status"`) and red error banner (`role="alert"`). |
| `tests/masterSubmit.test.ts` **(new)** | Unit/integration tests for the entire boundary. |
| `tests/EditorHeader.submit.test.tsx` | Extended with the submit-state rendering tests (saving, success, click, invalid-metadata disabled). |

> Note: files from earlier phases also exist (`templateMetadata.validation.ts`,
> `templateImageUpload.ts`, `BackgroundSection.tsx`, etc.) but were not changed
> in this phase.

---

## Files changed — Laravel (PHP) project, in detail

Project root: `/home/eazydiner/eazyweb` (the active repo; `eazyweb2` is a stale
duplicate and was **not** touched).

### 1. `app/Services/DynamicPoster/LegacyTemplateAdapter.php`

The adapter previously was one-way only: `toReactTemplate()` (legacy row →
React). This phase added the reverse direction **without modifying the existing
mapping** (STEP 8D rule: only add, never re-map).

New **public** method:

```
toLegacyTemplate(array $reactTemplate): array
```

Produces a legacy `poster_template` data array exactly in the shape that
`DynamicPosterController::processData()` produces, so `store()`-style
persistence works unchanged:

```php
[
    'name'     => 'Summer Standee',
    'code'     => 'summer_standee',              // str_slug(name, '_') — mirrors processData()
    'image'    => 'abc123.jpg',                  // fileName extracted from full CDN URL
    'active'   => 1,                             // boolean → 0/1
    'campaign' => 'PayEazy Standee',             // React slug → exact legacy label
    'box1'     => '{...}',                       // JSON strings, percentages "NN.dddddddd%"
    'box2'     => '{...}',
    'box3'     => '{...}',
    'box4'     => '{...}',
    'box5'     => '{...}',
]
```

The returned array deliberately contains **no `id`**: the controller resolves
CREATE vs EDIT and the repository manages the persisted id (same contract as
`processData()` feeding `store()`/`update()`).

New private helpers:

- `reverseCampaign()` — inverse of `campaignMap` (`pay-eazy-standee` →
  `PayEazy Standee`, etc.). Unknown/missing campaign throws `DomainException`.
- `imageFileName()` — React `background.imageUrl` holds the full CDN URL
  (from the upload-image endpoint), but the legacy `image` column stores only
  the S3 fileName. It parses the URL and returns the filename, e.g.
  `https://cdn.eazydiner.com/eazymedia/dynamic_poster/abc123.jpg?width=100` →
  `abc123.jpg`. Empty/missing background → `""`.
- `convertLegacyBox($box)` — one React box → legacy slot; empty slots become
  the exact all-empty-string array that `processData()` encodes. Throws
  `DomainException` for unknown/malformed input.
- `reactPercentage($box, $key)` — React numeric geometry (x/y/width/height)
  → `number_format(..., 8) . '%'`, identical to `processData()`.
- `reactTextValue($box, $key)` — font/color/size/weight with the same defaults
  `toReactTemplate()` uses when reading back (`Arial`, `48`, `700`, `#000000`).
- `reactTextTransform($box)` — validates against the same supported transform
  set (`none|capitalize|uppercase|lowercase`); unsupported → `DomainException`.

Validation rules (all throw `DomainException` instead of silently dropping data):
- empty/whitespace `name`
- unsupported/missing `campaign`
- missing or non-numeric `x`/`y`/`width`/`height`
- unknown box `variable`
- more than **5** boxes (legacy format limit)
- unsupported `textTransform`
- missing `boxes` array

### 2. `app/Http/Controllers/Admin/DynamicPosterController.php`

New **public** action + a private helper:

```
submitFromEditor(submitMarketingTemplatesRequests $request, PosterTemplateRepository $posterTemplateRepo): JsonResponse
decodeBoxes(array $legacyTemplate): array
```

Flow of `submitFromEditor()`:

1. Read the JSON body: `$request->input('template')`. Missing/non-array →
   `422 { message: "Invalid template payload." }`.
2. Convert via the adapter:
   `App::make(LegacyTemplateAdapter::class)->toLegacyTemplate($templateData)`.
   `DomainException` → `422 { message }`.
3. Resolve CREATE vs EDIT from the React `id`
   (placeholder/none ⇒ CREATE; real persisted id ⇒ EDIT).
4. **CREATE**: `$posterTemplateRepo->create($data)` then exactly the same
   `$this->processLog($template->toArray())` call that `store()` uses.
   **EDIT**: fetch by id (`condition('id', $id)->fetchOne()`); missing →
   `404 { message: "Template does not exist." }`; then
   `$this->processLog($data, $template->toArray(), 'update')` and
   `$posterTemplateRepo->condition('id', $id)->update($data)`, mirroring the
   legacy `update()` action.
5. Re-fetch the persisted row, `decodeBoxes()` the `box1..box5` JSON strings
   (same decoding the `show()` view does), and normalize it back to React via
   the existing `toReactTemplate()`.
6. Respond:

```json
200
{
  "id": "123",
  "template": { "...canonical React template with persisted id..." }
}
```

`decodeBoxes()` simply `json_decode`s `box1..box5` into arrays so the adapter
can consume the row exactly like the `show()` page does.

**No changes** were made to `store()`, `update()`, `processData()`, `processLog()`,
`uploadImage()`, `show()` or `create()`.

### 3. `routes/admin.php`

Added one route inside the existing `admin.auth` middleware group (which also
carries web/CSRF middleware), right beside the legacy template routes:

```php
Route::post('marketing/template/submit-editor', [
    'as'   => 'marketing.template.submitEditor',
    'uses' => 'Admin\DynamicPosterController@submitFromEditor',
]);
```

Full named route: `admin::marketing.template.submitEditor`
(outer group applies the `admin::` name prefix).

Confirmed real routes (this phase re-verified them; one task assumption was
wrong):

| Route | Method | Action |
| --- | --- | --- |
| `marketing/template/create` | GET | `create()` |
| `marketing/template/store` | POST | `store()` |
| **`marketing/template/update`** | **POST** | `update()` — **id is in the request body, NOT `/update/{id}`** |
| `marketing/template/upload-image` | POST | `uploadImage()` |
| `marketing/template/submit-editor` | POST | `submitFromEditor()` **(new)** |
| `marketing/template/{id?}` | GET | `show()` |

### 4. `resources/views/admin/dynamic_poster/details.blade.php`

The parent page owns persistence. Its existing `EDITOR_READY → EDITOR_INIT`
handshake is untouched, and a new `SAVE_REQUEST` handler was added:

- Reads the submit URL and the CSRF token up front:
  `@json(route('admin::marketing.template.submitEditor'))` and
  `$('meta[name="csrf-token"]').attr('content')`.
- `onEditorMessage` first validates **origin** (`event.origin === editorOrigin`,
  the CloudFront iframe origin) and **source** (`event.source === iframe.contentWindow`).
- If `data.type === 'SAVE_REQUEST'`: `handleSaveRequest(data)`.
  - Validates `version === 1` and that `payload.template` is a non-null object.
  - POSTs `application/json` to the submit route with `X-CSRF-TOKEN` header
    and `JSON.stringify({ template: payload.template })`.
  - On success replies to the iframe:
    `SAVE_SUCCESS { version:1, payload: { template: res.template, id: res.id } }`.
  - On failure (or missing payload) replies:
    `SAVE_ERROR { version:1, payload: { message } }`
    (reads `xhr.responseJSON.message`, falling back to `msg`).
- All other/unknown message types are ignored.

jQuery is already loaded on admin pages (the legacy `create_template.js` uses
it), so `$.ajax` needs no new dependency.

---

## Flow: React → PHP (submit / save)

1. **User clicks “Submit Template”** in `EditorHeader`. The button is
   disabled while metadata is invalid (Step 5.6 gate) or a submit is in flight.
2. `EditorLayout.handleSubmit()` stitches the temporary background into
   `template.background.imageUrl` if present (same as `handleSave`), then calls
   `requestTemplateSubmit(templateToSend)` from `src/integration/masterSubmit.ts`.
3. `requestTemplateSubmit`:
   - re-runs `canSubmitTemplate` (name + campaign required) and refuses + sets
     `submitStatus = "error"` when invalid — nothing is posted;
   - refuses if not embedded (`window.parent === window`);
   - otherwise `store.setSubmitStatus("saving")` and
     `window.parent.postMessage(SaveRequestMessage, PARENT_ORIGIN)` where
     `PARENT_ORIGIN = VITE_EDITOR_PARENT_ORIGIN`
     (`https://admin.eazyweb.dev` in both `.env.local` and `.env.production`).
4. SaveRequestMessage is structurally:

```json
{
  "type": "SAVE_REQUEST",
  "version": 1,
  "payload": { "template": { "...canonical React Template..." } }
}
```

5. `details.blade.php` receives it, validates origin/source/version/shape,
   then performs the **authenticated** fetch: `POST /marketing/template/submit-editor`
   with the CSRF token and the admin session cookie.
6. `submitFromEditor()` converts `template` → legacy data via
   `toLegacyTemplate()` and persists through the same repository + `processLog`
   flow as `store()`/`update()` (details above). DomainException failures become
   422s, missing rows become 404s.
7. Laravel responds `200 { id, template }` (template re-normalized from the
   freshly persisted row via `toReactTemplate`).

---

## Flow: PHP → React (init, save success, save error)

### Edit-mode init (existing, recap)

1. Admin opens a template; `show()` decodes `box1..box5`, converts the legacy
   row with `toReactTemplate()` and passes `reactTemplate` into the Blade view.
2. Iframe loads (`https://dtw7ku4n4d0j3.cloudfront.net`); the editor app posts
   `EDITOR_READY`; the parent validates and replies `EDITOR_INIT` containing
   `payload.template` (or `template: null` for Create).
3. `masterBootstrap.applyEditorInitMessage` hydrates the store
   (`setTemplate`), clearing dirty/submit state.

### Save success / error (new)

After the parent receives the Laravel JSON response it posts back to the
iframe:

```json
// on success
{ "type": "SAVE_SUCCESS", "version": 1, "payload": { "template": {...}, "id": "123" } }

// on failure
{ "type": "SAVE_ERROR", "version": 1, "payload": { "message": "..." } }
```

The iframe `useMasterSubmit` listener receives the event and routes it through
`applySaveResponseEvent`, which guards:

- `event.origin === PARENT_ORIGIN`
- `event.source === window.parent`
- `isSaveSuccessMessage(event.data)` / `isSaveErrorMessage(event.data)`
  (type + `version === 1` + payload schema)

Then:

- **SAVE_SUCCESS** → `applySaveSuccessMessage`:
  - `store.setTemplate(message.payload.template)` — hydrates the persisted row.
    For CREATE this **binds the newly-persisted id** back into the editor, so
    subsequent saves become edits. `setTemplate` also clears `isDirty` and
    resets prior submit state.
  - `store.setSubmitStatus("success", "Template saved successfully.")`
  - UI: header shows “Submitted ✓”, green `role="status"` banner shows.
- **SAVE_ERROR** → `applySaveErrorMessage`:
  - `store.setSubmitStatus("error", message.payload.message)`.
  - The working template is **deliberately untouched** — every unsaved edit
    stays on the canvas.
  - UI: red `role="alert"` banner appears with the message; the button re-enables
    for retry.
- Anything failing a guard is silently ignored (untrusted origin/source,
  wrong version, malformed payload, unrelated message types).

---

## Protocol specification (version 1)

| Message | Direction | Payload | Guard |
| --- | --- | --- | --- |
| `EDITOR_READY` | editor → parent | — (version only) | type + version |
| `EDITOR_INIT` | parent → editor | `{ mode: "master", template: Template\|null, capabilities, previewData? }` | `isEditorInitMessage` |
| `SAVE_REQUEST` | editor → parent | `{ template: Template }` | `isSaveRequestMessage` |
| `SAVE_SUCCESS` | parent → editor | `{ template: Template, id: string }` | `isSaveSuccessMessage` |
| `SAVE_ERROR` | parent → editor | `{ message: string }` | `isSaveErrorMessage` |

All messages carry `version: 1`; a different version is rejected. The trusted
origin is `VITE_EDITOR_PARENT_ORIGIN`; the iframe origin (used by the parent)
is derived from the iframe `src`.

## CREATE vs EDIT resolution

| React `template.id` value | Meaning | PHP handling |
| --- | --- | --- |
| `"new-template"` (empty editor placeholder) | CREATE | `submitFromEditor` calls `create()` + create log |
| `""` / missing | CREATE | same as above |
| any numeric persisted id (e.g. `"123"`) | EDIT | `submitFromEditor` updates that exact row + update log; missing row → 404 |

The editor never generates a DB id; CREATE hydrates the DB id from the
`SAVE_SUCCESS` payload. The legacy placeholder logic in `store()` (`"Image not
uploaded"` 422) applies **only** to the untouched legacy form flow.

## React Template ↔ legacy poster_template mapping

| React | legacy (poster_template) | Notes |
| --- | --- | --- |
| `name` | `name` | required |
| — | `code` | always `str_slug(name, '_')`, mirrors `processData()` |
| `background.imageUrl` (full CDN URL) | `image` | S3 fileName only, extracted by adapter |
| `active` (bool) | `active` | 1 / 0 |
| `campaign` (e.g. `pay-eazy-standee`) | `campaign` | exact legacy label, e.g. `PayEazy Standee` |
| `boxes[i].variable` | `box<i>.label` | known text/QR variable or throw |
| `boxes[i].x` | `box<i>.left` | `number_format(v,8).'%'` |
| `boxes[i].y` | `box<i>.top` | same format |
| `boxes[i].width` / `height` | `box<i>.width` / `height` | same format |
| text: `fontFamily` | `box<i>.ftype` | default `Arial` |
| text: `color` | `box<i>.fcolor` | default `#000000` |
| text: `color2` (optional) | `box<i>.fcolor2` | `''` when absent |
| text: `fontSize` | `box<i>.fsize` | default `48` |
| text: `fontWeight` | `box<i>.fweight` | default `700` |
| text: `textTransform` | `box<i>.fcase` | validated to `none\|capitalize\|uppercase\|lowercase` |
| QR box | `box<i>.ftype/fcolor/fsize/...` | all `''` |

Empty React slots are encoded exactly like `processData()` does (an
all-empty-string JSON object), so the round trip through `toReactTemplate()`
skips them identically.

## Error handling & guards

- **React**: metadata gate prevents invalid submits; `requestTemplateSubmit`
  refuses when not embedded; origin/source/version/schema guards drop untrusted
  messages; `SAVE_ERROR` preserves edits.
- **Parent blade**: origin + source + version + shape checks before any POST;
  maps HTTP failures to a readable `SAVE_ERROR` message.
- **Laravel**: 422 for invalid/malformed payloads or conversion
  `DomainException`s; 404 for missing template on EDIT; no silent data loss —
  unsupported campaigns/variables/transforms/geometry fail loudly.

## Verification results

- **React** (`eazy-template-editor`): `vitest run` → **17 files / 160 tests**
  pass; ESLint clean; `tsc -b && vite build` succeeds. New tests live in
  `tests/masterSubmit.test.ts` and the extended `tests/EditorHeader.submit.test.tsx`.
- **Laravel** (`eazyweb`): `vendor/bin/phpunit tests/Unit/DynamicPoster/LegacyTemplateAdapterTest.php`
  → **91 tests, 171 assertions** pass (26 new `toLegacyTemplate` tests +
  route-registration test). `php -l` clean on all touched PHP files.
- **Manual regression (STEP 8K)** not run here: requires a live admin login,
  the CloudFront iframe and a real DB. Flows to verify on staging:
  (A) Master CREATE + submit → row appears, editor binds new id;
  (B) Master EDIT + submit → same row updated, update log written;
  (C) upload background → persists as S3 fileName, reloads as full URL;
  (D) submit with invalid metadata / forced error → error banner, edits kept.