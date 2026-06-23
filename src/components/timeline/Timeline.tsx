import { useRef, useState, useCallback, useEffect } from "react";
import { createPortal } from "react-dom";
import { ZoomIn, ZoomOut, RotateCcw, ChevronDown, ChevronUp, ChevronLeft as ChevLeft, ChevronRight as ChevRight } from "lucide-react";
import { TIMELINE_MILESTONES, FAMILY_COLORS } from "../../config/timeline";
import { MODEL_REGISTRY, MODEL_COLORS } from "../../config/models";
import type { TimelineMilestone } from "../../types";
import { BlogModal } from "./BlogModal";
import { useTheme } from "../../context/ThemeContext";

const MAP_W = 2200;
const MAP_H = 860;

// Boustrophedon (snake) grid: 3 rows, alternating L→R / R→L
const ROWS     = 3;
const ROW_Y    = [155, 455, 740];
const X_LEFT   = 180;
const X_RIGHT  = 2020;

function computeZigzagPositions(n: number): [number, number][] {
  if (n <= 0) return [];
  const rowBounds = Array.from({ length: ROWS }, (_, r) => ({
    start: Math.floor(r * n / ROWS),
    end:   Math.floor((r + 1) * n / ROWS),
  }));
  return Array.from({ length: n }, (_, i) => {
    const row   = rowBounds.findIndex(b => i >= b.start && i < b.end);
    const { start, end } = rowBounds[row];
    const count = end - start;
    const t     = count === 1 ? 0.5 : (i - start) / (count - 1);
    const x     = row % 2 === 0
      ? X_LEFT  + t * (X_RIGHT - X_LEFT)
      : X_RIGHT - t * (X_RIGHT - X_LEFT);
    return [x, ROW_Y[row]] as [number, number];
  });
}

const N          = TIMELINE_MILESTONES.length;
const POSITIONS  = computeZigzagPositions(N);
const SIZE_SCALE = 0.82;
const ISLE_RX    = 60 * SIZE_SCALE;
const ISLE_RY    = 22 * SIZE_SCALE;

function milestoneAccent(m: TimelineMilestone): string {
  const firstModel = m.modelIds[0];
  return (firstModel && MODEL_COLORS[firstModel]) ?? FAMILY_COLORS[m.family] ?? "#0ea5e9";
}

function milestonePos(i: number) {
  const [cx, cy] = POSITIONS[i] ?? [MAP_W / 2, MAP_H / 2];
  return { cx, cy };
}

function qpt(t: number, x1: number, y1: number, cpx: number, cpy: number, x2: number, y2: number) {
  const mt = 1 - t;
  return { x: mt*mt*x1 + 2*mt*t*cpx + t*t*x2, y: mt*mt*y1 + 2*mt*t*cpy + t*t*y2 };
}

function RopeBridge({ ax, ay, bx, by }: { ax:number; ay:number; bx:number; by:number }) {
  const dx = bx - ax, dy = by - ay;
  const len = Math.sqrt(dx*dx + dy*dy);
  const ux = dx / len, uy = dy / len;
  const px = -uy, py = ux;
  const sx = ax + ux * ISLE_RX, sy = ay + uy * ISLE_RY;
  const ex = bx - ux * ISLE_RX, ey = by - uy * ISLE_RY;
  const sag = Math.min(50, len * 0.15);
  const cpx = (sx + ex) / 2, cpy = (sy + ey) / 2 + sag;
  const off = 9 * SIZE_SCALE;
  const r1sx = sx + px*off, r1sy = sy + py*off, r1ex = ex + px*off, r1ey = ey + py*off;
  const r1cx = cpx + px*off, r1cy = cpy + py*off;
  const r2sx = sx - px*off, r2sy = sy - py*off, r2ex = ex - px*off, r2ey = ey - py*off;
  const r2cx = cpx - px*off, r2cy = cpy - py*off;
  const PLANKS = 11;
  const planks: [ReturnType<typeof qpt>, ReturnType<typeof qpt>][] = [];
  for (let i = 1; i <= PLANKS; i++) {
    const t = i / (PLANKS + 1);
    planks.push([
      qpt(t, r1sx, r1sy, r1cx, r1cy, r1ex, r1ey),
      qpt(t, r2sx, r2sy, r2cx, r2cy, r2ex, r2ey),
    ]);
  }
  return (
    <g>
      {planks.map(([p1, p2], i) => (
        <line key={`ps${i}`} x1={p1.x+2} y1={p1.y+3} x2={p2.x+2} y2={p2.y+3}
          stroke="rgba(0,0,0,0.25)" strokeWidth={6*SIZE_SCALE} strokeLinecap="round" />
      ))}
      {planks.map(([p1, p2], i) => (
        <line key={`p${i}`} x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y}
          stroke="#5BA4CF" strokeWidth={5*SIZE_SCALE} strokeLinecap="round" />
      ))}
      <path d={`M ${r1sx} ${r1sy} Q ${r1cx} ${r1cy} ${r1ex} ${r1ey}`}
        fill="none" stroke="#5D4037" strokeWidth={2.5*SIZE_SCALE} />
      <path d={`M ${r2sx} ${r2sy} Q ${r2cx} ${r2cy} ${r2ex} ${r2ey}`}
        fill="none" stroke="#5D4037" strokeWidth={2.5*SIZE_SCALE} />
    </g>
  );
}

