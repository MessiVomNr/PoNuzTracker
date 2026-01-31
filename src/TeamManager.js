import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { DragDropContext, Droppable, Draggable } from "react-beautiful-dnd";
import { versionToPokedex } from "./data/versionToPokedex";

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

function TeamManager() {
  const navigate = useNavigate();
  const activeSave = localStorage.getItem("activeSave");
  const [teams, setTeams] = useState([]);
  const [availablePokemon, setAvailablePokemon] = useState([]);
  const [linkMode, setLinkMode] = useState("solo");
  const [fullDex, setFullDex] = useState({});
  const [pokemonTypes, setPokemonTypes] = useState({});

  useEffect(() => {
    const saves = JSON.parse(localStorage.getItem("savegames") || "{}");
    const current = saves[activeSave] || {};
    const encounters = current.encounters || {};
    const storedTeams = current.teams || [];

    const edition = current.edition || "Rot";
    const mergedDex = versionToPokedex[edition] || {};
    setFullDex(mergedDex);

    const newLinkMode = current.linkMode || "solo";
    const newTeamCount = newLinkMode === "trio" ? 3 : newLinkMode === "duo" ? 2 : 1;
    setLinkMode(newLinkMode);

    const cleaned = storedTeams.map((team) => [...team, "", "", "", "", ""].slice(0, 6));
    setTeams(cleaned.length === newTeamCount ? cleaned : Array(newTeamCount).fill(["", "", "", "", "", ""]));

    const perTeamPokemon = Array(newTeamCount).fill().map(() => []);
    Object.entries(encounters).forEach(([location, entry]) => {
      for (let i = 0; i < newTeamCount; i++) {
        const pokeKey = `pokemon${i + 1}`;
        const statusKey = `status${i + 1}`;
        const poke = entry[pokeKey];
        const status = newTeamCount === 1 ? (entry.status ?? entry.status1) : entry[statusKey];
        if (poke && status === "Gefangen") {
          perTeamPokemon[i].push(poke);
        }
      }
    });

    const uniqueLists = perTeamPokemon.map((list) => [...new Set(list)]);
    setAvailablePokemon(uniqueLists);
  }, [activeSave]);

  // Typen für alle Pokémon nachladen
  useEffect(() => {
    teams.flat().forEach(async (name) => {
      if (!name || pokemonTypes[name]) return;
      const dexId = getDexIdFromName(name, fullDex);
      if (dexId) {
        const types = await fetchTypesFromAPI(dexId);
        setPokemonTypes((prev) => ({ ...prev, [name]: types }));
      }
    });
  }, [teams, fullDex]);

  // Entferne Pokémon aus Team, wenn sie aus Encounters gelöscht wurden
  useEffect(() => {
    const saves = JSON.parse(localStorage.getItem("savegames") || "{}");
    const current = saves[activeSave] || {};
    const encounters = current.encounters || {};

    const allEncountered = new Set();
    Object.values(encounters).forEach((entry) => {
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
      current.teams = cleanedTeams;
      saves[activeSave] = current;
      localStorage.setItem("savegames", JSON.stringify(saves));
    }
  }, [teams, activeSave]);

  const updateTeam = (index, newTeam) => {
    const newTeams = [...teams];
    newTeams[index] = newTeam;
    setTeams(newTeams);

    const saves = JSON.parse(localStorage.getItem("savegames") || "{}");
    saves[activeSave].teams = newTeams;
    localStorage.setItem("savegames", JSON.stringify(saves));
  };

  const findLinkedGroup = (name, teamIndex) => {
    const saves = JSON.parse(localStorage.getItem("savegames") || "{}");
    const encounters = saves[activeSave]?.encounters || {};
    for (const [location, entry] of Object.entries(encounters)) {
      if (entry[`pokemon${teamIndex + 1}`] === name) {
        return Array.from({ length: teams.length }, (_, i) => entry[`pokemon${i + 1}`]);
      }
    }
    return null;
  };

  const isInTeam = (name) => teams.some((team) => team.includes(name));

  const toggleLinkedPokemon = (clickedIndex, name) => {
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
    const saves = JSON.parse(localStorage.getItem("savegames") || "{}");
    saves[activeSave].teams = newTeams;
    localStorage.setItem("savegames", JSON.stringify(saves));
  };

  const onDragEnd = (result, teamIndex) => {
    if (!result.destination) return;
    const newTeam = [...teams[teamIndex]];
    const [moved] = newTeam.splice(result.source.index, 1);
    newTeam.splice(result.destination.index, 0, moved);
    updateTeam(teamIndex, newTeam);
  };

  return (
    <div className="team-page">
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
                          <Draggable key={j} draggableId={`poke-${i}-${j}`} index={j}>
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
                    <div key={p} className="pokebox-item" onClick={() => toggleLinkedPokemon(i, p)}>
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
