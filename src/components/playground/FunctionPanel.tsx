import { useState, useEffect, useRef } from "react";
import { Square, Zap } from "lucide-react";
import type { InferenceStatus } from "../../types";
import { useTheme } from "../../context/ThemeContext";

const SKY = "#0ea5e9";
const MODEL_YELLOW = "#f97316";

const TOOLS = [
  {
    type: "function",
    function: {
      name: "switch_theme",
      description: "Switch the app theme between dark and light mode.",
      parameters: {
        type: "object",
        properties: { mode: { type: "string", enum: ["dark", "light"] } },
        required: ["mode"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "navigate_to",
      description: "Navigate to a section of the app. Use 'timeline' for the Gemma Journey timeline, 'playground' for the model playground.",
      parameters: {
        type: "object",
        properties: { section: { type: "string", enum: ["timeline", "playground"] } },
        required: ["section"],
      },
    },
  },
];

const PRESET_COMMANDS = ["Switch theme", "Go to Gemma Journey"];

function parseFunctionCall(raw: string): { name: string; args: Record<string, string> } | null {
  const outer = raw.match(/<start_function_call>([\s\S]*?)(?:<end_function_call>|$)/);
  const content = outer ? outer[1].trim() : raw.trim();
  const nameMatch = content.match(/^call:(\w+)\{/);
  if (!nameMatch) return null;
  const name = nameMatch[1];
  const args: Record<string, string> = {};
  const argRe = /(\w+):<escape>([\s\S]*?)<escape>/g;
  let m: RegExpExecArray | null;
  while ((m = argRe.exec(content)) !== null) args[m[1]] = m[2];
  return { name, args };
}

interface FunctionPanelProps {
  status: InferenceStatus;
  output: string;
  processingMs?: number | null;
  error?: string | null;
  onGenerate: (opts: { prompt: string; maxNewTokens: number; family: string }) => void;
  onAbort: () => void;
  onNavigateTab: (tab: "timeline" | "playground") => void;
  onSelectModel: (modelId: string) => void;
}

export function FunctionPanel({
  status, output, processingMs, error,
  onGenerate, onAbort, onNavigateTab,
}: FunctionPanelProps) {
  const { theme, toggle } = useTheme();
  const [command, setCommand] = useState(PRESET_COMMANDS[0]);
  const [toast, setToast] = useState<string | null>(null);
  const [actionLog, setActionLog] = useState<string | null>(null);
  const lastOutputRef = useRef("");
  const commandRef = useRef(command);
  useEffect(() => { commandRef.current = command; }, [command]);

  const isRunning = status === "running";
  const canRun = status === "idle" || status === "ready" || status === "done" || status === "error";

  useEffect(() => {
    if (status !== "done" || !output || output === lastOutputRef.current) return;
    lastOutputRef.current = output;
    setActionLog(null);

    const call = parseFunctionCall(output);
    if (!call) return;

    if (call.name === "switch_theme") {
      // Model is biased toward "light" - ignore the arg and always toggle
      toggle();
      const next = theme === "dark" ? "light" : "dark";
      setActionLog(`Switched to ${next} mode`);
      showToast(`Switched to ${next} mode`);
    } else if (call.name === "navigate_to") {
      const raw = (call.args.section ?? "").toLowerCase();
      const section: "timeline" | "playground" =
        raw === "playground" ? "playground"
        : raw === "timeline" ? "timeline"
        : commandRef.current.toLowerCase().includes("journey") || commandRef.current.toLowerCase().includes("timeline")
          ? "timeline"
          : "playground";
      const label = section === "timeline" ? "Gemma Journey" : "Playground";
      setActionLog(`Navigating to ${label}…`);
      showToast(`Navigating to ${label}…`);
      // Delay so the function call output is visible before the tab switches
      setTimeout(() => onNavigateTab(section), 1200);
    }
  }, [status, output]); // eslint-disable-line

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  }

  const handleRun = () => {
    setActionLog(null);
    lastOutputRef.current = "";
    const prompt = `__TOOLS__\n${JSON.stringify(TOOLS)}\n__QUERY__\n${command}`;
    onGenerate({ prompt, maxNewTokens: 128, family: "function" });
  };

  const fcCall = output ? parseFunctionCall(output) : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20, flex: 1 }}>

      {/* Toast */}
      {toast && (
        <div style={{
          position: "fixed", top: 80, right: 24, zIndex: 200,
          background: "var(--bg-card)", border: `1.5px solid ${SKY}`,
          borderRadius: 14, padding: "12px 18px",
          boxShadow: `0 8px 32px rgba(0,0,0,0.35), 0 0 20px ${SKY}30`,
          display: "flex", alignItems: "center", gap: 10,
          animation: "fadeSlideIn 0.2s ease",
        }}>
          <span style={{ fontSize: 13, color: "var(--text)", fontWeight: 600 }}>{toast}</span>
        </div>
      )}

      <div className="rounded-2xl border p-5 flex flex-col gap-5"
        style={{ background: "var(--bg-card)", borderColor: "var(--border)" }}>

        {/* Header */}
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-3)" }}>
            Agentic Demo
          </h3>
          <p style={{ fontSize: 12, color: "var(--text-3)", margin: "4px 0 0", lineHeight: 1.6 }}>
            Type a command in natural language. FunctionGemma outputs a structured function call, and the app executes it.
          </p>
        </div>

        {/* Registered tools */}
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-3)", marginBottom: 8 }}>
            Registered Tools
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {TOOLS.map(t => (
              <div key={t.function.name} style={{
                padding: "5px 12px", borderRadius: 8,
                background: "var(--bg-3)", border: "1px solid var(--border)",
                fontSize: 11, fontWeight: 600, color: "var(--text-2)",
              }}>
                <code>{t.function.name}</code>
              </div>
            ))}
          </div>
        </div>

        {/* Command input */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-3)" }}>
            Command
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            {PRESET_COMMANDS.map(p => (
              <button key={p} onClick={() => setCommand(p)} disabled={isRunning}
                style={{
                  padding: "4px 12px", borderRadius: 99, fontSize: 11, fontWeight: 600,
                  border: `1px solid ${command === p ? SKY : "var(--border)"}`,
                  background: command === p ? `${SKY}15` : "transparent",
                  color: command === p ? SKY : "var(--text-3)",
                  cursor: "pointer",
                }}>
                {p}
              </button>
            ))}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              value={command}
              onChange={e => setCommand(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && canRun && command.trim()) handleRun(); }}
              disabled={isRunning}
              placeholder="Type a command…"
              style={{
                flex: 1, padding: "10px 14px", borderRadius: 10, fontSize: 13,
                background: "var(--bg-3)", border: `1px solid var(--border)`,
                color: "var(--text)", outline: "none", fontFamily: "inherit",
              }}
            />
            <button
              onClick={isRunning ? onAbort : handleRun}
              disabled={!isRunning && (!canRun || !command.trim())}
              style={{
                display: "flex", alignItems: "center", gap: 7,
                padding: "10px 20px", borderRadius: 10, border: "none",
                cursor: (isRunning || (canRun && command.trim())) ? "pointer" : "not-allowed",
                fontWeight: 700, fontSize: 13,
                background: isRunning ? "#ef4444" : `linear-gradient(135deg, ${SKY}, #6366f1)`,
                color: "white",
                opacity: !isRunning && (!canRun || !command.trim()) ? 0.45 : 1,
                boxShadow: isRunning ? "0 4px 14px rgba(239,68,68,0.4)" : `0 4px 14px ${SKY}40`,
                flexShrink: 0,
              }}
            >
              {isRunning ? <><Square size={13} /> Stop</> : <><Zap size={13} /> Run</>}
            </button>
          </div>
        </div>

        {/* Output */}
        {(isRunning || error || output) && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>

            <div style={{
              background: "var(--bg-3)", border: "1px solid var(--border)",
              borderRadius: 10, padding: "12px 14px",
            }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-3)" }}>
                  Function Call
                </span>
                {processingMs != null && !isRunning && (
                  <span style={{ fontSize: 10, color: "var(--text-3)" }}>{processingMs.toFixed(0)} ms</span>
                )}
              </div>
              {isRunning ? (
                <span style={{ fontSize: 12, color: "var(--text-3)", fontStyle: "italic" }}>Generating…</span>
              ) : error ? (
                <span style={{ fontSize: 12, color: "#ef4444" }}>{error}</span>
              ) : (
                <pre style={{
                  margin: 0, fontSize: 12, fontFamily: "monospace",
                  color: MODEL_YELLOW, whiteSpace: "pre-wrap", wordBreak: "break-all",
                }}>
                  {fcCall
                    ? `call:${fcCall.name}{}`
                    : output}
                </pre>
              )}
            </div>

            {!isRunning && actionLog && (
              <div style={{
                display: "flex", alignItems: "center", gap: 12,
                background: "rgba(34,197,94,0.07)", border: "1px solid rgba(34,197,94,0.3)",
                borderRadius: 10, padding: "12px 14px",
                animation: "fadeSlideIn 0.25s ease",
              }}>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#22c55e", marginBottom: 2 }}>
                    Action Executed
                  </div>
                  <div style={{ fontSize: 13, color: "var(--text-2)", fontWeight: 500 }}>{actionLog}</div>
                </div>
              </div>
            )}

            {!isRunning && !error && output && !fcCall && (
              <div style={{
                background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.25)",
                borderRadius: 10, padding: "10px 14px", fontSize: 11, color: "var(--text-3)", lineHeight: 1.6,
              }}>
                No parseable function call in model output. Quantized ONNX models can be unreliable, try again or rephrase the command.
              </div>
            )}
          </div>
        )}

        {!isRunning && !error && !output && (
          <div style={{ fontSize: 12, color: "var(--text-3)", fontStyle: "italic", textAlign: "center", padding: "2px 0 6px" }}>
            Load the model above, then pick a preset or type your own command.
          </div>
        )}

        <div style={{
          background: `${SKY}08`, border: `1px solid ${SKY}25`,
          borderRadius: 10, padding: "10px 14px",
          fontSize: 11, color: "var(--text-3)", lineHeight: 1.7,
        }}>
          <strong style={{ color: SKY }}>Note:</strong>{" "}
          FunctionGemma 270M runs quantized (q4f16) in the browser via ONNX. The quantized model
          may not always produce a valid function call. It works best with functions similar to its
          training data. For reliable production use, fine-tune the model on your specific functions
          at full precision.
        </div>
      </div>

      <style>{`
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(5px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
