import { db, auth } from "../firebase"; 
import {
  doc, setDoc, getDoc, updateDoc, serverTimestamp,
  onSnapshot
} from "firebase/firestore";

// kleine helper: kurze room id
export function makeRoomId(len = 6) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

export async function createRoom({ displayName = "Spieler" } = {}) {
  const roomId = makeRoomId();
  const uid = auth?.currentUser?.uid ?? `anon-${Math.random().toString(16).slice(2)}`;

  const roomRef = doc(db, "rooms", roomId);

  await setDoc(roomRef, {
    createdAt: serverTimestamp(),
    ownerUid: uid,
    status: "lobby",
    players: {
      [uid]: { name: displayName, slot: 1, ready: false, joinedAt: serverTimestamp() }
    }
  });

  return roomId;
}

export async function joinRoom(roomId, { displayName = "Spieler" } = {}) {
  const uid = auth?.currentUser?.uid ?? `anon-${Math.random().toString(16).slice(2)}`;
  const roomRef = doc(db, "rooms", roomId);
  const snap = await getDoc(roomRef);
  if (!snap.exists()) throw new Error("Room nicht gefunden.");

  const room = snap.data();
  const players = room.players ?? {};

  // wenn schon drin: nichts ändern
  if (players[uid]) return;

  // freien slot 1..3 suchen (kannst du später auf 4/8 erweitern)
  const taken = new Set(Object.values(players).map(p => p.slot));
  let slot = 1;
  while (taken.has(slot)) slot++;
  if (slot > 3) throw new Error("Room ist voll.");

  await updateDoc(roomRef, {
    [`players.${uid}`]: { name: displayName, slot, ready: false, joinedAt: serverTimestamp() }
  });
}

export async function setReady(roomId, ready) {
  const uid = auth?.currentUser?.uid ?? null;
  if (!uid) throw new Error("Kein User (Auth fehlt).");

  const roomRef = doc(db, "rooms", roomId);
  await updateDoc(roomRef, {
    [`players.${uid}.ready`]: !!ready
  });
}

export function subscribeRoom(roomId, cb) {
  const roomRef = doc(db, "rooms", roomId);
  return onSnapshot(roomRef, (snap) => cb(snap.exists() ? snap.data() : null));
}
