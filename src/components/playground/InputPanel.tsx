import { useRef, useState, useEffect } from "react";
import { Upload, X, Image, Mic, Send, Square, StopCircle, Type } from "lucide-react";
import type { ModelConfig, InferenceStatus } from "../../types";

interface InputPanelProps {
  model: ModelConfig;
  status: InferenceStatus;
  onGenerate: (opts: {
    prompt: string;
    imageUrl?: string;
    audioData?: Float32Array;
  }) => void;
  onAbort: () => void;
}

type AudioSource = "upload" | "record";
type InputMode = "text" | "image" | "audio";

export function InputPanel({ model, status, onGenerate, onAbort }: InputPanelProps) {
  const [prompt, setPrompt] = useState("");
  const [inputMode, setInputMode] = useState<InputMode>("text");

  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [audioPreviewUrl, setAudioPreviewUrl] = useState<string | null>(null);
  const [audioName, setAudioName] = useState<string | null>(null);
  const [audioSource, setAudioSource] = useState<AudioSource>("upload");

  const [recording, setRecording] = useState(false);
  const [recordingMs, setRecordingMs] = useState(0);
  const [micError, setMicError] = useState<string | null>(null);

  const imageRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recordingMsRef = useRef(0);

  const supportsImage = model.inputModalities.includes("image");
  const supportsAudio = model.inputModalities.includes("audio");
  const isMultimodal = supportsImage || supportsAudio;

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      mediaRecorderRef.current?.stream?.getTracks().forEach(t => t.stop());
    };
  }, []);

  // Reset media when switching modes
  useEffect(() => {
    if (inputMode !== "image") { clearImage(); }
    if (inputMode !== "audio") { clearAudio(); }
  }, [inputMode]); // eslint-disable-line

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const handleAudioChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAudioFile(file);
    setAudioName(file.name);
    setAudioPreviewUrl(URL.createObjectURL(file));
    setMicError(null);
  };

  const clearImage = () => {
    setImageFile(null);
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImagePreview(null);
    if (imageRef.current) imageRef.current.value = "";
  };

  const clearAudio = () => {
    setAudioFile(null);
    setAudioName(null);
    if (audioPreviewUrl) URL.revokeObjectURL(audioPreviewUrl);
    setAudioPreviewUrl(null);
    if (audioRef.current) audioRef.current.value = "";
    setMicError(null);
  };

  const startRecording = async () => {
    setMicError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      chunksRef.current = [];

      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/ogg;codecs=opus")
        ? "audio/ogg;codecs=opus"
        : "";

      const mr = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      mediaRecorderRef.current = mr;

      mr.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mr.onstop = () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(chunksRef.current, { type: mr.mimeType || "audio/webm" });
        const ext  = mr.mimeType.includes("ogg") ? "ogg" : "webm";
        const file = new File([blob], `recording.${ext}`, { type: blob.type });
        setAudioFile(file);
        setAudioName(`Recording (${formatMs(recordingMsRef.current)})`);
        setAudioPreviewUrl(URL.createObjectURL(file));
        setRecording(false);
        if (timerRef.current) clearInterval(timerRef.current);
      };

      mr.start(100);
      setRecording(true);
      setRecordingMs(0);
      recordingMsRef.current = 0;
      timerRef.current = setInterval(() => {
        recordingMsRef.current += 100;
        setRecordingMs(ms => ms + 100);
      }, 100);
    } catch {
      setMicError("Microphone access denied.");
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
  };

  const handleSubmit = async () => {
    if (!prompt.trim() && !imageFile && !audioFile) return;
    const imageUrl = imagePreview ?? undefined;
    let audioData: Float32Array | undefined;
    if (audioFile) {
      try {
        audioData = await decodeAudioTo16kHz(audioFile);
      } catch {
        setMicError("Failed to decode audio.");
        return;
      }
    }
    onGenerate({ prompt: prompt.trim(), imageUrl, audioData });
  };

  const isRunning = status === "running";
  const canSubmit = status === "ready" || status === "done";

  const defaultPrompts: Record<InputMode, string> = {
    text:  "Tell me about the key innovations in modern AI.",
    image: "Describe this image in detail.",
    audio: "Transcribe the audio and describe its content.",
  };

  const TABS: { mode: InputMode; label: string; icon: typeof Type }[] = [
    { mode: "text",  label: "Text",  icon: Type  },
    { mode: "image", label: "Image", icon: Image },
    { mode: "audio", label: "Audio", icon: Mic   },
  ].filter(t =>
    t.mode === "text" ||
    (t.mode === "image" && supportsImage) ||
    (t.mode === "audio" && supportsAudio)
  ) as { mode: InputMode; label: string; icon: typeof Type }[];

  return (
    <div className="flex flex-col gap-3">

      {/* Mode tabs - only for multimodal models */}
      {isMultimodal && (
        <div className="flex rounded-xl overflow-hidden border" style={{ borderColor: "var(--border)" }}>
          {TABS.map(({ mode, label, icon: Icon }) => (
            <button
              key={mode}
              onClick={() => setInputMode(mode)}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-semibold transition-all"
              style={{
                background: inputMode === mode ? "var(--bg-3)" : "transparent",
                color: inputMode === mode ? "var(--text)" : "var(--text-3)",
                borderRight: "1px solid var(--border)",
              }}
            >
              <Icon size={12} />
              {label}
            </button>
          ))}
        </div>
      )}

      {/* Image tab */}
      {inputMode === "image" && supportsImage && (
        <div>
          <input ref={imageRef} type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
          {imagePreview ? (
            <div className="relative rounded-xl overflow-hidden border" style={{ borderColor: "var(--border)" }}>
              <img
                src={imagePreview}
                alt="Preview"
                className="w-full block rounded-xl"
                style={{ height: "auto" }}
              />
              <button
                onClick={clearImage}
                className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/60 flex items-center justify-center hover:bg-red-500/80 transition-colors"
              >
                <X size={13} className="text-white" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => imageRef.current?.click()}
              disabled={!canSubmit && !imageFile}
              className="w-full flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed transition-all disabled:opacity-40"
              style={{
                height: 150,
                borderColor: "var(--border)",
                background: "var(--bg-card)",
                color: "var(--text-3)",
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.borderColor = "#0ea5e9";
                (e.currentTarget as HTMLElement).style.color = "#0ea5e9";
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.borderColor = "var(--border)";
                (e.currentTarget as HTMLElement).style.color = "var(--text-3)";
              }}
            >
              <Upload size={28} />
              <div className="text-center">
                <p className="text-sm font-medium">Click to upload image</p>
                <p className="text-xs mt-0.5" style={{ color: "var(--text-3)" }}>PNG, JPG, WEBP supported</p>
              </div>
            </button>
          )}
        </div>
      )}

      {/* Audio tab */}
      {inputMode === "audio" && supportsAudio && (
        <div className="flex flex-col gap-2">
          <input ref={audioRef} type="file" accept="audio/*" className="hidden" onChange={handleAudioChange} />

          {audioFile && audioPreviewUrl ? (
            <div className="rounded-xl border p-3 flex flex-col gap-2" style={{ borderColor: "rgba(20,184,166,0.4)", background: "rgba(20,184,166,0.05)" }}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Mic size={14} className="text-teal-400 flex-shrink-0" />
                  <span className="text-xs truncate max-w-[240px]" style={{ color: "var(--text-2)" }}>{audioName}</span>
                </div>
                <button
                  onClick={clearAudio}
                  className="w-6 h-6 rounded-full bg-black/40 flex items-center justify-center hover:bg-red-500/70 transition-colors flex-shrink-0"
                >
                  <X size={11} className="text-white" />
                </button>
              </div>
              <audio controls src={audioPreviewUrl} className="w-full" style={{ height: 36 }} />
            </div>

          ) : !audioFile && (
            <>
              {/* Source toggle */}
              <div className="flex rounded-lg overflow-hidden border text-[10px] font-medium"
                style={{ borderColor: "var(--border)" }}>
                {(["upload", "record"] as AudioSource[]).map(src => (
                  <button key={src} onClick={() => { setAudioSource(src); setMicError(null); }}
                    className="flex-1 py-1.5 transition-colors capitalize"
                    style={{
                      background: audioSource === src ? "var(--bg-3)" : "transparent",
                      color: audioSource === src ? "var(--text)" : "var(--text-3)",
                    }}>
                    {src}
                  </button>
                ))}
              </div>

              {audioSource === "upload" ? (
                <button
                  onClick={() => audioRef.current?.click()}
                  disabled={!canSubmit}
                  className="w-full flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed transition-all disabled:opacity-40"
                  style={{ height: 120,borderColor: "var(--border)", background: "var(--bg-card)", color: "var(--text-3)" }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = "#14b8a6"; (e.currentTarget as HTMLElement).style.color = "#14b8a6"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "var(--border)"; (e.currentTarget as HTMLElement).style.color = "var(--text-3)"; }}
                >
                  <Upload size={26} />
                  <div className="text-center">
                    <p className="text-sm font-medium">Upload audio file</p>
                    <p className="text-xs mt-0.5" style={{ color: "var(--text-3)" }}>WAV, MP3, OGG, WEBM</p>
                  </div>
                </button>

              ) : recording ? (
                <button
                  onClick={stopRecording}
                  className="w-full h-24 flex flex-col items-center justify-center gap-2 rounded-xl border border-red-500/40 bg-red-500/8 hover:bg-red-500/12 transition-all"
                >
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-red-400 animate-pulse" />
                    <StopCircle size={20} className="text-red-400" />
                  </div>
                  <span className="text-sm font-mono text-red-400">{formatMs(recordingMs)}</span>
                  <span className="text-xs" style={{ color: "var(--text-3)" }}>Click to stop</span>
                </button>

              ) : (
                <button
                  onClick={startRecording}
                  disabled={!canSubmit}
                  className="w-full h-24 flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed transition-all disabled:opacity-40"
                  style={{ borderColor: "var(--border)", background: "var(--bg-card)", color: "var(--text-3)" }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = "#14b8a6"; (e.currentTarget as HTMLElement).style.color = "#14b8a6"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "var(--border)"; (e.currentTarget as HTMLElement).style.color = "var(--text-3)"; }}
                >
                  <Mic size={26} />
                  <p className="text-sm font-medium">Record from microphone</p>
                </button>
              )}
            </>
          )}

          {micError && <p className="text-xs text-red-400 text-center">{micError}</p>}
        </div>
      )}

      {/* Text prompt */}
      <div className="relative">
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder={defaultPrompts[inputMode]}
          rows={3}
          disabled={isRunning}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleSubmit();
          }}
          className="w-full resize-none rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-sky-500/50 transition-all disabled:opacity-50"
          style={{
            background: "var(--bg-card)",
            border: "1px solid var(--border)",
            color: "var(--text)",
          }}
        />
        <span className="absolute bottom-2 right-3 text-[10px]" style={{ color: "var(--text-3)" }}>Cmd+Enter</span>
      </div>

      <button
        onClick={isRunning ? onAbort : handleSubmit}
        disabled={!isRunning && !canSubmit}
        className={`flex items-center justify-center gap-2 w-full py-2.5 rounded-xl font-medium text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
          isRunning
            ? "bg-red-500/20 border border-red-500/40 text-red-300 hover:bg-red-500/30"
            : "bg-gradient-to-r from-sky-500 to-teal-500 text-white hover:from-sky-400 hover:to-teal-400 shadow-lg shadow-sky-500/20"
        }`}
      >
        {isRunning ? <><Square size={14} />Stop generation</> : <><Send size={14} />Run inference</>}
      </button>
    </div>
  );
}

