import { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import {
  Send, StopCircle, Globe, AlertTriangle, Copy, Check, Clock,
  MessageSquare, Image as ImgIcon, FileText, PenLine, RotateCcw, Upload, X, Info, Languages,
  ArrowRightLeft, Plus,
} from "lucide-react";
import { ProgressBar } from "../ui/ProgressBar";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const w = (typeof window !== "undefined" ? window : {}) as any;

const TASKS = [
  { id: "prompt",       label: "Prompt",        color: "#4285f4", Icon: MessageSquare },
  { id: "prompt-image", label: "Prompt + Image", color: "#ea4335", Icon: ImgIcon      },
  { id: "summarizer",   label: "Summarizer",     color: "#fbbc05", Icon: FileText     },
  { id: "writer",       label: "Writer",         color: "#34a853", Icon: PenLine      },
  { id: "rewriter",     label: "Rewriter",       color: "#a142f4", Icon: RotateCcw    },
  { id: "translate",    label: "Translate",      color: "#1a73e8", Icon: Languages    },
] as const;
type TaskId = typeof TASKS[number]["id"];
type RunStatus = "idle" | "running" | "done" | "error";

const DEFAULT_LANGUAGES = [
  "Afrikaans","Albanian","Amharic","Arabic","Armenian","Azerbaijani",
  "Basque","Belarusian","Bengali","Bosnian","Bulgarian","Catalan",
  "Cebuano","Chinese (Simplified)","Chinese (Traditional)","Croatian",
  "Czech","Danish","Dutch","English","Esperanto","Estonian",
  "Filipino","Finnish","French","Galician","Georgian","German",
  "Greek","Gujarati","Haitian Creole","Hausa","Hebrew","Hindi",
  "Hmong","Hungarian","Icelandic","Igbo","Indonesian","Irish",
  "Italian","Japanese","Javanese","Kannada","Kazakh","Khmer",
  "Korean","Kurdish","Kyrgyz","Lao","Latin","Latvian","Lithuanian",
  "Luxembourgish","Macedonian","Malagasy","Malay","Malayalam",
  "Maltese","Maori","Marathi","Mongolian","Myanmar (Burmese)",
  "Nepali","Norwegian","Nyanja (Chichewa)","Odia (Oriya)","Pashto",
  "Persian","Polish","Portuguese","Punjabi","Romanian","Russian",
  "Samoan","Serbian","Sesotho","Shona","Sindhi","Sinhala","Slovak",
  "Slovenian","Somali","Spanish","Sundanese","Swahili","Swedish",
  "Tajik","Tamil","Tatar","Telugu","Thai","Turkish","Turkmen",
  "Ukrainian","Urdu","Uyghur","Uzbek","Vietnamese","Welsh",
  "Xhosa","Yiddish","Yoruba","Zulu",
];

// Name → BCP-47 code for Chrome Translation API
const LANG_CODES: Record<string, string> = {
  "English":"en","Spanish":"es","French":"fr","German":"de",
  "Italian":"it","Portuguese":"pt","Russian":"ru","Japanese":"ja",
  "Korean":"ko","Chinese (Simplified)":"zh","Arabic":"ar","Hindi":"hi",
  "Dutch":"nl","Polish":"pl","Swedish":"sv","Turkish":"tr",
  "Vietnamese":"vi","Thai":"th","Indonesian":"id","Czech":"cs",
  "Romanian":"ro","Hungarian":"hu","Ukrainian":"uk","Greek":"el",
  "Danish":"da","Finnish":"fi","Norwegian":"no","Hebrew":"he",
  "Bengali":"bn","Tamil":"ta","Telugu":"te","Marathi":"mr",
  "Gujarati":"gu","Kannada":"kn","Malayalam":"ml","Punjabi":"pa",
  "Swahili":"sw","Afrikaans":"af","Croatian":"hr","Slovak":"sk",
  "Bulgarian":"bg","Serbian":"sr","Lithuanian":"lt","Latvian":"lv",
  "Estonian":"et","Slovenian":"sl","Albanian":"sq","Macedonian":"mk",
  "Malay":"ms","Filipino":"tl","Catalan":"ca","Welsh":"cy",
  "Irish":"ga","Icelandic":"is","Belarusian":"be","Azerbaijani":"az",
  "Georgian":"ka","Armenian":"hy","Kazakh":"kk","Uzbek":"uz",
  "Mongolian":"mn","Nepali":"ne","Sinhala":"si","Khmer":"km",
  "Lao":"lo","Myanmar (Burmese)":"my","Amharic":"am","Somali":"so",
  "Hausa":"ha","Yoruba":"yo","Zulu":"zu","Xhosa":"xh",
  "Persian":"fa","Urdu":"ur","Pashto":"ps","Kurdish":"ku",
};

function apiAvailable(task: TaskId): boolean {
  if (task === "prompt" || task === "prompt-image") return typeof w.LanguageModel === "function";
  if (task === "summarizer") return typeof w.Summarizer === "function";
  if (task === "writer")     return typeof w.Writer     === "function";
  if (task === "rewriter")   return typeof w.Rewriter   === "function";
  if (task === "translate")  return typeof w.translation === "object" || typeof w.LanguageModel === "function";
  return false;
}

async function* readStream(stream: ReadableStream<string>) {
  const reader = stream.getReader();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      yield value as string;
    }
  } finally {
    reader.releaseLock();
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function buildSession(task: TaskId, onProgress: (p: number) => void): Promise<any> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const monitor = (m: any) => {
    m.addEventListener("downloadprogress", (ev: ProgressEvent) => {
      if (ev.total) onProgress(Math.round((ev.loaded / ev.total) * 100));
    });
  };

  if (task === "prompt") {
    const avail = await w.LanguageModel.availability?.();
    if (avail === "unavailable")
      throw new Error("LanguageModel unavailable. Update 'Optimization Guide On Device Model' at chrome://components.");
    return w.LanguageModel.create({ expectedInputLanguages: ["en"], expectedOutputLanguages: ["en"], monitor });
  }
  if (task === "prompt-image") {
    const avail = await w.LanguageModel.availability?.();
    if (avail === "unavailable")
      throw new Error("LanguageModel unavailable. Update 'Optimization Guide On Device Model' at chrome://components.");
    return w.LanguageModel.create({
      expectedInputs: [{ type: "text" }, { type: "image" }],
      monitor,
    });
  }
  if (task === "summarizer") {
    const avail = await w.Summarizer.availability?.();
    if (avail === "unavailable") throw new Error("Summarizer unavailable. Enable the Summarizer API flag in chrome://flags.");
    try {
      return await w.Summarizer.create({ type: "tldr", format: "plain-text", length: "medium", monitor });
    } catch {
      return await w.Summarizer.create({ monitor });
    }
  }
  if (task === "writer") {
    const avail = await w.Writer.availability?.();
    if (avail === "unavailable") throw new Error("Writer unavailable. Enable the Writer API flag in chrome://flags.");
    return w.Writer.create({ tone: "neutral", format: "plain-text", length: "medium", monitor });
  }
  if (task === "rewriter") {
    const avail = await w.Rewriter.availability?.();
    if (avail === "unavailable") throw new Error("Rewriter unavailable. Enable the Rewriter API flag in chrome://flags.");
    return w.Rewriter.create({ tone: "as-is", format: "plain-text", length: "as-is", monitor });
  }
  throw new Error("Unknown task");
}

