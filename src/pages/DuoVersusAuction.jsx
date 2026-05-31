// src/versus/DuoVersusAuction.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { subscribeRoom, transferHost, heartbeat, getStoredPlayerId  } from "../versus/versusService"; // System A: versusRooms
import { db } from "../firebase";
import { doc, runTransaction, updateDoc, serverTimestamp, getDoc } from "firebase/firestore";
import { comboMatches, isTypingTarget, loadHotkeys } from "../utils/hotkeys";
import TypeModal from "../versus/TypeModal";
import { makeShuffledPool, dexIdToImageUrl, getDexCapForGen } from "../utils/pokemonPool";
import { pokedex as fullPokedex } from "../data/pokedex.js";
import { buildBots, decideBotBid, generateBotConfigs, BOT_BEHAVIORS, BOT_DIFFICULTIES } from "../versus/botEngine";
import {
  statPanel,
  auctionGrid,
  playerCard,
  teamSlotCard,
  timerBig,
  input,
  btnPrimary,
  btnGhost,
  btnSecondary,
  btnGhostSmall,
  imgBtn,
  pokeHeroWrap,
  pokeHeroBtn,
  pokeHeroImg,
  pokeHeroOverlay,
  pokeHeroOverlayFlash,
  pokeHeroRightBadge,
  evoCardBtn,
  typeIconRow,
  typeIcon,
  btnDanger,
  pokeHeroOverlayFlashStrong,
  selectOption,
  selectDark
} from "./DuoVersusAuction.styles";
function normalizeBehavior(v) {
  return String(v || "none").trim().toLowerCase();
}

/* =========================================================
   Evolution Line (PokeAPI) + Cache (in-memory)
   - getEvolutionLineByDexId(dexId) -> [{ dexId, nameKey, evolvesToText? }]
   - getBaseFormDexId(dexId) -> baseDexId
========================================================= */
const evoMemCache = new Map(); // dexId -> line[{dexId,nameKey,evolvesToText}]
const evoInFlight = new Map(); // dexId -> Promise
const typeCache = {}; // dexId -> ["water","flying",...]
const statsCache = {}; // dexId -> { hp, atk, def, spa, spd, spe, total }

const AUCTION_MODES = {
  CLASSIC: "classic",
  BLIND_SINGLE: "blind_single",
  BLIND_MULTI: "blind_multi",
};

const AUCTION_MODE_LABELS = {
  [AUCTION_MODES.CLASSIC]: "Normaler Live-Auction Draft",
  [AUCTION_MODES.BLIND_SINGLE]: "Blind-Auction Einzel",
  [AUCTION_MODES.BLIND_MULTI]: "Blind-Auction Multi",
};

function getAuctionMode(settings) {
  const mode = String(settings?.auctionMode || AUCTION_MODES.CLASSIC);
  return Object.values(AUCTION_MODES).includes(mode) ? mode : AUCTION_MODES.CLASSIC;
}

function isBlindAuctionMode(settings) {
  const mode = getAuctionMode(settings);
  return mode === AUCTION_MODES.BLIND_SINGLE || mode === AUCTION_MODES.BLIND_MULTI;
}

function getPokemonAuctionKey(poke) {
  if (!poke) return "";
  if (poke.formKey) return `mega:${poke.formKey}`;
  return `dex:${Number(poke.dexId || 0)}`;
}

function getRoundOptionsFromDraft(draft) {
  const options = Array.isArray(draft?.currentOptions) ? draft.currentOptions.filter(Boolean) : [];
  if (options.length) return options;
  return draft?.current ? [draft.current] : [];
}

function makeDraftTeamPokemon(poke, price) {
  const draftedDexId = Number(poke?.dexId || 0);
  const baseDexId = Number(poke?.baseDexId ?? poke?.dexId ?? 0);

  return {
    dexId: draftedDexId,
    baseDexId,
    price,
    formKey: poke?.formKey || null,
    name: poke?.name || getPokemonName(draftedDexId),
    imageUrl: poke?.imageUrl || dexIdToImageUrl(draftedDexId),
  };
}

function sortBlindBidsDesc(a, b) {
  const amountDiff = Number(b?.amount || 0) - Number(a?.amount || 0);
  if (amountDiff !== 0) return amountDiff;

  // Tie-Break: früheres Gebot gewinnt.
  const aTime = Number(a?.updatedAtMs || 0);
  const bTime = Number(b?.updatedAtMs || 0);
  if (aTime !== bTime) return aTime - bTime;

  return String(a?.teamId || "").localeCompare(String(b?.teamId || ""));
}


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
function appendMegasToEvoLine(evoLine) {
  if (!Array.isArray(evoLine) || evoLine.length === 0) return evoLine;

  // Wir bauen eine Kopie, in die wir Megas "einfügen"
  let out = [...evoLine];

  // Welche Bases sind in der Linie?
  const baseDexIds = Array.from(
    new Set(out.map((p) => Number(p?.dexId)).filter(Boolean))
  );

  // Alle Mega-Forms, die zu dieser Linie passen (z.B. Garados, Bisaflor, etc.)
  const megasForLine = MEGA_FORMS.filter((m) => baseDexIds.includes(Number(m.base)));

  if (megasForLine.length === 0) return out;

  // Für jede passende Mega: direkt NACH dem passenden Base-Pokémon einfügen
  for (const mega of megasForLine) {
    const baseDex = Number(mega.base);
    const formKey = mega.form;

    // schon drin?
    if (out.some((e) => e?.formKey === formKey)) continue;

    // wo steht das Base in der out-Liste?
    const idxBase = out.findIndex((e) => Number(e?.dexId) === baseDex);
    if (idxBase === -1) continue;

    const baseName = getPokemonName(baseDex);

    const megaEntry = {
      dexId: baseDex,
      formKey,
      nameOverride: `${baseName} (${mega.label})`,
      imageUrl: null, // Bild kommt später über getMegaImageUrl / Render-Fallback
      evolvesToText: null, // Pfeil-Text machen wir im UI
    };

    // Einfügen direkt nach dem Base
    out = [
      ...out.slice(0, idxBase + 1),
      megaEntry,
      ...out.slice(idxBase + 1),
    ];
  }

  return out;
}



