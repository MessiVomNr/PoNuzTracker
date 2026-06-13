// src/pages/PokemonCompare.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { pokedex as fullPokedex } from "../data/pokedex.js";
import dexBg from "../assets/DexBackground.png";

/* =========================================================
   Helpers
========================================================= */
function cap(s) {
  return String(s || "")
    .replace(/-/g, " ")
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

function getDexIdFromKey(key) {
  const m = String(key || "").match(/pokedex(\d+)/i);
  return m ? Number(m[1]) : null;
}

function normText(s) {
  return String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

function officialArtworkUrl(dexId) {
  const id = Number(dexId);
  if (!Number.isFinite(id) || id <= 0) return "";
  return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${id}.png`;
}

/* =========================================================
   Types (DE) + Colors + Icons
========================================================= */
const TYPE_DE = {
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

const TYPE_COLORS = {
  normal: { bg: "rgba(168,168,120,0.18)", bd: "rgba(168,168,120,0.45)" },
  fire: { bg: "rgba(240,128,48,0.18)", bd: "rgba(240,128,48,0.45)" },
  water: { bg: "rgba(104,144,240,0.18)", bd: "rgba(104,144,240,0.45)" },
  electric: { bg: "rgba(248,208,48,0.18)", bd: "rgba(248,208,48,0.45)" },
  grass: { bg: "rgba(120,200,80,0.18)", bd: "rgba(120,200,80,0.45)" },
  ice: { bg: "rgba(152,216,216,0.18)", bd: "rgba(152,216,216,0.45)" },
  fighting: { bg: "rgba(192,48,40,0.18)", bd: "rgba(192,48,40,0.45)" },
  poison: { bg: "rgba(160,64,160,0.18)", bd: "rgba(160,64,160,0.45)" },
  ground: { bg: "rgba(224,192,104,0.18)", bd: "rgba(224,192,104,0.45)" },
  flying: { bg: "rgba(168,144,240,0.18)", bd: "rgba(168,144,240,0.45)" },
  psychic: { bg: "rgba(248,88,136,0.18)", bd: "rgba(248,88,136,0.45)" },
  bug: { bg: "rgba(168,184,32,0.18)", bd: "rgba(168,184,32,0.45)" },
  rock: { bg: "rgba(184,160,56,0.18)", bd: "rgba(184,160,56,0.45)" },
  ghost: { bg: "rgba(112,88,152,0.18)", bd: "rgba(112,88,152,0.45)" },
  dragon: { bg: "rgba(112,56,248,0.18)", bd: "rgba(112,56,248,0.45)" },
  dark: { bg: "rgba(112,88,72,0.18)", bd: "rgba(112,88,72,0.45)" },
  steel: { bg: "rgba(184,184,208,0.18)", bd: "rgba(184,184,208,0.45)" },
  fairy: { bg: "rgba(238,153,172,0.18)", bd: "rgba(238,153,172,0.45)" },
};

function typeColor(typeEn) {
  const t = String(typeEn || "").toLowerCase();
  return TYPE_COLORS[t] || { bg: "rgba(255,255,255,0.10)", bd: "rgba(255,255,255,0.22)" };
}

function typeIconUrl(typeEn) {
  const t = String(typeEn || "").toLowerCase();
  return `https://raw.githubusercontent.com/duiker101/pokemon-type-svg-icons/master/icons/${t}.svg`;
}

/* =========================================================
   Type chart (multipliers)
========================================================= */
const TYPE_CHART = {
  normal: { rock: 0.5, ghost: 0, steel: 0.5 },
  fire: { fire: 0.5, water: 0.5, grass: 2, ice: 2, bug: 2, rock: 0.5, dragon: 0.5, steel: 2 },
  water: { fire: 2, water: 0.5, grass: 0.5, ground: 2, rock: 2, dragon: 0.5 },
  electric: { water: 2, electric: 0.5, grass: 0.5, ground: 0, flying: 2, dragon: 0.5 },
  grass: { fire: 0.5, water: 2, grass: 0.5, poison: 0.5, ground: 2, flying: 0.5, bug: 0.5, rock: 2, dragon: 0.5, steel: 0.5 },
  ice: { fire: 0.5, water: 0.5, grass: 2, ice: 0.5, ground: 2, flying: 2, dragon: 2, steel: 0.5 },
  fighting: { normal: 2, ice: 2, rock: 2, dark: 2, steel: 2, poison: 0.5, flying: 0.5, psychic: 0.5, bug: 0.5, fairy: 0.5, ghost: 0 },
  poison: { grass: 2, fairy: 2, poison: 0.5, ground: 0.5, rock: 0.5, ghost: 0.5, steel: 0 },
  ground: { fire: 2, electric: 2, grass: 0.5, poison: 2, flying: 0, bug: 0.5, rock: 2, steel: 2 },
  flying: { electric: 0.5, grass: 2, fighting: 2, bug: 2, rock: 0.5, steel: 0.5 },
  psychic: { fighting: 2, poison: 2, psychic: 0.5, steel: 0.5, dark: 0 },
  bug: { fire: 0.5, grass: 2, fighting: 0.5, poison: 0.5, flying: 0.5, psychic: 2, ghost: 0.5, dark: 2, steel: 0.5, fairy: 0.5 },
  rock: { fire: 2, ice: 2, fighting: 0.5, ground: 0.5, flying: 2, bug: 2, steel: 0.5 },
  ghost: { normal: 0, psychic: 2, ghost: 2, dark: 0.5 },
  dragon: { dragon: 2, steel: 0.5, fairy: 0 },
  dark: { fighting: 0.5, psychic: 2, ghost: 2, dark: 0.5, fairy: 0.5 },
  steel: { fire: 0.5, water: 0.5, electric: 0.5, ice: 2, rock: 2, fairy: 2, steel: 0.5 },
  fairy: { fire: 0.5, fighting: 2, poison: 0.5, dragon: 2, dark: 2, steel: 0.5 },
};

function typeMultiplier(moveType, defenderTypes) {
  const atk = String(moveType || "").toLowerCase();
  const defs = Array.isArray(defenderTypes) ? defenderTypes : [];
  let mult = 1;
  for (const d of defs) {
    const def = String(d || "").toLowerCase();
    const m = TYPE_CHART?.[atk]?.[def];
    if (m == null) continue;
    mult *= m;
  }
  return mult;
}

/* =========================================================
   Gen -> version groups (for Level-Up moves)
========================================================= */
const VERSION_GROUPS_BY_GEN = {
  1: ["red-blue", "yellow"],
  2: ["gold-silver", "crystal"],
  3: ["ruby-sapphire", "emerald", "firered-leafgreen"],
  4: ["diamond-pearl", "platinum", "heartgold-soulsilver"],
  5: ["black-white", "black-2-white-2"],
  6: ["x-y", "omega-ruby-alpha-sapphire"],
  7: ["sun-moon", "ultra-sun-ultra-moon"],
  8: ["sword-shield"],
  9: ["scarlet-violet"],
};

/* =========================================================
   PokeAPI
========================================================= */
async function fetchPokemonFull(id) {
  const res = await fetch(`https://pokeapi.co/api/v2/pokemon/${id}`);
  if (!res.ok) throw new Error("PokeAPI Fehler");
  const p = await res.json();

  const types = (p?.types || [])
    .map((x) => String(x?.type?.name || "").trim())
    .filter(Boolean);

  const statsArr = Array.isArray(p?.stats) ? p.stats : [];
  const stat = (key) => {
    const hit = statsArr.find((s) => s?.stat?.name === key);
    return hit?.base_stat ?? null;
  };

  const hp = stat("hp");
  const atk = stat("attack");
  const def = stat("defense");
  const spa = stat("special-attack");
  const spd = stat("special-defense");
  const spe = stat("speed");
  const bst = [hp, atk, def, spa, spd, spe].reduce((a, b) => a + (Number(b) || 0), 0);

  const movesRaw = Array.isArray(p?.moves) ? p.moves : [];

  return {
    id: Number(id),
    types,
    baseStats: { hp, atk, def, spa, spd, spe, total: bst },
    movesRaw,
  };
}

async function fetchMoveMeta(moveName) {
  const res = await fetch(`https://pokeapi.co/api/v2/move/${moveName}`);
  if (!res.ok) throw new Error("Move meta Fehler");
  const m = await res.json();

  const type = String(m?.type?.name || "").trim();
  const power = m?.power ?? null;
  const damageClass = String(m?.damage_class?.name || "").trim();
  const genName = String(m?.generation?.name || "").trim();
  let gen = null;
  const mm = genName.match(/generation-([ivx]+)/i);
  if (mm) {
    const roman = mm[1].toLowerCase();
    const map = { i: 1, ii: 2, iii: 3, iv: 4, v: 5, vi: 6, vii: 7, viii: 8, ix: 9 };
    gen = map[roman] ?? null;
  }

  let nameDe = null;
  const names = Array.isArray(m?.names) ? m.names : [];
  const de = names.find((n) => n?.language?.name === "de");
  if (de?.name) nameDe = de.name;

  return {
    name: moveName,
    nameDe,
    type,
    power,
    damageClass,
    gen,
  };
}

/* =========================================================
   Level stat calc (simple, no IV/EV/Nature)
========================================================= */
function calcLevelStats(baseStats, level) {
  const L = clamp(Number(level) || 1, 1, 100);

  const hp = Number(baseStats?.hp) || 1;
  const atk = Number(baseStats?.atk) || 1;
  const def = Number(baseStats?.def) || 1;
  const spa = Number(baseStats?.spa) || 1;
  const spd = Number(baseStats?.spd) || 1;
  const spe = Number(baseStats?.spe) || 1;

  const HP = Math.floor((2 * hp * L) / 100) + L + 10;
  const other = (b) => Math.floor((2 * b * L) / 100) + 5;

  const ATK = other(atk);
  const DEF = other(def);
  const SPA = other(spa);
  const SPD = other(spd);
  const SPE = other(spe);
  const total = HP + ATK + DEF + SPA + SPD + SPE;

  return { hp: HP, atk: ATK, def: DEF, spa: SPA, spd: SPD, spe: SPE, total };
}

/* =========================================================
   Colored bars (simple gradient stops)
========================================================= */
function hexToRgb(h) {
  const x = String(h).replace("#", "").trim();
  const full = x.length === 3 ? x.split("").map((c) => c + c).join("") : x;
  const n = parseInt(full, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}
function lerp(a, b, t) {
  return a + (b - a) * t;
}
function mix(c1, c2, t) {
  const A = hexToRgb(c1);
  const B = hexToRgb(c2);
  const r = Math.round(lerp(A.r, B.r, t));
  const g = Math.round(lerp(A.g, B.g, t));
  const b = Math.round(lerp(A.b, B.b, t));
  return `rgb(${r},${g},${b})`;
}
function colorFromStops(value, stops) {
  const v = Number(value) || 0;
  if (!stops?.length) return "rgba(255,255,255,0.35)";
  if (v <= stops[0].v) return stops[0].c;
  for (let i = 0; i < stops.length - 1; i++) {
    const a = stops[i];
    const b = stops[i + 1];
    if (v >= a.v && v <= b.v) {
      const t = (v - a.v) / Math.max(1e-9, b.v - a.v);
      return mix(a.c, b.c, t);
    }
  }
  return stops[stops.length - 1].c;
}

const STAT_STOPS = [
  { v: 0, c: "#d34a4a" },
  { v: 40, c: "#e07b39" },
  { v: 60, c: "#e6c14a" },
  { v: 100, c: "#58c46a" },
  { v: 120, c: "#2faa57" },
  { v: 150, c: "#4aa3ff" },
];

const BST_STOPS = [
  { v: 0, c: "#d34a4a" },
  { v: 250, c: "#e07b39" },
  { v: 350, c: "#e6c14a" },
  { v: 450, c: "#58c46a" },
  { v: 520, c: "#2faa57" },
  { v: 600, c: "#4aa3ff" },
];

/* =========================================================
   UI bits
========================================================= */
function TypePills({ types, compact = false }) {
  if (!types?.length) return null;

  return (
    <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: compact ? 8 : 10 }}>
      {types.map((t) => {
        const c = typeColor(t);
        return (
          <div
            key={t}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: compact ? "5px 10px" : "6px 12px",
              borderRadius: 999,
              border: `1px solid ${c.bd}`,
              background: c.bg,
              fontWeight: 950,
              fontSize: 12,
              lineHeight: 1,
              minWidth: 0,
              maxWidth: "100%",
            }}
            title={TYPE_DE[t] || cap(t)}
          >
            <span
              style={{
                width: 22,
                height: 22,
                borderRadius: 999,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                border: `1px solid ${c.bd}`,
                background: "rgba(0,0,0,0.12)",
                flex: "0 0 auto",
              }}
            >
              <img
                src={typeIconUrl(t)}
                alt={t}
                style={{ width: 14, height: 14, objectFit: "contain" }}
                onError={(e) => (e.currentTarget.style.display = "none")}
              />
            </span>
            <span style={{ opacity: 0.96, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {TYPE_DE[t] || cap(t)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function StatMini({ label, value, max = 180, isTotal = false }) {
  const v = Number(value);
  const safe = Number.isFinite(v) ? v : 0;
  const w = Math.round((safe / Math.max(1, max)) * 100);
  const col = colorFromStops(safe, isTotal ? BST_STOPS : STAT_STOPS);

  return (
    <div style={{ display: "grid", gridTemplateColumns: "58px 1fr 44px", gap: 8, alignItems: "center" }}>
      <div style={{ opacity: 0.78, fontWeight: 950, fontSize: 12 }}>{label}</div>
      <div style={{ height: 8, borderRadius: 999, background: "rgba(255,255,255,0.10)", overflow: "hidden" }}>
        <div style={{ width: `${clamp(w, 0, 100)}%`, height: "100%", borderRadius: 999, background: col }} />
      </div>
      <div style={{ textAlign: "right", fontWeight: 950, opacity: 0.95, fontSize: 12 }}>{Number.isFinite(v) ? v : "-"}</div>
    </div>
  );
}

function MultBadge({ mult }) {
  const m = Number(mult) || 1;
  if (m <= 1) return null;
  const txt = m === 4 ? "x4" : m === 2 ? "x2" : `x${m}`;
  return (
    <span
      style={{
        fontSize: 11,
        fontWeight: 1000,
        padding: "2px 8px",
        borderRadius: 999,
        border: "1px solid rgba(255,255,255,0.18)",
        background: "rgba(255,255,255,0.10)",
      }}
    >
      {txt}
    </span>
  );
}

/* =========================================================
   Page
========================================================= */
export default function PokemonCompare() {
  const nav = useNavigate();
  const { leftId } = useParams();

  const leftDexFromRoute = Number(leftId);
  const [leftDex, setLeftDex] = useState(Number.isFinite(leftDexFromRoute) && leftDexFromRoute > 0 ? leftDexFromRoute : 1);
  const [rightDex, setRightDex] = useState(null);

  const [gen, setGen] = useState(6);

  // level inputs (default 50) but: stats show BaseStats until edited
  const [leftLevel, setLeftLevel] = useState("50");
  const [rightLevel, setRightLevel] = useState("50");
  const [leftLevelEdited, setLeftLevelEdited] = useState(false);
  const [rightLevelEdited, setRightLevelEdited] = useState(false);

  const L = clamp(parseInt(leftLevel || "50", 10) || 50, 1, 100);
  const R = clamp(parseInt(rightLevel || "50", 10) || 50, 1, 100);

  const [leftQuery, setLeftQuery] = useState("");
  const [rightQuery, setRightQuery] = useState("");

  const dexList = useMemo(() => {
    const entries = Object.entries(fullPokedex || {});
    return entries
      .map(([k, name]) => ({ id: getDexIdFromKey(k), name }))
      .filter((x) => Number.isFinite(x.id))
      .sort((a, b) => a.id - b.id);
  }, []);

  const getNameById = (id) => {
    const hit = dexList.find((x) => x.id === id);
    return hit?.name || `#${id}`;
  };

  const leftName = useMemo(() => (leftDex ? getNameById(leftDex) : ""), [dexList, leftDex]);
  const rightName = useMemo(() => (rightDex ? getNameById(rightDex) : ""), [dexList, rightDex]);

  const leftSuggestions = useMemo(() => {
    const q = normText(leftQuery.trim());
    if (!q) return [];
    return dexList.filter((p) => normText(p.name).includes(q) || String(p.id) === q).slice(0, 10);
  }, [dexList, leftQuery]);

  const rightSuggestions = useMemo(() => {
    const q = normText(rightQuery.trim());
    if (!q) return [];
    return dexList.filter((p) => normText(p.name).includes(q) || String(p.id) === q).slice(0, 10);
  }, [dexList, rightQuery]);

  // ✅ Hide suggestion list if the input exactly equals the currently selected Pokémon (prevents the extra "#4 — Glumanda" row)
  const showLeftSuggestions = useMemo(() => {
    if (!leftSuggestions.length) return false;
    if (!leftDex) return true;
    return normText(leftQuery) !== normText(leftName);
  }, [leftSuggestions.length, leftDex, leftQuery, leftName]);

  const showRightSuggestions = useMemo(() => {
    if (!rightSuggestions.length) return false;
    if (!rightDex) return true;
    return normText(rightQuery) !== normText(rightName);
  }, [rightSuggestions.length, rightDex, rightQuery, rightName]);

  // lock background scroll (but page itself scrolls)
  useEffect(() => {
    const prevHtml = document.documentElement.style.overflow;
    const prevBody = document.body.style.overflow;
    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    return () => {
      document.documentElement.style.overflow = prevHtml;
      document.body.style.overflow = prevBody;
    };
  }, []);

  const [leftData, setLeftData] = useState(null);
  const [rightData, setRightData] = useState(null);
  const [err, setErr] = useState("");

  const moveMetaCacheRef = useRef({});
  const [moveMetaVersion, setMoveMetaVersion] = useState(0);

  async function ensureMoveMeta(moveName) {
    const key = String(moveName || "").trim().toLowerCase();
    if (!key) return null;
    const cache = moveMetaCacheRef.current;
    if (cache[key] !== undefined) return cache[key];
    try {
      const meta = await fetchMoveMeta(key);
      cache[key] = meta;
      setMoveMetaVersion((v) => v + 1);
      return meta;
    } catch {
      cache[key] = null;
      setMoveMetaVersion((v) => v + 1);
      return null;
    }
  }

  useEffect(() => {
    let alive = true;
    setErr("");
    setLeftData(null);
    if (!leftDex || !Number.isFinite(leftDex) || leftDex <= 0) return;

    fetchPokemonFull(leftDex)
      .then((d) => alive && setLeftData(d))
      .catch(() => alive && setErr("Links konnte nicht geladen werden."));
    return () => {
      alive = false;
    };
  }, [leftDex]);

  useEffect(() => {
    let alive = true;
    setErr("");
    setRightData(null);
    if (!rightDex) return;

    fetchPokemonFull(rightDex)
      .then((d) => alive && setRightData(d))
      .catch(() => alive && setErr("Rechts konnte nicht geladen werden."));
    return () => {
      alive = false;
    };
  }, [rightDex]);

  const bothReady = !!(leftData && rightData);

  const leftShownStats = useMemo(() => {
    if (!leftData?.baseStats) return null;
    if (!leftLevelEdited) return leftData.baseStats;
    return calcLevelStats(leftData.baseStats, L);
  }, [leftData, leftLevelEdited, L]);

  const rightShownStats = useMemo(() => {
    if (!rightData?.baseStats) return null;
    if (!rightLevelEdited) return rightData.baseStats;
    return calcLevelStats(rightData.baseStats, R);
  }, [rightData, rightLevelEdited, R]);

  const effectiveness = useMemo(() => {
    if (!bothReady) return null;
    const leftTypes = leftData?.types || [];
    const rightTypes = rightData?.types || [];

    const leftHits = [];
    for (const t of leftTypes) {
      const mult = typeMultiplier(t, rightTypes);
      if (mult > 1) leftHits.push({ type: t, mult });
    }
    const leftDedup = [];
    const seenL = new Set();
    for (const x of leftHits.sort((a, b) => b.mult - a.mult)) {
      if (seenL.has(x.type)) continue;
      seenL.add(x.type);
      leftDedup.push(x);
    }

    const rightHits = [];
    for (const t of rightTypes) {
      const mult = typeMultiplier(t, leftTypes);
      if (mult > 1) rightHits.push({ type: t, mult });
    }
    const rightDedup = [];
    const seenR = new Set();
    for (const x of rightHits.sort((a, b) => b.mult - a.mult)) {
      if (seenR.has(x.type)) continue;
      seenR.add(x.type);
      rightDedup.push(x);
    }

    return {
      leftDedup,
      rightDedup,
      show: leftDedup.length > 0 || rightDedup.length > 0,
    };
  }, [bothReady, leftData, rightData]);

  function extractLevelUpMoves(pokemonData, level, selectedGen) {
    const vg = VERSION_GROUPS_BY_GEN[selectedGen] || VERSION_GROUPS_BY_GEN[6];
    const raw = Array.isArray(pokemonData?.movesRaw) ? pokemonData.movesRaw : [];
    const out = [];

    for (const m of raw) {
      const name = String(m?.move?.name || "").trim().toLowerCase();
      if (!name) continue;

      const vgd = Array.isArray(m?.version_group_details) ? m.version_group_details : [];
      let bestLevel = null;

      for (const d of vgd) {
        const method = String(d?.move_learn_method?.name || "");
        const group = String(d?.version_group?.name || "");
        const lvl = Number(d?.level_learned_at);

        if (method !== "level-up") continue;
        if (!vg.includes(group)) continue;
        if (!Number.isFinite(lvl)) continue;

        if (bestLevel == null || lvl < bestLevel) bestLevel = lvl;
      }

      if (bestLevel == null) continue;
      if (bestLevel > level) continue;

      out.push({ name, level: bestLevel });
    }

    const map = new Map();
    for (const e of out) {
      const prev = map.get(e.name);
      if (!prev || e.level < prev.level) map.set(e.name, e);
    }
    return Array.from(map.values()).sort((a, b) => a.level - b.level);
  }

  const leftLvlMoves = useMemo(() => {
    if (!bothReady) return [];
    return extractLevelUpMoves(leftData, L, gen);
  }, [bothReady, leftData, L, gen]);

  const rightLvlMoves = useMemo(() => {
    if (!bothReady) return [];
    return extractLevelUpMoves(rightData, R, gen);
  }, [bothReady, rightData, R, gen]);

  useEffect(() => {
    let alive = true;
    async function run() {
      if (!bothReady) return;

      const combined = [...leftLvlMoves, ...rightLvlMoves]
        .slice(0, 40)
        .map((x) => x.name);

      for (const n of combined) {
        if (!alive) return;
        await ensureMoveMeta(n);
      }
    }
    run();
    return () => {
      alive = false;
    };
  }, [bothReady, gen, L, R, leftLvlMoves.length, rightLvlMoves.length]);

  function getMoveMeta(name) {
    return moveMetaCacheRef.current[String(name || "").toLowerCase()] || null;
  }

  function onlyDamaging(moveMeta) {
    if (!moveMeta) return false;
    if (String(moveMeta.damageClass || "") === "status") return false;
    if (moveMeta.power == null) return moveMeta.damageClass === "physical" || moveMeta.damageClass === "special";
    return Number(moveMeta.power) > 0;
  }

  function filterMovesForGen(moveMeta, selectedGen) {
    if (!moveMeta) return false;
    const g = Number(moveMeta.gen);
    if (!Number.isFinite(g)) return true;
    return g <= selectedGen;
  }

  function buildDamagingMovesList(sideMoves, attackerTypes, defenderTypes, selectedGen) {
    const out = [];
    for (const e of sideMoves) {
      const meta = getMoveMeta(e.name);
      if (!meta) continue;
      if (!filterMovesForGen(meta, selectedGen)) continue;
      if (!onlyDamaging(meta)) continue;

      const mult = typeMultiplier(meta.type, defenderTypes);
      const stab = attackerTypes.includes(meta.type) ? 1 : 0;

      out.push({ ...e, meta, mult, stab });
    }

    out.sort((a, b) => {
      if (b.mult !== a.mult) return b.mult - a.mult;
      if (a.level !== b.level) return a.level - b.level;
      const ap = Number(a.meta?.power) || 0;
      const bp = Number(b.meta?.power) || 0;
      return bp - ap;
    });

    return out;
  }

  const leftDamagingMoves = useMemo(() => {
    if (!bothReady) return [];
    return buildDamagingMovesList(leftLvlMoves, leftData.types || [], rightData.types || [], gen);
  }, [bothReady, leftLvlMoves, gen, moveMetaVersion, leftData, rightData]);

  const rightDamagingMoves = useMemo(() => {
    if (!bothReady) return [];
    return buildDamagingMovesList(rightLvlMoves, rightData.types || [], leftData.types || [], gen);
  }, [bothReady, rightLvlMoves, gen, moveMetaVersion, leftData, rightData]);

  const leftHasSEMove = useMemo(() => leftDamagingMoves.some((m) => m.mult > 1), [leftDamagingMoves]);
  const rightHasSEMove = useMemo(() => rightDamagingMoves.some((m) => m.mult > 1), [rightDamagingMoves]);

  /* =========================================================
     Styles
  ========================================================= */
  const page = {
    height: "100vh",
    overflow: "hidden",
    padding: 18,
    boxSizing: "border-box",
    color: "var(--pnt-text, white)",
    backgroundImage: `
      radial-gradient(circle at 50% 0%, rgba(52, 211, 153, 0.13), transparent 34%),
      radial-gradient(circle at 0% 25%, rgba(96, 165, 250, 0.12), transparent 38%),
      linear-gradient(180deg, rgba(5, 10, 24, 0.22), rgba(5, 10, 24, 0.78)),
      url(${dexBg})
    `,
    backgroundSize: "cover",
    backgroundPosition: "center",
    backgroundRepeat: "no-repeat",
    backgroundAttachment: "fixed",
  };

  const scrollWrap = {
    height: "calc(100vh - 36px)",
    overflowY: "auto",
    overflowX: "hidden",
    padding: "0 4px 22px",
    boxSizing: "border-box",
  };

  const panel = {
    border: "1px solid var(--pnt-border, rgba(137, 155, 184, 0.28))",
    background:
      "linear-gradient(180deg, rgba(10, 18, 33, 0.94), rgba(6, 12, 24, 0.92))",
    borderRadius: "var(--pnt-radius, 14px)",
    padding: 18,
    boxShadow:
      "var(--pnt-shadow, 0 18px 48px rgba(0, 0, 0, 0.36)), inset 0 1px 0 rgba(255, 255, 255, 0.045)",
    backdropFilter: "blur(10px)",
  };

  const btn = {
    minHeight: 42,
    padding: "0 15px",
    borderRadius: "var(--pnt-radius-small, 8px)",
    border: "1px solid rgba(100, 140, 215, 0.55)",
    background:
      "linear-gradient(180deg, rgba(14, 30, 56, 0.92), rgba(9, 20, 39, 0.92))",
    color: "#f8fafc",
    cursor: "pointer",
    fontWeight: 950,
    whiteSpace: "nowrap",
    boxShadow:
      "inset 0 1px 0 rgba(255, 255, 255, 0.04), 0 10px 24px rgba(0, 0, 0, 0.18)",
    transition:
      "transform 0.15s ease, background 0.15s ease, border-color 0.15s ease",
  };

  const input = {
    width: "100%",
    height: 44,
    boxSizing: "border-box",
    padding: "10px 12px",
    borderRadius: 10,
    border: "1px solid rgba(137, 155, 184, 0.28)",
    background:
      "linear-gradient(180deg, rgba(10, 19, 34, 0.94), rgba(8, 15, 28, 0.94))",
    color: "var(--pnt-text, white)",
    outline: "none",
    fontWeight: 950,
    fontSize: 14,
    lineHeight: "20px",
    boxShadow: "inset 0 1px 0 rgba(255, 255, 255, 0.035)",
  };

  const sideCard = {
    border: "1px solid rgba(137, 155, 184, 0.18)",
    borderRadius: "var(--pnt-radius, 14px)",
    padding: 14,
    background:
      "linear-gradient(180deg, rgba(13, 24, 42, 0.68), rgba(9, 17, 31, 0.66))",
    minWidth: 0,
    boxShadow: "inset 0 1px 0 rgba(255, 255, 255, 0.035)",
  };

  const statsCard = {
    border: "1px solid rgba(137, 155, 184, 0.18)",
    borderRadius: "var(--pnt-radius, 14px)",
    padding: 14,
    background:
      "linear-gradient(180deg, rgba(13, 24, 42, 0.68), rgba(9, 17, 31, 0.66))",
    boxShadow: "inset 0 1px 0 rgba(255, 255, 255, 0.035)",
    minWidth: 0,
  };

  const subTitle = { fontWeight: 1000, marginBottom: 8 };
  const faint = { opacity: 0.78, fontSize: 12 };

  const movePill = (isSE) => ({
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    padding: "9px 10px",
    borderRadius: "var(--pnt-radius-small, 10px)",
    border: isSE
      ? "1px solid rgba(96, 165, 250, 0.34)"
      : "1px solid rgba(137, 155, 184, 0.16)",
    background: isSE
      ? "radial-gradient(circle at 0% 0%, rgba(96, 165, 250, 0.12), transparent 42%), rgba(5, 11, 21, 0.34)"
      : "rgba(5, 11, 21, 0.3)",
    boxShadow: "inset 0 1px 0 rgba(255, 255, 255, 0.03)",
  });

  function renderMoveLine(m, defenderTypes) {
    const meta = m.meta;
    const typeEn = meta?.type;
    const mult = typeMultiplier(typeEn, defenderTypes);
    const isSE = mult > 1;
    const c = typeColor(typeEn);

    return (
      <div key={m.name} style={movePill(isSE)}>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
            <div
              style={{
                fontSize: 11,
                fontWeight: 1000,
                opacity: 0.85,
                border: "1px solid rgba(255,255,255,0.12)",
                padding: "2px 8px",
                borderRadius: 999,
                background: "rgba(255,255,255,0.06)",
                flex: "0 0 auto",
              }}
              title="Level"
            >
              Lv {m.level}
            </div>

            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "4px 10px",
                borderRadius: 999,
                border: `1px solid ${c.bd}`,
                background: c.bg,
                fontWeight: 1000,
                fontSize: 12,
                lineHeight: 1,
                flex: "0 0 auto",
              }}
              title={TYPE_DE[typeEn] || cap(typeEn)}
            >
              <span
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: 999,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  border: `1px solid ${c.bd}`,
                  background: "rgba(0,0,0,0.12)",
                }}
              >
                <img
                  src={typeIconUrl(typeEn)}
                  alt={typeEn}
                  style={{ width: 12, height: 12, objectFit: "contain" }}
                  onError={(e) => (e.currentTarget.style.display = "none")}
                />
              </span>
              <span style={{ opacity: 0.96 }}>{TYPE_DE[typeEn] || cap(typeEn)}</span>
            </div>

            <div
              style={{
                fontWeight: 1000,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
              title={meta?.nameDe || cap(m.name)}
            >
              {meta?.nameDe || cap(m.name)}
            </div>

            {meta?.power != null ? (
              <div style={{ fontSize: 12, opacity: 0.75, fontWeight: 900, flex: "0 0 auto" }}>{meta.power}</div>
            ) : null}
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "center", flex: "0 0 auto" }}>
          {meta?.damageClass && meta.damageClass !== "status" ? (
            <span
              style={{
                fontSize: 11,
                fontWeight: 950,
                padding: "2px 8px",
                borderRadius: 999,
                border: "1px solid rgba(255,255,255,0.14)",
                background: "rgba(255,255,255,0.08)",
                opacity: 0.9,
              }}
              title="Kategorie"
            >
              {meta.damageClass === "physical" ? "phys" : meta.damageClass === "special" ? "spez" : meta.damageClass}
            </span>
          ) : null}
          <MultBadge mult={mult} />
          {m.stab ? (
            <span
              style={{
                fontSize: 11,
                fontWeight: 950,
                padding: "2px 8px",
                borderRadius: 999,
                border: "1px solid rgba(255,255,255,0.14)",
                background: "rgba(255,255,255,0.08)",
                opacity: 0.9,
              }}
              title="STAB"
            >
              STAB
            </span>
          ) : null}
        </div>
      </div>
    );
  }

  function openInfo(id) {
    if (!id) return;
    nav(`/pokemon/${id}`);
  }

  function clearLeft() {
    setLeftDex(null);
    setLeftQuery("");
    setLeftData(null);
    setLeftLevelEdited(false);
  }

  function clearRight() {
    setRightDex(null);
    setRightQuery("");
    setRightData(null);
    setRightLevelEdited(false);
  }

  return (
    <div style={page}>
      <style>{`
        .cmp-scroll {
          scrollbar-width: none;
          -ms-overflow-style: none;
        }

        .cmp-scroll::-webkit-scrollbar {
          width: 0;
          height: 0;
          display: none;
        }

        .cmp-topgrid {
          display: grid;
          grid-template-columns: minmax(180px, 240px) minmax(180px, 1fr) minmax(180px, 1fr);
          gap: 12px;
          align-items: end;
        }

        .cmp-main-grid {
          margin-top: 14px;
          display: grid;
          grid-template-columns: 260px minmax(0, 1fr) minmax(0, 1fr) 260px;
          gap: 12px;
          align-items: start;
        }

        .cmp-moves-grid {
          margin-top: 12px;
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
        }

        .cmp-select {
          appearance: auto;
          cursor: pointer;
          color: var(--pnt-text, #fff);
          background:
            linear-gradient(180deg, rgba(10, 19, 34, 0.94), rgba(8, 15, 28, 0.94)) !important;
          border: 1px solid rgba(137, 155, 184, 0.28) !important;
          border-radius: 10px !important;
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.035);
        }

        .cmp-select:focus,
        .cmp-input:focus {
          outline: none;
          border-color: rgba(96, 165, 250, 0.72) !important;
          box-shadow:
            0 0 0 3px rgba(96, 165, 250, 0.14),
            inset 0 1px 0 rgba(255, 255, 255, 0.035) !important;
        }

        .cmp-select option {
          background: #08111f;
          color: #f8fafc;
          font-weight: 900;
        }

        .cmp-button:hover:not(:disabled),
        .cmp-suggestion-button:hover:not(:disabled) {
          transform: translateY(-1px);
          border-color: rgba(140, 170, 230, 0.68) !important;
          background:
            linear-gradient(180deg, rgba(18, 38, 70, 0.96), rgba(10, 23, 44, 0.96)) !important;
        }

        .cmp-button:disabled {
          opacity: 0.48;
          cursor: not-allowed;
          transform: none;
        }

        .cmp-suggestion-button {
          width: 100%;
        }

        .cmp-card-hover {
          transition:
            transform 0.15s ease,
            border-color 0.15s ease,
            background 0.15s ease;
        }

        .cmp-card-hover:hover {
          transform: translateY(-1px);
          border-color: rgba(160, 178, 210, 0.34) !important;
          background:
            linear-gradient(180deg, rgba(16, 31, 56, 0.82), rgba(10, 22, 42, 0.78)) !important;
        }

        input::placeholder {
          color: rgba(235, 241, 250, 0.46);
        }

        @media (max-width: 1180px) {
          .cmp-main-grid {
            grid-template-columns: 1fr 1fr;
          }
        }

        @media (max-width: 980px) {
          .cmp-topgrid,
          .cmp-moves-grid {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 760px) {
          .cmp-main-grid {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 640px) {
          .cmp-topgrid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>

      <div style={scrollWrap} className="cmp-scroll">
        <div style={{ width: "min(1320px, 96vw)", margin: "0 auto", paddingTop: 12 }}>
          {/* Header */}
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
            <div>
              <h2 style={{ margin: 0, fontWeight: 1100 }}>Pokémon vergleichen</h2>
            </div>

            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <button className="cmp-button" style={btn} onClick={() => nav(-1)}>
                Zurück
              </button>
              <button className="cmp-button" style={btn} onClick={() => nav("/pokedex")}>
                Pokédex
              </button>
              <button className="cmp-button" style={btn} onClick={() => openInfo(leftDex)}>
                Linke Info
              </button>
              <button className="cmp-button" style={btn} onClick={() => openInfo(rightDex)}>
                Rechte Info
              </button>
            </div>
          </div>

          <div style={{ ...panel, marginTop: 12 }}>
            {/* Top controls */}
            <div className="cmp-topgrid">
              <div>
                <div style={{ ...faint, fontWeight: 950, marginBottom: 6 }}>Gen</div>
                <select
                  className="cmp-select"
                  value={gen}
                  onChange={(e) => setGen(clamp(parseInt(e.target.value, 10) || 6, 1, 9))}
                  style={{ ...input, appearance: "auto", cursor: "pointer" }}
                >
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((g) => (
                    <option key={g} value={g}>
                      Gen {g}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <div style={{ ...faint, fontWeight: 950, marginBottom: 6 }}>Level (links)</div>
                <input
                  type="number"
                  min={1}
                  max={100}
                  inputMode="numeric"
                  value={leftLevel}
                  onChange={(e) => {
                    const v = e.target.value.replace(/[^\d]/g, "").slice(0, 3);
                    setLeftLevel(v);
                    setLeftLevelEdited(true);
                  }}
                  placeholder="50"
                  style={input}
                />
              </div>

              <div>
                <div style={{ ...faint, fontWeight: 950, marginBottom: 6 }}>Level (rechts)</div>
                <input
                  type="number"
                  min={1}
                  max={100}
                  inputMode="numeric"
                  value={rightLevel}
                  onChange={(e) => {
                    const v = e.target.value.replace(/[^\d]/g, "").slice(0, 3);
                    setRightLevel(v);
                    setRightLevelEdited(true);
                  }}
                  placeholder="50"
                  style={input}
                />
              </div>
            </div>

            {/* Main: left stats | left card | right card | right stats */}
            <div className="cmp-main-grid">
              {/* Left Stats */}
              <div className="cmp-card-hover" style={statsCard}>
                <div style={subTitle}>
                  {leftLevelEdited ? `Stats (Lv ${L})` : "Basiswerte"}
                  <span style={{ marginLeft: 8, opacity: 0.65, fontSize: 12, fontWeight: 900 }}>
                    {leftLevelEdited ? "vereinfacht" : "National-Dex"}
                  </span>
                </div>

                {leftShownStats ? (
                  <div style={{ display: "grid", gap: 8 }}>
                    <StatMini label="KP" value={leftShownStats.hp} max={leftLevelEdited ? 260 : 160} />
                    <StatMini label="Ang" value={leftShownStats.atk} max={leftLevelEdited ? 200 : 160} />
                    <StatMini label="Vert" value={leftShownStats.def} max={leftLevelEdited ? 200 : 160} />
                    <StatMini label="SpAng" value={leftShownStats.spa} max={leftLevelEdited ? 200 : 160} />
                    <StatMini label="SpVert" value={leftShownStats.spd} max={leftLevelEdited ? 200 : 160} />
                    <StatMini label="Init" value={leftShownStats.spe} max={leftLevelEdited ? 200 : 160} />
                    <div style={{ marginTop: 4 }}>
                      <StatMini label="BST" value={leftShownStats.total} max={leftLevelEdited ? 800 : 720} isTotal />
                    </div>
                  </div>
                ) : (
                  <div style={{ opacity: 0.7, fontSize: 12 }}>—</div>
                )}
              </div>

              {/* Left card */}
              <div style={sideCard}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
                  <div style={{ fontWeight: 1000, opacity: 0.9 }}>Links</div>
                  <button className="cmp-button" style={{ ...btn, minHeight: 38, padding: "0 12px" }} onClick={clearLeft} disabled={!leftDex}>
                    Entfernen
                  </button>
                </div>

                {leftDex ? (
                  <>
                    <div style={{ display: "flex", gap: 12, alignItems: "center", marginTop: 10, minWidth: 0 }}>
                      <img
                        src={officialArtworkUrl(leftDex)}
                        alt={leftName}
                        style={{ width: 92, height: 92, objectFit: "contain", cursor: "pointer" }}
                        onClick={() => openInfo(leftDex)}
                        title="Info öffnen"
                      />
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline" }}>
                          <div
                            style={{
                              fontWeight: 1100,
                              fontSize: 18,
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                            }}
                          >
                            {leftName}
                          </div>
                          <div style={{ opacity: 0.75, fontWeight: 950 }}>#{leftDex}</div>
                        </div>

                        <TypePills types={leftData?.types || []} compact />
                      </div>
                    </div>

                    <div style={{ marginTop: 12 }}>
                      <div style={{ ...faint, fontWeight: 950, marginBottom: 6 }}>Links wechseln</div>
                      <input
                        value={leftQuery}
                        onChange={(e) => setLeftQuery(e.target.value)}
                        placeholder='Suche (z.B. "Glumanda", "Glu", "4")'
                        style={input}
                      />

                      {showLeftSuggestions && (
                        <div style={{ marginTop: 8, display: "grid", gap: 6 }}>
                          {leftSuggestions.map((s) => (
                            <button
                              key={s.id}
                            className="cmp-suggestion-button"
                            style={{ ...btn, minHeight: 38, justifyContent: "flex-start", textAlign: "left", padding: "0 12px" }}
                              onClick={() => {
                                setLeftDex(s.id);
                                setLeftQuery(s.name);
                                setLeftLevelEdited(false);
                              }}
                            >
                              #{s.id} — {s.name}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <div style={{ marginTop: 10 }}>
                    <div style={{ ...faint, fontWeight: 950, marginBottom: 6 }}>Links wählen</div>
                    <input
                      value={leftQuery}
                      onChange={(e) => setLeftQuery(e.target.value)}
                      placeholder='Suche (z.B. "Glumanda", "Glu", "4")'
                      style={input}
                    />
                    {showLeftSuggestions && (
                      <div style={{ marginTop: 8, display: "grid", gap: 6 }}>
                        {leftSuggestions.map((s) => (
                          <button
                            key={s.id}
                            className="cmp-suggestion-button"
                            style={{ ...btn, minHeight: 38, justifyContent: "flex-start", textAlign: "left", padding: "0 12px" }}
                            onClick={() => {
                              setLeftDex(s.id);
                              setLeftQuery(s.name);
                              setLeftLevelEdited(false);
                            }}
                          >
                            #{s.id} — {s.name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Right card */}
              <div style={sideCard}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
                  <div style={{ fontWeight: 1000, opacity: 0.9 }}>Rechts</div>
                  <button className="cmp-button" style={{ ...btn, minHeight: 38, padding: "0 12px" }} onClick={clearRight} disabled={!rightDex}>
                    Entfernen
                  </button>
                </div>

                {rightDex ? (
                  <>
                    <div style={{ display: "flex", gap: 12, alignItems: "center", marginTop: 10, minWidth: 0 }}>
                      <img
                        src={officialArtworkUrl(rightDex)}
                        alt={rightName}
                        style={{ width: 92, height: 92, objectFit: "contain", cursor: "pointer" }}
                        onClick={() => openInfo(rightDex)}
                        title="Info öffnen"
                      />
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline" }}>
                          <div
                            style={{
                              fontWeight: 1100,
                              fontSize: 18,
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                            }}
                          >
                            {rightName}
                          </div>
                          <div style={{ opacity: 0.75, fontWeight: 950 }}>#{rightDex}</div>
                        </div>

                        <TypePills types={rightData?.types || []} compact />
                      </div>
                    </div>

                    <div style={{ marginTop: 12 }}>
                      <div style={{ ...faint, fontWeight: 950, marginBottom: 6 }}>Rechts wechseln</div>
                      <input
                        value={rightQuery}
                        onChange={(e) => setRightQuery(e.target.value)}
                        placeholder='Suche (z.B. "Glumanda", "Glu", "4")'
                        style={input}
                      />

                      {showRightSuggestions && (
                        <div style={{ marginTop: 8, display: "grid", gap: 6 }}>
                          {rightSuggestions.map((s) => (
                            <button
                              key={s.id}
                            className="cmp-suggestion-button"
                            style={{ ...btn, minHeight: 38, justifyContent: "flex-start", textAlign: "left", padding: "0 12px" }}
                              onClick={() => {
                                setRightDex(s.id);
                                setRightQuery(s.name);
                                setRightLevelEdited(false);
                              }}
                            >
                              #{s.id} — {s.name}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <div style={{ marginTop: 10 }}>
                    <div style={{ ...faint, fontWeight: 950, marginBottom: 6 }}>Gegner wählen</div>
                    <input
                      value={rightQuery}
                      onChange={(e) => setRightQuery(e.target.value)}
                      placeholder='Suche (z.B. "Glumanda", "Glu", "4")'
                      style={input}
                    />
                    {showRightSuggestions && (
                      <div style={{ marginTop: 8, display: "grid", gap: 6 }}>
                        {rightSuggestions.map((s) => (
                          <button
                            key={s.id}
                            className="cmp-suggestion-button"
                            style={{ ...btn, minHeight: 38, justifyContent: "flex-start", textAlign: "left", padding: "0 12px" }}
                            onClick={() => {
                              setRightDex(s.id);
                              setRightQuery(s.name);
                              setRightLevelEdited(false);
                            }}
                          >
                            #{s.id} — {s.name}
                          </button>
                        ))}
                      </div>
                    )}
                    <div style={{ marginTop: 10, opacity: 0.7, fontSize: 12 }}>Wähle rechts ein Pokémon aus.</div>
                  </div>
                )}
              </div>

              {/* Right Stats */}
              <div className="cmp-card-hover" style={statsCard}>
                <div style={subTitle}>
                  {rightLevelEdited ? `Stats (Lv ${R})` : "Basiswerte"}
                  <span style={{ marginLeft: 8, opacity: 0.65, fontSize: 12, fontWeight: 900 }}>
                    {rightLevelEdited ? "vereinfacht" : "National-Dex"}
                  </span>
                </div>

                {rightShownStats ? (
                  <div style={{ display: "grid", gap: 8 }}>
                    <StatMini label="KP" value={rightShownStats.hp} max={rightLevelEdited ? 260 : 160} />
                    <StatMini label="Ang" value={rightShownStats.atk} max={rightLevelEdited ? 200 : 160} />
                    <StatMini label="Vert" value={rightShownStats.def} max={rightLevelEdited ? 200 : 160} />
                    <StatMini label="SpAng" value={rightShownStats.spa} max={rightLevelEdited ? 200 : 160} />
                    <StatMini label="SpVert" value={rightShownStats.spd} max={rightLevelEdited ? 200 : 160} />
                    <StatMini label="Init" value={rightShownStats.spe} max={rightLevelEdited ? 200 : 160} />
                    <div style={{ marginTop: 4 }}>
                      <StatMini label="BST" value={rightShownStats.total} max={rightLevelEdited ? 800 : 720} isTotal />
                    </div>
                  </div>
                ) : (
                  <div style={{ opacity: 0.7, fontSize: 12 }}>—</div>
                )}
              </div>
            </div>

            {/* Only show matchup + moves when both Pokémon exist */}
            {bothReady ? (
              <>
                {effectiveness?.show || leftHasSEMove || rightHasSEMove ? (
                  <div
                    style={{
                      marginTop: 12,
                      borderRadius: 14,
                      border: "1px solid rgba(255,255,255,0.12)",
                      background: "rgba(0,0,0,0.20)",
                      padding: 12,
                    }}
                  >
                    <div style={{ fontWeight: 1100, marginBottom: 6 }}>Matchup</div>

                    {effectiveness?.leftDedup?.length ? (
                      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                        <span style={{ fontWeight: 950, opacity: 0.9 }}>Du triffst den Gegner gut mit:</span>
                        {effectiveness.leftDedup.map((x) => {
                          const c = typeColor(x.type);
                          return (
                            <span
                              key={"lh-" + x.type}
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 8,
                                padding: "5px 10px",
                                borderRadius: 999,
                                border: `1px solid ${c.bd}`,
                                background: c.bg,
                                fontWeight: 1000,
                                fontSize: 12,
                              }}
                            >
                              {TYPE_DE[x.type] || cap(x.type)} <span style={{ opacity: 0.9 }}>{x.mult === 4 ? "x4" : "x2"}</span>
                            </span>
                          );
                        })}
                      </div>
                    ) : null}

                    {effectiveness?.rightDedup?.length ? (
                      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginTop: 8 }}>
                        <span style={{ fontWeight: 950, opacity: 0.9 }}>Der Gegner trifft dich gut mit:</span>
                        {effectiveness.rightDedup.map((x) => {
                          const c = typeColor(x.type);
                          return (
                            <span
                              key={"rh-" + x.type}
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 8,
                                padding: "5px 10px",
                                borderRadius: 999,
                                border: `1px solid ${c.bd}`,
                                background: c.bg,
                                fontWeight: 1000,
                                fontSize: 12,
                              }}
                            >
                              {TYPE_DE[x.type] || cap(x.type)} <span style={{ opacity: 0.9 }}>{x.mult === 4 ? "x4" : "x2"}</span>
                            </span>
                          );
                        })}
                      </div>
                    ) : null}

                    <div
  style={{
    marginTop: 8,
    fontWeight: 950,
    color: leftHasSEMove ? "#5CFF9E" : "rgba(255,255,255,0.75)",
  }}
>
  {leftHasSEMove
    ? `✅ Du hast bis Level ${L} mindestens eine sehr effektive Level-Up-Attacke.`
    : `❌ Du hast bis Level ${L} keine sehr effektive Level-Up-Attacke (nur Level-Up, nur DMG).`}
</div>


                    <div
  style={{
    marginTop: 6,
    fontWeight: 950,
    color: rightHasSEMove ? "#FF5C5C" : "rgba(255,255,255,0.75)",
  }}
>
  {rightHasSEMove
    ? `⚠ Der Gegner hat bis Level ${R} mindestens eine sehr effektive Level-Up-Attacke.`
    : `✅ Der Gegner hat bis Level ${R} keine sehr effektive Level-Up-Attacke (nur Level-Up, nur DMG).`}
</div>

                  </div>
                ) : null}

                <div className="cmp-moves-grid">
              <div className="cmp-card-hover" style={statsCard}>
                    <div style={{ fontWeight: 1100, marginBottom: 8 }}>Deine Level-Up-Moves bis Lv {L} (Gen {gen})</div>
                    {err ? <div style={{ opacity: 0.85, marginBottom: 10 }}>⚠ {err}</div> : null}

                    {leftDamagingMoves.length ? (
                      <div style={{ display: "grid", gap: 8 }}>
                        {leftDamagingMoves.slice(0, 40).map((m) => renderMoveLine(m, rightData.types || []))}
                      </div>
                    ) : (
                      <div style={{ opacity: 0.75, fontSize: 12 }}>Keine passenden Level-Up-DMG-Moves geladen (oder Meta lädt noch).</div>
                    )}
                  </div>

              <div className="cmp-card-hover" style={statsCard}>
                    <div style={{ fontWeight: 1100, marginBottom: 8 }}>Gegner Level-Up-Moves bis Lv {R} (Gen {gen})</div>
                    {rightDamagingMoves.length ? (
                      <div style={{ display: "grid", gap: 8 }}>
                        {rightDamagingMoves.slice(0, 40).map((m) => renderMoveLine(m, leftData.types || []))}
                      </div>
                    ) : (
                      <div style={{ opacity: 0.75, fontSize: 12 }}>Keine passenden Level-Up-DMG-Moves geladen (oder Meta lädt noch).</div>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <div style={{ marginTop: 14, opacity: 0.75, fontSize: 12 }}>Wähle rechts ein Pokémon aus – dann erscheinen Matchup & Attacken.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
