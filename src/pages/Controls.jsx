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

const card = {
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(0, 0, 0, 0.55)",
  borderRadius: 14,
  padding: 14,
  color: "white",
};

const tabRow = { display: "flex", gap: 10, flexWrap: "wrap" };
const tabBtn = {
  padding: "8px 10px",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.14)",
  background: "rgba(255,255,255,0.06)",
  color: "white",
  cursor: "pointer",
  fontWeight: 900,
};
const tabBtnActive = {
  ...tabBtn,
  background: "rgba(255,255,255,0.12)",
  border: "1px solid rgba(255,255,255,0.22)",
};

function Row({ title, value, onChange, conflict }) {
  const hasValue = !!normalizeKeyCombo(value);

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 180px 110px", gap: 10, alignItems: "center" }}>
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
        value={formatKeyForDisplay(value)}
        placeholder="—"
        readOnly
        style={{
          padding: "10px 12px",
          borderRadius: 12,
          border: "1px solid rgba(255,255,255,0.14)",
          background: "rgba(0,0,0,0.35)",
          color: "white",
          fontWeight: 900,
          outline: "none",
        }}
        onKeyDown={(e) => {
          e.preventDefault();
          e.stopPropagation();
          const combo = normalizeKeyComboFromEvent(e);
          if (!combo) return; // reine Mod-Taste ignorieren
          onChange(combo);
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
        style={{
          padding: "10px 12px",
          borderRadius: 12,
          border: "1px solid rgba(255,255,255,0.14)",
          background: hasValue ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.02)",
          color: "white",
          cursor: hasValue ? "pointer" : "not-allowed",
          fontWeight: 950,
          opacity: hasValue ? 1 : 0.45,
          textAlign: "center",
        }}
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
    <div style={{ padding: 16, maxWidth: 980, margin: "0 auto" }}>
      <div style={{ ...card }}>
        {/* ✅ Header mit Zurück-Button */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
          <div style={{ fontSize: 20, fontWeight: 950 }}>Steuerung</div>

          <button
            type="button"
            onClick={() => nav(-1)}
            style={{
              padding: "8px 12px",
              borderRadius: 12,
              border: "1px solid rgba(255,255,255,0.14)",
              background: "rgba(255,255,255,0.06)",
              color: "white",
              cursor: "pointer",
              fontWeight: 950,
            }}
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
          <button style={tab === "soullink" ? tabBtnActive : tabBtn} onClick={() => setTab("soullink")}>
            Soullink
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
    </div>
  );
}
