import { useState, useEffect, useRef, useCallback } from "react";

// D3 loaded from CDN in index.html:
// <script src="https://cdnjs.cloudflare.com/ajax/libs/d3/7.8.5/d3.min.js"></script>

const SEVERITY_CONFIG = {
  0: { label: "Safe",      color: "#4ade80", glow: "#4ade8055", bg: "rgba(74,222,128,0.08)",  icon: "●" },
  1: { label: "Caution",   color: "#facc15", glow: "#facc1555", bg: "rgba(250,204,21,0.08)",  icon: "◉" },
  2: { label: "Dangerous", color: "#f87171", glow: "#f8717155", bg: "rgba(248,113,113,0.08)", icon: "⬟" },
};

const API = import.meta?.env?.VITE_API_URL || "http://localhost:8000";

// ── D3 Force Graph ─────────────────────────────────────────────────────────────
function DrugGraph({ graphData, onNodeClick, selectedDrug }) {
  const svgRef = useRef(null);
  const simRef = useRef(null);

  useEffect(() => {
    if (!graphData || !graphData.nodes.length || !window.d3) return;
    const d3 = window.d3;
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const W = svgRef.current.clientWidth  || 500;
    const H = svgRef.current.clientHeight || 400;

    const g = svg.append("g");

    // Zoom
    svg.call(d3.zoom()
      .scaleExtent([0.4, 3])
      .on("zoom", (e) => g.attr("transform", e.transform))
    );

    // Arrow markers for each severity
    const defs = svg.append("defs");
    Object.entries(SEVERITY_CONFIG).forEach(([sev, cfg]) => {
      defs.append("marker")
        .attr("id", `arrow-${sev}`)
        .attr("viewBox", "0 -4 10 8")
        .attr("refX", 18).attr("refY", 0)
        .attr("markerWidth", 6).attr("markerHeight", 6)
        .attr("orient", "auto")
        .append("path")
        .attr("d", "M0,-4L10,0L0,4")
        .attr("fill", cfg.color)
        .attr("opacity", 0.7);
    });

    // Deep copy for simulation
    const nodes = graphData.nodes.map(d => ({ ...d }));
    const links = graphData.links.map(d => ({ ...d }));

    // Force simulation
    simRef.current = d3.forceSimulation(nodes)
      .force("link", d3.forceLink(links)
        .id(d => d.id)
        .distance(d => 80 + d.severity * 30)
        .strength(0.6))
      .force("charge", d3.forceManyBody().strength(-250))
      .force("center", d3.forceCenter(W / 2, H / 2))
      .force("collision", d3.forceCollide(35));

    // Links
    const link = g.append("g").selectAll("line")
      .data(links).join("line")
      .attr("stroke", d => SEVERITY_CONFIG[d.severity]?.color || "#fff")
      .attr("stroke-width", d => d.width || 1.5)
      .attr("stroke-opacity", 0.6)
      .attr("marker-end", d => `url(#arrow-${d.severity})`)
      .style("filter", d => d.severity === 2 ? `drop-shadow(0 0 4px ${SEVERITY_CONFIG[2].color})` : "none");

    // Link hover area (wider for easier hover)
    const linkHover = g.append("g").selectAll("line")
      .data(links).join("line")
      .attr("stroke", "transparent")
      .attr("stroke-width", 12)
      .style("cursor", "pointer")
      .on("mouseenter", function(event, d) {
        tooltip.style("opacity", 1)
          .html(`
            <div style="font-size:10px;color:${SEVERITY_CONFIG[d.severity].color};letter-spacing:2px;margin-bottom:4px">
              ${SEVERITY_CONFIG[d.severity].icon} ${SEVERITY_CONFIG[d.severity].label.toUpperCase()}
            </div>
            <div style="font-size:11px;font-weight:600;margin-bottom:3px">${d.source?.toUpperCase()} ↔ ${d.target?.id?.toUpperCase() || d.target?.toUpperCase()}</div>
            <div style="font-size:10px;color:rgba(255,255,255,0.6);margin-bottom:4px">${d.mechanism}</div>
            <div style="font-size:10px;color:rgba(255,255,255,0.4);line-height:1.4">${d.effect}</div>
          `);
      })
      .on("mousemove", (event) => {
        tooltip
          .style("left", (event.offsetX + 14) + "px")
          .style("top",  (event.offsetY - 10) + "px");
      })
      .on("mouseleave", () => tooltip.style("opacity", 0));

    // Node groups
    const node = g.append("g").selectAll("g")
      .data(nodes).join("g")
      .style("cursor", "pointer")
      .call(d3.drag()
        .on("start", (e, d) => { if (!e.active) simRef.current.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y; })
        .on("drag",  (e, d) => { d.fx = e.x; d.fy = e.y; })
        .on("end",   (e, d) => { if (!e.active) simRef.current.alphaTarget(0); d.fx = null; d.fy = null; })
      )
      .on("click", (_, d) => onNodeClick?.(d.id));

    // Node glow ring (danger indicator)
    node.filter(d => d.severity === 2)
      .append("circle")
      .attr("r", d => (d.size || 20) + 4)
      .attr("fill", "none")
      .attr("stroke", SEVERITY_CONFIG[2].color)
      .attr("stroke-width", 1)
      .attr("opacity", 0.3)
      .style("animation", "pulse 2s ease-in-out infinite");

    // Node circles
    node.append("circle")
      .attr("r", d => d.size || 20)
      .attr("fill", d => {
        const cfg = SEVERITY_CONFIG[d.severity || 0];
        return cfg.bg;
      })
      .attr("stroke", d => SEVERITY_CONFIG[d.severity || 0].color)
      .attr("stroke-width", d => selectedDrug === d.id ? 2.5 : 1.5)
      .style("filter", d => `drop-shadow(0 0 ${4 + (d.severity || 0) * 4}px ${SEVERITY_CONFIG[d.severity || 0].glow})`);

    // Node labels
    node.append("text")
      .text(d => d.label)
      .attr("text-anchor", "middle")
      .attr("dy", "0.35em")
      .attr("fill", d => SEVERITY_CONFIG[d.severity || 0].color)
      .attr("font-size", "9px")
      .attr("font-family", "'DM Mono', monospace")
      .attr("font-weight", "500")
      .attr("pointer-events", "none");

    // Drug class badge
    node.append("text")
      .text(d => d.class?.replace("_", " ") || "")
      .attr("text-anchor", "middle")
      .attr("dy", "1.8em")
      .attr("fill", "rgba(255,255,255,0.25)")
      .attr("font-size", "7px")
      .attr("font-family", "'DM Mono', monospace")
      .attr("pointer-events", "none");

    // Tooltip
    const tooltip = d3.select(svgRef.current.parentElement)
      .select(".drug-tooltip");

    // Simulation tick
    simRef.current.on("tick", () => {
      link
        .attr("x1", d => d.source.x).attr("y1", d => d.source.y)
        .attr("x2", d => d.target.x).attr("y2", d => d.target.y);
      linkHover
        .attr("x1", d => d.source.x).attr("y1", d => d.source.y)
        .attr("x2", d => d.target.x).attr("y2", d => d.target.y);
      node.attr("transform", d => `translate(${d.x},${d.y})`);
    });

    return () => { simRef.current?.stop(); };
  }, [graphData, selectedDrug]);

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <svg ref={svgRef} width="100%" height="100%">
        <style>{`
          @keyframes pulse { 0%,100%{opacity:0.3} 50%{opacity:0.7} }
        `}</style>
      </svg>
      <div className="drug-tooltip" style={{
        position: "absolute", pointerEvents: "none",
        background: "rgba(8,8,20,0.95)",
        border: "1px solid rgba(255,255,255,0.1)",
        borderRadius: 8, padding: "10px 12px",
        maxWidth: 220, opacity: 0,
        transition: "opacity 0.15s",
        backdropFilter: "blur(12px)",
        fontFamily: "'DM Mono', monospace",
        zIndex: 10,
      }} />
    </div>
  );
}

