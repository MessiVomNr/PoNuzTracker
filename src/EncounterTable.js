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

function getDexIdFromName(pokemonName, pokedex) {
  const entry = Object.entries(pokedex).find(([, name]) => name === pokemonName);
  if (!entry) return null;
  return entry[0].replace("pokedex", "");
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

    // online=true ODER Aktivität in den letzten 60 Sekunden
    const online = all.filter((p) => p.online || (p.lastActiveAtMs && Date.now() - p.lastActiveAtMs < 60000));

    return { online, all };
  }, [duoRoom]);

  const gen = getGenFromEdition(effectiveEdition);
  const genData = editionData[effectiveEdition]; // aktuell nicht genutzt, aber okay
  const pokedex = versionToPokedex[effectiveEdition] || {};
  const locationList = allLocations[`locationsGen${gen}`] || [];
  const pokemonList = Object.values(pokedex);

  // ===== Slot-Namen (Header: Pokémon 1/2/3) =====
  const [slotNames, setSlotNames] = useState(() =>
    normalizeSlotNames(isDuo ? duoSave?.slotNames : currentSave?.slotNames, slotCount)
  );

  // Sync: wenn DuoSave / Savewechsel / SlotCount ändert
  useEffect(() => {
    setSlotNames(normalizeSlotNames(isDuo ? duoSave?.slotNames : currentSave?.slotNames, slotCount));
  }, [isDuo, duoSave, activeSave, slotCount]); // activeSave reicht um local wechsel zu erkennen

  const editSlotName = async (index) => {
    const current = (slotNames[index] || "").trim();
    const next = window.prompt(`Name für Spalte ${index + 1} (Spieler)`, current);
    if (next === null) return; // abbrechen

    const cleaned = String(next).trim(); // leer erlaubt -> fällt im UI zurück auf "Pokémon X"
    const updated = normalizeSlotNames([...slotNames], slotCount);
    updated[index] = cleaned;

    setSlotNames(updated);

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

  // Duo: Encounters aus Firestore übernehmen
  useEffect(() => {
    if (!isDuo) return;
    if (!duoSave) return;
    setEncounters(duoSave.encounters || {});
  }, [isDuo, duoSave]);

  // Local: bei Savewechsel Encounters aus local neu setzen
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
      await patchDuoSave({ encounters: updatedEncounters });
      return;
    }
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
        for (let i = 1; i <= slotCount; i++) data[`status${i}`] = "";
      }
    }

    if (field === "status") {
      for (let i = 1; i <= slotCount; i++) updated[location][`status${i}`] = value;
    }

    setEncounters(updated);
    try {
      await persistEncounters(updated);
    } catch (e) {
      console.error(e);
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

  const dark = theme === "dark";

  return (
    <div style={pageWrap(dark)}>
      {/* Hintergrund nur im Dark-Theme */}
      {dark && <div style={bg} />}
      {dark && <div style={bgOverlay} />}

      {/* Content-Karte, damit der BG nur dezent durchscheint */}
      <div style={contentCard(dark)}>
        {/* Mini CSS für table-transparency (ohne deine globale CSS zu zerschießen) */}
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

        <h1 style={{ marginTop: 6 }}>
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

              {[...Array(slotCount)].map((_, i) => {
                const label = (slotNames[i] || "").trim() || `Pokémon ${i + 1}`;
                return (
                  <th key={`pkmn-header-${i}`}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 8,
                      }}
                    >
                      <span>{label}</span>
                      <button
                        onClick={() => editSlotName(i)}
                        title="Spaltenname bearbeiten"
                        style={{
                          padding: "2px 8px",
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
  // Das ist der wichtigste Teil: macht den BG deutlich dunkler/ruhiger
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

const tableCss = (dark) => {
  if (!dark) return "";

  // Wir machen nur im Dark-Mode „Glass Table“.
  // Falls du globale Tabellen-CSS hast, wird das hier als Override drüber gelegt.
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
    }

    tr:last-child td { border-bottom: none; }
    th:last-child, td:last-child { border-right: none; }

    tbody tr {
      background: rgba(0,0,0,0.22);
    }

    tbody tr:nth-child(even) {
      background: rgba(0,0,0,0.16);
    }

    /* Die kleinen nativen Selects (Status + Sort) leicht "glass" */
    select {
      background: rgba(0,0,0,0.28);
      color: white;
      border: 1px solid rgba(255,255,255,0.14);
      border-radius: 10px;
      padding: 8px 10px;
      outline: none;
      backdrop-filter: blur(8px);
    }

    /* Buttons bleiben wie du sie hast – aber minimal lesbarer auf BG */
    .button-row button {
      backdrop-filter: blur(8px);
    }
  `;
};
