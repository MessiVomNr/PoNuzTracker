// src/duo/SoullinkStart.jsx
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { joinDuoRoom } from "./duoService";
import RecentRoomsPanel from "./RecentRoomsPanel";
import { upsertRecentRoom } from "./recentRooms";

const SOULLINK_START_CSS = `
  .soullink-start-page,
  .soullink-start-page * {
    box-sizing: border-box;
  }

  .soullink-start-page::-webkit-scrollbar,
  .soullink-start-page *::-webkit-scrollbar {
    display: none;
  }

  .soullink-start-page,
  .soullink-start-page * {
    scrollbar-width: none;
    -ms-overflow-style: none;
  }

  .soullink-start-page button {
    border-radius: 8px !important;
    font-weight: 950 !important;
    border: 1px solid rgba(140, 165, 210, 0.36) !important;
    background:
      linear-gradient(135deg, rgba(70, 105, 165, 0.18), rgba(28, 42, 74, 0.16)),
      rgba(7, 12, 26, 0.58) !important;
    color: #ffffff !important;
    box-shadow:
      0 10px 22px rgba(0, 0, 0, 0.18),
      inset 0 1px 0 rgba(255, 255, 255, 0.08) !important;
    transition:
      transform 160ms ease,
      border-color 160ms ease,
      background 160ms ease,
      box-shadow 160ms ease,
      filter 160ms ease;
  }

  .soullink-start-page button:hover,
  .soullink-start-page button:focus-visible {
    transform: translateY(-2px);
    border-color: rgba(165, 195, 255, 0.62) !important;
    box-shadow:
      0 14px 28px rgba(0, 0, 0, 0.24),
      0 0 18px rgba(120, 165, 255, 0.12),
      inset 0 1px 0 rgba(255, 255, 255, 0.12) !important;
    outline: none;
    filter: brightness(1.04);
  }

  .soullink-start-page input {
    border-radius: 8px !important;
    transition:
      border-color 160ms ease,
      box-shadow 160ms ease,
      background 160ms ease;
  }

  .soullink-start-page input:focus {
    border-color: rgba(126, 165, 255, 0.72) !important;
    box-shadow:
      0 0 0 2px rgba(90, 130, 220, 0.18),
      0 0 18px rgba(120, 165, 255, 0.12),
      inset 0 1px 0 rgba(255, 255, 255, 0.06) !important;
  }

  .soullink-start-page .soullink-primary-button {
    border-color: rgba(67, 233, 123, 0.34) !important;
    background:
      linear-gradient(135deg, rgba(20, 84, 67, 0.34), rgba(10, 18, 32, 0.30)),
      rgba(6, 13, 25, 0.58) !important;
  }

  .soullink-start-page .soullink-primary-button:hover,
  .soullink-start-page .soullink-primary-button:focus-visible {
    border-color: rgba(67, 233, 123, 0.52) !important;
    box-shadow:
      0 14px 28px rgba(0, 0, 0, 0.24),
      0 0 18px rgba(67, 233, 123, 0.14),
      inset 0 1px 0 rgba(255, 255, 255, 0.12) !important;
  }

  .soullink-start-page .soullink-secondary-button {
    border-color: rgba(80, 170, 255, 0.34) !important;
    background:
      linear-gradient(135deg, rgba(45, 94, 140, 0.34), rgba(10, 18, 32, 0.30)),
      rgba(6, 13, 25, 0.58) !important;
  }

  .soullink-start-page .soullink-secondary-button:hover,
  .soullink-start-page .soullink-secondary-button:focus-visible {
    border-color: rgba(120, 195, 255, 0.52) !important;
    box-shadow:
      0 14px 28px rgba(0, 0, 0, 0.24),
      0 0 18px rgba(80, 170, 255, 0.14),
      inset 0 1px 0 rgba(255, 255, 255, 0.12) !important;
  }
`;

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
    <div className="soullink-start-page" style={wrap}>
      <style>{SOULLINK_START_CSS}</style>

      <div style={bg} />
      <div style={overlay} />

      <div style={card}>
        <header style={header}>
          <div>
            <div style={kicker}>Soullink Lobby</div>
            <h1 style={title}>Soullink</h1>
          </div>

          <button style={btnGhost} onClick={() => nav("/")}>
            Zur Startseite
          </button>
        </header>

        {/* ✅ Name (oben zentral, kürzer) */}
        <div style={{ marginTop: 14, display: "grid", gap: 8 }}>
          <div style={label}>Dein Name</div>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="z.B. Achim"
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
            <button
              className="soullink-primary-button"
              style={btnGreen}
              onClick={handleJoin}
            >
              Beitreten
            </button>

            {err && <div style={{ color: "crimson", fontWeight: 700, fontSize: 13 }}>{err}</div>}
          </div>

          {/* Erstellen */}
          <div style={panel}>
            <div style={{ fontWeight: 950, marginBottom: 8 }}>Lobby erstellen</div>

            <button
              type="button"
              className="soullink-secondary-button"
              style={btnBlue}
              onClick={(e) => {
                e.preventDefault();
                const dn = (name || "Spieler").trim() || "Spieler";
                localStorage.setItem("duoPlayerName", dn);
                nav("/duo/create", { replace: true });
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
  position: "relative",
  overflowX: "hidden",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "24px 18px",
};

const bg = {
  position: "absolute",
  inset: 0,
  backgroundImage: `url("/backgrounds/background_1.png")`,
  backgroundSize: "cover",
  backgroundPosition: "center",
  backgroundRepeat: "no-repeat",
  transform: "scale(1.025)",
  zIndex: 0,
  filter: "saturate(1.05) brightness(0.76)",
};

const overlay = {
  position: "absolute",
  inset: 0,
  background:
    "radial-gradient(760px 520px at 18% 16%, rgba(255, 120, 60, 0.13), transparent 62%), radial-gradient(840px 560px at 82% 18%, rgba(66, 153, 225, 0.16), transparent 64%), linear-gradient(180deg, rgba(3, 7, 18, 0.50), rgba(3, 7, 18, 0.84))",
  zIndex: 1,
};

const card = {
  width: "min(620px, 94vw)",
  padding: 22,
  borderRadius: 22,
  border: "1px solid rgba(180, 205, 255, 0.14)",
  background:
    "linear-gradient(145deg, rgba(15, 23, 42, 0.78), rgba(5, 9, 20, 0.68))",
  backdropFilter: "blur(14px)",
  boxShadow:
    "0 30px 90px rgba(0, 0, 0, 0.50), inset 0 1px 0 rgba(255, 255, 255, 0.10)",
  color: "white",
  position: "relative",
  zIndex: 2,
};

const header = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: 16,
  marginBottom: 18,
};

