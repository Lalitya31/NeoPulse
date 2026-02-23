import { useEffect, useRef, useState, useCallback } from "react";

/*
  BreathingExercise.jsx
  ─────────────────────
  Three.js particle sphere that expands/contracts with guided breathing.
  Particle color = real-time emotion state (from EmotionDetector WebSocket).
  As user calms down, particles transition from chaotic → ordered.

  Phases: inhale(4s) → hold(4s) → exhale(4s) → hold(4s) → repeat
  
  CDN: <script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
*/

const PHASES = [
  { name: "INHALE",  duration: 4000, target: 1.0,  color: 0x60a5fa, instruction: "Breathe in slowly..." },
  { name: "HOLD",    duration: 4000, target: 1.0,  color: 0xa78bfa, instruction: "Hold..." },
  { name: "EXHALE",  duration: 4000, target: 0.35, color: 0x4ade80, instruction: "Release slowly..." },
  { name: "HOLD",    duration: 4000, target: 0.35, color: 0x94a3b8, instruction: "Rest..." },
];

const EMOTION_COLORS = {
  calm:         [0x4ade80, 0x059669],
  focused:      [0x60a5fa, 0x2563eb],
  stressed:     [0xf87171, 0xdc2626],
  anxious:      [0xfb923c, 0xea580c],
  fatigued:     [0xa78bfa, 0x7c3aed],
  joy:          [0xfacc15, 0xd97706],
  dissociation: [0x94a3b8, 0x475569],
};

const N_PARTICLES = 2400;

function easeInOut(t) {
  return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
}

