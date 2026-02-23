import { useState, useEffect, useRef, useCallback } from "react";

const EMOTIONS = ["calm", "focused", "stressed", "anxious", "fatigued", "joy", "dissociation"];

const EMOTION_CONFIG = {
  calm:          { color: "#4ade80", glow: "0 0 30px #4ade8066", icon: "◎", label: "Calm" },
  focused:       { color: "#60a5fa", glow: "0 0 30px #60a5fa66", icon: "◈", label: "Focused" },
  stressed:      { color: "#f87171", glow: "0 0 30px #f8717166", icon: "◉", label: "Stressed" },
  anxious:       { color: "#fb923c", glow: "0 0 30px #fb923c66", icon: "◌", label: "Anxious" },
  fatigued:      { color: "#a78bfa", glow: "0 0 30px #a78bfa66", icon: "◍", label: "Fatigued" },
  joy:           { color: "#facc15", glow: "0 0 30px #facc1566", icon: "●", label: "Joy" },
  dissociation:  { color: "#94a3b8", glow: "0 0 30px #94a3b866", icon: "○", label: "Dissociation" },
};

// ── Circular emotion radar ──────────────────────────────────────────────────
function EmotionRadar({ allEmotions, activeEmotion }) {
  if (!allEmotions) return null;
  const cx = 80, cy = 80, r = 55;
  const n = EMOTIONS.length;

  const points = EMOTIONS.map((e, i) => {
    const angle = (i / n) * 2 * Math.PI - Math.PI / 2;
    const val = allEmotions[e] || 0;
    return {
      x: cx + r * val * Math.cos(angle),
      y: cy + r * val * Math.sin(angle),
      label: e,
      outer: { x: cx + (r + 14) * Math.cos(angle), y: cy + (r + 14) * Math.sin(angle) },
    };
  });

  const polygon = points.map(p => `${p.x},${p.y}`).join(" ");

  return (
    <svg width="160" height="160" viewBox="0 0 160 160">
      {/* Grid rings */}
      {[0.25, 0.5, 0.75, 1].map(scale => (
        <polygon
          key={scale}
          points={EMOTIONS.map((_, i) => {
            const angle = (i / n) * 2 * Math.PI - Math.PI / 2;
            return `${cx + r * scale * Math.cos(angle)},${cy + r * scale * Math.sin(angle)}`;
          }).join(" ")}
          fill="none"
          stroke="rgba(255,255,255,0.07)"
          strokeWidth="1"
        />
      ))}
      {/* Spokes */}
      {EMOTIONS.map((_, i) => {
        const angle = (i / n) * 2 * Math.PI - Math.PI / 2;
        return (
          <line
            key={i}
            x1={cx} y1={cy}
            x2={cx + r * Math.cos(angle)}
            y2={cy + r * Math.sin(angle)}
            stroke="rgba(255,255,255,0.07)"
            strokeWidth="1"
          />
        );
      })}
      {/* Data polygon */}
      <polygon
        points={polygon}
        fill={`${EMOTION_CONFIG[activeEmotion]?.color || "#60a5fa"}22`}
        stroke={EMOTION_CONFIG[activeEmotion]?.color || "#60a5fa"}
        strokeWidth="1.5"
        style={{ filter: `drop-shadow(${EMOTION_CONFIG[activeEmotion]?.glow || ""})` }}
      />
      {/* Emotion labels */}
      {points.map((p, i) => (
        <text
          key={i}
          x={p.outer.x}
          y={p.outer.y}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize="6"
          fill={EMOTIONS[i] === activeEmotion
            ? EMOTION_CONFIG[EMOTIONS[i]].color
            : "rgba(255,255,255,0.35)"}
          fontFamily="'DM Mono', monospace"
        >
          {EMOTIONS[i].slice(0, 4).toUpperCase()}
        </text>
      ))}
      {/* Center dot */}
      <circle cx={cx} cy={cy} r={3} fill={EMOTION_CONFIG[activeEmotion]?.color || "#60a5fa"} />
    </svg>
  );
}

