interface ProgressBarProps {
  progress: number; // 0–100
  label?: string;
  file?: string;
}

export function ProgressBar({ progress, label, file }: ProgressBarProps) {
  return (
    <div className="w-full space-y-1.5">
      {(label || file) && (
        <div className="flex justify-between items-center text-xs text-slate-400">
          <span className="truncate max-w-[80%]">
            {label ?? (file ? `Loading ${file.split("/").pop()}` : "Loading…")}
          </span>
          <span className="tabular-nums">{Math.round(progress)}%</span>
        </div>
      )}
      <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-300 bg-gradient-to-r from-sky-500 to-teal-400"
          style={{ width: `${Math.min(100, progress)}%` }}
        />
      </div>
    </div>
  );
}
