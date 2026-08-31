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
   * Keeps the latest template available to
   * keyboard handlers.
   */
  const templateRef =
    useRef<Template>(template);

  /*
   * Prevents the incremental renderer from
   * running while the initial/full renderer
   * is still creating objects.
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
      (state) =>
        state.updateBoxTransform
    );

  const updateTextBox =
    useEditorStore(
      (state) =>
        state.updateTextBox
    );

  const templateLoadVersion =
    useEditorStore(
      (state) =>
        state.templateLoadVersion
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

  // --------------------------------------------------
  // 2. Full template render
  // --------------------------------------------------

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
      fabricCanvas.clear();

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
              fabricCanvas.add(
                fabricQR
              );
            }
          } catch (error) {
            if (!cancelled) {
              console.error(
                "Failed to render QR box:",
                box.id,
                error
              );
            }
          }
        }
      }

      if (cancelled) {
        return;
      }

      // --------------------------------------------
      // Background always at index 0
      // --------------------------------------------

      const backgroundObject =
        fabricCanvas
          .getObjects()
          .find(
            (object) =>
              object
                .get("data")
                ?.isBackground === true
          );

      if (backgroundObject) {
        fabricCanvas.moveObjectTo(
          backgroundObject,
          0
        );
      }

      fabricCanvas.renderAll();

      /*
       * Only after the complete async render
       * has finished do we allow incremental
       * rendering.
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

  // --------------------------------------------------
  // 3. Sync text properties
  // --------------------------------------------------

  useEffect(() => {
    const canvas =
      fabricCanvasRef.current;

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
  }, [
    template.boxes,
  ]);

  // --------------------------------------------------
  // 4. Background image
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

    if (!backgroundUrl) {
      canvas.renderAll();
      return;
    }

    const imageUrl =
      backgroundUrl;

    let cancelled = false;

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

    const fabricCanvas = canvas;

    async function loadBackground() {
      try {
        const image =
          await Image.fromURL(
            imageUrl
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

        /*
         * Cover the complete canvas while
         * preserving aspect ratio.
         */
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

  // --------------------------------------------------
  // 5. Incrementally add NEW boxes
  // --------------------------------------------------

  useEffect(() => {
    const canvas =
      fabricCanvasRef.current;

    if (!canvas) {
      return;
    }

    /*
     * Full renderer owns initial rendering.
     */
    if (
      !initialRenderCompleteRef.current
    ) {
      return;
    }

    const fabricCanvas = canvas;

    let cancelled = false;

    async function addNewBoxes() {
      for (const box of template.boxes) {
        if (cancelled) {
          return;
        }

        if (
          box.type === "text" ||
          box.type === "qr"
        ) {
          console.log(
            "INCREMENTAL BOX CHECK:",
            box.id,
            box.type,
            box.variable
          );
        }

        // --------------------------------------------
        // Check existing object
        // --------------------------------------------

        const existingObject =
          fabricCanvas
            .getObjects()
            .find(
              (object) =>
                object
                  .get("data")
                  ?.boxId === box.id
            );

        if (existingObject) {
          continue;
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
            fabricCanvas.add(
              fabricText
            );
          }

          continue;
        }

        // --------------------------------------------
        // QR
        // --------------------------------------------

        if (box.type === "qr") {
          try {
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

            /*
             * Re-check after async QR generation.
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
              fabricCanvas.add(
                fabricQR
              );
            }
          } catch (error) {
            if (!cancelled) {
              console.error(
                "Failed to render newly added QR box:",
                box.id,
                error
              );
            }
          }
        }
      }

      if (cancelled) {
        return;
      }

      const backgroundObject =
        fabricCanvas
          .getObjects()
          .find(
            (object) =>
              object
                .get("data")
                ?.isBackground === true
          );

      if (backgroundObject) {
        fabricCanvas.moveObjectTo(
          backgroundObject,
          0
        );
      }

      fabricCanvas.renderAll();
    }

    void addNewBoxes();

    return () => {
      cancelled = true;
    };
  }, [
    template,
    previewData,
    width,
    height,
  ]);

  // --------------------------------------------------
  // 6. Sync Zustand -> Fabric objects
  // --------------------------------------------------

  useEffect(() => {
    const canvas =
      fabricCanvasRef.current;

    if (!canvas) {
      return;
    }

    template.boxes.forEach((box) => {
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

      // --------------------------------------------
      // TEXT
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
          angle: box.rotation,
          opacity: box.opacity,
          scaleX: 1,
        });

        fabricObject.setCoords();

        return;
      }

      // --------------------------------------------
      // QR
      // --------------------------------------------

      if (box.type === "qr") {
        /*
         * QR size is based on canvas WIDTH.
         *
         * This keeps the QR physically square
         * even when the canvas itself is vertical.
         */
        const qrSize =
          percentageToPixels(
            box.width,
            width
          );

        if (qrSize <= 0) {
          return;
        }

        const baseWidth =
          fabricObject.width ?? 0;

        const baseHeight =
          fabricObject.height ?? 0;

        if (
          baseWidth <= 0 ||
          baseHeight <= 0
        ) {
          return;
        }

        /*
         * Fabric QR image itself must remain square.
         */
        const scaleX =
          qrSize / baseWidth;

        const scaleY =
          qrSize / baseHeight;

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

          angle: box.rotation,

          opacity: box.opacity,

          visible: box.visible,

          selectable:
            !box.locked,
        });

        fabricObject.setCoords();

        return;
      }

      // --------------------------------------------
      // OTHER OBJECTS
      // --------------------------------------------

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

        angle: box.rotation,

        opacity: box.opacity,

        visible: box.visible,

        selectable:
          !box.locked,
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
  // 7. Selection
  // --------------------------------------------------

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

  // --------------------------------------------------
  // 8. Object movement / resize
  // --------------------------------------------------

  useEffect(() => {
    const canvas =
      fabricCanvasRef.current;

    if (!canvas) {
      return;
    }

    const handleObjectModified = (
      event: ObjectModifiedEvent
    ) => {
      const object = event.target;

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
        /*
         * Background images don't have a boxId.
         * Only editable QR/image boxes reach here.
         */
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
          object.width ?? 0;

        const baseHeight =
          object.height ?? 0;

        if (
          baseWidth <= 0 ||
          baseHeight <= 0
        ) {
          return;
        }

        // ------------------------------------------
        // Actual rendered dimensions
        // ------------------------------------------

        const actualWidth =
          baseWidth * scaleX;

        const actualHeight =
          baseHeight * scaleY;

        /*
         * QR must remain square.
         *
         * Take the smaller dimension so
         * the QR cannot become distorted.
         */
        const qrSize =
          Math.min(
            actualWidth,
            actualHeight
          );

        if (qrSize <= 0) {
          return;
        }

        /*
         * Store QR size relative to canvas WIDTH.
         *
         * This is the important part.
         *
         * width = height
         *
         * in domain space.
         */
        const qrSizePercentage =
          pixelsToPercentage(
            qrSize,
            width
          );

        /*
         * Normalize Fabric object.
         *
         * The image itself becomes square.
         */
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

        /*
         * Persist the same percentage
         * for width and height.
         *
         * Both dimensions use the canvas
         * width as their reference.
         */
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

  // --------------------------------------------------
  // 9. Keyboard movement
  // --------------------------------------------------

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