// ── Stress timeline bar ─────────────────────────────────────────────────────
function StressTimeline({ timeline }) {
  if (!timeline.length) return (
    <div style={{ height: 40, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <span style={{ color: "rgba(255,255,255,0.2)", fontSize: 11, fontFamily: "'DM Mono', monospace" }}>
        TIMELINE WILL APPEAR HERE
      </span>
    </div>
  );

  const recent = timeline.slice(-80);
  const w = 4, gap = 1;

  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: gap, height: 40, overflow: "hidden" }}>
      {recent.map((entry, i) => {
        const h = Math.max(4, entry.stress * 38);
        const cfg = EMOTION_CONFIG[entry.e] || EMOTION_CONFIG.calm;
        return (
          <div
            key={i}
            style={{
              width: w,
              height: h,
              background: cfg.color,
              borderRadius: 1,
              opacity: 0.4 + (i / recent.length) * 0.6,
              flexShrink: 0,
              transition: "height 0.2s ease",
            }}
            title={`${cfg.label} — stress: ${entry.stress.toFixed(2)}`}
          />
        );
      })}
    </div>
  );
}

// ── Emotion bar ─────────────────────────────────────────────────────────────
function EmotionBar({ emotion, value, isActive }) {
  const cfg = EMOTION_CONFIG[emotion];
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
      <span style={{
        width: 70, fontSize: 9, color: isActive ? cfg.color : "rgba(255,255,255,0.3)",
        fontFamily: "'DM Mono', monospace", letterSpacing: 1,
        textTransform: "uppercase", flexShrink: 0,
        transition: "color 0.3s",
      }}>
        {cfg.label}
      </span>
      <div style={{ flex: 1, height: 3, background: "rgba(255,255,255,0.06)", borderRadius: 2, overflow: "hidden" }}>
        <div style={{
          height: "100%",
          width: `${(value || 0) * 100}%`,
          background: cfg.color,
          borderRadius: 2,
          transition: "width 0.4s cubic-bezier(0.34,1.56,0.64,1)",
          boxShadow: isActive ? `0 0 8px ${cfg.color}` : "none",
        }} />
      </div>
      <span style={{
        width: 30, fontSize: 9, color: "rgba(255,255,255,0.25)",
        fontFamily: "'DM Mono', monospace", textAlign: "right", flexShrink: 0,
      }}>
        {((value || 0) * 100).toFixed(0)}%
      </span>
    </div>
  );
}

