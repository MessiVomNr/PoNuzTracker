// src/versus/versusService.js
// Firestore Versus Rooms (Online Join möglich) — SYSTEM A
// Collection: versusRooms
// players: Array<{ id, displayName, ready, joinedAt, lastSeenAt, active }>
// hostPlayerId: string

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
  return "P" + Math.random().toString(16).slice(2, 10).toUpperCase();
}

function roomRef(roomId) {
  return doc(db, COLLECTION, normalizeRoomId(roomId));
}

export function getStoredPlayerId(roomId) {
  try {
    const rid = normalizeRoomId(roomId);
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
    const rid = normalizeRoomId(roomId);
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

// ===========================
// Helpers: Player finden (Array!)
// ===========================
function normId(v) {
  return String(v ?? "").trim();
}

function findPlayerIndex(players, targetId) {
  const t = normId(targetId);
  if (!t) return -1;
  return players.findIndex((p) => {
    if (!p) return false;
    return (
      normId(p.id) === t ||
      normId(p.playerId) === t ||
      normId(p.deviceId) === t ||
      normId(p.uid) === t
    );
  });
}

function ensureAuthUid() {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error("Nicht eingeloggt (Auth UID fehlt).");
  return uid;
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

  ensureAuthUid();

  // wenn es für den Room schon eine ID gäbe (eigentlich neu), nutze sie – sonst generiere
  const stored = getStoredPlayerId(rid);
  const playerId = stored || genPlayerId();

  const data = {
    createdByUid: auth.currentUser.uid,
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
    lastSeenAt: Date.now(),
    active: true,
  },
],

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
 * - Rejoin: nutzt gespeicherte PlayerId pro Room
 * - Wenn Player bereits existiert: setzt active=true, updated displayName, lastSeenAt
 */
export async function joinRoom(roomId, playerOrName) {
  const rid = normalizeRoomId(roomId);
  if (!rid) throw new Error("Bitte eine Room-ID eingeben.");

  ensureAuthUid();

  const displayName = normalizeName(
    typeof playerOrName === "string" ? playerOrName : playerOrName?.displayName
  );

  const ref = roomRef(rid);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("Room nicht gefunden.");

  const stored = getStoredPlayerId(rid);
  const playerId = stored || genPlayerId();

  await runTransaction(db, async (tx) => {
    const s = await tx.get(ref);
    if (!s.exists()) throw new Error("Room nicht gefunden.");

    const room = s.data();
    const players = Array.isArray(room.players) ? room.players : [];

    const idx = findPlayerIndex(players, playerId);

    if (idx >= 0) {
      // Rejoin / Refresh
      const next = [...players];
      next[idx] = {
        ...next[idx],
        displayName,
        active: true,
        lastSeenAt: Date.now(),
        active: true,
        lastSeenAt: Date.now(),
      };
      tx.update(ref, { players: next, updatedAt: serverTimestamp() });
      return;
    }

    // Neu joinen
    tx.update(ref, {
      players: arrayUnion({
        id: playerId,
        displayName,
        ready: false,
        joinedAt: Date.now(),
        lastSeenAt: Date.now(),
        active: true,
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

/**
 * leaveRoom(roomId, playerId)
 * - markiert Spieler als offline, statt ihn zu löschen
 */
export async function leaveRoom(roomId, playerId) {
  const rid = normalizeRoomId(roomId);
  const pid = normId(playerId);
  if (!rid || !pid) throw new Error("Ungültige IDs.");

  const ref = roomRef(rid);

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error("Room nicht gefunden.");

    const room = snap.data();
    const players = Array.isArray(room.players) ? room.players : [];
    const idx = findPlayerIndex(players, pid);
    if (idx === -1) return;

    const next = [...players];
    next[idx] = { ...next[idx], active: false, lastSeenAt: Date.now(), ready: false };

    tx.update(ref, { players: next, updatedAt: serverTimestamp() });
  });
}

export async function setReady(roomId, playerId, ready) {
  const rid = normalizeRoomId(roomId);
  const pid = normId(playerId);
  if (!rid || !pid) throw new Error("Ungültige IDs.");

  const ref = roomRef(rid);

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error("Room nicht gefunden.");

    const room = snap.data();
    const players = Array.isArray(room.players) ? room.players : [];

    const idx = findPlayerIndex(players, pid);
    if (idx === -1) throw new Error("Spieler nicht im Room gefunden.");

    const next = [...players];
    next[idx] = { ...next[idx], ready: !!ready, lastSeenAt: Date.now(), active: true };

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
  const pid = normId(playerId);
  if (!rid || !pid) throw new Error("Ungültige IDs.");

  const ref = roomRef(rid);

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error("Room nicht gefunden.");

    const room = snap.data();
    if (room.hostPlayerId !== pid) throw new Error("Nur der Host darf das ändern.");

    const s =
      status === "auction"
        ? "auction"
        : status === "playing"
        ? "playing"
        : status === "finished"
        ? "finished"
        : "lobby";

    tx.update(ref, { status: s, "versus.phase": s, updatedAt: serverTimestamp() });
  });
}
export async function heartbeat(roomId, playerId) {
  const rid = normalizeRoomId(roomId);
  const pid = String(playerId || "").trim();
  if (!rid || !pid) return;

  const ref = roomRef(rid);

  try {
    // 1️⃣ Snapshot holen (ohne Transaction)
    const snap = await getDoc(ref);
    if (!snap.exists()) return;

    const room = snap.data();
    const players = Array.isArray(room.players) ? room.players : [];

    const idx = players.findIndex((p) => p?.id === pid);
    if (idx === -1) return;

    const next = [...players];
    next[idx] = {
      ...next[idx],
      active: true,
      lastSeenAt: Date.now(),
    };

    // 2️⃣ Optimistisches Update (KEINE Transaction)
    await updateDoc(ref, {
      players: next,
      updatedAt: serverTimestamp(),
    });
  } catch {
    // 🔇 Heartbeat darf NIE loggen oder crashen
    // (Konflikte sind normal und irrelevant)
  }
}
/**
 * removePlayer(roomId, myPlayerId, targetPlayerId)
 * - Host-only
 * - entfernt target aus players (hartes Remove)
 * - Gibt {ok:true} oder {ok:false, reason:"target_not_in_room"} zurück
 */
export async function removePlayer(roomId, myPlayerId, targetPlayerId) {
  const rid = normalizeRoomId(roomId);
  const myId = normId(myPlayerId);
  const targetId = normId(targetPlayerId);
  if (!rid || !myId || !targetId) throw new Error("Ungültige IDs.");

  const ref = roomRef(rid);

  return await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error("Room nicht gefunden.");

    const room = snap.data();
    if (room.hostPlayerId !== myId) throw new Error("Nur der Host darf entfernen.");

    const players = Array.isArray(room.players) ? room.players : [];

    const idx = findPlayerIndex(players, targetId);
    if (idx === -1) {
      console.warn("[versusService] target not in room:", {
        targetPlayerId: targetId,
        playerIds: players.map((p) => p?.id).filter(Boolean),
      });
      return { ok: false, reason: "target_not_in_room" };
    }

    const target = players[idx];
    const next = players.filter((_, i) => i !== idx);

    // falls Host aus Versehen entfernt würde (solltest du im UI blocken), verhindere es trotzdem
    if (normId(target?.id) === myId) {
      return { ok: false, reason: "cannot_remove_self" };
    }

    tx.update(ref, { players: next, updatedAt: serverTimestamp() });
    return { ok: true };
  });
}

/**
 * transferHost(roomId, myPlayerId, targetPlayerId)
 * - Host-only
 * - setzt hostPlayerId auf target
 * - Gibt {ok:true} oder {ok:false, reason:"target_not_in_room"} zurück
 */
export async function transferHost(roomId, myPlayerId, targetPlayerId) {
  const rid = normalizeRoomId(roomId);
  const myId = normId(myPlayerId);
  const targetId = normId(targetPlayerId);
  if (!rid || !myId || !targetId) throw new Error("Ungültige IDs.");

  const ref = roomRef(rid);

  return await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error("Room nicht gefunden.");

    const room = snap.data();
    if (room.hostPlayerId !== myId) throw new Error("Nur der Host darf Adminrechte übertragen.");

    const players = Array.isArray(room.players) ? room.players : [];
    const idx = findPlayerIndex(players, targetId);
    if (idx === -1) {
      console.warn("[versusService] target not in room (transferHost):", {
        targetPlayerId: targetId,
        playerIds: players.map((p) => p?.id).filter(Boolean),
      });
      return { ok: false, reason: "target_not_in_room" };
    }

    const target = players[idx];
    const newHostId = normId(target?.id);
    if (!newHostId) return { ok: false, reason: "bad_target" };

    tx.update(ref, { hostPlayerId: newHostId, updatedAt: serverTimestamp() });
    return { ok: true, hostPlayerId: newHostId };
  });
}
