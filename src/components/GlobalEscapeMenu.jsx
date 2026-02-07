// src/components/GlobalEscapeMenu.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { comboMatches, isTypingTarget, loadHotkeys } from "../utils/hotkeys";

/* =========================================================
   AUDIO (global)
========================================================= */
const AUDIO_KEYS = {
  muted: "app_audio_muted_v1",
  volume: "app_audio_volume_v1", // 0..1
};

function readAudioSettings() {
  const muted = localStorage.getItem(AUDIO_KEYS.muted) === "1";
  const vRaw = localStorage.getItem(AUDIO_KEYS.volume);
  const volume = vRaw == null ? 0.6 : Math.max(0, Math.min(1, Number(vRaw)));
  return { muted, volume };
}

function writeAudioSettings({ muted, volume }) {
  localStorage.setItem(AUDIO_KEYS.muted, muted ? "1" : "0");
  localStorage.setItem(AUDIO_KEYS.volume, String(volume));
}

function applyAudioToMediaEls({ muted, volume }) {
  try {
    document.querySelectorAll("audio,video").forEach((el) => {
      el.muted = !!muted;
      el.volume = Math.max(0, Math.min(1, Number(volume)));
    });
  } catch {
    // ignore
  }
}

function emitAudioChanged(next) {
  try {
    window.dispatchEvent(new CustomEvent("appAudioSettingsChanged", { detail: next }));
  } catch {
    // ignore
  }
}

/* =========================================================
   DRAFT CONTEXT (optional)
========================================================= */
function readDraftCtx() {
  try {
    return window.__ESC_DRAFT_CTX__ || null;
  } catch {
    return null;
  }
}

/* =========================================================
   TYPE CALCULATOR (self-contained)
   - Standard Gen 6+ Typechart (inkl. Fee)
========================================================= */
const TYPES = [
  "normal","fire","water","electric","grass","ice","fighting","poison","ground",
  "flying","psychic","bug","rock","ghost","dragon","dark","steel","fairy"
];

