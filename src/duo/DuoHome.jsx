// src/duo/DuoHome.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { createDuoRoom } from "./duoService";
import RecentRoomsPanel from "./RecentRoomsPanel";
import { upsertRecentRoom } from "./recentRooms";
import DarkSelect from "../components/DarkSelect";

import editionData from "../data/editionData.js";
import { getGenFromEdition } from "../utils/editionHelpers";

const DUO_HOME_CSS = `
  .duo-home-page,
  .duo-home-page * {
    box-sizing: border-box;
  }

  .duo-home-page::-webkit-scrollbar,
  .duo-home-page *::-webkit-scrollbar {
    display: none;
  }

  .duo-home-page,
  .duo-home-page * {
    scrollbar-width: none;
    -ms-overflow-style: none;
  }

  .duo-home-page select.darkSelect {
    color-scheme: dark;
  }

  .duo-home-page select.darkSelect option {
    background: #0b0f16;
    color: #e5e7eb;
  }

  .duo-home-page select.darkSelect optgroup {
    background: #0b0f16;
    color: #9ca3af;
    font-weight: 900;
  }

  .duo-home-page select.darkSelect option:checked {
    background: #111827;
    color: #ffffff;
  }

  .duo-home-page button {
    border-radius: 8px !important;
    font-weight: 950 !important;
    transition:
      transform 160ms ease,
      border-color 160ms ease,
      background 160ms ease,
      box-shadow 160ms ease,
      filter 160ms ease;
  }

  .duo-home-page button:hover,
  .duo-home-page button:focus-visible {
    transform: translateY(-2px);
    border-color: rgba(165, 195, 255, 0.62) !important;
    box-shadow:
      0 14px 28px rgba(0, 0, 0, 0.24),
      0 0 18px rgba(120, 165, 255, 0.12),
      inset 0 1px 0 rgba(255, 255, 255, 0.12) !important;
    outline: none;
    filter: brightness(1.04);
  }

  .duo-home-page input,
  .duo-home-page select {
    transition:
      border-color 160ms ease,
      box-shadow 160ms ease,
      background 160ms ease;
  }

  .duo-home-page input:focus,
  .duo-home-page select:focus {
    border-color: rgba(126, 165, 255, 0.72) !important;
    box-shadow:
      0 0 0 2px rgba(90, 130, 220, 0.18),
      0 0 18px rgba(120, 165, 255, 0.12),
      inset 0 1px 0 rgba(255, 255, 255, 0.06) !important;
  }

  .duo-home-page .duo-create-button {
    border-color: rgba(67, 233, 123, 0.34) !important;
    background:
      linear-gradient(135deg, rgba(20, 84, 67, 0.34), rgba(10, 18, 32, 0.30)),
      rgba(6, 13, 25, 0.58) !important;
  }

  .duo-home-page .duo-create-button:hover,
  .duo-home-page .duo-create-button:focus-visible {
    border-color: rgba(67, 233, 123, 0.52) !important;
    box-shadow:
      0 14px 28px rgba(0, 0, 0, 0.24),
      0 0 18px rgba(67, 233, 123, 0.14),
      inset 0 1px 0 rgba(255, 255, 255, 0.12) !important;
  }
`;

