import { useState, useRef, useEffect } from "react";
import { ArrowRightLeft, Languages, Plus, X, Check } from "lucide-react";
import type { InferenceStatus } from "../../types";

const DEFAULT_LANGUAGES = [
  "Afrikaans", "Albanian", "Amharic", "Arabic", "Armenian", "Azerbaijani",
  "Basque", "Belarusian", "Bengali", "Bosnian", "Bulgarian", "Catalan",
  "Cebuano", "Chinese (Simplified)", "Chinese (Traditional)", "Croatian",
  "Czech", "Danish", "Dutch", "English", "Esperanto", "Estonian",
  "Filipino", "Finnish", "French", "Galician", "Georgian", "German",
  "Greek", "Gujarati", "Haitian Creole", "Hausa", "Hebrew", "Hindi",
  "Hmong", "Hungarian", "Icelandic", "Igbo", "Indonesian", "Irish",
  "Italian", "Japanese", "Javanese", "Kannada", "Kazakh", "Khmer",
  "Korean", "Kurdish", "Kyrgyz", "Lao", "Latin", "Latvian", "Lithuanian",
  "Luxembourgish", "Macedonian", "Malagasy", "Malay", "Malayalam",
  "Maltese", "Maori", "Marathi", "Mongolian", "Myanmar (Burmese)",
  "Nepali", "Norwegian", "Nyanja (Chichewa)", "Odia (Oriya)", "Pashto",
  "Persian", "Polish", "Portuguese", "Punjabi", "Romanian", "Russian",
  "Samoan", "Serbian", "Sesotho", "Shona", "Sindhi", "Sinhala", "Slovak",
  "Slovenian", "Somali", "Spanish", "Sundanese", "Swahili", "Swedish",
  "Tajik", "Tamil", "Tatar", "Telugu", "Thai", "Turkish", "Turkmen",
  "Ukrainian", "Urdu", "Uyghur", "Uzbek", "Vietnamese", "Welsh",
  "Xhosa", "Yiddish", "Yoruba", "Zulu",
];

interface Props {
  status: InferenceStatus;
  output: string;
  processingMs: number | null;
  error: string | null;
  onGenerate: (opts: { prompt: string; maxNewTokens: number; family: string }) => void;
  onAbort: () => void;
}

