import { useEffect, useRef } from "react";
import { Canvas, Image } from "fabric";

import type { Template } from "../domain/template/template.types";
import type { PreviewData } from "../domain/variables/preview.types";
import { useEditorStore } from "../store/editorStore";

import {
  percentageToPixels,
  pixelsToPercentage,
  textBoxToFabric,
} from "./CanvasAdapter";

interface CanvasEditorProps {
  width: number;
  height: number;
  template: Template;
  previewData: PreviewData;
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

  const templateRef =
    useRef<Template>(template);

  useEffect(() => {
    templateRef.current = template;
  }, [template]);

  const selectBox = useEditorStore(
    (state) => state.selectBox
  );

  const selectedBoxId = useEditorStore(
    (state) => state.selectedBoxId
  );

  const updateBoxTransform = useEditorStore(
    (state) => state.updateBoxTransform
  );

  const updateTextBox = useEditorStore(
    (state) => state.updateTextBox
  );

  const templateLoadVersion = useEditorStore(
    (state) => state.templateLoadVersion
  );

  const temporaryBackgroundImageUrl =
  useEditorStore(
    (state) =>
      state.temporaryBackgroundImageUrl
  );

  // --------------------------------------------------
  // 1. Fabric canvas lifecycle
  // --------------------------------------------------

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

    return () => {
      canvas.dispose();
      fabricCanvasRef.current = null;
    };
  }, [width, height]);

  // --------------------------------------------------
  // 2. Render template objects
  //
  // IMPORTANT:
  // This effect is ONLY for loading/rebuilding
  // Fabric objects.
  //
  // Do NOT depend on `template` here.
  // --------------------------------------------------

  useEffect(() => {
    const canvas = fabricCanvasRef.current;

    if (!canvas) {
      return;
    }

    canvas.clear();

    const textBoxes = template.boxes.filter(
      (box) => box.type === "text"
    );

    textBoxes.forEach((box) => {
      const fabricText =
        textBoxToFabric(
          box,
          previewData,
          {
            width,
            height,
          }
        );

      canvas.add(fabricText);
    });

    canvas.renderAll();
  }, [
    templateLoadVersion,
    previewData,
    width,
    height,
  ]);

  // --------------------------------------------------
    // 2.5. Sync template properties to existing Fabric objects
    // --------------------------------------------------

    useEffect(() => {
    const canvas = fabricCanvasRef.current;

    if (!canvas) {
        return;
    }

    template.boxes.forEach((box) => {
        if (box.type !== "text") {
        return;
        }

        const fabricObject = canvas
        .getObjects()
        .find(
            (object) =>
            object.get("data")?.boxId === box.id
        );

        if (!fabricObject) {
        return;
        }

        fabricObject.set({
        fontSize: box.fontSize,
        fontFamily: box.fontFamily,
        fontWeight: box.fontWeight,
        fill: box.color,
        textAlign: box.textAlign,
        });

        fabricObject.setCoords();
    });

    canvas.renderAll();
    }, [template]);

