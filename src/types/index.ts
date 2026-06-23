export type Modality = "text" | "image" | "audio";

export type ModelFamily =
  | "gemma"
  | "gemma2"
  | "gemma3"
  | "gemma3n"
  | "gemma4"
  | "paligemma"
  | "embedding"
  | "translate"
  | "recurrent"
  | "code"
  | "shield"
  | "data"
  | "dolphin"
  | "med"
  | "vault"
  | "t5"
  | "function"
  | "diffusion"
  | "nano";

export interface ModelConfig {
  id: string;
  name: string;
  family: ModelFamily;
  version: string;
  hfRepo: string;
  dtype: string;
  description: string;
  inputModalities: Modality[];
  outputType: "text" | "embedding" | "translation";
  maxNewTokens: number;
  releaseDate: string;
  badge?: string;
  isNew?: boolean;
  isNative?: boolean;
}

export type InferenceStatus =
  | "idle"
  | "loading"
  | "ready"
  | "running"
  | "done"
  | "error";

export interface ModelLoadProgress {
  file: string;
  loaded: number;
  total: number;
  progress: number;
}

export interface InferenceResult {
  text?: string;
  embeddings?: number[];
  translatedText?: string;
  processingMs?: number;
}

export interface TimelineMilestone {
  id: string;
  name: string;
  date: string;
  family: ModelFamily;
  description: string;
  highlight?: string;
  modelIds: string[];
  blogUrl?: string;
  mediaUrl?: string;
  isSpecial?: boolean;
}
