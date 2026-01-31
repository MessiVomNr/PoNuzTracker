import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getRoom, subscribeRoom, setRoomStatus } from "./versusService";
import DuoVersusAuction from "../pages/DuoVersusAuction";

export default function VersusGame() {
  const { roomId } = useParams();
  const nav = useNavigate();

  const myPlayerId = useMemo(() => {
    return (
      sessionStorage.getItem(
        `versus_player_${String(roomId || "").toUpperCase()}`
      ) || ""
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

  // Wenn Game nicht mehr running → zurück zur Lobby
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

  return (
    <div
      style={{
        width: "min(1400px, 98vw)",
        height: "100vh",
        margin: "0 auto",
        padding: "12px 14px",
        boxSizing: "border-box",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
    >
      {/* ===== Topbar ===== */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
        }}
      >
        <div style={{ fontSize: 18, fontWeight: 900 }}>Versus Game</div>

        <div style={{ opacity: 0.85 }}>
          Room:&nbsp;
          <span style={{ color: "#4ade80", fontWeight: 800 }}>
            {String(roomId || "").toUpperCase()}
          </span>
          {room?.status && (
            <>
              &nbsp;· Status: <b>{room.status}</b>
            </>
          )}
        </div>

        <div style={{ marginLeft: "auto", display: "flex", gap: 10 }}>
          <button
            onClick={() => nav("/")}
            style={{
              padding: "10px 14px",
              borderRadius: 999,
              border: "1px solid rgba(255,255,255,0.18)",
              background: "rgba(255,255,255,0.06)",
              color: "white",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Zur Startseite
          </button>

          <button
            onClick={backToLobby}
            style={{
              padding: "10px 14px",
              background: "#22c55e",
              color: "#000",
              border: "none",
              borderRadius: 999,
              fontWeight: 800,
              cursor: "pointer",
            }}
          >
            Zur Lobby
          </button>
        </div>
      </div>

      {err && <div style={{ color: "crimson" }}>{err}</div>}
      {!room && !err && <div style={{ opacity: 0.8 }}>Lade Game-State …</div>}

      {/* ===== Auction Draft (füllt Rest des Screens) ===== */}
      <div
        style={{
          flex: 1,
          overflow: "hidden",
        }}
      >
        {room && <DuoVersusAuction roomId={roomId} room={room} />}
      </div>
    </div>
  );
}
