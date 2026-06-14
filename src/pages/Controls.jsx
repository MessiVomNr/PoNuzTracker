// src/pages/Controls.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  DEFAULT_HOTKEYS,
  loadHotkeys,
  saveHotkeys,
  normalizeKeyComboFromEvent,
  normalizeKeyCombo,
  isTypingTarget,
  findConflict,
  formatKeyForDisplay,
  labelHotkey,
} from "../utils/hotkeys";
import DexBackground from "../assets/DexBackground.png";

const pageShell = {
  minHeight: "100vh",
  padding: 16,
  color: "#f8fafc",
  backgroundImage:
    `linear-gradient(180deg, rgba(3, 7, 18, 0.54), rgba(3, 7, 18, 0.86)), url(${DexBackground})`,
  backgroundSize: "cover",
  backgroundPosition: "center",
  backgroundRepeat: "no-repeat",
  backgroundAttachment: "fixed",
};

const pageWrap = {
  maxWidth: 980,
  margin: "0 auto",
};

const card = {
  border: "1px solid rgba(137,155,184,0.26)",
  background:
    "radial-gradient(circle at 0% 0%, rgba(52,211,153,0.075), transparent 44%), linear-gradient(180deg, rgba(10,18,33,0.94), rgba(5,11,21,0.92))",
  borderRadius: 14,
  padding: 14,
  color: "#f8fafc",
  boxShadow:
    "0 18px 50px rgba(0,0,0,0.38), inset 0 1px 0 rgba(255,255,255,0.045)",
};

const tabRow = {
  display: "flex",
  gap: 10,
  flexWrap: "wrap",
};

const tabBtn = {
  padding: "9px 12px",
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

const tabBtnActive = {
  ...tabBtn,
  border: "1px solid rgba(52,211,153,0.5)",
  background:
    "radial-gradient(circle at 0% 0%, rgba(52,211,153,0.18), transparent 46%), linear-gradient(180deg, rgba(13,44,34,0.88), rgba(8,20,18,0.88))",
  boxShadow:
    "0 0 0 1px rgba(52,211,153,0.14), 0 10px 20px rgba(0,0,0,0.2)",
};

const rowStyle = {
  display: "grid",
  gridTemplateColumns: "1fr 180px 110px",
  gap: 10,
  alignItems: "center",
  padding: 10,
  borderRadius: 12,
  border: "1px solid rgba(137,155,184,0.16)",
  background:
    "linear-gradient(180deg, rgba(13,24,42,0.54), rgba(8,15,28,0.54))",
};

const keyInputStyle = {
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid rgba(137,155,184,0.3)",
  background:
    "linear-gradient(180deg, rgba(13,24,42,0.96), rgba(8,15,28,0.96))",
  color: "#f8fafc",
  fontWeight: 950,
  outline: "none",
  boxShadow:
    "inset 0 1px 0 rgba(255,255,255,0.045), 0 8px 18px rgba(0,0,0,0.18)",
};

const keyInputActiveStyle = {
  ...keyInputStyle,
  border: "1px solid rgba(52,211,153,0.78)",
  background:
    "radial-gradient(circle at 0% 0%, rgba(52,211,153,0.16), transparent 46%), linear-gradient(180deg, rgba(13,44,34,0.96), rgba(8,20,18,0.96))",
  color: "#ffffff",
  boxShadow:
    "0 0 0 3px rgba(52,211,153,0.14), 0 0 24px rgba(52,211,153,0.18), inset 0 1px 0 rgba(255,255,255,0.055)",
};

const rowActiveStyle = {
  ...rowStyle,
  border: "1px solid rgba(52,211,153,0.42)",
  background:
    "radial-gradient(circle at 0% 0%, rgba(52,211,153,0.10), transparent 46%), linear-gradient(180deg, rgba(13,24,42,0.68), rgba(8,15,28,0.68))",
};

const clearButtonStyle = (hasValue) => ({
  padding: "10px 12px",
  borderRadius: 10,
  border: hasValue
    ? "1px solid rgba(248,113,113,0.32)"
    : "1px solid rgba(120,138,170,0.22)",
  background: hasValue
    ? "linear-gradient(180deg, rgba(127,29,29,0.34), rgba(69,10,10,0.34))"
    : "linear-gradient(180deg, rgba(13,24,42,0.48), rgba(8,15,28,0.48))",
  color: hasValue ? "#fee2e2" : "rgba(248,250,252,0.48)",
  cursor: hasValue ? "pointer" : "not-allowed",
  fontWeight: 950,
  opacity: hasValue ? 1 : 0.58,
  textAlign: "center",
  boxShadow: hasValue
    ? "inset 0 1px 0 rgba(255,255,255,0.035), 0 8px 18px rgba(0,0,0,0.18)"
    : "none",
});

const backButtonStyle = {
  padding: "8px 12px",
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

function Row({ title, value, onChange, conflict }) {
  const hasValue = !!normalizeKeyCombo(value);
  const [isCapturing, setIsCapturing] = useState(false);

  return (
    <div style={isCapturing ? rowActiveStyle : rowStyle}>
      <div>
        <div style={{ fontWeight: 950 }}>{title}</div>
        {conflict ? (
          <div style={{ marginTop: 4, fontSize: 12, color: "rgba(255,120,120,0.95)" }}>
            Konflikt mit: {labelHotkey(conflict.scope, conflict.key)}
          </div>
        ) : (
          <div style={{ marginTop: 4, fontSize: 12, opacity: 0.7 }}> </div>
        )}
      </div>

      <input
        value={isCapturing ? "Taste drücken" : formatKeyForDisplay(value)}
        placeholder="—"
        readOnly
        style={isCapturing ? keyInputActiveStyle : keyInputStyle}
        onFocus={() => setIsCapturing(true)}
        onBlur={() => setIsCapturing(false)}
        onKeyDown={(e) => {
          e.preventDefault();
          e.stopPropagation();
          const combo = normalizeKeyComboFromEvent(e);
          if (!combo) return; // reine Mod-Taste ignorieren
          onChange(combo);
          setIsCapturing(false);
          e.currentTarget.blur();
        }}
      />

      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onChange("");
        }}
        disabled={!hasValue}
        title={hasValue ? "Hotkey löschen (unbelegt)" : "Bereits unbelegt"}
        style={clearButtonStyle(hasValue)}
      >
        Löschen
      </button>
    </div>
  );
}

