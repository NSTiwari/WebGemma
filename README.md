# WebGemma

An interactive, browser-based playground for the Gemma model family. WebGemma lets you run text generation, summarization, translation, function calling, and embedding models entirely on-device using WebGPU -- no server, no API key, no data leaving your machine.

It also includes a visual timeline of every Gemma model release from 2024 to present.

**Live demo:** [https://your-deployment-url.com](https://your-deployment-url.com)

---

## Features

- On-device inference via WebGPU and the Hugging Face Transformers.js library
- Support for Gemini Nano through Chrome's built-in AI APIs (Prompt, Summarizer, Writer, Rewriter, Translator)
- Interactive Gemma Journey timeline with model history and media
- Playground panels for text generation, translation, embedding, function calling, and image understanding
- Light and dark theme

---

## Requirements

- Node.js 18 or later
- A WebGPU-capable browser (Chrome 113+ recommended)
- For Gemini Nano features: Chrome 127+ with Chrome AI flags enabled (see notes below)

---

## Getting Started

```bash
# 1. Clone the repository
git clone https://github.com/NSTiwari/webgemma.git
cd webgemma

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

**Model downloads.** Models are downloaded from Hugging Face on first use and cached in the browser's Cache Storage. Subsequent loads are instant. Depending on your connection, the first load may take a few minutes.

**Memory usage.** Running large models in the browser is memory-intensive. If the page becomes unresponsive or inference stalls, close other tabs to free GPU memory. In persistent cases, a full browser restart clears the GPU context and resolves most out-of-memory issues.

**WebGPU support.** WebGPU is required for all on-device models. If inference does not start, verify that your browser supports WebGPU at [webgpureport.org](https://webgpureport.org). On some systems, hardware acceleration must be enabled manually in browser settings.

**Gemini Nano setup.** Gemini Nano runs via Chrome's built-in AI APIs, which require Chrome 127 or later with the following flags enabled:
- `chrome://flags/#optimization-guide-on-device-model` -- set to Enabled (BypassPerfRequirement)
- `chrome://flags/#prompt-api-for-gemini-nano` -- set to Enabled

After enabling the flags, restart Chrome and allow a few minutes for the on-device model to download in the background.

**iOS and Firefox.** WebGPU support on iOS Safari is partial and may not support all models. Firefox does not yet ship WebGPU by default.

---

## Tech Stack

- React 19, TypeScript, Vite
- Tailwind CSS, Framer Motion
- Hugging Face Transformers.js
- Chrome Built-in AI (Gemini Nano)

---

## License

Apache 2.0
