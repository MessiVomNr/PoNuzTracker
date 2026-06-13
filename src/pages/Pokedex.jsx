// src/pages/Pokedex.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { pokedex as fullPokedex } from "../data/pokedex.js";
import dexBg from "../assets/DexBackground.png";
import { megaFormsByBaseDexId, specialFormsByBaseDexId } from "../data/megaForms";

/** ✅ Falls deine Compare-Route anders heißt, nur DAS hier ändern */
const COMPARE_ROUTE = "/compare";

// =========================================================
// EXTRA SPECIAL FORMS (Rotom, Kyurem, usw.)
// =========================================================
const EXTRA_SPECIAL_FORMS_BY_BASEDEXID = {
  351: [
    { id: 10013, label: "Sonne" },
    { id: 10014, label: "Regen" },
    { id: 10015, label: "Schnee" },
  ],
  386: [
    { id: 10001, label: "Angriff" },
    { id: 10002, label: "Verteidigung" },
    { id: 10003, label: "Initiative" },
  ],
  413: [
    { id: 10004, label: "Sand" },
    { id: 10005, label: "Müll" },
  ],
  479: [
    { id: 10008, label: "Hitze" },
    { id: 10009, label: "Wasch" },
    { id: 10010, label: "Frost" },
    { id: 10011, label: "Wirbel" },
    { id: 10012, label: "Schneid" },
  ],
  487: [{ id: 10007, label: "Urform" }],
  492: [{ id: 10006, label: "Zenit" }],
  550: [{ id: 10016, label: "Blau" }],
  555: [{ id: 10017, label: "Zen" }],
  648: [{ id: 10018, label: "Tanz" }],
  641: [{ id: 10019, label: "Tiergeist" }],
  642: [{ id: 10020, label: "Tiergeist" }],
  645: [{ id: 10021, label: "Tiergeist" }],
  646: [
    { id: 10022, label: "Schwarz" },
    { id: 10023, label: "Weiß" },
  ],
  647: [{ id: 10024, label: "Resolut" }],
  678: [{ id: 10025, label: "Weiblich" }],
  681: [{ id: 10026, label: "Klinge" }],
  710: [
    { id: 10027, label: "Klein" },
    { id: 10028, label: "Groß" },
    { id: 10029, label: "Riesig" },
  ],
  711: [
    { id: 10030, label: "Klein" },
    { id: 10031, label: "Groß" },
    { id: 10032, label: "Riesig" },
  ],
};

function mergeFormsMap(a, b) {
  const out = {};
  const keys = new Set([...Object.keys(a || {}), ...Object.keys(b || {})]);
  for (const k of keys) {
    const left = Array.isArray(a?.[k]) ? a[k] : [];
    const right = Array.isArray(b?.[k]) ? b[k] : [];
    const merged = [...left, ...right];

    const seen = new Set();
    const deduped = [];
    for (const f of merged) {
      const id = Number(f?.id);
      if (!Number.isFinite(id)) continue;
      if (seen.has(id)) continue;
      seen.add(id);
      deduped.push(f);
    }
    if (deduped.length) out[k] = deduped;
  }
  return out;
}

function getDexIdFromKey(key) {
  const m = String(key || "").match(/pokedex(\d+)/i);
  return m ? Number(m[1]) : null;
}

function cap(s) {
  return String(s || "")
    .replace(/-/g, " ")
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

// =====================
// GEN RANGES (NationalDex)
// =====================
const GEN_RANGES = [
  { gen: 1, from: 1, to: 151 },
  { gen: 2, from: 152, to: 251 },
  { gen: 3, from: 252, to: 386 },
  { gen: 4, from: 387, to: 493 },
  { gen: 5, from: 494, to: 649 },
  { gen: 6, from: 650, to: 721 },
  { gen: 7, from: 722, to: 809 },
  { gen: 8, from: 810, to: 905 },
  { gen: 9, from: 906, to: 1025 },
];

function genFromSpeciesId(speciesId) {
  const id = Number(speciesId);
  if (!Number.isFinite(id) || id <= 0) return null;
  for (const r of GEN_RANGES) {
    if (id >= r.from && id <= r.to) return r.gen;
  }
  return null;
}

const LS_KEYS = {
  gens: "pokedex_filter_gens_v4",
  forms: "pokedex_filter_forms_v4",
  apiIndex: "pokedex_api_index_v1",
  apiNameCache: "pokedex_api_name_cache_v2", // dexId -> { baseDe, gen }
  apiTypeCache: "pokedex_api_type_cache_v1", // dexId -> { types, typesDe }
  uiFilterOpen: "pokedex_filter_open_v1",

  favorites: "pokedex_favorites_v1", // csv dexIds
  onlyFav: "pokedex_only_favorites_v1", // "1"/"0"
  apiStatsCache: "pokedex_api_stats_cache_v1", // dexId -> { stats, total }
  apiEvoCache: "pokedex_api_evo_cache_v1", // dexId -> { chainDexIds: number[] }
};

const DEX_NAV_STATE_KEY = "pokedex_nav_state_v1";

function readCsvSet(key, fallbackArr) {
  const raw = (localStorage.getItem(key) || "").trim();
  if (!raw) return new Set(fallbackArr);
  const arr = raw
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
  return new Set(arr.length ? arr : fallbackArr);
}

function writeCsvSet(key, setObj) {
  const arr = Array.from(setObj || []);
  localStorage.setItem(key, arr.join(","));
}

function readJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}
function writeJson(key, val) {
  try {
    localStorage.setItem(key, JSON.stringify(val));
  } catch {}
}

