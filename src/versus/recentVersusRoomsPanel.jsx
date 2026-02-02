// src/versus/RecentVersusRoomsPanel.jsx
import React, { useEffect, useState } from "react";
import { loadRecentVersusRooms, removeRecentVersusRoom } from "./recentVersusRooms";
import { db } from "../firebase";
import { doc, onSnapshot } from "firebase/firestore";

export default function RecentVersusRoomsPanel({ onReconnect, onDeleteRoom, canDeleteRoom }) {
  // ✅ NICHT useMemo([]) – wir brauchen State, damit UI sofort aktualisiert
  const [rooms, setRooms] = useState(() => loadRecentVersusRooms());

  // ✅ Wenn localStorage-Liste irgendwo geändert wird (auch anderer Tab), neu laden
  useEffect(() => {
    function refresh() {
      setRooms(loadRecentVersusRooms());
    }

    // unser eigener Custom-Event (siehe recentVersusRooms.js unten)
    window.addEventListener("recentVersusRoomsChanged", refresh);

    // Browser-"storage" Event (für andere Tabs)
    window.addEventListener("storage", refresh);

    return () => {
      window.removeEventListener("recentVersusRoomsChanged", refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  // ✅ Firestore live: wenn eine Lobby gelöscht wird, fliegt sie automatisch aus der Liste
  useEffect(() => {
    if (!rooms.length) return;

    const unsubs = rooms.map((r) => {
      const id = String(r.roomId || "").toUpperCase();
      if (!id) return null;

      return onSnapshot(doc(db, "versusRooms", id), (snap) => {
        if (!snap.exists()) {
          // Lobby wurde gelöscht -> auch lokal entfernen
          removeRecentVersusRoom(id);
          setRooms(loadRecentVersusRooms());
        }
      });
    });

    return () => {
      unsubs.filter(Boolean).forEach((fn) => fn());
    };
  }, [rooms]);

  if (!rooms.length) {
    return (
      <div style={box}>
        <div style={title}>Letzte Lobbys</div>
        <div style={{ opacity: 0.7, fontSize: 12 }}>Noch keine gespeicherten Lobbys.</div>
      </div>
    );
  }

  return (
    <div style={box}>
      <div style={title}>Letzte Lobbys</div>

      <div style={{ display: "grid", gap: 8 }}>
        {rooms.map((r) => {
          const id = String(r.roomId || "").toUpperCase();
          const t = String(r.title || "").trim();
          const when = Number(r.lastSeenAt || 0);

          return (
            <div key={id} style={card}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline" }}>
                <div style={{ fontWeight: 900 }}>
                  {id}
                  {t ? <span style={{ fontWeight: 700, opacity: 0.8 }}> — {t}</span> : null}
                </div>
                <div style={{ fontSize: 12, opacity: 0.7 }}>
                  {when ? new Date(when).toLocaleString("de-DE") : ""}
                </div>
              </div>

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
                <button type="button" style={btn} onClick={() => onReconnect?.(id)}>
                  Reconnect
                </button>

                <button
                  type="button"
                  style={btnGhost}
                  onClick={() => {
                    removeRecentVersusRoom(id);
                    setRooms(loadRecentVersusRooms()); // ✅ sofort UI updaten
                  }}
                  title="Nur aus der Liste entfernen (nicht aus Firestore)"
                >
                  Aus Liste entfernen
                </button>

                {canDeleteRoom?.(id) ? (
                  <button
                    type="button"
                    style={btnDanger}
                    onClick={() => onDeleteRoom?.(id)}
                    title="Löscht die Lobby aus Firestore"
                  >
                    Lobby löschen
                  </button>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const box = {
  padding: 12,
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(0,0,0,0.15)",
};

const title = { fontWeight: 900, marginBottom: 10 };

const card = {
  padding: 10,
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.14)",
  background: "rgba(255,255,255,0.04)",
};

const btn = {
  padding: "8px 10px",
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.28)",
  background: "rgba(255,255,255,0.16)",
  color: "white",
  cursor: "pointer",
  fontWeight: 900,
};

const btnGhost = {
  padding: "8px 10px",
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.18)",
  background: "rgba(255,255,255,0.06)",
  color: "white",
  cursor: "pointer",
  fontWeight: 800,
};

const btnDanger = {
  padding: "8px 10px",
  borderRadius: 10,
  border: "1px solid rgba(239,68,68,0.35)",
  background: "rgba(239,68,68,0.12)",
  color: "white",
  cursor: "pointer",
  fontWeight: 900,
};
