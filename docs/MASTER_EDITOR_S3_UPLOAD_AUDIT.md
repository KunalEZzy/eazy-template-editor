# Audit: Master Editor Background Image Upload to S3

Detailed end-to-end audit of how a background image picked in the React Master
editor reaches S3 and how that reference survives persistence in Laravel —
from the React service, through the Laravel controller and the S3/CDN helpers,
to the `poster_template.image` column and its read-back path.

Scope note: this phase deliberately kept the React editor free of CSRF tokens,
Laravel sessions and admin route knowledge (it only ever talks to the trusted
parent via `postMessage`). The S3 **upload** call is the one place the editor
talks to an HTTP endpoint directly; this audit documents exactly how that works
and flags the cross-origin/auth constraints discovered while auditing.

---

## 1. High-level flow

```
 User picks image in BackgroundSection
        │  (file input, accept="image/*")
        ▼
 uploadTemplateImage(file)  ─── src/integration/templateImageUpload.ts
        │  FormData { image: File }
        │  POST {VITE_EDITOR_API_BASE}/marketing/template/upload-image
        │  (no CSRF header, no cookies, no auth header — see §7)
        ▼
 DynamicPosterController::uploadImage()      (admin web route, admin.auth)
        │  $fileName = sha1(date('YmdHis')).'.jpg'
        │  \Image::make($img)   → Intervention Image
        │  Image::upload('eazymedia/dynamic_poster/<file.jpg>', $image)
        ▼
 S3::upload()                                 (Eazydiner\Helpers\S3)
        │  1. saveTemporaryFile()   → local storage/app/eazymedia/dynamic_poster/<file>
        │  2. Storage::get()        → read local content
        │  3. Storage::disk('s3')->put(...,'public')  → bucket eazyweb.eazydiner.com
        │  4. removeTemporaryFile() → delete local temp
        ▼
 response 200 { path: "https://dt4l9bx31tioh.cloudfront.net/eazymedia/dynamic_poster/<file>.jpg",
                fileName: "<file>.jpg" }
        ▼
 React store: setTemporaryBackgroundImage(result.path)
        │  → temporaryBackgroundImageUrl = path
        │  → template.background.imageUrl = path   (full CDN URL)
        │  → isDirty = true, history reset
        ▼
 Persist (Submit/Save): EditorLayout stitches temp URL into the template and the
 STEP-8 submit flow persists it:
        │  LegacyTemplateAdapter::toLegacyTemplate()
        │  image = <fileName extracted from the full URL>   → poster_template.image
        ▼
 Read-back (show/edit): DynamicPosterController::show()
        │  toReactTemplate('dynamic_poster/' . image)  → background.imageUrl (full CDN URL)
        ▼
 Canvas: FabricImage.fromURL(bgUrl, { crossOrigin: 'anonymous' }) scaled to 1200×1600
```

---

## 2. React side in detail

### 2.1 Env config

File: `.env.local` / `.env.production`

| Var | Dev | Production |
| --- | --- | --- |
| `VITE_EDITOR_API_BASE` | `https://api.eazyweb.dev` | `https://usa-inspired-nuts-dod.trycloudflare.com` (Cloudflare tunnel) |
| `VITE_EDITOR_PARENT_ORIGIN` | `https://admin.eazyweb.dev` | `https://admin.eazyweb.dev` |

In `src/integration/templateImageUpload.ts`:

```ts
const API_BASE = import.meta.env.VITE_EDITOR_API_BASE ?? "";
export const UPLOAD_IMAGE_ENDPOINT = "/marketing/template/upload-image";
```

The endpoint is **relative to the API base** and intentionally matches the
Laravel admin route `marketing/template/upload-image` verbatim.

### 2.2 Upload service — `src/integration/templateImageUpload.ts`

Signature:

```ts
export async function uploadTemplateImage(file: File): Promise<TemplateImageUploadResult>
// TemplateImageUploadResult = { path: string; fileName: string }
```

Steps, in order:

1. `new FormData()` and `formData.append("image", file)` — the multipart field
   name is **`image`**, the exact field the legacy Laravel endpoint reads.
