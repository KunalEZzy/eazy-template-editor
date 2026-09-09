# Dynamic Canvas Architecture

## 1. Overview

In the template editor, templates have fixed canonical document dimensions (e.g. `1200 × 1600` or the native resolution of an uploaded background image like `1920 × 1080`) which act as the absolute source of truth for all box positions, dimensions, font sizes, QR codes, and export renders.

When users edit templates on various screen sizes or resize their browser windows, the editor visually fits the document into the available workspace without:
1. Triggering ResizeObserver feedback loops or repeated scale recalculations.
2. Destroying and recreating the Fabric.js `Canvas` instance on visual resize.
3. Mutating template coordinates or causing unexpected undo/redo history entries.
4. Desynchronizing layer or object selections between the canvas, left sidebar, and right properties panel.
5. Arbitrarily cropping or zooming background images.

Dynamic Canvas implements **Option B**: a fixed internal Fabric document canvas visually scaled via CSS transforms inside a calculated display viewport.

---

## 2. High-Level Architecture

```
+-----------------------------------------------------------------------------------------+
|                                      EditorLayout                                       |
|                                                                                         |
|  +-------------------+  +-------------------------------------+  +-------------------+  |
|  |    LeftSidebar    |  |               <main>                |  |   RightSidebar    |  |
|  |                   |  |                                     |  |                   |  |
|  |  +-------------+  |  |  +-------------------------------+  |  |  +-------------+  |  |
|  |  | LayersPanel |  |  |  |   Workspace Measurement Ref   |  |  |  | Properties  |  |  |
|  |  +------+------+  |  |  |   (Observed by ResizeObserver)|  |  |  |    Panel    |  |  |
|  |         |         |  |  +---------------+---------------+  |  |  +------+------+  |  |
|  |         |         |  |                  |                  |  |         ^         |  |
|  +---------|---------+  |                  v                  |  +---------|---------+  |
|            |            |     calculateCanvasDisplaySize()    |            |            |
|            |            |                  |                  |            |            |
|            |            |                  v                  |            |            |
|            |            |  +-------------------------------+  |            |            |
|            |            |  |       DISPLAY VIEWPORT        |  |            |            |
|            |            |  |  (displayWidth x displayHeight)| |            |            |
|            |            |  |  +-------------------------+  |  |            |            |
|            |            |  |  | DOCUMENT SCALE CONTAINER|  |  |            |            |
|            |            |  |  | (documentWidth x Height)|  |  |            |            |
|            |            |  |  | (transform: scale(s))   |  |  |            |            |
|            |            |  |  |  +-------------------+  |  |  |            |            |
|            |            |  |  |  |   CanvasEditor    |  |  |  |            |            |
|            |            |  |  |  | +---------------+ |  |  |  |            |            |
|            |            |  |  |  | | Fabric Canvas | |  |  |  |            |            |
|            |            |  |  |  | |(docW x docH)  | |  |  |  |            |            |
|            |            |  |  |  | +-------+-------+ |  |  |  |            |            |
|            |            |  |  |  +---------|---------+  |  |  |            |            |
|            |            |  |  +------------|------------+  |  |            |            |
|            |            |  +---------------|---------------+  |            |            |
|            |            +------------------|------------------+            |            |
|            |                               |                               |            |
|            +-------------------------> Zustand <---------------------------+            |
|                               (useEditorStore)                                          |
|                               - template                                                |
|                               - selectedBoxId                                           |
|                               - selectBox()                                             |
|                               - updateBoxTransform()                                    |
|                               - setTemporaryBackgroundImage()                           |
|                               - undo() / redo()                                         |
+-----------------------------------------------------------------------------------------+
```

---

## 3. Document Coordinates vs Display Coordinates

The architecture strictly separates two distinct coordinate systems:

### Document Coordinates (Source of Truth)
- **Internal Size**: Defined by `template.settings.canvasWidth` and `template.settings.canvasHeight` (e.g. `1200 × 1600` or natural image dimensions).
- **Consumers**:
  - `template.boxes` (`x`, `y`, `width`, `height` in percentages of document dimensions).
  - Fabric `Canvas` (`width: documentWidth`, `height: documentHeight`).
  - Fabric objects (`Textbox`, `FabricImage`) positioned at document pixel coordinates.
  - Background image sized to span `[0, 0]` to `[documentWidth, documentHeight]`.
  - Font sizes (`fontSize: 48`), QR code dimensions, and stroke widths.
  - `CanvasAdapter` (`percentageToPixels`, `pixelsToPercentage`).
  - Undo/Redo historical snapshots.
  - High-resolution image export (`toDataURL` with `multiplier: 1`).
- **Invariance**: These values **never** mutate when the browser window or workspace container changes size.

