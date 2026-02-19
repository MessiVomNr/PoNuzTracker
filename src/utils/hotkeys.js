// src/utils/hotkeys.js

export const HOTKEYS_KEY = "app_hotkeys_v1";

export const DEFAULT_HOTKEYS = {
  general: {
    openPokedex: "E",
    openMoveDex: "A",
    openTypeCalculator: "Q",
    nextLevelCap: "I",
    prevLevelCap: "O",
    toggleMute: "M",
    menuToggle: "Esc",
    goHome: "H",
    goLobby: "Shift+L",
    goBack: "Backspace",
    openTeamCompare: "C",
  },

  draft: {
    bidSubmit: "Enter",
    allIn: "O",
    plus100: "ArrowUp",
    minus100: "ArrowDown",
    togglePause: "P",
  },

  soullink: {
    goTeam: "1",
    goGuide: "2",
  },
};

/* =========================================================
   Helpers: normalize + compare key combos
========================================================= */

const MOD_ALIASES = {
  control: "Ctrl",
  ctrl: "Ctrl",
  shift: "Shift",
  alt: "Alt",
  option: "Alt",
  meta: "Meta",
  cmd: "Meta",
  command: "Meta",
};

const KEY_ALIASES = {
  escape: "Esc",
  esc: "Esc",
  " ": "Space",
  space: "Space",
  spacebar: "Space",
  backspace: "Backspace",
  del: "Delete",
  delete: "Delete",
  return: "Enter",
  enter: "Enter",
  arrowup: "ArrowUp",
  arrowdown: "ArrowDown",
  arrowleft: "ArrowLeft",
  arrowright: "ArrowRight",
};

function capWord(s) {
  if (!s) return s;
  return s.length === 1 ? s.toUpperCase() : s[0].toUpperCase() + s.slice(1);
}

function normalizeKeyName(raw) {
  const s = String(raw || "").trim();
  if (!s) return "";
  const low = s.toLowerCase();

  if (MOD_ALIASES[low]) return MOD_ALIASES[low];
  if (KEY_ALIASES[low]) return KEY_ALIASES[low];

  // F1..F24
  if (/^f\d{1,2}$/i.test(s)) return s.toUpperCase();

  // Arrow keys etc.
  if (/^arrow(up|down|left|right)$/i.test(s)) return capWord(low);

  // Single letters / digits
  if (s.length === 1) return s.toUpperCase();

  return capWord(low);
}

function sortMods(mods) {
  // feste Reihenfolge
  const order = { Ctrl: 1, Shift: 2, Alt: 3, Meta: 4 };
  return mods.slice().sort((a, b) => (order[a] || 99) - (order[b] || 99));
}

export function normalizeKeyCombo(combo) {
  const raw = String(combo || "").trim();
  if (!raw) return "";

  // Unterstützung für "Ctrl+K", "Ctrl + Shift + k", "Backspace"
  const parts = raw
    .split("+")
    .map((p) => p.trim())
    .filter(Boolean);

  const mods = [];
  let key = "";

  for (const p of parts) {
    const n = normalizeKeyName(p);
    if (!n) continue;

    if (n === "Ctrl" || n === "Shift" || n === "Alt" || n === "Meta") {
      if (!mods.includes(n)) mods.push(n);
    } else {
      key = n; // letzter gewinnt
    }
  }

  // Falls nur "Ctrl" eingetragen wurde (kein Key), ist es ungültig
  if (!key) return "";

  const sorted = sortMods(mods);
  return [...sorted, key].join("+");
}

export function normalizeKeyComboFromEvent(e) {
  if (!e) return "";
  const mods = [];
  if (e.ctrlKey) mods.push("Ctrl");
  if (e.shiftKey) mods.push("Shift");
  if (e.altKey) mods.push("Alt");
  if (e.metaKey) mods.push("Meta");

  const keyRaw = e.key;

  // Wenn nur Mod gedrückt wurde: ignorieren
  const kLow = String(keyRaw || "").toLowerCase();
  if (kLow === "control" || kLow === "shift" || kLow === "alt" || kLow === "meta") return "";

  const key = normalizeKeyName(keyRaw);
  if (!key) return "";

  const sorted = sortMods(mods);
  return [...sorted, key].join("+");
}

