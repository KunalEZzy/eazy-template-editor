# Eazy Template Editor — Production Readiness Context

## Purpose and scope

This React/Vite editor replaces the Laravel Admin **Dynamic Poster** UI without
changing the legacy template database format or its existing consumers.

Two repositories are involved:

- React editor (this repository): `/home/eazydiner/eazy-template-editor`
- Laravel Admin: `/home/eazydiner/eazyweb`

The deployed React editor is `https://dtw7ku4n4d0j3.cloudfront.net`.

The compatibility boundary is deliberately:

```text
Laravel poster_template -> LegacyTemplateAdapter -> React canonical Template
  -> iframe EDITOR_INIT -> React editor
```

Do **not** migrate legacy records or replace the Laravel persistence/S3 model.
Existing legacy templates and restaurant/banner consumers must continue to work.

## Confirmed integration state

- Laravel can load an existing poster template (example: ID `104`) and adapt it
  with `LegacyTemplateAdapter::toReactTemplate()`.
- The Laravel Blade parent and React iframe handshake works: React sends
  `EDITOR_READY`; Laravel responds with `EDITOR_INIT` containing the template.
- In master edit, the legacy template is visible in React. Do not diagnose the
  basic handshake as broken.
- The precise Laravel implementation has **not yet been audited** in this
  repository. Verify controllers, Blade, adapter, upload, S3, routes, and tests
  in `/home/eazydiner/eazyweb` before changing those areas.

## Non-negotiable architecture

- `src/components`: UI only.
- `src/canvas`: Fabric lifecycle and domain-to-Fabric conversion.
- `src/store`: Zustand runtime state/actions.
- `src/domain`: canonical models, validation, pure logic, variable definitions.
- `src/repository`: persistence abstraction.
- `src/editor`: orchestration.
- `App.tsx`: thin mode/bootstrap selection.

Keep logical **document space** separate from responsive **display space**:

- Canonical `settings.canvasWidth`/`canvasHeight`, geometry, typography, and
  Fabric coordinates are document space.
- The embedded editor must scale a fixed document canvas to its available
  viewport with CSS. Resizing the iframe/layout must not rewrite coordinates or
  document dimensions.
- PNG/PDF export must use document dimensions, never displayed/zoomed dimensions.

## React facts verified in the current working tree

### Canonical model and state

- `Template` is in `src/domain/template/template.types.ts`; it has identity,
  campaign, `background.imageUrl`, `boxes`, logical canvas settings, active flag,
  version, and timestamps.
- The Zustand store starts with `template: null` and `previewData: null`.
- `previewData` is runtime preview input, not template definition. Variables and
  static/custom text must remain distinct.
- The standalone fallback is `mockTemplate` plus `mockPreviewData` in `App.tsx`.
  It is appropriate only for standalone/demo behavior, never master create/edit.

### Modes and bootstrap

- `src/integration/masterBootstrap.ts` sends `EDITOR_READY` only when framed,
  validates `EDITOR_INIT`, checks `VITE_EDITOR_PARENT_ORIGIN` and parent window,
  then hydrates the store.
- Current protocol in `src/integration/editorProtocol.ts` requires a non-null
  `payload.template`; consequently **blank master create is not yet represented
  by the protocol** and needs a deliberate design.
- `App.tsx` skips standalone bootstrap when framed. `useEditorToken.ts` also
  returns when framed, so restaurant token loading does not collide with master
  bootstrap.
- Standalone token mode currently loads `mockTemplate` plus real restaurant
  preview data. This is separate from master mode.

### Canvas, variables, export, upload

- `EditorLayout` calculates a responsive display size using
  `calculateCanvasDisplaySize`; `CanvasEditor` owns the logical Fabric canvas.
- Background upload currently reads the image locally as a data URL and updates
  logical canvas dimensions from its natural size. Save currently uses
  `LocalTemplateRepository`; it is **not yet Laravel/S3 production upload**.
- `CanvasEditor` contains PNG and PDF behavior; verify both use logical canvas
  dimensions with tests before declaring export production-ready.
- `previewResolver` now receives nullable preview data and returns the variable
  name if data is absent. This supports displaying a variable representation in
  master mode rather than mock restaurant values.

## Existing uncommitted work — preserve and review

There are user-owned, uncommitted changes in `src/App.tsx`, `src/canvas`,
`src/components`, `src/domain/variables`, `src/hooks/useEditorToken.ts`, plus
new `src/integration/` files and a preview-resolver test. Treat them as current
work in progress. Inspect the diff before editing overlapping files; do not
reset, discard, or silently replace them.

## Production requirements and acceptance criteria

1. **Master create is blank:** no mock background, boxes, QR, variables, or
   restaurant preview values. Loading, empty, and invalid/error states are
   distinguishable.
2. **Embedded responsiveness:** the canvas fits Laravel Admin's iframe/center
   workspace while its logical dimensions and Fabric coordinates remain stable.
3. **Variable picker:** only canonical supported variable names are offered.
4. **No mock-value leakage:** a variable such as `resNameNL` displays as its
   variable representation without preview data; static/custom text stays exact.
5. **Export fidelity:** PNG and PDF preserve the logical width, height, and
   aspect ratio independently of viewport size, iframe size, or display scale.
6. **Upload compatibility:** React uploads through Laravel's authenticated
   upload endpoint and existing S3/storage conventions. Do not put S3 credentials
   in React or introduce a second storage/path model.

## Safe execution order

1. Perform the cross-repository, read-only audit first. Trace Laravel
   `DynamicPosterController` (`create`, `show`, `store`, `update`, `uploadImage`),
   `details.blade.php`, `LegacyTemplateAdapter`, models/repositories, old
   `create_template.js`, routes, S3 settings, and consumers. Record only observed
   behavior; label gaps `UNKNOWN — NEEDS VERIFICATION`.
2. Define and test an explicit master-create protocol/state. Decide whether the
   parent sends `template: null` or a canonical empty template; update both
   contract ends atomically. Do not fall back to mock data in a framed editor.
3. Complete variable-definition/preview separation and test with and without
   preview data.
4. Validate responsive layout in a Laravel-sized iframe; only adjust display
   wrappers/scaling if needed, not document coordinates.
5. Test PNG and PDF pixel/page dimensions against non-default templates.
6. Implement React-to-Laravel upload/save integration using the proven Laravel
   endpoint and S3 response shape. Test authentication, failure handling, and
   saved legacy-template compatibility.
7. Run regression tests across create, edit, standalone, restaurant-token,
   legacy-load, upload, export, and existing consumers. Retire legacy UI only
   after the replacement flow is proven.

## Required verification before a production claim

- Run `npm test`, `npm run lint`, and `npm run build` in this repository.
- Add/maintain tests for protocol validation and origin/source checks; blank
  master create; variable rendering without preview data; display-size math;
  PNG/PDF logical dimensions; and upload error/success behavior.
- In Laravel, add/confirm adapter/controller/upload tests and manually test an
  existing legacy template, blank create, S3 upload, save/reload, and downstream
  restaurant/banner rendering.
- Keep origin allowlisting strict. Reject messages from an unexpected origin or
  source. Never trust a client-provided restaurant identity without Laravel-side
  authorization.

## Instructions for the next implementation agent

Read this file, inspect the current git diff, then audit both repositories before
writing code. Prefer small, test-backed changes. Do not perform unrelated
refactors, database migrations, storage redesigns, S3 credential changes, or
legacy cleanup until compatibility is demonstrated.
