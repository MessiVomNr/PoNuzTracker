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

    const onFocus = () => reload();

    const onStorage = () => {
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
    <div style={wrap}>
      <div style={topRow}>
        <button type="button" onClick={reload} title="Liste neu laden" style={smallButton}>
          Aktualisieren
        </button>

        <button
          type="button"
          onClick={() => {
            clearAllRecentRooms();
            setRooms([]);
          }}
          title="Löscht nur die lokale Liste"
          style={smallButton}
        >
          Liste leeren
        </button>
      </div>

      <div style={list}>
        {sorted.map((r) => {
          const title = getRoomTitle(r);

          return (
            <div key={r.roomId} style={roomCard}>
              <div style={roomInfo}>
                <div style={titleRow}>
                  <strong style={roomTitle}>{title}</strong>

                  <span style={roomMeta}>
                    {r.edition || "?"} / {r.linkMode || "?"}
                  </span>
                </div>

                <div style={detailLine}>
                  <strong>Room:</strong> {r.roomId}
                </div>

                {!!(r.lastPlayers && r.lastPlayers.length) && (
                  <div style={detailLine}>
                    <strong>Spieler:</strong> {r.lastPlayers.join(", ")}
                  </div>
                )}

                <div style={timeLine}>
                  Letzter Zugriff: {formatTimeAgo(r.lastSeen)} · Läuft ab: {formatExpiresIn(r.lastSeen, ttlDays)}
                </div>
              </div>

              <div style={actions}>
                <button
                  type="button"
                  onClick={() => onReconnect?.(r)}
                  title="Wieder verbinden"
                  style={primaryButton}
                >
                  Reconnect
                </button>

                <button
                  type="button"
                  onClick={() => setRooms(removeRecentRoom(r.roomId))}
                  title="Nur lokal entfernen"
                  style={smallButton}
                >
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

const wrap = {
  display: "grid",
  gap: 8,
  marginTop: -10,
};

const topRow = {
  display: "flex",
  gap: 10,
  alignItems: "center",
  flexWrap: "wrap",
};

const list = {
  display: "grid",
  gap: 8,
};

const roomCard = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) auto",
  gap: 12,
  padding: "12px 14px",
  border: "1px solid rgba(120, 150, 210, 0.24)",
  borderRadius: 15,
  alignItems: "center",
  background: "linear-gradient(135deg, rgba(8, 16, 34, 0.92), rgba(6, 12, 28, 0.72))",
  boxShadow: "0 12px 28px rgba(0, 0, 0, 0.16)",
};

const roomInfo = {
  minWidth: 0,
};

const titleRow = {
  display: "flex",
  gap: 8,
  alignItems: "baseline",
  flexWrap: "wrap",
  marginBottom: 4,
};

const roomTitle = {
  fontSize: 16,
  fontWeight: 950,
  lineHeight: 1.1,
};

const roomMeta = {
  opacity: 0.72,
  fontSize: 12,
  fontWeight: 800,
  lineHeight: 1.1,
};

const detailLine = {
  opacity: 0.86,
  fontSize: 13,
  marginTop: 2,
  lineHeight: 1.25,
};

const timeLine = {
  opacity: 0.68,
  fontSize: 12,
  marginTop: 5,
  lineHeight: 1.25,
};

const actions = {
  display: "flex",
  gap: 8,
  flexWrap: "nowrap",
  alignItems: "center",
  justifyContent: "flex-end",
};

const smallButton = {
  border: "1px solid rgba(140, 170, 230, 0.38)",
  borderRadius: 10,
  padding: "9px 13px",
  background: "rgba(16, 29, 55, 0.9)",
  color: "#f4f7ff",
  fontWeight: 900,
  cursor: "pointer",
  whiteSpace: "nowrap",
};

const primaryButton = {
  ...smallButton,
  border: "1px solid rgba(69, 255, 166, 0.38)",
  background: "linear-gradient(135deg, rgba(21, 67, 68, 0.98), rgba(13, 42, 55, 0.98))",
};