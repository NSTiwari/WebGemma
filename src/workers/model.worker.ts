/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  AutoProcessor,
  AutoTokenizer,
  AutoModel,
  AutoModelForCausalLM,
  Gemma4ForConditionalGeneration,
  PaliGemmaForConditionalGeneration,
  TextStreamer,
  load_image,
  env,
} from "@huggingface/transformers";

// Use browser Cache Storage so weights survive page/machine restarts
env.allowLocalModels = false;
env.useBrowserCache  = true;

/* Detect WebGPU availability once at startup */
async function resolveDevice(): Promise<"webgpu" | "wasm"> {
  try {
    if (typeof navigator === "undefined" || !navigator.gpu) return "wasm";
    const adapter = await navigator.gpu.requestAdapter();
    return adapter ? "webgpu" : "wasm";
  } catch {
    return "wasm";
  }
}
const devicePromise = resolveDevice();

type WorkerMessage =
  | { type: "load"; modelId: string; dtype: string; family: string }
  | {
      type: "generate";
      prompt: string;
      imageUrl?: string;
      audioData?: Float32Array;
      maxNewTokens: number;
      family: string;
    }
  | { type: "abort" };

interface CachedModel {
  model: any;
  processor: any;
  tokenizer: any;
}

// Keep every loaded model in memory so switching back is instant (no re-download)
const modelCache = new Map<string, CachedModel>();

// Currently active model/processor/tokenizer
let processor: any = null;
let tokenizer: any = null;
let model: any = null;
let activeModelId: string | null = null;
let abortController = new AbortController();

function post(msg: object) {
  self.postMessage(msg);
}

