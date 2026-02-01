// src/versus/DuoVersusAuction.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { subscribeRoom } from "../versus/versusService"; // System A: versusRooms
import { db } from "../firebase";
import { doc, runTransaction, updateDoc, serverTimestamp, getDoc } from "firebase/firestore";
import TypeModal from "../versus/TypeModal";
import { makeShuffledPool, dexIdToImageUrl, getDexCapForGen } from "../utils/pokemonPool";
import { pokedex as fullPokedex } from "../data/pokedex.js";

/* =========================================================
   Evolution Line (PokeAPI) + Cache (in-memory)
   - getEvolutionLineByDexId(dexId) -> [{ dexId, nameKey, evolvesToText? }]
   - getBaseFormDexId(dexId) -> baseDexId
========================================================= */
const evoMemCache = new Map(); // dexId -> line[{dexId,nameKey,evolvesToText}]
const evoInFlight = new Map(); // dexId -> Promise
const typeCache = {}; // dexId -> ["water","flying",...]
const statsCache = {}; // dexId -> { hp, atk, def, spa, spd, spe, total }

/* =========================================================
   Mega Forms (Gen 6+ only)
   - Pool item format: "mega:<pokeapi-form-name>"
   - We keep dexId = base form dex for bans/evo logic
========================================================= */
const MEGA_FORMS = [
  // Gen 1
  { base: 3, form: "venusaur-mega", label: "Mega" },
  { base: 6, form: "charizard-mega-x", label: "Mega X" },
  { base: 6, form: "charizard-mega-y", label: "Mega Y" },
  { base: 9, form: "blastoise-mega", label: "Mega" },
  { base: 15, form: "beedrill-mega", label: "Mega" },
  { base: 18, form: "pidgeot-mega", label: "Mega" },
  { base: 65, form: "alakazam-mega", label: "Mega" },
  { base: 80, form: "slowbro-mega", label: "Mega" },
  { base: 94, form: "gengar-mega", label: "Mega" },
  { base: 115, form: "kangaskhan-mega", label: "Mega" },
  { base: 127, form: "pinsir-mega", label: "Mega" },
  { base: 130, form: "gyarados-mega", label: "Mega" },
  { base: 142, form: "aerodactyl-mega", label: "Mega" },
  { base: 150, form: "mewtwo-mega-x", label: "Mega X" },
  { base: 150, form: "mewtwo-mega-y", label: "Mega Y" },

  // Gen 2
  { base: 181, form: "ampharos-mega", label: "Mega" },
  { base: 208, form: "steelix-mega", label: "Mega" },
  { base: 212, form: "scizor-mega", label: "Mega" },
  { base: 214, form: "heracross-mega", label: "Mega" },
  { base: 229, form: "houndoom-mega", label: "Mega" },
  { base: 248, form: "tyranitar-mega", label: "Mega" },

  // Gen 3
  { base: 254, form: "sceptile-mega", label: "Mega" },
  { base: 257, form: "blaziken-mega", label: "Mega" },
  { base: 260, form: "swampert-mega", label: "Mega" },
  { base: 282, form: "gardevoir-mega", label: "Mega" },
  { base: 302, form: "sableye-mega", label: "Mega" },
  { base: 303, form: "mawile-mega", label: "Mega" },
  { base: 306, form: "aggron-mega", label: "Mega" },
  { base: 308, form: "medicham-mega", label: "Mega" },
  { base: 310, form: "manectric-mega", label: "Mega" },
  { base: 319, form: "sharpedo-mega", label: "Mega" },
  { base: 323, form: "camerupt-mega", label: "Mega" },
  { base: 334, form: "altaria-mega", label: "Mega" },
  { base: 354, form: "banette-mega", label: "Mega" },
  { base: 359, form: "absol-mega", label: "Mega" },
  { base: 362, form: "glalie-mega", label: "Mega" },
  { base: 373, form: "salamence-mega", label: "Mega" },
  { base: 376, form: "metagross-mega", label: "Mega" },
  { base: 384, form: "rayquaza-mega", label: "Mega" },


  // Gen 4
  { base: 380, form: "latias-mega", label: "Mega" },
  { base: 381, form: "latios-mega", label: "Mega" },
  { base: 445, form: "garchomp-mega", label: "Mega" },
  { base: 448, form: "lucario-mega", label: "Mega" },
  { base: 460, form: "abomasnow-mega", label: "Mega" },
  { base: 428, form: "lopunny-mega", label: "Mega" },
  { base: 475, form: "gallade-mega", label: "Mega" },


  // Gen 5
  { base: 531, form: "audino-mega", label: "Mega" },

  // Gen 6
  { base: 719, form: "diancie-mega", label: "Mega" },
];

const MEGA_BY_FORM = Object.fromEntries(MEGA_FORMS.map((m) => [m.form, m]));

// Cache for mega sprites fetched from PokeAPI
const megaSpriteCache = new Map(); // form -> imageUrl

function isMegaPoolItem(item) {
  return typeof item === "string" && item.startsWith("mega:");
}
function megaFormFromItem(item) {
  return String(item || "").slice(5);
}
function megaMetaFromItem(item) {
  const form = megaFormFromItem(item);
  return MEGA_BY_FORM[form] || null;
}
function appendMegaToEvoLine(evoLine, current) {
  if (!Array.isArray(evoLine) || !current) return evoLine;

  // nur wenn das aktuelle Pokémon eine Mega-Form ist
  if (!current.formKey) return evoLine;

  const baseDexId = Number(current.dexId);
  if (!baseDexId) return evoLine;

  // schon enthalten?
  const already = evoLine.some((e) => e.formKey === current.formKey);
  if (already) return evoLine;

  return [
    ...evoLine,
    {
      dexId: baseDexId,
      formKey: current.formKey,
      nameOverride: current.name,   // "Simsala (Mega)"
      imageUrl: current.imageUrl,
      evolvesToText: "Mega-Entwicklung",
    },
  ];
}

