// src/duo/duoService.js
import { db, ensureAnonAuth } from "../firebase";
import {
  doc,
  setDoc,
  getDoc,
  updateDoc,
  onSnapshot,
  serverTimestamp,
  runTransaction,
} from "firebase/firestore";

function nowMs() {
  return Date.now();
}

function genRoomId() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  const buf = new Uint8Array(6);
  crypto.getRandomValues(buf);
  for (let i = 0; i < 6; i++) out += chars[buf[i] % chars.length];
  return out;
}

function normalizeName(displayName) {
  const n = String(displayName ?? "").trim();
  return n || "Spieler";
}

function roomRef(roomId) {
  return doc(db, "duoRooms", String(roomId).toUpperCase());
}

function defaultSave({ edition = "Rot", linkMode = "duo", title = "" } = {}) {
  return {
    encounters: {},
    team: ["", "", "", "", "", ""],
    gymsDefeated: 0,
    edition,
    linkMode,
    title: (title || "").trim(),
  };
}

export async function createDuoRoom({ displayName, edition, linkMode, title }) {
  if (!db) throw new Error("Firestore (db) ist null. Prüfe Firebase ENV / Config.");
  const user = await ensureAnonAuth();

  const roomId = genRoomId();
  const ref = roomRef(roomId);

  const player = {
    uid: user.uid,
    displayName: normalizeName(displayName),
    joinedAtMs: nowMs(),

    // ✅ Presence initial
    online: true,
    lastActiveAtMs: nowMs(),
  };

  const payload = {
    save: defaultSave({ edition, linkMode, title }),
    players: {
      [user.uid]: player,
    },
    createdAt: serverTimestamp(),
    createdAtMs: nowMs(),
    updatedAt: serverTimestamp(),
    updatedAtMs: nowMs(),
  };

  await setDoc(ref, payload);

  return { roomId };
}

export async function joinDuoRoom(roomId, { displayName }) {
  if (!db) throw new Error("Firestore (db) ist null. Prüfe Firebase ENV / Config.");
  const user = await ensureAnonAuth();

  const id = String(roomId || "").trim().toUpperCase();
  if (!id) throw new Error("Bitte eine Room-ID eingeben.");

  const ref = roomRef(id);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("Room nicht gefunden.");

  const player = {
    uid: user.uid,
    displayName: normalizeName(displayName),
    joinedAtMs: nowMs(),

    // ✅ Presence beim Join
    online: true,
    lastActiveAtMs: nowMs(),
  };

  await updateDoc(ref, {
    [`players.${user.uid}`]: player,
    updatedAt: serverTimestamp(),
    updatedAtMs: nowMs(),
  });

  return { roomId: id };
}

export function subscribeDuoRoom(roomId, cb) {
  const id = String(roomId || "").trim().toUpperCase();
  const ref = roomRef(id);

  return onSnapshot(
    ref,
    (snap) => cb(snap.exists() ? snap.data() : null),
    (err) => cb({ __error: err?.message || String(err) })
  );
}

export async function updateDuoSave(roomId, patch) {
  if (!db) throw new Error("Firestore (db) ist null. Prüfe Firebase ENV / Config.");
  await ensureAnonAuth();

  const id = String(roomId || "").trim().toUpperCase();
  if (!id) throw new Error("Ungültige Room-ID.");

  const ref = roomRef(id);

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error("Room nicht gefunden.");
    const data = snap.data();
    const save = data.save || {};
    tx.update(ref, {
      save: { ...save, ...(patch || {}) },
      updatedAt: serverTimestamp(),
      updatedAtMs: nowMs(),
    });
  });
}

export async function touchDuoPresence(roomId, { online } = {}) {
  if (!db) throw new Error("Firestore (db) ist null. Prüfe Firebase ENV / Config.");
  const user = await ensureAnonAuth();

  const id = String(roomId || "").trim().toUpperCase();
  if (!id) throw new Error("Ungültige Room-ID.");

  const ref = roomRef(id);

  const patch = {
    [`players.${user.uid}.uid`]: user.uid,
    [`players.${user.uid}.lastActiveAtMs`]: nowMs(),
    updatedAt: serverTimestamp(),
    updatedAtMs: nowMs(),
  };

  if (typeof online === "boolean") {
    patch[`players.${user.uid}.online`] = online;
  }

  await updateDoc(ref, patch);
}
