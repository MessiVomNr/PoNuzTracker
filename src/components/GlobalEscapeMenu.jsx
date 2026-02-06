// src/components/GlobalEscapeMenu.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

/* =========================================================
   AUDIO (global)
   - Speichert in localStorage
   - Wendet es auf alle <audio>/<video> im DOM an
   - Stellt window.__APP_AUDIO__ bereit (für spätere Sound-Engine)
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
   - Draft Seite setzt window.__ESC_DRAFT_CTX__
   - ESC-Menü zeigt dann extra Buttons
========================================================= */
function readDraftCtx() {
  try {
    return window.__ESC_DRAFT_CTX__ || null;
  } catch {
    return null;
  }
}

export default function GlobalEscapeMenu() {
  const nav = useNavigate();
  const location = useLocation();

  const [open, setOpen] = useState(false);
  const [audio, setAudio] = useState(() => readAudioSettings());
  const [draftCtx, setDraftCtx] = useState(() => readDraftCtx());

  const isPokedex = location.pathname === "/pokedex";

  const lobbyPath = useMemo(() => {
    // Lobby-Ziel kontextabhängig
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

    function onDraftCtxChanged() {
      setDraftCtx(readDraftCtx());
    }

    window.addEventListener("appAudioSettingsChanged", onAudioChanged);
    window.addEventListener("escDraftCtxChanged", onDraftCtxChanged);

    return () => {
      window.removeEventListener("appAudioSettingsChanged", onAudioChanged);
      window.removeEventListener("escDraftCtxChanged", onDraftCtxChanged);
    };
  }, []);

  // ESC Handler
  useEffect(() => {
    function onKeyDown(e) {
      if (e.key !== "Escape") return;

      // Wenn Pokédex offen ist: ESC schließt Pokédex (zurück / oder Home)
      if (isPokedex) {
        if (window.history.length > 1) nav(-1);
        else nav("/");
        return;
      }

      // sonst Menü togglen
      setOpen((v) => !v);
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isPokedex, nav]);

  if (!open) return null;

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

  return (
    <div style={overlay} onClick={() => setOpen(false)}>
      <div style={panel} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
          <div style={{ fontSize: 18, fontWeight: 950, letterSpacing: 0.2 }}>
            Pause-Menü
          </div>
          <button style={btnIcon} onClick={() => setOpen(false)} title="Schließen (ESC)">
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

          <button
            style={btnPurple}
            onClick={() => {
              setOpen(false);
              nav("/pokedex");
            }}
          >
            Pokédex anzeigen
          </button>
<button
  style={btnPurple}
  onClick={() => {
    setOpen(false);
    nav("/movedex");
  }}
>
  MoveDex öffnen
</button>

<button
  style={btnPurple}
  onClick={() => {
    setOpen(false);
    nav("/tms");
  }}
>
  TM Story Liste
</button>

          <button
            style={btnGhost}
            onClick={() => {
              setOpen(false);
              nav(-1);
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

        <div style={{ marginTop: 6, opacity: 0.7, fontSize: 12 }}>
          ESC öffnet/schließt das Menü. Im Pokédex schließt ESC den Pokédex.
        </div>
      </div>
    </div>
  );
}

/* =========================================================
   STYLES (slightly colorful, still dark)
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
  width: "min(460px, 92vw)",
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
