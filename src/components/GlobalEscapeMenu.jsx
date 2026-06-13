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
========================================================= */
const TYPES = [
  "normal",
  "fire",
  "water",
  "electric",
  "grass",
  "ice",
  "fighting",
  "poison",
  "ground",
  "flying",
  "psychic",
  "bug",
  "rock",
  "ghost",
  "dragon",
  "dark",
  "steel",
  "fairy",
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

// attackType -> defenseType -> multiplier
const CHART = {
  normal: { rock: 0.5, ghost: 0, steel: 0.5 },
  fire: { fire: 0.5, water: 0.5, grass: 2, ice: 2, bug: 2, rock: 0.5, dragon: 0.5, steel: 2 },
  water: { fire: 2, water: 0.5, grass: 0.5, ground: 2, rock: 2, dragon: 0.5 },
  electric: { water: 2, electric: 0.5, grass: 0.5, ground: 0, flying: 2, dragon: 0.5 },
  grass: { fire: 0.5, water: 2, grass: 0.5, poison: 0.5, ground: 2, flying: 0.5, bug: 0.5, rock: 2, dragon: 0.5, steel: 0.5 },
  ice: { fire: 0.5, water: 0.5, grass: 2, ice: 0.5, ground: 2, flying: 2, dragon: 2, steel: 0.5 },
  fighting: { normal: 2, ice: 2, rock: 2, dark: 2, steel: 2, poison: 0.5, flying: 0.5, psychic: 0.5, bug: 0.5, fairy: 0.5, ghost: 0 },
  poison: { grass: 2, fairy: 2, poison: 0.5, ground: 0.5, rock: 0.5, ghost: 0.5, steel: 0 },
  ground: { fire: 2, electric: 2, grass: 0.5, poison: 2, flying: 0, bug: 0.5, rock: 2, steel: 2 },
  flying: { electric: 0.5, grass: 2, fighting: 2, bug: 2, rock: 0.5, steel: 0.5 },
  psychic: { fighting: 2, poison: 2, psychic: 0.5, dark: 0, steel: 0.5 },
  bug: { fire: 0.5, grass: 2, fighting: 0.5, poison: 0.5, flying: 0.5, psychic: 2, ghost: 0.5, dark: 2, steel: 0.5, fairy: 0.5 },
  rock: { fire: 2, ice: 2, flying: 2, bug: 2, fighting: 0.5, ground: 0.5, steel: 0.5 },
  ghost: { normal: 0, psychic: 2, ghost: 2, dark: 0.5 },
  dragon: { dragon: 2, steel: 0.5, fairy: 0 },
  dark: { psychic: 2, ghost: 2, fighting: 0.5, dark: 0.5, fairy: 0.5 },
  steel: { ice: 2, rock: 2, fairy: 2, fire: 0.5, water: 0.5, electric: 0.5, steel: 0.5 },
  fairy: { fighting: 2, dragon: 2, dark: 2, fire: 0.5, poison: 0.5, steel: 0.5 },
};

function mult(att, def) {
  const row = CHART[String(att || "").toLowerCase()] || {};
  return row[String(def || "").toLowerCase()] ?? 1;
}

function typeIconUrl(typeKey) {
  const t = String(typeKey || "").toLowerCase();
  return `https://raw.githubusercontent.com/partywhale/pokemon-type-icons/master/icons/${t}.svg`;
}

/* Scrollbar hide helper (scrollbar bleibt nutzbar) */
const HIDE_SCROLL_CSS = `
.tm-scroll,
.esc-scroll {
  scrollbar-width: none;
  -ms-overflow-style: none;
}

.tm-scroll::-webkit-scrollbar,
.esc-scroll::-webkit-scrollbar {
  width: 0px;
  height: 0px;
  display: none;
}
`;

/* =========================================================
   COMPONENT
========================================================= */
export default function GlobalEscapeMenu() {
  const nav = useNavigate();
  const location = useLocation();

  const [open, setOpen] = useState(false);
  const [audio, setAudio] = useState(() => readAudioSettings());
  const [draftCtx, setDraftCtx] = useState(() => readDraftCtx());

  const [dexOpen, setDexOpen] = useState(false);

  // Type calculator (im Menü)
  const [typeOpen, setTypeOpen] = useState(false);
  const [typeMode, setTypeMode] = useState("def"); // "def" | "atk"
  const [defTypes, setDefTypes] = useState([]); // up to 2
  const [atkTypes, setAtkTypes] = useState([]); // multiple

  // ✅ Type calculator Dock (global, auch wenn Menü zu ist)
  const [typeDockOpen, setTypeDockOpen] = useState(false);

  const isPokedex = location.pathname === "/pokedex";
  const isMoveDex = location.pathname === "/movedex" || location.pathname.startsWith("/move/");
  const isControls = location.pathname.startsWith("/controls");

  // ✅ Detail-Seiten (damit E/A: Detail -> Dex -> Dex schließen)
  const isPokemonDetail = location.pathname.startsWith("/pokemon/");
  const isMoveDetail = location.pathname.startsWith("/move/");

  // ✅ Compare zählt zur Dex-Fläche (damit E nicht zwischen Compare <-> Dex toggelt)
  const isPokemonCompare =
    location.pathname.startsWith("/compare") ||
    location.pathname.startsWith("/pokemon-compare") ||
    location.pathname.startsWith("/pokemoncompare");

  // ✅ Team-Compare: eigene Seite (Toggle mit C)
  const isTeamCompare = location.pathname === "/team-compare";

  // ✅ "Return-to" Speicher für echtes Toggle (E/A/C)
  const POKEDEX_RETURN_KEY = "app_return_to_pokedex_v1";
  const MOVEDEX_RETURN_KEY = "app_return_to_movedex_v1";
  const TEAMCOMPARE_RETURN_KEY = "app_return_to_team_compare_v1";
  const LAST_NON_POKEDEX_KEY = "app_last_non_pokedex_v1";
  const LAST_NON_MOVEDEX_KEY = "app_last_non_movedex_v1";
  const LAST_NON_TEAMCOMPARE_KEY = "app_last_non_team_compare_v1";

  function currentFullPath() {
    return `${location.pathname}${location.search || ""}${location.hash || ""}`;
  }

  function smartBack() {
    if (window.history.length > 1) nav(-1);
    else nav("/");
  }

  const lobbyPath = useMemo(() => {
    if (location.pathname.startsWith("/duo")) return "/duo";
    if (location.pathname.startsWith("/versus")) return "/versus";
    return "/duo";
  }, [location.pathname]);

  // ✅ Merke dir jeweils die "letzte normale Seite" (außerhalb von Dex-/MoveDex-/TeamCompare-Flächen)
  useEffect(() => {
    const path = currentFullPath();

    if (!isPokedex && !isPokemonDetail && !isPokemonCompare) {
      try {
        sessionStorage.setItem(LAST_NON_POKEDEX_KEY, path);
      } catch {}
    }

    if (location.pathname !== "/movedex" && !isMoveDetail) {
      try {
        sessionStorage.setItem(LAST_NON_MOVEDEX_KEY, path);
      } catch {}
    }

    if (!isTeamCompare) {
      try {
        sessionStorage.setItem(LAST_NON_TEAMCOMPARE_KEY, path);
      } catch {}
    }
  }, [
    location.pathname,
    location.search,
    location.hash,
    isPokedex,
    isPokemonDetail,
    isPokemonCompare,
    isMoveDetail,
    isTeamCompare,
  ]);

  // Audio apply + listeners
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
  }, []); // intentional

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

  // ===== Type calculator logic =====
  function toggleDef(t) {
    setDefTypes((prev) => {
      const has = prev.includes(t);
      if (has) return prev.filter((x) => x !== t);
      if (prev.length >= 2) return [prev[1], t];
      return [...prev, t];
    });
  }

  function toggleAtk(t) {
    setAtkTypes((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));
  }

  const defBuckets = useMemo(() => {
    if (!defTypes.length) return null;

    const out = { "4x": [], "2x": [], "0.5x": [], "0.25x": [], "0x": [], "1x": [] };

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
        const k = `${m}x`;
        out[k] = (out[k] || []).concat([a]);
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
          padding: "9px 11px",
          borderRadius: 14,
          border: active ? "2px solid rgba(120,220,255,0.85)" : "1px solid rgba(255,255,255,0.14)",
          background: active
            ? "linear-gradient(135deg, rgba(120,220,255,0.22), rgba(120,220,255,0.08))"
            : "rgba(255,255,255,0.06)",
          boxShadow: active ? "0 0 0 2px rgba(120,220,255,0.15), 0 6px 18px rgba(120,220,255,0.35)" : "none",
          transform: active ? "scale(1.03)" : "scale(1)",
          transition: "all 120ms ease",
          color: "white",
          cursor: "pointer",
          fontWeight: 950,
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
                  width: 18,
                  height: 18,
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

  // ✅ Global hotkeys (auch wenn Menü zu ist)
  useEffect(() => {
    function onGlobalHotkeys(e) {
      if (e.repeat) return;

      const hk = loadHotkeys();
      const g = hk?.general || {};
      const s = hk?.soullink || {};

      // ✅ Typenrechner-Dock: überall, aber NICHT wenn man tippt
      if (g.openTypeCalculator && comboMatches(e, g.openTypeCalculator)) {
        if (isTypingTarget(document.activeElement)) return;
        e.preventDefault();
        e.stopPropagation();
        setTypeDockOpen((v) => !v);
        return;
      }

      // ✅ Ab hier: wenn Fokus in Input/Textarea/ContentEditable -> GAR NICHTS triggern
      if (isTypingTarget(document.activeElement)) return;

      // ✅ TEAM COMPARE TOGGLE (C)
      if (g.openTeamCompare && comboMatches(e, g.openTeamCompare)) {
        e.preventDefault();
        e.stopPropagation();

        if (isTeamCompare) {
          const ret =
            sessionStorage.getItem(TEAMCOMPARE_RETURN_KEY) ||
            sessionStorage.getItem(LAST_NON_TEAMCOMPARE_KEY);

          sessionStorage.removeItem(TEAMCOMPARE_RETURN_KEY);

          if (ret) nav(ret);
          else smartBack();
          return;
        }

        sessionStorage.setItem(TEAMCOMPARE_RETURN_KEY, currentFullPath());
        nav("/team-compare");
        return;
      }

      // Soullink Hotkeys
      if (s.goTeam && comboMatches(e, s.goTeam)) {
        e.preventDefault();
        e.stopPropagation();
        if (location.pathname.startsWith("/team")) smartBack();
        else nav("/team");
        return;
      }

      if (s.goGuide && comboMatches(e, s.goGuide)) {
        e.preventDefault();
        e.stopPropagation();
        if (location.pathname.startsWith("/guide")) smartBack();
        else nav("/guide");
        return;
      }

      // ✅ Level-Cap Hotkeys (EncounterTable hört auf Events)
      if (g.nextLevelCap && comboMatches(e, g.nextLevelCap)) {
        e.preventDefault();
        e.stopPropagation();
        try {
          window.dispatchEvent(new CustomEvent("appLevelCapNext"));
        } catch {}
        return;
      }

      if (g.prevLevelCap && comboMatches(e, g.prevLevelCap)) {
        e.preventDefault();
        e.stopPropagation();
        try {
          window.dispatchEvent(new CustomEvent("appLevelCapPrev"));
        } catch {}
        return;
      }

      // Menü darf offen sein: dann keine weiteren global nav-hotkeys
      if (open) return;

      if (g.goHome && comboMatches(e, g.goHome)) {
        e.preventDefault();
        e.stopPropagation();
        nav("/");
        return;
      }

      if (g.goLobby && comboMatches(e, g.goLobby)) {
        e.preventDefault();
        e.stopPropagation();
        nav(lobbyPath);
        return;
      }

      if (g.goBack && comboMatches(e, g.goBack)) {
        e.preventDefault();
        e.stopPropagation();
        smartBack();
        return;
      }

      // ✅ POKEDEX TOGGLE (E)
      if (g.openPokedex && comboMatches(e, g.openPokedex)) {
        e.preventDefault();
        e.stopPropagation();

        if (isPokedex) {
          const ret =
            sessionStorage.getItem(POKEDEX_RETURN_KEY) ||
            sessionStorage.getItem(LAST_NON_POKEDEX_KEY);

          sessionStorage.removeItem(POKEDEX_RETURN_KEY);

          if (ret) nav(ret);
          else smartBack();
          return;
        }

        if (isPokemonDetail || isPokemonCompare) {
          const lastNon = sessionStorage.getItem(LAST_NON_POKEDEX_KEY) || "/";
          sessionStorage.setItem(POKEDEX_RETURN_KEY, lastNon);
          nav("/pokedex");
          return;
        }

        sessionStorage.setItem(POKEDEX_RETURN_KEY, currentFullPath());
        nav("/pokedex");
        return;
      }

      // ✅ MOVEDEX TOGGLE (A)
      if (g.openMoveDex && comboMatches(e, g.openMoveDex)) {
        e.preventDefault();
        e.stopPropagation();

        const onMoveDexSurface = location.pathname === "/movedex";

        if (onMoveDexSurface) {
          const ret =
            sessionStorage.getItem(MOVEDEX_RETURN_KEY) ||
            sessionStorage.getItem(LAST_NON_MOVEDEX_KEY);

          sessionStorage.removeItem(MOVEDEX_RETURN_KEY);

          if (ret) nav(ret);
          else smartBack();
          return;
        }

        if (isMoveDetail) {
          const lastNon = sessionStorage.getItem(LAST_NON_MOVEDEX_KEY) || "/";
          sessionStorage.setItem(MOVEDEX_RETURN_KEY, lastNon);
          nav("/movedex");
          return;
        }

        sessionStorage.setItem(MOVEDEX_RETURN_KEY, currentFullPath());
        nav("/movedex");
        return;
      }

      if (g.toggleMute && comboMatches(e, g.toggleMute)) {
        e.preventDefault();
        e.stopPropagation();
        setMuted(!(audio?.muted));
        return;
      }
    }

    window.addEventListener("keydown", onGlobalHotkeys, { capture: true });
    return () => window.removeEventListener("keydown", onGlobalHotkeys, { capture: true });
  }, [
    open,
    nav,
    audio,
    lobbyPath,
    isPokedex,
    isPokemonDetail,
    isPokemonCompare,
    isMoveDetail,
    isTeamCompare,
    location.pathname,
    location.search,
    location.hash,
  ]);

  // ESC toggles menu; wenn Dock offen -> ESC schließt Dock zuerst
  useEffect(() => {
    function onKeyDown(e) {
      if (e.key !== "Escape") return;

      if (isTypingTarget(document.activeElement)) return;

      if (isControls) {
        e.preventDefault();
        e.stopPropagation();
        smartBack();
        return;
      }

      if (typeDockOpen) {
        e.preventDefault();
        setTypeDockOpen(false);
        return;
      }

      if (isPokedex || isMoveDex) {
        if (window.history.length > 1) nav(-1);
        else nav("/");
        return;
      }

      setOpen((v) => !v);
    }

    window.addEventListener("keydown", onKeyDown, { capture: true });
    return () => window.removeEventListener("keydown", onKeyDown, { capture: true });
  }, [isPokedex, isMoveDex, isControls, nav, typeDockOpen]);

  const volumePct = Math.round((audio.volume ?? 0) * 100);

  const inDraft = !!draftCtx?.inDraft;
  const canRestart = !!draftCtx?.canRestart;
  const restartFn = draftCtx?.restart;
  const leaveTo = draftCtx?.leaveTo || lobbyPath;

  if (!open && !typeDockOpen) return null;

  return (
    <>
      <style>{HIDE_SCROLL_CSS}</style>

      {/* ✅ Dock: klein rechts, immer sichtbar wenn typeDockOpen */}
      {typeDockOpen && (
        <div className="esc-scroll" style={dockWrap}>
          <div style={dockHeader}>
            <div style={{ fontWeight: 950 }}>Typenrechner</div>
            <button style={dockClose} onClick={() => setTypeDockOpen(false)} title="Schließen">
              ✕
            </button>
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button style={typeMode === "def" ? btnTabActive : btnTab} onClick={() => setTypeMode("def")}>
              Def
            </button>
            <button style={typeMode === "atk" ? btnTabActive : btnTab} onClick={() => setTypeMode("atk")}>
              Atk
            </button>
            <button
              style={btnTab}
              onClick={() => {
                setDefTypes([]);
                setAtkTypes([]);
              }}
              title="Reset"
            >
              Reset
            </button>
          </div>

          {typeMode === "def" && (
            <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
                  gap: 8,
                  alignItems: "stretch",
                }}
              >
                {TYPES.map((t) => (
                  <TypePill key={t} t={t} active={defTypes.includes(t)} onClick={() => toggleDef(t)} />
                ))}
              </div>

              {defTypes.length > 0 ? (
                <div style={{ display: "grid", gap: 12 }}>
                  <Bucket title="4×" items={defBuckets?.["4x"]} />
                  <Bucket title="2×" items={defBuckets?.["2x"]} />
                  <Bucket title="½×" items={defBuckets?.["0.5x"]} />
                  <Bucket title="¼×" items={defBuckets?.["0.25x"]} />
                  <Bucket title="Immun (0×)" items={defBuckets?.["0x"]} />
                </div>
              ) : (
                <div style={{ opacity: 0.75 }}>Wähle 1–2 Def-Typen.</div>
              )}
            </div>
          )}

          {typeMode === "atk" && (
            <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
              <div style={{ opacity: 0.85, fontWeight: 900 }}>Atk (mehrere):</div>
              <div className="tm-scroll" style={{ display: "flex", flexWrap: "wrap", gap: 8, maxHeight: 160, overflow: "auto" }}>
                {TYPES.map((t) => (
                  <TypePill key={t} t={t} active={atkTypes.includes(t)} onClick={() => toggleAtk(t)} />
                ))}
              </div>

              {atkTypes.length > 0 ? (
                <div style={{ display: "grid", gap: 12 }}>
                  <Bucket title="Super (≥2×)" items={atkCoverage?.super} />
                  <Bucket title="Neutral (1×)" items={atkCoverage?.neutral} />
                  <Bucket title="Resist (½×/¼×)" items={atkCoverage?.resist} />
                  <Bucket title="Immun (0×)" items={atkCoverage?.immune} />
                </div>
              ) : (
                <div style={{ opacity: 0.75 }}>Wähle mindestens 1 Atk-Typ.</div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ✅ Pause-Menü Overlay */}
      {open && (
        <div
          style={overlay}
          onClick={() => {
            setOpen(false);
            setDexOpen(false);
            setTypeOpen(false);
          }}
        >
          <div className="esc-scroll" style={panel} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
              <div style={{ fontSize: 18, fontWeight: 950, letterSpacing: 0.2 }}>Pause-Menü</div>
              <button
                style={btnIcon}
                onClick={() => {
                  setOpen(false);
                  setDexOpen(false);
                  setTypeOpen(false);
                }}
                title="Schließen (ESC)"
              >
                ✕
              </button>
            </div>

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
                      nav("/movedex");
                    }}
                  >
                    MoveDex
                  </button>
                </div>
              )}

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
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button style={typeMode === "def" ? btnTabActive : btnTab} onClick={() => setTypeMode("def")}>
                      Verteidigung
                    </button>
                    <button style={typeMode === "atk" ? btnTabActive : btnTab} onClick={() => setTypeMode("atk")}>
                      Angriff
                    </button>
                    <button
                      style={btnTab}
                      onClick={() => {
                        setDefTypes([]);
                        setAtkTypes([]);
                      }}
                      title="Reset"
                    >
                      Reset
                    </button>

                    <button style={btnTab} onClick={() => setTypeDockOpen((v) => !v)} title="Dock rechts öffnen/schließen">
                      Dock
                    </button>
                  </div>

                  {typeMode === "def" && (
                    <div style={{ display: "grid", gap: 10 }}>
                      <div style={{ fontWeight: 950, opacity: 0.9 }}>Verteidigungstypen wählen (1–2)</div>

                      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                        {TYPES.map((t) => (
                          <TypePill key={t} t={t} active={defTypes.includes(t)} onClick={() => toggleDef(t)} />
                        ))}
                      </div>

                      {defTypes.length > 0 ? (
                        <div style={{ display: "grid", gap: 12 }}>
                          <Bucket title="4× Schwäche" items={defBuckets?.["4x"]} />
                          <Bucket title="2× Schwäche" items={defBuckets?.["2x"]} />
                          <Bucket title="½× Resist" items={defBuckets?.["0.5x"]} />
                          <Bucket title="¼× Resist" items={defBuckets?.["0.25x"]} />
                          <Bucket title="Immun (0×)" items={defBuckets?.["0x"]} />
                        </div>
                      ) : (
                        <div style={{ opacity: 0.75 }}>Wähle mindestens 1 Verteidigungstyp.</div>
                      )}
                    </div>
                  )}

                  {typeMode === "atk" && (
                    <div style={{ display: "grid", gap: 10 }}>
                      <div style={{ fontWeight: 950, opacity: 0.9 }}>Angriffstypen wählen (mehrere möglich)</div>

                      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                        {TYPES.map((t) => (
                          <TypePill key={t} t={t} active={atkTypes.includes(t)} onClick={() => toggleAtk(t)} />
                        ))}
                      </div>

                      {atkTypes.length > 0 ? (
                        <div style={{ display: "grid", gap: 12 }}>
                          <Bucket title="Coverage: Super effektiv (≥2×)" items={atkCoverage?.super} />
                          <Bucket title="Neutral (1×)" items={atkCoverage?.neutral} />
                          <Bucket title="Nicht sehr effektiv (½×/¼×)" items={atkCoverage?.resist} />
                          <Bucket title="Keine Wirkung (0×)" items={atkCoverage?.immune} />
                        </div>
                      ) : (
                        <div style={{ opacity: 0.75 }}>Wähle mindestens 1 Angriffstyp.</div>
                      )}
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
                  smartBack();
                }}
              >
                Zurück
              </button>
            </div>

            <div style={section}>
              <div style={sectionTitle}>Audio</div>

              <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                <button style={audio.muted ? btnMuted : btnOrange} onClick={() => setMuted(!audio.muted)} title="Stumm / Ton an">
                  {audio.muted ? "Stumm" : "Ton an"}
                </button>

                <div style={{ flex: 1, minWidth: 200 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, opacity: 0.85 }}>
                    <span>Lautstärke</span>
                    <span>{Math.round((audio.volume ?? 0) * 100)}%</span>
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
        </div>
      )}
    </>
  );
}

