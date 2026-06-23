import { useRef, useState, useCallback } from "react";
import type { ModelConfig, InferenceStatus, ModelLoadProgress } from "../types";

interface WorkerState {
  status: InferenceStatus;
  output: string;
  progress: ModelLoadProgress | null;
  error: string | null;
  processingMs: number | null;
  loadedModelRepo: string | null;
  device: "webgpu" | "wasm" | null;
  embeddingVector: number[] | null;
}

export function useModelWorker() {
  const workerRef = useRef<Worker | null>(null);
  const loadingRepoRef = useRef<string | null>(null);
  const [state, setState] = useState<WorkerState>({
    status: "idle",
    output: "",
    progress: null,
    error: null,
    processingMs: null,
    loadedModelRepo: null,
    device: null,
    embeddingVector: null,
  });

  const ensureWorker = useCallback(() => {
    if (!workerRef.current) {
      workerRef.current = new Worker(
        new URL("../workers/model.worker.ts", import.meta.url),
        { type: "module" }
      );

      workerRef.current.onmessage = (e: MessageEvent) => {
        const msg = e.data;
        switch (msg.type) {
          case "device_info":
            setState((s) => ({ ...s, device: msg.device }));
            break;
          case "load_start":
            setState((s) => ({ ...s, status: "loading", error: null }));
            break;
          case "load_progress":
            setState((s) => ({
              ...s,
              progress: {
                file: msg.file,
                loaded: msg.loaded,
                total: msg.total,
                progress: msg.progress,
              },
            }));
            break;
          case "load_done":
            setState((s) => ({ ...s, status: "ready", progress: null, loadedModelRepo: loadingRepoRef.current }));
            break;
          case "embedding_vector":
            setState((s) => ({ ...s, embeddingVector: msg.vector }));
            break;
          case "generation_start":
            setState((s) => ({
              ...s,
              status: "running",
              output: "",
              processingMs: null,
              embeddingVector: null,
            }));
            break;
          case "token":
            setState((s) => ({ ...s, output: s.output + msg.text }));
            break;
          case "generation_done":
            setState((s) => ({
              ...s,
              status: "done",
              processingMs: msg.processingMs,
            }));
            break;
          case "aborted":
            setState((s) => ({ ...s, status: "ready" }));
            break;
          case "error":
            setState((s) => ({
              ...s,
              status: "error",
              error: msg.message,
            }));
            break;
        }
      };
    }
    return workerRef.current;
  }, []);

  const loadModel = useCallback(
    (config: ModelConfig) => {
      const worker = ensureWorker();
      loadingRepoRef.current = config.hfRepo;
      setState((s) => ({
        ...s,
        status: "loading",
        output: "",
        progress: null,
        error: null,
        processingMs: null,
      }));
      worker.postMessage({
        type: "load",
        modelId: config.hfRepo,
        dtype: config.dtype,
        family: config.family,
      });
    },
    [ensureWorker]
  );

  const generate = useCallback(
    (opts: {
      prompt: string;
      imageUrl?: string;
      audioData?: Float32Array;
      maxNewTokens: number;
      family: string;
    }) => {
      const worker = ensureWorker();
      // Transfer the Float32Array buffer so it's zero-copy moved to the worker
      const transfer: Transferable[] = opts.audioData ? [opts.audioData.buffer] : [];
      worker.postMessage({ type: "generate", ...opts }, transfer);
    },
    [ensureWorker]
  );

  const abort = useCallback(() => {
    workerRef.current?.postMessage({ type: "abort" });
  }, []);

  // Clear output state when switching models; does NOT kill the worker
  const switchToModel = useCallback((hfRepo: string) => {
    setState((s) => ({
      ...s,
      status: s.loadedModelRepo === hfRepo ? "ready" : "idle",
      output: "",
      error: null,
      processingMs: null,
      progress: null,
    }));
  }, []);

  const reset = useCallback(() => {
    workerRef.current?.terminate();
    workerRef.current = null;
    loadingRepoRef.current = null;
    setState({
      status: "idle",
      output: "",
      progress: null,
      error: null,
      processingMs: null,
      loadedModelRepo: null,
      device: null,
      embeddingVector: null,
    });
  }, []);

  return { state, loadModel, generate, abort, reset, switchToModel };
}
