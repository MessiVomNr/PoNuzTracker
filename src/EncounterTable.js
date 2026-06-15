// src/EncounterTable.jsx (oder wo deine EncounterTable aktuell liegt)
import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import CreatableSelect from "react-select/creatable";
import { versionToPokedex } from "./data/versionToPokedex";
import editionData from "./data/editionData.js";
import { getGenFromEdition } from "./utils/editionHelpers";
import * as allLocations from "./locations/index.js";
import { useDuoSave } from "./duo/useDuoSave";
import RunTitleBar from "./duo/RunTitleBar";
import { updateDuoSave } from "./duo/duoService";
import { upsertRecentRoom } from "./duo/recentRooms";
import levelCapsByGen from "./guides/level_caps";
import { getFossilPoolForRunGen } from "./data/fossilsByGen";
import { evolutionFamiliesByDex } from "./data/evolutionFamilies";
import GeflohenIconImg from "./assets/Geflohen.png";
import PokeballIconImg from "./assets/Pokeball.png";
import BesiegtIconImg from "./assets/Besiegt.png";

function getDexIdFromName(pokemonName, pokedex) {
  const entry = Object.entries(pokedex).find(([, name]) => name === pokemonName);
  if (!entry) return null;
  return entry[0].replace("pokedex", "");
}

function getFamilyDexIds(dexId) {
  const id = Number(dexId);
  if (!id) return [];
  return evolutionFamiliesByDex[id] || [id];
}

