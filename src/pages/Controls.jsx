// src/pages/Controls.jsx
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  DEFAULT_HOTKEYS,
  loadHotkeys,
  saveHotkeys,
  normalizeKeyComboFromEvent,
  findConflict,
  labelHotkey,
} from "../utils/hotkeys";

function KeyBindInput({ value, onChange }) {
  const [listening, setListening] = useState(false);

  useEffect(() => {
    if (!listening) return;

    function onKeyDown(e) {
      e.preventDefault();
      e.stopPropagation();

      if (e.key === "Escape") {
        setListening(false);
        return;
      }

      const combo = normalizeKeyComboFromEvent(e);
      if (!combo) return;

      onChange(combo);
      setListening(false);
    }

    window.addEventListener("keydown", onKeyDown, { capture: true });
    return () => window.removeEventListener("keydown", onKeyDown, { capture: true });
  }, [listening, onChange]);

  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
      <input
        value={value || ""}
        readOnly
        placeholder="Klicken & Taste drücken"
        style={inp}
        onFocus={() => setListening(true)}
        onClick={() => setListening(true)}
      />
      <button style={btn} onClick={() => onChange("")} title="Bind löschen">
        Löschen
      </button>
    </div>
  );
}

function Row({ label, value, onChange, hint }) {
  return (
    <div style={row}>
      <div style={{ display: "grid", gap: 4 }}>
        <div style={{ fontWeight: 900 }}>{label}</div>
        {!!hint && <div style={{ fontSize: 12, opacity: 0.75 }}>{hint}</div>}
      </div>
      <KeyBindInput value={value} onChange={onChange} />
    </div>
  );
}

export default function Controls() {
  const nav = useNavigate();
  const [hk, setHk] = useState(() => loadHotkeys());
  const [conflictMsg, setConflictMsg] = useState("");
  const [tab, setTab] = useState("general"); // "general" | "draft" | "soullink"

  function setHotkeyChecked(section, key, combo) {
    const next = {
      ...hk,
      [section]: { ...(hk[section] || {}), [key]: combo },
    };

    const conflict = findConflict(next, combo, { section, key });
    if (conflict) {
      setConflictMsg(`Taste "${combo}" ist bereits belegt für: ${labelHotkey(conflict.section, conflict.key)}`);
      return;
    }

    setConflictMsg("");
    setHk(next);
  }

  useEffect(() => {
    function onEsc(e) {
      if (e.key !== "Escape") return;
      nav(-1);
    }

    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, [nav]);

  useEffect(() => saveHotkeys(hk), [hk]);

  const general = hk.general || DEFAULT_HOTKEYS.general;
  const draft = hk.draft || DEFAULT_HOTKEYS.draft;
  const soullink = hk.soullink || DEFAULT_HOTKEYS.soullink;

  return (
    <div style={wrap}>
      <div style={card}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 950 }}>Steuerung</div>

            {conflictMsg && (
              <div
                style={{
                  marginTop: 10,
                  padding: 10,
                  borderRadius: 12,
                  border: "1px solid rgba(255,120,120,0.4)",
                  background: "rgba(255,65,108,0.18)",
                }}
              >
                {conflictMsg}
              </div>
            )}

            <div style={{ opacity: 0.8, marginTop: 6 }}>
              Hotkeys gelten nur, wenn du <b>nicht</b> in einem Textfeld bist.
            </div>
          </div>

          <button style={btn} onClick={() => nav(-1)}>
            Zurück
          </button>
        </div>

        {/* Tabs */}
        <div style={tabsRow}>
          <button style={tab === "general" ? tabBtnActive : tabBtn} onClick={() => setTab("general")}>
            Allgemein
          </button>
          <button style={tab === "draft" ? tabBtnActive : tabBtn} onClick={() => setTab("draft")}>
            Draft
          </button>
          <button style={tab === "soullink" ? tabBtnActive : tabBtn} onClick={() => setTab("soullink")}>
            Soullink
          </button>

          <div style={{ flex: 1 }} />

          <button
            style={btnDangerSmall}
            onClick={() => {
              setHk(DEFAULT_HOTKEYS);
              saveHotkeys(DEFAULT_HOTKEYS);
              setConflictMsg("");
            }}
            title="Auf Standard zurücksetzen"
          >
            Reset
          </button>
        </div>

        {/* Content */}
        {tab === "general" && (
          <div style={section}>
            <div style={h2}>Allgemein</div>

            <Row
              label="Pokédex öffnen"
              value={general.openPokedex}
              onChange={(v) => setHotkeyChecked("general", "openPokedex", v)}
            />

            <Row
              label="MoveDex öffnen"
              value={general.openMoveDex}
              onChange={(v) => setHotkeyChecked("general", "openMoveDex", v)}
            />

            <Row
              label="Menü öffnen/schließen"
              value={general.menuToggle}
              onChange={(v) => setHotkeyChecked("general", "menuToggle", v)}
            />

            <Row
              label="Startbildschirm"
              value={general.goHome}
              onChange={(v) => setHotkeyChecked("general", "goHome", v)}
            />

            <Row
              label="Zur Lobby"
              value={general.goLobby}
              onChange={(v) => setHotkeyChecked("general", "goLobby", v)}
            />

            <Row
              label="Zurück (1 Schritt)"
              value={general.goBack}
              onChange={(v) => setHotkeyChecked("general", "goBack", v)}
            />

            <Row
              label="Mute / Unmute"
              value={general.toggleMute}
              onChange={(v) => setHotkeyChecked("general", "toggleMute", v)}
            />
          </div>
        )}

        {tab === "draft" && (
          <div style={section}>
            <div style={h2}>Draft</div>

            <Row
              label="Bieten / Submit"
              value={draft.bidSubmit}
              onChange={(v) => setHotkeyChecked("draft", "bidSubmit", v)}
            />

            <Row
              label="All-in"
              value={draft.allIn}
              onChange={(v) => setHotkeyChecked("draft", "allIn", v)}
            />

            <Row
              label="+100"
              value={draft.plus100}
              onChange={(v) => setHotkeyChecked("draft", "plus100", v)}
            />

            <Row
              label="-100"
              value={draft.minus100}
              onChange={(v) => setHotkeyChecked("draft", "minus100", v)}
            />

            <Row
              label="Pause/Fortfahren"
              value={draft.togglePause}
              onChange={(v) => setHotkeyChecked("draft", "togglePause", v)}
            />
          </div>
        )}

        {tab === "soullink" && (
          <div style={section}>
            <div style={h2}>Soullink</div>

            <Row
              label="Team öffnen"
              value={soullink.goTeam}
              onChange={(v) => setHotkeyChecked("soullink", "goTeam", v)}
            />

            <Row
              label="Story-Guide öffnen"
              value={soullink.goGuide}
              onChange={(v) => setHotkeyChecked("soullink", "goGuide", v)}
            />
          </div>
        )}

        {/* Footer hint */}
        <div style={{ marginTop: 12, opacity: 0.7, fontSize: 12 }}>
          Tipp: Klicke ins Feld und drücke die gewünschte Taste/Kombination.
        </div>
      </div>
    </div>
  );
}

