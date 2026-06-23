import { useEffect, useRef } from "react";
import type { Detection } from "../../utils/detection";

const PALETTE = [
  "#0ea5e9", "#f59e0b", "#14b8a6", "#ec4899",
  "#6366f1", "#84cc16", "#f97316", "#a855f7",
  "#ef4444", "#06b6d4", "#eab308", "#10b981",
];

/** Same label → same colour across all detections */
function buildColorMap(detections: Detection[]): Map<string, string> {
  const map = new Map<string, string>();
  let idx = 0;
  for (const d of detections) {
    const key = d.label.toLowerCase().trim();
    if (!map.has(key)) {
      map.set(key, PALETTE[idx % PALETTE.length]);
      idx++;
    }
  }
  return map;
}

interface Props {
  imageUrl: string;
  detections: Detection[];
}

export function BoundingBoxOverlay({ imageUrl, detections }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const W = img.naturalWidth;
      const H = img.naturalHeight;
      canvas.width  = W;
      canvas.height = H;

      // Draw base image (no dimming)
      ctx.drawImage(img, 0, 0);

      const colorMap = buildColorMap(detections);
      const lineW    = Math.max(2, Math.round(Math.min(W, H) / 250));
      const fontSize = Math.max(12, Math.round(Math.min(W, H) / 35));
      ctx.font = `bold ${fontSize}px Inter, system-ui, sans-serif`;

      detections.forEach((det) => {
        const color = colorMap.get(det.label.toLowerCase().trim()) ?? PALETTE[0];

        const x  = Math.round(det.x1 * W);
        const y  = Math.round(det.y1 * H);
        const bw = Math.round((det.x2 - det.x1) * W);
        const bh = Math.round((det.y2 - det.y1) * H);

        // Bounding box outline only - no fill
        ctx.strokeStyle = color;
        ctx.lineWidth   = lineW;
        ctx.strokeRect(x, y, bw, bh);

        // Label dimensions
        const labelText = det.label;
        const textW     = ctx.measureText(labelText).width;
        const padX      = 6, padY = 4;
        const pillW     = textW + padX * 2;
        const pillH     = fontSize + padY * 2;

        // Place pill at top-left of bounding box, clamped inside canvas
        const pillX = Math.max(0, x);
        const pillY = y - pillH >= 0 ? y - pillH : y;

        // Filled label box (same colour as bounding box)
        ctx.fillStyle = color;
        ctx.fillRect(pillX, pillY, pillW, pillH);

        // White label text
        ctx.fillStyle    = "#ffffff";
        ctx.textBaseline = "top";
        ctx.fillText(labelText, pillX + padX, pillY + padY);
      });

      // Reset baseline
      ctx.textBaseline = "alphabetic";
    };
    img.src = imageUrl;
  }, [imageUrl, detections]);

  return (
    <canvas
      ref={canvasRef}
      style={{ width: "100%", height: "100%", display: "block", objectFit: "contain" }}
    />
  );
}