/* =========================================================
   STYLES
========================================================= */

const overlay = {
  position: "fixed",
  inset: 0,
  background:
    "radial-gradient(circle at 20% 0%, rgba(52,211,153,0.10), transparent 34%), radial-gradient(circle at 80% 10%, rgba(96,165,250,0.12), transparent 34%), rgba(0,0,0,0.72)",
  backdropFilter: "blur(10px)",
  WebkitBackdropFilter: "blur(10px)",
  zIndex: 99999,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 16,
};

const panel = {
  width: "min(560px, 92vw)",
  maxHeight: "min(780px, 92vh)",
  overflowY: "auto",
  overflowX: "hidden",
  overscrollBehavior: "contain",
  borderRadius: 18,
  border: "1px solid rgba(137,155,184,0.34)",
  background:
    "radial-gradient(circle at 50% 0%, rgba(52,211,153,0.10), transparent 42%), linear-gradient(180deg, rgba(10,18,33,0.98), rgba(8,15,28,0.98))",
  boxShadow:
    "0 30px 90px rgba(0,0,0,0.68), inset 0 1px 0 rgba(255,255,255,0.05)",
  padding: 16,
  color: "#f8fafc",
  display: "flex",
  flexDirection: "column",
  gap: 12,
};

const subPanel = {
  marginTop: 2,
  borderRadius: 14,
  border: "1px solid rgba(137,155,184,0.22)",
  background:
    "radial-gradient(circle at 0% 0%, rgba(96,165,250,0.08), transparent 42%), rgba(5,11,21,0.34)",
  padding: 12,
  display: "grid",
  gap: 12,
  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.035)",
};

