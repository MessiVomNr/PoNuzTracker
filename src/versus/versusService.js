// src/versus/versusService.js
// Firestore Versus Rooms (Online Join möglich) — SYSTEM A
// Collection: versusRooms
// players: Array
// playerId: sessionStorage (lokal generiert)

import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  onSnapshot,
  serverTimestamp,
  runTransaction,
  arrayUnion,
} from "firebase/firestore";
import { db, auth } from "../firebase";
// ===========================
// PlayerId persist per room (localStorage)
// ===========================
const PLAYER_ID_LS_KEY = "ponuztracker_versus_player_ids_v1";

export function getStoredPlayerId(roomId) {
  try {
    const rid = String(roomId || "").trim().toUpperCase();
    if (!rid) return "";
    const raw = localStorage.getItem(PLAYER_ID_LS_KEY);
    const obj = raw ? JSON.parse(raw) : {};
    return String(obj?.[rid] || "");
  } catch {
    return "";
  }
}

export function storePlayerId(roomId, playerId) {
  try {
    const rid = String(roomId || "").trim().toUpperCase();
    const pid = String(playerId || "");
    if (!rid || !pid) return;

    const raw = localStorage.getItem(PLAYER_ID_LS_KEY);
    const obj = raw ? JSON.parse(raw) : {};
    obj[rid] = pid;

    localStorage.setItem(PLAYER_ID_LS_KEY, JSON.stringify(obj));
  } catch {
    // ignore
  }
}

const COLLECTION = "versusRooms";

export function normalizeRoomId(roomId) {
  return String(roomId || "").trim().toUpperCase();
}

function normalizeName(v) {
  const n = String(v ?? "").trim();
  return n || "Spieler";
}

function genRoomId() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // ohne I/O/1/0
  let out = "";
  for (let i = 0; i < 6; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

function genPlayerId() {
  // für SessionStorage reicht das völlig
  return "P" + Math.random().toString(16).slice(2, 10).toUpperCase();
}

function roomRef(roomId) {
  return doc(db, COLLECTION, normalizeRoomId(roomId));
}

/**
 * createRoom(displayName)  ODER  createRoom({displayName})
 */
export async function createRoom(playerOrName) {
  const displayName = normalizeName(
    typeof playerOrName === "string" ? playerOrName : playerOrName?.displayName
  );

  // unique room id erzeugen
  let rid = genRoomId();
  for (let i = 0; i < 20; i++) {
    const snap = await getDoc(roomRef(rid));
    if (!snap.exists()) break;
    rid = genRoomId();
  }

  const playerId = genPlayerId();
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error("Nicht eingeloggt (Auth UID fehlt).");

  const data = {
    createdByUid: uid,
    id: rid,
    status: "lobby",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    hostPlayerId: playerId,
    players: [
      {
        id: playerId,
        displayName,
        ready: false,
        joinedAt: Date.now(),
      },
    ],

    // optional: Versus-spezifischer Bereich (kannst du später erweitern)
    versus: {
      phase: "lobby", // lobby | auction | playing | finished
      startedAt: null,
      turn: 0,
      log: [],
    },
  };

  await setDoc(roomRef(rid), data);
storePlayerId(rid, playerId);
  return { roomId: rid, playerId };
}

/**
 * joinRoom(roomId, displayName)  ODER  joinRoom(roomId, {displayName})
 */
export async function joinRoom(roomId, playerOrName) {
  const rid = normalizeRoomId(roomId);
  if (!rid) throw new Error("Bitte eine Room-ID eingeben.");

  const displayName = normalizeName(
    typeof playerOrName === "string" ? playerOrName : playerOrName?.displayName
  );

  const ref = roomRef(rid);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("Room nicht gefunden.");

  const playerId = genPlayerId();

  // Transaction, damit join sicher ist
  await runTransaction(db, async (tx) => {
    const s = await tx.get(ref);
    if (!s.exists()) throw new Error("Room nicht gefunden.");

    const room = s.data();
    const players = Array.isArray(room.players) ? room.players : [];

    // optional: doppelte Namen/PlayerIds verhindern (eher unwahrscheinlich)
    if (players.some((p) => p?.id === playerId)) return;

    tx.update(ref, {
      players: arrayUnion({
        id: playerId,
        displayName,
        ready: false,
        joinedAt: Date.now(),
      }),
      updatedAt: serverTimestamp(),
    });
  });
storePlayerId(rid, playerId);
  return { roomId: rid, playerId };
}

export async function getRoom(roomId) {
  const rid = normalizeRoomId(roomId);
  if (!rid) return null;

  const snap = await getDoc(roomRef(rid));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}

export function subscribeRoom(roomId, cb) {
  const rid = normalizeRoomId(roomId);
  if (!rid) {
    cb(null);
    return () => {};
  }

  return onSnapshot(roomRef(rid), (snap) => {
    cb(snap.exists() ? { id: snap.id, ...snap.data() } : null);
  });
}

export async function setReady(roomId, playerId, ready) {
  const rid = normalizeRoomId(roomId);
  const pid = String(playerId || "").trim();
  if (!rid || !pid) throw new Error("Ungültige IDs.");

  const ref = roomRef(rid);

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error("Room nicht gefunden.");

    const room = snap.data();
    const players = Array.isArray(room.players) ? room.players : [];

    const idx = players.findIndex((p) => p?.id === pid);
    if (idx === -1) throw new Error("Spieler nicht im Room gefunden.");

    const next = [...players];
    next[idx] = { ...next[idx], ready: !!ready };

    tx.update(ref, { players: next, updatedAt: serverTimestamp() });
  });
}

/**
 * setRoomStatus:
 * status = lobby | auction | playing | finished
 * Nur Host darf das.
 */
export async function setRoomStatus(roomId, playerId, status) {
  const rid = normalizeRoomId(roomId);
  const pid = String(playerId || "").trim();
  if (!rid || !pid) throw new Error("Ungültige IDs.");

  const ref = roomRef(rid);

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error("Room nicht gefunden.");

    const room = snap.data();
    if (room.hostPlayerId !== pid) throw new Error("Nur der Host darf das ändern.");

    const s =
      status === "auction" ? "auction" :
      status === "playing" ? "playing" :
      status === "finished" ? "finished" :
      "lobby";

    tx.update(ref, { status: s, "versus.phase": s, updatedAt: serverTimestamp() });
  });
}