const TYPE_LABELS_DE = {
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

// Effectiveness map: attackType -> defenseType -> multiplier
const CHART = {
  normal:  { rock:0.5, ghost:0, steel:0.5 },
  fire:    { fire:0.5, water:0.5, grass:2, ice:2, bug:2, rock:0.5, dragon:0.5, steel:2 },
  water:   { fire:2, water:0.5, grass:0.5, ground:2, rock:2, dragon:0.5 },
  electric:{ water:2, electric:0.5, grass:0.5, ground:0, flying:2, dragon:0.5 },
  grass:   { fire:0.5, water:2, grass:0.5, poison:0.5, ground:2, flying:0.5, bug:0.5, rock:2, dragon:0.5, steel:0.5 },
  ice:     { fire:0.5, water:0.5, grass:2, ice:0.5, ground:2, flying:2, dragon:2, steel:0.5 },
  fighting:{ normal:2, ice:2, rock:2, dark:2, steel:2, poison:0.5, flying:0.5, psychic:0.5, bug:0.5, fairy:0.5, ghost:0 },
  poison:  { grass:2, fairy:2, poison:0.5, ground:0.5, rock:0.5, ghost:0.5, steel:0 },
  ground:  { fire:2, electric:2, grass:0.5, poison:2, flying:0, bug:0.5, rock:2, steel:2 },
  flying:  { electric:0.5, grass:2, fighting:2, bug:2, rock:0.5, steel:0.5 },
  psychic: { fighting:2, poison:2, psychic:0.5, dark:0, steel:0.5 },
  bug:     { fire:0.5, grass:2, fighting:0.5, poison:0.5, flying:0.5, psychic:2, ghost:0.5, dark:2, steel:0.5, fairy:0.5 },
  rock:    { fire:2, ice:2, flying:2, bug:2, fighting:0.5, ground:0.5, steel:0.5 },
  ghost:   { normal:0, psychic:2, ghost:2, dark:0.5 },
  dragon:  { dragon:2, steel:0.5, fairy:0 },
  dark:    { psychic:2, ghost:2, fighting:0.5, dark:0.5, fairy:0.5 },
  steel:   { ice:2, rock:2, fairy:2, fire:0.5, water:0.5, electric:0.5, steel:0.5 },
  fairy:   { fighting:2, dragon:2, dark:2, fire:0.5, poison:0.5, steel:0.5 },
};

function mult(att, def) {
  const a = String(att || "").toLowerCase();
  const d = String(def || "").toLowerCase();
  const row = CHART[a] || {};
  return row[d] ?? 1;
}

function typeIconUrl(typeKey) {
  const t = String(typeKey || "").toLowerCase();
  return `https://raw.githubusercontent.com/partywhale/pokemon-type-icons/master/icons/${t}.svg`;
}

function fmtMult(x) {
  if (x === 0) return "0×";
  if (x === 0.25) return "¼×";
  if (x === 0.5) return "½×";
  if (x === 1) return "1×";
  if (x === 2) return "2×";
  if (x === 4) return "4×";
  return `${x}×`;
}

/* Scrollbar hide helper (scrollbar bleibt nutzbar) */
const HIDE_SCROLL_CSS = `
.tm-scroll { scrollbar-width: none; -ms-overflow-style: none; }
.tm-scroll::-webkit-scrollbar { width: 0px; height: 0px; }

@keyframes tmPulse {
  0% {
    box-shadow:
      inset 0 0 0 2px rgba(255,255,255,0.35),
      0 0 0 1px rgba(161,76,255,0.35),
      0 0 18px rgba(161,76,255,0.35),
      0 0 28px rgba(0,242,254,0.18);
  }
  50% {
    box-shadow:
      inset 0 0 0 2px rgba(255,255,255,0.55),
      0 0 0 1px rgba(161,76,255,0.55),
      0 0 26px rgba(161,76,255,0.55),
      0 0 40px rgba(0,242,254,0.28);
  }
  100% {
    box-shadow:
      inset 0 0 0 2px rgba(255,255,255,0.35),
      0 0 0 1px rgba(161,76,255,0.35),
      0 0 18px rgba(161,76,255,0.35),
      0 0 28px rgba(0,242,254,0.18);
  }
}
`;


export default function GlobalEscapeMenu() {
  const nav = useNavigate();
  const location = useLocation();

  const [open, setOpen] = useState(false);
  const [audio, setAudio] = useState(() => readAudioSettings());
  const [draftCtx, setDraftCtx] = useState(() => readDraftCtx());

  const [dexOpen, setDexOpen] = useState(false);

  // Types calculator
  const [typeOpen, setTypeOpen] = useState(false);
  const [typeMode, setTypeMode] = useState("def"); // "def" | "atk" | "table"
  const [defTypes, setDefTypes] = useState([]);    // up to 2
  const [atkTypes, setAtkTypes] = useState([]);    // multiple

  // Table zoom + highlight (row/col)
  const [tableZoomOpen, setTableZoomOpen] = useState(false);
  const [tableSelAtk, setTableSelAtk] = useState(null); // row (atk)
  const [tableSelDef, setTableSelDef] = useState(null); // col (def)

  const isPokedex = location.pathname === "/pokedex";
  const isMoveDex = location.pathname === "/movedex" || location.pathname.startsWith("/move/");
  const isControls = location.pathname.startsWith("/controls");

  function smartBack() {
    if (window.history.length > 1) nav(-1);
    else nav("/");
  }

  const lobbyPath = useMemo(() => {
    if (location.pathname.startsWith("/duo")) return "/duo";
    if (location.pathname.startsWith("/versus")) return "/versus";
    return "/duo";
  }, [location.pathname]);

  // Audio beim Mount anwenden + Listener
  useEffect(() => {
    applyAudioToMediaEls(audio);
    window.__APP_AUDIO__ = audio;

    function onAudioChanged(e) {
      const next = e?.detail;
      if (!next) return;
      setAudio(next);
      applyAudioToMediaEls(next);
      window.__APP_AUDIO__ = next;
    }

    window.addEventListener("appAudioSettingsChanged", onAudioChanged);

    function onDraftCtxChanged() {
      setDraftCtx(readDraftCtx());
    }
    window.addEventListener("escDraftCtxChanged", onDraftCtxChanged);

    return () => {
      window.removeEventListener("appAudioSettingsChanged", onAudioChanged);
      window.removeEventListener("escDraftCtxChanged", onDraftCtxChanged);
    };
  }, []);

  // ESC / global hotkeys (ohne Menü offen)
  useEffect(() => {
    function onGlobalHotkeys(e) {
      if (open) return;
      if (isControls) return;
      if (isTypingTarget(document.activeElement)) return;

      const hk = loadHotkeys();
      const g = hk?.general || {};

      if (g.goHome && comboMatches(e, g.goHome)) {
        e.preventDefault();
        nav("/");
        return;
      }
      if (g.goLobby && comboMatches(e, g.goLobby)) {
        e.preventDefault();
        nav(lobbyPath);
        return;
      }
      if (g.goBack && comboMatches(e, g.goBack)) {
        e.preventDefault();
        smartBack();
        return;
      }
      if (g.openPokedex && comboMatches(e, g.openPokedex)) {
        e.preventDefault();
        if (isPokedex) smartBack();
        else nav("/pokedex");
        return;
      }
      if (g.openMoveDex && comboMatches(e, g.openMoveDex)) {
        e.preventDefault();
        if (isMoveDex) smartBack();
        else nav("/movedex");
        return;
      }
      if (g.toggleMute && comboMatches(e, g.toggleMute)) {
        e.preventDefault();
        setMuted(!(audio?.muted));
        return;
      }
    }

    window.addEventListener("keydown", onGlobalHotkeys);
    return () => window.removeEventListener("keydown", onGlobalHotkeys);
  }, [open, isControls, nav, audio, lobbyPath, isPokedex, isMoveDex]);

  // ESC Handler (Menü togglen / Overlay-Pages schließen)
  useEffect(() => {
    function onKeyDown(e) {
      if (e.key !== "Escape") return;

      // wenn große Typentabelle offen: ESC schließt erst diese
      if (open && tableZoomOpen) {
        e.preventDefault();
        setTableZoomOpen(false);
        return;
      }

      if (isPokedex || isMoveDex) {
        if (window.history.length > 1) nav(-1);
        else nav("/");
        return;
      }

      setOpen((v) => !v);
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isPokedex, isMoveDex, nav, open, tableZoomOpen]);

  const volumePct = Math.round((audio.volume ?? 0) * 100);

  const setMuted = (muted) => {
    const next = { ...audio, muted: !!muted };
    setAudio(next);
    writeAudioSettings(next);
    applyAudioToMediaEls(next);
    window.__APP_AUDIO__ = next;
    emitAudioChanged(next);
  };

  const setVolumePct = (pct) => {
    const v = Math.max(0, Math.min(100, Number(pct))) / 100;
    const next = { ...audio, volume: v };
    setAudio(next);
    writeAudioSettings(next);
    applyAudioToMediaEls(next);
    window.__APP_AUDIO__ = next;
    emitAudioChanged(next);
  };

  const inDraft = !!draftCtx?.inDraft;
  const canRestart = !!draftCtx?.canRestart;
  const restartFn = draftCtx?.restart;
  const leaveTo = draftCtx?.leaveTo || lobbyPath;

  // ===== Type calculator logic =====
  function toggleDef(t) {
    setDefTypes((prev) => {
      const has = prev.includes(t);
      if (has) return prev.filter((x) => x !== t);
      if (prev.length >= 2) return [prev[1], t]; // keep last 1, add new
      return [...prev, t];
    });
  }

  function toggleAtk(t) {
    setAtkTypes((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));
  }

  const defBuckets = useMemo(() => {
    if (!defTypes.length) return null;

    const out = { "4x": [], "2x": [], "1x": [], "0.5x": [], "0.25x": [], "0x": [] };

    for (const a of TYPES) {
      let m = 1;
      for (const d of defTypes) m *= mult(a, d);

      if (m === 0) out["0x"].push(a);
      else if (m === 0.25) out["0.25x"].push(a);
      else if (m === 0.5) out["0.5x"].push(a);
      else if (m === 1) out["1x"].push(a);
      else if (m === 2) out["2x"].push(a);
      else if (m === 4) out["4x"].push(a);
      else {
        out[`${m}x`] = (out[`${m}x`] || []).concat([a]);
      }
    }

    return out;
  }, [defTypes]);

  const atkCoverage = useMemo(() => {
    const picked = atkTypes;
    if (!picked.length) return null;

    const out = { super: [], neutral: [], resist: [], immune: [] };

    for (const d of TYPES) {
      let best = 0;
      for (const a of picked) best = Math.max(best, mult(a, d));

      if (best === 0) out.immune.push(d);
      else if (best >= 2) out.super.push(d);
      else if (best === 1) out.neutral.push(d);
      else out.resist.push(d);
    }

    return out;
  }, [atkTypes]);

  function TypePill({ t, active, onClick }) {
    return (
      <button
        onClick={onClick}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "8px 10px",
          borderRadius: 12,
          border: active
            ? "1px solid rgba(255,255,255,0.32)"
            : "1px solid rgba(255,255,255,0.14)",
          background: active
            ? "linear-gradient(135deg, rgba(161,76,255,0.35), rgba(255,76,160,0.22))"
            : "rgba(255,255,255,0.06)",
          boxShadow: active ? "0 0 0 2px rgba(161,76,255,0.18)" : "none",
          color: "white",
          cursor: "pointer",
          fontWeight: 900,
          transform: active ? "scale(1.02)" : "scale(1.0)",
          transition: "120ms ease",
        }}
        title={TYPE_LABELS_DE[t] || t}
      >
        <img
          src={typeIconUrl(t)}
          alt={t}
          style={{
            width: 22,
            height: 22,
            borderRadius: 8,
            padding: 3,
            background: "rgba(0,0,0,0.45)",
            border: "1px solid rgba(255,255,255,0.14)",
          }}
          onError={(e) => {
            e.currentTarget.style.display = "none";
          }}
        />
        <span style={{ fontSize: 12, opacity: 0.95 }}>{TYPE_LABELS_DE[t] || t}</span>
      </button>
    );
  }

  function Bucket({ title, items }) {
    if (!items || items.length === 0) return null;
    return (
      <div style={{ display: "grid", gap: 8 }}>
        <div style={{ fontWeight: 950, opacity: 0.9 }}>{title}</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {items.map((t) => (
            <div
              key={t}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "7px 10px",
                borderRadius: 12,
                border: "1px solid rgba(255,255,255,0.14)",
                background: "rgba(255,255,255,0.06)",
                fontWeight: 900,
              }}
              title={TYPE_LABELS_DE[t] || t}
            >
              <img
                src={typeIconUrl(t)}
                alt={t}
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: 8,
                  padding: 3,
                  background: "rgba(0,0,0,0.45)",
                  border: "1px solid rgba(255,255,255,0.14)",
                }}
                onError={(e) => {
                  e.currentTarget.style.display = "none";
                }}
              />
              <span style={{ fontSize: 12 }}>{TYPE_LABELS_DE[t] || t}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  function openBigTable() {
    setTableZoomOpen(true);
    // optional: wenn noch nichts gewählt ist, lassen wir null
  }

  function cellStyle({ a, d }) {
    const rowOn = tableSelAtk && tableSelAtk === a;
    const colOn = tableSelDef && tableSelDef === d;
    const both = rowOn && colOn;

    const base = { ...td };

    if (both) {
  return {
    ...base,
    background:
      "radial-gradient(circle at 30% 25%, rgba(255,255,255,0.18), transparent 55%)," +
      "linear-gradient(135deg, rgba(161,76,255,0.55), rgba(0,242,254,0.28))",
    borderBottom: "1px solid rgba(255,255,255,0.18)",
    boxShadow:
      "inset 0 0 0 2px rgba(255,255,255,0.42)," +
      "0 0 0 1px rgba(161,76,255,0.45)," +
      "0 0 22px rgba(161,76,255,0.45)," +
      "0 0 36px rgba(0,242,254,0.22)",
    fontWeight: 950,
    textShadow: "0 0 10px rgba(255,255,255,0.22)",
    animation: "tmPulse 1.4s ease-in-out infinite",
  };
}


    if (rowOn || colOn) {
      return {
        ...base,
        background: "rgba(117, 117, 117, 0.34)",
        borderBottom: "1px solid rgba(255,255,255,0.12)",
      };
    }

    return base;
  }

  function headStyleActive(isActive, baseStyle) {
    if (!isActive) return baseStyle;
    return {
      ...baseStyle,
      background: "rgba(65, 84, 255, 0.22)",
      boxShadow: "inset 0 0 0 2px rgba(255,255,255,0.18)",
    };
  }

  if (!open) return null;

  return (
    <div
      style={overlay}
      onClick={() => {
        setOpen(false);
        setDexOpen(false);
        setTypeOpen(false);
        setTableZoomOpen(false);
      }}
    >
      <style>{HIDE_SCROLL_CSS}</style>

      <div style={panel} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
          <div style={{ fontSize: 18, fontWeight: 950, letterSpacing: 0.2 }}>Pause-Menü</div>
          <button
            style={btnIcon}
            onClick={() => {
              setOpen(false);
              setDexOpen(false);
              setTypeOpen(false);
              setTableZoomOpen(false);
            }}
            title="Schließen (ESC)"
          >
            ✕
          </button>
        </div>

        {/* Main actions */}
        <div style={{ display: "grid", gap: 10 }}>
          <button
            style={btnBlue}
            onClick={() => {
              setOpen(false);
              nav("/");
            }}
          >
            Startbildschirm
          </button>

          <button
            style={btnGreen}
            onClick={() => {
              setOpen(false);
              nav(lobbyPath);
            }}
          >
            Zur Lobby
          </button>

          <button style={btnPurple} onClick={() => setDexOpen((v) => !v)}>
            Dex
          </button>

          {dexOpen && (
            <div style={{ display: "grid", gap: 8, paddingLeft: 10 }}>
              <button
                style={btnGhost}
                onClick={() => {
                  setOpen(false);
                  setDexOpen(false);
                  setTypeOpen(false);
                  setTableZoomOpen(false);
                  nav("/pokedex");
                }}
              >
                Pokédex
              </button>

              <button
                style={btnGhost}
                onClick={() => {
                  setOpen(false);
                  setDexOpen(false);
                  setTypeOpen(false);
                  setTableZoomOpen(false);
                  nav("/movedex");
                }}
              >
                MoveDex
              </button>
            </div>
          )}

          {/* Type calculator */}
          <button
            style={btnBlue}
            onClick={() => {
              setTypeOpen((v) => !v);
              setDexOpen(false);
            }}
          >
            Typenrechner
          </button>

          {typeOpen && (
            <div style={{ ...subPanel }}>
              {/* Mode buttons */}
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button
                  style={typeMode === "def" ? btnTabActive : btnTab}
                  onClick={() => setTypeMode("def")}
                >
                  Verteidigung
                </button>
                <button
                  style={typeMode === "atk" ? btnTabActive : btnTab}
                  onClick={() => setTypeMode("atk")}
                >
                  Angriff
                </button>
                <button
                  style={typeMode === "table" ? btnTabActive : btnTab}
                  onClick={() => setTypeMode("table")}
                  title="Normale Typentabelle"
                >
                  Typentabelle
                </button>

                <button
                  style={btnTab}
                  onClick={() => {
                    setDefTypes([]);
                    setAtkTypes([]);
                    setTableSelAtk(null);
                    setTableSelDef(null);
                  }}
                  title="Reset"
                >
                  Reset
                </button>
              </div>

              {/* DEF MODE */}
              {typeMode === "def" && (
                <div style={{ display: "grid", gap: 10 }}>
                  <div style={{ fontWeight: 950, opacity: 0.9 }}>
                    Verteidigungstypen wählen (1–2)
                  </div>

                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {TYPES.map((t) => (
                      <TypePill
                        key={t}
                        t={t}
                        active={defTypes.includes(t)}
                        onClick={() => toggleDef(t)}
                      />
                    ))}
                  </div>

                  {defTypes.length > 0 ? (
                    <div style={{ display: "grid", gap: 12 }}>
                      <div style={{ opacity: 0.85, fontWeight: 900 }}>
                        Def: {defTypes.map((t) => TYPE_LABELS_DE[t]).join(" / ")}
                      </div>

                      <Bucket title="4× Schwäche" items={defBuckets?.["4x"]} />
                      <Bucket title="2× Schwäche" items={defBuckets?.["2x"]} />
                      <Bucket title="½× Resist" items={defBuckets?.["0.5x"]} />
                      <Bucket title="¼× Resist" items={defBuckets?.["0.25x"]} />
                      <Bucket title="Immun (0×)" items={defBuckets?.["0x"]} />
                    </div>
                  ) : (
                    <div style={{ opacity: 0.75 }}>
                      Wähle mindestens 1 Verteidigungstyp.
                    </div>
                  )}
                </div>
              )}

              {/* ATK MODE */}
              {typeMode === "atk" && (
                <div style={{ display: "grid", gap: 10 }}>
                  <div style={{ fontWeight: 950, opacity: 0.9 }}>
                    Angriffstypen wählen (mehrere möglich)
                  </div>

                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {TYPES.map((t) => (
                      <TypePill
                        key={t}
                        t={t}
                        active={atkTypes.includes(t)}
                        onClick={() => toggleAtk(t)}
                      />
                    ))}
                  </div>

                  {atkTypes.length > 0 ? (
                    <div style={{ display: "grid", gap: 12 }}>
                      <div style={{ opacity: 0.85, fontWeight: 900 }}>
                        Atk: {atkTypes.map((t) => TYPE_LABELS_DE[t]).join(", ")}
                      </div>

                      <Bucket title="Coverage: Super effektiv (≥2×)" items={atkCoverage?.super} />
                      <Bucket title="Neutral (1×)" items={atkCoverage?.neutral} />
                      <Bucket title="Nicht sehr effektiv (½×/¼×)" items={atkCoverage?.resist} />
                      <Bucket title="Keine Wirkung (0×)" items={atkCoverage?.immune} />

                      <div style={{ opacity: 0.8, fontSize: 12 }}>
                        Tipp: Wenn du sehen willst „wo du nichts hast“, schau auf Neutral/Resist/Immune.
                      </div>
                    </div>
                  ) : (
                    <div style={{ opacity: 0.75 }}>
                      Wähle mindestens 1 Angriffstyp.
                    </div>
                  )}
                </div>
              )}

              {/* TABLE MODE */}
              {typeMode === "table" && (
                <div style={{ display: "grid", gap: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
                    <div style={{ fontWeight: 950, opacity: 0.9 }}>Typentabelle</div>

                    <button
                      style={btnTab}
                      onClick={() => openBigTable()}
                      title="Groß öffnen"
                    >
                      Groß öffnen
                    </button>
                  </div>

                  {/* small table (click to enlarge) */}
                  <div
                    className="tm-scroll"
                    style={{
                      overflow: "auto",
                      maxHeight: 360,
                      borderRadius: 14,
                      border: "1px solid rgba(255,255,255,0.12)",
                      cursor: "zoom-in",
                    }}
                    onClick={() => openBigTable()}
                    title="Klicken zum Vergrößern"
                  >
                    <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 720 }}>
                      <thead>
                        <tr>
                          <th style={th}>Atk \\ Def</th>
                          {TYPES.map((d) => (
                            <th key={d} style={th} title={TYPE_LABELS_DE[d]}>
                              {TYPE_LABELS_DE[d]}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {TYPES.map((a) => (
                          <tr key={a}>
                            <td style={rowHead} title={TYPE_LABELS_DE[a]}>
                              {TYPE_LABELS_DE[a]}
                            </td>
                            {TYPES.map((d) => {
                              const m = mult(a, d);
                              return (
                                <td
                                  key={d}
                                  style={td}
                                  title={`${TYPE_LABELS_DE[a]} vs ${TYPE_LABELS_DE[d]} = ${fmtMult(m)}`}
                                >
                                  {fmtMult(m)}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          <button
            style={btnBlue}
            onClick={() => {
              setOpen(false);
              setDexOpen(false);
              setTypeOpen(false);
              setTableZoomOpen(false);
              nav("/controls");
            }}
          >
            Steuerung
          </button>

          <button
            style={btnGhost}
            onClick={() => {
              setOpen(false);
              setDexOpen(false);
              setTypeOpen(false);
              setTableZoomOpen(false);
              smartBack();
            }}
          >
            Zurück
          </button>
        </div>

        {/* Audio */}
        <div style={section}>
          <div style={sectionTitle}>Audio</div>

          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <button
              style={audio.muted ? btnMuted : btnOrange}
              onClick={() => setMuted(!audio.muted)}
              title="Stumm / Ton an"
            >
              {audio.muted ? "Stumm" : "Ton an"}
            </button>

            <div style={{ flex: 1, minWidth: 200 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, opacity: 0.85 }}>
                <span>Lautstärke</span>
                <span>{volumePct}%</span>
              </div>

              <input
                type="range"
                min="0"
                max="100"
                value={volumePct}
                onChange={(e) => setVolumePct(e.target.value)}
                style={{ width: "100%" }}
              />
            </div>
          </div>
        </div>

        {/* Draft-only section */}
        {inDraft && (
          <div style={section}>
            <div style={sectionTitle}>Draft</div>

            <button
              style={btnRed}
              onClick={() => {
                setOpen(false);
                nav(leaveTo);
              }}
            >
              Draft verlassen
            </button>

            {canRestart && (
              <button
                style={btnDanger}
                onClick={() => {
                  setOpen(false);
                  if (typeof restartFn === "function") restartFn();
                }}
                title="Nur Admin/Host"
              >
                Draft neu starten (Admin)
              </button>
            )}
          </div>
        )}
      </div>

      {/* ===== BIG TABLE OVERLAY ===== */}
      {tableZoomOpen && (
        <div
          style={bigOverlay}
          onClick={() => setTableZoomOpen(false)}
        >
          <div
            style={bigPanel}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
              <div style={{ fontSize: 16, fontWeight: 950, opacity: 0.95 }}>
                Typentabelle (groß) — Zeile/Spalte anklicken zum Markieren
              </div>

              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <button
                  style={btnTab}
                  onClick={() => {
                    setTableSelAtk(null);
                    setTableSelDef(null);
                  }}
                  title="Markierung zurücksetzen"
                >
                  Markierung reset
                </button>
                <button
                  style={btnIcon}
                  onClick={() => setTableZoomOpen(false)}
                  title="Schließen (ESC)"
                >
                  ✕
                </button>
              </div>
            </div>

            <div style={{ opacity: 0.75, fontSize: 12, marginTop: 6 }}>
              Auswahl: Atk {tableSelAtk ? TYPE_LABELS_DE[tableSelAtk] : "-"} / Def {tableSelDef ? TYPE_LABELS_DE[tableSelDef] : "-"}
            </div>

            <div
              className="tm-scroll"
              style={{
                marginTop: 10,
                overflow: "auto",
                borderRadius: 14,
                border: "1px solid rgba(255,255,255,0.12)",
                height: "calc(86vh - 120px)",
                background: "rgba(0,0,0,0.20)",
              }}
            >
              <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 980 }}>
                <thead>
                  <tr>
                    <th style={thBig}>Atk \\ Def</th>
                    {TYPES.map((d) => {
                      const active = tableSelDef === d;
                      return (
                        <th
                          key={d}
                          style={headStyleActive(active, thBig)}
                          title={TYPE_LABELS_DE[d]}
                          onClick={() => setTableSelDef((prev) => (prev === d ? null : d))}
                        >
                          {TYPE_LABELS_DE[d]}
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {TYPES.map((a) => {
                    const rowActive = tableSelAtk === a;
                    return (
                      <tr key={a}>
                        <td
                          style={headStyleActive(rowActive, rowHeadBig)}
                          title={TYPE_LABELS_DE[a]}
                          onClick={() => setTableSelAtk((prev) => (prev === a ? null : a))}
                        >
                          {TYPE_LABELS_DE[a]}
                        </td>

                        {TYPES.map((d) => {
                          const m = mult(a, d);
                          return (
                            <td
                              key={d}
                              style={cellStyle({ a, d })}
                              title={`${TYPE_LABELS_DE[a]} vs ${TYPE_LABELS_DE[d]} = ${fmtMult(m)}`}
                              onClick={() => {
                                setTableSelAtk(a);
                                setTableSelDef(d);
                              }}
                            >
                              {fmtMult(m)}
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
        </div>
      )}
    </div>
  );
}

/* =========================================================
   STYLES
========================================================= */
const overlay = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.55)",
  backdropFilter: "blur(10px)",
  zIndex: 99999,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 16,
};

const panel = {
  width: "min(560px, 92vw)",
  borderRadius: 18,
  border: "1px solid rgba(255,255,255,0.14)",
  background: "rgba(10,10,16,0.82)",
  boxShadow: "0 30px 90px rgba(0,0,0,0.65)",
  padding: 16,
  color: "white",
  display: "flex",
  flexDirection: "column",
  gap: 12,
};

const subPanel = {
  marginTop: 2,
  borderRadius: 16,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(255,255,255,0.05)",
  padding: 12,
  display: "grid",
  gap: 12,
};

const section = {
  marginTop: 2,
  paddingTop: 10,
  borderTop: "1px solid rgba(255,255,255,0.12)",
  display: "grid",
  gap: 10,
};

const sectionTitle = {
  fontWeight: 950,
  opacity: 0.9,
};

const baseBtn = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: 14,
  border: "1px solid rgba(255,255,255,0.14)",
  color: "white",
  cursor: "pointer",
  fontWeight: 950,
  textAlign: "left",
};

const btnIcon = {
  padding: "8px 10px",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.14)",
  background: "rgba(255,255,255,0.06)",
  color: "white",
  cursor: "pointer",
  fontWeight: 900,
};

const btnGhost = {
  ...baseBtn,
  background: "rgba(255,255,255,0.06)",
};

const btnBlue = {
  ...baseBtn,
  background: "linear-gradient(135deg, rgba(79,172,254,0.35), rgba(0,242,254,0.18))",
};

const btnGreen = {
  ...baseBtn,
  background: "linear-gradient(135deg, rgba(67,233,123,0.30), rgba(56,249,215,0.16))",
};

const btnPurple = {
  ...baseBtn,
  background: "linear-gradient(135deg, rgba(161,140,209,0.32), rgba(251,194,235,0.16))",
};

const btnOrange = {
  ...baseBtn,
  background: "linear-gradient(135deg, rgba(255,183,77,0.30), rgba(255,140,0,0.16))",
};

const btnMuted = {
  ...baseBtn,
  background: "rgba(255,255,255,0.06)",
};

const btnRed = {
  ...baseBtn,
  background: "linear-gradient(135deg, rgba(255,65,108,0.22), rgba(255,75,43,0.12))",
};

const btnDanger = {
  ...baseBtn,
  background: "linear-gradient(135deg, rgba(255,65,108,0.32), rgba(255,75,43,0.18))",
  border: "1px solid rgba(255,120,120,0.28)",
};

// tabs inside type calculator
const btnTab = {
  padding: "8px 10px",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.14)",
  background: "rgba(0,0,0,0.22)",
  color: "white",
  cursor: "pointer",
  fontWeight: 950,
};

const btnTabActive = {
  ...btnTab,
  border: "1px solid rgba(255,255,255,0.22)",
  background: "rgba(255,255,255,0.10)",
};

// table styles (small)
const th = {
  position: "sticky",
  top: 0,
  zIndex: 2,
  background: "rgba(10,10,16,0.92)",
  borderBottom: "1px solid rgba(255,255,255,0.14)",
  padding: 8,
  fontSize: 12,
  textAlign: "left",
  whiteSpace: "nowrap",
};

const rowHead = {
  position: "sticky",
  left: 0,
  zIndex: 1,
  background: "rgba(10,10,16,0.92)",
  borderRight: "1px solid rgba(255,255,255,0.10)",
  borderBottom: "1px solid rgba(255,255,255,0.10)",
  padding: 8,
  fontSize: 12,
  fontWeight: 950,
  whiteSpace: "nowrap",
};

const td = {
  borderBottom: "1px solid rgba(255,255,255,0.08)",
  padding: 8,
  fontSize: 12,
  opacity: 0.95,
  whiteSpace: "nowrap",
};

/* ===== big table overlay styles ===== */
const bigOverlay = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.66)",
  backdropFilter: "blur(10px)",
  zIndex: 100000,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 16,
};

const bigPanel = {
  width: "min(1120px, 96vw)",
  height: "min(86vh, 900px)",
  borderRadius: 18,
  border: "1px solid rgba(255,255,255,0.14)",
  background: "rgba(10,10,16,0.90)",
  boxShadow: "0 30px 90px rgba(0,0,0,0.70)",
  padding: 14,
  color: "white",
  display: "flex",
  flexDirection: "column",
};

const thBig = {
  position: "sticky",
  top: 0,
  zIndex: 3,
  background: "rgba(10,10,16,0.95)",
  borderBottom: "1px solid rgba(255,255,255,0.14)",
  padding: 10,
  fontSize: 13,
  textAlign: "left",
  whiteSpace: "nowrap",
  cursor: "pointer",
};

const rowHeadBig = {
  position: "sticky",
  left: 0,
  zIndex: 2,
  background: "rgba(10,10,16,0.95)",
  borderRight: "1px solid rgba(255,255,255,0.10)",
  borderBottom: "1px solid rgba(255, 255, 255, 0.27)",
  padding: 10,
  fontSize: 13,
  fontWeight: 950,
  whiteSpace: "nowrap",
  cursor: "pointer",
};