export default function BreathingExercise({ emotion = "calm", stressScore = 0.3, onComplete }) {
  const mountRef    = useRef(null);
  const frameRef    = useRef(null);
  const stateRef    = useRef({
    phaseIndex: 0,
    phaseStart: Date.now(),
    breathScale: 0.35,
    targetScale: 1.0,
    cycleCount: 0,
  });

  const [phase,       setPhase]       = useState(PHASES[0]);
  const [progress,    setProgress]    = useState(0);
  const [cycleCount,  setCycleCount]  = useState(0);
  const [active,      setActive]      = useState(false);
  const [countdown,   setCountdown]   = useState(null);

  const emotionColors = EMOTION_COLORS[emotion] || EMOTION_COLORS.calm;

  // ── Three.js scene ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!active || !window.THREE) return;
    const THREE = window.THREE;

    const W = mountRef.current.clientWidth;
    const H = mountRef.current.clientHeight;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(W, H);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);
    mountRef.current.appendChild(renderer.domElement);

    const scene  = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(60, W / H, 0.1, 1000);
    camera.position.z = 300;

    // ── Particle sphere ───────────────────────────────────────────────────────
    const positions  = new Float32Array(N_PARTICLES * 3);
    const origPos    = new Float32Array(N_PARTICLES * 3);
    const colors     = new Float32Array(N_PARTICLES * 3);
    const sizes      = new Float32Array(N_PARTICLES);
    const velocities = new Float32Array(N_PARTICLES * 3);
    const phases_p   = new Float32Array(N_PARTICLES);  // per-particle phase offset

    // Fibonacci sphere distribution
    const phi = Math.PI * (3 - Math.sqrt(5));
    const baseRadius = 80;

    for (let i = 0; i < N_PARTICLES; i++) {
      const y = 1 - (i / (N_PARTICLES - 1)) * 2;
      const r = Math.sqrt(1 - y * y);
      const theta = phi * i;

      const x = Math.cos(theta) * r;
      const z = Math.sin(theta) * r;

      origPos[i*3]   = x * baseRadius;
      origPos[i*3+1] = y * baseRadius;
      origPos[i*3+2] = z * baseRadius;

      positions[i*3]   = origPos[i*3];
      positions[i*3+1] = origPos[i*3+1];
      positions[i*3+2] = origPos[i*3+2];

      // Velocity for chaotic state
      velocities[i*3]   = (Math.random() - 0.5) * 0.8;
      velocities[i*3+1] = (Math.random() - 0.5) * 0.8;
      velocities[i*3+2] = (Math.random() - 0.5) * 0.8;

      phases_p[i] = Math.random() * Math.PI * 2;
      sizes[i]    = 1.5 + Math.random() * 2;

      // Initial color from emotion
      const c = new THREE.Color(emotionColors[0]);
      colors[i*3]   = c.r;
      colors[i*3+1] = c.g;
      colors[i*3+2] = c.b;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geo.setAttribute("color",    new THREE.BufferAttribute(colors,    3));
    geo.setAttribute("size",     new THREE.BufferAttribute(sizes,     1));

    const mat = new THREE.ShaderMaterial({
      uniforms: {
        time:       { value: 0 },
        pointScale: { value: renderer.getPixelRatio() * 80 },
      },
      vertexShader: `
        attribute float size;
        attribute vec3 color;
        varying vec3 vColor;
        uniform float time;
        void main() {
          vColor = color;
          vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = size * (200.0 / -mvPos.z);
          gl_Position = projectionMatrix * mvPos;
        }
      `,
      fragmentShader: `
        varying vec3 vColor;
        void main() {
          vec2 uv = gl_PointCoord - 0.5;
          float d = length(uv);
          if (d > 0.5) discard;
          float alpha = smoothstep(0.5, 0.1, d);
          gl_FragColor = vec4(vColor, alpha);
        }
      `,
      transparent: true,
      depthWrite:  false,
      vertexColors: true,
    });

    const particles = new THREE.Points(geo, mat);
    scene.add(particles);

    // ── Wireframe sphere (structural guide) ───────────────────────────────────
    const wireColor = new THREE.Color(emotionColors[0]);
    const wireMat   = new THREE.MeshBasicMaterial({
      color:       wireColor,
      wireframe:   true,
      transparent: true,
      opacity:     0.04,
    });
    const wireSphere = new THREE.Mesh(
      new THREE.SphereGeometry(baseRadius, 16, 16),
      wireMat
    );
    scene.add(wireSphere);

    // ── Animation ─────────────────────────────────────────────────────────────
    let t = 0;

    const animate = () => {
      frameRef.current = requestAnimationFrame(animate);
      t += 0.016;
      mat.uniforms.time.value = t;

      const state = stateRef.current;
      const now   = Date.now();
      const phase = PHASES[state.phaseIndex];
      const elapsed = now - state.phaseStart;
      const phaseProgress = Math.min(elapsed / phase.duration, 1);

      // Advance phase
      if (phaseProgress >= 1) {
        const nextIdx = (state.phaseIndex + 1) % PHASES.length;
        state.phaseIndex = nextIdx;
        state.phaseStart = now;
        state.targetScale = PHASES[nextIdx].target;
        if (nextIdx === 0) {
          state.cycleCount++;
          setCycleCount(state.cycleCount);
        }
        setPhase(PHASES[nextIdx]);
      }

      setProgress(phaseProgress);

      // Smooth breath scale
      state.breathScale += (state.targetScale - state.breathScale) * 0.025;
      const bScale  = state.breathScale;
      const calmness = Math.max(0, 1 - stressScore);

      // Update particle positions
      const posArr = geo.attributes.position.array;
      const colArr = geo.attributes.color.array;

      // Target colors: blend from stressed-color → calm-color based on calmness
      const colorA = new THREE.Color(emotionColors[0]);   // current emotion
      const colorB = new THREE.Color(EMOTION_COLORS.calm[0]);
      const blended = colorA.clone().lerp(colorB, calmness * phaseProgress * 0.3);

      for (let i = 0; i < N_PARTICLES; i++) {
        const ox = origPos[i*3];
        const oy = origPos[i*3+1];
        const oz = origPos[i*3+2];

        // Target: sphere at breathScale * baseRadius
        const tx = ox * bScale;
        const ty = oy * bScale;
        const tz = oz * bScale;

        // Chaos amount: inversely proportional to calmness
        const chaos = stressScore * 12;
        const pOffset = phases_p[i];

        // Apply chaotic noise
        const nx = Math.sin(t * 0.8 + pOffset)       * chaos;
        const ny = Math.cos(t * 0.7 + pOffset * 1.3) * chaos;
        const nz = Math.sin(t * 0.6 + pOffset * 0.7) * chaos;

        posArr[i*3]   = tx + nx;
        posArr[i*3+1] = ty + ny;
        posArr[i*3+2] = tz + nz;

        // Color: transition toward calm
        const colorT = easeInOut(Math.min(1, calmness + phaseProgress * 0.2));
        colArr[i*3]   = colorA.r + (blended.r - colorA.r) * colorT;
        colArr[i*3+1] = colorA.g + (blended.g - colorA.g) * colorT;
        colArr[i*3+2] = colorA.b + (blended.b - colorA.b) * colorT;
      }

      geo.attributes.position.needsUpdate = true;
      geo.attributes.color.needsUpdate    = true;

      // Sphere scale + rotation
      const sScale = bScale;
      wireSphere.scale.set(sScale, sScale, sScale);
      particles.rotation.y += 0.001;
      particles.rotation.x += 0.0003;
      wireSphere.rotation.y -= 0.0005;

      // Camera gentle drift
      camera.position.x = Math.sin(t * 0.05) * 20;
      camera.position.y = Math.cos(t * 0.04) * 15;
      camera.lookAt(0, 0, 0);

      renderer.render(scene, camera);
    };

    animate();
    stateRef.current.phaseStart = Date.now();

    const onResize = () => {
      const w = mountRef.current?.clientWidth  || W;
      const h = mountRef.current?.clientHeight || H;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener("resize", onResize);

    return () => {
      cancelAnimationFrame(frameRef.current);
      window.removeEventListener("resize", onResize);
      renderer.dispose();
      if (mountRef.current?.contains(renderer.domElement)) {
        mountRef.current.removeChild(renderer.domElement);
      }
    };
  }, [active, emotion, stressScore]);

  // ── Countdown before start ──────────────────────────────────────────────────
  const startSession = useCallback(() => {
    let c = 3;
    setCountdown(c);
    const iv = setInterval(() => {
      c--;
      if (c <= 0) {
        clearInterval(iv);
        setCountdown(null);
        setActive(true);
        stateRef.current = {
          phaseIndex: 0,
          phaseStart: Date.now(),
          breathScale: 0.35,
          targetScale: 1.0,
          cycleCount: 0,
        };
        setPhase(PHASES[0]);
      } else {
        setCountdown(c);
      }
    }, 1000);
  }, []);

  const stopSession = useCallback(() => {
    setActive(false);
    setCycleCount(0);
    onComplete?.({ cycles: stateRef.current.cycleCount });
  }, [onComplete]);

  const phaseColorHex = `#${PHASES[active ? stateRef.current?.phaseIndex ?? 0 : 0]?.color?.toString(16).padStart(6,"0") || "60a5fa"}`;
  const stressLabel   = stressScore > 0.65 ? "HIGH" : stressScore > 0.35 ? "MODERATE" : "LOW";
  const stressColor   = stressScore > 0.65 ? "#f87171" : stressScore > 0.35 ? "#facc15" : "#4ade80";

  return (
    <div style={{
      position: "relative",
      width: "100%",
      height: "100vh",
      background: "radial-gradient(ellipse at 50% 60%, #06060f 0%, #020208 100%)",
      overflow: "hidden",
      fontFamily: "'DM Mono', monospace",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@300;400;500&family=Playfair+Display:ital,wght@0,400;1,400&display=swap');
        @keyframes fadeIn   { from{opacity:0;transform:scale(0.95)} to{opacity:1;transform:scale(1)} }
        @keyframes pulse    { 0%,100%{opacity:0.8} 50%{opacity:0.4} }
        @keyframes countdown{ 0%{transform:scale(1.3);opacity:0} 30%{opacity:1} 100%{transform:scale(0.8);opacity:0} }
        .start-btn:hover { transform: scale(1.04) !important; }
      `}</style>

      {/* Canvas */}
      <div ref={mountRef} style={{
        position: "absolute", inset: 0,
        opacity: active ? 1 : 0,
        transition: "opacity 1s ease",
      }} />

      {/* Header */}
      <div style={{
        position: "absolute", top: 28, left: 0, right: 0,
        textAlign: "center", zIndex: 2, pointerEvents: "none",
      }}>
        <div style={{
          fontFamily: "'Playfair Display', serif",
          fontStyle: "italic",
          fontSize: 26,
          color: "rgba(255,255,255,0.7)",
          letterSpacing: 2,
        }}>
          Box Breathing
        </div>
        <div style={{
          fontSize: 8, letterSpacing: 4,
          color: "rgba(255,255,255,0.2)", marginTop: 4,
        }}>
          4 · 4 · 4 · 4 TECHNIQUE
        </div>
      </div>

      {/* Emotion + stress context */}
      <div style={{
        position: "absolute", top: 28, right: 28,
        textAlign: "right", zIndex: 2,
        fontSize: 9, letterSpacing: 2,
      }}>
        <div style={{ color: "rgba(255,255,255,0.25)", marginBottom: 3 }}>
          DETECTED STATE
        </div>
        <div style={{ color: "#fff", fontSize: 11, textTransform: "capitalize" }}>
          {emotion}
        </div>
        <div style={{ color: stressColor, marginTop: 2 }}>
          STRESS: {stressLabel}
        </div>
        {stressScore > 0.65 && (
          <div style={{
            fontSize: 8, color: "#f87171",
            marginTop: 4, animation: "pulse 2s ease infinite",
          }}>
            ● AUTO-TRIGGERED
          </div>
        )}
      </div>

      {/* Idle state */}
      {!active && countdown === null && (
        <div style={{
          zIndex: 3, textAlign: "center",
          animation: "fadeIn 0.6s ease",
        }}>
          <div style={{
            width: 160, height: 160,
            borderRadius: "50%",
            border: "1px solid rgba(255,255,255,0.1)",
            display: "flex", alignItems: "center", justifyContent: "center",
            marginBottom: 32, margin: "0 auto 32px",
            position: "relative",
          }}>
            {/* Static rings */}
            {[1, 1.5, 2].map((s, i) => (
              <div key={i} style={{
                position: "absolute",
                width: 160 * s, height: 160 * s,
                borderRadius: "50%",
                border: "1px solid rgba(96,165,250,0.08)",
                animation: `pulse ${2 + i * 0.5}s ease ${i * 0.3}s infinite`,
              }} />
            ))}
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 36, opacity: 0.3 }}>◎</div>
              <div style={{ fontSize: 8, color: "rgba(255,255,255,0.2)", letterSpacing: 3, marginTop: 4 }}>
                READY
              </div>
            </div>
          </div>

          <div style={{
            fontSize: 9, color: "rgba(255,255,255,0.3)",
            letterSpacing: 3, marginBottom: 24, lineHeight: 1.8,
          }}>
            INHALE 4s · HOLD 4s · EXHALE 4s · HOLD 4s<br/>
            PARTICLES RESPOND TO YOUR STRESS LEVEL
          </div>

          <button
            className="start-btn"
            onClick={startSession}
            style={{
              padding: "14px 40px",
              background: "linear-gradient(135deg, rgba(96,165,250,0.2), rgba(167,139,250,0.2))",
              border: "1px solid rgba(96,165,250,0.3)",
              borderRadius: 30,
              color: "#60a5fa",
              fontFamily: "'DM Mono', monospace",
              fontSize: 10, letterSpacing: 4,
              cursor: "pointer",
              transition: "transform 0.2s",
              textTransform: "uppercase",
            }}
          >
            BEGIN SESSION
          </button>
        </div>
      )}

      {/* Countdown overlay */}
      {countdown !== null && (
        <div style={{
          zIndex: 10, textAlign: "center",
          fontFamily: "'Playfair Display', serif",
          fontSize: 100,
          color: "rgba(255,255,255,0.8)",
          animation: "countdown 1s ease",
        }}>
          {countdown}
        </div>
      )}

      {/* Active breathing UI */}
      {active && (
        <>
          {/* Phase instruction */}
          <div style={{
            zIndex: 3, textAlign: "center",
            pointerEvents: "none",
          }}>
            <div style={{
              fontFamily: "'Playfair Display', serif",
              fontStyle: "italic",
              fontSize: 32,
              color: phaseColorHex,
              textShadow: `0 0 30px ${phaseColorHex}66`,
              marginBottom: 8,
              transition: "color 1s, text-shadow 1s",
            }}>
              {phase.instruction}
            </div>

            {/* Progress arc */}
            <div style={{ position: "relative", width: 80, height: 80, margin: "0 auto 16px" }}>
              <svg width="80" height="80" viewBox="0 0 80 80">
                <circle cx="40" cy="40" r="34" fill="none"
                  stroke="rgba(255,255,255,0.06)" strokeWidth="3" />
                <circle cx="40" cy="40" r="34" fill="none"
                  stroke={phaseColorHex} strokeWidth="3"
                  strokeLinecap="round"
                  strokeDasharray={`${2 * Math.PI * 34}`}
                  strokeDashoffset={`${2 * Math.PI * 34 * (1 - progress)}`}
                  transform="rotate(-90 40 40)"
                  style={{ transition: "stroke 1s", filter: `drop-shadow(0 0 6px ${phaseColorHex})` }}
                />
                <text x="40" y="45" textAnchor="middle"
                  fill={phaseColorHex} fontSize="11"
                  fontFamily="'DM Mono', monospace">
                  {phase.name}
                </text>
              </svg>
            </div>

            <div style={{
              fontSize: 9, color: "rgba(255,255,255,0.25)",
              letterSpacing: 3,
            }}>
              CYCLE {cycleCount + 1}
            </div>
          </div>

          {/* Stop button */}
          <button
            onClick={stopSession}
            style={{
              position: "absolute", bottom: 32,
              padding: "10px 24px",
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 20,
              color: "rgba(255,255,255,0.4)",
              fontFamily: "'DM Mono', monospace",
              fontSize: 9, letterSpacing: 3,
              cursor: "pointer", zIndex: 3,
            }}
          >
            ■ END SESSION
          </button>
        </>
      )}

      {/* Cycle complete message */}
      {active && cycleCount > 0 && cycleCount % 3 === 0 && progress < 0.1 && (
        <div style={{
          position: "absolute", top: "50%", left: "50%",
          transform: "translate(-50%, -50%)",
          zIndex: 5, textAlign: "center",
          animation: "fadeIn 0.5s ease",
          background: "rgba(5,5,20,0.8)",
          padding: "16px 28px", borderRadius: 12,
          border: "1px solid rgba(74,222,128,0.2)",
          pointerEvents: "none",
        }}>
          <div style={{ color: "#4ade80", fontSize: 16, marginBottom: 4 }}>●</div>
          <div style={{ fontSize: 11, color: "#4ade80", letterSpacing: 2 }}>
            {cycleCount} CYCLES COMPLETE
          </div>
          <div style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", marginTop: 4 }}>
            Keep going...
          </div>
        </div>
      )}
    </div>
  );
}
