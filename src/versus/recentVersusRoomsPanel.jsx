// src/versus/recentVersusRoomsPanel.jsx
import React, { useEffect, useState } from "react";
import { loadRecentVersusRooms, removeRecentVersusRoom } from "./recentVersusRooms";
import { db } from "../firebase";
import { doc, onSnapshot } from "firebase/firestore";

export default function RecentVersusRoomsPanel({
  onReconnect,
  onDeleteRoom,
  canDeleteRoom,
}) {
  const [rooms, setRooms] = useState(() => loadRecentVersusRooms());

  useEffect(() => {
    function refresh() {
      setRooms(loadRecentVersusRooms());
    }

    window.addEventListener("recentVersusRoomsChanged", refresh);
    window.addEventListener("storage", refresh);

    return () => {
      window.removeEventListener("recentVersusRoomsChanged", refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  useEffect(() => {
    if (!rooms.length) return undefined;

    const unsubs = rooms.map((r) => {
      const id = String(r.roomId || "").toUpperCase();
      if (!id) return null;

      return onSnapshot(doc(db, "versusRooms", id), (snap) => {
        if (!snap.exists()) {
          removeRecentVersusRoom(id);
          setRooms(loadRecentVersusRooms());
        }
      });
    });

    return () => {
      unsubs.filter(Boolean).forEach((fn) => fn());
    };
  }, [rooms]);

  function handleRemoveFromList(id) {
    removeRecentVersusRoom(id);
    setRooms(loadRecentVersusRooms());
  }

  function formatDate(value) {
    const when = Number(value || 0);

    if (!when) {
      return "";
    }

    return new Date(when).toLocaleString("de-DE");
  }

  if (!rooms.length) {
    return (
      <div className="versus-recent-panel versus-recent-empty">
        <div className="versus-recent-panel-title">Letzte Lobbys</div>
        <p>Noch keine gespeicherten Lobbys.</p>
      </div>
    );
  }

  return (
    <div className="versus-recent-panel">
      <div className="versus-recent-panel-title">Letzte Lobbys</div>

      <div className="versus-recent-list">
        {rooms.map((r) => {
          const id = String(r.roomId || "").toUpperCase();
          const title = String(r.title || "").trim();
          const lastSeen = formatDate(r.lastSeenAt);

          return (
            <article key={id} className="versus-recent-room-card">
              <div className="versus-recent-room-head">
                <div className="versus-recent-room-main">
                  <strong>{id}</strong>

                  {title ? (
                    <span>{title}</span>
                  ) : (
                    <span>Versus Lobby</span>
                  )}
                </div>

                {lastSeen && (
                  <time className="versus-recent-room-time">
                    {lastSeen}
                  </time>
                )}
              </div>

              <div className="versus-recent-actions">
                <button
                  type="button"
                  className="pnt-button"
                  onClick={() => onReconnect?.(id)}
                >
                  Reconnect
                </button>

                <button
                  type="button"
                  className="pnt-button pnt-button-ghost"
                  onClick={() => handleRemoveFromList(id)}
                  title="Nur aus der Liste entfernen, nicht aus Firestore"
                >
                  Aus Liste entfernen
                </button>

                {canDeleteRoom?.(id) ? (
                  <button
                    type="button"
                    className="pnt-button pnt-button-danger"
                    onClick={() => onDeleteRoom?.(id)}
                    title="Löscht die Lobby aus Firestore"
                  >
                    Lobby löschen
                  </button>
                ) : null}
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}