2. `fetch(`${API_BASE}${UPLOAD_IMAGE_ENDPOINT}`, { method: "POST", body: formData })`.
   - `Content-Type` is left to the browser (`multipart/form-data; boundary=…`).
   - **No `X-CSRF-TOKEN`, no `Authorization`, no `credentials:`** — the editor
     sends no session/CSRF/auth data (see §7 for the consequence).
3. `fetch` rejects (network/unreachable) → friendly error
   `"Could not reach the server. Check your connection and try again."`
   surfaced as an `Error` with the original HTTP `status` attached.
4. `!response.ok` → `"Image upload failed. Please try again."` (status attached).
5. Unparseable JSON → `"Image upload returned an invalid response."`.
6. Validates the body shape — both `path` and `fileName` must be strings —
   otherwise the same "invalid response" error.
7. Returns `{ path, fileName }`.

`path` is the **full public CDN URL** of the S3 object; `fileName` is the bare
S3 object name. The editor stores `path`; `fileName` is not persisted into the
canonical template (it is derived again on the Laravel side at submit time).

### 2.3 UI — `src/components/properties/BackgroundSection.tsx`

- Hidden `<input type="file" accept="image/*">`; the "Upload Image"/"Change
  Image" button triggers it.
- Type guard: `file.type.startsWith("image/")` else `role="alert"` error
  "Please choose an image file." and the input is cleared.
- Sets `uploadStatus.uploading = true`, calls `uploadTemplateImage(file)`.
- **On success** → `setTemporaryBackgroundImage(result.path)` (only on
  success — a failed upload never mutates the template).
- `finally` clears the file input value so the *same file* can be re-selected,
  and resets `uploading`.
- Display: `currentBackgroundUrl = temporaryBackgroundImageUrl ?? template.background.imageUrl`;
  an "Unsaved background (1200 × 1600)" chip renders while a temporary
  background is active.
- "Remove" clears the temporary background (`setTemporaryBackgroundImage(null)`).

### 2.4 Store — `editorStore.setTemporaryBackgroundImage(imageUrl, dimensions?)`

This is the single mutation triggered by a successful upload. It:

- sets `temporaryBackgroundImageUrl = imageUrl`;
- sets `template.background.imageUrl = imageUrl ?? previous` (the canonical
  template now carries the full CDN URL immediately — no second step);
- resets undo/redo history (`past: [], future: []`) so the upload becomes the
  new history baseline;
- bumps `templateLoadVersion`, clears `selectedBoxId`, marks `isDirty = true`,
  touches `updatedAt`.

`dimensions` is not passed by the upload path, so **canvas dimensions stay
1200 × 1600** — the upload never changes the document size.

### 2.5 Canvas rendering — `src/canvas/CanvasEditor.tsx`

On (re)render the background URL is resolved as
`temporaryBackgroundImageUrl ?? template.background.imageUrl`, then loaded with:

```ts
const image = await FabricImage.fromURL(bgUrl, { crossOrigin: "anonymous" });
image.set({
  left: 0, top: 0,
  scaleX: documentWidth / iw, scaleY: documentHeight / ih, // cover-fill 1200×1600
  selectable: false, evented: false,
});
```

It is scaled to fill the 1200 × 1600 document regardless of source pixel size.

---

## 3. Laravel side in detail

### 3.1 Route

`routes/admin.php` (inside `admin.auth`, itself inside the `web` group):

```php
Route::post('marketing/template/upload-image', 'Admin\DynamicPosterController@uploadImage');
```

Middleware stack that actually runs for this URI:
`web` group = maintenance → EncryptCookies → AddQueuedCookies → StartSession →
ShareErrorsFromSession → **VerifyCsrfToken** → SubstituteBindings → **Api\EnableCors**
(bundle verbose), then **admin.auth** (custom admin-session authenticator).

### 3.2 Controller — `DynamicPosterController::uploadImage()`

```php
public function uploadImage(Request $request)
{
    $img = $request->image;                                   // UploadedFile
    $image = App::make(Image::class);
    $fileName = sha1(date('YmdHis')) . '.jpg';               // timestamp+sha1 name
    $filePath = 'eazymedia/dynamic_poster/' . $fileName;
    $image->upload($filePath, \Image::make($img));           // Intervention Image
    return response()->json([
        'path'     => IMG::getImageSrc("dynamic_poster/" . $fileName, false, false),
        'fileName' => $fileName,
    ], 200);
}
```

