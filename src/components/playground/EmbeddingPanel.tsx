import { useState, useEffect, useRef, useMemo } from "react";
import { Plus, Trash2, Zap, RotateCcw } from "lucide-react";
import type { InferenceStatus } from "../../types";
import { useTheme } from "../../context/ThemeContext";

const DEFAULT_TEXTS = [
  "I love pizza and pasta.",
  "Italian cuisine is delicious.",
  "The stock market crashed today.",
  "Investors are worried about inflation.",
  "Dogs are loyal companions.",
  "Cats are independent animals.",
];

const COLORS = [
  "#0ea5e9","#f59e0b","#14b8a6","#ec4899",
  "#6366f1","#84cc16","#f97316","#a855f7",
  "#e11d48","#0d9488","#7c3aed","#b45309",
];

function cosine(a: number[], b: number[]): number {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) { dot += a[i]*b[i]; na += a[i]*a[i]; nb += b[i]*b[i]; }
  const denom = Math.sqrt(na * nb);
  return denom < 1e-10 ? 0 : dot / denom;
}

function runPCA3D(vectors: number[][]): [number, number, number][] {
  const n = vectors.length;
  if (n === 0) return [];
  if (n === 1) return [[0, 0, 1]];
  const d = vectors[0].length;

  const mean = new Array(d).fill(0);
  for (const v of vectors) for (let i = 0; i < d; i++) mean[i] += v[i] / n;
  const X = vectors.map(v => v.map((x, i) => x - mean[i]));

  function powerIter(data: number[][]): number[] {
    const norm0 = Math.sqrt(data[0].reduce((s, x) => s + x*x, 0));
    let u = norm0 > 1e-10 ? data[0].map(x => x/norm0) : new Array(d).fill(1/Math.sqrt(d));
    for (let iter = 0; iter < 400; iter++) {
      const Xu = data.map(v => v.reduce((s, x, i) => s + x*u[i], 0));
      const nu = new Array(d).fill(0);
      for (let j = 0; j < n; j++) for (let i = 0; i < d; i++) nu[i] += data[j][i]*Xu[j];
      const norm = Math.sqrt(nu.reduce((s, x) => s+x*x, 0));
      if (norm < 1e-10) break;
      u = nu.map(x => x/norm);
    }
    return u;
  }
  function deflate(data: number[][], pc: number[]): number[][] {
    const projs = data.map(v => v.reduce((s, x, i) => s + x*pc[i], 0));
    return data.map((v, j) => v.map((x, i) => x - projs[j]*pc[i]));
  }

  const pc1 = powerIter(X);
  const X2  = deflate(X, pc1);
  const pc2 = powerIter(X2);
  const X3  = deflate(X2, pc2);
  const pc3 = powerIter(X3);

  const raw = X.map(v => [
    v.reduce((s, x, i) => s + x*pc1[i], 0),
    v.reduce((s, x, i) => s + x*pc2[i], 0),
    v.reduce((s, x, i) => s + x*pc3[i], 0),
  ] as [number, number, number]);

  // normalize each point onto the unit sphere
  return raw.map(([a, b, c]) => {
    const r = Math.sqrt(a*a + b*b + c*c);
    if (r < 1e-10) return [0, 0, 1] as [number, number, number];
    return [a/r, b/r, c/r] as [number, number, number];
  });
}

interface PlotPoint { label: string; x: number; y: number; vector: number[]; color: string; }
interface CollectedItem { label: string; vector: number[]; }
interface Props {
  status: InferenceStatus;
  embeddingVector: number[] | null;
  onGenerate: (text: string) => void;
  onAbort: () => void;
}