export default function Controls() {
  const nav = useNavigate();

  const [hk, setHk] = useState(() => loadHotkeys());
  const [tab, setTab] = useState("general"); // "general" | "draft" | "soullink"

  useEffect(() => {
    setHk(loadHotkeys());
  }, []);

  const general = hk.general || DEFAULT_HOTKEYS.general;
  const draft = hk.draft || DEFAULT_HOTKEYS.draft;
  const soullink = hk.soullink || DEFAULT_HOTKEYS.soullink;
  const games = hk.games || DEFAULT_HOTKEYS.games;

  function setHotkeyChecked(scope, key, value) {
    const v = normalizeKeyCombo(value);
    const next = {
      ...hk,
      [scope]: { ...(hk[scope] || {}), [key]: v },
    };
    setHk(next);
    saveHotkeys(next);
  }

  const conflicts = useMemo(() => {
    const out = {};
    for (const scope of Object.keys(hk || {})) {
      for (const key of Object.keys(hk?.[scope] || {})) {
        const val = hk?.[scope]?.[key];
        const c = findConflict(hk, scope, key, val);
        if (c) out[`${scope}.${key}`] = c;
      }
    }
    return out;
  }, [hk]);

  // optional: verhindert nix aktiv, aber lässt dir Platz, falls du später was hooken willst
  useEffect(() => {
    function stopIfTyping(e) {
      if (!isTypingTarget(e)) return;
    }
    window.addEventListener("keydown", stopIfTyping, { capture: true });
    return () => window.removeEventListener("keydown", stopIfTyping, { capture: true });
  }, []);

  return (
    <div style={pageShell}>
      <div style={pageWrap}>
        <div style={{ ...card }}>
        {/* ✅ Header mit Zurück-Button */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
          <div style={{ fontSize: 20, fontWeight: 950 }}>Steuerung</div>

          <button
            type="button"
            onClick={() => nav(-1)}
            style={backButtonStyle}
            title="Schließen"
          >
            Zurück
          </button>
        </div>

        <div style={{ marginTop: 6, opacity: 0.8, fontSize: 13 }}>
          Klicke ins Feld und drücke die gewünschte Tastenkombi (z.B. Strg+K). Nochmal überschreibt.
        </div>

        <div style={{ marginTop: 14, ...tabRow }}>
          <button style={tab === "general" ? tabBtnActive : tabBtn} onClick={() => setTab("general")}>
            Allgemein
          </button>
          <button style={tab === "draft" ? tabBtnActive : tabBtn} onClick={() => setTab("draft")}>
            Draft
          </button>
          <button style={tab === "games" ? tabBtnActive : tabBtn} onClick={() => setTab("games")}>
            Games
          </button>
        </div>
      </div>

      {tab === "general" && (
        <div style={{ ...card, marginTop: 12, display: "grid", gap: 12 }}>
          <Row
            title={labelHotkey("general", "openPokedex")}
            value={general.openPokedex}
            conflict={conflicts["general.openPokedex"]}
            onChange={(v) => setHotkeyChecked("general", "openPokedex", v)}
          />
          <Row
            title={labelHotkey("general", "openMoveDex")}
            value={general.openMoveDex}
            conflict={conflicts["general.openMoveDex"]}
            onChange={(v) => setHotkeyChecked("general", "openMoveDex", v)}
          />
          <Row
            title={labelHotkey("general", "openTypeCalculator")}
            value={general.openTypeCalculator}
            conflict={conflicts["general.openTypeCalculator"]}
            onChange={(v) => setHotkeyChecked("general", "openTypeCalculator", v)}
          />
          
          <Row
            title={labelHotkey("general", "openTeamCompare")}
            value={general.openTeamCompare}
            conflict={conflicts["general.openTeamCompare"]}
            onChange={(v) => setHotkeyChecked("general", "openTeamCompare", v)}
          />

          {/* ✅ Level-Cap Hotkeys (K/L default, aber bindbar) */}
          <Row
            title={labelHotkey("general", "nextLevelCap")}
            value={general.nextLevelCap}
            conflict={conflicts["general.nextLevelCap"]}
            onChange={(v) => setHotkeyChecked("general", "nextLevelCap", v)}
          />
          <Row
            title={labelHotkey("general", "prevLevelCap")}
            value={general.prevLevelCap}
            conflict={conflicts["general.prevLevelCap"]}
            onChange={(v) => setHotkeyChecked("general", "prevLevelCap", v)}
          />

          <Row
            title={labelHotkey("general", "toggleMute")}
            value={general.toggleMute}
            conflict={conflicts["general.toggleMute"]}
            onChange={(v) => setHotkeyChecked("general", "toggleMute", v)}
          />
          <Row
            title={labelHotkey("general", "menuToggle")}
            value={general.menuToggle}
            conflict={conflicts["general.menuToggle"]}
            onChange={(v) => setHotkeyChecked("general", "menuToggle", v)}
          />
          <Row
            title={labelHotkey("general", "goHome")}
            value={general.goHome}
            conflict={conflicts["general.goHome"]}
            onChange={(v) => setHotkeyChecked("general", "goHome", v)}
          />
          <Row
            title={labelHotkey("general", "goLobby")}
            value={general.goLobby}
            conflict={conflicts["general.goLobby"]}
            onChange={(v) => setHotkeyChecked("general", "goLobby", v)}
          />
          <Row
            title={labelHotkey("general", "goBack")}
            value={general.goBack}
            conflict={conflicts["general.goBack"]}
            onChange={(v) => setHotkeyChecked("general", "goBack", v)}
          />
        </div>
      )}

      {tab === "draft" && (
        <div style={{ ...card, marginTop: 12, display: "grid", gap: 12 }}>
          <Row
            title={labelHotkey("draft", "bidSubmit")}
            value={draft.bidSubmit}
            conflict={conflicts["draft.bidSubmit"]}
            onChange={(v) => setHotkeyChecked("draft", "bidSubmit", v)}
          />
          <Row
            title={labelHotkey("draft", "allIn")}
            value={draft.allIn}
            conflict={conflicts["draft.allIn"]}
            onChange={(v) => setHotkeyChecked("draft", "allIn", v)}
          />
          <Row
            title={labelHotkey("draft", "plus100")}
            value={draft.plus100}
            conflict={conflicts["draft.plus100"]}
            onChange={(v) => setHotkeyChecked("draft", "plus100", v)}
          />
          <Row
            title={labelHotkey("draft", "minus100")}
            value={draft.minus100}
            conflict={conflicts["draft.minus100"]}
            onChange={(v) => setHotkeyChecked("draft", "minus100", v)}
          />
          <Row
            title={labelHotkey("draft", "plus10")}
            value={draft.plus10}
            conflict={conflicts["draft.plus10"]}
            onChange={(v) => setHotkeyChecked("draft", "plus10", v)}
          />
          <Row
            title={labelHotkey("draft", "minus10")}
            value={draft.minus10}
            conflict={conflicts["draft.minus10"]}
            onChange={(v) => setHotkeyChecked("draft", "minus10", v)}
          />
          <Row
            title={labelHotkey("draft", "plus1")}
            value={draft.plus1}
            conflict={conflicts["draft.plus1"]}
            onChange={(v) => setHotkeyChecked("draft", "plus1", v)}
          />
          <Row
            title={labelHotkey("draft", "minus1")}
            value={draft.minus1}
            conflict={conflicts["draft.minus1"]}
            onChange={(v) => setHotkeyChecked("draft", "minus1", v)}
          />
          <Row
            title={labelHotkey("draft", "togglePause")}
            value={draft.togglePause}
            conflict={conflicts["draft.togglePause"]}
            onChange={(v) => setHotkeyChecked("draft", "togglePause", v)}
          />
        </div>
      )}

      {tab === "soullink" && (
        <div style={{ ...card, marginTop: 12, display: "grid", gap: 12 }}>
          <Row
            title={labelHotkey("soullink", "goTeam")}
            value={soullink.goTeam}
            conflict={conflicts["soullink.goTeam"]}
            onChange={(v) => setHotkeyChecked("soullink", "goTeam", v)}
          />
          <Row
            title={labelHotkey("soullink", "goGuide")}
            value={soullink.goGuide}
            conflict={conflicts["soullink.goGuide"]}
            onChange={(v) => setHotkeyChecked("soullink", "goGuide", v)}
          />
        </div>
      )}
      
      {tab === "games" && (
        <div style={{ ...card, marginTop: 12, display: "grid", gap: 12 }}>
          <Row
            title={labelHotkey("games", "higherLowerHigher")}
            value={games.higherLowerHigher}
            conflict={conflicts["games.higherLowerHigher"]}
            onChange={(v) => setHotkeyChecked("games", "higherLowerHigher", v)}
          />
          <Row
            title={labelHotkey("games", "higherLowerLower")}
            value={games.higherLowerLower}
            conflict={conflicts["games.higherLowerLower"]}
            onChange={(v) => setHotkeyChecked("games", "higherLowerLower", v)}
          />
          <Row
            title={labelHotkey("games", "higherLowerEqual")}
            value={games.higherLowerEqual}
            conflict={conflicts["games.higherLowerEqual"]}
            onChange={(v) => setHotkeyChecked("games", "higherLowerEqual", v)}
          />
          <Row
            title={labelHotkey("games", "nextPokemon")}
            value={games.nextPokemon}
            conflict={conflicts["games.nextPokemon"]}
            onChange={(v) => setHotkeyChecked("games", "nextPokemon", v)}
          />
        </div>
      )}

      </div>
    </div>
  );
}