const section = {
  marginTop: 2,
  paddingTop: 12,
  borderTop: "1px solid rgba(137,155,184,0.18)",
  display: "grid",
  gap: 10,
};

const sectionTitle = {
  fontWeight: 950,
  color: "#ffffff",
  opacity: 0.95,
  letterSpacing: "-0.01em",
};

const baseBtn = {
  width: "100%",
  padding: "11px 13px",
  borderRadius: 11,
  border: "1px solid rgba(120,138,170,0.42)",
  color: "#f8fafc",
  cursor: "pointer",
  fontWeight: 950,
  textAlign: "left",
  boxShadow:
    "inset 0 1px 0 rgba(255,255,255,0.04), 0 8px 18px rgba(0,0,0,0.18)",
};

const btnIcon = {
  padding: "8px 10px",
  borderRadius: 10,
  border: "1px solid rgba(120,138,170,0.42)",
  background:
    "linear-gradient(180deg, rgba(13,24,42,0.88), rgba(8,15,28,0.88))",
  color: "#f8fafc",
  cursor: "pointer",
  fontWeight: 950,
  boxShadow:
    "inset 0 1px 0 rgba(255,255,255,0.04), 0 8px 18px rgba(0,0,0,0.18)",
};

const btnGhost = {
  ...baseBtn,
  background:
    "linear-gradient(180deg, rgba(13,24,42,0.88), rgba(8,15,28,0.88))",
};

