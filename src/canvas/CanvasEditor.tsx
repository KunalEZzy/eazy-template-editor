import { useEffect, useRef } from "react";
import { Canvas } from "fabric";

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
  // 3. Selection events
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
  // 4. Mouse movement + resize
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
      // POSITION CHANGES
      // ----------------------------------------------

      updateBoxTransform(
        boxId,
        {
          x,
          y,
        }
      );

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

        /*
         * Fabric resizing can happen in
         * two different ways.
         *
         * SIDE HANDLE:
         *
         *   width changes
         *   scaleX ~= 1
         *   scaleY ~= 1
         *
         * CORNER HANDLE:
         *
         *   width stays roughly the same
         *   scaleX changes
         *   scaleY changes
         *
         * We normalize both cases.
         */

        const isScaled =
          Math.abs(scaleX - 1) > 0.0001 ||
          Math.abs(scaleY - 1) > 0.0001;

        if (isScaled) {
          /*
           * Corner resize.
           *
           * Convert Fabric scale into
           * actual application dimensions.
           */

          const actualWidth =
            currentWidth * scaleX;

          const actualFontSize =
            currentFontSize * scaleY;

          const widthPercentage =
            pixelsToPercentage(
              actualWidth,
              width
            );

          /*
           * Persist width.
           */
          updateBoxTransform(
            boxId,
            {
              x,
              y,
              width: widthPercentage,
            }
          );

          /*
           * Persist visual font size.
           */
          updateTextBox(
            boxId,
            {
              fontSize:
                actualFontSize,
            }
          );

          /*
           * Normalize Fabric.
           *
           * After this Fabric has no
           * hidden scale.
           */
          object.set({
            width: actualWidth,
            fontSize:
              actualFontSize,
            scaleX: 1,
            scaleY: 1,
          });

          object.setCoords();
        } else {
          /*
           * Side resize.
           *
           * Fabric has already changed
           * the textbox width.
           *
           * Font size stays unchanged.
           */

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

          object.set({
            scaleX: 1,
            scaleY: 1,
          });

          object.setCoords();
        }

        // --------------------------------------------
        // Diagnostic
        // --------------------------------------------

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
// 5. Keyboard movement
// --------------------------------------------------

// --------------------------------------------------
// 5. Keyboard movement
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

        // Stop browser page scrolling.
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

        // IMPORTANT:
        // Always read the latest template.
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
      tabIndex = {0}
    />
  );
}