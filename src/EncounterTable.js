import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import CreatableSelect from "react-select/creatable";
import { versionToPokedex } from "./data/versionToPokedex";
import editionData from "./data/editionData.js";
import { getGenFromEdition } from "./utils/editionHelpers";
import * as allLocations from "./locations/index.js";
import { useDuoSave } from "./duo/useDuoSave";

function getDexIdFromName(pokemonName, pokedex) {
  const entry = Object.entries(pokedex).find(([, name]) => name === pokemonName);
  if (!entry) return null;
  return entry[0].replace("pokedex", "");
}

function EncounterTable() {
  const navigate = useNavigate();

  // ===== Duo/Online State =====
  const activeDuoRoomId = localStorage.getItem("activeDuoRoomId") || "";
  const { save: duoSave, patchSave: patchDuoSave, error: duoError } = useDuoSave(activeDuoRoomId);
  const isDuo = !!activeDuoRoomId;

  // ===== Local Save State =====
  const activeSave = localStorage.getItem("activeSave");
  const savegames = JSON.parse(localStorage.getItem("savegames") || "{}");
  const currentSave = activeSave ? savegames[activeSave] : null;

  // ===== Effective meta (Duo prefers Firestore) =====
  const effectiveEdition = isDuo ? (duoSave?.edition || "Rot") : (currentSave?.edition || "Alpha Saphir");
  const effectiveLinkMode = isDuo ? (duoSave?.linkMode || "duo") : (currentSave?.linkMode || "solo");
  const slotCount = effectiveLinkMode === "trio" ? 3 : effectiveLinkMode === "duo" ? 2 : 1;

  const gen = getGenFromEdition(effectiveEdition);
  // (genData aktuell nicht genutzt, aber falls du später brauchst)
  const genData = editionData[effectiveEdition];
  const pokedex = versionToPokedex[effectiveEdition] || {};
  const locationList = allLocations[`locationsGen${gen}`] || [];
  const pokemonList = Object.values(pokedex);

  // ===== Encounters state =====
  // Initial: local or empty; wird bei Duo automatisch aus duoSave synchronisiert
  const [encounters, setEncounters] = useState(() => (currentSave?.encounters || {}));

  // Sobald DuoSave (live) reinkommt: Encounters aus Firestore übernehmen
  useEffect(() => {
    if (!isDuo) return;
    if (!duoSave) return;
    setEncounters(duoSave.encounters || {});
  }, [isDuo, duoSave]);

  // Wenn nicht Duo: bei Savewechsel die Encounters aus local neu setzen
  useEffect(() => {
    if (isDuo) return;
    setEncounters(currentSave?.encounters || {});
  }, [isDuo, activeSave]);

  // ===== Filter/Sort/Theme =====
  const defaultFilters = { Gefangen: true, Entkommen: true, Besiegt: true, Offen: true };
  const [filters, setFilters] = useState(() => {
    return JSON.parse(localStorage.getItem("encounterFilters")) || defaultFilters;
  });

  const [sortMode, setSortMode] = useState(() => {
    return localStorage.getItem("encounterSortMode") || "route";
  });

  const [theme, setTheme] = useState(localStorage.getItem("theme") || "light");

  useEffect(() => {
    document.body.className = theme + "-mode";
  }, [theme]);

  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    localStorage.setItem("theme", next);
    document.body.className = next + "-mode";
  };

  const toggleFilter = (status) => {
    const updated = { ...filters, [status]: !filters[status] };
    setFilters(updated);
    localStorage.setItem("encounterFilters", JSON.stringify(updated));
  };

  // ===== Save helper (local or Firestore) =====
  const persistEncounters = async (updatedEncounters) => {
    if (isDuo) {
      // Firestore patch
      await patchDuoSave({ encounters: updatedEncounters });
      return;
    }
    // localStorage save
    if (activeSave && savegames[activeSave]) {
      savegames[activeSave].encounters = updatedEncounters;
      localStorage.setItem("savegames", JSON.stringify(savegames));
    }
  };

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

    if (field.startsWith("pokemon")) {
      const allFilled = [...Array(slotCount)].every((_, i) => !!data[`pokemon${i + 1}`]);
      const status = data.status;
      if (!allFilled && (status === "Gefangen" || status === "Besiegt")) {
        data.status = "";
        for (let i = 1; i <= slotCount; i++) {
          data[`status${i}`] = "";
        }
      }
    }

    if (field === "status") {
      for (let i = 1; i <= slotCount; i++) {
        updated[location][`status${i}`] = value;
      }
    }

    setEncounters(updated);
    try {
      await persistEncounters(updated);
    } catch (e) {
      console.error(e);
      // optional: du könntest hier ein UI-Error setzen
    }
  };

  const handleReset = async () => {
    if (!window.confirm("Bist du sicher, dass du alle Einträge löschen möchtest?")) return;
    setEncounters({});
    try {
      await persistEncounters({});
    } catch (e) {
      console.error(e);
    }
  };

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

  const getSelectStyles = () => {
    const dark = theme === "dark";
    return {
      control: (styles) => ({
        ...styles,
        backgroundColor: dark ? "#222" : "#fff",
        color: dark ? "#fff" : "#000",
        borderColor: dark ? "#444" : "#ccc",
      }),
      input: (styles) => ({
        ...styles,
        color: dark ? "#fff" : "#000",
      }),
      menu: (styles) => ({
        ...styles,
        backgroundColor: dark ? "#333" : "#fff",
        zIndex: 9999,
      }),
      singleValue: (styles) => ({
        ...styles,
        color: dark ? "#fff" : "#000",
      }),
      option: (styles, { isFocused }) => ({
        ...styles,
        backgroundColor: isFocused ? (dark ? "#555" : "#eee") : (dark ? "#333" : "#fff"),
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

  return (
    <div style={{ position: "relative" }}>
      {/* Duo Status + Exit */}
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

      <h1>
        {effectiveEdition} Encounter-Tabelle ({effectiveLinkMode.toUpperCase()})
      </h1>

      <div className="button-row">
        <button onClick={toggleTheme}>Dark Mode an/aus</button>
        <button onClick={() => navigate("/team")}>Zum Team</button>
        <button onClick={() => navigate("/")}>Zurück zur Spielstand-Auswahl</button>
        <button onClick={() => navigate("/guide")}>Story-Guide öffnen</button>
      </div>

      <div className="button-row">
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
      </div>

      <table>
        <thead>
          <tr>
            <th>Ort</th>
            {[...Array(slotCount)].map((_, i) => (
              <th key={`pkmn-header-${i}`}>Pokémon {i + 1}</th>
            ))}
            <th>Status</th>
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

            return (
              <tr key={loc} className={rowClass} data-status={status}>
                <td>{loc}</td>

                {[...Array(slotCount)].map((_, i) => {
                  const slotName = `pokemon${i + 1}`;
                  const selected = data[slotName] || "";
                  const available = pokemonList.filter((p) => !usedPokemon.has(p) || p === selected);

                  return (
                    <td key={`${loc}-slot-${i}`}>
                      <div style={{ display: "flex", alignItems: "center" }}>
                        <div style={{ flex: 1 }}>
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

                        {selected && getDexIdFromName(selected, pokedex) && (
                          <a
                            href={`https://www.pokewiki.de/${selected}#Attacken`}
                            target="_blank"
                            rel="noopener noreferrer"
                            title={`PokéWiki: ${selected}`}
                          >
                            <img
                              src={`https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${getDexIdFromName(
                                selected,
                                pokedex
                              )}.png`}
                              alt={selected}
                              style={{ height: "60px", marginLeft: "10px", cursor: "pointer" }}
                            />
                          </a>
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
              </tr>
            );
          })}
        </tbody>
      </table>

      <br />
      <button onClick={handleReset}>Tabelle zurücksetzen</button>
    </div>
  );
}

export default EncounterTable;
