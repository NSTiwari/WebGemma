import { Loader2, Clock, Copy, Check, Boxes } from "lucide-react";
import { useState } from "react";
import type { InferenceStatus } from "../../types";
import { parseDetections, isDetectionOutput } from "../../utils/detection";
import { BoundingBoxOverlay } from "./BoundingBoxOverlay";

const PALETTE = [
  "#0ea5e9","#f59e0b","#14b8a6","#ec4899",
  "#6366f1","#84cc16","#f97316","#a855f7",
  "#ef4444","#06b6d4","#eab308","#10b981",
];

function uniqueLabelColors(labels: string[]): Map<string, string> {
  const map = new Map<string, string>();
  let i = 0;
  for (const l of labels) {
    const key = l.toLowerCase().trim();
    if (!map.has(key)) { map.set(key, PALETTE[i % PALETTE.length]); i++; }
  }
  return map;
}

interface OutputPanelProps {
  status: InferenceStatus;
  output: string;
  processingMs: number | null;
  error: string | null;
  imageUrl?: string;
  modelFamily?: string;
  lastPrompt?: string;
  device?: "webgpu" | "wasm" | null;
}

export function OutputPanel({
  status, output, processingMs, error, imageUrl, modelFamily, lastPrompt = "", device,
}: OutputPanelProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(output);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const family            = modelFamily ?? "";
  const canDetect         = family === "paligemma" || family === "gemma4";
  const promptWantsDetect = /\bdetect\b/i.test(lastPrompt);
  const detectMode        = canDetect && promptWantsDetect && !!imageUrl;
  const generationDone    = status === "done" ||
    (status !== "running" && status !== "idle" && status !== "loading" && output.length > 0);
  const detections        = generationDone && detectMode && isDetectionOutput(output, family)
    ? parseDetections(output, family)
    : [];
  const hasBoxes = detections.length > 0;

  // Unique colour per label (consistent with canvas drawing)
  const colorMap = uniqueLabelColors(detections.map(d => d.label));

  return (
    <div className="flex flex-col gap-3 h-full">

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-3)" }}>
            Output
          </span>
          {hasBoxes && (
            <span className="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full"
              style={{ background: "rgba(14,165,233,0.12)", color: "#0ea5e9", border: "1px solid rgba(14,165,233,0.3)" }}>
              <Boxes size={9} />
              {detections.length} object{detections.length !== 1 ? "s" : ""} detected
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {device && (
            <span className="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full"
              style={device === "webgpu"
                ? { background: "rgba(99,102,241,0.12)", color: "#6366f1", border: "1px solid rgba(99,102,241,0.3)" }
                : { background: "rgba(245,158,11,0.12)", color: "#f59e0b", border: "1px solid rgba(245,158,11,0.3)" }}>
              {device === "webgpu" ? "WebGPU" : "WASM (CPU)"}
            </span>
          )}
          {processingMs != null && (
            <span className="flex items-center gap-1 text-xs" style={{ color: "var(--text-3)" }}>
              <Clock size={10} />{(processingMs / 1000).toFixed(1)}s
            </span>
          )}
          {output && (
            <button onClick={handleCopy}
              className="flex items-center gap-1 text-xs transition-colors hover:text-sky-400"
              style={{ color: "var(--text-3)" }}>
              {copied ? <Check size={12} /> : <Copy size={12} />}
              {copied ? "Copied" : "Copy"}
            </button>
          )}
        </div>
      </div>

      {hasBoxes && imageUrl ? (
        <div className="flex-1 flex flex-col gap-3 min-h-0">

          {/* Annotated image - full width, takes all available height */}
          <div className="flex-1 rounded-xl overflow-hidden flex items-center justify-center min-h-0"
            style={{ background: "#000", border: "1px solid var(--border)" }}>
            <BoundingBoxOverlay imageUrl={imageUrl} detections={detections} />
          </div>

          {/* Legend row */}
          <div className="flex flex-wrap gap-1.5 px-1">
            {[...colorMap.entries()].map(([label, color]) => (
              <span key={label} className="flex items-center gap-1.5 text-[10px] px-2 py-0.5 rounded-md font-medium"
                style={{ background: color + "18", color, border: `1px solid ${color}40` }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: color, display: "inline-block", flexShrink: 0 }} />
                {label}
              </span>
            ))}
          </div>

          {/* Raw model output - below image, compact */}
          <div className="rounded-xl border px-4 py-3 overflow-y-auto max-h-36"
            style={{ background: "var(--bg-card)", borderColor: "var(--border)" }}>
            <p className="text-[10px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: "var(--text-3)" }}>
              Raw model output
            </p>
            <pre className="text-xs leading-relaxed whitespace-pre-wrap break-words font-mono"
              style={{ color: "var(--text-2)" }}>
              {output}
            </pre>
          </div>
        </div>

      ) : (
        <div className="flex-1 rounded-xl border p-4 overflow-y-auto min-h-[180px]"
          style={{ background: "var(--bg-card)", borderColor: "var(--border)" }}>

          {status === "idle" && (
            <div className="h-full flex flex-col items-center justify-center text-center gap-3"
              style={{ color: "var(--text-3)" }}>
              <div className="w-12 h-12 rounded-full flex items-center justify-center"
                style={{ background: "var(--bg-3)" }}>
                <span className="text-2xl" style={{ color: "var(--text-3)" }}>···</span>
              </div>
              <p className="text-sm">Load a model and run inference to see output here</p>
            </div>
          )}

          {status === "loading" && !output && (
            <div className="h-full flex items-center justify-center">
              <Loader2 size={24} className="text-sky-400 animate-spin" />
            </div>
          )}

          {status === "error" && error && (
            <div className="text-red-400 text-sm bg-red-500/10 rounded-lg p-3 border border-red-500/20">
              <p className="font-semibold mb-1">Error</p>
              <p className="text-xs font-mono leading-relaxed">{error}</p>
            </div>
          )}

          {/* Detection mode while generating - hide streaming tokens, show spinner */}
          {detectMode && status === "running" && (
            <div className="h-full flex flex-col items-center justify-center gap-3"
              style={{ color: "var(--text-3)" }}>
              <Loader2 size={24} className="text-sky-400 animate-spin" />
              <p className="text-sm">Detecting objects…</p>
            </div>
          )}

          {/* Detection mode done but no boxes parsed - show raw model output */}
          {detectMode && status !== "running" && output && !hasBoxes && (
            <div className="prose-gemma text-sm leading-relaxed whitespace-pre-wrap"
              style={{ color: "var(--text)" }}>
              {output}
            </div>
          )}

          {/* Normal streaming output (non-detection) */}
          {!detectMode && (output || status === "running") && (
            <div className="prose-gemma text-sm leading-relaxed whitespace-pre-wrap"
              style={{ color: "var(--text)" }}>
              {output}
              {status === "running" && (
                <span className="inline-block w-2 h-4 bg-sky-400 ml-0.5 animate-pulse rounded-sm align-middle" />
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
