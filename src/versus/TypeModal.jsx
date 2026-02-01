// src/versus/TypeModal.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { TYPES, mult } from "./typechart";

/* ============================
   Scrollbars verstecken
============================ */
const HIDE_SCROLL_CSS = `
.tm-scroll { scrollbar-width: none; -ms-overflow-style: none; }
.tm-scroll::-webkit-scrollbar { width: 0px; height: 0px; }
`;

/* ============================
   Labels / UI helpers
============================ */
function typeLabelDe(t) {
  const map = {
    normal: "Normal",
    fire: "Feuer",
    water: "Wasser",
    electric: "Elektro",
    grass: "Pflanze",
    ice: "Eis",
    fighting: "Kampf",
    poison: "Gift",
    ground: "Boden",
    flying: "Flug",
    psychic: "Psycho",
    bug: "Käfer",
    rock: "Gestein",
    ghost: "Geist",
    dragon: "Drache",
    dark: "Unlicht",
    steel: "Stahl",
    fairy: "Fee",
  };
  return map[t] || t;
}

function typeColor(t) {
  const c = {
    normal: "#A8A77A",
    fire: "#EE8130",
    water: "#6390F0",
    electric: "#F7D02C",
    grass: "#7AC74C",
    ice: "#96D9D6",
    fighting: "#C22E28",
    poison: "#A33EA1",
    ground: "#E2BF65",
    flying: "#A98FF3",
    psychic: "#F95587",
    bug: "#A6B91A",
    rock: "#B6A136",
    ghost: "#735797",
    dragon: "#6F35FC",
    dark: "#705746",
    steel: "#B7B7CE",
    fairy: "#D685AD",
  };
  return c[t] || "#9CA3AF";
}

function pillStyle(type, opts = {}) {
  const { active = false, subtle = false } = opts;
  const col = typeColor(type);

  return {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: active ? "6px 12px" : "5px 11px",
    borderRadius: 999,
    fontSize: 14,              // 👈 Typnamen größer
    fontWeight: 950,
    cursor: "pointer",
    userSelect: "none",
    whiteSpace: "nowrap",

    border: active
      ? `2px solid ${col}`     // 👈 farbiger Ring
      : "1px solid rgba(255,255,255,0.18)",

    background: active
      ? `linear-gradient(135deg, ${col}55, rgba(255,255,255,0.12))`
      : subtle
      ? "rgba(255,255,255,0.04)"
      : "rgba(255,255,255,0.07)",

    boxShadow: active
      ? `0 0 18px ${col}AA, inset 0 0 0 2px rgba(255,255,255,0.18)` // 👈 Glow!
      : "none",

    color: "white",
    transform: active ? "translateY(-1px)" : "none",
    transition: "all 0.12s ease",
  };
}


function badgeDot(color) {
  return {
    width: 10,
    height: 10,
    borderRadius: 999,
    background: color,
    boxShadow: "0 0 10px rgba(0,0,0,0.45)",
  };
}

function cellBg(m) {
  if (m === 0) return "rgba(148,163,184,0.16)";
  if (m >= 4) return "rgba(239,68,68,0.44)";
  if (m >= 2) return "rgba(245,158,11,0.34)";
  if (m <= 0.25) return "rgba(34,197,94,0.30)";
  if (m <= 0.5) return "rgba(34,197,94,0.18)";
  return "rgba(255,255,255,0.06)";
}

function cellText(m) {
  if (m === 0) return "0";
  if (m === 0.25) return "¼";
  if (m === 0.5) return "½";
  if (m === 1) return "1";
  if (m === 2) return "2";
  if (m === 4) return "4";
  return String(m);
}

/* ============================
   Team parsing + analysis
============================ */
function getPokemonTypes(p) {
  const arr = p?.types || p?.type || p?.pokemonTypes || p?.data?.types || [];
  return Array.isArray(arr)
    ? arr.map((x) => String(x).toLowerCase()).filter(Boolean)
    : [String(arr).toLowerCase()].filter(Boolean);
}

function calcDefensiveWeaknesses(teamPokemons) {
  const mons = teamPokemons || [];
  const summary = TYPES.map((atk) => {
    let weak2 = 0;
    let weak4 = 0;
    let immune = 0;
    let resist = 0;

    for (const p of mons) {
      const ts = getPokemonTypes(p);
      if (!ts.length) continue;

      let m = 1;
      for (const def of ts) m *= mult(atk, def);

      if (m === 0) immune++;
      else if (m >= 4) weak4++;
      else if (m >= 2) weak2++;
      else if (m <= 0.5) resist++;
    }

    return { atk, weak2, weak4, immune, resist };
  });

  summary.sort((a, b) => (b.weak4 - a.weak4) || (b.weak2 - a.weak2));
  return summary;
}

