// src/pages/Controls.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { DEFAULT_HOTKEYS, loadHotkeys, saveHotkeys, normalizeKeyComboFromEvent, findConflict, labelHotkey } from "../utils/hotkeys";

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

export default function Controls() {
  const nav = useNavigate();
  const [hk, setHk] = useState(() => loadHotkeys());
  const [conflictMsg, setConflictMsg] = useState("");
function setHotkeyChecked(section, key, combo) {
  const next = {
    ...hk,
    [section]: { ...(hk[section] || {}), [key]: combo },
  };

  const conflict = findConflict(next, combo, { section, key });

  if (conflict) {
    setConflictMsg(
      `Taste "${combo}" ist bereits belegt für: ${labelHotkey(conflict.section, conflict.key)}`
    );
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

  return (
    <div style={wrap}>
      <div style={card}>
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
            <div style={{ opacity: 0.8, marginTop: 2 }}>
              Hotkeys gelten nur, wenn du <b>nicht</b> in einem Textfeld bist.
            </div>
          </div>
          <button style={btn} onClick={() => nav(-1)}>Zurück</button>
        </div>

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

        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", marginTop: 10 }}>
          <button style={btn} onClick={() => nav("/controls/draft")}>
            Draft Hotkeys →
          </button>

          <button
            style={btnDanger}
            onClick={() => {
              setHk(DEFAULT_HOTKEYS);
              saveHotkeys(DEFAULT_HOTKEYS);
            }}
            title="Auf Standard zurücksetzen"
          >
            Reset
          </button>
        </div>

        <div style={{ marginTop: 10, opacity: 0.7, fontSize: 12 }}>
          Tipp: Klicke ins Feld und drücke die gewünschte Taste/Kombination. ESC bricht das Recording ab.
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, onChange }) {
  return (
    <div style={row}>
      <div style={{ fontWeight: 900 }}>{label}</div>
      <KeyBindInput value={value} onChange={onChange} />
    </div>
  );
}

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
const section = { marginTop: 14, borderTop: "1px solid rgba(255,255,255,0.12)", paddingTop: 12, display: "grid", gap: 10 };
const h2 = { fontWeight: 950, opacity: 0.9 };
const row = { display: "grid", gap: 8, padding: 10, borderRadius: 14, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)" };
const inp = { flex: 1, minWidth: 240, padding: "10px 12px", borderRadius: 12, border: "1px solid rgba(255,255,255,0.18)", background: "rgba(10,10,16,0.7)", color: "white", fontWeight: 900 };
const btn = { padding: "10px 12px", borderRadius: 12, border: "1px solid rgba(255,255,255,0.18)", background: "rgba(255,255,255,0.08)", color: "white", fontWeight: 900, cursor: "pointer" };
const btnDanger = { ...btn, border: "1px solid rgba(255,120,120,0.28)", background: "linear-gradient(135deg, rgba(255,65,108,0.32), rgba(255,75,43,0.18))" };
