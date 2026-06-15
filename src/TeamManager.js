import React, { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { versionToPokedex } from "./data/versionToPokedex";
import { useDuoSave } from "./duo/useDuoSave";

function getDexIdFromName(name, fullDex) {
  const entry = Object.entries(fullDex).find(([, n]) => n === name);
  if (!entry) return null;
  return entry[0].replace("pokedex", "");
}

/* =========================
   Spezial-Form IDs
========================= */
const SPECIAL_FORM_IDS = {
  // ===== Mega-Formen =====
  3: { mega: 10033 },
  6: { "mega-x": 10034, "mega-y": 10035 },
  9: { mega: 10036 },
  15: { mega: 10090 },
  18: { mega: 10073 },
  65: { mega: 10037 },
  80: { mega: 10071 },
  94: { mega: 10038 },
  115: { mega: 10039 },
  127: { mega: 10040 },
  130: { mega: 10041 },
  142: { mega: 10042 },
  150: { "mega-x": 10043, "mega-y": 10044 },

  181: { mega: 10045 },
  208: { mega: 10072 },
  212: { mega: 10046 },
  214: { mega: 10047 },
  229: { mega: 10048 },
  248: { mega: 10049 },

  254: { mega: 10065 },
  257: { mega: 10050 },
  260: { mega: 10064 },
  282: { mega: 10051 },
  303: { mega: 10052 },
  306: { mega: 10053 },
  308: { mega: 10054 },
  310: { mega: 10055 },
  319: { mega: 10070 },
  323: { mega: 10087 },
  334: { mega: 10067 },
  354: { mega: 10056 },
  359: { mega: 10057 },
  362: { mega: 10074 },
  373: { mega: 10089 },
  376: { mega: 10076 },

  380: { mega: 10062 },
  381: { mega: 10063 },
  445: { mega: 10058 },
  448: { mega: 10059 },
  460: { mega: 10060 },

  531: { mega: 10061 },
  719: { mega: 10075 },

  // ===== Klassische Spezialformen =====
  351: { sunny: 10013, rainy: 10014, snowy: 10015 },
  386: { attack: 10001, defense: 10002, speed: 10003 },
  413: { sandy: 10004, trash: 10005 },
  421: { sunshine: 10028 },

  479: {
    heat: 10008,
    wash: 10009,
    frost: 10010,
    fan: 10011,
    mow: 10012,
  },

  487: { origin: 10007 },
  492: { sky: 10006 },
  550: { blue: 10016 },
  555: { zen: 10017 },

  641: { therian: 10019 },
  642: { therian: 10020 },
  645: { therian: 10021 },

  646: { white: 10022, black: 10023 },
  648: { pirouette: 10018 },
  647: { resolute: 10024 },
  718: { "10": 10025, complete: 10026 },

  681: { blade: 10027 },
  720: { unbound: 10086 },
  745: { midnight: 10029, dusk: 10030 },
  746: { school: 10031 },
  800: { "dusk-mane": 10155, "dawn-wings": 10156, ultra: 10157 },

  898: {
    "ice-rider": 10191,
    "shadow-rider": 10192,
  },

  964: { hero: 10256 },
  1017: {
    wellspring: 10273,
    hearthflame: 10274,
    cornerstone: 10275,
  },
};

function addSpecialForm(baseDexId, formKey, formPokemonId) {
  const id = Number(baseDexId);
  if (!id || !formKey || !formPokemonId) return;

  SPECIAL_FORM_IDS[id] = {
    ...(SPECIAL_FORM_IDS[id] || {}),
    [formKey]: formPokemonId,
  };
}

[
  // ===== Fehlende Megas / Proto-Formen =====
  [302, "mega", 10066], // Zobiris
  [384, "mega", 10079], // Rayquaza
  [428, "mega", 10088], // Schlapor
  [475, "mega", 10068], // Galagladi
  [382, "primal", 10077], // Kyogre
  [383, "primal", 10078], // Groudon

  // ===== Alola-Formen =====
  [19, "alola", 10091],
  [20, "alola", 10092],
  [26, "alola", 10100],
  [27, "alola", 10101],
  [28, "alola", 10102],
  [37, "alola", 10103],
  [38, "alola", 10104],
  [50, "alola", 10105],
  [51, "alola", 10106],
  [52, "alola", 10107],
  [53, "alola", 10108],
  [74, "alola", 10109],
  [75, "alola", 10110],
  [76, "alola", 10111],
  [88, "alola", 10112],
  [89, "alola", 10113],
  [103, "alola", 10114],
  [105, "alola", 10115],

  // ===== Galar-Formen =====
  [52, "galar", 10161],
  [77, "galar", 10162],
  [78, "galar", 10163],
  [79, "galar", 10164],
  [80, "galar", 10165],
  [83, "galar", 10166],
  [110, "galar", 10167],
  [122, "galar", 10168],
  [144, "galar", 10169],
  [145, "galar", 10170],
  [146, "galar", 10171],
  [199, "galar", 10172],
  [222, "galar", 10173],
  [263, "galar", 10174],
  [264, "galar", 10175],
  [554, "galar", 10176],
  [555, "galar", 10177],
  [555, "galar-zen", 10178],
  [562, "galar", 10179],
  [618, "galar", 10180],

  // ===== Hisui-Formen =====
  [58, "hisui", 10229],
  [59, "hisui", 10230],
  [100, "hisui", 10231],
  [101, "hisui", 10232],
  [157, "hisui", 10233],
  [211, "hisui", 10234],
  [215, "hisui", 10235],
  [503, "hisui", 10236],
  [549, "hisui", 10237],
  [570, "hisui", 10238],
  [571, "hisui", 10239],
  [628, "hisui", 10240],
  [705, "hisui", 10241],
  [706, "hisui", 10242],
  [713, "hisui", 10243],
  [724, "hisui", 10244],

  // ===== Paldea-Formen =====
  [128, "paldea-combat", 10250],
  [128, "paldea-blaze", 10251],
  [128, "paldea-aqua", 10252],
  [194, "paldea", 10253],
].forEach(([baseDexId, formKey, formPokemonId]) => {
  addSpecialForm(baseDexId, formKey, formPokemonId);
});

function formBadgeLabel(formKey) {
  if (!formKey) return "";

  if (formKey === "mega") return "Mega";
  if (formKey === "mega-x") return "Mega X";
  if (formKey === "mega-y") return "Mega Y";
  if (formKey === "primal") return "Proto";

  if (formKey === "alola") return "Alola";
  if (formKey === "galar") return "Galar";
  if (formKey === "galar-zen") return "Galar Zen";
  if (formKey === "hisui") return "Hisui";
  if (formKey === "paldea") return "Paldea";
  if (formKey === "paldea-combat") return "Paldea Kampf";
  if (formKey === "paldea-blaze") return "Paldea Feuer";
  if (formKey === "paldea-aqua") return "Paldea Wasser";

  if (formKey === "heat") return "Feuer";
  if (formKey === "wash") return "Wasser";
  if (formKey === "frost") return "Eis";
  if (formKey === "fan") return "Flug";
  if (formKey === "mow") return "Pflanze";

  if (formKey === "attack") return "Angriff";
  if (formKey === "defense") return "Verteid.";
  if (formKey === "speed") return "Initiative";

  if (formKey === "sandy") return "Sand";
  if (formKey === "trash") return "Lumpen";
  if (formKey === "sunshine") return "Sonne";

  if (formKey === "origin") return "Urform";
  if (formKey === "sky") return "Zenit";

  if (formKey === "zen") return "Trance";
  if (formKey === "pirouette") return "Pirouette";
  if (formKey === "therian") return "Tiergeist";

  if (formKey === "white") return "Weiss";
  if (formKey === "black") return "Schwarz";

  if (formKey === "sunny") return "Sonne";
  if (formKey === "rainy") return "Regen";
  if (formKey === "snowy") return "Schnee";

  if (formKey === "blue") return "Blau";
  if (formKey === "resolute") return "Resolut";

  if (formKey === "10") return "10%";
  if (formKey === "complete") return "Komplett";

  if (formKey === "blade") return "Klinge";
  if (formKey === "midnight") return "Mitternacht";
  if (formKey === "dusk") return "Abend";
  if (formKey === "school") return "Schwarm";

  if (formKey === "dusk-mane") return "Abendmähne";
  if (formKey === "dawn-wings") return "Morgenschwingen";
  if (formKey === "ultra") return "Ultra";

  if (formKey === "unbound") return "Entfesselt";

  if (formKey === "ice-rider") return "Eisreiter";
  if (formKey === "shadow-rider") return "Schattenreiter";

  if (formKey === "hero") return "Held";

  if (formKey === "wellspring") return "Quellmaske";
  if (formKey === "hearthflame") return "Flammenmaske";
  if (formKey === "cornerstone") return "Felsmaske";

  return "Form";
}

function getFormIdFor(baseDexId, formKey) {
  const base = Number(baseDexId);
  if (!base || !formKey) return null;
  const forms = SPECIAL_FORM_IDS[base];
  if (!forms) return null;
  return forms[formKey] || null;
}

const typeCache = {};

const typeRelationsCache = {};

const ALL_ATTACK_TYPES = [
  "normal", "fire", "water", "electric", "grass", "ice",
  "fighting", "poison", "ground", "flying", "psychic", "bug",
  "rock", "ghost", "dragon", "dark", "steel", "fairy",
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

function typeLabelDe(typeKey) {
  return TYPE_LABELS_DE[typeKey] || typeKey;
}

async function fetchTypeRelations(typeName) {
  if (!typeName) return null;
  if (typeRelationsCache[typeName]) return typeRelationsCache[typeName];

  try {
    const res = await fetch(`https://pokeapi.co/api/v2/type/${typeName}`);
    const data = await res.json();

    const relations = {
      doubleFrom: data.damage_relations?.double_damage_from?.map((x) => x.name) || [],
      halfFrom: data.damage_relations?.half_damage_from?.map((x) => x.name) || [],
      noFrom: data.damage_relations?.no_damage_from?.map((x) => x.name) || [],
    };

    typeRelationsCache[typeName] = relations;
    return relations;
  } catch (err) {
    console.error("Typ-Relations konnten nicht geladen werden:", err);
    return null;
  }
}

function getMultiplierFromRelations(defenderTypes, typeRelationsMap, attackType) {
  let multiplier = 1;

  defenderTypes.forEach((defType) => {
    const rel = typeRelationsMap[defType];
    if (!rel) return;

    if (rel.noFrom.includes(attackType)) {
      multiplier *= 0;
      return;
    }
    if (rel.doubleFrom.includes(attackType)) {
      multiplier *= 2;
    }
    if (rel.halfFrom.includes(attackType)) {
      multiplier *= 0.5;
    }
  });

  return multiplier;
}

function multiplierLabel(multiplier) {
  if (multiplier === 0) return "0x";
  if (multiplier === 0.25) return "0.25x";
  if (multiplier === 0.5) return "0.5x";
  if (multiplier === 1) return "1x";
  if (multiplier === 2) return "2x";
  if (multiplier === 4) return "4x";
  return `${multiplier}x`;
}

async function fetchTypesFromAPI(pokeId) {
  if (typeCache[pokeId]) return typeCache[pokeId];
  try {
    const res = await fetch(`https://pokeapi.co/api/v2/pokemon/${pokeId}`);
    const data = await res.json();
    const types = data.types.map((t) => t.type.name);
    typeCache[pokeId] = types;
    return types;
  } catch (err) {
    console.error("Typen konnten nicht geladen werden:", err);
    return [];
  }
}

function typeIconUrl(typeKey) {
  const t = String(typeKey || "").toLowerCase();
  return `https://raw.githubusercontent.com/partywhale/pokemon-type-icons/master/icons/${t}.svg`;
}

function padTeam(team) {
  return [...(team || []), "", "", "", "", "", ""].slice(0, 6);
}

function buildAvailablePokemon(encounters, teamCount) {
  const perTeamPokemon = Array(teamCount)
    .fill(null)
    .map(() => []);

  Object.values(encounters || {}).forEach((entry) => {
    for (let i = 0; i < teamCount; i++) {
      const pokeKey = `pokemon${i + 1}`;
      const statusKey = `status${i + 1}`;
      const poke = entry[pokeKey];

      const status = teamCount === 1 ? (entry.status ?? entry.status1) : entry[statusKey];

      if (poke && status === "Gefangen") {
        perTeamPokemon[i].push(poke);
      }
    }
  });

  // unique, Reihenfolge wird später deterministisch sortiert
  return perTeamPokemon.map((list) => [...new Set(list)]);
}

// Firestore darf keine nested arrays -> Teams als Objekt speichern
function teamsArrayToObject(teamsArr) {
  const obj = {};
  (teamsArr || []).forEach((team, i) => {
    obj[`team${i + 1}`] = team;
  });
  return obj;
}

// Kann sowohl Array (local) als auch Objekt (firestore) lesen
function normalizeTeamsSource(teamsSrc, teamCount) {
  if (Array.isArray(teamsSrc)) {
    const cleaned = teamsSrc.map((t) => padTeam(t));
    return cleaned.length === teamCount
      ? cleaned
      : Array(teamCount).fill(null).map(() => ["", "", "", "", "", ""]);
  }

  if (teamsSrc && typeof teamsSrc === "object") {
    const arr = [];
    for (let i = 0; i < teamCount; i++) {
      arr.push(padTeam(teamsSrc[`team${i + 1}`] || []));
    }
    return arr;
  }

  return Array(teamCount).fill(null).map(() => ["", "", "", "", "", ""]);
}

/* =========================
   Team Page CSS
========================= */
const TEAM_PAGE_CSS = `
  .team-page,
  .team-page * {
    box-sizing: border-box;
  }

  .team-page::-webkit-scrollbar,
  .team-page *::-webkit-scrollbar {
    display: none;
  }

  .team-page,
  .team-page * {
    scrollbar-width: none;
    -ms-overflow-style: none;
  }

  .team-page button {
    margin: 0 !important;
    border-radius: 12px !important;
    border: 1px solid rgba(120, 155, 220, 0.34);
    background:
      linear-gradient(135deg, rgba(70, 105, 165, 0.18), rgba(28, 42, 74, 0.16)),
      rgba(7, 12, 26, 0.54);
    color: #ffffff;
    font-weight: 950;
    box-shadow:
      0 10px 22px rgba(0, 0, 0, 0.18),
      inset 0 1px 0 rgba(255, 255, 255, 0.08);
    transition:
      transform 160ms ease,
      border-color 160ms ease,
      background 160ms ease,
      box-shadow 160ms ease,
      filter 160ms ease;
  }

  .team-page button:hover,
  .team-page button:focus-visible {
    transform: translateY(-2px);
    border-color: rgba(165, 195, 255, 0.58);
    background:
      linear-gradient(135deg, rgba(90, 130, 200, 0.24), rgba(35, 54, 92, 0.20)),
      rgba(9, 15, 32, 0.64);
    box-shadow:
      0 14px 28px rgba(0, 0, 0, 0.24),
      0 0 18px rgba(120, 165, 255, 0.12),
      inset 0 1px 0 rgba(255, 255, 255, 0.12);
    outline: none;
    filter: brightness(1.04);
  }

  .team-page h1 {
    color: #ffffff !important;
    text-shadow: 3px 3px #079e4b;
    letter-spacing: -0.03em;
  }

  .team-page h2,
  .team-page h3 {
    color: rgba(255, 255, 255, 0.96);
    letter-spacing: -0.02em;
  }

  .pokeboxItemStatic,
  .pokeboxItemStatic:hover,
  .pokeboxItemStatic:active,
  .pokeboxItemStatic:focus,
  .pokeboxItemStatic:focus-visible {
    transform: none !important;
    transition: none !important;
    animation: none !important;
    filter: none !important;
    box-shadow: none !important;
  }

  .pokeboxItemStatic img,
  .pokeboxItemStatic:hover img,
  .pokeboxItemStatic:active img,
  .pokeboxItemStatic:focus img,
  .pokeboxItemStatic:focus-visible img {
    transform: none !important;
    transition: none !important;
    animation: none !important;
    filter: none !important;
  }

  .pokeboxImgStatic {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: contain;
    transform: none !important;
    transition: none !important;
    animation: none !important;
  }

  .analysisModalScroll {
    -ms-overflow-style: none;
    scrollbar-width: none;
  }

  .analysisModalScroll::-webkit-scrollbar {
    display: none;
    width: 0;
    height: 0;
  }

  .pokeboxItemStatic:focus-visible {
    outline: 2px solid rgba(120,170,255,0.55) !important;
    outline-offset: 2px !important;
  }
  .team-slot-sprite,
  .team-pokebox-item,
  .pokeboxImgStatic {
    user-select: none;
    -webkit-user-select: none;
    -webkit-touch-callout: none;
    touch-action: manipulation;
  }
    
  @media (max-width: 760px), (max-width: 980px) and (max-height: 560px) and (orientation: landscape) {
    .team-page {
      min-height: 100dvh !important;
      overflow-x: hidden !important;
      overflow-y: auto !important;
    }

    .team-content {
      width: 100% !important;
      padding: 10px 8px 28px !important;
    }

    .team-topbar {
      width: 100% !important;
      display: grid !important;
      grid-template-columns: 1fr !important;
      align-items: stretch !important;
      gap: 10px !important;
      padding: 12px !important;
      border-radius: 18px !important;
    }

    .team-topbar button {
      width: 100% !important;
      min-height: 40px !important;
      padding: 8px 10px !important;
      font-size: 0.86rem !important;
    }

    .team-header-card {
      width: 100% !important;
      margin: 0 0 12px !important;
      padding: 14px !important;
      border-radius: 18px !important;
    }

    .team-header-card h1 {
      font-size: clamp(1.75rem, 8vw, 2.35rem) !important;
      line-height: 0.95 !important;
      text-shadow: 2px 2px #079e4b !important;
    }

    .team-header-actions {
      display: grid !important;
      grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
      gap: 8px !important;
    }

    .team-header-actions button {
      width: 100% !important;
      min-height: 42px !important;
      padding: 9px 10px !important;
      font-size: 0.86rem !important;
    }

    .team-teams-wrap {
      width: 100% !important;
      display: grid !important;
      grid-template-columns: 1fr !important;
      gap: 14px !important;
      justify-content: stretch !important;
    }

    .team-column {
      width: 100% !important;
      gap: 12px !important;
    }

    .team-glass-card {
      padding: 12px !important;
      border-radius: 18px !important;
    }

    .team-party-card > div:first-child {
      margin-bottom: 10px !important;
      align-items: center !important;
    }

    .team-party-card h2,
    .team-box-card h3 {
      font-size: 1.25rem !important;
      line-height: 1.05 !important;
    }

    .team-party-card > div:first-child button {
      min-height: 38px !important;
      padding: 8px 10px !important;
      font-size: 0.84rem !important;
    }

    .team-list {
      gap: 8px !important;
    }

    .team-slot-card {
      min-height: 76px !important;
      padding: 9px !important;
      border-radius: 14px !important;
      touch-action: pan-y;
    }

    .team-slot-card-empty {
      min-height: 54px !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
    }

    .team-slot-content {
      gap: 10px !important;
      align-items: center !important;
    }

    .team-slot-sprite {
      width: 58px !important;
      height: 58px !important;
      flex: 0 0 58px !important;
      object-fit: contain !important;
    }

    .team-slot-info {
      min-width: 0 !important;
      flex: 1 1 auto !important;
    }

    .team-slot-name-row {
      gap: 6px !important;
      margin-bottom: 5px !important;
      flex-wrap: wrap !important;
    }

    .team-slot-name {
      max-width: 100% !important;
      overflow: hidden !important;
      font-size: 1rem !important;
      line-height: 1.1 !important;
      text-overflow: ellipsis !important;
      white-space: nowrap !important;
    }

    .team-slot-name-row span {
      max-width: 100% !important;
      font-size: 0.68rem !important;
      padding: 4px 7px !important;
    }

    .team-type-row {
      gap: 6px !important;
    }

    .team-type-icon {
      width: 30px !important;
      height: 30px !important;
      padding: 4px !important;
      border-radius: 9px !important;
    }

    .team-pokebox-list {
      grid-template-columns: repeat(auto-fill, minmax(54px, 1fr)) !important;
      gap: 8px !important;
    }

    .team-pokebox-item {
      border-radius: 13px !important;
      padding: 5px !important;
    }

    .analysisModalScroll {
      width: min(100%, calc(100vw - 18px)) !important;
      max-height: 88dvh !important;
      padding: 14px !important;
      border-radius: 18px !important;
    }

    .analysisModalScroll > div:first-child {
      align-items: stretch !important;
      flex-direction: column !important;
    }

    .analysisModalScroll > div:first-child button {
      width: 100% !important;
      min-height: 40px !important;
    }
  }

  @media (max-width: 980px) and (max-height: 560px) and (orientation: landscape) {
    .team-content {
      padding: 8px 8px 22px !important;
    }

    .team-header-card {
      padding: 12px !important;
    }

    .team-header-card h1 {
      font-size: clamp(1.45rem, 4.8vw, 2rem) !important;
    }

    .team-teams-wrap {
      grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
      gap: 12px !important;
    }

    .team-glass-card {
      padding: 10px !important;
    }

    .team-slot-card {
      min-height: 68px !important;
      padding: 8px !important;
    }

    .team-slot-sprite {
      width: 52px !important;
      height: 52px !important;
      flex-basis: 52px !important;
    }

    .team-type-icon {
      width: 26px !important;
      height: 26px !important;
      padding: 3px !important;
    }

    .team-pokebox-list {
      grid-template-columns: repeat(auto-fill, minmax(46px, 1fr)) !important;
      gap: 7px !important;
    }
  }

  @media (max-width: 390px), (max-width: 700px) and (max-height: 430px) and (orientation: landscape) {
    .team-header-actions {
      grid-template-columns: 1fr !important;
    }

    .team-slot-sprite {
      width: 54px !important;
      height: 54px !important;
      flex-basis: 54px !important;
    }

    .team-pokebox-list {
      grid-template-columns: repeat(auto-fill, minmax(48px, 1fr)) !important;
    }
  }
`;

/* =========================
   Deterministische Sortierung
   - stabilisiert Box-Reihenfolge trotz Firestore/Object.values()
========================= */
function sortBoxList(list, fullDex) {
  const arr = [...(list || [])];
  arr.sort((a, b) => {
    const aDex = Number(getDexIdFromName(a, fullDex) || 99999);
    const bDex = Number(getDexIdFromName(b, fullDex) || 99999);
    if (aDex !== bDex) return aDex - bDex;
    return String(a).localeCompare(String(b), "de", { sensitivity: "base" });
  });
  return arr;
}

function buildLinkedBoxRows(encounters, teams, teamCount, fullDex) {
  const rows = [];

  const encounterEntries = Object.entries(encounters || {}).sort(([keyA, a], [keyB, b]) => {
    const routeA = String(a?.route || keyA || "");
    const routeB = String(b?.route || keyB || "");
    return routeA.localeCompare(routeB, "de", { sensitivity: "base" });
  });

  encounterEntries.forEach(([, entry]) => {
    const names = Array.from({ length: teamCount }, (_, i) => entry?.[`pokemon${i + 1}`] || "");
    const statuses = Array.from({ length: teamCount }, (_, i) => {
      return teamCount === 1 ? (entry?.status ?? entry?.status1) : entry?.[`status${i + 1}`];
    });

    const hasCaughtPokemon = names.some((name, i) => name && statuses[i] === "Gefangen");
    if (!hasCaughtPokemon) return;

    const allAlreadyInTeam = names.every((name, i) => {
      if (!name) return true;
      return (teams?.[i] || []).includes(name);
    });

    if (allAlreadyInTeam) return;

    rows.push({
      route: entry?.route || "",
      names,
    });
  });

  rows.sort((a, b) => {
    const aDex = Math.min(
      ...a.names
        .filter(Boolean)
        .map((name) => Number(getDexIdFromName(name, fullDex) || 99999))
    );

    const bDex = Math.min(
      ...b.names
        .filter(Boolean)
        .map((name) => Number(getDexIdFromName(name, fullDex) || 99999))
    );

    if (aDex !== bDex) return aDex - bDex;

    const aRoute = String(a.route || "");
    const bRoute = String(b.route || "");
    return aRoute.localeCompare(bRoute, "de", { sensitivity: "base" });
  });

  return rows;
}

function TeamManager() {
  const navigate = useNavigate();

  // ===== Duo/Online State =====
  const activeDuoRoomId = localStorage.getItem("activeDuoRoomId") || "";
  const { save: duoSave, patchSave: patchDuoSave, error: duoError } = useDuoSave(activeDuoRoomId);
  const isDuo = !!activeDuoRoomId;

  // ===== Local Save State =====
  const activeSave = localStorage.getItem("activeSave");

  // ===== Effective meta (Duo prefers Firestore) =====
  const effectiveEdition = isDuo
    ? (duoSave?.edition || "Rot")
    : (() => {
        const saves = JSON.parse(localStorage.getItem("savegames") || "{}");
        const current = saves[activeSave] || {};
        return current.edition || "Rot";
      })();

  const effectiveLinkMode = isDuo
    ? (duoSave?.linkMode || "duo")
    : (() => {
        const saves = JSON.parse(localStorage.getItem("savegames") || "{}");
        const current = saves[activeSave] || {};
        return current.linkMode || "solo";
      })();

  const teamCount = effectiveLinkMode === "trio" ? 3 : effectiveLinkMode === "duo" ? 2 : 1;

  // ===== Derived sources (Encounters + Teams) =====
  const encountersSource = useMemo(() => {
    if (isDuo) return duoSave?.encounters || {};
    const saves = JSON.parse(localStorage.getItem("savegames") || "{}");
    const current = saves[activeSave] || {};
    return current.encounters || {};
  }, [isDuo, duoSave, activeSave]);

  const teamsSource = useMemo(() => {
    if (isDuo) return duoSave?.teams || {}; // in Firestore als Objekt gespeichert
    const saves = JSON.parse(localStorage.getItem("savegames") || "{}");
    const current = saves[activeSave] || {};
    return current.teams || [];
  }, [isDuo, duoSave, activeSave]);

  // ===== Form-Lookup: Name -> formKey (mega/mega-x/mega-y/"") =====
  const formByName = useMemo(() => {
  const map = {};
  Object.values(encountersSource || {}).forEach((entry) => {
    for (let i = 1; i <= teamCount; i++) {
      const n = entry?.[`pokemon${i}`];
      const f = entry?.[`form${i}`] || "";
      if (n) map[n] = f;
    }
  });
  return map;
}, [encountersSource, teamCount]);

  // ===== UI State =====
  const [teams, setTeams] = useState(() => Array(teamCount).fill(["", "", "", "", "", ""]));
  const [availablePokemon, setAvailablePokemon] = useState(() => Array(teamCount).fill([]));
  const [fullDex, setFullDex] = useState({});
  const [pokemonTypes, setPokemonTypes] = useState({}); // key: `${name}__${formKey}`
const [typeRelationsMap, setTypeRelationsMap] = useState({});
const [linkMode, setLinkMode] = useState(effectiveLinkMode);
const [showHardResetModal, setShowHardResetModal] = useState(false);
const [analysisModal, setAnalysisModal] = useState({
  open: false,
  teamIndex: 0,
});
const pokemonLongPressTimerRef = useRef(null);
const ignoreNextPokemonClickRef = useRef(false);

  // ===== Load Dex + Teams + Box when sources change =====
  useEffect(() => {
    const mergedDex = versionToPokedex[effectiveEdition] || {};
    setFullDex(mergedDex);

    setLinkMode(effectiveLinkMode);

    const finalTeams = normalizeTeamsSource(teamsSource, teamCount);
    setTeams(finalTeams);

    const avail = buildAvailablePokemon(encountersSource, teamCount);
    setAvailablePokemon(avail);
  }, [effectiveEdition, effectiveLinkMode, teamCount, encountersSource, teamsSource]);

    // ===== Gemeinsame Box-Reihen für gelinkte Pokémon =====
  const linkedBoxRows = useMemo(() => {
    return buildLinkedBoxRows(encountersSource, teams, teamCount, fullDex);
  }, [encountersSource, teams, teamCount, fullDex]);
const teamAnalysis = useMemo(() => {
  return teams.map((team, teamIndex) => {
    const members = team
      .filter(Boolean)
      .map((name) => {
        const formKey = formByName[name] || "";
        const typesKey = `${name}__${formKey || "base"}`;
        const types = pokemonTypes[typesKey] || [];

        return {
          name,
          formKey,
          types,
        };
      })
      .filter((mon) => mon.types.length > 0);

    const attackSummary = ALL_ATTACK_TYPES.map((attackType) => {
  let weakCount = 0;
  let resistCount = 0;
  let immuneCount = 0;
  let neutralCount = 0;

  let x4Count = 0;
  let x2Count = 0;
  let x05Count = 0;
  let x025Count = 0;
  let x0Count = 0;

  let score = 0;

  members.forEach((mon) => {
    const mult = getMultiplierFromRelations(mon.types, typeRelationsMap, attackType);

    if (mult === 0) {
      immuneCount += 1;
      x0Count += 1;
      score -= 2;
    } else if (mult === 4) {
      weakCount += 1;
      x4Count += 1;
      score += 4;
    } else if (mult === 2) {
      weakCount += 1;
      x2Count += 1;
      score += 2;
    } else if (mult === 0.25) {
      resistCount += 1;
      x025Count += 1;
      score -= 2;
    } else if (mult === 0.5) {
      resistCount += 1;
      x05Count += 1;
      score -= 1;
    } else {
      neutralCount += 1;
    }
  });

  return {
    attackType,
    weakCount,
    resistCount,
    immuneCount,
    neutralCount,
    x4Count,
    x2Count,
    x05Count,
    x025Count,
    x0Count,
    score,
  };
})
      .sort((a, b) => b.score - a.score);

    const perPokemon = members.map((mon) => {
      const weaknesses = ALL_ATTACK_TYPES
        .map((attackType) => ({
          attackType,
          multiplier: getMultiplierFromRelations(mon.types, typeRelationsMap, attackType),
        }))
        .filter((x) => x.multiplier > 1)
        .sort((a, b) => b.multiplier - a.multiplier);

      const resistances = ALL_ATTACK_TYPES
        .map((attackType) => ({
          attackType,
          multiplier: getMultiplierFromRelations(mon.types, typeRelationsMap, attackType),
        }))
        .filter((x) => x.multiplier < 1)
        .sort((a, b) => a.multiplier - b.multiplier);

      return {
        ...mon,
        weaknesses,
        resistances,
      };
    });

    return {
      teamIndex,
      members,
      dangerousTypes: attackSummary.filter((x) => x.score > 0).slice(0, 6),
      safeTypes: [...attackSummary].reverse().filter((x) => x.score < 0).slice(0, 6),
      perPokemon,
    };
  });
}, [teams, formByName, pokemonTypes, typeRelationsMap]);

  // ===== Persist Teams helper =====
  const persistTeams = async (newTeams) => {
    if (isDuo) {
      await patchDuoSave({ teams: teamsArrayToObject(newTeams) });
      return;
    }
    const saves = JSON.parse(localStorage.getItem("savegames") || "{}");
    if (!activeSave || !saves[activeSave]) return;
    saves[activeSave].teams = newTeams;
    localStorage.setItem("savegames", JSON.stringify(saves));
  };

  // ===== Load types for all Pokémon in teams (inkl. Mega-Form) =====
  useEffect(() => {
  teams.flat().forEach(async (name) => {
    if (!name) return;

    const formKey = formByName[name] || "";
    const cacheKey = `${name}__${formKey || "base"}`;
    if (pokemonTypes[cacheKey]) return;

    const baseDexId = getDexIdFromName(name, fullDex);
    if (!baseDexId) return;

    const formId = getFormIdFor(baseDexId, formKey);
    const idToUse = formId || Number(baseDexId);

    const types = await fetchTypesFromAPI(idToUse);
    setPokemonTypes((prev) => ({ ...prev, [cacheKey]: types }));
  });
}, [teams, fullDex, pokemonTypes, formByName]);

useEffect(() => {
  const neededTypes = new Set();

  Object.values(pokemonTypes || {}).forEach((types) => {
    (types || []).forEach((t) => {
      if (t) neededTypes.add(t);
    });
  });

  neededTypes.forEach(async (typeName) => {
    if (typeRelationsMap[typeName]) return;
    const rel = await fetchTypeRelations(typeName);
    if (!rel) return;

    setTypeRelationsMap((prev) => {
      if (prev[typeName]) return prev;
      return { ...prev, [typeName]: rel };
    });
  });
}, [pokemonTypes, typeRelationsMap]);

  // ===== Remove Pokémon from Team if not in encounters anymore =====
  useEffect(() => {
  const allEncountered = new Set();
  Object.values(encountersSource || {}).forEach((entry) => {
    for (let i = 1; i <= teamCount; i++) {
      const mon = entry[`pokemon${i}`];
      if (mon) allEncountered.add(mon);
    }
  });

  const cleanedTeams = teams.map((team) => team.map((mon) => (mon && allEncountered.has(mon) ? mon : "")));

  const changed = JSON.stringify(cleanedTeams) !== JSON.stringify(teams);
  if (changed) {
    setTeams(cleanedTeams);
    persistTeams(cleanedTeams).catch(console.error);
  }
}, [encountersSource, teams, teamCount]);

  const updateTeam = async (index, newTeam) => {
    const newTeams = [...teams];
    newTeams[index] = newTeam;
    setTeams(newTeams);
    await persistTeams(newTeams);
  };

  const findLinkedGroup = (name, teamIndex) => {
    const encounters = encountersSource || {};
    for (const entry of Object.values(encounters)) {
      if (entry[`pokemon${teamIndex + 1}`] === name) {
        return Array.from({ length: teams.length }, (_, i) => entry[`pokemon${i + 1}`]);
      }
    }
    return null;
  };

  const isInTeam = (name) => teams.some((team) => team.includes(name));

  const toggleLinkedPokemon = async (clickedIndex, name) => {
  if (teamCount === 1) {
    const newTeams = [...teams];
    const team = [...newTeams[0]];
    const isAdding = !team.includes(name);

    if (isAdding) {
      const emptyIndex = team.findIndex((x) => !x);
      if (!team.includes(name) && emptyIndex >= 0) {
        team[emptyIndex] = name;
      }
    } else {
      const index = team.indexOf(name);
      if (index >= 0) {
        team[index] = "";
      }
    }

    newTeams[0] = team;
    setTeams(newTeams);
    await persistTeams(newTeams);
    return;
  }

  const linkedGroup = findLinkedGroup(name, clickedIndex);
  if (!linkedGroup) return;

  const newTeams = [...teams];
  const isAdding = !teams[clickedIndex].includes(name);

  linkedGroup.forEach((mon, i) => {
    if (!mon) return;
    const team = [...newTeams[i]];

    if (isAdding) {
      const emptyIndex = team.findIndex((x) => !x);
      if (!team.includes(mon) && emptyIndex >= 0) {
        team[emptyIndex] = mon;
      }
    } else {
      const index = team.indexOf(mon);
      if (index >= 0) {
        team[index] = "";
      }
    }

    newTeams[i] = team;
  });

  setTeams(newTeams);
  await persistTeams(newTeams);
};

  const onDragEnd = (result, teamIndex) => {
    if (!result.destination) return;
    const newTeam = [...teams[teamIndex]];
    const [moved] = newTeam.splice(result.source.index, 1);
    newTeam.splice(result.destination.index, 0, moved);
    updateTeam(teamIndex, newTeam).catch(console.error);
  };

  const hardResetAllTeams = async () => {
  const emptyTeams = Array(teamCount)
      .fill(null)
      .map(() => ["", "", "", "", "", ""]);

    setTeams(emptyTeams);

    try {
      await persistTeams(emptyTeams);
      setShowHardResetModal(false);
    } catch (err) {
      console.error("Fehler beim Hard-Reset der Teams:", err);
      alert("Beim Zuruecksetzen der Teams ist ein Fehler aufgetreten.");
    }
  };

  const openHardResetModal = () => {
    setShowHardResetModal(true);
  };

  const closeHardResetModal = () => {
    setShowHardResetModal(false);
  };

  const clearPokemonLongPressTimer = () => {
    if (pokemonLongPressTimerRef.current) {
      window.clearTimeout(pokemonLongPressTimerRef.current);
      pokemonLongPressTimerRef.current = null;
    }
  };

  const openPokemonInfo = (idToUse) => {
    const id = Number(idToUse);
    if (!id) return;

    navigate(`/pokemon/${id}`);
  };

  const startPokemonLongPress = (idToUse) => {
    clearPokemonLongPressTimer();

    const id = Number(idToUse);
    if (!id) return;

    ignoreNextPokemonClickRef.current = false;

    pokemonLongPressTimerRef.current = window.setTimeout(() => {
      ignoreNextPokemonClickRef.current = true;
      openPokemonInfo(id);

      window.setTimeout(() => {
        ignoreNextPokemonClickRef.current = false;
      }, 900);
    }, 600);
  };

  const handlePokemonPrimaryClick = async (teamIndex, pokemonName) => {
    if (ignoreNextPokemonClickRef.current) {
      ignoreNextPokemonClickRef.current = false;
      return;
    }

    await toggleLinkedPokemon(teamIndex, pokemonName);
  };

  return (
    <div className="team-page" style={page}>
      <style>{TEAM_PAGE_CSS}</style>

      <div style={bg} />
      <div style={overlay} />

      <div className="team-content" style={content}>
        {isDuo && (
  <div className="team-topbar" style={topBar}>
    <div>
      <strong style={{ color: "#079e4b" }}>
        {effectiveLinkMode === "solo"
          ? "Solo Online aktiv"
          : effectiveLinkMode === "trio"
          ? "Trio Online aktiv"
          : "Duo Online aktiv"}
      </strong>{" "}
      — Room: <b>{activeDuoRoomId}</b>
    </div>
    <button
      style={btnGreen}
      onClick={() => {
        localStorage.removeItem("activeDuoRoomId");
        localStorage.removeItem("activeSave");
        localStorage.removeItem("current_slot");
        sessionStorage.setItem("blockAutoResume", "1");
        navigate("/duo", { replace: true });
      }}
    >
      Lobby verlassen
    </button>
  </div>
)}
        {duoError && <p style={{ color: "crimson" }}>{duoError}</p>}

        <div className="team-header-card" style={headerCard}>
  <h1 style={{ margin: 0 }}>
  Dein Team (
  {linkMode === "solo" ? "Solo" : linkMode === "trio" ? "Trio" : "Duo"}
  )
</h1>

  <div
    className="team-header-actions"
    style={{
      marginTop: 10,
      display: "flex",
      gap: 10,
      flexWrap: "wrap",
    }}
  >
    <button style={btnGhost} onClick={() => navigate("/table")}>
      Zurück zur Tabelle
    </button>

    <button style={btnDanger} onClick={openHardResetModal}>
  Team reset
</button>
  </div>
</div>

        <div className="team-teams-wrap" style={teamsWrap}>
          {teams.map((team, i) => (
            <div key={i} className="team-column" style={teamCol}>
              <div className="team-glass-card team-party-card" style={glassCard}>
  <div
    style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 10,
      marginBottom: 10,
    }}
  >
    <h2 style={{ marginTop: 0, marginBottom: 0 }}>Team {i + 1}</h2>

    <button
      style={btnGhost}
      onClick={() =>
        setAnalysisModal({
          open: true,
          teamIndex: i,
        })
      }
    >
      Analyse
    </button>
  </div>

                <DragDropContext onDragEnd={(res) => onDragEnd(res, i)}>
                  <Droppable droppableId={`team-${i}`}>
                    {(provided) => (
                      <ul className="team-list" ref={provided.innerRef} {...provided.droppableProps} style={teamList}>
                        {team.map((p, j) => {
                          const baseDexId = p ? getDexIdFromName(p, fullDex) : null;
                          const formKey = p ? (formByName[p] || "") : "";
                          const formId = baseDexId ? getFormIdFor(baseDexId, formKey) : null;
                          const idToUse = formId || (baseDexId ? Number(baseDexId) : null);

                          const imgUrl = idToUse
                            ? formId
                              ? `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${idToUse}.png`
                              : `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${idToUse}.png`
                            : null;

                          const typesKey = p ? `${p}__${formKey || "base"}` : "";
                          const types = typesKey ? (pokemonTypes[typesKey] || []) : [];

                          return (
                            <Draggable key={`slot-${i}-${j}`} draggableId={`poke-${i}-${j}`} index={j}>
                              {(provided) => (
                                <li
                                  ref={provided.innerRef}
                                  {...provided.draggableProps}
                                  {...provided.dragHandleProps}
                                  className={p ? "team-slot-card" : "team-slot-card team-slot-card-empty"}
                                  style={{
                                    ...teamSlot,
                                    ...(provided.draggableProps.style || {}),
                                  }}
                                >
                                  {p ? (
                                    <div className="team-slot-content" style={slotContent}>
                                      {imgUrl && (
                                        <img
                                          className="team-slot-sprite"
                                          src={imgUrl}
                                          alt={p}
                                          onClick={() => handlePokemonPrimaryClick(i, p)}
                                          onTouchStart={() => startPokemonLongPress(idToUse)}
                                          onTouchMove={clearPokemonLongPressTimer}
                                          onTouchEnd={clearPokemonLongPressTimer}
                                          onTouchCancel={clearPokemonLongPressTimer}
                                          onContextMenu={(e) => {
                                            e.preventDefault();
                                            openPokemonInfo(idToUse);
                                          }}
                                          title="Klick: aus Team entfernen | Gedrückt halten/Rechtsklick: Pokédex öffnen"
                                          style={{
                                            width: 72,
                                            height: 72,
                                            cursor: "pointer",
                                            filter: formId
                                              ? "drop-shadow(0 0 14px rgba(161,76,255,0.55)) drop-shadow(0 10px 18px rgba(0,0,0,0.45))"
                                              : "drop-shadow(0 6px 14px rgba(0,0,0,0.45))",
                                            display: "block",
                                          }}
                                          onError={(e) => {
                                            if (!formId && idToUse) {
                                              e.currentTarget.src = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${idToUse}.png`;
                                            }
                                          }}
                                        />
                                      )}

                                      <div className="team-slot-info" style={{ flex: 1 }}>
                                        <div className="team-slot-name-row" style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                                          <div className="team-slot-name" style={{ fontWeight: 900 }}>{p}</div>

                                          {!!formKey && (
                                            <span
                                              style={{
                                                fontSize: 11,
                                                fontWeight: 950,
                                                padding: "4px 8px",
                                                borderRadius: 999,
                                                border: "1px solid rgba(255,255,255,0.18)",
                                                background:
                                                  "linear-gradient(135deg, rgba(161,76,255,0.35), rgba(255,76,160,0.18))",
                                                boxShadow: "0 0 18px rgba(161,76,255,0.28)",
                                                lineHeight: 1,
                                              }}
                                              title="Form aus der Encounter-Tabelle"
                                            >
                                              {formBadgeLabel(formKey)}
                                            </span>
                                          )}
                                        </div>

                                        <div className="team-type-row" style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                                          {types.map((type) => (
                                            <img
                                              key={type}
                                              className="team-type-icon"
                                              src={typeIconUrl(type)}
                                              alt={type}
                                              title={type}
                                              style={{
                                                width: 36,
                                                height: 36,
                                                opacity: 0.98,
                                                borderRadius: 10,
                                                padding: 5,
                                                background: "rgba(0,0,0,0.35)",
                                                border: "1px solid rgba(255,255,255,0.12)",
                                                boxShadow: "0 6px 14px rgba(0,0,0,0.35)",
                                                display: "block",
                                              }}
                                              onError={(e) => {
                                                e.currentTarget.style.display = "none";
                                              }}
                                            />
                                          ))}
                                        </div>
                                      </div>
                                    </div>
                                  ) : (
                                    <div style={{ opacity: 0.65 }}>-leer-</div>
                                  )}
                                </li>
                              )}
                            </Draggable>
                          );
                        })}
                        {provided.placeholder}
                      </ul>
                    )}
                  </Droppable>
                </DragDropContext>
              </div>

                            <div className="team-glass-card team-box-card" style={glassCard}>
                <h3 style={{ marginTop: 0 }}>Box {i + 1}</h3>
                <div className="team-pokebox-list" style={pokeboxList}>
                  {linkedBoxRows.map((row, rowIndex) => {
                    const p = row.names[i] || "";

                    if (!p) {
                      return (
                        <div
                          key={`box-empty-${i}-${rowIndex}`}
                          style={{
                            ...pokeboxItem,
                            opacity: 0.22,
                            cursor: "default",
                          }}
                        />
                      );
                    }

                    const dexId = getDexIdFromName(p, fullDex);
                    const formKey = formByName[p] || "";
                    const formId = dexId ? getFormIdFor(dexId, formKey) : null;
                    const idToUse = formId || dexId;

                    const imgUrl = idToUse
                      ? formId
                        ? `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${idToUse}.png`
                        : `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${idToUse}.png`
                      : null;

                    return (
                      <button
                        key={`box-${i}-${rowIndex}-${p}`}
                        onClick={() => handlePokemonPrimaryClick(i, p)}
                        onTouchStart={() => startPokemonLongPress(idToUse)}
                        onTouchMove={clearPokemonLongPressTimer}
                        onTouchEnd={clearPokemonLongPressTimer}
                        onTouchCancel={clearPokemonLongPressTimer}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          openPokemonInfo(idToUse);
                        }}
                        title={`${rowIndex + 1}. ${p}${row.route ? ` - ${row.route}` : ""} | Klick: ins Team | Gedrückt halten/Rechtsklick: Pokédex`}
                        className="pokeboxItemStatic team-pokebox-item"
                        style={pokeboxItem}
                      >
                        {imgUrl ? (
                          <img
                            src={imgUrl}
                            alt={p}
                            className="pokeboxImgStatic"
                            onError={(e) => {
                              if (idToUse) {
                                e.currentTarget.src = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${idToUse}.png`;
                              }
                            }}
                          />
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          ))}
        </div>
        {analysisModal.open && (() => {
  const analysis = teamAnalysis[analysisModal.teamIndex];
  if (!analysis) return null;

  return (
    <div
      style={modalOverlay}
      onClick={() => setAnalysisModal({ open: false, teamIndex: 0 })}
    >
      <div
  className="analysisModalScroll"
  style={modalCardWide}
  onClick={(e) => e.stopPropagation()}
>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 12,
            alignItems: "center",
          }}
        >
          <h3 style={{ marginTop: 0, marginBottom: 0 }}>
            Analyse für Team {analysisModal.teamIndex + 1}
          </h3>

          <button
            style={btnModalCancel}
            onClick={() => setAnalysisModal({ open: false, teamIndex: 0 })}
          >
            Schließen
          </button>
        </div>

        {!analysis.members.length ? (
          <p style={{ marginTop: 18, color: "rgba(255,255,255,0.88)" }}>
            Für dieses Team sind noch keine Typdaten vorhanden oder das Team ist leer.
          </p>
        ) : (
          <>
            <div style={{ marginTop: 18 }}>
  <div style={{ fontWeight: 900, marginBottom: 10 }}>
    Besonders gefährlich gegen dich
  </div>

  <div style={analysisTable}>
    <div style={analysisTableHeader}>
      <div></div>
      <div>4x</div>
      <div>2x</div>
      <div>0.5x</div>
      <div>0.25x</div>
      <div>0x</div>
    </div>

    {analysis.dangerousTypes.length ? (
      analysis.dangerousTypes.map((row) => (
        <div key={`danger-${row.attackType}`} style={analysisTableRowDanger}>
          <div style={{ fontWeight: 900, textAlign: "left" }}>{typeLabelDe(row.attackType)}</div>
          <div>{row.x4Count}</div>
          <div>{row.x2Count}</div>
          <div>{row.x05Count}</div>
          <div>{row.x025Count}</div>
          <div>{row.x0Count}</div>
        </div>
      ))
    ) : (
      <div style={{ opacity: 0.8 }}>
        Keine auffälligen Gesamt-Schwächen gefunden.
      </div>
    )}
  </div>
</div>

            <div style={{ marginTop: 18 }}>
  <div style={{ fontWeight: 900, marginBottom: 10 }}>
    Was dein Team gut abfängt
  </div>

  <div style={analysisTable}>
    <div style={analysisTableHeader}>
      <div></div>
      <div>4x</div>
      <div>2x</div>
      <div>0.5x</div>
      <div>0.25x</div>
      <div>0x</div>
    </div>

    {analysis.safeTypes.length ? (
      analysis.safeTypes.map((row) => (
        <div key={`safe-${row.attackType}`} style={analysisTableRowSafe}>
          <div style={{ fontWeight: 900, textAlign: "left" }}>{typeLabelDe(row.attackType)}</div>
          <div>{row.x4Count}</div>
          <div>{row.x2Count}</div>
          <div>{row.x05Count}</div>
          <div>{row.x025Count}</div>
          <div>{row.x0Count}</div>
        </div>
      ))
    ) : (
      <div style={{ opacity: 0.8 }}>
        Noch keine starken Resistenzen erkannt.
      </div>
    )}
  </div>
</div>

            <div style={{ marginTop: 18 }}>
              <div style={{ fontWeight: 900, marginBottom: 10 }}>Pro Pokémon</div>
              <div style={{ display: "grid", gap: 12 }}>
                {analysis.perPokemon.map((mon) => (
                  <div key={`analysis-mon-${mon.name}`} style={analysisMonCard}>
                    <div style={{ fontWeight: 900, marginBottom: 6 }}>{mon.name}</div>

                    <div style={{ fontSize: 13, opacity: 0.92, marginBottom: 6 }}>
                      Typen: {mon.types.map((t) => typeLabelDe(t)).join(" / ")}
                    </div>

                    <div style={{ fontSize: 13, marginBottom: 4 }}>
                      <strong>Schwächen:</strong>{" "}
                      {mon.weaknesses.length
                        ? mon.weaknesses
                            .map((w) => `${typeLabelDe(w.attackType)} (${multiplierLabel(w.multiplier)})`)
                            .join(", ")
                        : "keine"}
                    </div>

                    <div style={{ fontSize: 13 }}>
                      <strong>Resistenzen/Immunitäten:</strong>{" "}
                      {mon.resistances.length
                        ? mon.resistances
                            .map((r) => `${typeLabelDe(r.attackType)} (${multiplierLabel(r.multiplier)})`)
                            .join(", ")
                        : "keine"}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
})()}
        {showHardResetModal && (
          <div style={modalOverlay}>
            <div style={modalCard}>
              <h3 style={{ marginTop: 0, marginBottom: 10 }}>
                Team wirklich zurücksetzen?
              </h3>

              <p style={{ marginTop: 0, marginBottom: 18, lineHeight: 1.5, color: "rgba(255,255,255,0.88)" }}>
                Alle Pokemon werden aus dem Team entfernt.
                <br />
                Die Encounter-Liste und Box bleiben erhalten.
              </p>

              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: 10,
                  flexWrap: "wrap",
                }}
              >
                <button style={btnModalCancel} onClick={closeHardResetModal}>
                  Abbrechen
                </button>

                <button style={btnModalDanger} onClick={hardResetAllTeams}>
                  Ja, Team leeren
                </button>
              </div>
            </div>
          </div>
        )}

        <div style={{ height: 22 }} />
        <div style={{ height: 22 }} />
      </div>
    </div>
  );
}

export default TeamManager;

/* =======================
   Styles
======================= */

const page = {
  minHeight: "100vh",
  position: "relative",
  overflowX: "hidden",
  background: "#050914",
};

const bg = {
  position: "fixed",
  inset: 0,
  backgroundImage: `url("/backgrounds/background_5.png")`,
  backgroundSize: "cover",
  backgroundPosition: "center",
  backgroundRepeat: "no-repeat",
  transform: "scale(1.03)",
  zIndex: 0,
  filter: "saturate(1.05) brightness(0.78)",
};

const overlay = {
  position: "fixed",
  inset: 0,
  zIndex: 1,
  background:
    "radial-gradient(900px 520px at 18% 8%, rgba(66, 153, 225, 0.16), transparent 62%), radial-gradient(760px 520px at 84% 12%, rgba(67, 233, 123, 0.11), transparent 64%), linear-gradient(180deg, rgba(3, 7, 18, 0.55), rgba(3, 7, 18, 0.86))",
};

const content = {
  position: "relative",
  zIndex: 2,
  padding: "22px 18px",
  color: "white",
};

const topBar = {
  width: "min(1200px, 96vw)",
  margin: "0 auto 12px auto",
  padding: "12px 14px",
  borderRadius: 18,
  border: "1px solid rgba(180, 205, 255, 0.14)",
  background:
    "linear-gradient(145deg, rgba(15, 23, 42, 0.68), rgba(5, 9, 20, 0.56))",
  backdropFilter: "blur(14px)",
  boxShadow:
    "0 18px 46px rgba(0, 0, 0, 0.28), inset 0 1px 0 rgba(255, 255, 255, 0.08)",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
};

const headerCard = {
  width: "min(1200px, 96vw)",
  margin: "0 auto 16px auto",
  padding: 18,
  borderRadius: 24,
  border: "1px solid rgba(180, 205, 255, 0.14)",
  background:
    "linear-gradient(145deg, rgba(15, 23, 42, 0.76), rgba(5, 9, 20, 0.66))",
  backdropFilter: "blur(14px)",
  boxShadow:
    "0 30px 90px rgba(0, 0, 0, 0.42), inset 0 1px 0 rgba(255, 255, 255, 0.10)",
};

const teamsWrap = {
  width: "min(1200px, 96vw)",
  margin: "0 auto",
  display: "flex",
  flexWrap: "wrap",
  gap: "1.2rem",
  justifyContent: "center",
  alignItems: "flex-start",
};

const teamCol = {
  width: "min(520px, 96vw)",
  display: "grid",
  gap: 14,
};

const glassCard = {
  padding: 16,
  borderRadius: 22,
  border: "1px solid rgba(180, 205, 255, 0.13)",
  background:
    "linear-gradient(145deg, rgba(15, 23, 42, 0.62), rgba(5, 10, 24, 0.50))",
  backdropFilter: "blur(14px)",
  boxShadow:
    "0 24px 70px rgba(0, 0, 0, 0.34), inset 0 1px 0 rgba(255, 255, 255, 0.08)",
};

const teamList = {
  listStyle: "none",
  padding: 0,
  margin: 0,
  display: "grid",
  gap: 10,
};

const teamSlot = {
  borderRadius: 16,
  border: "1px solid rgba(180, 205, 255, 0.12)",
  background:
    "linear-gradient(135deg, rgba(10, 18, 36, 0.58), rgba(5, 9, 20, 0.50))",
  padding: 10,
  boxShadow: "inset 0 1px 0 rgba(255, 255, 255, 0.06)",
};

const slotContent = {
  display: "flex",
  alignItems: "center",
  gap: 12,
};

const pokeboxList = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(64px, 1fr))",
  gap: 10,
};

const pokeboxItem = {
  width: "100%",
  aspectRatio: "1 / 1",
  borderRadius: 16,
  border: "1px solid rgba(180, 205, 255, 0.12)",
  background:
    "linear-gradient(135deg, rgba(10, 18, 36, 0.52), rgba(5, 9, 20, 0.42))",
  padding: 6,
  cursor: "pointer",
  boxShadow: "inset 0 1px 0 rgba(255, 255, 255, 0.06)",
};

const btnGreen = {
  padding: "10px 14px",
  borderRadius: 14,
  border: "1px solid rgba(255,255,255,0.14)",
  background: "linear-gradient(135deg, rgba(67,233,123,0.30), rgba(56,249,215,0.16))",
  color: "white",
  cursor: "pointer",
  fontWeight: 950,
};

const btnGhost = {
  padding: "10px 14px",
  borderRadius: 14,
  border: "1px solid rgba(255,255,255,0.14)",
  background: "rgba(255,255,255,0.06)",
  color: "white",
  cursor: "pointer",
  fontWeight: 950,
};

const btnDanger = {
  padding: "10px 14px",
  borderRadius: 14,
  border: "1px solid rgba(255,255,255,0.14)",
  background: "linear-gradient(135deg, rgba(220,38,38,0.40), rgba(127,29,29,0.24))",
  color: "white",
  cursor: "pointer",
  fontWeight: 950,
};

const modalOverlay = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.62)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 16,
  zIndex: 9999,
};

const modalCard = {
  width: "min(460px, 92vw)",
  borderRadius: 20,
  border: "1px solid rgba(255,255,255,0.14)",
  background: "rgba(14,14,22,0.96)",
  backdropFilter: "blur(10px)",
  boxShadow: "0 24px 70px rgba(0,0,0,0.55)",
  padding: 20,
  color: "white",
};

const modalCardWide = {
  width: "min(780px, 96vw)",
  maxHeight: "85vh",
  overflowY: "auto",
  borderRadius: 20,
  border: "1px solid rgba(255,255,255,0.14)",
  background: "rgba(14,14,22,0.96)",
  backdropFilter: "blur(10px)",
  boxShadow: "0 24px 70px rgba(0,0,0,0.55)",
  padding: 20,
  color: "white",
};

const analysisMonCard = {
  padding: 12,
  borderRadius: 14,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(255,255,255,0.04)",
};

const analysisTable = {
  display: "grid",
  gap: 6,
};

const analysisTableHeader = {
  display: "grid",
  gridTemplateColumns: "1.2fr repeat(5, 0.8fr)",
  fontSize: 12,
  opacity: 0.7,
  padding: "0 6px",
  textAlign: "center",
  alignItems: "center",
};

const analysisTableRowDanger = {
  display: "grid",
  gridTemplateColumns: "1.2fr repeat(5, 0.8fr)",
  padding: "10px 12px",
  borderRadius: 12,
  background: "rgba(220,38,38,0.16)",
  border: "1px solid rgba(220,38,38,0.28)",
  textAlign: "center",
  alignItems: "center",
};

const analysisTableRowSafe = {
  display: "grid",
  gridTemplateColumns: "1.2fr repeat(5, 0.8fr)",
  padding: "10px 12px",
  borderRadius: 12,
  background: "rgba(34,197,94,0.14)",
  border: "1px solid rgba(34,197,94,0.24)",
  textAlign: "center",
  alignItems: "center",
};

const btnModalCancel = {
  padding: "10px 14px",
  borderRadius: 14,
  border: "1px solid rgba(255,255,255,0.14)",
  background: "rgba(255,255,255,0.07)",
  color: "white",
  cursor: "pointer",
  fontWeight: 900,
};

const btnModalDanger = {
  padding: "10px 14px",
  borderRadius: 14,
  border: "1px solid rgba(255,255,255,0.14)",
  background: "linear-gradient(135deg, rgba(220,38,38,0.95), rgba(127,29,29,0.92))",
  color: "white",
  cursor: "pointer",
  fontWeight: 950,
};