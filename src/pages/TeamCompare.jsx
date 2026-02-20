// src/pages/PokemonCompare.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { pokedex as fullPokedex } from "../data/pokedex.js";
import dexBg from "../assets/DexBackground.png";

/* =========================
   Helpers
========================= */
function cap(s) {
  return String(s || "")
    .replace(/-/g, " ")
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

function normText(s) {
  return String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim();
}

function getDexIdFromKey(key) {
  const m = String(key || "").match(/pokedex(\d+)/i);
  return m ? Number(m[1]) : null;
}
function keyFromDexId(id) {
  return `pokedex${Number(id)}`;
}
function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}
function uniq(arr) {
  return Array.from(new Set(arr));
}
function safeNum(n, fallback = 0) {
  const x = Number(n);
  return Number.isFinite(x) ? x : fallback;
}
function isTypingTarget(el) {
  if (!el) return false;
  const tag = String(el.tagName || "").toLowerCase();
  if (tag === "input" || tag === "textarea" || tag === "select") return true;
  if (el.isContentEditable) return true;
  return false;
}

/* =========================
   Storage
========================= */
const TEAM_KEY = "team_compare_v4";
const UI_KEY = "team_compare_ui_v4";

// shared with PokemonInfo (so both pages use same gen)
const GEN_KEY = "pinfo_selected_gen_v1";

/* =========================
   Gen helpers (availability)
========================= */
function maxDexForGen(gen) {
  const g = Number(gen) || 1;
  if (g <= 1) return 151;
  if (g === 2) return 251;
  if (g === 3) return 386;
  if (g === 4) return 493;
  if (g === 5) return 649;
  if (g === 6) return 721;
  if (g === 7) return 809;
  if (g === 8) return 905;
  return 1025; // gen 9 (current natdex in many sources)
}

function isBaseDexIdAllowedInGen(dexId, gen) {
  const id = Number(dexId);
  if (!id) return false;

  const max = maxDexForGen(gen);

  if (id > max && id >= 10000) {
    return Number(gen) >= 6;
  }

  return id <= max;
}

/* =========================
   Gen → VersionGroup
========================= */
const GEN_TO_VERSION_GROUP = {
  1: "red-blue",
  2: "crystal",
  3: "emerald",
  4: "platinum",
  5: "black-2-white-2",
  6: "omega-ruby-alpha-sapphire",
  7: "ultra-sun-ultra-moon",
  8: "sword-shield",
  9: "scarlet-violet",
};

/* =========================
   Type Chart
========================= */
const TYPES = [
  "normal",
  "fire",
  "water",
  "electric",
  "grass",
  "ice",
  "fighting",
  "poison",
  "ground",
  "flying",
  "psychic",
  "bug",
  "rock",
  "ghost",
  "dragon",
  "dark",
  "steel",
  "fairy",
];

const TYPE_LABELS_DE = {
  normal: "Normal",
  fire: "Feuer",
  water: "Wasser",
  electric: "Elektro",
  grass: "Pflanze",
  ice: "Eis",
  fighting: "Kampf",
  poison: "Gift",
  ground: "Boden",
  flying: "Flug",
  psychic: "Psycho",
  bug: "Käfer",
  rock: "Gestein",
  ghost: "Geist",
  dragon: "Drache",
  dark: "Unlicht",
  steel: "Stahl",
  fairy: "Fee",
};

const MOVE_CLASS_LABEL_DE = {
  physical: "Physisch",
  special: "Spezial",
  status: "Status",
};

const TYPE_MULT = {
  normal: { rock: 0.5, ghost: 0, steel: 0.5 },
  fire: { fire: 0.5, water: 0.5, grass: 2, ice: 2, bug: 2, rock: 0.5, dragon: 0.5, steel: 2 },
  water: { fire: 2, water: 0.5, grass: 0.5, ground: 2, rock: 2, dragon: 0.5 },
  electric: { water: 2, electric: 0.5, grass: 0.5, ground: 0, flying: 2, dragon: 0.5 },
  grass: { fire: 0.5, water: 2, grass: 0.5, poison: 0.5, ground: 2, flying: 0.5, bug: 0.5, rock: 2, dragon: 0.5, steel: 0.5 },
  ice: { fire: 0.5, water: 0.5, grass: 2, ice: 0.5, ground: 2, flying: 2, dragon: 2, steel: 0.5 },
  fighting: { normal: 2, ice: 2, rock: 2, dark: 2, steel: 2, poison: 0.5, flying: 0.5, psychic: 0.5, bug: 0.5, ghost: 0, fairy: 0.5 },
  poison: { grass: 2, fairy: 2, poison: 0.5, ground: 0.5, rock: 0.5, ghost: 0.5, steel: 0 },
  ground: { fire: 2, electric: 2, grass: 0.5, poison: 2, flying: 0, bug: 0.5, rock: 2, steel: 2 },
  flying: { grass: 2, fighting: 2, bug: 2, electric: 0.5, rock: 0.5, steel: 0.5 },
  psychic: { fighting: 2, poison: 2, psychic: 0.5, steel: 0.5, dark: 0 },
  bug: { grass: 2, psychic: 2, dark: 2, fire: 0.5, fighting: 0.5, poison: 0.5, flying: 0.5, ghost: 0.5, steel: 0.5, fairy: 0.5 },
  rock: { fire: 2, ice: 2, flying: 2, bug: 2, fighting: 0.5, ground: 0.5, steel: 0.5 },
  ghost: { psychic: 2, ghost: 2, dark: 0.5, normal: 0 },
  dragon: { dragon: 2, steel: 0.5, fairy: 0 },
  dark: { psychic: 2, ghost: 2, fighting: 0.5, dark: 0.5, fairy: 0.5 },
  steel: { ice: 2, rock: 2, fairy: 2, fire: 0.5, water: 0.5, electric: 0.5, steel: 0.5 },
  fairy: { fighting: 2, dragon: 2, dark: 2, fire: 0.5, poison: 0.5, steel: 0.5 },
};

/* =========================
   Gen type normalization
   (Fix: Fairy should not exist < Gen 6)
========================= */
function normalizeTypeForGen(typeKey, gen) {
  const t = String(typeKey || "").toLowerCase();
  if (!t) return t;

  if (Number(gen) < 6 && t === "fairy") return "normal";

  return t;
}

function attackTypesForGen(gen) {
  const g = Number(gen) || 1;
  if (g < 6) return TYPES.filter((x) => x !== "fairy");
  return TYPES;
}

function typeEffectiveness(attType, defTypes, gen) {
  const a = normalizeTypeForGen(attType, gen);
  let mult = 1;

  for (const dt of defTypes || []) {
    const d = normalizeTypeForGen(dt, gen);
    const row = TYPE_MULT[a] || {};
    const m = row[d];
    mult *= m == null ? 1 : m;
  }
  return mult;
}

function overrideEffForAbilities({ moveType, defenderAbilities, eff }) {
  const t = String(moveType || "").toLowerCase();
  if (!t) return eff;

  if (t === "ground" && Array.isArray(defenderAbilities)) {
    if (defenderAbilities.includes("levitate")) return 0;
  }

  return eff;
}

function typeIconUrl(typeKey) {
  const t = String(typeKey || "").toLowerCase();
  return `https://raw.githubusercontent.com/partywhale/pokemon-type-icons/master/icons/${t}.svg`;
}

function moveCategoryIconUrl(dc) {
  const d = String(dc || "").toLowerCase();
  if (d !== "physical" && d !== "special" && d !== "status") return null;
  return `https://raw.githubusercontent.com/msikma/pokesprite/master/misc/move-category/${d}.png`;
}

/* =========================
   PokeAPI helpers
========================= */
function getGermanName(namesArr, fallback) {
  const de = (namesArr || []).find((n) => n?.language?.name === "de");
  return de?.name || fallback;
}

function getGermanEffectShort(effectEntries, fallback = "") {
  const de = (effectEntries || []).find((e) => e?.language?.name === "de");
  if (!de) return fallback;
  return de?.short_effect || de?.effect || fallback;
}

async function fetchPokemonById(id) {
  const r = await fetch(`https://pokeapi.co/api/v2/pokemon/${id}`);
  if (!r.ok) throw new Error("pokemon");
  return await r.json();
}

async function fetchPokemonByName(name) {
  const r = await fetch(`https://pokeapi.co/api/v2/pokemon/${name}`);
  if (!r.ok) throw new Error("pokemon");
  return await r.json();
}

async function fetchSpeciesById(id) {
  const r = await fetch(`https://pokeapi.co/api/v2/pokemon-species/${id}`);
  if (!r.ok) throw new Error("species");
  return await r.json();
}

async function fetchMove(moveName) {
  const r = await fetch(`https://pokeapi.co/api/v2/move/${moveName}`);
  if (!r.ok) throw new Error("move");
  return await r.json();
}

async function fetchAbility(abilityName) {
  const r = await fetch(`https://pokeapi.co/api/v2/ability/${abilityName}`);
  if (!r.ok) throw new Error("ability");
  return await r.json();
}

function extractTypes(poke) {
  return (poke?.types || [])
    .slice()
    .sort((a, b) => (a.slot || 0) - (b.slot || 0))
    .map((t) => t?.type?.name)
    .filter(Boolean);
}

function extractTypesForGen(poke, gen) {
  const raw = extractTypes(poke);
  const mapped = raw.map((t) => normalizeTypeForGen(t, gen)).filter(Boolean);
  return uniq(mapped);
}

/**
 * Returns ALL moves that are allowed by VersionGroup, regardless of level.
 * (level-up + machine)
 */
function extractAllowedMoves(poke, versionGroup) {
  const out = [];
  for (const m of poke?.moves || []) {
    const moveName = m?.move?.name;
    if (!moveName) continue;
    const details = m?.version_group_details || [];
    const ok = details.some((d) => {
      const vg = d?.version_group?.name;
      const method = d?.move_learn_method?.name;
      if (vg !== versionGroup) return false;
      return method === "level-up" || method === "machine";
    });
    if (ok) out.push(moveName);
  }
  return uniq(out).sort((a, b) => a.localeCompare(b));
}

/**
 * ✅ Level-aware learnset extraction (for enemy level filtering)
 * - level-up: keep the LOWEST level at which the move is learned in that versionGroup
 * - machine: always allowed (TMs/HMs/TRs etc)
 */
function extractLearnsetByMethod(poke, versionGroup) {
  const lvlMap = new Map(); // moveName -> lowestLevel
  const machineSet = new Set();

  for (const m of poke?.moves || []) {
    const moveName = m?.move?.name;
    if (!moveName) continue;

    for (const d of m?.version_group_details || []) {
      const vg = d?.version_group?.name;
      if (vg !== versionGroup) continue;

      const method = d?.move_learn_method?.name;
      if (method === "machine") {
        machineSet.add(String(moveName).toLowerCase());
        continue;
      }
      if (method === "level-up") {
        const lvl = Number(d?.level_learned_at ?? 0);
        const key = String(moveName).toLowerCase();
        const prev = lvlMap.get(key);
        if (prev == null || (Number.isFinite(lvl) && lvl < prev)) lvlMap.set(key, Number.isFinite(lvl) ? lvl : 0);
      }
    }
  }

  const levelUp = Array.from(lvlMap.entries())
    .map(([name, level]) => ({ name, level: Number(level) || 0 }))
    .sort((a, b) => (a.level - b.level) || a.name.localeCompare(b.name));

  const machine = Array.from(machineSet).sort((a, b) => a.localeCompare(b));

  return { levelUp, machine };
}

function extractAbilityKeys(poke) {
  return (poke?.abilities || [])
    .slice()
    .sort((a, b) => (a?.slot || 0) - (b?.slot || 0))
    .map((a) => a?.ability?.name)
    .filter(Boolean)
    .map((x) => String(x).toLowerCase());
}

/* =========================
   Stats simulation
========================= */
function calcStat(base, level, isHP) {
  const L = clamp(Number(level) || 1, 1, 100);
  const IV = 31;
  const EV = 0;
  if (isHP) return Math.floor(((2 * base + IV + Math.floor(EV / 4)) * L) / 100) + L + 10;
  return Math.floor(((2 * base + IV + Math.floor(EV / 4)) * L) / 100) + 5;
}