- Reads the multipart field `image` (matches the React FormData field).
- `\Image::make($img)` decodes the uploaded bytes with **Intervention Image**.
- Upload path is always `eazymedia/dynamic_poster/<file>.jpg` on S3.
- Returns **both** the full CDN URL (`path`) and the bare name (`fileName`) —
  exactly what `uploadTemplateImage` consumes.

### 3.3 Upload helper — `Eazydiner\Helpers\Image::upload()` → `S3::upload()`

`Image::upload($filePath, $file)` delegates to `App::make(S3::class)->upload($filePath, $file)`.

`S3::upload()` does a local-file round-trip:

```php
public function upload($filePath, $file)
{
    $this->saveTemporaryFile($filePath, $file);      // 1. write local storage_path('app')/eazymedia/dynamic_poster/<file>
    $content = Storage::get($filePath);              // 2. read it back locally
    $result = Storage::disk('s3')->put($filePath, $content, 'public'); // 3. PUT S3, public read
    $this->removeTemporaryFile($filePath);           // 4. delete local temp
    return $result;
}
```

1. `saveTemporaryFile()` — `Storage::makeDirectory('eazymedia/dynamic_poster')`,
   then `$temporaryFile->save(storage_path('app') . $filePath)`.
2. Read the local temp content (`Storage::get` on the default local disk).
3. `Storage::disk('s3')->put(...)` — streams the bytes to S3 with
   **`public` visibility**.
4. `removeTemporaryFile()` — `Storage::delete(...)` cleans the local temp file.

### 3.4 S3 disk config — `config/filesystems.php`

```php
's3' => [
    'driver' => 's3',
    'key'    => env('AWS_KEY', 'AKIA…'),     // env AWS_KEY (has hard-coded fallback)
    'secret' => env('AWS_SECRET', '…'),      // env AWS_SECRET (fallback)
    'region' => env('AWS_REGION', 'us-west-2'),
    'bucket' => env('AWS_BUCKET', 'eazyweb.eazydiner.com'),
],
```

### 3.5 CDN URL builder — `Eazydiner\Helpers\ImageBuilder::getImageSrc()`

```php
$imgPath = 'eazymedia/' . $path;                     // no resize params
$domain  = config('constants.S3_CDN_BASE_URL',
                  "https://dt4l9bx31tioh.cloudfront.net/");
return $domain . $imgPath;
```

So `getImageSrc('dynamic_poster/abc123.jpg', false, false)`
→ `https://dt4l9bx31tioh.cloudfront.net/eazymedia/dynamic_poster/abc123.jpg`.
This is the **`path`** the editor stores and the CDN URL used for display.

### 3.6 Persistence & read-back of the image reference

- `poster_template.image` column stores only the **fileName** (e.g.
  `abc123.jpg`), not the URL.
- **Write (STEP-8 submit flow):**
  `LegacyTemplateAdapter::toLegacyTemplate($reactTemplate)` extracts the fileName
  from the full `background.imageUrl` (`parse_url`→`basename`, strips query),
  and the `DynamicPosterController::submitFromEditor()` path persists it —
  mirroring what the legacy `create_template.js` form posts (`image: data.fileName`).
- **Read (edit):** `DynamicPosterController::show()` →
  `LegacyTemplateAdapter::toReactTemplate()` builds
  `background.imageUrl = imageUrlBuilder('dynamic_poster/' . image)` and the view
  also exposes `$template->imagePath = IMG::getImageSrc('dynamic_poster/' . $template->image, ...)`.
  The editor therefore always reloads the full CDN URL from a bare fileName.
- **Grid/listing:** `getTemplateGrid()` renders the thumbnail by the same
  `IMG::getImageSrc('dynamic_poster/' . $imgName, 100, 100)` builder (requests a
  100×100 rendition through the CDN query API).

### 3.7 Legacy reference flow (same endpoint, for comparison)