### Display Coordinates (Presentation Only)
- **Rendered Size**: Computed from the available workspace area (e.g. `600 × 800`, `scale = 0.5`).
- **Consumers**:
  - Display Viewport outer bounding box (`width: displayWidth`, `height: displayHeight`).
  - CSS scale transformation: `transform: scale(scale)` with `transform-origin: top left`.
- **Scope**: Exists strictly outside the Fabric canvas and domain template models.

---

## 4. Scale Calculation

The scale calculation is implemented as a pure function in `src/utils/canvasDimensions.ts`:

```typescript
export function calculateCanvasDisplaySize({
  documentWidth,
  documentHeight,
  availableWidth,
  availableHeight,
}: CalculateCanvasDisplaySizeParams): CanvasDisplaySize {
  if (
    documentWidth <= 0 ||
    documentHeight <= 0 ||
    availableWidth <= 0 ||
    availableHeight <= 0
  ) {
    return { width: 0, height: 0, scale: 0 };
  }

  const scaleX = availableWidth / documentWidth;
  const scaleY = availableHeight / documentHeight;

  // Preserve aspect ratio by fitting inside available bounds
  const scale = Math.min(scaleX, scaleY);

  return {
    width: Math.round(documentWidth * scale),
    height: Math.round(documentHeight * scale),
    scale,
  };
}
```

---

## 5. Background Image Sizing & Resolution Preservation

1. **Resolution Extraction on Upload**:
   When a user uploads a new background image, `BackgroundSection` inspects the image's `naturalWidth` and `naturalHeight` and updates `template.settings.canvasWidth` and `template.settings.canvasHeight` in Zustand.
2. **Uncropped Mapping**:
   In `CanvasEditor`, the background image is scaled to document dimensions using:
   ```typescript
   const scaleX = documentWidth / imageWidth;
   const scaleY = documentHeight / imageHeight;

   image.set({
     left: 0,
     top: 0,
     scaleX: scaleX,
     scaleY: scaleY,
     originX: "left",
     originY: "top",
     selectable: false,
     evented: false,
     data: { isBackground: true },
   });
   ```
   This ensures the entire design remains visible without unwanted cropping or offset.
3. **High-Resolution Export**:
   When exporting/downloading, `canvas.toDataURL({ format: "png", multiplier: 1 })` renders the canvas at full canonical document resolution, preserving 100% of the uploaded image's resolution.

---

## 6. Resize Flow

When the browser or workspace resizes:

1. The browser layout updates the dimensions of the `<main>` workspace.
2. `ResizeObserver` on the inner measurement element (`workspaceRef`) measures `contentRect.width` and `contentRect.height`.
3. `setAvailableWorkspace` updates state only if integer pixel dimensions changed.
4. `calculateCanvasDisplaySize` computes the new `width`, `height`, and `scale`.
5. React updates:
   - Outer **DISPLAY VIEWPORT** `width` and `height`.
   - Inner **DOCUMENT SCALE CONTAINER** `transform: scale(...)`.
6. The Fabric.js `Canvas` instance **remains mounted, active, and untouched**:
   - Fabric canvas internal dimensions remain canonical `documentWidth × documentHeight`.
   - Fabric objects remain on canvas with existing coordinates.
   - Background image remains loaded without reload.
   - Active selection remains selected.
   - PropertiesPanel remains open.
   - Undo/Redo stack remains untouched.

---

## 7. ResizeObserver Stability

To completely eliminate layout feedback loops and continuous scale oscillation:

1. **Dedicated Stable Measurement Target**:
   `workspaceRef` is placed on an inner container with `flex: 1`, `minWidth: 0`, `minHeight: 0`, and `overflow: "hidden"`. Its layout size is determined by the parent flexbox, completely isolated from child contents.
2. **Padding Cleanliness**:
   Using `entry.contentRect` provides the exact inner bounding box excluding padding, preventing any double-padding subtraction or box-sizing mismatch.
3. **No Catch-All CSS Transitions**:
   Removed `transition: "all 0.2s"` from elements in the measurement tree. Only specific visual properties (`background-color`, `border-color`, `box-shadow`) are transitioned.
4. **State De-duplication**:
   Dimension state updates are guarded by `if (prev.width === width && prev.height === height) return prev;`.

---

## 8. Selection Flow

The editor features bidirectional selection synchronization between the canvas and Zustand:

### 1. Canvas → Zustand → PropertiesPanel
```
User clicks Fabric object
       ↓
Fabric `selection:created` / `selection:updated`
       ↓
Extract `boxId` from `object.get("data")?.boxId`
       ↓
Loop Guard: `if (selectedBoxId !== boxId)`
       ↓
`selectBox(boxId)` in Zustand
       ↓
`PropertiesPanel` re-renders with Box Properties (Geometry, Typography, QR, Background)
```

