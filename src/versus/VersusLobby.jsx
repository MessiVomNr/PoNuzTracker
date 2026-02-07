import React, { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getRoom, subscribeRoom, setReady, setRoomStatus, transferHost, heartbeat } from "./versusService";

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
    ((players.length === 1 && players[0]?.ready === true) || (players.length > 1 && allReady));

  useEffect(() => {
    if (!roomId || !myPlayerId) return;

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

      await setRoomStatus(roomKey, myPlayerId, "auction");
      nav(`/versus/${roomKey}/auction`, { replace: true });
    } catch (e) {
      setErr(e?.message || String(e));
    }
  }

  return (
    <div style={page}>
      {/* Hintergrundbild */}
      <div style={bg} />
      {/* dunkles Overlay für Lesbarkeit (nicht zu stark!) */}
      <div style={overlay} />

      <div style={card}>
        <button style={topRightBtn} onClick={() => nav("/")}>
          Zur Startseite
        </button>

        <h2 style={{ marginTop: 0 }}>Versus Lobby</h2>

        <p style={{ marginTop: 6 }}>
          <strong>Room-ID:</strong> <span style={{ color: "#4ade80" }}>{roomKey}</span>
        </p>

        {!room && !err && <p>Room wird geladen …</p>}
        {err && <p style={{ color: "crimson" }}>{err}</p>}
        {!err && room === null && <p style={{ color: "crimson" }}>Room nicht gefunden.</p>}

        {room && (
          <>
            <h3 style={{ marginTop: 14 }}>Spieler</h3>

            <ul style={{ paddingLeft: 18, marginTop: 8 }}>
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
                          style={btnSmall}
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

            <p style={{ opacity: 0.85, marginTop: 10 }}>
              {players.length === 1
                ? players[0]?.ready
                  ? "Solo-Start bereit ✅"
                  : "Drücke „Bereit“, um solo zu starten …"
                : allReady
                ? "Alle sind bereit ✅"
                : "Warte, bis alle bereit sind …"}
            </p>

            <div style={{ display: "flex", gap: 10, marginTop: 14, flexWrap: "wrap" }}>
              <button onClick={toggleReady} style={btnGreen}>
                {me?.ready ? "Nicht bereit" : "Bereit"}
              </button>

              <button
                onClick={startGame}
                disabled={!canStart}
                style={{
                  ...btnGreen,
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

        <div style={{ marginTop: 18, display: "flex", gap: 10 }}>
          <button onClick={() => nav("/versus")} style={btnGhost}>
            Zurück
          </button>
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
  zIndex: 1,
};

const card = {
  width: "min(560px, 92vw)",
  padding: 16,
  borderRadius: 18,
  border: "1px solid rgba(255,255,255,0.14)",
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

const btnGhost = {
  padding: "10px 14px",
  borderRadius: 14,
  border: "1px solid rgba(255,255,255,0.14)",
  background: "rgba(255,255,255,0.06)",
  color: "white",
  cursor: "pointer",
  fontWeight: 950,
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

const btnSmall = {
  padding: "6px 10px",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.14)",
  background: "rgba(255,255,255,0.06)",
  color: "white",
  cursor: "pointer",
  fontWeight: 900,
};
