// src/utils/offlineStore.js

const NAMESPACE = "nuzlocke";
const VERSION = 1;

// UUID Generator mit Fallback
function genId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return "id-" + Math.random().toString(36).substr(2, 9);
}

// Default-Datenstruktur
const defaultData = () => ({
  version: VERSION,
  createdAt: Date.now(),
  updatedAt: Date.now(),
  runs: [],
  encounters: [],
  team: []
});

// Lesen
function readRaw() {
  try {
    const raw = localStorage.getItem(NAMESPACE);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (err) {
    console.error("Fehler beim Lesen aus LocalStorage:", err);
    return null;
  }
}

// Schreiben
function writeRaw(data) {
  try {
    data.updatedAt = Date.now();
    localStorage.setItem(NAMESPACE, JSON.stringify(data));
  } catch (e) {
    console.error("Speichern fehlgeschlagen:", e);
  }
}

// Laden mit Default
export function loadStore() {
  const data = readRaw();
  if (!data || typeof data !== "object" || !data.version) {
    const fresh = defaultData();
    writeRaw(fresh);
    return fresh;
  }
  return data;
}

// Schreiben mit Updater
export function saveStore(updater) {
  const current = loadStore();
  const next = typeof updater === "function" ? updater(current) : updater;
  writeRaw(next);
  return next;
}

// Exportierte API
export const storeApi = {
  getAll: () => loadStore(),

  addRun: (run) =>
    saveStore((s) => {
      s.runs.push({ id: genId(), createdAt: Date.now(), ...run });
      return s;
    }),

  addEncounter: (enc) =>
    saveStore((s) => {
      s.encounters.push({ id: genId(), ...enc });
      return s;
    }),

  upsertTeamMon: (mon) =>
    saveStore((s) => {
      const i = s.team.findIndex((t) => t.id === mon.id);
      if (i >= 0) {
        s.team[i] = { ...s.team[i], ...mon };
      } else {
        s.team.push({ id: genId(), ...mon });
      }
      return s;
    }),

  removeTeamMon: (id) =>
    saveStore((s) => {
      s.team = s.team.filter((t) => t.id !== id);
      return s;
    }),

  exportJson: () => {
    try {
      const blob = new Blob([JSON.stringify(loadStore(), null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = nuzlocke-backup-${new Date().toISOString().slice(0, 10)}.json;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Backup fehlgeschlagen:", err);
    }
  },

  importJson: async (file) => {
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      if (!data || typeof data !== "object") throw new Error("Ungültige Datei");
      writeRaw(data);
      return data;
    } catch (err) {
      console.error("Import fehlgeschlagen:", err);
      throw err;
    }
  },

  clearAll: () => {
    localStorage.removeItem(NAMESPACE);
    return loadStore();
  }
};