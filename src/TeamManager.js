import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { DragDropContext, Droppable, Draggable } from "react-beautiful-dnd";
import { versionToPokedex } from "./data/versionToPokedex";
import { useDuoSave } from "./duo/useDuoSave";

function getDexIdFromName(name, fullDex) {
  const entry = Object.entries(fullDex).find(([, n]) => n === name);
  if (!entry) return null;
  return entry[0].replace("pokedex", "");
}

const typeCache = {};

async function fetchTypesFromAPI(dexId) {
  if (typeCache[dexId]) return typeCache[dexId];
  try {
    const res = await fetch(`https://pokeapi.co/api/v2/pokemon/${dexId}`);
    const data = await res.json();
    const types = data.types.map((t) => t.type.name);
    typeCache[dexId] = types;
    return types;
  } catch (err) {
    console.error("Typen konnten nicht geladen werden:", err);
    return [];
  }
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

  // ===== UI State =====
  const [teams, setTeams] = useState(() => Array(teamCount).fill(["", "", "", "", "", ""]));
  const [availablePokemon, setAvailablePokemon] = useState(() => Array(teamCount).fill([]));
  const [fullDex, setFullDex] = useState({});
  const [pokemonTypes, setPokemonTypes] = useState({});
  const [linkMode, setLinkMode] = useState(effectiveLinkMode);

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

  // ===== Persist Teams helper =====
  const persistTeams = async (newTeams) => {
    if (isDuo) {
      // Firestore: Teams als Objekt speichern (kein nested array!)
      await patchDuoSave({ teams: teamsArrayToObject(newTeams) });
      return;
    }
    const saves = JSON.parse(localStorage.getItem("savegames") || "{}");
    if (!activeSave || !saves[activeSave]) return;
    saves[activeSave].teams = newTeams;
    localStorage.setItem("savegames", JSON.stringify(saves));
  };

  // ===== Load types for all Pokémon in teams =====
  useEffect(() => {
    teams.flat().forEach(async (name) => {
      if (!name || pokemonTypes[name]) return;
      const dexId = getDexIdFromName(name, fullDex);
      if (dexId) {
        const types = await fetchTypesFromAPI(dexId);
        setPokemonTypes((prev) => ({ ...prev, [name]: types }));
      }
    });
  }, [teams, fullDex, pokemonTypes]);

  // ===== Remove Pokémon from Team if not in encounters anymore =====
  useEffect(() => {
    const allEncountered = new Set();
    Object.values(encountersSource || {}).forEach((entry) => {
      for (let i = 1; i <= 3; i++) {
        const mon = entry[`pokemon${i}`];
        if (mon) allEncountered.add(mon);
      }
    });

    const cleanedTeams = teams.map((team) =>
      team.map((mon) => (mon && allEncountered.has(mon) ? mon : ""))
    );

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

  return (
    <div className="team-page">
      {isDuo && (
        <div style={{ marginBottom: 10 }}>
          <strong style={{ color: "#079e4b" }}>Duo Online aktiv</strong> — Room: <b>{activeDuoRoomId}</b>{" "}
          <button
            onClick={() => {
              localStorage.removeItem("activeDuoRoomId");
              window.location.reload();
            }}
            style={{ marginLeft: 10 }}
          >
            Duo verlassen
          </button>
        </div>
      )}
      {duoError && <p style={{ color: "crimson" }}>{duoError}</p>}

      <h1>Dein Team ({linkMode})</h1>

      <div className="button-row">
        <button onClick={() => navigate("/table")}>Zurück zur Tabelle</button>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: "2rem", justifyContent: "center" }}>
        {teams.map((team, i) => (
          <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
            <div className="team-container">
              <h2>Team {i + 1}</h2>

              <DragDropContext onDragEnd={(res) => onDragEnd(res, i)}>
                <Droppable droppableId={`team-${i}`}>
                  {(provided) => (
                    <ul ref={provided.innerRef} {...provided.droppableProps} className="team-list">
                      {team.map((p, j) => {
                        const dexId = getDexIdFromName(p, fullDex);
                        const imgUrl = dexId
                          ? `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${dexId}.png`
                          : null;
                        const types = pokemonTypes[p] || [];

                        return (
                          <Draggable key={`slot-${i}-${j}`} draggableId={`poke-${i}-${j}`} index={j}>
                            {(provided) => (
                              <li
                                className="team-slot"
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                {...provided.dragHandleProps}
                              >
                                {p ? (
                                  <div
                                    className="slot-content"
                                    style={{
                                      display: "flex",
                                      alignItems: "center",
                                      gap: "1rem",
                                    }}
                                  >
                                    {imgUrl && (
                                      <img
                                        src={imgUrl}
                                        alt={p}
                                        className="pokemon-image"
                                        onClick={() => toggleLinkedPokemon(i, p)}
                                        style={{ width: 72, height: 72, cursor: "pointer" }}
                                      />
                                    )}
                                    <div style={{ display: "flex", gap: "0.5rem" }}>
                                      {types.map((type) => (
                                        <img
                                          key={type}
                                          src={`/type-icons/${type}.png`}
                                          alt={type}
                                          title={type}
                                          style={{ width: 32, height: 32 }}
                                        />
                                      ))}
                                    </div>
                                  </div>
                                ) : (
                                  <div className="slot-content">-leer-</div>
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

            <div className="pokebox">
              <h3>Box {i + 1}</h3>
              <div className="pokebox-list">
                {availablePokemon[i]?.map((p) => {
                  if (isInTeam(p)) return null;

                  const dexId = getDexIdFromName(p, fullDex);
                  const imgUrl = dexId
                    ? `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${dexId}.png`
                    : null;

                  return (
                    <div
                      key={p}
                      className="pokebox-item"
                      onClick={() => toggleLinkedPokemon(i, p)}
                      title={p}
                    >
                      {imgUrl && <img src={imgUrl} alt={p} />}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default TeamManager;
