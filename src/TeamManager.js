import React, { useState, useEffect, useMemo } from "react";
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

function formBadgeLabel(formKey) {
  if (!formKey) return "";

  if (formKey === "mega") return "Mega";
  if (formKey === "mega-x") return "Mega X";
  if (formKey === "mega-y") return "Mega Y";

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
   Box: Anti-Wobble CSS
========================= */
const BOX_STATIC_CSS = `
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

  .pokeboxItemStatic:focus-visible {
    outline: 2px solid rgba(120,170,255,0.55) !important;
    outline-offset: 2px !important;
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
      for (let i = 1; i <= 3; i++) {
        const n = entry?.[`pokemon${i}`];
        const f = entry?.[`form${i}`] || "";
        if (n) map[n] = f;
      }
    });
    return map;
  }, [encountersSource]);

  // ===== UI State =====
  const [teams, setTeams] = useState(() => Array(teamCount).fill(["", "", "", "", "", ""]));
  const [availablePokemon, setAvailablePokemon] = useState(() => Array(teamCount).fill([]));
  const [fullDex, setFullDex] = useState({});
  const [pokemonTypes, setPokemonTypes] = useState({}); // key: `${name}__${formKey}`
  const [linkMode, setLinkMode] = useState(effectiveLinkMode);
  const [showHardResetModal, setShowHardResetModal] = useState(false);

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

  // ===== Remove Pokémon from Team if not in encounters anymore =====
  useEffect(() => {
    const allEncountered = new Set();
    Object.values(encountersSource || {}).forEach((entry) => {
      for (let i = 1; i <= 3; i++) {
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
  }, [encountersSource, teams]);

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

  return (
    <div style={page}>
      <style>{BOX_STATIC_CSS}</style>

      <div style={bg} />
      <div style={overlay} />

      <div style={content}>
        {isDuo && (
          <div style={topBar}>
            <div>
              <strong style={{ color: "#079e4b" }}>Duo Online aktiv</strong> — Room: <b>{activeDuoRoomId}</b>
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

        <div style={headerCard}>
  <h1 style={{ margin: 0 }}>Dein Team ({linkMode})</h1>

  <div
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

        <div style={teamsWrap}>
          {teams.map((team, i) => (
            <div key={i} style={teamCol}>
              <div style={glassCard}>
                <h2 style={{ marginTop: 0 }}>Team {i + 1}</h2>

                <DragDropContext onDragEnd={(res) => onDragEnd(res, i)}>
                  <Droppable droppableId={`team-${i}`}>
                    {(provided) => (
                      <ul ref={provided.innerRef} {...provided.droppableProps} style={teamList}>
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
                                  style={{
                                    ...teamSlot,
                                    ...(provided.draggableProps.style || {}),
                                  }}
                                >
                                  {p ? (
                                    <div style={slotContent}>
                                      {imgUrl && (
                                        <img
                                          src={imgUrl}
                                          alt={p}
                                          onClick={() => toggleLinkedPokemon(i, p)}
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

                                      <div style={{ flex: 1 }}>
                                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                                          <div style={{ fontWeight: 900 }}>{p}</div>

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

                                        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                                          {types.map((type) => (
                                            <img
                                              key={type}
                                              src={typeIconUrl(type)}
                                              alt={type}
                                              title={type}
                                              style={{
                                                width: 28,
                                                height: 28,
                                                opacity: 0.98,
                                                borderRadius: 8,
                                                padding: 4,
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

                            <div style={glassCard}>
                <h3 style={{ marginTop: 0 }}>Box {i + 1}</h3>
                <div style={pokeboxList}>
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
                        onClick={() => toggleLinkedPokemon(i, p)}
                        title={`${rowIndex + 1}. ${p}${row.route ? ` - ${row.route}` : ""}`}
                        className="pokeboxItemStatic"
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
  overflow: "hidden",
};

const bg = {
  position: "absolute",
  inset: 0,
  backgroundImage: `url("/backgrounds/background_5.png")`,
  backgroundSize: "cover",
  backgroundPosition: "center",
  backgroundRepeat: "no-repeat",
  transform: "scale(1.02)",
  zIndex: 0,
};

const overlay = {
  position: "absolute",
  inset: 0,
  background: "rgba(0,0,0,0.72)",
  zIndex: 1,
};

const content = {
  position: "relative",
  zIndex: 2,
  padding: 16,
  color: "white",
};

const topBar = {
  width: "min(1200px, 96vw)",
  margin: "0 auto 12px auto",
  padding: "10px 12px",
  borderRadius: 14,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(10,10,16,0.40)",
  backdropFilter: "blur(10px)",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
};

const headerCard = {
  width: "min(1200px, 96vw)",
  margin: "0 auto 16px auto",
  padding: 16,
  borderRadius: 18,
  border: "1px solid rgba(255,255,255,0.14)",
  background: "rgba(10,10,16,0.40)",
  backdropFilter: "blur(10px)",
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
  gap: 12,
};

const glassCard = {
  padding: 14,
  borderRadius: 18,
  border: "1px solid rgba(255,255,255,0.14)",
  background: "rgba(10,10,16,0.40)",
  backdropFilter: "blur(10px)",
  boxShadow: "0 20px 60px rgba(0,0,0,0.45)",
};

const teamList = {
  listStyle: "none",
  padding: 0,
  margin: 0,
  display: "grid",
  gap: 10,
};

const teamSlot = {
  borderRadius: 14,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(0,0,0,0.35)",
  padding: 10,
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
  borderRadius: 14,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(0,0,0,0.28)",
  padding: 6,
  cursor: "pointer",
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