### 2. LeftSidebar → Zustand → Canvas
```
User clicks Layer in LeftSidebar
       ↓
`selectBox(boxId)` in Zustand
       ↓
CanvasEditor `useEffect([selectedBoxId])` triggers
       ↓
Loop Guard: `if (canvas.getActiveObject()?.get("data")?.boxId === selectedBoxId) return;`
       ↓
Find target object: `canvas.getObjects().find(...)`
       ↓
`canvas.setActiveObject(targetObject)`
       ↓
`canvas.requestRenderAll()`
```

### 3. Clear Selection
```
User clicks empty Canvas area
       ↓
Fabric `selection:cleared`
       ↓
`selectBox(null)` in Zustand
       ↓
`PropertiesPanel` displays "No Selection" placeholder
```

---

## 9. File Responsibilities

- **`src/components/layout/EditorLayout.tsx`**:
  Measures available workspace with `ResizeObserver`, computes display size via `calculateCanvasDisplaySize`, renders the outer `DISPLAY VIEWPORT` and `DOCUMENT SCALE CONTAINER` with CSS scaling.
- **`src/canvas/CanvasEditor.tsx`**:
  Manages Fabric.js canvas lifecycle at canonical document dimensions, reconciles template state to Fabric objects, renders background image at full document bounds, handles bidirectional selection and object modifications, and exports high-resolution PNGs.
- **`src/canvas/CanvasAdapter.tsx`**:
  Converts domain models (`TextBox`, `QRBox`) into Fabric objects (`Textbox`, `FabricImage`) and handles document coordinate transformations (`percentageToPixels`, `pixelsToPercentage`).
- **`src/store/editorStore.ts`**:
  Zustand store holding `template`, `selectedBoxId`, history (`past`, `future`), and mutation actions (`selectBox`, `updateTextBox`, `updateQRBox`, `updateBoxTransform`, `setTemporaryBackgroundImage`, `undo`, `redo`).
- **`src/components/properties/PropertiesPanel.tsx`**:
  Renders property editors for the currently selected box based on `useEditorStore((state) => state.selectedBoxId)`.
- **`src/components/properties/BackgroundSection.tsx`**:
  Manages background image uploads, inspects native image resolution, and commits changes.
- **`src/components/layout/EditorHeader.tsx`**:
  Header navigation with download PNG, save template, and theme toggle controls.
- **`src/components/layout/LeftSidebar.tsx` & `src/components/layers/LayersPanel.tsx`**:
  Displays template layers and dispatches `onSelectBox(box.id)` to Zustand.
- **`src/utils/canvasDimensions.ts`**:
  Pure utility for calculating proportional display dimensions and scale factor.

---

## 10. Data Integrity Rules

Resizing the browser window or workspace container will **NEVER**:
- Mutate `template.settings.canvasWidth` or `template.settings.canvasHeight`.
- Mutate `box.x`, `box.y`, `box.width`, or `box.height`.
- Mutate `box.fontSize` or QR dimensions.
- Create entries in the undo/redo history stack (`past` / `future`).
- Clear the currently active selection.

---

## 11. Testing Checklist

- [x] **Initial Load**: Canvas renders centered with correct aspect ratio at document dimensions; no scale feedback loop or console errors.
- [x] **Background Visibility**: Full background image is visible with zero accidental cropping.
- [x] **Image Resolution Preservation**: Uploading background image updates canvas dimensions to native image resolution.
- [x] **High-Resolution Export**: "Download PNG" exports the template at 100% native document resolution.
- [x] **Browser Resize (Small to Large & Large to Small)**: Scale adjusts smoothly without destroying/recreating Fabric canvas.
- [x] **Canvas Text Selection**: Clicking a text box selects the object on canvas and displays `GeometrySection` + `TypographySection` in `PropertiesPanel`.
- [x] **Canvas QR Selection**: Clicking a QR box selects the object on canvas and displays `GeometrySection` + `QRPropertiesSection` in `PropertiesPanel`.
- [x] **Sidebar Layer Selection**: Clicking a layer item selects the corresponding box on the Fabric canvas with active transformation handles.
- [x] **Clear Selection**: Clicking on empty canvas deselects the object and renders the "No Selection" view in `PropertiesPanel`.
- [x] **Resize with Active Selection**: Selected object and `PropertiesPanel` remain open and active while resizing the browser.
- [x] **Data Integrity**: Canonical document settings, box coordinates, and typography values remain untouched by UI resizing.
- [x] **Undo / Redo**: Resizing creates zero history entries; undo and redo work accurately.

