import React, { useEffect, useState, useRef } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { Video, VideoOff, Send, Square, Clock, ArrowLeft } from "lucide-react";
import DashboardLayout from "../components/dashboard/DashboardLayout";
import api from "../lib/api";

export default function Session() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [session, setSession] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [code, setCode] = useState("# collaborate live\n");
  const [videoOn, setVideoOn] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const timerRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    api.get(`/sessions/${id}`).then(({ data }) => {
      if (cancelled) return;
      setSession(data);
      setSecondsLeft(data.duration_min * 60);
      setMessages([
        { role: "tutor", body: `Hi — I'm ${data.tutor_name}. I read your doubt. Let's start with the chunker config you mentioned.`, ts: new Date().toISOString() },
      ]);
    }).catch((e) => console.warn("session load failed", e));
    return () => { cancelled = true; };
  }, [id]);

  useEffect(() => {
    if (secondsLeft <= 0) return;
    timerRef.current = setInterval(() => setSecondsLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(timerRef.current);
  }, [secondsLeft > 0]);  // eslint-disable-line

  const sendMsg = () => {
    if (!input.trim()) return;
    setMessages((m) => [...m, { role: "you", body: input, ts: new Date().toISOString() }]);
    setInput("");
    // simulate tutor reply
    setTimeout(() => {
      setMessages((m) => [...m, { role: "tutor", body: "Got it — try lowering chunk overlap to 64 and re-run recall@5.", ts: new Date().toISOString() }]);
    }, 1200);
  };

  const endSession = async () => {
    try { await api.post(`/sessions/${id}/end`); } catch (e) { console.warn("end-session failed", e); }
    navigate("/dashboard");
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
              <div className="u-caption">Session #{session.id.slice(0, 8)}</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="u-pill">{session.tier} · {session.duration_min} min</span>
            <span className="inline-flex items-center gap-1.5 u-small font-medium text-ink" data-testid="session-timer">
              <Clock size={14} strokeWidth={1.75} className="text-purple-primary" /> {mins}:{secs}
            </span>
            <button className="u-btn-secondary !py-2 !px-3 text-[13.5px]" onClick={endSession} data-testid="session-end">
              <Square size={14} strokeWidth={2} /> End
            </button>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-5 mt-6">
          {/* chat */}
          <div className="lg:col-span-2 u-card !p-0 flex flex-col h-[520px]">
            <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4" data-testid="session-chat">
              {messages.map((m, i) => (
                <div key={i} className={`flex ${m.role === "you" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[78%] rounded-md px-4 py-2.5 text-[14.5px] leading-6 ${
                    m.role === "you" ? "bg-purple-primary text-white" : "bg-canvas-alt text-ink"
                  }`}>
                    {m.body}
                  </div>
                </div>
              ))}
            </div>
            <div className="border-t border-line p-3 flex gap-2">
              <input
                className="u-input flex-1"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && sendMsg()}
                placeholder="Reply to your tutor…"
                data-testid="session-chat-input"
              />
              <button className="u-btn-primary !px-4" onClick={sendMsg} data-testid="session-chat-send">
                <Send size={16} strokeWidth={2} />
              </button>
            </div>
          </div>

          {/* video */}
          <div className="u-card !p-0 overflow-hidden h-[520px] flex flex-col">
            <div className="flex-1 bg-ink relative flex items-center justify-center">
              {videoOn ? (
                <div className="text-center text-canvas">
                  <Video size={48} strokeWidth={1.5} className="mx-auto opacity-80" />
                  <div className="u-small text-canvas mt-3 opacity-90">Video panel (Daily.co iframe)</div>
                </div>
              ) : (
                <div className="text-center text-canvas">
                  <VideoOff size={48} strokeWidth={1.5} className="mx-auto opacity-50" />
                  <div className="u-small text-canvas mt-3 opacity-70">Video off</div>
                </div>
              )}
            </div>
            <div className="p-3 border-t border-line">
              <button className="u-btn-secondary w-full" onClick={() => setVideoOn(!videoOn)} data-testid="session-video-toggle">
                {videoOn ? "Stop video" : "Start video"}
              </button>
            </div>
          </div>
        </div>

        {/* code editor */}
        <div className="u-card mt-5 !p-0 overflow-hidden">
          <div className="px-5 py-3 border-b border-line flex items-center justify-between">
            <span className="font-display font-semibold text-ink text-[14px]">Shared editor</span>
            <span className="u-caption">Live · auto-saved</span>
          </div>
          <textarea
            className="w-full font-mono text-[13.5px] p-5 bg-ink text-canvas border-0 outline-none min-h-[220px]"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            spellCheck={false}
            data-testid="session-editor"
          />
        </div>
      </div>
    </DashboardLayout>
  );
}