function computeStats(p, level) {
  if (!p) return null;
  const lvl = clamp(Number(level) || 1, 1, 100);
  const base = {};
  for (const s of p?.stats || []) base[s?.stat?.name] = s?.base_stat;

  return {
    level: lvl,
    hp: calcStat(base.hp || 1, lvl, true),
    atk: calcStat(base.attack || 1, lvl, false),
    def: calcStat(base.defense || 1, lvl, false),
    spa: calcStat(base["special-attack"] || 1, lvl, false),
    spd: calcStat(base["special-defense"] || 1, lvl, false),
    spe: calcStat(base.speed || 1, lvl, false),
  };
}

/* =========================
   Forms labeling (DE only)
========================= */
function formatFormLabelDE(baseDeName, pokemonApiName) {
  const n = String(pokemonApiName || "").toLowerCase();

  if (n.includes("-mega-x")) return `Mega ${baseDeName} X`;
  if (n.includes("-mega-y")) return `Mega ${baseDeName} Y`;
  if (n.includes("-mega")) return `Mega ${baseDeName}`;

  if (n.includes("-gmax")) return `Gigadynamax ${baseDeName}`;
  if (n.includes("-primal")) return `Proto ${baseDeName}`;

  if (n.includes("-origin")) return `${baseDeName} (Urform)`;

  if (n.includes("-alola")) return `${baseDeName} (Alola)`;
  if (n.includes("-galar")) return `${baseDeName} (Galar)`;
  if (n.includes("-hisui")) return `${baseDeName} (Hisui)`;
  if (n.includes("-paldea")) return `${baseDeName} (Paldea)`;

  if (n.includes("-therian")) return `${baseDeName} (Tiergeist)`;
  if (n.includes("-incarnate")) return `${baseDeName} (Inkarnationsform)`;
  if (n.includes("-complete")) return `${baseDeName} (Komplett)`;
  if (n.includes("-10")) return `${baseDeName} (10%)`;
  if (n.includes("-50")) return `${baseDeName} (50%)`;

  return baseDeName;
}

function isFormAvailableInGen(apiName, gen) {
  const n = String(apiName || "").toLowerCase();

  if (n.includes("-mega") || n.includes("-primal")) return Number(gen) >= 6;
  if (n.includes("-gmax")) return Number(gen) >= 8;

  if (n.includes("-alola")) return Number(gen) >= 7;
  if (n.includes("-galar")) return Number(gen) >= 8;
  if (n.includes("-hisui")) return Number(gen) >= 8;
  if (n.includes("-paldea")) return Number(gen) >= 9;

  if (n.includes("-origin")) return Number(gen) >= 4;
  if (n.includes("-therian") || n.includes("-incarnate")) return Number(gen) >= 5;

  if (n.includes("-complete") || n.includes("-10") || n.includes("-50")) return Number(gen) >= 6;

  return true;
}

/* =========================
   Storage helpers
========================= */
function readJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}
function writeJSON(key, val) {
  localStorage.setItem(key, JSON.stringify(val));
}

/* =========================
   Team slots
========================= */
function makeEmptySlot(i) {
  return {
    id: `slot-${i}`,
    dexId: null,
    level: 50,
    moves: ["", "", "", ""],
  };
}

/* =========================
   UI bits
========================= */
function TypePill({ t, compact }) {
  const name = TYPE_LABELS_DE[String(t || "").toLowerCase()] || cap(t);
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: compact ? "5px 8px" : "6px 10px",
        borderRadius: 999,
        border: "1px solid rgba(255,255,255,0.12)",
        background: "rgba(255,255,255,0.06)",
        fontSize: compact ? 11 : 12,
        fontWeight: 950,
        marginRight: 8,
        marginBottom: 8,
      }}
      title={name}
    >
      <img
        src={typeIconUrl(t)}
        alt=""
        style={{
          width: compact ? 14 : 16,
          height: compact ? 14 : 16,
          borderRadius: 6,
          padding: 2,
          background: "rgba(0,0,0,0.35)",
          border: "1px solid rgba(255,255,255,0.12)",
        }}
        onError={(e) => {
          e.currentTarget.style.display = "none";
        }}
      />
      {name}
    </span>
  );
}

function moveBadgeStyle(eff, emphasis, view = "my") {
  const base = {
    padding: "7px 10px",
    borderRadius: 999,
    fontWeight: 1100,
    fontSize: 12,
    flex: "0 0 auto",
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    whiteSpace: "nowrap",
  };

  const isImmune = eff === 0;
  const isVery = eff >= 2;
  const isResist = eff > 0 && eff < 1;
  const isNeutral = eff === 1;

  if (isImmune) {
    return {
      ...base,
      border: "1px solid rgba(0,0,0,0.55)",
      background: "rgba(0,0,0,0.55)",
      color: "#fff",
      boxShadow: emphasis ? "0 0 0 3px rgba(0,0,0,0.25)" : undefined,
    };
  }

  let goodForMe = false;
  if (view === "my") {
    if (isVery) goodForMe = true;
    else if (isResist) goodForMe = false;
  } else {
    if (isResist) goodForMe = true;
    else if (isVery) goodForMe = false;
  }

  if (isNeutral) {
    return {
      ...base,
      border: "1px solid rgba(255,255,255,0.14)",
      background: "rgba(255,255,255,0.06)",
      color: "#fff",
    };
  }

  if (goodForMe) {
    return {
      ...base,
      border: emphasis ? "1px solid rgba(90,255,170,0.65)" : "1px solid rgba(90,255,170,0.30)",
      background: emphasis ? "rgba(90,255,170,0.20)" : "rgba(90,255,170,0.14)",
      color: "#eafff4",
      boxShadow: emphasis ? "0 0 0 3px rgba(90,255,170,0.14), 0 10px 24px rgba(0,0,0,0.35)" : undefined,
    };
  }

  return {
    ...base,
    border: emphasis ? "1px solid rgba(255,120,120,0.55)" : "1px solid rgba(255,120,120,0.30)",
    background: emphasis ? "rgba(255,120,120,0.16)" : "rgba(255,120,120,0.12)",
    color: "#fff0f0",
    boxShadow: emphasis ? "0 0 0 3px rgba(255,120,120,0.12)" : undefined,
  };
}

function moveRowBg(eff, view = "my") {
  if (eff === 0) return { bg: "rgba(0,0,0,0.22)", border: "1px solid rgba(0,0,0,0.35)", glow: undefined };
  if (eff === 1 || eff == null) return { bg: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)", glow: undefined };

  const isVery = eff >= 2;
  const isResist = eff > 0 && eff < 1;

  let goodForMe = false;
  if (view === "my") {
    goodForMe = isVery;
  } else {
    goodForMe = isResist;
  }

  if (goodForMe) {
    return {
      bg: "rgba(90,255,170,0.10)",
      border: "1px solid rgba(90,255,170,0.40)",
      glow: "0 0 0 3px rgba(90,255,170,0.10)",
    };
  }

  return {
    bg: "rgba(255,120,120,0.10)",
    border: "1px solid rgba(255,120,120,0.30)",
    glow: isVery ? "0 0 0 3px rgba(255,120,120,0.10)" : undefined,
  };
}

function StatBar({ label, value, compact }) {
  const v = safeNum(value, 0);
  const max = 200;
  const pct = clamp((v / max) * 100, 0, 100);

  let bar = "rgba(90,255,170,0.55)";
  if (v >= 120) bar = "rgba(110,170,255,0.75)";
  else if (v <= 70) bar = "rgba(255,110,110,0.75)";

  return (
    <div style={{ display: "grid", gap: compact ? 4 : 5 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: compact ? 11 : 12, lineHeight: 1.15 }}>
        <span style={{ opacity: 0.85 }}>{label}</span>
        <span style={{ fontWeight: 950 }}>{v}</span>
      </div>
      <div
        style={{
          height: compact ? 7 : 8,
          borderRadius: 999,
          border: "1px solid rgba(255,255,255,0.10)",
          background: "rgba(0,0,0,0.28)",
          overflow: "hidden",
        }}
      >
        <div style={{ width: `${pct}%`, height: "100%", background: bar }} />
      </div>
    </div>
  );
}

function IconBtn({ title, onClick, children, danger }) {
  return (
    <button
      title={title}
      onClick={onClick}
      style={{
        width: 34,
        height: 34,
        borderRadius: 12,
        border: "1px solid rgba(255,255,255,0.14)",
        background: danger ? "rgba(255,80,80,0.12)" : "rgba(255,255,255,0.06)",
        color: "#fff",
        cursor: "pointer",
        fontWeight: 950,
        display: "grid",
        placeItems: "center",
        padding: 0,
        lineHeight: 1,
      }}
    >
      <span style={{ display: "grid", placeItems: "center", width: "100%", height: "100%", transform: "translateY(-0.5px)" }}>{children}</span>
    </button>
  );
}

function Collapsible({ title, open, setOpen, children }) {
  return (
    <div style={{ marginTop: 12 }}>
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          width: "100%",
          textAlign: "left",
          padding: "10px 12px",
          borderRadius: 14,
          border: "1px solid rgba(255,255,255,0.12)",
          background: "rgba(255,255,255,0.06)",
          color: "#fff",
          cursor: "pointer",
          fontWeight: 1000,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 10,
        }}
      >
        <span>{title}</span>
        <span style={{ opacity: 0.8 }}>{open ? "▴" : "▾"}</span>
      </button>
      {open && (
        <div
          className="hideScroll"
          style={{
            marginTop: 10,
            padding: 12,
            borderRadius: 14,
            border: "1px solid rgba(255,255,255,0.10)",
            background: "rgba(0,0,0,0.22)",
            maxHeight: 220,
            overflow: "auto",
          }}
        >
          {children}
        </div>
      )}
    </div>
  );
}