const INPUT_PLACEHOLDER: Record<TaskId, string> = {
  "prompt":       "Ask Gemini Nano anything...",
  "prompt-image": "Describe what you want to know about the image...",
  "summarizer":   "Paste the text you want to summarize...",
  "writer":       "Describe what you want written (e.g. 'Write a short bio for a software engineer')...",
  "rewriter":     "Paste the text you want to rewrite...",
  "translate":    "Enter text to translate...",
};
const CONTEXT_PLACEHOLDER: Partial<Record<TaskId, string>> = {
  "writer":   "Optional background context (e.g. 'The audience is non-technical')...",
  "rewriter": "Optional instructions (e.g. 'Make it more formal and concise')...",
};

export function NanoPanel() {
  const [activeTask, setActiveTask]   = useState<TaskId>("prompt");
  const [prompt, setPrompt]           = useState("");
  const [context, setContext]         = useState("");
  const [imageFile, setImageFile]     = useState<File | null>(null);
  const [imageUrl, setImageUrl]       = useState<string | null>(null);
  const [languages, setLanguages]   = useState<string[]>(DEFAULT_LANGUAGES);
  const [sourceLang, setSourceLang] = useState("English");
  const [targetLang, setTargetLang] = useState("Spanish");
  const [output, setOutput]           = useState("");
  const [status, setStatus]           = useState<RunStatus>("idle");
  const [error, setError]             = useState<string | null>(null);
  const [processingMs, setMs]         = useState<number | null>(null);
  const [copied, setCopied]           = useState(false);
  const [downloadPct, setDownloadPct] = useState<number | null>(null);
  const [preparing, setPreparing]     = useState(false);
  const [showInfo, setShowInfo]       = useState(false);
  const sessionRef                    = useRef<{ destroy: () => void } | null>(null);
  const abortRef                      = useRef(false);
  const fileInputRef                  = useRef<HTMLInputElement>(null);

  const task = TASKS.find(t => t.id === activeTask)!;
  const available = apiAvailable(activeTask);
  const canRun = available
    && (status === "idle" || status === "done")
    && prompt.trim().length > 0
    && (activeTask !== "prompt-image" || imageFile !== null);

  const switchTask = (id: TaskId) => {
    if (status === "running") return;
    setActiveTask(id);
    setOutput(""); setStatus("idle"); setError(null); setMs(null);
    setPrompt(""); setContext(""); setImageFile(null); setImageUrl(null);
  };

  const handleAddLanguage = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed || languages.includes(trimmed)) return;
    setLanguages(prev => [...prev, trimmed].sort());
  };

  const handleSwapLangs = () => {
    setSourceLang(targetLang);
    setTargetLang(sourceLang);
  };

  const handleImageUpload = (file: File) => {
    setImageFile(file);
    setImageUrl(URL.createObjectURL(file));
  };

  const handleRun = async () => {
    if (!prompt.trim()) return;
    abortRef.current = false;
    setStatus("running"); setOutput(""); setError(null); setMs(null);
    setDownloadPct(null); setPreparing(true);
    const t0 = performance.now();

    try {
      if (activeTask === "translate") {
        setPreparing(false);
        const srcLabel = sourceLang;
        const tgtLabel = targetLang;
        const srcCode = LANG_CODES[sourceLang];
        const tgtCode = LANG_CODES[targetLang];

        if (typeof w.translation === "object" && srcCode && tgtCode) {
          const translator = await w.translation.createTranslator({
            sourceLanguage: srcCode,
            targetLanguage: tgtCode,
          });
          const result: string = await translator.translate(prompt.trim());
          translator.destroy?.();
          setOutput(result);
        } else {
          // Fallback to LanguageModel
          const session = await w.LanguageModel.create({ monitor: () => {} });
          const fallbackPrompt = `Translate the following text from ${srcLabel} to ${tgtLabel}. Return only the translated text, no explanation:\n\n${prompt.trim()}`;
          const stream: ReadableStream<string> = session.promptStreaming(fallbackPrompt);
          let prev = "";
          for await (const value of readStream(stream)) {
            if (abortRef.current) break;
            if (typeof value === "string") {
              if (value.startsWith(prev)) { const d = value.slice(prev.length); if (d) setOutput(o => o + d); prev = value; }
              else { if (value) setOutput(o => o + value); }
            }
          }
          session.destroy?.();
        }
      } else {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const session: any = await buildSession(activeTask, (p) => setDownloadPct(p));
        setDownloadPct(null); setPreparing(false);
        sessionRef.current = { destroy: () => session.destroy?.() };

        const ctx = context.trim() || undefined;

        if (activeTask === "prompt-image" && imageFile) {
            const messageArr = [{
            role: "user",
            content: [
              { type: "text",  value: prompt.trim() },
              { type: "image", value: imageFile },
            ],
          }];
          const result: string = await session.prompt(messageArr);
          setOutput(result);
        } else if (activeTask === "prompt") {
          const stream: ReadableStream<string> = session.promptStreaming(prompt.trim());
          let prev = "";
          for await (const value of readStream(stream)) {
            if (abortRef.current) break;
            if (typeof value === "string") {
              if (value.startsWith(prev)) { const d = value.slice(prev.length); if (d) setOutput(o => o + d); prev = value; }
              else { if (value) setOutput(o => o + value); }
            }
          }
        } else if (activeTask === "summarizer") {
          if (typeof session.summarizeStreaming === "function") {
            const stream: ReadableStream<string> = session.summarizeStreaming(prompt.trim());
            let prev = "";
            for await (const value of readStream(stream)) {
              if (abortRef.current) break;
              if (typeof value === "string") {
                if (value.startsWith(prev)) { const d = value.slice(prev.length); if (d) setOutput(o => o + d); prev = value; }
                else { if (value) setOutput(o => o + value); }
              }
            }
          } else {
            const result: string = await session.summarize(prompt.trim());
            setOutput(result);
          }
        } else if (activeTask === "writer") {
          const opts = ctx ? { context: ctx } : {};
          if (typeof session.writeStreaming === "function") {
            const stream: ReadableStream<string> = session.writeStreaming(prompt.trim(), opts);
            let prev = "";
            for await (const value of readStream(stream)) {
              if (abortRef.current) break;
              if (typeof value === "string") {
                if (value.startsWith(prev)) { const d = value.slice(prev.length); if (d) setOutput(o => o + d); prev = value; }
                else { if (value) setOutput(o => o + value); }
              }
            }
          } else {
            const result: string = await session.write(prompt.trim(), opts);
            setOutput(result);
          }
        } else if (activeTask === "rewriter") {
          const opts = ctx ? { context: ctx } : {};
          if (typeof session.rewriteStreaming === "function") {
            const stream: ReadableStream<string> = session.rewriteStreaming(prompt.trim(), opts);
            let prev = "";
            for await (const value of readStream(stream)) {
              if (abortRef.current) break;
              if (typeof value === "string") {
                if (value.startsWith(prev)) { const d = value.slice(prev.length); if (d) setOutput(o => o + d); prev = value; }
                else { if (value) setOutput(o => o + value); }
              }
            }
          } else {
            const result: string = await session.rewrite(prompt.trim(), opts);
            setOutput(result);
          }
        }

        session.destroy?.();
        sessionRef.current = null;
      }

      if (!abortRef.current) { setStatus("done"); setMs(performance.now() - t0); }
      else setStatus("idle");
    } catch (err) {
      setPreparing(false); setDownloadPct(null);
      setStatus("error"); setError(String(err));
    }
  };

  const handleAbort = () => {
    abortRef.current = true;
    sessionRef.current?.destroy();
    sessionRef.current = null;
    setStatus("idle");
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(output);
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  };


  // If nothing is available at all, show the full setup guide
  if (!TASKS.some(t => apiAvailable(t.id))) {
    return (
      <div className="flex flex-col gap-4 flex-1">
        <div className="rounded-2xl border p-5 flex flex-col gap-4"
          style={{ borderColor: "rgba(234,67,53,0.3)", background: "rgba(234,67,53,0.05)" }}>
          <div className="flex items-center gap-2">
            <AlertTriangle size={16} className="text-red-400 flex-shrink-0" />
            <span className="text-sm font-semibold text-red-400">Gemini Nano not available</span>
          </div>
          <p className="text-xs leading-relaxed" style={{ color: "var(--text-2)" }}>
            Requires Chrome 127+ with built-in AI enabled:
          </p>
          <ol className="text-xs leading-loose list-decimal list-inside space-y-1" style={{ color: "var(--text-2)" }}>
            <li>Open <code className="px-1 py-0.5 rounded text-[11px]" style={{ background: "var(--bg-3)" }}>chrome://flags</code></li>
            <li>Set <strong>Prompt API for Gemini Nano</strong> to <strong>Enabled Multilingual</strong></li>
            <li>Set <strong>Optimization Guide On Device Model</strong> to <strong>Enabled BypassPerfReq</strong></li>
            <li><strong>Fully relaunch Chrome</strong></li>
            <li>Go to <code className="px-1 py-0.5 rounded text-[11px]" style={{ background: "var(--bg-3)" }}>chrome://components</code> and update <strong>Optimization Guide On Device Model</strong></li>
            <li>Reload this page</li>
          </ol>
          <a href="https://huggingface.co/blog/Xenova/run-gemini-nano-in-your-browser"
            target="_blank" rel="noopener noreferrer"
            className="text-xs underline" style={{ color: "#4285f4" }}>
            Setup guide
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">

      {/* Model header bar */}
      <div className="flex items-center justify-between gap-3 p-4 rounded-2xl border"
        style={{ background: "var(--bg-card)", borderColor: "var(--border)" }}>
        <div>
          <p className="text-sm font-semibold" style={{ color: "var(--text)" }}>Gemini Nano</p>
          <p className="text-xs mt-0.5 font-mono" style={{ color: "var(--text-3)" }}>
            Built-in · Chrome 127+
          </p>
        </div>
        <div className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg"
          style={{ background: "rgba(66,133,244,0.12)", border: "1px solid rgba(66,133,244,0.3)", color: "#4285f4" }}>
          <Globe size={12} /> Chrome Built-in
        </div>
      </div>

      {/* Task tab bar + info button */}
      <div className="flex items-center gap-2 flex-wrap">
        {TASKS.map(t => (
          <button key={t.id} onClick={() => switchTask(t.id)}
            className="relative flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-medium transition-all overflow-hidden"
            style={{
              background:  activeTask === t.id ? `${t.color}1a` : "var(--bg-card)",
              border:      `1px solid ${activeTask === t.id ? t.color + "90" : "var(--border)"}`,
              color:       activeTask === t.id ? t.color : "var(--text-3)",
              boxShadow:   activeTask === t.id ? `0 0 14px ${t.color}28` : "none",
            }}>
            <span className="absolute left-0 top-0 bottom-0 w-[3px] rounded-l-xl"
              style={{ background: t.color, opacity: activeTask === t.id ? 1 : 0.3 }} />
            <t.Icon size={12} />
            <span>{t.label}</span>
            {!apiAvailable(t.id) && (
              <span className="text-[9px] opacity-40 ml-0.5">x</span>
            )}
          </button>
        ))}

        <button
          onClick={() => setShowInfo(v => !v)}
          className="ml-auto flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-xl transition-all"
          style={{
            background: showInfo ? "rgba(66,133,244,0.15)" : "var(--bg-card)",
            border: `1px solid ${showInfo ? "#4285f480" : "var(--border)"}`,
            color: showInfo ? "#4285f4" : "var(--text-3)",
          }}
        >
          <Info size={12} /> Setup
        </button>
      </div>

      {/* Collapsible setup guide */}
      {showInfo && (
        <div className="rounded-2xl border p-4 flex flex-col gap-3"
          style={{ borderColor: "rgba(66,133,244,0.3)", background: "rgba(66,133,244,0.05)" }}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold" style={{ color: "#4285f4" }}>
              Chrome Built-in AI — Setup Guide
            </span>
            <button onClick={() => setShowInfo(false)} style={{ color: "var(--text-3)" }}>
              <X size={13} />
            </button>
          </div>
          <ol className="text-xs leading-loose list-decimal list-inside space-y-1" style={{ color: "var(--text-2)" }}>
            <li>Open <code className="px-1 py-0.5 rounded" style={{ background: "var(--bg-3)" }}>chrome://flags</code> in Chrome</li>
            <li>Set <strong>Prompt API for Gemini Nano</strong> to <strong>Enabled Multilingual</strong></li>
            <li>Set <strong>Optimization Guide On Device Model</strong> to <strong>Enabled BypassPerfReq</strong></li>
            <li><strong>Fully relaunch Chrome</strong> (close all windows)</li>
            <li>Open <code className="px-1 py-0.5 rounded" style={{ background: "var(--bg-3)" }}>chrome://components</code> and update <strong>Optimization Guide On Device Model</strong></li>
            <li>For Summarizer / Writer / Rewriter / Translate: enable their respective flags under <code className="px-1 py-0.5 rounded" style={{ background: "var(--bg-3)" }}>chrome://flags</code></li>
            <li>Reload this page</li>
          </ol>
          <a href="https://huggingface.co/blog/Xenova/run-gemini-nano-in-your-browser"
            target="_blank" rel="noopener noreferrer"
            className="text-xs underline w-fit" style={{ color: "#4285f4" }}>
            Full setup guide
          </a>
        </div>
      )}

      {/* Download / Preparing bar */}
      {(preparing || downloadPct !== null) && (
        <div className="rounded-2xl border p-4 flex flex-col gap-2"
          style={{ background: "var(--bg-card)", borderColor: "var(--border)" }}>
          <p className="text-xs font-semibold" style={{ color: "var(--text-3)" }}>
            {downloadPct !== null ? `Downloading ${task.label} model...` : `Preparing ${task.label}...`}
          </p>
          {downloadPct !== null
            ? <ProgressBar progress={downloadPct} label={`${task.label} — ${downloadPct}%`} />
            : <div className="w-full h-1.5 rounded-full animate-pulse"
                style={{ background: `linear-gradient(90deg,${task.color},${task.color}88,${task.color})` }} />
          }
        </div>
      )}

      {/* Per-task API unavailable notice */}
      {!available && (
        <div className="rounded-2xl border p-4"
          style={{ borderColor: `${task.color}40`, background: `${task.color}08` }}>
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle size={13} style={{ color: task.color }} />
            <span className="text-xs font-semibold" style={{ color: task.color }}>
              {task.label} API not available
            </span>
          </div>
          <p className="text-xs" style={{ color: "var(--text-3)" }}>
            This Chrome built-in API is not exposed in your browser. Try Chrome Canary or enable the relevant flag.
          </p>
        </div>
      )}

      {/* Main Input / Output grid */}
      {available && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">

          {/* Input panel */}
          <div className="rounded-2xl border p-5 flex flex-col gap-3"
            style={{
              background: "var(--bg-card)", borderColor: "var(--border)",
              borderLeftWidth: 3, borderLeftColor: task.color,
            }}>
            <div className="flex items-center gap-2">
              <Globe size={13} style={{ color: task.color }} />
              <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-3)" }}>
                {task.label}
              </span>
              <span className="ml-auto text-[10px] px-2 py-0.5 rounded-full font-semibold"
                style={{ background: `${task.color}18`, color: task.color, border: `1px solid ${task.color}40` }}>
                Chrome Built-in
              </span>
            </div>

            {/* Language selectors (translate only) */}
            {activeTask === "translate" && (
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <NanoLangInline value={sourceLang} onChange={setSourceLang}
                    languages={languages} onAdd={handleAddLanguage} color={task.color} />
                  <button onClick={handleSwapLangs} title="Swap languages"
                    className="flex-shrink-0 p-1 rounded-md transition-colors hover:opacity-70"
                    style={{ color: "var(--text-3)" }}>
                    <ArrowRightLeft size={12} />
                  </button>
                  <NanoLangInline value={targetLang} onChange={setTargetLang}
                    languages={languages} onAdd={handleAddLanguage} color={task.color} />
                </div>
              </div>
            )}

            {/* Image upload (prompt-image only) */}
            {activeTask === "prompt-image" && (
              <>
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden"
                  onChange={e => e.target.files?.[0] && handleImageUpload(e.target.files[0])} />
                {imageUrl ? (
                  <div className="relative rounded-xl overflow-hidden border" style={{ borderColor: "var(--border)" }}>
                    <img src={imageUrl} alt="Input" className="w-full block rounded-xl" style={{ height: "auto" }} />
                    <button onClick={() => { setImageFile(null); setImageUrl(null); }}
                      className="absolute top-2 right-2 w-7 h-7 rounded-full flex items-center justify-center"
                      style={{ background: "rgba(0,0,0,0.6)" }}>
                      <X size={12} className="text-white" />
                    </button>
                  </div>
                ) : (
                  <button onClick={() => fileInputRef.current?.click()}
                    className="w-full rounded-xl border-2 border-dashed flex flex-col items-center gap-3 transition-colors hover:opacity-80"
                    style={{ height: 150, borderColor: `${task.color}60`, color: "var(--text-3)", background: "var(--bg-card)" }}>
                    <Upload size={26} style={{ color: task.color, opacity: 0.7 }} />
                    <div className="text-center">
                      <p className="text-sm font-medium">Click to upload image</p>
                      <p className="text-xs mt-0.5" style={{ color: "var(--text-3)" }}>PNG, JPG, WEBP supported</p>
                    </div>
                  </button>
                )}
              </>
            )}

            {/* Main prompt textarea */}
            <textarea
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) handleRun(); }}
              placeholder={INPUT_PLACEHOLDER[activeTask]}
              disabled={status === "running"}
              rows={activeTask === "writer" || activeTask === "rewriter" ? 4 : 3}
              className="flex-1 resize-none text-sm rounded-xl px-4 py-3 outline-none"
              style={{ background: "var(--bg-card)", border: "1px solid var(--border)", color: "var(--text)" }}
            />

            {/* Context / instructions (writer and rewriter only) */}
            {(activeTask === "writer" || activeTask === "rewriter") && (
              <textarea
                value={context}
                onChange={e => setContext(e.target.value)}
                placeholder={CONTEXT_PLACEHOLDER[activeTask]}
                disabled={status === "running"}
                rows={2}
                className="resize-none text-sm rounded-xl px-4 py-3 outline-none"
                style={{ background: "var(--bg-card)", border: `1px solid ${task.color}40`, color: "var(--text-2)" }}
              />
            )}

            <div className="flex items-center justify-between">
              <span className="text-xs" style={{ color: "var(--text-3)" }}>Ctrl+Enter to run</span>
              {status === "running" ? (
                <button onClick={handleAbort}
                  className="flex items-center gap-2 text-sm px-4 py-1.5 rounded-xl"
                  style={{ color: "#f87171", border: "1px solid rgba(239,68,68,0.3)" }}>
                  <StopCircle size={14} /> Stop
                </button>
              ) : (
                <button onClick={handleRun} disabled={!canRun}
                  className="flex items-center gap-2 text-sm px-4 py-1.5 rounded-xl font-medium transition-all disabled:opacity-40"
                  style={{
                    background: canRun ? "linear-gradient(135deg,#4285f4,#e040fb)" : `${task.color}18`,
                    border: canRun ? "none" : `1px solid ${task.color}40`,
                    color: canRun ? "#fff" : task.color,
                  }}>
                  <Send size={14} /> Run
                </button>
              )}
            </div>
          </div>

          {/* Output panel */}
          <div className="rounded-2xl border p-5 flex flex-col gap-4"
            style={{ background: "var(--bg-card)", borderColor: "var(--border)" }}>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-3)" }}>
                Output
              </span>
              <div className="flex items-center gap-3">
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

            <div className="rounded-xl border p-4 min-h-[80px]"
              style={{ background: "var(--bg-card)", borderColor: "var(--border)" }}>
              {status === "idle" && !output && (
                <p className="text-sm" style={{ color: "var(--text-3)", opacity: 0.5 }}>Output will appear here</p>
              )}
              {status === "error" && error && (
                <div className="text-red-400 text-sm bg-red-500/10 rounded-lg p-3 border border-red-500/20">
                  <p className="font-semibold mb-1">Error</p>
                  <p className="text-xs font-mono leading-relaxed">{error}</p>
                </div>
              )}
              {(output || status === "running") && (
                <div className="text-sm leading-relaxed prose prose-sm max-w-none"
                  style={{ color: "var(--text)" }}>
                  <ReactMarkdown
                    components={{
                      p:      ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                      strong: ({ children }) => <strong className="font-semibold" style={{ color: "var(--text)" }}>{children}</strong>,
                      em:     ({ children }) => <em className="italic">{children}</em>,
                      ul:     ({ children }) => <ul className="list-disc list-inside mb-2 space-y-0.5">{children}</ul>,
                      ol:     ({ children }) => <ol className="list-decimal list-inside mb-2 space-y-0.5">{children}</ol>,
                      li:     ({ children }) => <li>{children}</li>,
                      code:   ({ children }) => <code className="px-1 py-0.5 rounded text-[11px] font-mono" style={{ background: "var(--bg-3)" }}>{children}</code>,
                      pre:    ({ children }) => <pre className="rounded-lg p-3 overflow-x-auto text-xs font-mono mb-2" style={{ background: "var(--bg-3)" }}>{children}</pre>,
                      h1:     ({ children }) => <h1 className="text-base font-bold mb-2">{children}</h1>,
                      h2:     ({ children }) => <h2 className="text-sm font-bold mb-1.5">{children}</h2>,
                      h3:     ({ children }) => <h3 className="text-sm font-semibold mb-1">{children}</h3>,
                    }}
                  >
                    {output}
                  </ReactMarkdown>
                  {status === "running" && (
                    <span className="inline-block w-2 h-4 ml-0.5 animate-pulse rounded-sm align-middle"
                      style={{ background: task.color }} />
                  )}
                </div>
              )}
            </div>
          </div>

        </div>
      )}
    </div>
  );
}

