import { useEffect, useRef } from "react";
import {
  Canvas,
  Image,
  Textbox,
  type FabricObject,
} from "fabric";

import type { Template } from "../domain/template/template.types";
import type { PreviewData } from "../domain/variables/preview.types";

import { useEditorStore } from "../store/editorStore";

import {
  percentageToPixels,
  pixelsToPercentage,
  textBoxToFabric,
  qrBoxToFabric,
} from "./CanvasAdapter";

interface CanvasEditorProps {
  width: number;
  height: number;
  template: Template;
  previewData: PreviewData;
}

interface SelectionEvent {
  selected?: FabricObject[];
}

interface ObjectModifiedEvent {
  target?: FabricObject;
}

export function CanvasEditor({
  width,
  height,
  template,
  previewData,
}: CanvasEditorProps) {
  const canvasElementRef =
    useRef<HTMLCanvasElement | null>(null);

  const fabricCanvasRef =
    useRef<Canvas | null>(null);

  /*
   * Always keep the latest template available
   * to keyboard/event handlers.
   */
  const templateRef =
    useRef<Template>(template);

  /*
   * Prevents incremental reconciliation from
   * running before the initial render finishes.
   */
  const initialRenderCompleteRef =
    useRef(false);

  useEffect(() => {
    templateRef.current = template;
  }, [template]);

  const selectBox = useEditorStore(
    (state) => state.selectBox
  );

  const selectedBoxId = useEditorStore(
    (state) => state.selectedBoxId
  );

  const updateBoxTransform =
    useEditorStore(
      (state) => state.updateBoxTransform
    );

  const updateTextBox =
    useEditorStore(
      (state) => state.updateTextBox
    );

  const deleteBox =
    useEditorStore(
      (state) => state.deleteBox
    );

  const templateLoadVersion =
    useEditorStore(
      (state) => state.templateLoadVersion
    );

  const temporaryBackgroundImageUrl =
    useEditorStore(
      (state) =>
        state.temporaryBackgroundImageUrl
    );

  // ==================================================
  // 1. Fabric canvas lifecycle
  // ==================================================

  useEffect(() => {
    if (!canvasElementRef.current) {
      return;
    }

    const canvas = new Canvas(
      canvasElementRef.current,
      {
        width,
        height,
      }
    );

    fabricCanvasRef.current = canvas;

    initialRenderCompleteRef.current =
      false;

    return () => {
      canvas.dispose();

      fabricCanvasRef.current =
        null;

      initialRenderCompleteRef.current =
        false;
    };
  }, [width, height]);

  // ==================================================
  // 2. Full template render
  //
  // IMPORTANT:
  // We remove ONLY template objects.
  //
  // Background is managed separately and must
  // survive Undo / Redo / template replacement.
  // ==================================================

  useEffect(() => {
    const canvas =
      fabricCanvasRef.current;

    if (!canvas) {
      return;
    }

    const fabricCanvas = canvas;

    initialRenderCompleteRef.current =
      false;

    let cancelled = false;

    async function renderTemplate() {
      console.log(
        "FULL RENDER START",
        {
          templateLoadVersion,
          boxes:
            template.boxes.map(
              (box) => ({
                id: box.id,
                type: box.type,
                variable:
                  "variable" in box
                    ? box.variable
                    : undefined,
              })
            ),
        }
      );

      // ----------------------------------------------
      // Remove only template objects.
      //
      // NEVER remove background.
      // ----------------------------------------------

      const objectsToRemove =
        fabricCanvas
          .getObjects()
          .filter((object) => {
            const data =
              object.get("data");

            return (
              data?.isBackground !== true
            );
          });

      objectsToRemove.forEach(
        (object) => {
          fabricCanvas.remove(
            object
          );
        }
      );

      // ----------------------------------------------
      // Render every template box
      // ----------------------------------------------

      for (const box of template.boxes) {
        if (cancelled) {
          return;
        }

        // --------------------------------------------
        // TEXT
        // --------------------------------------------

        if (box.type === "text") {
          const fabricText =
            textBoxToFabric(
              box,
              previewData,
              {
                width,
                height,
              }
            );

          if (cancelled) {
            return;
          }

          fabricCanvas.add(
            fabricText
          );

          continue;
        }

        // --------------------------------------------
        // QR
        // --------------------------------------------

        if (box.type === "qr") {
          try {
            console.log(
              "CREATING QR",
              {
                boxId: box.id,
                variable:
                  box.variable,
              }
            );

            const fabricQR =
              await qrBoxToFabric(
                box,
                previewData,
                {
                  width,
                  height,
                }
              );

            if (cancelled) {
              return;
            }

            console.log(
              "QR CREATED",
              {
                boxId: box.id,
                fabricQR,
              }
            );

            /*
             * Extra duplicate protection.
             *
             * QR creation is asynchronous, so check
             * immediately before adding.
             */
            const alreadyExists =
              fabricCanvas
                .getObjects()
                .some(
                  (object) =>
                    object
                      .get("data")
                      ?.boxId ===
                    box.id
                );

            if (!alreadyExists) {
              console.log(
                "ADDING QR TO CANVAS",
                box.id
              );

              fabricCanvas.add(
                fabricQR
              );
            }

            continue;
          } catch (error) {
            if (!cancelled) {
              console.error(
                "Failed to render QR box:",
                box.id,
                error
              );
            }

            continue;
          }
        }
      }

      if (cancelled) {
        return;
      }

      // ----------------------------------------------
      // Keep background at index 0
      // ----------------------------------------------

      const backgroundObject =
        fabricCanvas
          .getObjects()
          .find(
            (object) =>
              object
                .get("data")
                ?.isBackground ===
              true
          );

      if (backgroundObject) {
        fabricCanvas.moveObjectTo(
          backgroundObject,
          0
        );
      }

      fabricCanvas.renderAll();

      /*
       * Only after the async render is completely
       * finished do we allow reconciliation.
       */
      initialRenderCompleteRef.current =
        true;
    }

    void renderTemplate();

    return () => {
      cancelled = true;

      initialRenderCompleteRef.current =
        false;
    };
  }, [
    templateLoadVersion,
    previewData,
    width,
    height,
  ]);

// ==================================================
// Background image
//
// Background is an independent Fabric object.
// It must survive template Undo / Redo.
// ==================================================

  useEffect(() => {
    const canvas =
      fabricCanvasRef.current;

    if (!canvas) {
      return;
    }

    const backgroundUrl =
      temporaryBackgroundImageUrl ??
      template.background.imageUrl;

    // ----------------------------------------------
    // No background
    // ----------------------------------------------

    if (!backgroundUrl) {
      const existingBackground =
        canvas
          .getObjects()
          .find(
            (object) =>
              object
                .get("data")
                ?.isBackground === true
          );

      if (existingBackground) {
        canvas.remove(
          existingBackground
        );
      }

      canvas.renderAll();

      return;
    }

    // ----------------------------------------------
    // Important:
    // Capture the already-narrowed values.
    // ----------------------------------------------

    const fabricCanvas: Canvas = canvas;
    const resolvedBackgroundUrl: string =
      backgroundUrl;

    let cancelled = false;

    // ----------------------------------------------
    // Remove existing background
    // ----------------------------------------------

    const existingBackground =
      fabricCanvas
        .getObjects()
        .find(
          (object) =>
            object
              .get("data")
              ?.isBackground === true
        );

    if (existingBackground) {
      fabricCanvas.remove(
        existingBackground
      );
    }

    // ----------------------------------------------
    // Load background
    // ----------------------------------------------

    async function loadBackground() {
      try {
        const image =
          await Image.fromURL(
            resolvedBackgroundUrl
          );

        if (cancelled) {
          return;
        }

        const imageWidth =
          image.width ?? width;

        const imageHeight =
          image.height ?? height;

        if (
          imageWidth <= 0 ||
          imageHeight <= 0
        ) {
          return;
        }

        // ------------------------------------------
        // Scale image to cover canvas
        // ------------------------------------------

        const scaleX =
          width / imageWidth;

        const scaleY =
          height / imageHeight;

        const scale =
          Math.max(
            scaleX,
            scaleY
          );

        image.set({
          left: 0,
          top: 0,

          scaleX: scale,
          scaleY: scale,

          selectable: false,
          evented: false,

          originX: "left",
          originY: "top",

          data: {
            isBackground: true,
          },
        });

        if (cancelled) {
          return;
        }

        // ------------------------------------------
        // Prevent duplicate background
        // ------------------------------------------

        const duplicateBackground =
          fabricCanvas
            .getObjects()
            .find(
              (object) =>
                object
                  .get("data")
                  ?.isBackground === true
            );

        if (duplicateBackground) {
          fabricCanvas.remove(
            duplicateBackground
          );
        }

        // ------------------------------------------
        // Add background
        // ------------------------------------------

        fabricCanvas.add(image);

        fabricCanvas.moveObjectTo(
          image,
          0
        );

        fabricCanvas.renderAll();
      } catch (error) {
        if (!cancelled) {
          console.error(
            "Failed to load background image:",
            error
          );
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
    width,
    height,
  ]);

  // ==================================================
  // 4. Reconcile Zustand -> Fabric
  //
  // Handles:
  //   ADD
  //   UPDATE
  //   REMOVE
  //
  // This is for normal document changes.
  // ==================================================

  useEffect(() => {
    const canvas =
      fabricCanvasRef.current;

    if (!canvas) {
      return;
    }

    if (
      !initialRenderCompleteRef.current
    ) {
      return;
    }

    const fabricCanvas = canvas;

    let cancelled = false;

    async function reconcileCanvas() {
      // ----------------------------------------------
      // Current Fabric objects
      // ----------------------------------------------

      const fabricObjectMap =
        new Map<
          string,
          FabricObject
        >();

      fabricCanvas
        .getObjects()
        .forEach(
          (object) => {
            const boxId =
              object
                .get("data")
                ?.boxId;

            if (
              typeof boxId ===
              "string"
            ) {
              fabricObjectMap.set(
                boxId,
                object
              );
            }
          }
        );

      // ----------------------------------------------
      // ADD / UPDATE
      // ----------------------------------------------

      for (const box of template.boxes) {
        if (cancelled) {
          return;
        }

        let fabricObject =
          fabricObjectMap.get(
            box.id
          );

        // --------------------------------------------
        // ADD missing object
        // --------------------------------------------

        if (!fabricObject) {
          if (box.type === "text") {
            fabricObject =
              textBoxToFabric(
                box,
                previewData,
                {
                  width,
                  height,
                }
              );
          }

          if (box.type === "qr") {
            try {
              fabricObject =
                await qrBoxToFabric(
                  box,
                  previewData,
                  {
                    width,
                    height,
                  }
                );
            } catch (error) {
              if (!cancelled) {
                console.error(
                  "Failed to create QR object:",
                  box.id,
                  error
                );
              }

              continue;
            }
          }

          if (cancelled) {
            return;
          }

          if (!fabricObject) {
            continue;
          }

          /*
           * QR generation is async.
           *
           * Check again before adding.
           */
          const existing =
            fabricCanvas
              .getObjects()
              .find(
                (object) =>
                  object
                    .get("data")
                    ?.boxId ===
                  box.id
              );

          if (!existing) {
            fabricCanvas.add(
              fabricObject
            );

            fabricObject =
              fabricObject;
          } else {
            fabricObject =
              existing;
          }
        }

        // --------------------------------------------
        // UPDATE TEXT
        // --------------------------------------------

        if (box.type === "text") {
          const newLeft =
            percentageToPixels(
              box.x,
              width
            );

          const newTop =
            percentageToPixels(
              box.y,
              height
            );

          const newWidth =
            percentageToPixels(
              box.width,
              width
            );

          fabricObject.set({
            left: newLeft,
            top: newTop,
            width: newWidth,

            angle:
              box.rotation,

            opacity:
              box.opacity,

            visible:
              box.visible,

            selectable:
              !box.locked,

            fontSize:
              box.fontSize,

            fontFamily:
              box.fontFamily,

            fontWeight:
              box.fontWeight,

            fill:
              box.color,

            textAlign:
              box.textAlign,

            scaleX: 1,
          });

          fabricObject.setCoords();

          continue;
        }

        // --------------------------------------------
        // UPDATE QR
        // --------------------------------------------

        if (box.type === "qr") {
          const qrSize =
            percentageToPixels(
              box.width,
              width
            );

          if (qrSize <= 0) {
            continue;
          }

          const objectData =
            fabricObject.get("data");

          const baseWidth =
            objectData?.baseWidth ?? fabricObject.width ?? 0;

          const baseHeight =
            objectData?.baseHeight ?? fabricObject.height ?? 0;

          if (
            baseWidth <= 0 ||
            baseHeight <= 0
          ) {
            continue;
          }

          const scaleX =
            qrSize /
            baseWidth;

          const scaleY =
            qrSize /
            baseHeight;

          fabricObject.set({
            left:
              percentageToPixels(
                box.x,
                width
              ),

            top:
              percentageToPixels(
                box.y,
                height
              ),

            scaleX,
            scaleY,

            angle:
              box.rotation,

            opacity:
              box.opacity,

            visible:
              box.visible,

            selectable:
              !box.locked,
          });

          fabricObject.setCoords();

          continue;
        }
      }

      // ----------------------------------------------
      // REMOVE stale Fabric objects
      // ----------------------------------------------

      const templateBoxIds =
        new Set(
          template.boxes.map(
            (box) => box.id
          )
        );

      const objectsToRemove =
        fabricCanvas
          .getObjects()
          .filter(
            (object) => {
              const data =
                object.get("data");

              if (
                data?.isBackground ===
                true
              ) {
                return false;
              }

              const boxId =
                data?.boxId;

              return (
                typeof boxId ===
                  "string" &&
                !templateBoxIds.has(
                  boxId
                )
              );
            }
          );

      objectsToRemove.forEach(
        (object) => {
          fabricCanvas.remove(
            object
          );
        }
      );

      // ----------------------------------------------
      // Background always stays first
      // ----------------------------------------------

      const backgroundObject =
        fabricCanvas
          .getObjects()
          .find(
            (object) =>
              object
                .get("data")
                ?.isBackground ===
              true
          );

      if (backgroundObject) {
        fabricCanvas.moveObjectTo(
          backgroundObject,
          0
        );
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
    width,
    height,
  ]);

  // ==================================================
  // 5. Selection
  // ==================================================

  useEffect(() => {
    const canvas =
      fabricCanvasRef.current;

    if (!canvas) {
      return;
    }

    const handleSelection = (
      event: SelectionEvent
    ) => {
      const selectedObject =
        event.selected?.[0];

      if (!selectedObject) {
        return;
      }

      const boxId =
        selectedObject
          .get("data")
          ?.boxId;

      if (
        typeof boxId === "string"
      ) {
        selectBox(boxId);
      }
    };

    const handleSelectionCleared =
      () => {
        selectBox(null);
      };

    canvas.on(
      "selection:created",
      handleSelection
    );

    canvas.on(
      "selection:updated",
      handleSelection
    );

    canvas.on(
      "selection:cleared",
      handleSelectionCleared
    );

    return () => {
      canvas.off(
        "selection:created",
        handleSelection
      );

      canvas.off(
        "selection:updated",
        handleSelection
      );

      canvas.off(
        "selection:cleared",
        handleSelectionCleared
      );
    };
  }, [selectBox]);

  // ==================================================
  // 6. Object movement / resize
  // ==================================================

  useEffect(() => {
    const canvas =
      fabricCanvasRef.current;

    if (!canvas) {
      return;
    }

    const handleObjectModified = (
      event: ObjectModifiedEvent
    ) => {
      const object =
        event.target;

      if (!object) {
        return;
      }

      const boxId =
        object
          .get("data")
          ?.boxId;

      if (
        typeof boxId !== "string"
      ) {
        return;
      }

      // --------------------------------------------
      // POSITION
      // --------------------------------------------

      let x =
        pixelsToPercentage(
          object.left ?? 0,
          width
        );

      let y =
        pixelsToPercentage(
          object.top ?? 0,
          height
        );

      x = Math.max(0, x);
      y = Math.max(0, y);

      object.set({
        left:
          percentageToPixels(
            x,
            width
          ),

        top:
          percentageToPixels(
            y,
            height
          ),
      });

      object.setCoords();

      // --------------------------------------------
      // TEXTBOX
      // --------------------------------------------

      if (
        object.type === "textbox"
      ) {
        const textObject =
          object as Textbox;

        const scaleX =
          textObject.scaleX ?? 1;

        const scaleY =
          textObject.scaleY ?? 1;

        const currentWidth =
          textObject.width ?? 0;

        const currentFontSize =
          textObject.fontSize ?? 16;

        const isScaled =
          Math.abs(
            scaleX - 1
          ) > 0.0001 ||
          Math.abs(
            scaleY - 1
          ) > 0.0001;

        if (isScaled) {
          const actualWidth =
            currentWidth *
            scaleX;

          const actualFontSize =
            currentFontSize *
            scaleY;

          const widthPercentage =
            pixelsToPercentage(
              actualWidth,
              width
            );

          updateBoxTransform(
            boxId,
            {
              x,
              y,
              width:
                widthPercentage,
            }
          );

          updateTextBox(
            boxId,
            {
              fontSize:
                actualFontSize,
            }
          );

          textObject.set({
            width:
              actualWidth,

            fontSize:
              actualFontSize,

            scaleX: 1,
            scaleY: 1,
          });

          textObject.setCoords();
        } else {
          const actualWidth =
            textObject.width ?? 0;

          const widthPercentage =
            pixelsToPercentage(
              actualWidth,
              width
            );

          updateBoxTransform(
            boxId,
            {
              x,
              y,
              width:
                widthPercentage,
            }
          );

          textObject.set({
            scaleX: 1,
            scaleY: 1,
          });

          textObject.setCoords();
        }

        return;
      }

      // --------------------------------------------
      // QR BOX
      // --------------------------------------------

      if (
        object.type === "image"
      ) {
        const objectData =
          object.get("data");

        const qrBoxId =
          objectData?.boxId;

        if (
          typeof qrBoxId !==
          "string"
        ) {
          return;
        }

        const scaleX =
          object.scaleX ?? 1;

        const scaleY =
          object.scaleY ?? 1;

        const baseWidth =
          objectData?.baseWidth ?? object.width ?? 0;

        const baseHeight =
          objectData?.baseHeight ?? object.height ?? 0;

        if (
          baseWidth <= 0 ||
          baseHeight <= 0
        ) {
          return;
        }

        const actualWidth =
          baseWidth * scaleX;

        const actualHeight =
          baseHeight * scaleY;

        const qrSize =
          Math.min(
            actualWidth,
            actualHeight
          );

        if (qrSize <= 0) {
          return;
        }

        const qrSizePercentage =
          pixelsToPercentage(
            qrSize,
            width
          );

        const normalizedScaleX =
          qrSize /
          baseWidth;

        const normalizedScaleY =
          qrSize /
          baseHeight;

        object.set({
          scaleX:
            normalizedScaleX,

          scaleY:
            normalizedScaleY,
        });

        object.setCoords();

        updateBoxTransform(
          qrBoxId,
          {
            x,
            y,

            width:
              qrSizePercentage,

            height:
              qrSizePercentage,
          }
        );

        canvas.renderAll();

        return;
      }

      // --------------------------------------------
      // OTHER OBJECTS
      // --------------------------------------------

      updateBoxTransform(
        boxId,
        {
          x,
          y,
        }
      );
    };

    canvas.on(
      "object:modified",
      handleObjectModified
    );

    return () => {
      canvas.off(
        "object:modified",
        handleObjectModified
      );
    };
  }, [
    updateBoxTransform,
    updateTextBox,
    width,
    height,
  ]);

  // ==================================================
  // 7. Keyboard movement
  // ==================================================

  useEffect(() => {
    const handleKeyDown = (
      event: KeyboardEvent
    ) => {
      if (!selectedBoxId) {
        return;
      }

      const isArrowKey =
        event.key ===
          "ArrowLeft" ||
        event.key ===
          "ArrowRight" ||
        event.key ===
          "ArrowUp" ||
        event.key ===
          "ArrowDown";

      if (!isArrowKey) {
        return;
      }

      event.preventDefault();

      const stepPixels =
        event.shiftKey
          ? 10
          : 1;

      let deltaX = 0;
      let deltaY = 0;

      switch (event.key) {
        case "ArrowLeft":
          deltaX =
            -stepPixels;
          break;

        case "ArrowRight":
          deltaX =
            stepPixels;
          break;

        case "ArrowUp":
          deltaY =
            -stepPixels;
          break;

        case "ArrowDown":
          deltaY =
            stepPixels;
          break;
      }

      const deltaXPercentage =
        pixelsToPercentage(
          deltaX,
          width
        );

      const deltaYPercentage =
        pixelsToPercentage(
          deltaY,
          height
        );

      const currentBox =
        templateRef.current.boxes.find(
          (box) =>
            box.id ===
            selectedBoxId
        );

      if (!currentBox) {
        return;
      }

      let newX =
        currentBox.x +
        deltaXPercentage;

      let newY =
        currentBox.y +
        deltaYPercentage;

      newX = Math.max(
        0,
        newX
      );

      newY = Math.max(
        0,
        newY
      );

      const fabricObject =
        fabricCanvasRef.current
          ?.getObjects()
          .find(
            (object) =>
              object
                .get("data")
                ?.boxId ===
              selectedBoxId
          );

      if (fabricObject) {
        fabricObject.set({
          left:
            percentageToPixels(
              newX,
              width
            ),

          top:
            percentageToPixels(
              newY,
              height
            ),
        });

        fabricObject.setCoords();

        fabricCanvasRef.current
          ?.renderAll();
      }

      updateBoxTransform(
        selectedBoxId,
        {
          x: newX,
          y: newY,
        }
      );
    };

    window.addEventListener(
      "keydown",
      handleKeyDown
    );

    return () => {
      window.removeEventListener(
        "keydown",
        handleKeyDown
      );
    };
  }, [
    selectedBoxId,
    updateBoxTransform,
    width,
    height,
  ]);

  // ==================================================
  // 8. Backspace / Delete
  // ==================================================

  useEffect(() => {
    const handleKeyDown = (
      event: KeyboardEvent
    ) => {
      const target =
        event.target as
          | HTMLElement
          | null;

      if (!target) {
        return;
      }

      const tagName =
        target.tagName.toLowerCase();

      const isTyping =
        tagName === "input" ||
        tagName === "textarea" ||
        tagName === "select" ||
        target.isContentEditable;

      if (isTyping) {
        return;
      }

      if (
        event.key !==
          "Backspace" &&
        event.key !==
          "Delete"
      ) {
        return;
      }

      const currentSelectedBoxId =
        useEditorStore
          .getState()
          .selectedBoxId;

      if (!currentSelectedBoxId) {
        return;
      }

      event.preventDefault();

      deleteBox(
        currentSelectedBoxId
      );
    };

    window.addEventListener(
      "keydown",
      handleKeyDown
    );

    return () => {
      window.removeEventListener(
        "keydown",
        handleKeyDown
      );
    };
  }, [deleteBox]);

  return (
    <canvas
      ref={canvasElementRef}
      tabIndex={0}
    />
  );
}