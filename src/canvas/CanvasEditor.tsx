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

  const selectBox = useEditorStore(
    (state) => state.selectBox
  );

  const selectedBoxId = useEditorStore(
    (state) => state.selectedBoxId
  );

  const updateBoxTransform = useEditorStore(
    (state) => state.updateBoxTransform
  );

  // 1. Fabric canvas lifecycle
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

  // 2. Render template objects
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
      const fabricText = textBoxToFabric(
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
    previewData,
    width,
    height,
  ]);

  // 3. Selection events
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
        selectedObject.get("data")?.boxId;

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

  // 4. Mouse movement and resize events
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
        object.get("data")?.boxId;

      if (typeof boxId !== "string") {
        return;
      }

      const left = object.left ?? 0;
      const top = object.top ?? 0;

      const x = pixelsToPercentage(
        left,
        width
      );

      const y = pixelsToPercentage(
        top,
        height
      );

      const changes: {
        x: number;
        y: number;
        width?: number;
      } = {
        x,
        y,
      };

      if (object.type === "textbox") {
        const scaledWidth =
          object.getScaledWidth();

        changes.width =
          pixelsToPercentage(
            scaledWidth,
            width
          );
      }

      updateBoxTransform(
        boxId,
        changes
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
    width,
    height,
  ]);

  // 5. Keyboard movement
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

      event.preventDefault();

      // Normal arrow = 1px
      // Shift + arrow = 10px
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

      // Convert pixel movement
      // into percentage movement.
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
        template.boxes.find(
          (box) => box.id === selectedBoxId
        );

      if (!currentBox) {
        return;
      }

      const newX =
        currentBox.x + deltaXPercentage;

      const newY =
        currentBox.y + deltaYPercentage;

      // Find the live Fabric object.
      const fabricObject =
        fabricCanvasRef.current
          ?.getObjects()
          .find(
            (object) =>
              object.get("data")?.boxId ===
              selectedBoxId
          );

      if (fabricObject) {
        // Convert the new percentage
        // position back into pixels.
        const newLeft =
          percentageToPixels(
            newX,
            width
          );

        const newTop =
          percentageToPixels(
            newY,
            height
          );

        // Update the live Fabric object.
        fabricObject.set({
          left: newLeft,
          top: newTop,
        });

        fabricObject.setCoords();

        fabricCanvasRef.current?.renderAll();
      }

      // Update our domain state.
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
    template,
    updateBoxTransform,
    width,
    height,
  ]);

  return (
    <canvas ref={canvasElementRef} />
  );
}