// src/duo/DuoLobby.jsx
import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { joinDuoRoom } from "./duoService";

export default function DuoLobby() {
  const nav = useNavigate();
  const { roomId } = useParams();

  const [err, setErr] = useState("");

  useEffect(() => {
    let alive = true;

    async function run() {
      try {
        const id = String(roomId || "").trim().toUpperCase();
        if (!id) throw new Error("Ungültige Room-ID.");

        // Name aus localStorage oder Default
        const displayName = (localStorage.getItem("duoPlayerName") || "Spieler").trim() || "Spieler";

        // Join in Firestore (damit du als Spieler wirklich drin bist)
        await joinDuoRoom(id, { displayName });

        // Active Room setzen (EncounterTable nutzt activeDuoRoomId)
        localStorage.setItem("activeDuoRoomId", id);
        // optionaler Alias (falls du irgendwo anders noch drauf zugreifst)
        localStorage.setItem("duo_roomId", id);

        // Ab in die Online-EncounterTable
        nav("/table", { replace: true });
      } catch (e) {
        if (!alive) return;
        setErr(e?.message || String(e));
      }
    }

    run();
    return () => {
      alive = false;
    };
  }, [roomId, nav]);

  return (
    <div style={{ maxWidth: 520, margin: "24px auto", padding: 16, color: "white" }}>
      <h2>Lobby beitreten…</h2>
      <p style={{ opacity: 0.8 }}>
        Room: <b>{String(roomId || "").toUpperCase()}</b>
      </p>

      {!err ? (
        <p style={{ opacity: 0.8 }}>Verbinde…</p>
      ) : (
        <div style={{ marginTop: 12, color: "crimson" }}>
          <b>Fehler:</b> {err}
          <div style={{ marginTop: 12 }}>
            <button onClick={() => nav("/duo")} style={{ padding: "10px 14px" }}>
              Zurück
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
