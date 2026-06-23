import { Sun, Moon } from "lucide-react";
import { useTheme } from "../../context/ThemeContext";

interface HeaderProps {
  activeTab: "playground" | "timeline";
  onTabChange: (tab: "playground" | "timeline") => void;
}

export function Header({ activeTab, onTabChange }: HeaderProps) {
  const { theme, toggle } = useTheme();
  const isDark = theme === "dark";

  return (
    <header
      className="sticky top-0 z-50 border-b backdrop-blur-xl"
      style={{
        background: "var(--header-bg)",
        borderColor: "var(--border)",
      }}
    >
      {/* Use relative+absolute so the center block is truly centered regardless of side widths */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-20 relative flex items-center">

        {/* Left side: Journey title (timeline tab only) */}
        {activeTab === "timeline" && (
          <div className="flex flex-col gap-1 flex-shrink-0 relative z-10">
            <span className="text-lg font-extrabold leading-tight" style={{ color: isDark ? "#f1f5f9" : "#0f172a" }}>
              The Gemma Journey
            </span>
            <span className="text-[10px] font-medium" style={{ color: isDark ? "#94a3b8" : "#64748b" }}>
              Scroll to zoom · Drag to pan · Click an island to explore
            </span>
            <div id="zoom-controls-slot" />
          </div>
        )}

        {/* Absolutely centered: WebGemma + attribution */}
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-0.5 pointer-events-none">
          <span
            className="text-3xl font-bold tracking-tight leading-none"
            style={{ color: "#0ea5e9" }}
          >
            WebGemma
          </span>
          <span
            className="flex items-center gap-1.5"
            style={{
              fontFamily: "Calibri, 'Gill Sans', 'Trebuchet MS', sans-serif",
              fontSize: "1.05rem",
              fontWeight: 400,
              fontStyle: "normal",
              color: isDark ? "#cbd5e1" : "#1e3a5f",
              letterSpacing: "0.02em",
            }}
          >
            Made with 🧡 by{" "}
            <img
              src="/dev-logo.png"
              alt="Google Developers"
              style={{ height: "1.1em", width: "auto", display: "inline-block", verticalAlign: "middle" }}
            />
            {" "}<a
              href="https://linkedin.com/in/tiwari-nitin"
              target="_blank"
              rel="noopener noreferrer"
              className="pointer-events-auto transition-colors underline-offset-2 hover:underline"
              style={{ color: "inherit" }}
              onMouseEnter={e => (e.currentTarget.style.color = "#f59e0b")}
              onMouseLeave={e => (e.currentTarget.style.color = "inherit")}
            >Nitin Tiwari</a>
          </span>
        </div>

        {/* Nav tabs - right side */}
        <nav
          className="ml-auto flex items-center gap-1 p-1 rounded-xl flex-shrink-0 relative z-10"
          style={{ background: isDark ? "rgba(255,255,255,0.05)" : "rgba(14,165,233,0.08)" }}
        >
          {(["timeline", "playground"] as const).map((t) => (
            <button
              key={t}
              onClick={() => onTabChange(t)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
                activeTab === t
                  ? "bg-sky-500 text-white shadow-md"
                  : "hover:bg-sky-500/10"
              }`}
              style={{ color: activeTab === t ? "white" : isDark ? "#94a3b8" : "#334155" }}
            >
              {t === "playground" ? "Playground" : "Gemma Journey"}
            </button>
          ))}
        </nav>

        {/* Theme toggle */}
        <button
          onClick={toggle}
          className="ml-3 w-8 h-8 rounded-lg flex items-center justify-center transition-all hover:scale-110 flex-shrink-0 relative z-10"
          style={{
            background: isDark ? "rgba(255,255,255,0.06)" : "rgba(14,165,233,0.1)",
            color: isDark ? "#e2e8f0" : "#0f172a",
            border: "1px solid var(--border)",
          }}
          title={isDark ? "Switch to light mode" : "Switch to dark mode"}
        >
          {isDark ? <Sun size={14} /> : <Moon size={14} />}
        </button>

      </div>
    </header>
  );
}
