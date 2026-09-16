# Eazy Template Editor: Architecture & Workflow Guide

An in-depth architectural guide explaining how the dynamic canvas system, coordinate separation, state synchronization, background image handling, and export pipelines were designed and implemented.

---

## Table of Contents
1. [Core Architectural Philosophy](#1-core-architectural-philosophy)
2. [Problems Identified & Root Causes](#2-problems-identified--root-causes)
3. [System Architecture & Visual Model](#3-system-architecture--visual-model)
4. [File-by-File Breakdown & Code Tour](#4-file-by-file-breakdown--code-tour)
5. [End-to-End Workflow Tracing](#5-end-to-end-workflow-tracing)
   - [A. Browser / Workspace Resize Lifecycle](#a-browser--workspace-resize-lifecycle)
   - [B. Background Upload & Dynamic Resolution Adaptation](#b-background-upload--dynamic-resolution-adaptation)
   - [C. Bidirectional Selection Synchronization](#c-bidirectional-selection-synchronization)
   - [D. Box Drag / Resize / Modify Pipeline](#d-box-drag--resize--modify-pipeline)
   - [E. High-Resolution 1:1 Export Pipeline](#e-high-resolution-11-export-pipeline)
   - [F. Undo / Redo Snapshot Mechanism](#f-undo--redo-snapshot-mechanism)
6. [Fabric.js 7.4 Type Safety & Custom Data](#6-fabricjs-74-type-safety--custom-data)
7. [Extensibility Guide: Adding New Element Types](#7-extensibility-guide-adding-new-element-types)

---

## 1. Core Architectural Philosophy

### The Two Coordinate Systems
The most critical design principle in this template editor is the strict separation between **Document Space** and **Display Space**.

```
+-------------------------------------------------------------------------------+
| DOCUMENT SPACE (Canonical Source of Truth)                                    |
| Dimensions: template.settings.canvasWidth x canvasHeight (e.g., 1200 x 1600)  |
| - Fabric Canvas internal size: 1200 x 1600                                    |
| - Template Box positions: % of 1200 x 1600 (e.g., x: 10% = 120px)            |
| - Typography & Font sizes: Document pixels (e.g., 48px)                       |
| - QR code resolution: Document pixels (e.g., 360 x 360)                       |
| - Background Image: Document bounds [0, 0] to [1200, 1600]                    |
| - Stored JSON & Exports: 100% full original resolution                        |
+-------------------------------------------------------------------------------+
                                      |
                                      | Scaled via CSS transform: scale(s)
                                      v
+-------------------------------------------------------------------------------+
| DISPLAY SPACE (Purely Visual / Presentation Layer)                            |
| Dimensions: displayWidth x displayHeight (e.g., 600 x 800, scale = 0.5)       |
| - Display Viewport wrapper: 600 x 800 (overflow: hidden)                      |
| - Scaled Document container: 1200 x 1600 with transform: scale(0.5)           |
| - Changes with browser window resizing                                        |
| - NEVER mutates template data, box coordinates, or font sizes                 |
+-------------------------------------------------------------------------------+
```

### Why Option B (Fixed Document + CSS Scale) Was Chosen
- **Option A (Dynamic Fabric Resizing)**: Disposing or recalculating all Fabric objects and canvas dimensions on every single browser window resize event. This caused canvas destruction, destroyed active selections, reloaded images, and created severe ResizeObserver feedback loops.
- **Option B (Fixed Document + CSS Scaling)**: The Fabric canvas is created **once** with document dimensions. Visual scaling is achieved purely through an outer DOM container using CSS `transform: scale(scale)` and `transform-origin: top left`. Fabric handles mouse interactions automatically by mapping visual client coordinates back to internal canvas coordinates.

---

## 2. Problems Identified & Root Causes

### Problem 1: Scale Jitter & Canvas Re-instantiation on Resize
- **Root Cause**: `EditorLayout.tsx` passed visual `width` and `height` props down to `CanvasEditor.tsx`. In `CanvasEditor.tsx`, a `useEffect([width, height])` hook disposed and recreated `new Canvas(...)` whenever the window resized by even 1 pixel. Furthermore, catch-all transitions (`transition: all 0.2s`) on measured DOM elements caused `ResizeObserver` to trigger on every animation frame, generating infinite layout loops.
- **Solution**: Decoupled `CanvasEditor` from visual display dimensions. Measured available workspace through an isolated inner container, removed catch-all transitions, and applied visual scaling exclusively via CSS on the parent container.

### Problem 2: Background Image Cropping & Visual Shift
- **Root Cause**: In `CanvasEditor.tsx`, background sizing used `scale = Math.max(scaleX, scaleY)` (CSS `cover` equivalent). When an uploaded background had a different aspect ratio than the default template, the image was magnified and its right/bottom sides were cut off.
- **Solution**:
  1. On background image upload, `BackgroundSection.tsx` inspects the image's `naturalWidth` and `naturalHeight` and updates `template.settings.canvasWidth` and `template.settings.canvasHeight` dynamically.
  2. `CanvasEditor.tsx` maps background scale directly to logical document bounds (`scaleX = documentWidth / imageWidth`, `scaleY = documentHeight / imageHeight`) with `left: 0, top: 0, originX: 'left', originY: 'top'`, guaranteeing 100% visibility without cropping.

### Problem 3: Selection Desynchronization
- **Root Cause**: `CanvasEditor.tsx` listened to Fabric canvas selection events (`selection:created`, etc.), but lacked a reactive effect syncing `selectedBoxId` changes from the Zustand store (e.g. when a user clicks a layer in `LeftSidebar.tsx`) back to `canvas.setActiveObject(...)`.
- **Solution**: Implemented bidirectional selection synchronization with loop protection guards (`if (currentActiveBoxId === selectedBoxId) return;`).

---

## 3. System Architecture & Visual Model

```
+----------------------------------------------------------------------------------------------------+
|                                           EditorLayout                                             |
|                                                                                                    |
|  +----------------------+  +--------------------------------------------+  +--------------------+  |
|  |     LeftSidebar      |  |                   <main>                   |  |    RightSidebar    |  |
|  |                      |  |                                            |  |                    |  |
|  |  +----------------+  |  |  +--------------------------------------+  |  |  +---------------+ |  |
|  |  |  LayersPanel   |  |  |  |      Workspace Measurement Ref       |  |  |  |  Properties   | |  |
|  |  +-------+--------+  |  |  |      (Observed by ResizeObserver)    |  |  |  |     Panel     | |  |
|  |          |           |  |  +------------------+-------------------+  |  |  +-------+-------+ |  |
|  |          |           |  |                     |                      |  |          ^         |  |
|  |  +-------+--------+  |  |                     v                      |  |  +-------+-------+ |  |
|  |  | VariablePicker |  |  |        calculateCanvasDisplaySize()        |  |  | GeometrySec.  | |  |
|  |  +----------------+  |  |                     |                      |  |  | TypographySec.| |  |
|  |                      |  |                     v                      |  |  | QRProperties  | |  |
|  +----------|-----------+  |  +--------------------------------------+  |  |  | BackgroundSec.| |  |
|             |              |  |           DISPLAY VIEWPORT           |  |  +----------|---------+  |
|             |              |  |   width = displayWidth               |  |             ^            |
|             |              |  |   height = displayHeight             |  |             |            |
|             |              |  |   overflow = hidden                  |  |             |            |
|             |              |  |  +--------------------------------+  |  |             |            |
|             |              |  |  |    DOCUMENT SCALE CONTAINER    |  |  |             |            |
|             |              |  |  | width = documentWidth          |  |  |             |            |
|             |              |  |  | height = documentHeight        |  |  |             |            |
|             |              |  |  | transform = scale(scale)       |  |  |             |            |
|             |              |  |  |  +--------------------------+  |  |  |             |            |
|             |              |  |  |  |       CanvasEditor       |  |  |  |             |            |
|             |              |  |  |  |  +--------------------+  |  |  |  |             |            |
|             |              |  |  |  |  |   Fabric Canvas    |  |  |  |  |             |            |
|             |              |  |  |  |  |  (documentWidth x  |  |  |  |  |             |            |
|             |              |  |  |  |  |   documentHeight)  |  |  |  |  |             |            |
|             |              |  |  |  |  +----------+---------+  |  |  |  |             |            |
|             |              |  |  |  +-------------|------------+  |  |  |             |            |
|             |              |  |  +----------------|---------------+  |  |             |            |
|             |              |  +-------------------|------------------+  |             |            |
|             |              +----------------------|---------------------+             |            |
|             |                                     |                                   |            |
|             +----------------------------> Zustand Store <----------------------------+            |
|                                           (useEditorStore)                                         |
|                                           - template                                               |
|                                           - selectedBoxId                                          |
|                                           - temporaryBackgroundImageUrl                            |
|                                           - selectBox()                                            |
|                                           - updateBoxTransform()                                   |
|                                           - updateTextBox() / updateQRBox()                        |
|                                           - setTemporaryBackgroundImage()                          |
|                                           - undo() / redo()                                        |
+----------------------------------------------------------------------------------------------------+
```

---

## 4. File-by-File Breakdown & Code Tour

### 1. `src/utils/canvasDimensions.ts`
- **Purpose**: Pure mathematical calculation of visual display dimensions and scale factor while strictly preserving aspect ratio.
- **Key Function**: `calculateCanvasDisplaySize({ documentWidth, documentHeight, availableWidth, availableHeight })`
  - Calculates `scaleX = availableWidth / documentWidth` and `scaleY = availableHeight / documentHeight`.
  - Determines the limiting dimension using `scale = Math.min(scaleX, scaleY)`.
  - Returns `{ width: Math.round(documentWidth * scale), height: Math.round(documentHeight * scale), scale }`.

### 2. `src/components/layout/EditorLayout.tsx`
- **Purpose**: The main application shell managing layout orchestration, theme switching, keyboard shortcuts, workspace measurement, and DOM scaling wrappers.
- **Key Sections**:
  - `workspaceRef`: Attached to an inner container with `flex: 1`, `minWidth: 0`, `minHeight: 0`, and `padding: 32px`.
  - `ResizeObserver`: Observes `workspaceRef` and reads `entry.contentRect` (which naturally excludes padding), avoiding any double-padding subtraction.
  - `Display Viewport`: Sized to `canvasDisplaySize.width` and `canvasDisplaySize.height` with `position: relative` and `overflow: hidden`.
  - `Document Scale Container`: Sized to `template.settings.canvasWidth` and `template.settings.canvasHeight` with `transform: scale(${canvasDisplaySize.scale})` and `transformOrigin: "top left"`.
  - `handleSave`: Commits any temporary background image into `template.background.imageUrl` and invokes `editorService.saveTemplate()`.

### 3. `src/canvas/CanvasEditor.tsx`
- **Purpose**: Fabric.js lifecycle manager and event bridge between the imperative Fabric canvas and the reactive Zustand state.
- **Key Sections**:
  - **1. Canvas Lifecycle**: Creates `new Canvas(...)` with `width: documentWidth` and `height: documentHeight`. Recreated **only** if template document settings change (e.g. after a background upload of different dimensions), never during window resizing.
  - **2. Full Template Render**: Runs on initial load or undo/redo (`templateLoadVersion`). Clears template objects (preserving background), creates Text and QR Fabric objects via `CanvasAdapter`, and sets z-indices.
  - **3. Background Image Effect**: Loads image via `FabricImage.fromURL()`, scales it exactly to `[documentWidth, documentHeight]` using `scaleX = documentWidth / imageWidth` and `scaleY = documentHeight / imageHeight`, sets `originX: 'left', originY: 'top', left: 0, top: 0`, and places it at index `0`.
  - **4. Incremental Reconcile Effect**: Subscribes to `template` changes. Updates existing Fabric objects in-place (`set()`, `setCoords()`, `renderAll()`) without tearing down the canvas. Regenerates QR preview if QR properties change.
  - **5. Bidirectional Selection**:
    - `Canvas -> Store`: Listens to `selection:created`, `selection:updated`, `selection:cleared` and calls `selectBox(boxId)`.
    - `Store -> Canvas`: Subscribes to `selectedBoxId` from Zustand and calls `canvas.setActiveObject(targetObject)`.
  - **6. Object Modification Handler**: Listens to `object:modified`. Converts Fabric pixel coordinates (`object.left`, `object.top`, `object.width * scaleX`) to document percentage values using `pixelsToPercentage(..., docWidth)` and dispatches `updateBoxTransform()`.
  - **7. Export Handler**: Listens to `eazy:export-canvas`. Temporarily deselects active objects and calls `canvas.toDataURL({ format: "png", multiplier: 1 })` to produce a 100% original-resolution download.

### 4. `src/canvas/CanvasAdapter.tsx`
- **Purpose**: Conversion layer between domain entities (`TextBox`, `QRBox`) and Fabric.js objects (`Textbox`, `FabricImage`).
- **Key Functions**:
  - `percentageToPixels(percentage, totalPixels)`: Converts domain percentage (`0-100`) to document pixels.
  - `pixelsToPercentage(pixels, totalPixels)`: Converts document pixels back to domain percentage.
  - `textBoxToFabric(box, previewData, canvasSize)`: Instantiates a Fabric `Textbox` with resolved variable text, custom font settings, and attaches `data: { boxId: box.id }`.
  - `qrBoxToFabric(box, previewData, canvasSize)`: Generates QR data URL asynchronously via `generateQRPreview()`, instantiates a `FabricImage`, sets dimensions and scale, and attaches `data: { boxId: box.id, ... }`.
  - `FabricCustomData`: Strongly-typed interface for all custom metadata stored in `object.get("data")`.

### 5. `src/store/editorStore.ts` & `src/store/editor.actions.ts`
- **Purpose**: Centralized Zustand store holding the template state, active selection, undo/redo history, and action dispatchers.
- **Key State & Actions**:
  - `template`: The active `Template` domain entity.
  - `selectedBoxId`: ID of the currently selected element (`null` if none).
  - `temporaryBackgroundImageUrl`: Holds the object URL of an unsaved background image.
  - `setTemporaryBackgroundImage(imageUrl, dimensions)`: Updates the background preview URL and dynamically updates `template.settings.canvasWidth` and `canvasHeight` if new dimensions are provided.
  - `updateBoxTransform(boxId, changes)`: Mutates box geometry in percentage values and flags `isDirty: true`.
  - `undo()` / `redo()`: Restores previous/future template snapshots and increments `templateLoadVersion`.

### 6. `src/components/properties/BackgroundSection.tsx`
- **Purpose**: UI panel for previewing, uploading, and removing background images.
- **Key Functionality**:
  - `handleFileChange`: Creates an object URL for the uploaded file, loads an off-screen `new window.Image()`, extracts `img.naturalWidth` and `img.naturalHeight`, and passes them to `setTemporaryBackgroundImage(objectUrl, { width, height })`.

### 7. `src/components/properties/PropertyInput.tsx`
- **Purpose**: Controlled numeric and text input components for editing box properties in the right sidebar.
- **Key Pattern**: Uses React's recommended state-adjustment during render pattern (`if (prevValue !== value) { setPrevValue(value); setLocalVal(formatted); }`), completely eliminating `useEffect`-based cascading render warnings.

### 8. `src/components/layout/EditorHeader.tsx`
- **Purpose**: Top navigation header displaying template metadata, active document resolution (`W × H px`), live dirty badge, theme toggle, and action buttons.
- **Key Functionality**: Includes the **Download PNG** button which dispatches the `eazy:export-canvas` event.

---

## 5. End-to-End Workflow Tracing

### A. Browser / Workspace Resize Lifecycle

```
[Browser Window Resizes]
           │
           ▼
[<main> layout bounds change]
           │
           ▼
[ResizeObserver fires on workspaceRef]
           │
           ▼
[extract entry.contentRect.width & height (excluding padding)]
           │
           ▼
[setAvailableWorkspace updates state (if integer size changed)]
           │
           ▼
[calculateCanvasDisplaySize(docW, docH, availW, availH)]
           │
           ▼
[React re-renders EditorLayout]
  ├── Display Viewport: style.width = displayWidth, style.height = displayHeight
  └── Document Scale Container: style.transform = scale(scale)
           │
           ▼
[Fabric Canvas: UNTOUCHED & ALIVE]
  - Internal dimensions remain 1200 x 1600
  - All objects, coordinates, selections, and background stay intact
  - Zero canvas re-renders, zero lag
```

---

### B. Background Upload & Dynamic Resolution Adaptation

```
[User selects image file in BackgroundSection]
           │
           ▼
[URL.createObjectURL(file)]
           │
           ▼
[off-screen new Image().onload reads naturalWidth (e.g. 1920) & naturalHeight (e.g. 1080)]
           │
           ▼
[setTemporaryBackgroundImage(url, { width: 1920, height: 1080 })]
           │
           ▼
[Zustand updates: template.settings.canvasWidth = 1920, canvasHeight = 1080]
           │
           ▼
[EditorLayout recalculates visual scale for 1920 x 1080]
           │
           ▼
[CanvasEditor lifecycle detects document dimension change]
  ├── Fabric Canvas initializes at 1920 x 1080
  ├── Background image renders at scaleX: 1, scaleY: 1 (100% full resolution)
  └── Percentage boxes (e.g. x: 35%, y: 65%) reposition proportionally on 1920 x 1080
```

---

### C. Bidirectional Selection Synchronization

#### Case 1: User clicks on Fabric Canvas
```
[User clicks Textbox on Canvas]
           │
           ▼
[Fabric fires 'selection:created' or 'selection:updated']
           │
           ▼
[Extract boxId from object.get("data")?.boxId]
           │
           ▼
[Loop Guard: if (selectedBoxId !== boxId)]
           │
           ▼
[selectBox(boxId) in Zustand]
           │
           ▼
[PropertiesPanel reads selectedBoxId from Zustand]
  └── Renders Element ID, GeometrySection, TypographySection, BackgroundSection
```

#### Case 2: User clicks a Layer in LeftSidebar
```
[User clicks Layer in LeftSidebar]
           │
           ▼
[selectBox(boxId) in Zustand]
           │
           ▼
[PropertiesPanel immediately updates]
           │
           ▼
[CanvasEditor's useEffect([selectedBoxId]) triggers]
           │
           ▼
[Loop Guard: if (canvas.getActiveObject()?.get("data")?.boxId === selectedBoxId) return]
           │
           ▼
[targetObject = canvas.getObjects().find(obj => obj.get("data")?.boxId === selectedBoxId)]
           │
           ▼
[canvas.setActiveObject(targetObject)]
           │
           ▼
[canvas.requestRenderAll()] -> Canvas shows active transform handles on selected box
```

---

### D. Box Drag / Resize / Modify Pipeline

```
[User drags/resizes a box on the Canvas]
           │
           ▼
[User releases mouse -> Fabric fires 'object:modified']
           │
           ▼
[CanvasEditor handleObjectModified(event)]
  ├── Reads object.left, object.top, object.width * scaleX in document pixels
  ├── Converts to percentage: x = pixelsToPercentage(left, docWidth)
  └── Converts to percentage: y = pixelsToPercentage(top, docHeight)
           │
           ▼
[updateBoxTransform(boxId, { x, y, width, height }) in Zustand]
           │
           ▼
[Zustand updates template.boxes and sets isDirty: true]
           │
           ▼
[PropertiesPanel inputs update to reflect new X, Y, W, H values]
```

---

### E. High-Resolution 1:1 Export Pipeline

```
[User clicks "Download PNG" in EditorHeader]
           │
           ▼
[window.dispatchEvent(new CustomEvent("eazy:export-canvas"))]
           │
           ▼
[CanvasEditor event handler triggers]
  ├── Temporarily discards active selection (removes bounding box & handles from image)
  ├── canvas.toDataURL({ format: "png", multiplier: 1 })
  │     └── Renders complete canvas at full documentWidth x documentHeight
  ├── Restores active selection on screen
  └── Creates temporary <a> element with download attribute and triggers click
           │
           ▼
[Browser downloads crystal-clear PNG matching native uploaded resolution]
```

---

### F. Undo / Redo Snapshot Mechanism

```
[User presses Cmd+Z / Ctrl+Z]
           │
           ▼
[EditorLayout keydown listener catches shortcut -> calls undo()]
           │
           ▼
[Zustand undo() action]
  ├── Pushes current template to `future` stack
  ├── Pops previous template from `past` stack into `template`
  └── Increments `templateLoadVersion = templateLoadVersion + 1`
           │
           ▼
[CanvasEditor useEffect([templateLoadVersion]) triggers]
  ├── Clears old template objects from Fabric canvas
  ├── Reconstructs Text & QR objects from the restored template snapshot
  └── Preserves the background image at index 0
```

---

## 6. Fabric.js 7.4 Type Safety & Custom Data

In Fabric.js 7.4, custom properties stored on objects are accessed via `object.get("data")` which returns `unknown`. To guarantee strict TypeScript type safety across the entire application, a central interface was created:

```typescript
// src/canvas/CanvasAdapter.tsx
export interface FabricCustomData {
  boxId?: string;
  isBackground?: boolean;
  baseWidth?: number;
  baseHeight?: number;
  foregroundColor?: string;
  backgroundColor?: string;
  variable?: string;
  logoUrl?: string;
}
```

Whenever custom data is inspected, it is safely typed:
```typescript
const data = object.get("data") as FabricCustomData | undefined;
if (data?.boxId === targetBoxId) {
  // Safe, typed access
}
```

---

## 7. Extensibility Guide: Adding New Element Types

To add a new box type (e.g. `image-box` or `shape-box`):

1. **Domain Model**: Add type definition in `src/domain/box/box.types.ts`.
2. **Adapter**: Add conversion function in `src/canvas/CanvasAdapter.tsx` (e.g. `shapeBoxToFabric(box, canvasSize)`), assigning `data: { boxId: box.id }`.
3. **Canvas Full Render & Reconcile**: Add a case in `src/canvas/CanvasEditor.tsx` inside `renderTemplate()` and `reconcileCanvas()`.
4. **Properties Panel**: Create a property editor component in `src/components/properties/` and render it inside `PropertiesPanel.tsx` when `box.type === "shape"`.
5. **Zustand Actions**: Add any type-specific update actions in `src/store/editor.actions.ts` and `src/store/editorStore.ts`.