function PencilIcon({ size = 18 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      aria-hidden="true"
      focusable="false"
      style={{
        display: "block",
        filter:
          "drop-shadow(0 2px 5px rgba(0, 0, 0, 0.35)) drop-shadow(0 0 8px rgba(160, 190, 255, 0.14))",
      }}
    >
      <path
        d="M43.5 8.5L55.5 20.5L24.5 51.5L10.5 55.5L14.5 41.5L43.5 8.5Z"
        fill="rgba(255, 255, 255, 0.96)"
        stroke="rgba(220, 235, 255, 0.96)"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      <path
        d="M38.5 14.5L49.5 25.5"
        fill="none"
        stroke="rgba(82, 122, 190, 0.72)"
        strokeWidth="3.5"
        strokeLinecap="round"
      />
      <path
        d="M14.5 41.5L24.5 51.5"
        fill="none"
        stroke="rgba(82, 122, 190, 0.72)"
        strokeWidth="3.5"
        strokeLinecap="round"
      />
      <path
        d="M10.5 55.5L15.3 43.5L22.5 50.7L10.5 55.5Z"
        fill="rgba(67, 233, 123, 0.92)"
        stroke="rgba(210, 255, 230, 0.88)"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path
        d="M43.5 8.5L55.5 20.5L59 17C61 15 61 11.8 59 9.8L54.2 5C52.2 3 49 3 47 5L43.5 8.5Z"
        fill="rgba(255, 145, 88, 0.95)"
        stroke="rgba(255, 224, 205, 0.86)"
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const STATUS_ICON_MAP = {
  Gefangen: {
    src: PokeballIconImg,
    alt: "Gefangen",
  },
  Besiegt: {
    src: BesiegtIconImg,
    alt: "Besiegt",
  },
  Entkommen: {
    src: GeflohenIconImg,
    alt: "Geflohen",
  },
};

function StatusIcon({ status, size = 22, style = {} }) {
  const entry = STATUS_ICON_MAP[status];
  if (!entry) return null;

  return (
    <img
      src={entry.src}
      alt={entry.alt}
      style={{
        width: size,
        height: size,
        objectFit: "contain",
        display: "block",
        flexShrink: 0,
        ...style,
      }}
    />
  );
}
// ===== Spezial-Formen (PokeAPI IDs / Anzeigeoptionen) =====
// formKey wird in encounters als form1/form2/form3 gespeichert
// Beispiele:
// "" | "mega" | "mega-x" | "mega-y"
// "" | "heat" | "wash" | "frost" | "fan" | "mow"
const SPECIAL_FORM_IDS = {
  // ===== Mega-Formen =====
  // Gen 1
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

  // Gen 2
  181: { mega: 10045 },
  208: { mega: 10072 },
  212: { mega: 10046 },
  214: { mega: 10047 },
  229: { mega: 10048 },
  248: { mega: 10049 },

  // Gen 3
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

  // Gen 4
  380: { mega: 10062 },
  381: { mega: 10063 },
  445: { mega: 10058 },
  448: { mega: 10059 },
  460: { mega: 10060 },

  // Gen 5
  531: { mega: 10061 },

  // Gen 6
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

  // ===== NEU Gen 5 Zusatz =====
  647: { resolute: 10024 }, // Keldeo

  // ===== Gen 6 =====
  718: { "10": 10025, complete: 10026 }, // Zygarde

  // ===== Gen 7 =====
  681: { blade: 10027 }, // Aegislash
  745: { midnight: 10029, dusk: 10030 }, // Wolwerock
  746: { school: 10031 }, // Lusardin
  800: { "dusk-mane": 10155, "dawn-wings": 10156, ultra: 10157 }, // Necrozma
  720: { unbound: 10086 }, // Hoopa

  // ===== Gen 8 =====
  898: {
    "ice-rider": 10191,
    "shadow-rider": 10192,
  }, // Calyrex

  // ===== Gen 9 =====
  964: { hero: 10256 }, // Palafin
  1017: {
    wellspring: 10273,
    hearthflame: 10274,
    cornerstone: 10275,
  }, // Ogerpon
};

const SPECIAL_FORM_OPTIONS = {
  3: ["mega"],
  6: ["mega-x", "mega-y"],
  9: ["mega"],
  15: ["mega"],
  18: ["mega"],
  65: ["mega"],
  80: ["mega"],
  94: ["mega"],
  115: ["mega"],
  127: ["mega"],
  130: ["mega"],
  142: ["mega"],
  150: ["mega-x", "mega-y"],
  181: ["mega"],
  208: ["mega"],
  212: ["mega"],
  214: ["mega"],
  229: ["mega"],
  248: ["mega"],
  254: ["mega"],
  257: ["mega"],
  260: ["mega"],
  282: ["mega"],
  303: ["mega"],
  306: ["mega"],
  308: ["mega"],
  310: ["mega"],
  319: ["mega"],
  323: ["mega"],
  334: ["mega"],
  354: ["mega"],
  359: ["mega"],
  362: ["mega"],
  373: ["mega"],
  376: ["mega"],
  380: ["mega"],
  381: ["mega"],
  445: ["mega"],
  448: ["mega"],
  460: ["mega"],
  531: ["mega"],
  719: ["mega"],

  351: ["sunny", "rainy", "snowy"],
  386: ["attack", "defense", "speed"],
  413: ["sandy", "trash"],
  421: ["sunshine"],
  479: ["heat", "wash", "frost", "fan", "mow"],
  487: ["origin"],
  492: ["sky"],
  550: ["blue"],
  555: ["zen"],
  641: ["therian"],
  642: ["therian"],
  645: ["therian"],
  646: ["white", "black"],
  648: ["pirouette"],

  647: ["resolute"],
  718: ["10", "complete"],

  681: ["blade"],
  745: ["midnight", "dusk"],
  746: ["school"],
  800: ["dusk-mane", "dawn-wings", "ultra"],
  720: ["unbound"],

  898: ["ice-rider", "shadow-rider"],

  964: ["hero"],
  1017: ["wellspring", "hearthflame", "cornerstone"],
};

function addSpecialForm(baseDexId, formKey, formPokemonId) {
  const id = Number(baseDexId);
  if (!id || !formKey || !formPokemonId) return;

  SPECIAL_FORM_IDS[id] = {
    ...(SPECIAL_FORM_IDS[id] || {}),
    [formKey]: formPokemonId,
  };

  const oldOptions = SPECIAL_FORM_OPTIONS[id] || [];
  if (!oldOptions.includes(formKey)) {
    SPECIAL_FORM_OPTIONS[id] = [...oldOptions, formKey];
  }
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

function getFormOptionsForDexId(dexId) {
  const id = Number(dexId);
  return SPECIAL_FORM_OPTIONS[id] || [];
}

function nextSpecialForm(current, options) {
  if (!options.length) return "";
  const idx = options.indexOf(current);
  if (!current || idx === -1) return options[0];
  if (idx === options.length - 1) return "";
  return options[idx + 1];
}

function formLabel(formKey) {
  if (!formKey) return "Normal";

  // ===== Mega / Proto =====
  if (formKey === "mega") return "Mega";
  if (formKey === "mega-x") return "Mega X";
  if (formKey === "mega-y") return "Mega Y";
  if (formKey === "primal") return "Proto";

  // ===== Regionalformen =====
  if (formKey === "alola") return "Alola";
  if (formKey === "galar") return "Galar";
  if (formKey === "galar-zen") return "Galar Zen";
  if (formKey === "hisui") return "Hisui";
  if (formKey === "paldea") return "Paldea";
  if (formKey === "paldea-combat") return "Paldea Kampf";
  if (formKey === "paldea-blaze") return "Paldea Feuer";
  if (formKey === "paldea-aqua") return "Paldea Wasser";

  // ===== Rotom =====
  if (formKey === "heat") return "Feuer";
  if (formKey === "wash") return "Wasser";
  if (formKey === "frost") return "Eis";
  if (formKey === "fan") return "Flug";
  if (formKey === "mow") return "Pflanze";

  // ===== Deoxys =====
  if (formKey === "attack") return "Angriff";
  if (formKey === "defense") return "Verteid.";
  if (formKey === "speed") return "Initiative";

  // ===== Wormadam =====
  if (formKey === "sandy") return "Sand";
  if (formKey === "trash") return "Lumpen";

  // ===== Cherrim =====
  if (formKey === "sunshine") return "Sonne";

  // ===== Giratina / Shaymin =====
  if (formKey === "origin") return "Urform";
  if (formKey === "sky") return "Zenit";

  // ===== Darmanitan / Meloetta / Genie =====
  if (formKey === "zen") return "Trance";
  if (formKey === "pirouette") return "Pirouette";
  if (formKey === "therian") return "Tiergeist";

  // ===== Kyurem =====
  if (formKey === "white") return "Weiss";
  if (formKey === "black") return "Schwarz";

  // ===== Castform =====
  if (formKey === "sunny") return "Sonne";
  if (formKey === "rainy") return "Regen";
  if (formKey === "snowy") return "Schnee";

  // ===== Basculin =====
  if (formKey === "blue") return "Blau";

  // ===== Keldeo =====
  if (formKey === "resolute") return "Resolut";

  // ===== Zygarde =====
  if (formKey === "10") return "10%";
  if (formKey === "complete") return "Komplett";

  // ===== Aegislash =====
  if (formKey === "blade") return "Klinge";

  // ===== Lycanroc =====
  if (formKey === "midnight") return "Mitternacht";
  if (formKey === "dusk") return "Abend";

  // ===== Wishiwashi =====
  if (formKey === "school") return "Schwarm";

  // ===== Necrozma =====
  if (formKey === "dusk-mane") return "Abendmähne";
  if (formKey === "dawn-wings") return "Morgenschwingen";
  if (formKey === "ultra") return "Ultra";

  // ===== Hoopa =====
  if (formKey === "unbound") return "Entfesselt";

  // ===== Calyrex =====
  if (formKey === "ice-rider") return "Eisreiter";
  if (formKey === "shadow-rider") return "Schattenreiter";

  // ===== Palafin =====
  if (formKey === "hero") return "Held";

  // ===== Ogerpon =====
  if (formKey === "wellspring") return "Quellmaske";
  if (formKey === "hearthflame") return "Flammenmaske";
  if (formKey === "cornerstone") return "Felsmaske";

  return "Form";
}

function getFormIdFor(dexId, formKey) {
  const baseId = Number(dexId);
  if (!baseId || !formKey) return null;
  const forms = SPECIAL_FORM_IDS[baseId];
  if (!forms) return null;
  return forms[formKey] || null;
}

function spriteUrlFor(dexId, formKey) {
  const baseId = Number(dexId);
  if (!baseId) return null;

  const formId = getFormIdFor(baseId, formKey);
  const idToUse = formId || baseId;

  return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${idToUse}.png`;
}

function formatLastActive(ms) {
  if (!ms) return "unbekannt";
  const diff = Date.now() - ms;
  const sec = Math.floor(diff / 1000);
  if (sec < 10) return "gerade eben";
  if (sec < 60) return `vor ${sec}s`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `vor ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `vor ${h} h`;
  const d = Math.floor(h / 24);
  return `vor ${d} d`;
}

function normalizeSlotNames(arr, count) {
  const a = Array.isArray(arr) ? [...arr] : [];
  while (a.length < count) a.push("");
  if (a.length > count) a.length = count;
  return a;
}

function isFossilLocation(loc) {
  return /^Fossil-\d+/.test(String(loc || "").trim());
}

function fossilFieldForSlot(slotIndex) {
  // slotIndex 0..2
  return `fossil${slotIndex + 1}`; // fossil1 / fossil2 / fossil3
}

function EncounterCustomSelect({
  value,
  options,
  onChange,
  disabled = false,
  placeholder = "-",
  className = "",
  dotPrefix = "encounter-status-dot",
  showDot = true,
}) {
  const [open, setOpen] = useState(false);

  const safeOptions = Array.isArray(options) && options.length
    ? options
    : [{ value: "", label: placeholder }];

  const selected =
    safeOptions.find((opt) => String(opt.value) === String(value)) ||
    safeOptions[0];

  return (
    <div
      className={[
        "encounter-custom-select",
        open ? "encounter-custom-select-open" : "",
        disabled ? "encounter-custom-select-disabled" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      tabIndex={-1}
      onBlur={() => {
        window.setTimeout(() => setOpen(false), 120);
      }}
    >
      <button
        type="button"
        disabled={disabled}
        className={[
          "encounter-custom-select-trigger",
          open ? "encounter-custom-select-trigger-open" : "",
        ]
          .filter(Boolean)
          .join(" ")}
        onClick={() => {
          if (disabled) return;
          setOpen((prev) => !prev);
        }}
      >
        <span className="encounter-custom-select-label">
          {showDot && (
            <span
              className={[
                "encounter-custom-select-dot",
                `${dotPrefix}-${selected.value || "empty"}`,
              ].join(" ")}
            />
          )}

          <span className="encounter-custom-select-text">{selected.label}</span>
        </span>

        <span className="encounter-custom-select-arrow" />
      </button>

      {open && !disabled && (
        <div className="encounter-custom-select-menu">
          {safeOptions.map((opt) => (
            <button
              key={opt.value || "empty"}
              type="button"
              className={[
                "encounter-custom-select-option",
                String(opt.value) === String(value)
                  ? "encounter-custom-select-option-active"
                  : "",
              ]
                .filter(Boolean)
                .join(" ")}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onChange(opt.value);
                setOpen(false);
              }}
            >
              <span className="encounter-custom-select-label">
                {showDot && (
                  <span
                    className={[
                      "encounter-custom-select-dot",
                      `${dotPrefix}-${opt.value || "empty"}`,
                    ].join(" ")}
                  />
                )}

                <span className="encounter-custom-select-text">{opt.label}</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function EncounterStatusSelect({ value, allFilled, onChange }) {
  const options = useMemo(() => {
    const next = [{ value: "", label: "-" }];

    if (allFilled) {
      next.push({ value: "Gefangen", label: "Gefangen" });
      next.push({ value: "Besiegt", label: "Besiegt" });
    }

    next.push({ value: "Entkommen", label: "Entkommen" });

    return next;
  }, [allFilled]);

  return (
    <EncounterCustomSelect
      value={value}
      options={options}
      onChange={onChange}
      className="encounter-status-select"
      dotPrefix="encounter-status-dot"
    />
  );
}

function EncounterSinnerSelect({ value, disabled, options, onChange }) {
  const selectOptions = useMemo(() => {
    if (disabled) return [{ value: "", label: "—" }];

    return [
      { value: "", label: "-" },
      ...options.map((opt) => ({
        value: opt.key,
        label: opt.label,
      })),
    ];
  }, [disabled, options]);

  return (
    <EncounterCustomSelect
      value={disabled ? "" : value}
      options={selectOptions}
      onChange={onChange}
      disabled={disabled}
      className="encounter-sinner-select"
      dotPrefix="encounter-sinner-dot"
      showDot={false}
    />
  );
}

function EncounterTable() {
  const navigate = useNavigate();

  // ===== Duo/Online State =====
  const activeDuoRoomId = (localStorage.getItem("activeDuoRoomId") || "").trim().toUpperCase();
  const { room: duoRoom, save: duoSave, patchSave: patchDuoSave, error: duoError } = useDuoSave(activeDuoRoomId);
  const isDuo = !!activeDuoRoomId;

  // ===== Local Save State =====
  const activeSave = localStorage.getItem("activeSave");
  const savegames = JSON.parse(localStorage.getItem("savegames") || "{}");
  const currentSave = activeSave ? savegames[activeSave] : null;

  // ===== Effective meta (Duo prefers Firestore) =====
  const effectiveEdition = isDuo ? (duoSave?.edition || "Rot") : (currentSave?.edition || "Alpha Saphir");
  const effectiveLinkMode = isDuo ? (duoSave?.linkMode || "duo") : (currentSave?.linkMode || "solo");
  const slotCount = effectiveLinkMode === "trio" ? 3 : effectiveLinkMode === "duo" ? 2 : 1;

  // ===== Presence (online users) =====
  const presence = useMemo(() => {
    const playersObj = duoRoom?.players;
    if (!playersObj || typeof playersObj !== "object") return { online: [], all: [] };

    const all = Object.values(playersObj)
      .filter(Boolean)
      .map((p) => ({
        uid: p.uid || "",
        name: (p.displayName || "Spieler").trim(),
        online: !!p.online,
        lastActiveAtMs: p.lastActiveAtMs || 0,
      }))
      .sort((a, b) => (b.lastActiveAtMs || 0) - (a.lastActiveAtMs || 0));

    const online = all.filter((p) => p.online || (p.lastActiveAtMs && Date.now() - p.lastActiveAtMs < 60000));
    return { online, all };
  }, [duoRoom]);

  const gen = getGenFromEdition(effectiveEdition);
  const genData = editionData[effectiveEdition] || null;
  const pokedex = versionToPokedex[effectiveEdition] || {};

// WICHTIG:
// 1. Erst editionsspezifische Locations aus editionData nehmen
// 2. Nur wenn dort nichts hinterlegt ist, auf locationsGen{gen} zurückfallen
  const locationList =
    genData?.locations ||
    allLocations[`locationsGen${gen}`] ||
    [];

const pokemonList = Object.values(pokedex);
const nameToDexId = useMemo(() => {
  const map = new Map();
  Object.entries(pokedex || {}).forEach(([key, name]) => {
    if (!name) return;
    const dexId = Number(String(key).replace("pokedex", ""));
    if (dexId) map.set(name, dexId);
  });
  return map;
}, [pokedex]);
  // ===== Level-Cap (aus GuidePage-Checklist) =====
  const levelCaps = levelCapsByGen[gen] || [];

  const levelCapsProgressKey = useMemo(() => {
    if (!gen) return "";
    if (isDuo) return `guidecheck_duo_${activeDuoRoomId}_gen_${gen}`;
    return `guidecheck_save_${activeSave}_gen_${gen}`;
  }, [isDuo, activeDuoRoomId, activeSave, gen]);

  const idForLevelCap = (cap) => `${cap.order}|${cap.name}|${cap.level}`;

  function readLevelCapProgress() {
    if (!levelCapsProgressKey) return { levelcaps: [] };
    try {
      const raw = localStorage.getItem(levelCapsProgressKey);
      const parsed = raw ? JSON.parse(raw) : {};
      const arr = Array.isArray(parsed?.levelcaps) ? parsed.levelcaps : [];
      return { ...parsed, levelcaps: arr };
    } catch {
      return { levelcaps: [] };
    }
  }

  function writeLevelCapProgress(nextObj) {
    if (!levelCapsProgressKey) return;
    try {
      localStorage.setItem(levelCapsProgressKey, JSON.stringify(nextObj));
    } catch {
      // ignore
    }
  }

  const [currentLevelCap, setCurrentLevelCap] = useState(null); // { order, name, location, level }

  const computeCurrentLevelCap = () => {
    if (!gen || !levelCaps.length) return null;
    try {
      const progress = readLevelCapProgress();
      const done = new Set(progress.levelcaps || []);

      const next = levelCaps.find((cap) => !done.has(idForLevelCap(cap)));
      return next || levelCaps[levelCaps.length - 1];
    } catch {
      return levelCaps[0] || null;
    }
  };

  const markNextLevelCapDone = () => {
    if (!levelCaps.length) return;

    const cur = computeCurrentLevelCap();
    if (!cur) return;

    const progress = readLevelCapProgress();
    const done = Array.isArray(progress.levelcaps) ? [...progress.levelcaps] : [];
    const id = idForLevelCap(cur);

    if (!done.includes(id)) done.push(id);
    writeLevelCapProgress({ ...progress, levelcaps: done });

    // UI aktualisieren
    setCurrentLevelCap(computeCurrentLevelCap());
  };

  const undoLastLevelCap = () => {
    if (!levelCaps.length) return;

    const progress = readLevelCapProgress();
    const doneArr = Array.isArray(progress.levelcaps) ? progress.levelcaps : [];
    const doneSet = new Set(doneArr);

    // letztes DONE (höchste order)
    const lastDone = [...levelCaps].reverse().find((cap) => doneSet.has(idForLevelCap(cap)));
    if (!lastDone) return;

    const id = idForLevelCap(lastDone);
    const nextArr = doneArr.filter((x) => x !== id);

    writeLevelCapProgress({ ...progress, levelcaps: nextArr });
    setCurrentLevelCap(computeCurrentLevelCap());
  };

  useEffect(() => {
    setCurrentLevelCap(computeCurrentLevelCap());

    const onStorage = (e) => {
      if (!e.key) return;
      if (e.key === levelCapsProgressKey) setCurrentLevelCap(computeCurrentLevelCap());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [gen, levelCapsProgressKey, levelCaps.length]);

  // ✅ Hotkeys via GlobalEscapeMenu (K/L) -> custom events
  useEffect(() => {
    const onNext = () => markNextLevelCapDone();
    const onPrev = () => undoLastLevelCap();

    window.addEventListener("appLevelCapNext", onNext);
    window.addEventListener("appLevelCapPrev", onPrev);
    return () => {
      window.removeEventListener("appLevelCapNext", onNext);
      window.removeEventListener("appLevelCapPrev", onPrev);
    };
  }, [levelCapsProgressKey, levelCaps.length, gen]);

  // ===== Slot-Namen =====
  const [slotNames, setSlotNames] = useState(() =>
    normalizeSlotNames(isDuo ? duoSave?.slotNames : currentSave?.slotNames, slotCount)
  );

  useEffect(() => {
    setSlotNames(normalizeSlotNames(isDuo ? duoSave?.slotNames : currentSave?.slotNames, slotCount));
  }, [isDuo, duoSave, activeSave, slotCount]);

  const editSlotName = (index) => {
  const current = (slotNames[index] || "").trim();
  setSlotNameModal({
    open: true,
    index,
    value: current,
  });
};
const saveSlotName = async () => {
  const index = slotNameModal.index;
  if (index === null || index === undefined) {
    setSlotNameModal({ open: false, index: null, value: "" });
    return;
  }

  const cleaned = String(slotNameModal.value || "").trim();
  const updated = normalizeSlotNames([...slotNames], slotCount);
  updated[index] = cleaned;

  setSlotNames(updated);
  setSlotNameModal({ open: false, index: null, value: "" });

  try {
    if (isDuo) {
      await patchDuoSave({ slotNames: updated });
    } else {
      if (activeSave && savegames[activeSave]) {
        savegames[activeSave].slotNames = updated;
        localStorage.setItem("savegames", JSON.stringify(savegames));
      }
    }
  } catch (e) {
    console.error(e);
  }
};

  // ===== Encounters state =====
  const [encounters, setEncounters] = useState(() => currentSave?.encounters || {});
  const [confirmModal, setConfirmModal] = useState(null);
  const [slotNameModal, setSlotNameModal] = useState({
  open: false,
  index: null,
  value: "",
});
  // null | "reset" | "clear"

  useEffect(() => {
    if (!isDuo) return;
    if (!duoSave) return;
    setEncounters(duoSave.encounters || {});
  }, [isDuo, duoSave]);

  useEffect(() => {
    if (isDuo) return;
    setEncounters(currentSave?.encounters || {});
  }, [isDuo, activeSave]);

  // ===== Filter/Sort/Theme =====
  const defaultFilters = { Gefangen: true, Entkommen: true, Besiegt: true, Offen: true };
  const [filters, setFilters] = useState(() => JSON.parse(localStorage.getItem("encounterFilters")) || defaultFilters);

  const [sortMode, setSortMode] = useState(() => localStorage.getItem("encounterSortMode") || "route");
  const [theme, setTheme] = useState(localStorage.getItem("theme") || "light");

  useEffect(() => {
    document.body.className = theme + "-mode";
  }, [theme]);

  const toggleFilter = (status) => {
    const updated = { ...filters, [status]: !filters[status] };
    setFilters(updated);
    localStorage.setItem("encounterFilters", JSON.stringify(updated));
  };

  // ===== Save helper (local or Firestore) =====
  const persistEncounters = async (updatedEncounters) => {
    if (isDuo) {
      await patchDuoSave({ encounters: updatedEncounters });
      return;
    }
    if (activeSave && savegames[activeSave]) {
      savegames[activeSave].encounters = updatedEncounters;
      localStorage.setItem("savegames", JSON.stringify(savegames));
    }
  };

    const persistGlobalSinnerStats = async (updatedStats) => {
    if (isDuo) {
      await patchDuoSave({ globalSinnerStats: updatedStats });
      return;
    }

    if (activeSave && savegames[activeSave]) {
      savegames[activeSave].globalSinnerStats = updatedStats;
      localStorage.setItem("savegames", JSON.stringify(savegames));
    }
  };

  const persistRunCounter = async (updatedRunCounter) => {
    if (isDuo) {
      await patchDuoSave({ runCounter: updatedRunCounter });
      return;
    }

    if (activeSave && savegames[activeSave]) {
      savegames[activeSave].runCounter = updatedRunCounter;
      localStorage.setItem("savegames", JSON.stringify(savegames));
    }
  };

  const persistMetaStats = async ({ updatedStats, updatedRunCounter }) => {
    if (isDuo) {
      const patch = {};
      if (updatedStats !== undefined) patch.globalSinnerStats = updatedStats;
      if (updatedRunCounter !== undefined) patch.runCounter = updatedRunCounter;
      await patchDuoSave(patch);
      return;
    }

    if (activeSave && savegames[activeSave]) {
      if (updatedStats !== undefined) {
        savegames[activeSave].globalSinnerStats = updatedStats;
      }
      if (updatedRunCounter !== undefined) {
        savegames[activeSave].runCounter = updatedRunCounter;
      }
      localStorage.setItem("savegames", JSON.stringify(savegames));
    }
  };

  // ===== Spieler-Optionen für "Sündiger" =====
  const sinnerOptions = useMemo(() => {
    return [...Array(slotCount)].map((_, i) => {
      const label = (slotNames[i] || "").trim() || `Pokémon ${i + 1}`;
      return { key: `p${i + 1}`, label };
    });
  }, [slotNames, slotCount]);

  const [globalSinnerStats, setGlobalSinnerStats] = useState(() => {
  if (isDuo) return duoSave?.globalSinnerStats || {};
  return currentSave?.globalSinnerStats || {};
});

const [runCounter, setRunCounter] = useState(() => {
  if (isDuo) return Number(duoSave?.runCounter || 0);
  return Number(currentSave?.runCounter || 0);
});

const [editStatsModal, setEditStatsModal] = useState({
  open: false,
  runCounter: 0,
  sinnerStats: {},
});

useEffect(() => {
  if (isDuo) {
    setGlobalSinnerStats(duoSave?.globalSinnerStats || {});
    setRunCounter(Number(duoSave?.runCounter || 0));
    return;
  }

  setGlobalSinnerStats(currentSave?.globalSinnerStats || {});
  setRunCounter(Number(currentSave?.runCounter || 0));
}, [isDuo, duoSave, currentSave, activeSave]);

  const openEditStatsModal = () => {
    const nextStats = {};

    sinnerOptions.forEach((opt) => {
      const saved = globalSinnerStats?.[opt.key] || {};
      nextStats[opt.key] = {
        escaped: Number(saved.escaped || 0),
        fainted: Number(saved.fainted || 0),
      };
    });

    setEditStatsModal({
      open: true,
      runCounter: Number(runCounter || 0),
      sinnerStats: nextStats,
    });
  };

  const closeEditStatsModal = () => {
    setEditStatsModal({
      open: false,
      runCounter: 0,
      sinnerStats: {},
    });
  };

  const saveEditStatsModal = async () => {
    const cleanedRunCounter = Math.max(0, Number(editStatsModal.runCounter || 0));

    const cleanedStats = {};
    sinnerOptions.forEach((opt) => {
      const row = editStatsModal.sinnerStats?.[opt.key] || {};
      cleanedStats[opt.key] = {
        escaped: Math.max(0, Number(row.escaped || 0)),
        fainted: Math.max(0, Number(row.fainted || 0)),
      };
    });

    setGlobalSinnerStats(cleanedStats);
    setRunCounter(cleanedRunCounter);

    try {
      await persistMetaStats({
        updatedStats: cleanedStats,
        updatedRunCounter: cleanedRunCounter,
      });
      closeEditStatsModal();
    } catch (e) {
      console.error(e);
    }
  };

  // ===== Counter (Entkommen/Besiegt pro Spieler) =====
  const sinnerStats = useMemo(() => {
  const base = {};

  for (const opt of sinnerOptions) {
    const saved = globalSinnerStats?.[opt.key] || {};
    base[opt.key] = {
      label: opt.label,
      escaped: Number(saved.escaped || 0),
      fainted: Number(saved.fainted || 0),
    };
  }

  Object.values(encounters || {}).forEach((row) => {
    if (!row) return;
    const status = row.status || "";
    const sinnerKey = (row.sinner || "").trim();
    if (!sinnerKey || !base[sinnerKey]) return;

    if (status === "Entkommen") base[sinnerKey].escaped += 1;
    if (status === "Besiegt") base[sinnerKey].fainted += 1;
  });

  return Object.values(base);
}, [encounters, sinnerOptions, globalSinnerStats]);

  const handleChange = async (location, field, value) => {
    const prev = encounters[location] || {};
    const updated = {
      ...encounters,
      [location]: {
        ...prev,
        [field]: value,
      },
    };

    const data = updated[location];

    // Wenn Pokémon geändert/gelöscht: Form für diesen Slot resetten
    if (field.startsWith("pokemon")) {
      const idx = Number(field.replace("pokemon", "")); // 1..3
      if (Number.isFinite(idx) && idx >= 1 && idx <= 3) {
        const nextName = value || "";
        const prevName = prev?.[field] || "";
        if (!nextName || nextName !== prevName) {
          updated[location][`form${idx}`] = "";
        }
      }

      const allFilled = [...Array(slotCount)].every((_, i) => !!data[`pokemon${i + 1}`]);
      const status = data.status;
      if (!allFilled && (status === "Gefangen" || status === "Besiegt")) {
        data.status = "";
        for (let i = 1; i <= slotCount; i++) data[`status${i}`] = "";
        // wenn Status ungültig wird, Sündiger auch reset
        data.sinner = "";
      }
    }

    if (field === "status") {
  for (let i = 1; i <= slotCount; i++) updated[location][`status${i}`] = value;

  if (slotCount === 1) {
    if (value === "Entkommen" || value === "Besiegt") {
      updated[location].sinner = "p1";
    } else {
      updated[location].sinner = "";
    }
  } else {
    if (value !== "Entkommen" && value !== "Besiegt") {
      updated[location].sinner = "";
    }
  }
}

    setEncounters(updated);
    try {
      await persistEncounters(updated);
    } catch (e) {
      console.error(e);
    }
  };

 const handleReset = async () => {
  setConfirmModal("reset");
};

  const handleClearListOnly = async () => {
  setConfirmModal("clear");
};
const confirmAction = async () => {
  if (confirmModal === "reset") {
    setEncounters({});
    setGlobalSinnerStats({});
    setRunCounter(0);

    try {
      await persistEncounters({});
      await persistMetaStats({
        updatedStats: {},
        updatedRunCounter: 0,
      });
    } catch (e) {
      console.error(e);
    }
  }

  if (confirmModal === "clear") {
    const nextTotals = { ...(globalSinnerStats || {}) };

    Object.values(encounters || {}).forEach((row) => {
      if (!row) return;
      const status = row.status || "";
      const sinnerKey = (row.sinner || "").trim();
      if (!sinnerKey) return;

      if (!nextTotals[sinnerKey]) {
        nextTotals[sinnerKey] = { escaped: 0, fainted: 0 };
      }

      if (status === "Entkommen") nextTotals[sinnerKey].escaped += 1;
      if (status === "Besiegt") nextTotals[sinnerKey].fainted += 1;
    });

    const nextRunCounter = Number(runCounter || 0) + 1;

    setGlobalSinnerStats(nextTotals);
    setRunCounter(nextRunCounter);
    setEncounters({});

    try {
      await persistEncounters({});
      await persistMetaStats({
        updatedStats: nextTotals,
        updatedRunCounter: nextRunCounter,
      });
    } catch (e) {
      console.error(e);
    }
  }

  setConfirmModal(null);
};

  // Duplicate-Check bleibt auf Basis-Pokémon (Name) – Mega ist nur Anzeige/Form.
  const familyStatusByName = useMemo(() => {
  const exactMap = new Map();
  const familyPresenceByDex = new Map();

  Object.entries(encounters || {}).forEach(([loc, entry]) => {
    const rowStatus = entry?.status || "";

    Object.entries(entry || {}).forEach(([key, val]) => {
      if (!key.startsWith("pokemon")) return;
      if (!val) return;

      const dexId = Number(nameToDexId.get(val));
      if (!dexId) return;

      // exaktes Pokémon
      const prevExact = exactMap.get(val) || {
        count: 0,
        statuses: [],
        locations: [],
      };

      prevExact.count += 1;

      if (rowStatus && !prevExact.statuses.includes(rowStatus)) {
        prevExact.statuses.push(rowStatus);
      }

      if (loc && !prevExact.locations.includes(loc)) {
        prevExact.locations.push(loc);
      }

      exactMap.set(val, prevExact);

      // Familien-Präsenz nach Dex
      const familyDexIds = getFamilyDexIds(dexId);
      familyDexIds.forEach((famDexId) => {
        const famKey = Number(famDexId);
        const prevFamily = familyPresenceByDex.get(famKey) || {
          count: 0,
          statuses: [],
          locations: [],
          members: [],
        };

        prevFamily.count += 1;

        if (rowStatus && !prevFamily.statuses.includes(rowStatus)) {
          prevFamily.statuses.push(rowStatus);
        }

        if (loc && !prevFamily.locations.includes(loc)) {
          prevFamily.locations.push(loc);
        }

        if (!prevFamily.members.includes(val)) {
          prevFamily.members.push(val);
        }

        familyPresenceByDex.set(famKey, prevFamily);
      });
    });
  });

  const finalMap = new Map();

  pokemonList.forEach((name) => {
    const dexId = Number(nameToDexId.get(name));
    if (!dexId) {
      finalMap.set(name, {
        alreadyOwned: false,
        isFamilyMatch: false,
        statuses: [],
        statusText: "",
      });
      return;
    }

    const exactInfo = exactMap.get(name) || null;
    const familyInfo = familyPresenceByDex.get(dexId) || null;

    const exactAlreadyOwned = (exactInfo?.count || 0) > 0;
    const familyAlreadyOwned = (familyInfo?.count || 0) > 0;
    const isFamilyMatch = !exactAlreadyOwned && familyAlreadyOwned;

    const statuses = exactAlreadyOwned
      ? exactInfo?.statuses || []
      : familyInfo?.statuses || [];

    const uniqueStatuses = [...new Set(statuses)];
    const alreadyOwned = exactAlreadyOwned || familyAlreadyOwned;

    finalMap.set(name, {
      alreadyOwned,
      isFamilyMatch,
      statuses: uniqueStatuses,
      statusText: getOwnedStatusText(uniqueStatuses, isFamilyMatch),
    });
  });

  return finalMap;
}, [encounters, pokemonList, nameToDexId]);

function getOwnedStatusText(statuses = [], isFamilyMatch = false) {
  if (statuses.includes("Gefangen")) {
    return isFamilyMatch ? "Familie schon gefangen" : "schon gefangen";
  }

  if (statuses.includes("Besiegt")) {
    return isFamilyMatch ? "Familie schon besiegt" : "schon besiegt";
  }

  if (statuses.includes("Entkommen")) {
    return isFamilyMatch ? "Familie schon entkommen" : "schon entkommen";
  }

  return isFamilyMatch ? "Familie schon im Run" : "schon im Run";
}

function getOwnedStatusIcon(statuses = []) {
  if (statuses.includes("Gefangen")) {
    return <StatusIcon status="Gefangen" size={16} />;
  }

  if (statuses.includes("Besiegt")) {
    return <StatusIcon status="Besiegt" size={16} />;
  }

  if (statuses.includes("Entkommen")) {
    return <StatusIcon status="Entkommen" size={16} />;
  }

  return "•";
}

  let filteredLocations = locationList.filter((loc) => {
    const status = encounters[loc]?.status || "Offen";
    return filters[status];
  });

  if (sortMode === "offen-oben") {
    filteredLocations.sort((a, b) => {
      const dataA = encounters[a] || {};
      const dataB = encounters[b] || {};
      const hasDataA = [...Array(slotCount)].some((_, i) => !!dataA[`pokemon${i + 1}`]) || !!dataA.status;
      const hasDataB = [...Array(slotCount)].some((_, i) => !!dataB[`pokemon${i + 1}`]) || !!dataB.status;
      return hasDataA === hasDataB ? 0 : hasDataA ? 1 : -1;
    });
  }

  if (sortMode === "offen-unten") {
    filteredLocations.sort((a, b) => {
      const dataA = encounters[a] || {};
      const dataB = encounters[b] || {};
      const hasDataA = [...Array(slotCount)].some((_, i) => !!dataA[`pokemon${i + 1}`]) || !!dataA.status;
      const hasDataB = [...Array(slotCount)].some((_, i) => !!dataB[`pokemon${i + 1}`]) || !!dataB.status;
      return hasDataA === hasDataB ? 0 : hasDataA ? -1 : 1;
    });
  }

  const fossilPool = useMemo(() => getFossilPoolForRunGen(gen), [gen]);

const usedFossilsBySlot = useMemo(() => {
  // pro Spieler: Set der bereits gewählten Fossilien (über alle Fossil-1..Fossil-10 Zeilen)
  const sets = [...Array(slotCount)].map(() => new Set());

  Object.entries(encounters || {}).forEach(([loc, row]) => {
    if (!isFossilLocation(loc)) return;
    const data = row || {};
    for (let i = 0; i < slotCount; i++) {
      const key = data[fossilFieldForSlot(i)];
      if (key) sets[i].add(key);
    }
  });

  return sets;
}, [encounters, slotCount]);

  const getSelectStyles = () => {
    return {
      control: (styles, state) => ({
        ...styles,
        minHeight: 42,
        borderRadius: 8,
        background:
          "linear-gradient(135deg, rgba(14, 23, 42, 0.88), rgba(8, 13, 28, 0.86))",
        color: "#ffffff",
        borderColor: state.isFocused
          ? "rgba(126, 165, 255, 0.72)"
          : "rgba(140, 165, 210, 0.34)",
        boxShadow: state.isFocused
          ? "0 0 0 2px rgba(90, 130, 220, 0.18), 0 0 18px rgba(120, 165, 255, 0.12)"
          : "inset 0 1px 0 rgba(255, 255, 255, 0.06)",
        backdropFilter: "blur(10px)",
        cursor: "text",
        transition: "border-color 160ms ease, box-shadow 160ms ease, background 160ms ease",
        overflow: "hidden",
      }),

      valueContainer: (styles) => ({
        ...styles,
        padding: "2px 10px",
      }),

      placeholder: (styles) => ({
        ...styles,
        color: "rgba(255, 255, 255, 0.46)",
        fontWeight: 750,
      }),

      input: (styles) => ({
        ...styles,
        color: "#ffffff",
        fontWeight: 800,
      }),

      singleValue: (styles) => ({
        ...styles,
        color: "#ffffff",
        fontWeight: 850,
      }),

      indicatorsContainer: (styles) => ({
        ...styles,
        color: "rgba(255, 255, 255, 0.72)",
      }),

      dropdownIndicator: (styles, state) => ({
        ...styles,
        color: state.isFocused ? "rgba(170, 200, 255, 0.95)" : "rgba(255, 255, 255, 0.58)",
        padding: 8,
        transition: "color 160ms ease, transform 160ms ease",
        transform: state.selectProps.menuIsOpen ? "rotate(180deg)" : "none",
        ":hover": {
          color: "rgba(210, 228, 255, 1)",
        },
      }),

      clearIndicator: (styles) => ({
        ...styles,
        color: "rgba(255, 255, 255, 0.50)",
        padding: 8,
        ":hover": {
          color: "rgba(255, 255, 255, 0.88)",
        },
      }),

      indicatorSeparator: (styles) => ({
        ...styles,
        backgroundColor: "rgba(255, 255, 255, 0.10)",
      }),

      menuPortal: (styles) => ({
        ...styles,
        zIndex: 999999,
      }),

      menu: (styles) => ({
        ...styles,
        marginTop: 8,
        borderRadius: 12,
        overflow: "hidden",
        background:
          "linear-gradient(145deg, rgba(10, 16, 32, 0.96), rgba(5, 9, 20, 0.96))",
        border: "1px solid rgba(140, 165, 210, 0.28)",
        boxShadow:
          "0 24px 70px rgba(0, 0, 0, 0.48), inset 0 1px 0 rgba(255, 255, 255, 0.08)",
        backdropFilter: "blur(14px)",
        zIndex: 9999,
      }),

      menuList: (styles) => ({
        ...styles,
        padding: 6,
        maxHeight: 260,
        scrollbarWidth: "none",
        msOverflowStyle: "none",
      }),

      option: (styles, { isFocused, isSelected, data }) => ({
        ...styles,
        borderRadius: 8,
        marginBottom: 3,
        backgroundColor: isSelected
          ? "rgba(67, 233, 123, 0.22)"
          : isFocused
          ? "rgba(120, 165, 255, 0.14)"
          : "transparent",
        color: data?.alreadyOwned ? "rgba(255, 255, 255, 0.68)" : "#ffffff",
        fontStyle: data?.alreadyOwned ? "italic" : "normal",
        opacity: data?.alreadyOwned ? 0.82 : 1,
        fontWeight: isSelected ? 900 : 750,
        cursor: "pointer",
        ":active": {
          backgroundColor: "rgba(67, 233, 123, 0.26)",
        },
      }),

      noOptionsMessage: (styles) => ({
        ...styles,
        color: "rgba(255, 255, 255, 0.62)",
      }),
    };
  };

  
  const getStatusIcon = (status) => {
    if (!status) return null;

    if (status === "Gefangen") {
      return <StatusIcon status="Gefangen" size={45} style={{ marginLeft: 10 }} />;
    }

    if (status === "Besiegt") {
      return <StatusIcon status="Besiegt" size={50} style={{ marginLeft: 10 }} />;
    }

    if (status === "Entkommen") {
      return <StatusIcon status="Entkommen" size={45} style={{ marginLeft: 10 }} />;
    }

    return null;
  };

  const openInternalPokedex = (baseDexId, formKey, pokemonName) => {
    const baseId = Number(baseDexId);
    if (!baseId) return;

    const formId = getFormIdFor(baseId, formKey);
    const idToUse = formId || baseId;

    // ✅ Hier wird NICHT mehr PokéWiki geöffnet, sondern deine interne Seite.
    // Falls dein Route nicht "/pokedex" ist: hier anpassen.
    navigate("/pokedex", {
      state: {
        focusDexId: idToUse,
        baseDexId: baseId,
        formKey: formKey || "",
        name: pokemonName || "",
        from: "encounters",
      },
    });
  };

  function renderMobileEncounterCards() {
    return (
      <div className="encounter-mobile-list">
        {filteredLocations.map((loc) => {
          const data = encounters[loc] || {};
          const status = data.status || "";

          const rowClass =
            status === "Gefangen"
              ? "status-caught"
              : status === "Besiegt"
              ? "status-fainted"
              : status === "Entkommen"
              ? "status-escaped"
              : "unused-location";

          const allFilled = [...Array(slotCount)].every((_, i) => !!data[`pokemon${i + 1}`]);

          const sinnerKey = (data.sinner || "").trim();
          const sinnerEnabled = status === "Entkommen" || status === "Besiegt";

          return (
            <section
              key={`mobile-${loc}`}
              className={`encounter-mobile-card ${rowClass}`}
              data-status={status || "Offen"}
            >
              <div className="encounter-mobile-card-head">
                <div className="encounter-mobile-card-title-wrap">
                  <div className="encounter-mobile-location">{loc}</div>
                  <div className="encounter-mobile-meta">
                    {status || "Offen"}
                    {allFilled ? " · Pokémon eingetragen" : ""}
                  </div>
                </div>

                <div className="encounter-mobile-status-icon">
                  {status ? (
                    <StatusIcon status={status} size={34} />
                  ) : (
                    <span className="encounter-mobile-open-dot" />
                  )}
                </div>
              </div>

              <div className="encounter-mobile-slots">
                {[...Array(slotCount)].map((_, i) => {
                  const slotName = `pokemon${i + 1}`;
                  const slotLabel = (slotNames[i] || "").trim() || `Pokémon ${i + 1}`;
                  const formKey = data[`form${i + 1}`] || "";
                  const selected = data[slotName] || "";

                  const isFossil = isFossilLocation(loc);
                  const fossilField = fossilFieldForSlot(i);
                  const chosenFossil = data[fossilField] || "";
                  const usedSet = usedFossilsBySlot[i] || new Set();
                  const fossilOptions = fossilPool;

                  const selectOptions = pokemonList.map((name) => {
                    const info = familyStatusByName.get(name) || {
                      alreadyOwned: false,
                      isFamilyMatch: false,
                      statuses: [],
                      statusText: "",
                    };

                    const isCurrentSelected = selected === name;
                    const alreadyOwned = !isCurrentSelected && info.alreadyOwned;

                    return {
                      value: name,
                      label: name,
                      customLabel: alreadyOwned ? (
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                              minWidth: 18,
                            }}
                          >
                            {getOwnedStatusIcon(info.statuses)}
                          </span>
                          <span>
                            {name} ({info.statusText})
                          </span>
                        </div>
                      ) : (
                        name
                      ),
                      alreadyOwned,
                      isFamilyMatch: info.isFamilyMatch,
                    };
                  });

                  const dexId = selected ? nameToDexId.get(selected) : null;
                  const formOptions = dexId ? getFormOptionsForDexId(dexId) : [];
                  const hasForms = formOptions.length > 0;
                  const sprite = dexId ? spriteUrlFor(dexId, formKey) : null;

                  return (
                    <div key={`${loc}-mobile-slot-${i}`} className="encounter-mobile-slot">
                      <div className="encounter-mobile-slot-head">
                        <span>{slotLabel}</span>

                        <button
                          type="button"
                          onClick={() => editSlotName(i)}
                          title="Spaltenname bearbeiten"
                          className="encounter-mobile-edit-button"
                        >
                          <PencilIcon size={14} />
                        </button>
                      </div>

                      <div className="encounter-mobile-pokemon-row">
                        <div className="encounter-mobile-select-wrap">
                          <CreatableSelect
                            key={`${loc}-${i}-${theme}-mobile`}
                            options={selectOptions}
                            formatOptionLabel={(option) => option.customLabel || option.label}
                            value={selected ? { label: selected, value: selected } : null}
                            onChange={(sel) => handleChange(loc, slotName, sel?.value || "")}
                            isClearable
                            isSearchable
                            placeholder={slotLabel}
                            styles={getSelectStyles()}
                          />
                        </div>

                        {selected && dexId && hasForms && (
                          <button
                            type="button"
                            onClick={() => {
                              const next = nextSpecialForm(formKey, formOptions);
                              handleChange(loc, `form${i + 1}`, next);
                            }}
                            title="Form wechseln"
                            className="encounter-mobile-form-button"
                            style={megaBtn(dark, !!formKey)}
                          >
                            {formLabel(formKey)}
                          </button>
                        )}

                        {selected && dexId && (
                          <button
                            type="button"
                            onClick={() => {
                              const formId = getFormIdFor(dexId, formKey);
                              const idToUse = formId || Number(dexId);

                              if (idToUse) navigate(`/pokemon/${idToUse}`);
                            }}
                            title={`Info öffnen: ${selected}${formKey ? ` (${formLabel(formKey)})` : ""}`}
                            className="encounter-mobile-sprite-button"
                          >
                            <img
                              src={sprite || `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${dexId}.png`}
                              alt={selected}
                              className="encounter-mobile-sprite"
                            />
                          </button>
                        )}
                      </div>

                      {isFossil && (
                        <div className="encounter-mobile-fossil-row">
                          <span>Fossil</span>

                          <select
                            value={chosenFossil}
                            onChange={(e) => handleChange(loc, fossilField, e.target.value)}
                          >
                            <option value="">— wählen —</option>
                            {fossilOptions.map((f) => (
                              <option
                                key={f.key}
                                value={f.key}
                                disabled={usedSet.has(f.key) && f.key !== chosenFossil}
                              >
                                {f.label}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="encounter-mobile-bottom">
                <div className="encounter-mobile-field">
                  <span>Status</span>
                  <EncounterStatusSelect
                    value={status || ""}
                    allFilled={allFilled}
                    onChange={(nextStatus) => handleChange(loc, "status", nextStatus)}
                  />
                </div>

                <div className="encounter-mobile-field">
                  <span>Sündiger</span>
                  <EncounterSinnerSelect
                    value={sinnerKey || ""}
                    disabled={!sinnerEnabled}
                    options={sinnerOptions}
                    onChange={(nextSinner) => handleChange(loc, "sinner", nextSinner)}
                  />
                </div>
              </div>
            </section>
          );
        })}
      </div>
    );
  }

  const dark = theme === "dark";

  return (
    <div className="encounter-page" style={pageWrap(dark)}>
      {dark && <div style={bg} />}
      {dark && <div style={bgOverlay} />}

      <div className="encounter-content-card" style={contentCard(dark)}>
        <style>{tableCss(dark)}</style>

        {/* Duo Status + Exit */}
       {isDuo && (
  <div style={{ marginBottom: 10 }}>
    <strong style={{ color: "#079e4b" }}>
      {effectiveLinkMode === "solo"
        ? "Solo Online aktiv"
        : effectiveLinkMode === "trio"
        ? "Trio Online aktiv"
        : "Duo Online aktiv"}
    </strong>{" "}
    — Room: <b>{activeDuoRoomId}</b>{" "}
    <button
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

        {/* Run Title + Presence */}
        {isDuo && (
          <>
            <RunTitleBar
              title={duoSave?.title}
              onSaveTitle={async (newTitle) => {
                if (!activeDuoRoomId) throw new Error("Keine aktive Room-ID gefunden.");

                await updateDuoSave(activeDuoRoomId, { title: newTitle });

                upsertRecentRoom({
                  roomId: activeDuoRoomId,
                  title: newTitle,
                  edition: duoSave?.edition || effectiveEdition || "",
                  linkMode: duoSave?.linkMode || effectiveLinkMode || "duo",
                });
              }}
            />

            <div style={encounterTitleBlock}>
              <h1 style={encounterTableTitle}>
                {effectiveEdition} Encounter-Tabelle (
                {effectiveLinkMode === "solo"
                  ? "Solo"
                  : effectiveLinkMode === "trio"
                  ? "Trio"
                  : "Duo"}
                )
              </h1>
            </div>

            <div style={{ marginBottom: 12, textAlign: "center" }}>
              <div style={{ fontWeight: 700, opacity: 0.9 }}>
                Online: {presence.online.length ? presence.online.map((p) => p.name).join(", ") : "—"}
              </div>

              {!!presence.all.length && (
                <div style={{ fontSize: 12, opacity: 0.75, marginTop: 4 }}>
                  {presence.all.map((p) => (
                    <span key={p.uid || p.name} style={{ margin: "0 8px", whiteSpace: "nowrap" }}>
                      {p.name}: {formatLastActive(p.lastActiveAtMs)}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {/* Titelzeile + Actions rechts oben */}
        {!isDuo && (
          <div style={encounterTitleBlock}>
            <h1 style={encounterTableTitle}>
              {effectiveEdition} Encounter-Tabelle (
              {effectiveLinkMode === "solo"
                ? "Solo"
                : effectiveLinkMode === "trio"
                ? "Trio"
                : "Duo"}
              )
            </h1>
          </div>
        )}

        <div className="encounter-header-actions-row" style={headerRow}>
          <div className="encounter-top-actions" style={topRightActions}>
            <button onClick={() => navigate("/team")}>Zum Team</button>
            <button onClick={() => navigate("/guide")}>Story-Guide öffnen</button>
          </div>
        </div>

        {currentLevelCap && (
          <div style={levelCapBanner(dark)}>
            <div style={{ fontWeight: 950, letterSpacing: 0.2 }}>
              Aktuelles Level-Cap: <span style={{ fontSize: 18 }}>{currentLevelCap.level}</span>
            </div>
            <div style={{ opacity: 0.9, fontSize: 13, marginTop: 2 }}>
              {currentLevelCap.order}. {currentLevelCap.name}
              {currentLevelCap.location ? ` — ${currentLevelCap.location}` : ""}
            </div>
          </div>
        )}

        {/* ✅ NEU: Counter-Box */}
                <div style={sinnerStatsBox(dark)}>
  <div
    style={{
      position: "relative",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 6,
      minHeight: 32,
    }}
  >
    <div
      style={{
        fontWeight: 900,
        textAlign: "center",
      }}
    >
      Run- & Sünden-Zähler
    </div>

    <button
      onClick={openEditStatsModal}
      title="Run-Counter und Sünden-Zahlen bearbeiten"
      style={{
        ...editIconBtn,
        position: "absolute",
        right: 34,
        top: "50%",
        transform: "translateY(-50%)",
      }}
    >
      <PencilIcon size={18} />
    </button>
  </div>

          <div style={runCounterCard(dark)}>
            <div style={{ fontWeight: 900, fontSize: 14 }}>Run-Counter</div>
            <div style={{ fontSize: 28, fontWeight: 950, lineHeight: 1.1 }}>{runCounter}</div>
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center", marginTop: 10 }}>
            {sinnerStats.map((s) => (
              <div key={s.label} style={sinnerStatPill(dark)}>
                <div style={{ fontWeight: 900 }}>{s.label}</div>
                <div
                  style={{
                    fontSize: 12,
                    opacity: 0.9,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexWrap: "wrap",
                    gap: 10,
                  }}
                >
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                    <StatusIcon status="Entkommen" size={14} />
                    <span>
                      Entkommen: <b>{s.escaped}</b>
                    </span>
                  </span>

                  <span style={{ opacity: 0.45 }}>|</span>

                  <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                    <StatusIcon status="Besiegt" size={14} />
                    <span>
                      Besiegt: <b>{s.fainted}</b>
                    </span>
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="button-row" style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 14 }}>
  {Object.keys(filters).map((status) => (
    <button
      key={status}
      className={
        filters[status]
          ? "encounter-filter-button encounter-filter-button-active"
          : "encounter-filter-button"
      }
      onClick={() => toggleFilter(status)}
    >
      {status}
    </button>
  ))}

  <select
    value={sortMode}
    onChange={(e) => {
      setSortMode(e.target.value);
      localStorage.setItem("encounterSortMode", e.target.value);
    }}
  >
    <option value="route">Nach Route</option>
    <option value="offen-oben">Offene oben</option>
    <option value="offen-unten">Offene unten</option>
  </select>

  <button
    onClick={handleClearListOnly}
    className="encounter-filter-button encounter-filter-button-warn"
    title="Leert nur die Encounter-Liste, behält aber die gesamten Sündiger-Zahlen"
  >
    Liste leeren
  </button>

  <button
    onClick={handleReset}
    className="encounter-filter-button encounter-filter-button-danger"
    title="Setzt alles zurück, inklusive gesamter Sündiger-Zahlen"
  >
    Alles zurücksetzen
  </button>
</div>

        {renderMobileEncounterCards()}

        <table className="encounter-desktop-table">
          <thead>
            <tr>
              <th>Ort</th>

              {[...Array(slotCount)].map((_, i) => {
                const label = (slotNames[i] || "").trim() || `Pokémon ${i + 1}`;
                return (
                  <th key={`pkmn-header-${i}`}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                      <span>{label}</span>
                      <button
                        onClick={() => editSlotName(i)}
                        title="Spaltenname bearbeiten"
                        style={smallEditIconBtn}
                      >
                        <PencilIcon size={15} />
                      </button>
                    </div>
                  </th>
                );
              })}

              <th>Status</th>
              {/* ✅ NEU */}
              <th>Sündiger</th>
            </tr>
          </thead>

          <tbody>
            {filteredLocations.map((loc) => {
              const data = encounters[loc] || {};
              const status = data.status || "";

              const rowClass =
                status === "Gefangen"
                  ? "status-caught"
                  : status === "Besiegt"
                  ? "status-fainted"
                  : status === "Entkommen"
                  ? "status-escaped"
                  : "unused-location";

              const allFilled = [...Array(slotCount)].every((_, i) => !!data[`pokemon${i + 1}`]);

              const sinnerKey = (data.sinner || "").trim();
              const sinnerEnabled = status === "Entkommen" || status === "Besiegt";

              return (
                <tr key={loc} className={rowClass} data-status={status}>
                  <td>{loc}</td>

                  {[...Array(slotCount)].map((_, i) => {
  const slotName = `pokemon${i + 1}`;
  const formKey = data[`form${i + 1}`] || "";
  const selected = data[slotName] || "";

  const isFossil = isFossilLocation(loc);
  const fossilField = fossilFieldForSlot(i);
  const chosenFossil = data[fossilField] || "";

  // Fossil-Optionen: disable wenn dieser Spieler es schon woanders gewählt hat
  const usedSet = usedFossilsBySlot[i] || new Set();
  const fossilOptions = fossilPool;

  // normale Pokémon-Auswahl
  const available = pokemonList;

const selectOptions = available.map((name) => {
  const info = familyStatusByName.get(name) || {
    alreadyOwned: false,
    isFamilyMatch: false,
    statuses: [],
    statusText: "",
  };

  const isCurrentSelected = selected === name;
  const alreadyOwned = !isCurrentSelected && info.alreadyOwned;

  return {
    value: name,
    label: name,
    customLabel: alreadyOwned ? (
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", minWidth: 18 }}>
          {getOwnedStatusIcon(info.statuses)}
        </span>
        <span>
          {name} ({info.statusText})
        </span>
      </div>
    ) : (
      name
    ),
    alreadyOwned,
    isFamilyMatch: info.isFamilyMatch,
  };
});

const dexId = selected ? nameToDexId.get(selected) : null;
  const formOptions = dexId ? getFormOptionsForDexId(dexId) : [];
  const hasForms = formOptions.length > 0;
  const sprite = dexId ? spriteUrlFor(dexId, formKey) : null;

  // --- Fossil-Zeile: Dropdown statt CreatableSelect ---
  if (isFossil) {
  return (
    <td key={`${loc}-slot-${i}`}>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {/* 1) Pokémon ganz normal auswählen */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ flex: 1, minWidth: 180 }}>
            <CreatableSelect
              key={`${loc}-${i}-${theme}`}
              options={selectOptions}
              formatOptionLabel={(option) => option.customLabel || option.label}
              value={selected ? { label: selected, value: selected } : null}
              onChange={(sel) => handleChange(loc, slotName, sel?.value || "")}
              isClearable
              isSearchable
              placeholder={`Pokémon ${i + 1}`}
              styles={getSelectStyles()}
            />
          </div>

                    {/* Form-Toggle */}
          {selected && dexId && hasForms && (
            <button
              type="button"
              onClick={() => {
                const next = nextSpecialForm(formKey, formOptions);
                handleChange(loc, `form${i + 1}`, next);
              }}
              title="Form wechseln"
              style={megaBtn(dark, !!formKey)}
            >
              {formLabel(formKey)}
            </button>
          )}

          {/* Sprite */}
          {selected && dexId && (
            <button
              type="button"
                onClick={() => {
                const formId = getFormIdFor(dexId, formKey);
                const idToUse = formId || Number(dexId);

                if (idToUse) navigate(`/pokemon/${idToUse}`);
              }}
              title={`Info öffnen: ${selected}${formKey ? ` (${formLabel(formKey)})` : ""}`}
              style={{
                border: "none",
                background: "transparent",
                padding: 0,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
              }}
            >
              <img
                src={sprite || `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${dexId}.png`}
                alt={selected}
                style={{ height: "60px" }}
              />
            </button>
          )}
        </div>

        {/* 2) Fossil-Auswahl klein darunter */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 11, opacity: 0.75, minWidth: 64 }}>Fossil:</span>
          <select
            value={chosenFossil}
            onChange={(e) => handleChange(loc, fossilField, e.target.value)}
            style={{
              fontSize: 12,
              padding: "6px 8px",
              borderRadius: 10,
              opacity: 0.95,
              width: "100%",
            }}
          >
            <option value="">— wählen —</option>
            {fossilOptions.map((f) => (
              <option key={f.key} value={f.key} disabled={usedSet.has(f.key) && f.key !== chosenFossil}>
                {f.label}
              </option>
            ))}
          </select>
        </div>
      </div>
    </td>
  );
}

  // --- normale Route: CreatableSelect + Mega + Sprite ---
  return (
    <td key={`${loc}-slot-${i}`}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ flex: 1, minWidth: 180 }}>
          <CreatableSelect
            key={`${loc}-${i}-${theme}`}
            options={selectOptions}
            formatOptionLabel={(option) => option.customLabel || option.label}
            value={selected ? { label: selected, value: selected } : null}
            onChange={(sel) => handleChange(loc, slotName, sel?.value || "")}
            isClearable
            isSearchable
            placeholder={`Pokémon ${i + 1}`}
            styles={getSelectStyles()}
          />
        </div>

        {/* Form-Toggle */}
        {selected && dexId && hasForms && (
          <button
            type="button"
            onClick={() => {
              const next = nextSpecialForm(formKey, formOptions);
              handleChange(loc, `form${i + 1}`, next);
            }}
            title="Form wechseln"
            style={megaBtn(dark, !!formKey)}
          >
            {formLabel(formKey)}
          </button>
        )}

        {/* Sprite */}
        {selected && dexId && (
          <button
            type="button"
              onClick={() => {
              const formId = getFormIdFor(dexId, formKey);
              const idToUse = formId || Number(dexId);

              if (idToUse) navigate(`/pokemon/${idToUse}`);
            }}
            title={`Info öffnen: ${selected}${formKey ? ` (${formLabel(formKey)})` : ""}`}
            style={{
              border: "none",
              background: "transparent",
              padding: 0,
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
            }}
          >
            <img
              src={sprite || `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${dexId}.png`}
              alt={selected}
              style={{ height: "60px" }}
            />
          </button>
        )}
      </div>
    </td>
  );
})}

                  <td>
                    <div className="encounter-status-cell">
                      <EncounterStatusSelect
                        value={status || ""}
                        allFilled={allFilled}
                        onChange={(nextStatus) => handleChange(loc, "status", nextStatus)}
                      />

                      {getStatusIcon(status)}
                    </div>
                  </td>

                  {/* ✅ NEU: Sündiger */}
                  <td>
                    <EncounterSinnerSelect
                      value={sinnerKey || ""}
                      disabled={!sinnerEnabled}
                      options={sinnerOptions}
                      onChange={(nextSinner) => handleChange(loc, "sinner", nextSinner)}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
            </div>

      {confirmModal && (
        <div
          onClick={() => setConfirmModal(null)}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 999999,
            background: "rgba(0,0,0,0.72)",
            backdropFilter: "blur(8px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "420px",
              maxWidth: "92vw",
              minHeight: "180px",
              borderRadius: 18,
              border: "1px solid rgba(255,255,255,0.16)",
              background: "#111827",
              boxShadow: "0 30px 90px rgba(0,0,0,0.65)",
              padding: 22,
              color: "#ffffff",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
            }}
          >
            <div>
              <h2 style={{ margin: 0, marginBottom: 12, color: "#fff", fontSize: 24 }}>
                {confirmModal === "reset" ? "Alles zurücksetzen?" : "Liste leeren?"}
              </h2>

              <p style={{ margin: 0, color: "rgba(255,255,255,0.9)", lineHeight: 1.5 }}>
                {confirmModal === "reset"
                  ? "Alle Daten werden gelöscht, inklusive der gesamten Sündiger-Zahlen."
                  : "Nur die Encounter-Liste wird geleert. Die gesamten Sündiger-Zahlen bleiben erhalten."}
              </p>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 22 }}>
              <button
                onClick={() => setConfirmModal(null)}
                style={{
                  padding: "10px 14px",
                  borderRadius: 12,
                  border: "1px solid rgba(255,255,255,0.14)",
                  background: "rgba(255,255,255,0.06)",
                  color: "white",
                  cursor: "pointer",
                  fontWeight: 800,
                }}
              >
                Abbrechen
              </button>

              <button
                onClick={confirmAction}
                style={{
                  padding: "10px 14px",
                  borderRadius: 12,
                  border: "none",
                  background: confirmModal === "reset" ? "#b91c1c" : "#d97706",
                  color: "white",
                  cursor: "pointer",
                  fontWeight: 900,
                }}
              >
                Bestätigen
              </button>
            </div>
          </div>
        </div>
            )}
      
            {editStatsModal.open && (
        <div
          onClick={closeEditStatsModal}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 999999,
            background: "rgba(0,0,0,0.72)",
            backdropFilter: "blur(8px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "520px",
              maxWidth: "94vw",
              borderRadius: 18,
              border: "1px solid rgba(255,255,255,0.16)",
              background: "#111827",
              boxShadow: "0 30px 90px rgba(0,0,0,0.65)",
              padding: 22,
              color: "#ffffff",
              display: "flex",
              flexDirection: "column",
              gap: 14,
            }}
          >
            <h2 style={{ margin: 0 }}>Run- und Sünden-Zähler bearbeiten</h2>

            <p style={{ margin: 0, color: "rgba(255,255,255,0.82)" }}>
              Diese Werte werden gespeichert. Im Duo sehen alle Spieler sofort dieselben Zahlen.
            </p>

            <div style={{ display: "grid", gap: 8 }}>
              <label style={{ fontWeight: 800 }}>Run-Counter</label>
              <input
                type="number"
                min="0"
                value={editStatsModal.runCounter}
                onChange={(e) =>
                  setEditStatsModal((prev) => ({
                    ...prev,
                    runCounter: e.target.value,
                  }))
                }
                style={modalNumberInput}
              />
            </div>

            <div style={{ display: "grid", gap: 12, marginTop: 4 }}>
              {sinnerOptions.map((opt) => {
                const row = editStatsModal.sinnerStats?.[opt.key] || { escaped: 0, fainted: 0 };

                return (
                  <div
                    key={opt.key}
                    style={{
                      border: "1px solid rgba(255,255,255,0.12)",
                      borderRadius: 14,
                      padding: 12,
                      background: "rgba(255,255,255,0.04)",
                    }}
                  >
                    <div style={{ fontWeight: 900, marginBottom: 10 }}>{opt.label}</div>

                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr",
                        gap: 10,
                      }}
                    >
                      <div style={{ display: "grid", gap: 6 }}>
                        <label
                          style={{
                            fontSize: 13,
                            opacity: 0.9,
                            display: "flex",
                            alignItems: "center",
                            gap: 6,
                          }}
                        >
                          <StatusIcon status="Entkommen" size={14} />
                          Entkommen
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={row.escaped}
                          onChange={(e) =>
                            setEditStatsModal((prev) => ({
                              ...prev,
                              sinnerStats: {
                                ...prev.sinnerStats,
                                [opt.key]: {
                                  ...(prev.sinnerStats?.[opt.key] || {}),
                                  escaped: e.target.value,
                                },
                              },
                            }))
                          }
                          style={modalNumberInput}
                        />
                      </div>

                      <div style={{ display: "grid", gap: 6 }}>
                        <label
                          style={{
                            fontSize: 13,
                            opacity: 0.9,
                            display: "flex",
                            alignItems: "center",
                            gap: 6,
                          }}
                        >
                          <StatusIcon status="Besiegt" size={14} />
                          Besiegt
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={row.fainted}
                          onChange={(e) =>
                            setEditStatsModal((prev) => ({
                              ...prev,
                              sinnerStats: {
                                ...prev.sinnerStats,
                                [opt.key]: {
                                  ...(prev.sinnerStats?.[opt.key] || {}),
                                  fainted: e.target.value,
                                },
                              },
                            }))
                          }
                          style={modalNumberInput}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 6 }}>
              <button
                onClick={closeEditStatsModal}
                style={{
                  padding: "10px 14px",
                  borderRadius: 12,
                  border: "1px solid rgba(255,255,255,0.14)",
                  background: "rgba(255,255,255,0.06)",
                  color: "white",
                  cursor: "pointer",
                  fontWeight: 800,
                }}
              >
                Abbrechen
              </button>

              <button
                onClick={saveEditStatsModal}
                style={{
                  padding: "10px 14px",
                  borderRadius: 12,
                  border: "none",
                  background: "#079e4b",
                  color: "white",
                  cursor: "pointer",
                  fontWeight: 900,
                }}
              >
                Speichern
              </button>
            </div>
          </div>
        </div>
      )}

      {slotNameModal.open && (
        <div
          onClick={() => setSlotNameModal({ open: false, index: null, value: "" })}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 999999,
            background: "rgba(0,0,0,0.72)",
            backdropFilter: "blur(8px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "420px",
              maxWidth: "92vw",
              borderRadius: 18,
              border: "1px solid rgba(255,255,255,0.16)",
              background: "#111827",
              boxShadow: "0 30px 90px rgba(0,0,0,0.65)",
              padding: 22,
              color: "#ffffff",
              display: "flex",
              flexDirection: "column",
              gap: 14,
            }}
          >
            <h2 style={{ margin: 0 }}>
              Name für Spalte {Number(slotNameModal.index) + 1}
            </h2>

            <p style={{ margin: 0, color: "rgba(255,255,255,0.82)" }}>
              Gib den Spielernamen für diese Spalte ein.
            </p>

            <input
              autoFocus
              value={slotNameModal.value}
              onChange={(e) =>
                setSlotNameModal((prev) => ({
                  ...prev,
                  value: e.target.value,
                }))
              }
              onKeyDown={(e) => {
                if (e.key === "Enter") saveSlotName();
                if (e.key === "Escape") {
                  setSlotNameModal({ open: false, index: null, value: "" });
                }
              }}
              style={{
                width: "100%",
                padding: "12px 14px",
                borderRadius: 12,
                border: "1px solid rgba(255,255,255,0.14)",
                background: "rgba(255,255,255,0.06)",
                color: "white",
                outline: "none",
                boxSizing: "border-box",
              }}
              placeholder="z. B. Achim"
            />

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button
                onClick={() => setSlotNameModal({ open: false, index: null, value: "" })}
                style={{
                  padding: "10px 14px",
                  borderRadius: 12,
                  border: "1px solid rgba(255,255,255,0.14)",
                  background: "rgba(255,255,255,0.06)",
                  color: "white",
                  cursor: "pointer",
                  fontWeight: 800,
                }}
              >
                Abbrechen
              </button>

              <button
                onClick={saveSlotName}
                style={{
                  padding: "10px 14px",
                  borderRadius: 12,
                  border: "none",
                  background: "#079e4b",
                  color: "white",
                  cursor: "pointer",
                  fontWeight: 900,
                }}
              >
                Speichern
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default EncounterTable;

/* =======================
   Styles (Background + Glass)
======================= */

const pageWrap = (dark) => ({
  position: "relative",
  minHeight: "100vh",
  padding: "22px 18px",
  overflowX: "hidden",
  background: dark ? "#050914" : "#07111f",
});

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

const bgOverlay = {
  position: "fixed",
  inset: 0,
  zIndex: 1,
  background:
    "radial-gradient(900px 520px at 18% 8%, rgba(66, 153, 225, 0.16), transparent 62%), radial-gradient(760px 520px at 84% 12%, rgba(67, 233, 123, 0.11), transparent 64%), linear-gradient(180deg, rgba(3, 7, 18, 0.55), rgba(3, 7, 18, 0.86))",
};

const contentCard = (dark) => ({
  position: "relative",
  zIndex: 2,
  maxWidth: 1460,
  margin: "0 auto",
  padding: 20,
  borderRadius: 26,
  border: "1px solid rgba(180, 205, 255, 0.14)",
  background:
    "linear-gradient(145deg, rgba(15, 23, 42, 0.76), rgba(5, 9, 20, 0.66))",
  backdropFilter: "blur(14px)",
  boxShadow:
    "0 30px 90px rgba(0, 0, 0, 0.46), inset 0 1px 0 rgba(255, 255, 255, 0.10)",
  color: "#ffffff",
});

/* Titel + Buttons */
const encounterTitleBlock = {
  width: "100%",
  display: "flex",
  justifyContent: "center",
  marginTop: 8,
  marginBottom: 10,
  padding: "0 12px",
};

const encounterTableTitle = {
  margin: 0,
  maxWidth: 980,
  textAlign: "center",
  lineHeight: 1.08,
  overflowWrap: "anywhere",
  wordBreak: "normal",
};

const headerRow = {
  display: "flex",
  alignItems: "center",
  justifyContent: "flex-end",
  gap: 12,
  marginTop: -20,
  marginBottom: -30,
  minHeight: 34,
};

const topRightActions = {
  display: "flex",
  alignItems: "center",
  justifyContent: "flex-end",
  gap: 10,
  flexWrap: "wrap",
};

/* Level-Cap */
const levelCapBanner = (dark) => ({
  margin: "10px auto 14px auto",
  maxWidth: 300,
  padding: "10px 14px",
  borderRadius: 12,
  textAlign: "center",
  border: "1px solid rgba(67, 233, 123, 0.28)",
  background:
    "linear-gradient(135deg, rgba(7, 158, 75, 0.22), rgba(56, 249, 215, 0.08)), rgba(5, 12, 26, 0.54)",
  backdropFilter: "blur(12px)",
  boxShadow:
    "0 18px 46px rgba(0, 0, 0, 0.28), inset 0 1px 0 rgba(255, 255, 255, 0.08)",
});

const megaBtn = (dark, active) => ({
  padding: "8px 10px",
  borderRadius: 12,
  border: active ? "1px solid rgba(255,255,255,0.22)" : "1px solid rgba(255,255,255,0.14)",
  background: active
    ? "linear-gradient(135deg, rgba(161,76,255,0.35), rgba(255,76,160,0.22))"
    : dark
    ? "rgba(255,255,255,0.06)"
    : "rgba(0,0,0,0.06)",
  color: dark ? "white" : "black",
  cursor: "pointer",
  fontWeight: 950,
  whiteSpace: "nowrap",
});

/* ✅ Sprite als Button ohne "Button-Look" */
const spriteBtn = {
  border: "none",
  background: "transparent",
  padding: 0,
  margin: 0,
  display: "inline-flex",
  alignItems: "center",
  cursor: "pointer",
};

/* ✅ Sünden-Zähler Box */
const sinnerStatsBox = (dark) => ({
  margin: "0 auto 10px auto",
  maxWidth: 520,
  padding: "0 14px",
  borderRadius: 0,
  textAlign: "center",
  border: "none",
  background: "transparent",
  backdropFilter: "none",
  boxShadow: "none",
});

const sinnerStatPill = (dark) => ({
  padding: "8px 10px",
  borderRadius: 10,
  border: "1px solid rgba(140, 165, 210, 0.22)",
  background:
    "linear-gradient(135deg, rgba(70, 105, 165, 0.14), rgba(28, 42, 74, 0.12)), rgba(7, 12, 26, 0.42)",
  minWidth: 170,
  boxShadow: "inset 0 1px 0 rgba(255, 255, 255, 0.06)",
});

const tableCss = (dark) => {
  return `
    .encounter-page,
    .encounter-page * {
      box-sizing: border-box;
    }

    .encounter-page {
      color: rgba(255, 255, 255, 0.90);
    }

    .encounter-page::-webkit-scrollbar,
    .encounter-page *::-webkit-scrollbar {
      display: none;
    }

    .encounter-page,
    .encounter-page * {
      scrollbar-width: none;
      -ms-overflow-style: none;
    }

    .encounter-page h1 {
      color: #ffffff !important;
      text-shadow: 3px 3px #079e4b;
      letter-spacing: -0.03em;
    }

    .encounter-page button {
      margin: 0 !important;
      border-radius: 8px !important;
      border: 1px solid rgba(120, 155, 220, 0.42);
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

    .encounter-page button:hover,
    .encounter-page button:focus-visible {
      transform: translateY(-2px);
      border-color: rgba(165, 195, 255, 0.62);
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

    .encounter-page button[title^="Info öffnen:"] {
      appearance: none !important;
      min-width: 0 !important;
      min-height: 0 !important;
      width: auto !important;
      height: auto !important;
      padding: 0 !important;
      margin: 0 !important;
      border: 0 !important;
      border-radius: 0 !important;
      background: transparent !important;
      box-shadow: none !important;
      outline: none !important;
      display: inline-flex !important;
      align-items: center !important;
      justify-content: center !important;
      cursor: pointer;
      filter: none !important;
    }

    .encounter-page button[title^="Info öffnen:"]:hover,
    .encounter-page button[title^="Info öffnen:"]:focus-visible {
      transform: none !important;
      border: 0 !important;
      background: transparent !important;
      box-shadow: none !important;
      outline: none !important;
      filter: none !important;
    }

    .encounter-page button[title^="Info öffnen:"] img {
      display: block;
      transition: transform 140ms ease, filter 140ms ease;
      filter: drop-shadow(0 8px 14px rgba(0, 0, 0, 0.24));
    }

    .encounter-page button[title^="Info öffnen:"]:hover img,
    .encounter-page button[title^="Info öffnen:"]:focus-visible img {
      transform: scale(1.06);
      filter:
        drop-shadow(0 10px 18px rgba(0, 0, 0, 0.30))
        drop-shadow(0 0 10px rgba(120, 165, 255, 0.12));
    }
        
    .encounter-page .button-row {
      width: fit-content;
      max-width: 100%;
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
      justify-content: center;
      align-items: center;
      margin: 12px auto 14px !important;
      padding: 8px 10px;
      border-radius: 14px;
      border: 1px solid rgba(180, 205, 255, 0.10);
      background: rgba(5, 10, 24, 0.30);
      backdrop-filter: blur(10px);
    }

    .encounter-page .button-row button {
      min-height: 40px;
      padding: 9px 15px !important;
    }

    .encounter-page .encounter-filter-button {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 7px;
      min-height: 38px;
      padding: 8px 14px !important;
      border-radius: 8px !important;
      border-color: rgba(140, 165, 210, 0.28) !important;
      background:
        linear-gradient(135deg, rgba(45, 62, 96, 0.16), rgba(10, 16, 32, 0.32)),
        rgba(6, 11, 24, 0.52) !important;
      color: rgba(255, 255, 255, 0.76) !important;
      box-shadow:
        0 8px 18px rgba(0, 0, 0, 0.14),
        inset 0 1px 0 rgba(255, 255, 255, 0.06) !important;
    }

    .encounter-page .encounter-filter-button::before {
      content: "";
      width: 6px;
      height: 6px;
      border-radius: 999px;
      background: rgba(255, 255, 255, 0.30);
      box-shadow: none;
    }

    .encounter-page .encounter-filter-button-active {
      border-color: rgba(67, 233, 123, 0.26) !important;
      background:
        linear-gradient(135deg, rgba(20, 84, 67, 0.22), rgba(10, 18, 32, 0.34)),
        rgba(6, 13, 25, 0.56) !important;
      color: rgba(231, 255, 242, 0.92) !important;
    }

    .encounter-page .encounter-filter-button-active::before {
      background: rgba(67, 233, 123, 0.86);
      box-shadow: 0 0 10px rgba(67, 233, 123, 0.20);
    }
      
    .encounter-page .encounter-filter-button-warn {
      border-color: rgba(255, 185, 80, 0.22) !important;
      background:
        linear-gradient(135deg, rgba(110, 78, 24, 0.18), rgba(10, 16, 32, 0.32)),
        rgba(6, 11, 24, 0.52) !important;
      color: rgba(255, 244, 224, 0.90) !important;
    }

    .encounter-page .encounter-filter-button-warn::before {
      background: rgba(255, 185, 80, 0.82);
      box-shadow: 0 0 10px rgba(255, 185, 80, 0.16);
    }

    .encounter-page .encounter-filter-button-danger {
      border-color: rgba(255, 110, 130, 0.22) !important;
      background:
        linear-gradient(135deg, rgba(110, 34, 46, 0.18), rgba(10, 16, 32, 0.32)),
        rgba(6, 11, 24, 0.52) !important;
      color: rgba(255, 232, 236, 0.90) !important;
    }

    .encounter-page .encounter-filter-button-danger::before {
      background: rgba(255, 110, 130, 0.82);
      box-shadow: 0 0 10px rgba(255, 110, 130, 0.16);
    }

    .encounter-page .button-row select,
    .encounter-page select {
      min-height: 40px;
      border-radius: 8px;
      border: 1px solid rgba(140, 165, 210, 0.34);
      background:
        linear-gradient(135deg, rgba(14, 23, 42, 0.88), rgba(8, 13, 28, 0.86));
      color: #ffffff;
      font-weight: 850;
      outline: none;
      box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.06);
      backdrop-filter: blur(10px);
    }

    .encounter-page .encounter-status-cell {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .encounter-page .encounter-status-cell img {
      margin-left: 0 !important;
    }

    .encounter-page .encounter-custom-select {
      position: relative;
      width: 150px;
      z-index: 20;
    }

    .encounter-page .encounter-status-select {
      width: 166px;
    }

    .encounter-page .encounter-custom-select-open {
      z-index: 999999;
    }

    .encounter-page .encounter-sinner-select {
      width: 154px;
    }

    .encounter-page .encounter-sinner-select .encounter-custom-select-menu {
      min-width: 154px;
    }

    .encounter-page .encounter-sinner-select .encounter-custom-select-trigger {
      padding: 9px 12px !important;
    }

    .encounter-page .encounter-sinner-select .encounter-custom-select-option {
      min-height: 40px !important;
      padding: 10px 12px !important;
    }

    .encounter-page .encounter-custom-select-disabled {
      opacity: 0.42;
      pointer-events: none;
    }

    .encounter-page .encounter-custom-select-trigger {
      width: 100%;
      min-height: 40px !important;
      padding: 8px 11px !important;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      border-radius: 8px !important;
      border: 1px solid rgba(140, 165, 210, 0.34) !important;
      background:
        linear-gradient(135deg, rgba(14, 23, 42, 0.92), rgba(8, 13, 28, 0.88)) !important;
      color: rgba(255, 255, 255, 0.92) !important;
      box-shadow:
        inset 0 1px 0 rgba(255, 255, 255, 0.07),
        0 8px 18px rgba(0, 0, 0, 0.14) !important;
    }

    .encounter-page .encounter-custom-select-trigger:hover,
    .encounter-page .encounter-custom-select-trigger:focus-visible {
      transform: none !important;
      border-color: rgba(165, 195, 255, 0.56) !important;
      outline: none;
    }

    .encounter-page .encounter-custom-select-trigger-open {
      border-color: rgba(126, 165, 255, 0.72) !important;
      box-shadow:
        0 0 0 2px rgba(90, 130, 220, 0.18),
        0 0 18px rgba(120, 165, 255, 0.12),
        inset 0 1px 0 rgba(255, 255, 255, 0.08) !important;
    }

    .encounter-page .encounter-custom-select-label {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      min-width: 0;
      max-width: 100%;
      font-weight: 900;
      line-height: 1.1;
      white-space: nowrap;
    }

    .encounter-page .encounter-custom-select-text {
      display: block;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .encounter-page .encounter-custom-select-dot {
      width: 6px;
      height: 6px;
      border-radius: 999px;
      flex: 0 0 auto;
      background: rgba(255, 255, 255, 0.34);
    }

    .encounter-page .encounter-status-dot-Gefangen {
      background: rgba(67, 233, 123, 0.90);
      box-shadow: 0 0 10px rgba(67, 233, 123, 0.20);
    }

    .encounter-page .encounter-status-dot-Besiegt {
      background: rgba(255, 110, 130, 0.86);
      box-shadow: 0 0 10px rgba(255, 110, 130, 0.16);
    }

    .encounter-page .encounter-status-dot-Entkommen {
      background: rgba(255, 185, 80, 0.86);
      box-shadow: 0 0 10px rgba(255, 185, 80, 0.16);
    }

    .encounter-page .encounter-sinner-dot-empty {
      background: rgba(255, 255, 255, 0.24);
    }

    .encounter-page .encounter-sinner-dot-p1 {
      background: rgba(135, 170, 255, 0.88);
      box-shadow: 0 0 10px rgba(135, 170, 255, 0.16);
    }

    .encounter-page .encounter-sinner-dot-p2 {
      background: rgba(190, 135, 255, 0.88);
      box-shadow: 0 0 10px rgba(190, 135, 255, 0.16);
    }

    .encounter-page .encounter-sinner-dot-p3 {
      background: rgba(255, 185, 80, 0.88);
      box-shadow: 0 0 10px rgba(255, 185, 80, 0.16);
    }

    .encounter-page .encounter-custom-select-arrow {
      width: 9px;
      height: 9px;
      display: inline-block;
      flex: 0 0 auto;
      border-right: 2px solid rgba(255, 255, 255, 0.72);
      border-bottom: 2px solid rgba(255, 255, 255, 0.72);
      transform: rotate(45deg) translateY(-1px);
      transform-origin: center;
      opacity: 0.88;
      transition:
        transform 160ms ease,
        opacity 160ms ease,
        border-color 160ms ease;
      margin-right: 2px;
    }

    .encounter-page .encounter-custom-select-trigger-open .encounter-custom-select-arrow {
      transform: rotate(225deg) translateY(1px);
      opacity: 1;
      border-right-color: rgba(210, 228, 255, 0.96);
      border-bottom-color: rgba(210, 228, 255, 0.96);
    }

    .encounter-page .encounter-custom-select-menu {
      position: absolute;
      left: 0;
      right: 0;
      top: calc(100% + 6px);
      z-index: 999999;
      padding: 6px;
      border-radius: 10px;
      border: 1px solid rgba(140, 165, 210, 0.30);
      background:
        linear-gradient(145deg, rgba(10, 16, 32, 0.99), rgba(5, 9, 20, 0.99));
      box-shadow:
        0 20px 50px rgba(0, 0, 0, 0.56),
        inset 0 1px 0 rgba(255, 255, 255, 0.08);
      backdrop-filter: blur(14px);
      overflow: hidden;
    }

    .encounter-page td {
      overflow: visible;
    }

    .encounter-page tr {
      position: relative;
    }

    .encounter-page .encounter-custom-select-option {
      width: 100%;
      min-height: 34px !important;
      margin: 0 0 4px 0 !important;
      padding: 8px 10px !important;
      display: flex;
      align-items: center;
      justify-content: flex-start;
      border-radius: 7px !important;
      border: 1px solid transparent !important;
      background: transparent !important;
      color: rgba(255, 255, 255, 0.82) !important;
      text-align: left;
      box-shadow: none !important;
    }

    .encounter-page .encounter-custom-select-option:last-child {
      margin-bottom: 0 !important;
    }

    .encounter-page .encounter-custom-select-option:hover,
    .encounter-page .encounter-custom-select-option:focus-visible {
      transform: none !important;
      border-color: rgba(140, 165, 210, 0.22) !important;
      background: rgba(120, 165, 255, 0.12) !important;
      outline: none;
    }

    .encounter-page .encounter-custom-select-option-active {
      border-color: rgba(67, 233, 123, 0.20) !important;
      background:
        linear-gradient(135deg, rgba(20, 84, 67, 0.22), rgba(10, 18, 32, 0.28)) !important;
      color: rgba(231, 255, 242, 0.95) !important;
    }

    .encounter-page input {
      border-radius: 8px;
      border: 1px solid rgba(140, 165, 210, 0.34);
      background:
        linear-gradient(135deg, rgba(14, 23, 42, 0.88), rgba(8, 13, 28, 0.86));
      color: #ffffff;
      font-weight: 800;
      outline: none;
    }

    .encounter-page input:focus,
    .encounter-page select:focus {
      border-color: rgba(126, 165, 255, 0.72);
      box-shadow:
        0 0 0 2px rgba(90, 130, 220, 0.18),
        0 0 18px rgba(120, 165, 255, 0.12);
    }

    .encounter-page table {
      width: 100%;
      border-collapse: separate;
      border-spacing: 0;
      overflow: visible;
      border-radius: 18px;
      border: 1px solid rgba(180, 205, 255, 0.12);
      background:
        linear-gradient(145deg, rgba(9, 15, 32, 0.76), rgba(5, 9, 20, 0.70));
      backdrop-filter: blur(12px);
      box-shadow:
        0 24px 70px rgba(0, 0, 0, 0.34),
        inset 0 1px 0 rgba(255, 255, 255, 0.08);
    }

    .encounter-page thead th {
      position: sticky;
      top: 0;
      z-index: 4;
      background:
        linear-gradient(135deg, rgba(21, 33, 58, 0.96), rgba(9, 16, 34, 0.96));
      color: rgba(255, 255, 255, 0.94);
      font-weight: 950;
      letter-spacing: 0.01em;
      text-shadow: none;
    }

    .encounter-page td,
    .encounter-page th {
      border: 0 !important;
      padding: 11px 12px;
      vertical-align: middle;
    }

    /* Innere vertikale Linien */
    .encounter-page th + th,
    .encounter-page td + td {
      border-left: 2px solid rgba(180, 205, 255, 0.08) !important;
    }

    /* Trennlinie zwischen Header und Body */
    .encounter-page tbody tr:first-child td {
      border-top: 2px solid rgba(180, 205, 255, 0.09) !important;
    }

    /* Innere horizontale Linien */
    .encounter-page tbody tr + tr td {
      border-top: 2px solid rgba(180, 205, 255, 0.08) !important;
    }

    .encounter-page tbody tr {
      background: rgba(5, 10, 24, 0.38);
      transition:
        background 160ms ease,
        filter 160ms ease;
    }

    .encounter-page tbody tr:nth-child(even) {
      background: rgba(10, 18, 36, 0.34);
    }

    .encounter-page tbody tr:hover td {
      background: rgba(120, 165, 255, 0.055);
    }

    .encounter-page tr[data-status="Gefangen"],
    .encounter-page tr[data-status="Gefangen"] td {
      background:
        linear-gradient(135deg, rgba(7, 158, 75, 0.30), rgba(7, 158, 75, 0.12)) !important;
    }

    .encounter-page tr[data-status="Besiegt"],
    .encounter-page tr[data-status="Besiegt"] td {
      background:
        linear-gradient(135deg, rgba(185, 28, 28, 0.30), rgba(185, 28, 28, 0.12)) !important;
    }

    .encounter-page tr[data-status="Entkommen"],
    .encounter-page tr[data-status="Entkommen"] td {
      background:
        linear-gradient(135deg, rgba(118, 128, 145, 0.28), rgba(45, 52, 66, 0.22)) !important;
      color: rgba(235, 240, 248, 0.78);
    }

    .encounter-page tr[data-status="Entkommen"] td:first-child {
      color: rgba(235, 240, 248, 0.66);
      font-style: italic;
    }

    .encounter-page .unused-location td:first-child {
      color: rgba(255, 255, 255, 0.52);
      font-style: italic;
    }

    .encounter-page img {
      image-rendering: auto;
    }

    .encounter-mobile-list {
      display: none;
    }

    @media (max-width: 900px) {
      .encounter-page {
        overflow-x: hidden;
      }

      .encounter-page table {
        min-width: 980px;
      }

      .encounter-page .button-row {
        justify-content: flex-start;
      }
    }

    @media (max-width: 760px), (max-width: 980px) and (max-height: 560px) and (orientation: landscape) {
      .encounter-page {
        min-height: 100dvh;
        padding: 10px 8px 26px !important;
        overflow-x: hidden !important;
        overflow-y: auto !important;
      }

      .encounter-content-card {
        width: 100% !important;
        padding: 12px !important;
        border-radius: 18px !important;
      }

      .encounter-page h1 {
        font-size: clamp(1.65rem, 8vw, 2.35rem) !important;
        line-height: 0.95 !important;
        text-shadow: 2px 2px #079e4b !important;
      }

      .encounter-header-actions-row {
        margin: 8px 0 10px !important;
        min-height: 0 !important;
        justify-content: stretch !important;
      }

      .encounter-top-actions {
        width: 100% !important;
        display: grid !important;
        grid-template-columns: 1fr 1fr !important;
        gap: 8px !important;
      }

      .encounter-top-actions button {
        min-height: 40px !important;
        padding: 8px 10px !important;
        font-size: 0.82rem !important;
      }

      .encounter-page .button-row {
        width: 100% !important;
        display: grid !important;
        grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
        gap: 8px !important;
        padding: 8px !important;
        margin: 10px 0 12px !important;
      }

      .encounter-page .button-row button,
      .encounter-page .button-row select {
        width: 100% !important;
        min-height: 39px !important;
        padding: 8px 9px !important;
        font-size: 0.78rem !important;
      }

      .encounter-desktop-table {
        display: none !important;
      }

      .encounter-mobile-list {
        display: grid;
        gap: 12px;
      }

      .encounter-mobile-card {
        position: relative;
        overflow: visible;
        padding: 12px;
        border-radius: 18px;
        border: 1px solid rgba(180, 205, 255, 0.14);
        background:
          linear-gradient(145deg, rgba(12, 22, 42, 0.82), rgba(5, 10, 24, 0.78));
        box-shadow:
          0 16px 38px rgba(0, 0, 0, 0.28),
          inset 0 1px 0 rgba(255, 255, 255, 0.07);
      }

      .encounter-mobile-card[data-status="Gefangen"] {
        border-color: rgba(67, 233, 123, 0.24);
        background:
          linear-gradient(145deg, rgba(7, 158, 75, 0.26), rgba(5, 10, 24, 0.78));
      }

      .encounter-mobile-card[data-status="Besiegt"] {
        border-color: rgba(255, 110, 130, 0.22);
        background:
          linear-gradient(145deg, rgba(185, 28, 28, 0.26), rgba(5, 10, 24, 0.78));
      }

      .encounter-mobile-card[data-status="Entkommen"] {
        border-color: rgba(180, 190, 210, 0.16);
        background:
          linear-gradient(145deg, rgba(95, 105, 124, 0.22), rgba(5, 10, 24, 0.78));
      }

      .encounter-mobile-card-head {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 10px;
        margin-bottom: 10px;
      }

      .encounter-mobile-card-title-wrap {
        min-width: 0;
      }

      .encounter-mobile-location {
        color: #ffffff;
        font-size: 1.08rem;
        font-weight: 1000;
        line-height: 1.08;
        overflow-wrap: anywhere;
      }

      .encounter-mobile-meta {
        margin-top: 3px;
        color: rgba(235, 241, 250, 0.64);
        font-size: 0.78rem;
        font-weight: 850;
      }

      .encounter-mobile-status-icon {
        width: 38px;
        height: 38px;
        flex: 0 0 38px;
        display: grid;
        place-items: center;
        border-radius: 13px;
        border: 1px solid rgba(180, 205, 255, 0.12);
        background: rgba(0, 0, 0, 0.16);
      }

      .encounter-mobile-open-dot {
        width: 9px;
        height: 9px;
        border-radius: 999px;
        background: rgba(255, 255, 255, 0.34);
      }

      .encounter-mobile-slots {
        display: grid;
        gap: 10px;
      }

      .encounter-mobile-slot {
        padding: 10px;
        border-radius: 14px;
        border: 1px solid rgba(180, 205, 255, 0.10);
        background: rgba(5, 10, 24, 0.32);
      }

      .encounter-mobile-slot-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        margin-bottom: 8px;
        color: rgba(235, 241, 250, 0.78);
        font-size: 0.78rem;
        font-weight: 950;
        text-transform: uppercase;
        letter-spacing: 0.06em;
      }

      .encounter-mobile-edit-button {
        width: 30px !important;
        height: 30px !important;
        min-height: 30px !important;
        padding: 0 !important;
        border-radius: 9px !important;
        display: inline-flex !important;
        align-items: center !important;
        justify-content: center !important;
      }

      .encounter-mobile-edit-button svg {
        display: block !important;
        margin: 0 auto !important;
      }

      .encounter-mobile-pokemon-row {
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        gap: 8px;
        align-items: center;
      }

      .encounter-mobile-select-wrap {
        min-width: 0;
      }

      .encounter-mobile-form-button {
        max-width: 92px;
        min-height: 38px !important;
        padding: 7px 9px !important;
        font-size: 0.76rem !important;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .encounter-mobile-sprite-button {
        grid-column: 2;
        width: 46px !important;
        height: 46px !important;
        min-height: 46px !important;
        padding: 0 !important;
      }

      .encounter-mobile-sprite {
        width: 44px !important;
        height: 44px !important;
        object-fit: contain;
      }

      .encounter-mobile-fossil-row {
        margin-top: 8px;
        display: grid;
        grid-template-columns: 58px minmax(0, 1fr);
        gap: 8px;
        align-items: center;
      }

      .encounter-mobile-fossil-row span {
        color: rgba(235, 241, 250, 0.66);
        font-size: 0.76rem;
        font-weight: 900;
      }

      .encounter-mobile-fossil-row select {
        width: 100%;
        min-height: 38px;
        padding: 7px 9px;
        border-radius: 10px;
      }

      .encounter-mobile-bottom {
        margin-top: 10px;
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 8px;
      }

      .encounter-mobile-field {
        min-width: 0;
        display: grid;
        gap: 6px;
      }

      .encounter-mobile-field > span {
        color: rgba(235, 241, 250, 0.66);
        font-size: 0.75rem;
        font-weight: 950;
      }

      .encounter-mobile-card .encounter-custom-select,
      .encounter-mobile-card .encounter-status-select,
      .encounter-mobile-card .encounter-sinner-select {
        width: 100% !important;
      }

      .encounter-mobile-card .encounter-custom-select-trigger {
        min-height: 38px !important;
        padding: 8px 10px !important;
      }

      .encounter-mobile-card .encounter-custom-select-menu {
        min-width: 100% !important;
      }
    }

    @media (max-width: 980px) and (max-height: 560px) and (orientation: landscape) {
      .encounter-content-card {
        padding: 10px !important;
      }

      .encounter-page h1 {
        font-size: clamp(1.4rem, 4.6vw, 2rem) !important;
      }

      .encounter-page .button-row {
        grid-template-columns: repeat(4, minmax(0, 1fr)) !important;
      }

      .encounter-mobile-list {
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 10px;
      }

      .encounter-mobile-card {
        padding: 10px;
      }

      .encounter-mobile-slot {
        padding: 9px;
      }

      .encounter-mobile-bottom {
        grid-template-columns: 1fr 1fr;
      }
    }

    @media (max-width: 390px), (max-width: 700px) and (max-height: 430px) and (orientation: landscape) {
      .encounter-top-actions,
      .encounter-page .button-row,
      .encounter-mobile-bottom {
        grid-template-columns: 1fr !important;
      }

      .encounter-mobile-pokemon-row {
        grid-template-columns: minmax(0, 1fr) auto;
      }

      .encounter-mobile-form-button {
        grid-column: 1 / -1;
        max-width: none;
        width: 100%;
      }
    }
  `;
};

const editIconBtn = {
  width: 38,
  height: 38,
  padding: 0,
  borderRadius: 10,
  border: "1px solid rgba(150, 180, 235, 0.34)",
  background:
    "linear-gradient(145deg, rgba(42, 58, 92, 0.52), rgba(8, 14, 30, 0.54))",
  color: "white",
  cursor: "pointer",
  fontSize: 14,
  fontWeight: 900,
  lineHeight: 1,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  boxShadow:
    "0 10px 22px rgba(0, 0, 0, 0.18), inset 0 1px 0 rgba(255, 255, 255, 0.10)",
};

const smallEditIconBtn = {
  width: 28,
  height: 28,
  padding: 0,
  borderRadius: 9,
  border: "1px solid rgba(150, 180, 235, 0.30)",
  background:
    "linear-gradient(145deg, rgba(42, 58, 92, 0.48), rgba(8, 14, 30, 0.50))",
  color: "white",
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  boxShadow:
    "0 8px 18px rgba(0, 0, 0, 0.16), inset 0 1px 0 rgba(255, 255, 255, 0.09)",
};

const runCounterCard = (dark) => ({
  margin: "0 auto",
  maxWidth: 130,
  padding: "10px 12px",
  borderRadius: 10,
  textAlign: "center",
  border: "1px solid rgba(67, 233, 123, 0.24)",
  background:
    "linear-gradient(135deg, rgba(67, 233, 123, 0.16), rgba(56, 249, 215, 0.06)), rgba(7, 12, 26, 0.44)",
  boxShadow:
    "0 14px 32px rgba(0, 0, 0, 0.22), inset 0 1px 0 rgba(255, 255, 255, 0.08)",
});

const modalNumberInput = {
  width: "100%",
  padding: "12px 14px",
  borderRadius: 8,
  border: "1px solid rgba(140, 165, 210, 0.34)",
  background:
    "linear-gradient(135deg, rgba(14, 23, 42, 0.88), rgba(8, 13, 28, 0.86))",
  color: "white",
  outline: "none",
  boxSizing: "border-box",
  fontWeight: 850,
};