const btnBlue = {
  ...baseBtn,
  border: "1px solid rgba(96,165,250,0.36)",
  background:
    "radial-gradient(circle at 0% 0%, rgba(96,165,250,0.14), transparent 46%), linear-gradient(180deg, rgba(13,24,42,0.9), rgba(8,15,28,0.9))",
};

const btnGreen = {
  ...baseBtn,
  border: "1px solid rgba(52,211,153,0.42)",
  background:
    "radial-gradient(circle at 0% 0%, rgba(52,211,153,0.18), transparent 46%), linear-gradient(180deg, rgba(13,44,34,0.82), rgba(8,20,18,0.82))",
};

const btnPurple = {
  ...baseBtn,
  border: "1px solid rgba(168,85,247,0.34)",
  background:
    "radial-gradient(circle at 0% 0%, rgba(168,85,247,0.13), transparent 46%), linear-gradient(180deg, rgba(20,18,42,0.88), rgba(10,10,26,0.88))",
};

const btnOrange = {
  ...baseBtn,
  border: "1px solid rgba(251,146,60,0.36)",
  background:
    "radial-gradient(circle at 0% 0%, rgba(251,146,60,0.14), transparent 46%), linear-gradient(180deg, rgba(42,28,13,0.88), rgba(24,15,8,0.88))",
};

