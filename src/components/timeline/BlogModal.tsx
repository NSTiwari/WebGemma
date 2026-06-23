import { X, ExternalLink } from "lucide-react";
import type { TimelineMilestone } from "../../types";
import { useTheme } from "../../context/ThemeContext";

interface BlogModalProps {
  milestone: TimelineMilestone;
  accent: string;
  onClose: () => void;
}

export function BlogModal({ milestone, accent, onClose }: BlogModalProps) {
  const { theme } = useTheme();
  const hasVideo = !!milestone.mediaUrl;

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 100,
        background: "rgba(0,0,0,0.55)",
        backdropFilter: "blur(8px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "24px",
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: theme === "dark" ? "#0f172a" : "#ffffff",
          border: `1.5px solid ${accent}60`,
          borderRadius: 20,
          width: "100%",
          maxWidth: hasVideo ? 780 : 560,
          boxShadow: `0 24px 60px rgba(0,0,0,0.4), 0 0 40px ${accent}20`,
          overflow: "hidden",
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          padding: "18px 22px 14px",
          borderBottom: `1px solid ${accent}30`,
          display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12,
        }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <h2 style={{ fontSize: 17, fontWeight: 800, color: "var(--text)", margin: 0 }}>
                {milestone.name}
              </h2>
              <span style={{
                fontSize: 11, fontWeight: 600, padding: "2px 10px", borderRadius: 99,
                background: `${accent}20`, color: accent, border: `1px solid ${accent}40`,
              }}>
                {milestone.date}
              </span>
              {milestone.highlight && (
                <span style={{ fontSize: 11, color: accent, fontWeight: 600 }}>
                  ★ {milestone.highlight}
                </span>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              width: 32, height: 32, borderRadius: 8,
              border: "1px solid var(--border)",
              background: "var(--bg-3)", cursor: "pointer", color: "var(--text-3)",
              display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
            }}
          >
            <X size={15} />
          </button>
        </div>

        {/* Video - full width, no padding */}
        {hasVideo && (
          <div style={{ width: "100%", aspectRatio: "16/9", background: "#000" }}>
            <iframe
              src={milestone.mediaUrl}
              style={{ width: "100%", height: "100%", border: "none", display: "block" }}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        )}

        {/* Body - shown only when no video */}
        {!hasVideo && (
          <div style={{ padding: "20px 22px" }}>
            <p style={{ fontSize: 13, color: "var(--text-2)", lineHeight: 1.7, margin: "0 0 16px" }}>
              {milestone.description}
            </p>
            <div style={{
              background: "var(--bg-3)",
              border: "1px solid var(--border)",
              borderRadius: 10, padding: "10px 14px",
              fontSize: 12, color: "var(--text-3)",
            }}>
              No on-device ONNX export available yet. Not runnable in the Playground.
            </div>
          </div>
        )}

        {/* Footer */}
        {milestone.blogUrl && (
          <div style={{
            padding: "13px 22px",
            borderTop: `1px solid ${accent}20`,
            display: "flex", alignItems: "center", justifyContent: hasVideo ? "space-between" : "flex-end", gap: 12,
          }}>
            {hasVideo && (
              <p style={{ fontSize: 12, color: "var(--text-3)", margin: 0, flex: 1 }}>
                {milestone.description}
              </p>
            )}
            <a
              href={milestone.blogUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: "flex", alignItems: "center", gap: 7, flexShrink: 0,
                padding: "8px 16px", borderRadius: 10,
                background: accent, color: "white",
                fontWeight: 700, fontSize: 13, textDecoration: "none",
                boxShadow: `0 4px 14px ${accent}50`,
              }}
            >
              {milestone.blogUrl?.includes("developer.chrome.com") ? "Documentation" : "Visit Blog"} <ExternalLink size={13} />
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
