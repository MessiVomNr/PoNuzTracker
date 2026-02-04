import React, { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getRoom, subscribeRoom, setReady, setRoomStatus, transferHost, heartbeat  } from "./versusService";

export default function VersusLobby() {
  const { roomId } = useParams();
  const nav = useNavigate();

  const roomKey = String(roomId || "").toUpperCase();

  const myPlayerId = useMemo(() => {
  const k = `versus_player_${roomKey}`;
  return (
    sessionStorage.getItem(k) ||
    localStorage.getItem(k) ||
    localStorage.getItem("versus_device_id") ||
    ""
  );
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
const canStart =
  isHost &&
  (
    // Solo-Fall: nur 1 Spieler → dieser eine muss ready sein
    (players.length === 1 && players[0]?.ready === true)

    ||

    // Multiplayer-Fall: 2+ Spieler → alle müssen ready sein
    (players.length > 1 && allReady)
  );
useEffect(() => {
  if (!roomId || !myPlayerId) return;

  // sofort einmal "alive" senden
  heartbeat(roomId, myPlayerId);

  const t = setInterval(() => {
    heartbeat(roomId, myPlayerId);
  }, 12000);

  return () => clearInterval(t);
}, [roomId, myPlayerId]);


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
async function makeAdmin(targetPlayerId, targetName) {
  try {
    setErr("");
    if (!isHost) return;
    if (!targetPlayerId || targetPlayerId === myPlayerId) return;

    const ok = window.confirm(`Admin-Rechte an ${targetName || "Spieler"} übertragen?`);
    if (!ok) return;

    await transferHost(roomKey, myPlayerId, targetPlayerId);
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
                <li
  key={p.id}
  style={{
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    padding: "6px 0",
  }}
>
  <div>
    {readyIcon} {p.displayName}
    {hostIcon}
    {isMe ? " (du)" : ""}
  </div>

  {isHost && !isMe && (
    <div style={{ display: "flex", gap: 8 }}>
      <button
        onClick={() => makeAdmin(p.id, p.displayName)}
        style={{ padding: "6px 10px" }}
        title="Überträgt die Admin/Host-Rechte an diesen Spieler"
      >
        Zum Admin machen
      </button>
    </div>
  )}
</li>

              );
            })}
          </ul>

          <p style={{ opacity: 0.85 }}>
  {players.length === 1
    ? (players[0]?.ready
        ? "Solo-Start bereit ✅"
        : "Drücke „Bereit“, um solo zu starten …")
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
    : players.length === 1 && !players[0]?.ready
    ? "Drücke zuerst „Bereit“."
    : players.length > 1 && !allReady
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
