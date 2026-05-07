import React, { useEffect, useState, useRef, useCallback } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { Video, VideoOff, Send, Square, Clock, ArrowLeft, CheckCircle2, RotateCcw, X } from "lucide-react";
import Editor from "@monaco-editor/react";
import DashboardLayout from "../components/dashboard/DashboardLayout";
import api, { formatApiErrorDetail } from "../lib/api";

const SESSION_MONACO_OPTIONS = {
  minimap: { enabled: false },
  fontSize: 13.5,
  fontFamily: "JetBrains Mono, monospace",
  lineNumbers: "on",
  scrollBeyondLastLine: false,
  wordWrap: "on",
  padding: { top: 16, bottom: 16 },
  automaticLayout: true,
};

const VIDEO_BASE_URL = process.env.REACT_APP_VIDEO_BASE_URL || "https://meet.jit.si/unstuck-";

function ResolutionModal({ open, onClose, onResolve, submitting }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 bg-ink/60 z-50 flex items-center justify-center px-4" data-testid="resolution-modal">
      <div className="bg-white rounded-lg shadow-lg w-full max-w-md u-card relative">
        <button
          className="absolute top-4 right-4 text-ink-muted hover:text-ink"
          onClick={onClose}
          aria-label="Close"
          data-testid="resolution-close"
        >
          <X size={18} strokeWidth={1.75} />
        </button>
        <h3 className="u-h3">How did it go?</h3>
        <p className="u-body mt-2">
          You only pay if your doubt was actually resolved. Pick honestly — refunds happen the same day.
        </p>
        <div className="mt-6 space-y-3">
          <button
            className="w-full text-left u-card u-card-hover !p-4 !border"
            onClick={() => onResolve("resolved")}
            disabled={submitting}
            data-testid="resolution-resolved"
          >
            <div className="flex items-start gap-3">
              <CheckCircle2 size={20} strokeWidth={1.75} className="text-good mt-0.5" />
              <div>
                <div className="font-display font-semibold text-ink">Resolved</div>
                <div className="u-caption mt-0.5">My doubt is fixed. Release the payment.</div>
              </div>
            </div>
          </button>
          <button
            className="w-full text-left u-card u-card-hover !p-4 !border"
            onClick={() => onResolve("refunded")}
            disabled={submitting}
            data-testid="resolution-refund"
          >
            <div className="flex items-start gap-3">
              <RotateCcw size={20} strokeWidth={1.75} className="text-warn mt-0.5" />
              <div>
                <div className="font-display font-semibold text-ink">Not resolved — refund</div>
                <div className="u-caption mt-0.5">Auto-refund and flag for quality review.</div>
              </div>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}

function VideoPanel({ on, onToggle, sessionId }) {
  const roomUrl = `${VIDEO_BASE_URL}${sessionId}`;
  return (
    <div className="u-card !p-0 overflow-hidden h-[520px] flex flex-col" data-testid="video-panel">
      <div className="flex-1 bg-ink relative">
        {on ? (
          <iframe
            title="Video session room"
            src={roomUrl}
            allow="camera; microphone; fullscreen; speaker; display-capture; autoplay"
            className="w-full h-full border-0"
            data-testid="video-iframe"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center text-canvas">
              <VideoOff size={48} strokeWidth={1.5} className="mx-auto opacity-50" />
              <div className="u-small text-canvas mt-3 opacity-70">Video off</div>
              <div className="u-caption text-canvas opacity-60 mt-1">Per-session room · ready to join</div>
            </div>
          </div>
        )}
      </div>
      <div className="p-3 border-t border-line flex items-center gap-2">
        <button
          className={on ? "u-btn-secondary flex-1" : "u-btn-primary flex-1"}
          onClick={onToggle}
          data-testid="session-video-toggle"
        >
          {on ? (<><VideoOff size={16} strokeWidth={2} /> Stop video</>) : (<><Video size={16} strokeWidth={2} /> Start video</>)}
        </button>
      </div>
    </div>
  );
}

function ChatBubble({ msg }) {
  const mine = msg.role === "you";
  return (
    <div className={`flex ${mine ? "justify-end" : "justify-start"}`} data-testid={`msg-${msg.id}`}>
      <div className="max-w-[78%]">
        {!mine && <div className="u-caption mb-1 ml-1">{msg.author || "Tutor"}</div>}
        <div className={`rounded-md px-4 py-2.5 text-[14.5px] leading-6 whitespace-pre-wrap ${
          mine ? "bg-purple-primary text-white" : "bg-canvas-alt text-ink"
        }`}>
          {msg.body}
        </div>
      </div>
    </div>
  );
}