const btnMuted = {
  ...baseBtn,
  background:
    "linear-gradient(180deg, rgba(13,24,42,0.88), rgba(8,15,28,0.88))",
};

const btnRed = {
  ...baseBtn,
  border: "1px solid rgba(248,113,113,0.36)",
  background:
    "radial-gradient(circle at 0% 0%, rgba(248,113,113,0.13), transparent 46%), linear-gradient(180deg, rgba(69,10,10,0.52), rgba(24,8,8,0.52))",
  color: "#fee2e2",
};

const btnDanger = {
  ...baseBtn,
  border: "1px solid rgba(248,113,113,0.42)",
  background:
    "linear-gradient(180deg, rgba(127,29,29,0.46), rgba(69,10,10,0.46))",
  color: "#fee2e2",
};

const btnTab = {
  padding: "8px 10px",
  borderRadius: 10,
  border: "1px solid rgba(120,138,170,0.42)",
  background:
    "linear-gradient(180deg, rgba(13,24,42,0.86), rgba(8,15,28,0.86))",
  color: "#f8fafc",
  cursor: "pointer",
  fontWeight: 950,
  boxShadow:
    "inset 0 1px 0 rgba(255,255,255,0.035), 0 8px 16px rgba(0,0,0,0.16)",
};

const btnTabActive = {
  ...btnTab,
  border: "1px solid rgba(52,211,153,0.5)",
  background:
    "radial-gradient(circle at 0% 0%, rgba(52,211,153,0.2), transparent 46%), linear-gradient(180deg, rgba(13,44,34,0.88), rgba(8,20,18,0.88))",
  boxShadow:
    "0 0 0 1px rgba(52,211,153,0.14), 0 10px 20px rgba(0,0,0,0.2)",
};

