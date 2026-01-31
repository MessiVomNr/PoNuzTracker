const KEY = "recentOnlineRooms";
const DEFAULT_TTL_DAYS = 7;

function now() {
  return Date.now();
}

function readRaw() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "[]");
  } catch {
    return [];
  }
}

function writeRaw(list) {
  localStorage.setItem(KEY, JSON.stringify(list));
}

export function cleanupRecentRooms(ttlDays = DEFAULT_TTL_DAYS) {
  const ttlMs = ttlDays * 24 * 60 * 60 * 1000;
  const cut = now() - ttlMs;

  const cleaned = readRaw()
    .filter((r) => r && r.roomId)
    .filter((r) => (r.lastSeen || 0) >= cut)
    .sort((a, b) => (b.lastSeen || 0) - (a.lastSeen || 0));

  writeRaw(cleaned);
  return cleaned;
}

export function getRecentRooms(ttlDays = DEFAULT_TTL_DAYS) {
  return cleanupRecentRooms(ttlDays);
}

export function upsertRecentRoom(room) {
  // room: { roomId, linkMode, edition, title?, lastPlayers? }
  const list = readRaw().filter((r) => r && r.roomId);

  const roomId = String(room?.roomId || "").trim();
  if (!roomId) return list;

  const prev = list.find((r) => r.roomId === roomId) || {};

  // ✅ Titel nur überschreiben, wenn wirklich ein nicht-leerer Titel reinkommt
  const incomingTitle = String(room?.title ?? "").trim();
  const nextTitle = incomingTitle || String(prev.title ?? "").trim();

  const incomingPlayers = Array.isArray(room?.lastPlayers)
    ? room.lastPlayers.filter(Boolean)
    : null;

  const entry = {
    roomId,
    linkMode: room?.linkMode || prev.linkMode || "duo",
    edition: room?.edition || prev.edition || "",
    title: nextTitle,
    // ✅ lastPlayers nur ersetzen, wenn wirklich geliefert – sonst alte behalten
    lastPlayers: incomingPlayers !== null ? incomingPlayers : (Array.isArray(prev.lastPlayers) ? prev.lastPlayers : []),
    lastSeen: now(),
  };

  const next = [entry, ...list.filter((r) => r.roomId !== roomId)].slice(0, 30);
  writeRaw(next);
  return next;
}

export function removeRecentRoom(roomId) {
  const next = readRaw().filter((r) => r.roomId !== String(roomId));
  writeRaw(next);
  return next;
}

export function clearAllRecentRooms() {
  localStorage.removeItem(KEY);
}
