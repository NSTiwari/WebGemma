import { Cpu, Image, Mic, Type, ExternalLink, Check } from "lucide-react";
import type { ModelConfig } from "../../types";
import { FAMILY_COLORS } from "../../config/timeline";
import { MODEL_COLORS } from "../../config/models";
import { useTheme } from "../../context/ThemeContext";

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
function formatDate(d: string): string {
  const [year, month] = d.split("-");
  return month ? `${MONTHS[parseInt(month) - 1]} ${year}` : d;
}

interface ModelCardProps {
  model: ModelConfig;
  isSelected: boolean;
  onSelect: () => void;
}

const modalityIcons = { text: Type, image: Image, audio: Mic };

export function ModelCard({ model, isSelected, onSelect }: ModelCardProps) {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const accentColor = MODEL_COLORS[model.id] ?? FAMILY_COLORS[model.family] ?? "#0ea5e9";

  const cardBg     = isDark ? `${accentColor}18` : `${accentColor}28`;
  const cardBorder = isDark ? `${accentColor}70` : `${accentColor}cc`;
  const cardShadow = isSelected
    ? `0 0 22px ${isDark ? accentColor + "40" : accentColor + "55"}`
    : `0 0 10px ${isDark ? accentColor + "18" : accentColor + "28"}`;
  const iconBg     = isDark ? `${accentColor}25` : `${accentColor}30`;
  const iconBorder = isDark ? `${accentColor}50` : `${accentColor}80`;

  const isNano = model.family === "nano";
  const nanoText1 = "#ffffff";
  const nanoText2 = "rgba(255,255,255,0.80)";
  const nanoText3 = "rgba(255,255,255,0.65)";

  return (
    <button
      onClick={onSelect}
      className="relative w-full text-left p-4 rounded-2xl border transition-all duration-200"
      style={{
        background:  isNano ? "rgba(15,23,42,0.92)" : cardBg,
        borderColor: isNano ? "rgba(66,133,244,0.35)" : cardBorder,
        boxShadow:   isNano
          ? `0 0 18px rgba(66,133,244,0.18), ${cardShadow}`
          : cardShadow,
      }}
    >
      {/* Google-color diagonal stripes clipped to top-right corner triangle */}
      {isNano && (
        <div
          className="absolute top-0 right-0 pointer-events-none"
          style={{
            width: 80, height: 80,
            borderTopRightRadius: "1rem",
            clipPath: "polygon(100% 0, 0 0, 100% 100%)",
            background: "repeating-linear-gradient(-45deg,#4285f4 0px,#4285f4 9px,#ea4335 9px,#ea4335 18px,#fbbc05 18px,#fbbc05 27px,#34a853 27px,#34a853 36px,transparent 36px,transparent 44px)",
            opacity: 0.85,
          }}
        />
      )}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex items-center gap-2.5">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{
              background: isNano ? "rgba(255,255,255,0.12)" : iconBg,
              border: `1px solid ${isNano ? "rgba(255,255,255,0.2)" : iconBorder}`,
            }}
          >
            <Cpu size={15} style={{ color: isNano ? "rgba(255,255,255,0.85)" : accentColor }} />
          </div>
          <div>
            <p className="text-sm font-semibold leading-tight"
              style={{ color: isNano ? nanoText1 : "var(--text)" }}>
              {model.name}
            </p>
            <p className="text-xs mt-0.5"
              style={{ color: isNano ? nanoText3 : "var(--text-3)" }}>
              {formatDate(model.releaseDate)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {isSelected && (
            <div className="w-5 h-5 rounded-full bg-sky-500 flex items-center justify-center">
              <Check size={11} className="text-white" />
            </div>
          )}
        </div>
      </div>

      <p className="text-xs leading-relaxed mb-3 line-clamp-2"
        style={{ color: isNano ? nanoText2 : "var(--text-2)" }}>
        {model.description}
      </p>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          {model.inputModalities.map((m) => {
            const Icon = modalityIcons[m];
            return (
              <span
                key={m}
                className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-md font-medium"
                style={{
                  background: isNano ? "rgba(255,255,255,0.1)" : isDark ? "var(--bg-3)" : `${accentColor}18`,
                  color:      isNano ? nanoText2 : isDark ? "var(--text-3)" : accentColor,
                  border:     `1px solid ${isNano ? "rgba(255,255,255,0.15)" : isDark ? "transparent" : accentColor + "40"}`,
                }}
              >
                <Icon size={9} />{m}
              </span>
            );
          })}
        </div>
        <a
          href={`https://huggingface.co/${model.hfRepo}`}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="flex items-center gap-1 text-[10px] transition-colors hover:text-sky-400"
          style={{ color: isNano ? nanoText3 : "var(--text-3)" }}
        >
          HF <ExternalLink size={9} />
        </a>
      </div>
    </button>
  );
}