function shuffleArray(arr) {
  const a = [...(arr || [])];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateBotName(seed = "") {
  // kurz, witzig, pokemon-ish – ohne Markenstress
  const a = [
    "Wilder", "Schlauer", "Frecher", "Zäher", "Listiger", "Rasender",
    "Eisiger", "Glühender", "Nervöser", "Ruhiger", "Kühner", "Düsterer"
  ];
  const b = [
    "Bidder", "Trainer", "Draftlord", "Snacker", "Sampler", "Sparfuchs",
    "Knallkopf", "Taktiker", "Münzmeister", "Pokéhai", "Kaderplaner"
  ];
  const tag = seed ? String(seed).slice(-4) : String(Math.floor(Math.random() * 9999)).padStart(4, "0");
  return `${pick(a)} ${pick(b)} #${tag}`;
}

async function getMegaImageUrl(form) {
  if (!form) return null;
  if (megaSpriteCache.has(form)) return megaSpriteCache.get(form);

  try {
    const res = await fetch(`https://pokeapi.co/api/v2/pokemon/${form}`);
    if (!res.ok) throw new Error("mega sprite fetch failed");
    const data = await res.json();

    // 🔥 WICHTIG: richtige Priorität für Mega-Artworks
    const url =
      data?.sprites?.other?.["official-artwork"]?.front_default ||
      data?.sprites?.other?.home?.front_default ||
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
// ===========================
// Host Settings Persistence (localStorage)
// ===========================
const HOST_SETTINGS_KEY = "versus_host_settings_v1";

const DEFAULT_HOST_SETTINGS = {
  generation: 1,
  participants: 0,
  budgetPerTeam: 10000,
  totalPokemon: 12,
  secondsPerBid: 10,
  botCount: 0,
  botsConfig: [],

  // Auktionsart
  auctionMode: AUCTION_MODES.CLASSIC,
  blindMultiCount: 3,
  blindMultiLoserCompensation: false,

  // Draft-Modus Default: "Alle erlauben (bleibt wie gedraftet)"
  baseFormsOnly: false,
  keepEvolvedForms: true,

  // Pool-Filter Defaults: alles erlaubt (Checkboxen nicht gesetzt)
  allowLegendary: true,
  allowSubLegendary: true,
  allowMythical: true,
  allowPseudo: true,
};

function loadHostSettingsFromLS() {
  try {
    const raw = localStorage.getItem(HOST_SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_HOST_SETTINGS };

    const obj = JSON.parse(raw);
    // Merge + Fallback, damit alte Versionen nicht crashen
    return { ...DEFAULT_HOST_SETTINGS, ...(obj || {}) };
  } catch {
    return { ...DEFAULT_HOST_SETTINGS };
  }
}

function saveHostSettingsToLS(nextSettings) {
  try {
    const payload = { ...DEFAULT_HOST_SETTINGS, ...(nextSettings || {}) };
    localStorage.setItem(HOST_SETTINGS_KEY, JSON.stringify(payload));
  } catch {
    // ignore
  }
}

// ===========================
// Special Sets (für Badges + Pool-Filter)
// ===========================
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
  // Gen 7
  722, 723, 724, 725, 726, 727, 728, 729, 730,
  // Gen 8
  810, 811, 812, 813, 814, 815, 816, 817, 818,
  // Gen 9
  906, 907, 908, 909, 910, 911, 912, 913, 914,
]);

const PSEUDO = new Set([
  149, // Dragoran
  248, // Despotar
  373, // Brutalanda
  376, // Metagross
  445, // Knakrack
  635, // Trikephalo
  706, // Grandiras
  784, // Kommo-o
  887, // Dragapult
  1001, // Baojian
  1002, // Dinglu
  1003, // Yuyu
  1004, // Chongjian
  1007, // Koraidon 
  1008, // Miraidon 
]);


const LEGENDARY = new Set([
  // Gen 1
  150, // Mewtu

  // Gen 2
  249, // Lugia
  250, // Ho-Oh

  // Gen 3
  382, // Kyogre
  383, // Groudon
  384, // Rayquaza

  // Gen 4
  483, // Dialga
  484, // Palkia
  487, // Giratina

  // Gen 5
  643, // Reshiram
  644, // Zekrom
  646, // Kyurem

  // Gen 6
  716, // Xerneas
  717, // Yveltal
  718, // Zygarde

  // Gen 7
  789, 790, 791, 792, // Cosmog Linie + Solgaleo/Lunala
  800, // Necrozma

  // Gen 8
  888, // Zacian
  889, // Zamazenta
  890, // Eternatus
  898, // Calyrex

  // Gen 9
  1007, // Koraidon
  1008, // Miraidon
]);


const MYTHICAL = new Set([
  // Gen 1
  151, // Mew

  // Gen 2
  251, // Celebi

  // Gen 3
  385, // Jirachi
  386, // Deoxys

  // Gen 4
  489, // Phione
  490, // Manaphy
  491, // Darkrai
  492, // Shaymin
  493, // Arceus

  // Gen 5
  494, // Victini
  647, // Keldeo
  648, // Meloetta
  649, // Genesect

  // Gen 6
  719, // Diancie
  720, // Hoopa
  721, //Volcanion

  // Gen 7
  801, // Magearna
  802, // Marshadow
  807, // Zeraora
  808, // Meltan
  809, // Melmetal

  // Gen 8
  893, // Zarude

  // Gen 9
  1010, // Pecharunt
]);


const SUB_LEGENDARY = new Set([
  // Gen 1
  144, 145, 146, // Arktos, Zapdos, Lavados

  // Gen 2
  243, 244, 245, // Raikou, Entei, Suicune

  // Gen 3
  377, 378, 379, // Regirock, Regice, Registeel
  380, 381,      // Latias, Latios

  // Gen 4
  480, 481, 482, // Vesprit, Tobutz, Selfe
  485, 486, 488, // Heatran, Regigigas, Cresselia

  // Gen 5
  638, 639, 640, // Cobalion, Terrakion, Virizion
  641, 642, 645, // Boreos, Voltolos, Demeteros

  // Gen 6
  785, 786, 787, 788, // Kapu-Reihe (optional, falls du sie schon drin hast)

  // Gen 7
  785, 786, 787, 788, // Tapus (falls nicht doppelt → ok)
  791, 792, // optional je nach Regel

  // Gen 8
  891, // Kubfu
  892, // Urshifu
  894, 895, // Regieleki, Regidrago
  896, 897, // Glastrier, Spectrier

  // Gen 9
  1001, 1002, 1003, 1004, // Ruinous Quartet
]);

// Ultra Beasts (Gen 7)
const ULTRA_BEASTS = new Set([
  793, // Nihilego
  794, // Buzzwole
  795, // Pheromosa
  796, // Xurkitree
  797, // Celesteela
  798, // Kartana
  799, // Guzzlord
  803, // Poipole
  804, // Naganadel
  805, // Stakataka
  806, // Blacephalon
]);

const MEGA_BASES = new Set(MEGA_FORMS.map((m) => Number(m.base)));

function getSpecialFlags(dexIdRaw, opts = {}) {
  const dexId = Number(dexIdRaw);
  const isMega = !!opts?.isMega;

  return {
    starter: STARTERS.has(dexId),
    pseudo: PSEUDO.has(dexId),
    legendary: LEGENDARY.has(dexId),
    mythical: MYTHICAL.has(dexId),
    subLegendary: SUB_LEGENDARY.has(dexId),
    ultraBeast: ULTRA_BEASTS.has(dexId),
    mega: isMega, // ✅ nur wenn wirklich Mega-Form angezeigt wird
  };
}


function getSpecialTag(dexIdRaw, opts = {}) {
  const dexId = Number(dexIdRaw);
  const f = getSpecialFlags(dexId, { isMega: !!opts?.isMega });
  if (f.mega) return { label: "Mega", color: "#ff4fd8", text: "#3b0030" };
  if (f.ultraBeast) return { label: "Ultra-Bestie", color: "#3b82f6", text: "#06210f" };
  if (f.mythical) return { label: "Mythisch", color: "#facc15", text: "#111827" };
  if (f.legendary) return { label: "Legendär", color: "#a855f7", text: "white" };
  if (f.subLegendary) return { label: "Sub-Legendär", color: "#60a5fa", text: "#0b1220" };
  if (f.pseudo) return { label: "Pseudo-Legi", color: "#f97316", text: "#0b1220" };
  if (f.starter) return { label: "Starter-Reihe", color: "#22c55e", text: "#06210f" };

  return null;
}



function labelPlayer(playerId, room) {
  const id = String(playerId || "");

  // ✅ Bot-Owner (reserviert/AI)
  if (id.startsWith("bot:")) {
    const idx = Number(id.slice(4)); // bot:1, bot:2, ...
    const rid = String(room?.id || room?.roomId || room?.code || room?.versus?.roomId || "") || ""; // fallback
    // roomId haben wir in deiner Komponente sowieso als const roomId
    // aber hier sind wir außerhalb – darum notfalls rid leer lassen:
    return botNameFor(rid || "room", idx || 1);
  }

  // ✅ echte Spieler
  const arr = room?.players || [];
  const p = arr.find((x) => x.id === id);
  return p?.displayName || id?.slice?.(0, 6) || id || "—";
}

function stableHashInt(str) {
  const s = String(str || "");
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h >>> 0;
}

const BOT_NAMES = [
  "Bid-Basti",
  "Sparfuchs-Susi",
  "Overbid-Olli",
  "Flex-Fiona",
  "AllIn-Andi",
  "Knauser-Klaus",
  "Hochbieter-Hugo",
  "Sniper-Sabine",
  "Tilt-Timo",
  "Gönn-Dir-Gabi",
  "Auktions-Achim",
  "Münzen-Mario",
  "Panic-Petra",
  "Rage-Ronny",
  "Budget-Betty",
];

function botNameFor(roomId, botIndex1Based) {
  const base = stableHashInt(`${roomId}|bot|${botIndex1Based}`);
  const name = BOT_NAMES[base % BOT_NAMES.length];
  // kleines “Suffix”, damit sich Namen nicht doppeln
  const tag = String((base % 90) + 10);
  return `${name} #${tag}`;
}

const BOT_TEAM_ADJECTIVES = [
  "Wilde", "Schlaue", "Freche", "Zähe", "Listige", "Rasende",
  "Eisige", "Glühende", "Nervöse", "Ruhige", "Kühne", "Düstere",
  "Goldene", "Gierige", "Chaotische", "Taktische", "Mutige", "Sparsame"
];

const BOT_TEAM_NOUNS = [
  "Bidder", "Trainer", "Draftlords", "Sparfüchse", "Münzmeister", "Pokéhaie",
  "Kaderplaner", "Overbidders", "Auktionsbären", "Sniper", "All-In-Asse", "Budget-Bosse",
  "Glücksritter", "Team Rocket", "Panic-Picker", "Preisdrücker", "Zocker", "Pokéjäger"
];

function makeRandomBotDraftName(seedRaw) {
  const seed = String(seedRaw || `${Date.now()}|${Math.random()}`);
  const h = stableHashInt(seed);
  const adj = BOT_TEAM_ADJECTIVES[h % BOT_TEAM_ADJECTIVES.length];
  const noun = BOT_TEAM_NOUNS[Math.floor(h / 17) % BOT_TEAM_NOUNS.length];
  const tag = String((h % 90) + 10);
  return `${adj} ${noun} #${tag}`;
}

function sanitizeTeamName(raw) {
  return String(raw || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 28);
}

function buildTeamNamesForOwners(count, owners, previousNames = {}, previousOwners = {}, roomId = "room", opts = {}) {
  const next = {};
  const forceBotNames = !!opts.forceBotNames;
  const seed = String(opts.seed || "lobby");

  for (let i = 0; i < count; i++) {
    const tid = teamIdFor(i);
    const owner = owners?.[tid] ?? null;
    const prevOwner = previousOwners?.[tid] ?? null;
    const prevName = sanitizeTeamName(previousNames?.[tid] || "");

    if (owner && String(owner).startsWith("bot:")) {
      next[tid] = forceBotNames || !prevName
        ? makeRandomBotDraftName(`${roomId}|${tid}|${owner}|${seed}`)
        : prevName;
      continue;
    }

    // Wenn auf diesem Slot vorher ein Bot saß, übernehmen wir dessen Namen nicht für Menschen.
    if (prevName && !(prevOwner && String(prevOwner).startsWith("bot:"))) {
      next[tid] = prevName;
    }
  }

  return next;
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

async function findNextAllowedManyFromPool(pool, startIndex, bannedSet, countRaw) {
  const count = clampInt(countRaw, 2, 6);
  const options = [];
  let idx = startIndex;
  let lastIndex = startIndex;

  while (idx < (pool?.length || 0) && options.length < count) {
    const found = findNextAllowedFromPool(pool, idx, bannedSet);
    if (!found?.nextDex) {
      lastIndex = found?.nextIndex ?? idx;
      break;
    }

    const cur = await poolItemToCurrent(found.nextDex);
    if (cur) {
      options.push(cur);
      lastIndex = found.nextIndex;
    }

    idx = (found.nextIndex ?? idx) + 1;
  }

  return { options, nextIndex: lastIndex };
}

// ===========================
// Pool Filter Helpers
// ===========================

// Cache: dexId -> true/false ob Basisform (über pokemon-species.evolves_from_species)
const baseFormFlagCache = new Map();

async function isBaseFormDexId(dexIdRaw) {
  const dexId = Number(dexIdRaw);
  if (!dexId) return false;

  if (baseFormFlagCache.has(dexId)) return baseFormFlagCache.get(dexId);

  try {
    const res = await fetch(`https://pokeapi.co/api/v2/pokemon-species/${dexId}`);
    if (!res.ok) throw new Error("species fetch failed");

    const data = await res.json();
    const isBase = !data?.evolves_from_species;

    baseFormFlagCache.set(dexId, !!isBase);
    return !!isBase;
  } catch (err) {
    console.warn("isBaseFormDexId failed for dexId:", dexId, err);

    // Wichtig:
    // Bei API-Fehlern nicht das Pokémon wegfiltern,
    // sondern lieber drinlassen.
    baseFormFlagCache.set(dexId, true);
    return true;
  }
}

async function buildFilteredPool(rawPool, settings, gen) {
  let pool = Array.isArray(rawPool) ? [...rawPool] : [];

  // 1) Kategorie-Filter (Legendär/Mythisch/etc.)
  pool = pool.filter((item) => {
    // Mega -> anhand base dex filtern
    const dexId = isMegaPoolItem(item) ? Number(megaMetaFromItem(item)?.base) : Number(item);
    if (!dexId) return false;

    const f = getSpecialFlags(dexId);

    if (!settings.allowLegendary && f.legendary) return false;
    if (!settings.allowSubLegendary && f.subLegendary) return false;
    if (!settings.allowMythical && f.mythical) return false;
    if (!settings.allowPseudo && f.pseudo) return false;

    return true;
  });

  // 2) Basisform only: nur Basisformen, und Megas raus
  if (settings.baseFormsOnly) {
    // Megas raus (weil keine Basisform)
    pool = pool.filter((x) => !isMegaPoolItem(x));

    // Basisform-Check nur für normale DexIds
    const uniq = Array.from(new Set(pool.map((x) => Number(x)).filter(Boolean)));

    // parallelisiert, aber simpel
    const isBaseMap = new Map();
    await Promise.all(
      uniq.map(async (id) => {
        const ok = await isBaseFormDexId(id);
        isBaseMap.set(id, ok);
      })
    );

    pool = pool.filter((x) => {
      const id = Number(x);
      return !!isBaseMap.get(id);
    });
  }

  // Safety: falls durch Filter leer geworden
  if (pool.length === 0) {
    // fallback: wenigstens irgendwas
    pool = Array.isArray(rawPool) ? [...rawPool] : [];
    if (gen >= 6) {
      const megaItems = MEGA_FORMS.map((m) => `mega:${m.form}`);
      pool = shuffleArray([...pool, ...megaItems]);
    }
  }

  return pool;
}

export default function DuoVersusAuction() {
  const nav = useNavigate();
  const { roomId: roomIdParam } = useParams();
  const roomId = String(roomIdParam || "").toUpperCase();
  const myPlayerId = getStoredPlayerId(roomId) || "";
  const [bidFlash, setBidFlash] = useState(false);
  const [curTypes, setCurTypes] = useState([]);
  const [curStats, setCurStats] = useState(null); // ✅ NEW: current pokemon stats
  const [room, setRoom] = useState(null);
  const [err, setErr] = useState("");
  const [typeModalOpen, setTypeModalOpen] = useState(false);
// 🔊 Audio Settings (kommt aus ESC-Menü via appAudioSettingsChanged)
// Keys wie in GlobalEscapeMenu.jsx:
const AUDIO_KEYS = {
  muted: "app_audio_muted_v1",
  volume: "app_audio_volume_v1", // 0..1
};

// Fallback: deine alten Keys noch mitlesen (damit nix „resetet“)
const LEGACY_KEYS = {
  muted: "versusSoundMuted",
  volume: "versusSoundVolume", // 0..100
};

const [soundMuted, setSoundMuted] = useState(() => {
  const mNew = localStorage.getItem(AUDIO_KEYS.muted);
  if (mNew != null) return mNew === "1";
  return localStorage.getItem(LEGACY_KEYS.muted) === "1";
});

const [soundVolume, setSoundVolume] = useState(() => {
  const vNew = localStorage.getItem(AUDIO_KEYS.volume);
  if (vNew != null) {
    const v = Number(vNew);
    const vv = Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 0.6;
    return Math.round(vv * 100);
  }

  const vOld = Number(localStorage.getItem(LEGACY_KEYS.volume) ?? "80");
  return Number.isFinite(vOld) ? Math.max(0, Math.min(100, vOld)) : 80;
});
// =========================================================
// GLOBAL AUDIO REGISTRY (für alle new Audio() in der App)
// - verhindert "Ghost Audio", doppelte Songs
// - ESC Menü kann global Mute/Volume setzen
// =========================================================
function readGlobalAudioSettings() {
  const muted = localStorage.getItem(AUDIO_KEYS.muted) === "1";
  const vRaw = localStorage.getItem(AUDIO_KEYS.volume);
  const volume = vRaw == null ? 0.6 : Math.max(0, Math.min(1, Number(vRaw)));
  return { muted, volume };
}

// global registry auf window
function getAudioRegistry() {
  if (!window.__GLOBAL_AUDIO_REGISTRY__) window.__GLOBAL_AUDIO_REGISTRY__ = new Set();
  return window.__GLOBAL_AUDIO_REGISTRY__;
}

function registerGlobalAudio(a) {
  if (!a) return;
  getAudioRegistry().add(a);
}

function applySettingsToAudio(a, baseVolume = 1) {
  if (!a) return;
  const { muted, volume } = readGlobalAudioSettings();
  a.muted = !!muted;
  a.volume = Math.max(0, Math.min(1, volume * baseVolume));
}

function stopAudio(a) {
  if (!a) return;
  try {
    a.pause();
    a.currentTime = 0;
  } catch {}
}

function stopAllGlobalAudio() {
  try {
    const reg = getAudioRegistry();
    reg.forEach((a) => stopAudio(a));
  } catch {}
}

function setMasterVolume(nextRaw) {
  const next = Math.max(0, Math.min(100, Number(nextRaw)));
  setSoundVolume(next);
  localStorage.setItem("versusSoundVolume", String(next));
}
// ✅ Sync: ESC-Menü -> Draft Audio
useEffect(() => {
  function onAudioChanged(e) {
    const next = e?.detail;
    if (!next) return;

    const muted = !!next.muted;
    const vol01 = Math.max(0, Math.min(1, Number(next.volume ?? 0.6)));
    const volPct = Math.round(vol01 * 100);

    setSoundMuted(muted);
    setSoundVolume(volPct);

    // neue Keys persistieren
    localStorage.setItem(AUDIO_KEYS.muted, muted ? "1" : "0");
    localStorage.setItem(AUDIO_KEYS.volume, String(vol01));

    // alte Keys weiter pflegen (falls irgendwo im Code noch benutzt)
    localStorage.setItem(LEGACY_KEYS.muted, muted ? "1" : "0");
    localStorage.setItem(LEGACY_KEYS.volume, String(volPct));
  }

  window.addEventListener("appAudioSettingsChanged", onAudioChanged);
  return () => window.removeEventListener("appAudioSettingsChanged", onAudioChanged);
}, []);

function toggleSoundMuted() {
  setSoundMuted((v) => {
    const next = !v;
    localStorage.setItem("versusSoundMuted", next ? "1" : "0");
    return next;
  });
}

  // ✅ NEW: Team types map for analysis modal
  const [teamTypesMap, setTeamTypesMap] = useState({}); // { [dexId]: ["water","flying"] }

  // live room
  useEffect(() => {
    if (!roomId) return;
    setErr("");
    const unsub = subscribeRoom(roomId, (r) => setRoom(r));
    return () => unsub && unsub();
  }, [roomId]);
useEffect(() => {
  if (!roomId || !myPlayerId) return;

  // einmal sofort
  heartbeat(roomId, myPlayerId).catch(() => {});

  // dann regelmäßig
  const t = setInterval(() => {
    heartbeat(roomId, myPlayerId).catch(() => {});
  }, 15000);

  return () => clearInterval(t);
}, [roomId, myPlayerId]);

const players = room?.players || [];
const hostPlayerId = room?.hostPlayerId || "";
// ============================
// 4B: Offline-Markierung
// ============================
const OFFLINE_AFTER_MS = 45_000; // 45s (stell gern auf 30-90s)
const playersRaw = room?.players;

const playersList = useMemo(() => {
  if (!playersRaw) return [];
  if (Array.isArray(playersRaw)) return playersRaw;
  if (typeof playersRaw === "object") return Object.values(playersRaw);
  return [];
}, [playersRaw]);

const playersById = useMemo(() => {
  const map = new Map();
  (playersList || []).forEach((p) => {
    if (p?.id) map.set(String(p.id), p);
  });
  return map;
}, [playersList]);

function isPlayerOffline(playerId) {
  const pid = String(playerId || "").trim();
  if (!pid) return true;
  const p = playersById.get(pid);
  if (!p) return true;

  const last = Number(p?.lastSeenAt?.toMillis?.() ?? p?.lastSeenAt ?? 0);
  if (!last) return false; // wenn du lastSeenAt noch nicht für alle hast, lieber nicht direkt rot

  return Date.now() - last > OFFLINE_AFTER_MS;
}

const meIsHost = !!myPlayerId && !!hostPlayerId && myPlayerId === hostPlayerId;

async function makeAdmin(targetPlayerId, targetName) {
  try {
    if (!meIsHost) return;
    if (!targetPlayerId || targetPlayerId === myPlayerId) return;

    const ok = window.confirm(`Admin-Rechte an ${targetName || "Spieler"} übertragen?`);
    if (!ok) return;

    await transferHost(roomId, myPlayerId, targetPlayerId);
  } catch (e) {
    console.error(e);
    alert(e?.message || String(e));
  }
}

  function goLobby() {
    stopAllAudio();
    nav(`/versus/`);
  }

    async function copyRoomCode() {
    const code = String(roomId || "").trim().toUpperCase();
    if (!code) return;

    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(code);
      } else {
        const el = document.createElement("textarea");
        el.value = code;
        el.setAttribute("readonly", "");
        el.style.position = "fixed";
        el.style.opacity = "0";
        document.body.appendChild(el);
        el.select();
        document.execCommand("copy");
        document.body.removeChild(el);
      }

      setCopiedRoom(true);
      setTimeout(() => setCopiedRoom(false), 1400);
    } catch {
      alert("Room-Code konnte nicht kopiert werden.");
    }
  }

  function openPokemonDetails(dexId) {
  nav(`/pokemon/${dexId}`);
}

  // Guard: only valid in auction status
  useEffect(() => {
    if (!room) return;
    if (room.status !== "auction") {
      nav(`/versus/${roomId}`, { replace: true });
    }
  }, [room, roomId, nav]);

  //hier kann der hintergrund entfernt werden
//useEffect(() => {
//  document.body.classList.add("versus-page");
//  return () => document.body.classList.remove("versus-page");
//}, []);

useEffect(() => {
  const styleId = "draft-hide-scrollbar-style";

  let style = document.getElementById(styleId);
  if (!style) {
    style = document.createElement("style");
    style.id = styleId;
    style.textContent = `
      html.draft-hide-scrollbar,
      body.draft-hide-scrollbar {
        scrollbar-width: none;
        -ms-overflow-style: none;
      }

      html.draft-hide-scrollbar::-webkit-scrollbar,
      body.draft-hide-scrollbar::-webkit-scrollbar {
        width: 0;
        height: 0;
        display: none;
      }
    `;
    document.head.appendChild(style);
  }

  document.documentElement.classList.add("draft-hide-scrollbar");
  document.body.classList.add("draft-hide-scrollbar");

  return () => {
    document.documentElement.classList.remove("draft-hide-scrollbar");
    document.body.classList.remove("draft-hide-scrollbar");
  };
}, []);

  const roomRef = useMemo(() => doc(db, "versusRooms", roomId), [roomId]);

  // ===== Shared Auction State in Firestore =====
  const auction = room?.versus?.auction || null;

  const phase = auction?.phase || "lobby"; // lobby | auction | blindReveal | results
  const settings = auction?.settings || loadHostSettingsFromLS();
  const genNum = clampInt(settings?.generation ?? 1, 1, 9);
  const teamOwners = auction?.teamOwners || {};
  const teamNames = auction?.teamNames || {};
  const hasDraftBackground = phase === "lobby" || phase === "auction" || phase === "blindReveal" || phase === "results";
  const draftBgOverlay = phase === "lobby" ? "rgba(0,0,0,0.88)" : "rgba(0,0,0,0.78)";
  
  const outerStyle = {
    ...outer,
    display: phase === "lobby" ? "block" : "grid",
    alignContent: "start",
    backgroundImage: hasDraftBackground
      ? `linear-gradient(${draftBgOverlay}, ${draftBgOverlay}), url('/backgrounds/background_draft.png')`
      : "none",
    backgroundSize: hasDraftBackground ? "cover" : "auto",
    backgroundPosition: phase === "lobby" ? "center 22%" : "center 30%",
    backgroundRepeat: "no-repeat",
    backgroundColor: hasDraftBackground ? "#05070b" : "transparent",
    backgroundAttachment: hasDraftBackground ? "fixed" : "scroll",
    position: "relative",
  };

  const draft = auction?.draft || {
    auctionCountDone: 0,
    current: null,
    currentOptions: [],
    blindBids: {},
    blindReveal: null,

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

  const auctionMode = getAuctionMode(settings);
  const isBlindMode = isBlindAuctionMode(settings);
  const isBlindSingleMode = auctionMode === AUCTION_MODES.BLIND_SINGLE;
  const isBlindMultiMode = auctionMode === AUCTION_MODES.BLIND_MULTI;
  const currentOptions = getRoundOptionsFromDraft(draft);
  const blindBidCount = Object.keys(draft?.blindBids || {}).length;

const activePlayers = useMemo(() => {
  // wir nehmen "active" wenn vorhanden, sonst gilt jeder als aktiv
  return playersList.filter((p) => p && p.active !== false);
}, [playersList]);

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
  async function togglePauseTimer() {
  if (!meIsHost) return;
  if (!timer?.running) return;

  if (timer?.paused) {
    // Fortfahren
    await updateDoc(roomRef, {
      "versus.auction.timer.paused": false,
      "versus.auction.timer.remaining": (timer.remaining ?? 0) + 5,
      "versus.auction.updatedAt": serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } else {
    // Pause
    await updateDoc(roomRef, {
      "versus.auction.timer.paused": true,
      "versus.auction.updatedAt": serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }
}

  // ============================
// Battle Music Control (Step 4)
// ============================
const lastBattleDexRef = useRef(null);
const lastBattleRunningRef = useRef(false);
const winAudioRef = useRef(null);
const winStopTimeoutRef = useRef(null);
const lastAuctionCountRef = useRef(null);
const startAudioRef = useRef(null); // start1/start2 (ein Player reicht)
const endAudioRef = useRef(null);   // ende.mp3
const introKeyRef = useRef(null);   // damit intro nur 1x pro Draft läuft
const endKeyRef = useRef(null);     // damit ende nur 1x pro Results läuft


useEffect(() => {
  // wenn wir nicht in der Auction sind -> battle sicher aus
  if (phase !== "auction") {
  lastBattleDexRef.current = null;
  lastBattleRunningRef.current = false;
  stopAllAudio();
  return;
}


  // nur wenn countdown wirklich läuft
  const runningNow = !!timer?.running && !timer?.paused;

  // wenn nicht running oder muted -> battle aus
  if (!runningNow || soundMuted) {
    lastBattleRunningRef.current = false;
    stopBattle();
    return;
  }

  const curDex = Number(draft?.current?.dexId || 0);

  // ✅ Start, wenn running gerade erst true geworden ist
  if (!lastBattleRunningRef.current && runningNow) {
    lastBattleRunningRef.current = true;
    lastBattleDexRef.current = curDex || null;
    playBattleRestart();
    return;
  }

  // ✅ Restart, wenn ein neues Pokémon kommt während running
  if (curDex && lastBattleDexRef.current !== curDex) {
    lastBattleDexRef.current = curDex;
    playBattleRestart();
  }
}, [phase, timer?.running, timer?.paused, draft?.current?.dexId, soundMuted, genNum]);

  // ===== Timer Warning (last 3s) =====
const remainingSec = timer?.running ? Number(timer?.remaining ?? NaN) : NaN;
const isUrgent = Number.isFinite(remainingSec) && remainingSec > 0 && remainingSec <= 3;
useEffect(() => {
  if (soundMuted) return;
  // kein Timer oder pausiert -> reset
  if (!Number.isFinite(remainingSec) || !timer?.running || timer?.paused) {
    lastBeepSecondRef.current = null;
    return;
  }

  // ✅ Nur bei 3,2,1 (einmal pro Sekunde)
  if (remainingSec <= 3 && remainingSec >= 1) {
    if (lastBeepSecondRef.current !== remainingSec) {
      lastBeepSecondRef.current = remainingSec;

      // 3 -> 880Hz, 2 -> 980Hz, 1 -> 1100Hz
      const freq = remainingSec === 1 ? 1100 : remainingSec === 2 ? 980 : 880;
      playBeep(freq, 95, 0.004 * (soundVolume ?? 0.6));
    }
  } else {
    lastBeepSecondRef.current = null;
  }
}, [remainingSec, timer?.running, timer?.paused]);



const teamIds = useMemo(() => {
  const humans = clampInt(settings.participants ?? 0, 0, 20); // ✅ 0 erlaubt
  let bots = clampInt(settings.botCount ?? 0, 0, 9);

  // ✅ Bot-only: erzwinge mind. 1 Bot, sonst gäbe es 0 Teams
  if (humans === 0 && bots === 0) bots = 1;

  const total = Math.min(20, humans + bots);
  const safeTotal = Math.max(1, total);

  return Array.from({ length: safeTotal }, (_, i) => teamIdFor(i));
}, [settings.participants, settings.botCount]);




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
  const [blindOptionKey, setBlindOptionKey] = useState("");

  useEffect(() => {
    if (!isBlindMultiMode) {
      setBlindOptionKey("");
      return;
    }

    const keys = (currentOptions || []).map((p) => getPokemonAuctionKey(p)).filter(Boolean);
    if (!keys.length) {
      setBlindOptionKey("");
      return;
    }

    setBlindOptionKey((prev) => (keys.includes(prev) ? prev : keys[0]));
  }, [isBlindMultiMode, JSON.stringify((currentOptions || []).map((p) => getPokemonAuctionKey(p)))]);

  const displayPokemon = useMemo(() => {
    if (!isBlindMultiMode) return draft?.current || null;

    return (
      (currentOptions || []).find((p) => getPokemonAuctionKey(p) === blindOptionKey) ||
      (currentOptions || [])[0] ||
      draft?.current ||
      null
    );
  }, [
    isBlindMultiMode,
    blindOptionKey,
    draft?.current?.dexId,
    draft?.current?.formKey,
    JSON.stringify((currentOptions || []).map((p) => getPokemonAuctionKey(p))),
  ]);

  const myBlindBid = myTeamId ? draft?.blindBids?.[myTeamId] || null : null;
  const [teamNameInput, setTeamNameInput] = useState("");
  const [settingsModal, setSettingsModal] = useState(null); // "basic" | "auction" | "pool"
  const [teamModal, setTeamModal] = useState(null); // { tid, slotIdx }
  const [copiedRoom, setCopiedRoom] = useState(false);

  useEffect(() => {
    if (!myTeamId) {
      setTeamNameInput("");
      return;
    }

    setTeamNameInput(teamNames?.[myTeamId] || "");
  }, [myTeamId, teamNames?.[myTeamId]]);

  function round100(n) {
    const x = Number(n || 0);
    const r = Math.ceil(x / 100) * 100;
    return Math.max(100, r);
  }

  const lastBidRef = useRef(null);
  const lastAwardCountRef = useRef(null); // für Win-Sound beim Zuschlag

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
      const dexId = Number(displayPokemon?.dexId);
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
  }, [displayPokemon?.dexId]);

  // ✅ NEW: Current Pokemon base stats (PokeAPI)
  useEffect(() => {
    let alive = true;

    (async () => {
      const dexId = Number(displayPokemon?.dexId || 0);
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
  }, [displayPokemon?.dexId]);

  // ===== Evolution UI state (current Pokémon) =====
  const [evoLine, setEvoLine] = useState([]);
  const [evoLoading, setEvoLoading] = useState(false);
  const [evoStatsMap, setEvoStatsMap] = useState({}); // { [dexId]: {hp,atk,def,spa,spd,spe,total} }
  const [megaEvoImgMap, setMegaEvoImgMap] = useState({}); // { [formKey]: url }
  const [megaImgMap, setMegaImgMap] = useState({}); // formKey -> imageUrl
  const evoLineInGen = useMemo(() => {
  const base = Array.isArray(evoLine) ? evoLine : [];
  const cap = getDexCapForGen(genNum); // z.B. Gen1 -> 151
  return base.filter((p) => Number(p?.dexId) > 0 && Number(p.dexId) <= cap);
}, [evoLine, genNum]);
  const evoLineWithMega = useMemo(() => {
if (!Array.isArray(evoLineInGen)) return [];

if (Number(settings?.generation) >= 6) {
  return appendMegasToEvoLine(evoLineInGen);
}

return evoLineInGen;

}, [evoLineInGen, settings?.generation]);
const lastBeepSecondRef = useRef(null);
const lastTickSecondRef = useRef(null);

// mini beep ohne Datei (WebAudio)
function playBeep(freq = 880, durationMs = 90, volume = 0.06) {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;

    const ctx = new AudioCtx();
    const o = ctx.createOscillator();
    const g = ctx.createGain();

    o.type = "sine";
    o.frequency.value = freq;
    g.gain.value = volume;

    o.connect(g);
    g.connect(ctx.destination);

    o.start();
    setTimeout(() => {
      o.stop();
      ctx.close().catch(() => {});
    }, durationMs);
  } catch {
    // ignore (z.B. wenn browser blockt)
  }
}
// ============================
// MP3 Engine (Gen-spezifisch)
// public/audio/genX/battle.mp3
// public/audio/genX/auctionWin.mp3
// ============================
const battleAudioRef = useRef(null);


function battleSrcForGen(gen) {
  return `/audio/gen${gen}/battle.mp3`;
}
function winSrcForGen(gen) {
  return `/audio/gen${gen}/auctionWin.mp3`;
}
function start1SrcForGen(gen) {
  return `/audio/gen${gen}/start1.mp3`;
}
function start2SrcForGen(gen) {
  return `/audio/gen${gen}/start2.mp3`;
}
function end1SrcForGen(gen) {
  return `/audio/gen${gen}/ende1.mp3`;
}
function end2SrcForGen(gen) {
  return `/audio/gen${gen}/ende2.mp3`;
}

function ensureBattleAudio() {
  if (!battleAudioRef.current) {
    const a = new Audio();
    a.preload = "auto";
    a.loop = true;

    registerGlobalAudio(a);
    applySettingsToAudio(a, 0.35);
    applyAudioSettings(a, 0.35);

    battleAudioRef.current = a;
  }

  const a = battleAudioRef.current;

  const want = battleSrcForGen(genNum);
  const wantAbs = window.location.origin + want;
  if (a.src !== wantAbs) a.src = want;

  // settings refresh (falls ESC geändert wurde)
  applySettingsToAudio(a, 0.35);
  applyAudioSettings(a, 0.35);

  return a;
}

function ensureWinAudio() {
  if (!winAudioRef.current) {
    const w = new Audio();
    w.preload = "auto";
    w.loop = false;

    // ✅ richtig: WIN registrieren (nicht battle)
    registerGlobalAudio(w);
    applySettingsToAudio(w, 0.45);
    applyAudioSettings(w, 0.45);

    winAudioRef.current = w;
  }

  const w = winAudioRef.current;

  const want = winSrcForGen(genNum);
  const wantAbs = window.location.origin + want;
  if (w.src !== wantAbs) w.src = want;

  // settings refresh (falls ESC geändert wurde)
  applySettingsToAudio(w, 0.45);
  applyAudioSettings(w, 0.45);

  return w;
}

function applyAudioSettings(a, baseVolume = 1) {
  if (!a) return;

  const percent = Math.max(0, Math.min(100, soundVolume));
  const vol = (percent / 100) * baseVolume;

  a.muted = !!soundMuted;
  a.volume = Math.max(0, Math.min(1, vol));
}

// ✅ Wenn Sound Settings sich ändern: auf alle Audio-Reusen anwenden
useEffect(() => {
  try {
    applyAudioSettings(battleAudioRef.current, 0.35);
    applyAudioSettings(winAudioRef.current, 0.45);
    applyAudioSettings(startAudioRef.current, 0.9);
    applyAudioSettings(endAudioRef.current, 0.8);
  } catch {}
}, [soundMuted, soundVolume]);

function stopBattle() {
  const a = battleAudioRef.current;
  if (!a) return;
  try {
    a.pause();
    a.currentTime = 0;
  } catch {}
}
function stopAllAudio() {
  stopBattle();
  stopWin();
  stopIntro();
  stopEnd();
}

async function playBattleRestart() {
  stopAllGlobalAudio();
  if (soundMuted) return;

  // ✅ Battle soll IMMER alles andere überschreiben
  stopIntro();
  stopEnd();
  stopWin();

  const a = ensureBattleAudio();

  try {
    a.pause();
    a.currentTime = 0;
    await a.play();
  } catch {
    // Autoplay kann blocken bis User-Interaktion -> ok
  }
}

function stopIntro() {
  const a = startAudioRef.current;
  if (!a) return;
  try {
    a.onended = null;
    a.pause();
    a.currentTime = 0;
  } catch {}
}

function stopEnd() {
  const a = endAudioRef.current;
  if (!a) return;
  try {
    a.onended = null;     // ✅ wichtig: chain reset
    a.pause();
    a.currentTime = 0;
  } catch {}
}

function ensureStartAudio() {
  if (startAudioRef.current) return startAudioRef.current;
  const a = new Audio();
  a.preload = "auto";

  // ✅ global registrieren, damit stopAllGlobalAudio() + ESC Settings greifen
  registerGlobalAudio(a);

  // initial settings
  applySettingsToAudio(a, 0.9);
  applyAudioSettings(a, 0.9);

  startAudioRef.current = a;
  return a;
}

function ensureEndAudio() {
  if (endAudioRef.current) return endAudioRef.current;
  const a = new Audio();
  a.preload = "auto";

  // ✅ global registrieren, damit stopAllGlobalAudio() + ESC Settings greifen
  registerGlobalAudio(a);

  // initial settings
  applySettingsToAudio(a, 0.9);
  applyAudioSettings(a, 0.9);

  endAudioRef.current = a;
  return a;
}

// start1 -> (onended) -> start2
function playIntroOnce(gen) {
  if (soundMuted) return;

  // Sicherheit: nichts überlappen lassen
  stopBattle?.();
  stopWin?.();
  stopEnd();
  stopIntro();

  const a = ensureStartAudio();

  a.onended = null;
  a.src = start1SrcForGen(gen);
  a.currentTime = 0;

  const playStart2 = () => {
    stopAllGlobalAudio();
    if (soundMuted) return;
    a.onended = null;
    a.src = start2SrcForGen(gen);
    a.currentTime = 0;
    a.play().catch(() => {});
  };

  a.onended = playStart2;
  a.play().catch(() => {});
}

function playEndOnce(gen) {
  stopAllGlobalAudio();
  if (soundMuted) return;

  // Sicherheit: alles andere aus
  stopBattle?.();
  stopWin?.();
  stopIntro();
  stopEnd();

  const a = ensureEndAudio();

  a.onended = null;
  a.src = end1SrcForGen(gen);
  a.currentTime = 0;

  const playEnd2 = () => {
    if (soundMuted) return; // falls währenddessen gemutet wurde, starten wir Teil 2 nicht neu
    a.onended = null;
    a.src = end2SrcForGen(gen);
    a.currentTime = 0;
    a.play().catch(() => {});
  };

  a.onended = playEnd2;
  a.play().catch(() => {});
}




function stopWin() {
  if (winStopTimeoutRef.current) {
    clearTimeout(winStopTimeoutRef.current);
    winStopTimeoutRef.current = null;
  }

  const a = winAudioRef.current;
  if (!a) return;

  try {
    a.pause();
    a.currentTime = 0;
  } catch {}
}


function playWinOnce() {
  stopAllGlobalAudio();
  if (soundMuted) return;

  const a = ensureWinAudio();

  // falls Gen gewechselt hat, Quelle updaten
  const want = winSrcForGen(genNum);
  if (a.src && !a.src.endsWith(want)) {
    a.src = want;
  }

  try {
    a.pause();
    a.currentTime = 0;
    a.play().catch(() => {});
  } catch {}
    // nach 6 Sekunden automatisch stoppen
  if (winStopTimeoutRef.current) clearTimeout(winStopTimeoutRef.current);
  winStopTimeoutRef.current = setTimeout(() => {
    stopWin();
  }, 10000);

}

async function playAuctionWin() {
  if (soundMuted) return;

  // battle aus
  stopBattle();

  const w = ensureWinAudio();
  try {
    w.pause();
    w.currentTime = 0;
    await w.play();
  } catch {
    // Autoplay kann blocken -> ok
  }
}

// Cleanup beim Unmount
useEffect(() => {
  return () => {
    try { battleAudioRef.current?.pause(); } catch {}
    try { winAudioRef.current?.pause(); } catch {}
    battleAudioRef.current = null;
    winAudioRef.current = null;
  };
}, []);
useEffect(() => {
  applyAudioSettings(battleAudioRef.current, 0.35);
  applyAudioSettings(winAudioRef.current, 0.9);
  applyAudioSettings(startAudioRef.current, 0.9);
  applyAudioSettings(endAudioRef.current, 0.9);
}, [soundMuted, soundVolume]);

useEffect(() => {
  function onAudioChanged() {
    // wenn ESC Menü etwas ändert: auf ALLE globalen audios anwenden
    const reg = getAudioRegistry();
    reg.forEach((a) => applySettingsToAudio(a, 1));
  }

  window.addEventListener("appAudioSettingsChanged", onAudioChanged);
  return () => window.removeEventListener("appAudioSettingsChanged", onAudioChanged);
}, []);
useEffect(() => {
  // ✅ wenn man die Draft-Seite verlässt (z.B. Pokémon Info öffnen), alles stoppen
  return () => {
    stopAllGlobalAudio();
  };
}, []);

useEffect(() => {
  // nur während der Auction relevant
  if (phase !== "auction") {
    lastAuctionCountRef.current = null;
    stopWin();
    return;
  }

  const count = Number(draft?.auctionCountDone ?? 0);

  // erster Render -> nur merken, nicht abspielen
  if (lastAuctionCountRef.current === null) {
    lastAuctionCountRef.current = count;
    return;
  }

  // wenn count hochgeht -> Pokémon wurde vergeben -> Win-Sound
  if (count > lastAuctionCountRef.current) {
    lastAuctionCountRef.current = count;

    // battle stoppt sowieso, weil timer danach running:false ist,
    // aber wir machen es hier "hart", damit es clean ist:
    stopBattle?.();
    playWinOnce();
    return;
  }

  lastAuctionCountRef.current = count;
}, [phase, draft?.auctionCountDone, soundMuted, genNum]);

// ===== WebAudio Engine (re-use, no spam) =====
const audioCtxRef = useRef(null);

function getAudioCtx() {
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return null;
  if (!audioCtxRef.current) audioCtxRef.current = new AudioCtx();
  // manche Browser starten suspended -> versuchen zu aktivieren
  if (audioCtxRef.current.state === "suspended") {
    audioCtxRef.current.resume().catch(() => {});
  }
  return audioCtxRef.current;
}

// Leiser Tick (jede Sekunde während Timer läuft)
function playTick() {
  const ctx = getAudioCtx();
  if (!ctx) return;

  try {
    const o = ctx.createOscillator();
    const g = ctx.createGain();

    const t0 = ctx.currentTime;
    o.type = "square";
    o.frequency.setValueAtTime(220, t0);

    // kurzes "clicky" envelope
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(0.035, t0 + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.06);

    o.connect(g);
    g.connect(ctx.destination);

    o.start(t0);
    o.stop(t0 + 0.07);
  } catch {
    // ignore
  }
}

// Cooler Beep für die letzten 5 Sekunden (kleine 2-Ton Kombi)
function playFinalBeep(secLeft) {
  if (soundMuted) return;
  const ctx = getAudioCtx();
  if (!ctx) return;

  try {
    // 🔊 Lautstärke & Tonhöhe je nach Sekunde
    let baseFreq = 700;
    let volume = 0.04;

    if (secLeft === 5) { baseFreq = 620; volume = 0.035; }
    if (secLeft === 4) { baseFreq = 680; volume = 0.045; }

    if (secLeft === 3) { baseFreq = 820; volume = 0.07; }
    if (secLeft === 2) { baseFreq = 960; volume = 0.085; }
    if (secLeft === 1) { baseFreq = 1100; volume = 0.11; }

    const o = ctx.createOscillator();
    const g = ctx.createGain();

    const t0 = ctx.currentTime;
    o.type = "sine";

    // kleiner "chirp"
    o.frequency.setValueAtTime(baseFreq, t0);
    o.frequency.exponentialRampToValueAtTime(baseFreq * 1.25, t0 + 0.1);

    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(volume, t0 + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.14);

    o.connect(g);
    g.connect(ctx.destination);

    o.start(t0);
    o.stop(t0 + 0.15);
  } catch {
    // ignore
  }
}
// 🎉 Fröhlicher Win-Sound (Pokemon-Style)
function playWinSound() {
  if (soundMuted) return;
  const ctx = getAudioCtx();
  if (!ctx) return;

  try {
    const t0 = ctx.currentTime;

    const notes = [660, 880, 1100]; // fröhliche Dreiklang-Steigerung
    notes.forEach((freq, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();

      o.type = "triangle";
      o.frequency.setValueAtTime(freq, t0 + i * 0.08);

      g.gain.setValueAtTime(0.0001, t0 + i * 0.08);
      g.gain.exponentialRampToValueAtTime(0.12, t0 + i * 0.08 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + i * 0.08 + 0.18);

      o.connect(g);
      g.connect(ctx.destination);

      o.start(t0 + i * 0.08);
      o.stop(t0 + i * 0.08 + 0.2);
    });
  } catch {
    // ignore
  }
}



const showEvoUI = useMemo(() => {
  const baseLine = Array.isArray(evoLineInGen) ? evoLineInGen : [];
  const hasNormalEvo = baseLine.length > 1;
  const hasMega = Array.isArray(evoLineWithMega) && evoLineWithMega.some((x) => !!x?.formKey);
  return hasNormalEvo || hasMega;
}, [evoLineInGen, evoLineWithMega]);

useEffect(() => {
  let alive = true;

  (async () => {
    const line = Array.isArray(evoLineWithMega) ? evoLineWithMega : [];
    const megaKeys = line.map((p) => p?.formKey).filter(Boolean);

    if (!megaKeys.length) return;

    const next = { ...(megaImgMap || {}) };

    for (const fk of megaKeys) {
      if (next[fk]) continue; // schon geladen
      const url = await getMegaImageUrl(fk); // PokeAPI -> sprites -> png-id (z.B. 10041)
      next[fk] = url || null;
    }

    if (alive) setMegaImgMap(next);
  })();

  return () => {
    alive = false;
  };
}, [JSON.stringify((evoLineWithMega || []).map((p) => p?.formKey).filter(Boolean))]);

useEffect(() => {
  let alive = true;

  (async () => {
    const line = Array.isArray(evoLineWithMega) ? evoLineWithMega : [];
    const megaForms = line.map((p) => p?.formKey).filter(Boolean);

    if (!megaForms.length) {
      if (alive) setMegaEvoImgMap({});
      return;
    }

    const uniq = Array.from(new Set(megaForms));
    const next = {};

    for (const form of uniq) {
      try {
        const url = await getMegaImageUrl(form);
        if (url) next[form] = url;
      } catch {
        // ignore
      }
    }

    if (alive) setMegaEvoImgMap(next);
  })();

  return () => {
    alive = false;
  };
}, [JSON.stringify((evoLineWithMega || []).map((p) => p?.formKey || ""))]);
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
const bumpBidSafe = (delta) => {
  try {
    if (typeof bumpBid === "function") return bumpBid(delta);
    // Fallback: wenn du stattdessen bid-State hast, passe ich dir das gleich exakt an
    console.warn("Hotkey: bumpBid() ist nicht vorhanden");
  } catch (e) {
    console.error(e);
  }
};

const allInSafe = () => {
  try {
    if (typeof doAllIn === "function") return doAllIn();
    console.warn("Hotkey: doAllIn() ist nicht vorhanden");
  } catch (e) {
    console.error(e);
  }
};

const submitBidSafe = () => {
  try {
    if (typeof submitBid === "function") return submitBid();
    console.warn("Hotkey: submitBid() ist nicht vorhanden");
  } catch (e) {
    console.error(e);
  }
};

  useEffect(() => {
    let alive = true;

    (async () => {
      const curDex = displayPokemon?.dexId;
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
  }, [displayPokemon?.dexId]);

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

useEffect(() => {
  // Intro soll laufen wenn Draft läuft, aber noch niemand geboten hat
  if (phase !== "auction") return;
  if (!draft?.current) return;

  // sobald timer läuft (also Gebot kam), intro nicht (mehr) spielen
  if (timer?.running) return;

  // nur ganz am Anfang (0 verkauft)
  if ((draft?.auctionCountDone ?? 0) !== 0) return;

  // Key, damit es nur 1x pro Draft feuert
  const key = `${roomId}|gen${genNum}|start|cur${draft.current.dexId}|tp${draft.totalPokemon}|pool${(draft.pool || []).length}`;

  if (introKeyRef.current === key) return;
  introKeyRef.current = key;

  playIntroOnce(genNum);
}, [
  phase,
  timer?.running,
  draft?.auctionCountDone,
  draft?.current?.dexId,
  draft?.totalPokemon,
  (draft?.pool || []).length,
  genNum,
  roomId,
  soundMuted,
]);
useEffect(() => {
  // ✅ sobald das erste Gebot kommt -> timer läuft -> Intro sofort aus
  if (phase !== "auction") return;
  if (!timer?.running || timer?.paused) return;

  stopIntro();
}, [phase, timer?.running, timer?.paused]);

useEffect(() => {
  if (phase !== "results") return;

  const key = `${roomId}|gen${genNum}|end|done${draft?.auctionCountDone ?? 0}|tp${draft?.totalPokemon ?? 0}`;

  if (endKeyRef.current === key) return;
  endKeyRef.current = key;

  playEndOnce(genNum);
}, [
  phase,
  draft?.auctionCountDone,
  draft?.totalPokemon,
  genNum,
  roomId,
  soundMuted,
]);

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

    const initSettings = loadHostSettingsFromLS();

const humans = clampInt(initSettings.participants ?? 0, 0, 20);
let bots = clampInt(initSettings.botCount ?? 0, 0, 9);
if (humans === 0 && bots === 0) bots = 1; // bot-only safety

const totalTeams = Math.min(20, humans + bots);

// owners initialisieren + bots reservieren
const initOwners = ensureTeamOwners(totalTeams, {});
for (let i = 0; i < bots; i++) {
  const tid = teamIdFor(humans + i); // bots hinten dran
  initOwners[tid] = `bot:${i + 1}`;
}

const initial = {
  phase: "lobby",
  settings: initSettings,
  teamOwners: initOwners,
  teamNames: buildTeamNamesForOwners(totalTeams, initOwners, {}, {}, roomId, { seed: "initial" }),
  draft: {
    auctionCountDone: 0,
    current: null,
    currentOptions: [],
    blindBids: {},
    blindReveal: null,

    teamIds: [],
    budgets: {},
    teams: {},

    pool: [],
    poolIndex: 0,
    totalPokemon: initSettings.totalPokemon ?? 12,

    highestBid: 0,
    highestTeamId: null,
    hasStarted: false,

    bannedDexIds: [],
  },
  timer: { running: false, paused: false, remaining: initSettings.secondsPerBid ?? 10 },
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
      // ✅ merken wie bei Namen (nur lokal, pro Gerät)
  saveHostSettingsToLS(nextSettings);
  // ✅ wenn botCount verändert wurde: botsConfig passend machen
const cnt = clampInt(nextSettings.botCount ?? 0, 0, 9);
let cfg = Array.isArray(nextSettings.botsConfig) ? [...nextSettings.botsConfig] : [];

if (cfg.length > cnt) {
  cfg = cfg.slice(0, cnt);
} else if (cfg.length < cnt) {
  const missing = cnt - cfg.length;
  const extra = generateBotConfigs(missing, Date.now());
  // ids/names bleiben stabil durch botEngine-fix (#1..)
  cfg = [...cfg, ...extra];
}
nextSettings.botsConfig = cfg;

      // ✅ Spieler + Bots → totalTeams (max 10)
 const playersCount = clampInt(nextSettings.participants ?? 0, 0, 10); // ✅ 0 erlaubt
let botCount = clampInt(nextSettings.botCount ?? 0, 0, 9);

// ✅ Wenn Bot-only (0 Spieler), erzwinge mind. 1 Bot
if (playersCount === 0 && botCount === 0) botCount = 1;

const totalTeams = Math.min(10, playersCount + botCount);

// falls zu viele Spieler eingestellt wurden, runter clampen
const finalPlayers = Math.min(playersCount, totalTeams);
const finalBots = Math.max(0, totalTeams - finalPlayers);

const normalizedSettings = {
  ...nextSettings,
  participants: finalPlayers,
  botCount: finalBots,
};


  saveHostSettingsToLS(normalizedSettings);

  // ✅ TeamOwners auf totalTeams erweitern
  const owners = ensureTeamOwners(totalTeams, teamOwners);

  // ✅ Bot-Teams reservieren: team (index >= finalPlayers) bekommt owner "bot:X"
  for (let i = 0; i < finalBots; i++) {
    const teamIndex = finalPlayers + i; // 0-based
    const tid = teamIdFor(teamIndex);   // team2, team3, ...
    if (!owners[tid]) owners[tid] = `bot:${i + 1}`;
  }

  // ✅ Wenn Teilnehmer hochgestellt werden: Bot-Owner aus Human-Slots entfernen
  for (let i = 0; i < finalPlayers; i++) {
    const tid = teamIdFor(i);
    if (owners[tid] && String(owners[tid]).startsWith("bot:")) delete owners[tid];
  }

  // ✅ Sicherheit: falls BotCount kleiner gemacht wurde -> alte bot:... owners entfernen
  for (let i = totalTeams; i < 20; i++) {
    const tid = teamIdFor(i);
    if (owners[tid] && String(owners[tid]).startsWith("bot:")) delete owners[tid];
  }

  const nextTeamNames = buildTeamNamesForOwners(totalTeams, owners, teamNames, teamOwners, roomId, {
    seed: `settings|${finalPlayers}|${finalBots}`,
  });

  await updateDoc(roomRef, {
    "versus.auction.settings": normalizedSettings,
    "versus.auction.teamOwners": owners,
    "versus.auction.teamNames": nextTeamNames,
    "versus.auction.updatedAt": serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  }

  // ===== Team join/leave (sync, transaction) =====
  async function claimTeam(tid) {
  // ✅ Join ist in Lobby UND Draft erlaubt
  if (phase !== "lobby" && phase !== "auction") return;
  if (!myPlayerId) return;
// ✅ Bot-only: keine Human-Teams joinbar
  if (clampInt(settings.participants ?? 0, 0, 20) === 0) return;

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(roomRef);
    if (!snap.exists()) throw new Error("Room nicht gefunden.");

    const data = snap.data();
    const a = data?.versus?.auction;
    if (!a) throw new Error("Auction nicht initialisiert.");
    if (data.status !== "auction") throw new Error("Room nicht in Auction.");

    const s = a.settings || settings;

    // ✅ WICHTIG: totalTeams = humans + bots (sonst “schneiden” wir Bot-Teams weg!)
    const humans = clampInt(s.participants ?? 0, 0, 20);
    const bots = clampInt(s.botCount ?? 0, 0, 9);
    const totalTeams = Math.min(20, humans + bots);

    const owners = ensureTeamOwners(totalTeams, a.teamOwners || {});

    // already in a team?
    if (Object.values(owners).some((pid) => pid === myPlayerId)) return;

    // ✅ Bots dürfen nicht gejoint werden (falls mal frei/kaputt)
    const curOwner = owners[tid];
    if (curOwner && String(curOwner).startsWith("bot:")) return;

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

    const s = a.settings || settings;

    const humans = clampInt(s.participants ?? 0, 0, 20);
    const bots = clampInt(s.botCount ?? 0, 0, 9);
    const totalTeams = Math.min(20, humans + bots);

    const owners = ensureTeamOwners(totalTeams, a.teamOwners || {});

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

    const s = a.settings || settings;

    const humans = clampInt(s.participants ?? 0, 0, 20);
    const bots = clampInt(s.botCount ?? 0, 0, 9);
    const totalTeams = Math.min(20, humans + bots);

    const owners = ensureTeamOwners(totalTeams, a.teamOwners || {});

    const owner = owners[tid];
    if (!owner) return;

    // ✅ Bots nicht rauskicken (passt auch zu deiner “Bots dürfen nicht rausfliegen”-Regel)
    if (String(owner).startsWith("bot:")) return;

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

    const gen = clampInt(settings.generation, 1, 9);
   const participants = clampInt(settings.participants ?? 0, 0, 20);
let botCount = clampInt(settings.botCount ?? 0, 0, 9);

// ✅ Bot-only: mindestens 1 Bot erzwingen
if (participants === 0 && botCount === 0) botCount = 1;


const totalTeams = Math.min(20, participants + botCount);
const finalParticipants = Math.min(participants, totalTeams);
const finalBotCount = Math.max(0, totalTeams - finalParticipants);

// ✅ bot configs (aus Lobby), stabil nach Index 1..N
const existing = Array.isArray(settings.botsConfig) ? [...settings.botsConfig] : [];
const generatedFull = generateBotConfigs(finalBotCount, Date.now());

// Wir bauen die Liste IMMER als Länge finalBotCount neu auf,
// damit IDs nie doppelt werden (bot:1 .. bot:N).
let botConfigs = Array.from({ length: finalBotCount }, (_, i) => {
  const id = `bot:${i + 1}`;

  // Falls es schon einen Config mit dieser ID gibt -> übernehmen
  const byId = existing.find((c) => String(c?.id) === id) || null;

  // Fallback: gleiche Position
  const byIdx = existing[i] || null;

  // Basis ist immer generatedFull[i] (korrekte id/name)
  const base = generatedFull[i];

  // Prefer byId, dann byIdx (für "alte" saves)
  const picked = byId || byIdx;

  return picked
    ? {
        ...base,
        ...picked,
        id: base.id,     // erzwingen
        name: base.name, // erzwingen (damit #index passt)
      }
    : base;
});

// ✅ Defaults: standardmäßig VeryHard + 2x Zufall (wie du wolltest)
//    WICHTIG: Diese Version bleibt für UI/Lobby-Anzeige erhalten.
const botConfigsLobby = botConfigs.map((c) => ({
  ...c,
  difficulty: String(c?.difficulty || "veryhard"),
  behavior1:
    String(c?.behavior1 || "zufall") === "none"
      ? "zufall"
      : String(c?.behavior1 || "zufall"),
  behavior2:
    String(c?.behavior2 || "zufall") === "none"
      ? "zufall"
      : String(c?.behavior2 || "zufall"),
}));

function pickRandomBehavior(exclude = []) {
  const pool = (BOT_BEHAVIORS || [])
    .map((v) => String(v))
    .filter((v) => v && v !== "none" && v !== "zufall" && !exclude.includes(v));
  if (!pool.length) return "none";
  return pool[Math.floor(Math.random() * pool.length)];
}

// ✅ Draft-intern: "zufall" auflösen – aber NICHT in settings speichern!
const botConfigsResolved = botConfigsLobby.map((b) => {
  let b1 = String(b.behavior1 || "none");
  let b2 = String(b.behavior2 || "none");

  if (b1 === "zufall") b1 = pickRandomBehavior();
  if (b2 === "zufall") b2 = pickRandomBehavior([b1]);

  return { ...b, behavior1: b1, behavior2: b2 };
});



// ✅ TeamIds für alle Teams
const localTeamIds = Array.from({ length: totalTeams }, (_, i) => teamIdFor(i));

// ✅ owners für ALLE Teams (humans + bots)
const owners = ensureTeamOwners(totalTeams, teamOwners);

// ✅ Bots erstellen (IDs MUSS "bot:X" sein, passend zu owners)
//    startTeamIndex ist 0-based team index, also: humans starten bei 0..finalParticipants-1
let bots = buildBots({
  botConfigs: botConfigsResolved,
  startTeamIndex: finalParticipants,
});

// ✅ Bot-Teams als belegt setzen: ownerId exakt = bot.id ("bot:1", "bot:2", ...)
for (const b of bots) {
  owners[b.teamId] = b.id;
}

const draftNameSeed = `${Date.now()}|${Math.random()}`;
const teamNamesForDraft = buildTeamNamesForOwners(totalTeams, owners, teamNames, teamOwners, roomId, {
  forceBotNames: true,
  seed: draftNameSeed,
});

// Bot-Displayname im Draft = zufälliger zusammengesetzter Teamname.
bots = bots.map((b) => ({
  ...b,
  name: teamNamesForDraft?.[b.teamId] || b.name || makeRandomBotDraftName(`${roomId}|${b.id}|${draftNameSeed}`),
}));


// ✅ Settings-Werte sicher auslesen (verhindert "is not defined" + sorgt für Defaults)
const budgetPerTeam = Number(settings?.budgetPerTeam ?? 1000);
const totalPokemon = Number(settings?.totalPokemon ?? 10);
const secondsPerBid = Number(settings?.secondsPerBid ?? 30);
// ✅ Teams + Budgets initialisieren
const budgets = {};
const teams = {};
for (const tid of localTeamIds) {
  budgets[tid] = budgetPerTeam;
  teams[tid] = [];
}

// ✅ Pool bauen (Gen + optional Megas)
let rawPool = makeShuffledPool(gen);

// Megas nur wenn Gen 6+ (werden bei baseFormsOnly später sowieso rausgefiltert)
if (gen >= 6) {
  const megaItems = MEGA_FORMS.map((m) => `mega:${m.form}`);
  rawPool = shuffleArray([...rawPool, ...megaItems]);
}

// ✅ Pool-Filter anwenden (Legendär/Sublegi/Mythisch/Pseudo + baseFormsOnly)
const pool = await buildFilteredPool(rawPool, settings, gen);

// ✅ Start-Current bestimmen
const auctionModeStart = getAuctionMode(settings);
const blindMultiCount = clampInt(settings?.blindMultiCount ?? 3, 2, 6);
const startsBlind = isBlindAuctionMode({ auctionMode: auctionModeStart });
const bannedSet = new Set(); // beim Start noch nichts gebannt

let current = null;
let currentOptions = [];
let poolIndex = 0;

if (auctionModeStart === AUCTION_MODES.BLIND_MULTI) {
  const multi = await findNextAllowedManyFromPool(pool, 0, bannedSet, blindMultiCount);
  currentOptions = multi.options || [];
  current = currentOptions[0] || null;
  poolIndex = multi.nextIndex ?? 0;
} else {
  const { nextDex, nextIndex } = findNextAllowedFromPool(pool, 0, bannedSet);
  current = nextDex ? await poolItemToCurrent(nextDex) : null;
  currentOptions = current ? [current] : [];
  poolIndex = nextIndex ?? 0;
}

// ✅ Blind-Modi: Bots geben schon beim Start der Runde ein verdecktes Gebot ab.
// Das fixt besonders Runde 1, weil wir nicht erst auf einen späteren useEffect warten müssen.
const initialBlindBids = {};
if (startsBlind && currentOptions.length) {
  const nowMs = Date.now();
  const picksLeftAtStart = Math.max(1, totalPokemon);
  const isFinalAtStart = auctionModeStart === AUCTION_MODES.BLIND_MULTI
    ? picksLeftAtStart <= currentOptions.length
    : picksLeftAtStart <= 1;

  for (let i = 0; i < bots.length; i++) {
    const bot = bots[i];
    const budget = Number(budgets?.[bot.teamId] ?? 0);
    if (budget < 100) continue;

    const chosenOption = auctionModeStart === AUCTION_MODES.BLIND_MULTI
      ? chooseBotBlindOption(bot, currentOptions)
      : currentOptions[0];

    if (!chosenOption) continue;

    const amount = makeSmartBotBidAmount({
      bot,
      budgetRaw: budget,
      poke: chosenOption,
      highestBidRaw: 0,
      picksLeftRaw: picksLeftAtStart,
      isFinalRound: isFinalAtStart,
      isBlind: true,
      teamCountRaw: localTeamIds.length,
    });

    if (amount < 100) continue;

    initialBlindBids[bot.teamId] = {
      teamId: bot.teamId,
      optionKey: getPokemonAuctionKey(chosenOption),
      amount: Math.min(amount, botMaxBidFromBudget(budget)),
      updatedAtMs: nowMs + i,
    };
  }
}

    await updateDoc(roomRef, {
      "versus.auction.phase": "auction",
      "versus.auction.settings": {
        generation: gen,
        participants: finalParticipants,
        botCount: finalBotCount,
        budgetPerTeam,
        totalPokemon,
        botsConfig: botConfigsLobby,
        secondsPerBid,
        auctionMode: auctionModeStart,
        blindMultiCount,
        blindMultiLoserCompensation: !!settings.blindMultiLoserCompensation,
        keepEvolvedForms: !!settings.keepEvolvedForms,
        baseFormsOnly: !!settings.baseFormsOnly,
        allowLegendary: !!settings.allowLegendary,
        allowSubLegendary: !!settings.allowSubLegendary,
        allowMythical: !!settings.allowMythical,
        allowPseudo: !!settings.allowPseudo,
      },
      "versus.auction.teamOwners": owners,
      "versus.auction.teamNames": teamNamesForDraft,
      "versus.auction.draft": {
        auctionCountDone: 0,
        current,
        currentOptions,
        blindBids: initialBlindBids,
        blindReveal: null,
        teamIds: localTeamIds,
        budgets,
        teams,
        bots,
        pool,
        poolIndex,
        totalPokemon,
        highestBid: 0,
        highestTeamId: null,
        hasStarted: startsBlind && !!current,
        bannedDexIds: [],
      },
      "versus.auction.timer": { running: startsBlind && !!current, paused: false, remaining: secondsPerBid },
      "versus.auction.updatedAt": serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    setBidInput(100);
  }

  async function restartDraftToSetup() {
    if (!meIsHost) return;
    stopAllGlobalAudio();
    stopAllAudio();

    const participants = clampInt(settings.participants ?? 0, 0, 20);
let botCount = clampInt(settings.botCount ?? 0, 0, 9);

// ✅ Bot-only: mindestens 1 Bot erzwingen
if (participants === 0 && botCount === 0) botCount = 1;

const totalTeams = Math.min(20, participants + botCount);
const secondsPerBid = Math.max(5, clampInt(settings.secondsPerBid, 5, 60));


    const resetAuction = {
      phase: "lobby",
      settings: {
  generation: clampInt(settings.generation, 1, 9),
  participants,
  botCount,
  botsConfig: Array.isArray(settings.botsConfig) ? settings.botsConfig : generateBotConfigs(botCount, Date.now()),
  budgetPerTeam: Math.max(0, clampInt(settings.budgetPerTeam, 0, 9999999)),
  totalPokemon: Math.max(1, clampInt(settings.totalPokemon, 1, 999)),
  secondsPerBid,
  auctionMode: getAuctionMode(settings),
  blindMultiCount: clampInt(settings?.blindMultiCount ?? 3, 2, 6),
  blindMultiLoserCompensation: !!settings.blindMultiLoserCompensation,
  keepEvolvedForms: !!settings.keepEvolvedForms,
  baseFormsOnly: !!settings.baseFormsOnly,
  allowLegendary: !!settings.allowLegendary,
  allowSubLegendary: !!settings.allowSubLegendary,
  allowMythical: !!settings.allowMythical,
  allowPseudo: !!settings.allowPseudo,
},
      teamOwners: (() => {
  const owners = ensureTeamOwners(totalTeams, {});
  // Bot-Teams reservieren: die letzten botCount Teams gehören bot:1..bot:N
  for (let i = 0; i < botCount; i++) {
    const teamIndex = participants + i; // 0-based
    const tid = teamIdFor(teamIndex);
    owners[tid] = `bot:${i + 1}`;
  }
  return owners;
})(),
      teamNames: (() => {
  const owners = ensureTeamOwners(totalTeams, {});
  for (let i = 0; i < botCount; i++) {
    const teamIndex = participants + i;
    const tid = teamIdFor(teamIndex);
    owners[tid] = `bot:${i + 1}`;
  }
  return buildTeamNamesForOwners(totalTeams, owners, teamNames, teamOwners, roomId, { seed: `restart|${participants}|${botCount}` });
})(),

      draft: {
        auctionCountDone: 0,
        current: null,
        currentOptions: [],
        blindBids: {},
    blindReveal: null,

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
  // =========================================================
  // ESC Menu: Draft-Context (für GlobalEscapeMenu)
  // - zeigt im ESC-Menü "Draft verlassen"
  // - zeigt "Draft neu starten" nur für Admin/Host
  // =========================================================
  useEffect(() => {
    // diese Seite IST die Draft-Seite
    window.__ESC_DRAFT_CTX__ = {
      inDraft: true,
      // wohin "Draft verlassen" gehen soll:
      // du hast oben bereits goLobby() -> nav(`/versus/`)
      leaveTo: "/versus",
      // Restart nur für Host/Admin
      canRestart: !!meIsHost,
      // Restart-Callback (nutzt deine existierende Funktion)
      restart: () => restartDraftToSetup(),
    };

    window.dispatchEvent(new Event("escDraftCtxChanged"));

    return () => {
      // beim Verlassen der Seite wieder entfernen
      if (window.__ESC_DRAFT_CTX__?.inDraft) {
        window.__ESC_DRAFT_CTX__ = null;
        window.dispatchEvent(new Event("escDraftCtxChanged"));
      }
    };
  }, [meIsHost]);

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

  async function placeBlindBid(amountRaw, optionKeyRaw = null) {
    if (phase !== "auction") return;
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
      const modeHere = getAuctionMode(s);
      if (!isBlindAuctionMode({ auctionMode: modeHere })) return;

      const optionsHere = getRoundOptionsFromDraft(d);
      if (!optionsHere.length) return;

      const validKeys = optionsHere.map((p) => getPokemonAuctionKey(p)).filter(Boolean);
      const optionKey =
        modeHere === AUCTION_MODES.BLIND_MULTI
          ? String(optionKeyRaw || "")
          : getPokemonAuctionKey(optionsHere[0]);

      if (!validKeys.includes(optionKey)) return;

      const budgetsHere = d.budgets || {};
      const budget = budgetsHere[myTeamId] ?? 0;
      if (amt > budget) return;

      const secondsPerBid = clampInt(s.secondsPerBid ?? 10, 5, 60);
      const timerHere = a.timer || {};
      const timerRunning = !!timerHere.running && !timerHere.paused;
      const remaining = timerRunning
        ? Number(timerHere.remaining ?? secondsPerBid)
        : secondsPerBid;

      tx.update(roomRef, {
        [`versus.auction.draft.blindBids.${myTeamId}`]: {
          teamId: myTeamId,
          optionKey,
          amount: amt,
          updatedAtMs: Date.now(),
        },
        "versus.auction.draft.hasStarted": true,
        "versus.auction.timer.paused": false,
        "versus.auction.timer.running": true,
        "versus.auction.timer.remaining": Math.max(1, remaining),
        "versus.auction.updatedAt": serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    });
  }
function clampBidToRules(v) {
  const budget = Number(myBudget() || 0);

  // bids: >=100, multiple of 100, not above budget
  let x = Number(v || 0);

  if (!Number.isFinite(x)) x = 100;

  // auf 100er runden
  x = Math.round(x / 100) * 100;

  if (x < 100) x = 100;
  if (budget > 0) x = Math.min(x, Math.floor(budget / 100) * 100);

  // falls budget < 100 -> 100 bleibt stehen, aber placeBid wird eh blocken
  return x;
}

function bumpBid(delta) {
  setBidInput((prev) => clampBidToRules(Number(prev || 0) + Number(delta || 0)));
}

function doAllIn() {
  const budget = Number(myBudget() || 0);
  const max = Math.floor(budget / 100) * 100;
  setBidInput(clampBidToRules(max));
}

function submitBid() {
  const safeBid = clampBidToRules(bidInput);
  if (isBlindMode) {
    placeBlindBid(safeBid, blindOptionKey);
    return;
  }

  placeBid(safeBid);
}

useEffect(() => {
  // Hotkeys nur im Auction-Phase sinnvoll
  if (phase !== "auction") return;

  function onDraftHotkeys(e) {
    if (isTypingTarget(document.activeElement)) return;

    const hk = loadHotkeys();
    const d = hk?.draft || {};

if (d.togglePause && comboMatches(e, d.togglePause)) {e.preventDefault(); togglePauseTimer(); return;}

    if (d.plus100 && comboMatches(e, d.plus100)) { e.preventDefault(); bumpBid(100); return; }
    if (d.minus100 && comboMatches(e, d.minus100)) { e.preventDefault(); bumpBid(-100); return; }

    if (d.plus10 && comboMatches(e, d.plus10)) { e.preventDefault(); bumpBid(10); return; }
    if (d.minus10 && comboMatches(e, d.minus10)) { e.preventDefault(); bumpBid(-10); return; }

    if (d.plus1 && comboMatches(e, d.plus1)) { e.preventDefault(); bumpBid(1); return; }
    if (d.minus1 && comboMatches(e, d.minus1)) { e.preventDefault(); bumpBid(-1); return; }

    if (d.allIn && comboMatches(e, d.allIn)) { e.preventDefault(); doAllIn(); return; }
    if (d.bidSubmit && comboMatches(e, d.bidSubmit)) { e.preventDefault(); submitBid(); return; }
  }

  window.addEventListener("keydown", onDraftHotkeys);
  return () => window.removeEventListener("keydown", onDraftHotkeys);
}, [phase, bidInput, myTeamId, auction?.draft?.highestBid]);

async function placeBotBid(botTeamId, amountRaw) {
  if (!meIsHost) return;
  if (phase !== "auction") return;
  if (!draft.current) return;
  if (!botTeamId) return;
// ===== Optional: Only-Bots / Humans-in-Teams Erkennung (robust) =====
// room.players kann Array oder Object sein -> nimm lieber playersList (hast du oben sauber gebaut)
const ownersNow = teamOwners || {}; // <-- das ist das "auction teamOwners" aus dem Component Scope

// echte (nicht-bot) Owner, die aktuell ein Team belegen
const humansInTeams = Object.values(ownersNow).filter(
  (oid) => oid && !String(oid).startsWith("bot:")
);

// Bot-only wenn niemand als echter Spieler ein Team belegt
const onlyBotsMode = humansInTeams.length === 0;


  const amt = clampInt(amountRaw, 0, 999999999);
  if (amt < 100) return;
  if (amt % 100 !== 0) return;

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(roomRef);
    if (!snap.exists()) return;

    const data = snap.data();
    const a = data?.versus?.auction;
    if (!a || a.phase !== "auction") return;

    const d = a.draft || {};
    const s = a.settings || settings;

    const budgetsHere = d.budgets || {};
    const budget = budgetsHere[botTeamId] ?? 0;

    const highestBid = d.highestBid ?? 0;
    const highestTeamId = d.highestTeamId ?? null;

    // bot bietet nicht wenn er schon führt
    if (highestTeamId === botTeamId) return;
    if (amt <= highestBid) return;
    if (amt > budget) return;

    tx.update(roomRef, {
      "versus.auction.draft.highestBid": amt,
      "versus.auction.draft.highestTeamId": botTeamId,
      "versus.auction.draft.hasStarted": true,
      "versus.auction.timer.paused": false,
      "versus.auction.timer.running": true,
      "versus.auction.timer.remaining": clampInt(s.secondsPerBid ?? 10, 5, 60),
      "versus.auction.updatedAt": serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  });
}
async function placeBotBlindBid(botTeamId, amountRaw, optionKeyRaw = null) {
  if (!meIsHost) return;
  if (phase !== "auction") return;
  if (!botTeamId) return;

  const amt = clampInt(amountRaw, 0, 999999999);
  if (amt < 100) return;
  if (amt % 100 !== 0) return;

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(roomRef);
    if (!snap.exists()) return;

    const data = snap.data();
    const a = data?.versus?.auction;
    if (!a || a.phase !== "auction") return;

    const d = a.draft || {};
    const s = a.settings || settings;
    const modeHere = getAuctionMode(s);
    if (!isBlindAuctionMode({ auctionMode: modeHere })) return;

    const optionsHere = getRoundOptionsFromDraft(d);
    if (!optionsHere.length) return;

    const validKeys = optionsHere.map((p) => getPokemonAuctionKey(p)).filter(Boolean);
    const optionKey =
      modeHere === AUCTION_MODES.BLIND_MULTI
        ? String(optionKeyRaw || "")
        : getPokemonAuctionKey(optionsHere[0]);

    if (!validKeys.includes(optionKey)) return;

    const budgetsHere = d.budgets || {};
    const budget = budgetsHere[botTeamId] ?? 0;
    if (amt > budget) return;

    const secondsPerBid = clampInt(s.secondsPerBid ?? 10, 5, 60);
    const timerHere = a.timer || {};
    const remaining = timerHere.running
      ? Number(timerHere.remaining ?? secondsPerBid)
      : secondsPerBid;

    tx.update(roomRef, {
      [`versus.auction.draft.blindBids.${botTeamId}`]: {
        teamId: botTeamId,
        optionKey,
        amount: amt,
        updatedAtMs: Date.now(),
      },
      "versus.auction.draft.hasStarted": true,
      "versus.auction.timer.paused": false,
      "versus.auction.timer.running": true,
      "versus.auction.timer.remaining": Math.max(1, remaining),
      "versus.auction.updatedAt": serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  });
}

function botMaxBidFromBudget(budgetRaw) {
  const budget = Number(budgetRaw || 0);
  return Math.floor(budget / 100) * 100;
}

function makeSmartBotBidAmount({ bot, budgetRaw, poke, highestBidRaw = 0, highestTeamId = null, picksLeftRaw = 1, isFinalRound = false, isBlind = false, teamCountRaw = null }) {
  const budget = Number(budgetRaw || 0);
  const maxBid = botMaxBidFromBudget(budget);
  if (maxBid < 100) return 0;

  if (!isBlind && highestTeamId && highestTeamId === bot?.teamId) return 0;

  // Letzte Runde: Bots sollen nicht mit viel Geld rausgehen.
  if (isFinalRound) return maxBid;

  const flags = getSpecialFlags(Number(poke?.dexId || 0), { isMega: !!poke?.formKey });
  const diff = String(bot?.difficulty || "normal").toLowerCase();
  const picksLeft = Math.max(1, Number(picksLeftRaw || 1));
  // Beim Draft-Start ist draft.teamIds im React-State noch leer.
  // Darum kann startDraft die echte Teamanzahl direkt uebergeben.
  const teamCount = Math.max(
    1,
    Number(teamCountRaw || 0) || (Array.isArray(draft?.teamIds) ? draft.teamIds.length : 1)
  );

  // Grobe Planung: Wie viele Picks wird dieses Team wahrscheinlich noch bekommen?
  const expectedOwnPicksLeft = Math.max(1, Math.ceil(picksLeft / teamCount));
  const budgetPerExpectedPick = budget / expectedOwnPicksLeft;

  let strength = 0.62;
  if (diff === "easy") strength = 0.42;
  if (diff === "normal") strength = 0.66;
  if (diff === "hard") strength = 0.88;
  if (diff === "veryhard") strength = 1.08;
  if (diff === "chaos") strength = 0.45 + Math.random() * 1.15;

  if (flags.starter) strength += 0.08;
  if (flags.pseudo) strength += 0.18;
  if (flags.subLegendary) strength += 0.22;
  if (flags.legendary || flags.mythical || flags.ultraBeast) strength += 0.32;
  if (flags.mega) strength += 0.24;

  const behavior1 = normalizeBehavior(bot?.behavior1);
  const behavior2 = normalizeBehavior(bot?.behavior2);
  if (behavior1 === "allin" || behavior2 === "allin") strength += 0.18;
  if (behavior1 === "sparfuchs" || behavior2 === "sparfuchs") strength -= 0.16;
  if (behavior1 === "sniper" || behavior2 === "sniper") strength += 0.08;

  const randomFactor = 0.82 + Math.random() * 0.56;
  let raw = budgetPerExpectedPick * strength * randomFactor;

  // Mindestdruck: Bots sollen bei großem Budget nicht nur 100/200 bieten.
  let minPct = 0.10;
  if (diff === "easy") minPct = 0.07;
  if (diff === "normal") minPct = 0.10;
  if (diff === "hard") minPct = 0.14;
  if (diff === "veryhard") minPct = 0.18;
  if (flags.legendary || flags.mythical || flags.ultraBeast || flags.mega) minPct += 0.05;
  if (flags.pseudo || flags.subLegendary) minPct += 0.03;

  // Wichtig: Der Mindestdruck darf nicht fuer alle Bots exakt gleich sein.
  // Sonst bieten in Runde 1 alle Bots denselben Betrag, weil alle mit gleichem Budget starten.
  const minPressureRandom = 0.72 + Math.random() * 0.62;
  const minPressure = budget * minPct * minPressureRandom;

  raw = Math.max(raw, minPressure);

  let bid = round100(raw);
  const highestBid = Number(highestBidRaw || 0);
  if (!isBlind && highestBid > 0) bid = Math.max(bid, highestBid + 100);

  return Math.min(maxBid, bid);
}

function makeSimpleBlindBotBidAmount(bot, budgetRaw, poke) {
  const picksLeft = Math.max(
    1,
    Number(draft?.totalPokemon ?? 0) - Number(draft?.auctionCountDone ?? 0)
  );
  const isFinalRound = isBlindMultiMode
    ? picksLeft <= Math.max(1, getRoundOptionsFromDraft(draft).length)
    : picksLeft <= 1;

  return makeSmartBotBidAmount({
    bot,
    budgetRaw,
    poke,
    highestBidRaw: 0,
    picksLeftRaw: picksLeft,
    isFinalRound,
    isBlind: true,
  });
}

function scorePokemonForBotChoice(bot, poke) {
  const flags = getSpecialFlags(Number(poke?.dexId || 0), { isMega: !!poke?.formKey });
  const diff = String(bot?.difficulty || "normal").toLowerCase();

  let score = 1;
  if (flags.starter) score += 0.25;
  if (flags.pseudo) score += 0.55;
  if (flags.subLegendary) score += 0.7;
  if (flags.legendary || flags.mythical || flags.ultraBeast) score += 1.05;
  if (flags.mega) score += 0.85;

  if (diff === "easy") score *= 0.85;
  if (diff === "hard") score *= 1.15;
  if (diff === "veryhard") score *= 1.3;
  if (diff === "chaos") score *= 0.75 + Math.random() * 1.1;

  // Kleine Streuung, damit nicht alle Bots immer exakt dieselbe Option nehmen.
  return score * (0.75 + Math.random() * 0.65);
}

function chooseBotBlindOption(bot, optionsRaw) {
  const options = Array.isArray(optionsRaw) ? optionsRaw.filter(Boolean) : [];
  if (!options.length) return null;
  if (options.length === 1) return options[0];

  const diff = String(bot?.difficulty || "normal").toLowerCase();
  const scored = options
    .map((p) => ({ poke: p, score: scorePokemonForBotChoice(bot, p) }))
    .sort((a, b) => b.score - a.score);

  // Schlechte Bots/Chaos picken öfter zufällig, gute Bots picken öfter das stärkste/seltenste.
  const randomChance =
    diff === "easy" ? 0.45 :
    diff === "normal" ? 0.25 :
    diff === "chaos" ? 0.55 :
    0.12;

  if (Math.random() < randomChance) {
    return options[Math.floor(Math.random() * options.length)];
  }

  // Sehr harte Bots nehmen fast immer die beste Option, sonst eine der Top-Optionen.
  if (diff === "veryhard") return scored[0].poke;

  const topCount = Math.min(scored.length, diff === "hard" ? 2 : 3);
  return scored[Math.floor(Math.random() * topCount)].poke;
}

useEffect(() => {
  if (!meIsHost) return;
  if (phase !== "auction") return;
  if (!isBlindMode) return;
  if (timer?.paused) return;

  const bots = Array.isArray(draft?.bots) ? draft.bots : [];
  const options = getRoundOptionsFromDraft(draft);
  if (!bots.length || !options.length) return;

  const blindBids = draft?.blindBids || {};

  // Wichtig:
  // Nicht nur "einmal pro Runde" triggern, sondern solange nachlegen,
  // bis jeder Bot mit Budget ein Blind-Gebot abgegeben hat.
  // Dadurch bieten Bots auch in Runde 1 zuverlässig.
  const missingBots = bots.filter((bot) => {
    const budget = Number(draft?.budgets?.[bot.teamId] ?? 0);
    if (budget < 100) return false;
    return !blindBids?.[bot.teamId];
  });

  if (!missingBots.length) return;

  let cancelled = false;
  const timeouts = [];

  missingBots.forEach((bot, index) => {
    const budget = Number(draft?.budgets?.[bot.teamId] ?? 0);
    const chosenOption = isBlindMultiMode ? chooseBotBlindOption(bot, options) : options[0];
    if (!chosenOption) return;

    const amount = makeSimpleBlindBotBidAmount(bot, budget, chosenOption);
    if (amount < 100) return;

    // Runde 1 und Folgerunden: Bots bieten immer früh genug.
    // Gestaffelt, damit Firestore nicht alle Writes exakt gleichzeitig bekommt.
    const delay = 150 + index * 130 + Math.floor(Math.random() * 350);

    const submitBotBlind = () => {
      if (cancelled) return;

      const live = draftLiveRef.current || {};
      const liveBids = live?.blindBids || {};
      const liveBudget = Number(live?.budgets?.[bot.teamId] ?? budget);
      if (liveBudget < 100) return;
      if (liveBids?.[bot.teamId]) return;

      placeBotBlindBid(bot.teamId, Math.min(amount, botMaxBidFromBudget(liveBudget)), getPokemonAuctionKey(chosenOption)).catch(() => {});
    };

    const t = setTimeout(submitBotBlind, delay);
    const retry = setTimeout(submitBotBlind, delay + 900);

    timeouts.push(t, retry);
  });

  return () => {
    cancelled = true;
    for (const t of timeouts) clearTimeout(t);
  };
}, [
  meIsHost,
  phase,
  isBlindMode,
  isBlindMultiMode,
  auctionMode,
  timer?.paused,
  timer?.running,
  draft?.auctionCountDone,
  draft?.poolIndex,
  JSON.stringify(draft?.bots || []),
  JSON.stringify(draft?.budgets || {}),
  JSON.stringify(draft?.blindBids || {}),
  JSON.stringify((currentOptions || []).map((p) => getPokemonAuctionKey(p))),
]);

async function forceBotStartFromSpectator() {
  if (!meIsHost) return;
  if (phase !== "auction") return;

  const hb = Number(draft?.highestBid ?? 0);
  const ht = draft?.highestTeamId ?? null;
  const opening = !draft?.hasStarted && hb === 0 && !ht;

  if (!opening) return;

  const bots = Array.isArray(draft?.bots) ? draft.bots : [];
  if (bots.length === 0) return;

  // irgendein Bot-Team mit Budget >=100
  const bot = bots.find((b) => Number(draft?.budgets?.[b.teamId] ?? 0) >= 100);
  if (!bot?.teamId) return;

  const picksLeft = Math.max(
    1,
    Number(draft?.totalPokemon ?? 0) - Number(draft?.auctionCountDone ?? 0)
  );
  const amount = makeSmartBotBidAmount({
    bot,
    budgetRaw: Number(draft?.budgets?.[bot.teamId] ?? 0),
    poke: draft?.current,
    highestBidRaw: 0,
    highestTeamId: null,
    picksLeftRaw: picksLeft,
    isFinalRound: picksLeft <= 1,
    isBlind: false,
  }) || 100;

  await placeBotBid(bot.teamId, amount);
}

const lastBotReactKeyRef = useRef("");
const stuckGuardRef = useRef("");
const draftLiveRef = useRef(null);
useEffect(() => {
  draftLiveRef.current = draft;
}, [draft]);

useEffect(() => {
  if (!meIsHost) return;
  if (phase !== "auction") return;
  if (!draft?.current) return;

  // nur wenn noch niemand geboten hat und timer nicht läuft
  if (draft.hasStarted) return;
  if (timer?.running) return;

  const budgets = draft?.budgets || {};
  const teamIdsHere = Array.isArray(draft?.teamIds) ? draft.teamIds : [];

  // kann irgendwer noch mind. 100 bieten?
  const anyoneCanBid = teamIdsHere.some((tid) => Number(budgets?.[tid] ?? 0) >= 100);

  // Key pro Pokémon, damit wir nicht dauernd triggern
  const key = `${draft.current.dexId}|done${draft.auctionCountDone}|can${anyoneCanBid ? 1 : 0}`;
  if (stuckGuardRef.current === key) return;
  stuckGuardRef.current = key;

  if (anyoneCanBid) return;

  // ✅ Niemand kann mehr bieten -> nach kurzer Zeit sauber beenden
  const t = setTimeout(() => {
    updateDoc(roomRef, {
      "versus.auction.phase": "results",
      "versus.auction.timer": { running: false, paused: false, remaining: 0 },
      "versus.auction.draft.current": null,
      "versus.auction.draft.hasStarted": false,
      "versus.auction.draft.highestBid": 0,
      "versus.auction.draft.highestTeamId": null,
      "versus.auction.updatedAt": serverTimestamp(),
      updatedAt: serverTimestamp(),
    }).catch(() => {});
  }, 1800);

  return () => clearTimeout(t);
}, [
  meIsHost,
  phase,
  draft?.current?.dexId,
  draft?.auctionCountDone,
  draft?.hasStarted,
  JSON.stringify(draft?.budgets || {}),
  JSON.stringify(draft?.teamIds || []),
  timer?.running,
  roomRef,
]);
// ✅ AUTO-END: Wenn global niemand mehr überhaupt 100 bieten kann -> Draft beenden
useEffect(() => {
  if (!meIsHost) return;
  if (phase !== "auction") return;

  const d = draft || {};
  const teamIdsHere = Array.isArray(d.teamIds) ? d.teamIds : [];
  const budgetsHere = d.budgets || {};

  if (teamIdsHere.length === 0) return;

  const anyoneCanOpen = teamIdsHere.some((tid) => Number(budgetsHere?.[tid] ?? 0) >= 100);

  if (anyoneCanOpen) return;

  // Schon im Results? dann nichts
  // (phase check oben reicht, aber sicher ist sicher)
  const t = setTimeout(() => {
    updateDoc(roomRef, {
      "versus.auction.phase": "results",
      "versus.auction.timer": { running: false, paused: false, remaining: 0 },
      "versus.auction.draft.current": null,
      "versus.auction.draft.hasStarted": false,
      "versus.auction.draft.highestBid": 0,
      "versus.auction.draft.highestTeamId": null,
      "versus.auction.updatedAt": serverTimestamp(),
      updatedAt: serverTimestamp(),
    }).catch(() => {});
  }, 800);

  return () => clearTimeout(t);
}, [
  meIsHost,
  phase,
  JSON.stringify(draft?.teamIds || []),
  JSON.stringify(draft?.budgets || {}),
  roomRef,
]);
useEffect(() => {
  if (!meIsHost) return;
  if (phase !== "auction") return;
  if (isBlindMode) return;
  if (!draft?.current) return;

  const bots = Array.isArray(draft?.bots) ? draft.bots : [];
  if (bots.length === 0) return;

  const hb = Number(draft.highestBid ?? 0);
  const ht = draft.highestTeamId ?? null;

  const picksLeft = Math.max(
    0,
    Number(draft.totalPokemon ?? 0) - Number(draft.auctionCountDone ?? 0)
  );

  // key verhindert Spam bei gleichen states
  const key = `${draft.current.dexId}|hb${hb}|ht${ht}|left${picksLeft}|hs${draft.hasStarted ? 1 : 0}`;
  if (lastBotReactKeyRef.current === key) return;
  lastBotReactKeyRef.current = key;

  // Opening = noch kein Bid, timer läuft nicht (bei dir läuft er erst nach erstem Bid)
  const opening = !draft.hasStarted && hb === 0 && !ht;
  // Wir erkennen das NICHT über room.players (da bist du als Mensch drin),
  // sondern über "participants == 0" ODER "keine Human-Owner in teamOwners".
  const onlyBotsMode =
    clampInt(settings.participants ?? 0, 0, 20) === 0 ||
    !Object.values(teamOwners || {}).some((oid) => oid && !String(oid).startsWith("bot:"));


  const baseDelay = opening ? 900 : 250;
  const randDelay = opening ? 1200 : 850;

  const currentDex = Number(draft.current.dexId);
  const flags = getSpecialFlags(currentDex, { isMega: !!draft?.current?.formKey });

 // ✅ START-BID: Alle Bots dürfen starten (außer Sniper -> wartet 5s, falls niemand bietet)
// Ziel: Runde 1 darf nie "stuck" sein, auch wenn ein random-wurf mal failt.
const openingStartKey = `opening:${draft?.poolIndex ?? 0}:${draft?.current?.dexId ?? "x"}`;
const hasHumanInAnyTeam = Object.values(teamOwners || {}).some(
  (oid) => oid && !String(oid).startsWith("bot:")
);

if (opening) {
  const botsWithBudget = bots
    .map((b) => ({
      bot: b,
      teamId: b.teamId,
      budget: Number(draft.budgets?.[b.teamId] ?? 0),
      b1: String(b.behavior1 || ""),
      b2: String(b.behavior2 || ""),
    }))
    .filter((x) => x.budget >= 100);

  if (botsWithBudget.length === 0) return;

  // Guard: nicht jedes Render neu schedulen
  if (lastBotReactKeyRef.current === openingStartKey) return;
  lastBotReactKeyRef.current = openingStartKey;

  let cancelled = false;
  const timeouts = [];

  const scheduleStartBid = (botInfo, delayMs) => {
    const t = setTimeout(() => {
      if (cancelled) return;

      const live = draftLiveRef.current;
      const liveHb = Number(live?.highestBid ?? 0);
      const liveHt = live?.highestTeamId ?? null;
      const liveOpening = !live?.hasStarted && liveHb === 0 && !liveHt;

      if (!liveOpening) return;

      const livePicksLeft = Math.max(
        1,
        Number(live?.totalPokemon ?? 0) - Number(live?.auctionCountDone ?? 0)
      );
      const liveBudget = Number(live?.budgets?.[botInfo.teamId] ?? botInfo.budget ?? 0);
      const amount = makeSmartBotBidAmount({
        bot: botInfo.bot,
        budgetRaw: liveBudget,
        poke: live?.current,
        highestBidRaw: 0,
        highestTeamId: null,
        picksLeftRaw: livePicksLeft,
        isFinalRound: livePicksLeft <= 1,
        isBlind: false,
      }) || 100;

      placeBotBid(botInfo.teamId, amount).catch(() => {});
    }, Math.max(0, delayMs));
    timeouts.push(t);
  };

  // alle Nicht-Sniper: schnell starten (auch wenn Humans gejoint sind)
  // Sniper: startet erst NACH 5s, falls bis dahin niemand geboten hat
  for (const x of botsWithBudget) {
    const isSniper =
      normalizeBehavior(x.b1) === "sniper" || normalizeBehavior(x.b2) === "sniper";

    if (isSniper) {
      // Sniper wartet etwas, aber nicht so lange, dass Runde 1 leer bleibt.
      scheduleStartBid(x, 1200 + Math.floor(Math.random() * 900));
    } else {
      // alle anderen starten sicher und früh.
      scheduleStartBid(x, 450 + Math.floor(Math.random() * 700));
    }
  }

  return () => {
    cancelled = true;
    for (const t of timeouts) clearTimeout(t);
  };
}
// ✅ "Power" der Evolutionsreihe: max BST(total) aus evoStatsMap (falls geladen)
const evoMaxTotal = (() => {
  let maxT = 0;
  for (const it of (evoLine || [])) {
    const id = Number(it?.dexId ?? it);
    const st = evoStatsMap?.[id];
    if (st?.total && st.total > maxT) maxT = st.total;
  }
  if (curStats?.total && curStats.total > maxT) maxT = curStats.total;
  return maxT || Number(curStats?.total ?? 0) || 0;
})();

// Kandidaten sammeln (normales Bot-Verhalten)
const candidates = [];
for (const b of bots) {
  const myBudget = Number(draft.budgets?.[b.teamId] ?? 0);

// =======================
// 🌍 MARKET AVERAGE PRICE (improved)
// avgPrice = SummeBudgetsAll / verbleibende Picks gesamt
// =======================

// Team-IDs sauber als Basis (stabiler als Object.keys(teams))
const teamIdsAll = Array.isArray(draft.teamIds) ? draft.teamIds : Object.keys(draft.teams || {});
const teamsObj = draft.teams || {};
const budgetsObj = draft.budgets || {};
const monsPerTeam = Number(draft.settings?.monsPerTeam || 6);

// Gesamtbudget aller Teams
const totalBudgetRemaining = teamIdsAll.reduce((sum, tid) => {
  return sum + Number(budgetsObj?.[tid] ?? 0);
}, 0);

// Verbleibende Picks (wie viele Pokémon fehlen über alle Teams)
const remainingMons = Math.max(
  1,
  teamIdsAll.reduce((sum, tid) => {
    const teamSize = (teamsObj?.[tid] || []).length;
    const missing = Math.max(0, monsPerTeam - teamSize);
    return sum + missing;
  }, 0)
);

// 🌍 echter Marktpreis
const avgPrice = totalBudgetRemaining / remainingMons;


  const suggestedBid = decideBotBid({
    bot: b,
    myBudget,
    highestBid: hb,
    highestTeamId: ht,
    minBidIncrement: 100,
    specialFlags: flags,
    picksLeft,
    avgPrice,
    evoMaxTotal,
    highestTeamBudget: Number(draft.budgets?.[ht] ?? 0),
    remainingSec,
    myTeamSize: (draft.teams?.[b.teamId] ?? []).length,
  });

  const aggressiveBid = makeSmartBotBidAmount({
    bot: b,
    budgetRaw: myBudget,
    poke: draft.current,
    highestBidRaw: hb,
    highestTeamId: ht,
    picksLeftRaw: picksLeft,
    isFinalRound: picksLeft <= 1,
    isBlind: false,
  });

  const bid = Math.max(Number(suggestedBid || 0), Number(aggressiveBid || 0));

  if (bid && bid > hb) {
    candidates.push({ teamId: b.teamId, bid, budget: myBudget });
  }
}

// ✅ START-BID (Opening) – Runde startet bei erstem Gebot
// Fix: wenn der Zufallswurf einmal "nein" sagt, dürfen Bots nicht für immer aufgeben.
// => Retry-Loop: mehrere Versuche, bis jemand geboten hat oder wir abbrechen.
if (opening) {
  const startBidAmount = 100;

  const hasHumanOwnerInTeams = Object.values(teamOwners || {}).some(
    (oid) => oid && !String(oid).startsWith("bot:")
  );

  const forceStart = !hasHumanOwnerInTeams; // wenn niemand gejoint ist -> Bot MUSS starten

  function startBidChance(diff) {
    const d = String(diff || "normal").toLowerCase();
    if (d === "easy" || d === "leicht") return 0.15;
    if (d === "normal" || d === "mittel") return 0.30;
    if (d === "hard" || d === "schwer") return 0.50;
    if (d === "veryhard" || d === "sehrhart") return 0.70;
    if (d === "random" || d === "zufall") return 0.35;
    if (d === "chaotic" || d === "chaotisch") return 0.55;
    return 0.30;
  }

  const startBots = bots
    .map((b) => ({
      teamId: b.teamId,
      budget: Number(draft.budgets?.[b.teamId] ?? 0),
      difficulty: b.difficulty || "normal",
    }))
    .filter((x) => x.budget >= startBidAmount);

  if (startBots.length > 0) {
    // Weighted Auswahl (höhere Difficulty startet eher)
    const weighted = startBots.map((sb) => ({
      ...sb,
      w: Math.max(0.01, startBidChance(sb.difficulty)),
    }));
    const sumW = weighted.reduce((a, x) => a + x.w, 0);
    let r = Math.random() * sumW;
    let chosen = weighted[0];
    for (const x of weighted) {
      r -= x.w;
      if (r <= 0) {
        chosen = x;
        break;
      }
    }

    let cancelled = false;
    let attempts = 0;

    // ForceStart: 1–2 schnelle Versuche
    // Mit Humans: mehrere Versuche, damit Runde 1 nicht "stuck" bleibt, wenn ein Wurf failt
    const maxAttempts = forceStart ? 2 : 8;

    const baseDelayStart = forceStart ? 900 : 2200;
    const randDelayStart = forceStart ? 1200 : 2800;

    const tryStart = () => {
      if (cancelled) return;

      // ✅ check "live"
      const live = draftLiveRef.current;
      const liveHb = Number(live?.highestBid ?? 0);
      const liveHt = live?.highestTeamId ?? null;
      const liveOpening = !live?.hasStarted && liveHb === 0 && !liveHt;

      if (!liveOpening) return;

      attempts += 1;

      const ok = forceStart || Math.random() < startBidChance(chosen.difficulty);
      if (ok) {
        placeBotBid(chosen.teamId, startBidAmount).catch(() => {});
        return;
      }

      if (attempts >= maxAttempts) return;

      const delay = baseDelayStart + Math.floor(Math.random() * randDelayStart);
      setTimeout(tryStart, delay);
    };

    const firstDelay = baseDelayStart + Math.floor(Math.random() * randDelayStart);
    const t = setTimeout(tryStart, firstDelay);

    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }
}

  if (candidates.length === 0) return;

  // best bid nehmen (Bots gefährlicher)
  candidates.sort((a, b) => b.bid - a.bid);
  const chosen = candidates[0];

  const delay = baseDelay + Math.floor(Math.random() * randDelay);
  const t = setTimeout(() => {
    placeBotBid(chosen.teamId, chosen.bid).catch(() => {});
  }, delay);

  return () => clearTimeout(t);
}, [
  meIsHost,
  phase,
  draft?.current?.dexId,
  draft?.highestBid,
  draft?.highestTeamId,
  draft?.hasStarted,
  draft?.auctionCountDone,
  draft?.totalPokemon,
  JSON.stringify(draft?.bots || []),
  JSON.stringify(draft?.budgets || {}),
  avgPrice,
  // ✅ wichtig, weil wir activePlayers nutzen
  JSON.stringify(activePlayers || []),
  JSON.stringify(teamOwners || {}),
  settings?.participants,
]);

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

  async function awardBlindRound(a, fallbackSettings) {
    const d = a?.draft || {};
    const s = a?.settings || fallbackSettings || settings;
    const modeHere = getAuctionMode(s);
    const isMulti = modeHere === AUCTION_MODES.BLIND_MULTI;
    const useLoserCompensation = isMulti && !!s?.blindMultiLoserCompensation;

    const options = getRoundOptionsFromDraft(d);
    if (!options.length) {
      await updateDoc(roomRef, {
        "versus.auction.phase": "results",
        "versus.auction.timer": { running: false, paused: false, remaining: 0 },
        "versus.auction.updatedAt": serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      return;
    }

    const bidsObj = d.blindBids || {};
    const budgetsNow = d.budgets || {};
    const optionKeys = options.map((p) => getPokemonAuctionKey(p)).filter(Boolean);
    const singleOptionKey = optionKeys[0] || "";

    const revealResults = [];
    const winners = [];
    const overbidLosersByTeam = new Map(); // teamId -> eigenes überbotenes Gebot + Ziel-Pokémon

    for (const option of options) {
      const optionKey = getPokemonAuctionKey(option);

      const bidsForOption = Object.values(bidsObj)
        .map((b) => {
          const teamId = String(b?.teamId || "");
          const amount = Number(b?.amount || 0);
          const rawOptionKey = String(b?.optionKey || "");
          const resolvedOptionKey = isMulti ? rawOptionKey : (rawOptionKey || singleOptionKey);
          const budget = Number(budgetsNow?.[teamId] ?? 0);
          return {
            teamId,
            optionKey: resolvedOptionKey,
            amount,
            updatedAtMs: Number(b?.updatedAtMs || 0),
            valid: !!teamId && amount >= 100 && amount <= budget,
          };
        })
        .filter((b) => {
          if (!b.teamId) return false;
          if (b.optionKey !== optionKey) return false;
          return b.amount >= 100;
        })
        .sort(sortBlindBidsDesc);

      const validBids = bidsForOption.filter((b) => b.valid);
      const top = validBids[0] || null;

      if (top) {
        winners.push({
          teamId: top.teamId,
          price: Number(top.amount || 0),
          poke: option,
          optionKey,
        });

        if (useLoserCompensation) {
          for (const bid of validBids) {
            if (bid.teamId && bid.teamId !== top.teamId) {
              overbidLosersByTeam.set(bid.teamId, {
                teamId: bid.teamId,
                price: Number(bid.amount || 0),
                bidOptionKey: optionKey,
                bidPoke: option,
                updatedAtMs: Number(bid.updatedAtMs || 0),
              });
            }
          }
        }
      }

      revealResults.push({
        optionKey,
        poke: option,
        winnerTeamId: top?.teamId || null,
        winningAmount: top ? Number(top.amount || 0) : 0,
        noBid: validBids.length === 0,
        bids: bidsForOption.map((b) => ({
          teamId: b.teamId,
          amount: Number(b.amount || 0),
          valid: !!b.valid,
          won: !!top && b.teamId === top.teamId,
        })),
      });
    }

    const prevBanned = Array.isArray(d.bannedDexIds) ? d.bannedDexIds : [];
    const bannedSet = new Set(prevBanned.map((x) => Number(x)).filter(Boolean));

    async function banEvolutionLineFor(poke) {
      const evoLineHere = await getEvolutionLineByDexId(poke.dexId);
      const evoDexIds = (evoLineHere || []).map((x) => Number(x.dexId)).filter(Boolean);
      if (evoDexIds.length === 0) evoDexIds.push(Number(poke.dexId));
      for (const id of evoDexIds) bannedSet.add(Number(id));
    }

    for (const w of winners) {
      await banEvolutionLineFor(w.poke);
    }

    const pool = d.pool || [];
    const nextSearchStartIdx = Number(d.poolIndex ?? 0) + 1;
    const compensations = [];
    const skippedCompensations = [];

    if (useLoserCompensation && overbidLosersByTeam.size > 0) {
      const alreadyWonTeams = new Set(winners.map((w) => w.teamId));
      const winnerOptionKeys = new Set(winners.map((w) => w.optionKey));
      const usedOptionKeysThisRound = new Set(winners.map((w) => w.optionKey));
      const loserInfos = Array.from(overbidLosersByTeam.values())
        .filter((info) => info?.teamId && !alreadyWonTeams.has(info.teamId))
        // Höchste überbotene Gebote bekommen zuerst Ausgleich.
        // Wenn nicht genug unterschiedliche Pokémon frei sind, gehen die niedrigsten Gebote leer aus.
        .sort((a, b) => {
          const amountDiff = Number(b.price || 0) - Number(a.price || 0);
          if (amountDiff !== 0) return amountDiff;
          return Number(a.updatedAtMs || 0) - Number(b.updatedAtMs || 0);
        });

      function pickRandomOption(list) {
        const arr = Array.isArray(list) ? list.filter(Boolean) : [];
        if (!arr.length) return null;
        return arr[Math.floor(Math.random() * arr.length)] || null;
      }

      for (const loser of loserInfos) {
        const teamId = loser.teamId;
        const price = Number(loser.price || 0);
        const budget = Number(budgetsNow?.[teamId] ?? 0);
        if (price < 100 || budget < price) continue;

        // Ausgleich kommt NUR aus derselben Blind-Multi-Auswahl.
        // Keine Duplikate in derselben Runde: Was ein Gewinner oder ein anderer Ausgleich schon bekommen hat,
        // darf kein zweites Team bekommen.
        const availableOtherOptions = options.filter((p) => {
          const key = getPokemonAuctionKey(p);
          return key && key !== loser.bidOptionKey && !usedOptionKeysThisRound.has(key);
        });

        const compPoke = pickRandomOption(availableOtherOptions);

        if (!compPoke) {
          skippedCompensations.push({
            teamId,
            price,
            sourceOptionKey: loser.bidOptionKey,
            sourcePoke: loser.bidPoke || null,
            reason: "Keine freie Alternative aus dieser Auswahl",
          });
          continue;
        }

        const compKey = getPokemonAuctionKey(compPoke);
        usedOptionKeysThisRound.add(compKey);

        const compensation = {
          teamId,
          price, // eigenes Gebot wird trotzdem bezahlt
          poke: compPoke,
          optionKey: `comp:${teamId}:${compKey}`,
          sourceOptionKey: loser.bidOptionKey,
          sourcePoke: loser.bidPoke || null,
        };

        compensations.push(compensation);
        await banEvolutionLineFor(compPoke);
      }
    }

    const awardedPokemon = [...winners, ...compensations];
    // Blind-Draft zählt nach Bietrunden, nicht nach Anzahl der vergebenen Pokémon.
    const nextAuctionCount = Number(d.auctionCountDone || 0) + 1;
    const totalPokemon = Number(d.totalPokemon ?? s.totalPokemon ?? 12);
    const doneByCount = nextAuctionCount >= totalPokemon;

    const startIdx = nextSearchStartIdx;
    const secondsPerBid = clampInt(s.secondsPerBid ?? 10, 5, 60);
    const blindMultiCount = clampInt(s?.blindMultiCount ?? 3, 2, 6);

    let nextCurrent = null;
    let nextCurrentOptions = [];
    let nextPoolIndex = startIdx;

    if (!doneByCount) {
      if (isMulti) {
        const multi = await findNextAllowedManyFromPool(pool, startIdx, bannedSet, blindMultiCount);
        nextCurrentOptions = multi.options || [];
        nextCurrent = nextCurrentOptions[0] || null;
        nextPoolIndex = multi.nextIndex ?? startIdx;
      } else {
        const { nextDex, nextIndex } = findNextAllowedFromPool(pool, startIdx, bannedSet);
        nextCurrent = nextDex ? await poolItemToCurrent(nextDex) : null;
        nextCurrentOptions = nextCurrent ? [nextCurrent] : [];
        nextPoolIndex = nextIndex ?? startIdx;
      }
    }

    const shouldFinish = doneByCount || !nextCurrent;

    await runTransaction(db, async (tx) => {
      const snap2 = await tx.get(roomRef);
      if (!snap2.exists()) return;

      const data2 = snap2.data();
      const a2 = data2?.versus?.auction;
      if (!a2 || a2.phase !== "auction") return;

      const d2 = a2.draft || {};
      const liveOptions = getRoundOptionsFromDraft(d2).map((p) => getPokemonAuctionKey(p)).join(",");
      const oldOptions = options.map((p) => getPokemonAuctionKey(p)).join(",");
      if (liveOptions !== oldOptions) return;

      const budgets = { ...(d2.budgets || {}) };
      const teams = { ...(d2.teams || {}) };

      for (const w of awardedPokemon) {
        const curBudget = Number(budgets?.[w.teamId] ?? 0);
        const price = Number(w.price || 0);
        if (curBudget < price) continue;

        budgets[w.teamId] = Math.max(0, curBudget - price);

        const teamArr = Array.isArray(teams[w.teamId]) ? [...teams[w.teamId]] : [];
        teamArr.push(makeDraftTeamPokemon(w.poke, price));
        teams[w.teamId] = teamArr;
      }

      tx.update(roomRef, {
        "versus.auction.phase": "blindReveal",
        "versus.auction.draft": {
          ...d2,
          budgets,
          teams,
          bannedDexIds: Array.from(bannedSet),
          auctionCountDone: nextAuctionCount,
          blindBids: d2.blindBids || {},
          blindReveal: {
            mode: modeHere,
            isMulti,
            results: revealResults,
            winners: winners.map((w) => ({
              teamId: w.teamId,
              price: w.price,
              optionKey: w.optionKey,
              poke: w.poke,
            })),
            compensations: compensations.map((w) => ({
              teamId: w.teamId,
              price: w.price,
              optionKey: w.optionKey,
              poke: w.poke,
              sourceOptionKey: w.sourceOptionKey || null,
              sourcePoke: w.sourcePoke || null,
            })),
            skippedCompensations: skippedCompensations.map((w) => ({
              teamId: w.teamId,
              price: w.price,
              sourceOptionKey: w.sourceOptionKey || null,
              sourcePoke: w.sourcePoke || null,
              reason: w.reason || "Keine freie Alternative aus dieser Auswahl",
            })),
            loserCompensationEnabled: useLoserCompensation,
            nextCurrent,
            nextCurrentOptions,
            nextPoolIndex,
            shouldFinish,
            secondsPerBid,
            nextAuctionCount,
            totalPokemon,
          },
          hasStarted: false,
          highestBid: 0,
          highestTeamId: null,
        },
        "versus.auction.timer": { running: false, paused: false, remaining: 0 },
        "versus.auction.updatedAt": serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    });
  }

  async function continueBlindAfterReveal() {
    if (!meIsHost) return;
    if (phase !== "blindReveal") return;

    await runTransaction(db, async (tx) => {
      const snap = await tx.get(roomRef);
      if (!snap.exists()) return;

      const data = snap.data();
      const a = data?.versus?.auction;
      if (!a || a.phase !== "blindReveal") return;

      const d = a.draft || {};
      const reveal = d.blindReveal || {};
      const shouldFinish = !!reveal.shouldFinish || !reveal.nextCurrent;

      if (shouldFinish) {
        tx.update(roomRef, {
          "versus.auction.phase": "results",
          "versus.auction.draft": {
            ...d,
            current: null,
            currentOptions: [],
            blindBids: {},
            blindReveal: null,
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

      const secondsPerBid = clampInt(reveal.secondsPerBid ?? a?.settings?.secondsPerBid ?? 10, 5, 60);
      const nextOptions = Array.isArray(reveal.nextCurrentOptions)
        ? reveal.nextCurrentOptions
        : (reveal.nextCurrent ? [reveal.nextCurrent] : []);

      // ✅ Auch nach dem Reveal direkt wieder Bot-Gebote vorbereiten.
      // Falls der useEffect einmal zu spät kommt, sind Bots trotzdem sofort in der Runde.
      const nextBlindBids = {};
      if (nextOptions.length) {
        const botsHere = Array.isArray(d?.bots) ? d.bots : [];
        const budgetsHere = d?.budgets || {};
        const nextDone = Number(reveal.nextAuctionCount ?? d.auctionCountDone ?? 0);
        const totalPokemonHere = Number(reveal.totalPokemon ?? d.totalPokemon ?? a?.settings?.totalPokemon ?? 1);
        const picksLeft = Math.max(1, totalPokemonHere - nextDone);
        const isFinalRound = getAuctionMode(a?.settings || settings) === AUCTION_MODES.BLIND_MULTI
          ? picksLeft <= nextOptions.length
          : picksLeft <= 1;
        const nowMs = Date.now();

        for (let i = 0; i < botsHere.length; i++) {
          const bot = botsHere[i];
          const budget = Number(budgetsHere?.[bot.teamId] ?? 0);
          if (budget < 100) continue;

          const chosenOption = getAuctionMode(a?.settings || settings) === AUCTION_MODES.BLIND_MULTI
            ? chooseBotBlindOption(bot, nextOptions)
            : nextOptions[0];

          if (!chosenOption) continue;

          const amount = makeSmartBotBidAmount({
            bot,
            budgetRaw: budget,
            poke: chosenOption,
            highestBidRaw: 0,
            picksLeftRaw: picksLeft,
            isFinalRound,
            isBlind: true,
            teamCountRaw: Array.isArray(d?.teamIds) ? d.teamIds.length : null,
          });

          if (amount < 100) continue;

          nextBlindBids[bot.teamId] = {
            teamId: bot.teamId,
            optionKey: getPokemonAuctionKey(chosenOption),
            amount: Math.min(amount, botMaxBidFromBudget(budget)),
            updatedAtMs: nowMs + i,
          };
        }
      }

      tx.update(roomRef, {
        "versus.auction.phase": "auction",
        "versus.auction.draft": {
          ...d,
          poolIndex: Number(reveal.nextPoolIndex ?? d.poolIndex ?? 0),
          current: reveal.nextCurrent || null,
          currentOptions: nextOptions,
          blindBids: nextBlindBids,
          blindReveal: null,
          hasStarted: true,
          highestBid: 0,
          highestTeamId: null,
        },
        "versus.auction.timer": { running: true, paused: false, remaining: secondsPerBid },
        "versus.auction.updatedAt": serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    });
  }

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

        if (isBlindAuctionMode(s)) {
          await awardBlindRound(a, s);
          return;
        }

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
                currentOptions: [],
                blindBids: {},
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
              currentOptions: nextCurrent ? [nextCurrent] : [],
              blindBids: {},
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
  async function saveMyTeamName() {
    if (!myTeamId || !myPlayerId) return;
    const nextName = sanitizeTeamName(teamNameInput);

    await updateDoc(roomRef, {
      [`versus.auction.teamNames.${myTeamId}`]: nextName,
      "versus.auction.updatedAt": serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }

  function renderTeamRenameBox(tid) {
    if (!teamIsMine(tid)) return null;

    return (
      <div
        style={{
          marginTop: 8,
          padding: 8,
          borderRadius: 10,
          border: "1px solid rgba(255,255,255,0.12)",
          background: "rgba(0,0,0,0.18)",
          display: "grid",
          gap: 6,
        }}
      >
        <div style={{ fontSize: 12, opacity: 0.8, fontWeight: 900 }}>Eigenes Team umbenennen</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8 }}>
          <input
            type="text"
            value={teamNameInput}
            maxLength={28}
            placeholder={labelPlayer(myPlayerId, room)}
            onChange={(e) => setTeamNameInput(e.target.value)}
            style={input}
          />
          <button type="button" style={btnGhostSmall} onClick={saveMyTeamName}>
            Speichern
          </button>
        </div>
        <div style={{ fontSize: 11, opacity: 0.65 }}>
          Leer speichern = Spielername wird wieder angezeigt.
        </div>
      </div>
    );
  }

  function findBotByOwnerId(ownerId) {
  const bots = draft?.bots || [];
  return bots.find((b) => b?.id === ownerId) || null;
}

function teamTitle(tid) {
  const customName = sanitizeTeamName(teamNames?.[tid] || "");
  if (customName) return customName;

  const owner = teamOwners?.[tid] ?? null;
  if (!owner) return "Frei";

  const isBot = String(owner).startsWith("bot:");

  if (isBot) {
    const bot = (draft?.bots || []).find((b) => b.teamId === tid || b.id === owner);
    if (bot?.name) return bot.name;

    const botIndex = Number(String(owner).slice(4)) || Number(String(tid).replace("team", "")) || 1;
    return makeRandomBotDraftName(`${roomId}|${tid}|bot|${botIndex}|lobby`);
  }

  return labelPlayer(owner, room);
}


  function teamIsFree(tid) {
    return !teamOwners?.[tid];
  }
  function teamIsMine(tid) {
    return teamOwners?.[tid] === myPlayerId;
  }

  const lobbyPagePanel = {
    ...panel,
    width: "min(1240px, calc(100vw - 36px))",
    margin: "22px auto 0",
    padding: 18,
    background:
      "linear-gradient(180deg, rgba(9,13,21,0.86), rgba(5,8,13,0.78))",
    border: "1px solid rgba(255,255,255,0.09)",
    boxShadow: "0 20px 70px rgba(0,0,0,0.38)",
    backdropFilter: "blur(13px)",
  };

  const lobbyLayout = {
    display: "grid",
    gridTemplateColumns: "310px minmax(0, 1fr)",
    gap: 30,
    alignItems: "start",
  };

  const lobbyTitle = {
    fontSize: 21,
    fontWeight: 950,
    marginBottom: 3,
    letterSpacing: 0.1,
  };

  const lobbyHint = {
    fontSize: 12,
    lineHeight: 1.45,
    color: "rgba(255,255,255,0.58)",
  };

  const lobbySummaryCard = {
    width: "100%",
    boxSizing: "border-box",
    textAlign: "left",
    padding: "14px 15px",
    borderRadius: 16,
    border: "1px solid rgba(255,255,255,0.09)",
    background:
      "linear-gradient(180deg, rgba(255,255,255,0.055), rgba(255,255,255,0.025))",
    color: "white",
    cursor: "pointer",
    display: "grid",
    gap: 7,
    boxShadow: "0 10px 24px rgba(0,0,0,0.18)",
  };

  const lobbyTeamList = {
    display: "grid",
    gap: 8,
    minWidth: 0,
  };

  const lobbyTeamRow = {
    width: "100%",
    boxSizing: "border-box",
    padding: "11px 13px",
    borderRadius: 15,
    border: "1px solid rgba(255,255,255,0.09)",
    background:
      "linear-gradient(180deg, rgba(255,255,255,0.052), rgba(255,255,255,0.026))",
    color: "white",
    cursor: "pointer",
    display: "grid",
    gridTemplateColumns: "72px minmax(0, 1.15fr) minmax(92px, 150px) 70px",
    gap: 10,
    alignItems: "center",
    textAlign: "left",
    minWidth: 0,
    boxShadow: "0 8px 20px rgba(0,0,0,0.16)",
  };

  const modalBackdrop = {
    position: "fixed",
    inset: 0,
    zIndex: 9999,
    background: "rgba(0,0,0,0.72)",
    display: "grid",
    placeItems: "center",
    padding: 18,
  };

  const modalBox = {
    width: "min(720px, 96vw)",
    maxHeight: "86vh",
    overflow: "auto",
    padding: 18,
    borderRadius: 22,
    border: "1px solid rgba(255,255,255,0.13)",
    background:
      "linear-gradient(180deg, rgba(13,18,29,0.98), rgba(7,10,17,0.98))",
    color: "white",
    boxShadow: "0 26px 90px rgba(0,0,0,0.60)",
  };

  const modalSection = {
    display: "grid",
    gap: 10,
    padding: 12,
    borderRadius: 16,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(255,255,255,0.04)",
  };

  function lobbyStatusPill(info) {
    let bg = "rgba(255,255,255,0.08)";
    let color = "rgba(255,255,255,0.78)";
    let text = "frei";

    if (info.ownerOffline) {
      bg = "rgba(239,68,68,0.18)";
      color = "#fecaca";
      text = "offline";
    } else if (info.ownerIsBot) {
      bg = "rgba(59,130,246,0.18)";
      color = "#bfdbfe";
      text = "bot";
    } else if (!info.free) {
      bg = "rgba(34,197,94,0.16)";
      color = "#bbf7d0";
      text = "belegt";
    }

    return (
      <span
        style={{
          justifySelf: "end",
          padding: "5px 9px",
          borderRadius: 999,
          background: bg,
          color,
          fontSize: 11,
          fontWeight: 950,
          border: "1px solid rgba(255,255,255,0.10)",
          textTransform: "uppercase",
        }}
      >
        {text}
      </span>
    );
  }

  function getLobbyTeamInfo(tid, slotIdx) {
    const free = teamIsFree(tid);
    const mine = teamIsMine(tid);
    const owner = teamOwners?.[tid] ?? null;
    const ownerIsBot = owner && String(owner).startsWith("bot:");
    const ownerOffline = !free && !ownerIsBot && isPlayerOffline(owner);

    const playersCount = clampInt(settings.participants ?? 0, 0, 20);
    const botCount = clampInt(settings.botCount ?? 0, 0, 9);
    const isBotSlot = slotIdx >= playersCount && slotIdx < playersCount + botCount;
    const botCfgIdx = isBotSlot ? slotIdx - playersCount : -1;
    const botCfg = botCfgIdx >= 0 ? (settings.botsConfig || [])[botCfgIdx] : null;

    return {
      tid,
      slotIdx,
      free,
      mine,
      owner,
      ownerIsBot,
      ownerOffline,
      isBotSlot,
      botCfgIdx,
      botCfg,
      teamName: free ? `Team ${slotIdx + 1}` : teamTitle(tid),
      playerName: free ? "Kein Spieler" : ownerIsBot ? "Bot-Team" : labelPlayer(owner, room),
    };
  }

  function updateLobbyBotConfig(botCfgIdx, patch) {
    if (!meIsHost) return;
    if (botCfgIdx < 0) return;

    const next = [...(settings.botsConfig || [])];
    next[botCfgIdx] = {
      ...(next[botCfgIdx] || {}),
      ...(patch || {}),
    };

    updateSettings({ botsConfig: next });
  }

  function getAuctionSummary() {
    const mode = getAuctionMode(settings);
    if (mode === AUCTION_MODES.BLIND_MULTI) {
      return `Blind-Multi · ${settings.blindMultiCount ?? 3} Auswahl`;
    }
    if (mode === AUCTION_MODES.BLIND_SINGLE) {
      return "Blind-Einzel";
    }
    return "Live-Auction";
  }

  function getPoolSummary() {
    const blocked = [];
    if (!settings.allowLegendary) blocked.push("Legis");
    if (!settings.allowSubLegendary) blocked.push("Sub-Legis");
    if (!settings.allowMythical) blocked.push("Mythische");
    if (!settings.allowPseudo) blocked.push("Pseudo");

    return blocked.length ? `Blockiert: ${blocked.join(", ")}` : "Alle Kategorien erlaubt";
  }

  function renderSettingsModal() {
    if (phase !== "lobby") return null;
    if (!settingsModal || !meIsHost) return null;

    const title =
      settingsModal === "basic"
        ? "Grundsetup"
        : settingsModal === "auction"
          ? "Auktionsregeln"
          : "Pool-Filter";

    return (
      <div style={modalBackdrop} onClick={() => setSettingsModal(null)}>
        <div style={modalBox} onClick={(e) => e.stopPropagation()}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", marginBottom: 14 }}>
            <div>
              <div style={{ fontSize: 22, fontWeight: 950 }}>{title}</div>
              <div style={lobbyHint}>Änderungen werden direkt für den Raum gespeichert.</div>
            </div>

            <button type="button" style={btnGhostSmall} onClick={() => setSettingsModal(null)}>
              Schließen
            </button>
          </div>

          {settingsModal === "basic" && (
            <div style={modalSection}>
              <Row label="Generation">
                <select
                  value={settings.generation}
                  onChange={(e) => updateSettings({ generation: Number(e.target.value) })}
                  style={selectDark}
                >
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((g) => (
                    <option key={g} value={g} style={selectOption}>
                      Gen {g} (bis #{getDexCapForGen(g)})
                    </option>
                  ))}
                </select>
              </Row>

              <Row label="Teilnehmer">
                <select
                  value={settings.participants ?? 0}
                  onChange={(e) =>
                    updateSettings({
                      participants: Math.max(0, Math.min(9, Number(e.target.value))),
                    })
                  }
                  style={selectDark}
                >
                  {Array.from({ length: 10 }, (_, i) => (
                    <option key={i} value={i} style={selectOption}>
                      {i}
                    </option>
                  ))}
                </select>
              </Row>

              <Row label="Bots">
                <select
                  value={settings.botCount ?? 0}
                  onChange={(e) =>
                    updateSettings({
                      botCount: Math.max(0, Math.min(9, Number(e.target.value))),
                    })
                  }
                  style={selectDark}
                >
                  {Array.from({ length: 10 }, (_, i) => (
                    <option key={i} value={i} style={selectOption}>
                      {i}
                    </option>
                  ))}
                </select>
              </Row>

              <Row label="Budget pro Team">
                <input
                  type="number"
                  min={0}
                  step={100}
                  value={settings.budgetPerTeam}
                  onChange={(e) => updateSettings({ budgetPerTeam: Number(e.target.value) })}
                  style={input}
                />
              </Row>

              <Row label="Pokémon insgesamt">
                <input
                  type="number"
                  min={1}
                  max={200}
                  value={settings.totalPokemon}
                  onChange={(e) => updateSettings({ totalPokemon: Number(e.target.value) })}
                  style={input}
                />
              </Row>

              <Row label="Sekunden / Runde">
                <input
                  type="number"
                  min={5}
                  max={60}
                  value={settings.secondsPerBid}
                  onChange={(e) => updateSettings({ secondsPerBid: Number(e.target.value) })}
                  style={input}
                />
              </Row>
            </div>
          )}

          {settingsModal === "auction" && (
            <div style={modalSection}>
              <Row label="Auktionsart">
                <select
                  value={getAuctionMode(settings)}
                  onChange={(e) => updateSettings({ auctionMode: e.target.value })}
                  style={selectDark}
                >
                  <option value={AUCTION_MODES.CLASSIC} style={selectOption}>
                    Normal: Live-Gebote sichtbar
                  </option>
                  <option value={AUCTION_MODES.BLIND_SINGLE} style={selectOption}>
                    Blind: 1 Pokémon verdeckt
                  </option>
                  <option value={AUCTION_MODES.BLIND_MULTI} style={selectOption}>
                    Blind: mehrere Pokémon gleichzeitig
                  </option>
                </select>
              </Row>

              {getAuctionMode(settings) === AUCTION_MODES.BLIND_MULTI && (
                <>
                  <Row label="Blind-Multi Auswahl">
                    <select
                      value={settings.blindMultiCount ?? 3}
                      onChange={(e) => updateSettings({ blindMultiCount: Number(e.target.value) })}
                      style={selectDark}
                    >
                      {[2, 3, 4, 5, 6].map((n) => (
                        <option key={n} value={n} style={selectOption}>
                          {n} Pokémon gleichzeitig
                        </option>
                      ))}
                    </select>
                  </Row>

                  <label style={{ display: "flex", alignItems: "flex-start", gap: 10, lineHeight: 1.35 }}>
                    <input
                      type="checkbox"
                      checked={!!settings.blindMultiLoserCompensation}
                      onChange={(e) => updateSettings({ blindMultiLoserCompensation: e.target.checked })}
                      style={{ marginTop: 3 }}
                    />
                    <span>Überbotene Bieter bekommen ein anderes Auswahl-Pokémon und zahlen ihr Gebot.</span>
                  </label>
                </>
              )}

              <Row label="Draft-Modus">
                <select
                  value={settings.baseFormsOnly ? "baseOnly" : "allKeep"}
                  onChange={(e) => {
                    const v = e.target.value;

                    if (v === "baseOnly") {
                      updateSettings({
                        baseFormsOnly: true,
                        keepEvolvedForms: false,
                      });
                      return;
                    }

                    updateSettings({
                      baseFormsOnly: false,
                      keepEvolvedForms: true,
                    });
                  }}
                  style={selectDark}
                >
                  <option value="baseOnly" style={selectOption}>Basisform only</option>
                  <option value="allKeep" style={selectOption}>Alle erlauben</option>
                </select>
              </Row>
            </div>
          )}

          {settingsModal === "pool" && (
            <div style={modalSection}>
              <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <input
                  type="checkbox"
                  checked={!settings.allowLegendary}
                  onChange={(e) => updateSettings({ allowLegendary: !e.target.checked })}
                />
                <span>Legendäre deaktivieren</span>
              </label>

              <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <input
                  type="checkbox"
                  checked={!settings.allowSubLegendary}
                  onChange={(e) => updateSettings({ allowSubLegendary: !e.target.checked })}
                />
                <span>Sub-Legendäre deaktivieren</span>
              </label>

              <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <input
                  type="checkbox"
                  checked={!settings.allowMythical}
                  onChange={(e) => updateSettings({ allowMythical: !e.target.checked })}
                />
                <span>Mythische deaktivieren</span>
              </label>

              <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <input
                  type="checkbox"
                  checked={!settings.allowPseudo}
                  onChange={(e) => updateSettings({ allowPseudo: !e.target.checked })}
                />
                <span>Pseudo-Legendäre deaktivieren</span>
              </label>

              <div style={lobbyHint}>
                Häkchen bedeutet: Diese Kategorie wird aus dem Draft-Pool entfernt.
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  function renderTeamModal() {
    if (phase !== "lobby") return null;
    if (!teamModal?.tid) return null;

    const slotIdx = teamIds.findIndex((x) => x === teamModal.tid);
    if (slotIdx < 0) return null;

    const info = getLobbyTeamInfo(teamModal.tid, slotIdx);
    const botCfgSafe = info.botCfg || {
      difficulty: "veryhard",
      behavior1: "zufall",
      behavior2: "zufall",
    };

    const canJoin =
      info.free &&
      !myTeamId &&
      !!myPlayerId &&
      clampInt(settings.participants ?? 0, 0, 20) > 0;

    const ownerName = info.owner ? labelPlayer(info.owner, room) : "—";

    return (
      <div style={modalBackdrop} onClick={() => setTeamModal(null)}>
        <div style={modalBox} onClick={(e) => e.stopPropagation()}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", marginBottom: 14 }}>
            <div>
              <div style={{ fontSize: 12, opacity: 0.55, fontWeight: 950 }}>TEAM {slotIdx + 1}</div>
              <div style={{ fontSize: 24, fontWeight: 950 }}>{info.teamName}</div>
              <div style={{ opacity: 0.72, marginTop: 4 }}>{info.playerName}</div>
            </div>

            <button type="button" style={btnGhostSmall} onClick={() => setTeamModal(null)}>
              Schließen
            </button>
          </div>

          {info.free && (
            <div style={modalSection}>
              <div style={{ fontWeight: 950 }}>Freies Team</div>
              <div style={lobbyHint}>
                Dieses Team ist noch frei.
              </div>

              <button
                type="button"
                style={{ ...btnPrimary, opacity: canJoin ? 1 : 0.5 }}
                disabled={!canJoin}
                onClick={() => {
                  claimTeam(info.tid);
                  setTeamModal(null);
                }}
              >
                Team beitreten
              </button>

              {myTeamId && (
                <div style={lobbyHint}>
                  Du bist bereits in einem Team.
                </div>
              )}
            </div>
          )}

          {!info.free && info.mine && (
            <div style={modalSection}>
              <div style={{ fontWeight: 950 }}>Dein Team</div>
              {renderTeamRenameBox(info.tid)}

              <button
                type="button"
                style={btnGhost}
                onClick={() => {
                  leaveMyTeam();
                  setTeamModal(null);
                }}
              >
                Team verlassen
              </button>
            </div>
          )}

          {!info.free && info.ownerIsBot && (
            <div style={modalSection}>
              <div style={{ fontWeight: 950 }}>Bot-Einstellungen</div>

              {!meIsHost ? (
                <div style={lobbyHint}>Nur der Host kann Bot-Verhalten ändern.</div>
              ) : (
                <>
                  <Row label="Schwierigkeit">
                    <select
                      value={botCfgSafe.difficulty || "normal"}
                      onChange={(e) => {
                        const d = e.target.value;
                        updateLobbyBotConfig(info.botCfgIdx, {
                          difficulty: d,
                          behavior2: d === "veryhard" ? (botCfgSafe.behavior2 || "zufall") : "none",
                        });
                      }}
                      style={selectDark}
                    >
                      <option value="easy" style={selectOption}>Easy</option>
                      <option value="normal" style={selectOption}>Normal</option>
                      <option value="hard" style={selectOption}>Hard</option>
                      <option value="veryhard" style={selectOption}>Sehr hart</option>
                      <option value="chaos" style={selectOption}>Chaos</option>
                    </select>
                  </Row>

                  <Row label="Verhalten 1">
                    <select
                      value={botCfgSafe.behavior1 || "zufall"}
                      onChange={(e) => updateLobbyBotConfig(info.botCfgIdx, { behavior1: e.target.value })}
                      style={selectDark}
                    >
                      {(BOT_BEHAVIORS || []).map((opt) => (
                        <option key={opt} value={opt} style={selectOption}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  </Row>

                  <Row label="Verhalten 2">
                    <select
                      value={botCfgSafe.behavior2 || ((botCfgSafe.difficulty || "normal") === "veryhard" ? "zufall" : "none")}
                      disabled={(botCfgSafe.difficulty || "normal") !== "veryhard"}
                      onChange={(e) => updateLobbyBotConfig(info.botCfgIdx, { behavior2: e.target.value })}
                      style={{
                        ...selectDark,
                        opacity: (botCfgSafe.difficulty || "normal") === "veryhard" ? 1 : 0.55,
                      }}
                    >
                      {(BOT_BEHAVIORS || []).map((opt) => (
                        <option key={opt} value={opt} style={selectOption}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  </Row>
                </>
              )}
            </div>
          )}

          {!info.free && !info.ownerIsBot && !info.mine && (
            <div style={modalSection}>
              <div style={{ fontWeight: 950 }}>Spieler</div>
              <div>{ownerName}</div>

              {info.ownerOffline && (
                <div style={{ color: "#fecaca", fontSize: 12, fontWeight: 950 }}>
                  Offline
                </div>
              )}

              {meIsHost && (
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 6 }}>
                  <button
                    type="button"
                    style={btnDanger}
                    onClick={() => {
                      hostKickFromTeam(info.tid);
                      setTeamModal(null);
                    }}
                  >
                    Spieler kicken
                  </button>

                  <button
                    type="button"
                    style={btnGhost}
                    onClick={() => makeAdmin(info.owner, ownerName)}
                  >
                    Zum Admin machen
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ===== Render Guards
  if (!roomId) return <div style={{ padding: 12 }}>Keine Room-ID in der URL.</div>;
  if (!room && !err) return <div style={{ padding: 12 }}>Lade Versus-Room …</div>;
  if (err) return <div style={{ padding: 12, color: "crimson" }}>{err}</div>;
  if (room === null) return <div style={{ padding: 12, color: "crimson" }}>Room nicht gefunden.</div>;

  const showDraftBackground = hasDraftBackground;

const draftBgStyle = {
  position: "fixed",
  inset: 0,
  zIndex: -1,
  backgroundImage:
    `linear-gradient(${draftBgOverlay}, ${draftBgOverlay}), url('/backgrounds/background_draft.png')`,
  backgroundSize: "cover",
  backgroundPosition: phase === "lobby" ? "center 24%" : "center 30%",
  backgroundRepeat: "no-repeat",
  backgroundAttachment: "fixed",
  backgroundColor: "#05070b",
};

  return (
  <div style={outerStyle}>
    {showDraftBackground && <div style={draftBgStyle} />}
      <div style={topLine}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
          <div style={{ fontWeight: 900 }}>Versus — Auction Draft</div>

          {/* ✅ Zurück zur Lobby Button (immer sichtbar in auction/results) */}
          {(phase === "auction" || phase === "blindReveal" || phase === "results") && (
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
<button
  type="button"
  style={btnGhostSmall}
  onClick={toggleSoundMuted}
  title={soundMuted ? "Sound aktivieren" : "Sound stummschalten"}
>
  {soundMuted ? "🔇 Sound" : "🔊 Sound"}
</button>
<div style={{ display: "flex", alignItems: "center", gap: 10 }}>
  <span style={{ minWidth: 28 }}>Vol</span>

  <input
  type="range"
  min={0}
  max={100}
  step={1}
  value={soundVolume}
  onChange={(e) => {
    const v = Number(e.target.value);
    setSoundVolume(v);
    localStorage.setItem("versusSoundVolume", String(v));
  }}
  className="vs-vol"
  style={{ width: 120 }}
/>


  <span
    style={{
      fontSize: 12,
      opacity: 0.85,
      width: 36,
      textAlign: "right",
      fontVariantNumeric: "tabular-nums",
    }}
  >
    {soundVolume}%
  </span>
</div>


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
        <section style={lobbyPagePanel}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 14,
              alignItems: "flex-start",
              marginBottom: 18,
            }}
          >
            <div>
              <div style={lobbyTitle}>Auction Draft Lobby</div>
              
            </div>

            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <button
                type="button"
                onClick={copyRoomCode}
                style={{
                  ...btnGhostSmall,
                  padding: "12px 14px",
                  minWidth: 130,
                }}
              >
                {copiedRoom ? "Kopiert" : `Code: ${roomId}`}
              </button>

              {meIsHost && (
                <button onClick={startDraft} style={{ ...btnPrimary, padding: "12px 18px" }}>
                  Draft starten
                </button>
              )}
            </div>
          </div>

          <div style={lobbyLayout}>
            {/* Links: kompakte Host-Einstellungen */}
            <div style={{ display: "grid", gap: 10 }}>
              <div style={{ fontWeight: 950, opacity: 0.92 }}>Einstellungen</div>

              {!meIsHost ? (
                <div style={{ ...lobbySummaryCard, cursor: "default" }}>
                  <div style={{ fontWeight: 950 }}>Warte auf Host</div>
                  <div style={lobbyHint}>Der Host stellt den Draft ein und startet danach.</div>
                </div>
              ) : (
                <>
                  <button type="button" style={lobbySummaryCard} onClick={() => setSettingsModal("basic")}>
                    <div style={{ fontWeight: 950 }}>Grundsetup</div>
                    <div style={{ opacity: 0.78 }}>
                      Gen {settings.generation} · {settings.participants ?? 0} Spieler · {settings.botCount ?? 0} Bots
                    </div>
                    <div style={lobbyHint}>
                      Budget, Pokémon-Anzahl und Rundenzeit bearbeiten.
                    </div>
                  </button>

                  <button type="button" style={lobbySummaryCard} onClick={() => setSettingsModal("auction")}>
                    <div style={{ fontWeight: 950 }}>Auktion</div>
                    <div style={{ opacity: 0.78 }}>{getAuctionSummary()}</div>
                    <div style={lobbyHint}>
                      Auktionsart, Blind-Multi und Draft-Modus bearbeiten.
                    </div>
                  </button>

                  <button type="button" style={lobbySummaryCard} onClick={() => setSettingsModal("pool")}>
                    <div style={{ fontWeight: 950 }}>Pool-Filter</div>
                    <div style={{ opacity: 0.78 }}>{getPoolSummary()}</div>
                    <div style={lobbyHint}>
                      Legendäre, Mythische, Sub-Legis und Pseudo-Legis ein- oder ausschließen.
                    </div>
                  </button>
                </>
              )}

              <div style={{ ...lobbySummaryCard, cursor: "default" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
                  <div>
                    <div style={{ fontWeight: 950 }}>Raum</div>
                    <div style={{ opacity: 0.78, marginTop: 3 }}>
                      <b>{roomId}</b>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={copyRoomCode}
                    style={{ ...btnGhostSmall, padding: "8px 10px" }}
                  >
                    {copiedRoom ? "Kopiert" : "Kopieren"}
                  </button>
                </div>

                <div style={lobbyHint}>
                  Host: <b>{labelPlayer(hostPlayerId, room)}</b>
                  <br />
                  Du: <b>{labelPlayer(myPlayerId, room)}</b>
                </div>
              </div>
            </div>

            {/* Rechts: Teams clean untereinander */}
            <div style={{ display: "grid", gap: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "baseline" }}>
                <div>
                  <div style={{ fontWeight: 950, opacity: 0.92 }}>Teams</div>
                  <div style={lobbyHint}>
                    {clampInt(settings.participants ?? 0, 0, 20) === 0 ? (
                      <>Bot-only Raum. Du bist Zuschauer.</>
                    ) : (
                      <>Klicke auf ein Team, um beizutreten oder Aktionen zu öffnen.</>
                    )}
                  </div>
                </div>

                <div style={{ fontSize: 12, opacity: 0.65, fontWeight: 900 }}>
                  Dein Team: {myTeamId ? myTeamId.toUpperCase() : "—"}
                </div>
              </div>

              <div style={lobbyTeamList}>
                {teamIds.map((tid, slotIdx) => {
                  const info = getLobbyTeamInfo(tid, slotIdx);

                  return (
                    <button
                      key={tid}
                      type="button"
                      style={{
                        ...lobbyTeamRow,
                        borderColor: info.free
                          ? "rgba(255,255,255,0.10)"
                          : info.ownerOffline
                            ? "rgba(239,68,68,0.48)"
                            : info.ownerIsBot
                              ? "rgba(59,130,246,0.35)"
                              : "rgba(34,197,94,0.34)",
                        background: info.mine
                          ? "rgba(34,197,94,0.12)"
                          : "rgba(255,255,255,0.045)",
                      }}
                      onClick={() => setTeamModal({ tid, slotIdx })}
                    >
                      <div style={{ fontSize: 12, opacity: 0.48, fontWeight: 950 }}>
                        Team {slotIdx + 1}
                      </div>

                      <div style={{ minWidth: 0 }}>
                        <div
                          style={{
                            fontWeight: 950,
                            letterSpacing: 0.1,
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                        >
                          {info.teamName}
                          {info.mine ? " (deins)" : ""}
                        </div>
                      </div>

                      <div
                        style={{
                          opacity: 0.72,
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {info.playerName}
                      </div>

                      {lobbyStatusPill(info)}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </section>
      )}

      {renderSettingsModal()}
      {renderTeamModal()}

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
                const ownerId = teamOwners?.[tid] ?? null;
                const ownerIsBot = ownerId && String(ownerId).startsWith("bot:");
                const ownerOffline = !free && !ownerIsBot && isPlayerOffline(ownerId);

                // ================================
                // Anzeige-Team bestimmen
                // ================================
                let displayTeam = [];

                if (settings.keepEvolvedForms) {
  // ✅ Originalformen anzeigen (so wie gedraftet) — inkl. Mega-Metadaten
  displayTeam = team.map((p) => ({
    dexId: p.dexId,
    price: p.price,
    formKey: p.formKey || null,
    imageUrl: p.imageUrl || null,
    name: p.name || null,
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
  // wir behalten trotzdem Bild/Name vom originalen Draft-Mon als nice-to-have
  formKey: p.formKey || null,
  imageUrl: p.imageUrl || null,
  name: p.name || null,
});

                    }
                  }
                }

                return (
                  <div
                    key={tid}
                    style={{
  ...playerCard,
  borderColor: free
    ? "rgba(239,68,68,0.35)"
    : ownerOffline
      ? "rgba(239,68,68,0.85)"
      : "rgba(34,197,94,0.5)",
  background: free
    ? "rgba(24,8,8,0.88)"
    : ownerOffline
      ? "rgba(239,68,68,0.14)"
      : "rgba(34,197,94,0.08)",
      boxShadow: "0 12px 28px rgba(0,0,0,0.42)",
}}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
                      <div style={{ fontWeight: 900 }}>
  {teamTitle(tid)} {mine ? "(du)" : ""}
  {String(teamOwners?.[tid] || "").startsWith("bot:") ? (
    <span style={{ marginLeft: 8, fontSize: 11, opacity: 0.8 }}>(BOT)</span>
  ) : null}
</div>
                      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <div style={{ fontWeight: 900 }}>{money}€</div>
{ownerOffline && (
  <div style={{ fontSize: 11, fontWeight: 950, color: "rgba(239,68,68,0.95)" }}>
    OFFLINE
  </div>
)}

                       {!free && meIsHost && (() => {
  const ownerId = teamOwners?.[tid] ?? null;
  const ownerIsBot = ownerId && String(ownerId).startsWith("bot:");
  return (
    <button
      type="button"
      style={{ ...btnDanger, padding: "6px 10px", fontSize: 12, opacity: ownerIsBot ? 0.45 : 1 }}
      onClick={() => hostKickFromTeam(tid)}
      disabled={ownerIsBot}
      title={ownerIsBot ? "Bots dürfen nicht rausfliegen" : "Owner entfernen (Geld/Pokémon bleiben)"}
    >
      Entfernen
    </button>
  );
})()}

                      </div>
                    </div>
                    {renderTeamRenameBox(tid)}

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
  flexWrap: "wrap",          // ✅ macht automatisch 2+ Reihen
  overflow: "hidden",        // ✅ keine Scrollbar mehr
  paddingBottom: 0,
  whiteSpace: "normal",      // ✅ nowrap aus
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
  src={(p.formKey && megaImgMap?.[p.formKey]) || p.imageUrl || dexIdToImageUrl(p.dexId)}
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
  {(() => {
    const total = Number(draft.totalPokemon ?? 0);
    const done = Number(draft.auctionCountDone ?? 0);
    const cur = draft.current ? Math.min(total, done + 1) : Math.min(total, done);
    return isBlindMultiMode
      ? `Aktuelle Blind-Auswahl (${cur}/${total})`
      : `Aktuelles Pokémon (${cur}/${total})`;
  })()}
</div>


            {displayPokemon ? (
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
                <div style={{ display: "grid", gap: 10, justifyItems: "stretch", width: "100%" }}>
                  <div style={{ ...pokeHeroWrap, justifySelf: "center" }}>
                    <button
                      style={pokeHeroBtn}
                      onClick={() => openPokemonDetails(displayPokemon.dexId)}
                      title="Pokémon-Details öffnen"
                    >
                      <img
                        src={displayPokemon.imageUrl}
                        alt={displayPokemon.name}
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
                            {isBlindMode ? "Dein verdecktes Gebot" : "Höchstgebot"}
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
                            {isBlindMode ? (myBlindBid?.amount || 0) : (draft.highestBid || 0)}€
                          </div>

                          <div style={{ fontSize: 12, opacity: 0.9, marginTop: 2 }}>
                            {isBlindMode ? (
                              <>Gebote abgegeben: <b>{blindBidCount}</b></>
                            ) : (
                              <>von <b>{draft.highestTeamId ? teamTitle(draft.highestTeamId) : "—"}</b></>
                            )}
                          </div>
                        </div>

                        <div style={pokeHeroRightBadge}>
                          <div style={{ fontSize: 11, opacity: 0.8, fontWeight: 600 }}>Dex</div>
                          <div style={{ fontSize: 13, fontWeight: 600 }}>#{displayPokemon.dexId}</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div style={{ textAlign: "center", justifySelf: "center" }}>
                    <div style={{ fontSize: 20, fontWeight: 900 }}>{displayPokemon.name}</div>

                    {(() => {
                      const tag = getSpecialTag(displayPokemon.dexId, { isMega: !!displayPokemon?.formKey });
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
    gap: 1,
    rowGap: 1,
    alignItems: "center",
    flexWrap: "wrap",          
    justifyContent: "flex-start",
    alignContent: "flex-start",
    width: "100%",             
    overflow: "hidden",        
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
          src={
  p.formKey
    ? (megaImgMap?.[p.formKey] || p.imageUrl || dexIdToImageUrl(p.dexId))
    : (p.imageUrl || dexIdToImageUrl(p.dexId))
}

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
          <section
  className={isUrgent ? "timer-urgent" : ""}
  style={{ ...panel, gridColumn: "2 / 3", height: "min(61.5vh)" }}
>

            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
              <div style={{ fontWeight: 900 }}>Timer</div>
            </div>

            <div className="timer-display" style={timerBig}>
  {timer.running ? fmtSecs(timer.remaining) : "--"}
</div>

            <div style={{ opacity: 0.8, marginBottom: 12 }}>
              {timer.running
                ? (timer.paused ? "Pausiert" : "Läuft")
                : (isBlindMode ? "Wartet auf nächste Blind-Runde" : "Startet bei erstem Gebot (≥ 100)")}
            </div>

            <div style={{ borderTop: "1px solid rgba(255,255,255,0.12)", paddingTop: 10, marginTop: 10 }}>
              <div style={{ fontWeight: 900, marginBottom: 8 }}>Bieten</div>

              {isBlindMultiMode && (
                <div style={{ display: "grid", gap: 8, marginBottom: 12 }}>
                  <div style={{ fontSize: 12, opacity: 0.82 }}>
                    Wähle genau ein Pokémon aus und gib dein verdecktes Gebot ab. Pokémon ohne Gebot verschwinden nach der Runde.
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8 }}>
                    {(currentOptions || []).map((p) => {
                      const key = getPokemonAuctionKey(p);
                      const selected = blindOptionKey === key;
                      const hasMyBid = isBlindMultiMode && myBlindBid?.optionKey === key;

                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => setBlindOptionKey(key)}
                          style={{
                            padding: 10,
                            borderRadius: 14,
                            border: hasMyBid
                              ? "2px solid rgba(250,204,21,0.95)"
                              : selected
                                ? "2px solid rgba(34,197,94,0.9)"
                                : "1px solid rgba(255,255,255,0.14)",
                            background: hasMyBid
                              ? "rgba(250,204,21,0.16)"
                              : selected
                                ? "rgba(34,197,94,0.16)"
                                : "rgba(0,0,0,0.18)",
                            color: "inherit",
                            cursor: "pointer",
                            display: "grid",
                            justifyItems: "center",
                            gap: 4,
                            position: "relative",
                            boxShadow: hasMyBid
                              ? "0 0 0 1px rgba(250,204,21,0.35), 0 0 18px rgba(250,204,21,0.18)"
                              : "none",
                          }}
                          title={hasMyBid ? `Dein Gebot: ${myBlindBid?.amount || 0}€` : "Auf dieses Pokémon bieten"}
                        >
                          <img
                            src={p.imageUrl || dexIdToImageUrl(p.dexId)}
                            alt={p.name}
                            width={64}
                            height={64}
                            style={{ imageRendering: "pixelated" }}
                          />
                          <div style={{ fontWeight: 900, fontSize: 12, textAlign: "center" }}>{p.name}</div>
                          <div style={{ opacity: 0.75, fontSize: 11 }}>#{p.dexId}</div>
                          {hasMyBid && (
                            <div
                              style={{
                                marginTop: 4,
                                padding: "4px 8px",
                                borderRadius: 999,
                                background: "rgba(250,204,21,0.95)",
                                color: "#111827",
                                fontSize: 11,
                                fontWeight: 950,
                                boxShadow: "0 6px 14px rgba(0,0,0,0.28)",
                              }}
                            >
                              Dein Gebot: {myBlindBid?.amount || 0}€
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {isBlindMode && myBlindBid && (
                <div style={{ marginBottom: 10, fontSize: 12, opacity: 0.86 }}>
                  Dein aktuelles Blind-Gebot: <b>{myBlindBid.amount}€</b>
                  {isBlindMultiMode ? (
                    <> auf <b>{(currentOptions || []).find((p) => getPokemonAuctionKey(p) === myBlindBid.optionKey)?.name || "—"}</b></>
                  ) : null}
                </div>
              )}

              <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8 }}>
                {/* ✅ Spectator-Host: Startbutton, wenn kein Team */}
{!isBlindMode && meIsHost && !myTeamId && !draft.hasStarted && Number(draft.highestBid ?? 0) === 0 && !draft.highestTeamId ? (
  <div style={{ marginBottom: 10 }}>
    <button
      onClick={forceBotStartFromSpectator}
      style={btnPrimary}
      title="Setzt das erste Gebot (100€) durch einen Bot, damit die Runde startet"
    >
      Bots starten (100€ Startgebot)
    </button>
    <div style={{ fontSize: 12, opacity: 0.75, marginTop: 6 }}>
      Du bist Host ohne Team (Zuschauer). Dieser Button startet die Runde.
    </div>
  </div>
) : null}

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
                  onClick={() => submitBid()}
                  style={{ ...btnPrimary, opacity: myTeamId ? 1 : 0.5 }}
                  disabled={!myTeamId}
                  title={
                    myTeamId
                      ? (isBlindMode ? "Verdecktes Gebot abgeben oder ändern" : "Muss höher sein als das aktuelle Höchstgebot")
                      : "Du musst erst ein Team wählen (Lobby)"
                  }
                >
                  {isBlindMode ? "Verdeckt bieten" : "Bieten"}
                </button>
              </div>

              {/* ✅ Quick-Buttons */}
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
                <button style={btnGhost} onClick={() => setBidInput(100)} disabled={!myTeamId}>
                  100
                </button>

                {!isBlindMode && (
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
                )}

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

      {phase === "blindReveal" && (() => {
        const reveal = draft?.blindReveal || {};
        const results = Array.isArray(reveal?.results) ? reveal.results : [];
        const compensations = Array.isArray(reveal?.compensations) ? reveal.compensations : [];
        const skippedCompensations = Array.isArray(reveal?.skippedCompensations) ? reveal.skippedCompensations : [];
        const shouldFinish = !!reveal?.shouldFinish || !reveal?.nextCurrent;

        return (
          <section style={panel}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", marginBottom: 12 }}>
              <div>
                <div style={{ fontWeight: 950, fontSize: 22 }}>Blind-Reveal</div>
                <div style={{ opacity: 0.8, fontSize: 13 }}>
                  Gebote sind aufgedeckt. {meIsHost ? "Host kann danach fortfahren." : "Warte auf den Host."}
                </div>
              </div>

              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" }}>
                <div style={{ fontWeight: 900, opacity: 0.9 }}>
                  Bietrunden: {Number(draft?.auctionCountDone || 0)} / {Number(draft?.totalPokemon || settings?.totalPokemon || 0)}
                </div>

                {meIsHost ? (
                  <button type="button" style={btnPrimary} onClick={continueBlindAfterReveal}>
                    {shouldFinish ? "Zu den Ergebnissen" : "Nächstes Pokémon"}
                  </button>
                ) : (
                  <div style={{ opacity: 0.75, fontWeight: 800 }}>Host entscheidet weiter…</div>
                )}
              </div>
            </div>

            {results.length === 0 ? (
              <div style={{ opacity: 0.8 }}>Keine Reveal-Daten vorhanden.</div>
            ) : (
              <div style={{ display: "grid", gap: 12 }}>
                {results.map((r, idx) => {
                  const poke = r?.poke || {};
                  const bids = Array.isArray(r?.bids) ? r.bids : [];
                  const winnerName = r?.winnerTeamId ? teamTitle(r.winnerTeamId) : null;

                  return (
                    <div
                      key={`blind-reveal-${r?.optionKey || idx}`}
                      style={{
                        padding: 12,
                        borderRadius: 16,
                        border: "1px solid rgba(255,255,255,0.14)",
                        background: "rgba(0,0,0,0.28)",
                        display: "grid",
                        gridTemplateColumns: "120px 1fr",
                        gap: 14,
                        alignItems: "start",
                      }}
                    >
                      <button style={imgBtn} onClick={() => openPokemonDetails(poke.dexId)} title="Pokémon-Details öffnen">
                        <img
                          src={poke.imageUrl || dexIdToImageUrl(poke.dexId)}
                          alt={poke.name || getPokemonName(poke.dexId)}
                          width={86}
                          height={86}
                          style={{ imageRendering: "pixelated" }}
                        />
                      </button>

                      <div>
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                          <div>
                            <div style={{ fontWeight: 950, fontSize: 18 }}>{poke.name || getPokemonName(poke.dexId)}</div>
                            <div style={{ opacity: 0.75, fontSize: 12 }}>#{poke.dexId}</div>
                          </div>

                          {winnerName ? (
                            <div style={{ textAlign: "right" }}>
                              <div style={{ opacity: 0.75, fontSize: 12 }}>Gewinner</div>
                              <div style={{ fontWeight: 950 }}>{winnerName}</div>
                              <div style={{ fontWeight: 950 }}>{Number(r?.winningAmount || 0).toLocaleString("de-DE")}€</div>
                            </div>
                          ) : (
                            <div style={{ textAlign: "right", opacity: 0.8, fontWeight: 900 }}>
                              Keine Gebote - Pokémon verschwindet
                            </div>
                          )}
                        </div>

                        <div style={{ marginTop: 12, display: "grid", gap: 6 }}>
                          {bids.length === 0 ? (
                            <div style={{ opacity: 0.75, fontSize: 13 }}>Niemand hat darauf geboten.</div>
                          ) : (
                            bids.map((b, bidIdx) => (
                              <div
                                key={`blind-bid-${r?.optionKey || idx}-${b.teamId}-${bidIdx}`}
                                style={{
                                  display: "grid",
                                  gridTemplateColumns: "1fr auto auto",
                                  gap: 10,
                                  alignItems: "center",
                                  padding: "8px 10px",
                                  borderRadius: 12,
                                  background: b.won ? "rgba(34,197,94,0.16)" : "rgba(255,255,255,0.06)",
                                  border: b.won ? "1px solid rgba(34,197,94,0.4)" : "1px solid rgba(255,255,255,0.08)",
                                }}
                              >
                                <div style={{ fontWeight: 900 }}>{teamTitle(b.teamId)}</div>
                                <div style={{ fontWeight: 950 }}>{Number(b.amount || 0).toLocaleString("de-DE")}€</div>
                                <div style={{ opacity: b.valid ? 0.85 : 0.55, fontSize: 12 }}>
                                  {b.won ? "gewonnen" : b.valid ? "gültig" : "ungültig"}
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}

                {compensations.length > 0 && (
                  <div
                    style={{
                      padding: 12,
                      borderRadius: 16,
                      border: "1px solid rgba(250,204,21,0.35)",
                      background: "rgba(250,204,21,0.10)",
                      display: "grid",
                      gap: 10,
                    }}
                  >
                    <div style={{ fontWeight: 950, fontSize: 17 }}>Ausgleich für überbotene Teams</div>
                    <div style={{ opacity: 0.82, fontSize: 13 }}>
                      Diese Teams haben gültig geboten, wurden aber überboten. Sie bekommen ein noch freies anderes Pokémon aus derselben Auswahl und zahlen trotzdem ihr eigenes Gebot.
                    </div>

                    <div style={{ display: "grid", gap: 8 }}>
                      {compensations.map((c, idx) => {
                        const poke = c?.poke || {};
                        return (
                          <div
                            key={`blind-comp-${c?.teamId || idx}-${poke?.dexId || idx}`}
                            style={{
                              display: "grid",
                              gridTemplateColumns: "1fr auto",
                              gap: 10,
                              alignItems: "center",
                              padding: "8px 10px",
                              borderRadius: 12,
                              background: "rgba(255,255,255,0.06)",
                              border: "1px solid rgba(255,255,255,0.10)",
                            }}
                          >
                            <div style={{ fontWeight: 900 }}>{teamTitle(c.teamId)}</div>
                            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                              <img
                                src={poke.imageUrl || dexIdToImageUrl(poke.dexId)}
                                alt={poke.name || getPokemonName(poke.dexId)}
                                width={36}
                                height={36}
                                style={{ imageRendering: "pixelated" }}
                              />
                              <div style={{ fontWeight: 950 }}>{poke.name || getPokemonName(poke.dexId)}</div>
                              <div style={{ opacity: 0.75, fontSize: 12 }}>
                                {Number(c?.price || 0).toLocaleString("de-DE")}€
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {skippedCompensations.length > 0 && (
                  <div
                    style={{
                      padding: 12,
                      borderRadius: 16,
                      border: "1px solid rgba(239,68,68,0.28)",
                      background: "rgba(239,68,68,0.08)",
                      display: "grid",
                      gap: 10,
                    }}
                  >
                    <div style={{ fontWeight: 950, fontSize: 17 }}>Kein Ausgleich mehr frei</div>
                    <div style={{ opacity: 0.82, fontSize: 13 }}>
                      Es gab mehr überbotene Teams als freie andere Pokémon. Die niedrigsten überbotenen Gebote gehen leer aus.
                    </div>

                    <div style={{ display: "grid", gap: 8 }}>
                      {skippedCompensations.map((c, idx) => (
                        <div
                          key={`blind-comp-skip-${c?.teamId || idx}-${idx}`}
                          style={{
                            display: "grid",
                            gridTemplateColumns: "1fr auto",
                            gap: 10,
                            alignItems: "center",
                            padding: "8px 10px",
                            borderRadius: 12,
                            background: "rgba(255,255,255,0.05)",
                            border: "1px solid rgba(255,255,255,0.08)",
                          }}
                        >
                          <div style={{ fontWeight: 900 }}>{teamTitle(c.teamId)}</div>
                          <div style={{ opacity: 0.78, fontSize: 12 }}>
                            leer ausgegangen · Gebot: {Number(c?.price || 0).toLocaleString("de-DE")}€
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </section>
        );
      })()}

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
              const ownerId = teamOwners?.[tid] || null;
const bot = (draft?.bots || []).find((b) => b.teamId === tid || b.id === ownerId) || null;

// 🔥 Lobby-Config enthält evtl. noch "zufall" (soll im Draft NICHT spoilern, aber im Results schon auflösen)
const lobbyCfg =
  ownerId && String(ownerId).startsWith("bot:")
    ? (settings?.botsConfig || []).find((c) => String(c?.id) === String(ownerId)) || null
    : null;

const botInfo =
  bot && lobbyCfg
    ? (() => {
        const lobbyB1 = String(lobbyCfg.behavior1 || "none");
        const lobbyB2 = String(lobbyCfg.behavior2 || "none");
        const resolvedB1 = String(bot.behavior1 || "none");
        const resolvedB2 = String(bot.behavior2 || "none");

        const b1Text = lobbyB1 === "zufall" ? `zufall → ${resolvedB1}` : lobbyB1;
        const b2Text = lobbyB2 === "zufall" ? `zufall → ${resolvedB2}` : lobbyB2;

        return {
          diff: String(lobbyCfg.difficulty || bot.difficulty || "normal"),
          b1Text,
          b2Text,
        };
      })()
    : null;

              const showDraftedAsIs = !!settings.keepEvolvedForms && !settings.baseFormsOnly;
              const money = draft.budgets?.[tid] ?? 0;
              const free = teamIsFree(tid);

              // ✅ Anzeige nur Basisformen (dedupe) – aber nur wenn wir NICHT "as drafted" anzeigen
let baseDisplay = [];
if (!showDraftedAsIs) {
  const seen = new Set();
  for (const p of team) {
    const baseDex = baseDexIdOf(p.dexId);
    if (!seen.has(baseDex)) {
      seen.add(baseDex);
      baseDisplay.push({ baseDexId: baseDex, original: p });
    }
  }
}


              return (
                <div
                  key={tid}
                  style={{
                    ...playerCard,
                    borderColor: free ? "rgba(239,68,68,0.35)" : "rgba(34,197,94,0.35)",
                    background: free ? "rgba(34,197,94,0.08)" : "rgba(34,197,94,0.05)",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                    <div style={{ fontWeight: 900 }}>{teamTitle(tid)}</div>
                    <div style={{ fontWeight: 900, opacity: 0.9 }}>{money}€ übrig</div>
                  </div>
{botInfo && (
  <div style={{ opacity: 0.85, fontSize: 12, marginTop: 2 }}>
    Bot: <b>{botInfo.diff}</b> — Verhalten: <b>{botInfo.b1Text}</b>
    {botInfo.b2Text && botInfo.b2Text !== "none" ? ` + ${botInfo.b2Text}` : ""}
  </div>
)}
                  <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
                    {team.length === 0 ? (
  <div style={{ opacity: 0.7 }}>Keine Pokémon</div>
) : showDraftedAsIs ? (
  // ✅ Modus: "Alle erlauben" → exakt so anzeigen wie gedraftet
  team.map((p, idx) => {
    const name = p?.name || getPokemonName(p?.dexId);
    const price = p?.price ?? "?";
    const img = p?.imageUrl || dexIdToImageUrl(p?.dexId);

    return (
      <div key={`${tid}-drafted-row-${p?.dexId}-${idx}`} style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <button style={imgBtn} onClick={() => openPokemonDetails(p?.dexId)} title="Pokémon-Details öffnen">
          <img
            src={img}
            alt={name}
            width={44}
            height={44}
            style={{ imageRendering: "pixelated" }}
          />
        </button>

        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 900 }}>{name}</div>
          <div style={{ opacity: 0.8, fontSize: 12 }}>
            Gedraftet · {price}€
          </div>
        </div>
      </div>
    );
  })
) : (
  // ✅ Modus: "Basisform only" → Basisformen anzeigen (wie vorher)
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
  minHeight: "100vh",
  display: "grid",
  gap: 10,
  overflowX: "auto",
  overflowY: "auto",
  WebkitOverflowScrolling: "touch",
};


const topLine = {
  display: "flex",
  flexDirection: "column",
  gap: 6,
  padding: "6px 0",
};

const panel = {
  padding: 12,
  border: "1px solid rgba(255,255,255,0.14)",
  borderRadius: 16,
  background: "rgba(0,0,0,0.22)",
  boxShadow: "0 10px 24px rgba(0,0,0,0.30)",
};