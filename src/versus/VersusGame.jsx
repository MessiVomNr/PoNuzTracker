// src/versus/VersusGame.js
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  arrayUnion,
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { db, auth } from "../firebase"; // ggf. Pfad anpassen

/* =========================================================
   CONFIG
========================================================= */
const ROOMS_COL = "duoRooms"; // muss zu deinen Duo-Rooms passen!

/* =========================================================
   HELPERS (named exports)
========================================================= */
export function normalizeRoomId(v) {
  return String(v || "").trim().replace(/\s+/g, "");
}

async function resolveRoomDocId(roomIdOrCode) {
  const key = normalizeRoomId(roomIdOrCode);
  if (!key) return null;

  // 1) Direkt als docId probieren
  const directRef = doc(db, ROOMS_COL, key);
  const directSnap = await getDoc(directRef);
  if (directSnap.exists()) return { docId: key, data: directSnap.data() };

  // 2) Als code-Feld probieren
  const q = query(collection(db, ROOMS_COL), where("code", "==", key));
  const qsnap = await getDocs(q);
  if (!qsnap.empty) {
    const found = qsnap.docs[0];
    return { docId: found.id, data: found.data() };
  }

  return null;
}

/* =========================================================
   ROOM API (named exports)
========================================================= */
export async function createRoom({ title = "Versus Run", edition = null, code = null } = {}) {
  const uid = auth?.currentUser?.uid;
  if (!uid) throw new Error("Not authenticated");

  const cleanCode = code ? normalizeRoomId(code) : null;
  const roomRef = cleanCode ? doc(db, ROOMS_COL, cleanCode) : doc(collection(db, ROOMS_COL));

  const roomDoc = {
    title,
    edition,
    code: cleanCode || roomRef.id,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    status: "lobby", // lobby | auction | playing | finished
    players: {
      [uid]: {
        uid,
        name: "Player",
        ready: false,
        joinedAt: serverTimestamp(),
        lastSeenAt: serverTimestamp(),
      },
    },
    versus: {
      phase: "setup",
      startedAt: null,
      turn: 0,
      log: [],
    },
  };

  await setDoc(roomRef, roomDoc, { merge: false });
  return roomRef.id;
}

export async function getRoom(roomIdOrCode) {
  const resolved = await resolveRoomDocId(roomIdOrCode);
  if (!resolved) return null;
  return { id: resolved.docId, ...resolved.data };
}

export async function joinRoom(roomIdOrCode, { name = "Player" } = {}) {
  const uid = auth?.currentUser?.uid;
  if (!uid) throw new Error("Not authenticated");

  const resolved = await resolveRoomDocId(roomIdOrCode);
  if (!resolved) return null;

  const roomRef = doc(db, ROOMS_COL, resolved.docId);

  await updateDoc(roomRef, {
    updatedAt: serverTimestamp(),
    [`players.${uid}`]: {
      uid,
      name,
      ready: false,
      joinedAt: serverTimestamp(),
      lastSeenAt: serverTimestamp(),
    },
  });

  return resolved.docId;
}

export function subscribeRoom(roomIdOrCode, cb) {
  let unsub = () => {};

  (async () => {
    const resolved = await resolveRoomDocId(roomIdOrCode);
    if (!resolved) {
      cb(null);
      return;
    }

    const roomRef = doc(db, ROOMS_COL, resolved.docId);

    unsub = onSnapshot(
      roomRef,
      (snap) => {
        if (!snap.exists()) return cb(null);
        cb({ id: snap.id, ...snap.data() });
      },
      () => cb(null)
    );
  })();

  return () => unsub();
}

export async function setReady(roomIdOrCode, ready) {
  const uid = auth?.currentUser?.uid;
  if (!uid) throw new Error("Not authenticated");

  const resolved = await resolveRoomDocId(roomIdOrCode);
  if (!resolved) return false;

  const roomRef = doc(db, ROOMS_COL, resolved.docId);

  await updateDoc(roomRef, {
    updatedAt: serverTimestamp(),
    [`players.${uid}.ready`]: !!ready,
    [`players.${uid}.lastSeenAt`]: serverTimestamp(),
  });

  return true;
}

export async function setRoomStatus(roomIdOrCode, status) {
  const resolved = await resolveRoomDocId(roomIdOrCode);
  if (!resolved) return false;

  const roomRef = doc(db, ROOMS_COL, resolved.docId);

  await updateDoc(roomRef, {
    updatedAt: serverTimestamp(),
    status: String(status || "lobby"),
  });

  return true;
}

/**
 * Startet die "Auction/Draft"-Phase (der eigentliche Draft läuft dann in DuoVersusAuction.jsx)
 * -> setzt room.status auf "auction" und optional ein Log.
 */
export async function startAuction(roomIdOrCode) {
  const resolved = await resolveRoomDocId(roomIdOrCode);
  if (!resolved) return false;

  const roomRef = doc(db, ROOMS_COL, resolved.docId);

  await updateDoc(roomRef, {
    updatedAt: serverTimestamp(),
    status: "auction",
    "versus.phase": "auction",
    "versus.startedAt": serverTimestamp(),
    "versus.log": arrayUnion({ t: Date.now(), type: "AUCTION_STARTED" }),
  });

  return true;
}