function NanoLangInline({ value, onChange, languages, onAdd, color }: {
  value: string; onChange: (v: string) => void;
  languages: string[]; onAdd: (name: string) => void; color: string;
}) {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft]   = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (adding) { inputRef.current?.focus(); setDraft(""); }
  }, [adding]);

  const commit = () => {
    const trimmed = draft.trim();
    if (trimmed) { onAdd(trimmed); onChange(trimmed); }
    setAdding(false);
  };

  const selectStyle = {
    background: "var(--bg-card)",
    border: `1px solid ${color}40`,
    color: "var(--text)",
    borderRadius: "0.5rem",
    padding: "0.2rem 0.5rem",
    fontSize: "0.75rem",
    outline: "none",
    maxWidth: 140,
  };

  if (adding) {
    return (
      <div className="flex items-center gap-1">
        <input
          ref={inputRef}
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") commit(); if (e.key === "Escape") setAdding(false); }}
          placeholder="Language name…"
          className="text-xs rounded-lg px-2 py-1 outline-none"
          style={{ background: "var(--bg-card)", border: `1px solid ${color}60`, color: "var(--text)", width: 130 }}
        />
        <button onClick={commit} className="p-1 rounded flex-shrink-0" style={{ color }}><Check size={12} /></button>
        <button onClick={() => setAdding(false)} className="p-1 rounded flex-shrink-0" style={{ color: "var(--text-3)" }}><X size={12} /></button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1">
      <select value={value} onChange={e => onChange(e.target.value)} style={selectStyle}>
        {languages.map(l => <option key={l} value={l}>{l}</option>)}
      </select>
      <button onClick={() => setAdding(true)} title="Add a language"
        className="p-1 rounded-md flex-shrink-0 transition-colors hover:opacity-70"
        style={{ color: "var(--text-3)", border: "1px solid var(--border)" }}>
        <Plus size={11} />
      </button>
    </div>
  );
}
