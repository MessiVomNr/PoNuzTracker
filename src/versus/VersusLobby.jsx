import React, { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getRoom, subscribeRoom, setReady, setRoomStatus } from "./versusService";

export default function VersusLobby() {
  const { roomId } = useParams();
  const nav = useNavigate();

  const roomKey = String(roomId || "").toUpperCase();

  const myPlayerId = useMemo(() => {
    return sessionStorage.getItem(`versus_player_${roomKey}`) || "";
  }, [roomKey]);

  const [room, setRoom] = useState(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    let unsub = null;

    (async () => {
      setErr("");
      const r = await getRoom(roomKey);
      setRoom(r);

      unsub = subscribeRoom(roomKey, (next) => setRoom(next));
    })().catch((e) => setErr(e?.message || String(e)));

    return () => {
      if (unsub) unsub();
    };
  }, [roomKey]);

  // Auto-Redirect: Wenn Room schon in Auction ist -> direkt zur Auction
  useEffect(() => {
    if (!room) return;
    if (room.status === "auction") {
      nav(`/versus/${roomKey}/auction`, { replace: true });
    }
  }, [room, nav, roomKey]);

  const players = room?.players || [];
  const me = players.find((p) => p.id === myPlayerId);
  const isHost = room?.hostPlayerId && myPlayerId && room.hostPlayerId === myPlayerId;

  const allReady = players.length >= 2 && players.every((p) => !!p.ready);
  const canStart = isHost && room?.status === "lobby" && allReady;

  async function toggleReady() {
    try {
      setErr("");
      if (!myPlayerId) {
        setErr("Dein Spieler-Token fehlt (Tab-Session). Bitte erneut beitreten.");
        return;
      }
      await setReady(roomKey, myPlayerId, !me?.ready);
    } catch (e) {
      setErr(e?.message || String(e));
    }
  }

  async function startGame() {
    try {
      setErr("");
      if (!myPlayerId) {
        setErr("Dein Spieler-Token fehlt (Tab-Session). Bitte erneut beitreten.");
        return;
      }

      // ✅ System A: Start = AUCTION
      await setRoomStatus(roomKey, myPlayerId, "auction");

      // ✅ Ziel: Auction-Seite
      nav(`/versus/${roomKey}/auction`, { replace: true });
    } catch (e) {
      setErr(e?.message || String(e));
    }
  }

  return (
    <div
      style={{
        maxWidth: 520,
        margin: "24px auto",
        padding: 20,
        position: "relative",
      }}
    >
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

      <h2>Versus Lobby</h2>

      <p>
        <strong>Room-ID:</strong> <span style={{ color: "#4ade80" }}>{roomKey}</span>
      </p>

      {!room && !err && <p>Room wird geladen …</p>}
      {err && <p style={{ color: "crimson" }}>{err}</p>}
      {!err && room === null && <p style={{ color: "crimson" }}>Room nicht gefunden.</p>}

      {room && (
        <>
          <h3>Spieler</h3>
          <ul>
            {players.map((p) => {
              const isMe = p.id === myPlayerId;
              const readyIcon = p.ready ? "✅" : "⏳";
              const hostIcon = room.hostPlayerId === p.id ? " 👑" : "";
              return (
                <li key={p.id}>
                  {readyIcon} {p.displayName}
                  {hostIcon}
                  {isMe ? " (du)" : ""}
                </li>
              );
            })}
          </ul>

          <p style={{ opacity: 0.85 }}>
            {players.length < 2
              ? "Warte auf mindestens 1 weiteren Spieler …"
              : allReady
              ? "Alle sind bereit ✅"
              : "Warte, bis alle bereit sind …"}
          </p>

          <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
            <button onClick={toggleReady} style={{ padding: "10px 14px" }}>
              {me?.ready ? "Nicht bereit" : "Bereit"}
            </button>

            <button
              onClick={startGame}
              disabled={!canStart}
              style={{
                padding: "10px 14px",
                opacity: canStart ? 1 : 0.5,
                cursor: canStart ? "pointer" : "not-allowed",
              }}
              title={
                !isHost
                  ? "Nur der Host kann starten."
                  : players.length < 2
                  ? "Mindestens 2 Spieler nötig."
                  : !allReady
                  ? "Alle müssen bereit sein."
                  : ""
              }
            >
              Draft starten
            </button>
          </div>
        </>
      )}

      <div style={{ marginTop: 20, display: "flex", gap: 10 }}>
        <button onClick={() => nav("/versus")} style={{ padding: "10px 14px" }}>
          Zurück
        </button>
      </div>
    </div>
  );
}
