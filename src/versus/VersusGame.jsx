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
import { db, auth } from "../firebase"; // <-- ggf. Pfad anpassen

/* =========================================================
   CONFIG
========================================================= */
const ROOMS_COL = "duoRooms"; // wenn du Versus-Rooms getrennt willst: z.B. "versusRooms"

/* =========================================================
   HELPERS (named exports)
========================================================= */

/**
 * Normalisiert RoomId/Code (User Input).
 * - trim
 * - optional: uppercase (falls du Codes uppercase speicherst)
 */
export function normalizeRoomId(v) {
  return String(v || "")
    .trim()
    .replace(/\s+/g, "");
}

/**
 * Versucht erst docId zu laden; wenn nicht existent, sucht nach Feld `code == input`.
 * Gibt { docId, data } oder null zurück.
 */
async function resolveRoomDocId(roomIdOrCode) {
  const key = normalizeRoomId(roomIdOrCode);
  if (!key) return null;

  // 1) Direkt als docId probieren
  const directRef = doc(db, ROOMS_COL, key);
  const directSnap = await getDoc(directRef);
  if (directSnap.exists()) return { docId: key, data: directSnap.data() };

  // 2) Als room code probieren
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

export async function createRoom({
  title = "Versus Run",
  edition = null,
  code = null,
} = {}) {
  const uid = auth?.currentUser?.uid;
  if (!uid) throw new Error("Not authenticated");

  const cleanCode = code ? normalizeRoomId(code) : null;

  // Wenn code gesetzt ist, nutzen wir den code als docId (praktisch für kurze IDs).
  // Wenn du docId automatisch willst: doc(collection(db, ROOMS_COL)).id verwenden.
  const roomRef = cleanCode ? doc(db, ROOMS_COL, cleanCode) : doc(collection(db, ROOMS_COL));

  const roomDoc = {
    title,
    edition,
    code: cleanCode || roomRef.id, // falls du später per code suchen willst
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    status: "lobby", // lobby | ready | playing | finished
    players: {
      [uid]: {
        uid,
        name: "Player",
        ready: false,
        joinedAt: serverTimestamp(),
        lastSeenAt: serverTimestamp(),
      },
    },
    // optionales Versus-State (später erweitern)
    versus: {
      phase: "setup", // setup | draft | battle | done
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

/* =========================================================
   DEFAULT EXPORT: React Page/Component (fixes your import)
========================================================= */

export default function VersusGame() {
  const navigate = useNavigate();
  const params = useParams();

  // Passe das an deinen Router an:
  // z.B. /duo/:roomId/versus oder /versus/:roomId
  const roomIdOrCode = params.roomId || params.id || params.code || "";

  const [room, setRoom] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const [loading, setLoading] = useState(true);

  const uid = auth?.currentUser?.uid || null;

  const myPlayer = useMemo(() => {
    if (!room || !uid) return null;
    return room.players?.[uid] || null;
  }, [room, uid]);

  useEffect(() => {
    if (!roomIdOrCode) {
      setNotFound(true);
      setLoading(false);
      return;
    }

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

  async function handleToggleReady() {
    if (!room) return;
    await setReady(room.id, !(myPlayer?.ready));
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
        <button onClick={() => navigate("/duo")} style={{ marginTop: 12 }}>
          Zurück zur Lobby
        </button>
      </div>
    );
  }

  const players = room?.players ? Object.values(room.players) : [];

  return (
    <div style={{ padding: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
        <div>
          <h2 style={{ margin: 0 }}>Versus</h2>
          <div style={{ opacity: 0.8, marginTop: 4 }}>
            <span>Run: </span>
            <strong>{room.title || "—"}</strong>
            <span style={{ marginLeft: 12 }}>Status: </span>
            <strong>{room.status || "—"}</strong>
          </div>
          <div style={{ opacity: 0.7, marginTop: 4 }}>
            Room ID: <code>{room.id}</code>
          </div>
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => navigate(-1)}>Zurück</button>
          <button onClick={handleToggleReady}>
            {myPlayer?.ready ? "Ready aus" : "Ready"}
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
              <strong>{p.name || "Player"}</strong>{" "}
              {p.ready ? "✅ ready" : "⏳ not ready"}
              {p.uid === uid ? " (du)" : ""}
            </li>
          ))}
        </ul>
      )}

      <hr style={{ margin: "16px 0" }} />

      <h3>Versus (Platzhalter)</h3>
      <p style={{ opacity: 0.85 }}>
        Hier kommt als nächstes dein Draft/Battle/Compare-UI rein (live-sync über room.versus).
      </p>
    </div>
  );
}
