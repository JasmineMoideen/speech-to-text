"use client";
import { useRef, useState } from "react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
const WS = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:4000/stream";

export default function RecordPage() {
  const [engine, setEngine] = useState("deepgram"); // deepgram | browser
  const [recording, setRecording] = useState(false);
  const [finalText, setFinalText] = useState("");
  const [interim, setInterim] = useState("");
  const [status, setStatus] = useState("Ready. Press the mic and start speaking.");
  const [error, setError] = useState("");

  const finalRef = useRef("");
  const startedAt = useRef(0);
  const wsRef = useRef(null);
  const recorderRef = useRef(null);
  const streamRef = useRef(null);
  const recogRef = useRef(null);

  const addFinal = (t) => {
    finalRef.current = (finalRef.current + " " + t).trim();
    setFinalText(finalRef.current);
    setInterim("");
  };

  async function startDeepgram() {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    streamRef.current = stream;
    const ws = new WebSocket(WS);
    wsRef.current = ws;

    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      if (msg.type === "transcript") (msg.isFinal ? addFinal(msg.text) : setInterim(msg.text));
      if (msg.type === "error") setError(msg.message);
    };
    ws.onopen = () => {
      const rec = new MediaRecorder(stream, { mimeType: "audio/webm;codecs=opus" });
      recorderRef.current = rec;
      rec.ondataavailable = (ev) => ev.data.size && ws.readyState === 1 && ws.send(ev.data);
      rec.start(250); // send a chunk every 250 ms
    };
    ws.onerror = () => setError("Cannot reach the backend. Is it running on port 4000?");
  }

  function startBrowser() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) throw new Error("Web Speech API is not supported. Use Chrome or Edge.");
    const r = new SR();
    r.lang = "hi-IN"; // hi-IN handles English words mixed into Hindi reasonably well
    r.continuous = true;
    r.interimResults = true;
    r.onresult = (e) => {
      let tmp = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        e.results[i].isFinal ? addFinal(t) : (tmp += t);
      }
      setInterim(tmp);
    };
    r.onerror = (e) => setError("Speech recognition error: " + e.error);
    r.onend = () => recogRef.current && r.start(); // auto-restart on silence timeout
    recogRef.current = r;
    r.start();
  }

  async function start() {
    setError(""); setFinalText(""); setInterim(""); finalRef.current = "";
    try {
      engine === "deepgram" ? await startDeepgram() : startBrowser();
      startedAt.current = Date.now();
      setRecording(true);
      setStatus("Listening…");
    } catch (err) {
      setError(err.message || "Could not start the microphone.");
    }
  }

  async function stop() {
    setRecording(false);
    recorderRef.current?.state !== "inactive" && recorderRef.current?.stop();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    const r = recogRef.current; recogRef.current = null; r?.stop();
    wsRef.current?.close();
    await new Promise((res) => setTimeout(res, 700)); // let last final result arrive

    const text = (finalRef.current + " " + interim).trim();
    if (!text) return setStatus("Nothing was heard, so nothing was saved.");
    const res = await fetch(`${API}/api/transcriptions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text, engine, language: "hi+en",
        duration_sec: Math.round((Date.now() - startedAt.current) / 1000),
      }),
    });
    setStatus(res.ok ? "Saved to history." : "Could not save. Check the backend.");
    setInterim("");
    setFinalText(text);
  }

  return (
    <main className="wrap">
      <h1>Speak in Hindi, English, or both</h1>
      <p className="sub">Your words appear as you say them and are saved when you stop.</p>

      <section className="panel">
        <div className="controls">
          <button
            className={`mic ${recording ? "rec pulse" : "primary"}`}
            onClick={recording ? stop : start}
            aria-label={recording ? "Stop recording" : "Start recording"}
          >
            {recording ? "■" : "🎤"}
          </button>
          <label>
            Engine{" "}
            <select value={engine} onChange={(e) => setEngine(e.target.value)} disabled={recording}>
              <option value="deepgram">Deepgram (best for mixed speech)</option>
              <option value="browser">Browser (no API key)</option>
            </select>
          </label>
          <span className="status" role="status">{status}</span>
        </div>
        {error && <p className="error">{error}</p>}
        <div className="live-box" aria-live="polite">
          {finalText}{" "}
          <span className="interim">{interim}</span>
          {!finalText && !interim && <span className="hint">Your transcript will appear here.</span>}
        </div>
      </section>
    </main>
  );
}
