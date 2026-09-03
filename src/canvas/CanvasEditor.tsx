import { useEffect, useRef } from "react";
import {
  Canvas,
  Image as FabricImage,
  Textbox,
  type FabricObject,
} from "fabric";

import type { Template } from "../domain/template/template.types";
import type { PreviewData } from "../domain/variables/preview.types";
import { resolveTextVariable } from "../domain/variables/previewResolver";

import { useEditorStore } from "../store/editorStore";

import {
  percentageToPixels,
  pixelsToPercentage,
  textBoxToFabric,
  qrBoxToFabric,
  type FabricCustomData,
} from "./CanvasAdapter";

interface CanvasEditorProps {
  template: Template;
  previewData: PreviewData;
}

interface SelectionEventPayload {
  selected?: FabricObject[];
  deselected?: FabricObject[];
}

interface ObjectModifiedEventPayload {
  target?: FabricObject;
}

// ============================================================
// Helper: find a Fabric object by its domain box ID
// ============================================================
function findFabricObjectByBoxId(
  canvas: Canvas,
  boxId: string
): FabricObject | undefined {
  return canvas.getObjects().find((obj) => {
    const data = obj.get("data") as FabricCustomData | undefined;
    return data?.boxId === boxId;
  });
}

export function CanvasEditor({ template, previewData }: CanvasEditorProps) {
  const canvasElementRef = useRef<HTMLCanvasElement | null>(null);
  const fabricCanvasRef = useRef<Canvas | null>(null);
  const isTransformingRef = useRef(false);

  // Always keep the latest template + previewData available inside event handlers
  // without causing effect re-runs.
  const templateRef = useRef<Template>(template);
  const previewDataRef = useRef<PreviewData>(previewData);

  // Track the stable ordered list of box IDs so we can detect add/remove cheaply.
  const boxIdsRef = useRef<string>(JSON.stringify(template.boxes.map((b) => b.id)));

  // Guard: incremental update must not run until the full initial render completes.
  const initialRenderCompleteRef = useRef(false);

  // Prevent selection-sync from fighting itself when we're the ones setting the object.
  const isSettingSelectionRef = useRef(false);

  const documentWidth = template.settings.canvasWidth;
  const documentHeight = template.settings.canvasHeight;

  useEffect(() => {
    templateRef.current = template;
    previewDataRef.current = previewData;
  });

  // ─── Zustand subscriptions ─────────────────────────────────────────────────
  const selectBox = useEditorStore((state) => state.selectBox);
  const selectedBoxId = useEditorStore((state) => state.selectedBoxId);
  const updateBoxTransform = useEditorStore((state) => state.updateBoxTransform);
  const updateTextBox = useEditorStore((state) => state.updateTextBox);
  const deleteBox = useEditorStore((state) => state.deleteBox);
  const templateLoadVersion = useEditorStore((state) => state.templateLoadVersion);
  const temporaryBackgroundImageUrl = useEditorStore(
    (state) => state.temporaryBackgroundImageUrl
  );

  // ==================================================
  // 1. Fabric canvas lifecycle
  // Created once per document dimension pair.
  // Visual scaling is CSS-only (parent container).
  // ==================================================

  useEffect(() => {
    if (!canvasElementRef.current) return;

    const canvas = new Canvas(canvasElementRef.current, {
      width: documentWidth,
      height: documentHeight,
      selection: true,
      preserveObjectStacking: true,
      // Render on demand — we control renderAll() explicitly.
      renderOnAddRemove: false,
    });

    fabricCanvasRef.current = canvas;
    initialRenderCompleteRef.current = false;

    return () => {
      canvas.dispose();
      fabricCanvasRef.current = null;
      initialRenderCompleteRef.current = false;
    };
    // Only recreate when document dimensions change (e.g. new background uploaded).
  }, [documentWidth, documentHeight]);

  // ==================================================
  // 2. Full template render (initial + undo/redo)
  //
  // Triggered by templateLoadVersion only.
  // Clears all non-background objects and redraws from scratch.
  // ==================================================

  useEffect(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    initialRenderCompleteRef.current = false;
    let cancelled = false;

    async function renderTemplate() {
      if (!canvas) return;

      // Remove all non-background objects.
      const toRemove = canvas.getObjects().filter((obj) => {
        const data = obj.get("data") as FabricCustomData | undefined;
        return data?.isBackground !== true;
      });
      toRemove.forEach((obj) => canvas.remove(obj));

      const boxes = templateRef.current.boxes;

      for (const box of boxes) {
        if (cancelled) return;

        if (box.type === "text") {
          const fObj = textBoxToFabric(box, previewDataRef.current, {
            width: documentWidth,
            height: documentHeight,
          });
          if (cancelled) return;
          canvas.add(fObj);
          continue;
        }

        if (box.type === "qr") {
          try {
            const fObj = await qrBoxToFabric(box, previewDataRef.current, {
              width: documentWidth,
              height: documentHeight,
            });
            if (cancelled) return;
            // Double-guard: don't add if already present (parallel async).
            const exists = canvas.getObjects().some((o) => {
              const d = o.get("data") as FabricCustomData | undefined;
              return d?.boxId === box.id;
            });
            if (!exists) canvas.add(fObj);
          } catch (err) {
            if (!cancelled) console.error("Failed to render QR:", box.id, err);
          }
        }
      }

      if (cancelled) return;

      // Ensure background is always at z=0.
      const bg = canvas.getObjects().find((o) => {
        const d = o.get("data") as FabricCustomData | undefined;
        return d?.isBackground === true;
      });
      if (bg) canvas.moveObjectTo(bg, 0);

      // Restore selection if one was active.
      const pendingId = useEditorStore.getState().selectedBoxId;
      if (pendingId) {
        const target = findFabricObjectByBoxId(canvas, pendingId);
        if (target && target.selectable !== false) {
          isSettingSelectionRef.current = true;
          canvas.setActiveObject(target);
          isSettingSelectionRef.current = false;
        }
      }

      canvas.renderAll();
      initialRenderCompleteRef.current = true;

      // Sync the box-ids snapshot so incremental sync knows where baseline is.
      boxIdsRef.current = JSON.stringify(
        templateRef.current.boxes.map((b) => b.id)
      );
    }

    void renderTemplate();

    return () => {
      cancelled = true;
      initialRenderCompleteRef.current = false;
    };
  }, [templateLoadVersion, documentWidth, documentHeight]);


  // ==================================================
  // 3. Background image effect
  // ==================================================

  useEffect(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    const backgroundUrl = temporaryBackgroundImageUrl ?? template.background.imageUrl;

    if (!backgroundUrl) {
      const existing = canvas.getObjects().find((o) => {
        const d = o.get("data") as FabricCustomData | undefined;
        return d?.isBackground === true;
      });
      if (existing) canvas.remove(existing);
      canvas.renderAll();
      return;
    }

    let cancelled = false;

    // Remove current background first so we never have two.
    const existing = canvas.getObjects().find((o) => {
      const d = o.get("data") as FabricCustomData | undefined;
      return d?.isBackground === true;
    });
    if (existing) canvas.remove(existing);

    async function loadBackground() {
      if (!canvas) return;
      try {
        const image = await FabricImage.fromURL(backgroundUrl as string);
        if (cancelled) return;

        const iw = image.width ?? documentWidth;
        const ih = image.height ?? documentHeight;
        if (iw <= 0 || ih <= 0) return;

        const customData: FabricCustomData = { isBackground: true };
        image.set({
          left: 0,
          top: 0,
          scaleX: documentWidth / iw,
          scaleY: documentHeight / ih,
          selectable: false,
          evented: false,
          originX: "left",
          originY: "top",
          data: customData,
        });

        if (cancelled) return;

        // Guard again: another async call may have already added background.
        const dup = canvas.getObjects().find((o) => {
          const d = o.get("data") as FabricCustomData | undefined;
          return d?.isBackground === true;
        });
        if (dup) canvas.remove(dup);

        canvas.add(image);
        canvas.moveObjectTo(image, 0);
        canvas.renderAll();
      } catch (err) {
        if (!cancelled) console.error("Failed to load background:", err);
      }
    }

    void loadBackground();
    return () => { cancelled = true; };
  }, [
    temporaryBackgroundImageUrl,
    template.background.imageUrl,
    documentWidth,
    documentHeight,
  ]);

  // ==================================================
  // 4. Structural sync — add/remove boxes
  //
  // Runs only when the set of box IDs changes (a box was added or deleted).
  // Does NOT re-run for property changes (x, y, fontSize, color…).
  // This is the key fix for 4.1: adding a variable must NOT wipe existing state.
  // ==================================================

    const boxStructureKey =
      template.boxes
        .map((box) => box.id)
        .join("|");

  useEffect(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas || !initialRenderCompleteRef.current) return;

    const currentIds = JSON.stringify(template.boxes.map((b) => b.id));
    if (currentIds === boxIdsRef.current) {
      // No structural change — nothing to add or remove.
      return;
    }
    boxIdsRef.current = currentIds;

    let cancelled = false;

    async function syncStructure() {
      if (!canvas) return;

      const existingIds = new Set<string>();
      canvas.getObjects().forEach((obj) => {
        const d = obj.get("data") as FabricCustomData | undefined;
        if (d?.boxId) existingIds.add(d.boxId);
      });

      const templateIds = new Set(template.boxes.map((b) => b.id));

      // ── Remove deleted boxes ──────────────────────────────────────────
      const toRemove = canvas.getObjects().filter((obj) => {
        const d = obj.get("data") as FabricCustomData | undefined;
        if (!d?.boxId || d.isBackground) return false;
        return !templateIds.has(d.boxId);
      });
      toRemove.forEach((obj) => canvas.remove(obj));

      // ── Add new boxes ─────────────────────────────────────────────────
      for (const box of template.boxes) {
        if (cancelled) return;
        if (existingIds.has(box.id)) continue; // Already on canvas.

        if (box.type === "text") {
          const fObj = textBoxToFabric(box, previewDataRef.current, {
            width: documentWidth,
            height: documentHeight,
          });
          if (cancelled) return;
          canvas.add(fObj);

          // Immediately select if this is the pending selection.
          const pendingId = useEditorStore.getState().selectedBoxId;
          if (pendingId === box.id) {
            isSettingSelectionRef.current = true;
            canvas.setActiveObject(fObj);
            isSettingSelectionRef.current = false;
          }
        }

        if (box.type === "qr") {
          try {
            const fObj = await qrBoxToFabric(box, previewDataRef.current, {
              width: documentWidth,
              height: documentHeight,
            });
            if (cancelled) return;
            canvas.add(fObj);

            const pendingId = useEditorStore.getState().selectedBoxId;
            if (pendingId === box.id) {
              isSettingSelectionRef.current = true;
              canvas.setActiveObject(fObj);
              isSettingSelectionRef.current = false;
            }
          } catch (err) {
            if (!cancelled) console.error("Failed to add QR:", box.id, err);
          }
        }
      }

      if (cancelled) return;

      // Keep background at z=0.
      const bg = canvas.getObjects().find((o) => {
        const d = o.get("data") as FabricCustomData | undefined;
        return d?.isBackground === true;
      });
      if (bg) canvas.moveObjectTo(bg, 0);

      canvas.renderAll();
    }

    void syncStructure();
    return () => { cancelled = true; };
  }, [boxStructureKey, documentWidth, documentHeight]);


  // ==================================================
  // 5. Property sync — update existing objects in-place
  //
  // Runs on every template change but ONLY touches objects that already exist.
  // Does not add or remove. Does not disturb objects being dragged/edited.
  // ==================================================

  useEffect(() => {
  const canvas = fabricCanvasRef.current;

  if (!canvas) {
    return;
  }

  const handleTransformStart = () => {
    isTransformingRef.current = true;
  };

  const handleTransformEnd = () => {
    isTransformingRef.current = false;
  };

  canvas.on(
    "before:transform",
    handleTransformStart
  );

  canvas.on(
    "object:modified",
    handleTransformEnd
  );

  return () => {
    canvas.off(
      "before:transform",
      handleTransformStart
    );

    canvas.off(
      "object:modified",
      handleTransformEnd
    );
  };
}, []);

  useEffect(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas || !initialRenderCompleteRef.current) return;

    let needsRender = false;

    for (const box of template.boxes) {
      const fObj = findFabricObjectByBoxId(canvas, box.id);
      if (!fObj) continue; // Structural sync will handle missing objects.

      // Do not overwrite the currently active object while it is being manipulated.
      if (canvas.getActiveObject() === fObj && !isTransformingRef.current) {
        continue;
      }

      if (box.type === "text") {
        const newLeft = percentageToPixels(box.x, documentWidth);
        const newTop = percentageToPixels(box.y, documentHeight);
        const newWidth = percentageToPixels(box.width, documentWidth);
        const textValue = resolveTextVariable(box.variable, previewDataRef.current);

        fObj.set({
          left: newLeft,
          top: newTop,
          width: newWidth,
          angle: box.rotation,
          opacity: box.opacity,
          visible: box.visible,
          selectable: !box.locked,
          fontSize: box.fontSize,
          fontFamily: box.fontFamily,
          fontWeight: box.fontWeight,
          fill: box.color,
          textAlign: box.textAlign,
          scaleX: 1,
          scaleY: 1,
          text: textValue,
        });
        fObj.setCoords();
        needsRender = true;
      }

      if (box.type === "qr") {
        const qrWidth = percentageToPixels(
          box.width,
          documentWidth
        );

        const qrHeight = percentageToPixels(
          box.height,
          documentHeight
        );

        if (qrWidth <= 0 || qrHeight <= 0) {
          continue;
        }

        const currentData =
          fObj.get("data") as
            | FabricCustomData
            | undefined;

        const baseWidth =
          currentData?.baseWidth ??
          fObj.width ??
          0;

        const baseHeight =
          currentData?.baseHeight ??
          fObj.height ??
          0;

        if (
          baseWidth <= 0 ||
          baseHeight <= 0
        ) {
          continue;
        }

        fObj.set({
          left: percentageToPixels(
            box.x,
            documentWidth
          ),

          top: percentageToPixels(
            box.y,
            documentHeight
          ),

          scaleX:
            qrWidth / baseWidth,

          scaleY:
            qrHeight / baseHeight,

          angle: box.rotation,

          opacity: box.opacity,

          visible: box.visible,

          selectable: !box.locked,
        });

        fObj.setCoords();

        needsRender = true;
      }
    }

    if (needsRender) canvas.renderAll();
  }, [template, previewData, documentWidth, documentHeight]);

  // ==================================================
  // 6. Bidirectional selection — Canvas → Zustand
  // ==================================================

  useEffect(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    const handleSelection = (event: SelectionEventPayload) => {
      if (isSettingSelectionRef.current) return; // We triggered this — ignore.

      const selected = event.selected?.[0] ?? canvas.getActiveObject();
      if (!selected) return;

      const data = selected.get("data") as FabricCustomData | undefined;
      const boxId = data?.boxId;
      if (typeof boxId !== "string") return;

      const current = useEditorStore.getState().selectedBoxId;
      if (current !== boxId) selectBox(boxId);
    };

    const handleSelectionCleared = () => {
      if (isSettingSelectionRef.current) return;
      const current = useEditorStore.getState().selectedBoxId;
      if (current !== null) selectBox(null);
    };

    canvas.on("selection:created", handleSelection);
    canvas.on("selection:updated", handleSelection);
    canvas.on("selection:cleared", handleSelectionCleared);

    return () => {
      canvas.off("selection:created", handleSelection);
      canvas.off("selection:updated", handleSelection);
      canvas.off("selection:cleared", handleSelectionCleared);
    };
  }, [selectBox]);

  // ==================================================
  // 7. Bidirectional selection — Zustand → Canvas
  // ==================================================

  useEffect(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    if (!selectedBoxId) {
      const current = canvas.getActiveObject();
      if (current) {
        isSettingSelectionRef.current = true;
        canvas.discardActiveObject();
        canvas.requestRenderAll();
        isSettingSelectionRef.current = false;
      }
      return;
    }

    const current = canvas.getActiveObject();
    const currentData = current?.get("data") as FabricCustomData | undefined;
    if (currentData?.boxId === selectedBoxId) return; // Already correct.

    const target = findFabricObjectByBoxId(canvas, selectedBoxId);
    if (target && target.selectable !== false) {
      isSettingSelectionRef.current = true;
      canvas.setActiveObject(target);
      canvas.requestRenderAll();
      isSettingSelectionRef.current = false;
    }
  }, [selectedBoxId]);

  // ==================================================
  // 8. Object modified — write back to Zustand
  // ==================================================

  useEffect(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    const handleObjectModified = (event: ObjectModifiedEventPayload) => {
      const object = event.target;
      if (!object) return;

      const data = object.get("data") as FabricCustomData | undefined;
      const boxId = data?.boxId;
      if (typeof boxId !== "string") return;

      const docWidth = templateRef.current.settings.canvasWidth;
      const docHeight = templateRef.current.settings.canvasHeight;

      let x = pixelsToPercentage(object.left ?? 0, docWidth);
      let y = pixelsToPercentage(object.top ?? 0, docHeight);
      x = Math.max(0, x);
      y = Math.max(0, y);

      // Snap back to clean percentage coords.
      object.set({
        left: percentageToPixels(x, docWidth),
        top: percentageToPixels(y, docHeight),
      });
      object.setCoords();

      if (object.type === "textbox") {
        const textObj = object as Textbox;
        const scaleX = textObj.scaleX ?? 1;
        const scaleY = textObj.scaleY ?? 1;
        const isScaled = Math.abs(scaleX - 1) > 0.0001 || Math.abs(scaleY - 1) > 0.0001;

        if (isScaled) {
          const actualWidth = (textObj.width ?? 0) * scaleX;
          const actualFontSize = (textObj.fontSize ?? 16) * scaleY;
          updateBoxTransform(boxId, {
            x,
            y,
            width: pixelsToPercentage(actualWidth, docWidth),
          });
          updateTextBox(boxId, { fontSize: actualFontSize });
          textObj.set({ width: actualWidth, fontSize: actualFontSize, scaleX: 1, scaleY: 1 });
          textObj.setCoords();
        } else {
          updateBoxTransform(boxId, {
            x,
            y,
            width: pixelsToPercentage(textObj.width ?? 0, docWidth),
          });
          textObj.set({ scaleX: 1, scaleY: 1 });
          textObj.setCoords();
        }
        return;
      }

      if (object.type === "image") {
        const qrBoxId = data?.boxId;
        if (typeof qrBoxId !== "string") return;

        const scaleX = object.scaleX ?? 1;
        const scaleY = object.scaleY ?? 1;
        const baseWidth = data?.baseWidth ?? object.width ?? 0;
        const baseHeight = data?.baseHeight ?? object.height ?? 0;
        if (baseWidth <= 0 || baseHeight <= 0) return;

        const actualWidth = baseWidth * scaleX;
        const actualHeight = baseHeight * scaleY;
        const qrSize = Math.min(actualWidth, actualHeight);
        if (qrSize <= 0) return;

        const normalizedScaleX = qrSize / baseWidth;
        const normalizedScaleY = qrSize / baseHeight;
        object.set({ scaleX: normalizedScaleX, scaleY: normalizedScaleY });
        object.setCoords();

        updateBoxTransform(qrBoxId, {
          x,
          y,
          width: pixelsToPercentage(qrSize, docWidth),
          height: pixelsToPercentage(qrSize, docHeight),
        });

        canvas.renderAll();
        return;
      }

      updateBoxTransform(boxId, { x, y });
    };

    canvas.on("object:modified", handleObjectModified);
    return () => { canvas.off("object:modified", handleObjectModified); };
  }, [updateBoxTransform, updateTextBox]);

  // ==================================================
  // 9. Arrow key nudge
  // ==================================================

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!selectedBoxId) return;

      const target =
        event.target as HTMLElement | null;

      if (!target) {
        return;
      }

      const tag =
        target.tagName.toLowerCase();

      if (
        tag === "input" ||
        tag === "textarea" ||
        tag === "select" ||
        target.isContentEditable
      ) {
        return;
      }

      const isArrow =
        event.key === "ArrowLeft" ||
        event.key === "ArrowRight" ||
        event.key === "ArrowUp" ||
        event.key === "ArrowDown";
      if (!isArrow) return;

      event.preventDefault();

      const step = event.shiftKey ? 10 : 1;
      let dx = 0;
      let dy = 0;
      if (event.key === "ArrowLeft") dx = -step;
      if (event.key === "ArrowRight") dx = step;
      if (event.key === "ArrowUp") dy = -step;
      if (event.key === "ArrowDown") dy = step;

      const docWidth = templateRef.current.settings.canvasWidth;
      const docHeight = templateRef.current.settings.canvasHeight;
      const currentBox = templateRef.current.boxes.find((b) => b.id === selectedBoxId);
      if (!currentBox) return;

      const newX = Math.max(0, currentBox.x + pixelsToPercentage(dx, docWidth));
      const newY = Math.max(0, currentBox.y + pixelsToPercentage(dy, docHeight));

      const canvas = fabricCanvasRef.current;
      if (canvas) {
        const fObj = findFabricObjectByBoxId(canvas, selectedBoxId);
        if (fObj) {
          fObj.set({
            left: percentageToPixels(newX, docWidth),
            top: percentageToPixels(newY, docHeight),
          });
          fObj.setCoords();
          canvas.renderAll();
        }
      }

      updateBoxTransform(selectedBoxId, { x: newX, y: newY });
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => { window.removeEventListener("keydown", handleKeyDown); };
  }, [selectedBoxId, updateBoxTransform]);

  // ==================================================
  // 10. Delete / Backspace key
  // ==================================================

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;

      const tag = target.tagName.toLowerCase();
      if (
        tag === "input" ||
        tag === "textarea" ||
        tag === "select" ||
        target.isContentEditable
      ) {
        return;
      }

      if (event.key !== "Backspace" && event.key !== "Delete") return;

      const currentId = useEditorStore.getState().selectedBoxId;
      if (!currentId) return;

      event.preventDefault();
      const canvas = fabricCanvasRef.current;

      if (canvas) {
        canvas.discardActiveObject();
        canvas.requestRenderAll();
      }

      deleteBox(currentId);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => { window.removeEventListener("keydown", handleKeyDown); };
  }, [deleteBox]);

  // ==================================================
  // 11. High-resolution export
  // ==================================================

  useEffect(() => {
    const handleExport = () => {
      const canvas = fabricCanvasRef.current;
      if (!canvas) return;

      const active = canvas.getActiveObject();
      if (active) {
        canvas.discardActiveObject();
        canvas.renderAll();
      }

      const dataUrl = canvas.toDataURL({ format: "png", multiplier: 1 });

      if (active) {
        canvas.setActiveObject(active);
        canvas.renderAll();
      }

      const safeName =
        templateRef.current.name.toLowerCase().replace(/[^a-z0-9]+/g, "-") ||
        "template";
      const link = document.createElement("a");
      link.download = `${safeName}-${templateRef.current.settings.canvasWidth}x${templateRef.current.settings.canvasHeight}.png`;
      link.href = dataUrl;
      link.click();
    };

    window.addEventListener("eazy:export-canvas", handleExport);
    return () => { window.removeEventListener("eazy:export-canvas", handleExport); };
  }, []);

  return <canvas ref={canvasElementRef} tabIndex={0} />;
}