import type { ModelConfig } from "../types";

// Add new models here; no other file needs to change
export const MODEL_REGISTRY: ModelConfig[] = [
  {
    id: "gemma-4-e2b-it",
    name: "Gemma 4 E2B Instruct",
    family: "gemma4",
    version: "4",
    hfRepo: "onnx-community/gemma-4-E2B-it-ONNX",
    dtype: "q4f16",
    description:
      "Gemma 4's 2B-parameter multimodal model supporting text, image, and audio inputs. Runs fully on-device via WebGPU.",
    inputModalities: ["text", "image", "audio"],
    outputType: "text",
    maxNewTokens: 256,
    releaseDate: "2026-04",
    badge: "Latest",
    isNew: true,
  },

  {
    id: "gemini-nano",
    name: "Gemini Nano",
    family: "nano",
    version: "1",
    hfRepo: "",
    dtype: "built-in",
    description:
      "Google's on-device model built directly into Chrome. No download required — powered by Chrome's Prompt API (window.ai). Requires Chrome 127+ with built-in AI enabled.",
    inputModalities: ["text", "image"],
    outputType: "text",
    maxNewTokens: 0,
    releaseDate: "2024-05",
    badge: "Chrome Built-in",
    isNative: true,
  },

  {
    id: "gemma-3-270m-it",
    name: "Gemma 3 270M Instruct",
    family: "gemma3",
    version: "3",
    hfRepo: "onnx-community/gemma-3-270m-it-ONNX",
    dtype: "fp32",
    description:
      "Ultra-lightweight 270M text model from the Gemma 3 family. Designed for devices with minimal resources.",
    inputModalities: ["text"],
    outputType: "text",
    maxNewTokens: 512,
    releaseDate: "2025-08",
  },

  {
    id: "gemma-3-1b-it",
    name: "Gemma 3 1B Instruct",
    family: "gemma3",
    version: "3",
    hfRepo: "onnx-community/gemma-3-1b-it-ONNX",
    dtype: "q4",
    description:
      "Gemma 3's 1B-parameter text model, optimised for on-device use.",
    inputModalities: ["text"],
    outputType: "text",
    maxNewTokens: 512,
    releaseDate: "2025-03",
  },

  {
    id: "translategemma-4b",
    name: "TranslateGemma 4B",
    family: "translate",
    version: "1",
    hfRepo: "onnx-community/translategemma-text-4b-it-ONNX",
    dtype: "q4",
    description:
      "4B-parameter translation model built on Gemma. Translates between 100+ languages directly on-device via WebGPU.",
    inputModalities: ["text"],
    outputType: "text",
    maxNewTokens: 1024,
    releaseDate: "2026-01",
    badge: "New",
    isNew: true,
  },

  {
    id: "paligemma2-3b-mix-224",
    name: "PaliGemma 2 3B Mix",
    family: "paligemma",
    version: "2",
    hfRepo: "NSTiwari/paligemma2-3b-mix-224-onnx",
    dtype: "q4",
    description:
      "PaliGemma 2 fine-tuned on a mix of tasks including captioning, VQA, and object detection at 224px resolution.",
    inputModalities: ["text", "image"],
    outputType: "text",
    maxNewTokens: 256,
    releaseDate: "2025-02",
  },

  {
    id: "vaultgemma-1b",
    name: "VaultGemma 1B",
    family: "vault",
    version: "1",
    hfRepo: "onnx-community/vaultgemma-1b-ONNX",
    dtype: "q4",
    description:
      "Privacy-preserving 1B text generation model trained with Differential Privacy (DP-SGD, ε≤2). Safe for sensitive healthcare and finance data. Max 1,024 tokens.",
    inputModalities: ["text"],
    outputType: "text",
    maxNewTokens: 256,
    releaseDate: "2025-09",
  },

  {
    id: "functiongemma-270m-it",
    name: "FunctionGemma 270M",
    family: "function",
    version: "1",
    hfRepo: "onnx-community/functiongemma-270m-it-ONNX",
    dtype: "q4f16",
    description:
      "270M function-calling model that generates structured tool invocations from natural language queries. Designed for agentic pipelines.",
    inputModalities: ["text"],
    outputType: "text",
    maxNewTokens: 512,
    releaseDate: "2025-12",
  },

  {
    id: "embeddinggemma-300m",
    name: "EmbeddingGemma 300M",
    family: "embedding",
    version: "1",
    hfRepo: "onnx-community/embeddinggemma-300m-ONNX",
    dtype: "q8",
    description:
      "300M-parameter text embedding model built on Gemma 3. Produces 768-dim vectors for search, retrieval, clustering, and semantic similarity across 100+ languages.",
    inputModalities: ["text"],
    outputType: "embedding",
    maxNewTokens: 0,
    releaseDate: "2025-09",
    badge: "New",
    isNew: true,
  },

  {
    id: "gemma-3n-e2b-it",
    name: "Gemma 3n E2B Instruct",
    family: "gemma3n",
    version: "3n",
    hfRepo: "onnx-community/gemma-3n-E2B-it-ONNX",
    dtype: "q4f16",
    description:
      "Gemma 3n is a new architecture optimised for on-device inference. E2B has an effective 2B parameter footprint with native multimodal support.",
    inputModalities: ["text", "image", "audio"],
    outputType: "text",
    maxNewTokens: 512,
    releaseDate: "2025-06",
    badge: "New",
    isNew: true,
  },
];

// Per-model accent colors, shared between ModelCard and Timeline
export const MODEL_COLORS: Record<string, string> = {
  "gemini-nano":           "#4285f4",
  "gemma-4-e2b-it":        "#f59e0b",
  "gemma-3n-e2b-it":       "#06b6d4",
  "gemma-3-1b-it":         "#14b8a6",
  "gemma-3-270m-it":       "#6366f1",
  "paligemma2-3b-mix-224": "#ec4899",
  "embeddinggemma-300m":   "#84cc16",
  "translategemma-4b":     "#a855f7",
  "vaultgemma-1b":         "#2dd4bf",
  "functiongemma-270m-it": "#eab308",
};

export function getModelById(id: string): ModelConfig | undefined {
  return MODEL_REGISTRY.find((m) => m.id === id);
}
