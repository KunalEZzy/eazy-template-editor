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

export function CanvasEditor({
  template,
  previewData,
}: CanvasEditorProps) {
  const canvasElementRef = useRef<HTMLCanvasElement | null>(null);
  const fabricCanvasRef = useRef<Canvas | null>(null);

  /*
   * Always keep the latest template available to keyboard/event handlers.
   */
  const templateRef = useRef<Template>(template);

  /*
   * Prevents incremental reconciliation from running before initial render finishes.
   */
  const initialRenderCompleteRef = useRef(false);

  const documentWidth = template.settings.canvasWidth;
  const documentHeight = template.settings.canvasHeight;

  useEffect(() => {
    templateRef.current = template;
  }, [template]);

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
  // Internal dimensions = Document dimensions (e.g. 1200 x 1600).
  // Visual scaling is handled by CSS transform on the parent container.
  // ==================================================

  useEffect(() => {
    if (!canvasElementRef.current) {
      return;
    }

    const canvas = new Canvas(canvasElementRef.current, {
      width: documentWidth,
      height: documentHeight,
      selection: true,
      preserveObjectStacking: true,
    });

    fabricCanvasRef.current = canvas;
    initialRenderCompleteRef.current = false;

    return () => {
      canvas.dispose();
      fabricCanvasRef.current = null;
      initialRenderCompleteRef.current = false;
    };
  }, [documentWidth, documentHeight]);

  // ==================================================
  // 2. Full template render
  //
  // IMPORTANT:
  // We remove ONLY template objects.
  // Background is managed separately and must survive Undo/Redo.
  // ==================================================

  useEffect(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) {
      return;
    }

    const fabricCanvas = canvas;
    initialRenderCompleteRef.current = false;
    let cancelled = false;

    async function renderTemplate() {
      // Remove only template objects, never background
      const objectsToRemove = fabricCanvas
        .getObjects()
        .filter((object) => {
          const data = object.get("data") as FabricCustomData | undefined;
          return data?.isBackground !== true;
        });

      objectsToRemove.forEach((object) => {
        fabricCanvas.remove(object);
      });

      const currentBoxes = templateRef.current.boxes;

      // Render every template box
      for (const box of currentBoxes) {
        if (cancelled) {
          return;
        }

        if (box.type === "text") {
          const fabricText = textBoxToFabric(box, previewData, {
            width: documentWidth,
            height: documentHeight,
          });

          if (cancelled) {
            return;
          }

          fabricCanvas.add(fabricText);
          continue;
        }

        if (box.type === "qr") {
          try {
            const fabricQR = await qrBoxToFabric(box, previewData, {
              width: documentWidth,
              height: documentHeight,
            });

            if (cancelled) {
              return;
            }

            const alreadyExists = fabricCanvas
              .getObjects()
              .some((object) => {
                const data = object.get("data") as FabricCustomData | undefined;
                return data?.boxId === box.id;
              });

            if (!alreadyExists) {
              fabricCanvas.add(fabricQR);
            }
          } catch (error) {
            if (!cancelled) {
              console.error("Failed to render QR box:", box.id, error);
            }
          }
        }
      }

      if (cancelled) {
        return;
      }

      // Keep background at index 0
      const backgroundObject = fabricCanvas
        .getObjects()
        .find((object) => {
          const data = object.get("data") as FabricCustomData | undefined;
          return data?.isBackground === true;
        });

      if (backgroundObject) {
        fabricCanvas.moveObjectTo(backgroundObject, 0);
      }

      // Re-apply active selection if an object is selected in Zustand
      const currentSelectedBoxId = useEditorStore.getState().selectedBoxId;
      if (currentSelectedBoxId) {
        const targetObject = fabricCanvas
          .getObjects()
          .find((obj) => {
            const data = obj.get("data") as FabricCustomData | undefined;
            return data?.boxId === currentSelectedBoxId;
          });

        if (targetObject && targetObject.selectable !== false) {
          fabricCanvas.setActiveObject(targetObject);
        }
      }

      fabricCanvas.renderAll();
      initialRenderCompleteRef.current = true;
    }

    void renderTemplate();

    return () => {
      cancelled = true;
      initialRenderCompleteRef.current = false;
    };
  }, [
    templateLoadVersion,
    previewData,
    documentWidth,
    documentHeight,
  ]);

  // ==================================================
  // 3. Background image
  // Fits perfectly against canonical document dimensions.
  // ==================================================

  useEffect(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) {
      return;
    }

    const backgroundUrl =
      temporaryBackgroundImageUrl ?? template.background.imageUrl;

    if (!backgroundUrl) {
      const existingBackground = canvas
        .getObjects()
        .find((object) => {
          const data = object.get("data") as FabricCustomData | undefined;
          return data?.isBackground === true;
        });

      if (existingBackground) {
        canvas.remove(existingBackground);
      }

      canvas.renderAll();
      return;
    }

    const fabricCanvas: Canvas = canvas;
    const resolvedBackgroundUrl: string = backgroundUrl;
    let cancelled = false;

    const existingBackground = fabricCanvas
      .getObjects()
      .find((object) => {
        const data = object.get("data") as FabricCustomData | undefined;
        return data?.isBackground === true;
      });

    if (existingBackground) {
      fabricCanvas.remove(existingBackground);
    }

    async function loadBackground() {
      try {
        const image = await FabricImage.fromURL(resolvedBackgroundUrl);

        if (cancelled) {
          return;
        }

        const imageWidth = image.width ?? documentWidth;
        const imageHeight = image.height ?? documentHeight;

        if (imageWidth <= 0 || imageHeight <= 0) {
          return;
        }

        // Scale image exactly to logical document dimensions without cropping
        const scaleX = documentWidth / imageWidth;
        const scaleY = documentHeight / imageHeight;

        const customData: FabricCustomData = {
          isBackground: true,
        };

        image.set({
          left: 0,
          top: 0,
          scaleX: scaleX,
          scaleY: scaleY,
          selectable: false,
          evented: false,
          originX: "left",
          originY: "top",
          data: customData,
        });

        if (cancelled) {
          return;
        }

        const duplicateBackground = fabricCanvas
          .getObjects()
          .find((object) => {
            const data = object.get("data") as FabricCustomData | undefined;
            return data?.isBackground === true;
          });

        if (duplicateBackground) {
          fabricCanvas.remove(duplicateBackground);
        }

        fabricCanvas.add(image);
        fabricCanvas.moveObjectTo(image, 0);
        fabricCanvas.renderAll();
      } catch (error) {
        if (!cancelled) {
          console.error("Failed to load background image:", error);
        }
      }
    }

    void loadBackground();

    return () => {
      cancelled = true;
    };
  }, [
    temporaryBackgroundImageUrl,
    template.background.imageUrl,
    documentWidth,
    documentHeight,
  ]);

  // ==================================================
  // 4. Reconcile Zustand -> Fabric
  // ==================================================

  useEffect(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) {
      return;
    }

    if (!initialRenderCompleteRef.current) {
      return;
    }

    const fabricCanvas = canvas;
    let cancelled = false;

    async function reconcileCanvas() {
      const fabricObjectMap = new Map<string, FabricObject>();

      fabricCanvas.getObjects().forEach((object) => {
        const data = object.get("data") as FabricCustomData | undefined;
        const boxId = data?.boxId;
        if (typeof boxId === "string") {
          fabricObjectMap.set(boxId, object);
        }
      });

      for (const box of template.boxes) {
        if (cancelled) {
          return;
        }

        let fabricObject = fabricObjectMap.get(box.id);

        if (!fabricObject) {
          if (box.type === "text") {
            fabricObject = textBoxToFabric(box, previewData, {
              width: documentWidth,
              height: documentHeight,
            });
          }

          if (box.type === "qr") {
            try {
              fabricObject = await qrBoxToFabric(box, previewData, {
                width: documentWidth,
                height: documentHeight,
              });
            } catch (error) {
              if (!cancelled) {
                console.error("Failed to create QR object:", box.id, error);
              }
              continue;
            }
          }

          if (cancelled || !fabricObject) {
            continue;
          }

          const existing = fabricCanvas
            .getObjects()
            .find((object) => {
              const data = object.get("data") as FabricCustomData | undefined;
              return data?.boxId === box.id;
            });

          if (!existing) {
            fabricCanvas.add(fabricObject);
          } else {
            fabricObject = existing;
          }
        }

        // UPDATE TEXT
        if (box.type === "text") {
          const newLeft = percentageToPixels(box.x, documentWidth);
          const newTop = percentageToPixels(box.y, documentHeight);
          const newWidth = percentageToPixels(box.width, documentWidth);
          const textValue = resolveTextVariable(box.variable, previewData);

          fabricObject.set({
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

          fabricObject.setCoords();
          continue;
        }

        // UPDATE QR
        if (box.type === "qr") {
          const objectData = fabricObject.get("data") as FabricCustomData | undefined;

          const needsQRRegeneration =
            objectData?.foregroundColor !== box.foregroundColor ||
            objectData?.backgroundColor !== box.backgroundColor ||
            objectData?.variable !== box.variable ||
            objectData?.logoUrl !== box.logoUrl;

          if (needsQRRegeneration) {
            try {
              const newFabricQR = await qrBoxToFabric(box, previewData, {
                width: documentWidth,
                height: documentHeight,
              });

              if (cancelled) {
                return;
              }

              fabricCanvas.remove(fabricObject);
              fabricCanvas.add(newFabricQR);
              fabricObject = newFabricQR;
            } catch (err) {
              console.error("Failed to regenerate QR box:", box.id, err);
            }
          }

          const qrSize = percentageToPixels(box.width, documentWidth);
          if (qrSize <= 0) {
            continue;
          }

          const currentData = fabricObject.get("data") as FabricCustomData | undefined;
          const baseWidth = currentData?.baseWidth ?? fabricObject.width ?? 0;
          const baseHeight = currentData?.baseHeight ?? fabricObject.height ?? 0;

          if (baseWidth <= 0 || baseHeight <= 0) {
            continue;
          }

          const scaleX = qrSize / baseWidth;
          const scaleY = qrSize / baseHeight;

          fabricObject.set({
            left: percentageToPixels(box.x, documentWidth),
            top: percentageToPixels(box.y, documentHeight),
            scaleX,
            scaleY,
            angle: box.rotation,
            opacity: box.opacity,
            visible: box.visible,
            selectable: !box.locked,
          });

          fabricObject.setCoords();
          continue;
        }
      }

      // REMOVE stale Fabric objects
      const templateBoxIds = new Set(template.boxes.map((box) => box.id));
      const objectsToRemove = fabricCanvas.getObjects().filter((object) => {
        const data = object.get("data") as FabricCustomData | undefined;
        if (data?.isBackground === true) {
          return false;
        }
        const boxId = data?.boxId;
        return typeof boxId === "string" && !templateBoxIds.has(boxId);
      });

      objectsToRemove.forEach((object) => {
        fabricCanvas.remove(object);
      });

      // Background always stays at index 0
      const backgroundObject = fabricCanvas
        .getObjects()
        .find((object) => {
          const data = object.get("data") as FabricCustomData | undefined;
          return data?.isBackground === true;
        });

      if (backgroundObject) {
        fabricCanvas.moveObjectTo(backgroundObject, 0);
      }

      if (!cancelled) {
        fabricCanvas.renderAll();
      }
    }

    void reconcileCanvas();

    return () => {
      cancelled = true;
    };
  }, [
    template,
    previewData,
    documentWidth,
    documentHeight,
  ]);

  // ==================================================
  // 5. Bidirectional Selection
  // ==================================================

  useEffect(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) {
      return;
    }

    const handleSelection = (event: SelectionEventPayload) => {
      const selectedObject =
        event.selected?.[0] ?? canvas.getActiveObject();

      if (!selectedObject) {
        return;
      }

      const data = selectedObject.get("data") as FabricCustomData | undefined;
      const boxId = data?.boxId;

      if (typeof boxId === "string") {
        const currentSelectedBoxId = useEditorStore.getState().selectedBoxId;
        if (currentSelectedBoxId !== boxId) {
          selectBox(boxId);
        }
      }
    };

    const handleSelectionCleared = () => {
      const currentSelectedBoxId = useEditorStore.getState().selectedBoxId;
      if (currentSelectedBoxId !== null) {
        selectBox(null);
      }
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

  useEffect(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) {
      return;
    }

    if (!selectedBoxId) {
      const currentActive = canvas.getActiveObject();
      if (currentActive) {
        canvas.discardActiveObject();
        canvas.requestRenderAll();
      }
      return;
    }

    const currentActive = canvas.getActiveObject();
    const currentActiveData = currentActive?.get("data") as FabricCustomData | undefined;
    const currentActiveBoxId = currentActiveData?.boxId;

    if (currentActiveBoxId === selectedBoxId) {
      return;
    }

    const targetObject = canvas.getObjects().find((object) => {
      const data = object.get("data") as FabricCustomData | undefined;
      return data?.boxId === selectedBoxId;
    });

    if (targetObject && targetObject.selectable !== false) {
      canvas.setActiveObject(targetObject);
      canvas.requestRenderAll();
    }
  }, [selectedBoxId]);

  // ==================================================
  // 6. Object movement / resize (Document Coordinates)
  // ==================================================

  useEffect(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) {
      return;
    }

    const handleObjectModified = (event: ObjectModifiedEventPayload) => {
      const object = event.target;
      if (!object) {
        return;
      }

      const data = object.get("data") as FabricCustomData | undefined;
      const boxId = data?.boxId;
      if (typeof boxId !== "string") {
        return;
      }

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
        const textObject = object as Textbox;
        const scaleX = textObject.scaleX ?? 1;
        const scaleY = textObject.scaleY ?? 1;
        const currentWidth = textObject.width ?? 0;
        const currentFontSize = textObject.fontSize ?? 16;

        const isScaled =
          Math.abs(scaleX - 1) > 0.0001 || Math.abs(scaleY - 1) > 0.0001;

        if (isScaled) {
          const actualWidth = currentWidth * scaleX;
          const actualFontSize = currentFontSize * scaleY;
          const widthPercentage = pixelsToPercentage(actualWidth, docWidth);

          updateBoxTransform(boxId, {
            x,
            y,
            width: widthPercentage,
          });

          updateTextBox(boxId, {
            fontSize: actualFontSize,
          });

          textObject.set({
            width: actualWidth,
            fontSize: actualFontSize,
            scaleX: 1,
            scaleY: 1,
          });
          textObject.setCoords();
        } else {
          const actualWidth = textObject.width ?? 0;
          const widthPercentage = pixelsToPercentage(actualWidth, docWidth);

          updateBoxTransform(boxId, {
            x,
            y,
            width: widthPercentage,
          });

          textObject.set({
            scaleX: 1,
            scaleY: 1,
          });
          textObject.setCoords();
        }
        return;
      }

      if (object.type === "image") {
        const objectData = object.get("data") as FabricCustomData | undefined;
        const qrBoxId = objectData?.boxId;
        if (typeof qrBoxId !== "string") {
          return;
        }

        const scaleX = object.scaleX ?? 1;
        const scaleY = object.scaleY ?? 1;
        const baseWidth = objectData?.baseWidth ?? object.width ?? 0;
        const baseHeight = objectData?.baseHeight ?? object.height ?? 0;

        if (baseWidth <= 0 || baseHeight <= 0) {
          return;
        }

        const actualWidth = baseWidth * scaleX;
        const actualHeight = baseHeight * scaleY;
        const qrSize = Math.min(actualWidth, actualHeight);
        if (qrSize <= 0) {
          return;
        }

        const qrSizePercentage = pixelsToPercentage(qrSize, docWidth);
        const normalizedScaleX = qrSize / baseWidth;
        const normalizedScaleY = qrSize / baseHeight;

        object.set({
          scaleX: normalizedScaleX,
          scaleY: normalizedScaleY,
        });
        object.setCoords();

        updateBoxTransform(qrBoxId, {
          x,
          y,
          width: qrSizePercentage,
          height: qrSizePercentage,
        });

        canvas.renderAll();
        return;
      }

      updateBoxTransform(boxId, { x, y });
    };

    canvas.on("object:modified", handleObjectModified);

    return () => {
      canvas.off("object:modified", handleObjectModified);
    };
  }, [updateBoxTransform, updateTextBox]);

  // ==================================================
  // 7. Keyboard movement (Document Coordinates)
  // ==================================================

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!selectedBoxId) {
        return;
      }

      const isArrowKey =
        event.key === "ArrowLeft" ||
        event.key === "ArrowRight" ||
        event.key === "ArrowUp" ||
        event.key === "ArrowDown";

      if (!isArrowKey) {
        return;
      }

      event.preventDefault();

      const stepPixels = event.shiftKey ? 10 : 1;
      let deltaX = 0;
      let deltaY = 0;

      switch (event.key) {
        case "ArrowLeft":
          deltaX = -stepPixels;
          break;
        case "ArrowRight":
          deltaX = stepPixels;
          break;
        case "ArrowUp":
          deltaY = -stepPixels;
          break;
        case "ArrowDown":
          deltaY = stepPixels;
          break;
      }

      const docWidth = templateRef.current.settings.canvasWidth;
      const docHeight = templateRef.current.settings.canvasHeight;

      const deltaXPercentage = pixelsToPercentage(deltaX, docWidth);
      const deltaYPercentage = pixelsToPercentage(deltaY, docHeight);

      const currentBox = templateRef.current.boxes.find(
        (box) => box.id === selectedBoxId
      );

      if (!currentBox) {
        return;
      }

      let newX = currentBox.x + deltaXPercentage;
      let newY = currentBox.y + deltaYPercentage;
      newX = Math.max(0, newX);
      newY = Math.max(0, newY);

      const fabricObject = fabricCanvasRef.current
        ?.getObjects()
        .find((object) => {
          const data = object.get("data") as FabricCustomData | undefined;
          return data?.boxId === selectedBoxId;
        });

      if (fabricObject) {
        fabricObject.set({
          left: percentageToPixels(newX, docWidth),
          top: percentageToPixels(newY, docHeight),
        });
        fabricObject.setCoords();
        fabricCanvasRef.current?.renderAll();
      }

      updateBoxTransform(selectedBoxId, {
        x: newX,
        y: newY,
      });
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [selectedBoxId, updateBoxTransform]);

  // ==================================================
  // 8. Backspace / Delete
  // ==================================================

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target) {
        return;
      }

      const tagName = target.tagName.toLowerCase();
      const isTyping =
        tagName === "input" ||
        tagName === "textarea" ||
        tagName === "select" ||
        target.isContentEditable;

      if (isTyping) {
        return;
      }

      if (event.key !== "Backspace" && event.key !== "Delete") {
        return;
      }

      const currentSelectedBoxId = useEditorStore.getState().selectedBoxId;
      if (!currentSelectedBoxId) {
        return;
      }

      event.preventDefault();
      deleteBox(currentSelectedBoxId);
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [deleteBox]);

  // ==================================================
  // 9. Full Resolution Export / Download Handler
  // ==================================================

  useEffect(() => {
    const handleExportEvent = () => {
      const canvas = fabricCanvasRef.current;
      if (!canvas) {
        return;
      }

      const activeObject = canvas.getActiveObject();
      if (activeObject) {
        canvas.discardActiveObject();
        canvas.renderAll();
      }

      const dataUrl = canvas.toDataURL({
        format: "png",
        multiplier: 1, // Exports at full canonical document resolution
      });

      if (activeObject) {
        canvas.setActiveObject(activeObject);
        canvas.renderAll();
      }

      const link = document.createElement("a");
      const safeName =
        templateRef.current.name.toLowerCase().replace(/[^a-z0-9]+/g, "-") ||
        "template";
      link.download = `${safeName}-${templateRef.current.settings.canvasWidth}x${templateRef.current.settings.canvasHeight}.png`;
      link.href = dataUrl;
      link.click();
    };

    window.addEventListener("eazy:export-canvas", handleExportEvent);

    return () => {
      window.removeEventListener("eazy:export-canvas", handleExportEvent);
    };
  }, []);

  return <canvas ref={canvasElementRef} tabIndex={0} />;
}