function shuffleArray(arr) {
  const a = [...(arr || [])];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

async function getMegaImageUrl(form) {
  if (!form) return null;
  if (megaSpriteCache.has(form)) return megaSpriteCache.get(form);

  try {
    const res = await fetch(`https://pokeapi.co/api/v2/pokemon/${form}`);
    if (!res.ok) throw new Error("mega sprite fetch failed");
    const data = await res.json();

    // Prefer official artwork, fallback to default sprite
    const url =
      data?.sprites?.other?.["official-artwork"]?.front_default ||
      data?.sprites?.front_default ||
      null;

    megaSpriteCache.set(form, url);
    return url;
  } catch {
    megaSpriteCache.set(form, null);
    return null;
  }
}

async function poolItemToCurrent(item) {
  // normal dexId
  if (!isMegaPoolItem(item)) {
    const dexId = Number(item);
    if (!dexId) return null;
    return { dexId, name: getPokemonName(dexId), imageUrl: dexIdToImageUrl(dexId) };
  }

  // mega item
  const meta = megaMetaFromItem(item);
  if (!meta) return null;

  const form = meta.form;
  const baseDexId = Number(meta.base);
  const baseName = getPokemonName(baseDexId);
  const img = (await getMegaImageUrl(form)) || dexIdToImageUrl(baseDexId);

  return {
    dexId: baseDexId,          // IMPORTANT: base dex id for bans/evo-line
    baseDexId: baseDexId,
    formKey: form,             // for display/team
    name: `${baseName} (${meta.label})`,
    imageUrl: img,
  };
}

function safeLower(s) {
  return String(s || "").toLowerCase();
}

function prettifyName(s) {
  return String(s || "")
    .replace(/-/g, " ")
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

function buildEvoMethodText(details) {
  const d = details || {};
  const trigger = d?.trigger?.name || "";

  // Häufige Fälle
  if (trigger === "level-up") {
    const parts = [];
    if (d.min_level) parts.push(`Lvl ${d.min_level}`);
    if (d.min_happiness) parts.push(`Freundschaft ${d.min_happiness}+`);
    if (d.min_affection) parts.push(`Zuneigung ${d.min_affection}+`);
    if (d.min_beauty) parts.push(`Schönheit ${d.min_beauty}+`);
    if (d.time_of_day) parts.push(`Zeit: ${d.time_of_day}`);
    if (d.location?.name) parts.push(`Ort: ${prettifyName(d.location.name)}`);
    if (d.held_item?.name) parts.push(`Item halten: ${prettifyName(d.held_item.name)}`);
    if (d.known_move?.name) parts.push(`Attacke: ${prettifyName(d.known_move.name)}`);
    if (d.known_move_type?.name) parts.push(`Attacken-Typ: ${prettifyName(d.known_move_type.name)}`);
    if (d.party_species?.name) parts.push(`Mit im Team: ${prettifyName(d.party_species.name)}`);
    if (d.party_type?.name) parts.push(`Party-Typ: ${prettifyName(d.party_type.name)}`);
    if (d.gender === 1) parts.push("♀");
    if (d.gender === 2) parts.push("♂");
    if (d.relative_physical_stats === 1) parts.push("Angriff > Vert.");
    if (d.relative_physical_stats === 0) parts.push("Angriff = Vert.");
    if (d.relative_physical_stats === -1) parts.push("Angriff < Vert.");
    if (d.needs_overworld_rain) parts.push("Regen (Overworld)");
    if (d.turn_upside_down) parts.push("Gerät umdrehen");

    return parts.length ? parts.join(" · ") : "Level-Up";
  }

  if (trigger === "use-item") {
    if (d.item?.name) return `Stein/Item: ${prettifyName(d.item.name)}`;
    return "Item benutzen";
  }

  if (trigger === "trade") {
    if (d.held_item?.name) return `Tausch (mit Item: ${prettifyName(d.held_item.name)})`;
    if (d.trade_species?.name) return `Tausch (gegen: ${prettifyName(d.trade_species.name)})`;
    return "Tausch";
  }

  if (trigger === "shed") return "Shed (Ninjask/Ninjatom)";
  if (trigger === "spin") return "Drehen/Spin";
  if (trigger === "tower-of-darkness") return "Turm der Finsternis";
  if (trigger === "tower-of-waters") return "Turm des Wassers";
  if (trigger === "three-critical-hits") return "3 Volltreffer";
  if (trigger === "take-damage") return "Schaden nehmen";
  if (trigger === "other") return "Spezial";

  // Fallback
  if (trigger) return prettifyName(trigger);
  return "—";
}

function parseEvolutionChain(node, out) {
  if (!node) return;

  // Node: species + evolves_to[], each with evolution_details[]
  const curName = node?.species?.name;
  out.push({ nameKey: safeLower(curName), dexId: null, evolvesToText: null });

  const nextArr = node?.evolves_to || [];
  for (const next of nextArr) {
    const details = Array.isArray(next?.evolution_details) ? next.evolution_details[0] : null;
    const methodText = buildEvoMethodText(details);

    // Wir markieren am *aktuellen* Entry, wie es zum nächsten geht
    if (out.length > 0) out[out.length - 1].evolvesToText = methodText;

    parseEvolutionChain(next, out);
  }
}

async function nameToDexId(name) {
  const res = await fetch(`https://pokeapi.co/api/v2/pokemon/${safeLower(name)}`);
  if (!res.ok) throw new Error(`pokemon fetch failed for ${name}`);
  const data = await res.json();
  return Number(data.id);
}

async function getEvolutionLineByDexId(dexIdRaw) {
  const dexId = Number(dexIdRaw);
  if (!dexId || Number.isNaN(dexId)) return [];

  if (evoMemCache.has(dexId)) return evoMemCache.get(dexId);
  if (evoInFlight.has(dexId)) return evoInFlight.get(dexId);

  const p = (async () => {
    // 1) species -> evolution_chain.url
    const sRes = await fetch(`https://pokeapi.co/api/v2/pokemon-species/${dexId}`);
    if (!sRes.ok) return [];

    const species = await sRes.json();
    const evoUrl = species?.evolution_chain?.url;
    if (!evoUrl) return [];

    // 2) chain -> structure
    const eRes = await fetch(evoUrl);
    if (!eRes.ok) return [];

    const evoData = await eRes.json();

    // 3) parse chain to ordered list with methodText on each step
    const tmp = [];
    parseEvolutionChain(evoData?.chain, tmp);

    // 4) names -> dexIds
    const line = [];
    for (const entry of tmp) {
      const n = entry?.nameKey;
      if (!n) continue;
      try {
        const id = await nameToDexId(n);
        if (id) line.push({ dexId: id, nameKey: n, evolvesToText: entry?.evolvesToText || null });
      } catch {
        // ignore
      }
    }

    const finalLine = line.length ? line : [{ dexId, nameKey: "", evolvesToText: null }];

    // cache for all members
    for (const entry of finalLine) evoMemCache.set(entry.dexId, finalLine);
    return finalLine;
  })()
    .then((line) => {
      evoInFlight.delete(dexId);
      evoMemCache.set(dexId, line);
      return line;
    })
    .catch(() => {
      evoInFlight.delete(dexId);
      evoMemCache.set(dexId, []);
      return [];
    });

  evoInFlight.set(dexId, p);
  return p;
}

async function getBaseFormDexId(dexIdRaw) {
  const dexId = Number(dexIdRaw);
  if (!dexId || Number.isNaN(dexId)) return dexIdRaw;

  const line = await getEvolutionLineByDexId(dexId);
  const base = line?.[0]?.dexId;
  return base ? Number(base) : dexId;
}

/* =========================================================
   Helpers
========================================================= */
function getPokemonName(dexId) {
  const key = `pokedex${dexId}`;
  return fullPokedex?.[key] ?? `#${dexId}`;
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

function getSpecialTag(dexIdRaw) {
  const dexId = Number(dexIdRaw);

  // ✅ Starter (komplette Reihen)
  const STARTERS = new Set([
    // Gen 1
    1, 2, 3, 4, 5, 6, 7, 8, 9,
    // Gen 2
    152, 153, 154, 155, 156, 157, 158, 159, 160,
    // Gen 3
    252, 253, 254, 255, 256, 257, 258, 259, 260,
    // Gen 4
    387, 388, 389, 390, 391, 392, 393, 394, 395,
    // Gen 5
    495, 496, 497, 498, 499, 500, 501, 502, 503,
    // Gen 6
    650, 651, 652, 653, 654, 655, 656, 657, 658,
  ]);

  // ✅ Pseudo-Legis (Endstufen)
  const PSEUDO = new Set([149, 248, 373, 376, 445, 635, 706]);

  // ✅ Legendär (grobe Auswahl, kannst du später easy erweitern)
  const LEGENDARY = new Set([
    144, 145, 146, 150, // Kanto
    243, 244, 245, 249, 250, // Johto
    377, 378, 379, 380, 381, 382, 383, 384, // Hoenn
    480, 481, 482, 483, 484, 485, 486, 487, 488, // Sinnoh
    494, // Unova
    716, 717, 718, // Kalos
  ]);

  // ✅ Mythisch
  const MYTHICAL = new Set([
    151, 251, 385, 386, 489, 490, 491, 492, 493, 494,
    647, 648, 649,
    719, 720,
  ]);

  // ✅ Sub-Legendär (hier “Legendary-like”, aber nicht Boxart)
  const SUB_LEGENDARY = new Set([
    144, 145, 146, 150,
    243, 244, 245,
    377, 378, 379, 380, 381,
    480, 481, 482,
    647, 648,
  ]);

  if (MYTHICAL.has(dexId)) return { label: "Mythisch", color: "#facc15", text: "#111827" };
  if (LEGENDARY.has(dexId)) return { label: "Legendär", color: "#a855f7", text: "white" };
  if (SUB_LEGENDARY.has(dexId)) return { label: "Sub-Legendär", color: "#60a5fa", text: "#0b1220" };
  if (PSEUDO.has(dexId)) return { label: "Pseudo-Legi", color: "#f97316", text: "#0b1220" };
  if (STARTERS.has(dexId)) return { label: "Starter-Reihe", color: "#22c55e", text: "#06210f" };

  return null;
}

function labelPlayer(playerId, room) {
  const arr = room?.players || [];
  const p = arr.find((x) => x.id === playerId);
  return p?.displayName || playerId?.slice?.(0, 6) || String(playerId);
}

function clampInt(v, min, max) {
  const n = Number(v);
  if (Number.isNaN(n)) return min;
  return Math.max(min, Math.min(max, Math.floor(n)));
}

function fmtSecs(s) {
  const sec = Math.max(0, Math.ceil(s));
  return `${sec}s`;
}

function teamIdFor(i) {
  return `team${i + 1}`;
}

function ensureTeamOwners(count, prev = {}) {
  const next = { ...(prev || {}) };
  for (let i = 0; i < count; i++) {
    const tid = teamIdFor(i);
    if (!(tid in next)) next[tid] = null;
  }
  // trim extras
  for (const k of Object.keys(next)) {
    const idx = Number(String(k).replace("team", "")) - 1;
    if (Number.isFinite(idx) && idx >= count) delete next[k];
  }
  return next;
}

function findNextAllowedFromPool(pool, startIndex, bannedSet) {
  let idx = startIndex;
  while (idx < (pool?.length || 0)) {
    const item = pool[idx];

    // Normaler Dex
    if (!isMegaPoolItem(item)) {
      const dex = Number(item);
      if (dex && !bannedSet.has(dex)) {
        return { nextDex: item, nextIndex: idx }; // NOTE: can be number
      }
      idx += 1;
      continue;
    }

    // Mega: skip if its base is banned
    const meta = megaMetaFromItem(item);
    const baseDex = Number(meta?.base);
    if (baseDex && !bannedSet.has(baseDex)) {
      return { nextDex: item, nextIndex: idx }; // NOTE: can be "mega:..."
    }

    idx += 1;
  }
  return { nextDex: null, nextIndex: idx };
}


export default function DuoVersusAuction() {
  const nav = useNavigate();
  const { roomId: roomIdParam } = useParams();
  const roomId = String(roomIdParam || "").toUpperCase();

  const [bidFlash, setBidFlash] = useState(false);
  const [curTypes, setCurTypes] = useState([]);
  const [curStats, setCurStats] = useState(null); // ✅ NEW: current pokemon stats
  const [room, setRoom] = useState(null);
  const [err, setErr] = useState("");
  const [typeModalOpen, setTypeModalOpen] = useState(false);

  // ✅ NEW: Team types map for analysis modal
  const [teamTypesMap, setTeamTypesMap] = useState({}); // { [dexId]: ["water","flying"] }

  // live room
  useEffect(() => {
    if (!roomId) return;
    setErr("");
    const unsub = subscribeRoom(roomId, (r) => setRoom(r));
    return () => unsub && unsub();
  }, [roomId]);

  const players = room?.players || [];
  const hostPlayerId = room?.hostPlayerId || "";

  const myPlayerId = useMemo(() => {
    return sessionStorage.getItem(`versus_player_${roomId}`) || "";
  }, [roomId]);

  const meIsHost = myPlayerId && hostPlayerId ? myPlayerId === hostPlayerId : false;

  function goLobby() {
    nav(`/versus/`);
  }

  function openPokemonDetails(dexId) {
    const name = getPokemonName(dexId); // deutsches Pokédex-Name-Mapping
    const slug = encodeURIComponent(String(name).trim().replace(/\s+/g, "_"));
    window.open(`https://www.pokewiki.de/${slug}#Zucht_und_Entwicklung`, "_blank", "noopener,noreferrer");
  }

  // Guard: only valid in auction status
  useEffect(() => {
    if (!room) return;
    if (room.status !== "auction") {
      nav(`/versus/${roomId}`, { replace: true });
    }
  }, [room, roomId, nav]);

  const roomRef = useMemo(() => doc(db, "versusRooms", roomId), [roomId]);

  // ===== Shared Auction State in Firestore =====
  const auction = room?.versus?.auction || null;

  const phase = auction?.phase || "lobby"; // lobby | auction | results
  const settings = auction?.settings || {
    generation: 1,
    participants: 2,
    budgetPerTeam: 10000,
    totalPokemon: 12,
    secondsPerBid: 10,
    keepEvolvedForms: false, // false = Basisform, true = so bleiben
  };

  const teamOwners = auction?.teamOwners || {};
  const draft = auction?.draft || {
    auctionCountDone: 0,
    current: null,

    teamIds: [],
    budgets: {},
    teams: {},

    pool: [],
    poolIndex: 0,
    totalPokemon: settings.totalPokemon,

    highestBid: 0,
    highestTeamId: null,
    hasStarted: false,

    bannedDexIds: [],
  };

  // ===== Avg Preis (Summe / Anzahl gedrafteter Pokémon) =====
  const avgPrice = useMemo(() => {
    const teams = draft?.teams || {};
    let totalPrice = 0;
    let count = 0;

    for (const team of Object.values(teams)) {
      if (!Array.isArray(team)) continue;
      for (const p of team) {
        if (typeof p?.price === "number") {
          totalPrice += p.price;
          count += 1;
        }
      }
    }

    if (count === 0) return 0;
    return Math.round(totalPrice / count);
  }, [draft?.teams]);

  const timer = auction?.timer || { running: false, paused: false, remaining: settings.secondsPerBid };
  const teamIds = useMemo(() => {
    const count = Math.max(2, clampInt(settings.participants, 2, 8));
    return Array.from({ length: count }, (_, i) => teamIdFor(i));
  }, [settings.participants]);

  const myTeamId = useMemo(() => {
    if (!myPlayerId) return null;
    for (const tid of teamIds) {
      if (teamOwners?.[tid] === myPlayerId) return tid;
    }
    return null;
  }, [myPlayerId, teamOwners, teamIds]);

  // ✅ NEW: My team pokemons (for analysis)
  const myTeamPokemons = useMemo(() => {
    if (!myTeamId) return [];
    const teamsObj = draft?.teams || {};
    const arr = teamsObj?.[myTeamId] || [];
    return Array.isArray(arr) ? arr : [];
  }, [myTeamId, draft?.teams]);

  // Local-only input
  const [bidInput, setBidInput] = useState(100);

  function round100(n) {
    const x = Number(n || 0);
    const r = Math.ceil(x / 100) * 100;
    return Math.max(100, r);
  }

  const lastBidRef = useRef(null);

  useEffect(() => {
    const bid = Number(auction?.draft?.highestBid ?? 0);

    // nur in auction-phase
    if ((auction?.phase || "lobby") !== "auction") return;

    // beim ersten Render nicht flashen
    if (lastBidRef.current === null) {
      lastBidRef.current = bid;
      return;
    }

    // nur flashen wenn bid wirklich steigt/ändert
    if (bid !== lastBidRef.current) {
      lastBidRef.current = bid;

      setBidFlash(true);
      const t = setTimeout(() => setBidFlash(false), 300);
      return () => clearTimeout(t);
    }
  }, [auction?.phase, auction?.draft?.highestBid]);

  // ===== Current Pokemon types (already in your UI) =====
  useEffect(() => {
    let alive = true;

    (async () => {
      const dexId = Number(draft?.current?.dexId);
      if (!dexId) {
        setCurTypes([]);
        return;
      }

      if (typeCache[dexId]) {
        setCurTypes(typeCache[dexId]);
        return;
      }

      try {
        const res = await fetch(`https://pokeapi.co/api/v2/pokemon/${dexId}`);
        if (!res.ok) throw new Error("type fetch failed");
        const data = await res.json();
        const types = (data?.types || []).map((t) => t?.type?.name).filter(Boolean);

        typeCache[dexId] = types;
        if (alive) setCurTypes(types);
      } catch {
        if (alive) setCurTypes([]);
      }
    })();

    return () => {
      alive = false;
    };
  }, [draft?.current?.dexId]);

  // ✅ NEW: Current Pokemon base stats (PokeAPI)
  useEffect(() => {
    let alive = true;

    (async () => {
      const dexId = Number(draft?.current?.dexId || 0);
      if (!dexId) {
        setCurStats(null);
        return;
      }

      if (statsCache[dexId]) {
        if (alive) setCurStats(statsCache[dexId]);
        return;
      }

      try {
        const res = await fetch(`https://pokeapi.co/api/v2/pokemon/${dexId}`);
        if (!res.ok) throw new Error("stats fetch failed");
        const data = await res.json();

        const map = {};
        for (const s of (data?.stats || [])) {
          const key = s?.stat?.name;
          const val = Number(s?.base_stat ?? 0);
          if (key) map[key] = val;
        }

        const stats = {
          hp: map.hp ?? 0,
          atk: map.attack ?? 0,
          def: map.defense ?? 0,
          spa: map["special-attack"] ?? 0,
          spd: map["special-defense"] ?? 0,
          spe: map.speed ?? 0,
        };
        stats.total = stats.hp + stats.atk + stats.def + stats.spa + stats.spd + stats.spe;

        statsCache[dexId] = stats;
        if (alive) setCurStats(stats);
      } catch {
        if (alive) setCurStats(null);
      }
    })();

    return () => {
      alive = false;
    };
  }, [draft?.current?.dexId]);

  // ===== Evolution UI state (current Pokémon) =====
  const [evoLine, setEvoLine] = useState([]);
  const [evoLoading, setEvoLoading] = useState(false);
  const [evoStatsMap, setEvoStatsMap] = useState({}); // { [dexId]: {hp,atk,def,spa,spd,spe,total} }

  // ✅ Evo-Line für Anzeige (ab Gen 6 inkl. Mega, falls passend)
const evoLineWithMega = useMemo(() => {
  if (!Array.isArray(evoLine)) return [];

  // Nur wenn Gen >= 6: Mega in die Reihe integrieren
  if (Number(settings?.generation) >= 6) {
    return appendMegaToEvoLine(evoLine, draft?.current);
  }

  return evoLine;
}, [evoLine, settings?.generation, draft?.current]);
// ✅ Hide evo UI if there is no evolution before/after (e.g. legendaries, kecleon)
const showEvoUI = useMemo(() => {
  const baseLine = Array.isArray(evoLine) ? evoLine : [];

  // normal evo chain exists (more than 1 stage)
  const hasNormalEvo = baseLine.length > 1;

  // mega appended counts as "something to show"
  const hasMega = Array.isArray(evoLineWithMega) && evoLineWithMega.some((x) => !!x?.formKey);

  return hasNormalEvo || hasMega;
}, [evoLine, evoLineWithMega]);

useEffect(() => {
  let alive = true;

  (async () => {
    const line = Array.isArray(evoLineWithMega) ? evoLineWithMega : [];
    if (!line.length) {
      if (alive) setEvoStatsMap({});
      return;
    }

    // key: dex:<id> oder mega:<formKey> damit Mega eigene Stats bekommt
    const keys = line.map((p) => (p?.formKey ? `mega:${p.formKey}` : `dex:${Number(p?.dexId)}`));
    const uniqKeys = Array.from(new Set(keys)).filter(Boolean);

    const next = { ...(evoStatsMap || {}) };

    for (let i = 0; i < line.length; i++) {
      const p = line[i];
      const key = p?.formKey ? `mega:${p.formKey}` : `dex:${Number(p?.dexId)}`;
      if (!key) continue;

      if (next[key]) continue;

      // Cache hit?
      if (statsCache[key]) {
        next[key] = statsCache[key];
        continue;
      }

      try {
        const url = p?.formKey
          ? `https://pokeapi.co/api/v2/pokemon/${p.formKey}`
          : `https://pokeapi.co/api/v2/pokemon/${Number(p?.dexId)}`;

        const res = await fetch(url);
        if (!res.ok) throw new Error("stats fetch failed");
        const data = await res.json();

        const statsArr = Array.isArray(data?.stats) ? data.stats : [];
        const get = (k) => Number(statsArr.find((s) => s?.stat?.name === k)?.base_stat ?? 0);

        const pack = {
          hp: get("hp"),
          atk: get("attack"),
          def: get("defense"),
          spa: get("special-attack"),
          spd: get("special-defense"),
          spe: get("speed"),
        };
        pack.total = pack.hp + pack.atk + pack.def + pack.spa + pack.spd + pack.spe;

        statsCache[key] = pack;
        next[key] = pack;
      } catch {
        next[key] = null;
      }
    }

    if (alive) setEvoStatsMap(next);
  })();

  return () => {
    alive = false;
  };
}, [JSON.stringify((evoLineWithMega || []).map((p) => (p?.formKey ? `mega:${p.formKey}` : `dex:${p?.dexId}`)))]);

  useEffect(() => {
    let alive = true;

    (async () => {
      const curDex = draft?.current?.dexId;
      if (!curDex) {
        setEvoLine([]);
        return;
      }
      setEvoLoading(true);
      try {
        const line = await getEvolutionLineByDexId(curDex);
        if (alive) setEvoLine(line);
      } catch {
        if (alive) setEvoLine([]);
      } finally {
        if (alive) setEvoLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [draft?.current?.dexId]);

  // ===== Base-form display map for team boxes (only 1st evolution shown) =====
  const [baseDexMap, setBaseDexMap] = useState({}); // originalDexId -> baseDexId

  useEffect(() => {
    let alive = true;

    (async () => {
      const teamsObj = draft?.teams || {};
      const allDexIds = [];
      for (const tid of Object.keys(teamsObj)) {
        const arr = Array.isArray(teamsObj[tid]) ? teamsObj[tid] : [];
        for (const p of arr) {
          if (p?.dexId) allDexIds.push(Number(p.dexId));
        }
      }

      const uniq = Array.from(new Set(allDexIds)).filter(Boolean);
      if (uniq.length === 0) {
        if (alive) setBaseDexMap({});
        return;
      }

      const next = {};
      for (const id of uniq) {
        try {
          next[id] = await getBaseFormDexId(id);
        } catch {
          next[id] = id;
        }
      }

      if (alive) setBaseDexMap(next);
    })();

    return () => {
      alive = false;
    };
  }, [JSON.stringify(draft?.teams || {})]);

  function baseDexIdOf(originalDexId) {
    const id = Number(originalDexId);
    return baseDexMap?.[id] ?? id;
  }

  // ✅ NEW: Build analysis team objects with types loaded from map
  const myTeamForAnalysis = useMemo(() => {
    return (myTeamPokemons || []).map((p) => {
      const rawDex = Number(p?.dexId);
      const effectiveDex = settings.keepEvolvedForms ? rawDex : baseDexIdOf(rawDex);
      return {
        ...p,
        dexId: effectiveDex,
        name: getPokemonName(effectiveDex),
        types: teamTypesMap?.[effectiveDex] || [],
      };
    });
  }, [JSON.stringify(myTeamPokemons), settings.keepEvolvedForms, JSON.stringify(teamTypesMap), JSON.stringify(baseDexMap)]);

  // ✅ NEW: Load types for my team (for TypeModal analysis)
  useEffect(() => {
    let alive = true;

    (async () => {
      const dexIds = (myTeamForAnalysis || [])
        .map((p) => Number(p?.dexId))
        .filter(Boolean);

      const uniq = Array.from(new Set(dexIds));
      if (uniq.length === 0) {
        if (alive) setTeamTypesMap({});
        return;
      }

      const nextMap = { ...(teamTypesMap || {}) };

      for (const dexId of uniq) {
        if (nextMap[dexId] && nextMap[dexId].length) continue;

        try {
          if (typeCache[dexId]) {
            nextMap[dexId] = typeCache[dexId];
            continue;
          }

          const res = await fetch(`https://pokeapi.co/api/v2/pokemon/${dexId}`);
          if (!res.ok) throw new Error("type fetch failed");
          const data = await res.json();
          const types = (data?.types || []).map((t) => t?.type?.name).filter(Boolean);

          typeCache[dexId] = types;
          nextMap[dexId] = types;
        } catch {
          nextMap[dexId] = [];
        }
      }

      if (alive) setTeamTypesMap(nextMap);
    })();

    return () => {
      alive = false;
    };
  }, [JSON.stringify((myTeamForAnalysis || []).map((p) => p.dexId))]);

  // ===== Init auction state once (host) =====
  const didInitRef = useRef(false);
  useEffect(() => {
    if (!room || !meIsHost) return;
    if (didInitRef.current) return;
    if (room.status !== "auction") return;

    // if already exists, don't overwrite
    if (room?.versus?.auction) {
      didInitRef.current = true;
      return;
    }

    didInitRef.current = true;

    const initial = {
      phase: "lobby",
      settings: {
        generation: 1,
        participants: 2,
        budgetPerTeam: 10000,
        totalPokemon: 12,
        secondsPerBid: 10,
        keepEvolvedForms: false,
      },
      teamOwners: ensureTeamOwners(2, {}),
      draft: {
        auctionCountDone: 0,
        current: null,

        teamIds: [],
        budgets: {},
        teams: {},

        pool: [],
        poolIndex: 0,
        totalPokemon: 12,

        highestBid: 0,
        highestTeamId: null,
        hasStarted: false,

        bannedDexIds: [],
      },
      timer: { running: false, paused: false, remaining: 10 },
      updatedAt: serverTimestamp(),
    };

    updateDoc(roomRef, {
      "versus.auction": initial,
      "versus.phase": "auction",
      updatedAt: serverTimestamp(),
    }).catch(() => {});
  }, [room, meIsHost, roomRef]);

  // ===== Host updates settings (sync) =====
  async function updateSettings(partial) {
    if (!meIsHost) return;

    const nextSettings = { ...settings, ...partial };
    const count = Math.max(2, clampInt(nextSettings.participants, 2, 8));

    await updateDoc(roomRef, {
      "versus.auction.settings": nextSettings,
      "versus.auction.teamOwners": ensureTeamOwners(count, teamOwners),
      "versus.auction.updatedAt": serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }

  // ===== Team join/leave (sync, transaction) =====
  async function claimTeam(tid) {
    // ✅ Join ist in Lobby UND Draft erlaubt
    if (phase !== "lobby" && phase !== "auction") return;
    if (!myPlayerId) return;

    await runTransaction(db, async (tx) => {
      const snap = await tx.get(roomRef);
      if (!snap.exists()) throw new Error("Room nicht gefunden.");

      const data = snap.data();
      const a = data?.versus?.auction;
      if (!a) throw new Error("Auction nicht initialisiert.");
      if (data.status !== "auction") throw new Error("Room nicht in Auction.");

      const s = a.settings || settings;
      const count = Math.max(2, clampInt(s.participants, 2, 8));
      const owners = ensureTeamOwners(count, a.teamOwners || {});

      // already in a team?
      if (Object.values(owners).some((pid) => pid === myPlayerId)) return;

      // ✅ nur joinen wenn das Team frei ist
      if (owners[tid]) return;

      owners[tid] = myPlayerId;

      tx.update(roomRef, {
        "versus.auction.teamOwners": owners,
        "versus.auction.updatedAt": serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    });
  }

  async function leaveMyTeam() {
    if (phase !== "lobby") return;
    if (!myTeamId || !myPlayerId) return;

    await runTransaction(db, async (tx) => {
      const snap = await tx.get(roomRef);
      if (!snap.exists()) throw new Error("Room nicht gefunden.");

      const data = snap.data();
      const a = data?.versus?.auction;
      if (!a) throw new Error("Auction nicht initialisiert.");

      const owners = { ...(a.teamOwners || {}) };
      if (owners[myTeamId] !== myPlayerId) return;

      owners[myTeamId] = null;

      tx.update(roomRef, {
        "versus.auction.teamOwners": owners,
        "versus.auction.updatedAt": serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    });
  }

  async function hostKickFromTeam(tid) {
    if (!meIsHost) return;
    if (phase !== "lobby" && phase !== "auction") return;

    await runTransaction(db, async (tx) => {
      const snap = await tx.get(roomRef);
      if (!snap.exists()) throw new Error("Room nicht gefunden.");

      const data = snap.data();
      const a = data?.versus?.auction;
      if (!a) throw new Error("Auction nicht initialisiert.");

      const owners = { ...(a.teamOwners || {}) };
      if (!owners[tid]) return; // schon frei

      owners[tid] = null;

      tx.update(roomRef, {
        "versus.auction.teamOwners": owners,
        "versus.auction.updatedAt": serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    });
  }

  // ===== Start Draft (host) =====
  async function startDraft() {
    if (!meIsHost) return;

    const gen = clampInt(settings.generation, 1, 7);
    const participants = Math.max(2, clampInt(settings.participants, 2, 8));
    const budgetPerTeam = Math.max(0, clampInt(settings.budgetPerTeam, 0, 9999999));
    const totalPokemon = Math.max(1, clampInt(settings.totalPokemon, 1, 999));
    const secondsPerBid = Math.max(5, clampInt(settings.secondsPerBid, 5, 60));

    let pool = makeShuffledPool(gen);

// ✅ Gen 6+ → Mega Formen zusätzlich in den Pool
if (gen >= 6) {
  const megaItems = MEGA_FORMS.map((m) => `mega:${m.form}`);
  pool = shuffleArray([...pool, ...megaItems]);
}

const poolIndex = 0;
const firstItem = pool[poolIndex] ?? null;

const current = firstItem ? await poolItemToCurrent(firstItem) : null;


    const budgets = {};
    const teams = {};
    const localTeamIds = Array.from({ length: participants }, (_, i) => teamIdFor(i));
    for (const tid of localTeamIds) {
      budgets[tid] = budgetPerTeam;
      teams[tid] = [];
    }

    // ensure owners exist
    const owners = ensureTeamOwners(participants, teamOwners);

    await updateDoc(roomRef, {
      "versus.auction.phase": "auction",
      "versus.auction.settings": {
        generation: gen,
        participants,
        budgetPerTeam,
        totalPokemon,
        secondsPerBid,
        keepEvolvedForms: !!settings.keepEvolvedForms,
      },
      "versus.auction.teamOwners": owners,
      "versus.auction.draft": {
        auctionCountDone: 0,
        current,
        teamIds: localTeamIds,
        budgets,
        teams,
        pool,
        poolIndex,
        totalPokemon,
        highestBid: 0,
        highestTeamId: null,
        hasStarted: false,
        bannedDexIds: [],
      },
      "versus.auction.timer": { running: false, paused: false, remaining: secondsPerBid },
      "versus.auction.updatedAt": serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    setBidInput(100);
  }

  async function restartDraftToSetup() {
    if (!meIsHost) return;

    const participants = Math.max(2, clampInt(settings.participants, 2, 8));
    const secondsPerBid = Math.max(5, clampInt(settings.secondsPerBid, 5, 60));

    const resetAuction = {
      phase: "lobby",
      settings: {
        generation: clampInt(settings.generation, 1, 7),
        participants,
        budgetPerTeam: Math.max(0, clampInt(settings.budgetPerTeam, 0, 9999999)),
        totalPokemon: Math.max(1, clampInt(settings.totalPokemon, 1, 999)),
        secondsPerBid,
      },
      teamOwners: ensureTeamOwners(participants, {}), // ✅ alle Teams wieder frei
      draft: {
        auctionCountDone: 0,
        current: null,

        teamIds: [],
        budgets: {},
        teams: {},

        pool: [],
        poolIndex: 0,
        totalPokemon: Math.max(1, clampInt(settings.totalPokemon, 1, 999)),

        highestBid: 0,
        highestTeamId: null,
        hasStarted: false,

        bannedDexIds: [],
      },
      timer: { running: false, paused: false, remaining: secondsPerBid },
      updatedAt: serverTimestamp(),
    };

    await updateDoc(roomRef, {
      "versus.auction": resetAuction,
      "versus.phase": "auction",
      updatedAt: serverTimestamp(),
    });
  }

  // ===== Bidding (transaction sync) =====
  function myBudget() {
    if (!myTeamId) return 0;
    return draft.budgets?.[myTeamId] ?? 0;
  }

  async function placeBid(amountRaw) {
    if (phase !== "auction") return;
    if (!draft.current) return;
    if (!myTeamId) return;
    if (!draft.teamIds.includes(myTeamId)) return;

    const amt = clampInt(amountRaw, 0, 999999999);
    if (amt < 100) return;
    if (amt % 100 !== 0) return;

    await runTransaction(db, async (tx) => {
      const snap = await tx.get(roomRef);
      if (!snap.exists()) throw new Error("Room nicht gefunden.");

      const data = snap.data();
      const a = data?.versus?.auction;
      if (!a) throw new Error("Auction nicht initialisiert.");
      if (a.phase !== "auction") return;

      const d = a.draft || {};
      const s = a.settings || settings;

      const cur = d.current;
      if (!cur) return;

      const teamIdsHere = d.teamIds || [];
      if (!teamIdsHere.includes(myTeamId)) return;

      const budgetsHere = d.budgets || {};
      const budget = budgetsHere[myTeamId] ?? 0;
      if (amt > budget) return;

      const highestBid = d.highestBid ?? 0;
      if (amt <= highestBid) return;

      tx.update(roomRef, {
        "versus.auction.draft.highestBid": amt,
        "versus.auction.draft.highestTeamId": myTeamId,
        "versus.auction.draft.hasStarted": true,
        "versus.auction.timer.paused": false,
        "versus.auction.timer.running": true,
        "versus.auction.timer.remaining": clampInt(s.secondsPerBid ?? 10, 5, 60),
        "versus.auction.updatedAt": serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    });
  }

  // ===== Host-only timer tick + award =====
  useEffect(() => {
    if (!meIsHost) return;
    if (phase !== "auction") return;
    if (!timer?.running) return;
    if (timer?.paused) return;

    const iv = setInterval(async () => {
      try {
        await runTransaction(db, async (tx) => {
          const snap = await tx.get(roomRef);
          if (!snap.exists()) return;
          const data = snap.data();
          const a = data?.versus?.auction;
          if (!a || a.phase !== "auction") return;

          const t = a.timer || {};
          if (!t.running || t.paused) return;

          const remaining = Number(t.remaining ?? 0);
          const next = remaining <= 0 ? 0 : remaining - 1;

          tx.update(roomRef, {
            "versus.auction.timer.remaining": next,
            "versus.auction.updatedAt": serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        });
      } catch {
        // ignore
      }
    }, 1000);

    return () => clearInterval(iv);
  }, [meIsHost, phase, timer?.running, timer?.paused, roomRef]);

  // When timer hits 0 -> host awards (with evo-line banning)
  useEffect(() => {
    if (!meIsHost) return;
    if (phase !== "auction") return;
    if (!timer?.running) return;
    if (timer?.paused) return;
    if ((timer?.remaining ?? 0) > 0) return;

    (async () => {
      try {
        // Snapshot außerhalb Transaction holen (PokeAPI erlaubt)
        const snap = await getDoc(roomRef);
        if (!snap.exists()) return;

        const data = snap.data();
        const a = data?.versus?.auction;
        if (!a || a.phase !== "auction") return;

        const d = a.draft || {};
        const s = a.settings || settings;

        if (!d.hasStarted || !d.highestTeamId || !d.highestBid || !d.current) {
          await updateDoc(roomRef, {
            "versus.auction.timer.running": false,
            "versus.auction.updatedAt": serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
          return;
        }

        const winnerTeam = d.highestTeamId;
        const price = d.highestBid;
        const poke = d.current;

        // Evolution-Line holen => Sperr-Liste
        const evoLineHere = await getEvolutionLineByDexId(poke.dexId);
        const evoDexIds = (evoLineHere || []).map((x) => Number(x.dexId)).filter(Boolean);
        if (evoDexIds.length === 0) evoDexIds.push(Number(poke.dexId));

        await runTransaction(db, async (tx) => {
          const snap2 = await tx.get(roomRef);
          if (!snap2.exists()) return;

          const data2 = snap2.data();
          const a2 = data2?.versus?.auction;
          if (!a2 || a2.phase !== "auction") return;

          const d2 = a2.draft || {};
          const s2 = a2.settings || s;

          // Safety
          if (!d2.current || Number(d2.current.dexId) !== Number(poke.dexId)) return;

          const budgets = { ...(d2.budgets || {}) };
          budgets[winnerTeam] = Math.max(0, (budgets[winnerTeam] ?? 0) - price);

          const teams = { ...(d2.teams || {}) };
          const teamArr = Array.isArray(teams[winnerTeam]) ? [...teams[winnerTeam]] : [];
          const draftedDexId = Number(poke.dexId); // gedraftete Form
          const baseDexId = Number(poke.baseDexId ?? poke.dexId); // Basisform
          teamArr.push({
  dexId: draftedDexId,                 // base dex for logic
  baseDexId,
  price,
  formKey: poke.formKey || null,       // ✅ mega info
  name: poke.name || getPokemonName(draftedDexId),
  imageUrl: poke.imageUrl || dexIdToImageUrl(draftedDexId),
});

          teams[winnerTeam] = teamArr;

          const prevBanned = Array.isArray(d2.bannedDexIds) ? d2.bannedDexIds : [];
          const bannedSet = new Set(prevBanned.map((x) => Number(x)).filter(Boolean));
          for (const id of evoDexIds) bannedSet.add(Number(id));
          const bannedDexIds = Array.from(bannedSet);

          const nextAuctionCount = (d2.auctionCountDone ?? 0) + 1;
          const totalPokemon = d2.totalPokemon ?? s2.totalPokemon ?? 12;
          const done = nextAuctionCount >= totalPokemon;

          const pool = d2.pool || [];
          const startIdx = (d2.poolIndex ?? 0) + 1;

          const { nextDex, nextIndex } = findNextAllowedFromPool(pool, startIdx, bannedSet);
          const nextCurrent = nextDex ? await poolItemToCurrent(nextDex) : null;


          if (done || !nextCurrent) {
            tx.update(roomRef, {
              "versus.auction.phase": "results",
              "versus.auction.draft": {
                ...d2,
                budgets,
                teams,
                bannedDexIds,
                auctionCountDone: nextAuctionCount,
                current: null,
                hasStarted: false,
                highestBid: 0,
                highestTeamId: null,
              },
              "versus.auction.timer": { running: false, paused: false, remaining: 0 },
              "versus.auction.updatedAt": serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
            return;
          }

          const secondsPerBid = clampInt(s2.secondsPerBid ?? 10, 5, 60);

          tx.update(roomRef, {
            "versus.auction.draft": {
              ...d2,
              budgets,
              teams,
              bannedDexIds,
              auctionCountDone: nextAuctionCount,
              poolIndex: nextIndex,
              current: nextCurrent,
              hasStarted: false,
              highestBid: 0,
              highestTeamId: null,
            },
            "versus.auction.timer": { running: false, paused: false, remaining: secondsPerBid },
            "versus.auction.updatedAt": serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        });
      } catch {
        // ignore
      }
    })();
  }, [meIsHost, phase, timer?.running, timer?.paused, timer?.remaining, roomRef, settings]);

  // ===== UI helpers =====
  function teamTitle(tid) {
    const owner = teamOwners?.[tid] ?? null;
    if (!owner) return "Frei";
    return labelPlayer(owner, room);
  }
  function teamIsFree(tid) {
    return !teamOwners?.[tid];
  }
  function teamIsMine(tid) {
    return teamOwners?.[tid] === myPlayerId;
  }

  // ===== Render Guards
  if (!roomId) return <div style={{ padding: 12 }}>Keine Room-ID in der URL.</div>;
  if (!room && !err) return <div style={{ padding: 12 }}>Lade Versus-Room …</div>;
  if (err) return <div style={{ padding: 12, color: "crimson" }}>{err}</div>;
  if (room === null) return <div style={{ padding: 12, color: "crimson" }}>Room nicht gefunden.</div>;

  return (
    <div style={outer}>
      <div style={topLine}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
          <div style={{ fontWeight: 900 }}>Versus — Auction Draft</div>

          {/* ✅ Zurück zur Lobby Button (immer sichtbar in auction/results) */}
          {(phase === "auction" || phase === "results") && (
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <button type="button" style={btnGhostSmall} onClick={goLobby} title="Zur Versus-Lobby">
                ← Zurück zur Lobby
              </button>

              {/* ✅ NEW: Type / Analysis Modal */}
              <button
                type="button"
                style={btnGhostSmall}
                onClick={() => setTypeModalOpen(true)}
                title="Typentabelle + Team-Analyse"
              >
                Typen / Analyse
              </button>

              {meIsHost && (
                <button
                  type="button"
                  style={btnGhostSmall}
                  onClick={restartDraftToSetup}
                  title="Setzt den Draft zurück und bringt dich zurück zur Setup-Auswahl"
                >
                  ↻ Restart Draft
                </button>
              )}
            </div>
          )}
        </div>

        <div style={{ opacity: 0.8, fontSize: 12 }}>
          Room: <b>{roomId}</b>
          {" · "}Host: <b>{labelPlayer(hostPlayerId, room)}</b>
          {" · "}Du: <b>{labelPlayer(myPlayerId, room)}</b>
        </div>
      </div>

      {phase === "lobby" && (
        <section style={panel}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, alignItems: "start" }}>
            {/* Settings */}
            <div>
              <div style={{ fontWeight: 900, marginBottom: 10 }}>Host Einstellungen</div>

              {!meIsHost ? (
                <div style={{ opacity: 0.8 }}>Warte auf Host…</div>
              ) : (
                <div style={{ display: "grid", gap: 8, maxWidth: 560 }}>
                  <Row label="Generation">
                    <select value={settings.generation} onChange={(e) => updateSettings({ generation: Number(e.target.value) })}>
                      {[1, 2, 3, 4, 5, 6, 7].map((g) => (
                        <option key={g} value={g}>
                          Gen {g} (bis #{getDexCapForGen(g)})
                        </option>
                      ))}
                    </select>
                  </Row>

                  <Row label="Teams (Teilnehmer)">
                    <input
                      type="number"
                      min={2}
                      max={8}
                      value={settings.participants}
                      onChange={(e) => updateSettings({ participants: Number(e.target.value) })}
                    />
                  </Row>

                  <Row label="Budget pro Team">
                    <input
                      type="number"
                      min={0}
                      step={100}
                      value={settings.budgetPerTeam}
                      onChange={(e) => updateSettings({ budgetPerTeam: Number(e.target.value) })}
                    />
                  </Row>

                  <Row label="Pokémon insgesamt">
                    <input
                      type="number"
                      min={1}
                      max={200}
                      value={settings.totalPokemon}
                      onChange={(e) => updateSettings({ totalPokemon: Number(e.target.value) })}
                    />
                  </Row>

                  <Row label="Sekunden nach Gebot (Reset)">
                    <input
                      type="number"
                      min={5}
                      max={60}
                      value={settings.secondsPerBid}
                      onChange={(e) => updateSettings({ secondsPerBid: Number(e.target.value) })}
                    />
                  </Row>

                  <Row label="Pokémon-Form im Team">
                    <select
                      value={settings.keepEvolvedForms ? "keep" : "base"}
                      onChange={(e) => updateSettings({ keepEvolvedForms: e.target.value === "keep" })}
                    >
                      <option value="base">Basisform only</option>
                      <option value="keep">Bleibt wie gedraftet</option>
                    </select>
                  </Row>

                  <button onClick={startDraft} style={btnPrimary}>
                    Draft starten
                  </button>
                </div>
              )}
            </div>

            {/* Team slots */}
            <div>
              <div style={{ fontWeight: 900, marginBottom: 10 }}>Teams auswählen</div>
              <div style={{ opacity: 0.8, fontSize: 12, marginBottom: 10 }}>
                Freie Teams sind <b>rot</b>. Belegte Teams <b>grün</b>. Klicke auf ein Team zum Joinen.
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10 }}>
                {teamIds.map((tid) => {
                  const free = teamIsFree(tid);
                  const mine = teamIsMine(tid);
                  const owner = teamOwners?.[tid] ?? null;

                  return (
                    <div
                      key={tid}
                      style={{
                        ...teamSlotCard,
                        borderColor: free ? "rgba(239,68,68,0.55)" : "rgba(34,197,94,0.55)",
                        background: free ? "rgba(239,68,68,0.08)" : "rgba(34,197,94,0.08)",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                        <div style={{ fontWeight: 900 }}>
                          {tid.toUpperCase()}
                          {mine ? " (deins)" : ""}
                        </div>
                        <div style={{ opacity: 0.85, fontWeight: 800 }}>{owner ? "belegt" : "frei"}</div>
                      </div>

                      <div style={{ marginTop: 6, fontWeight: 800 }}>{teamTitle(tid)}</div>

                      <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
                        {free ? (
                          <button
                            type="button"
                            style={btnGhost}
                            onClick={() => claimTeam(tid)}
                            disabled={!myPlayerId || !!myTeamId}
                            title={myTeamId ? "Du bist schon in einem Team" : "Team beitreten"}
                          >
                            Team beitreten
                          </button>
                        ) : mine ? (
                          <button type="button" style={btnGhost} onClick={leaveMyTeam}>
                            Team verlassen
                          </button>
                        ) : (
                          <button type="button" style={{ ...btnGhost, opacity: 0.5 }} disabled>
                            Belegt
                          </button>
                        )}

                        {/* ✅ Host kann belegtes Team leeren */}
                        {!free && meIsHost && (
                          <button
                            type="button"
                            style={{ ...btnDanger, padding: "10px 12px" }}
                            onClick={() => hostKickFromTeam(tid)}
                            title="Entfernt den Spieler aus dem Team (Geld/Pokémon bleiben)"
                          >
                            Entfernen
                          </button>
                        )}
                      </div>

                      <div style={{ marginTop: 10, fontSize: 12, opacity: 0.8 }}>
                        Dein Team: <b>{myTeamId ? myTeamId.toUpperCase() : "— (nicht gewählt)"}</b>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </section>
      )}

      {phase === "auction" && (
        <div style={auctionGrid}>
          {/* Teams */}
          <section style={{ ...panel, gridColumn: "1 / 3" }}>
            <div style={{ fontWeight: 900, marginBottom: 10 }}>Teams</div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10 }}>
              {draft.teamIds.map((tid) => {
                const money = draft.budgets?.[tid] ?? 0;
                const team = draft.teams?.[tid] ?? [];
                const free = teamIsFree(tid);
                const mine = teamIsMine(tid);

                // ================================
                // Anzeige-Team bestimmen
                // ================================
                let displayTeam = [];

                if (settings.keepEvolvedForms) {
                  // ✅ Originalformen anzeigen (so wie gedraftet)
                  displayTeam = team.map((p) => ({
                    dexId: p.dexId,
                    price: p.price,
                  }));
                } else {
                  // ✅ Basisformen deduplizieren
                  const seen = new Set();
                  displayTeam = [];

                  for (const p of team) {
                    const baseDex = baseDexIdOf(p.dexId);
                    if (!seen.has(baseDex)) {
                      seen.add(baseDex);
                      displayTeam.push({
                        dexId: baseDex,
                        price: p.price,
                      });
                    }
                  }
                }

                return (
                  <div
                    key={tid}
                    style={{
                      ...playerCard,
                      borderColor: free ? "rgba(239,68,68,0.35)" : "rgba(34,197,94,0.35)",
                      background: free ? "rgba(239,68,68,0.05)" : "rgba(34,197,94,0.05)",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
                      <div style={{ fontWeight: 900 }}>
                        {teamTitle(tid)} {mine ? "(du)" : ""}
                      </div>

                      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <div style={{ fontWeight: 900 }}>{money}€</div>

                        {!free && meIsHost && (
                          <button
                            type="button"
                            style={{ ...btnDanger, padding: "6px 10px", fontSize: 12 }}
                            onClick={() => hostKickFromTeam(tid)}
                            title="Owner entfernen (Geld/Pokémon bleiben)"
                          >
                            Entfernen
                          </button>
                        )}
                      </div>
                    </div>

                    {/* ✅ Draft: Team beitreten, wenn Team frei */}
                    {phase === "auction" && free && !myTeamId && (
                      <div style={{ marginTop: 8 }}>
                        <button type="button" style={btnGhost} onClick={() => claimTeam(tid)} title="Team beitreten (nur wenn frei)">
                          Team beitreten
                        </button>
                      </div>
                    )}

                    {/* Hinweis, falls man schon in einem Team ist */}
                    {phase === "auction" && free && myTeamId && (
                      <div style={{ marginTop: 8, fontSize: 12, opacity: 0.7 }}>Du bist bereits in einem Team.</div>
                    )}

                    <div
                      style={{
                        marginTop: 10,
                        display: "flex",
                        gap: 8,
                        overflowX: "auto",
                        overflowY: "hidden",
                        paddingBottom: 6,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {team.length === 0 ? (
                        <span style={{ opacity: 0.7, fontSize: 12 }}>Noch keine Pokémon</span>
                      ) : (
                        displayTeam.map((p, idx) => {
                          const name = getPokemonName(p.dexId);

                          return (
                            <button
                              key={`${tid}-${p.dexId}-${idx}`}
                              onClick={() => openPokemonDetails(p.dexId)}
                              title={`${name} (${p.price ?? "?"}€)`}
                              style={imgBtn}
                            >
                              <img
  src={p.imageUrl || dexIdToImageUrl(p.dexId)}
  alt={p.name || name}
  width={44}
  height={44}
  style={{ imageRendering: "pixelated", flex: "0 0 auto" }}
/>

                            </button>
                          );
                        })
                      )}
                    </div>

                    {free && <div style={{ fontSize: 12, opacity: 0.75 }}>(frei) — Teams werden in der Lobby belegt</div>}
                  </div>
                );
              })}
            </div>
          </section>

          {/* Current Pokémon */}
          <section style={{ ...panel, gridColumn: "1 / 2" }}>
            <div style={{ fontWeight: 900, marginBottom: 10 }}>
              Aktuelles Pokémon ({draft.auctionCountDone}/{draft.totalPokemon})
            </div>

            {draft.current ? (
              // ✅ NEW: Left stats + right centered pokemon
              <div style={{ display: "grid", gridTemplateColumns: "280px 1fr", gap: 16, alignItems: "start" }}>
                {/* LEFT: Stats */}
                <div style={statPanel}>
                  <div style={{ fontWeight: 950, marginBottom: 10 }}>Basiswerte</div>

                  {!curStats ? (
                    <div style={{ fontSize: 12, opacity: 0.75 }}>lädt…</div>
                  ) : (
                    <div style={{ display: "grid", gap: 8 }}>
                      <StatBar label="KP" value={curStats.hp} max={255} />
                      <StatBar label="ATK" value={curStats.atk} max={190} />
                      <StatBar label="DEF" value={curStats.def} max={230} />
                      <StatBar label="SP.ATK" value={curStats.spa} max={194} />
                      <StatBar label="SP.DEF" value={curStats.spd} max={230} />
                      <StatBar label="INIT" value={curStats.spe} max={200} />

                      <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid rgba(255,255,255,0.12)" }}>
                        <div style={{ fontSize: 12, opacity: 0.75 }}>Total</div>
                        <div style={{ fontSize: 22, fontWeight: 950 }}>{curStats.total}</div>
                      </div>
                    </div>
                  )}
                </div>

                {/* RIGHT: Pokémon + info (centered) */}
                <div style={{ display: "grid", gap: 10, justifyItems: "center" }}>
                  <div style={pokeHeroWrap}>
                    <button
                      style={pokeHeroBtn}
                      onClick={() => openPokemonDetails(draft.current.dexId)}
                      title="Pokémon-Details öffnen"
                    >
                      <img
                        src={draft.current.imageUrl}
                        alt={draft.current.name}
                        style={pokeHeroImg}
                      />
                    </button>

                    {/* 🔥 OVERLAY: Timer + Höchstgebot + Team */}
                    <div
                      style={{
                        ...pokeHeroOverlay,
                        ...(bidFlash ? pokeHeroOverlayFlash : null),
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-end" }}>
                        <div>
                          <div style={{ fontSize: 12, opacity: 0.85, marginTop: 6 }}>
                            Höchstgebot
                          </div>

                          <div
                            style={{
                              fontSize: 38,
                              fontWeight: 950,
                              lineHeight: 1,
                              transform: bidFlash ? "scale(1.06)" : "scale(1)",
                              transition: "transform 160ms ease",
                            }}
                          >
                            {draft.highestBid || 0}€
                          </div>

                          <div style={{ fontSize: 12, opacity: 0.9, marginTop: 2 }}>
                            von <b>{draft.highestTeamId ? teamTitle(draft.highestTeamId) : "—"}</b>
                          </div>
                        </div>

                        <div style={pokeHeroRightBadge}>
                          <div style={{ fontSize: 11, opacity: 0.8, fontWeight: 900 }}>Dex</div>
                          <div style={{ fontWeight: 900 }}>#{draft.current.dexId}</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontSize: 20, fontWeight: 900 }}>{draft.current.name}</div>
                    <div style={{ opacity: 0.8 }}>Dex #{draft.current.dexId}</div>

                    {(() => {
                      const tag = getSpecialTag(draft.current.dexId);
                      if (!tag) return null;

                      return (
                        <div
                          style={{
                            marginTop: 8,
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 8,
                            padding: "6px 12px",
                            borderRadius: 999,
                            fontSize: 12,
                            fontWeight: 950,
                            color: tag.text,
                            background: tag.color,
                            boxShadow: "0 10px 20px rgba(0,0,0,0.35)",
                            border: "1px solid rgba(255,255,255,0.18)",
                          }}
                          title="Besonderes Pokémon"
                        >
                          ⭐ {tag.label}
                        </div>
                      );
                    })()}

                    {curTypes.length > 0 && (
                      <div style={typeIconRow}>
                        {curTypes.map((t) => (
                          <img
                            key={t}
                            src={`https://raw.githubusercontent.com/partywhale/pokemon-type-icons/master/icons/${t.toLowerCase()}.svg`}
                            alt={t}
                            title={TYPE_LABELS_DE[t] ?? t}
                            style={{
                              ...typeIcon,
                              filter: "drop-shadow(0 0 4px rgba(0,0,0,0.6))",
                            }}
                            onError={(e) => {
                              // Fallback auf zweites CDN
                              e.currentTarget.src = `https://raw.githubusercontent.com/duiker101/pokemon-type-svg-icons/master/icons/${t.toLowerCase()}.svg`;
                            }}
                          />
                        ))}
                      </div>
                    )}
                  </div>

                  {/* ✅ Entwicklungsreihe größer + evo-method */}
                  <div style={{ width: "100%", marginTop: 6 }}>
                    {showEvoUI && (
  <div style={{ fontSize: 13, opacity: 0.85, marginBottom: 8, fontWeight: 800 }}>
    Entwicklungsreihe
  </div>
)}

                    {evoLoading ? (
                      <div style={{ fontSize: 12, opacity: 0.75 }}>lädt…</div>
                    ) : showEvoUI ? (

                      <div style={{ display: "grid", gap: 10, justifyItems: "start", width: "100%" }}>
                        <div
                          style={{
                            display: "flex",
                            gap: 12,
                            alignItems: "center",
                            flexWrap: "nowrap",
justifyContent: "flex-start",
overflowX: "auto",
overflowY: "hidden",
paddingBottom: 6,

                          }}
                        >
                         {evoLineWithMega.map((p, idx) => {
  const name = p.nameOverride || getPokemonName(p.dexId);
  const method = p.evolvesToText;
  const isLast = idx === evoLineWithMega.length - 1;

  // Mega erkennen (du hast formKey ja schon am Mega-Entry gesetzt)
  const isMega = !!p.formKey;

  const Arrow = ({ label }) => (
    <div style={{ display: "grid", justifyItems: "center", minWidth: 90 }}>
      <div style={{ opacity: 0.7, fontWeight: 900 }}>→</div>
      <div style={{ fontSize: 11, opacity: 0.85, textAlign: "center" }}>{label}</div>
    </div>
  );

  return (
    <React.Fragment key={`evo-${p.dexId}-${idx}`}>
      {/* Pfeil + Text VOR Mega */}
      {isMega && <Arrow label="Mega-Entwicklung" />}

      {/* genau 1 Karte pro Item */}
      <button style={evoCardBtn} onClick={() => openPokemonDetails(p.dexId)} title="Pokémon-Details öffnen">
        <img
          src={p.imageUrl || dexIdToImageUrl(p.dexId)}
          alt={name}
          style={{ width: 56, height: 56, imageRendering: "pixelated" }}
        />
        <div style={{ fontSize: 13, fontWeight: 900 }}>{name}</div>
        <div style={{ fontSize: 11, opacity: 0.75 }}>#{p.dexId}</div>
      </button>

      {/* Pfeil + Text NACH normalen Pokémon */}
      {!isMega && !isLast && !!method && <Arrow label={method} />}
    </React.Fragment>
  );
})}

                        </div>
{/* ✅ Stats der ganzen Entwicklungsreihe */}
<div style={{ width: "100%", marginTop: 10, maxWidth: 940 }}>
  <div style={{ fontSize: 12, opacity: 0.8, fontWeight: 950, marginBottom: 8, textAlign: "center" }}>
    Basiswerte pro Stufe
  </div>

  <div
  style={{
    display: "grid",
    gridTemplateColumns: `repeat(${evoLineWithMega.length}, minmax(220px, 1fr))`,
    gap: 10,
    width: "100%",
    justifyContent: "start",
    overflowX: "auto",
    paddingBottom: 6,
  }}
>

    {evoLineWithMega.map((p, idx) => {
      const name = p.nameOverride || getPokemonName(p.dexId);
      const key = p?.formKey ? `mega:${p.formKey}` : `dex:${Number(p?.dexId)}`;
      const st = evoStatsMap?.[key];

      return (
        <div
          key={`evostats-${key}-${idx}`}
          style={{
            padding: "10px 10px",
            borderRadius: 14,
            border: "1px solid rgba(255,255,255,0.14)",
            background: "rgba(0,0,0,0.22)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline" }}>
            <div style={{ fontWeight: 950 }}>{name}</div>
            <div style={{ opacity: 0.75, fontSize: 12 }}>
              {p.formKey ? "Mega" : `#${p.dexId}`}
            </div>
          </div>

          {!st ? (
            <div style={{ fontSize: 12, opacity: 0.75, marginTop: 8 }}>lädt…</div>
          ) : (
            <div style={{ display: "grid", gap: 6, marginTop: 10 }}>
              <StatBar label="KP" value={st.hp} max={255} />
              <StatBar label="ATK" value={st.atk} max={190} />
              <StatBar label="DEF" value={st.def} max={230} />
              <StatBar label="SP.ATK" value={st.spa} max={194} />
              <StatBar label="SP.DEF" value={st.spd} max={230} />
              <StatBar label="INIT" value={st.spe} max={200} />

              <div style={{ marginTop: 8, paddingTop: 8, borderTop: "1px solid rgba(255,255,255,0.12)" }}>
                <div style={{ fontSize: 12, opacity: 0.75 }}>Total</div>
                <div style={{ fontSize: 18, fontWeight: 950 }}>{st.total}</div>
              </div>
            </div>
          )}
        </div>
      );
    })}
  </div>
</div>

                        <div style={{ fontSize: 12, opacity: 0.75, textAlign: "center" }}>
                          Tipp: Klick auf ein Pokémon → Detailseite (Attacken usw.)
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ opacity: 0.8 }}>Kein Pokémon geladen.</div>
            )}
          </section>

          {/* Timer + Bid */}
          <section style={{ ...panel, gridColumn: "2 / 3", height: "min(61.5vh)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
              <div style={{ fontWeight: 900 }}>Timer</div>
            </div>

            <div style={timerBig}>{timer.running ? fmtSecs(timer.remaining) : "--"}</div>
            <div style={{ opacity: 0.8, marginBottom: 12 }}>
              {timer.running ? (timer.paused ? "Pausiert" : "Läuft") : "Startet bei erstem Gebot (≥ 100)"}
            </div>

            <div style={{ borderTop: "1px solid rgba(255,255,255,0.12)", paddingTop: 10, marginTop: 10 }}>
              <div style={{ fontWeight: 900, marginBottom: 8 }}>Bieten</div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8 }}>
                <input
                  type="number"
                  step={100}
                  min={100}
                  value={bidInput}
                  onChange={(e) => setBidInput(Number(e.target.value))}
                  style={input}
                  disabled={!myTeamId}
                />
                <button
                  onClick={() => placeBid(bidInput)}
                  style={{ ...btnPrimary, opacity: myTeamId ? 1 : 0.5 }}
                  disabled={!myTeamId}
                  title={myTeamId ? "Muss höher sein als das aktuelle Höchstgebot" : "Du musst erst ein Team wählen (Lobby)"}
                >
                  Bieten
                </button>
              </div>

              {/* ✅ Neue Quick-Buttons */}
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
                <button style={btnGhost} onClick={() => setBidInput(100)} disabled={!myTeamId}>
                  100
                </button>

                <button
                  style={btnGhost}
                  onClick={() => {
                    const next = round100((draft.highestBid || 0) + 100);
                    setBidInput(next);
                    placeBid(next);
                  }}
                  disabled={!myTeamId || !draft.current}
                  title="Bietet automatisch 100 über dem aktuellen Höchstgebot"
                >
                  Aktuelles Gebot +100
                </button>

                <button style={btnGhost} onClick={() => setBidInput((v) => Math.max(100, (v || 0) - 100))} disabled={!myTeamId}>
                  -100
                </button>

                <button style={btnGhost} onClick={() => setBidInput((v) => Math.max(0, v || 0) + 100)} disabled={!myTeamId}>
                  +100
                </button>

                <button style={btnGhost} onClick={() => setBidInput((v) => Math.max(0, v || 0) + 500)} disabled={!myTeamId}>
                  +500
                </button>

                <button style={btnGhost} onClick={() => setBidInput(myBudget() - (myBudget() % 100))} disabled={!myTeamId}>
                  All-in
                </button>
              </div>
            </div>

            <div style={{ marginTop: 12, display: "grid", gap: 8 }}>
              <button
                onClick={async () => {
                  if (!meIsHost) return;
                  if (!timer.running || timer.paused) return;
                  await updateDoc(roomRef, {
                    "versus.auction.timer.paused": true,
                    "versus.auction.updatedAt": serverTimestamp(),
                    updatedAt: serverTimestamp(),
                  });
                }}
                disabled={!meIsHost || !timer.running || timer.paused}
                style={{ ...btnGhost, opacity: !meIsHost || !timer.running || timer.paused ? 0.5 : 1 }}
              >
                Pause
              </button>

              <button
                onClick={async () => {
                  if (!meIsHost) return;
                  if (!timer.running || !timer.paused) return;
                  await updateDoc(roomRef, {
                    "versus.auction.timer.paused": false,
                    "versus.auction.timer.remaining": (timer.remaining ?? 0) + 5,
                    "versus.auction.updatedAt": serverTimestamp(),
                    updatedAt: serverTimestamp(),
                  });
                }}
                disabled={!meIsHost || !timer.running || !timer.paused}
                style={{ ...btnGhost, opacity: !meIsHost || !timer.running || !timer.paused ? 0.5 : 1 }}
              >
                Fortfahren (+5s)
              </button>
            </div>

            {/* 📊 Durchschnittspreis */}
            <div
              style={{
                marginTop: 16,
                paddingTop: 12,
                borderTop: "1px solid rgba(255,255,255,0.12)",
                display: "grid",
                gap: 6,
                justifyItems: "end",
                textAlign: "right",
              }}
            >
              <div style={{ fontSize: 12, opacity: 0.75 }}>Durchschnittspreis</div>

              <div style={{ fontSize: 22, fontWeight: 900 }}>{avgPrice.toLocaleString("de-DE")}€</div>

              <div style={{ fontSize: 11, opacity: 0.6 }}>{draft?.auctionCountDone || 0} verkauft</div>
            </div>
          </section>
        </div>
      )}

      {phase === "results" && (
        <section style={panel}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
            <div style={{ fontWeight: 900, fontSize: 18 }}>Draft fertig ✅</div>
            <button style={btnGhostSmall} onClick={goLobby} title="Zur Versus-Lobby">
              ← Zurück zur Lobby
            </button>
          </div>

          <div style={{ opacity: 0.85, marginBottom: 10 }}>Jetzt kann jeder sein Team in der ROM nachbauen.</div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 }}>
            {draft.teamIds.map((tid) => {
              const team = draft.teams?.[tid] ?? [];
              const money = draft.budgets?.[tid] ?? 0;
              const free = teamIsFree(tid);

              // ✅ Anzeige nur Basisformen (dedupe)
              const baseDisplay = [];
              const seen = new Set();
              for (const p of team) {
                const baseDex = baseDexIdOf(p.dexId);
                if (!seen.has(baseDex)) {
                  seen.add(baseDex);
                  baseDisplay.push({ baseDexId: baseDex, original: p });
                }
              }

              return (
                <div
                  key={tid}
                  style={{
                    ...playerCard,
                    borderColor: free ? "rgba(239,68,68,0.35)" : "rgba(34,197,94,0.35)",
                    background: free ? "rgba(239,68,68,0.05)" : "rgba(34,197,94,0.05)",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                    <div style={{ fontWeight: 900 }}>{teamTitle(tid)}</div>
                    <div style={{ fontWeight: 900, opacity: 0.9 }}>{money}€ übrig</div>
                  </div>

                  <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
                    {team.length === 0 ? (
                      <div style={{ opacity: 0.7 }}>Keine Pokémon</div>
                    ) : (
                      baseDisplay.map((x, idx) => {
                        const baseName = getPokemonName(x.baseDexId);
                        return (
                          <div key={`${tid}-base-row-${x.baseDexId}-${idx}`} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <button style={imgBtn} onClick={() => openPokemonDetails(x.baseDexId)} title="Pokémon-Details öffnen">
                              <img
  src={x.original?.imageUrl || dexIdToImageUrl(x.baseDexId)}
  alt={x.original?.name || baseName}
  width={44}
  height={44}
  style={{ imageRendering: "pixelated" }}
/>
                            </button>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontWeight: 900 }}>{baseName}</div>
                              <div style={{ opacity: 0.8, fontSize: 12 }}>
                                Basisform · (gedraftet: {x.original?.name ?? getPokemonName(x.original?.dexId)} · {x.original?.price ?? "?"}€)
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ✅ NEW: Type/Analysis modal (works in auction/results; safe everywhere) */}
      <TypeModal
        open={typeModalOpen}
        onClose={() => setTypeModalOpen(false)}
        myTeamPokemons={myTeamForAnalysis}
        title="Typen & Team-Analyse"
      />
    </div>
  );
}

function Row({ label, children }) {
  return (
    <label style={{ display: "grid", gridTemplateColumns: "220px 1fr", gap: 10, alignItems: "center" }}>
      <span style={{ opacity: 0.85 }}>{label}</span>
      {children}
    </label>
  );
}

function StatBar({ label, value, max }) {
  const v = Number(value ?? 0);
  const m = Number(max ?? 200);
  const pct = Math.max(0, Math.min(100, (v / m) * 100));

  // 🎨 Farblogik
  let color = "#ef4444"; // rot
  if (v >= 50) color = "#f97316"; // orange
  if (v >= 80) color = "#eab308"; // gelb
  if (v >= 100) color = "#22c55e"; // grün
  if (v >= 120) color = "#3b82f6"; // blau

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "64px 38px 1fr",
        gap: 10,
        alignItems: "center",
      }}
    >
      <div style={{ fontSize: 12, fontWeight: 900, opacity: 0.85 }}>
        {label}
      </div>

      <div style={{ fontWeight: 900 }}>{v}</div>

      <div
        style={{
          height: 10,
          borderRadius: 999,
          background: "rgba(255,255,255,0.12)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${pct}%`,
            height: "100%",
            background: color,
            boxShadow: "0 0 6px rgba(0,0,0,0.35)",
            transition: "width 220ms ease",
          }}
        />
      </div>
    </div>
  );
}


const outer = {
  width: "100%",
  height: "100%",
  display: "grid",
  gap: 10,
  overflow: "hidden",
};

const topLine = {
  display: "flex",
  flexDirection: "column",
  gap: 6,
  padding: "6px 0",
};

const panel = {
  padding: 12,
  border: "1px solid rgba(255,255,255,0.12)",
  borderRadius: 12,
  background: "rgba(0,0,0,0.15)",
};

const statPanel = {
  padding: 12,
  borderRadius: 14,
  border: "1px solid rgba(255,255,255,0.14)",
  background: "rgba(0,0,0,0.22)",
  boxShadow: "0 12px 28px rgba(0,0,0,0.35)",
};

const auctionGrid = {
  display: "grid",
  gridTemplateColumns: "1.6fr 1fr",
  gap: 10,
  alignItems: "start",
};

const playerCard = {
  padding: 12,
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.14)",
  background: "rgba(255,255,255,0.04)",
};

const teamSlotCard = {
  padding: 12,
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.14)",
  background: "rgba(255,255,255,0.04)",
};

const timerBig = {
  fontSize: 40,
  fontWeight: 900,
  letterSpacing: 1,
  marginBottom: 6,
};

const input = {
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.18)",
  background: "rgba(255,255,255,0.06)",
  color: "white",
  outline: "none",
};

const btnPrimary = {
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.28)",
  background: "rgba(255,255,255,0.16)",
  color: "white",
  cursor: "pointer",
  fontWeight: 900,
};

const btnGhost = {
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.18)",
  background: "rgba(255,255,255,0.06)",
  color: "white",
  cursor: "pointer",
  fontWeight: 800,
};

const btnGhostSmall = {
  padding: "8px 10px",
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.18)",
  background: "rgba(255,255,255,0.06)",
  color: "white",
  cursor: "pointer",
  fontWeight: 800,
  fontSize: 12,
};

const imgBtn = {
  padding: 0,
  border: "none",
  background: "transparent",
  cursor: "pointer",
};

const pokeHeroWrap = {
  position: "relative",
  width: 320,
  height: 320,
  borderRadius: 18,
  overflow: "hidden",
  border: "1px solid rgba(255,255,255,0.14)",
  background: "rgba(0,0,0,0.18)",
  boxShadow: "0 18px 40px rgba(0,0,0,0.45)",
};

const pokeHeroBtn = {
  padding: 0,
  border: "none",
  background: "transparent",
  cursor: "pointer",
  width: "100%",
  height: "100%",
  display: "grid",
  placeItems: "center",
};

const pokeHeroImg = {
  width: "100%",
  height: "100%",
  objectFit: "contain",
  imageRendering: "pixelated",
  filter: "drop-shadow(0 12px 22px rgba(0,0,0,0.65))",
};

const pokeHeroOverlay = {
  position: "absolute",
  left: 0,
  right: 0,
  bottom: 0,
  padding: "14px 14px 12px",
  background: "linear-gradient(to top, rgba(0,0,0,0.88), rgba(0,0,0,0.28), rgba(0,0,0,0))",
  color: "white",
};

// ✅ absichtlich leer -> kein weißer Rahmen/Glow beim Bieten
const pokeHeroOverlayFlash = {};

const pokeHeroRightBadge = {
  borderRadius: 12,
  padding: "10px 10px",
  background: "rgba(0,0,0,0.40)",
  border: "1px solid rgba(255,255,255,0.14)",
  minWidth: 70,
  textAlign: "center",
};

const evoCardBtn = {
  display: "grid",
  justifyItems: "center",
  gap: 4,
  padding: "10px 12px",
  borderRadius: 14,
  border: "1px solid rgba(255,255,255,0.22)",
  background: "rgba(0,0,0,0.28)",
  cursor: "pointer",
  color: "rgba(255,255,255,0.95)",
};

const typeIconRow = {
  display: "flex",
  gap: 10,
  justifyContent: "center",
  alignItems: "center",
  flexWrap: "wrap",
  marginTop: 10,
};

const typeIcon = {
  width: 42,
  height: 50,
  objectFit: "contain",
  imageRendering: "auto",
  filter: "drop-shadow(0 2px 8px rgba(0,0,0,0.6))",
};

const btnDanger = {
  borderRadius: 10,
  border: "1px solid rgba(239,68,68,0.35)",
  background: "rgba(239,68,68,0.12)",
  color: "white",
  cursor: "pointer",
  fontWeight: 900,
};
