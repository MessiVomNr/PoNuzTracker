// src/utils/hotkeys.js
export const HOTKEYS_KEY = "app_hotkeys_v1";

export const DEFAULT_HOTKEYS = {
  general: {
    openPokedex: "E",
    openMoveDex: "A",
    toggleMute: "M",
    menuToggle: "Esc",
    goHome: "H",
    goLobby: "L",
    goBack: "Backspace",
  },

  draft: {
    bidSubmit: "Enter",
    allIn: "O",
    plus100: "ArrowUp",
    minus100: "ArrowDown",
    togglePause: "P",
  },

  // NEU: Soullink/Duo-spezifische Hotkeys
  soullink: {
    goTeam: "T",
    goGuide: "R",
  },
};

export function loadHotkeys() {
  try {
    const raw = localStorage.getItem(HOTKEYS_KEY);
    if (!raw) return DEFAULT_HOTKEYS;
    const parsed = JSON.parse(raw);
    return mergeDefaults(DEFAULT_HOTKEYS, parsed);
  } catch {
    return DEFAULT_HOTKEYS;
  }
}

export function saveHotkeys(next) {
  localStorage.setItem(HOTKEYS_KEY, JSON.stringify(next));
}

function mergeDefaults(def, v) {
  if (!v || typeof v !== "object") return def;
  const out = Array.isArray(def) ? [...def] : { ...def };

  for (const k of Object.keys(def)) {
    if (def[k] && typeof def[k] === "object" && !Array.isArray(def[k])) {
      out[k] = mergeDefaults(def[k], v[k]);
    } else {
      out[k] = v[k] ?? def[k];
    }
  }

  // Keep any extra keys user had
  for (const k of Object.keys(v)) {
    if (!(k in out)) out[k] = v[k];
  }

  return out;
}

export function flattenHotkeys(hk) {
  const out = [];
  const general = hk?.general || {};
  const draft = hk?.draft || {};
  const soullink = hk?.soullink || {};

  for (const [k, v] of Object.entries(general)) {
    if (!v) continue;
    out.push({ section: "general", key: k, combo: String(v) });
  }
  for (const [k, v] of Object.entries(draft)) {
    if (!v) continue;
    out.push({ section: "draft", key: k, combo: String(v) });
  }
  for (const [k, v] of Object.entries(soullink)) {
    if (!v) continue;
    out.push({ section: "soullink", key: k, combo: String(v) });
  }

  return out;
}

export function findConflict(hk, nextCombo, where) {
  // where: { section: "general"|"draft"|"soullink", key: "openMoveDex" ... }
  const want = String(nextCombo || "").trim().toLowerCase();
  if (!want) return null;

  const all = flattenHotkeys(hk);
  return (
    all.find((x) => {
      if (x.section === where.section && x.key === where.key) return false;
      return String(x.combo).trim().toLowerCase() === want;
    }) || null
  );
}

export function labelHotkey(section, key) {
  const labels = {
    general: {
      openPokedex: "Dex öffnen",
      openMoveDex: "MoveDex öffnen",
      toggleMute: "Mute / Unmute",
      menuToggle: "Menü öffnen",
      goHome: "Startbildschirm",
      goLobby: "Zur Lobby",
      goBack: "Zurück",
    },
    draft: {
      bidSubmit: "Bieten",
      allIn: "All-in",
      plus100: "+100",
      minus100: "-100",
      togglePause: "Pause/Fortfahren",
    },
    soullink: {
      goTeam: "Team öffnen",
      goGuide: "Story-Guide öffnen",
    },
  };

  return labels?.[section]?.[key] || `${section}.${key}`;
}

export function isTypingTarget(el) {
  if (!el) return false;
  const tag = (el.tagName || "").toUpperCase();
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  if (el.isContentEditable) return true;
  return false;
}

export function normalizeKeyComboFromEvent(e) {
  // Single combo: Ctrl/Alt/Shift + Key
  // We ignore Meta to keep it simple cross-platform; if you want, we can add it.
  const parts = [];
  if (e.ctrlKey) parts.push("Ctrl");
  if (e.altKey) parts.push("Alt");
  if (e.shiftKey) parts.push("Shift");

  const k = (e.key || "").trim();

  // Normalize some keys
  const key =
    k === " "
      ? "Space"
      : k === "Escape"
      ? "Esc"
      : k.length === 1
      ? k.toUpperCase()
      : k;

  // Disallow modifier-only
  if (key === "Control" || key === "Shift" || key === "Alt") return "";

  parts.push(key);
  return parts.join("+");
}

export function comboMatches(e, combo) {
  const want = String(combo || "").trim();
  if (!want) return false;
  const got = normalizeKeyComboFromEvent(e);
  return got.toLowerCase() === want.toLowerCase();
}
