// src/pages/Pokedex.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { pokedex as fullPokedex } from "../data/pokedex.js";
import dexBg from "../assets/DexBackground.png";
import { megaFormsByBaseDexId, specialFormsByBaseDexId } from "../data/megaForms";

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
        const suf = prettyFormSuffixDe(apiName);
        return suf ? `${suf}-${baseDe}` : baseDe;
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
    if (!q) return rawList;
    return rawList.filter((p) => {
      const name = getDisplayName(p, apiNameCache);
      return normText(name).includes(q) || String(p.dexId) === q;
    });
  }, [rawList, query, apiNameCache]);

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
    height: "100vh",
    overflow: "hidden",
    padding: 16,
    color: "white",
    backgroundImage: `url(${dexBg})`,
    backgroundSize: "cover",
    backgroundPosition: "center",
    backgroundRepeat: "no-repeat",
    backgroundAttachment: "fixed",
  };

  const overlay = {
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(0, 0, 0, 0.44)",
    borderRadius: 16,
    padding: 14,
    boxShadow: "0 30px 90px rgba(0,0,0,0.55)",
    backdropFilter: "blur(6px)",
  };

  const btn = {
    padding: "10px 12px",
    borderRadius: 10,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(0,0,0,0.25)",
    color: "white",
    cursor: "pointer",
    fontWeight: 900,
    whiteSpace: "nowrap",
  };

  const input = {
    width: "100%",
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.16)",
    background: "rgba(0,0,0,0.25)",
    color: "white",
    outline: "none",
    fontWeight: 900,
  };

  const chip = (active) => ({
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "7px 11px",
    borderRadius: 999,
    border: active ? "1px solid rgba(255,255,255,0.40)" : "1px solid rgba(255,255,255,0.14)",
    background: active ? "rgba(255,255,255,0.14)" : "rgba(0,0,0,0.18)",
    cursor: "pointer",
    userSelect: "none",
    fontWeight: 950,
    opacity: active ? 1 : 0.85,
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
    gap: 10,
    padding: "10px 12px",
    borderRadius: 14,
    border: active ? "1px solid rgba(255,255,255,0.38)" : "1px solid rgba(255,255,255,0.12)",
    background: active ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.20)",
    boxShadow: active ? "0 0 0 1px rgba(255,255,255,0.08), 0 16px 40px rgba(0,0,0,0.45)" : "none",
    cursor: "pointer",
    opacity: active ? 1 : 0.86,
    transition: "120ms ease",
  });

  const centerCard = {
    borderRadius: 18,
    border: "1px solid rgba(255,255,255,0.20)",
    background: "rgba(0,0,0,0.32)",
    padding: 14,
    boxShadow: "0 18px 60px rgba(0,0,0,0.55)",
  };

  // Type pills (colored like PokemonInfo)
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

  return (
    <div style={page}>
      <style>{`
        .dex-scroll { scrollbar-width: none; -ms-overflow-style: none; }
        .dex-scroll::-webkit-scrollbar { display: none; }
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

          {/* Middle highlight layout (current + 2 above/below) */}
          <div
            ref={listRef}
            className="dex-scroll"
            style={{
              marginTop: 12,
              maxHeight: filtersOpen ? "calc(100vh - 420px)" : "calc(100vh - 250px)",
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

                        {p.kind !== "normal" && p.kind !== "normal_api" ? (
                          <div style={badge(false)}>
                            {p.kind.includes("mega") ? "MEGA" : p.kind.includes("gigas") ? "GIGAS" : "FORM"}
                          </div>
                        ) : null}
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

                      <div style={{ minWidth: 0 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline" }}>
                          <div
                            style={{
                              fontSize: 22,
                              fontWeight: 1000,
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                            }}
                          >
                            {currentName}
                          </div>
                          <div style={{ opacity: 0.75, fontWeight: 950 }}>#{current.dexId}</div>
                        </div>

                        <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
                          {current.gen ? <div style={badge(true)}>Gen {current.gen}</div> : <div style={badge(false)}>Gen …</div>}
                          <div style={badge(true)}>
                            {current.kind === "normal" || current.kind === "normal_api"
                              ? "NORMAL"
                              : current.kind.includes("mega")
                              ? "MEGA"
                              : current.kind.includes("gigas")
                              ? "GIGAS"
                              : "FORM"}
                          </div>
                        </div>

                        {renderTypes(current.dexId, true)}

                        <div style={{ marginTop: 12 }}>
                          <button style={{ ...btn, width: "100%" }} onClick={() => openPokemon(current.dexId)}>
                            Info öffnen
                          </button>
                        </div>
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
                      </div>
                    );
                  })}
              </>
            )}
          </div>

          <div style={{ marginTop: 10, opacity: 0.7, fontSize: 12 }}>
            Treffer: <b>{list.length}</b>
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