function normText(s) {
  return String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

// =====================
// PokeAPI helpers
// =====================
function getIdFromSpeciesUrl(url) {
  const m = String(url || "").match(/\/pokemon-species\/(\d+)\//);
  return m ? Number(m[1]) : null;
}

function getIdFromPokemonUrl(url) {
  const m = String(url || "").match(/\/pokemon\/(\d+)\//);
  return m ? Number(m[1]) : null;
}

function getLocalizedName(namesArr, lang = "de") {
  const arr = Array.isArray(namesArr) ? namesArr : [];
  const hit = arr.find((n) => n?.language?.name === lang);
  return hit?.name || null;
}

// for API-only forms
function prettyFormSuffixDe(apiName) {
  const n = String(apiName || "").toLowerCase();

  if (n.includes("-mega")) {
    if (n.endsWith("-mega-x")) return "Mega X";
    if (n.endsWith("-mega-y")) return "Mega Y";
    return "Mega";
  }
  if (n.includes("-gmax")) return "Gigas";

  let s = n.replace(/-/g, " ");
  s = s.replace(/\bgmax\b/g, "Gigas");
  s = s.replace(/\balola\b/g, "Alola");
  s = s.replace(/\bgalar\b/g, "Galar");
  s = s.replace(/\bhisui\b/g, "Hisui");
  s = s.replace(/\bpaldea\b/g, "Paldea");
  s = s.replace(/\borigin\b/g, "Urform");
  s = s.replace(/\bsky\b/g, "Zenit");
  s = s.replace(/\btherian\b/g, "Tiergeist");
  s = s.replace(/\bblack\b/g, "Schwarz");
  s = s.replace(/\bwhite\b/g, "Weiß");

  return cap(s);
}

function apiSpecialFormDisplayName(apiName, baseDe) {
  const n = String(apiName || "").toLowerCase();
  const name = String(baseDe || "").trim();

  if (!name) return prettyFormSuffixDe(apiName);

  const regionForms = [
    { key: "-alola", label: "Alola" },
    { key: "-galar", label: "Galar" },
    { key: "-hisui", label: "Hisui" },
    { key: "-paldea", label: "Paldea" },
  ];

  const region = regionForms.find((f) => n.includes(f.key));
  if (region) return `${region.label}-${name}`;

  const namedForms = [
    { key: "-origin", label: "Urform" },
    { key: "-sky", label: "Zenit" },
    { key: "-therian", label: "Tiergeist" },
    { key: "-black", label: "Schwarz" },
    { key: "-white", label: "Weiß" },
    { key: "-blade", label: "Klinge" },
    { key: "-zen", label: "Zen" },
    { key: "-resolute", label: "Resolut" },
    { key: "-female", label: "Weiblich" },
  ];

  const form = namedForms.find((f) => n.includes(f.key));
  if (form) return `${form.label}-${name}`;

  return name;
}

function officialArtworkUrl(dexId) {
  const id = Number(dexId);
  if (!Number.isFinite(id) || id <= 0) return "";
  return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${id}.png`;
}

// =====================
// Types (DE) + Icons + Colors
// =====================
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

// =====================
// Form classification (for filtering)
// =====================
function isApiGigas(apiName) {
  return String(apiName || "").toLowerCase().includes("-gmax");
}

// =====================
// EVO CHAIN parser
// =====================
function flattenEvoChain(chainNode) {
  const out = [];
  function walk(node) {
    if (!node) return;
    const sid = getIdFromSpeciesUrl(node?.species?.url);
    if (Number.isFinite(sid)) out.push(sid);
    const next = Array.isArray(node?.evolves_to) ? node.evolves_to : [];
    next.forEach(walk);
  }
  walk(chainNode);
  // dedupe, keep order
  const seen = new Set();
  const ded = [];
  for (const x of out) {
    if (seen.has(x)) continue;
    seen.add(x);
    ded.push(x);
  }
  return ded;
}

export default function Pokedex() {
  const nav = useNavigate();

  // ✅ Lock background scroll
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

  // UI: Filter fold/unfold
  const [filtersOpen, setFiltersOpen] = useState(() => {
    const raw = localStorage.getItem(LS_KEYS.uiFilterOpen);
    if (raw === "0") return false;
    if (raw === "1") return true;
    return true;
  });

  useEffect(() => {
    localStorage.setItem(LS_KEYS.uiFilterOpen, filtersOpen ? "1" : "0");
  }, [filtersOpen]);

  // Favorites
  const [favorites, setFavorites] = useState(() => readCsvSet(LS_KEYS.favorites, [])); // set of dexId strings
  useEffect(() => writeCsvSet(LS_KEYS.favorites, favorites), [favorites]);

  const [onlyFav, setOnlyFav] = useState(() => localStorage.getItem(LS_KEYS.onlyFav) === "1");
  useEffect(() => localStorage.setItem(LS_KEYS.onlyFav, onlyFav ? "1" : "0"), [onlyFav]);

  function isFav(dexId) {
    const id = String(Number(dexId));
    return favorites.has(id);
  }

  function toggleFav(dexId) {
    const id = String(Number(dexId));
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // Filters
  const [selectedGens, setSelectedGens] = useState(() =>
    readCsvSet(
      LS_KEYS.gens,
      GEN_RANGES.map((g) => String(g.gen))
    )
  );

  // Formen: alle / normal / megas / gigas / special
  const [selectedForms, setSelectedForms] = useState(() =>
    readCsvSet(LS_KEYS.forms, ["normal", "mega", "gigas", "special"])
  );

  useEffect(() => writeCsvSet(LS_KEYS.gens, selectedGens), [selectedGens]);
  useEffect(() => writeCsvSet(LS_KEYS.forms, selectedForms), [selectedForms]);

  function toggleSet(setter, key) {
    setter((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  const [query, setQuery] = useState("");

  // Scroll container ref (for restoring scrollTop)
  const listRef = useRef(null);

  // PokeAPI index (cached)
  const [apiIndex, setApiIndex] = useState(() => {
    const cached = readJson(LS_KEYS.apiIndex, null);
    return Array.isArray(cached) ? cached : null; // [{dexId, apiName}]
  });
  const [apiIndexLoading, setApiIndexLoading] = useState(false);
  const [apiIndexErr, setApiIndexErr] = useState("");

  // dexId -> { baseDe, gen }
  const [apiNameCache, setApiNameCache] = useState(() => {
    const cached = readJson(LS_KEYS.apiNameCache, {});
    return cached && typeof cached === "object" ? cached : {};
  });
  useEffect(() => writeJson(LS_KEYS.apiNameCache, apiNameCache), [apiNameCache]);

  // dexId -> { types, typesDe }
  const [typeCache, setTypeCache] = useState(() => {
    const cached = readJson(LS_KEYS.apiTypeCache, {});
    return cached && typeof cached === "object" ? cached : {};
  });
  useEffect(() => writeJson(LS_KEYS.apiTypeCache, typeCache), [typeCache]);

  // dexId -> { stats, total }
  const [statsCache, setStatsCache] = useState(() => {
    const cached = readJson(LS_KEYS.apiStatsCache, {});
    return cached && typeof cached === "object" ? cached : {};
  });
  useEffect(() => writeJson(LS_KEYS.apiStatsCache, statsCache), [statsCache]);

  // dexId -> { chainDexIds }
  const [evoCache, setEvoCache] = useState(() => {
    const cached = readJson(LS_KEYS.apiEvoCache, {});
    return cached && typeof cached === "object" ? cached : {};
  });
  useEffect(() => writeJson(LS_KEYS.apiEvoCache, evoCache), [evoCache]);

  // Quick Info toggle
  const [quickOpen, setQuickOpen] = useState(false);

  // =====================
  // State save/restore for "go to pokemon and back"
  // =====================
  const [idx, setIdx] = useState(0); // declared early for restore to work

  function saveDexNavState(snapshotOverride) {
    try {
      const payload =
        snapshotOverride && typeof snapshotOverride === "object"
          ? snapshotOverride
          : {
              idx,
              query,
              selectedGens: Array.from(selectedGens),
              selectedForms: Array.from(selectedForms),
              filtersOpen,
              scrollTop: listRef.current ? listRef.current.scrollTop : 0,
            };
      sessionStorage.setItem(DEX_NAV_STATE_KEY, JSON.stringify(payload));
    } catch {
      // ignore
    }
  }

  // Restore once on mount
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(DEX_NAV_STATE_KEY);
      if (!raw) return;
      const st = JSON.parse(raw);

      if (st && typeof st === "object") {
        if (typeof st.query === "string") setQuery(st.query);
        if (Array.isArray(st.selectedGens)) setSelectedGens(new Set(st.selectedGens));
        if (Array.isArray(st.selectedForms)) setSelectedForms(new Set(st.selectedForms));
        if (typeof st.filtersOpen === "boolean") setFiltersOpen(st.filtersOpen);
        if (Number.isFinite(st.idx)) setIdx(st.idx);

        const t = window.setTimeout(() => {
          if (listRef.current && Number.isFinite(st.scrollTop)) {
            listRef.current.scrollTop = st.scrollTop;
          }
        }, 0);

        return () => window.clearTimeout(t);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    let alive = true;

    async function run() {
      if (apiIndex && apiIndex.length) return;

      try {
        setApiIndexLoading(true);
        setApiIndexErr("");

        const res = await fetch("https://pokeapi.co/api/v2/pokemon?limit=200000&offset=0");
        if (!res.ok) throw new Error("PokeAPI Index konnte nicht geladen werden.");
        const data = await res.json();

        const results = Array.isArray(data?.results) ? data.results : [];
        const out = [];
        for (const r of results) {
          const url = String(r?.url || "");
          const m = url.match(/\/pokemon\/(\d+)\//);
          const id = m ? Number(m[1]) : null;
          if (!Number.isFinite(id) || id <= 0) continue;
          const apiName = String(r?.name || "").trim();
          if (!apiName) continue;
          out.push({ dexId: id, apiName });
        }

        const seen = new Set();
        const deduped = [];
        for (const e of out) {
          if (seen.has(e.dexId)) continue;
          seen.add(e.dexId);
          deduped.push(e);
        }

        if (!alive) return;
        setApiIndex(deduped);
        writeJson(LS_KEYS.apiIndex, deduped);
      } catch (e) {
        if (!alive) return;
        setApiIndexErr(e?.message || "Fehler beim Laden des Formen-Index.");
        setApiIndex(null);
      } finally {
        if (!alive) return;
        setApiIndexLoading(false);
      }
    }

    run();
    return () => {
      alive = false;
    };
  }, [apiIndex]);

  // Build base lists (local) + API base species (Gen8/9 completeness)
  const baseData = useMemo(() => {
    const baseEntries = Object.entries(fullPokedex || {});
    const baseArr = baseEntries
      .map(([k, name]) => ({
        dexId: getDexIdFromKey(k),
        nameDe: name,
        kind: "normal",
        gen: null,
        apiName: null,
        baseId: null,
      }))
      .filter((x) => Number.isFinite(x.dexId))
      .sort((a, b) => a.dexId - b.dexId);

    for (const p of baseArr) p.gen = genFromSpeciesId(p.dexId);

    const baseNameById = new Map(baseArr.map((p) => [p.dexId, p.nameDe]));
    const baseIds = new Set(baseArr.map((p) => p.dexId));
    const maxLocalDexId = baseArr.length ? Math.max(...baseArr.map((p) => p.dexId)) : 0;

    // Megas (local)
    const megaArr = [];
    const megaIds = new Set();
    for (const [baseIdStr, forms] of Object.entries(megaFormsByBaseDexId || {})) {
      const baseId = Number(baseIdStr);
      const baseName = baseNameById.get(baseId) || `#${baseId}`;
      (forms || []).forEach((f) => {
        const label = String(f.label || "Mega").trim();
        const suffix = label === "Mega" ? "" : ` ${label.replace(/^Mega/i, "").trim()}`;
        const dexId = Number(f.id);
        if (!Number.isFinite(dexId)) return;
        megaIds.add(dexId);
        megaArr.push({
          dexId,
          nameDe: `Mega-${baseName}${suffix}`.trim(),
          kind: "mega",
          baseId,
          gen: genFromSpeciesId(baseId),
          apiName: null,
        });
      });
    }

    // Specials (local)
    const mergedSpecial = mergeFormsMap(specialFormsByBaseDexId || {}, EXTRA_SPECIAL_FORMS_BY_BASEDEXID);
    const specialArr = [];
    const specialIds = new Set();
    for (const [baseIdStr, forms] of Object.entries(mergedSpecial || {})) {
      const baseId = Number(baseIdStr);
      const baseName = baseNameById.get(baseId) || `#${baseId}`;
      (forms || []).forEach((f) => {
        const label = String(f.label || "Form").trim();
        const dexId = Number(f.id);
        if (!Number.isFinite(dexId)) return;
        specialIds.add(dexId);
        specialArr.push({
          dexId,
          nameDe: `${label}-${baseName}`.trim(),
          kind: "special",
          baseId,
          gen: genFromSpeciesId(baseId),
          apiName: null,
        });
      });
    }

    // API extras
    const apiBaseExtras = [];
    const apiMegaExtra = [];
    const apiGigasExtra = [];
    const apiSpecialExtra = [];

    if (Array.isArray(apiIndex)) {
      for (const e of apiIndex) {
        const id = Number(e.dexId);
        if (!Number.isFinite(id) || id <= 0) continue;

        const apiName = String(e.apiName || "");

        // missing base species (Gen8/9 etc.)
        if (!baseIds.has(id) && id < 10000 && !apiName.includes("-")) {
          if (id > maxLocalDexId) {
            apiBaseExtras.push({
              dexId: id,
              nameDe: null,
              kind: "normal_api",
              baseId: null,
              gen: apiNameCache[id]?.gen ?? null,
              apiName,
            });
          }
          continue;
        }

        // forms
        if (baseIds.has(id)) continue;
        const hasDash = apiName.includes("-");
        const isMega = apiName.includes("-mega");
        const isGigas = isApiGigas(apiName);
        const isFormCandidate = hasDash || id >= 10000;
        if (!isFormCandidate) continue;

        if (isGigas) {
          apiGigasExtra.push({
            dexId: id,
            nameDe: null,
            kind: "gigas_api",
            baseId: null,
            gen: apiNameCache[id]?.gen ?? null,
            apiName,
          });
        } else if (isMega) {
          if (megaIds.has(id)) continue;
          apiMegaExtra.push({
            dexId: id,
            nameDe: null,
            kind: "mega_api",
            baseId: null,
            gen: apiNameCache[id]?.gen ?? null,
            apiName,
          });
        } else {
          if (specialIds.has(id)) continue;
          apiSpecialExtra.push({
            dexId: id,
            nameDe: null,
            kind: "special_api",
            baseId: null,
            gen: apiNameCache[id]?.gen ?? null,
            apiName,
          });
        }
      }
    }

    return {
      baseArr: [...baseArr, ...apiBaseExtras],
      megaArr: [...megaArr, ...apiMegaExtra],
      gigasArr: [...apiGigasExtra],
      specialArr: [...specialArr, ...apiSpecialExtra],
    };
  }, [apiIndex, apiNameCache]);

  // Apply filters + sort
  const rawList = useMemo(() => {
    const gens = new Set(Array.from(selectedGens).map((x) => Number(x)));
    const forms = new Set(Array.from(selectedForms).map((x) => String(x)));

    const out = [];
    if (forms.has("normal")) out.push(...baseData.baseArr);
    if (forms.has("mega")) out.push(...baseData.megaArr);
    if (forms.has("gigas")) out.push(...baseData.gigasArr);
    if (forms.has("special")) out.push(...baseData.specialArr);

    const filtered = out.filter((p) => {
      const g = Number(p.gen);
      if (!Number.isFinite(g) || g <= 0) return true;
      return gens.has(g);
    });

    filtered.sort((a, b) => Number(a.dexId) - Number(b.dexId));
    return filtered;
  }, [baseData, selectedGens, selectedForms]);

  // Display names (no parentheses)
  function getDisplayName(p, cache) {
    if (p?.nameDe) return p.nameDe;

    const id = Number(p?.dexId);
    const baseDe = Number.isFinite(id) ? cache?.[id]?.baseDe : null;
    const apiName = String(p?.apiName || "");

    if (baseDe) {
      if (p.kind === "mega_api") {
        const isX = apiName.endsWith("-mega-x");
        const isY = apiName.endsWith("-mega-y");
        return `Mega-${baseDe}${isX ? " X" : isY ? " Y" : ""}`.trim();
      }
      if (p.kind === "gigas_api") return `Gigas-${baseDe}`;
      if (p.kind === "special_api") {
        return apiSpecialFormDisplayName(apiName, baseDe);
      }
      return baseDe; // normal_api
    }

    if (apiName) {
      if (p.kind === "gigas_api") return `Gigas-${cap(apiName)}`;
      if (p.kind === "special_api") {
        const suf = prettyFormSuffixDe(apiName);
        return suf ? `${suf}-${cap(apiName)}` : cap(apiName);
      }
      return cap(apiName);
    }

    return `#${p?.dexId}`;
  }

  const list = useMemo(() => {
    const q = normText(query.trim());
    let out = rawList;

    if (onlyFav) {
      out = out.filter((p) => isFav(p.dexId));
    }

    if (!q) return out;

    return out.filter((p) => {
      const name = getDisplayName(p, apiNameCache);
      return normText(name).includes(q) || String(p.dexId) === q;
    });
  }, [rawList, query, apiNameCache, onlyFav, favorites]);

  // Keep idx in range when list changes
  useEffect(() => setIdx((v) => clamp(v, 0, Math.max(0, list.length - 1))), [list.length]);

  const current = list[idx] || null;
  const currentName = current ? getDisplayName(current, apiNameCache) : "";

  // Resolve German name + gen for API entries
  async function resolveGermanNameAndGenIfNeeded(entry) {
    const id = Number(entry?.dexId);
    if (!Number.isFinite(id) || id <= 0) return;

    if (entry?.nameDe) return;
    if (apiNameCache[id]?.baseDe) return;

    try {
      const pRes = await fetch(`https://pokeapi.co/api/v2/pokemon/${id}`);
      if (!pRes.ok) return;
      const p = await pRes.json();

      const speciesId = getIdFromSpeciesUrl(p?.species?.url) || null;
      const gen = speciesId ? genFromSpeciesId(speciesId) : null;

      let baseDe = null;
      if (speciesId) {
        const sRes = await fetch(`https://pokeapi.co/api/v2/pokemon-species/${speciesId}`);
        if (sRes.ok) {
          const s = await sRes.json();
          baseDe = getLocalizedName(s?.names, "de") || cap(s?.name);
        }
      }
      if (!baseDe) baseDe = cap(entry?.apiName || `#${id}`);

      setApiNameCache((prev) => ({
        ...prev,
        [id]: { baseDe, gen },
      }));
    } catch {}
  }

  async function resolveTypesIfNeeded(entry) {
    const id = Number(entry?.dexId);
    if (!Number.isFinite(id) || id <= 0) return;
    if (typeCache[id]?.types?.length) return;

    try {
      const pRes = await fetch(`https://pokeapi.co/api/v2/pokemon/${id}`);
      if (!pRes.ok) return;
      const p = await pRes.json();

      const types = (p?.types || [])
        .map((t) => String(t?.type?.name || "").trim())
        .filter(Boolean);
      const typesDe = types.map((t) => TYPE_DE[t] || cap(t));

      setTypeCache((prev) => ({
        ...prev,
        [id]: { types, typesDe },
      }));
    } catch {}
  }

  async function resolveStatsIfNeeded(entry) {
    const id = Number(entry?.dexId);
    if (!Number.isFinite(id) || id <= 0) return;
    if (statsCache[id]?.stats) return;

    try {
      const pRes = await fetch(`https://pokeapi.co/api/v2/pokemon/${id}`);
      if (!pRes.ok) return;
      const p = await pRes.json();

      const statsArr = Array.isArray(p?.stats) ? p.stats : [];
      const map = {};
      for (const s of statsArr) {
        const k = String(s?.stat?.name || "");
        const v = Number(s?.base_stat);
        if (!k || !Number.isFinite(v)) continue;
        map[k] = v;
      }

      const hp = map.hp ?? null;
      const atk = map.attack ?? null;
      const def = map.defense ?? null;
      const spa = map["special-attack"] ?? null;
      const spd = map["special-defense"] ?? null;
      const spe = map.speed ?? null;

      const nums = [hp, atk, def, spa, spd, spe].filter((x) => Number.isFinite(x));
      const total = nums.reduce((a, b) => a + b, 0);

      setStatsCache((prev) => ({
        ...prev,
        [id]: { stats: { hp, atk, def, spa, spd, spe }, total },
      }));
    } catch {}
  }

  async function resolveEvoChainIfNeeded(entry) {
    const id = Number(entry?.dexId);
    if (!Number.isFinite(id) || id <= 0) return;
    if (evoCache[id]?.chainDexIds?.length) return;

    try {
      const pRes = await fetch(`https://pokeapi.co/api/v2/pokemon/${id}`);
      if (!pRes.ok) return;
      const p = await pRes.json();

      const speciesId = getIdFromSpeciesUrl(p?.species?.url);
      if (!Number.isFinite(speciesId)) return;

      const sRes = await fetch(`https://pokeapi.co/api/v2/pokemon-species/${speciesId}`);
      if (!sRes.ok) return;
      const species = await sRes.json();

      const evoUrl = String(species?.evolution_chain?.url || "");
      if (!evoUrl) return;

      const eRes = await fetch(evoUrl);
      if (!eRes.ok) return;
      const evo = await eRes.json();

      const chainSpeciesIds = flattenEvoChain(evo?.chain);
      if (!chainSpeciesIds.length) return;

      // speciesId == national dex id for base species, usable for official artwork
      const chainDexIds = chainSpeciesIds.map((x) => Number(x)).filter((x) => Number.isFinite(x) && x > 0);

      setEvoCache((prev) => ({
        ...prev,
        [id]: { chainDexIds },
      }));

      // warm name cache (nice UX)
      for (const dex of chainDexIds) {
        if (!apiNameCache[dex]?.baseDe && !fullPokedex?.[`pokedex${dex}`]) {
          // create a tiny entry-like object for resolver
          await resolveGermanNameAndGenIfNeeded({ dexId: dex, nameDe: null, apiName: null, kind: "normal_api" });
        }
      }
    } catch {}
  }

  // Prefetch around current (fast + cached)
  useEffect(() => {
    let alive = true;
    async function run() {
      const chunk = [];
      for (let d = -70; d <= 70; d++) {
        const p = list[idx + d];
        if (p) chunk.push(p);
      }
      for (const e of chunk) {
        if (!alive) return;
        if (!e.nameDe) await resolveGermanNameAndGenIfNeeded(e);
        await resolveTypesIfNeeded(e);
      }
    }
    if (list.length) run();
    return () => {
      alive = false;
    };
  }, [idx, list]);

  useEffect(() => {
    if (!current) return;
    if (!current.nameDe) resolveGermanNameAndGenIfNeeded(current);
    resolveTypesIfNeeded(current);

    // Quick info prefetch (lightweight)
    resolveStatsIfNeeded(current);
    resolveEvoChainIfNeeded(current);
  }, [current?.dexId]);

  // Navigation (wheel / keyboard)
  const lockRef = useRef(false);
  function step(delta) {
    setIdx((v) => clamp(v + delta, 0, list.length - 1));
  }
  function onWheel(e) {
    if (lockRef.current) return;
    const dy = e.deltaY || 0;
    if (Math.abs(dy) < 6) return;
    lockRef.current = true;
    step(dy > 0 ? 1 : -1);
    window.setTimeout(() => (lockRef.current = false), 90);
  }

  useEffect(() => {
    function onKey(e) {
      if (e.key === "ArrowDown") step(1);
      if (e.key === "ArrowUp") step(-1);
      if (e.key === "PageDown") step(10);
      if (e.key === "PageUp") step(-10);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [list.length]);

  // Styles
  const page = {
    minHeight: "100vh",
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

  const overlay = {
    border: "1px solid var(--pnt-border, rgba(137, 155, 184, 0.28))",
    background:
      "linear-gradient(180deg, rgba(10, 18, 33, 0.92), rgba(6, 12, 24, 0.9))",
    borderRadius: "var(--pnt-radius, 14px)",
    padding: 16,
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
    fontWeight: 900,
    whiteSpace: "nowrap",
    boxShadow:
      "inset 0 1px 0 rgba(255, 255, 255, 0.04), 0 10px 24px rgba(0, 0, 0, 0.18)",
    transition:
      "transform 0.15s ease, background 0.15s ease, border-color 0.15s ease",
  };

  const input = {
    width: "100%",
    minHeight: 48,
    boxSizing: "border-box",
    padding: "11px 13px",
    borderRadius: 10,
    border: "1px solid rgba(137, 155, 184, 0.28)",
    background:
      "linear-gradient(180deg, rgba(10, 19, 34, 0.94), rgba(8, 15, 28, 0.94))",
    color: "var(--pnt-text, white)",
    outline: "none",
    fontWeight: 900,
    boxShadow: "inset 0 1px 0 rgba(255, 255, 255, 0.035)",
  };

  const chip = (active) => ({
    minHeight: 34,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "0 12px",
    borderRadius: 999,
    border: active
      ? "1px solid rgba(52, 211, 153, 0.56)"
      : "1px solid rgba(137, 155, 184, 0.24)",
    background: active
      ? "linear-gradient(135deg, rgba(52, 211, 153, 0.22), rgba(34, 197, 94, 0.12))"
      : "rgba(5, 11, 21, 0.34)",
    color: active ? "#dcfce7" : "rgba(235, 241, 250, 0.78)",
    cursor: "pointer",
    userSelect: "none",
    fontWeight: 950,
    opacity: active ? 1 : 0.88,
    boxShadow: active ? "0 10px 24px rgba(0, 0, 0, 0.22)" : "none",
    transition:
      "transform 0.15s ease, background 0.15s ease, border-color 0.15s ease",
  });

  const badge = (active) => ({
    fontSize: 12,
    fontWeight: 950,
    padding: "3px 8px",
    borderRadius: 999,
    border: active ? "1px solid rgba(255,255,255,0.34)" : "1px solid rgba(255,255,255,0.14)",
    background: active ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.06)",
    opacity: 0.95,
  });

  const smallRow = (active) => ({
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "12px 14px",
    borderRadius: "var(--pnt-radius, 12px)",
    border: active
      ? "1px solid rgba(86, 220, 170, 0.46)"
      : "1px solid rgba(137, 155, 184, 0.18)",
    background: active
      ? "radial-gradient(circle at 0% 0%, rgba(52, 211, 153, 0.13), transparent 42%), rgba(5, 11, 21, 0.42)"
      : "linear-gradient(180deg, rgba(13, 24, 42, 0.68), rgba(9, 17, 31, 0.66))",
    boxShadow: active
      ? "0 0 0 1px rgba(255,255,255,0.08), 0 16px 40px rgba(0,0,0,0.45)"
      : "inset 0 1px 0 rgba(255,255,255,0.035)",
    cursor: "pointer",
    opacity: active ? 1 : 0.92,
    transition:
      "transform 0.15s ease, background 0.15s ease, border-color 0.15s ease, opacity 0.15s ease",
  });

  const centerCard = {
    borderRadius: 18,
    border: "1px solid rgba(86, 220, 170, 0.28)",
    background:
      "radial-gradient(circle at 0% 0%, rgba(52, 211, 153, 0.12), transparent 42%), linear-gradient(180deg, rgba(13, 24, 42, 0.78), rgba(9, 17, 31, 0.78))",
    padding: 16,
    boxShadow:
      "0 18px 60px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.045)",
  };

  // Type pills
  const typePill = (active, typeEn) => {
    const c = typeColor(typeEn);
    return {
      display: "inline-flex",
      alignItems: "center",
      gap: 8,
      padding: "6px 12px",
      borderRadius: 999,
      border: `1px solid ${c.bd}`,
      background: c.bg,
      boxShadow: active ? "0 12px 28px rgba(0,0,0,0.35)" : "none",
      fontSize: 12,
      fontWeight: 900,
      lineHeight: 1,
    };
  };

  const typeIconBubble = (active, typeEn) => {
    const c = typeColor(typeEn);
    return {
      width: 22,
      height: 22,
      borderRadius: 999,
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      border: `1px solid ${c.bd}`,
      background: active ? "rgba(0,0,0,0.18)" : "rgba(0,0,0,0.12)",
    };
  };

  function renderTypes(dexId, active) {
    const t = typeCache[dexId];
    if (!t?.types?.length) return null;

    return (
      <div style={{ marginTop: 8, display: "flex", gap: 10, flexWrap: "wrap" }}>
        {t.types.map((typeEn, ti) => (
          <div key={typeEn + ti} style={typePill(active, typeEn)}>
            <span style={typeIconBubble(active, typeEn)}>
              <img
                src={typeIconUrl(typeEn)}
                alt={typeEn}
                style={{ width: 14, height: 14, objectFit: "contain" }}
                onError={(e) => (e.currentTarget.style.display = "none")}
              />
            </span>
            <span style={{ opacity: 0.96 }}>{TYPE_DE[typeEn] || cap(typeEn)}</span>
          </div>
        ))}
      </div>
    );
  }

  function openPokemon(dexId) {
    saveDexNavState();
    nav(`/pokemon/${dexId}`);
  }

  function openCompare(leftDexId) {
  const id = Number(leftDexId);
  if (!Number.isFinite(id) || id <= 0) return;
  saveDexNavState();
  nav(`${COMPARE_ROUTE}/${id}`, { state: { leftDexId: id } });
}


  // Accent for quick info (based on first type)
  const currentTypes = current ? typeCache[current.dexId]?.types || [] : [];
  const accentType = currentTypes[0] || null;
  const accent = accentType ? typeColor(accentType) : { bg: "rgba(255,255,255,0.08)", bd: "rgba(255,255,255,0.18)" };

  function FavStar({ active, onClick, title }) {
    return (
      <button
        onClick={onClick}
        title={title}
        style={{
          appearance: "none",
          border: "1px solid rgba(255,255,255,0.14)",
          background: active ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.18)",
          cursor: "pointer",
          width: 38,
          height: 38,
          borderRadius: 12,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: active ? "0 14px 40px rgba(0,0,0,0.40)" : "none",
          transition: "120ms ease",
          color: "white",
          flex: "0 0 auto",
        }}
      >
        <span style={{ fontSize: 18, lineHeight: 1, opacity: active ? 1 : 0.85 }}>
          {active ? "★" : "☆"}
        </span>
      </button>
    );
  }

  function SmallFav({ active, onClick }) {
    return (
      <button
        onClick={onClick}
        title={active ? "Aus Favoriten entfernen" : "Zu Favoriten"}
        style={{
          appearance: "none",
          border: "1px solid rgba(255,255,255,0.10)",
          background: "rgba(0,0,0,0.18)",
          cursor: "pointer",
          width: 30,
          height: 30,
          borderRadius: 10,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          opacity: active ? 1 : 0.75,
        }}
      >
        <span style={{ fontSize: 14, lineHeight: 1 }}>{active ? "★" : "☆"}</span>
      </button>
    );
  }

  function renderEvoAndStats(dexId) {
  const evo = evoCache[dexId]?.chainDexIds || [];
  const st = statsCache[dexId];

  const statRows = st?.stats
    ? [
        { k: "hp", label: "KP", v: st.stats.hp },
        { k: "atk", label: "Ang", v: st.stats.atk },
        { k: "def", label: "Vert", v: st.stats.def },
        { k: "spa", label: "SpAng", v: st.stats.spa },
        { k: "spd", label: "SpVert", v: st.stats.spd },
        { k: "spe", label: "Init", v: st.stats.spe },
      ]
    : [];

  const max = 180;

  function statFillStyle(k) {
    // bewusst “Pokémon-like” Farben
    const map = {
      hp: { a: "rgba(70, 220, 140, 0.92)", b: "rgba(70, 220, 140, 0.28)" },    // grün
      atk: { a: "rgba(255, 92, 92, 0.92)", b: "rgba(255, 92, 92, 0.26)" },     // rot
      def: { a: "rgba(88, 140, 255, 0.92)", b: "rgba(88, 140, 255, 0.26)" },   // blau
      spa: { a: "rgba(185, 110, 255, 0.92)", b: "rgba(185, 110, 255, 0.26)" }, // lila
      spd: { a: "rgba(80, 220, 255, 0.92)", b: "rgba(80, 220, 255, 0.22)" },   // cyan
      spe: { a: "rgba(255, 210, 80, 0.92)", b: "rgba(255, 210, 80, 0.22)" },   // gelb
    };
    return map[k] || { a: "rgba(255,255,255,0.75)", b: "rgba(255,255,255,0.18)" };
  }

  return (
    <div
      style={{
        marginTop: 12,
        borderRadius: 16,
        border: `1px solid ${accent.bd}`,
        background: accent.bg,
        padding: 12,
        boxShadow: "0 18px 55px rgba(0,0,0,0.45)",
      }}
    >
      {/* EVO */}
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10 }}>
        <div style={{ fontWeight: 1000, letterSpacing: 0.2, opacity: 0.95 }}>Quick Info</div>
        <div style={{ fontSize: 12, opacity: 0.75, fontWeight: 900 }}>
          {st?.total ? (
            <>
              BST: <b>{st.total}</b>
            </>
          ) : (
            " "
          )}
        </div>
      </div>

      {evo.length ? (
        <div style={{ marginTop: 10 }}>
          <div style={{ fontSize: 12, opacity: 0.80, fontWeight: 900, marginBottom: 8 }}>Entwicklungsreihe</div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            {evo.map((eid, i) => {
              const nameLocal = fullPokedex?.[`pokedex${eid}`] || null;
              const name = nameLocal || apiNameCache?.[eid]?.baseDe || `#${eid}`;
              const active = Number(eid) === Number(dexId);

              return (
                <div key={eid + "-" + i} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <button
                    onClick={() => openPokemon(eid)}
                    title={active ? "Aktuell" : "Info öffnen"}
                    style={{
                      position: "relative",
                      appearance: "none",
                      color: "white",
                      textShadow: "0 1px 2px rgba(0,0,0,0.65)",
                      border: active ? `2px solid ${accent.bd}` : "1px solid rgba(255,255,255,0.14)",
                      background: active ? "rgba(0,0,0,0.26)" : "rgba(0,0,0,0.14)",
                      cursor: "pointer",
                      borderRadius: 14,
                      padding: "8px 10px",
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      transform: active ? "scale(1.03)" : "scale(1)",
                      boxShadow: active
                        ? `0 0 0 2px rgba(255,255,255,0.10), 0 18px 55px rgba(0,0,0,0.55), 0 0 22px ${accent.bd}`
                        : "none",
                      transition: "120ms ease",
                    }}
                  >
                    {/* kleine “Aktuell” Markierung */}
                    

                    <img
                      src={officialArtworkUrl(eid)}
                      alt={name}
                      style={{
                        width: 34,
                        height: 34,
                        objectFit: "contain",
                        filter: active ? "drop-shadow(0 8px 18px rgba(0,0,0,0.55))" : "none",
                      }}
                      loading="lazy"
                    />
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", lineHeight: 1.05 }}>
                      <div
                        style={{
                          fontWeight: 1000,
                          fontSize: 13,
                          maxWidth: 180,
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {name}
                      </div>
                      <div style={{ fontSize: 11, opacity: 0.72, fontWeight: 900 }}>#{eid}</div>
                    </div>
                  </button>

                  {i < evo.length - 1 ? <div style={{ opacity: 0.5, fontWeight: 1000, userSelect: "none" }}>›</div> : null}
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div style={{ marginTop: 10, fontSize: 12, opacity: 0.75 }}>Entwicklungsreihe lädt…</div>
      )}

      {/* STATS */}
      <div style={{ marginTop: 12 }}>
        <div style={{ fontSize: 12, opacity: 0.80, fontWeight: 900, marginBottom: 8 }}>Basiswerte</div>

        {statRows.length ? (
          <div style={{ display: "grid", gap: 8 }}>
            {statRows.map((r) => {
              const v = Number(r.v);
              const pct = Number.isFinite(v) ? Math.max(0, Math.min(1, v / max)) : 0;
              const col = statFillStyle(r.k);

              return (
                <div key={r.k} style={{ display: "grid", gridTemplateColumns: "54px 1fr 42px", gap: 10, alignItems: "center" }}>
                  <div style={{ fontSize: 12, opacity: 0.9, fontWeight: 950 }}>{r.label}</div>

                  <div
                    style={{
                      height: 10,
                      borderRadius: 999,
                      background: "rgba(0,0,0,0.18)",
                      border: "1px solid rgba(255,255,255,0.10)",
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        height: "100%",
                        width: `${pct * 100}%`,
                        borderRadius: 999,
                        background: `linear-gradient(90deg, ${col.a}, ${col.b})`,
                        boxShadow: `0 0 0 1px rgba(255,255,255,0.10) inset, 0 10px 22px rgba(0,0,0,0.35)`,
                      }}
                    />
                  </div>

                  <div style={{ textAlign: "right", fontSize: 12, fontWeight: 1000, opacity: 0.9 }}>
                    {Number.isFinite(v) ? v : "—"}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div style={{ fontSize: 12, opacity: 0.75 }}>Stats laden…</div>
        )}
      </div>
    </div>
  );
}


  return (
    <div style={page}>
      <style>{`
        .dex-scroll {
          scrollbar-width: none;
          -ms-overflow-style: none;
        }

        .dex-scroll::-webkit-scrollbar {
          width: 0;
          height: 0;
          display: none;
        }

        .dex-scroll > div {
          margin-bottom: 10px;
        }

        .dex-scroll > div:hover {
          transform: translateY(-1px);
          border-color: rgba(160, 178, 210, 0.34) !important;
          opacity: 1 !important;
        }

        input::placeholder {
          color: rgba(235, 241, 250, 0.46);
        }

        input:focus {
          border-color: rgba(52, 211, 153, 0.7) !important;
          box-shadow: 0 0 0 3px rgba(52, 211, 153, 0.14), inset 0 1px 0 rgba(255, 255, 255, 0.035) !important;
        }

        button:hover {
          transform: translateY(-1px);
        }

        button:active {
          transform: translateY(0);
        }

        /* CTA Buttons - clean, nicht "AI neon" */
        .dexCtaRow { display:flex; gap:10px; align-items:stretch; margin-top: 12px; flex-wrap: wrap; }
        .dexCtaBtn {
          appearance:none;
          border: 1px solid rgba(255,255,255,0.14);
          background: rgba(0,0,0,0.22);
          color: white;
          cursor:pointer;
          border-radius: 14px;
          padding: 10px 12px;
          font-weight: 950;
          display:flex;
          align-items:center;
          gap:10px;
          transition: transform 120ms ease, background 120ms ease, border 120ms ease, box-shadow 120ms ease;
          user-select:none;
          white-space:nowrap;
        }
        .dexCtaBtn:hover { transform: translateY(-1px); background: rgba(255,255,255,0.08); border-color: rgba(255,255,255,0.22); }
        .dexCtaBtn:active { transform: translateY(0px); }

        .dexCtaPrimary {
          border-color: rgba(255,255,255,0.22);
          background: linear-gradient(135deg, rgba(255,255,255,0.12), rgba(0,0,0,0.18));
          box-shadow: 0 14px 40px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,255,255,0.06) inset;
        }

        .dexCtaIcon {
          width: 30px;
          height: 30px;
          border-radius: 999px;
          display:flex;
          align-items:center;
          justify-content:center;
          border: 1px solid rgba(255,255,255,0.16);
          background: rgba(0,0,0,0.22);
          flex: 0 0 auto;
        }
        .dexCtaText { display:flex; flex-direction:column; line-height:1.05; }
        .dexCtaTitle { font-size: 13px; font-weight: 1000; letter-spacing: 0.2px; }
        .dexCtaSub { font-size: 11px; opacity: 0.72; margin-top: 2px; font-weight: 900; }

        .dexInfoPanel {
          border-radius: 16px;
          padding: 10px 10px 12px;
          border: 1px solid rgba(255,255,255,0.10);
          background: rgba(255,255,255,0.03);
          transition: 120ms ease;
        }
        .dexInfoPanel:hover {
          border-color: rgba(255,255,255,0.18);
          background: rgba(255,255,255,0.05);
        }
      `}</style>

      <div style={{ width: "min(980px, 96vw)", margin: "0 auto", paddingTop: 12 }}>
        {/* Header row */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr auto",
            gap: 12,
            alignItems: "center",
          }}
        >
          <h2 style={{ margin: 0 }}>Pokédex</h2>

          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", alignItems: "center" }}>
            <button style={btn} onClick={() => nav(-1)}>
              Zurück
            </button>
            <button
              style={{ ...btn, opacity: 0.95 }}
              onClick={() => {
                setSelectedGens(new Set(GEN_RANGES.map((g) => String(g.gen))));
                setSelectedForms(new Set(["normal", "mega", "gigas", "special"]));
                setQuery("");
                setIdx(0);
                setOnlyFav(false);
                setQuickOpen(false);
                if (listRef.current) listRef.current.scrollTop = 0;
                saveDexNavState({
                  idx: 0,
                  query: "",
                  selectedGens: GEN_RANGES.map((g) => String(g.gen)),
                  selectedForms: ["normal", "mega", "gigas", "special"],
                  filtersOpen,
                  scrollTop: 0,
                });
              }}
              title="Filter & Suche zurücksetzen"
            >
              Reset
            </button>
          </div>
        </div>

        <div style={{ ...overlay, marginTop: 12, maxHeight: "calc(100vh - 90px)", overflow: "hidden" }}>
          {/* Search + Filter toggle row */}
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setIdx(0);
              }}
              placeholder='Suche (z.B. "Glumanda", "Glu", "4")'
              style={input}
            />

            <button
              style={{ ...btn, width: 120 }}
              onClick={() => setFiltersOpen((v) => !v)}
              title="Filter ein-/ausklappen"
            >
              {filtersOpen ? "Filter ▲" : "Filter ▼"}
            </button>
          </div>

          {/* Filters (foldable) */}
          {filtersOpen && (
            <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
              <div>
                <div style={{ fontWeight: 950, opacity: 0.85, marginBottom: 6 }}>Generationen</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  <div
                    style={chip(selectedGens.size === GEN_RANGES.length)}
                    onClick={() => setSelectedGens(new Set(GEN_RANGES.map((g) => String(g.gen))))}
                  >
                    Alle
                  </div>
                  <div style={chip(selectedGens.size === 0)} onClick={() => setSelectedGens(new Set())}>
                    Keine
                  </div>

                  {GEN_RANGES.map((g) => {
                    const key = String(g.gen);
                    return (
                      <div key={key} style={chip(selectedGens.has(key))} onClick={() => toggleSet(setSelectedGens, key)}>
                        Gen {g.gen}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div>
                <div style={{ fontWeight: 950, opacity: 0.85, marginBottom: 6 }}>Formen</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  <div
                    style={chip(
                      selectedForms.has("normal") &&
                        selectedForms.has("mega") &&
                        selectedForms.has("gigas") &&
                        selectedForms.has("special")
                    )}
                    onClick={() => setSelectedForms(new Set(["normal", "mega", "gigas", "special"]))}
                  >
                    Alle
                  </div>

                  {[
                    { k: "normal", label: "Normal" },
                    { k: "mega", label: "Megas" },
                    { k: "gigas", label: "Gigas" },
                    { k: "special", label: "Special Formen" },
                  ].map((f) => (
                    <div key={f.k} style={chip(selectedForms.has(f.k))} onClick={() => toggleSet(setSelectedForms, f.k)}>
                      {f.label}
                    </div>
                  ))}

                  <div
                    style={chip(onlyFav)}
                    onClick={() => {
                      setOnlyFav((v) => !v);
                      setIdx(0);
                      if (listRef.current) listRef.current.scrollTop = 0;
                    }}
                    title="Nur Favoriten anzeigen"
                  >
                    Favoriten
                  </div>
                </div>
              </div>

              {(apiIndexLoading || apiIndexErr) && (
                <div style={{ opacity: 0.75, fontSize: 12 }}>
                  {apiIndexLoading ? "Formen/Gen8+ Index lädt (einmalig)…" : null}
                  {apiIndexErr ? ` ⚠ ${apiIndexErr}` : null}
                </div>
              )}
            </div>
          )}

          {/* List */}
          <div
            ref={listRef}
            className="dex-scroll"
            style={{
              marginTop: 12,
              maxHeight: filtersOpen ? "calc(100vh - 440px)" : "calc(100vh - 270px)",
              overflowY: "auto",
              paddingRight: 2,
            }}
            onWheel={onWheel}
          >
            {list.length === 0 ? (
              <div style={{ padding: 14, opacity: 0.75 }}>Keine Treffer.</div>
            ) : (
              <>
                {/* Top 2 */}
                {[list[idx - 2], list[idx - 1]]
                  .filter(Boolean)
                  .map((p, i) => {
                    const name = getDisplayName(p, apiNameCache);
                    return (
                      <div
                        key={`top-${p.kind}-${p.dexId}-${i}`}
                        style={smallRow(false)}
                        onClick={() => setIdx(idx - (2 - i))}
                      >
                        <img
                          src={officialArtworkUrl(p.dexId)}
                          alt={name}
                          style={{ width: 42, height: 42, objectFit: "contain" }}
                          loading="lazy"
                        />

                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 950, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                            {name}
                          </div>
                          <div style={{ opacity: 0.7, fontSize: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
                            <span>#{p.dexId}</span>
                            {p.gen ? <span>Gen {p.gen}</span> : null}
                          </div>

                          {renderTypes(p.dexId, false)}
                        </div>

                        <div
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleFav(p.dexId);
                          }}
                        >
                          <SmallFav active={isFav(p.dexId)} onClick={() => {}} />
                        </div>
                      </div>
                    );
                  })}

                {/* Current */}
                {current && (
                  <div style={centerCard}>
                    <div style={{ display: "grid", gridTemplateColumns: "160px 1fr", gap: 14, alignItems: "center" }}>
                      <div style={{ display: "flex", justifyContent: "center" }}>
                        <img
                          src={officialArtworkUrl(current.dexId)}
                          alt={currentName}
                          style={{ width: 170, height: 170, objectFit: "contain", cursor: "pointer" }}
                          onClick={() => openPokemon(current.dexId)}
                          title="Info öffnen"
                        />
                      </div>

                      <div className="dexInfoPanel" style={{ minWidth: 0 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start" }}>
                          <div style={{ minWidth: 0 }}>
                            <div
                              style={{
                                fontSize: 22,
                                fontWeight: 1000,
                                whiteSpace: "nowrap",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                              }}
                              title={currentName}
                            >
                              {currentName}
                            </div>
                            <div style={{ opacity: 0.72, fontWeight: 950, marginTop: 2, fontSize: 12 }}>
                              #{current.dexId}
                              {current.gen ? <> · Gen {current.gen}</> : null}
                            </div>
                          </div>

                          <div
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleFav(current.dexId);
                            }}
                          >
                            <FavStar
                              active={isFav(current.dexId)}
                              title={isFav(current.dexId) ? "Aus Favoriten entfernen" : "Zu Favoriten"}
                              onClick={() => {}}
                            />
                          </div>
                        </div>

                        {renderTypes(current.dexId, true)}

                        <div className="dexCtaRow">
                          <button className="dexCtaBtn dexCtaPrimary" onClick={() => openPokemon(current.dexId)} title="Details öffnen">
                            <span className="dexCtaIcon">
                              <span style={{ fontSize: 16, fontWeight: 1000, lineHeight: 1 }}>↗</span>
                            </span>
                            <span className="dexCtaText">
                              <span className="dexCtaTitle">Details</span>
                              <span className="dexCtaSub">Info · Moves · Formen</span>
                            </span>
                          </button>

                          <button className="dexCtaBtn" onClick={() => openCompare(current.dexId)} title="Vergleichen">
                            <span className="dexCtaIcon">
                              <span style={{ fontSize: 16, fontWeight: 1000, lineHeight: 1 }}>⚔</span>
                            </span>
                            <span className="dexCtaText">
                              <span className="dexCtaTitle">Vergleichen</span>
                            </span>
                          </button>

                          <button
                            className="dexCtaBtn"
                            onClick={() => {
                              setQuickOpen((v) => !v);
                              // ensure data prefetch when opening
                              if (!quickOpen) {
                                resolveStatsIfNeeded(current);
                                resolveEvoChainIfNeeded(current);
                              }
                            }}
                            title="Quick Info ein-/ausklappen"
                          >
                            <span className="dexCtaIcon">
                              <span style={{ fontSize: 16, fontWeight: 1000, lineHeight: 1 }}>{quickOpen ? "▾" : "▸"}</span>
                            </span>
                            <span className="dexCtaText">
                              <span className="dexCtaTitle">Quick Info</span>
                              <span className="dexCtaSub">{quickOpen ? "Einklappen" : "Entwicklung · Stats"}</span>
                            </span>
                          </button>
                        </div>

                        {quickOpen ? renderEvoAndStats(current.dexId) : null}
                      </div>
                    </div>
                  </div>
                )}

                {/* Bottom 2 */}
                {[list[idx + 1], list[idx + 2]]
                  .filter(Boolean)
                  .map((p, i) => {
                    const name = getDisplayName(p, apiNameCache);
                    return (
                      <div key={`bot-${p.kind}-${p.dexId}-${i}`} style={smallRow(false)} onClick={() => setIdx(idx + (i + 1))}>
                        <img
                          src={officialArtworkUrl(p.dexId)}
                          alt={name}
                          style={{ width: 42, height: 42, objectFit: "contain" }}
                          loading="lazy"
                        />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 950, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                            {name}
                          </div>
                          <div style={{ opacity: 0.7, fontSize: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
                            <span>#{p.dexId}</span>
                            {p.gen ? <span>Gen {p.gen}</span> : null}
                          </div>

                          {renderTypes(p.dexId, false)}
                        </div>

                        {p.kind !== "normal" && p.kind !== "normal_api" ? (
                          <div style={badge(false)}>
                            {p.kind.includes("mega") ? "MEGA" : p.kind.includes("gigas") ? "GIGAS" : "FORM"}
                          </div>
                        ) : null}

                        <div
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleFav(p.dexId);
                          }}
                        >
                          <SmallFav active={isFav(p.dexId)} onClick={() => {}} />
                        </div>
                      </div>
                    );
                  })}
              </>
            )}
          </div>

          <div style={{ marginTop: 10, opacity: 0.7, fontSize: 12 }}>
            Treffer: <b>{list.length}</b>
            {onlyFav ? (
              <>
                {" "}· <b>⭐ Nur Favoriten</b> ({favorites.size})
              </>
            ) : null}
            {query.trim() ? (
              <>
                {" "}für "<b>{query.trim()}</b>"
              </>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
