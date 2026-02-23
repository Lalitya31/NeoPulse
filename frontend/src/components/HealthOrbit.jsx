import { useEffect, useRef, useState } from "react";

/*
  HealthOrbit.jsx
  ───────────────
  Three.js 3D solar system where each planet = a health domain.
  Planet size  = current health score
  Orbit speed  = activity level (faster = more active)
  Ring glow    = risk level (calm glow → red pulse if high risk)

  Domains:
    ◉ Mental   — journal sentiment, emotion score
    ◉ Physical — sleep, activity
    ◉ Meds     — adherence rate
    ◉ Social   — activity level, streaks
    ◉ Forecast — MindCast risk score (center sun intensity)

  CDN deps (add to index.html):
    <script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
*/

const DOMAINS = [
  {
    key: "mental",
    label: "Mental",
    color: 0xa78bfa,
    emissive: 0x6d28d9,
    orbitRadius: 120,
    orbitSpeed: 0.0008,
    size: 14,
    route: "/journal",
    description: "Mood · Emotions · Journaling",
  },
  {
    key: "physical",
    label: "Physical",
    color: 0x34d399,
    emissive: 0x065f46,
    orbitRadius: 190,
    orbitSpeed: 0.0005,
    size: 18,
    route: "/health",
    description: "Sleep · Activity · Body",
  },
  {
    key: "medication",
    label: "Meds",
    color: 0xfb923c,
    emissive: 0x9a3412,
    orbitRadius: 265,
    orbitSpeed: 0.00035,
    size: 13,
    route: "/medications",
    description: "Adherence · Interactions · Schedule",
  },
  {
    key: "social",
    label: "Social",
    color: 0x38bdf8,
    emissive: 0x0369a1,
    orbitRadius: 340,
    orbitSpeed: 0.00022,
    size: 16,
    route: "/social",
    description: "Streaks · Circle · Support",
  },
];