// --------------------------------------------------
// 2.1. Sync background image
//
// IMPORTANT:
// This effect only changes the background.
// It does NOT rebuild the template objects.
// --------------------------------------------------

  useEffect(() => {
    const canvas =
        fabricCanvasRef.current;

    if (!canvas) {
        return;
    }

    const backgroundUrl =
        temporaryBackgroundImageUrl ??
        template.background.imageUrl;

    let cancelled = false;

    const existingBackground =
        canvas
        .getObjects()
        .find(
            (object) =>
            object.get("data")?.isBackground === true
        );

    if (existingBackground) {
        canvas.remove(existingBackground);
    }

    if (!backgroundUrl) {
        canvas.renderAll();
        return;
    }

    // At this point TypeScript knows that
    // backgroundUrl is a string.
    const imageUrl: string =
        backgroundUrl;

    // Keep a stable reference to the
    // already-validated Fabric canvas.
    const fabricCanvas = canvas;

    async function loadBackground() {
        try {
        const image =
            await Image.fromURL(imageUrl);

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

        const scaleX =
            width / imageWidth;

        const scaleY =
            height / imageHeight;

        const scale =
            Math.max(scaleX, scaleY);

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

        fabricCanvas.add(image);

        fabricCanvas.sendObjectToBack(
            image
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

    loadBackground();

    return () => {
        cancelled = true;
    };
    }, [
    temporaryBackgroundImageUrl,
    template.background.imageUrl,
    width,
    height,
    ]);


  // --------------------------------------------------
  // 3. Sync Zustand -> existing Fabric objects
  //
  // This is used by the Properties Panel.
  //
  // IMPORTANT:
  // We DO NOT call canvas.clear().
  // We update existing Fabric objects in place.
  // --------------------------------------------------

  useEffect(() => {
    const canvas = fabricCanvasRef.current;

    if (!canvas) {
      return;
    }

    template.boxes.forEach((box) => {
      if (box.type !== "text") {
        return;
      }

      const fabricObject =
        canvas
          .getObjects()
          .find(
            (object) =>
              object
                .get("data")
                ?.boxId === box.id
          );

      if (!fabricObject) {
        return;
      }

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
        angle: box.rotation,
        opacity: box.opacity,
        scaleX: 1,
      });

      fabricObject.setCoords();
    });

    canvas.renderAll();
  }, [
    template,
    width,
    height,
  ]);

  // --------------------------------------------------
  // 4. Selection events
  // --------------------------------------------------

  useEffect(() => {
    const canvas = fabricCanvasRef.current;

    if (!canvas) {
      return;
    }

    const handleSelection = (
      event: any
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

      if (typeof boxId === "string") {
        selectBox(boxId);
      }
    };

    const handleSelectionCleared = () => {
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

  // --------------------------------------------------
  // 5. Mouse movement + resize
  // --------------------------------------------------

  useEffect(() => {
    const canvas = fabricCanvasRef.current;

    if (!canvas) {
      return;
    }

    const handleObjectModified = (
      event: any
    ) => {
      const object = event.target;

      if (!object) {
        return;
      }

      const boxId =
        object
          .get("data")
          ?.boxId;

      if (typeof boxId !== "string") {
        return;
      }

      // ----------------------------------------------
      // POSITION
      // ----------------------------------------------

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
        left: percentageToPixels(
          x,
          width
        ),
        top: percentageToPixels(
          y,
          height
        ),
      });

      object.setCoords();

      // ----------------------------------------------
      // TEXTBOX RESIZE
      // ----------------------------------------------

      if (
        object.type === "textbox"
      ) {
        const scaleX =
          object.scaleX ?? 1;

        const scaleY =
          object.scaleY ?? 1;

        const currentWidth =
          object.width ?? 0;

        const currentFontSize =
          object.fontSize ?? 16;

        const isScaled =
          Math.abs(scaleX - 1) > 0.0001 ||
          Math.abs(scaleY - 1) > 0.0001;

        if (isScaled) {
          // ------------------------------------------
          // CORNER HANDLE RESIZE
          // ------------------------------------------

          const actualWidth =
            currentWidth * scaleX;

          const actualFontSize =
            currentFontSize * scaleY;

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
              width: widthPercentage,
            }
          );

          updateTextBox(
            boxId,
            {
              fontSize:
                actualFontSize,
            }
          );

          // Remove Fabric's temporary scale.
          object.set({
            width: actualWidth,
            fontSize:
              actualFontSize,
            scaleX: 1,
            scaleY: 1,
          });

          object.setCoords();
        } else {
          // ------------------------------------------
          // SIDE HANDLE RESIZE
          // ------------------------------------------

          const actualWidth =
            object.width ?? 0;

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
              width: widthPercentage,
            }
          );

          // Keep the normalized state.
          object.set({
            scaleX: 1,
            scaleY: 1,
          });

          object.setCoords();
        }

        if (
          boxId === "box-discount"
        ) {
          console.log(
            "DISCOUNT RESIZE",
            {
              widthPercentage:
                pixelsToPercentage(
                  object.width ?? 0,
                  width
                ),
              fontSize:
                object.fontSize,
              scaleX:
                object.scaleX,
              scaleY:
                object.scaleY,
            }
          );
        }
      } else {
        // --------------------------------------------
        // NON-TEXTBOX TRANSFORM
        // --------------------------------------------

        updateBoxTransform(
          boxId,
          {
            x,
            y,
          }
        );
      }
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

  // --------------------------------------------------
  // 6. Keyboard movement
  // --------------------------------------------------

  useEffect(() => {
    const handleKeyDown = (
      event: KeyboardEvent
    ) => {
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

      // Prevent browser scrolling.
      event.preventDefault();

      const stepPixels =
        event.shiftKey ? 10 : 1;

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

      // Always use the latest template.
      const currentBox =
        templateRef.current.boxes.find(
          (box) =>
            box.id === selectedBoxId
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

      newX = Math.max(0, newX);
      newY = Math.max(0, newY);

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

        fabricCanvasRef.current?.renderAll();
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

  return (
    <canvas
      ref={canvasElementRef}
      tabIndex={0}
    />
  );
}