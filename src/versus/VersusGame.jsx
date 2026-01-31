import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getRoom, subscribeRoom, setRoomStatus } from "./versusService";

export default function VersusGame() {
  const { roomId } = useParams();
  const nav = useNavigate();

  const myPlayerId = useMemo(() => {
    return (
      sessionStorage.getItem(`versus_player_${String(roomId || "").toUpperCase()}`) || ""
    );
  }, [roomId]);

  const [room, setRoom] = useState(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    let unsub = null;

    (async () => {
      setErr("");
      const r = await getRoom(roomId);
      setRoom(r);

      unsub = subscribeRoom(roomId, (next) => setRoom(next));
    })().catch((e) => setErr(e?.message || String(e)));

    return () => {
      if (unsub) unsub();
    };
  }, [roomId]);

  // Wenn nicht running, zurück zur Lobby
  useEffect(() => {
    if (!room) return;
    if (room.status !== "running") {
      nav(`/versus/${String(roomId || "").toUpperCase()}`);
    }
  }, [room, nav, roomId]);

  async function backToLobby() {
    try {
      setErr("");
      await setRoomStatus(roomId, myPlayerId, "lobby");
      nav(`/versus/${String(roomId || "").toUpperCase()}`);
    } catch (e) {
      setErr(e?.message || String(e));
    }
  }

  const players = room?.players || [];

  return (
    <div
      style={{
        maxWidth: 520,
        margin: "24px auto",
        padding: 20,
        position: "relative",
      }}
    >
      {/* Top right button */}
      <button
        onClick={() => nav("/")}
        style={{
          position: "absolute",
          top: 0,
          right: 0,
          padding: "8px 12px",
        }}
      >
        Zur Startseite
      </button>

      <h2>Versus Game</h2>

      <p>
        <strong>Room-ID:</strong>{" "}
        <span style={{ color: "#4ade80" }}>{String(roomId || "").toUpperCase()}</span>
      </p>

      {err && <p style={{ color: "crimson" }}>{err}</p>}
      {!room && !err && <p>Lade Game-State …</p>}

      {room && (
        <>
          <p style={{ opacity: 0.85 }}>
            Status: <strong>{room.status}</strong>
          </p>

          <h3>Spieler</h3>
          <ul>
            {players.map((p) => (
              <li key={p.id}>
                {p.displayName} {p.id === myPlayerId ? "(du)" : ""}
              </li>
            ))}
          </ul>

          <p style={{ marginTop: 12, opacity: 0.8 }}>
            Nächster Schritt: Punkte/Regeln/Events hier rein.
          </p>

          <div style={{ marginTop: 20, display: "flex", gap: 10 }}>
            <button
              onClick={backToLobby}
              style={{
                padding: "10px 14px",
                background: "#22c55e",
                color: "#000",
                border: "none",
                borderRadius: "999px",
                fontWeight: 600,
                cursor: "pointer",
              }}
              title="Setzt den Room zurück in die Lobby"
            >
              Zur Lobby
            </button>
          </div>
        </>
      )}
    </div>
  );
}
