# WebGemma

A browser-based playground for running Gemma models entirely on-device using WebGPU. No server, no API key, no data leaves your machine.

Includes a visual timeline of the Gemma model family from 2024 to present, and support for Gemini Nano via Chrome's built-in AI APIs.

**LIVE demo:** [https://your-deployment-url.com](https://your-deployment-url.com)

---

## Supported Models

| Model | Task | Runtime |
|---|---|---|
| Gemma 3 270M IT | Text generation | Transformers.js (WebGPU) |
| Gemma 3 1B IT | Text generation | Transformers.js (WebGPU) |
| Gemma 3n E2B IT | Text + image generation | Transformers.js (WebGPU) |
| Gemma 4 E2B IT | Text + image + audio | Transformers.js (WebGPU) |
| PaliGemma 2 3B Mix 224 | Image captioning, VQA, object detection | Transformers.js (WebGPU) |
| TranslateGemma 4B | 100+ language translation | Transformers.js (WebGPU) |
| EmbeddingGemma 300M | Text embeddings | Transformers.js (WebGPU) |
| VaultGemma 1B | Privacy-preserving text generation | Transformers.js (WebGPU) |
| FunctionGemma 270M IT | Structured function calling | Transformers.js (WebGPU) |
| Gemini Nano | Prompt, Summarize, Write, Rewrite, Translate | Chrome Built-in AI |

---

## Requirements

- Node.js 18 or later
- Chrome 113+ with WebGPU enabled
- For Gemini Nano: Chrome 127+ with Chrome AI flags enabled (see notes below)

---

## Getting Started

```bash
# 1. Clone the repository
git clone https://github.com/NSTiwari/WebGemma.git
cd WebGemma

# 2. Install dependencies
npm install

# 3. Start the development server
npm run dev
```

Open `http://localhost:5173` in your browser.

To create a production build:

```bash
npm run build
npm run preview
```

---

## Notes

**Model downloads.** Models are fetched from Hugging Face on first use and cached in the browser's Cache Storage. Subsequent loads are instant.

**Memory usage.** Running large models in the browser is memory-intensive. If the page becomes unresponsive or inference stalls, close other tabs to free GPU memory. A full browser restart clears the GPU context and resolves most out-of-memory issues.

**WebGPU support.** If inference does not start, verify WebGPU support at [webgpureport.org](https://webgpureport.org). On some systems, hardware acceleration must be enabled manually in browser settings.

**Gemini Nano setup.** Requires Chrome 127+ with the following flags enabled:
- `chrome://flags/#optimization-guide-on-device-model` -- set to Enabled (BypassPerfRequirement)
- `chrome://flags/#prompt-api-for-gemini-nano` -- set to Enabled

Restart Chrome after enabling flags and allow a few minutes for the on-device model to download.

**iOS and Firefox.** WebGPU support on iOS Safari is partial. Firefox does not ship WebGPU by default.