export function EmbeddingPanel({ status, embeddingVector, onGenerate, onAbort }: Props) {
  const [texts, setTexts]           = useState<string[]>(DEFAULT_TEXTS);
  const [phase, setPhase]           = useState<"idle"|"generating"|"done">("idle");
  const [processingIdx, setProcessingIdx] = useState(0);
  const [points, setPoints]         = useState<PlotPoint[]>([]);

  const pendingTextsRef = useRef<string[]>([]);
  const pendingIdxRef   = useRef(0);
  const collectedRef    = useRef<CollectedItem[]>([]);

  const handleVisualize = () => {
    const valid = texts.filter(t => t.trim().length > 0);
    if (valid.length < 2) return;
    pendingTextsRef.current = valid;
    pendingIdxRef.current   = 0;
    collectedRef.current    = [];
    setPhase("generating");
    setProcessingIdx(0);
    setPoints([]);
    onGenerate(valid[0]);
  };

  useEffect(() => {
    if (!embeddingVector || phase !== "generating") return;
    const idx = pendingIdxRef.current;
    const pending = pendingTextsRef.current;
    collectedRef.current.push({ label: pending[idx], vector: embeddingVector });
    if (idx + 1 < pending.length) {
      pendingIdxRef.current = idx + 1;
      setProcessingIdx(idx + 1);
      onGenerate(pending[idx + 1]);
    } else {
      const collected = collectedRef.current;
      setPoints(collected.map((c, i) => ({
        label: c.label, vector: c.vector, color: COLORS[i % COLORS.length],
        x: 0, y: 0,
      })));
      setPhase("done");
    }
  }, [embeddingVector]); // eslint-disable-line

  useEffect(() => {
    if (status === "error" && phase === "generating") setPhase("idle");
  }, [status, phase]);

  const isGenerating = phase === "generating";
  const canVisualize = (status === "ready" || status === "done") && !isGenerating;

  return (
    <div className="flex gap-4 flex-1" style={{ minHeight: 0 }}>
      <div className="flex flex-col gap-3 flex-shrink-0" style={{ width: 256 }}>
        <div className="rounded-2xl border p-4 flex flex-col gap-2.5 overflow-y-auto flex-1"
          style={{ background: "var(--bg-card)", borderColor: "var(--border)", maxHeight: "calc(100vh - 200px)" }}>
          <div className="flex items-center justify-between mb-0.5">
            <h3 className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-3)" }}>
              Input Texts
            </h3>
            <div className="flex gap-1">
              {phase === "done" && (
                <button onClick={() => { setPhase("idle"); setPoints([]); }}
                  className="text-xs px-2 py-0.5 rounded-lg hover:bg-sky-500/10 transition-colors flex items-center gap-1"
                  style={{ color: "var(--text-3)" }}>
                  <RotateCcw size={10} /> Reset
                </button>
              )}
              {texts.length < 12 && (
                <button onClick={() => setTexts(t => [...t, ""])} disabled={isGenerating}
                  className="text-xs px-2 py-0.5 rounded-lg hover:bg-sky-500/10 transition-colors flex items-center gap-1"
                  style={{ color: "var(--text-3)" }}>
                  <Plus size={10} /> Add
                </button>
              )}
            </div>
          </div>

          {texts.map((t, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: COLORS[i % COLORS.length] }} />
              <input value={t}
                onChange={e => setTexts(texts.map((t2, j) => j === i ? e.target.value : t2))}
                placeholder={`Text ${i + 1}…`} disabled={isGenerating}
                className="flex-1 text-xs rounded-lg px-2.5 py-1.5 outline-none min-w-0"
                style={{ background: "var(--bg-3)", border: "1px solid var(--border)", color: "var(--text)" }} />
              {texts.length > 2 && (
                <button onClick={() => setTexts(texts.filter((_, j) => j !== i))} disabled={isGenerating}
                  className="hover:text-red-400 transition-colors flex-shrink-0" style={{ color: "var(--text-3)" }}>
                  <Trash2 size={12} />
                </button>
              )}
            </div>
          ))}
        </div>

        {isGenerating ? (
          <div className="rounded-xl border px-3 py-2 flex items-center justify-between"
            style={{ background: "var(--bg-card)", borderColor: "var(--border)" }}>
            <span className="text-xs" style={{ color: "var(--text-3)" }}>
              {processingIdx + 1} / {pendingTextsRef.current.length}
            </span>
            <button onClick={onAbort} className="text-xs px-2.5 py-1 rounded-lg"
              style={{ color: "#f87171", border: "1px solid rgba(239,68,68,0.3)" }}>
              Abort
            </button>
          </div>
        ) : (
          <button onClick={handleVisualize}
            disabled={!canVisualize || texts.filter(t => t.trim()).length < 2}
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all disabled:opacity-40"
            style={{ background: "linear-gradient(135deg, #84cc16, #65a30d)", border: "none", color: "white", boxShadow: "0 4px 14px rgba(132,204,22,0.45)" }}>
            <Zap size={14} /> Visualize
          </button>
        )}
      </div>

      <div className="flex-1 rounded-2xl border overflow-hidden flex flex-col"
        style={{ background: "var(--bg-card)", borderColor: "var(--border)" }}>
        {phase === "done" && points.length >= 2 ? (
          <SphereViz3D points={points} />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center gap-2 p-6">
            <p className="text-sm text-center" style={{ color: "var(--text-3)" }}>
              {isGenerating
                ? `Computing embedding ${processingIdx + 1} of ${pendingTextsRef.current.length}…`
                : "Load the model, add texts, then click Visualize"}
            </p>
            {!isGenerating && (
              <p className="text-xs text-center" style={{ color: "var(--text-3)", opacity: 0.5 }}>
                Drag to rotate the 3D sphere
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function SphereViz3D({ points }: { points: PlotPoint[] }) {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef   = useRef(0);
  const lastTimeRef = useRef<number>(0);

  // rotation state: theta = Y-axis, phi = X-axis
  const rotRef  = useRef({ theta: 0.4, phi: 0.3 });
  const zoomRef = useRef(1.4);
  const dragRef = useRef<{ active: boolean; lx: number; ly: number } | null>(null);
  const mouseRef = useRef({ x: -9999, y: -9999 });
  const hovRef   = useRef(-1);

  const [tooltip, setTooltip] = useState<{ idx: number; sx: number; sy: number } | null>(null);
  const tooltipRef = useRef<{ idx: number; sx: number; sy: number } | null>(null);

  const cosines = useMemo(() =>
    points.map(a => points.map(b => cosine(a.vector, b.vector))),
  [points]);

  // compute 3D sphere coordinates via PCA3D inside this component
  const sphereCoords = useMemo((): [number, number, number][] => {
    return runPCA3D(points.map(p => p.vector));
  }, [points]);

  // Rotation helpers
  function rotateY(x: number, y: number, z: number, t: number): [number, number, number] {
    const c = Math.cos(t), s = Math.sin(t);
    return [c*x + s*z, y, -s*x + c*z];
  }
  function rotateX(x: number, y: number, z: number, t: number): [number, number, number] {
    const c = Math.cos(t), s = Math.sin(t);
    return [x, c*y - s*z, s*y + c*z];
  }
  function applyRot(x: number, y: number, z: number): [number, number, number] {
    const { theta, phi } = rotRef.current;
    const [x2, y2, z2] = rotateY(x, y, z, theta);
    return rotateX(x2, y2, z2, phi);
  }

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || points.length === 0) return;

    const resize = () => {
      const dpr  = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      canvas.width  = rect.width  * dpr;
      canvas.height = rect.height * dpr;
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const draw = (timestamp: number) => {
      const dt = Math.min(timestamp - (lastTimeRef.current || timestamp), 50) / 1000;
      lastTimeRef.current = timestamp;

      // auto-rotate when not dragging
      if (!dragRef.current?.active) {
        rotRef.current.theta += dt * 0.25;
      }

      const dpr = window.devicePixelRatio || 1;
      const W = canvas.width / dpr, H = canvas.height / dpr;
      const ctx = canvas.getContext("2d")!;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);

      const cx = W / 2, cy = H / 2;
      const R = Math.min(W, H) * 0.46 * zoomRef.current;


      const projected = sphereCoords.map(([x, y, z], idx) => {
        const [rx, ry, rz] = applyRot(x, y, z);
        const sx = cx + rx * R;
        const sy = cy - ry * R;
        return { idx, sx, sy, rz };
      });

      // hover detect
      const { x: mx, y: my } = mouseRef.current;
      let newHov = -1, minD = 30;
      for (const pt of projected) {
        const d = Math.hypot(pt.sx - mx, pt.sy - my);
        if (d < minD) { minD = d; newHov = pt.idx; }
      }
      if (newHov !== hovRef.current) {
        hovRef.current = newHov;
        const next = newHov >= 0
          ? { idx: newHov, sx: projected[newHov].sx, sy: projected[newHov].sy }
          : null;
        tooltipRef.current = next;
        setTooltip(next);
      } else if (newHov >= 0) {
        const cur = tooltipRef.current;
        if (cur && (Math.abs(cur.sx - projected[newHov].sx) > 1 || Math.abs(cur.sy - projected[newHov].sy) > 1)) {
          const next = { idx: newHov, sx: projected[newHov].sx, sy: projected[newHov].sy };
          tooltipRef.current = next;
          setTooltip(next);
        }
      }

      const hov = hovRef.current;

      // sort back-to-front by rz
      const sorted = [...projected].sort((a, b) => a.rz - b.rz);

      ctx.beginPath();
      ctx.arc(cx, cy, 4, 0, Math.PI * 2);
      ctx.fillStyle = isDark ? "rgba(255,255,255,0.25)" : "rgba(0,0,0,0.2)";
      ctx.fill();

      for (const { idx, sx, sy, rz } of sorted) {
        const p = points[idx];
        const isFront = rz > 0;
        const isHov = idx === hov;

        const spokeOpacity  = isFront ? 0.9 : 0.35;
        const spokeWidth    = isHov ? 2.5 : (isFront ? 1.5 : 0.8);
        const dotOpacity    = isFront ? 1.0 : 0.35;

        // glow for hovered spoke
        if (isHov) {
          ctx.beginPath();
          ctx.moveTo(cx, cy);
          ctx.lineTo(sx, sy);
          ctx.strokeStyle = p.color + "40";
          ctx.lineWidth = 8;
          ctx.globalAlpha = 1;
          ctx.stroke();
        }

        // spoke
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(sx, sy);
        ctx.strokeStyle = p.color;
        ctx.lineWidth = spokeWidth;
        ctx.globalAlpha = spokeOpacity;
        ctx.stroke();
        ctx.globalAlpha = 1;

        // halo for hovered dot
        if (isHov) {
          ctx.beginPath();
          ctx.arc(sx, sy, 12, 0, Math.PI * 2);
          ctx.fillStyle = p.color + "25";
          ctx.fill();
        }

        // dot
        ctx.globalAlpha = dotOpacity;
        ctx.beginPath();
        ctx.arc(sx, sy, isHov ? 7 : 5, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.fill();
        ctx.strokeStyle = isDark ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.9)";
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.globalAlpha = 1;

        // label for front-hemisphere dots
        if (isFront) {
          const label = p.label.length > 18 ? p.label.slice(0, 18) + "…" : p.label;
          ctx.font = "9.5px sans-serif";
          ctx.fillStyle = p.color;
          ctx.shadowColor = isDark ? "rgba(0,0,0,0.8)" : "rgba(255,255,255,0.9)";
          ctx.shadowBlur = 3;
          ctx.fillText(label, sx + 9, sy + 3);
          ctx.shadowBlur = 0;
        }
      }

      animRef.current = requestAnimationFrame(draw);
    };

    animRef.current = requestAnimationFrame(draw);
    return () => { cancelAnimationFrame(animRef.current); ro.disconnect(); };
  }, [points, sphereCoords, cosines, isDark]); // eslint-disable-line

  const relXY = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const r = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  return (
    <div className="relative flex-1 flex flex-col">
      {/* canvas */}
      <div className="relative flex-1">
        {/* floating hint */}
        <div style={{ position: "absolute", top: 10, left: 14, zIndex: 10, pointerEvents: "none" }}>
          <span className="text-[10px] font-medium" style={{ color: "var(--text-3)" }}>
            3D PCA · {points.length} vectors · Drag to rotate · Scroll to zoom
          </span>
        </div>
        <canvas
          ref={canvasRef}
          className="w-full h-full"
          style={{ cursor: dragRef.current?.active ? "grabbing" : "grab", display: "block" }}
          onMouseDown={e => {
            const { x, y } = relXY(e);
            dragRef.current = { active: true, lx: x, ly: y };
          }}
          onMouseMove={e => {
            const { x, y } = relXY(e);
            mouseRef.current = { x, y };
            if (!dragRef.current?.active) return;
            const dx = x - dragRef.current.lx;
            const dy = y - dragRef.current.ly;
            dragRef.current.lx = x; dragRef.current.ly = y;
            rotRef.current.theta += dx * 0.008;
            rotRef.current.phi   += dy * 0.008;
          }}
          onMouseUp={() => { if (dragRef.current) dragRef.current.active = false; }}
          onMouseLeave={() => {
            if (dragRef.current) dragRef.current.active = false;
            mouseRef.current = { x: -9999, y: -9999 };
            hovRef.current = -1;
            tooltipRef.current = null;
            setTooltip(null);
          }}
          onWheel={e => {
            e.preventDefault();
            const factor = e.deltaY < 0 ? 1.1 : 0.9;
            zoomRef.current = Math.min(8, Math.max(0.3, zoomRef.current * factor));
          }}
          onContextMenu={e => e.preventDefault()}
        />

        {tooltip !== null && (
          <TooltipCard
            point={points[tooltip.idx]}
            idx={tooltip.idx}
            sx={tooltip.sx}
            sy={tooltip.sy}
            allPoints={points}
            cosines={cosines[tooltip.idx]}
          />
        )}
      </div>
    </div>
  );
}

function TooltipCard({ point, idx, sx, sy, allPoints, cosines }: {
  point: PlotPoint; idx: number; sx: number; sy: number;
  allPoints: PlotPoint[]; cosines: number[];
}) {
  const others = allPoints
    .map((p, i) => ({ p, i, sim: cosines[i] }))
    .filter(x => x.i !== idx)
    .sort((a, b) => b.sim - a.sim)
    .slice(0, 5);

  const flipX = sx > window.innerWidth * 0.55;

  return (
    <div
      className="absolute pointer-events-none z-20 rounded-xl border shadow-2xl px-3 py-2.5 flex flex-col gap-2"
      style={{
        left: flipX ? sx - 16 : sx + 16,
        top: Math.max(8, sy - 20),
        transform: flipX ? "translateX(-100%)" : undefined,
        maxWidth: 240,
        background: "var(--bg-card)",
        borderColor: "var(--border)",
      }}>
      <div className="flex items-start gap-2">
        <span className="w-3 h-3 rounded-full flex-shrink-0 mt-0.5" style={{ background: point.color }} />
        <span className="text-xs font-medium leading-snug" style={{ color: "var(--text)" }}>
          {point.label}
        </span>
      </div>
      {others.length > 0 && (
        <div className="flex flex-col gap-1.5 pt-0.5 border-t" style={{ borderColor: "var(--border)" }}>
          {others.map(({ p, i, sim }) => (
            <div key={i} className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: p.color }} />
              <div className="flex-1 h-1 rounded-full overflow-hidden" style={{ background: "var(--bg-3)" }}>
                <div className="h-full rounded-full transition-all" style={{ width: `${sim * 100}%`, background: p.color }} />
              </div>
              <span className="text-[10px] font-mono w-7 text-right flex-shrink-0" style={{ color: "var(--text-3)" }}>
                {(sim * 100).toFixed(0)}%
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