function IsleTree({ x, y, s = 1, crown }: { x:number; y:number; s?:number; crown:string }) {
  return (
    <g transform={`translate(${x},${y}) scale(${s})`}>
      <rect x={-3} y={-14} width={6} height={18} rx={2} fill="#795548" />
      <circle cx={0}   cy={-26} r={13} fill={crown} />
      <circle cx={-9}  cy={-21} r={10} fill={crown} />
      <circle cx={9}   cy={-21} r={10} fill={crown} />
      <circle cx={0}   cy={-35} r={9}  fill={crown} style={{ filter: "brightness(1.1)" }} />
    </g>
  );
}

const TREE_CONFIGS = [
  { dx:-42, dy:-4,  s:0.75, crown:"#FF8F00" },
  { dx: 40, dy:-6,  s:0.80, crown:"#F57F17" },
  { dx:-22, dy:-10, s:0.60, crown:"#558B2F" },
  { dx: 22, dy:-12, s:0.62, crown:"#827717" },
];

function FloatingIsland({
  m, index, isActive, isHovered, onClick, onHover,
}: {
  m: TimelineMilestone; index: number;
  isActive: boolean; isHovered: boolean;
  onClick: () => void; onHover: (id: string | null) => void;
}) {
  const { cx, cy } = milestonePos(index);
  const accent = milestoneAccent(m);
  const lit = isActive || isHovered;
  const fs = SIZE_SCALE;
  const W = ISLE_RX, H = ISLE_RY, C = 52 * fs;

  const cliff = `M ${-W} 0
    C ${-W*1.1} ${C*0.4}, ${-W*0.8} ${C*0.85}, ${-W*0.55} ${C}
    L ${W*0.55} ${C}
    C ${W*0.8} ${C*0.85}, ${W*1.1} ${C*0.4}, ${W} 0 Z`;

  const cliffSide = `M ${-W} 0
    C ${-W*1.1} ${C*0.4}, ${-W*0.85} ${C*0.8}, ${-W*0.6} ${C*0.95}
    L ${-W*0.55} ${C} C ${-W*0.7} ${C*0.85}, ${-W*1.0} ${C*0.4}, ${-W} 0 Z`;

  const grassMain  = isActive ? accent : accent + "cc";
  const grassLight = isActive ? accent + "dd" : accent + "99";

  // Special Gemini Nano island — Chrome/Google themed
  if (m.isSpecial) {
    const GOOGLE = ["#4285f4", "#ea4335", "#fbbc05", "#34a853"];
    return (
      <g transform={`translate(${cx},${cy})`} onClick={onClick}
        onMouseEnter={() => onHover(m.id)} onMouseLeave={() => onHover(null)}
        style={{ cursor: "pointer" }}>

        {/* Chromatic multi-color glow */}
        {!lit && (<>
          {GOOGLE.map((color, i) => (
            <ellipse key={i} cx={0} cy={0} rx={W} ry={H} fill="none" stroke={color} strokeWidth={2.5} opacity={0}>
              <animate attributeName="rx" values={`${W+2};${W+50};${W+50}`} dur="2.4s" begin={`${i * 0.6}s`} repeatCount="indefinite" />
              <animate attributeName="ry" values={`${H+2};${H+38};${H+38}`} dur="2.4s" begin={`${i * 0.6}s`} repeatCount="indefinite" />
              <animate attributeName="opacity" values="0.9;0;0" dur="2.4s" begin={`${i * 0.6}s`} repeatCount="indefinite" />
              <animate attributeName="stroke-width" values="2.5;0.3;0" dur="2.4s" begin={`${i * 0.6}s`} repeatCount="indefinite" />
            </ellipse>
          ))}
          <g>
            <animateTransform attributeName="transform" type="rotate" from="0" to="360" dur="8s" repeatCount="indefinite" />
            {Array.from({ length: 16 }, (_, i) => {
              const a = (i / 16) * Math.PI * 2;
              const cos = Math.cos(a), sin = Math.sin(a);
              const color = GOOGLE[i % 4];
              const isMajor = i % 4 === 0;
              const r1 = W + 8;
              const r2 = r1 + (isMajor ? 32 : 16);
              return (
                <line key={i} x1={cos * r1} y1={sin * r1} x2={cos * r2} y2={sin * r2}
                  stroke={color} strokeWidth={isMajor ? 3 : 1.5} strokeLinecap="round" opacity={isMajor ? 1 : 0.65} />
              );
            })}
          </g>
        </>)}

        {/* Shadow */}
        <ellipse cx={4} cy={C + 14*fs} rx={W * 0.75} ry={12*fs}
          fill="rgba(0,0,0,0.4)" style={{ filter: "blur(5px)" }} />

        {/* Chrome-tinted cliff */}
        <path d={cliff} fill="#1e293b" />
        <path d={cliffSide} fill="#334155" opacity={0.6} />
        <path d={`M ${-W*0.55} ${C} C ${-W*0.2} ${C+7*fs}, ${W*0.2} ${C+7*fs}, ${W*0.55} ${C}`} fill="#0f172a" />

        {/* Trees (keep for consistency) */}
        {TREE_CONFIGS.slice(0, 2).map((t, i) => (
          <IsleTree key={i} x={t.dx*fs} y={t.dy*fs - H * 0.4} s={t.s * fs} crown="#22d3ee" />
        ))}

        {/* Lit ring */}
        {lit && (
          <ellipse cx={0} cy={0} rx={W + 8} ry={H + 6}
            fill="#4285f422" stroke="#4285f4" strokeWidth={2}
            style={{ filter: "drop-shadow(0 0 10px #4285f490)" }} />
        )}

        {/* Google-blue island top */}
        <ellipse cx={0} cy={0} rx={W} ry={H} fill={lit ? "#4285f4" : "#4285f4cc"} />
        <ellipse cx={-3} cy={-H * 0.25} rx={W * 0.65} ry={H * 0.55} fill="#74b3ff" opacity={0.45} />

        {/* Flagpole + Chrome-colored flag */}
        <line x1={0} y1={-H} x2={0} y2={-H - 34*fs} stroke="#334155" strokeWidth={2.5*fs} />
        <polygon points={`0,${-H-34*fs} ${22*fs},${-H-26*fs} 0,${-H-17*fs}`}
          fill="#4285f4" style={{ filter: "drop-shadow(0 2px 4px #4285f480)" }} />

        {/* Back trees */}
        {TREE_CONFIGS.slice(2).map((t, i) => (
          <IsleTree key={i} x={t.dx*fs} y={t.dy*fs - H * 0.2} s={t.s * fs} crown="#22d3ee" />
        ))}

        {/* "Chrome Built-in" ribbon above badge */}
        <defs>
          <clipPath id="nano-ribbon-clip">
            <rect x={-52*fs} y={H + 1*fs} width={104*fs} height={14*fs} rx={7*fs} />
          </clipPath>
        </defs>
        <rect x={-52*fs} y={H + 1*fs} width={104*fs} height={14*fs} rx={7*fs}
          fill="#4285f4" style={{ filter: "drop-shadow(0 1px 4px #4285f450)" }} />
        <g clipPath="url(#nano-ribbon-clip)">
          {GOOGLE.map((color, i) => (
            <rect key={i} x={(-52 + 26 * i)*fs} y={H + 1*fs} width={26*fs} height={14*fs}
              rx={0}
              fill={color} opacity={0.92} />
          ))}
        </g>
        <text x={0} y={H + 11*fs} textAnchor="middle" fontSize={8*fs} fontWeight="800"
          fill="white" fontFamily="Inter,sans-serif">Chrome Built-in</text>

        {/* Name badge */}
        <rect x={-64*fs} y={H + 16*fs} width={128*fs} height={50*fs} rx={8*fs}
          fill={lit ? "#1e293b" : "#1e293bcc"}
          stroke="#4285f4"
          strokeWidth={lit ? 2 : 1.5}
          style={{ filter: lit
            ? "drop-shadow(0 4px 14px #4285f470)"
            : "drop-shadow(0 3px 8px #4285f440)" }}
        />
        <text x={0} y={H + 33*fs} textAnchor="middle" fontSize={11*fs} fontWeight="800"
          fill="white" fontFamily="Inter,sans-serif">{m.name}</text>
        <text x={0} y={H + 46*fs} textAnchor="middle" fontSize={9*fs} fontWeight="600"
          fill="rgba(255,255,255,0.9)" fontFamily="Inter,sans-serif">{m.date}</text>
        <text x={0} y={H + 57*fs} textAnchor="middle" fontSize={7.5*fs}
          fill="rgba(255,255,255,0.75)" fontFamily="Inter,sans-serif">{m.highlight ?? ""}</text>
      </g>
    );
  }

  return (
    <g
      transform={`translate(${cx},${cy})`}
      onClick={onClick}
      onMouseEnter={() => onHover(m.id)}
      onMouseLeave={() => onHover(null)}
      style={{ cursor: "pointer" }}
    >
      {m.modelIds.length > 0 && !lit && (<>
        <ellipse cx={0} cy={0} rx={W + 38} ry={H + 30} fill={accent} opacity={0}>
          <animate attributeName="opacity" values="0;0.22;0" dur="2.4s" repeatCount="indefinite" />
          <animate attributeName="rx" values={`${W+30};${W+46};${W+30}`} dur="2.4s" repeatCount="indefinite" />
          <animate attributeName="ry" values={`${H+22};${H+36};${H+22}`} dur="2.4s" repeatCount="indefinite" />
        </ellipse>
        <ellipse cx={0} cy={0} rx={W + 16} ry={H + 12} fill={accent} opacity={0}>
          <animate attributeName="opacity" values="0;0.30;0" dur="2.4s" begin="0.3s" repeatCount="indefinite" />
        </ellipse>
      </>)}

      <ellipse cx={4} cy={C + 14*fs} rx={W * 0.75} ry={12*fs}
        fill="rgba(0,0,0,0.35)" style={{ filter: "blur(5px)" }} />

      <path d={cliff} fill="#8D6E63" />
      <path d={cliffSide} fill="#A1887F" opacity={0.55} />
      <path d={`M ${-W*0.55} ${C} C ${-W*0.2} ${C+7*fs}, ${W*0.2} ${C+7*fs}, ${W*0.55} ${C}`}
        fill="#6D4C41" />

      {TREE_CONFIGS.slice(0, 2).map((t, i) => (
        <IsleTree key={i} x={t.dx*fs} y={t.dy*fs - H * 0.4} s={t.s * fs} crown={t.crown} />
      ))}

      {m.modelIds.length > 0 && !lit && (
        <g>
          {([0, 0.8, 1.6] as number[]).map((delay, i) => (
            <ellipse key={i} cx={0} cy={0} rx={W} ry={H} fill="none" stroke={accent} strokeWidth={2.5} opacity={0}>
              <animate attributeName="rx" values={`${W+2};${W+50};${W+50}`} dur="2.4s" begin={`${delay}s`} repeatCount="indefinite" />
              <animate attributeName="ry" values={`${H+2};${H+38};${H+38}`} dur="2.4s" begin={`${delay}s`} repeatCount="indefinite" />
              <animate attributeName="opacity" values="0.8;0;0" dur="2.4s" begin={`${delay}s`} repeatCount="indefinite" />
              <animate attributeName="stroke-width" values="2.5;0.3;0" dur="2.4s" begin={`${delay}s`} repeatCount="indefinite" />
            </ellipse>
          ))}
          <g opacity={0.85}>
            <animateTransform attributeName="transform" type="rotate" from="0" to="360" dur="10s" repeatCount="indefinite" />
            {Array.from({ length: 16 }, (_, i) => {
              const a = (i / 16) * Math.PI * 2;
              const cos = Math.cos(a), sin = Math.sin(a);
              const isMajor = i % 4 === 0;
              const isMid   = i % 2 === 0 && !isMajor;
              const r1 = W + 8;
              const r2 = r1 + (isMajor ? 32 : isMid ? 20 : 12);
              return (
                <line key={i}
                  x1={cos * r1} y1={sin * r1}
                  x2={cos * r2} y2={sin * r2}
                  stroke={accent} strokeWidth={isMajor ? 3 : isMid ? 1.8 : 1}
                  strokeLinecap="round"
                  opacity={isMajor ? 1 : isMid ? 0.7 : 0.45}
                />
              );
            })}
          </g>
        </g>
      )}

      {lit && (
        <ellipse cx={0} cy={0} rx={W + 8} ry={H + 6}
          fill={accent + "22"} stroke={accent} strokeWidth={2}
          style={{ filter: `drop-shadow(0 0 8px ${accent}90)` }} />
      )}

      <ellipse cx={0} cy={0} rx={W} ry={H} fill={grassMain} />
      <ellipse cx={-3} cy={-H * 0.25} rx={W * 0.65} ry={H * 0.55} fill={grassLight} opacity={0.5} />

      <line x1={0} y1={-H} x2={0} y2={-H - 34*fs} stroke="#5D4037" strokeWidth={2.5*fs} />
      <polygon
        points={`0,${-H-34*fs} ${22*fs},${-H-26*fs} 0,${-H-17*fs}`}
        fill={accent}
        style={{ filter: `drop-shadow(0 2px 4px ${accent}80)` }}
      />

      {TREE_CONFIGS.slice(2).map((t, i) => (
        <IsleTree key={i} x={t.dx*fs} y={t.dy*fs - H * 0.2} s={t.s * fs} crown={t.crown} />
      ))}

      <rect x={-64*fs} y={H + 14*fs} width={128*fs} height={50*fs} rx={8*fs}
        fill={lit ? accent : accent + "cc"}
        stroke={accent}
        strokeWidth={lit ? 2 : 1.5}
        style={{ filter: lit
          ? `drop-shadow(0 4px 14px ${accent}70)`
          : `drop-shadow(0 3px 8px ${accent}40)` }}
      />
      <text x={0} y={H + 33*fs} textAnchor="middle" fontSize={11*fs} fontWeight="800"
        fill="white" fontFamily="Inter,sans-serif">
        {m.name}
      </text>
      <text x={0} y={H + 46*fs} textAnchor="middle" fontSize={9*fs} fontWeight="600"
        fill="rgba(255,255,255,0.9)" fontFamily="Inter,sans-serif">
        {m.date}
      </text>
      <text x={0} y={H + 57*fs} textAnchor="middle" fontSize={7.5*fs}
        fill="rgba(255,255,255,0.75)" fontFamily="Inter,sans-serif">
        {m.highlight ?? ""}
      </text>
    </g>
  );
}

