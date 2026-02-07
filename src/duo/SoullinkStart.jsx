// src/duo/SoullinkStart.jsx
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { joinDuoRoom } from "./duoService";
import RecentRoomsPanel from "./RecentRoomsPanel";
import { upsertRecentRoom } from "./recentRooms";

export default function SoullinkStart() {
  const nav = useNavigate();

  const [roomId, setRoomId] = useState("");
  const [name, setName] = useState(() => localStorage.getItem("duoPlayerName") || "Spieler");
  const [err, setErr] = useState("");

  useEffect(() => {
    const dn = (name || "Spieler").trim() || "Spieler";
    localStorage.setItem("duoPlayerName", dn);
  }, [name]);

  function cleanId(v) {
    return String(v || "").trim().replace(/\s+/g, "").toUpperCase();
  }

  async function handleJoin() {
    setErr("");
    try {
      const id = cleanId(roomId);
      if (!id) return;

      const dn = (name || "Spieler").trim() || "Spieler";
      localStorage.setItem("duoPlayerName", dn);

      // ✅ Firestore join (wichtig!)
      const res = await joinDuoRoom(id, { displayName: dn });

      // ✅ aktiven Room merken (EncounterTable nutzt das)
      localStorage.setItem("activeDuoRoomId", res.roomId);

      // ✅ Recent Rooms pflegen (minimal)
      upsertRecentRoom({
        roomId: res.roomId,
        linkMode: "duo",
        edition: "",
        title: "",
        lastPlayers: [dn],
      });

      // ✅ ab in die Tabelle
      nav("/table");
    } catch (e) {
      setErr(e?.message || String(e));
    }
  }

  return (
    <div style={wrap}>
      <div style={card}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 26, fontWeight: 950 }}>Soullink</div>
            <div style={{ opacity: 0.8, fontSize: 13 }}>Lobby erstellen oder einem Code beitreten.</div>
          </div>

          <button style={btnGhost} onClick={() => nav("/")}>
            Zur Startseite
          </button>
        </div>

        {/* ✅ Name (oben zentral, kürzer) */}
        <div style={{ marginTop: 14, display: "grid", gap: 8 }}>
          <div style={label}>Dein Name</div>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="z.B. Theo"
            style={inputShort}
          />
        </div>

        <div style={{ marginTop: 16, display: "grid", gap: 14 }}>
          {/* Beitreten */}
          <div style={panel}>
            <div style={{ fontWeight: 950, marginBottom: 8 }}>Lobby beitreten</div>

            <input
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
              placeholder="Code eingeben (z.B. ABCD12)"
              style={inputShort}
            />

            <button style={btnGreen} onClick={handleJoin}>
              Beitreten
            </button>

            {err && <div style={{ color: "crimson", fontWeight: 700, fontSize: 13 }}>{err}</div>}
          </div>

          {/* Erstellen */}
          <div style={panel}>
            <div style={{ fontWeight: 950, marginBottom: 8 }}>Lobby erstellen</div>
            <div style={{ opacity: 0.8, fontSize: 13, marginBottom: 10 }}>
              Öffnet die Seite mit Run-Titel / Modus / Edition.
            </div>

            <button
              type="button"
              style={btnBlue}
              onClick={(e) => {
                e.preventDefault();
                const dn = (name || "Spieler").trim() || "Spieler";
                localStorage.setItem("duoPlayerName", dn);
                nav("/duo", { replace: true });
              }}
            >
              Lobby erstellen
            </button>
          </div>

          {/* ✅ Recent Lobbys direkt hier */}
          <div style={panel}>
            <div style={{ fontWeight: 950, marginBottom: 8 }}>Zuletzt verwendete Lobbys</div>

            <RecentRoomsPanel
              ttlDays={7}
              onReconnect={(room) => {
                localStorage.setItem("activeDuoRoomId", room.roomId);
                upsertRecentRoom(room);
                nav("/table", { replace: true });
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ===================== STYLES ===================== */

const wrap = {
  minHeight: "100vh",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 16,

  // ⭐ Hintergrund hinzufügen
  backgroundImage: "url('/backgrounds/background_1.png')",
  backgroundSize: "cover",
  backgroundPosition: "center",
  backgroundRepeat: "no-repeat",
};


const card = {
  width: "min(560px, 92vw)",
  padding: 16,
  borderRadius: 18,
  border: "1px solid rgba(255,255,255,0.14)",
  background: "rgba(10,10,16,0.55)",
  backdropFilter: "blur(10px)",
  color: "white",
};

const label = { fontSize: 12, opacity: 0.85, fontWeight: 900 };

const panel = {
  padding: 12,
  borderRadius: 16,
  border: "1px solid rgba(255,255,255,0.14)",
  background: "rgba(255,255,255,0.06)",
  display: "grid",
  gap: 10,
};

// ✅ kürzere Inputs (nicht volle Card-Breite)
const inputShort = {
  width: "min(420px, 100%)",
  boxSizing: "border-box",
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.14)",
  background: "rgba(0,0,0,0.25)",
  color: "white",
  outline: "none",
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

const baseBtn = {
  width: "min(420px, 100%)",
  padding: "12px 12px",
  borderRadius: 14,
  border: "1px solid rgba(255,255,255,0.14)",
  color: "white",
  cursor: "pointer",
  fontWeight: 950,
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
