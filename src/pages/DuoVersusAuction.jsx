import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { subscribeRoom } from "../versus/versusService"; // System A: versusRooms
import { db } from "../firebase";
import { doc, runTransaction, updateDoc, serverTimestamp, getDoc } from "firebase/firestore";

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
    const dex = pool[idx];
    if (dex && !bannedSet.has(Number(dex))) {
      return { nextDex: Number(dex), nextIndex: idx };
    }
    idx += 1;
  }
  return { nextDex: null, nextIndex: idx };
}

export default function DuoVersusAuction() {
  const nav = useNavigate();
  const { roomId: roomIdParam } = useParams();
  const roomId = String(roomIdParam || "").toUpperCase();
  const [curTypes, setCurTypes] = useState([]);
  const [room, setRoom] = useState(null);
  const [err, setErr] = useState("");

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

  // Local-only input
  const [bidInput, setBidInput] = useState(100);

  function round100(n) {
    const x = Number(n || 0);
    const r = Math.ceil(x / 100) * 100;
    return Math.max(100, r);
  }
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
  // ===== Evolution UI state (current Pokémon) =====
  const [evoLine, setEvoLine] = useState([]);
  const [evoLoading, setEvoLoading] = useState(false);

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

    const pool = makeShuffledPool(gen);
    const poolIndex = 0;
    const firstDex = pool[poolIndex] ?? null;

    const current = firstDex
      ? { dexId: firstDex, name: getPokemonName(firstDex), imageUrl: dexIdToImageUrl(firstDex) }
      : null;

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
      "versus.auction.settings": { generation: gen, participants, budgetPerTeam, totalPokemon, secondsPerBid, keepEvolvedForms: !!settings.keepEvolvedForms, },
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

  // Optional: direkt in die Lobby-Route zurück (UI wirkt “cleaner”)
  // goLobby();
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
          const draftedDexId = Number(poke.dexId);                 // gedraftete Form
const baseDexId = Number(poke.baseDexId ?? poke.dexId);  // Basisform
teamArr.push({
  dexId: draftedDexId,
  baseDexId,
  price,
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

          const nextCurrent = nextDex
            ? { dexId: nextDex, name: getPokemonName(nextDex), imageUrl: dexIdToImageUrl(nextDex) }
            : null;

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

                    </div>
                  );
                })}
              </div>

              <div style={{ marginTop: 10, fontSize: 12, opacity: 0.8 }}>
                Dein Team: <b>{myTeamId ? myTeamId.toUpperCase() : "— (nicht gewählt)"}</b>
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
    <button
      type="button"
      style={btnGhost}
      onClick={() => claimTeam(tid)}
      title="Team beitreten (nur wenn frei)"
    >
      Team beitreten
    </button>
  </div>
)}