const SPEECH: Record<string, string> = {
  "gemma-1":        "Here's where it all began! Gemma 1, Google DeepMind's first open-weights model.",
  "paligemma-1":    "PaliGemma brought vision to Gemma. Now it can see!",
  "gemma-2":        "Gemma 2 doubled efficiency with sliding-window attention.",
  "paligemma-2":    "PaliGemma 2 upgraded the vision backbone to Gemma 2. Sharp eyes!",
  "paligemma-2-mix": "PaliGemma 2 Mix is fine-tuned on captioning, VQA, and detection tasks. Try it in the Playground!",
  "gemma-3":        "Gemma 3 with a 128k context window! Think of all you can fit.",
  "gemma-3n":       "Gemma 3n is built for on-device inference with a tiny footprint and full multimodal support.",
  "gemma-4":        "Gemma 4 handles text, image and audio all in one model. We made it!",
  "embeddinggemma": "EmbeddingGemma turns text into vectors, powering search and retrieval!",
  "translategemma": "TranslateGemma translates across 100+ languages, fully on-device via WebGPU!",
  "recurrentgemma": "RecurrentGemma replaced attention with recurrent layers, making it fast on long sequences without the quadratic cost!",
  "codegemma":      "CodeGemma was trained on 500B+ code tokens. It can complete, generate, and infill across 10+ programming languages.",
  "shieldgemma":    "ShieldGemma acts as a safety layer, classifying text for harm categories right on the device.",
  "datagemma":      "DataGemma grounds answers in Google's Data Commons. No more hallucinated statistics!",
  "shieldgemma-2":  "ShieldGemma 2 levelled up to handle images too. Multimodal safety filtering in one compact model.",
  "dolphingemma":   "DolphinGemma was trained on 40 years of dolphin vocalisations from the Wild Dolphin Project. It speaks dolphin!",
  "medgemma":       "MedGemma understands radiology reports, biomedical literature, and medical images. Built for healthcare AI.",
  "t5gemma":        "T5Gemma fuses encoder-decoder seq2seq power with Gemma's generation quality. Best of both architectures!",
  "vaultgemma":     "VaultGemma uses Differential Privacy training so it mathematically cannot memorise your sensitive data.",
  "functiongemma":  "FunctionGemma outputs structured tool calls from plain English, the backbone of agentic applications.",
  "t5gemma-v2":     "T5Gemma v2 improves on the original with better seq2seq quality and broader multilingual task coverage.",
  "diffusiongemma": "DiffusionGemma denoises tokens in parallel rather than one by one, a fundamentally different way to generate text!",
  "gemini-nano":    "Gemini Nano is built right into Chrome — no download, no HuggingFace, just window.ai. A new paradigm for on-device AI!",
};