function calcOffensiveGaps(teamPokemons) {
  const teamAttackTypes = new Set();
  for (const p of teamPokemons || []) for (const t of getPokemonTypes(p)) teamAttackTypes.add(t);

  const missing = TYPES.filter((def) => {
    for (const atk of teamAttackTypes) {
      if (mult(atk, def) > 1) return false;
    }
    return true;
  });

  return { teamAttackTypes: Array.from(teamAttackTypes), missing };
}

/* ============================
   Pretty cards
============================ */
function Card({ title, subtitle, children, accent = "rgba(255,255,255,0.08)" }) {
  return (
    <div
      style={{
        borderRadius: 16,
        border: "1px solid rgba(255,255,255,0.12)",
        background: `radial-gradient(circle at 20% 0%, ${accent} 0%, transparent 55%), rgba(255,255,255,0.05)`,
        padding: 14,
        boxShadow: "0 10px 26px rgba(0,0,0,0.25)",
      }}
    >
      <div style={{ fontSize: 14, fontWeight: 950 }}>{title}</div>
      {subtitle ? <div style={{ marginTop: 4, fontSize: 12, opacity: 0.78 }}>{subtitle}</div> : null}
      <div style={{ marginTop: 12 }}>{children}</div>
    </div>
  );
}

/* ============================
   Component
============================ */
export default function TypeModal({
  open,
  onClose,
  myTeamPokemons = [],
  title = "Typen & Team-Analyse",
}) {
  const [tab, setTab] = useState("table");

  // Auswahl (klick) + Hover (preview)
  const [selAtk, setSelAtk] = useState(null); // Zeile (Angriff)
  const [selDef, setSelDef] = useState(null); // Spalte (Verteidigung)
  const [hoverAtk, setHoverAtk] = useState(null);
  const [hoverDef, setHoverDef] = useState(null);

  // Fit / Zoom
  const wrapRef = useRef(null);
  const tableRef = useRef(null);
  const [fitMode, setFitMode] = useState(true); // Fit / 100%
  const [tableScale, setTableScale] = useState(1);

  const defensive = useMemo(() => calcDefensiveWeaknesses(myTeamPokemons), [myTeamPokemons]);
  const offensive = useMemo(() => calcOffensiveGaps(myTeamPokemons), [myTeamPokemons]);

  const activeAtk = selAtk || hoverAtk;
  const activeDef = selDef || hoverDef;

  function toggleAtk(t) {
    setSelAtk((prev) => (prev === t ? null : t));
  }
  function toggleDef(t) {
    setSelDef((prev) => (prev === t ? null : t));
  }
  function resetSelection() {
    setSelAtk(null);
    setSelDef(null);
  }

  // ===== Fit (korrekt, ohne Transform-Messbug)
  useEffect(() => {
    if (!open) return;
    if (tab !== "table") return;

    function recompute() {
      if (!fitMode) {
        setTableScale(1);
        return;
      }
      const wrap = wrapRef.current;
      const table = tableRef.current;
      if (!wrap || !table) return;

      const availW = wrap.clientWidth;
      const availH = wrap.clientHeight;

      // echte unskalierte Größe
      const w = table.scrollWidth;
      const h = table.scrollHeight;
      if (!w || !h) return;

      const sW = (availW - 10) / w;
      const sH = (availH - 10) / h;
      let s = Math.min(sW, sH, 1);

      s = Math.max(0.35, s);
      setTableScale(s);
    }

    const t1 = setTimeout(recompute, 0);
    const t2 = setTimeout(recompute, 60);
    window.addEventListener("resize", recompute);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      window.removeEventListener("resize", recompute);
    };
  }, [open, tab, fitMode]);

  // ✅ Hook muss IMMER laufen (auch wenn open=false) -> sonst Hook-Fehler
  const teamList = useMemo(() => {
    const mons = myTeamPokemons || [];
    return mons.map((p, idx) => {
      const name = p?.name || p?.displayName || p?.label || `Pokémon ${idx + 1}`;
      const ts = getPokemonTypes(p);
      return { name, types: ts };
    });
  }, [myTeamPokemons]);

  // Quick helpers: Analyse -> Tabelle
  function jumpToDefType(defType) {
    setSelDef(defType);
    setTab("table");
  }
  function jumpToAtkType(atkType) {
    setSelAtk(atkType);
    setTab("table");
  }

  // ✅ return null erst NACH allen Hooks
  if (!open) return null;

  return (
    <div
      style={overlay}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <style>{HIDE_SCROLL_CSS}</style>

      <div style={modal}>
        {/* Header */}
        <div style={header}>
          <div>
            <div style={{ fontSize: 20, fontWeight: 950 }}>{title}</div>
          </div>

          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {(selAtk || selDef) && (
              <button onClick={resetSelection} style={btnGhost} title="Auswahl zurücksetzen">
                Reset
              </button>
            )}

            {tab === "table" && (
              <button
                onClick={() => setFitMode((v) => !v)}
                style={{
                  ...btnGhost,
                  background: fitMode ? "rgba(99,102,241,0.18)" : "rgba(255,255,255,0.08)",
                  fontWeight: 950,
                }}
                title={fitMode ? "Skaliert so, dass alles sichtbar ist" : "Originalgröße"}
              >
                {fitMode ? "Fit" : "100%"}
              </button>
            )}

            <button onClick={onClose} style={btnClose} title="Schließen">
              ✕
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div style={tabRow}>
          <button
            onClick={() => setTab("table")}
            style={{
              ...tabBtn,
              background: tab === "table" ? "rgba(255,255,255,0.14)" : "rgba(255,255,255,0.06)",
            }}
          >
            Typentabelle
          </button>

          <button
            onClick={() => setTab("analysis")}
            style={{
              ...tabBtn,
              background: tab === "analysis" ? "rgba(255,255,255,0.14)" : "rgba(255,255,255,0.06)",
            }}
          >
            Analyse
          </button>
        </div>

        {/* Content */}
        {tab === "table" ? (
          <div style={{ display: "grid", gridTemplateRows: "1fr auto", gap: 10, minHeight: 0 }}>
            {/* Fit wrapper */}
            <div
              ref={wrapRef}
              className="tm-scroll"
              style={{
                overflow: fitMode ? "hidden" : "auto",
                minHeight: 0,
                borderRadius: 14,
                border: "1px solid rgba(255,255,255,0.10)",
                background: "rgba(0,0,0,0.14)",
                padding: 8,
                scrollBehavior: "smooth",
              }}
            >
              <div
                style={{
                  width: "100%",
                  height: "100%",
                  transform: `scale(${tableScale})`,
                  transformOrigin: "top left",
                }}
              >
                <table
                  ref={tableRef}
                  style={{
                    borderCollapse: "separate",
                    borderSpacing: 0,
                    width: "max-content",
                  }}
                >
                  <thead>
                    <tr>
                      <th style={stickyCorner} />
                      {TYPES.map((def) => {
                        const colActive = activeDef === def;
                        const colLocked = selDef === def;

                        return (
                          <th
                            key={def}
                            style={{
                              ...stickyTop,
                              background: colActive ? "rgba(99,102,241,0.14)" : "rgba(18,18,22,0.97)",
                            }}
                            onMouseEnter={() => setHoverDef(def)}
                            onMouseLeave={() => setHoverDef(null)}
                          >
                            <span
                              style={pillStyle(def, { active: colLocked || colActive })}
                              onClick={() => toggleDef(def)}
                              title="Spalte highlighten (Verteidigungstyp)"
                            >
                              <span style={badgeDot(typeColor(def))} />
                              {typeLabelDe(def)}
                            </span>
                          </th>
                        );
                      })}
                    </tr>
                  </thead>

                  <tbody>
                    {TYPES.map((atk) => {
                      const rowActive = activeAtk === atk;
                      const rowLocked = selAtk === atk;

                      return (
                        <tr
                          key={atk}
                          onMouseEnter={() => setHoverAtk(atk)}
                          onMouseLeave={() => setHoverAtk(null)}
                          style={{
                            background: rowActive ? "rgba(99,102,241,0.08)" : "transparent",
                          }}
                        >
                          <td
                            style={{
                              ...stickyLeft,
                              background: rowActive ? "rgba(99,102,241,0.12)" : "rgba(18,18,22,0.97)",
                            }}
                          >
                            <span
                              style={pillStyle(atk, { active: rowLocked || rowActive })}
                              onClick={() => toggleAtk(atk)}
                              title="Zeile highlighten (Angriffstyp)"
                            >
                              <span style={badgeDot(typeColor(atk))} />
                              {typeLabelDe(atk)}
                            </span>
                          </td>

                          {TYPES.map((def) => {
                            const m = mult(atk, def);

                            const isRow = activeAtk === atk;
                            const isCol = activeDef === def;
                            const isFocus = isRow || isCol;
                            const isCross = activeAtk === atk && activeDef === def;

                            return (
                              <td
                                key={def}
                                title={`${typeLabelDe(atk)} → ${typeLabelDe(def)} = ${m}×`}
                                style={{
                                  padding: 6,
                                  textAlign: "center",
                                  minWidth: 32,
                                  border: "1px solid rgba(255,255,255,0.08)",
                                  fontSize: 19,
                                  fontWeight: 900,
                                  fontVariantNumeric: "tabular-nums",
                                  background: isCross
  ? `linear-gradient(135deg, rgba(34,197,94,0.55), rgba(59,130,246,0.55))`  // Schnittpunkt
  : isFocus
  ? "rgba(255,255,255,0.18)"                                               // ganze Zeile/Spalte
  : cellBg(m),

                                  color: "rgba(255,255,255,0.92)",
                                  boxShadow: isCross
                                    ? "inset 0 0 0 2px rgba(255,255,255,0.65)"
                                    : isFocus
                                    ? "inset 0 0 0 1px rgba(255,255,255,0.28)"
                                    : "none",
                                  filter: isFocus ? "saturate(1.15)" : "none",
                                }}
                              >
                                {cellText(m)}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", fontSize: 20}}>
              <span>
                <b>Zeile</b> = Angriffstyp
              </span>
              <span>
                <b>Spalte</b> = Verteidigungstyp
              </span>
            </div>
          </div>
        ) : (
          <div className="tm-scroll" style={{ overflow: "auto", minHeight: 0, paddingRight: 6 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, alignItems: "start" }}>
              {/* TEAM */}
              <Card
                title="Dein Team (für Analyse)"
                accent="rgba(56,189,248,0.18)"
              >
                {teamList.length ? (
                  <div style={{ display: "grid", gap: 8 }}>
                    {teamList.map((m, idx) => (
                      <div
                        key={`team-${idx}`}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: 10,
                          padding: "10px 10px",
                          borderRadius: 12,
                          border: "1px solid rgba(255,255,255,0.10)",
                          background: "rgba(0,0,0,0.16)",
                        }}
                      >
                        <div style={{ fontWeight: 950 }}>{m.name}</div>
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
                          {m.types?.length ? (
                            m.types.map((t) => (
                              <span
                                key={`${idx}-${t}`}
                                style={pillStyle(t, { subtle: true })}
                                onClick={() => jumpToDefType(t)}
                                title="Zur Typentabelle springen (Spalte highlight)"
                              >
                                <span style={badgeDot(typeColor(t))} />
                                {typeLabelDe(t)}
                              </span>
                            ))
                          ) : (
                            <span style={{ opacity: 0.7, fontSize: 12 }}>—</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ opacity: 0.8, fontSize: 13 }}>Noch keine Pokémon im Team.</div>
                )}
              </Card>

              {/* OFFENSE */}
              <Card
                title="Offensiv (STAB-Coverage)"
                subtitle="Welche Verteidigungs-Typen triffst du mit keinem deiner Team-Typen super effektiv?"
                accent="rgba(34,197,94,0.20)"
              >
                <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 8, fontWeight: 950 }}>Deine Team-Typen</div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
                  {offensive.teamAttackTypes.length ? (
                    offensive.teamAttackTypes.map((t) => (
                      <span
                        key={t}
                        style={pillStyle(t)}
                        onClick={() => jumpToAtkType(t)}
                        title="Zur Typentabelle springen (Zeile highlight)"
                      >
                        <span style={badgeDot(typeColor(t))} />
                        {typeLabelDe(t)}
                      </span>
                    ))
                  ) : (
                    <span style={{ opacity: 0.8 }}>—</span>
                  )}
                </div>

                <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 8, fontWeight: 950 }}>Offensive Lücken</div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {offensive.missing.length ? (
                    offensive.missing.map((t) => (
                      <span
                        key={t}
                        style={pillStyle(t, { subtle: true })}
                        onClick={() => jumpToDefType(t)}
                        title="Zur Typentabelle springen (Spalte highlight)"
                      >
                        <span style={badgeDot(typeColor(t))} />
                        {typeLabelDe(t)}
                      </span>
                    ))
                  ) : (
                    <span style={{ opacity: 0.8 }}>Keine offensiven Lücken.</span>
                  )}
                </div>
              </Card>

              {/* DEFENSE */}
              <Card
                title="Defensiv (Team-Schwächen)"
                subtitle="Sortiert: wie viele deiner Pokémon werden sehr effektiv getroffen."
                accent="rgba(239,68,68,0.18)"
              >
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
                  {defensive.slice(0, 4).map((row) => (
                    <span
                      key={`top-${row.atk}`}
                      style={pillStyle(row.atk, { active: false })}
                      onClick={() => jumpToAtkType(row.atk)}
                      title="Zur Typentabelle springen (Angriffs-Zeile highlight)"
                    >
                      <span style={badgeDot(typeColor(row.atk))} />
                      {typeLabelDe(row.atk)}{" "}
                      <span style={{ opacity: 0.85, fontWeight: 950 }}>
                        {row.weak4 ? `4×:${row.weak4}` : `2×:${row.weak2}`}
                      </span>
                    </span>
                  ))}
                </div>

                <div style={{ overflowX: "auto" }} className="tm-scroll">
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr style={{ textAlign: "left", fontSize: 16, opacity: 0.85 }}>
                        <th style={{ padding: "6px 4px" }}>Angriffstyp</th>
                        <th style={{ padding: "6px 4px" }}>4×</th>
                        <th style={{ padding: "6px 4px" }}>2×</th>
                        <th style={{ padding: "6px 4px" }}>Resist</th>
                        <th style={{ padding: "6px 4px" }}>Immun</th>
                      </tr>
                    </thead>
                    <tbody>
                      {defensive.map((row) => (
                        <tr
                          key={row.atk}
                          style={{ borderTop: "1px solid rgba(255,255,255,0.08)", cursor: "pointer" }}
                          onClick={() => jumpToAtkType(row.atk)}
                          title="Klicken: zur Typentabelle springen (Angriffs-Zeile highlight)"
                        >
                          <td style={{ padding: "8px 4px" }}>
                            <span style={pillStyle(row.atk, { subtle: true })}>
                              <span style={badgeDot(typeColor(row.atk))} />
                              {typeLabelDe(row.atk)}
                            </span>
                          </td>
                          <td style={{ padding: "8px 4px", fontVariantNumeric: "tabular-nums", fontWeight: 950 }}>
                            {row.weak4}
                          </td>
                          <td style={{ padding: "8px 4px", fontVariantNumeric: "tabular-nums", fontWeight: 950 }}>
                            {row.weak2}
                          </td>
                          <td style={{ padding: "8px 4px", fontVariantNumeric: "tabular-nums" }}>{row.resist}</td>
                          <td style={{ padding: "8px 4px", fontVariantNumeric: "tabular-nums" }}>{row.immune}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>

            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ============================
   Styles
============================ */
const overlay = {
  position: "fixed",
  inset: 0,
  zIndex: 9999,
  background: "rgba(0,0,0,0.55)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 10,
};

const modal = {
  width: "min(1320px, 99vw)",
  height: "min(920px, 96vh)",
  maxHeight: "96vh",
  overflow: "hidden",
  borderRadius: 18,
  border: "1px solid rgba(255,255,255,0.14)",
  background: "rgba(18,18,22,0.97)",
  boxShadow: "0 18px 60px rgba(0,0,0,0.55)",
  padding: 14,
  display: "grid",
  gridTemplateRows: "auto auto 1fr",
  gap: 10,
};

const header = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 10,
};

const tabRow = {
  display: "flex",
  gap: 8,
  alignItems: "center",
  flexWrap: "wrap",
};

const tabBtn = {
  padding: "8px 12px",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.18)",
  color: "white",
  cursor: "pointer",
  fontWeight: 950,
  background: "rgba(255,255,255,0.06)",
};

const btnGhost = {
  padding: "8px 10px",
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.18)",
  background: "rgba(255,255,255,0.08)",
  color: "white",
  cursor: "pointer",
  fontWeight: 900,
};

const btnClose = {
  ...btnGhost,
  width: 40,
};

const stickyCorner = {
  position: "sticky",
  left: 0,
  top: 0,
  zIndex: 6,
  background: "rgba(18,18,22,0.97)",
  padding: 6,
  borderBottom: "1px solid rgba(255,255,255,0.10)",
  borderRight: "1px solid rgba(255,255,255,0.10)",
};

const stickyTop = {
  position: "sticky",
  top: 0,
  zIndex: 5,
  padding: 6,
  borderBottom: "1px solid rgba(255,255,255,0.10)",
};

const stickyLeft = {
  position: "sticky",
  left: 0,
  zIndex: 4,
  padding: 6,
  borderRight: "1px solid rgba(255,255,255,0.10)",
};
