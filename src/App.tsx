import { useState } from "react";
import { ThemeProvider } from "./context/ThemeContext";
import { Header } from "./components/layout/Header";
import { Playground } from "./components/playground/Playground";
import { Timeline } from "./components/timeline/Timeline";

type Tab = "playground" | "timeline";

export default function App() {
  const [tab, setTab] = useState<Tab>("timeline");
  const [jumpModelId, setJumpModelId] = useState<string | null>(null);

  const handleMilestoneNavigate = (modelId: string) => {
    setJumpModelId(modelId);
    setTab("playground");
  };

  return (
    <ThemeProvider>
      <div className="min-h-screen flex flex-col" style={{ background: "var(--bg)" }}>
        <Header activeTab={tab} onTabChange={setTab} />
        <main className="flex-1 overflow-y-auto">
          {tab === "playground" ? (
            <Playground jumpModelId={jumpModelId} onJumpConsumed={() => setJumpModelId(null)} onNavigateTab={setTab} />
          ) : (
            <Timeline onNavigateModel={handleMilestoneNavigate} />
          )}
        </main>
      </div>
    </ThemeProvider>
  );
}
