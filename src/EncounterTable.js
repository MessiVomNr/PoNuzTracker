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

function getDexIdFromName(pokemonName, pokedex) {
  const entry = Object.entries(pokedex).find(([, name]) => name === pokemonName);
  if (!entry) return null;
  return entry[0].replace("pokedex", "");
}

// ===== Mega-Form IDs (PokeAPI "pokemon-form" IDs) =====
// formKey: "" | "mega" | "mega-x" | "mega-y"
const MEGA_FORM_IDS = {
  // Gen 1
  3: { mega: 10033 }, // Bisaflor
  6: { "mega-x": 10034, "mega-y": 10035 }, // Glurak
  9: { mega: 10036 }, // Turtok
  15: { mega: 10090 }, // Bibor
  18: { mega: 10073 }, // Tauboss
  65: { mega: 10037 }, // Simsala
  80: { mega: 10071 }, // Lahmus
  94: { mega: 10038 }, // Gengar
  115: { mega: 10039 }, // Kangama
  127: { mega: 10040 }, // Pinsir
  130: { mega: 10041 }, // Garados
  142: { mega: 10042 }, // Aerodactyl
  150: { "mega-x": 10043, "mega-y": 10044 }, // Mewtu

  // Gen 2
  181: { mega: 10045 }, // Ampharos
  208: { mega: 10072 }, // Stahlos
  212: { mega: 10046 }, // Scherox
  214: { mega: 10047 }, // Skaraborn
  229: { mega: 10048 }, // Hundemon
  248: { mega: 10049 }, // Despotar

  // Gen 3
  254: { mega: 10065 }, // Gewaldro
  257: { mega: 10050 }, // Lohgock
  260: { mega: 10064 }, // Sumpex
  282: { mega: 10051 }, // Guardevoir
  303: { mega: 10052 }, // Flunkifer
  306: { mega: 10053 }, // Stolloss
  308: { mega: 10054 }, // Meditalis
  310: { mega: 10055 }, // Voltenso
  319: { mega: 10070 }, // Tohaido
  323: { mega: 10087 }, // Camerupt
  334: { mega: 10067 }, // Altaria
  354: { mega: 10056 }, // Banette
  359: { mega: 10057 }, // Absol
  362: { mega: 10074 }, // Firnontor
  373: { mega: 10089 }, // Brutalanda
  376: { mega: 10076 }, // Metagross

  // Gen 4
  380: { mega: 10062 }, // Latias
  381: { mega: 10063 }, // Latios
  445: { mega: 10058 }, // Knakrack
  448: { mega: 10059 }, // Lucario
  460: { mega: 10060 }, // Rexblisar

  // Gen 5
  531: { mega: 10061 }, // Ohrdoch

  // Gen 6
  719: { mega: 10075 }, // Diancie
};

function getMegaOptionsForDexId(dexId) {
  const id = Number(dexId);
  const forms = MEGA_FORM_IDS[id];
  if (!forms) return [];
  const out = [];
  if (forms.mega) out.push("mega");
  if (forms["mega-x"]) out.push("mega-x");
  if (forms["mega-y"]) out.push("mega-y");
  return out;
}

function nextMegaForm(current, options) {
  if (!options.length) return "";
  // cycle: "" -> first -> second -> ... -> ""
  const idx = options.indexOf(current);
  if (!current || idx === -1) return options[0];
  if (idx === options.length - 1) return "";
  return options[idx + 1];
}

function megaLabel(formKey) {
  if (!formKey) return "Normal";
  if (formKey === "mega") return "Mega";
  if (formKey === "mega-x") return "Mega X";
  if (formKey === "mega-y") return "Mega Y";
  return "Form";
}

