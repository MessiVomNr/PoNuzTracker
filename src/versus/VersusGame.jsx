import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  onSnapshot,
  serverTimestamp,
  arrayUnion,
} from "firebase/firestore";
import { db } from "../firebase";

// IMMER gleich normalisieren (case-sensitive Doc-IDs!)
export function normalizeRoomId(roomId) {
  return String(roomId || "").trim().toUpperCase();
}

function makeRoomCode(len = 6) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // ohne I/O/1/0
  let out = "";
  for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

function roomRef(roomId) {
  return doc(db, "versusRooms", normalizeRoomId(roomId));
}

// ===== CREATE =====
export async function createRoom(hostDisplayName = "Spieler") {
  const id = makeRoomCode(6);
  const rid = normalizeRoomId(id);

  const ref = roomRef(rid);

  const hostPlayerId = "P" + Math.random().toString(16).slice(2, 10).toUpperCase();

  const roomData = {
    id: rid,
    status: "lobby",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    hostPlayerId,

    // players: Array, so wie du es schon nutzt
    players: [
      {
        id: hostPlayerId,
        displayName: hostDisplayName || "Host",
        ready: false,
        joinedAt: Date.now(),
      },
    ],
  };

  await setDoc(ref, roomData);

  return { roomId: rid, playerId: hostPlayerId };
}

// ===== JOIN =====
export async function joinRoom(roomId, displayName = "Spieler") {
  const rid = normalizeRoomId(roomId);
  const ref = roomRef(rid);

  const snap = await getDoc(ref);
  if (!snap.exists()) {
    throw new Error("Room nicht gefunden");
  }

  const playerId = "P" + Math.random().toString(16).slice(2, 10).toUpperCase();

  // Spieler hinzufügen (arrayUnion)
  await updateDoc(ref, {
    players: arrayUnion({
      id: playerId,
      displayName: displayName || "Spieler",
      ready: false,
      joinedAt: Date.now(),
    }),
    updatedAt: serverTimestamp(),
  });

  return { roomId: rid, playerId };
}

// ===== READ =====
export async function getRoom(roomId) {
  const rid = normalizeRoomId(roomId);
  const snap = await getDoc(roomRef(rid));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}

// ===== LIVE =====
export function subscribeRoom(roomId, cb) {
  const rid = normalizeRoomId(roomId);
  return onSnapshot(roomRef(rid), (snap) => {
    cb(snap.exists() ? { id: snap.id, ...snap.data() } : null);
  });
}

// ===== STATUS =====
export async function setRoomStatus(roomId, playerId, status) {
  const rid = normalizeRoomId(roomId);
  const ref = roomRef(rid);

  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("Room nicht gefunden");

  const data = snap.data();
  const players = Array.isArray(data.players) ? data.players : [];
  const nextPlayers = players.map((p) => (p.id === playerId ? { ...p } : p));

  await updateDoc(ref, {
    status,
    players: nextPlayers,
    updatedAt: serverTimestamp(),
  });
}

// OPTIONAL: READY Toggle (falls du es nutzt)
export async function setReady(roomId, playerId, ready) {
  const rid = normalizeRoomId(roomId);
  const ref = roomRef(rid);

  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("Room nicht gefunden");

  const data = snap.data();
  const players = Array.isArray(data.players) ? data.players : [];
  const nextPlayers = players.map((p) => (p.id === playerId ? { ...p, ready: !!ready } : p));

  await updateDoc(ref, {
    players: nextPlayers,
    updatedAt: serverTimestamp(),
  });
}