{/* Hinweis, falls man schon in einem Team ist */}
{phase === "auction" && free && myTeamId && (
  <div style={{ marginTop: 8, fontSize: 12, opacity: 0.7 }}>
    Du bist bereits in einem Team.
  </div>
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
        src={dexIdToImageUrl(p.dexId)}
        alt={name}
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
              <div style={{ display: "grid", gap: 10, justifyItems: "center" }}>
                <button style={imgBtnBig} onClick={() => openPokemonDetails(draft.current.dexId)} title="Pokémon-Details öffnen">
                  <img
                    src={draft.current.imageUrl}
                    alt={draft.current.name}
                    width={180}
                    height={180}
                    style={{ imageRendering: "pixelated", filter: "drop-shadow(0 10px 18px rgba(0,0,0,0.6))" }}
                  />
                </button>

                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 20, fontWeight: 900 }}>{draft.current.name}</div>
                  <div style={{ opacity: 0.8 }}>Dex #{draft.current.dexId}</div>
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


                  <div style={{ marginTop: 6, opacity: 0.85 }}>
                    {draft.hasStarted ? (
                      <>
                        Höchstgebot: <b>{draft.highestBid}€</b> von <b>{teamTitle(draft.highestTeamId)}</b>
                      </>
                    ) : (
                      "Warte auf erstes Gebot (min. 100)"
                    )}
                  </div>
                </div>

                {/* ✅ Entwicklungsreihe größer + evo-method */}
                <div style={{ width: "100%", marginTop: 6 }}>
                  <div style={{ fontSize: 13, opacity: 0.85, marginBottom: 8, fontWeight: 900 }}>
                    Entwicklungsreihe
                  </div>

                  {evoLoading ? (
                    <div style={{ fontSize: 12, opacity: 0.75 }}>lädt…</div>
                  ) : evoLine.length ? (
                    <div style={{ display: "grid", gap: 10, justifyItems: "center" }}>
                      <div
                        style={{
                          display: "flex",
                          gap: 12,
                          alignItems: "center",
                          flexWrap: "wrap",
                          justifyContent: "center",
                        }}
                      >
                        {evoLine.map((p, idx) => {
                          const name = getPokemonName(p.dexId);
                          const method = p.evolvesToText; // method from THIS stage to next
                          const isLast = idx === evoLine.length - 1;

                          return (
                            <React.Fragment key={`evo-${p.dexId}-${idx}`}>
                              <button
                                style={evoCardBtn}
                                onClick={() => openPokemonDetails(p.dexId)}
                                title="Pokémon-Details öffnen"
                              >
                                <img
                                  src={dexIdToImageUrl(p.dexId)}
                                  alt={name}
                                  style={{ width: 56, height: 56, imageRendering: "pixelated" }}
                                />
                                <div style={{ fontSize: 13, fontWeight: 900 }}>{name}</div>
                                <div style={{ fontSize: 11, opacity: 0.75 }}>#{p.dexId}</div>
                              </button>

                              {!isLast && (
                                <div style={{ display: "grid", justifyItems: "center", minWidth: 90 }}>
                                  <div style={{ opacity: 0.7, fontWeight: 900 }}>→</div>
                                  <div style={{ fontSize: 11, opacity: 0.85, textAlign: "center" }}>
                                    {method || "—"}
                                  </div>
                                </div>
                              )}
                            </React.Fragment>
                          );
                        })}
                      </div>

                      <div style={{ fontSize: 12, opacity: 0.75, textAlign: "center" }}>
                        Tipp: Klick auf ein Pokémon → Detailseite (Attacken usw.)
                      </div>
                    </div>
                  ) : (
                    <div style={{ fontSize: 12, opacity: 0.75 }}>keine Daten</div>
                  )}
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

                <button
                  style={btnGhost}
                  onClick={() => setBidInput((v) => Math.max(100, (v || 0) - 100))}
                  disabled={!myTeamId}
                >
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

  <div style={{ fontSize: 22, fontWeight: 900 }}>
    {avgPrice.toLocaleString("de-DE")}€
  </div>

  <div style={{ fontSize: 11, opacity: 0.6 }}>
    {draft?.auctionCountDone || 0} verkauft
  </div>
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
                                src={dexIdToImageUrl(x.baseDexId)}
                                alt={baseName}
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

const imgBtnBig = {
  padding: 0,
  border: "none",
  background: "transparent",
  cursor: "pointer",
  borderRadius: 16,
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

const typeRow = {
  display: "flex",
  gap: 8,
  justifyContent: "center",
  flexWrap: "wrap",
  marginTop: 8,
};

const typeBadge = {
  padding: "4px 10px",
  borderRadius: 999,
  border: "1px solid rgba(255,255,255,0.22)",
  background: "rgba(0,0,0,0.22)",
  fontSize: 12,
  fontWeight: 900,
  color: "rgba(255,255,255,0.92)",
  textTransform: "uppercase",
  letterSpacing: 0.4,
  textShadow: "0 2px 10px rgba(0,0,0,0.6)",
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
  height:50,
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