const kicker = {
  color: "#43e97b",
  textTransform: "uppercase",
  letterSpacing: "0.18em",
  fontSize: 12,
  fontWeight: 950,
  marginBottom: 10,
};

const title = {
  margin: 0,
  color: "#ffffff",
  fontSize: 40,
  lineHeight: 0.95,
  fontWeight: 950,
  letterSpacing: "-0.04em",
  textShadow: "3px 3px #079e4b",
};

const subtitle = {
  margin: "10px 0 0",
  maxWidth: 410,
  color: "rgba(255, 255, 255, 0.74)",
  fontSize: 14,
  lineHeight: 1.45,
  fontWeight: 750,
};

const label = {
  fontSize: 13,
  color: "rgba(255, 255, 255, 0.82)",
  fontWeight: 900,
};

const panel = {
  padding: 14,
  borderRadius: 16,
  border: "1px solid rgba(180, 205, 255, 0.13)",
  background:
    "linear-gradient(145deg, rgba(15, 23, 42, 0.56), rgba(5, 10, 24, 0.46))",
  boxShadow: "inset 0 1px 0 rgba(255, 255, 255, 0.07)",
  backdropFilter: "blur(12px)",
  display: "grid",
  gap: 10,
};

const inputShort = {
  width: "min(420px, 100%)",
  boxSizing: "border-box",
  padding: "12px 14px",
  minHeight: 44,
  borderRadius: 8,
  border: "1px solid rgba(140, 165, 210, 0.34)",
  background:
    "linear-gradient(135deg, rgba(14, 23, 42, 0.90), rgba(8, 13, 28, 0.88))",
  color: "white",
  outline: "none",
  fontWeight: 850,
  boxShadow: "inset 0 1px 0 rgba(255, 255, 255, 0.06)",
};

const btnGhost = {
  flex: "0 0 auto",
  padding: "10px 14px",
  borderRadius: 8,
  border: "1px solid rgba(140, 165, 210, 0.36)",
  background:
    "linear-gradient(135deg, rgba(70, 105, 165, 0.18), rgba(28, 42, 74, 0.16)), rgba(7, 12, 26, 0.58)",
  color: "white",
  cursor: "pointer",
  fontWeight: 950,
  boxShadow:
    "0 10px 22px rgba(0, 0, 0, 0.18), inset 0 1px 0 rgba(255, 255, 255, 0.08)",
};

const baseBtn = {
  width: "min(420px, 100%)",
  padding: "12px 14px",
  minHeight: 46,
  borderRadius: 8,
  border: "1px solid rgba(140, 165, 210, 0.36)",
  color: "white",
  cursor: "pointer",
  fontWeight: 950,
  textAlign: "left",
  boxShadow:
    "0 10px 22px rgba(0, 0, 0, 0.18), inset 0 1px 0 rgba(255, 255, 255, 0.08)",
};

const btnGreen = {
  ...baseBtn,
  border: "1px solid rgba(67, 233, 123, 0.34)",
  background:
    "linear-gradient(135deg, rgba(20, 84, 67, 0.34), rgba(10, 18, 32, 0.30)), rgba(6, 13, 25, 0.58)",
};

const btnBlue = {
  ...baseBtn,
  border: "1px solid rgba(80, 170, 255, 0.34)",
  background:
    "linear-gradient(135deg, rgba(45, 94, 140, 0.34), rgba(10, 18, 32, 0.30)), rgba(6, 13, 25, 0.58)",
};