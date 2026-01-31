import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { createDuoRoom, joinDuoRoom, subscribeDuoRoom } from "./duoService";

export default function DuoHome() {
  const nav = useNavigate();
  const [name, setName] = useState("Spieler");
  const [roomId, setRoomId] = useState("");
  const [mode, setMode] = useState("duo");
  const [edition, setEdition] = useState("Rot");
  const [err, setErr] = useState("");
  const [preview, setPreview] = useState(null);

  useEffect(() => {
    const id = roomId.trim().toUpperCase();
    if (id.length < 4) {
      setPreview(null);
      return;
    }
    const unsub = subscribeDuoRoom(id, (data) => {
      if (!data || data.__error) return;
      setPreview(data);
    });
    return () => unsub();
  }, [roomId]);

  async function onCreate() {
    setErr("");
    try {
      const res = await createDuoRoom({
        displayName: name.trim() || "Spieler",
        edition,
        linkMode: mode,
      });
      localStorage.setItem("activeDuoRoomId", res.roomId);
      nav("/table");
    } catch (e) {
      setErr(e?.message || String(e));
    }
  }

  async function onJoin() {
    setErr("");
    try {
      const id = roomId.trim().toUpperCase();
      const res = await joinDuoRoom(id, { displayName: name.trim() || "Spieler" });
      localStorage.setItem("activeDuoRoomId", res.roomId);
      nav("/table");
    } catch (e) {
      setErr(e?.message || String(e));
    }
  }

  return (
    <div style={{ maxWidth: 520, margin: "24px auto", padding: 16, position: "relative" }}>
      <button
        onClick={() => nav("/")}
        style={{ position: "absolute", top: 0, right: 0, padding: "8px 12px" }}
      >
        Zur Startseite
      </button>

      <h2>Duo Online</h2>
      <p>Gemeinsamer Cloud-Spielstand (live).</p>

      <label style={{ display: "block", marginTop: 12 }}>Dein Name</label>
      <input value={name} onChange={(e) => setName(e.target.value)} style={{ width: "100%", padding: 10 }} />

      <label style={{ display: "block", marginTop: 12 }}>Modus</label>
      <select value={mode} onChange={(e) => setMode(e.target.value)} style={{ width: "100%", padding: 10 }}>
        <option value="duo">Duo</option>
        <option value="trio">Trio</option>
      </select>

      <label style={{ display: "block", marginTop: 12 }}>Edition</label>
      <input value={edition} onChange={(e) => setEdition(e.target.value)} style={{ width: "100%", padding: 10 }} />

      <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
        <button onClick={onCreate} style={{ padding: "10px 14px" }}>
          Online-Run erstellen
        </button>
      </div>

      <hr style={{ margin: "18px 0" }} />

      <label style={{ display: "block" }}>Room-ID</label>
      <input
        value={roomId}
        onChange={(e) => setRoomId(e.target.value)}
        placeholder="z.B. ABCD12"
        style={{ width: "100%", padding: 10 }}
      />

      <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
        <button onClick={onJoin} style={{ padding: "10px 14px" }}>
          Beitreten
        </button>
      </div>

      {preview && (
        <p style={{ marginTop: 10, opacity: 0.85 }}>
          Vorschau: {preview.save?.edition || "?"} / {preview.save?.linkMode || "?"} – Spieler:{" "}
          {preview.players ? Object.keys(preview.players).length : 0}
        </p>
      )}

      {err && <p style={{ marginTop: 12, color: "crimson" }}>{err}</p>}
    </div>
  );
}
