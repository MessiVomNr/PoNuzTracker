// src/pages/OnlineMode.jsx
import React from "react";
import { useNavigate } from "react-router-dom";

export default function OnlineMode() {
  const nav = useNavigate();

  return (
    <div style={wrap}>
      <div style={card}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 26, fontWeight: 950, marginBottom: 6 }}>Online</div>
            <div style={{ opacity: 0.8 }}>Wähle den Online-Modus.</div>
          </div>
          <button style={btnGhost} onClick={() => nav(-1)}>Zurück</button>
        </div>

        <div style={{ display: "grid", gap: 12, marginTop: 16 }}>
          {/* Soullink = aktuelle Online-Seite */}
          <button style={btnGreen} onClick={() => nav("/duo")}>
            Soullink
          </button>

          {/* Draft = aktuelle Versus-Seite */}
          <button style={btnPurple} onClick={() => nav("/versus")}>
            Draft
          </button>
        </div>
      </div>
    </div>
  );
}

const wrap = {
  minHeight: "100vh",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 16,
};

const card = {
  width: "min(520px, 92vw)",
  padding: 16,
  borderRadius: 18,
  border: "1px solid rgba(255,255,255,0.14)",
  background: "rgba(10,10,16,0.55)",
  backdropFilter: "blur(10px)",
  color: "white",
};

const baseBtn = {
  width: "100%",
  padding: "14px 14px",
  borderRadius: 14,
  border: "1px solid rgba(255,255,255,0.14)",
  color: "white",
  cursor: "pointer",
  fontWeight: 950,
  fontSize: 16,
  textAlign: "left",
};

const btnGhost = {
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.14)",
  background: "rgba(255,255,255,0.06)",
  color: "white",
  cursor: "pointer",
  fontWeight: 900,
};

const btnGreen = {
  ...baseBtn,
  background: "linear-gradient(135deg, rgba(67,233,123,0.30), rgba(56,249,215,0.16))",
};

const btnPurple = {
  ...baseBtn,
  background: "linear-gradient(135deg, rgba(161,140,209,0.32), rgba(251,194,235,0.16))",
};