/* =========================================================
   DEFAULT EXPORT: React Page/Component
========================================================= */
export default function VersusGame() {
  const navigate = useNavigate();
  const { roomId } = useParams(); // passt zu /versus/:roomId/game
  const roomIdOrCode = roomId || "";

  const [room, setRoom] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [starting, setStarting] = useState(false);

  const uid = auth?.currentUser?.uid || null;

  const players = useMemo(() => {
    if (!room?.players) return [];
    return Object.values(room.players);
  }, [room]);

  const myPlayer = useMemo(() => {
    if (!room || !uid) return null;
    return room.players?.[uid] || null;
  }, [room, uid]);

  const allReady = useMemo(() => {
    if (players.length < 2) return false; // Duo-Minimum
    return players.every((p) => p?.ready === true);
  }, [players]);

  useEffect(() => {
    if (!roomIdOrCode) {
      setNotFound(true);
      setLoading(false);
      return;
    }

    setErr("");
    setLoading(true);

    const unsub = subscribeRoom(roomIdOrCode, (r) => {
      if (!r) {
        setRoom(null);
        setNotFound(true);
        setLoading(false);
        return;
      }
      setRoom(r);
      setNotFound(false);
      setLoading(false);
    });

    return () => unsub();
  }, [roomIdOrCode]);

  // ✅ Snapshot-Bridge: IMMER mit aufgelöster Doc-ID nach /duo/:docId/versus
  useEffect(() => {
    if (!room?.id) return;
    if (room.status !== "auction") return;

    (async () => {
      const resolved = await resolveRoomDocId(roomIdOrCode);
      const targetId = resolved?.docId || room.id;
      navigate(`/duo/${targetId}/versus`, { replace: true });
    })();
  }, [room?.status, room?.id, roomIdOrCode, navigate]);

  async function handleToggleReady() {
    if (!room) return;
    try {
      setErr("");
      await setReady(room.id, !(myPlayer?.ready));
    } catch (e) {
      setErr(e?.message || "Fehler beim Ready-Update.");
    }
  }

  async function handleStartGame() {
    if (!room || starting) return;
    try {
      setErr("");
      setStarting(true);

      // Nur starten, wenn alle ready sind
      if (!allReady) {
        setErr("Noch nicht alle bereit. Beide müssen auf Ready sein.");
        setStarting(false);
        return;
      }

      // ✅ targetId für Navigation: immer echte Firestore Doc-ID
      const resolved = await resolveRoomDocId(roomIdOrCode);
      const targetId = resolved?.docId || room.id;

      const ok = await startAuction(targetId);
      if (!ok) {
        setErr("Konnte Auction nicht starten (Room nicht gefunden).");
        setStarting(false);
        return;
      }

      // ✅ Ergebnis: DUO AUCTION URL (damit du garantiert auf DuoVersusAuction landest)
      navigate(`/duo/${targetId}/versus`, { replace: true });
    } catch (e) {
      setErr(e?.message || "Fehler beim Starten.");
      setStarting(false);
    }
  }

  if (loading) {
    return (
      <div style={{ padding: 16 }}>
        <h2>Versus</h2>
        <p>Lade Room…</p>
      </div>
    );
  }

  if (notFound) {
    return (
      <div style={{ padding: 16 }}>
        <h2>Versus</h2>
        <p style={{ marginTop: 8 }}>Room nicht gefunden.</p>
        <button onClick={() => navigate("/versus")} style={{ marginTop: 12 }}>
          Zurück
        </button>
      </div>
    );
  }

  const phase = room?.versus?.phase || "setup";
  const status = room?.status || "lobby";

  return (
    <div style={{ padding: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <div>
          <h2 style={{ margin: 0 }}>Versus Lobby</h2>

          <div style={{ opacity: 0.85, marginTop: 6 }}>
            <span>Run: </span>
            <strong>{room.title || "—"}</strong>
            <span style={{ marginLeft: 12 }}>Status: </span>
            <strong>{status}</strong>
            <span style={{ marginLeft: 12 }}>Phase: </span>
            <strong>{phase}</strong>
          </div>

          <div style={{ opacity: 0.7, marginTop: 6 }}>
            Room ID: <code>{room.id}</code>
          </div>

          {err ? (
            <div style={{ marginTop: 8, padding: 10, border: "1px solid #c33", borderRadius: 8 }}>
              <strong>Hinweis:</strong> {err}
            </div>
          ) : null}
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button onClick={() => navigate(-1)} disabled={starting}>
            Zurück
          </button>

          <button onClick={handleToggleReady} disabled={starting}>
            {myPlayer?.ready ? "Ready aus" : "Ready"}
          </button>

          <button onClick={handleStartGame} disabled={starting || !allReady || status === "auction"}>
            {starting ? "Starte…" : status === "auction" ? "Wechsel…" : "Spiel starten"}
          </button>
        </div>
      </div>

      <hr style={{ margin: "16px 0" }} />

      <h3>Spieler</h3>
      {players.length === 0 ? (
        <p>Keine Spieler gefunden.</p>
      ) : (
        <ul style={{ lineHeight: 1.7 }}>
          {players.map((p) => (
            <li key={p.uid}>
              <strong>{p.name || "Player"}</strong> {p.ready ? "✅ ready" : "⏳ not ready"}
              {p.uid === uid ? " (du)" : ""}
            </li>
          ))}
        </ul>
      )}

      <hr style={{ margin: "16px 0" }} />

      <div style={{ padding: 12, border: "1px dashed #666", borderRadius: 10 }}>
        <h3 style={{ marginTop: 0 }}>So funktioniert’s jetzt</h3>
        <p style={{ marginBottom: 0, opacity: 0.85 }}>
          Beide klicken <strong>Ready</strong>. Sobald alle ready sind, kann einer <strong>Spiel starten</strong>.
          Dann setzen wir <code>room.status = "auction"</code> und leiten zu{" "}
          <code>/duo/:roomId/versus</code> (DuoVersusAuction) weiter.
        </p>
      </div>
    </div>
  );
}
