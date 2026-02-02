// src/versus/recentVersusRooms.js
const KEY = "ponuztracker_recent_versus_rooms_v1";
const MAX = 12;

function safeParse(v, fallback) {
  try { return JSON.parse(v); } catch { return fallback; }
}

export function loadRecentVersusRooms() {
  const raw = localStorage.getItem(KEY);
  const list = safeParse(raw, []);
  return Array.isArray(list) ? list : [];
}

export function upsertRecentVersusRoom(room) {
  // room: { roomId, title?, lastSeenAt }
  const roomId = String(room?.roomId || "").trim().toUpperCase();
  if (!roomId) return;

  const title = String(room?.title || "").trim();
  const lastSeenAt = Number(room?.lastSeenAt || Date.now());

  const prev = loadRecentVersusRooms();

  const next = [
    { roomId, title, lastSeenAt },
    ...prev.filter((x) => String(x?.roomId || "").toUpperCase() !== roomId),
  ].slice(0, MAX);

  localStorage.setItem(KEY, JSON.stringify(next));
  window.dispatchEvent(new Event("recentVersusRoomsChanged"));
}

export function removeRecentVersusRoom(roomIdRaw) {
  const roomId = String(roomIdRaw || "").trim().toUpperCase();
  if (!roomId) return;
try {
    const list = loadRecentVersusRooms();
    const next = (list || []).filter((x) => String(x?.roomId || "").toUpperCase() !== rid);
    saveRecentVersusRooms(next);
  } catch {
    // ignore
  }
  const prev = loadRecentVersusRooms();
  const next = prev.filter((x) => String(x?.roomId || "").toUpperCase() !== roomId);
  localStorage.setItem(KEY, JSON.stringify(next));
  window.dispatchEvent(new Event("recentVersusRoomsChanged"));
}
