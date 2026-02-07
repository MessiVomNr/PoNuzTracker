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

function pokewikiUrlFor(name, formKey) {
  if (!name) return "";
  if (!formKey) return `https://www.pokewiki.de/${name}#Attacken`;
  return `https://www.pokewiki.de/Mega-${name}#Attacken`;
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

    const online = all.filter((p) => p.online || (p.lastActiveAtMs && Date.now() - p.lastActiveAtMs < 60000));
    return { online, all };
  }, [duoRoom]);

  const gen = getGenFromEdition(effectiveEdition);
  const genData = editionData[effectiveEdition]; // (aktuell nicht genutzt)
  const pokedex = versionToPokedex[effectiveEdition] || {};
  const locationList = allLocations[`locationsGen${gen}`] || [];
  const pokemonList = Object.values(pokedex);

  // ===== Slot-Namen =====
  const [slotNames, setSlotNames] = useState(() =>
    normalizeSlotNames(isDuo ? duoSave?.slotNames : currentSave?.slotNames, slotCount)
  );

  useEffect(() => {
    setSlotNames(normalizeSlotNames(isDuo ? duoSave?.slotNames : currentSave?.slotNames, slotCount));
  }, [isDuo, duoSave, activeSave, slotCount]);

  const editSlotName = async (index) => {
    const current = (slotNames[index] || "").trim();
    const next = window.prompt(`Name für Spalte ${index + 1} (Spieler)`, current);
    if (next === null) return;

    const cleaned = String(next).trim();
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
      }
    }

    // Form-Wechsel ändert NICHT den Status – das lassen wir so.

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
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
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
                    const formKey = data[`form${i + 1}`] || "";
                    const selected = data[slotName] || "";
                    const available = pokemonList.filter((p) => !usedPokemon.has(p) || p === selected);

                    const dexId = selected ? getDexIdFromName(selected, pokedex) : null;
                    const megaOptions = dexId ? getMegaOptionsForDexId(dexId) : [];
                    const hasMega = megaOptions.length > 0;
                    const sprite = dexId ? spriteUrlFor(dexId, formKey) : null;
                    const wikiUrl = selected ? pokewikiUrlFor(selected, formKey) : "";

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
                            <a
                              href={wikiUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              title={`PokéWiki: ${selected}${formKey ? ` (${megaLabel(formKey)})` : ""}`}
                              style={{ display: "inline-flex", alignItems: "center" }}
                            >
                              <img
                                src={sprite || `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${dexId}.png`}
                                alt={selected}
                                style={{ height: "60px", cursor: "pointer" }}
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
