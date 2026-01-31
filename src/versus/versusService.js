// src/versus/versusService.js
// LocalStorage + BroadcastChannel Room-Service (kein Backend nötig)
// + intelligentes Cleanup (TTL) über updatedAt/createdAt

const ROOMS_KEY = "ponuztracker_versus_rooms_v1";
const CHANNEL_NAME = "ponuztracker_versus_channel_v1";

let bc = null;
function getBC() {
  if (typeof BroadcastChannel === "undefined") return null;
  if (!bc) bc = new BroadcastChannel(CHANNEL_NAME);
  return bc;
}

function now() {
  return Date.now();
}

function safeJsonParse(str, fallback) {
  try {
    return JSON.parse(str);
  } catch {
    return fallback;
  }
}

function isPlainObject(v) {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

/**
 * Cleanup-Regeln (TTL):
 * - Lobby (nie gestartet / status "lobby"): 6 Stunden ohne Aktivität -> löschen
 * - Running (status "running"): 30 Tage ohne Aktivität -> löschen
 * - Finished (status "finished"): 7 Tage ohne Aktivität -> löschen
 *
 * Aktivität bedeutet: updatedAt wird bei Änderungen aktualisiert
 * (join, ready toggles, status changes, später scores etc.)
 */
function cleanupRooms(rooms) {
  const t = now();

  const LOBBY_TTL = 6 * 60 * 60 * 1000; // 6 Stunden
  const RUNNING_TTL = 30 * 24 * 60 * 60 * 1000; // 30 Tage
  const FINISHED_TTL = 7 * 24 * 60 * 60 * 1000; // 7 Tage

  const out = { ...rooms };

  for (const id of Object.keys(out)) {
    const r = out[id];

    // kaputte Einträge raus
    if (!isPlainObject(r)) {
      delete out[id];
      continue;
    }

    const status = r.status || "lobby";
    const last = r.updatedAt || r.createdAt || 0;
    const age = t - last;

    if (status === "lobby" && age > LOBBY_TTL) delete out[id];
    else if (status === "running" && age > RUNNING_TTL) delete out[id];
    else if (status === "finished" && age > FINISHED_TTL) delete out[id];
  }

  return out;
}

function loadRooms() {
  const raw = localStorage.getItem(ROOMS_KEY);
  if (!raw) return {};

  const parsed = safeJsonParse(raw, {});
  const base = isPlainObject(parsed) ? parsed : {};
  const cleaned = cleanupRooms(base);

  // Wenn cleanup was entfernt hat, speichern wir sofort zurück
  // (optional, aber praktisch, damit localStorage nicht anwächst)
  if (Object.keys(cleaned).length !== Object.keys(base).length) {
    saveRooms(cleaned);
  }

  return cleaned;
}

function saveRooms(rooms) {
  const safe = isPlainObject(rooms) ? rooms : {};
  localStorage.setItem(ROOMS_KEY, JSON.stringify(safe));
}

function emitRoomChange(roomId) {
  const ch = getBC();
  if (ch) ch.postMessage({ type: "room_changed", roomId, t: now() });
}

function genRoomId() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  const buf = new Uint8Array(6);
  crypto.getRandomValues(buf);
  for (let i = 0; i < 6; i++) out += chars[buf[i] % chars.length];
  return out;
}

function genPlayerId() {
  if (crypto?.randomUUID) return crypto.randomUUID();
  const buf = new Uint8Array(16);
  crypto.getRandomValues(buf);
  return Array.from(buf, (b) => b.toString(16).padStart(2, "0")).join("");
}

function normalizeName(displayName) {
  const n = String(displayName ?? "").trim();
  return n || "Spieler";
}

function ensureRoomShape(room) {
  if (!isPlainObject(room)) return null;
  room.players = Array.isArray(room.players) ? room.players : [];
  room.status = room.status || "lobby";
  room.createdAt = typeof room.createdAt === "number" ? room.createdAt : now();
  room.updatedAt = typeof room.updatedAt === "number" ? room.updatedAt : room.createdAt;
  return room;
}

/**
 * Erstellt einen neuen Room und fügt den Ersteller als Spieler hinzu.
 * @param {{displayName: string}} player
 * @returns {Promise<{ roomId: string, playerId: string }>}
 */
