// src/pages/HomeMode.jsx
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";

export default function HomeMode() {
  const nav = useNavigate();
  const [onlineOpen, setOnlineOpen] = useState(false);

  return (
    <div style={wrap}>
      <div style={card}>
        <div style={{ fontSize: 26, fontWeight: 950, marginBottom: 6 }}>Start</div>
        <div style={{ opacity: 0.8, marginBottom: 16 }}>
          Wähle, wie du spielen willst.
        </div>

        <div style={{ display: "grid", gap: 12 }}>
          <button style={btnGreen} onClick={() => nav("/solo")}>
            Solo
          </button>

          <button
  style={btnBlue}
  onClick={() => setOnlineOpen((v) => !v)}
>
  Online {onlineOpen ? "▲" : "▼"}
</button>
{onlineOpen && (
  <div style={onlinePanel}>
    <button style={btnGreen} onClick={() => nav("/soullink")}>
      Soullink
    </button>

    <button style={btnPurple} onClick={() => nav("/versus")}>
      Draft
    </button>
  </div>
)}
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

const btnGreen = {
  ...baseBtn,
  background: "linear-gradient(135deg, rgba(67,233,123,0.30), rgba(56,249,215,0.16))",
};

const btnBlue = {
  ...baseBtn,
  background: "linear-gradient(135deg, rgba(79,172,254,0.35), rgba(0,242,254,0.18))",
};
const btnPurple = {
  ...baseBtn,
  background: "linear-gradient(135deg, rgba(161,140,209,0.32), rgba(251,194,235,0.16))",
};

const onlinePanel = {
  marginTop: 10,
  padding: 12,
  borderRadius: 16,
  border: "1px solid rgba(255,255,255,0.14)",
  background: "rgba(10,10,16,0.45)",
  backdropFilter: "blur(10px)",
  display: "grid",
  gap: 10,
};