/* =========================
   Styles
========================= */
const wrap = { minHeight: "100vh", padding: 16, color: "white" };

const card = {
  maxWidth: 900,
  margin: "0 auto",
  borderRadius: 18,
  border: "1px solid rgba(255,255,255,0.14)",
  background: "rgba(10,10,16,0.82)",
  boxShadow: "0 30px 90px rgba(0,0,0,0.65)",
  padding: 16,
};

const tabsRow = {
  marginTop: 14,
  display: "flex",
  alignItems: "center",
  gap: 10,
  flexWrap: "wrap",
  paddingTop: 12,
  borderTop: "1px solid rgba(255,255,255,0.12)",
};

const tabBtn = {
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.18)",
  background: "rgba(255,255,255,0.06)",
  color: "white",
  fontWeight: 950,
  cursor: "pointer",
};

const tabBtnActive = {
  ...tabBtn,
  border: "1px solid rgba(255,255,255,0.26)",
  background: "linear-gradient(135deg, rgba(79,172,254,0.28), rgba(0,242,254,0.14))",
};

const section = {
  marginTop: 14,
  paddingTop: 12,
  display: "grid",
  gap: 10,
};

const h2 = { fontWeight: 950, opacity: 0.9 };

const row = {
  display: "grid",
  gap: 8,
  padding: 10,
  borderRadius: 14,
  background: "rgba(255,255,255,0.06)",
  border: "1px solid rgba(255,255,255,0.12)",
};

const inp = {
  flex: 1,
  minWidth: 240,
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.18)",
  background: "rgba(10,10,16,0.7)",
  color: "white",
  fontWeight: 900,
};

const btn = {
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.18)",
  background: "rgba(255,255,255,0.08)",
  color: "white",
  fontWeight: 900,
  cursor: "pointer",
};

const btnDangerSmall = {
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid rgba(255,120,120,0.28)",
  background: "linear-gradient(135deg, rgba(255,65,108,0.32), rgba(255,75,43,0.18))",
  color: "white",
  fontWeight: 950,
  cursor: "pointer",
};
