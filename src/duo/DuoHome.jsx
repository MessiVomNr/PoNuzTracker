import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { createDuoRoom, joinDuoRoom, subscribeDuoRoom } from "./duoService";
import RecentRoomsPanel from "./RecentRoomsPanel";
import { upsertRecentRoom } from "./recentRooms";

// ✅ NEU: Editions-Daten wie Solo
import editionData from "../data/editionData.js";
import { getGenFromEdition } from "../utils/editionHelpers";

export default function DuoHome() {
  const nav = useNavigate();

  // ✅ Name merken (wie du wolltest)
  const [name, setName] = useState(() => localStorage.getItem("duoPlayerName") || "Spieler");

  const [roomTitle, setRoomTitle] = useState("");
  const [roomId, setRoomId] = useState("");
  const [mode, setMode] = useState("duo");
  const [edition, setEdition] = useState("Rot");
  const [err, setErr] = useState("");
  const [preview, setPreview] = useState(null);

  // Name immer speichern
  useEffect(() => {
    localStorage.setItem("duoPlayerName", name);
  }, [name]);

  // ===== Editions-Liste wie Solo (aus editionData) =====
  const editionGroups = useMemo(() => {
    const keys = Object.keys(editionData || {});
    const byGen = new Map();

    for (const ed of keys) {
      const gen = getGenFromEdition(ed) || "Sonstiges";
      if (!byGen.has(gen)) byGen.set(gen, []);
      byGen.get(gen).push(ed);
    }

    // Sortierung: Gen numerisch, dann Name
    const genOrder = Array.from(byGen.keys()).sort((a, b) => {
      const na = Number(a);
      const nb = Number(b);
      if (!Number.isNaN(na) && !Number.isNaN(nb)) return na - nb;
      return String(a).localeCompare(String(b));
    });

    return genOrder.map((gen) => {
      const list = (byGen.get(gen) || []).slice().sort((a, b) => a.localeCompare(b));
      return { gen, list };
    });
  }, []);

  // Falls im State eine Edition steht, die nicht in editionData ist (custom),
  // behalten wir sie als Option, damit nichts "kaputt" wirkt.
  const editionExistsInList = useMemo(() => {
    return !!editionData?.[edition];
  }, [edition]);

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
      const displayName = (name || "").trim() || "Spieler";
      localStorage.setItem("duoPlayerName", displayName);

      const res = await createDuoRoom({
        displayName,
        edition,
        linkMode: mode,
        title: (roomTitle || "").trim(),
      });

      localStorage.setItem("activeDuoRoomId", res.roomId);

      upsertRecentRoom({
        roomId: res.roomId,
        linkMode: mode,
        edition,
        title: (roomTitle || "").trim(),
        lastPlayers: [displayName],
      });

      nav("/table");
    } catch (e) {
      setErr(e?.message || String(e));
    }
  }

  async function onJoin() {
    setErr("");
    try {
      const displayName = (name || "").trim() || "Spieler";
      localStorage.setItem("duoPlayerName", displayName);

      const id = roomId.trim().toUpperCase();
      const res = await joinDuoRoom(id, { displayName });

      localStorage.setItem("activeDuoRoomId", res.roomId);

      const linkModeFromPreview = preview?.save?.linkMode;
      const editionFromPreview = preview?.save?.edition;
      const titleFromPreview = preview?.save?.title || preview?.save?.name;

      upsertRecentRoom({
        roomId: res.roomId,
        linkMode: linkModeFromPreview || mode,
        edition: editionFromPreview || edition,
        title: (titleFromPreview || "").trim(),
        lastPlayers: previewPlayerNames.length ? previewPlayerNames : [displayName],
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

      {/* ✅ NEU: Edition als Dropdown wie Solo */}
      <label style={{ display: "block", marginTop: 12 }}>Edition</label>
      <select value={edition} onChange={(e) => setEdition(e.target.value)} style={{ width: "100%", padding: 10 }}>
        {!editionExistsInList && <option value={edition}>Benutzerdefiniert: {edition}</option>}

        {editionGroups.map((g) => (
          <optgroup key={String(g.gen)} label={`Gen ${g.gen}`}>
            {g.list.map((ed) => (
              <option key={ed} value={ed}>
                {ed}
              </option>
            ))}
          </optgroup>
        ))}
      </select>

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
            Vorschau: <b>{preview.save?.title || preview.save?.name || "—"}</b> ({preview.save?.edition || "?"} /{" "}
            {preview.save?.linkMode || "?"})
          </div>
          <div style={{ fontSize: 13, opacity: 0.85, marginTop: 4 }}>
            Spieler: {previewPlayerNames.length ? previewPlayerNames.join(", ") : "—"}
          </div>
        </div>
      )}

      {err && <p style={{ marginTop: 12, color: "crimson" }}>{err}</p>}

      <RecentRoomsPanel
        ttlDays={7}
        onReconnect={(room) => {
          localStorage.setItem("activeDuoRoomId", room.roomId);
          upsertRecentRoom(room);
          nav("/table", { replace: true });
        }}
      />
    </div>
  );
}