/* =========================
   Dark dropdown components
========================= */
function DarkPicker({ title, value, onChange, items, placeholder = "Auswählen…", search = true, maxVisible = 90 }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const wrapRef = useRef(null);

  useEffect(() => {
    function onDown(e) {
      if (!open) return;
      const el = wrapRef.current;
      if (!el) return;
      if (!el.contains(e.target)) setOpen(false);
    }
    window.addEventListener("mousedown", onDown, { capture: true });
    return () => window.removeEventListener("mousedown", onDown, { capture: true });
  }, [open]);

  const cur = items.find((x) => String(x.value) === String(value));
  const label = cur?.label || placeholder;

  const filtered = useMemo(() => {
    if (!search) return items.slice(0, maxVisible);
    const qq = normText(q);
    if (!qq) return items.slice(0, maxVisible);
    const out = [];
    for (const it of items) {
      if (normText(it.label).includes(qq)) out.push(it);
      if (out.length >= maxVisible) break;
    }
    return out;
  }, [q, items, search, maxVisible]);

  return (
    <div ref={wrapRef} style={{ position: "relative" }}>
      {title ? <div style={{ opacity: 0.9, fontSize: 13, marginBottom: 6 }}>{title}</div> : null}

      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          width: "100%",
          textAlign: "left",
          padding: "10px 12px",
          borderRadius: 12,
          border: "1px solid rgba(255,255,255,0.14)",
          background: "rgba(0,0,0,0.28)",
          color: "#fff",
          cursor: "pointer",
          fontWeight: 950,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
          textDecoration: "none",
        }}
      >
        <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</span>
        <span style={{ opacity: 0.75 }}>▾</span>
      </button>

      {open && (
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: 44,
            zIndex: 999999,
            borderRadius: 14,
            border: "1px solid rgba(255,255,255,0.14)",
            background: "rgba(10,10,16,0.96)",
            boxShadow: "0 24px 80px rgba(0,0,0,0.75)",
            overflow: "hidden",
          }}
        >
          {search && (
            <div style={{ padding: 10, borderBottom: "1px solid rgba(255,255,255,0.12)" }}>
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Suchen…"
                style={{
                  width: "100%",
                  background: "rgba(0,0,0,0.32)",
                  border: "1px solid rgba(255,255,255,0.14)",
                  borderRadius: 12,
                  color: "#fff",
                  padding: "10px 12px",
                  outline: "none",
                }}
              />
            </div>
          )}

          <div className="hideScroll" style={{ maxHeight: 320, overflow: "auto" }}>
            {filtered.length === 0 ? (
              <div style={{ padding: 12, opacity: 0.75 }}>Keine Treffer.</div>
            ) : (
              filtered.map((it) => (
                <button
                  key={String(it.value)}
                  onClick={() => {
                    onChange(it.value);
                    setOpen(false);
                  }}
                  style={{
                    width: "100%",
                    textAlign: "left",
                    padding: "10px 12px",
                    border: "none",
                    borderBottom: "1px solid rgba(255,255,255,0.08)",
                    background: "transparent",
                    color: "#fff",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    textDecoration: "none",
                  }}
                >
                  {it.leftIconUrl ? (
                    <img
                      src={it.leftIconUrl}
                      alt=""
                      style={{
                        width: 18,
                        height: 18,
                        borderRadius: 8,
                        padding: 2,
                        background: "rgba(0,0,0,0.35)",
                        border: "1px solid rgba(255,255,255,0.12)",
                      }}
                      onError={(e) => {
                        e.currentTarget.style.display = "none";
                      }}
                    />
                  ) : null}
                  <div style={{ fontWeight: 950, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{it.label}</div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* Move Picker */
function MovePicker({
  label,
  value,
  onChange,
  allowedMoves,
  moveCacheRef,
  loadMove,
  enemyTypes,
  enemyAbilityKeys,
  myPokemonTitle,
  myPokemonImg,
  takenMoves,
  navigateToMove,
  gen,
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const wrapRef = useRef(null);
  const btnRef = useRef(null);
  const [menuPos, setMenuPos] = useState(null);

  useEffect(() => {
    function onDown(e) {
      if (!open) return;
      const el = wrapRef.current;
      if (!el) return;
      if (!el.contains(e.target)) setOpen(false);
    }
    window.addEventListener("mousedown", onDown, { capture: true });
    return () => window.removeEventListener("mousedown", onDown, { capture: true });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function recalc() {
      const b = btnRef.current;
      if (!b) return;
      const r = b.getBoundingClientRect();
      const vw = window.innerWidth;
      const vh = window.innerHeight;

      const desiredW = Math.min(Math.max(r.width, 320), 560);
      const left = clamp(r.left, 10, vw - desiredW - 10);
      const topCandidate = r.bottom + 6;

      const maxH = Math.min(380, vh - 20);
      const spaceBelow = vh - topCandidate - 10;
      const spaceAbove = r.top - 10;

      const openDown = spaceBelow >= 220 || spaceBelow >= spaceAbove;
      const maxHeight = Math.max(220, Math.min(maxH, openDown ? spaceBelow : spaceAbove));

      const top = openDown ? topCandidate : clamp(r.top - maxHeight - 6, 10, vh - maxHeight - 10);

      setMenuPos({
        left,
        top,
        width: desiredW,
        maxHeight,
      });
    }
    recalc();
    window.addEventListener("resize", recalc);
    window.addEventListener("scroll", recalc, true);
    return () => {
      window.removeEventListener("resize", recalc);
      window.removeEventListener("scroll", recalc, true);
    };
  }, [open]);

  const filtered = useMemo(() => {
    const qq = normText(q);
    if (!qq) return allowedMoves.slice(0, 110);
    const out = [];
    for (const m of allowedMoves) {
      const det = moveCacheRef.current.get(m);
      const de = det?.deName || "";
      const keyText = `${m} ${de}`;
      if (normText(keyText).includes(qq)) out.push(m);
      if (out.length >= 110) break;
    }
    return out;
  }, [q, allowedMoves, moveCacheRef]);

  const key = value ? String(value).toLowerCase() : "";
  const currentDet = key ? moveCacheRef.current.get(key) : null;

  if (key && !currentDet) {
    loadMove(key).catch(() => {});
  }

  const currentLabel = key ? currentDet?.deName || cap(key) : "—";
  const curType = currentDet?.type || null;
  const curPower = currentDet?.power ?? null;
  const curPP = currentDet?.pp ?? null;
  const curAcc = currentDet?.accuracy ?? null;
  const curDC = currentDet?.damage_class || null;

  const isDamaging =
    currentDet?.damage_class === "physical" ||
    currentDet?.damage_class === "special" ||
    currentDet?.power != null ||
    String(currentDet?.damage_class || "") === "physical" ||
    String(currentDet?.damage_class || "") === "special";

  let eff = curType && enemyTypes?.length && isDamaging ? typeEffectiveness(curType, enemyTypes, gen) : null;
  if (eff != null) {
    eff = overrideEffForAbilities({
      moveType: curType,
      defenderAbilities: enemyAbilityKeys,
      eff,
    });
  }

  const catIcon = moveCategoryIconUrl(curDC);
  const catLabel = curDC ? MOVE_CLASS_LABEL_DE[String(curDC).toLowerCase()] || cap(curDC) : null;

  return (
    <div ref={wrapRef} style={{ position: "relative" }}>
      <div style={{ opacity: 0.9, fontSize: 13, marginBottom: 6 }}>{label}</div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 42px", gap: 8, alignItems: "stretch" }}>
        <button
          ref={btnRef}
          onClick={() => setOpen((v) => !v)}
          style={{
            width: "100%",
            textAlign: "left",
            padding: "10px 12px",
            borderRadius: 12,
            border: "1px solid rgba(255,255,255,0.14)",
            background: "rgba(0,0,0,0.28)",
            color: "#fff",
            cursor: "pointer",
            fontWeight: 950,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 10,
            minHeight: 42,
            textDecoration: "none",
          }}
          title={key ? "Klicken: Dropdown • Doppelklick: Move-Details" : "Dropdown öffnen"}
          onDoubleClick={(e) => {
            if (!key) return;
            e.preventDefault();
            e.stopPropagation();
            navigateToMove(key);
          }}
        >
          <div style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
              <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: 1100 }}>
                {currentLabel}
              </span>
              <span style={{ opacity: 0.75, flex: "0 0 auto" }}>▾</span>
            </div>

            {key ? (
              <div
                style={{
                  opacity: 0.9,
                  fontSize: 12,
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  flexWrap: "wrap",
                }}
              >
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                  {curType ? (
                    <>
                      <img
                        src={typeIconUrl(curType)}
                        alt=""
                        style={{
                          width: 16,
                          height: 16,
                          borderRadius: 8,
                          padding: 2,
                          background: "rgba(0,0,0,0.35)",
                          border: "1px solid rgba(255,255,255,0.12)",
                        }}
                        onError={(e) => {
                          e.currentTarget.style.display = "none";
                        }}
                      />
                      <span style={{ fontWeight: 900 }}>Typ: {TYPE_LABELS_DE[curType] || cap(curType)}</span>
                    </>
                  ) : (
                    <span style={{ opacity: 0.75 }}>Typ: —</span>
                  )}
                </span>

                <span>
                  Stärke: <b>{curPower != null ? curPower : "—"}</b>
                </span>
                <span>
                  AP: <b>{curPP != null ? curPP : "—"}</b>
                </span>
                <span>
                  Genauigkeit: <b>{curAcc != null ? `${curAcc}%` : "—"}</b>
                </span>

                {curDC ? (
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                    {catIcon ? (
                      <img
                        src={catIcon}
                        alt=""
                        style={{
                          width: 16,
                          height: 16,
                          imageRendering: "pixelated",
                          borderRadius: 6,
                          padding: 1,
                          background: "rgba(0,0,0,0.35)",
                          border: "1px solid rgba(255,255,255,0.12)",
                        }}
                        onError={(e) => {
                          e.currentTarget.style.display = "none";
                        }}
                      />
                    ) : null}
                    <span>
                      Klasse: <b>{catLabel || cap(curDC)}</b>
                    </span>
                  </span>
                ) : null}

                {eff != null ? (
                  <span style={moveBadgeStyle(eff, eff >= 2 || eff === 0, "my")}>
                    x{eff}
                  </span>
                ) : null}
              </div>
            ) : null}
          </div>
        </button>

        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onChange("");
            setOpen(false);
          }}
          disabled={!key}
          style={{
            width: 42,
            height: 42,
            borderRadius: 12,
            border: "1px solid rgba(255,255,255,0.14)",
            background: key ? "rgba(255,80,80,0.12)" : "rgba(255,255,255,0.06)",
            color: key ? "#fff" : "rgba(255,255,255,0.45)",
            fontWeight: 1100,
            cursor: key ? "pointer" : "not-allowed",
            display: "grid",
            placeItems: "center",
            padding: 0,
          }}
          title={key ? "Attacke entfernen" : "Keine Attacke gesetzt"}
        >
          X
        </button>
      </div>

      {open && menuPos && (
        <div
          style={{
            position: "fixed",
            left: menuPos.left,
            top: menuPos.top,
            width: menuPos.width,
            zIndex: 9999999,
            borderRadius: 14,
            border: "1px solid rgba(255,255,255,0.14)",
            background: "rgba(10,10,16,0.98)",
            boxShadow: "0 28px 100px rgba(0,0,0,0.78)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              padding: 10,
              borderBottom: "1px solid rgba(255,255,255,0.12)",
              display: "flex",
              gap: 10,
              alignItems: "center",
            }}
          >
            <div
              style={{
                width: 42,
                height: 42,
                borderRadius: 12,
                border: "1px solid rgba(255,255,255,0.12)",
                background: "rgba(0,0,0,0.35)",
                display: "grid",
                placeItems: "center",
                overflow: "hidden",
                flex: "0 0 auto",
              }}
              title={myPokemonTitle || ""}
            >
              {myPokemonImg ? <img src={myPokemonImg} alt="" style={{ width: 42, height: 42, objectFit: "contain" }} /> : <div style={{ opacity: 0.6, fontWeight: 900 }}>—</div>}
            </div>

            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Attacke suchen…"
              style={{
                flex: 1,
                minWidth: 0,
                background: "rgba(0,0,0,0.32)",
                border: "1px solid rgba(255,255,255,0.14)",
                borderRadius: 12,
                color: "#fff",
                padding: "10px 12px",
                outline: "none",
              }}
            />

            <button
              onClick={() => {
                onChange("");
                setOpen(false);
              }}
              style={{
                width: 42,
                height: 42,
                borderRadius: 12,
                border: "1px solid rgba(255,255,255,0.14)",
                background: "rgba(255,255,255,0.06)",
                color: "#fff",
                fontWeight: 1000,
                cursor: "pointer",
                display: "grid",
                placeItems: "center",
                padding: 0,
              }}
              title="Leeren"
            >
              X
            </button>
          </div>

          <div className="hideScroll" style={{ maxHeight: menuPos.maxHeight, overflow: "auto" }}>
            {filtered.length === 0 ? (
              <div style={{ padding: 12, opacity: 0.75 }}>Keine Treffer.</div>
            ) : (
              filtered.map((m) => {
                const mk = String(m || "").toLowerCase();
                const cached = moveCacheRef.current.get(mk);
                if (!cached) loadMove(mk).catch(() => {});

                const deName = cached?.deName || cap(mk);
                const type = cached?.type || null;
                const power = cached?.power ?? null;
                const pp = cached?.pp ?? null;
                const acc = cached?.accuracy ?? null;
                const dc = cached?.damage_class || null;

                const catIcon2 = moveCategoryIconUrl(dc);
                const catLabel2 = dc ? MOVE_CLASS_LABEL_DE[String(dc).toLowerCase()] || cap(dc) : null;

                const alreadyTaken = takenMoves?.has(mk) && mk !== String(value || "").toLowerCase();

                let eff2 = null;
                if (type && Array.isArray(enemyTypes) && enemyTypes.length) {
                  eff2 = typeEffectiveness(type, enemyTypes, gen);
                  eff2 = overrideEffForAbilities({
                    moveType: type,
                    defenderAbilities: enemyAbilityKeys,
                    eff: eff2,
                  });
                }

                const isDamaging2 =
                  dc === "physical" || dc === "special" || power != null || String(dc || "") === "physical" || String(dc || "") === "special";

                const showEff = eff2 != null && isDamaging2;
                const badge = showEff ? moveBadgeStyle(eff2, eff2 >= 2 || eff2 === 0, "my") : null;

                const rowGlow =
                  showEff && eff2 >= 2
                    ? "0 0 0 2px rgba(90,255,170,0.12), 0 16px 40px rgba(0,0,0,0.35)"
                    : showEff && eff2 === 0
                    ? "0 0 0 2px rgba(0,0,0,0.18)"
                    : undefined;

                return (
                  <button
                    key={mk}
                    disabled={alreadyTaken}
                    onClick={() => {
                      if (alreadyTaken) return;
                      onChange(mk);
                      setOpen(false);
                    }}
                    style={{
                      width: "100%",
                      textAlign: "left",
                      padding: "10px 12px",
                      border: "none",
                      borderBottom: "1px solid rgba(255,255,255,0.08)",
                      background: alreadyTaken
                        ? "rgba(255,255,255,0.04)"
                        : showEff && eff2 >= 2
                        ? "rgba(90,255,170,0.10)"
                        : showEff && eff2 === 0
                        ? "rgba(0,0,0,0.26)"
                        : "transparent",
                      color: alreadyTaken ? "rgba(255,255,255,0.45)" : "#fff",
                      cursor: alreadyTaken ? "not-allowed" : "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 12,
                      boxShadow: rowGlow,
                      textDecoration: "none",
                    }}
                    title={alreadyTaken ? "Diese Attacke ist schon im Moveset." : "Wählen"}
                  >
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 1100, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{deName}</div>

                      <div
                        style={{
                          opacity: alreadyTaken ? 0.55 : 0.9,
                          fontSize: 12,
                          display: "flex",
                          gap: 12,
                          flexWrap: "wrap",
                          marginTop: 2,
                          alignItems: "center",
                        }}
                      >
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                          {type ? (
                            <>
                              <img
                                src={typeIconUrl(type)}
                                alt=""
                                style={{
                                  width: 16,
                                  height: 16,
                                  borderRadius: 8,
                                  padding: 2,
                                  background: "rgba(0,0,0,0.35)",
                                  border: "1px solid rgba(255,255,255,0.12)",
                                }}
                                onError={(e) => {
                                  e.currentTarget.style.display = "none";
                                }}
                              />
                              Typ: {TYPE_LABELS_DE[type] || cap(type)}
                            </>
                          ) : (
                            "Typ: —"
                          )}
                        </span>
                        <span>Stärke: {power != null ? power : "—"}</span>
                        <span>AP: {pp != null ? pp : "—"}</span>
                        <span>Genauigkeit: {acc != null ? `${acc}%` : "—"}</span>

                        {dc ? (
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                            {catIcon2 ? (
                              <img
                                src={catIcon2}
                                alt=""
                                style={{
                                  width: 16,
                                  height: 16,
                                  imageRendering: "pixelated",
                                  borderRadius: 6,
                                  padding: 1,
                                  background: "rgba(0,0,0,0.35)",
                                  border: "1px solid rgba(255,255,255,0.12)",
                                }}
                                onError={(e) => {
                                  e.currentTarget.style.display = "none";
                                }}
                              />
                            ) : null}
                            Klasse: {catLabel2 || cap(dc)}
                          </span>
                        ) : null}

                        {alreadyTaken ? <span style={{ color: "rgba(255,120,120,0.9)", fontWeight: 950 }}>Schon gewählt</span> : null}
                      </div>
                    </div>

                    {badge ? (
                      <div style={badge}>
                        x{eff2}
                      </div>
                    ) : null}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* =========================
   Suggest list
========================= */
function SuggestList({ suggestions, onPick }) {
  if (!suggestions?.length) return null;
  return (
    <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
      {suggestions.map((s) => (
        <button
          key={s.key}
          onClick={() => onPick(s)}
          style={{
            width: "100%",
            textAlign: "left",
            padding: "10px 12px",
            borderRadius: 14,
            border: "1px solid rgba(255,255,255,0.14)",
            background: "rgba(255,255,255,0.06)",
            color: "#fff",
            cursor: "pointer",
            fontWeight: 950,
            textDecoration: "none",
          }}
        >
          <span style={{ opacity: 0.7, marginRight: 10 }}>#{s.dexId}</span>
          {s.name}
        </button>
      ))}
    </div>
  );
}

/* =========================
   Weakness buckets
========================= */
function buildDefBuckets(defTypes, gen) {
  const out = { "4x": [], "2x": [], "0.5x": [], "0.25x": [], "0x": [], "1x": [] };
  if (!defTypes?.length) return out;

  const atkTypes = attackTypesForGen(gen);
  const normalizedDef = (defTypes || []).map((t) => normalizeTypeForGen(t, gen)).filter(Boolean);

  for (const a of atkTypes) {
    const mult = typeEffectiveness(a, normalizedDef, gen);

    if (mult === 0) out["0x"].push(a);
    else if (mult === 0.25) out["0.25x"].push(a);
    else if (mult === 0.5) out["0.5x"].push(a);
    else if (mult === 1) out["1x"].push(a);
    else if (mult === 2) out["2x"].push(a);
    else if (mult === 4) out["4x"].push(a);
  }
  return out;
}

function TypeRow({ title, list }) {
  if (!list?.length) return null;
  return (
    <div style={{ display: "grid", gap: 8, marginBottom: 10 }}>
      <div style={{ fontWeight: 1000, opacity: 0.9, fontSize: 13 }}>{title}</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {list.map((t) => (
          <span
            key={t}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "7px 10px",
              borderRadius: 999,
              border: "1px solid rgba(255,255,255,0.12)",
              background: "rgba(255,255,255,0.06)",
              fontWeight: 950,
              fontSize: 12,
            }}
            title={TYPE_LABELS_DE[t] || cap(t)}
          >
            <img
              src={typeIconUrl(t)}
              alt=""
              style={{
                width: 16,
                height: 16,
                borderRadius: 8,
                padding: 2,
                background: "rgba(0,0,0,0.35)",
                border: "1px solid rgba(255,255,255,0.12)",
              }}
              onError={(e) => {
                e.currentTarget.style.display = "none";
              }}
            />
            {TYPE_LABELS_DE[t] || cap(t)}
          </span>
        ))}
      </div>
    </div>
  );
}

/* =========================
   Component
========================= */
export default function TeamCompare() {
  const navigate = useNavigate();
  const location = useLocation();

  const allDexEntries = useMemo(() => {
    return Object.entries(fullPokedex || {})
      .map(([k, v]) => ({ key: k, dexId: getDexIdFromKey(k), name: String(v || "") }))
      .filter((x) => Number.isFinite(x.dexId) && x.dexId > 0 && x.name);
  }, []);

  const [gen, setGen] = useState(() => {
    const fromShared = Number(localStorage.getItem(GEN_KEY));
    if (Number.isFinite(fromShared) && fromShared >= 1 && fromShared <= 9) return fromShared;

    const fromUi = Number(readJSON(UI_KEY, {})?.gen ?? 6);
    return clamp(fromUi, 1, 9);
  });

  const versionGroup = useMemo(() => GEN_TO_VERSION_GROUP[gen] || "omega-ruby-alpha-sapphire", [gen]);

  const [team, setTeam] = useState(() => {
    const t = readJSON(TEAM_KEY, null);
    if (Array.isArray(t) && t.length === 6) return t;
    return new Array(6).fill(0).map((_, i) => makeEmptySlot(i));
  });

  const [activeSlot, setActiveSlot] = useState(() => clamp(Number(readJSON(UI_KEY, {})?.activeSlot ?? 0), 0, 5));

  const [enemyDexId, setEnemyDexId] = useState(() => {
    const v = readJSON(UI_KEY, {})?.enemyDexId ?? null;
    return v ? Number(v) : null;
  });
  const [enemyLevel, setEnemyLevel] = useState(() => clamp(Number(readJSON(UI_KEY, {})?.enemyLevel ?? 50), 1, 100));

  const [editOpen, setEditOpen] = useState(false);
  const [editQuery, setEditQuery] = useState("");
  const [enemyQuery, setEnemyQuery] = useState("");

  const [myFormList, setMyFormList] = useState([]);
  const [enemyFormList, setEnemyFormList] = useState([]);
  const [enemyWeakOpen, setEnemyWeakOpen] = useState(false);

  const pokeCacheRef = useRef(new Map());
  const moveCacheRef = useRef(new Map());
  const abilityCacheRef = useRef(new Map());
  const [tick, setTick] = useState(0);

  useEffect(() => writeJSON(TEAM_KEY, team), [team]);
  useEffect(() => writeJSON(UI_KEY, { gen, activeSlot, enemyDexId, enemyLevel }), [gen, activeSlot, enemyDexId, enemyLevel]);

  useEffect(() => {
    localStorage.setItem(GEN_KEY, String(gen));
  }, [gen]);

  const mySlot = team[activeSlot] || makeEmptySlot(activeSlot);

  function goToMove(moveKey) {
    const mk = String(moveKey || "").toLowerCase().trim();
    if (!mk) return;
    navigate(`/move/${mk}`);
  }

  async function loadPokemonFullById(id) {
    const pid = Number(id);
    if (!pid) return null;
    if (pokeCacheRef.current.has(pid)) return pokeCacheRef.current.get(pid);

    const p = await fetchPokemonById(pid);
    const speciesId = Number(String(p?.species?.url || "").match(/pokemon-species\/(\d+)/)?.[1] || pid);
    const s = await fetchSpeciesById(speciesId);

    const baseDeName = getGermanName(s?.names, fullPokedex[keyFromDexId(speciesId)] || `#${speciesId}`);
    const apiName = p?.name || `#${pid}`;
    const displayDeName = formatFormLabelDE(baseDeName, apiName);

    const val = { pokemon: p, species: s, baseDeName, displayDeName, apiName };
    pokeCacheRef.current.set(pid, val);
    setTick((t) => t + 1);
    return val;
  }

  async function loadMove(moveName) {
    const key = String(moveName || "").toLowerCase().trim();
    if (!key) return null;
    if (moveCacheRef.current.has(key)) return moveCacheRef.current.get(key);

    const m = await fetchMove(key);
    const deName = getGermanName(m?.names, cap(key));
    const dc = m?.damage_class?.name || null;

    const val = {
      deName,
      type: m?.type?.name || null,
      power: m?.power ?? null,
      pp: m?.pp ?? null,
      accuracy: m?.accuracy ?? null,
      damage_class: dc,
      isStatus: dc === "status",
    };
    moveCacheRef.current.set(key, val);
    setTick((t) => t + 1);
    return val;
  }

  async function loadAbility(abilityKey) {
    const k = String(abilityKey || "").toLowerCase().trim();
    if (!k) return null;
    if (abilityCacheRef.current.has(k)) return abilityCacheRef.current.get(k);

    const a = await fetchAbility(k);
    const deName = getGermanName(a?.names, cap(k));
    const short = getGermanEffectShort(a?.effect_entries, "");
    const val = { key: k, deName, shortEffect: short };
    abilityCacheRef.current.set(k, val);
    setTick((t) => t + 1);
    return val;
  }

  const [myLoading, setMyLoading] = useState(false);
  const [enemyLoading, setEnemyLoading] = useState(false);

  useEffect(() => {
    setTeam((prev) => {
      let changed = false;
      const next = prev.map((s, idx) => {
        const id = Number(s?.dexId || 0);
        if (!id) return s;
        if (!isBaseDexIdAllowedInGen(id, gen)) {
          changed = true;
          return makeEmptySlot(idx);
        }
        return s;
      });
      return changed ? next : prev;
    });

    setEnemyDexId((prev) => {
      const id = Number(prev || 0);
      if (!id) return prev;
      if (!isBaseDexIdAllowedInGen(id, gen)) return null;
      return prev;
    });
  }, [gen]);

  useEffect(() => {
    let alive = true;
    async function run() {
      if (!mySlot.dexId) return;
      try {
        setMyLoading(true);
        await loadPokemonFullById(mySlot.dexId);
      } finally {
        if (alive) setMyLoading(false);
      }
    }
    run();
    return () => {
      alive = false;
    };
  }, [mySlot.dexId]);

  useEffect(() => {
    let alive = true;
    async function run() {
      if (!enemyDexId) return;
      try {
        setEnemyLoading(true);
        await loadPokemonFullById(enemyDexId);
      } finally {
        if (alive) setEnemyLoading(false);
      }
    }
    run();
    return () => {
      alive = false;
    };
  }, [enemyDexId]);

  useEffect(() => {
    let alive = true;
    async function run() {
      const picks = (mySlot.moves || []).filter(Boolean);
      for (const mv of picks) {
        try {
          await loadMove(mv);
          if (!alive) return;
        } catch {}
      }
    }
    run();
    return () => {
      alive = false;
    };
  }, [mySlot.moves?.join("|")]);

  // ✅ IMPORTANT: now depends on enemyLevel too (because allowed enemy moves depend on level)
  useEffect(() => {
    let alive = true;
    async function run() {
      if (!enemyDexId) return;
      const data = pokeCacheRef.current.get(Number(enemyDexId));
      if (!data?.pokemon) return;

      const L = clamp(Number(enemyLevel) || 1, 1, 100);
      const ls = extractLearnsetByMethod(data.pokemon, versionGroup);

      const allowedLevel = ls.levelUp.filter((x) => (Number(x.level) || 0) <= L).map((x) => String(x.name).toLowerCase());
      const allowed = uniq([...allowedLevel, ...(ls.machine || [])]);

      for (const mv of allowed.slice(0, 220)) {
        try {
          await loadMove(mv);
          if (!alive) return;
        } catch {}
      }
    }
    run();
    return () => {
      alive = false;
    };
  }, [enemyDexId, versionGroup, enemyLevel]);

  const myData = mySlot.dexId ? pokeCacheRef.current.get(Number(mySlot.dexId)) : null;
  const enemyData = enemyDexId ? pokeCacheRef.current.get(Number(enemyDexId)) : null;

  const myTypes = useMemo(() => extractTypesForGen(myData?.pokemon, gen), [myData, tick, gen]);
  const enemyTypes = useMemo(() => extractTypesForGen(enemyData?.pokemon, gen), [enemyData, tick, gen]);

  const myStats = useMemo(() => computeStats(myData?.pokemon, mySlot.level), [myData, mySlot.level, tick]);
  const enemyStats = useMemo(() => computeStats(enemyData?.pokemon, enemyLevel), [enemyData, enemyLevel, tick]);

  const myAllowedMoves = useMemo(() => {
    if (!myData?.pokemon) return [];
    return extractAllowedMoves(myData.pokemon, versionGroup).map((x) => String(x).toLowerCase());
  }, [myData, versionGroup, tick]);

  // ✅ Enemy moves are now LEVEL-AWARE:
  // - level-up moves only if level_learned_at <= enemyLevel
  // - machine moves always allowed
  const enemyAllowedMoves = useMemo(() => {
    if (!enemyData?.pokemon) return [];
    const L = clamp(Number(enemyLevel) || 1, 1, 100);

    const ls = extractLearnsetByMethod(enemyData.pokemon, versionGroup);
    const levelMoves = (ls.levelUp || []).filter((x) => (Number(x.level) || 0) <= L).map((x) => String(x.name).toLowerCase());
    const machineMoves = (ls.machine || []).map((x) => String(x).toLowerCase());

    return uniq([...levelMoves, ...machineMoves]).sort((a, b) => a.localeCompare(b));
  }, [enemyData, versionGroup, tick, enemyLevel]);

  const myAbilityKeysRaw = useMemo(() => extractAbilityKeys(myData?.pokemon), [myData, tick]);
  const enemyAbilityKeysRaw = useMemo(() => extractAbilityKeys(enemyData?.pokemon), [enemyData, tick]);

  useEffect(() => {
    let alive = true;
    async function run() {
      for (const k of myAbilityKeysRaw) {
        try {
          await loadAbility(k);
          if (!alive) return;
        } catch {}
      }
    }
    run();
    return () => {
      alive = false;
    };
  }, [myAbilityKeysRaw.join("|")]);

  useEffect(() => {
    let alive = true;
    async function run() {
      for (const k of enemyAbilityKeysRaw) {
        try {
          await loadAbility(k);
          if (!alive) return;
        } catch {}
      }
    }
    run();
    return () => {
      alive = false;
    };
  }, [enemyAbilityKeysRaw.join("|")]);

  const myAbilities = useMemo(() => {
    const out = [];
    for (const k of myAbilityKeysRaw) {
      const det = abilityCacheRef.current.get(k);
      out.push({
        key: k,
        deName: det?.deName || cap(k),
        shortEffect: det?.shortEffect || "",
      });
    }
    return out;
  }, [myAbilityKeysRaw.join("|"), tick]);

  const enemyAbilities = useMemo(() => {
    const out = [];
    for (const k of enemyAbilityKeysRaw) {
      const det = abilityCacheRef.current.get(k);
      out.push({
        key: k,
        deName: det?.deName || cap(k),
        shortEffect: det?.shortEffect || "",
      });
    }
    return out;
  }, [enemyAbilityKeysRaw.join("|"), tick]);

  const enemyAbilityKeys = useMemo(() => enemyAbilities.map((a) => a.key).filter(Boolean), [enemyAbilities]);
  const myAbilityKeys = useMemo(() => myAbilities.map((a) => a.key).filter(Boolean), [myAbilities]);

  const enemyHasLevitate = useMemo(() => enemyAbilityKeys.includes("levitate"), [enemyAbilityKeys.join("|")]);

  const editSuggestions = useMemo(() => {
    const q = normText(editQuery);
    if (!q) return [];
    const max = maxDexForGen(gen);
    return allDexEntries
      .filter((p) => p.dexId <= max)
      .filter((p) => normText(p.name).includes(q) || String(p.dexId) === q)
      .slice(0, 12);
  }, [editQuery, allDexEntries, gen]);

  const enemySuggestions = useMemo(() => {
    const q = normText(enemyQuery);
    if (!q) return [];
    const max = maxDexForGen(gen);
    return allDexEntries
      .filter((p) => p.dexId <= max)
      .filter((p) => normText(p.name).includes(q) || String(p.dexId) === q)
      .slice(0, 12);
  }, [enemyQuery, allDexEntries, gen]);

  function setSlotDex(slotIndex, dexId) {
    const id = Number(dexId);
    if (!isBaseDexIdAllowedInGen(id, gen)) return;

    setTeam((prev) => {
      const next = prev.slice();
      const cur = next[slotIndex] || makeEmptySlot(slotIndex);
      next[slotIndex] = { ...cur, dexId: id, moves: cur.moves || ["", "", "", ""] };
      return next;
    });
  }

  function setSlotLevel(slotIndex, level) {
    setTeam((prev) => {
      const next = prev.slice();
      const cur = next[slotIndex] || makeEmptySlot(slotIndex);
      next[slotIndex] = { ...cur, level: clamp(Number(level) || 1, 1, 100) };
      return next;
    });
  }

  function setSlotMove(slotIndex, moveIndex, moveName) {
    const pick = String(moveName || "").toLowerCase().trim();
    setTeam((prev) => {
      const next = prev.slice();
      const cur = next[slotIndex] || makeEmptySlot(slotIndex);
      const moves = (cur.moves || ["", "", "", ""]).slice();

      if (pick && moves.some((m, i) => i !== moveIndex && String(m || "").toLowerCase() === pick)) {
        return prev;
      }

      moves[moveIndex] = pick || "";
      next[slotIndex] = { ...cur, moves };
      return next;
    });
  }

  function clearSlot(slotIndex) {
    setTeam((prev) => {
      const next = prev.slice();
      next[slotIndex] = makeEmptySlot(slotIndex);
      return next;
    });
  }

  function displayNameForDexId(dexId) {
    if (!dexId) return "—";
    const cached = pokeCacheRef.current.get(Number(dexId));
    if (cached?.displayDeName) return cached.displayDeName;
    const fallback = fullPokedex[keyFromDexId(dexId)] || `#${dexId}`;
    return fallback;
  }

  function spriteForDexId(dexId) {
    if (!dexId) return null;
    const cached = pokeCacheRef.current.get(Number(dexId));
    return cached?.pokemon?.sprites?.front_default || null;
  }

  function artworkForDexId(dexId) {
    if (!dexId) return null;
    const cached = pokeCacheRef.current.get(Number(dexId));
    const p = cached?.pokemon;
    return p?.sprites?.other?.["official-artwork"]?.front_default || p?.sprites?.front_default || null;
  }

  const myImg = artworkForDexId(mySlot.dexId);
  const enemyImg = artworkForDexId(enemyDexId);

  const HIDE_SCROLL_CSS = `
    .hideScroll { scrollbar-width: none; -ms-overflow-style: none; }
    .hideScroll::-webkit-scrollbar { width: 0px; height: 0px; }
  `;

  async function buildFormListFromBaseDexId(baseDexId) {
    try {
      const baseId = Number(baseDexId);
      if (!baseId) return [];

      const basePokemon = await loadPokemonFullById(baseId);
      const s = basePokemon?.species;
      const baseDe = basePokemon?.baseDeName || fullPokedex[keyFromDexId(baseId)] || `#${baseId}`;

      const vars = (s?.varieties || []).map((v) => v?.pokemon?.name).filter(Boolean);
      const items = [];

      for (const apiName of vars.slice(0, 80)) {
        if (!isFormAvailableInGen(apiName, gen)) continue;

        try {
          const p = await fetchPokemonByName(apiName);
          const id = Number(p?.id);
          if (!id) continue;

          if (!isBaseDexIdAllowedInGen(id, gen)) continue;

          const label = formatFormLabelDE(baseDe, apiName);
          items.push({ id, apiName, label });

          if (!pokeCacheRef.current.has(id)) {
            pokeCacheRef.current.set(id, { pokemon: p, species: s, baseDeName: baseDe, displayDeName: label, apiName });
          }
        } catch {}
      }

      const seen = new Set();
      const uniqItems = [];
      for (const it of items) {
        if (seen.has(it.id)) continue;
        seen.add(it.id);
        uniqItems.push(it);
      }
      uniqItems.sort((a, b) => a.label.localeCompare(b.label, "de"));
      return uniqItems;
    } catch {
      return [];
    }
  }

  useEffect(() => {
    let alive = true;
    async function run() {
      if (!mySlot.dexId) {
        setMyFormList([]);
        return;
      }
      const baseId = Number(String(myData?.species?.id || mySlot.dexId));
      const list = await buildFormListFromBaseDexId(baseId);
      if (!alive) return;
      setMyFormList(list);
    }
    run();
    return () => {
      alive = false;
    };
  }, [mySlot.dexId, gen, tick]);

  useEffect(() => {
    let alive = true;
    async function run() {
      if (!enemyDexId) {
        setEnemyFormList([]);
        return;
      }
      const baseId = Number(String(enemyData?.species?.id || enemyDexId));
      const list = await buildFormListFromBaseDexId(baseId);
      if (!alive) return;
      setEnemyFormList(list);
    }
    run();
    return () => {
      alive = false;
    };
  }, [enemyDexId, gen, tick]);

  const myMoveAdvice = useMemo(() => {
    if (!enemyTypes?.length) return { list: [], best: null, hasVeryEffective: false };
    const rows = [];

    for (const mv of (mySlot.moves || []).filter(Boolean)) {
      const key = String(mv).toLowerCase();
      const det = moveCacheRef.current.get(key);
      if (!det?.type) continue;

      const isDamaging = det.damage_class === "physical" || det.damage_class === "special" || det.power != null;
      if (!isDamaging) continue;

      let eff = typeEffectiveness(det.type, enemyTypes, gen);
      eff = overrideEffForAbilities({
        moveType: det.type,
        defenderAbilities: enemyAbilityKeys,
        eff,
      });

      const power = det.power ?? 60;
      const score = eff * power;

      rows.push({
        moveKey: key,
        deName: det.deName || cap(key),
        type: det.type,
        eff,
        power: det.power,
        pp: det.pp,
        accuracy: det.accuracy,
        dc: det.damage_class,
        score,
      });
    }
    rows.sort((a, b) => b.score - a.score);
    const best = rows[0] || null;
    const hasVeryEffective = rows.some((r) => r.eff >= 2);
    return { list: rows, best, hasVeryEffective };
  }, [enemyTypes, enemyAbilityKeys.join("|"), mySlot.moves?.join("|"), tick, gen]);

  const enemyAllMoves = useMemo(() => {
    if (!myTypes?.length || !enemyAllowedMoves?.length) return [];
    const rows = [];

    for (const mv of enemyAllowedMoves.slice(0, 400)) {
      const key = String(mv).toLowerCase();
      const det = moveCacheRef.current.get(key);
      if (!det) {
        loadMove(key).catch(() => {});
        continue;
      }

      const isDamaging = det.damage_class === "physical" || det.damage_class === "special" || det.power != null;
      if (!isDamaging || !det.type) continue;

      let eff = typeEffectiveness(det.type, myTypes, gen);
      eff = overrideEffForAbilities({
        moveType: det.type,
        defenderAbilities: myAbilityKeys,
        eff,
      });

      const score = eff * (det.power ?? 60);

      rows.push({
        moveKey: key,
        deName: det.deName || cap(key),
        type: det.type,
        eff,
        power: det.power,
        pp: det.pp,
        accuracy: det.accuracy,
        dc: det.damage_class,
        score,
      });
    }

    rows.sort((a, b) => b.score - a.score);
    return rows.slice(0, 60);
  }, [enemyAllowedMoves?.join("|"), myTypes?.join("|"), myAbilityKeys.join("|"), tick, gen]);

  const enemyHasVeryEffectiveVsMe = useMemo(() => {
    return enemyAllMoves.some((m) => m.eff >= 2);
  }, [enemyAllMoves]);

  const enemyDefBuckets = useMemo(() => {
    if (!enemyTypes?.length) return null;
    return buildDefBuckets(enemyTypes, gen);
  }, [enemyTypes?.join("|"), gen]);

  function slotHasVeryEffectiveMoveVsEnemy(slot) {
    if (!enemyTypes?.length) return false;
    const moves = (slot?.moves || []).filter(Boolean);
    for (const mv of moves) {
      const det = moveCacheRef.current.get(String(mv).toLowerCase());
      if (!det?.type) continue;
      const isDamaging = det.damage_class === "physical" || det.damage_class === "special" || det.power != null;
      if (!isDamaging) continue;

      let eff = typeEffectiveness(det.type, enemyTypes, gen);
      eff = overrideEffForAbilities({
        moveType: det.type,
        defenderAbilities: enemyAbilityKeys,
        eff,
      });

      if (eff >= 2) return true;
    }
    return false;
  }

  function enemyHasVeryEffectiveMoveVsTypes(defTypes) {
    if (!defTypes?.length || !enemyAllowedMoves?.length) return false;
    for (const mv of enemyAllowedMoves.slice(0, 900)) {
      const det = moveCacheRef.current.get(String(mv).toLowerCase());
      if (!det) {
        loadMove(String(mv).toLowerCase()).catch(() => {});
        continue;
      }
      const isDamaging = det.damage_class === "physical" || det.damage_class === "special" || det.power != null;
      if (!isDamaging) continue;

      let eff = typeEffectiveness(det.type, defTypes, gen);
      eff = overrideEffForAbilities({
        moveType: det.type,
        defenderAbilities: [],
        eff,
      });

      if (eff >= 2) return true;
    }
    return false;
  }

  /* =========================
     Shortcuts (do NOT trigger while typing)
  ========================= */
  useEffect(() => {
    function onKeyDown(e) {
      const el = document.activeElement;
      if (isTypingTarget(el)) return;

      const k = String(e.key || "").toLowerCase();
      if (editOpen) {
        if (k === "c" || k === "escape") {
          e.preventDefault();
          setEditOpen(false);
        }
        return;
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [editOpen]);

  /* =========================
     Styles
  ========================= */
  const pageStyle = {
    minHeight: "100vh",
    position: "relative",
    overflow: "hidden",
    color: "#e9e9f2",
  };
  const shell = { maxWidth: 1220, margin: "0 auto", padding: "14px 14px 40px" };
  const card = {
    background: "rgba(10, 12, 16, 0.72)",
    border: "1px solid rgba(255,255,255,0.10)",
    borderRadius: 18,
    boxShadow: "0 12px 30px rgba(0,0,0,0.35)",
    overflow: "hidden",
  };
  const headerRow = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 10,
  };
  const input = {
    width: "100%",
    background: "rgba(0,0,0,0.26)",
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: 12,
    color: "#fff",
    padding: "10px 12px",
    outline: "none",
  };
  const btn = {
    background: "rgba(255,255,255,0.10)",
    border: "1px solid rgba(255,255,255,0.14)",
    color: "#fff",
    borderRadius: 12,
    padding: "10px 12px",
    cursor: "pointer",
    userSelect: "none",
    fontWeight: 950,
    textDecoration: "none",
  };

  const genItems = useMemo(() => [1, 2, 3, 4, 5, 6, 7, 8, 9].map((g) => ({ value: g, label: `Gen ${g}` })), []);
  const myFormItems = useMemo(() => myFormList.map((f) => ({ value: f.id, label: f.label })), [myFormList]);
  const enemyFormItems = useMemo(() => enemyFormList.map((f) => ({ value: f.id, label: f.label })), [enemyFormList]);

  const showRedBanner = enemyHasVeryEffectiveVsMe;
  const showGreenBanner = myMoveAdvice.hasVeryEffective;

  const speedLine = useMemo(() => {
    if (!myStats?.spe || !enemyStats?.spe) return null;
    const a = Number(myStats.spe);
    const b = Number(enemyStats.spe);
    if (a === b) return { text: `Gleich schnell (${a} vs ${b})`, kind: "neutral" };
    if (a > b) return { text: `Du bist schneller (${a} vs ${b})`, kind: "good" };
    return { text: `Er ist schneller (${b} vs ${a})`, kind: "bad" };
  }, [myStats?.spe, enemyStats?.spe]);

  const speedPillStyle = useMemo(() => {
    if (!speedLine) return null;
    if (speedLine.kind === "good") {
      return { border: "1px solid rgba(90,255,170,0.38)", background: "rgba(90,255,170,0.12)" };
    }
    if (speedLine.kind === "bad") {
      return { border: "1px solid rgba(255,120,120,0.40)", background: "rgba(255,120,120,0.14)" };
    }
    return { border: "1px solid rgba(255,255,255,0.14)", background: "rgba(255,255,255,0.06)" };
  }, [speedLine]);

  const showLevitateWarning = useMemo(() => {
    if (!enemyHasLevitate) return false;
    for (const mv of (mySlot.moves || []).filter(Boolean)) {
      const det = moveCacheRef.current.get(String(mv).toLowerCase());
      if (!det?.type) continue;
      const isDamaging = det.damage_class === "physical" || det.damage_class === "special" || det.power != null;
      if (!isDamaging) continue;
      if (String(det.type).toLowerCase() === "ground") return true;
    }
    return false;
  }, [enemyHasLevitate, mySlot.moves?.join("|"), tick]);

  return (
    <div style={pageStyle}>
      {/* Background Layer 1: füllt den Screen (keine Balken), blurred */}
      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 0,
          backgroundImage: `url(${dexBg})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
          filter: "blur(18px)",
          transform: "scale(1.06)",
          opacity: 0.55,
          pointerEvents: "none",
        }}
      />

      {/* Background Layer 2: das eigentliche Bild komplett sichtbar */}
      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 1,
          backgroundImage: `url(${dexBg})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
          pointerEvents: "none",
        }}
      />

      {/* leichtes Darkening für bessere Lesbarkeit */}
      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 2,
          background: "rgba(0,0,0,0.35)",
          pointerEvents: "none",
        }}
      />

      {/* Content */}
      <div style={{ position: "relative", zIndex: 3 }}>
        <style>{HIDE_SCROLL_CSS}</style>

        <div style={shell}>
          <div style={headerRow}>
            <div>
              <div style={{ fontSize: 22, fontWeight: 1100, letterSpacing: 0.2 }}>Team Compare</div>
              <div style={{ opacity: 0.78, fontSize: 13, marginTop: 4 }}>
                Gen <b>{gen}</b> • Move-Filter: <b>Level-Up + TM</b> • Version-Group: <b>{versionGroup}</b>
              </div>
            </div>

            <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" }}>
              <div style={{ width: 140 }}>
                <DarkPicker title={null} value={gen} onChange={(v) => setGen(clamp(Number(v), 1, 9))} items={genItems} search={false} />
              </div>

              <button style={btn} onClick={() => navigate(location.state?.from || -1)}>
                Zurück
              </button>

              <button
                style={btn}
                onClick={() => {
                  const fresh = new Array(6).fill(0).map((_, i) => makeEmptySlot(i));
                  setTeam(fresh);
                  setActiveSlot(0);
                  setEnemyDexId(null);
                  setEnemyLevel(50);
                }}
              >
                Reset
              </button>
            </div>
          </div>

          {(showRedBanner || showGreenBanner) && (
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
              {showRedBanner ? (
                <div
                  style={{
                    padding: "8px 10px",
                    borderRadius: 14,
                    border: "1px solid rgba(255,120,120,0.40)",
                    background: "rgba(255,120,120,0.14)",
                    fontWeight: 950,
                    fontSize: 13,
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  Achtung: Gegner hat sehr effektive Attacken gegen dich
                </div>
              ) : null}

              {showGreenBanner ? (
                <div
                  style={{
                    padding: "8px 10px",
                    borderRadius: 14,
                    border: "1px solid rgba(90,255,170,0.38)",
                    background: "rgba(90,255,170,0.12)",
                    fontWeight: 950,
                    fontSize: 13,
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  Hinweis: Du hast sehr effektive Attacken gegen den Gegner
                </div>
              ) : null}
            </div>
          )}

          {/* TOP: Team-Leiste */}
          <div style={{ ...card, padding: 12, marginBottom: 12 }}>
            <div style={{ fontWeight: 1000, marginBottom: 10 }}>Dein Team</div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 10 }}>
              {team.map((s, idx) => {
                const active = idx === activeSlot;
                const spr = spriteForDexId(s.dexId);
                const name = displayNameForDexId(s.dexId);

                let greenGlow = false;
                if (enemyDexId && s.dexId) {
                  const slotData = pokeCacheRef.current.get(Number(s.dexId));
                  const slotTypes = extractTypesForGen(slotData?.pokemon, gen);
                  const iAmVE = slotHasVeryEffectiveMoveVsEnemy(s);
                  const heIsVE = enemyHasVeryEffectiveMoveVsTypes(slotTypes);
                  greenGlow = iAmVE && !heIsVE;
                }

                const chip = {
                  width: "100%",
                  textAlign: "left",
                  padding: 10,
                  borderRadius: 16,
                  border: active
                    ? "1px solid rgba(120,170,255,0.42)"
                    : greenGlow
                    ? "1px solid rgba(90,255,170,0.55)"
                    : "1px solid rgba(255,255,255,0.12)",
                  background: active ? "rgba(120,170,255,0.14)" : greenGlow ? "rgba(90,255,170,0.10)" : "rgba(255,255,255,0.06)",
                  color: "#fff",
                  cursor: "pointer",
                  display: "grid",
                  gridTemplateRows: "auto auto",
                  gap: 8,
                  alignItems: "stretch",
                  boxShadow: greenGlow ? "0 0 0 3px rgba(90,255,170,0.10), 0 16px 36px rgba(0,0,0,0.35)" : undefined,
                  textDecoration: "none",
                };

                return (
                  <button key={s.id} style={chip} onClick={() => setActiveSlot(idx)}>
                    <div style={{ fontWeight: 1200, fontSize: 13, lineHeight: 1.1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {name}
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "44px 1fr auto", gap: 10, alignItems: "center" }}>
                      <div
                        style={{
                          width: 44,
                          height: 44,
                          borderRadius: 14,
                          border: "1px solid rgba(255,255,255,0.12)",
                          background: "rgba(0,0,0,0.28)",
                          display: "grid",
                          placeItems: "center",
                          overflow: "hidden",
                          flex: "0 0 auto",
                        }}
                      >
                        {spr ? <img src={spr} alt="" style={{ width: 44, height: 44, objectFit: "contain" }} /> : <div style={{ opacity: 0.55, fontWeight: 900 }}>—</div>}
                      </div>

                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 12, opacity: 0.85 }}>Lvl {s.level || 50}</div>
                      </div>

                      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <IconBtn
                          title="Bearbeiten"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setActiveSlot(idx);
                            setEditQuery("");
                            setEditOpen(true);
                          }}
                        >
                          ✎
                        </IconBtn>

                        <IconBtn
                          title="Entfernen"
                          danger
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            clearSlot(idx);
                            if (idx === activeSlot) setEditOpen(false);
                          }}
                        >
                          X
                        </IconBtn>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* MAIN */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1.15fr", gap: 12 }}>
            {/* ME */}
            <div style={card}>
              <div
                style={{
                  padding: 12,
                  borderBottom: "1px solid rgba(255,255,255,0.10)",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 12,
                }}
              >
                <div style={{ fontWeight: 1100 }}>Dein aktuelles Pokémon</div>
                <button
                  style={{ ...btn, padding: "8px 10px" }}
                  onClick={() => {
                    setEditQuery("");
                    setEditOpen(true);
                  }}
                >
                  Bearbeiten
                </button>
              </div>

              <div style={{ padding: 12 }}>
                {!mySlot.dexId ? (
                  <div style={{ opacity: 0.75 }}>Wähle oben ein Pokémon (Bearbeiten).</div>
                ) : (
                  <>
                    <div style={{ display: "grid", gridTemplateColumns: "112px 1fr", gap: 12, alignItems: "start" }}>
                      <div
                        style={{
                          borderRadius: 18,
                          background: "linear-gradient(180deg, rgba(120,170,255,0.14), rgba(255,120,220,0.08))",
                          border: "1px solid rgba(255,255,255,0.12)",
                          display: "grid",
                          placeItems: "center",
                          padding: 10,
                          minHeight: 112,
                          overflow: "hidden",
                        }}
                      >
                        {myLoading ? <div style={{ opacity: 0.75 }}>Lädt…</div> : myImg ? <img src={myImg} alt="" style={{ width: 92, height: 92, objectFit: "contain" }} /> : null}
                      </div>

                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 1200, fontSize: 18, lineHeight: 1.15, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {myData?.displayDeName || displayNameForDexId(mySlot.dexId)} <span style={{ opacity: 0.75, fontSize: 13 }}>• Level {mySlot.level || 50}</span>
                        </div>

                        <div style={{ marginTop: 8 }}>
                          {myTypes.map((t) => (
                            <TypePill key={t} t={t} compact />
                          ))}
                        </div>

                        {myAbilities.length ? (
                          <div
                            style={{
                              marginTop: 10,
                              padding: 10,
                              borderRadius: 14,
                              border: "1px solid rgba(255,255,255,0.12)",
                              background: "rgba(0,0,0,0.18)",
                            }}
                          >
                            <div style={{ fontWeight: 1100, marginBottom: 6 }}>Fähigkeiten</div>
                            <div style={{ display: "grid", gap: 6 }}>
                              {myAbilities.map((a) => (
                                <div key={a.key} style={{ fontSize: 13, lineHeight: 1.35 }}>
                                  <b>{a.deName}</b>
                                  {a.shortEffect ? <span style={{ opacity: 0.9 }}> — {a.shortEffect}</span> : <span style={{ opacity: 0.75 }}> — (Keine DE-Beschreibung)</span>}
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : null}

                        {myStats && (
                          <div style={{ marginTop: 10, display: "grid", gap: 7 }}>
                            <StatBar label="KP" value={myStats.hp} compact />
                            <StatBar label="Angriff" value={myStats.atk} compact />
                            <StatBar label="Vert." value={myStats.def} compact />
                            <StatBar label="Sp.-Ang." value={myStats.spa} compact />
                            <StatBar label="Sp.-Vert." value={myStats.spd} compact />
                            <StatBar label="Initiative" value={myStats.spe} compact />
                          </div>
                        )}
                      </div>
                    </div>

                    <div style={{ marginTop: 12 }}>
                      <div style={{ fontWeight: 1100, marginBottom: 8 }}>Empfehlung gegen Gegner</div>

                      {enemyDexId && speedLine ? (
                        <div
                          style={{
                            padding: "8px 10px",
                            borderRadius: 14,
                            fontWeight: 950,
                            fontSize: 13,
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 8,
                            marginBottom: 10,
                            ...speedPillStyle,
                          }}
                        >
                          Initiative: {speedLine.text}
                        </div>
                      ) : null}

                      {enemyDexId && showLevitateWarning ? (
                        <div
                          style={{
                            padding: "8px 10px",
                            borderRadius: 14,
                            border: "1px solid rgba(255,200,120,0.40)",
                            background: "rgba(255,200,120,0.12)",
                            fontWeight: 950,
                            fontSize: 13,
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 8,
                            marginBottom: 10,
                          }}
                        >
                          Gegner hat<b>Schwebe</b>
                        </div>
                      ) : null}

                      {!enemyDexId ? (
                        <div style={{ opacity: 0.75 }}>Wähle rechts einen Gegner.</div>
                      ) : !myMoveAdvice.list.length ? (
                        <div style={{ opacity: 0.75 }}>Wähle im Bearbeiten-Editor deine 4 Attacken.</div>
                      ) : (
                        <div style={{ display: "grid", gap: 8 }}>
                          {myMoveAdvice.list.slice(0, 6).map((r) => {
                            const badge = moveBadgeStyle(r.eff, r.eff >= 2 || r.eff === 0, "my");
                            const { bg, border, glow } = moveRowBg(r.eff, "my");
                            const catIcon = moveCategoryIconUrl(r.dc);
                            const catLabel = r.dc ? MOVE_CLASS_LABEL_DE[String(r.dc).toLowerCase()] || cap(r.dc) : null;

                            return (
                              <button
                                key={r.moveKey}
                                onClick={() => goToMove(r.moveKey)}
                                style={{
                                  width: "100%",
                                  textAlign: "left",
                                  padding: "10px 12px",
                                  borderRadius: 14,
                                  border,
                                  background: bg,
                                  display: "flex",
                                  justifyContent: "space-between",
                                  gap: 12,
                                  boxShadow: glow,
                                  cursor: "pointer",
                                  color: "#fff",
                                  textDecoration: "none",
                                }}
                                title="Move-Details öffnen"
                              >
                                <div style={{ minWidth: 0 }}>
                                  <div style={{ fontWeight: 1100, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                    {r.deName}{" "}
                                    {r.eff >= 2 ? (
                                      <span style={{ marginLeft: 8, fontSize: 12, opacity: 0.9 }}>SEHR EFFEKTIV</span>
                                    ) : r.eff === 0 ? (
                                      <span style={{ marginLeft: 8, fontSize: 12, opacity: 0.9 }}>IMMUN</span>
                                    ) : null}
                                  </div>
                                  <div
                                    style={{
                                      opacity: 0.9,
                                      fontSize: 12,
                                      display: "flex",
                                      gap: 12,
                                      flexWrap: "wrap",
                                      alignItems: "center",
                                      marginTop: 2,
                                    }}
                                  >
                                    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                                      <img
                                        src={typeIconUrl(r.type)}
                                        alt=""
                                        style={{
                                          width: 16,
                                          height: 16,
                                          borderRadius: 8,
                                          padding: 2,
                                          background: "rgba(0,0,0,0.35)",
                                          border: "1px solid rgba(255,255,255,0.12)",
                                        }}
                                        onError={(e) => {
                                          e.currentTarget.style.display = "none";
                                        }}
                                      />
                                      Typ: {TYPE_LABELS_DE[r.type] || cap(r.type)}
                                    </span>
                                    <span>Stärke: {r.power ?? "—"}</span>
                                    <span>AP: {r.pp ?? "—"}</span>
                                    <span>Genauigkeit: {r.accuracy != null ? `${r.accuracy}%` : "—"}</span>

                                    {r.dc ? (
                                      <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                                        {catIcon ? (
                                          <img
                                            src={catIcon}
                                            alt=""
                                            style={{
                                              width: 16,
                                              height: 16,
                                              imageRendering: "pixelated",
                                              borderRadius: 6,
                                              padding: 1,
                                              background: "rgba(0,0,0,0.35)",
                                              border: "1px solid rgba(255,255,255,0.12)",
                                            }}
                                            onError={(e) => {
                                              e.currentTarget.style.display = "none";
                                            }}
                                          />
                                        ) : null}
                                        Klasse: {catLabel || cap(r.dc)}
                                      </span>
                                    ) : null}
                                  </div>
                                </div>

                                <div style={{ display: "grid", gap: 6, justifyItems: "end" }}>
                                  <div style={badge}>x{r.eff}</div>
                                  <div style={{ opacity: 0.65, fontSize: 12 }}>Effektiv</div>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* ENEMY */}
            <div style={card}>
              <div
                style={{
                  padding: 12,
                  borderBottom: "1px solid rgba(255,255,255,0.10)",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 12,
                }}
              >
                <div style={{ fontWeight: 1100 }}>Gegner</div>
                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <div style={{ opacity: 0.8, fontSize: 13 }}>Level</div>
                  <input
                    style={{ ...input, width: 80, padding: "7px 9px", height: 34 }}
                    type="number"
                    min={1}
                    max={100}
                    value={enemyLevel}
                    onChange={(e) => setEnemyLevel(e.target.value)}
                  />
                </div>
              </div>

              <div style={{ padding: 12 }}>
                <div style={{ fontWeight: 950, opacity: 0.9, marginBottom: 6 }}>Gegner wählen</div>
                <input style={input} value={enemyQuery} onChange={(e) => setEnemyQuery(e.target.value)} placeholder="Name oder Dex-ID…" />
                <SuggestList
                  suggestions={enemySuggestions}
                  onPick={async (s) => {
                    setEnemyDexId(s.dexId);
                    setEnemyQuery("");
                    const list = await buildFormListFromBaseDexId(s.dexId);
                    setEnemyFormList(list);
                  }}
                />

                {!enemyDexId ? (
                  <div style={{ opacity: 0.75, marginTop: 10 }}>Wähle einen Gegner.</div>
                ) : (
                  <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "112px 1fr", gap: 12, alignItems: "start" }}>
                    <div
                      style={{
                        borderRadius: 18,
                        background: "linear-gradient(180deg, rgba(255,180,120,0.14), rgba(120,255,210,0.08))",
                        border: "1px solid rgba(255,255,255,0.12)",
                        display: "grid",
                        placeItems: "center",
                        padding: 10,
                        minHeight: 112,
                        overflow: "hidden",
                      }}
                    >
                      {enemyLoading ? <div style={{ opacity: 0.75 }}>Lädt…</div> : enemyImg ? <img src={enemyImg} alt="" style={{ width: 92, height: 92, objectFit: "contain" }} /> : null}
                    </div>

                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 1200, fontSize: 18, lineHeight: 1.15, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {enemyData?.displayDeName || displayNameForDexId(enemyDexId)} <span style={{ opacity: 0.75, fontSize: 13 }}>• Level {enemyLevel}</span>
                      </div>

                      <div style={{ marginTop: 8 }}>
                        {enemyTypes.map((t) => (
                          <TypePill key={t} t={t} compact />
                        ))}
                      </div>

                      {enemyAbilities.length ? (
                        <div
                          style={{
                            marginTop: 10,
                            padding: 10,
                            borderRadius: 14,
                            border: "1px solid rgba(255,255,255,0.12)",
                            background: "rgba(0,0,0,0.18)",
                          }}
                        >
                          <div style={{ fontWeight: 1100, marginBottom: 6 }}>Fähigkeiten (Gegner)</div>
                          <div style={{ display: "grid", gap: 6 }}>
                            {enemyAbilities.map((a) => (
                              <div key={a.key} style={{ fontSize: 13, lineHeight: 1.35 }}>
                                <b>{a.deName}</b>
                                {a.shortEffect ? <span style={{ opacity: 0.9 }}> — {a.shortEffect}</span> : <span style={{ opacity: 0.75 }}> — (Keine DE-Beschreibung)</span>}
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : null}

                      {enemyFormItems.length > 1 ? (
                        <div style={{ marginTop: 10 }}>
                          <DarkPicker title="Form auswählen" value={enemyDexId} onChange={(v) => setEnemyDexId(Number(v))} items={enemyFormItems} search />
                        </div>
                      ) : null}

                      {enemyStats && (
                        <div style={{ marginTop: 10, display: "grid", gap: 7 }}>
                          <StatBar label="KP" value={enemyStats.hp} compact />
                          <StatBar label="Angriff" value={enemyStats.atk} compact />
                          <StatBar label="Vert." value={enemyStats.def} compact />
                          <StatBar label="Sp.-Ang." value={enemyStats.spa} compact />
                          <StatBar label="Sp.-Vert." value={enemyStats.spd} compact />
                          <StatBar label="Initiative" value={enemyStats.spe} compact />
                        </div>
                      )}

                      {enemyDefBuckets ? (
                        <Collapsible title="Schwächen & Resistenzen" open={enemyWeakOpen} setOpen={setEnemyWeakOpen}>
                          <TypeRow title="4× Schwäche" list={enemyDefBuckets["4x"]} />
                          <TypeRow title="2× Schwäche" list={enemyDefBuckets["2x"]} />
                          <TypeRow title="½× Resist" list={enemyDefBuckets["0.5x"]} />
                          <TypeRow title="¼× Resist" list={enemyDefBuckets["0.25x"]} />
                          <TypeRow title="Immun (0×)" list={enemyDefBuckets["0x"]} />
                        </Collapsible>
                      ) : null}

                      {enemyDexId && mySlot.dexId ? (
                        <div style={{ marginTop: 14 }}>
                          <div style={{ fontWeight: 1100, marginBottom: 8 }}>Gegner-Attacken (Level {enemyLevel})</div>

                          {!enemyAllMoves.length ? (
                            <div style={{ opacity: 0.75, fontSize: 13 }}>(Lädt Moves…)</div>
                          ) : (
                            <div style={{ display: "grid", gap: 8 }}>
                              {enemyAllMoves.map((m) => {
                                const emph = m.eff >= 2 || m.eff === 0;
                                const badge = moveBadgeStyle(m.eff, emph, "enemy");
                                const { bg, border, glow } = moveRowBg(m.eff, "enemy");

                                const catIcon = moveCategoryIconUrl(m.dc);
                                const catLabel = m.dc ? MOVE_CLASS_LABEL_DE[String(m.dc).toLowerCase()] || cap(m.dc) : null;

                                return (
                                  <button
                                    key={m.moveKey}
                                    onClick={() => goToMove(m.moveKey)}
                                    style={{
                                      width: "100%",
                                      textAlign: "left",
                                      padding: "10px 12px",
                                      borderRadius: 14,
                                      border,
                                      background: bg,
                                      display: "flex",
                                      justifyContent: "space-between",
                                      gap: 12,
                                      boxShadow: glow,
                                      cursor: "pointer",
                                      color: "#fff",
                                      textDecoration: "none",
                                    }}
                                    title="Move-Details öffnen"
                                  >
                                    <div style={{ minWidth: 0 }}>
                                      <div style={{ fontWeight: 1100, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                        {m.deName}{" "}
                                        {m.eff >= 2 ? (
                                          <span style={{ marginLeft: 8, fontSize: 12, opacity: 0.9 }}>SEHR EFFEKTIV</span>
                                        ) : m.eff === 0 ? (
                                          <span style={{ marginLeft: 8, fontSize: 12, opacity: 0.9 }}>IMMUN</span>
                                        ) : null}
                                      </div>

                                      <div
                                        style={{
                                          opacity: 0.92,
                                          fontSize: 12,
                                          display: "flex",
                                          gap: 12,
                                          flexWrap: "wrap",
                                          alignItems: "center",
                                          marginTop: 2,
                                        }}
                                      >
                                        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                                          <img
                                            src={typeIconUrl(m.type)}
                                            alt=""
                                            style={{
                                              width: 16,
                                              height: 16,
                                              borderRadius: 8,
                                              padding: 2,
                                              background: "rgba(0,0,0,0.35)",
                                              border: "1px solid rgba(255,255,255,0.12)",
                                            }}
                                            onError={(e) => {
                                              e.currentTarget.style.display = "none";
                                            }}
                                          />
                                          Typ: {TYPE_LABELS_DE[m.type] || cap(m.type)}
                                        </span>

                                        <span>Stärke: {m.power ?? "—"}</span>
                                        <span>AP: {m.pp ?? "—"}</span>
                                        <span>Genauigkeit: {m.accuracy != null ? `${m.accuracy}%` : "—"}</span>

                                        {m.dc ? (
                                          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                                            {catIcon ? (
                                              <img
                                                src={catIcon}
                                                alt=""
                                                style={{
                                                  width: 16,
                                                  height: 16,
                                                  imageRendering: "pixelated",
                                                  borderRadius: 6,
                                                  padding: 1,
                                                  background: "rgba(0,0,0,0.35)",
                                                  border: "1px solid rgba(255,255,255,0.12)",
                                                }}
                                                onError={(e) => {
                                                  e.currentTarget.style.display = "none";
                                                }}
                                              />
                                            ) : null}
                                            Klasse: {catLabel || cap(m.dc)}
                                          </span>
                                        ) : null}
                                      </div>
                                    </div>

                                    <div style={{ display: "grid", gap: 6, justifyItems: "end" }}>
                                      <div style={badge}>x{m.eff}</div>
                                      <div style={{ opacity: 0.65, fontSize: 12 }}>Effektiv</div>
                                    </div>
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      ) : null}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* EDIT MODAL */}
          {editOpen && (
            <div
              style={{
                position: "fixed",
                inset: 0,
                background: "rgba(0,0,0,0.60)",
                backdropFilter: "blur(10px)",
                zIndex: 99999,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: 16,
              }}
              onClick={() => setEditOpen(false)}
            >
              <div
                className="hideScroll"
                style={{
                  width: "min(900px, 96vw)",
                  maxHeight: "92vh",
                  overflow: "auto",
                  borderRadius: 18,
                  border: "1px solid rgba(255,255,255,0.14)",
                  background: "rgba(10,10,16,0.92)",
                  boxShadow: "0 30px 90px rgba(0,0,0,0.65)",
                  padding: 14,
                  color: "#fff",
                  display: "grid",
                  gap: 12,
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                  <div>
                    <div style={{ fontWeight: 1100, fontSize: 18 }}>Slot {activeSlot + 1} bearbeiten</div>
                    <div style={{ opacity: 0.75, fontSize: 13 }}>
                      Wählbar: <b>Level-Up + TM</b> in Gen <b>{gen}</b>
                    </div>
                  </div>
                  <button style={{ ...btn, padding: "8px 10px" }} onClick={() => setEditOpen(false)}>
                    Schließen
                  </button>
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "86px 1fr 110px",
                    gap: 12,
                    alignItems: "center",
                    padding: 12,
                    borderRadius: 16,
                    border: "1px solid rgba(255,255,255,0.12)",
                    background: "rgba(255,255,255,0.06)",
                  }}
                >
                  <div
                    style={{
                      width: 86,
                      height: 86,
                      borderRadius: 18,
                      border: "1px solid rgba(255,255,255,0.12)",
                      background: "rgba(0,0,0,0.32)",
                      display: "grid",
                      placeItems: "center",
                      overflow: "hidden",
                    }}
                  >
                    {myImg ? <img src={myImg} alt="" style={{ width: 78, height: 78, objectFit: "contain" }} /> : <div style={{ opacity: 0.6, fontWeight: 900 }}>—</div>}
                  </div>

                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 1200, fontSize: 18, lineHeight: 1.15, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {myData?.displayDeName || displayNameForDexId(mySlot.dexId)}
                    </div>
                    <div style={{ marginTop: 6 }}>
                      {(myTypes || []).map((t) => (
                        <TypePill key={t} t={t} compact />
                      ))}
                    </div>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
                    <div style={{ opacity: 0.85, fontSize: 13, marginBottom: 6 }}>Level</div>
                    <input
                      style={{
                        ...input,
                        width: 72,
                        padding: "8px 10px",
                        height: 36,
                        textAlign: "center",
                      }}
                      type="number"
                      min={1}
                      max={100}
                      value={mySlot.level ?? 50}
                      onChange={(e) => setSlotLevel(activeSlot, e.target.value)}
                    />
                  </div>
                </div>

                {myStats ? (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                    <StatBar label="KP" value={myStats.hp} compact />
                    <StatBar label="Angriff" value={myStats.atk} compact />
                    <StatBar label="Vert." value={myStats.def} compact />
                    <StatBar label="Sp.-Ang." value={myStats.spa} compact />
                    <StatBar label="Sp.-Vert." value={myStats.spd} compact />
                    <StatBar label="Initiative" value={myStats.spe} compact />
                  </div>
                ) : null}

                <div>
                  <div style={{ opacity: 0.85, fontSize: 13, marginBottom: 6 }}>Pokémon wählen</div>
                  <input style={input} value={editQuery} onChange={(e) => setEditQuery(e.target.value)} placeholder="Name oder Dex-ID…" />
                  <SuggestList
                    suggestions={editSuggestions}
                    onPick={async (s) => {
                      setEditQuery("");
                      setMyFormList([]);
                      setSlotDex(activeSlot, s.dexId);
                      const list = await buildFormListFromBaseDexId(s.dexId);
                      setMyFormList(list);
                    }}
                  />
                </div>

                {mySlot.dexId && myFormItems.length > 1 ? (
                  <div style={{ display: "grid", gap: 6 }}>
                    <DarkPicker
                      title="Form auswählen (Mega/Gigadynamax/Regional/Spezial)"
                      value={mySlot.dexId}
                      onChange={(v) => setSlotDex(activeSlot, Number(v))}
                      items={myFormItems}
                      search
                    />
                  </div>
                ) : null}

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div style={{ borderRadius: 16, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.06)", padding: 12 }}>
                    <div style={{ fontWeight: 1100, marginBottom: 10 }}>Deine 4 Attacken</div>

                    {!mySlot.dexId ? (
                      <div style={{ opacity: 0.75 }}>Erst Pokémon auswählen.</div>
                    ) : (
                      <div style={{ display: "grid", gap: 12 }}>
                        {[0, 1, 2, 3].map((i) => {
                          const taken = (function pickedMovesSetForSlotInline(slot) {
                            const s = new Set();
                            for (const m of (slot?.moves || []).filter(Boolean)) s.add(String(m).toLowerCase());
                            return s;
                          })(mySlot);

                          return (
                            <MovePicker
                              key={i}
                              label={`Attacke ${i + 1}`}
                              value={mySlot.moves?.[i] || ""}
                              onChange={(val) => setSlotMove(activeSlot, i, val)}
                              allowedMoves={myAllowedMoves}
                              moveCacheRef={moveCacheRef}
                              loadMove={loadMove}
                              enemyTypes={enemyTypes}
                              enemyAbilityKeys={enemyAbilityKeys}
                              myPokemonTitle={myData?.displayDeName || displayNameForDexId(mySlot.dexId)}
                              myPokemonImg={myImg}
                              takenMoves={taken}
                              navigateToMove={goToMove}
                              gen={gen}
                            />
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <div style={{ borderRadius: 16, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.06)", padding: 12 }}>
                    <div style={{ fontWeight: 1100, marginBottom: 10 }}>Schnellaktionen</div>

                    <div style={{ display: "grid", gap: 10 }}>
                      <button
                        style={btn}
                        onClick={() => {
                          clearSlot(activeSlot);
                          setEditOpen(false);
                        }}
                      >
                        Slot entfernen (X)
                      </button>

                      <button
                        style={btn}
                        onClick={() => {
                          writeJSON(TEAM_KEY, team);
                          writeJSON(UI_KEY, { gen, activeSlot, enemyDexId, enemyLevel });
                          setEditOpen(false);
                        }}
                      >
                        Speichern & schließen
                      </button>

                      <div style={{ opacity: 0.75, fontSize: 13, lineHeight: 1.5 }}>
                        Hinweis: Effektivitäts-Badges werden nur bei <b>schadensmachenden</b> Attacken angezeigt. <br />
                        Tipp: Doppel-Klick auf ein Move-Feld öffnet <b>/move/…</b>.
                      </div>
                    </div>
                  </div>
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                  <button style={btn} onClick={() => writeJSON(TEAM_KEY, team)}>
                    Team speichern
                  </button>
                  <button style={btn} onClick={() => writeJSON(UI_KEY, { gen, activeSlot, enemyDexId, enemyLevel })}>
                    UI speichern
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}