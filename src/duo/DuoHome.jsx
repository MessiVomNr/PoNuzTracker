// src/duo/DuoHome.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { createDuoRoom } from "./duoService";
import RecentRoomsPanel from "./RecentRoomsPanel";
import { upsertRecentRoom } from "./recentRooms";
import DarkSelect from "../components/DarkSelect";

import editionData from "../data/editionData.js";
import { getGenFromEdition } from "../utils/editionHelpers";

const DARK_SELECT_CSS = `
  /* macht native Select-Popup dunkler (Browser "best effort") */
  select.darkSelect { color-scheme: dark; }

  select.darkSelect option {
    background: #0b0f16;
    color: #e5e7eb;
  }

  select.darkSelect optgroup {
    background: #0b0f16;
    color: #9ca3af;
    font-weight: 800;
  }

  select.darkSelect option:checked {
    background: #111827;
    color: #ffffff;
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

    const genOrder = Array.from(byGen.keys()).sort((a, b) => {
      const na = Number(a);
      const nb = Number(b);
      if (!Number.isNaN(na) && !Number.isNaN(nb)) return na - nb;
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
    <div style={page}>
      <style>{DARK_SELECT_CSS}</style>

      {/* Hintergrundbild */}
      <div style={bg} />
      {/* Overlay (wenn dir etwas "zu dunkel" war: den Wert hier kleiner machen, z.B. 0.18) */}
      <div style={overlay} />

      <div style={card}>
        <button style={topRightBtn} onClick={() => nav("/")}>
          Zur Startseite
        </button>

        <h2 style={{ marginTop: 0 }}>Online</h2>

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
          <button onClick={onCreate} style={btnGreen}>
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
  overflow: "hidden",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 16,
};

const bg = {
  position: "absolute",
  inset: 0,
  backgroundImage: `url("/backgrounds/background_1.png")`,
  backgroundSize: "cover",
  backgroundPosition: "center",
  backgroundRepeat: "no-repeat",
  transform: "scale(1.02)",
  zIndex: 0,
};

const overlay = {
  position: "absolute",
  inset: 0,
  background: "rgba(0,0,0,0.22)", // <- hier wird es dunkler/heller
  zIndex: 1,
};

const card = {
  width: "min(560px, 92vw)",
  padding: 16,
  borderRadius: 18,
  border: "1px solid rgba(255,255,255,0.14)",
  background: "rgba(10,10,16,0.55)",
  backdropFilter: "blur(10px)",
  color: "white",
  position: "relative",
  zIndex: 2,
};

const topRightBtn = {
  position: "absolute",
  top: 12,
  right: 12,
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.14)",
  background: "rgba(255,255,255,0.06)",
  color: "white",
  cursor: "pointer",
  fontWeight: 900,
};

const label = { display: "block", marginTop: 12, fontWeight: 800, opacity: 0.9 };

const input = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.14)",
  background: "rgba(0,0,0,0.25)",
  color: "white",
  outline: "none",
};

const btnGreen = {
  padding: "10px 14px",
  borderRadius: 14,
  border: "1px solid rgba(255,255,255,0.14)",
  background: "linear-gradient(135deg, rgba(67,233,123,0.30), rgba(56,249,215,0.16))",
  color: "white",
  cursor: "pointer",
  fontWeight: 950,
};
