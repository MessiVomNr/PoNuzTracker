// src/pages/ControlsDraft.jsx
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { DEFAULT_HOTKEYS, loadHotkeys, saveHotkeys } from "../utils/hotkeys";
import { normalizeKeyComboFromEvent } from "../utils/hotkeys";

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
      <button style={btn} onClick={() => onChange("")}>Löschen</button>
    </div>
  );
}

export default function ControlsDraft() {
  const nav = useNavigate();
  const [hk, setHk] = useState(() => loadHotkeys());
useEffect(() => {
  function onEsc(e) {
    if (e.key !== "Escape") return;
    nav(-1);
  }

  window.addEventListener("keydown", onEsc);
  return () => window.removeEventListener("keydown", onEsc);
}, [nav]);

  useEffect(() => saveHotkeys(hk), [hk]);

  const draft = hk.draft || DEFAULT_HOTKEYS.draft;

  return (
    <div style={wrap}>
      <div style={card}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 950 }}>Draft Hotkeys</div>
            <div style={{ opacity: 0.8, marginTop: 2 }}>
              Hotkeys gelten nur, wenn du nicht in einem Textfeld bist.
            </div>
          </div>
          <button style={btn} onClick={() => nav(-1)}>Zurück</button>
        </div>

        <div style={section}>
          <Row label="Bieten (submit)" value={draft.bidSubmit} onChange={(v) => setHk((p) => ({ ...p, draft: { ...p.draft, bidSubmit: v } }))} />
          <Row label="All-in" value={draft.allIn} onChange={(v) => setHk((p) => ({ ...p, draft: { ...p.draft, allIn: v } }))} />
            <Row
  label="Pause / Fortfahren"
  value={draft.togglePause}
  onChange={(v) => setHk((p) => ({ ...p, draft: { ...p.draft, togglePause: v } }))}
 />
        </div>

        <div style={section}>
          <div style={h2}>Gebot ändern</div>
          <Row label="+100" value={draft.plus100} onChange={(v) => setHk((p) => ({ ...p, draft: { ...p.draft, plus100: v } }))} />
          <Row label="-100" value={draft.minus100} onChange={(v) => setHk((p) => ({ ...p, draft: { ...p.draft, minus100: v } }))} />
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", marginTop: 10 }}>
          <button style={btn} onClick={() => nav("/controls")}>← Allgemein</button>
          <button
            style={btnDanger}
            onClick={() => {
              setHk(DEFAULT_HOTKEYS);
              saveHotkeys(DEFAULT_HOTKEYS);
            }}
          >
            Reset
          </button>
        </div>

        <div style={{ marginTop: 10, opacity: 0.7, fontSize: 12 }}>
          Tipp: Wähle Tasten, die nicht mit Browser-Shortcuts kollidieren.
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
const card = { maxWidth: 900, margin: "0 auto", borderRadius: 18, border: "1px solid rgba(255,255,255,0.14)", background: "rgba(10,10,16,0.82)", boxShadow: "0 30px 90px rgba(0,0,0,0.65)", padding: 16 };
const section = { marginTop: 14, borderTop: "1px solid rgba(255,255,255,0.12)", paddingTop: 12, display: "grid", gap: 10 };
const h2 = { fontWeight: 950, opacity: 0.9 };
const row = { display: "grid", gap: 8, padding: 10, borderRadius: 14, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)" };
const inp = { flex: 1, minWidth: 240, padding: "10px 12px", borderRadius: 12, border: "1px solid rgba(255,255,255,0.18)", background: "rgba(10,10,16,0.7)", color: "white", fontWeight: 900 };
const btn = { padding: "10px 12px", borderRadius: 12, border: "1px solid rgba(255,255,255,0.18)", background: "rgba(255,255,255,0.08)", color: "white", fontWeight: 900, cursor: "pointer" };
const btnDanger = { ...btn, border: "1px solid rgba(255,120,120,0.28)", background: "linear-gradient(135deg, rgba(255,65,108,0.32), rgba(255,75,43,0.18))" };
