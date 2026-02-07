// src/pages/VersusHome.jsx
import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { createRoom, joinRoom, getStoredPlayerId } from "./versusService";
import RecentVersusRoomsPanel from "./recentVersusRoomsPanel";
import { upsertRecentVersusRoom } from "./recentVersusRooms";
import { db } from "../firebase";
import { doc, deleteDoc, getDoc } from "firebase/firestore";

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

  // ✅ Helper: PlayerId für einen Room aus sessionStorage lesen
  function getSessionPlayerIdForRoom(rid) {
    const key = `versus_player_${rid}`;
    return sessionStorage.getItem(key) || "";
  }

  // ✅ Nach Create/Join: recent speichern (inkl. Titel aus Firestore, falls vorhanden)
  async function saveRecentRoom(rid) {
    try {
      const snap = await getDoc(doc(db, "versusRooms", rid));
      const data = snap.exists() ? snap.data() : null;
      const title = String(data?.title || data?.roomTitle || "").trim();
      upsertRecentVersusRoom({ roomId: rid, title, lastSeenAt: Date.now() });
    } catch {
      // fallback ohne title
      upsertRecentVersusRoom({ roomId: rid, title: "", lastSeenAt: Date.now() });
    }
  }

  async function onCreate() {
    setErr("");
    try {
      const displayName = normName(name);

      // createRoom erwartet STRING
      const res = await createRoom(displayName);

      const rid = normRoomId(res.roomId);
      const pid = String(res.playerId || "");

      // session storage (wie du es schon machst)
      sessionStorage.setItem(`versus_player_${rid}`, pid);

      // ✅ recent upsert
      await saveRecentRoom(rid);

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
      const pid = String(res.playerId || "");

      sessionStorage.setItem(`versus_player_${finalRid}`, pid);

      // ✅ recent upsert
      await saveRecentRoom(finalRid);

      nav(`/versus/${finalRid}`);
    } catch (e) {
      setErr(e?.message || String(e));
    }
  }

  // ✅ Reconnect aus Recent Panel
  async function reconnectToRoom(roomIdFromList) {
    setErr("");
    const rid = normRoomId(roomIdFromList);
    if (!rid) return;
// ✅ Reconnect = alten Player wiederherstellen
const oldPid = getStoredPlayerId(rid);
if (oldPid) {
  sessionStorage.setItem(`versus_player_${rid}`, oldPid);
}

    try {
      const snap = await getDoc(doc(db, "versusRooms", rid));
      if (!snap.exists()) {
        setErr("Lobby nicht gefunden (evtl. gelöscht).");
        return;
      }

      // ✅ recent wieder nach oben pushen
      await saveRecentRoom(rid);

      nav(`/versus/${rid}`);
    } catch (e) {
      setErr(e?.message || "Reconnect fehlgeschlagen.");
    }
  }

  // ✅ Host-Check: nur Host darf löschen (UI + extra Safety)
  async function isHostOfRoom(roomIdFromList) {
    const rid = normRoomId(roomIdFromList);
    if (!rid) return false;

    // Unser playerId aus sessionStorage (wichtig: nur wenn du schonmal drin warst)
    const myPid = getSessionPlayerIdForRoom(rid);
    if (!myPid) return false;

    try {
      const snap = await getDoc(doc(db, "versusRooms", rid));
      if (!snap.exists()) return false;

      const data = snap.data() || {};
      return String(data?.hostPlayerId || "") === String(myPid);
    } catch {
      return false;
    }
  }

  // ✅ Lobby löschen (Firestore)
  async function deleteLobby(roomIdFromList) {
    setErr("");
    const rid = normRoomId(roomIdFromList);
    if (!rid) return;

    // Safety: nur Host darf löschen
    const okHost = await isHostOfRoom(rid);
    if (!okHost) {
      setErr("Du kannst diese Lobby nicht löschen (nicht Host / kein PlayerId gespeichert).");
      return;
    }

    const ok = window.confirm(`Lobby ${rid} wirklich aus der Datenbank löschen?`);
    if (!ok) return;

    try {
      await deleteDoc(doc(db, "versusRooms", rid));
      removeRecentVersusRoom(rid);
      // Panel entfernt das nicht automatisch aus localStorage; das machst du über “Aus Liste entfernen”
      // (Optional könntest du hier zusätzlich removeRecentVersusRoom(rid) aufrufen)
    } catch (e) {
      setErr("Raum wurde gelöscht");
    }
  }

  // ✅ canDeleteRoom für Panel (async -> wir lösen das so: sync cache pro render)
  // Wir bauen eine kleine Map, die pro roomId cached, ob Host.
  const [hostMap, setHostMap] = useState({}); // { [rid]: boolean }

  async function ensureHostFlag(rid) {
    const id = normRoomId(rid);
    if (!id) return false;

    // already cached?
    if (Object.prototype.hasOwnProperty.call(hostMap, id)) return hostMap[id];

    const ok = await isHostOfRoom(id);
    setHostMap((prev) => ({ ...prev, [id]: ok }));
    return ok;
  }

  return (
  <div style={pageWrap}>
    <div style={card}>

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

      {/* ✅ Recent Lobbys Panel */}
      <div style={{ marginTop: 12, marginBottom: 16 }}>
        <RecentVersusRoomsPanel
          onReconnect={(rid) => reconnectToRoom(rid)}
          onDeleteRoom={(rid) => deleteLobby(rid)}
          canDeleteRoom={(rid) => {
            const id = normRoomId(rid);
            if (!id) return false;

            // falls noch nicht geladen, async nachladen (fire-and-forget) und erstmal false
            if (!Object.prototype.hasOwnProperty.call(hostMap, id)) {
              ensureHostFlag(id);
              return false;
            }
            return !!hostMap[id];
          }}
        />
      </div>

      <label style={{ display: "block", marginTop: 12 }}>Dein Name</label>
      <input
        value={name}
        onChange={(e) => {
          const v = e.target.value;
          setName(v);
          localStorage.setItem("versusPlayerName", v);
        }}
        style={input}
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
        style={inputUpper}
      />

      <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
        <button onClick={onJoin} style={{ padding: "10px 14px" }}>
          Beitreten
        </button>
      </div>

      {err && <p style={{ marginTop: 12, color: "crimson" }}>{err}</p>}
        </div>
  </div>
);
}
const pageWrap = {
  minHeight: "100vh",
  padding: 16,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  backgroundImage: 'url("/backgrounds/background_1.png")',
  backgroundSize: "cover",
  backgroundPosition: "center",
  backgroundRepeat: "no-repeat",
};

const card = {
  width: "min(560px, 92vw)",
  padding: 16,
  borderRadius: 18,
  border: "1px solid rgba(255,255,255,0.14)",
  background: "rgba(10,10,16,0.55)",
  backdropFilter: "blur(10px)",
  color: "white",
  position: "relative",
};

const input = {
  width: "min(380px, 100%)",
  padding: 10,
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.14)",
  background: "rgba(0,0,0,0.25)",
  color: "white",
  outline: "none",
};

const inputUpper = {
  ...input,
  textTransform: "uppercase",
};