function spriteUrlFor(dexId, formKey) {
  const baseId = Number(dexId);
  if (!baseId) return null;

  const forms = MEGA_FORM_IDS[baseId];
  const formId = formKey && forms ? forms[formKey] : null;

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
      if (value !== "Entkommen" && value !== "Besiegt") {
        updated[location].sinner = "";
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
  const usedPokemon = useMemo(() => {
    return new Set(
      Object.values(encounters)
        .flatMap((e) =>
          Object.entries(e)
            .filter(([k]) => k.startsWith("pokemon"))
            .map(([, val]) => val)
        )
        .filter(Boolean)
    );
  }, [encounters]);

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
    const dark = theme === "dark";
    return {
      control: (styles) => ({
        ...styles,
        backgroundColor: dark ? "rgba(0,0,0,0.35)" : "#fff",
        color: dark ? "#fff" : "#000",
        borderColor: dark ? "rgba(255,255,255,0.14)" : "#ccc",
        boxShadow: "none",
        backdropFilter: dark ? "blur(8px)" : "none",
      }),
      input: (styles) => ({
        ...styles,
        color: dark ? "#fff" : "#000",
      }),
      menu: (styles) => ({
        ...styles,
        backgroundColor: dark ? "rgba(10,10,16,0.92)" : "#fff",
        border: dark ? "1px solid rgba(255,255,255,0.14)" : "1px solid #ddd",
        zIndex: 9999,
        backdropFilter: dark ? "blur(10px)" : "none",
      }),
      singleValue: (styles) => ({
        ...styles,
        color: dark ? "#fff" : "#000",
      }),
      option: (styles, { isFocused, isSelected }) => ({
        ...styles,
        backgroundColor: dark
          ? isSelected
            ? "rgba(67,233,123,0.22)"
            : isFocused
            ? "rgba(255,255,255,0.10)"
            : "transparent"
          : isFocused
          ? "#eee"
          : "#fff",
        color: dark ? "#fff" : "#000",
      }),
    };
  };

  const getStatusIcon = (status) => {
    if (status === "Gefangen") {
      return (
        <img
          src={process.env.PUBLIC_URL + "/pokeball.png"}
          alt="Pokéball"
          style={{ height: "28px", verticalAlign: "middle", marginLeft: "8px" }}
        />
      );
    }
    if (status === "Besiegt") return <span style={{ fontSize: "24px", marginLeft: "8px" }}>☠️</span>;
    if (status === "Entkommen") return <span style={{ fontSize: "24px", marginLeft: "8px" }}>👟</span>;
    return "";
  };

  const openInternalPokedex = (baseDexId, formKey, pokemonName) => {
    const baseId = Number(baseDexId);
    if (!baseId) return;

    const forms = MEGA_FORM_IDS[baseId];
    const formId = formKey && forms ? forms[formKey] : null;
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

  const dark = theme === "dark";

  return (
    <div style={pageWrap(dark)}>
      {dark && <div style={bg} />}
      {dark && <div style={bgOverlay} />}

      <div style={contentCard(dark)}>
        <style>{tableCss(dark)}</style>

        {/* Duo Status + Exit */}
        {isDuo && (
          <div style={{ marginBottom: 10 }}>
            <strong style={{ color: "#079e4b" }}>Duo Online aktiv</strong> — Room: <b>{activeDuoRoomId}</b>{" "}
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
        <div style={headerRow}>
          <h1 style={{ marginTop: 6, marginBottom: 0 }}>
            {effectiveEdition} Encounter-Tabelle ({effectiveLinkMode.toUpperCase()})
          </h1>

          <div style={topRightActions}>
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
      marginBottom: 8,
      minHeight: 38,
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
        right: 0,
        top: "50%",
        transform: "translateY(-50%)",
      }}
    >
      ✏️
    </button>
  </div>

          <div style={runCounterCard(dark)}>
            <div style={{ fontWeight: 900, fontSize: 14 }}>Run-Counter</div>
            <div style={{ fontSize: 28, fontWeight: 950, lineHeight: 1.1 }}>{runCounter}</div>
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, justifyContent: "center", marginTop: 12 }}>
            {sinnerStats.map((s) => (
              <div key={s.label} style={sinnerStatPill(dark)}>
                <div style={{ fontWeight: 900 }}>{s.label}</div>
                <div style={{ fontSize: 12, opacity: 0.9 }}>
                  👟 Entkommen: <b>{s.escaped}</b> &nbsp;|&nbsp; ☠️ Besiegt: <b>{s.fainted}</b>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="button-row" style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 14 }}>
  {Object.keys(filters).map((status) => (
    <button
      key={status}
      onClick={() => toggleFilter(status)}
      style={{ backgroundColor: filters[status] ? "#079e4b" : "#999" }}
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
    style={{ backgroundColor: "#d97706", color: "white", fontWeight: 800 }}
    title="Leert nur die Encounter-Liste, behält aber die gesamten Sündiger-Zahlen"
  >
    Liste leeren
  </button>

  <button
    onClick={handleReset}
    style={{ backgroundColor: "#b91c1c", color: "white", fontWeight: 800 }}
    title="Setzt alles zurück, inklusive gesamter Sündiger-Zahlen"
  >
    Alles zurücksetzen
  </button>
</div>

        <table>
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
                        style={{
                          padding: "2px 4px",
                          borderRadius: 8,
                          fontSize: 12,
                          lineHeight: 1.2,
                          cursor: "pointer",
                        }}
                      >
                        ✏️
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
  const available = pokemonList.filter((p) => !usedPokemon.has(p) || p === selected);
  const dexId = selected ? getDexIdFromName(selected, pokedex) : null;
  const megaOptions = dexId ? getMegaOptionsForDexId(dexId) : [];
  const hasMega = megaOptions.length > 0;
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
              options={available.map((name) => ({ label: name, value: name }))}
              value={selected ? { label: selected, value: selected } : null}
              onChange={(sel) => handleChange(loc, slotName, sel?.value || "")}
              isClearable
              isSearchable
              placeholder={`Pokémon ${i + 1}`}
              styles={getSelectStyles()}
            />
          </div>

          {/* Mega Toggle bleibt auch bei Fossil möglich (falls du willst) */}
          {selected && dexId && hasMega && (
            <button
              type="button"
              onClick={() => {
                const next = nextMegaForm(formKey, megaOptions);
                handleChange(loc, `form${i + 1}`, next);
              }}
              title="Form wechseln (Normal/Mega/Mega X/Mega Y)"
              style={megaBtn(dark, !!formKey)}
            >
              {megaLabel(formKey)}
            </button>
          )}

          {/* Sprite */}
          {selected && dexId && (
            <button
              type="button"
              onClick={() => {
                const idToUse =
                  formKey && dexId && MEGA_FORM_IDS[Number(dexId)]?.[formKey]
                    ? MEGA_FORM_IDS[Number(dexId)][formKey]
                    : Number(dexId);

                if (idToUse) navigate(`/pokemon/${idToUse}`);
              }}
              title={`Info öffnen: ${selected}${formKey ? ` (${megaLabel(formKey)})` : ""}`}
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
            options={available.map((name) => ({ label: name, value: name }))}
            value={selected ? { label: selected, value: selected } : null}
            onChange={(sel) => handleChange(loc, slotName, sel?.value || "")}
            isClearable
            isSearchable
            placeholder={`Pokémon ${i + 1}`}
            styles={getSelectStyles()}
          />
        </div>

        {/* Mega Toggle */}
        {selected && dexId && hasMega && (
          <button
            type="button"
            onClick={() => {
              const next = nextMegaForm(formKey, megaOptions);
              handleChange(loc, `form${i + 1}`, next);
            }}
            title="Form wechseln (Normal/Mega/Mega X/Mega Y)"
            style={megaBtn(dark, !!formKey)}
          >
            {megaLabel(formKey)}
          </button>
        )}

        {/* Sprite */}
        {selected && dexId && (
          <button
            type="button"
            onClick={() => {
              const idToUse =
                formKey && dexId && MEGA_FORM_IDS[Number(dexId)]?.[formKey]
                  ? MEGA_FORM_IDS[Number(dexId)][formKey]
                  : Number(dexId);

              if (idToUse) navigate(`/pokemon/${idToUse}`);
            }}
            title={`Info öffnen: ${selected}${formKey ? ` (${megaLabel(formKey)})` : ""}`}
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
                    <select value={status || ""} onChange={(e) => handleChange(loc, "status", e.target.value)}>
                      <option value="">-</option>
                      {allFilled && <option value="Gefangen">Gefangen</option>}
                      {allFilled && <option value="Besiegt">Besiegt</option>}
                      <option value="Entkommen">Entkommen</option>
                    </select>
                    {getStatusIcon(status)}
                  </td>

                  {/* ✅ NEU: Sündiger */}
                  <td>
                    <select
                      value={sinnerEnabled ? (sinnerKey || "") : ""}
                      disabled={!sinnerEnabled}
                      onChange={(e) => handleChange(loc, "sinner", e.target.value)}
                      style={{
                        width: "100%",
                        opacity: sinnerEnabled ? 1 : 0.35,
                        cursor: sinnerEnabled ? "pointer" : "not-allowed",
                      }}
                    >
                      {!sinnerEnabled ? (
                        <option value="">—</option>
                      ) : (
                        <>
                          <option value="">-</option>
                          {sinnerOptions.map((opt) => (
                            <option key={opt.key} value={opt.key}>
                              {opt.label}
                            </option>
                          ))}
                        </>
                      )}
                    </select>
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
                        <label style={{ fontSize: 13, opacity: 0.9 }}>Entkommen</label>
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
                        <label style={{ fontSize: 13, opacity: 0.9 }}>Besiegt</label>
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
  padding: 16,
  overflow: "hidden",
  background: dark ? "#05070b" : "transparent",
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
  filter: "blur(0px)",
};

const bgOverlay = {
  position: "fixed",
  inset: 0,
  zIndex: 1,
  background:
    "radial-gradient(1200px 600px at 20% 10%, rgba(0,0,0,0.35), rgba(0,0,0,0.78)), rgba(0,0,0,0.35)",
};

const contentCard = (dark) => ({
  position: "relative",
  zIndex: 2,
  maxWidth: 1400,
  margin: "0 auto",
  padding: 18,
  borderRadius: 18,
  border: dark ? "1px solid rgba(255,255,255,0.12)" : "none",
  background: dark ? "rgba(10,10,16,0.62)" : "transparent",
  backdropFilter: dark ? "blur(10px)" : "none",
  boxShadow: dark ? "0 30px 90px rgba(0,0,0,0.45)" : "none",
});

/* Titel + Buttons rechts */
const headerRow = {
  position: "relative",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 12,
  marginTop: 6,
};

const topRightActions = {
  position: "absolute",
  right: 0,
  top: -50,
  display: "flex",
  alignItems: "center",
  gap: 10,
  flexWrap: "wrap",
};

/* Level-Cap */
const levelCapBanner = (dark) => ({
  margin: "10px auto 14px auto",
  maxWidth: 320,
  padding: "10px 12px",
  borderRadius: 14,
  textAlign: "center",
  border: dark ? "1px solid rgba(255,255,255,0.14)" : "1px solid rgba(0,0,0,0.10)",
  background: dark
    ? "linear-gradient(135deg, rgba(67,233,123,0.18), rgba(56,249,215,0.10))"
    : "rgba(7,158,75,0.12)",
  backdropFilter: dark ? "blur(10px)" : "none",
  boxShadow: dark ? "0 18px 40px rgba(0,0,0,0.35)" : "none",
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
  margin: "10px auto 14px auto",
  maxWidth: 500,
  padding: "12px 14px",
  borderRadius: 16,
  textAlign: "center",
  border: dark ? "1px solid rgba(255,255,255,0.14)" : "1px solid rgba(0,0,0,0.10)",
  background: dark ? "rgba(0,0,0,0.20)" : "rgba(0,0,0,0.04)",
  backdropFilter: dark ? "blur(10px)" : "none",
});

const sinnerStatPill = (dark) => ({
  padding: "10px 12px",
  borderRadius: 14,
  border: dark ? "1px solid rgba(255,255,255,0.12)" : "1px solid rgba(0,0,0,0.08)",
  background: dark ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.85)",
  minWidth: 200,
});

const tableCss = (dark) => {
  if (!dark) return "";

  return `
    table {
      width: 100%;
      border-collapse: separate;
      border-spacing: 0;
      overflow: hidden;
      border-radius: 14px;
      border: 1px solid rgba(255,255,255,0.10);
      background: rgba(0,0,0,0.18);
      backdrop-filter: blur(8px);
    }

    thead th {
      background: rgba(0,0,0,0.35);
      color: rgba(255,255,255,0.92);
      border-bottom: 1px solid rgba(255,255,255,0.10);
    }

    td, th {
      border-right: 1px solid rgba(255,255,255,0.10);
      border-bottom: 1px solid rgba(255,255,255,0.10);
      padding: 10px 12px;
      vertical-align: middle;
    }

    tr:last-child td { border-bottom: none; }
    th:last-child, td:last-child { border-right: none; }

    tbody tr {
      background: rgba(0,0,0,0.22);
    }

    tbody tr:nth-child(even) {
      background: rgba(0,0,0,0.16);
    }

    select {
      background: rgba(0,0,0,0.28);
      color: white;
      border: 1px solid rgba(255,255,255,0.14);
      border-radius: 10px;
      padding: 8px 10px;
      outline: none;
      backdrop-filter: blur(8px);
    }

    .button-row button {
      backdrop-filter: blur(8px);
    }
  `;
};

const editIconBtn = {
  padding: "6px 10px",
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.14)",
  background: "rgba(255,255,255,0.08)",
  color: "white",
  cursor: "pointer",
  fontSize: 14,
  fontWeight: 900,
  lineHeight: 1,
};

const runCounterCard = (dark) => ({
  margin: "0 auto",
  maxWidth: 150,
  padding: "12px 14px",
  borderRadius: 14,
  textAlign: "center",
  border: dark ? "1px solid rgba(255,255,255,0.14)" : "1px solid rgba(0,0,0,0.10)",
  background: dark
    ? "linear-gradient(135deg, rgba(67,233,123,0.14), rgba(255,255,255,0.04))"
    : "rgba(7,158,75,0.08)",
  boxShadow: dark ? "0 14px 30px rgba(0,0,0,0.26)" : "none",
});

const modalNumberInput = {
  width: "100%",
  padding: "12px 14px",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.14)",
  background: "rgba(255,255,255,0.06)",
  color: "white",
  outline: "none",
  boxSizing: "border-box",
};