// ── Interaction Card ───────────────────────────────────────────────────────────
function InteractionCard({ ia, index }) {
  const cfg = SEVERITY_CONFIG[ia.severity];
  return (
    <div style={{
      background: cfg.bg,
      border: `1px solid ${cfg.color}33`,
      borderLeft: `3px solid ${cfg.color}`,
      borderRadius: 8,
      padding: "10px 12px",
      marginBottom: 8,
      animation: `fadeSlide 0.3s ease ${index * 0.05}s both`,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: "#fff", letterSpacing: 0.5 }}>
          {ia.drug_a.toUpperCase()} + {ia.drug_b.toUpperCase()}
        </div>
        <div style={{
          fontSize: 8, letterSpacing: 2, padding: "2px 6px",
          background: `${cfg.color}22`, color: cfg.color,
          borderRadius: 3,
        }}>
          {cfg.icon} {cfg.label.toUpperCase()}
        </div>
      </div>
      <div style={{ fontSize: 9, color: cfg.color, marginBottom: 3, letterSpacing: 1 }}>
        {ia.mechanism}
      </div>
      <div style={{ fontSize: 10, color: "rgba(255,255,255,0.5)", lineHeight: 1.5 }}>
        {ia.effect}
      </div>
      {ia.source === "gnn" && (
        <div style={{ fontSize: 8, color: "rgba(255,255,255,0.25)", marginTop: 4, letterSpacing: 1 }}>
          ◈ GNN PREDICTION · {(ia.confidence * 100).toFixed(0)}% CONFIDENCE
        </div>
      )}
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────
export default function DrugInteractionGraph({ token }) {
  const [medications,    setMedications]    = useState([]);
  const [inputValue,     setInputValue]     = useState("");
  const [suggestions,    setSuggestions]    = useState([]);
  const [allDrugs,       setAllDrugs]       = useState([]);
  const [result,         setResult]         = useState(null);
  const [loading,        setLoading]        = useState(false);
  const [error,          setError]          = useState(null);
  const [selectedDrug,   setSelectedDrug]   = useState(null);
  const [showSuggestions,setShowSuggestions]= useState(false);

  // Load drug list for autocomplete
  useEffect(() => {
    fetch(`${API}/drugs/list`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(r => r.json())
      .then(d => setAllDrugs(d.drugs || []))
      .catch(() => {});
  }, [token]);

  // Autocomplete
  useEffect(() => {
    if (!inputValue.trim() || inputValue.length < 2) {
      setSuggestions([]);
      return;
    }
    const q = inputValue.toLowerCase();
    setSuggestions(allDrugs.filter(d => d.includes(q)).slice(0, 6));
  }, [inputValue, allDrugs]);

  const addMedication = useCallback((name) => {
    const n = name.trim().toLowerCase();
    if (!n || medications.includes(n) || medications.length >= 10) return;
    const updated = [...medications, n];
    setMedications(updated);
    setInputValue("");
    setSuggestions([]);
    setShowSuggestions(false);
    if (updated.length >= 2) checkInteractions(updated);
  }, [medications]);

  const removeMedication = useCallback((name) => {
    const updated = medications.filter(m => m !== name);
    setMedications(updated);
    if (updated.length >= 2) checkInteractions(updated);
    else setResult(null);
  }, [medications]);

  const checkInteractions = useCallback(async (meds) => {
    if (meds.length < 2) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API}/drugs/check`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ medications: meds }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setResult(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [token]);

  const highestSeverity = result?.highest_severity ?? -1;
  const highestCfg = highestSeverity >= 0 ? SEVERITY_CONFIG[highestSeverity] : null;

  return (
    <div style={{
      fontFamily: "'DM Mono', 'Courier New', monospace",
      background: "linear-gradient(160deg, #07070f 0%, #0c0c1a 60%, #070710 100%)",
      minHeight: "100vh",
      padding: "24px 20px",
      color: "#fff",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@300;400;500&family=Bebas+Neue&display=swap');
        @keyframes fadeSlide { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:none} }
        @keyframes shimmer { 0%{opacity:0.4} 50%{opacity:1} 100%{opacity:0.4} }
        .drug-tag:hover { opacity: 0.7; }
        .add-btn:hover { background: rgba(96,165,250,0.2) !important; }
        .suggestion-item:hover { background: rgba(255,255,255,0.08) !important; }
      `}</style>

      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{
          fontFamily: "'Bebas Neue', sans-serif",
          fontSize: 28,
          letterSpacing: 4,
          background: "linear-gradient(90deg, #f87171, #fb923c)",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
        }}>
          DRUG INTERACTION ENGINE
        </div>
        <div style={{ fontSize: 9, color: "rgba(255,255,255,0.25)", letterSpacing: 3, marginTop: 2 }}>
          GRAPHSAGE NEURAL NETWORK · {allDrugs.length} DRUGS · REAL-TIME ANALYSIS
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: 16, maxWidth: 960 }}>

        {/* LEFT PANEL */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

          {/* Drug input */}
          <div style={{
            background: "#0a0a16",
            border: "1px solid rgba(255,255,255,0.07)",
            borderRadius: 12,
            padding: 16,
          }}>
            <div style={{ fontSize: 8, letterSpacing: 3, color: "rgba(255,255,255,0.25)", marginBottom: 12 }}>
              ADD MEDICATIONS
            </div>

            {/* Input + suggestions */}
            <div style={{ position: "relative" }}>
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  value={inputValue}
                  onChange={e => { setInputValue(e.target.value); setShowSuggestions(true); }}
                  onKeyDown={e => { if (e.key === "Enter" && inputValue) addMedication(inputValue); }}
                  onFocus={() => setShowSuggestions(true)}
                  placeholder="Type drug name..."
                  style={{
                    flex: 1, background: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: 6, padding: "8px 10px",
                    color: "#fff", fontSize: 11,
                    fontFamily: "'DM Mono', monospace",
                    outline: "none",
                  }}
                />
                <button
                  className="add-btn"
                  onClick={() => inputValue && addMedication(inputValue)}
                  style={{
                    padding: "8px 12px",
                    background: "rgba(96,165,250,0.1)",
                    border: "1px solid rgba(96,165,250,0.2)",
                    borderRadius: 6, color: "#60a5fa",
                    fontSize: 14, cursor: "pointer",
                    transition: "background 0.2s",
                  }}
                >
                  +
                </button>
              </div>

              {/* Autocomplete dropdown */}
              {showSuggestions && suggestions.length > 0 && (
                <div style={{
                  position: "absolute", top: "100%", left: 0, right: 40,
                  background: "#0e0e20",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: "0 0 8px 8px",
                  zIndex: 20, marginTop: 2,
                  overflow: "hidden",
                }}>
                  {suggestions.map(s => (
                    <div
                      key={s}
                      className="suggestion-item"
                      onClick={() => addMedication(s)}
                      style={{
                        padding: "8px 12px", fontSize: 11,
                        color: "rgba(255,255,255,0.7)",
                        cursor: "pointer",
                        transition: "background 0.15s",
                        borderBottom: "1px solid rgba(255,255,255,0.04)",
                      }}
                    >
                      {s}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Medication tags */}
            <div style={{ marginTop: 12, display: "flex", flexWrap: "wrap", gap: 6 }}>
              {medications.map(med => {
                const drugSeverity = result?.graph_data?.nodes?.find(n => n.id === med)?.severity ?? 0;
                const cfg = SEVERITY_CONFIG[drugSeverity];
                return (
                  <div
                    key={med}
                    className="drug-tag"
                    onClick={() => removeMedication(med)}
                    title="Click to remove"
                    style={{
                      display: "flex", alignItems: "center", gap: 5,
                      padding: "4px 10px",
                      background: cfg.bg,
                      border: `1px solid ${cfg.color}44`,
                      borderRadius: 20,
                      fontSize: 10, color: cfg.color,
                      cursor: "pointer",
                      transition: "opacity 0.2s",
                    }}
                  >
                    <span>{cfg.icon}</span>
                    <span>{med}</span>
                    <span style={{ opacity: 0.5, fontSize: 9 }}>✕</span>
                  </div>
                );
              })}
              {medications.length === 0 && (
                <div style={{ fontSize: 9, color: "rgba(255,255,255,0.2)", letterSpacing: 1 }}>
                  ADD 2+ MEDICATIONS TO BEGIN
                </div>
              )}
            </div>
          </div>

          {/* Status summary */}
          {result && (
            <div style={{
              background: highestCfg ? highestCfg.bg : "rgba(255,255,255,0.03)",
              border: `1px solid ${highestCfg ? highestCfg.color + "44" : "rgba(255,255,255,0.07)"}`,
              borderRadius: 12,
              padding: 16,
              animation: "fadeSlide 0.3s ease",
            }}>
              <div style={{ fontSize: 8, letterSpacing: 3, color: "rgba(255,255,255,0.25)", marginBottom: 10 }}>
                ANALYSIS RESULT
              </div>
              <div style={{
                fontFamily: "'Bebas Neue', sans-serif",
                fontSize: 22,
                letterSpacing: 3,
                color: highestCfg?.color || "#4ade80",
                marginBottom: 8,
              }}>
                {highestCfg?.icon} {highestSeverity === -1 ? "NO DATA" :
                  highestSeverity === 0 ? "ALL CLEAR" :
                  highestSeverity === 1 ? "CAUTION" : "DANGEROUS"}
              </div>

              <div style={{ display: "flex", gap: 12 }}>
                {Object.entries(result.summary).map(([label, count]) => (
                  <div key={label} style={{ textAlign: "center" }}>
                    <div style={{
                      fontSize: 18, fontWeight: 700,
                      color: Object.values(SEVERITY_CONFIG).find(c => c.label.toLowerCase() === label)?.color || "#fff",
                    }}>{count}</div>
                    <div style={{ fontSize: 7, color: "rgba(255,255,255,0.3)", letterSpacing: 2 }}>
                      {label.toUpperCase()}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Interaction list */}
          {result?.interactions?.length > 0 && (
            <div style={{
              background: "#0a0a16",
              border: "1px solid rgba(255,255,255,0.07)",
              borderRadius: 12,
              padding: 16,
              maxHeight: 340,
              overflowY: "auto",
            }}>
              <div style={{ fontSize: 8, letterSpacing: 3, color: "rgba(255,255,255,0.25)", marginBottom: 12 }}>
                INTERACTIONS ({result.interactions.length})
              </div>
              {result.interactions.map((ia, i) => (
                <InteractionCard key={`${ia.drug_a}-${ia.drug_b}`} ia={ia} index={i} />
              ))}
            </div>
          )}

          {result?.interactions?.length === 0 && medications.length >= 2 && (
            <div style={{
              background: "rgba(74,222,128,0.05)",
              border: "1px solid rgba(74,222,128,0.15)",
              borderRadius: 12, padding: 16, textAlign: "center",
            }}>
              <div style={{ fontSize: 20, color: "#4ade80", marginBottom: 6 }}>●</div>
              <div style={{ fontSize: 11, color: "#4ade80", letterSpacing: 2 }}>NO INTERACTIONS FOUND</div>
              <div style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", marginTop: 4 }}>
                These medications appear safe to combine
              </div>
            </div>
          )}

          {loading && (
            <div style={{
              textAlign: "center", padding: 20,
              fontSize: 9, color: "rgba(255,255,255,0.4)",
              letterSpacing: 3, animation: "shimmer 1.2s ease infinite",
            }}>
              ANALYZING INTERACTIONS...
            </div>
          )}

          {error && (
            <div style={{
              background: "rgba(248,113,113,0.08)",
              border: "1px solid rgba(248,113,113,0.2)",
              borderRadius: 8, padding: 12,
              fontSize: 10, color: "#f87171",
            }}>
              {error}
            </div>
          )}
        </div>

        {/* RIGHT: D3 Graph */}
        <div style={{
          background: "#0a0a16",
          border: `1px solid ${highestCfg ? highestCfg.color + "22" : "rgba(255,255,255,0.07)"}`,
          borderRadius: 16,
          overflow: "hidden",
          position: "relative",
          minHeight: 480,
          transition: "border-color 0.5s",
          boxShadow: highestCfg && highestSeverity === 2
            ? `0 0 40px ${SEVERITY_CONFIG[2].glow}`
            : "none",
        }}>
          {/* Graph header */}
          <div style={{
            position: "absolute", top: 14, left: 16, right: 16,
            display: "flex", justifyContent: "space-between",
            zIndex: 5, pointerEvents: "none",
          }}>
            <div style={{ fontSize: 8, letterSpacing: 3, color: "rgba(255,255,255,0.2)" }}>
              INTERACTION GRAPH · DRAG TO EXPLORE
            </div>
            <div style={{ display: "flex", gap: 12 }}>
              {Object.entries(SEVERITY_CONFIG).map(([sev, cfg]) => (
                <div key={sev} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <div style={{ width: 6, height: 6, borderRadius: "50%", background: cfg.color }} />
                  <span style={{ fontSize: 8, color: "rgba(255,255,255,0.3)" }}>{cfg.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Empty state */}
          {(!result || !result.graph_data?.nodes?.length) && (
            <div style={{
              position: "absolute", inset: 0,
              display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center",
              gap: 10,
            }}>
              <div style={{ fontSize: 40, opacity: 0.08 }}>⬡</div>
              <div style={{ fontSize: 9, color: "rgba(255,255,255,0.15)", letterSpacing: 3 }}>
                ADD MEDICATIONS TO SEE INTERACTION GRAPH
              </div>
            </div>
          )}

          {result?.graph_data && (
            <DrugGraph
              graphData={result.graph_data}
              onNodeClick={setSelectedDrug}
              selectedDrug={selectedDrug}
            />
          )}
        </div>
      </div>

      {/* Selected drug info */}
      {selectedDrug && result && (
        <div style={{
          marginTop: 12,
          background: "#0a0a16",
          border: "1px solid rgba(255,255,255,0.07)",
          borderRadius: 10,
          padding: "10px 16px",
          maxWidth: 960,
          display: "flex", gap: 16, alignItems: "center",
          animation: "fadeSlide 0.2s ease",
        }}>
          <div style={{ fontSize: 8, letterSpacing: 3, color: "rgba(255,255,255,0.25)" }}>
            SELECTED:
          </div>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#fff" }}>
            {selectedDrug.toUpperCase()}
          </div>
          <div style={{ fontSize: 9, color: "rgba(255,255,255,0.4)" }}>
            Class: {result.graph_data.nodes.find(n => n.id === selectedDrug)?.class?.replace("_", " ") || "—"}
          </div>
          <button
            onClick={() => setSelectedDrug(null)}
            style={{
              marginLeft: "auto", background: "none",
              border: "none", color: "rgba(255,255,255,0.3)",
              cursor: "pointer", fontSize: 12,
            }}
          >✕</button>
        </div>
      )}
    </div>
  );
}