/* ✅ Dock styles */
const dockWrap = {
  position: "fixed",
  right: 14,
  top: 86,
  width: "min(520px, 94vw)",
  height: "calc(93vh - 110px)",
  maxHeight: "calc(100vh - 110px)",
  overflow: "auto",
  borderRadius: 16,
  border: "1px solid rgba(137,155,184,0.34)",
  background:
    "radial-gradient(circle at 50% 0%, rgba(52,211,153,0.10), transparent 42%), linear-gradient(180deg, rgba(10,18,33,0.98), rgba(8,15,28,0.98))",
  boxShadow:
    "0 30px 90px rgba(0,0,0,0.70), inset 0 1px 0 rgba(255,255,255,0.05)",
  padding: 12,
  color: "#f8fafc",
  zIndex: 99998,
  backdropFilter: "blur(10px)",
  WebkitBackdropFilter: "blur(10px)",
};

const dockHeader = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 10,
  marginBottom: 8,
};

const dockClose = {
  padding: "6px 10px",
  borderRadius: 10,
  border: "1px solid rgba(120,138,170,0.42)",
  background:
    "linear-gradient(180deg, rgba(13,24,42,0.88), rgba(8,15,28,0.88))",
  color: "#f8fafc",
  cursor: "pointer",
  fontWeight: 950,
  boxShadow:
    "inset 0 1px 0 rgba(255,255,255,0.035), 0 8px 16px rgba(0,0,0,0.16)",
};