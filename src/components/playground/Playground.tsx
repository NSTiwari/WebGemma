import { useState, useEffect } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { MODEL_REGISTRY } from "../../config/models";
import { useModelWorker } from "../../hooks/useModelWorker";
import { ModelCard } from "./ModelCard";
import { LoadModelButton } from "./LoadModelButton";
import { InputPanel } from "./InputPanel";
import { OutputPanel } from "./OutputPanel";
import { EmbeddingPanel } from "./EmbeddingPanel";
import { TranslatePanel } from "./TranslatePanel";
import { FunctionPanel } from "./FunctionPanel";
import { NanoPanel } from "./NanoPanel";

interface PlaygroundProps {
  jumpModelId: string | null;
  onJumpConsumed: () => void;
  onNavigateTab: (tab: "timeline" | "playground") => void;
}

export function Playground({ jumpModelId, onJumpConsumed, onNavigateTab }: PlaygroundProps) {
  const [selectedModelId, setSelectedModelId] = useState(MODEL_REGISTRY[0].id);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [lastImageUrl, setLastImageUrl] = useState<string | undefined>();
  const [lastPrompt, setLastPrompt]     = useState("");
  const [everLoaded, setEverLoaded]     = useState(false);
  const { state, loadModel, generate, abort, switchToModel } = useModelWorker();

  useEffect(() => {
    if (state.status === "ready" || state.status === "done") setEverLoaded(true);
  }, [state.status]);

  // Jump to a model from the timeline
  useEffect(() => {
    if (jumpModelId) {
      handleSelectModel(jumpModelId);
      onJumpConsumed();
    }
  }, [jumpModelId]); // eslint-disable-line

  const selectedModel = MODEL_REGISTRY.find((m) => m.id === selectedModelId)!;

  const handleSelectModel = (id: string) => {
    if (id === selectedModelId) return;
    const m = MODEL_REGISTRY.find((m) => m.id === id);
    if (m) switchToModel(m.hfRepo);
    setSelectedModelId(id);
    setLastImageUrl(undefined);
    setLastPrompt("");
  };

  const handleLoad = () => loadModel(selectedModel);

  const handleGenerate = (opts: {
    prompt: string;
    imageUrl?: string;
    audioData?: Float32Array;
  }) => {
    setLastImageUrl(opts.imageUrl);
    setLastPrompt(opts.prompt);
    generate({
      ...opts,
      maxNewTokens: selectedModel.maxNewTokens,
      family: selectedModel.family,
    });
  };

  return (
    <div className="flex h-[calc(100vh-64px)] overflow-hidden">
      <aside
        className="flex-shrink-0 flex flex-col border-r transition-all duration-300 overflow-hidden"
        style={{
          width: sidebarOpen ? 296 : 0,
          borderColor: "var(--border)",
          background: "var(--bg-card)",
        }}
      >
        <div className="flex flex-col gap-2 p-4 overflow-y-auto flex-1" style={{ minWidth: 280 }}>
          <h2
            className="text-xs font-semibold uppercase tracking-wider px-1 mb-1"
            style={{ color: "var(--text-3)" }}
          >
            Select Model
          </h2>
          {MODEL_REGISTRY.map((m) => (
            <ModelCard
              key={m.id}
              model={m}
              isSelected={m.id === selectedModelId}
              onSelect={() => handleSelectModel(m.id)}
            />
          ))}
        </div>
      </aside>

      {/* Toggle button */}
      <button
        onClick={() => setSidebarOpen((o) => !o)}
        className="flex-shrink-0 w-5 flex items-center justify-center transition-colors hover:bg-sky-500/10 z-10"
        style={{
          background: "var(--bg-3)",
          borderRight: `1px solid var(--border)`,
          color: "var(--text-3)",
        }}
        title={sidebarOpen ? "Hide sidebar" : "Show sidebar"}
      >
        {sidebarOpen ? <ChevronLeft size={14} /> : <ChevronRight size={14} />}
      </button>

      <main className="flex-1 overflow-y-auto p-6 flex flex-col gap-5">
        {selectedModel.family !== "nano" && (
          <LoadModelButton
            model={selectedModel}
            status={state.status}
            progress={state.progress}
            onLoad={handleLoad}
            showReloadWarning={everLoaded && state.status === "idle"}
          />
        )}

        {selectedModel.family === "nano" ? (
          <NanoPanel />
        ) : selectedModel.family === "embedding" ? (
          <EmbeddingPanel
            status={state.status}
            embeddingVector={state.embeddingVector}
            onGenerate={(text) => generate({ prompt: text, maxNewTokens: 0, family: "embedding" })}
            onAbort={abort}
          />
        ) : selectedModel.family === "translate" ? (
          <TranslatePanel
            status={state.status}
            output={state.output}
            processingMs={state.processingMs}
            error={state.error}
            onGenerate={generate}
            onAbort={abort}
          />
        ) : selectedModel.family === "function" ? (
          <FunctionPanel
            status={state.status}
            output={state.output}
            processingMs={state.processingMs}
            error={state.error}
            onGenerate={generate}
            onAbort={abort}
            onNavigateTab={onNavigateTab}
            onSelectModel={handleSelectModel}
          />
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-5 flex-1">
            {/* Input */}
            <div
              className="rounded-2xl border p-5 flex flex-col gap-4"
              style={{ background: "var(--bg-card)", borderColor: "var(--border)" }}
            >
              <h3
                className="text-xs font-semibold uppercase tracking-wider"
                style={{ color: "var(--text-3)" }}
              >
                Input
              </h3>
              <InputPanel
                model={selectedModel}
                status={state.status}
                onGenerate={handleGenerate}
                onAbort={abort}
              />
            </div>

            {/* Output */}
            <div
              className="rounded-2xl border p-5 flex flex-col gap-4"
              style={{ background: "var(--bg-card)", borderColor: "var(--border)" }}
            >
              <OutputPanel
                status={state.status}
                output={state.output}
                processingMs={state.processingMs}
                error={state.error}
                imageUrl={lastImageUrl}
                modelFamily={selectedModel.family}
                lastPrompt={lastPrompt}
                device={state.device}
              />
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