export async function createRoom(player) {
  const rooms = loadRooms();

  let id = genRoomId();
  let guard = 0;
  while (rooms[id] && guard < 20) {
    id = genRoomId();
    guard++;
  }
  if (rooms[id]) throw new Error("Konnte keine eindeutige Room-ID erzeugen.");

  const p = {
    id: genPlayerId(),
    displayName: normalizeName(player?.displayName),
    joinedAt: now(),
    ready: false,
  };

  const t = now();

  rooms[id] = {
    id,
    createdAt: t,
    updatedAt: t,
    hostPlayerId: p.id,
    players: [p],
    status: "lobby", // später: "running"
  };

  saveRooms(rooms);
  emitRoomChange(id);

  return { roomId: id, playerId: p.id };
}

/**
 * Tritt einem bestehenden Room bei.
 * @param {string} roomId
 * @param {{displayName: string}} player
 * @returns {Promise<{ roomId: string, playerId: string }>}
 */
export async function joinRoom(roomId, player) {
  const id = String(roomId || "").trim().toUpperCase();
  if (!id) throw new Error("Bitte eine Room-ID eingeben.");

  const rooms = loadRooms();
  const room = ensureRoomShape(rooms[id]);
  if (!room) throw new Error("Room nicht gefunden.");

  const p = {
    id: genPlayerId(),
    displayName: normalizeName(player?.displayName),
    joinedAt: now(),
    ready: false,
  };

  room.players.push(p);
  room.updatedAt = now();

  rooms[id] = room;
  saveRooms(rooms);
  emitRoomChange(id);

  return { roomId: id, playerId: p.id };
}

/**
 * Room-Daten holen
 * @param {string} roomId
 * @returns {Promise<object|null>}
 */
export async function getRoom(roomId) {
  const id = String(roomId || "").trim().toUpperCase();
  if (!id) return null;

  const rooms = loadRooms();
  return ensureRoomShape(rooms[id]) || null;
}

/**
 * Ready-Status eines Spielers setzen
 * @param {string} roomId
 * @param {string} playerId
 * @param {boolean} ready
 */
export async function setReady(roomId, playerId, ready) {
  const id = String(roomId || "").trim().toUpperCase();
  if (!id) throw new Error("Ungültige Room-ID.");

  const pid = String(playerId || "").trim();
  if (!pid) throw new Error("Ungültige Player-ID.");

  const rooms = loadRooms();
  const room = ensureRoomShape(rooms[id]);
  if (!room) throw new Error("Room nicht gefunden.");

  const idx = room.players.findIndex((p) => p?.id === pid);
  if (idx === -1) throw new Error("Spieler nicht im Room gefunden.");

  room.players[idx] = { ...room.players[idx], ready: !!ready };
  room.updatedAt = now();

  rooms[id] = room;
  saveRooms(rooms);
  emitRoomChange(id);
}

/**
 * Room-Status setzen (z.B. "running" / "lobby") – nur Host darf das
 * @param {string} roomId
 * @param {string} playerId
 * @param {"lobby"|"running"|"finished"} status
 */
export async function setRoomStatus(roomId, playerId, status) {
  const id = String(roomId || "").trim().toUpperCase();
  const pid = String(playerId || "").trim();
  if (!id || !pid) throw new Error("Ungültige IDs.");

  const rooms = loadRooms();
  const room = ensureRoomShape(rooms[id]);
  if (!room) throw new Error("Room nicht gefunden.");

  if (room.hostPlayerId !== pid) throw new Error("Nur der Host darf das ändern.");

  const s =
    status === "running" ? "running" :
    status === "finished" ? "finished" :
    "lobby";

  room.status = s;
  room.updatedAt = now();

  rooms[id] = room;
  saveRooms(rooms);
  emitRoomChange(id);
}

/**
 * Änderungen an einem Room abonnieren
 * @param {string} roomId
 * @param {(room: object|null) => void} cb
 * @returns {() => void} unsubscribe
 */
export function subscribeRoom(roomId, cb) {
  const id = String(roomId || "").trim().toUpperCase();
  let alive = true;

  async function push() {
    if (!alive) return;
    const room = await getRoom(id);
    cb(room);
  }

  // initial
  push();

  // storage event (andere Tabs)
  function onStorage(e) {
    if (!alive) return;
    if (e.key === ROOMS_KEY) push();
  }
  window.addEventListener("storage", onStorage);

  // BroadcastChannel (gleicher Tab / andere Tabs)
  const ch = getBC();
  function onBC(ev) {
    if (!alive) return;
    const msg = ev?.data;
    if (msg?.type === "room_changed" && msg.roomId === id) push();
  }
  if (ch) ch.addEventListener("message", onBC);

  return () => {
    alive = false;
    window.removeEventListener("storage", onStorage);
    if (ch) ch.removeEventListener("message", onBC);
  };
}