export function comboMatches(e, binding) {
  const want = normalizeKeyCombo(binding);
  if (!want) return false;

  const got = normalizeKeyComboFromEvent(e);
  if (!got) return false;

  return got === want;
}

/* =========================================================
   Typing target detection
========================================================= */

export function isTypingTarget(targetOrEl) {
  // erlaubt: isTypingTarget(e) oder isTypingTarget(document.activeElement)
  const el = targetOrEl?.target ? targetOrEl.target : targetOrEl;

  if (!el) return false;

  const tag = String(el.tagName || "").toLowerCase();
  if (tag === "input" || tag === "textarea" || tag === "select") return true;

  // contenteditable
  if (el.isContentEditable) return true;

  // Role textbox (z.B. manche UI libs)
  const role = String(el.getAttribute?.("role") || "").toLowerCase();
  if (role === "textbox" || role === "combobox") return true;

  return false;
}

/* =========================================================
   Legacy helper (falls du es noch irgendwo nutzt)
========================================================= */
export function matchHotkey(e, hotkey) {
  // legacy: single-key matching
  const want = normalizeKeyCombo(hotkey);
  if (!want) return false;

  // wenn binding nur ein Key ohne Mods ist: vergleichen wir nur e.key normalisiert
  if (!want.includes("+")) {
    const key = normalizeKeyName(e?.key);
    return key === want;
  }

  return comboMatches(e, want);
}

/* =========================================================
   Storage
========================================================= */

export function loadHotkeys() {
  try {
    const raw = localStorage.getItem(HOTKEYS_KEY);
    if (!raw) return structuredClone(DEFAULT_HOTKEYS);
    const parsed = JSON.parse(raw);

    // merge defaults
    return {
      general: { ...DEFAULT_HOTKEYS.general, ...(parsed.general || {}) },
      draft: { ...DEFAULT_HOTKEYS.draft, ...(parsed.draft || {}) },
      soullink: { ...DEFAULT_HOTKEYS.soullink, ...(parsed.soullink || {}) },
    };
  } catch {
    return structuredClone(DEFAULT_HOTKEYS);
  }
}

export function saveHotkeys(next) {
  try {
    localStorage.setItem(HOTKEYS_KEY, JSON.stringify(next));
  } catch {
    // ignore
  }
}

/* =========================================================
   UI helpers
========================================================= */
export function formatKeyForDisplay(combo) {
  const c = normalizeKeyCombo(combo);
  if (!c) return "";
  return c
    .replace(/\bCtrl\b/g, "Strg")
    .replace(/\bShift\b/g, "Shift")
    .replace(/\bAlt\b/g, "Alt")
    .replace(/\bMeta\b/g, "Cmd")
    .replace(/\bBackspace\b/g, "Backspace")
    .replace(/\bEsc\b/g, "Esc")
    .replace(/\bSpace\b/g, "Leertaste");
}

export function labelHotkey(scope, key) {
  const map = {
    general: {
      openPokedex: "Pokédex öffnen/schließen",
      openMoveDex: "MoveDex öffnen/schließen",
      openTypeCalculator: "Typenrechner öffnen/schließen",
      nextLevelCap: "Level-Cap: nächstes abhaken",
      prevLevelCap: "Level-Cap: rückgängig",
      toggleMute: "Mute umschalten",
      menuToggle: "Pause-Menü (ESC)",
      goHome: "Zum Start",
      goLobby: "Zur Lobby",
      goBack: "Zurück",
      openTeamCompare: "Team-Rechner öffnen",
    },
    draft: {
      bidSubmit: "Gebot bestätigen",
      allIn: "All-In",
      plus100: "+100",
      minus100: "-100",
      togglePause: "Pause (Draft)",
    },
    soullink: {
      goTeam: "Soullink: Team",
      goGuide: "Soullink: Guide",
    },
  };

  return map?.[scope]?.[key] || `${scope}.${key}`;
}

export function findConflict(hotkeys, scope, key, value) {
  const v = normalizeKeyCombo(value);
  if (!v) return null;

  for (const s of Object.keys(hotkeys || {})) {
    for (const k of Object.keys(hotkeys?.[s] || {})) {
      if (s === scope && k === key) continue;
      const other = normalizeKeyCombo(hotkeys?.[s]?.[k]);
      if (other && other === v) return { scope: s, key: k };
    }
  }
  return null;
}