export default function DuoHome() {
  const nav = useNavigate();

  // ✅ Name merken
  const [name, setName] = useState(() => localStorage.getItem("duoPlayerName") || "Spieler");

  const [roomTitle, setRoomTitle] = useState("");
  const [mode, setMode] = useState("duo");
  const [edition, setEdition] = useState("Rot");
  const [err, setErr] = useState("");

  // Name immer speichern
  useEffect(() => {
    const dn = (name || "").trim() || "Spieler";
    localStorage.setItem("duoPlayerName", dn);
  }, [name]);

  // ===== Editions-Liste wie Solo (aus editionData) =====
  const editionGroups = useMemo(() => {
    const keys = Object.keys(editionData || {});
    const byGen = new Map();

    for (const ed of keys) {
      const gen = getGenFromEdition(ed) || "Sonstiges";
      if (!byGen.has(gen)) byGen.set(gen, []);
      byGen.get(gen).push(ed);
    }

  const customGenOrder = [1, 2, 3, 32, 33, 4, 42, 5, 52, 6, 62, 7, 72, 8, 9];

  const genOrder = Array.from(byGen.keys()).sort((a, b) => {
  const ia = customGenOrder.indexOf(Number(a));
  const ib = customGenOrder.indexOf(Number(b));

  if (ia !== -1 && ib !== -1) return ia - ib;
  if (ia !== -1) return -1;
  if (ib !== -1) return 1;

  return String(a).localeCompare(String(b));
});

    return genOrder.map((gen) => {
      const list = (byGen.get(gen) || []).slice().sort((a, b) => a.localeCompare(b));
      return { gen, list };
    });
  }, []);

  const editionExistsInList = useMemo(() => {
    return !!editionData?.[edition];
  }, [edition]);

  async function onCreate() {
    setErr("");
    try {
      const displayName = (name || "").trim() || "Spieler";
      localStorage.setItem("duoPlayerName", displayName);

      const res = await createDuoRoom({
        displayName,
        edition,
        linkMode: mode,
        title: (roomTitle || "").trim(),
      });

      localStorage.setItem("activeDuoRoomId", res.roomId);

      upsertRecentRoom({
        roomId: res.roomId,
        linkMode: mode,
        edition,
        title: (roomTitle || "").trim(),
        lastPlayers: [displayName],
      });

      nav("/table");
    } catch (e) {
      setErr(e?.message || String(e));
    }
  }

  return (
    <div className="duo-home-page" style={page}>
      <style>{DUO_HOME_CSS}</style>

      {/* Hintergrundbild */}
      <div style={bg} />
      {/* Overlay (wenn dir etwas "zu dunkel" war: den Wert hier kleiner machen, z.B. 0.18) */}
      <div style={overlay} />

      <div style={card}>
        <header style={header}>
          <div>
            <div style={kicker}>Soullink Lobby</div>
            <h1 style={title}>Online</h1>
          </div>

          <button style={topRightBtn} onClick={() => nav("/")}>
            Zur Startseite
          </button>
        </header>

        <label style={label}>Dein Name</label>
        <input value={name} onChange={(e) => setName(e.target.value)} style={input} />

        <label style={label}>Name des Online-Runs</label>
        <input
          value={roomTitle}
          onChange={(e) => setRoomTitle(e.target.value)}
          placeholder='z. B. "Run 1"'
          style={input}
        />

        <label style={label}>Modus</label>
<select
  className="darkSelect"
  value={mode}
  onChange={(e) => setMode(e.target.value)}
  style={input}
>
  <option value="solo">Solo</option>
  <option value="duo">Duo</option>
  <option value="trio">Trio</option>
</select>

        <label style={label}>Edition</label>
        <DarkSelect
          value={edition}
          onChange={setEdition}
          groups={editionGroups}
          style={input}
          customOption={
            !editionExistsInList
              ? { value: edition, label: `Benutzerdefiniert: ${edition}` }
              : null
          }
        />

        <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
          <button
            className="duo-create-button"
            onClick={onCreate}
            style={btnGreen}
          >
            Online-Run erstellen
          </button>
        </div>

        {err && <p style={{ marginTop: 12, color: "crimson" }}>{err}</p>}

        <div style={{ marginTop: 16 }}>
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
  );
}

/* =======================
   Styles
======================= */

const page = {
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
  maxWidth: 390,
  color: "rgba(255, 255, 255, 0.74)",
  fontSize: 14,
  lineHeight: 1.45,
  fontWeight: 750,
};

const topRightBtn = {
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

const label = {
  display: "block",
  marginTop: 14,
  marginBottom: 6,
  fontWeight: 900,
  color: "rgba(255, 255, 255, 0.82)",
};

const input = {
  width: "100%",
  maxWidth: "100%",
  boxSizing: "border-box",
  padding: "12px 14px",
  minHeight: 44,
  borderRadius: 8,
  border: "1px solid rgba(140, 165, 210, 0.34)",
  background:
    "linear-gradient(135deg, rgba(14, 23, 42, 0.90), rgba(8, 13, 28, 0.88))",
  color: "#fff",
  outline: "none",
  marginBottom: 14,
  fontWeight: 850,
  boxShadow: "inset 0 1px 0 rgba(255, 255, 255, 0.06)",
};

const btnGreen = {
  padding: "11px 16px",
  minHeight: 44,
  borderRadius: 8,
  border: "1px solid rgba(67, 233, 123, 0.34)",
  background:
    "linear-gradient(135deg, rgba(20, 84, 67, 0.34), rgba(10, 18, 32, 0.30)), rgba(6, 13, 25, 0.58)",
  color: "white",
  cursor: "pointer",
  fontWeight: 950,
  boxShadow:
    "0 10px 22px rgba(0, 0, 0, 0.18), inset 0 1px 0 rgba(255, 255, 255, 0.08)",
};