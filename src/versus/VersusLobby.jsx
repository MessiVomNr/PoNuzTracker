import React, { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { subscribeRoom, setReady } from "./versusService";
import { auth } from "../firebase";

export default function VersusLobby() {
  const { roomId } = useParams();
  const [room, setRoom] = useState(null);

  useEffect(() => {
    const unsub = subscribeRoom(roomId, setRoom);
    return () => unsub();
  }, [roomId]);

  const players = useMemo(() => {
    const map = room?.players ?? {};
    return Object.entries(map)
      .map(([uid, p]) => ({ uid, ...p }))
      .sort((a, b) => (a.slot ?? 99) - (b.slot ?? 99));
  }, [room]);

  const myUid = auth?.currentUser?.uid ?? null;
  const me = players.find(p => p.uid === myUid);

  async function toggleReady() {
    if (!me) return;
    await setReady(roomId, !me.ready);
  }

  return (
    <div style={{ maxWidth: 700, margin: "24px auto", padding: 16 }}>
      <h2>Versus Lobby – Room {roomId}</h2>

      {!room && <p>Lade Room…</p>}

      {room && (
        <>
          <p>Status: <b>{room.status}</b></p>

          <h3>Spieler</h3>
          <div style={{ display: "grid", gap: 10 }}>
            {players.map(p => (
              <div key={p.uid} style={{ border: "1px solid #333", padding: 12, borderRadius: 10 }}>
                <div><b>Slot {p.slot}</b> – {p.name}</div>
                <div>Ready: {p.ready ? "✅" : "❌"}</div>
              </div>
            ))}
          </div>

          <div style={{ marginTop: 16, display: "flex", gap: 10, alignItems: "center" }}>
            <button onClick={toggleReady} disabled={!me} style={{ padding: "10px 14px" }}>
              {me?.ready ? "Ready aus" : "Ready"}
            </button>
            {!me && (
              <span style={{ color: "orange" }}>
                Du bist nicht als Spieler erkannt (Auth). Wenn du kein Firebase-Auth nutzt, sag’s mir – dann baue ich es ohne Auth.
              </span>
            )}
          </div>

          <p style={{ marginTop: 16, opacity: 0.8 }}>
            Test: Öffne diese Seite in einem zweiten Browser/Handy, tritt dem Room bei und toggle Ready – es sollte live updaten.
          </p>
        </>
      )}
    </div>
  );
}