`public/admin/js/restaurant/create_template.js::uploadImage()` posts the same
multipart field `image`, but **sends `X-CSRF-TOKEN` from the Blade
`<meta name="csrf-token">`**, and stores `data.fileName` into a hidden input and
`data.path` into the preview `<img>`. On next save, that `.fileName` is posted
as the template `image`. This is the security-contract difference from the
React editor (see §7).

---

## 4. End-to-end scenarios

### A. Upload (Master editor)

1. User selects an image file → `BackgroundSection.handleFileChange`.
2. `uploadTemplateImage(file)` → `POST <API_BASE>/marketing/template/upload-image`, `FormData{image}`.
3. Laravel `uploadImage()` → Intervention decode → `S3::upload`
   (local temp → `Storage::disk('s3')->put(..., 'public')` → local cleanup)
   → `200 { path, fileName }`.
4. `setTemporaryBackgroundImage(path)` → store + canvas + properties panel all
   reflect the new background; `isDirty`, history reset.
5. **Persistence:** user clicks Submit → parent Blade → `submitFromEditor()` →
   `toLegacyTemplate()` extracts `fileName` from `path` → repo `create()/update()`
   writes `poster_template.image = <fileName>`.
6. Parent relays `SAVE_SUCCESS` with the normalized template → React hydrates.

### B. Reload an existing template with an image

1. Admin opens template → `show()` loads row, decodes boxes,
   `toReactTemplate()` → `background.imageUrl` = CDN URL.
2. `EDITOR_INIT` carries the template → store hydrates.
3. Canvas loads the URL with `FabricImage.fromURL(..., {crossOrigin:'anonymous'})`
   and cover-scales it to 1200 × 1600.

---

## 5. Error handling

| Layer | Failure | Behavior |
| --- | --- | --- |
| React service | network unreachable | Error "Could not reach the server…", status attached |
| React service | HTTP error (`!response.ok`) | Error "Image upload failed. Please try again." |
| React service | non-JSON / missing `path`+`fileName` | Error "Image upload returned an invalid response." |
| React UI | non-image file type | `role="alert"` "Please choose an image file." |
| React UI | upload failure | `role="alert"` shows the message; template untouched |
| Laravel | invalid/missing `image` | Intervention/S3 throws → generic 500 (no bespoke handler) |
| S3 | put fails | exception propagates → 500; React maps to "Image upload failed" |
| Persist | empty background (CREATE) | editor path allows it; `image` stored as `''` |

---

## 6. Security & auth analysis (findings)

1. **CSRF — React sends none, the endpoint requires one.** The route runs under
   `web` → `VerifyCsrfToken`. The legacy JS posts `X-CSRF-TOKEN`; the React
   `uploadTemplateImage` sends **no CSRF token**. On a same-origin configuration
   where the API base serves the admin app's own session cookie, this request
   would be rejected with `419` unless the route is CSRF-exempted — it is not in
   the `VerifyCsrfToken::$except` list (`image/upload` is, `marketing/template/upload-image` is not).

2. **CORS — the editor origin is not allowed on this endpoint.** The `web`
   group's `Api\EnableCors` allows only `*.eazydiner.com` origins; the dedicated
   `Editor\EnableEditorCors` (which *does* allow the CloudFront editor origin
   `https://dtw7ku4n4d0j3.cloudfront.net`) is registered only on the **editor API
   routes** (`routes/api.php`, `methods GET, OPTIONS`), not on `upload-image`.
   The editor sits on the CloudFront origin, so the browser will send the
   multipart POST (a CORS-safelisted "simple" request — no preflight), but the
   response will not carry `Access-Control-Allow-Origin` for the editor origin,
   so **the browser will block reading the JSON/cross-origin result**.

3. **Consequence.** In the **current wiring**, a truly cross-origin Master-editor
   upload to the live admin endpoint will very likely fail (CSRF 419 and/or CORS
   block), unless the deployment serves both the editor and the API under one
   same-origin setup (e.g. the dev Cloudflare tunnel proxying both to localhost,
   where no cross-origin browser policy applies). This is a **known integration
   gap**, not an implementation bug in isolation — the phase scope stipulated the
   React editor must not carry CSRF/session knowledge. Reconciliation options
   (for a later phase, not applied here):
   - relay the upload through the trusted Blade parent (same as SAVE_REQUEST does),
   - apply `editor.cors` + a token/session exemption to this route, or
   - run the upload against the `editor.token`-protected editor API.