async function loadModel(modelId: string, dtype: string, family: string) {
  // Already active - nothing to do
  if (activeModelId === modelId && model !== null) {
    post({ type: "load_done" });
    return;
  }

  // Explicitly dispose the active model to release WebGPU buffers (ONNX session.release()).
  // Files stay in browser Cache Storage - no re-download on next load.
  try { if (model)     await (model as any).dispose();     } catch {}
  try { if (processor) await (processor as any).dispose(); } catch {}
  try { if (tokenizer) await (tokenizer as any).dispose(); } catch {}
  modelCache.clear();
  processor     = null;
  tokenizer     = null;
  model         = null;
  activeModelId = null;

  // Load from Cache Storage (or network on first run)
  try {
    post({ type: "load_start" });

    const device = await devicePromise;
    // q4f16 uses fp16 activations - not supported on WASM; fall back to q4
    const resolvedDtype = device === "wasm" && dtype === "q4f16" ? "q4" : dtype;

    post({ type: "device_info", device });

    const progressCallback = (info: any) => {
      if (info.status === "progress" || info.status === "downloading") {
        post({
          type: "load_progress",
          file: info.file ?? "",
          loaded: info.loaded ?? 0,
          total: info.total ?? 0,
          progress: info.progress ?? 0,
        });
      }
    };

    let newProcessor: any = null;
    let newTokenizer: any = null;
    let newModel: any = null;

    const loadModelWithDevice = async (targetDevice: "webgpu" | "wasm", targetDtype: string) => {
      // q4f16 requires fp16 activations - not supported on WASM
      const safeDtype = targetDevice === "wasm" && targetDtype === "q4f16" ? "q4" : targetDtype;

      if (family === "gemma3n") {
        // Per-component dtypes to avoid GatherBlockQuantized (embed q4), SafeInt overflow (embed int8/uint8 >2GB),
        // and Mul type mismatch (decoder q4f16). vision_encoder only exists as fp32.
        const gemma3nDtype = {
          embed_tokens: "q4f16",
          decoder_model_merged: "q4",
          vision_encoder: "fp32",
          audio_encoder: "q4",  // q4f16 GroupedConv fails WebGPU shader compilation; q4 uses fp32 activations
        };
        if (!newProcessor) {
          newProcessor = await (AutoProcessor as any).from_pretrained(modelId, {
            progress_callback: progressCallback,
          });
        }
        newModel = await (Gemma4ForConditionalGeneration as any).from_pretrained(modelId, {
          dtype: gemma3nDtype,
          device: targetDevice,
          progress_callback: progressCallback,
        });

      } else if (family === "gemma4") {
        if (!newProcessor) {
          newProcessor = await (AutoProcessor as any).from_pretrained(modelId, {
            progress_callback: progressCallback,
          });
        }
        newModel = await (Gemma4ForConditionalGeneration as any).from_pretrained(modelId, {
          dtype: safeDtype,
          device: targetDevice,
          progress_callback: progressCallback,
        });

      } else if (family === "paligemma") {
        // PaliGemma 1 & 2 require PaliGemmaForConditionalGeneration
        // embed_tokens q4 = 2.37 GB → overflows 32-bit SafeInt in ONNX Runtime; use q8 (uint8, 593 MB) instead
        // vision_encoder q4 = 240 MB and decoder q4 = 1.47 GB are both fine
        const paliDtype = { embed_tokens: "uint8", vision_encoder: "q4", decoder_model_merged: "q4" };
        if (!newProcessor) {
          newProcessor = await (AutoProcessor as any).from_pretrained(modelId, {
            progress_callback: progressCallback,
          });
        }
        newModel = await (PaliGemmaForConditionalGeneration as any).from_pretrained(modelId, {
          dtype: paliDtype,
          device: targetDevice,
          progress_callback: progressCallback,
        });

      } else if (family === "embedding") {
        // EmbeddingGemma: AutoModel (encoder-only), AutoTokenizer, outputs sentence_embedding
        // Does not support fp16 - safeDtype already handles q4f16→q4, but also block fp16
        const embDtype = safeDtype === "fp16" ? "q8" : safeDtype;
        if (!newTokenizer) {
          newTokenizer = await (AutoTokenizer as any).from_pretrained(modelId, {
            progress_callback: progressCallback,
          });
        }
        newModel = await (AutoModel as any).from_pretrained(modelId, {
          dtype: embDtype,
          device: targetDevice,
          progress_callback: progressCallback,
        });

      } else {
        // gemma1 / gemma2 / gemma3 - instruct models use chat template via tokenizer
        if (!newTokenizer && !newProcessor) {
          try {
            newTokenizer = await (AutoTokenizer as any).from_pretrained(modelId, {
              progress_callback: progressCallback,
            });
          } catch {
            newProcessor = await (AutoProcessor as any).from_pretrained(modelId, {
              progress_callback: progressCallback,
            });
          }
        }
        newModel = await (AutoModelForCausalLM as any).from_pretrained(modelId, {
          dtype: safeDtype,
          device: targetDevice,
          progress_callback: progressCallback,
        });
      }
    };

    try {
      await loadModelWithDevice(device, resolvedDtype);
    } catch (gpuErr) {
      const msg = String(gpuErr);
      const isOOM = msg.includes("OUTOFMEMORY") || msg.includes("OrtRun") || msg.includes("OUT_OF_MEMORY");
      if (device === "webgpu" && isOOM) {
        post({ type: "device_info", device: "wasm" });
        post({ type: "load_progress", file: "GPU out of memory, retrying on CPU (WASM)…", loaded: 0, total: 0, progress: 0 });
        newModel = null; // processor/tokenizer may still be valid
        await loadModelWithDevice("wasm", resolvedDtype);
      } else {
        throw gpuErr;
      }
    }

    // Store in memory cache for instant future access
    modelCache.set(modelId, { model: newModel, processor: newProcessor, tokenizer: newTokenizer });

    processor     = newProcessor;
    tokenizer     = newTokenizer;
    model         = newModel;
    activeModelId = modelId;

    post({ type: "load_done" });
  } catch (err) {
    post({ type: "error", message: String(err) });
  }
}