// ── Main Component ──────────────────────────────────────────────────────────
export default function EmotionDetector({ token, userId, onEmotionUpdate }) {
  const videoRef       = useRef(null);
  const canvasRef      = useRef(null);
  const wsRef          = useRef(null);
  const streamRef      = useRef(null);
  const frameLoopRef   = useRef(null);
  const timelineRef    = useRef([]);

  const [status,        setStatus]        = useState("idle");   // idle | connecting | live | error | no_face
  const [emotion,       setEmotion]       = useState(null);
  const [allEmotions,   setAllEmotions]   = useState(null);
  const [confidence,    setConfidence]    = useState(0);
  const [stressScore,   setStressScore]   = useState(0);
  const [fps,           setFps]           = useState(0);
  const [timeline,      setTimeline]      = useState([]);
  const [isMock,        setIsMock]        = useState(false);
  const [faceDetected,  setFaceDetected]  = useState(false);

  const WS_URL = import.meta?.env?.VITE_WS_URL || "ws://localhost:8000";

  // ── Connect WebSocket ─────────────────────────────────────────────────────
  const connect = useCallback(async () => {
    setStatus("connecting");

    try {
      // Get camera
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: "user", frameRate: 30 },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
    } catch (err) {
      setStatus("error");
      console.error("Camera access denied:", err);
      return;
    }

    // Connect WS
    try {
      const ws = new WebSocket(`${WS_URL}/emotion/ws/${userId}?token=${token}`);
      wsRef.current = ws;

      ws.onopen = () => {
        setStatus("live");
        startFrameLoop();
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === "keepalive" || data.type === "pong") return;

          setFps(data.fps || 0);

          if (!data.face_detected) {
            setFaceDetected(false);
            setStatus("no_face");
            return;
          }

          setFaceDetected(true);
          setStatus("live");

          if (data.emotion) {
            setEmotion(data.emotion);
            setAllEmotions(data.all_emotions);
            setConfidence(data.confidence || 0);
            setStressScore(data.stress_score || 0);
            setIsMock(data.mock || false);

            const entry = { t: data.timestamp, e: data.emotion, stress: data.stress_score || 0 };
            timelineRef.current = [...timelineRef.current.slice(-299), entry];
            setTimeline([...timelineRef.current]);

            onEmotionUpdate?.(data);
          }
        } catch {}
      };

      ws.onerror = () => setStatus("error");
      ws.onclose = () => {
        if (status !== "idle") setStatus("idle");
        stopFrameLoop();
      };

    } catch (err) {
      setStatus("error");
    }
  }, [token, userId]);

  // ── Frame capture loop ────────────────────────────────────────────────────
  const startFrameLoop = useCallback(() => {
    const canvas = canvasRef.current;
    const video  = videoRef.current;
    if (!canvas || !video) return;
    const ctx = canvas.getContext("2d");

    const capture = () => {
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;

      canvas.width  = 320;   // Downscale for bandwidth
      canvas.height = 240;
      ctx.drawImage(video, 0, 0, 320, 240);

      canvas.toBlob(blob => {
        if (!blob) return;
        const reader = new FileReader();
        reader.onload = () => {
          if (wsRef.current?.readyState === WebSocket.OPEN) {
            const b64 = reader.result.split(",")[1];
            wsRef.current.send(JSON.stringify({ frame: b64 }));
          }
        };
        reader.readAsDataURL(blob);
      }, "image/jpeg", 0.7);

      frameLoopRef.current = requestAnimationFrame(capture);
    };

    frameLoopRef.current = requestAnimationFrame(capture);
  }, []);

  const stopFrameLoop = useCallback(() => {
    if (frameLoopRef.current) cancelAnimationFrame(frameLoopRef.current);
  }, []);

  // ── Disconnect ────────────────────────────────────────────────────────────
  const disconnect = useCallback(() => {
    stopFrameLoop();
    wsRef.current?.close();
    streamRef.current?.getTracks().forEach(t => t.stop());
    if (videoRef.current) videoRef.current.srcObject = null;
    setStatus("idle");
    setEmotion(null);
    setAllEmotions(null);
  }, [stopFrameLoop]);

  useEffect(() => () => disconnect(), []);

  // ── Derived state ─────────────────────────────────────────────────────────
  const cfg            = emotion ? EMOTION_CONFIG[emotion] : null;
  const stressPct      = Math.round(stressScore * 100);
  const stressLabel    = stressPct > 70 ? "HIGH" : stressPct > 40 ? "MODERATE" : "LOW";
  const stressLabelClr = stressPct > 70 ? "#f87171" : stressPct > 40 ? "#fb923c" : "#4ade80";

  return (
    <div style={{
      fontFamily: "'DM Mono', 'Courier New', monospace",
      background: "linear-gradient(135deg, #08080f 0%, #0d0d1a 50%, #080810 100%)",
      minHeight: "100vh",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      padding: "24px 16px",
      color: "#fff",
    }}>
      {/* Google font */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:ital,wght@0,300;0,400;0,500;1,400&family=Syne:wght@400;600;700;800&display=swap');

        .emotion-pulse {
          animation: pulse 2s ease-in-out infinite;
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50%       { opacity: 0.7; transform: scale(0.97); }
        }
        .scan-line {
          animation: scan 3s linear infinite;
        }
        @keyframes scan {
          0%   { transform: translateY(-100%); opacity: 0; }
          10%  { opacity: 0.4; }
          90%  { opacity: 0.4; }
          100% { transform: translateY(100%); opacity: 0; }
        }
        .blink { animation: blink 1s step-end infinite; }
        @keyframes blink { 50% { opacity: 0; } }
        .fade-in { animation: fadeIn 0.4s ease; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
        .stress-bar-fill {
          transition: width 0.6s cubic-bezier(0.34,1.2,0.64,1);
        }
      `}</style>

      {/* Header */}
      <div style={{ marginBottom: 28, textAlign: "center" }}>
        <div style={{
          fontFamily: "'Syne', sans-serif",
          fontSize: 11,
          letterSpacing: 6,
          color: "rgba(255,255,255,0.3)",
          textTransform: "uppercase",
          marginBottom: 6,
        }}>
          Neural Emotion Engine
        </div>
        <div style={{
          fontFamily: "'Syne', sans-serif",
          fontSize: 22,
          fontWeight: 800,
          letterSpacing: -0.5,
          background: "linear-gradient(90deg, #60a5fa, #a78bfa)",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
        }}>
          MindScan
        </div>
      </div>

      {/* Main layout */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "1fr 280px",
        gap: 16,
        width: "100%",
        maxWidth: 820,
      }}>

        {/* LEFT — Camera feed */}
        <div style={{
          position: "relative",
          background: "#0a0a14",
          borderRadius: 16,
          overflow: "hidden",
          border: `1px solid ${cfg ? cfg.color + "33" : "rgba(255,255,255,0.06)"}`,
          boxShadow: cfg ? cfg.glow : "none",
          transition: "border-color 0.5s, box-shadow 0.5s",
          aspectRatio: "4/3",
        }}>
          {/* Video */}
          <video
            ref={videoRef}
            muted
            playsInline
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              display: status !== "idle" ? "block" : "none",
              transform: "scaleX(-1)",  // mirror
              filter: "brightness(0.85) contrast(1.1)",
            }}
          />
          <canvas ref={canvasRef} style={{ display: "none" }} />

          {/* Idle state */}
          {status === "idle" && (
            <div style={{
              position: "absolute", inset: 0,
              display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center",
              gap: 12,
            }}>
              <div style={{ fontSize: 36, opacity: 0.2 }}>◎</div>
              <div style={{ fontSize: 10, color: "rgba(255,255,255,0.2)", letterSpacing: 3 }}>
                CAMERA INACTIVE
              </div>
            </div>
          )}

          {/* Scan line overlay */}
          {status === "live" && (
            <div className="scan-line" style={{
              position: "absolute", left: 0, right: 0,
              height: "30%",
              background: "linear-gradient(180deg, transparent, rgba(96,165,250,0.04), transparent)",
              pointerEvents: "none",
            }} />
          )}

          {/* Corner brackets */}
          {["tl","tr","bl","br"].map(pos => (
            <div key={pos} style={{
              position: "absolute",
              top:    pos.startsWith("t") ? 12 : "auto",
              bottom: pos.startsWith("b") ? 12 : "auto",
              left:   pos.endsWith("l")   ? 12 : "auto",
              right:  pos.endsWith("r")   ? 12 : "auto",
              width: 16, height: 16,
              borderTop:    pos.startsWith("t") ? `1.5px solid ${cfg?.color || "rgba(255,255,255,0.2)"}` : "none",
              borderBottom: pos.startsWith("b") ? `1.5px solid ${cfg?.color || "rgba(255,255,255,0.2)"}` : "none",
              borderLeft:   pos.endsWith("l")   ? `1.5px solid ${cfg?.color || "rgba(255,255,255,0.2)"}` : "none",
              borderRight:  pos.endsWith("r")   ? `1.5px solid ${cfg?.color || "rgba(255,255,255,0.2)"}` : "none",
              transition: "border-color 0.5s",
            }} />
          ))}

          {/* Status overlay */}
          <div style={{
            position: "absolute", bottom: 12, left: 12, right: 12,
            display: "flex", justifyContent: "space-between", alignItems: "center",
          }}>
            <div style={{
              fontSize: 8, letterSpacing: 2, padding: "3px 8px",
              borderRadius: 3,
              background: status === "live"
                ? (faceDetected ? "rgba(74,222,128,0.15)" : "rgba(251,146,60,0.15)")
                : "rgba(255,255,255,0.05)",
              border: `1px solid ${status === "live" ? (faceDetected ? "#4ade8033" : "#fb923c33") : "rgba(255,255,255,0.1)"}`,
              color: status === "live" ? (faceDetected ? "#4ade80" : "#fb923c") : "rgba(255,255,255,0.3)",
            }}>
              {status === "idle"       && "● STANDBY"}
              {status === "connecting" && "○ INITIALIZING"}
              {status === "live"       && faceDetected  && "● TRACKING"}
              {status === "no_face"    && "○ NO FACE DETECTED"}
              {status === "error"      && "● ERROR"}
            </div>
            {status === "live" && (
              <div style={{ fontSize: 8, color: "rgba(255,255,255,0.25)", letterSpacing: 1 }}>
                {fps.toFixed(1)} FPS {isMock && "· DEMO"}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT — Analysis panel */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

          {/* Current emotion */}
          <div style={{
            background: "#0a0a14",
            border: `1px solid ${cfg ? cfg.color + "22" : "rgba(255,255,255,0.06)"}`,
            borderRadius: 14,
            padding: "16px",
            transition: "border-color 0.5s",
          }}>
            <div style={{ fontSize: 8, letterSpacing: 3, color: "rgba(255,255,255,0.25)", marginBottom: 10 }}>
              DETECTED STATE
            </div>

            {cfg ? (
              <div className="fade-in">
                <div className="emotion-pulse" style={{
                  fontSize: 28,
                  marginBottom: 4,
                  filter: `drop-shadow(${cfg.glow})`,
                  color: cfg.color,
                }}>
                  {cfg.icon}
                </div>
                <div style={{
                  fontFamily: "'Syne', sans-serif",
                  fontSize: 20,
                  fontWeight: 700,
                  color: cfg.color,
                  letterSpacing: -0.5,
                }}>
                  {cfg.label}
                </div>
                <div style={{ fontSize: 9, color: "rgba(255,255,255,0.25)", marginTop: 3 }}>
                  {(confidence * 100).toFixed(0)}% confidence
                </div>
              </div>
            ) : (
              <div style={{ color: "rgba(255,255,255,0.2)", fontSize: 12 }}>
                {status === "idle" ? "—" : <span className="blink">ANALYZING<span>...</span></span>}
              </div>
            )}
          </div>

          {/* Stress meter */}
          <div style={{
            background: "#0a0a14",
            border: "1px solid rgba(255,255,255,0.06)",
            borderRadius: 14,
            padding: "14px 16px",
          }}>
            <div style={{
              display: "flex", justifyContent: "space-between",
              alignItems: "center", marginBottom: 10,
            }}>
              <div style={{ fontSize: 8, letterSpacing: 3, color: "rgba(255,255,255,0.25)" }}>
                STRESS INDEX
              </div>
              <div style={{ fontSize: 9, color: stressLabelClr, letterSpacing: 2 }}>
                {stressLabel}
              </div>
            </div>
            <div style={{ height: 4, background: "rgba(255,255,255,0.06)", borderRadius: 2, overflow: "hidden" }}>
              <div className="stress-bar-fill" style={{
                height: "100%",
                width: `${stressPct}%`,
                background: `linear-gradient(90deg, #4ade80, #fb923c ${stressPct > 60 ? "60%" : "100%"}, #f87171)`,
                boxShadow: stressPct > 60 ? "0 0 8px #f8717166" : "none",
              }} />
            </div>
            <div style={{ marginTop: 6, fontSize: 18, fontWeight: 600, color: stressLabelClr }}>
              {stressPct}
              <span style={{ fontSize: 9, color: "rgba(255,255,255,0.25)", marginLeft: 2 }}>/100</span>
            </div>
          </div>

          {/* Radar */}
          <div style={{
            background: "#0a0a14",
            border: "1px solid rgba(255,255,255,0.06)",
            borderRadius: 14,
            padding: "14px 16px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
          }}>
            <div style={{ fontSize: 8, letterSpacing: 3, color: "rgba(255,255,255,0.25)", marginBottom: 8, alignSelf: "flex-start" }}>
              EMOTION RADAR
            </div>
            <EmotionRadar allEmotions={allEmotions} activeEmotion={emotion} />
          </div>
        </div>
      </div>

      {/* Bottom row */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: 12,
        width: "100%",
        maxWidth: 820,
        marginTop: 12,
      }}>

        {/* Emotion breakdown bars */}
        <div style={{
          background: "#0a0a14",
          border: "1px solid rgba(255,255,255,0.06)",
          borderRadius: 14,
          padding: "16px",
        }}>
          <div style={{ fontSize: 8, letterSpacing: 3, color: "rgba(255,255,255,0.25)", marginBottom: 12 }}>
            EMOTION BREAKDOWN
          </div>
          {EMOTIONS.map(e => (
            <EmotionBar
              key={e}
              emotion={e}
              value={allEmotions?.[e]}
              isActive={emotion === e}
            />
          ))}
        </div>

        {/* Timeline + controls */}
        <div style={{
          background: "#0a0a14",
          border: "1px solid rgba(255,255,255,0.06)",
          borderRadius: 14,
          padding: "16px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
        }}>
          <div>
            <div style={{ fontSize: 8, letterSpacing: 3, color: "rgba(255,255,255,0.25)", marginBottom: 12 }}>
              STRESS TIMELINE
            </div>
            <StressTimeline timeline={timeline} />
          </div>

          {/* Session stats */}
          {timeline.length > 0 && (
            <div style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr 1fr",
              gap: 8,
              marginTop: 14,
            }}>
              {[
                { label: "AVG STRESS", val: `${Math.round(timeline.reduce((a, b) => a + b.stress, 0) / timeline.length * 100)}%` },
                { label: "FRAMES",     val: timeline.length },
                { label: "TOP STATE",  val: ((() => {
                  const counts = {};
                  timeline.forEach(t => counts[t.e] = (counts[t.e] || 0) + 1);
                  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0]?.slice(0, 4).toUpperCase() || "—";
                }))() },
              ].map(({ label, val }) => (
                <div key={label} style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "#fff" }}>{val}</div>
                  <div style={{ fontSize: 7, letterSpacing: 2, color: "rgba(255,255,255,0.2)", marginTop: 2 }}>{label}</div>
                </div>
              ))}
            </div>
          )}

          {/* Controls */}
          <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
            {status === "idle" ? (
              <button
                onClick={connect}
                style={{
                  flex: 1, padding: "10px 0",
                  background: "linear-gradient(135deg, #3b82f6, #6366f1)",
                  border: "none", borderRadius: 8,
                  color: "#fff", fontSize: 10, letterSpacing: 3,
                  cursor: "pointer", fontFamily: "'DM Mono', monospace",
                  textTransform: "uppercase",
                  transition: "opacity 0.2s",
                }}
                onMouseEnter={e => e.target.style.opacity = 0.85}
                onMouseLeave={e => e.target.style.opacity = 1}
              >
                ▶ START SCAN
              </button>
            ) : (
              <>
                <button
                  onClick={() => {
                    wsRef.current?.send(JSON.stringify({ type: "reset" }));
                    timelineRef.current = [];
                    setTimeline([]);
                  }}
                  style={{
                    flex: 1, padding: "10px 0",
                    background: "rgba(255,255,255,0.05)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: 8,
                    color: "rgba(255,255,255,0.5)", fontSize: 9, letterSpacing: 2,
                    cursor: "pointer", fontFamily: "'DM Mono', monospace",
                  }}
                >
                  ↺ RESET
                </button>
                <button
                  onClick={disconnect}
                  style={{
                    flex: 1, padding: "10px 0",
                    background: "rgba(248,113,113,0.1)",
                    border: "1px solid rgba(248,113,113,0.2)",
                    borderRadius: 8,
                    color: "#f87171", fontSize: 9, letterSpacing: 2,
                    cursor: "pointer", fontFamily: "'DM Mono', monospace",
                  }}
                >
                  ■ STOP
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Journal sync note */}
      {status === "live" && faceDetected && emotion && (
        <div className="fade-in" style={{
          marginTop: 12,
          fontSize: 9,
          color: "rgba(255,255,255,0.2)",
          letterSpacing: 2,
          textAlign: "center",
        }}>
          EMOTION DATA SYNCING TO JOURNAL SESSION
          <span className="blink"> ●</span>
        </div>
      )}
    </div>
  );
}
