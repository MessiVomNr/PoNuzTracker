import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { createRoom, joinRoom } from "./versusService";

export default function VersusHome() {
  const nav = useNavigate();
  const [name, setName] = useState(() => localStorage.getItem("versusPlayerName") || "Spieler");
  const [roomId, setRoomId] = useState("");
  const [err, setErr] = useState("");

  function normName(v) {
    return String(v || "").trim() || "Spieler";
  }

  function normRoomId(v) {
    return String(v || "").trim().toUpperCase();
  }

  async function onCreate() {
    setErr("");
    try {
      const displayName = normName(name);

      // createRoom erwartet STRING (nicht {displayName: ...})
      const res = await createRoom(displayName);

      const rid = normRoomId(res.roomId);
      sessionStorage.setItem(`versus_player_${rid}`, res.playerId);

      nav(`/versus/${rid}`);
    } catch (e) {
      setErr(e?.message || String(e));
    }
  }

  async function onJoin() {
    setErr("");
    try {
      const displayName = normName(name);
      const rid = normRoomId(roomId);

      if (!rid) {
        setErr("Bitte eine Room-ID eingeben.");
        return;
      }

      // joinRoom erwartet (roomIdString, nameString)
      const res = await joinRoom(rid, displayName);

      const finalRid = normRoomId(res.roomId);
      sessionStorage.setItem(`versus_player_${finalRid}`, res.playerId);

      nav(`/versus/${finalRid}`);
    } catch (e) {
      setErr(e?.message || String(e));
    }
  }

  return (
    <div
      style={{
        maxWidth: 520,
        margin: "24px auto",
        padding: 16,
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

      <h2>Versus</h2>
      <p>Erstelle einen Room oder tritt einem Room bei.</p>

      <label style={{ display: "block", marginTop: 12 }}>Dein Name</label>
      <input
        value={name}
        onChange={(e) => {
  const v = e.target.value;
  setName(v);
  localStorage.setItem("versusPlayerName", v);
}}

        style={{ width: "100%", padding: 10 }}
      />

      <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
        <button onClick={onCreate} style={{ padding: "10px 14px" }}>
          Room erstellen
        </button>
      </div>

      <hr style={{ margin: "18px 0" }} />

      <label style={{ display: "block" }}>Room-ID</label>
      <input
        value={roomId}
        onChange={(e) => setRoomId(e.target.value)}
        placeholder="z.B. ABCD12"
        style={{ width: "100%", padding: 10, textTransform: "uppercase" }}
      />

      <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
        <button onClick={onJoin} style={{ padding: "10px 14px" }}>
          Beitreten
        </button>
      </div>

      {err && <p style={{ marginTop: 12, color: "crimson" }}>{err}</p>}
    </div>
  );
}