async function runGeneration(
  prompt: string,
  imageUrl: string | undefined,
  audioData: Float32Array | undefined,
  maxNewTokens: number,
  family: string
) {
  if (!model) {
    post({ type: "error", message: "Model not loaded" });
    return;
  }

  abortController = new AbortController();
  const t0 = performance.now();

  try {
    post({ type: "generation_start" });

    const hasMedia = !!(imageUrl || audioData);

    if (family === "embedding") {
      // EmbeddingGemma: encode text, return embedding stats (no token streaming)
      const QUERY_PREFIX = "task: search result | query: ";
      const prefixedPrompt = prompt.startsWith("task:") ? prompt : QUERY_PREFIX + prompt;
      const inputs = await tokenizer(prefixedPrompt, { padding: true, return_tensors: "pt" });
      const output = await model(inputs);
      const emb = output.sentence_embedding ?? output.last_hidden_state?.mean(-2);
      if (!emb) throw new Error("Model did not return sentence_embedding");
      const dims = emb.dims as number[];
      const vector = Array.from(emb.data as Float32Array);
      const norm = Math.sqrt(vector.reduce((s: number, v: number) => s + v * v, 0));
      // Post raw vector for scatter plot visualisation
      post({ type: "embedding_vector", vector });
      // Post human-readable stats as the text output
      post({ type: "token", text:
        `Embedding generated\n\n` +
        `Shape: [${dims.join(" × ")}]\n` +
        `Dims: ${dims[dims.length - 1]}\n` +
        `L2 norm: ${norm.toFixed(4)}\n\n` +
        `First 8 values:\n[${vector.slice(0, 8).map((v: number) => v.toFixed(5)).join(", ")} …]`
      });

    } else {
      const tok = processor?.tokenizer ?? tokenizer;
      const streamer = new (TextStreamer as any)(tok, {
        skip_prompt: true,
        skip_special_tokens: true,
        callback_function: (text: string) => {
          if (abortController.signal.aborted) return;
          post({ type: "token", text });
        },
      });

      if ((family === "gemma4" || family === "gemma3n") && processor) {
        const messages = [
          {
            role: "user",
            content: [
              ...(imageUrl  ? [{ type: "image" }] : []),
              ...(audioData ? [{ type: "audio" }] : []),
              { type: "text", text: prompt },
            ],
          },
        ];
        const tmpl = processor.apply_chat_template(messages, {
          enable_thinking: false,
          add_generation_prompt: true,
        });

        let inputs: any;
        if (hasMedia) {
          const image = imageUrl ? await load_image(imageUrl) : undefined;
          inputs = await processor(tmpl, image, audioData, { add_special_tokens: false });
        } else {
          inputs = await processor.tokenizer(tmpl, { return_tensors: "pt", add_special_tokens: false });
        }
        await model.generate({ ...inputs, max_new_tokens: maxNewTokens, do_sample: false, streamer });

      } else if (family === "paligemma" && processor) {
        // PaliGemma: processor(image, prompt) - image first, then prompt
        const image = imageUrl ? await load_image(imageUrl) : undefined;
        const inputs: any = await processor(image, prompt);
        const inputLen: number = inputs.input_ids.dims[1];

        // Generate and manually decode to strip input tokens from output
        const output = await model.generate({
          ...inputs,
          max_new_tokens: maxNewTokens,
          do_sample: false,
        });
        const generatedIds = output.slice(null, [inputLen, null]);
        const decoded: string[] = processor.batch_decode(generatedIds, { skip_special_tokens: true });
        post({ type: "token", text: decoded[0] ?? "" });

      } else if (family === "function") {
        // Follow the HF reference exactly:
        // apply_chat_template(messages, { tools, tokenize: true, return_dict: true })
        // then decode output.slice(0, [inputLen, null]) with skip_special_tokens: false
        const tok2 = tokenizer ?? processor?.tokenizer;

        // Decode __TOOLS__\n{json}\n__QUERY__\n{command} from FunctionPanel
        let tools: any[] = [];
        let userQuery = prompt;
        const toolsSep = prompt.indexOf("\n__QUERY__\n");
        if (toolsSep !== -1) {
          try { tools = JSON.parse(prompt.slice("__TOOLS__\n".length, toolsSep)); } catch {}
          userQuery = prompt.slice(toolsSep + "\n__QUERY__\n".length);
        }

        const messages = [
          { role: "developer", content: "You are a model that can do function calling with the following functions" },
          { role: "user", content: userQuery },
        ];

        // tokenize: true + return_dict: true → returns {input_ids, attention_mask} tensors directly
        const inputs: any = tok2.apply_chat_template(messages, {
          tools: tools.length ? tools : undefined,
          tokenize: true,
          add_generation_prompt: true,
          return_dict: true,
        });

        const inputLen: number = inputs.input_ids.dims[1];
        const outputIds = await model.generate({
          ...inputs,
          max_new_tokens: maxNewTokens,
          do_sample: false,
        });

        // Decode only the newly generated tokens (skip the prompt)
        const newTokens = outputIds.slice(0, [inputLen, null]);
        const decoded: string = tok2.decode(newTokens, { skip_special_tokens: false });
        post({ type: "token", text: decoded });

      } else {
        // gemma1 / gemma2 / gemma3 - tokenize raw prompt directly
        const tok2 = tokenizer ?? processor?.tokenizer;
        const inputs = await tok2(prompt, { return_tensors: "pt" });
        await model.generate({ ...inputs, max_new_tokens: maxNewTokens, do_sample: false, streamer });
      }
    }

    post({ type: "generation_done", processingMs: performance.now() - t0 });
  } catch (err) {
    if (!abortController.signal.aborted) {
      post({ type: "error", message: String(err) });
    }
  }
}

self.onmessage = async (e: MessageEvent<WorkerMessage>) => {
  const msg = e.data;
  switch (msg.type) {
    case "load":
      await loadModel(msg.modelId, msg.dtype, msg.family);
      break;
    case "generate":
      await runGeneration(
        msg.prompt,
        msg.imageUrl,
        msg.audioData,
        msg.maxNewTokens,
        msg.family
      );
      break;
    case "abort":
      abortController.abort();
      post({ type: "aborted" });
      break;
  }
};