export default function Session() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [session, setSession] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [code, setCode] = useState("# collaborate live\n");
  const [videoOn, setVideoOn] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [modalOpen, setModalOpen] = useState(false);
  const [resolveErr, setResolveErr] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [wsConnected, setWsConnected] = useState(false);
  const wsRef = useRef(null);
  const timerRef = useRef(null);
  const scrollRef = useRef(null);

  // Load session metadata
  useEffect(() => {
    let cancelled = false;
    api.get(`/sessions/${id}`).then(({ data }) => {
      if (cancelled) return;
      setSession(data);
      setSecondsLeft(data.duration_min * 60);
    }).catch((e) => console.warn("session load failed", e));
    return () => { cancelled = true; };
  }, [id]);

  // Connect WebSocket for live chat
  useEffect(() => {
    if (!id) return;
    const backend = process.env.REACT_APP_BACKEND_URL || "";
    const wsBase = backend.replace(/^http/, "ws");
    const url = `${wsBase}/api/ws/sessions/${id}`;
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => setWsConnected(true);
    ws.onclose = () => setWsConnected(false);
    ws.onerror = (e) => console.warn("chat ws error", e);
    ws.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.type === "history") {
          setMessages(data.messages || []);
        } else if (data.type === "message" && data.message) {
          setMessages((m) => (m.some((x) => x.id === data.message.id) ? m : [...m, data.message]));
        }
      } catch (err) {
        console.warn("bad ws payload", err);
      }
    };

    return () => {
      try { ws.close(); } catch (e) { console.warn("ws close failed", e); }
    };
  }, [id]);

  // Auto-scroll on new messages
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  // Countdown timer
  useEffect(() => {
    if (secondsLeft <= 0) return;
    timerRef.current = setInterval(() => setSecondsLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(timerRef.current);
  }, [secondsLeft > 0]); // eslint-disable-line react-hooks/exhaustive-deps

  const sendMsg = useCallback(() => {
    const body = input.trim();
    if (!body || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(JSON.stringify({ body }));
    setInput("");
  }, [input]);

  const handleResolve = async (resolution) => {
    setResolveErr("");
    setSubmitting(true);
    try {
      await api.post(`/sessions/${id}/resolve`, { resolution });
      navigate("/dashboard/history");
    } catch (e) {
      setResolveErr(formatApiErrorDetail(e.response?.data?.detail) || e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const mins = Math.floor(secondsLeft / 60);
  const secs = (secondsLeft % 60).toString().padStart(2, "0");

  if (!session) {
    return (
      <DashboardLayout>
        <div className="u-card text-center">Loading session…</div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div data-testid="session-page" className="max-w-6xl">
        {/* top bar */}
        <div className="u-card flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="flex items-center gap-4">
            <Link to="/dashboard" className="text-ink-muted hover:text-purple-primary"><ArrowLeft size={18} strokeWidth={1.75} /></Link>
            <div>
              <div className="font-display font-semibold text-ink">{session.topic} with {session.tutor_name}</div>
              <div className="u-caption flex items-center gap-2">
                Session #{session.id.slice(0, 8)}
                <span className={`inline-flex items-center gap-1 ${wsConnected ? "text-good" : "text-ink-soft"}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${wsConnected ? "bg-good" : "bg-ink-soft"}`} />
                  {wsConnected ? "Live" : "Connecting…"}
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <span className="u-pill">{session.tier} · {session.duration_min} min</span>
            <span className="inline-flex items-center gap-1.5 u-small font-medium text-ink" data-testid="session-timer">
              <Clock size={14} strokeWidth={1.75} className="text-purple-primary" /> {mins}:{secs}
            </span>
            <button className="u-btn-secondary !py-2 !px-3 text-[13.5px]" onClick={() => setModalOpen(true)} data-testid="session-end">
              <Square size={14} strokeWidth={2} /> End
            </button>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-5 mt-6">
          {/* live chat */}
          <div className="lg:col-span-2 u-card !p-0 flex flex-col h-[520px]">
            <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-5 space-y-4" data-testid="session-chat">
              {messages.length === 0 ? (
                <div className="u-caption text-center mt-12">Connecting to your tutor…</div>
              ) : (
                messages.map((m) => <ChatBubble key={m.id} msg={m} />)
              )}
            </div>
            <div className="border-t border-line p-3 flex gap-2">
              <input
                className="u-input flex-1"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && sendMsg()}
                placeholder={wsConnected ? "Reply to your tutor…" : "Connecting…"}
                disabled={!wsConnected}
                data-testid="session-chat-input"
              />
              <button className="u-btn-primary !px-4" onClick={sendMsg} disabled={!wsConnected || !input.trim()} data-testid="session-chat-send">
                <Send size={16} strokeWidth={2} />
              </button>
            </div>
          </div>

          {/* Video — per-session room */}
          <VideoPanel on={videoOn} onToggle={() => setVideoOn(!videoOn)} sessionId={id} />
        </div>

        {/* code editor */}
        <div className="u-card mt-5 !p-0 overflow-hidden">
          <div className="px-5 py-3 border-b border-line flex items-center justify-between">
            <span className="font-display font-semibold text-ink text-[14px]">Shared editor</span>
            <span className="u-caption">Live · auto-saved</span>
          </div>
          <div data-testid="session-editor" className="bg-ink">
            <Editor
              height="280px"
              defaultLanguage="python"
              value={code}
              onChange={(v) => setCode(v ?? "")}
              theme="vs-dark"
              options={SESSION_MONACO_OPTIONS}
            />
          </div>
        </div>

        {resolveErr && <div className="u-small text-bad mt-3" data-testid="resolve-error">{resolveErr}</div>}
      </div>

      <ResolutionModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onResolve={handleResolve}
        submitting={submitting}
      />
    </DashboardLayout>
  );
}
