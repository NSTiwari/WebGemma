import { Download, CheckCircle, Loader2, RefreshCw } from "lucide-react";
import { ProgressBar } from "../ui/ProgressBar";
import type { ModelConfig, InferenceStatus, ModelLoadProgress } from "../../types";

interface LoadModelButtonProps {
  model: ModelConfig;
  status: InferenceStatus;
  progress: ModelLoadProgress | null;
  onLoad: () => void;
  showReloadWarning?: boolean;
}

export function LoadModelButton({ model, status, progress, onLoad, showReloadWarning }: LoadModelButtonProps) {
  const isLoaded  = ["ready", "running", "done"].includes(status);
  const isLoading = status === "loading";

  return (
    <div
      className="flex flex-col gap-3 p-4 rounded-2xl border"
      style={{ background: "var(--bg-card)", borderColor: "var(--border)" }}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold" style={{ color: "var(--text)" }}>{model.name}</p>
          <p className="text-xs mt-0.5 font-mono" style={{ color: "var(--text-3)" }}>
            {model.dtype.toUpperCase()} · {model.hfRepo}
          </p>
        </div>
        <div className="flex-shrink-0">
          {isLoaded ? (
            <div className="flex items-center gap-1.5 text-xs text-emerald-400">
              <CheckCircle size={14} /><span>Loaded</span>
            </div>
          ) : isLoading ? (
            <div className="flex items-center gap-1.5 text-xs text-sky-400">
              <Loader2 size={14} className="animate-spin" /><span>Loading…</span>
            </div>
          ) : (
            <button
              onClick={onLoad}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors hover:bg-sky-500"
              style={{ background: "rgba(14,165,233,0.85)", border: "1px solid rgba(14,165,233,0.9)", color: "white" }}
            >
              <Download size={12} />Load model
            </button>
          )}
        </div>
      </div>

      {isLoading && progress && (
        <ProgressBar progress={progress.progress} file={progress.file} />
      )}

      {!isLoading && !isLoaded && showReloadWarning && (
        <div className="flex items-center justify-between gap-3 rounded-lg px-3 py-2"
          style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)" }}>
          <p className="text-[11px]" style={{ color: "#fca5a5" }}>
            ⚠ A model was already loaded this session. Reload the page first to free GPU memory and avoid out-of-memory errors.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors hover:bg-red-500/20"
            style={{ background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.3)", color: "#f87171" }}
          >
            <RefreshCw size={11} /> Reload
          </button>
        </div>
      )}

      {!isLoading && !isLoaded && !showReloadWarning && (
        <div
          className="text-[11px] rounded-lg px-3 py-2"
          style={{
            background: "rgba(245,158,11,0.06)",
            border: "1px solid rgba(245,158,11,0.15)",
            color: "var(--text-3)",
          }}
        >
          ⚠ Weights (~1–4 GB) download from Hugging Face on first load. Requires WebGPU.
        </div>
      )}
    </div>
  );
}