function formatMs(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  return `${String(m).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

async function decodeAudioTo16kHz(file: File): Promise<Float32Array> {
  const TARGET_SR = 16000;
  const arrayBuffer = await file.arrayBuffer();

  const tmpCtx = new AudioContext();
  const decoded = await tmpCtx.decodeAudioData(arrayBuffer);
  await tmpCtx.close();

  // Mix down to mono
  const monoData = decoded.numberOfChannels > 1
    ? (() => {
        const ch0 = decoded.getChannelData(0);
        const ch1 = decoded.getChannelData(1);
        const mono = new Float32Array(ch0.length);
        for (let i = 0; i < ch0.length; i++) mono[i] = (ch0[i] + ch1[i]) / 2;
        return mono;
      })()
    : decoded.getChannelData(0);

  if (decoded.sampleRate === TARGET_SR) return monoData;

  // Resample to 16 kHz
  const numFrames = Math.ceil(decoded.duration * TARGET_SR);
  const offlineCtx = new OfflineAudioContext(1, numFrames, TARGET_SR);
  const buf = offlineCtx.createBuffer(1, monoData.length, decoded.sampleRate);
  buf.copyToChannel(monoData, 0);
  const src = offlineCtx.createBufferSource();
  src.buffer = buf;
  src.connect(offlineCtx.destination);
  src.start(0);
  const resampled = await offlineCtx.startRendering();
  return resampled.getChannelData(0);
}
