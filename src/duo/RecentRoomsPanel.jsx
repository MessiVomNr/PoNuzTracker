import React, { useEffect, useMemo, useState, useCallback } from "react";
import { cleanupRecentRooms, removeRecentRoom, clearAllRecentRooms } from "./recentRooms";

const RECENT_ROOMS_CSS = `
  .recent-rooms-panel,
  .recent-rooms-panel * {
    box-sizing: border-box;
  }

  .recent-rooms-panel {
    display: grid;
    gap: 10px;
    width: 100%;
    min-width: 0;
  }

  .recent-rooms-toolbar {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
    width: 100%;
  }

  .recent-room-button {
    width: 100%;
    min-height: 40px;
    padding: 9px 12px;
    border-radius: 10px;
    border: 1px solid rgba(140, 170, 230, 0.38);
    background:
      linear-gradient(135deg, rgba(16, 29, 55, 0.92), rgba(8, 15, 32, 0.88));
    color: #f4f7ff;
    font-weight: 950;
    cursor: pointer;
    white-space: nowrap;
  }

  .recent-room-button-primary {
    border-color: rgba(69, 255, 166, 0.34);
    background:
      linear-gradient(135deg, rgba(21, 67, 68, 0.96), rgba(13, 42, 55, 0.96));
  }

  .recent-room-button-danger {
    border-color: rgba(255, 110, 130, 0.28);
    background:
      linear-gradient(135deg, rgba(85, 30, 42, 0.78), rgba(18, 22, 40, 0.9));
  }

  .recent-rooms-list {
    display: grid;
    gap: 10px;
    width: 100%;
    min-width: 0;
  }

  .recent-room-card {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 12px;
    padding: 13px;
    border: 1px solid rgba(120, 150, 210, 0.22);
    border-radius: 16px;
    align-items: center;
    min-width: 0;
    background:
      radial-gradient(circle at 0% 0%, rgba(80, 170, 255, 0.09), transparent 44%),
      linear-gradient(135deg, rgba(8, 16, 34, 0.94), rgba(6, 12, 28, 0.76));
    box-shadow:
      0 12px 28px rgba(0, 0, 0, 0.18),
      inset 0 1px 0 rgba(255, 255, 255, 0.06);
  }

  .recent-room-info {
    min-width: 0;
    display: grid;
    gap: 7px;
  }

  .recent-room-title-row {
    min-width: 0;
    display: flex;
    gap: 8px;
    align-items: center;
    flex-wrap: wrap;
  }

  .recent-room-title {
    min-width: 0;
    max-width: 100%;
    color: #ffffff;
    font-size: 1rem;
    font-weight: 1000;
    line-height: 1.1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .recent-room-meta-pill {
    min-height: 23px;
    display: inline-flex;
    align-items: center;
    padding: 0 8px;
    border-radius: 999px;
    border: 1px solid rgba(140, 170, 230, 0.22);
    background: rgba(255, 255, 255, 0.055);
    color: rgba(235, 241, 250, 0.72);
    font-size: 0.72rem;
    font-weight: 900;
    line-height: 1;
  }

  .recent-room-detail-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 6px 10px;
    min-width: 0;
  }

  .recent-room-detail {
    min-width: 0;
    color: rgba(235, 241, 250, 0.78);
    font-size: 0.8rem;
    font-weight: 800;
    line-height: 1.25;
    overflow-wrap: anywhere;
  }

  .recent-room-detail strong {
    color: rgba(255, 255, 255, 0.9);
    font-weight: 950;
  }

  .recent-room-time {
    color: rgba(235, 241, 250, 0.58);
    font-size: 0.74rem;
    font-weight: 800;
    line-height: 1.25;
  }

  .recent-room-actions {
    display: grid;
    grid-template-columns: repeat(2, auto);
    gap: 8px;
    align-items: center;
    justify-content: end;
  }

  .recent-rooms-empty {
    padding: 12px;
    border-radius: 14px;
    border: 1px dashed rgba(140, 170, 230, 0.24);
    background: rgba(5, 10, 24, 0.24);
    color: rgba(235, 241, 250, 0.68);
    font-size: 0.84rem;
    font-weight: 850;
    line-height: 1.35;
  }

  @media (max-width: 760px) {
    .recent-room-card {
      grid-template-columns: 1fr;
      gap: 11px;
      padding: 12px;
      border-radius: 15px;
    }

    .recent-room-title {
      white-space: normal;
      overflow-wrap: anywhere;
    }

    .recent-room-detail-grid {
      grid-template-columns: 1fr;
      gap: 5px;
    }

    .recent-room-actions {
      grid-template-columns: repeat(2, minmax(0, 1fr));
      justify-content: stretch;
    }

    .recent-room-button {
      min-height: 39px;
      padding: 9px 10px;
      font-size: 0.84rem;
    }
  }

  @media (max-width: 390px) {
    .recent-rooms-toolbar,
    .recent-room-actions {
      grid-template-columns: 1fr;
    }
  }

  @media (max-width: 980px) and (max-height: 560px) and (orientation: landscape) {
    .recent-rooms-list {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .recent-room-card {
      grid-template-columns: 1fr;
      gap: 9px;
      padding: 11px;
    }

    .recent-room-detail-grid {
      grid-template-columns: 1fr;
    }

    .recent-room-actions {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }
`;

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
    const onStorage = () => reload();

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

  return (
    <div className="recent-rooms-panel">
      <style>{RECENT_ROOMS_CSS}</style>

      <div className="recent-rooms-toolbar">
        <button type="button" onClick={reload} title="Liste neu laden" className="recent-room-button">
          Aktualisieren
        </button>

        <button
          type="button"
          onClick={() => {
            clearAllRecentRooms();
            setRooms([]);
          }}
          title="Löscht nur die lokale Liste"
          className="recent-room-button recent-room-button-danger"
        >
          Liste leeren
        </button>
      </div>

      {!sorted.length ? (
        <div className="recent-rooms-empty">
          Noch keine gespeicherten Lobbys. Sobald du eine Lobby erstellst oder betrittst, erscheint sie hier.
        </div>
      ) : (
        <div className="recent-rooms-list">
          {sorted.map((r) => {
            const title = getRoomTitle(r);

            return (
              <article key={r.roomId} className="recent-room-card">
                <div className="recent-room-info">
                  <div className="recent-room-title-row">
                    <strong className="recent-room-title" title={title}>
                      {title}
                    </strong>

                    <span className="recent-room-meta-pill">
                      {r.edition || "?"} / {r.linkMode || "?"}
                    </span>
                  </div>

                  <div className="recent-room-detail-grid">
                    <div className="recent-room-detail">
                      <strong>Room:</strong> {r.roomId}
                    </div>

                    {!!(r.lastPlayers && r.lastPlayers.length) && (
                      <div className="recent-room-detail">
                        <strong>Spieler:</strong> {r.lastPlayers.join(", ")}
                      </div>
                    )}
                  </div>

                  <div className="recent-room-time">
                    Letzter Zugriff: {formatTimeAgo(r.lastSeen)} · Läuft ab: {formatExpiresIn(r.lastSeen, ttlDays)}
                  </div>
                </div>

                <div className="recent-room-actions">
                  <button
                    type="button"
                    onClick={() => onReconnect?.(r)}
                    title="Wieder verbinden"
                    className="recent-room-button recent-room-button-primary"
                  >
                    Reconnect
                  </button>

                  <button
                    type="button"
                    onClick={() => setRooms(removeRecentRoom(r.roomId))}
                    title="Nur lokal entfernen"
                    className="recent-room-button"
                  >
                    Löschen
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}