export default function HealthOrbit({ scores = {}, riskScore = 30, onNavigate }) {
  const mountRef   = useRef(null);
  const sceneRef   = useRef(null);
  const frameRef   = useRef(null);
  const planetsRef = useRef([]);
  const clockRef   = useRef(0);

  const [hovered,  setHovered]  = useState(null);
  const [selected, setSelected] = useState(null);
  const [loaded,   setLoaded]   = useState(false);

  // Normalize score 0-100 → size multiplier 0.6-1.4
  const scoreMult = (key) => {
    const s = scores[key] ?? 60;
    return 0.6 + (s / 100) * 0.8;
  };

  useEffect(() => {
    if (!window.THREE) {
      console.warn("Three.js not loaded — add CDN script to index.html");
      return;
    }
    const THREE = window.THREE;
    const W = mountRef.current.clientWidth;
    const H = mountRef.current.clientHeight;

    // ── Renderer ─────────────────────────────────────────────────────────────
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(W, H);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);
    mountRef.current.appendChild(renderer.domElement);

    // ── Scene & Camera ────────────────────────────────────────────────────────
    const scene  = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(55, W / H, 0.1, 2000);
    camera.position.set(0, 280, 520);
    camera.lookAt(0, 0, 0);
    sceneRef.current = scene;

    // ── Star field ────────────────────────────────────────────────────────────
    const starGeo = new THREE.BufferGeometry();
    const starVerts = [];
    for (let i = 0; i < 1800; i++) {
      starVerts.push(
        (Math.random() - 0.5) * 2400,
        (Math.random() - 0.5) * 2400,
        (Math.random() - 0.5) * 2400
      );
    }
    starGeo.setAttribute("position", new THREE.Float32BufferAttribute(starVerts, 3));
    scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({
      color: 0xffffff, size: 1.2, transparent: true, opacity: 0.55,
    })));

    // ── Central sun (MindCast risk) ───────────────────────────────────────────
    const riskIntensity = riskScore / 100;
    const sunColor = new THREE.Color().lerpColors(
      new THREE.Color(0x4ade80),
      new THREE.Color(0xf87171),
      riskIntensity
    );

    const sunMesh = new THREE.Mesh(
      new THREE.SphereGeometry(30, 32, 32),
      new THREE.MeshStandardMaterial({
        color: sunColor,
        emissive: sunColor,
        emissiveIntensity: 0.8,
        roughness: 0.3,
      })
    );
    scene.add(sunMesh);

    // Sun glow (corona)
    const coronaGeo = new THREE.SphereGeometry(38, 32, 32);
    const coronaMat = new THREE.MeshBasicMaterial({
      color: sunColor,
      transparent: true,
      opacity: 0.12,
      side: THREE.BackSide,
    });
    scene.add(new THREE.Mesh(coronaGeo, coronaMat));

    // Sun label
    const sunLight = new THREE.PointLight(sunColor, 2.5, 600);
    scene.add(sunLight);

    // Ambient
    scene.add(new THREE.AmbientLight(0x111122, 1.2));

    // ── Orbit rings ───────────────────────────────────────────────────────────
    DOMAINS.forEach(domain => {
      const pts = [];
      for (let i = 0; i <= 128; i++) {
        const a = (i / 128) * Math.PI * 2;
        pts.push(new THREE.Vector3(
          Math.cos(a) * domain.orbitRadius,
          0,
          Math.sin(a) * domain.orbitRadius
        ));
      }
      const orbitGeo = new THREE.BufferGeometry().setFromPoints(pts);
      const orbitMat = new THREE.LineBasicMaterial({
        color: domain.color,
        transparent: true,
        opacity: 0.12,
      });
      scene.add(new THREE.Line(orbitGeo, orbitMat));
    });

    // ── Planets ───────────────────────────────────────────────────────────────
    const planets = DOMAINS.map((domain, idx) => {
      const mult = scoreMult(domain.key);
      const radius = domain.size * mult;

      const geo = new THREE.SphereGeometry(radius, 24, 24);
      const mat = new THREE.MeshStandardMaterial({
        color:            domain.color,
        emissive:         domain.emissive,
        emissiveIntensity:0.4,
        roughness:        0.55,
        metalness:        0.2,
      });
      const mesh = new THREE.Mesh(geo, mat);

      // Point light on planet
      const pLight = new THREE.PointLight(domain.color, 0.6, 80);
      mesh.add(pLight);

      // Glow ring around planet
      const ringGeo = new THREE.RingGeometry(radius + 2, radius + 6, 32);
      const ringMat = new THREE.MeshBasicMaterial({
        color: domain.color,
        transparent: true,
        opacity: 0.25,
        side: THREE.DoubleSide,
      });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.rotation.x = Math.PI / 2;
      mesh.add(ring);

      scene.add(mesh);

      const angle = (idx / DOMAINS.length) * Math.PI * 2;

      return {
        mesh,
        ring,
        ringMat,
        mat,
        domain,
        angle,
        radius,
      };
    });
    planetsRef.current = planets;

    // ── Raycaster for click/hover ─────────────────────────────────────────────
    const raycaster = new THREE.Raycaster();
    const mouse     = new THREE.Vector2();

    const onMouseMove = (e) => {
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x =  ((e.clientX - rect.left) / rect.width)  * 2 - 1;
      mouse.y = -((e.clientY - rect.top)  / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const hits = raycaster.intersectObjects(planets.map(p => p.mesh));
      if (hits.length > 0) {
        const hit = planets.find(p => p.mesh === hits[0].object);
        setHovered(hit?.domain.key || null);
        renderer.domElement.style.cursor = "pointer";
      } else {
        setHovered(null);
        renderer.domElement.style.cursor = "default";
      }
    };

    const onClick = (e) => {
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x =  ((e.clientX - rect.left) / rect.width)  * 2 - 1;
      mouse.y = -((e.clientY - rect.top)  / rect.height) * 2 + 1;
      raycaster.setFromCamera(mouse, camera);
      const hits = raycaster.intersectObjects(planets.map(p => p.mesh));
      if (hits.length > 0) {
        const hit = planets.find(p => p.mesh === hits[0].object);
        if (hit) {
          setSelected(hit.domain.key);
          onNavigate?.(hit.domain.route);
        }
      }
    };

    renderer.domElement.addEventListener("mousemove", onMouseMove);
    renderer.domElement.addEventListener("click", onClick);

    // ── Camera auto-rotate ────────────────────────────────────────────────────
    let camAngle = 0;

    // ── Animation loop ────────────────────────────────────────────────────────
    const animate = () => {
      frameRef.current = requestAnimationFrame(animate);
      clockRef.current += 1;
      const t = clockRef.current;

      // Sun pulse
      const pulse = 0.8 + Math.sin(t * 0.04) * 0.2;
      sunMesh.material.emissiveIntensity = pulse;
      coronaMat.opacity = 0.08 + Math.sin(t * 0.04) * 0.06;

      // Planet orbits
      planets.forEach((p) => {
        p.angle += p.domain.orbitSpeed;
        p.mesh.position.x = Math.cos(p.angle) * p.domain.orbitRadius;
        p.mesh.position.z = Math.sin(p.angle) * p.domain.orbitRadius;
        p.mesh.position.y = Math.sin(p.angle * 2.1 + p.domain.orbitRadius) * 8;

        // Self-rotation
        p.mesh.rotation.y += 0.004;
        p.mesh.rotation.x += 0.001;

        // Hover glow
        const isHovered = hovered === p.domain.key;
        p.mat.emissiveIntensity = isHovered
          ? 0.8 + Math.sin(t * 0.1) * 0.2
          : 0.4;
        p.ringMat.opacity = isHovered ? 0.6 : 0.25;
      });

      // Slow camera orbit
      camAngle += 0.0004;
      camera.position.x = Math.sin(camAngle) * 520;
      camera.position.z = Math.cos(camAngle) * 520;
      camera.lookAt(0, 0, 0);

      renderer.render(scene, camera);
    };
    animate();
    setLoaded(true);

    // ── Resize ────────────────────────────────────────────────────────────────
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
      renderer.domElement.removeEventListener("mousemove", onMouseMove);
      renderer.domElement.removeEventListener("click", onClick);
      window.removeEventListener("resize", onResize);
      renderer.dispose();
      if (mountRef.current?.contains(renderer.domElement)) {
        mountRef.current.removeChild(renderer.domElement);
      }
    };
  }, [riskScore]);

  const hoveredDomain = DOMAINS.find(d => d.key === hovered);
  const riskColor  = riskScore > 65 ? "#f87171" : riskScore > 40 ? "#facc15" : "#4ade80";
  const riskLabel  = riskScore > 65 ? "HIGH RISK" : riskScore > 40 ? "MODERATE" : "STABLE";

  return (
    <div style={{
      position: "relative",
      width: "100%",
      height: "100vh",
      background: "radial-gradient(ellipse at center, #050510 0%, #020208 70%, #000 100%)",
      overflow: "hidden",
      fontFamily: "'Bebas Neue', 'DM Mono', monospace",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Mono:wght@300;400&display=swap');
        @keyframes fadeUp   { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:none} }
        @keyframes fadeDown { from{opacity:0;transform:translateY(-10px)} to{opacity:1;transform:none} }
        @keyframes blink    { 50%{opacity:0} }
        .orbit-btn:hover { background: rgba(255,255,255,0.1) !important; transform: translateY(-2px); }
        .planet-label { transition: opacity 0.3s; }
      `}</style>

      {/* Three.js canvas */}
      <div ref={mountRef} style={{ width: "100%", height: "100%" }} />

      {/* Header */}
      <div style={{
        position: "absolute", top: 32, left: 0, right: 0,
        textAlign: "center",
        animation: "fadeDown 1s ease 0.3s both",
        pointerEvents: "none",
      }}>
        <div style={{
          fontFamily: "'Bebas Neue', sans-serif",
          fontSize: 42,
          letterSpacing: 8,
          color: "#fff",
          textShadow: `0 0 40px ${riskColor}55`,
        }}>
          HEALTH ORBIT
        </div>
        <div style={{
          fontFamily: "'DM Mono', monospace",
          fontSize: 9,
          letterSpacing: 5,
          color: "rgba(255,255,255,0.3)",
          marginTop: 4,
        }}>
          YOUR HOLISTIC HEALTH UNIVERSE
        </div>
      </div>

      {/* Center risk score overlay */}
      <div style={{
        position: "absolute",
        top: "50%", left: "50%",
        transform: "translate(-50%, -50%)",
        textAlign: "center",
        pointerEvents: "none",
        animation: loaded ? "fadeUp 1s ease 0.8s both" : "none",
      }}>
        <div style={{
          fontFamily: "'Bebas Neue', sans-serif",
          fontSize: 52,
          color: riskColor,
          textShadow: `0 0 30px ${riskColor}`,
          lineHeight: 1,
        }}>
          {riskScore}
        </div>
        <div style={{
          fontFamily: "'DM Mono', monospace",
          fontSize: 8, letterSpacing: 4,
          color: riskColor, opacity: 0.8,
        }}>
          {riskLabel}
        </div>
        <div style={{
          fontFamily: "'DM Mono', monospace",
          fontSize: 7, letterSpacing: 3,
          color: "rgba(255,255,255,0.2)",
          marginTop: 4,
        }}>
          MINDCAST INDEX
        </div>
      </div>

      {/* Planet labels (positioned absolutely, synced to 2D projection) */}
      {DOMAINS.map((domain, i) => (
        <div key={domain.key} className="planet-label" style={{
          position: "absolute",
          bottom: 80 + i * 0,
          left: 0, right: 0,
          textAlign: "center",
          opacity: 0,   // hidden; use hover tooltip instead
          pointerEvents: "none",
        }} />
      ))}

      {/* Hover tooltip */}
      {hoveredDomain && (
        <div style={{
          position: "absolute",
          bottom: 120, left: "50%",
          transform: "translateX(-50%)",
          background: "rgba(5,5,20,0.9)",
          border: `1px solid rgba(${
            hoveredDomain.key === "mental"   ? "167,139,250" :
            hoveredDomain.key === "physical" ? "52,211,153"  :
            hoveredDomain.key === "medication"?"251,146,60"  : "56,189,248"
          },0.3)`,
          borderRadius: 10,
          padding: "10px 20px",
          textAlign: "center",
          backdropFilter: "blur(12px)",
          animation: "fadeUp 0.2s ease",
          pointerEvents: "none",
        }}>
          <div style={{
            fontFamily: "'Bebas Neue', sans-serif",
            fontSize: 18, letterSpacing: 3, color: "#fff",
          }}>
            {hoveredDomain.label.toUpperCase()}
          </div>
          <div style={{
            fontFamily: "'DM Mono', monospace",
            fontSize: 9, color: "rgba(255,255,255,0.4)",
            letterSpacing: 2, marginTop: 2,
          }}>
            {hoveredDomain.description}
          </div>
          <div style={{
            fontFamily: "'Bebas Neue', sans-serif",
            fontSize: 22,
            color: `#${hoveredDomain.color.toString(16).padStart(6, "0")}`,
            marginTop: 4,
          }}>
            {scores[hoveredDomain.key] ?? 60}
            <span style={{ fontSize: 10, opacity: 0.5 }}>/100</span>
          </div>
          <div style={{
            fontFamily: "'DM Mono', monospace",
            fontSize: 8, color: "rgba(255,255,255,0.25)",
            marginTop: 4, letterSpacing: 2,
          }}>
            CLICK TO EXPLORE →
          </div>
        </div>
      )}

      {/* Bottom nav: domain pills */}
      <div style={{
        position: "absolute", bottom: 32,
        left: "50%", transform: "translateX(-50%)",
        display: "flex", gap: 10,
        animation: "fadeUp 1s ease 1s both",
      }}>
        {DOMAINS.map(domain => {
          const hex = `#${domain.color.toString(16).padStart(6, "0")}`;
          return (
            <button
              key={domain.key}
              className="orbit-btn"
              onClick={() => onNavigate?.(domain.route)}
              style={{
                padding: "8px 16px",
                background: `rgba(${parseInt(hex.slice(1,3),16)},${parseInt(hex.slice(3,5),16)},${parseInt(hex.slice(5,7),16)},0.1)`,
                border: `1px solid ${hex}44`,
                borderRadius: 20,
                color: hex,
                fontFamily: "'DM Mono', monospace",
                fontSize: 9, letterSpacing: 2,
                cursor: "pointer",
                transition: "all 0.2s",
                textTransform: "uppercase",
              }}
            >
              {domain.label}
            </button>
          );
        })}
      </div>

      {/* Top-right: live status */}
      <div style={{
        position: "absolute", top: 32, right: 32,
        fontFamily: "'DM Mono', monospace",
        fontSize: 8, letterSpacing: 2,
        color: "rgba(255,255,255,0.2)",
        textAlign: "right",
        animation: "fadeDown 1s ease 0.5s both",
      }}>
        <div style={{ color: "#4ade80", marginBottom: 4 }}>
          ● LIVE<span style={{ animation: "blink 1s step-end infinite" }}>_</span>
        </div>
        {DOMAINS.map(d => (
          <div key={d.key} style={{ marginBottom: 2 }}>
            {d.label.toUpperCase()}: {scores[d.key] ?? 60}
          </div>
        ))}
      </div>
    </div>
  );
}