4. **Filename predictability.** `uploadImage` derives `$fileName = sha1(date('YmdHis')).'.jpg'`.
   Two uploads within the same second produce the **same** name; the second
   silently overwrites the first on S3. Low collision likelihood but worth noting.

5. **Hard-coded AWS fallback keys** in `config/filesystems.php` and the anonymous
   `public` S3 visibility are pre-existing legacy concerns; not changed in this phase.

6. **Origin trust model** on the React side remains sound: `SAVE_REQUEST`/responses
   are exchange-gated on `PARENT_ORIGIN` + `event.source === window.parent` + version
   + schema; the upload is the only direct HTTP call and carries no secrets.

---

## 7. File roles summary

**React project (`eazy-template-editor`)**

| File | Role |
| --- | --- |
| `src/integration/templateImageUpload.ts` | Endpoint constant, typed `{path, fileName}` result, clean HTTP/network/shape errors |
| `src/components/properties/BackgroundSection.tsx` | File picker, type guard, uploading state, success → `setTemporaryBackgroundImage(path)`, `role="alert"` errors, "Unsaved background" chip |
| `src/store/editorStore.ts` | `temporaryBackgroundImageUrl`, `template.background.imageUrl`, `isDirty`, history reset, load-version bump |
| `src/canvas/CanvasEditor.tsx` | `FabricImage.fromURL(temp ?? saved, {crossOrigin})` cover-scaled to 1200×1600 |
| `src/components/layout/EditorLayout.tsx` | Stitches temporary background into the template for Save/Submit |
| `.env.local` / `.env.production` | `VITE_EDITOR_API_BASE`, `VITE_EDITOR_PARENT_ORIGIN` |
| `tests/templateImageUpload.test.ts`, `tests/BackgroundSection.upload.test.tsx` | Service + UI coverage |

**Laravel project (`eazyweb`)**

| File | Role |
| --- | --- |
| `routes/admin.php` | `POST marketing/template/upload-image` (admin.auth + web group) |
| `app/Http/Controllers/Admin/DynamicPosterController.php` | `uploadImage()` (naming, Intervention write, response `path`+`fileName`); `show()`/`getTemplateGrid()` read-back |
| `app/Helpers/Image.php` | `upload()` façade → S3 |
| `app/Helpers/S3.php` | local-temp → `Storage::disk('s3')->put(...,'public')` → local cleanup |
| `app/Helpers/ImageBuilder.php` | `getImageSrc()` CDN URL construction |
| `config/filesystems.php`, `config/constants.php` | S3 disk (bucket/key/region), `S3_CDN_BASE_URL` |
| `app/Services/DynamicPoster/LegacyTemplateAdapter.php` | submit-time `imageFileName()` extraction; read-back URL build |
| `public/admin/js/restaurant/create_template.js` | Legacy comparison flow (posts CSRF + stores `fileName`) |

---

## 8. Testing coverage

- `tests/templateImageUpload.test.ts` — mocks fetch: happy path returning
  `{path, fileName}`, HTTP errors, network errors, invalid JSON, missing fields.
- `tests/BackgroundSection.upload.test.tsx` — image applied only on success,
  uploading state, error `role="alert"`, non-image rejection, Remove clears.
- Laravel: `LegacyTemplateAdapterTest` covers `imageFileName()` extraction
  (full URL, no prefix, resized URL with query, bare filename, empty background).
- **Not covered / manual:** a real S3 put (network), and the cross-origin
  production upload (see §6 — requires the deployment-context resolution).

---

## 9. Conclusion

The S3 upload path is correctly structured on both sides and internally
consistent: the editor uploads a file and stores the returned CDN URL; Laravel
names, uploads (`public`) and serves it over CloudFront; persistence stores only
the bare fileName; reload rebuilds the full URL. The single outstanding item is
the **deployment-level auth/CORS contract** for the direct editor→endpoint
upload (§6), which is fine when the editor and API share an origin (current dev
tunnel) but will need the parent-relay or editor-CORS+token middleware before a
cross-origin production deployment of the Master editor relies on it.