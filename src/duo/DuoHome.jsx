import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { createDuoRoom, joinDuoRoom, subscribeDuoRoom } from "./duoService";
import RecentRoomsPanel from "./RecentRoomsPanel";
import { upsertRecentRoom } from "./recentRooms";

export default function DuoHome() {
  const nav = useNavigate();
  const [name, setName] = useState("Spieler");
  const [roomTitle, setRoomTitle] = useState(""); // ✅ NEU: Name des Online-Runs
  const [roomId, setRoomId] = useState("");
  const [mode, setMode] = useState("duo");
  const [edition, setEdition] = useState("Rot");
  const [err, setErr] = useState("");
  const [preview, setPreview] = useState(null);

  // Helper: Spieler-Liste aus preview.players ziehen
  const previewPlayerNames = (() => {
    const players = preview?.players;
    if (!players || typeof players !== "object") return [];
    return Object.values(players)
      .map((p) => (p?.displayName || "").trim())
      .filter(Boolean);
  })();

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
        // ✅ NEU: Titel in Firestore speichern
        title: (roomTitle || "").trim(),
      });

      localStorage.setItem("activeDuoRoomId", res.roomId);

      // ✅ Recent Rooms speichern (inkl. Titel)
      upsertRecentRoom({
        roomId: res.roomId,
        linkMode: mode,
        edition,
        title: (roomTitle || "").trim(),
        lastPlayers: [name.trim() || "Spieler"],
      });

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

      // ✅ Daten aus Preview übernehmen (wenn vorhanden)
      const linkModeFromPreview = preview?.save?.linkMode;
      const editionFromPreview = preview?.save?.edition;
      const titleFromPreview = preview?.save?.title || preview?.save?.name; // falls du es mal "name" genannt hast

      upsertRecentRoom({
        roomId: res.roomId,
        linkMode: linkModeFromPreview || mode,
        edition: editionFromPreview || edition,
        title: (titleFromPreview || "").trim(),
        lastPlayers: previewPlayerNames.length ? previewPlayerNames : [name.trim() || "Spieler"],
      });

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

      <h2>Online</h2>
      <p>Gemeinsamer Cloud-Spielstand (live).</p>

      <label style={{ display: "block", marginTop: 12 }}>Dein Name</label>
      <input value={name} onChange={(e) => setName(e.target.value)} style={{ width: "100%", padding: 10 }} />

      {/* ✅ NEU: Titel */}
      <label style={{ display: "block", marginTop: 12 }}>Name des Online-Runs</label>
      <input
        value={roomTitle}
        onChange={(e) => setRoomTitle(e.target.value)}
        placeholder='z. B. "Theo & Max - Rot Nuzlocke"'
        style={{ width: "100%", padding: 10 }}
      />

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
        <div style={{ marginTop: 10, opacity: 0.9 }}>
          <div>
            Vorschau: <b>{preview.save?.title || preview.save?.name || "—"}</b>{" "}
            ({preview.save?.edition || "?"} / {preview.save?.linkMode || "?"})
          </div>
          <div style={{ fontSize: 13, opacity: 0.85, marginTop: 4 }}>
            Spieler: {previewPlayerNames.length ? previewPlayerNames.join(", ") : "—"}
          </div>
        </div>
      )}

      {err && <p style={{ marginTop: 12, color: "crimson" }}>{err}</p>}

      {/* ✅ Recent Rooms Panel */}
      <RecentRoomsPanel
        ttlDays={7}
        onReconnect={(room) => {
          localStorage.setItem("activeDuoRoomId", room.roomId);
          upsertRecentRoom(room); // lastSeen hochziehen
          nav("/table", { replace: true });
        }}
      />
    </div>
  );
}
