import { useEffect, useRef } from "react";
import { Canvas } from "fabric";

interface CanvasEditorProps {
  width: number;
  height: number;
}

export function CanvasEditor({
  width,
  height,
}: CanvasEditorProps) {
  const canvasElementRef =
    useRef<HTMLCanvasElement | null>(null);

  const fabricCanvasRef =
    useRef<Canvas | null>(null);

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

  return (
    <canvas
      ref={canvasElementRef}
    />
  );
}