function Sticker({ cx, cy, text, accent, hasModal }: {
  cx: number; cy: number; text: string; accent: string; hasModal?: boolean;
}) {
  const bw = 210;
  const padX = 12, padY = 10;
  const fontSize = 9.5;
  const lineH = fontSize * 1.55;
  const innerW = bw - padX * 2;
  const charsPerLine = Math.floor(innerW / (fontSize * 0.53));
  const lineCount = text.split(" ").reduce(
    (acc, word) => {
      const test = acc.current ? acc.current + " " + word : word;
      if (test.length > charsPerLine) { return { lines: acc.lines + 1, current: word }; }
      return { lines: acc.lines, current: test };
    },
    { lines: 1, current: "" }
  ).lines;
  const readMoreH = hasModal ? 22 : 0;
  const bh = Math.ceil(lineCount * lineH) + padY * 2 + readMoreH;

  const bx = cx - bw / 2;
  const placeBelow = cy < 320;
  // Tighter offset - just clear the island label (≈55px below cy at SIZE_SCALE 0.82)
  const by   = placeBelow ? cy + 86 : cy - bh - 20;
  const imgY = placeBelow ? by + bh + 8 : by - 88;

  const tailPts = placeBelow
    ? `${cx - 8},${by} ${cx + 8},${by} ${cx},${by - 10}`
    : `${cx - 8},${by + bh} ${cx + 8},${by + bh} ${cx},${by + bh + 10}`;

  const hexToRgba = (hex: string, a: number) => {
    const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
    return `rgba(${r},${g},${b},${a})`;
  };
  const fill   = hexToRgba(accent, 0.80);
  const stroke = hexToRgba(accent, 1.0);
  const textTop = placeBelow ? by + padY : by + padY;
  const readMoreY = by + bh - readMoreH;

  return (
    <g>
      <rect x={bx} y={by} width={bw} height={bh} rx={11}
        fill={fill} stroke={stroke} strokeWidth={1.5}
        style={{ filter: `drop-shadow(0 4px 18px ${hexToRgba(accent, 0.4)})` }} />
      <polygon points={tailPts} fill={fill} stroke={stroke} strokeWidth={1.5} strokeLinejoin="round" />
      <foreignObject x={bx + padX} y={textTop} width={innerW} height={Math.ceil(lineCount * lineH) + padY}>
        <div style={{ fontSize: `${fontSize}px`, color: "#fff", lineHeight: 1.55, fontFamily: "Inter,sans-serif", margin: 0, padding: 0 }}>
          {text}
        </div>
      </foreignObject>
      {hasModal && (
        <>
          <line x1={bx + 10} y1={readMoreY} x2={bx + bw - 10} y2={readMoreY}
            stroke={hexToRgba(accent, 0.5)} strokeWidth={1} />
          <foreignObject x={bx + padX} y={readMoreY + 4} width={innerW} height={18}>
            <div style={{ fontSize: "9px", color: "rgba(255,255,255,0.9)", fontFamily: "Inter,sans-serif", fontWeight: 700, letterSpacing: "0.04em" }}>
              Click again to read the article →
            </div>
          </foreignObject>
        </>
      )}
      <image href="/sticker.png" x={cx - 50} y={imgY} width={100} height={100}
        className="sticker-idle"
        style={{ filter: "drop-shadow(0 6px 20px rgba(14,165,233,0.4))" }} />
    </g>
  );
}

