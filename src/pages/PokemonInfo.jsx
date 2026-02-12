// src/pages/PokemonInfo.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import dexBg from "../assets/DexBackground.png";

function cap(s) {
  return String(s || "")
    .replace(/-/g, " ")
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

function getIdFromSpeciesUrl(url) {
  // z.B. https://pokeapi.co/api/v2/pokemon-species/25/
  const m = String(url || "").match(/\/pokemon-species\/(\d+)\//);
  return m ? Number(m[1]) : null;
}

// --- German localization helpers (PokeAPI) ---
const moveNameCache = new Map(); // legacy: moveUrl -> germanName
const moveInfoCache = new Map(); // moveUrl -> { nameDe, typeKey }
const speciesNameDeCache = new Map(); // speciesId -> germanName

// ✅ NEU: Ability Cache
const abilityInfoCache = new Map(); // abilityUrl -> { nameDe, effectDe, isHidden }

function getLocalizedName(namesArr, lang = "de") {
  const arr = Array.isArray(namesArr) ? namesArr : [];
  const hit = arr.find((n) => n?.language?.name === lang);
  return hit?.name || null;
}

const GEN_TO_VERSION_GROUPS = {
  1: ["red-blue", "yellow"],
  2: ["gold-silver", "crystal"],
  3: ["ruby-sapphire", "emerald", "firered-leafgreen"],
  4: ["diamond-pearl", "platinum", "heartgold-soulsilver"],
  5: ["black-white", "black-2-white-2"],
  6: ["x-y", "omega-ruby-alpha-sapphire"],
  7: ["sun-moon", "ultra-sun-ultra-moon"],
};

async function fetchSpeciesNameDeById(speciesId) {
  const id = Number(speciesId);
  if (!id) return null;
  if (speciesNameDeCache.has(id)) return speciesNameDeCache.get(id);

  try {
    const res = await fetch(`https://pokeapi.co/api/v2/pokemon-species/${id}`);
    if (!res.ok) return null;
    const json = await res.json();
    const de = getLocalizedName(json?.names, "de");
    const fallback = cap(json?.name);
    const name = de || fallback;
    speciesNameDeCache.set(id, name);
    return name;
  } catch {
    return null;
  }
}

async function fetchMoveInfoDe(moveUrl) {
  if (!moveUrl) return null;
  if (moveInfoCache.has(moveUrl)) return moveInfoCache.get(moveUrl);

  try {
    const res = await fetch(moveUrl);
    if (!res.ok) return null;
    const json = await res.json();

    const nameDe = getLocalizedName(json?.names, "de") || cap(json?.name);
    const typeKey = String(json?.type?.name || "").toLowerCase();

    const packed = { nameDe, typeKey };
    moveInfoCache.set(moveUrl, packed);
    return packed;
  } catch {
    return null;
  }
}

// legacy (falls du es woanders noch benutzt)
async function fetchMoveNameDe(moveUrl) {
  if (!moveUrl) return null;
  if (moveNameCache.has(moveUrl)) return moveNameCache.get(moveUrl);

  try {
    const res = await fetch(moveUrl);
    if (!res.ok) return null;
    const json = await res.json();
    const de = getLocalizedName(json?.names, "de");
    const fallback = cap(json?.name);
    const name = de || fallback;
    moveNameCache.set(moveUrl, name);
    return name;
  } catch {
    return null;
  }
}

async function fetchTypeNameDe(typeUrl) {
  if (!typeUrl) return null;
  try {
    const res = await fetch(typeUrl);
    if (!res.ok) return null;
    const json = await res.json();
    const de = getLocalizedName(json?.names, "de");
    return de || cap(json?.name);
  } catch {
    return null;
  }
}

// ✅ NEU: Ability Info (DE Name + DE Effect, Fallback EN)
function looksTooEnglish(s) {
  const t = String(s || "").toLowerCase();
  if (!t) return false;
  // grober Heuristik-Check: wenn diese Tokens vorkommen, ist es oft "halb-englisch"
  const bad = ["weather", "water", "attack", "defense", "special", "speed", "hp", "chance", "switch", "move"];
  let hits = 0;
  for (const w of bad) if (t.includes(w)) hits++;
  return hits >= 2; // ab 2 Treffern lieber anderen Text nehmen
}

function normalizeGermanText(s) {
  let t = String(s || "")
    .replace(/\s+/g, " ")
    .replace(/\f/g, " ")
    .trim();

  // PokeAPI Flavor Text hat gern komische Zeilenumbrüche / Steuerzeichen
  t = t.replace(/[\u0000-\u001F]+/g, " ").replace(/\s+/g, " ").trim();

  // Mini-Glossar: häufige "englische Reste" in DE-Texten
  const repl = [
    [/\bweather\b/gi, "Wetter"],
    [/\bwater\b/gi, "Wasser"],
    [/\bfire\b/gi, "Feuer"],
    [/\bgrass\b/gi, "Pflanze"],
    [/\belectric\b/gi, "Elektro"],
    [/\bice\b/gi, "Eis"],
    [/\bfighting\b/gi, "Kampf"],
    [/\bpoison\b/gi, "Gift"],
    [/\bground\b/gi, "Boden"],
    [/\bflying\b/gi, "Flug"],
    [/\bpsychic\b/gi, "Psycho"],
    [/\bbug\b/gi, "Käfer"],
    [/\brock\b/gi, "Gestein"],
    [/\bghost\b/gi, "Geist"],
    [/\bdragon\b/gi, "Drache"],
    [/\bdark\b/gi, "Unlicht"],
    [/\bsteel\b/gi, "Stahl"],
    [/\bfairy\b/gi, "Fee"],

    [/\bHP\b/g, "KP"],
    [/\battack\b/gi, "Angriff"],
    [/\bdefense\b/gi, "Verteidigung"],
    [/\bspecial attack\b/gi, "Spezial-Angriff"],
    [/\bspecial defense\b/gi, "Spezial-Verteidigung"],
    [/\bspeed\b/gi, "Initiative"],
    [/\bmove(s)?\b/gi, "Attacke$1"],
  ];

  for (const [rgx, to] of repl) t = t.replace(rgx, to);

  return t;
}

function pickAbilityEffect(abilityJson) {
  const eff = Array.isArray(abilityJson?.effect_entries) ? abilityJson.effect_entries : [];
  const flavors = Array.isArray(abilityJson?.flavor_text_entries) ? abilityJson.flavor_text_entries : [];

  const deShort = eff.find((e) => e?.language?.name === "de")?.short_effect || "";
  const enShort = eff.find((e) => e?.language?.name === "en")?.short_effect || "";

  const deFlavor = flavors.find((e) => e?.language?.name === "de")?.flavor_text || "";
  const enFlavor = flavors.find((e) => e?.language?.name === "en")?.flavor_text || "";

  // Priorität:
  // 1) DE short_effect, wenn nicht "zu englisch"
  // 2) DE flavor_text (oft natürlicher)
  // 3) EN short_effect
  // 4) EN flavor_text
  let chosen = deShort && !looksTooEnglish(deShort) ? deShort : "";
  if (!chosen) chosen = deFlavor || "";
  if (!chosen) chosen = enShort || "";
  if (!chosen) chosen = enFlavor || "";

  return normalizeGermanText(chosen);
}


async function fetchAbilityInfoDe(abilityUrl, isHidden) {
  if (!abilityUrl) return null;

  // Cache-Key muss isHidden NICHT enthalten, weil Name/Effect gleich bleiben
  if (abilityInfoCache.has(abilityUrl)) {
    const cached = abilityInfoCache.get(abilityUrl);
    return { ...cached, isHidden: !!isHidden };
  }

  try {
    const res = await fetch(abilityUrl);
    if (!res.ok) return null;
    const json = await res.json();

    const nameDe = getLocalizedName(json?.names, "de") || cap(json?.name);
    const effectDe = pickAbilityEffect(json);

    const packed = { nameDe, effectDe, isHidden: !!isHidden };
    abilityInfoCache.set(abilityUrl, packed);
    return packed;
  } catch {
    return null;
  }
}

// kleine Helper: Promise.all in kleinen Paketen (schont API)
async function mapInBatches(items, batchSize, fn) {
  const out = [];
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    // eslint-disable-next-line no-await-in-loop
    const r = await Promise.all(batch.map(fn));
    out.push(...r);
  }
  return out;
}

function prettyName(s) {
  return String(s || "")
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function artworkFromDexId(id) {
  if (!id) return null;
  return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${id}.png`;
}

function evoRequirementDe(detail) {
  if (!detail) return "Unbekannt";

  const trig = detail?.trigger?.name;

  if (trig === "level-up") {
    const parts = ["Level-Up"];
    if (detail.min_level) parts.push(`ab Lv. ${detail.min_level}`);
    if (detail.time_of_day) parts.push(detail.time_of_day === "night" ? "bei Nacht" : "bei Tag");
    if (detail.min_happiness) parts.push(`Zuneigung ≥ ${detail.min_happiness}`);
    return parts.join(" • ");
  }

  if (trig === "use-item") {
    const key = detail.item?.name;
    const de = key ? itemNameDeCache[key] || prettyName(key) : "Item";
    return `Item: ${de}`;
  }

  if (trig === "trade") return `Tausch`;

  return prettyName(trig);
}

function compactSprite(pokemon) {
  return pokemon?.sprites?.other?.["official-artwork"]?.front_default || pokemon?.sprites?.front_default || "";
}

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

const VERSION_GROUPS_BY_GEN = {
  1: ["red-blue", "yellow"],
  2: ["gold-silver", "crystal"],
  3: ["ruby-sapphire", "emerald", "firered-leafgreen"],
  4: ["diamond-pearl", "platinum", "heartgold-soulsilver"],
  5: ["black-white", "black-2-white-2"],
  6: ["x-y", "omega-ruby-alpha-sapphire"],
  7: ["sun-moon", "ultra-sun-ultra-moon"],
};

const ALL_GENS = [1, 2, 3, 4, 5, 6, 7];

const typeIconRow = {
  marginTop: 10,
  display: "flex",
  gap: 8,
  justifyContent: "center",
  alignItems: "center",
  flexWrap: "wrap",
};

const typeIcon = {
  width: 28,
  height: 28,
  borderRadius: 8,
  padding: 3,
  background: "rgba(0,0,0,0.55)",
  border: "1px solid rgba(255,255,255,0.14)",
};

const hideScrollbar = {
  maxHeight: 360,
  overflow: "auto",
  scrollbarWidth: "none",
  msOverflowStyle: "none",
};

const hideScrollbarCss = `
  .hide-scrollbar::-webkit-scrollbar { display: none; }

  /* ===== Catchrate Select Dark Mode ===== */
  .pinfo-select {
    background: rgba(255,255,255,0.06);
    color: #fff;
    border: 1px solid rgba(255,255,255,0.14);
  }
  .pinfo-select option { background: #15171c; color: #fff; }

  /* ===== Catchrate Slider Fix ===== */
  .pinfo-range {
    width: 100%;
    margin: 0;
    background: transparent;
    -webkit-appearance: none;
    appearance: none;
  }
  .pinfo-range::-webkit-slider-runnable-track {
    height: 8px;
    border-radius: 999px;
    background: linear-gradient(90deg,#a14cff,#ff4ca0);
  }
  .pinfo-range::-moz-range-track {
    height: 8px;
    border-radius: 999px;
    background: linear-gradient(90deg,#a14cff,#ff4ca0);
  }
  .pinfo-range::-webkit-slider-thumb {
    -webkit-appearance: none;
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background: white;
    margin-top: -5px;
  }
  .pinfo-range::-moz-range-thumb {
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background: white;
  }
  .pinfo-range:focus { outline: none; }
`;

function timerBallMult(gen, turnsPassed) {
  const t = Math.max(0, Math.floor(Number(turnsPassed) || 0));
  if (gen <= 4) return Math.min(4, 1 + t / 10);

  const table = [
    1,
    5325 / 4096,
    6554 / 4096,
    7783 / 4096,
    9012 / 4096,
    10241 / 4096,
    11470 / 4096,
    12699 / 4096,
    13928 / 4096,
    15157 / 4096,
    4,
  ];
  return t >= 10 ? 4 : table[t] || 1;
}

function quickBallMult(gen, turnNumber) {
  const turn = Math.max(1, Math.floor(Number(turnNumber) || 1));
  if (turn !== 1) return 1;
  if (gen === 4) return 4;
  return 5;
}

function duskBallMult(gen, isDark) {
  if (!isDark) return 1;
  if (gen >= 7) return 3;
  return 3.5;
}

function getBallsForGen(gen) {
  const g = Number(gen) || 7;

  const base = [
    { key: "poke", label: "Pokéball", kind: "static", mult: 1 },
    { key: "great", label: "Superball", kind: "static", mult: 1.5 },
    { key: "ultra", label: "Hyperball", kind: "static", mult: 2 },
    { key: "master", label: "Meisterball", kind: "static", mult: Infinity },
  ];

  if (g >= 3) base.push({ key: "timer", label: "Timerball", kind: "turns" });
  if (g >= 4) base.push({ key: "dusk", label: "Finsterball", kind: "dark" });
  if (g >= 4) base.push({ key: "quick", label: "Flottball", kind: "turn" });

  return base;
}

function getBallMultiplier(ball, { gen, turnNumber, isDark }) {
  if (!ball) return 1;
  if (ball.mult === Infinity) return Infinity;
  if (ball.kind === "static") return ball.mult ?? 1;

  const g = Number(gen) || 7;

  if (ball.kind === "turns") {
    const turnsPassed = Math.max(0, Math.floor(Number(turnNumber) || 1) - 1);
    return timerBallMult(g, turnsPassed);
  }
  if (ball.kind === "turn") return quickBallMult(g, turnNumber);
  if (ball.kind === "dark") return duskBallMult(g, Boolean(isDark));

  return 1;
}

function getStatusBonus(status) {
  if (status === "sleep" || status === "freeze") return 2;
  if (status === "par" || status === "poison" || status === "burn") return 1.5;
  return 1;
}

function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

function estimateCatchChanceGen3Plus({ captureRate, ballMult, statusBonus, hpPct }) {
  const maxHP = 100;
  const curHP = clamp(Math.round((hpPct / 100) * maxHP), 1, maxHP);

  if (!Number.isFinite(captureRate) || captureRate <= 0) return 0;
  if (ballMult === Infinity) return 1;

  let a = (((3 * maxHP - 2 * curHP) * captureRate * ballMult) / (3 * maxHP)) * statusBonus;
  a = clamp(a, 0, 255);
  if (a >= 255) return 1;

  const b = 1048560 / Math.sqrt(Math.sqrt(16711680 / a));
  const p = Math.pow(b / 65536, 4);
  return clamp(p, 0, 1);
}

function formatCatchChance(chance01) {
  const p = chance01 * 100;
  if (!Number.isFinite(p) || p <= 0) return "<0.01%";
  if (p < 0.01) return "<0.01%";
  if (p < 0.1) return p.toFixed(2) + "%";
  if (p < 1) return p.toFixed(2) + "%";
  if (p < 10) return p.toFixed(1) + "%";
  return Math.round(p) + "%";
}

const itemNameDeCache = {}; // key: "dusk-stone" -> "Finsterstein"

async function getItemNameDe(itemKey) {
  const key = String(itemKey || "").trim().toLowerCase();
  if (!key) return null;
  if (itemNameDeCache[key]) return itemNameDeCache[key];

  try {
    const res = await fetch(`https://pokeapi.co/api/v2/item/${encodeURIComponent(key)}`);
    if (!res.ok) throw new Error("item fetch failed");
    const data = await res.json();

    const de = data?.names?.find((n) => n?.language?.name === "de")?.name;
    itemNameDeCache[key] = de || prettyName(key);
    return itemNameDeCache[key];
  } catch {
    itemNameDeCache[key] = prettyName(key);
    return itemNameDeCache[key];
  }
}

/* =========================
   Typ-Matchups (Schwächen)
========================= */
const ALL_TYPE_KEYS = [
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

function uniq(arr) {
  return Array.from(new Set((arr || []).filter(Boolean)));
}

function multToBucket(mult) {
  if (mult === 0) return "immune";
  if (mult >= 4) return "weak4";
  if (mult >= 2) return "weak2";
  if (mult <= 0.25) return "resist4";
  if (mult <= 0.5) return "resist2";
  return "neutral";
}

function typeIconUrl(typeKey) {
  const t = String(typeKey || "").toLowerCase();
  return `https://raw.githubusercontent.com/partywhale/pokemon-type-icons/master/icons/${t}.svg`;
}

export default function PokemonInfo() {
  const { dexId } = useParams();
  const nav = useNavigate();
  const id = Number(dexId);

  const [typesDe, setTypesDe] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [pokemon, setPokemon] = useState(null);
  const [basePokemon, setBasePokemon] = useState(null);
  const [species, setSpecies] = useState(null);
  const [evoChain, setEvoChain] = useState(null);

  // moveUrl -> { nameDe, typeKey }
  const [moveNameDeByUrl, setMoveNameDeByUrl] = useState({});

  const [evoNameDeById, setEvoNameDeById] = useState({});
  const [simLevel, setSimLevel] = useState();
  const [useSimulation, setUseSimulation] = useState(false);
  const [selectedGen, setSelectedGen] = useState(7);

  const [showCatchCalc, setShowCatchCalc] = useState(false);
  const [ccBall, setCcBall] = useState("poke");
  const [ccStatus, setCcStatus] = useState("none");
  const [ccHpPct, setCcHpPct] = useState(35);
  const [ccTurn, setCcTurn] = useState(1);
  const [ccDark, setCcDark] = useState(false);

  const [evoItemTick, setEvoItemTick] = useState(0);

  // ✅ Typ-Matchups
  const [matchups, setMatchups] = useState(null);

  // ✅ NEU: Abilities
  // abilityUrl -> { nameDe, effectDe, isHidden }
  const [abilityInfoByUrl, setAbilityInfoByUrl] = useState({});

  // ✅ Background/Body darf NICHT scrollen
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

  // Load Pokémon + Species + Base + Evo
  useEffect(() => {
    let alive = true;

    async function run() {
      try {
        setLoading(true);
        setErr("");

        const pRes = await fetch(`https://pokeapi.co/api/v2/pokemon/${id}`);
        if (!pRes.ok) throw new Error("Pokémon konnte nicht geladen werden.");
        const p = await pRes.json();

        const baseId = getIdFromSpeciesUrl(p?.species?.url) || id;

        const sRes = await fetch(`https://pokeapi.co/api/v2/pokemon-species/${baseId}`);
        if (!sRes.ok) throw new Error("Species konnte nicht geladen werden.");
        const s = await sRes.json();

        let bp = null;
        try {
          const bpRes = await fetch(`https://pokeapi.co/api/v2/pokemon/${baseId}`);
          if (bpRes.ok) bp = await bpRes.json();
        } catch {
          bp = null;
        }

        let chain = null;
        const evoUrl = s?.evolution_chain?.url;
        if (evoUrl) {
          const eRes = await fetch(evoUrl);
          if (eRes.ok) chain = await eRes.json();
        }

        if (!alive) return;
        setPokemon(p);
        setSpecies(s);
        setBasePokemon(bp);
        setEvoChain(chain);
      } catch (e) {
        if (!alive) return;
        setErr(e?.message || "Fehler beim Laden.");
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    }

    if (Number.isFinite(id) && id > 0) run();
    else {
      setLoading(false);
      setErr("Ungültige Dex-ID.");
    }

    return () => {
      alive = false;
    };
  }, [id]);

  // Types DE (optional)
  useEffect(() => {
    let alive = true;
    async function run() {
      const arr = pokemon?.types || [];
      const sorted = arr.slice().sort((a, b) => (a?.slot ?? 0) - (b?.slot ?? 0));

      const names = await Promise.all(sorted.map((t) => fetchTypeNameDe(t?.type?.url)));

      if (!alive) return;
      setTypesDe(names.filter(Boolean));
    }

    if (pokemon) run();
    return () => {
      alive = false;
    };
  }, [pokemon]);

  // ✅ NEU: Abilities laden (Name DE + Effekt)
  useEffect(() => {
    let alive = true;

    async function run() {
      const ab = Array.isArray(pokemon?.abilities) ? pokemon.abilities : [];
      const sorted = ab.slice().sort((a, b) => (a?.slot ?? 0) - (b?.slot ?? 0));

      const urls = sorted
        .map((a) => ({
          url: a?.ability?.url,
          isHidden: !!a?.is_hidden,
        }))
        .filter((x) => !!x.url);

      if (urls.length === 0) return;

      const missing = urls.filter((x) => !abilityInfoByUrl[x.url]);
      if (missing.length === 0) return;

      const pairs = await mapInBatches(missing, 8, async (x) => {
        const info = await fetchAbilityInfoDe(x.url, x.isHidden);
        return [x.url, info];
      });

      if (!alive) return;

      setAbilityInfoByUrl((prev) => {
        const next = { ...prev };
        for (const [u, info] of pairs) {
          if (info) next[u] = info;
        }
        return next;
      });
    }

    if (pokemon) run();
    return () => {
      alive = false;
    };
  }, [pokemon, abilityInfoByUrl]);

  // ✅ Typ-Matchups
  useEffect(() => {
    let alive = true;

    async function run() {
      if (!pokemon?.types?.length) {
        setMatchups(null);
        return;
      }

      const defenderTypeUrls = pokemon.types
        .slice()
        .sort((a, b) => (a?.slot ?? 0) - (b?.slot ?? 0))
        .map((t) => t?.type?.url)
        .filter(Boolean);

      try {
        const defs = await Promise.all(
          defenderTypeUrls.map(async (url) => {
            const res = await fetch(url);
            if (!res.ok) return null;
            return res.json();
          })
        );

        if (!alive) return;

        const rels = defs.filter(Boolean).map((t) => t.damage_relations || {});
        const buckets = { immune: [], weak2: [], weak4: [], resist2: [], resist4: [] };

        for (const atk of ALL_TYPE_KEYS) {
          let mult = 1;

          for (const dr of rels) {
            const dd = (dr.double_damage_from || []).map((x) => x?.name);
            const hd = (dr.half_damage_from || []).map((x) => x?.name);
            const nd = (dr.no_damage_from || []).map((x) => x?.name);

            if (nd.includes(atk)) mult *= 0;
            else if (dd.includes(atk)) mult *= 2;
            else if (hd.includes(atk)) mult *= 0.5;
          }

          const bucket = multToBucket(mult);
          if (bucket !== "neutral") buckets[bucket].push(atk);
        }

        for (const k of Object.keys(buckets)) buckets[k] = uniq(buckets[k]).sort();
        setMatchups(buckets);
      } catch {
        if (!alive) return;
        setMatchups(null);
      }
    }

    run();
    return () => {
      alive = false;
    };
  }, [pokemon]);

  const catchRate = species?.capture_rate ?? null;

  const basePokeballChance = catchRate
    ? Math.round(
        estimateCatchChanceGen3Plus({
          captureRate: Number(catchRate),
          ballMult: 1,
          statusBonus: 1,
          hpPct: 100,
        }) * 100
      )
    : null;

  const stats = useMemo(() => {
    const s = pokemon?.stats || [];
    const map = {};
    for (const it of s) map[it?.stat?.name] = it?.base_stat;
    return {
      HP: map.hp ?? "-",
      Atk: map.attack ?? "-",
      Def: map.defense ?? "-",
      SpA: map["special-attack"] ?? "-",
      SpD: map["special-defense"] ?? "-",
      Spe: map.speed ?? "-",
    };
  }, [pokemon]);

  const typeKeys = useMemo(() => {
    const arr = pokemon?.types || [];
    return arr
      .slice()
      .sort((a, b) => (a?.slot ?? 0) - (b?.slot ?? 0))
      .map((t) => String(t?.type?.name || "").toLowerCase())
      .filter(Boolean);
  }, [pokemon]);

  const levelUpMoves = useMemo(() => {
    const mv = basePokemon?.moves || pokemon?.moves || [];
    const out = [];

    const allowed = new Set(VERSION_GROUPS_BY_GEN[selectedGen] || []);

    for (const m of mv) {
      const name = cap(m?.move?.name);
      const details = m?.version_group_details || [];
      for (const d of details) {
        const vg = d?.version_group?.name;
        if (!allowed.has(vg)) continue;
        if (d?.move_learn_method?.name !== "level-up") continue;

        const lvl = d?.level_learned_at ?? 0;
        out.push({ level: lvl, name, url: m?.move?.url });
      }
    }

    out.sort((a, b) => a.level - b.level || a.name.localeCompare(b.name));
    const seen = new Set();
    return out.filter((x) => {
      const key = `${x.level}|${x.name}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [pokemon, basePokemon, selectedGen]);

  const availableGens = useMemo(() => {
    const mv = basePokemon?.moves || pokemon?.moves || [];
    if (!mv.length) return ALL_GENS;

    const gensWithData = [];

    for (let g = 1; g <= 7; g++) {
      const allowed = new Set(VERSION_GROUPS_BY_GEN[g] || []);
      let has = false;

      for (const m of mv) {
        const details = m?.version_group_details || [];
        for (const d of details) {
          const vg = d?.version_group?.name;
          if (!allowed.has(vg)) continue;
          if (d?.move_learn_method?.name !== "level-up") continue;
          has = true;
          break;
        }
        if (has) break;
      }

      if (has) gensWithData.push(g);
    }

    return gensWithData.length ? gensWithData : ALL_GENS;
  }, [pokemon, basePokemon]);

  useEffect(() => {
    if (!availableGens.includes(selectedGen)) {
      setSelectedGen(availableGens[availableGens.length - 1] || 7);
    }
  }, [availableGens, selectedGen]);

  // ✅ Move-Infos (Name DE + TypeKey) laden
  useEffect(() => {
    let alive = true;

    async function run() {
      const uniqueUrls = Array.from(new Set((levelUpMoves || []).map((m) => m.url).filter(Boolean)));
      const missing = uniqueUrls.filter((u) => !moveNameDeByUrl[u]);

      if (missing.length === 0) return;

      const infos = await mapInBatches(missing, 12, async (u) => {
        const info = await fetchMoveInfoDe(u);
        return [u, info];
      });

      if (!alive) return;

      setMoveNameDeByUrl((prev) => {
        const next = { ...prev };
        for (const [u, info] of infos) {
          if (info) next[u] = info;
        }
        return next;
      });
    }

    run();
    return () => {
      alive = false;
    };
  }, [levelUpMoves, moveNameDeByUrl]);

  function flattenEvo(chainNode, acc = [], fromDetails = null) {
    if (!chainNode) return acc;

    const speciesId = getIdFromSpeciesUrl(chainNode?.species?.url);

    acc.push({
      id: speciesId,
      fallbackName: cap(chainNode?.species?.name),
      details: Array.isArray(fromDetails) ? fromDetails : [],
    });

    const next = chainNode?.evolves_to || [];
    for (const n of next) flattenEvo(n, acc, n?.evolution_details || []);
    return acc;
  }

  const evoList = useMemo(() => {
    const root = evoChain?.chain;
    if (!root) return [];
    const flat = flattenEvo(root, []);
    const seen = new Set();
    return flat.filter((x) => {
      const key = `${x.id || ""}|${x.fallbackName || ""}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [evoChain]);

  const simStats = useMemo(() => {
    if (!pokemon) return stats;

    const lvl = Math.max(1, Math.min(100, Number(simLevel || 1)));

    function calcStat(base) {
      return Math.floor((base * 2 * lvl) / 100 + 5);
    }

    function calcHp(base) {
      return Math.floor((base * 2 * lvl) / 100 + lvl + 10);
    }

    return {
      HP: calcHp(stats.HP),
      Atk: calcStat(stats.Atk),
      Def: calcStat(stats.Def),
      SpA: calcStat(stats.SpA),
      SpD: calcStat(stats.SpD),
      Spe: calcStat(stats.Spe),
    };
  }, [stats, simLevel, pokemon]);

  const activeStats = useMemo(() => {
    return useSimulation ? simStats : stats;
  }, [useSimulation, simStats, stats]);

  const levelFilteredMoves = useMemo(() => {
    const lvl = Number(simLevel || 1);
    return levelUpMoves.filter((m) => m.level <= lvl);
  }, [levelUpMoves, simLevel]);

  const activeMoves = useMemo(() => {
    return useSimulation ? levelFilteredMoves : levelUpMoves;
  }, [useSimulation, levelFilteredMoves, levelUpMoves]);

  // Evo names DE
  useEffect(() => {
    let alive = true;

    async function run() {
      const ids = Array.from(new Set((evoList || []).map((e) => e.id).filter(Boolean)));
      const missing = ids.filter((id2) => !evoNameDeById[id2]);

      if (missing.length === 0) return;

      const pairs = await mapInBatches(missing, 10, async (id2) => {
        const de = await fetchSpeciesNameDeById(id2);
        return [id2, de];
      });

      if (!alive) return;

      setEvoNameDeById((prev) => {
        const next = { ...prev };
        for (const [id2, de] of pairs) {
          if (de) next[id2] = de;
        }
        return next;
      });
    }

    run();
    return () => {
      alive = false;
    };
  }, [evoList, evoNameDeById]);

  // Evo item names DE
  useEffect(() => {
    let alive = true;

    async function loadEvoItemNames() {
      const keys = new Set();

      for (const e of evoList || []) {
        for (const d of e.details || []) {
          if (d?.item?.name) keys.add(d.item.name);
          if (d?.held_item?.name) keys.add(d.held_item.name);
        }
      }

      if (keys.size === 0) return;

      await Promise.all([...keys].map((k) => getItemNameDe(k)));

      if (!alive) return;
      setEvoItemTick((x) => x + 1);
    }

    loadEvoItemNames();

    return () => {
      alive = false;
    };
  }, [evoList]);

  useEffect(() => {
    function onKey(e) {
      if (e.key === "Escape" && showCatchCalc) setShowCatchCalc(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showCatchCalc]);

  const pageOuter = {
    minHeight: "100vh",
    padding: 16,
    color: "white",
    backgroundImage: `url(${dexBg})`,
    backgroundSize: "cover",
    backgroundPosition: "center",
    backgroundRepeat: "no-repeat",
    backgroundAttachment: "fixed",
    position: "relative",
    height: "100vh",
    overflow: "hidden",
  };

  // ✅ bisschen weiter nach links: maxWidth leicht runter + kein extra “zu mittig”
  const page = {
    maxWidth: 1400,
    margin: "0 auto",
  };

  const card = {
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(0, 0, 0, 0.55)",
    borderRadius: 14,
    padding: 14,
  };

  const hideBox = {
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(0,0,0,0.35)",
    borderRadius: 14,
    padding: 12,
  };

  return (
    <div style={pageOuter}>
      <style>{hideScrollbarCss}</style>

      {/* ⭐ Hintergrund Layer */}
      <div
        style={{
          position: "fixed",
          inset: 0,
          backgroundImage: `url(${dexBg})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          filter: "blur(6px)",
          transform: "scale(1.05)",
          zIndex: -2,
        }}
      />

      {/* ⭐ dunkles Overlay */}
      <div
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.55)",
          zIndex: -1,
        }}
      />

      <div style={page}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2>Pokémon Info</h2>

          <div style={{ display: "flex", gap: 10 }}>
            <button
              onClick={() => nav("/pokedex")}
              style={{
                padding: "8px 12px",
                borderRadius: 10,
                border: "1px solid rgba(255,255,255,0.14)",
                background: "rgba(0,0,0,0.25)",
                color: "white",
                cursor: "pointer",
                fontWeight: 700,
              }}
            >
              Pokédex
            </button>

            <button
              onClick={() => nav(-1)}
              style={{
                padding: "8px 12px",
                borderRadius: 10,
                border: "1px solid rgba(255,255,255,0.14)",
                background: "rgba(0,0,0,0.25)",
                color: "white",
                cursor: "pointer",
                fontWeight: 700,
              }}
            >
              Zurück
            </button>
          </div>
        </div>

        {loading && <div style={{ marginTop: 12, opacity: 0.8 }}>Lade…</div>}

        {!loading && err && (
          <div style={{ marginTop: 12, ...card, borderColor: "rgba(255,80,80,0.35)" }}>{err}</div>
        )}

        {!loading && !err && pokemon && species && (
          <div
            style={{
              ...card,
              marginTop: 12,
              padding: 22,
              borderRadius: 18,
              background: "rgba(0,0,0,0.68)",
              border: "1px solid rgba(255,255,255,0.14)",
              boxShadow: "0 30px 90px rgba(0,0,0,0.55)",
              backdropFilter: "blur(6px)",
              width: "min(1400px, 96vw)",
              marginLeft: "auto",
              marginRight: "auto",
            }}
          >
            {/* ===== 3-Spalten Master-Layout (alles in EINER schwarzen Box) ===== */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "minmax(360px, 1fr) minmax(360px, 1fr) minmax(420px, 1fr)",
                gap: 14,
                alignItems: "start",
              }}
            >
              {/* ================= LEFT: POKEMON + STATS ================= */}
              <div style={{ minWidth: 0 }}>
                <div style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
                  <div style={{ width: 170 }}>
                    {compactSprite(pokemon) ? (
                      <img
                        src={compactSprite(pokemon)}
                        alt={pokemon?.name || "pokemon"}
                        style={{ width: 170, height: 170, objectFit: "contain" }}
                      />
                    ) : (
                      <div style={{ width: 170, height: 170, opacity: 0.6 }}>Kein Bild</div>
                    )}
                  </div>

                  <div style={{ flex: 1, minWidth: 220 }}>
                    <div style={{ fontSize: 22, fontWeight: 900 }}>
                      {getLocalizedName(species?.names, "de") || cap(pokemon?.name)}{" "}
                      <span style={{ opacity: 0.6, fontWeight: 700 }}>#{id}</span>
                    </div>

                    {/* Types */}
                    {typeKeys.length > 0 && (
                      <div style={{ ...typeIconRow, justifyContent: "flex-start" }}>
                        {typeKeys.map((t) => (
                          <img
                            key={t}
                            src={`https://raw.githubusercontent.com/partywhale/pokemon-type-icons/master/icons/${t}.svg`}
                            alt={t}
                            title={TYPE_LABELS_DE[t] ?? t}
                            style={{ ...typeIcon, width: 26, height: 26 }}
                            onError={(e) => {
                              e.currentTarget.src = `https://raw.githubusercontent.com/duiker101/pokemon-type-svg-icons/master/icons/${t}.svg`;
                            }}
                          />
                        ))}
                      </div>
                    )}

                    {/* ✅ NEU: Fähigkeiten */}
                    <div style={{ marginTop: 12, ...hideBox }}>
                      <div style={{ fontWeight: 950, marginBottom: 8 }}>Fähigkeiten</div>

                      {(() => {
                        const ab = Array.isArray(pokemon?.abilities) ? pokemon.abilities : [];
                        const sorted = ab.slice().sort((a, b) => (a?.slot ?? 0) - (b?.slot ?? 0));

                        if (sorted.length === 0) return <div style={{ opacity: 0.75 }}>Keine Daten</div>;

                        return (
                          <div style={{ display: "grid", gap: 10 }}>
                            {sorted.map((a, idx) => {
                              const url = a?.ability?.url;
                              const isHidden = !!a?.is_hidden;

                              const info = url ? abilityInfoByUrl[url] : null;
                              const nameDe = info?.nameDe || cap(a?.ability?.name);
                              const effect = info?.effectDe || "";

                              return (
                                <div
                                  key={`${url || a?.ability?.name || "ab"}-${idx}`}
                                  style={{
                                    border: "1px solid rgba(255,255,255,0.10)",
                                    background: "rgba(0,0,0,0.28)",
                                    borderRadius: 12,
                                    padding: "10px 10px",
                                  }}
                                >
                                  <div style={{ display: "flex", gap: 10, alignItems: "baseline", flexWrap: "wrap" }}>
                                    <div style={{ fontWeight: 950 }}>
                                      {nameDe} {isHidden ? <span style={{ opacity: 0.8 }}>(V)</span> : null}
                                    </div>
                                    {!info && (
                                      <div style={{ fontSize: 12, opacity: 0.6 }}>
                                        Lade…
                                      </div>
                                    )}
                                  </div>

                                  {effect ? (
                                    <div style={{ marginTop: 6, fontSize: 13, opacity: 0.9, lineHeight: 1.35 }}>
                                      {effect}
                                    </div>
                                  ) : (
                                    <div style={{ marginTop: 6, fontSize: 12, opacity: 0.65 }}>
                                      Keine Beschreibung verfügbar.
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        );
                      })()}
                    </div>

                    {/* Catchrate + Rechner */}
                    <div
                      style={{
                        marginTop: 10,
                        opacity: 0.92,
                        display: "flex",
                        gap: 10,
                        alignItems: "center",
                        flexWrap: "wrap",
                      }}
                    >
                      <div>
                        {basePokeballChance !== null ? (
                          <>Fangchance: {basePokeballChance}%</>
                        ) : (
                          <>Catchrate: {catchRate ?? "-"}</>
                        )}
                      </div>

                      <button
                        style={{
                          padding: "6px 10px",
                          borderRadius: 10,
                          border: "1px solid rgba(255,255,255,0.14)",
                          background: "rgba(255,255,255,0.06)",
                          color: "white",
                          cursor: "pointer",
                          fontWeight: 900,
                        }}
                        onClick={() => setShowCatchCalc(true)}
                      >
                        Rechner öffnen
                      </button>
                    </div>

                    {/* Gen */}
                    <div style={{ marginTop: 10, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                      <div style={{ opacity: 0.9, fontWeight: 800 }}>Gen:</div>
                      <select
                        value={selectedGen}
                        onChange={(e) => setSelectedGen(Number(e.target.value))}
                        style={{
                          padding: "6px 10px",
                          borderRadius: 10,
                          border: "1px solid rgba(255,255,255,0.14)",
                          background: "rgba(20,20,20,0.95)",
                          color: "white",
                          cursor: "pointer",
                          outline: "none",
                          appearance: "none",
                          fontWeight: 900,
                        }}
                      >
                        {availableGens.map((g) => (
                          <option key={g} value={g} style={{ background: "#1a1a1a", color: "white" }}>
                            Gen {g}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Level Simulation */}
                    <div style={{ marginTop: 10, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                      <div style={{ opacity: 0.9, fontWeight: 800 }}>Level:</div>
                      <input
                        type="number"
                        min={1}
                        max={100}
                        value={simLevel}
                        onChange={(e) => setSimLevel(e.target.value)}
                        disabled={!useSimulation}
                        style={{
                          width: 74,
                          padding: 6,
                          borderRadius: 8,
                          background: "rgba(0,0,0,0.3)",
                          border: "1px solid rgba(255,255,255,0.15)",
                          color: "white",
                          opacity: useSimulation ? 1 : 0.5,
                          fontWeight: 900,
                        }}
                      />
                      <button
                        onClick={() => setUseSimulation((v) => !v)}
                        style={{
                          padding: "8px 10px",
                          borderRadius: 10,
                          border: "1px solid rgba(255,255,255,0.14)",
                          background: useSimulation ? "rgba(0,0,0,0.35)" : "rgba(255,255,255,0.06)",
                          color: "white",
                          cursor: "pointer",
                          fontWeight: 900,
                        }}
                        title="Umschalten zwischen Basisdaten und Level-Simulation"
                      >
                        {useSimulation ? "Basis anzeigen" : "Levelwerte anzeigen"}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Stats Grid */}
                <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 10 }}>
                  {Object.entries(activeStats).map(([k, v]) => (
                    <div
                      key={k}
                      style={{
                        border: "1px solid rgba(255,255,255,0.10)",
                        background: "rgba(0,0,0,0.35)",
                        borderRadius: 14,
                        padding: 10,
                      }}
                    >
                      <div style={{ fontSize: 12, opacity: 0.75, fontWeight: 800 }}>{k}</div>
                      <div style={{ fontSize: 18, fontWeight: 950 }}>{v}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* ================= MID: MATCHUPS ================= */}
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 950, fontSize: 14, marginBottom: 10 }}>Typ-Matchups</div>

                {(() => {
                  const ALL_TYPES = [
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

                  const CHART = {
                    normal: { rock: 0.5, ghost: 0, steel: 0.5 },
                    fire: { fire: 0.5, water: 0.5, grass: 2, ice: 2, bug: 2, rock: 0.5, dragon: 0.5, steel: 2 },
                    water: { fire: 2, water: 0.5, grass: 0.5, ground: 2, rock: 2, dragon: 0.5 },
                    electric: { water: 2, electric: 0.5, grass: 0.5, ground: 0, flying: 2, dragon: 0.5 },
                    grass: { fire: 0.5, water: 2, grass: 0.5, poison: 0.5, ground: 2, flying: 0.5, bug: 0.5, rock: 2, dragon: 0.5, steel: 0.5 },
                    ice: { fire: 0.5, water: 0.5, grass: 2, ground: 2, flying: 2, dragon: 2, steel: 0.5, ice: 0.5 },
                    fighting: { normal: 2, ice: 2, rock: 2, dark: 2, steel: 2, poison: 0.5, flying: 0.5, psychic: 0.5, bug: 0.5, fairy: 0.5, ghost: 0 },
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

                  const defenders = (typeKeys || []).slice(0, 2);

                  function getMult(attType, defType) {
                    const row = CHART[attType] || {};
                    const v = row[defType];
                    return Number.isFinite(v) ? v : 1;
                  }

                  const byMult = { 4: [], 2: [], 0.5: [], 0.25: [], 0: [] };

                  for (const atk of ALL_TYPES) {
                    let mult = 1;
                    for (const def of defenders) mult *= getMult(atk, def);
                    if (mult === 4) byMult[4].push(atk);
                    else if (mult === 2) byMult[2].push(atk);
                    else if (mult === 0.5) byMult[0.5].push(atk);
                    else if (mult === 0.25) byMult[0.25].push(atk);
                    else if (mult === 0) byMult[0].push(atk);
                  }

                  const rows = [
                    ["Starke Schwäche (×4)", byMult[4]],
                    ["Schwäche (×2)", byMult[2]],
                    ["Resistenz (×½)", byMult[0.5]],
                    ["Starke Resistenz (×¼)", byMult[0.25]],
                    ["Immunitäten", byMult[0]],
                  ];

                  return (
                    <div style={{ display: "grid", gap: 12 }}>
                      {rows.map(([label, arr]) => (
                        <div key={label}>
                          <div style={{ opacity: 0.9, fontWeight: 900, marginBottom: 6 }}>{label}</div>
                          {arr.length === 0 ? (
                            <div style={{ opacity: 0.55, fontSize: 12 }}>—</div>
                          ) : (
                            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                              {arr.map((t) => (
                                <div
                                  key={t}
                                  style={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: 8,
                                    padding: "6px 10px",
                                    borderRadius: 999,
                                    border: "1px solid rgba(255,255,255,0.14)",
                                    background: "rgba(255,255,255,0.06)",
                                    fontWeight: 900,
                                  }}
                                >
                                  <img
                                    src={`https://raw.githubusercontent.com/partywhale/pokemon-type-icons/master/icons/${t}.svg`}
                                    alt={t}
                                    title={TYPE_LABELS_DE[t] ?? t}
                                    style={{ ...typeIcon, width: 20, height: 20, padding: 2 }}
                                    onError={(e) => {
                                      e.currentTarget.src = `https://raw.githubusercontent.com/duiker101/pokemon-type-svg-icons/master/icons/${t}.svg`;
                                    }}
                                  />
                                  <span style={{ fontSize: 12, opacity: 0.95 }}>{TYPE_LABELS_DE[t] ?? t}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>

              {/* ================= RIGHT: MOVES + EVO (unten rechts) ================= */}
              <div style={{ minWidth: 0, display: "grid", gap: 12 }}>
                {/* Moves */}
                <div
                  style={{
                    border: "1px solid rgba(255,255,255,0.12)",
                    background: "rgba(0,0,0,0.35)",
                    borderRadius: 14,
                    padding: 12,
                  }}
                >
                  <div style={{ fontWeight: 950, marginBottom: 8 }}>Level-Up Moves</div>

                  <div
                    className="hide-scrollbar"
                    style={{
                      ...hideScrollbar,
                      maxHeight: "44vh",
                      overflowY: "auto",
                      paddingRight: 6,
                    }}
                  >
                    {activeMoves.length === 0 && <div style={{ opacity: 0.75 }}>Keine Daten</div>}

                    {activeMoves.map((m, idx) => {
                      const info = moveNameDeByUrl?.[m.url];
                      const moveName = info?.nameDe || moveNameDeByUrl?.[m.url] || m.name;
                      const t = info?.typeKey || "";

                      return (
                        <div
                          key={`${m.level}-${m.name}-${idx}`}
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            gap: 10,
                            padding: "6px 0",
                            borderBottom: "1px solid rgba(255,255,255,0.08)",
                          }}
                        >
                          <div style={{ opacity: 0.92, display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                            <div style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {moveName}
                            </div>

                            {!!t && (
                              <img
                                src={`https://raw.githubusercontent.com/partywhale/pokemon-type-icons/master/icons/${t}.svg`}
                                alt={t}
                                title={TYPE_LABELS_DE[t] ?? t}
                                style={{ ...typeIcon, width: 22, height: 22, padding: 2 }}
                                onError={(e) => {
                                  e.currentTarget.src = `https://raw.githubusercontent.com/duiker101/pokemon-type-svg-icons/master/icons/${t}.svg`;
                                }}
                              />
                            )}
                          </div>

                          <div style={{ opacity: 0.7, whiteSpace: "nowrap", fontWeight: 900 }}>Lv {m.level}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Evo unten rechts */}
                {evoList.length > 0 && (
                  <div
                    style={{
                      border: "1px solid rgba(255,255,255,0.12)",
                      background: "rgba(0,0,0,0.35)",
                      borderRadius: 14,
                      padding: 12,
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                      <div style={{ fontWeight: 950, fontSize: 14 }}>Entwicklung</div>
                      <div
                        style={{
                          fontSize: 12,
                          opacity: 0.75,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {getLocalizedName(species?.names, "de") || cap(pokemon?.name)}
                      </div>
                    </div>

                    <div style={{ height: 1, background: "rgba(255,255,255,0.10)", margin: "10px 0" }} />

                    <div className="hide-scrollbar" style={{ ...hideScrollbar, overflowY: "auto", maxHeight: "28vh", paddingRight: 6 }}>
                      {evoList.map((e) => (
                        <div
                          key={e.id || e.fallbackName}
                          onClick={() => e.id && nav(`/pokemon/${e.id}`)}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 12,
                            padding: "10px 10px",
                            borderRadius: 14,
                            marginBottom: 10,
                            border: "1px solid rgba(255,255,255,0.16)",
                            background: "rgba(255,255,255,0.07)",
                            cursor: e.id ? "pointer" : "default",
                          }}
                          title={e.id ? "Öffnen" : ""}
                        >
                          <img
                            src={artworkFromDexId(e.id)}
                            alt={e.fallbackName}
                            style={{
                              width: 46,
                              height: 46,
                              objectFit: "contain",
                              filter: "drop-shadow(0 10px 18px rgba(0,0,0,0.5))",
                            }}
                          />

                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontWeight: 950, fontSize: 14, lineHeight: 1.1 }}>
                              {evoNameDeById[e.id] || e.fallbackName}
                            </div>

                            {Array.isArray(e.details) && e.details.length > 0 ? (
                              e.details.map((d, i) => (
                                <div key={i} style={{ fontSize: 12, opacity: 0.85, marginTop: 4 }}>
                                  {evoRequirementDe(d)}
                                </div>
                              ))
                            ) : (
                              <div style={{ fontSize: 12, opacity: 0.65, marginTop: 4 }}>Basisform</div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* ✅ Catchrate Rechner Modal (DEIN EXISTIERENDER CODE) */}
            {showCatchCalc && (
              <div
                onClick={() => setShowCatchCalc(false)}
                style={{
                  position: "fixed",
                  inset: 0,
                  background: "rgba(0,0,0,0.55)",
                  backdropFilter: "blur(8px)",
                  zIndex: 99999,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: 14,
                }}
              >
                <div
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    width: "min(520px, 94vw)",
                    borderRadius: 18,
                    border: "1px solid rgba(255,255,255,0.14)",
                    background: "rgba(10,10,16,0.88)",
                    boxShadow: "0 30px 90px rgba(0,0,0,0.65)",
                    padding: 14,
                    color: "white",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
                    <div style={{ fontWeight: 950, fontSize: 16 }}>
                      Catchrate Rechner – {getLocalizedName(species?.names, "de") || cap(pokemon?.name)}
                    </div>
                    <button
                      style={{
                        padding: "8px 10px",
                        borderRadius: 12,
                        border: "1px solid rgba(255,255,255,0.14)",
                        background: "rgba(255,255,255,0.06)",
                        color: "white",
                        cursor: "pointer",
                        fontWeight: 900,
                      }}
                      onClick={() => setShowCatchCalc(false)}
                      title="Schließen"
                    >
                      ✕
                    </button>
                  </div>

                  <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
                    {/* Ball */}
                    <div style={{ display: "grid", gap: 6 }}>
                      <div style={{ opacity: 0.85, fontWeight: 800 }}>Ball</div>
                      <select
                        className="pinfo-select"
                        value={ccBall}
                        onChange={(e) => setCcBall(e.target.value)}
                        style={{
                          width: "100%",
                          padding: 10,
                          borderRadius: 12,
                          fontWeight: 800,
                        }}
                      >
                        {getBallsForGen(selectedGen).map((b) => (
                          <option key={b.key} value={b.key}>
                            {b.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Status */}
                    <div style={{ display: "grid", gap: 6 }}>
                      <div style={{ opacity: 0.85, fontWeight: 800 }}>Status</div>
                      <select
                        className="pinfo-select"
                        value={ccStatus}
                        onChange={(e) => setCcStatus(e.target.value)}
                        style={{
                          width: "100%",
                          padding: 10,
                          borderRadius: 12,
                          fontWeight: 800,
                        }}
                      >
                        <option value="none">Kein Status</option>
                        <option value="par">Paralyse</option>
                        <option value="poison">Gift</option>
                        <option value="burn">Verbrennung</option>
                        <option value="sleep">Schlaf</option>
                        <option value="freeze">Gefroren</option>
                      </select>
                    </div>

                    {/* HP Balken */}
                    <div style={{ display: "grid", gap: 6 }}>
                      <div style={{ opacity: 0.85, fontWeight: 800 }}>KP (Balken)</div>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, opacity: 0.85 }}>
                        <span>1%</span>
                        <span>{ccHpPct}%</span>
                        <span>100%</span>
                      </div>
                      <input
                        className="pinfo-range"
                        type="range"
                        min="1"
                        max="100"
                        value={ccHpPct}
                        onChange={(e) => setCcHpPct(Number(e.target.value))}
                      />
                    </div>

                    {/* Zusatz-Optionen (gen-/ball-abhängig) */}
                    {ccBall === "timer" && (
                      <div style={{ display: "grid", gap: 6 }}>
                        <div style={{ opacity: 0.85, fontWeight: 800 }}>Runde im Kampf (Timerball)</div>
                        {(() => {
                          const maxRound = Number(selectedGen) <= 4 ? 31 : 11;
                          const opts = [];
                          for (let r = 1; r <= maxRound; r++) opts.push(r);
                          return (
                            <select
                              className="pinfo-select"
                              value={ccTurn}
                              onChange={(e) => setCcTurn(Number(e.target.value))}
                              style={{ width: "100%", padding: 10, borderRadius: 12, fontWeight: 800 }}
                            >
                              {opts.map((r) => (
                                <option key={r} value={r}>
                                  Runde {r}
                                </option>
                              ))}
                            </select>
                          );
                        })()}
                        <div style={{ opacity: 0.75, fontSize: 12 }}>Hinweis: Ab der Maximal-Runde steigt der Effekt nicht weiter.</div>
                      </div>
                    )}

                    {ccBall === "quick" && (
                      <div style={{ display: "grid", gap: 6 }}>
                        <div style={{ opacity: 0.85, fontWeight: 800 }}>Runde im Kampf (Flottball)</div>
                        <select
                          className="pinfo-select"
                          value={ccTurn}
                          onChange={(e) => setCcTurn(Number(e.target.value))}
                          style={{ width: "100%", padding: 10, borderRadius: 12, fontWeight: 800 }}
                        >
                          <option value={1}>Runde 1 (Bonus aktiv)</option>
                          <option value={2}>Runde 2+ (kein Bonus)</option>
                        </select>
                      </div>
                    )}

                    {ccBall === "dusk" && (
                      <div style={{ display: "grid", gap: 6 }}>
                        <div style={{ opacity: 0.85, fontWeight: 800 }}>Umgebung (Finsterball)</div>
                        <label style={{ display: "flex", gap: 10, alignItems: "center", cursor: "pointer" }}>
                          <input type="checkbox" checked={ccDark} onChange={(e) => setCcDark(e.target.checked)} />
                          Nacht / Höhle
                        </label>
                      </div>
                    )}

                    {/* Ergebnis */}
                    {(() => {
                      const balls = getBallsForGen(selectedGen);
                      const ball = balls.find((b) => b.key === ccBall) || balls[0];
                      const captureRateLocal = species?.capture_rate ?? null;

                      const chance = estimateCatchChanceGen3Plus({
                        captureRate: Number(captureRateLocal),
                        ballMult: getBallMultiplier(ball, { gen: selectedGen, turnNumber: ccTurn, isDark: ccDark }),
                        statusBonus: getStatusBonus(ccStatus),
                        hpPct: ccHpPct,
                      });

                      const pctText = formatCatchChance(chance);

                      return (
                        <div
                          style={{
                            marginTop: 6,
                            padding: 12,
                            borderRadius: 14,
                            border: "1px solid rgba(255,255,255,0.14)",
                            background: "rgba(255,255,255,0.06)",
                          }}
                        >
                          <div style={{ fontWeight: 950 }}>Erwartete Fangchance</div>
                          <div style={{ fontSize: 28, fontWeight: 950, marginTop: 6 }}>{pctText}</div>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
