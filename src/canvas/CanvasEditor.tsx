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
  applyTextTransform,
  type FabricCustomData,
} from "./CanvasAdapter";
import { calculateTextFit } from "./TextFit";

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

function getObjectCustomData(obj: FabricObject): FabricCustomData | undefined {
  return (
    (obj as unknown as { data?: FabricCustomData }).data ??
    (typeof obj.get === "function" ? (obj.get("data") as FabricCustomData | undefined) : undefined)
  );
}

function findFabricObjectByBoxId(
  canvas: Canvas,
  boxId: string
): FabricObject | undefined {
  return canvas.getObjects().find((obj) => {
    const data = getObjectCustomData(obj);
    return data?.boxId === boxId;
  });
}

export function CanvasEditor({ template, previewData }: CanvasEditorProps) {
  const canvasElementRef = useRef<HTMLCanvasElement | null>(null);
  const fabricCanvasRef = useRef<Canvas | null>(null);

  const templateRef = useRef<Template>(template);
  const previewDataRef = useRef<PreviewData>(previewData);
  const isSettingSelectionRef = useRef(false);
  const initialRenderCompleteRef = useRef(false);
  const boxIdsRef = useRef<string>(JSON.stringify(template.boxes.map((b) => b.id)));

  const documentWidth = template.settings.canvasWidth;
  const documentHeight = template.settings.canvasHeight;

  // ─── Zustand subscriptions ─────────────────────────────────────────────────
  const selectBox = useEditorStore((state) => state.selectBox);
  const selectedBoxId = useEditorStore((state) => state.selectedBoxId);
  const updateBoxTransform = useEditorStore((state) => state.updateBoxTransform);
  const updateTextBox = useEditorStore((state) => state.updateTextBox);
  const deleteBox = useEditorStore((state) => state.deleteBox);
  const templateLoadVersion = useEditorStore((state) => state.templateLoadVersion);

  // Keep callback refs fresh so event listeners never have stale closures
  const selectBoxRef = useRef(selectBox);
  const updateBoxTransformRef = useRef(updateBoxTransform);
  const updateTextBoxRef = useRef(updateTextBox);

  useEffect(() => {
    templateRef.current = template;
    previewDataRef.current = previewData;
    selectBoxRef.current = selectBox;
    updateBoxTransformRef.current = updateBoxTransform;
    updateTextBoxRef.current = updateTextBox;
  });

  // ==================================================
  // 1. Fabric canvas lifecycle & complete event binding
  // ==================================================

  useEffect(() => {
    if (!canvasElementRef.current) return;

    const canvas = new Canvas(canvasElementRef.current, {
      width: documentWidth,
      height: documentHeight,
      selection: true,
      preserveObjectStacking: true,
      renderOnAddRemove: false,
    });

    fabricCanvasRef.current = canvas;
    initialRenderCompleteRef.current = false;

    // ── Selection Listeners ──
    const handleSelection = (event: SelectionEventPayload) => {
      if (isSettingSelectionRef.current) return;

      const selected = event.selected?.[0] ?? canvas.getActiveObject();
      if (!selected) return;

      const data = getObjectCustomData(selected);
      const boxId = data?.boxId;
      if (typeof boxId !== "string") return;

      const current = useEditorStore.getState().selectedBoxId;
      if (current !== boxId) {
        selectBoxRef.current(boxId);
      }
    };

    const handleSelectionCleared = () => {
      if (isSettingSelectionRef.current) return;
      const current = useEditorStore.getState().selectedBoxId;
      if (current !== null) {
        selectBoxRef.current(null);
      }
    };

    // ── Object Modification Listener ──
    const handleObjectModified = (event: ObjectModifiedEventPayload) => {
      const object = event.target;
      if (!object) return;

      const data = getObjectCustomData(object);
      const boxId = data?.boxId;
      if (typeof boxId !== "string") return;

      const docWidth = templateRef.current.settings.canvasWidth;
      const docHeight = templateRef.current.settings.canvasHeight;

      let x = pixelsToPercentage(object.left ?? 0, docWidth);
      let y = pixelsToPercentage(object.top ?? 0, docHeight);
      x = Math.max(0, x);
      y = Math.max(0, y);

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
          updateBoxTransformRef.current(boxId, {
            x,
            y,
            width: pixelsToPercentage(actualWidth, docWidth),
          });
          updateTextBoxRef.current(boxId, { fontSize: actualFontSize });
          textObj.set({ width: actualWidth, fontSize: actualFontSize, scaleX: 1, scaleY: 1 });
          textObj.setCoords();
        } else {
          updateBoxTransformRef.current(boxId, {
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

        updateBoxTransformRef.current(qrBoxId, {
          x,
          y,
          width: pixelsToPercentage(qrSize, docWidth),
          height: pixelsToPercentage(qrSize, docHeight),
        });

        canvas.renderAll();
        return;
      }

      updateBoxTransformRef.current(boxId, { x, y });
    };

    // ── Live On-Canvas Text Editing Listener ──
    const handleTextChanged = (event: { target?: FabricObject }) => {
      const target = event.target;
      if (!target || target.type !== "textbox") return;

      const data = getObjectCustomData(target);
      const boxId = data?.boxId;
      if (typeof boxId !== "string") return;

      const textObj = target as Textbox;
      const newText = textObj.text ?? "";
      updateTextBoxRef.current(boxId, { text: newText });
    };

    canvas.on("selection:created", handleSelection);
    canvas.on("selection:updated", handleSelection);
    canvas.on("selection:cleared", handleSelectionCleared);
    canvas.on("object:modified", handleObjectModified);
    canvas.on("text:changed", handleTextChanged);

    return () => {
      canvas.dispose();
      fabricCanvasRef.current = null;
      initialRenderCompleteRef.current = false;
    };
  }, [documentWidth, documentHeight]);

  // ==================================================
  // 2. Full template render (initial + undo/redo/dimension change)
  // ==================================================

  useEffect(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    initialRenderCompleteRef.current = false;
    let cancelled = false;

    async function renderTemplate() {
      if (!canvas) return;

      canvas.clear();

      const currentTemplate = templateRef.current;
      const bgUrl =
        useEditorStore.getState().temporaryBackgroundImageUrl ??
        currentTemplate.background.imageUrl;

      // 1. Render Background
      if (bgUrl) {
        try {
          const image = await FabricImage.fromURL(bgUrl);
          if (cancelled) return;

          const iw = image.width ?? documentWidth;
          const ih = image.height ?? documentHeight;

          if (iw > 0 && ih > 0) {
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
            (image as unknown as { data: FabricCustomData }).data = customData;

            canvas.add(image);
            canvas.moveObjectTo(image, 0);
          }
        } catch (err) {
          if (!cancelled) console.error("Failed to load background:", err);
        }
      }

      // 2. Render Template Boxes
      const boxes = currentTemplate.boxes;

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

            const exists = canvas.getObjects().some((o) => {
              const d = getObjectCustomData(o);
              return d?.boxId === box.id;
            });
            if (!exists) canvas.add(fObj);
          } catch (err) {
            if (!cancelled) console.error("Failed to render QR:", box.id, err);
          }
        }
      }

      if (cancelled) return;

      // 3. Restore selection if one was active
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
      boxIdsRef.current = JSON.stringify(currentTemplate.boxes.map((b) => b.id));
    }

    void renderTemplate();

    return () => {
      cancelled = true;
      initialRenderCompleteRef.current = false;
    };
  }, [templateLoadVersion, documentWidth, documentHeight]);

  // ==================================================
  // 3. Structural sync — add/remove boxes
  // ==================================================

  useEffect(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas || !initialRenderCompleteRef.current) return;

    const currentIds = JSON.stringify(template.boxes.map((b) => b.id));
    if (currentIds === boxIdsRef.current) {
      return;
    }
    boxIdsRef.current = currentIds;

    let cancelled = false;

    async function syncStructure() {
      if (!canvas) return;

      const existingIds = new Set<string>();
      canvas.getObjects().forEach((obj) => {
        const d = getObjectCustomData(obj);
        if (d?.boxId) existingIds.add(d.boxId);
      });

      const templateIds = new Set(template.boxes.map((b) => b.id));

      // Remove deleted boxes
      const toRemove = canvas.getObjects().filter((obj) => {
        const d = getObjectCustomData(obj);
        if (!d?.boxId || d.isBackground) return false;
        return !templateIds.has(d.boxId);
      });
      toRemove.forEach((obj) => canvas.remove(obj));

      // Add new boxes
      for (const box of template.boxes) {
        if (cancelled) return;
        if (existingIds.has(box.id)) continue;

        if (box.type === "text") {
          const fObj = textBoxToFabric(box, previewDataRef.current, {
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

      const bg = canvas.getObjects().find((o) => {
        const d = getObjectCustomData(o);
        return d?.isBackground === true;
      });
      if (bg) canvas.moveObjectTo(bg, 0);

      canvas.renderAll();
    }

    void syncStructure();
    return () => {
      cancelled = true;
    };
  }, [template.boxes, documentWidth, documentHeight]);

  // ==================================================
  // 4. Property sync — update existing objects in-place
  // ==================================================

  useEffect(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas || !initialRenderCompleteRef.current) return;

    let needsRender = false;

    for (const box of template.boxes) {
      const fObj = findFabricObjectByBoxId(canvas, box.id);
      if (!fObj) continue;

      if (box.type === "text") {
        const newLeft = percentageToPixels(box.x, documentWidth);
        const newTop = percentageToPixels(box.y, documentHeight);
        const newWidth = percentageToPixels(box.width, documentWidth);
        const newHeight = percentageToPixels(box.height, documentHeight);
        const resolvedTextValue = resolveTextVariable(box.variable, previewDataRef.current, box.text);
        const textValue = applyTextTransform(resolvedTextValue, box.textTransform);

        const fitResult = calculateTextFit({
          text: textValue,
          width: newWidth,
          height: newHeight,
          fontFamily: box.fontFamily,
          fontWeight: box.fontWeight,
          fontSize: box.fontSize,
          lineHeight: box.lineHeight,
          letterSpacing: box.letterSpacing,
        });

        fObj.set({
          left: newLeft,
          top: newTop,
          width: newWidth,
          angle: box.rotation,
          opacity: box.opacity,
          visible: box.visible,
          selectable: !box.locked,
          editable: !box.locked,
          fontSize: fitResult.fontSize,
          fontFamily: box.fontFamily,
          fontWeight: box.fontWeight,
          fill: box.color,
          textAlign: box.textAlign,
          lineHeight: box.lineHeight,
          charSpacing: box.letterSpacing,
          scaleX: 1,
          scaleY: 1,
          text: textValue,
        });
        fObj.setCoords();
        needsRender = true;
      }

      if (box.type === "qr") {
        const qrWidth = percentageToPixels(box.width, documentWidth);
        const qrHeight = percentageToPixels(box.height, documentHeight);
        if (qrWidth <= 0 || qrHeight <= 0) continue;

        const currentData = getObjectCustomData(fObj);
        const baseWidth = currentData?.baseWidth ?? fObj.width ?? 0;
        const baseHeight = currentData?.baseHeight ?? fObj.height ?? 0;
        if (baseWidth <= 0 || baseHeight <= 0) continue;

        fObj.set({
          left: percentageToPixels(box.x, documentWidth),
          top: percentageToPixels(box.y, documentHeight),
          scaleX: qrWidth / baseWidth,
          scaleY: qrHeight / baseHeight,
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
  // 5. Bidirectional selection — Zustand → Canvas
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
    const currentData = current ? getObjectCustomData(current) : undefined;
    if (currentData?.boxId === selectedBoxId) return;

    const target = findFabricObjectByBoxId(canvas, selectedBoxId);
    if (target && target.selectable !== false) {
      isSettingSelectionRef.current = true;
      canvas.setActiveObject(target);
      canvas.requestRenderAll();
      isSettingSelectionRef.current = false;
    }
  }, [selectedBoxId]);

  // ==================================================
  // 6. Arrow key nudge
  // ==================================================

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!selectedBoxId) return;

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
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [selectedBoxId, updateBoxTransform]);

  // ==================================================
  // 7. Delete / Backspace key
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

      // Check if a Fabric Textbox is actively being edited on canvas
      const canvas = fabricCanvasRef.current;
      const activeObj = canvas?.getActiveObject();
      if (activeObj && activeObj.type === "textbox" && (activeObj as Textbox).isEditing) {
        return;
      }

      if (event.key !== "Backspace" && event.key !== "Delete") return;

      const currentId = useEditorStore.getState().selectedBoxId;
      if (!currentId) return;

      event.preventDefault();
      if (canvas) {
        canvas.discardActiveObject();
        canvas.requestRenderAll();
      }

      deleteBox(currentId);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [deleteBox]);

  // ==================================================
  // 8. High-resolution export
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
    return () => {
      window.removeEventListener("eazy:export-canvas", handleExport);
    };
  }, []);

  return <canvas ref={canvasElementRef} tabIndex={0} />;
}