function clampCenter(cx: number, cy: number, vbW: number, vbH: number) {
  const x = vbW >= MAP_W ? MAP_W / 2 : Math.max(vbW / 2, Math.min(MAP_W - vbW / 2, cx));
  const y = vbH >= MAP_H ? MAP_H / 2 : Math.max(vbH / 2, Math.min(MAP_H - vbH / 2, cy));
  return { x, y };
}

export function Timeline({ onNavigateModel }: { onNavigateModel: (modelId: string) => void }) {
  const { theme } = useTheme();
  const containerRef   = useRef<HTMLDivElement>(null);
  const [cSize, setCSize] = useState({ w: 0, h: 0 });
  const nanoIdx  = TIMELINE_MILESTONES.findIndex(m => m.id === "gemini-nano");
  const nanoPos  = nanoIdx >= 0 ? milestonePos(nanoIdx) : { cx: MAP_W / 2, cy: MAP_H / 2 };
  const [zoom, setZoom]   = useState(1.0);
  const [center, setCenter] = useState({ x: nanoPos.cx, y: nanoPos.cy });
  const [dragging, setDragging]   = useState(false);
  const [dragStart, setDragStart] = useState({ mx:0, my:0, cx:0, cy:0 });
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [activeId, setActiveId]   = useState<string | null>(null);
  const [modalMilestone, setModalMilestone] = useState<TimelineMilestone | null>(null);
  const [modalAccent, setModalAccent] = useState<string>("#0ea5e9");
  const [panelExpanded, setPanelExpanded] = useState(true);
  const fitDone = useRef(false);

  const getMinZoom = useCallback((w: number, h: number) =>
    h > 0 ? Math.max(1, (w / h) * (MAP_H / MAP_W)) : 1, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect;
      setCSize({ w: width, h: height });
      if (!fitDone.current && width > 0 && height > 0) {
        fitDone.current = true;
        setZoom(Math.max(getMinZoom(width, height), 2.2));
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [getMinZoom]);


  const getViewBox = useCallback(() => {
    const aspect = cSize.h > 0 ? cSize.w / cSize.h : MAP_W / MAP_H;
    const vbH = MAP_H / zoom;
    const vbW = vbH * aspect;
    const c = clampCenter(center.x, center.y, vbW, vbH);
    return `${c.x - vbW/2} ${c.y - vbH/2} ${vbW} ${vbH}`;
  }, [zoom, center, cSize]);

  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault();
    const minZ = getMinZoom(cSize.w, cSize.h);
    setZoom(z => Math.min(5, Math.max(minZ, z * (e.deltaY > 0 ? 0.92 : 1.08))));
  }, [cSize, getMinZoom]);

  useEffect(() => {
    const el = containerRef.current;
    el?.addEventListener("wheel", handleWheel, { passive: false });
    return () => el?.removeEventListener("wheel", handleWheel);
  }, [handleWheel]);

  const onMouseDown = (e: React.MouseEvent) => {
    setDragging(true);
    setDragStart({ mx: e.clientX, my: e.clientY, cx: center.x, cy: center.y });
  };

  const onMouseMove = (e: React.MouseEvent) => {
    if (!dragging || cSize.h === 0) return;
    const aspect = cSize.w / cSize.h;
    const vbH = MAP_H / zoom;
    const vbW = vbH * aspect;
    const scaleX = vbW / cSize.w;
    const scaleY = vbH / cSize.h;
    const newCx = dragStart.cx - (e.clientX - dragStart.mx) * scaleX;
    const newCy = dragStart.cy - (e.clientY - dragStart.my) * scaleY;
    const vb = { vbW, vbH };
    setCenter(clampCenter(newCx, newCy, vb.vbW, vb.vbH));
  };

  const onMouseUp = () => setDragging(false);

  const resetView = () => {
    setZoom(getMinZoom(cSize.w, cSize.h));
    setCenter({ x: MAP_W / 2, y: MAP_H / 2 });
  };

  const activeMilestone = TIMELINE_MILESTONES.find(m => m.id === activeId);
  const activeIdx       = activeId != null ? TIMELINE_MILESTONES.findIndex(m => m.id === activeId) : -1;
  const activeP         = activeIdx >= 0 ? milestonePos(activeIdx) : null;

  const zoomSlot = typeof document !== "undefined" ? document.getElementById("zoom-controls-slot") : null;

  // Directional arrow visibility — check if milestones exist beyond current viewport edges
  const aspect = cSize.h > 0 ? cSize.w / cSize.h : MAP_W / MAP_H;
  const vbH = cSize.h > 0 ? MAP_H / zoom : MAP_H;
  const vbW = vbH * aspect;
  const clampedC = clampCenter(center.x, center.y, vbW, vbH);
  const viewLeft   = clampedC.x - vbW / 2;
  const viewRight  = clampedC.x + vbW / 2;
  const viewTop    = clampedC.y - vbH / 2;
  const viewBottom = clampedC.y + vbH / 2;
  const allPos = TIMELINE_MILESTONES.map((_, i) => milestonePos(i));
  const showLeft  = allPos.some(p => p.cx < viewLeft   - 20);
  const showRight = allPos.some(p => p.cx > viewRight  + 20);
  const showUp    = allPos.some(p => p.cy < viewTop    - 20);
  const showDown  = allPos.some(p => p.cy > viewBottom + 20);

  const panDir = (dir: "left" | "right" | "up" | "down") => {
    const panX = vbW * 0.45;
    const panY = vbH * 0.45;
    setCenter(c => clampCenter(
      c.x + (dir === "right" ? panX : dir === "left" ? -panX : 0),
      c.y + (dir === "down"  ? panY : dir === "up"   ? -panY : 0),
      vbW, vbH
    ));
  };

  return (
    <div style={{ height: "calc(100vh - 64px)", display: "flex", flexDirection: "column" }}>

      {zoomSlot && createPortal(
        <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 2 }}>
          {[
            { Icon: ZoomIn,    act: () => setZoom(z => Math.min(5, z * 1.25)), title: "Zoom in" },
            { Icon: ZoomOut,   act: () => { const minZ = getMinZoom(cSize.w, cSize.h); setZoom(z => Math.max(minZ, z * 0.8)); }, title: "Zoom out" },
            { Icon: RotateCcw, act: resetView, title: "Reset" },
          ].map(({ Icon, act, title }, i) => (
            <button key={i} onClick={act} title={title} style={{
              width: 26, height: 26, border: "1px solid var(--border)", borderRadius: 6,
              background: "var(--bg-3)", cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "var(--text-3)",
            }}>
              <Icon size={12} />
            </button>
          ))}
          <span style={{ fontSize: 11, color: "var(--text-3)", minWidth: 34, textAlign: "center" }}>
            {Math.round(zoom * 100)}%
          </span>
        </div>,
        zoomSlot
      )}

      <div
        ref={containerRef}
        className="timeline-canvas flex-1 overflow-hidden"
        style={{
          position: "relative",
          background: theme === "dark" ? "#070b18" : "#c9e8f5",
          cursor: dragging ? "grabbing" : "grab",
        }}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
      >
        <div style={{ position: "absolute", inset: 0, overflow: "hidden", zIndex: 0 }}>
          {(theme === "dark" ? [
            { color: "#f59e0b", size: 520, top: "10%",  left: "15%",  dur: "18s", anim: "blob1" },
            { color: "#a855f7", size: 480, top: "55%",  left: "72%",  dur: "22s", anim: "blob2" },
            { color: "#ec4899", size: 440, top: "20%",  left: "55%",  dur: "16s", anim: "blob3" },
            { color: "#06b6d4", size: 460, top: "65%",  left: "30%",  dur: "20s", anim: "blob4" },
            { color: "#84cc16", size: 400, top: "75%",  left: "82%",  dur: "24s", anim: "blob5" },
            { color: "#6366f1", size: 420, top: "5%",   left: "80%",  dur: "19s", anim: "blob6" },
          ] : [
            { color: "#38bdf8", size: 560, top: "5%",   left: "10%",  dur: "20s", anim: "blob1" },
            { color: "#818cf8", size: 500, top: "50%",  left: "70%",  dur: "24s", anim: "blob2" },
            { color: "#34d399", size: 460, top: "60%",  left: "25%",  dur: "18s", anim: "blob3" },
            { color: "#fbbf24", size: 480, top: "15%",  left: "55%",  dur: "22s", anim: "blob4" },
            { color: "#f472b6", size: 420, top: "70%",  left: "80%",  dur: "26s", anim: "blob5" },
            { color: "#2dd4bf", size: 440, top: "5%",   left: "78%",  dur: "21s", anim: "blob6" },
          ]).map((b, i) => (
            <div key={i} style={{
              position: "absolute",
              top: b.top, left: b.left,
              width: b.size, height: b.size,
              borderRadius: "50%",
              background: theme === "dark"
                ? `radial-gradient(circle at 40% 40%, ${b.color}55 0%, ${b.color}18 45%, transparent 70%)`
                : `radial-gradient(circle at 40% 40%, ${b.color}60 0%, ${b.color}28 45%, transparent 70%)`,
              filter: "blur(52px)",
              animation: `${b.anim} ${b.dur} ease-in-out infinite`,
              willChange: "transform",
            }} />
          ))}
          {/* Grid overlay */}
          <div style={{
            position: "absolute", inset: 0,
            backgroundImage: theme === "dark"
              ? "linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)"
              : "linear-gradient(rgba(0,0,0,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.05) 1px, transparent 1px)",
            backgroundSize: "60px 60px",
          }} />
        </div>

        <svg
          viewBox={getViewBox()}
          preserveAspectRatio="none"
          style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", zIndex: 1 }}
        >
          {/* Rope bridges */}
          {TIMELINE_MILESTONES.map((_, i) => {
            if (i === 0) return null;
            const a = milestonePos(i - 1), b = milestonePos(i);
            return <RopeBridge key={i} ax={a.cx} ay={a.cy} bx={b.cx} by={b.cy} />;
          })}

          {/* Islands */}
          {TIMELINE_MILESTONES.map((m, i) => (
            <FloatingIsland
              key={m.id} m={m} index={i}
              isActive={activeId === m.id}
              isHovered={hoveredId === m.id}
              onClick={() => {
                if (activeId === m.id) {
                  if (m.blogUrl && (m.modelIds.length === 0 || m.mediaUrl)) {
                    setModalMilestone(m);
                    setModalAccent(milestoneAccent(m));
                  } else {
                    setActiveId(null);
                  }
                } else {
                  setActiveId(m.id);
                  setPanelExpanded(true);
                }
              }}
              onHover={setHoveredId}
            />
          ))}

          {/* Sticker */}
          {activeId && activeP && activeMilestone && (
            <Sticker
              cx={activeP.cx} cy={activeP.cy}
              text={SPEECH[activeId] ?? ""}
              accent={milestoneAccent(activeMilestone)}
              hasModal={!!activeMilestone.blogUrl && (activeMilestone.modelIds.length === 0 || !!activeMilestone.mediaUrl)}
            />
          )}
        </svg>

        {/* Directional arrows */}
        {([
          { show: showLeft,  dir: "left",  cls: "arrow-left",  style: { left: 14, top: "50%", transform: "translateY(-50%)" } },
          { show: showRight, dir: "right", cls: "arrow-right", style: { right: 14, top: "50%", transform: "translateY(-50%)" } },
          { show: showUp,    dir: "up",    cls: "arrow-up",    style: { top: 14, left: "50%", transform: "translateX(-50%)" } },
          { show: showDown,  dir: "down",  cls: "arrow-down",  style: { bottom: 14, left: "50%", transform: "translateX(-50%)" } },
        ] as const).map(({ show, dir, cls, style }) => show && (
          <button
            key={dir}
            className={cls}
            onMouseDown={e => e.stopPropagation()}
            onClick={e => { e.stopPropagation(); panDir(dir); }}
            title={`More models to the ${dir}`}
            style={{
              position: "absolute",
              ...style,
              zIndex: 10,
              width: 38,
              height: 38,
              borderRadius: "50%",
              border: "1.5px solid rgba(255,255,255,0.25)",
              background: "rgba(15,23,42,0.72)",
              backdropFilter: "blur(8px)",
              color: "rgba(255,255,255,0.90)",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 2px 12px rgba(0,0,0,0.35)",
            }}
          >
            {dir === "left"  && <ChevLeft  size={18} />}
            {dir === "right" && <ChevRight size={18} />}
            {dir === "up"    && <ChevronUp   size={18} />}
            {dir === "down"  && <ChevronDown size={18} />}
          </button>
        ))}

      </div>

      {activeMilestone && (() => {
        const accent = milestoneAccent(activeMilestone);
        return (
          <div style={{
            flexShrink: 0,
            background: "var(--bg-card)",
            borderTop: `2px solid ${accent}50`,
            boxShadow: "0 -2px 16px rgba(0,0,0,0.18)",
          }}>
            <div
              onClick={() => setPanelExpanded(e => !e)}
              style={{
                padding: "8px 20px", display: "flex", alignItems: "center", gap: 10,
                cursor: "pointer", userSelect: "none",
              }}
            >
              <div style={{
                width: 8, height: 8, borderRadius: "50%", flexShrink: 0,
                background: accent, boxShadow: `0 0 6px ${accent}`,
              }} />
              <span style={{ fontWeight: 800, fontSize: 13, color: "var(--text)", flex: 1 }}>
                {activeMilestone.name}
              </span>
              <span style={{
                fontSize: 10, fontWeight: 600, padding: "1px 7px", borderRadius: 99,
                background: accent + "18", color: accent, border: `1px solid ${accent}40`,
              }}>
                {activeMilestone.date}
              </span>
              {activeMilestone.highlight && (
                <span style={{ fontSize: 10, color: "var(--text-3)" }}>★ {activeMilestone.highlight}</span>
              )}
              <div style={{ color: "var(--text-3)", display: "flex", alignItems: "center", marginLeft: 4 }}>
                {panelExpanded ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
              </div>
              <button
                onClick={e => { e.stopPropagation(); setActiveId(null); }}
                style={{
                  width: 24, height: 24, borderRadius: 6, border: "1px solid var(--border)",
                  background: "var(--bg-3)", cursor: "pointer", color: "var(--text-3)",
                  fontSize: 12, display: "flex", alignItems: "center", justifyContent: "center",
                }}
              >✕</button>
            </div>

            {panelExpanded && (
              <div style={{
                padding: "0 20px 12px",
                display: "flex", alignItems: "center", gap: 14,
                borderTop: `1px solid var(--border)`,
              }}>
                <p style={{ fontSize: 11, color: "var(--text-2)", margin: "10px 0 0", lineHeight: 1.6, flex: 1 }}>
                  {activeMilestone.description}
                </p>
                <div style={{ display: "flex", gap: 8, flexShrink: 0, marginTop: 10 }}>
                  {activeMilestone.modelIds.map(mid => {
                    const model = MODEL_REGISTRY.find(m => m.id === mid);
                    if (!model) return null;
                    return (
                      <button key={mid} onClick={() => onNavigateModel(mid)} style={{
                        padding: "7px 16px", borderRadius: 9, fontSize: 12, fontWeight: 700,
                        border: "none", background: accent, color: "white", cursor: "pointer",
                        whiteSpace: "nowrap", boxShadow: `0 4px 14px ${accent}50`,
                      }}>
                        {activeMilestone.modelIds.length > 1 ? model.name : "Try in Playground"}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {modalMilestone && (
        <BlogModal
          milestone={modalMilestone}
          accent={modalAccent}
          onClose={() => setModalMilestone(null)}
        />
      )}
    </div>
  );
}
