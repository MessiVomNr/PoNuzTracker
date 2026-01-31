import React, { useEffect, useMemo, useState, useCallback } from "react";
import { cleanupRecentRooms, removeRecentRoom, clearAllRecentRooms } from "./recentRooms";

function formatTimeAgo(ts) {
  const diff = Date.now() - ts;
  const min = Math.floor(diff / 60000);
  if (min < 1) return "gerade eben";
  if (min < 60) return `vor ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `vor ${h} h`;
  const d = Math.floor(h / 24);
  return `vor ${d} d`;
}

function formatExpiresIn(ts, ttlDays) {
  const expiresAt = ts + ttlDays * 24 * 60 * 60 * 1000;
  const diff = expiresAt - Date.now();
  const min = Math.floor(diff / 60000);
  if (min <= 0) return "abgelaufen";
  if (min < 60) return `in ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `in ${h} h`;
  const d = Math.floor(h / 24);
  return `in ${d} d`;
}

// ✅ Robust: nimmt mehrere mögliche Felder + trim
function getRoomTitle(r) {
  const candidates = [
    r?.title,
    r?.runTitle,
    r?.roomTitle,
    r?.name,
    r?.saveTitle,
  ];

  for (const c of candidates) {
    const t = String(c ?? "").trim();
    if (t) return t;
  }
  return "Online-Run";
}

export default function RecentRoomsPanel({ ttlDays = 7, onReconnect }) {
  const [rooms, setRooms] = useState([]);

  const reload = useCallback(() => {
    setRooms(cleanupRecentRooms(ttlDays));
  }, [ttlDays]);

  useEffect(() => {
    reload();

    // ✅ Wenn du zurück in den Tab kommst, neu laden (typisch: nach /table wieder zurück)
    const onFocus = () => reload();

    // ✅ Wenn localStorage sich ändert (anderer Tab oder manchmal auch durch deine App-Logik)
    const onStorage = (e) => {
      // falls du einen speziellen key hast, könntest du hier einschränken
      // z.B. if (e.key !== "recentDuoRooms") return;
      reload();
    };

    window.addEventListener("focus", onFocus);
    window.addEventListener("storage", onStorage);

    return () => {
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("storage", onStorage);
    };
  }, [reload]);

  const sorted = useMemo(
    () => [...rooms].sort((a, b) => (b.lastSeen || 0) - (a.lastSeen || 0)),
    [rooms]
  );

  if (!sorted.length) return null;

  return (
    <div style={{ marginTop: 14, padding: 12, border: "1px solid #333", borderRadius: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <h3 style={{ margin: 0 }}>Zuletzt verwendete Online-Runs</h3>

        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={reload} title="Liste neu laden">
            Aktualisieren
          </button>
          <button
            onClick={() => {
              clearAllRecentRooms();
              setRooms([]);
            }}
            title="Löscht nur die lokale Liste"
          >
            Liste leeren
          </button>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 10 }}>
        {sorted.map((r) => {
          const title = getRoomTitle(r);

          return (
            <div
              key={r.roomId}
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 10,
                padding: 10,
                border: "1px solid #222",
                borderRadius: 10,
                alignItems: "center",
                flexWrap: "wrap",
              }}
            >
              <div style={{ minWidth: 260 }}>
                <div style={{ display: "flex", gap: 8, alignItems: "baseline", flexWrap: "wrap" }}>
                  <strong>{title}</strong>
                  <span style={{ opacity: 0.85, fontSize: 13 }}>
                    ({r.edition || "?"} / {r.linkMode || "?"})
                  </span>
                </div>

                <div style={{ opacity: 0.85, fontSize: 13, marginTop: 3 }}>
                  <strong>Room:</strong> {r.roomId}
                </div>

                {!!(r.lastPlayers && r.lastPlayers.length) && (
                  <div style={{ opacity: 0.85, fontSize: 13, marginTop: 3 }}>
                    <strong>Spieler:</strong> {r.lastPlayers.join(", ")}
                  </div>
                )}

                <div style={{ opacity: 0.75, fontSize: 12, marginTop: 4 }}>
                  Letzter Zugriff: {formatTimeAgo(r.lastSeen)} · Läuft ab: {formatExpiresIn(r.lastSeen, ttlDays)}
                </div>
              </div>

              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => onReconnect?.(r)} title="Wieder verbinden">
                  Reconnect
                </button>
                <button onClick={() => setRooms(removeRecentRoom(r.roomId))} title="Nur lokal entfernen">
                  Löschen
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