export function TranslatePanel({ status, output, processingMs, error, onGenerate, onAbort }: Props) {
  const [languages, setLanguages] = useState<string[]>(DEFAULT_LANGUAGES);
  const [sourceLang, setSourceLang] = useState("English");
  const [targetLang, setTargetLang] = useState("French");
  const [inputText, setInputText]   = useState("");

  const isRunning = status === "running";
  const canRun    = (status === "ready" || status === "done") && inputText.trim().length > 0;

  const handleSwap = () => {
    setSourceLang(targetLang);
    setTargetLang(sourceLang);
  };

  const handleTranslate = () => {
    if (!canRun) return;
    const prompt = `Translate the following text from ${sourceLang} to ${targetLang}:\n\n${inputText.trim()}`;
    onGenerate({ prompt, maxNewTokens: 1024, family: "translate" });
  };

  const handleAddLanguage = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed || languages.includes(trimmed)) return;
    setLanguages(prev => [...prev, trimmed].sort());
  };

  return (
    <div className="flex flex-col gap-5 flex-1">
      {/* Language selectors */}
      <div className="flex items-center gap-3">
        <LanguageSelect
          value={sourceLang} onChange={setSourceLang} label="From"
          languages={languages} onAddLanguage={handleAddLanguage}
        />
        <button onClick={handleSwap}
          className="p-2 rounded-xl transition-colors hover:bg-sky-500/10 flex-shrink-0 mt-4"
          style={{ color: "var(--text-3)", border: "1px solid var(--border)" }}
          title="Swap languages">
          <ArrowRightLeft size={15} />
        </button>
        <LanguageSelect
          value={targetLang} onChange={setTargetLang} label="To"
          languages={languages} onAddLanguage={handleAddLanguage}
        />
      </div>

      {/* Input / Output grid */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5 flex-1">
        {/* Input */}
        <div className="rounded-2xl border flex flex-col"
          style={{ background: "var(--bg-card)", borderColor: "var(--border)" }}>
          <div className="flex items-center justify-between px-5 pt-4 pb-2">
            <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-3)" }}>
              {sourceLang}
            </span>
            <span className="text-[10px]" style={{ color: "var(--text-3)" }}>Ctrl+Enter to translate</span>
          </div>
          <textarea
            value={inputText}
            onChange={e => setInputText(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) handleTranslate(); }}
            placeholder="Enter text to translate…"
            disabled={isRunning}
            className="flex-1 resize-none text-sm px-5 pb-4 outline-none bg-transparent"
            style={{ color: "var(--text)", minHeight: 200 }}
          />
          <div className="flex items-center justify-between px-5 pb-4">
            <span className="text-xs" style={{ color: "var(--text-3)" }}>{inputText.length} chars</span>
            {isRunning ? (
              <button onClick={onAbort}
                className="text-sm px-4 py-1.5 rounded-xl"
                style={{ color: "#f87171", border: "1px solid rgba(239,68,68,0.3)" }}>
                Abort
              </button>
            ) : (
              <button onClick={handleTranslate} disabled={!canRun}
                className="flex items-center gap-2 text-sm px-4 py-1.5 rounded-xl font-medium transition-all disabled:opacity-40"
                style={{ background: "rgba(168,85,247,0.12)", border: "1px solid rgba(168,85,247,0.3)", color: "#a855f7" }}>
                <Languages size={14} /> Translate
              </button>
            )}
          </div>
        </div>

        {/* Output */}
        <div className="rounded-2xl border flex flex-col"
          style={{ background: "var(--bg-card)", borderColor: "var(--border)" }}>
          <div className="flex items-center justify-between px-5 pt-4 pb-2">
            <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-3)" }}>
              {targetLang}
            </span>
            {processingMs != null && (
              <span className="text-[10px]" style={{ color: "var(--text-3)" }}>
                {(processingMs / 1000).toFixed(1)}s
              </span>
            )}
          </div>
          <div className="flex-1 px-5 pb-4 text-sm overflow-y-auto" style={{ minHeight: 200 }}>
            {error ? (
              <p className="text-red-400 text-xs">{error}</p>
            ) : isRunning && !output ? (
              <p className="text-xs animate-pulse" style={{ color: "var(--text-3)" }}>Translating…</p>
            ) : output ? (
              <p className="leading-relaxed whitespace-pre-wrap" style={{ color: "var(--text)" }}>{output}</p>
            ) : (
              <p className="text-xs" style={{ color: "var(--text-3)", opacity: 0.5 }}>
                Translation will appear here
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function LanguageSelect({ value, onChange, label, languages, onAddLanguage }: {
  value: string;
  onChange: (v: string) => void;
  label: string;
  languages: string[];
  onAddLanguage: (name: string) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft]   = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (adding) { inputRef.current?.focus(); setDraft(""); }
  }, [adding]);

  const commit = () => {
    const trimmed = draft.trim();
    if (trimmed) {
      onAddLanguage(trimmed);
      onChange(trimmed);
    }
    setAdding(false);
  };

  return (
    <div className="flex-1 flex flex-col gap-1">
      <span className="text-[10px] font-semibold uppercase tracking-wider px-1" style={{ color: "var(--text-3)" }}>
        {label}
      </span>
      {adding ? (
        <div className="flex items-center gap-1">
          <input
            ref={inputRef}
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={e => {
              if (e.key === "Enter") commit();
              if (e.key === "Escape") setAdding(false);
            }}
            placeholder="Language name…"
            className="flex-1 text-sm rounded-xl px-3 py-2 outline-none min-w-0"
            style={{ background: "var(--bg-3)", border: "1px solid rgba(168,85,247,0.5)", color: "var(--text)" }}
          />
          <button onClick={commit}
            className="p-2 rounded-lg hover:bg-purple-500/10 transition-colors flex-shrink-0"
            style={{ color: "#a855f7" }}>
            <Check size={14} />
          </button>
          <button onClick={() => setAdding(false)}
            className="p-2 rounded-lg hover:bg-red-500/10 transition-colors flex-shrink-0"
            style={{ color: "var(--text-3)" }}>
            <X size={14} />
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-1">
          <select value={value} onChange={e => onChange(e.target.value)}
            className="flex-1 text-sm rounded-xl px-3 py-2 outline-none min-w-0"
            style={{ background: "var(--bg-3)", border: "1px solid var(--border)", color: "var(--text)" }}>
            {languages.map(l => (
              <option key={l} value={l}>{l}</option>
            ))}
          </select>
          <button onClick={() => setAdding(true)}
            title="Add a language"
            className="p-2 rounded-lg hover:bg-purple-500/10 transition-colors flex-shrink-0"
            style={{ color: "var(--text-3)", border: "1px solid var(--border)" }}>
            <Plus size={14} />
          </button>
        </div>
      )}
    </div>
  );
}
