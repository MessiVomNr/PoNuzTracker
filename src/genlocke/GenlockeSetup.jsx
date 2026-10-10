import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  CLASSIC_EDITIONS, DEFAULT_RULES, WHEEL_RESULTS,
  cleanRules, createGenlocke, getPresets, savePreset, deletePreset,
} from "./core";
import editionData from "../data/editionData";
import { createDuoRoom } from "../duo/duoService";
import "./GenlockeSetup.css";

export const RULE_OPTIONS = [
  ["legendLimit", "Legendäre Pokémon im Team", "number"],
  ["mythicalLimit", "Mysteriöse Pokémon im Team", "number"],
  ["mythicalShared", "Mysteriöse zählen zum Legendenlimit", "check"],
  ["ultraLimit", "Ultrabestien / Paradox im Team", "number"],
  ["ultraShared", "Ultrabestien / Paradox zählen zum Legendenlimit", "check"],
  ["pseudoLimit", "Pseudo-Legendäre im Team", "number"],
  ["globalDeathBan", "Verstorbene Entwicklungslinien dauerhaft sperren", "check"],
  ["giftException", "Geschenk-Pokémon von Sperren befreien", "check"],
  ["aceCap", "Ace-Levelcap aktivieren", "check"],
  ["aceDifference", "Levelabstand der anderen Pokémon", "number"],
  ["noHealingItems", "Heilitems im Kampf verbieten", "check"],
  ["ownPrimaryTypeUnique", "Keine doppelten Primärtypen im eigenen Team", "check"],
  ["crossPrimaryTypeUnique", "Keine doppelten Primärtypen über beide Teams", "check"],
  ["linkPairPrimaryTypeUnique", "Soul-Paare mit unterschiedlichen Primärtypen", "check"],
  ["sameAce", "Same Ace für beide Spieler", "check"],
  ["heirs", "Anzahl der Champion-Erben", "number"],
  ["lockedHeirs", "Davon fest im Team gelockt", "number"],
  ["releaseChampions", "Nicht übernommene Champions erlösen und sperren", "check"],
  ["allowRepeatHeir", "Erben dürfen erneut vererbt werden", "check"],
  ["maxRepeatHeir", "Maximale Erbfolgen (0 = unbegrenzt)", "number"],
  ["heirInHall", "Erbe muss im Champion-Team stehen", "check"],
  ["heirGym", "Erben müssen an Arenen teilnehmen", "check"],
  ["heirGymAll", "Alle Erben müssen an Arenen teilnehmen", "check"],
  ["heirLottery", "Erben aus dem Champion-Team auslosen", "check"],
  ["starterLottery", "Starter-Lotterie aktivieren", "check"],
  ["wheel", "Glücksrad aktivieren", "check"],
  ["wheelWithoutHeir", "Ohne Erben für den Starter drehen", "check"],
  ["wheelOnlyLegal", "Nur regulär mögliche Attacken / Fähigkeiten", "check"],
  ["riskWinChance", "Risiko-Dreh: Gewinnchance in %", "number"],
];

export const RULE_GROUPS = [
  {
    id: "pokemon",
    title: "Pokémon & Begegnungen",
    desc: "Legendäre, Pseudo-Legendäre, Todessperren und Geschenke",
    keys: ["legendLimit", "mythicalLimit", "mythicalShared", "ultraLimit",
      "ultraShared", "pseudoLimit", "globalDeathBan", "giftException"],
  },
  {
    id: "combat",
    title: "Kämpfe & Levelcaps",
    desc: "Ace-Regel, Typenbeschränkungen und Items",
    keys: ["aceCap", "aceDifference", "noHealingItems", "ownPrimaryTypeUnique",
      "crossPrimaryTypeUnique", "linkPairPrimaryTypeUnique", "sameAce"],
  },
  {
    id: "heirs",
    title: "Ruhmeshalle & Erben",
    desc: "Wie viele Erben, feste Teamplätze und Vererbung",
    keys: ["heirs", "lockedHeirs", "releaseChampions", "allowRepeatHeir",
      "maxRepeatHeir", "heirInHall", "heirGym", "heirGymAll", "heirLottery"],
  },
  {
    id: "wheel",
    title: "Starter & Glücksrad",
    desc: "Lotterien, Drehmodus, Chancen und Boni",
    keys: ["starterLottery", "wheel", "wheelWithoutHeir",
      "wheelOnlyLegal", "riskWinChance"],
  },
];

const DUO_ONLY = new Set(["crossPrimaryTypeUnique", "linkPairPrimaryTypeUnique", "sameAce"]);
const LIMITED_TO_SIX = new Set(["legendLimit", "mythicalLimit", "ultraLimit", "pseudoLimit", "heirs", "lockedHeirs"]);
const EDITIONS = [...new Set([...Object.keys(editionData), ...CLASSIC_EDITIONS])]
  .filter(Boolean)
  .sort((a, b) => a.localeCompare(b, "de"));
const normalizeEdition = (edition) => String(edition || "").trim().toLocaleLowerCase("de");

export default function GenlockeSetup() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [mode, setMode] = useState("solo");
  const [editions, setEditions] = useState([...CLASSIC_EDITIONS]);
  const [addEdition, setAddEdition] = useState("Rot");
  const [rules, setRules] = useState(() => cleanRules(DEFAULT_RULES));
  const [presets, setPresets] = useState(getPresets);
  const [presetName, setPresetName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    document.body.classList.add("background-active");
    return () => document.body.classList.remove("background-active");
  }, []);

  const changeRule = (key, value) => setRules((prev) => cleanRules({ ...prev, [key]: value }));

  // Existing editions are removed from every other row's choices.
  const unused = EDITIONS.filter((edition) =>
    !editions.some((selected) => normalizeEdition(selected) === normalizeEdition(edition))
  );
  const addChoice = unused.includes(addEdition) ? addEdition : (unused[0] || "");

  const changeEdition = (index, edition) => {
    if (editions.some((selected, i) =>
      i !== index && normalizeEdition(selected) === normalizeEdition(edition)
    )) return;
    setEditions((prev) => prev.map((selected, i) => i === index ? edition : selected));
  };
  const moveEdition = (index, distance) => {
    setEditions((prev) => {
      const target = index + distance;
      if (target < 0 || target >= prev.length) return prev;
      const ordered = [...prev];
      [ordered[index], ordered[target]] = [ordered[target], ordered[index]];
      return ordered;
    });
  };
  const addSelectedEdition = () => {
    if (!addChoice) return;
    if (editions.some((edition) => normalizeEdition(edition) === normalizeEdition(addChoice))) return;
    setEditions((prev) => [...prev, addChoice]);
    setError("");
  };

  const saveRulePreset = () => {
    const key = presetName.trim();
    if (!key) return setError("Gib dem Regel-Preset zuerst einen Namen.");
    if (Object.prototype.hasOwnProperty.call(presets, key) &&
      !window.confirm("Dieses Preset existiert bereits. Überschreiben?")) return;
    try {
      setPresets(savePreset(key, rules));
      setPresetName("");
      setError("");
    } catch (err) { setError(err.message || "Preset konnte nicht gespeichert werden."); }
  };

  const create = async () => {
    if (busy) return;
    setError("");
    const trimmed = name.trim();
    if (!trimmed) return setError("Bitte gib deiner Genlocke einen Namen.");
    setBusy(true);
    try {
      // Also rejects duplicate editions on the data-model level.
      const genlocke = createGenlocke({ name: trimmed, editions, rules, mode });

      if (mode === "solo") {
        const saves = JSON.parse(localStorage.getItem("savegames") || "{}");
        if (Object.keys(saves).some((savedName) =>
          savedName.toLocaleLowerCase("de") === trimmed.toLocaleLowerCase("de"))) {
          throw new Error("Ein Spielstand mit diesem Namen existiert bereits.");
        }
        const emptyTeam = ["", "", "", "", "", ""];
        saves[trimmed] = {
          encounters: {}, teams: [emptyTeam], team: emptyTeam,
          gymsDefeated: 0, edition: editions[0],
          linkMode: "solo", genlocke,
        };
        localStorage.setItem("savegames", JSON.stringify(saves));
        localStorage.removeItem("activeDuoRoomId");
        localStorage.setItem("activeSave", trimmed);
        navigate("/genlocke");
        return;
      }
      const result = await createDuoRoom({
        displayName: localStorage.getItem("duoPlayerName") || "Spieler 1",
        edition: editions[0], linkMode: "duo", title: trimmed, genlocke,
      });
      localStorage.removeItem("activeSave");
      localStorage.setItem("activeDuoRoomId", result.roomId);
      navigate("/genlocke");
    } catch (err) {
      setError(err.message || "Die Genlocke konnte nicht erstellt werden.");
    } finally {
      setBusy(false);
    }
  };

  const renderRule = ([key, description, type]) => (
    <label className="genlocke-setup-rule" key={key}>
      <span>{description}</span>
      {type === "check" ? (
        <input type="checkbox" checked={!!rules[key]}
          onChange={(e) => changeRule(key, e.target.checked)} />
      ) : (
        <input type="number" className="genlocke-setup-input"
          min={key === "aceDifference" ? 1 : 0}
          max={LIMITED_TO_SIX.has(key) ? 6 : key === "riskWinChance" ? 100 : 30}
          value={rules[key]}
          onChange={(e) => changeRule(key, e.target.value)} />
      )}
    </label>
  );

  return (
    <div className="genlocke-setup-shell">
      <main className="genlocke-setup-layout">
        <nav className="genlocke-setup-topbar" aria-label="Navigation">
          <button type="button" className="genlocke-setup-back"
            onClick={() => navigate("/")}>← Zur Startseite</button>
          <button type="button" className="genlocke-setup-back secondary"
            onClick={() => navigate("/solo")}>Spielstände ansehen</button>
        </nav>

        <header className="genlocke-setup-heading">
          <span className="genlocke-setup-eyebrow">POKENUZTRACKER · RUN CENTER</span>
          <h1>Neue Genlocke</h1>
          <p>Deine Editionen. Deine Regeln. Eine Challenge über mehrere Spiele hinweg.</p>
        </header>

        <section className="genlocke-setup-panel" aria-label="Grundlagen">
          <h2>Grundlagen</h2>
          <div className="genlocke-setup-intro-grid">
            <label className="genlocke-setup-field">
              <span className="genlocke-setup-label">Name deiner Genlocke</span>
              <input className="genlocke-setup-input" value={name}
                onChange={(e) => setName(e.target.value)} maxLength={70}
                placeholder="z. B. Die ultimative Genlocke" />
            </label>
            <div className="genlocke-setup-field">
              <span className="genlocke-setup-label">Spielmodus</span>
              <div className="genlocke-setup-mode" role="group" aria-label="Spielmodus">
                <button type="button" aria-pressed={mode === "solo"} onClick={() => setMode("solo")}>
                  Solo
                </button>
                <button type="button" aria-pressed={mode === "duo"} onClick={() => setMode("duo")}>
                  Duo Soullink
                </button>
              </div>
            </div>
          </div>
        </section>

        <details className="genlocke-setup-panel genlocke-setup-accordion">
          <summary>
            <div className="genlocke-setup-summary-icon">01</div>
            <div className="genlocke-setup-summary-main">
              <strong>Editionen & Reihenfolge</strong>
              <span>{editions.length} Spiele · {editions.length
                ? editions.slice(0, 3).join(" → ") + (editions.length > 3 ? " → …" : "")
                : "Noch keine Edition ausgewählt"}</span>
            </div>
            <span className="genlocke-setup-chevron" aria-hidden="true" />
          </summary>
          <div className="genlocke-setup-accordion-body">
            <p className="genlocke-setup-description">
              Die klassische Reihenfolge ist vorausgewählt. Du kannst jede Edition einmal
              verwenden und beliebig verschieben. Rot, Gelb und Feuerrot zählen als unterschiedliche Spiele.
            </p>
            {editions.length === 0 ? (
              <div className="genlocke-setup-empty">Noch keine Edition hinzugefügt.</div>
            ) : editions.map((edition, index) => {
              const selectable = EDITIONS.filter((candidate) =>
                normalizeEdition(candidate) === normalizeEdition(edition) ||
                !editions.some((selected) => normalizeEdition(selected) === normalizeEdition(candidate))
              );
              return (
                <div className="genlocke-setup-stage" key={index}>
                  <span className="genlocke-setup-stage-index">{index + 1}.</span>
                  <select className="genlocke-setup-select" aria-label={"Edition " + (index + 1)}
                    value={edition} onChange={(e) => changeEdition(index, e.target.value)}>
                    {selectable.map((choice) => <option key={choice} value={choice}>{choice}</option>)}
                  </select>
                  <button type="button" className="genlocke-setup-small-button"
                    aria-label={edition + " nach oben"} title="Nach oben"
                    disabled={index === 0} onClick={() => moveEdition(index, -1)}>↑</button>
                  <button type="button" className="genlocke-setup-small-button"
                    aria-label={edition + " nach unten"} title="Nach unten"
                    disabled={index === editions.length - 1}
                    onClick={() => moveEdition(index, 1)}>↓</button>
                  <button type="button" className="genlocke-setup-small-button danger"
                    aria-label={edition + " entfernen"} title="Entfernen"
                    onClick={() => setEditions((prev) => prev.filter((_, i) => i !== index))}>×</button>
                </div>
              );
            })}
            <div className="genlocke-setup-actions">
              <select className="genlocke-setup-select" style={{ width: "auto", flex: "1 1 165px" }}
                aria-label="Edition hinzufügen" disabled={!unused.length}
                value={addChoice} onChange={(e) => setAddEdition(e.target.value)}>
                {unused.length === 0 ? <option value="">Keine weiteren Editionen</option>
                  : unused.map((choice) => <option key={choice} value={choice}>{choice}</option>)}
              </select>
              <button type="button" className="genlocke-setup-button"
                disabled={!unused.length} onClick={addSelectedEdition}>+ Hinzufügen</button>
              <button type="button" className="genlocke-setup-button subtle"
                onClick={() => setEditions([...CLASSIC_EDITIONS])}>Klassisch zurücksetzen</button>
            </div>
          </div>
        </details>

        <details className="genlocke-setup-panel genlocke-setup-accordion">
          <summary>
            <div className="genlocke-setup-summary-icon">02</div>
            <div className="genlocke-setup-summary-main">
              <strong>Regeln & Schwierigkeit</strong>
              <span>Alle Regeloptionen, thematisch sortiert und einzeln ausklappbar</span>
            </div>
            <span className="genlocke-setup-chevron" aria-hidden="true" />
          </summary>
          <div className="genlocke-setup-accordion-body">
            <p className="genlocke-setup-description">
              Nur die gewählten Regeln gelten für deinen Run. Weitere Einstellungen erscheinen
              beim Öffnen einer Kategorie.
            </p>

            {RULE_GROUPS.map((group) => {
              const options = RULE_OPTIONS.filter(([key]) =>
                group.keys.includes(key) && (mode === "duo" || !DUO_ONLY.has(key))
              );
              return (
                <details key={group.id} className="genlocke-setup-rule-group">
                  <summary>
                    <div style={{ flex: 1 }}>
                      <strong>{group.title}</strong>
                      <span>{group.desc}</span>
                    </div>
                    <span className="genlocke-setup-chevron" aria-hidden="true" />
                  </summary>
                  <div className="genlocke-setup-rule-body">
                    <div className="genlocke-setup-rule-grid">{options.map(renderRule)}</div>

                    {group.id === "wheel" && (
                      <>
                        <div className="genlocke-setup-rule-grid" style={{ marginTop: 9 }}>
                          <label className="genlocke-setup-rule">
                            <span>Glücksrad-Modus</span>
                            <select className="genlocke-setup-select" style={{ maxWidth: 185 }}
                              value={rules.wheelMode}
                              onChange={(e) => changeRule("wheelMode", e.target.value)}>
                              <option value="each">Für jeden Erben</option>
                              <option value="oneChoose">Einen Erben wählen</option>
                              <option value="oneRandom">Einen Erben auslosen</option>
                            </select>
                          </label>
                        </div>
                        <details className="genlocke-setup-rule-group" style={{ marginTop: 12 }}>
                          <summary>
                            <div style={{ flex: 1 }}>
                              <strong>Glücksrad-Felder & Wahrscheinlichkeiten</strong>
                              <span>Individuelle Gewichtung der möglichen Ergebnisse</span>
                            </div>
                            <span className="genlocke-setup-chevron" aria-hidden="true" />
                          </summary>
                          <div className="genlocke-setup-rule-body">
                            <div className="genlocke-setup-rule-grid">
                              {WHEEL_RESULTS.map((result) => (
                                <label key={result.id} className="genlocke-setup-rule">
                                  <span>{result.label}</span>
                                  <input className="genlocke-setup-input" type="number" min={0} max={1000}
                                    value={rules.wheelWeights[result.id]}
                                    onChange={(e) => changeRule("wheelWeights", {
                                      ...rules.wheelWeights, [result.id]: Number(e.target.value),
                                    })} />
                                </label>
                              ))}
                            </div>
                          </div>
                        </details>
                        <details className="genlocke-setup-rule-group">
                          <summary>
                            <div style={{ flex: 1 }}>
                              <strong>Zufallspools</strong>
                              <span>Fähigkeiten, Items und Attacken für zufällige Boni</span>
                            </div>
                            <span className="genlocke-setup-chevron" aria-hidden="true" />
                          </summary>
                          <div className="genlocke-setup-rule-body">
                            <p className="genlocke-setup-description">
                              Mehrere Einträge durch Kommas trennen. Verfügbarkeit im jeweiligen
                              Pokémon-Spiel selbst prüfen.
                            </p>
                            {["ability", "item", "move"].map((kind) => (
                              <label key={kind} className="genlocke-setup-field" style={{ marginBottom: 12 }}>
                                <span className="genlocke-setup-label">
                                  {({ ability: "Fähigkeiten", item: "Items", move: "Attacken" })[kind]}
                                </span>
                                <textarea className="genlocke-setup-textarea" rows={2}
                                  value={(rules.wheelPools?.[kind] || []).join(", ")}
                                  onChange={(e) => changeRule("wheelPools", {
                                    ...rules.wheelPools,
                                    [kind]: e.target.value.split(",").map((v) => v.trim()).filter(Boolean),
                                  })} />
                              </label>
                            ))}
                          </div>
                        </details>
                      </>
                    )}
                  </div>
                </details>
              );
            })}

            <details className="genlocke-setup-rule-group">
              <summary>
                <div style={{ flex: 1 }}>
                  <strong>Wipe & Neustart</strong>
                  <span>Festlegen, wann der gesamte Versuch verloren ist</span>
                </div>
                <span className="genlocke-setup-chevron" aria-hidden="true" />
              </summary>
              <div className="genlocke-setup-rule-body">
                <label className="genlocke-setup-field">
                  <span className="genlocke-setup-label">Wipe-Bedingung</span>
                  <select className="genlocke-setup-select" value={rules.wipeMode}
                    onChange={(e) => changeRule("wipeMode", e.target.value)}>
                    <option value="team">Team-Wipe</option>
                    <option value="run">Vollständiger Run-Wipe</option>
                  </select>
                </label>
              </div>
            </details>
          </div>
        </details>

        <details className="genlocke-setup-panel genlocke-setup-accordion">
          <summary>
            <div className="genlocke-setup-summary-icon">03</div>
            <div className="genlocke-setup-summary-main">
              <strong>Eigene Regel-Presets</strong>
              <span>{Object.keys(presets).length
                ? Object.keys(presets).length + " gespeicherte Vorlagen"
                : "Optional · Regeln für zukünftige Runs speichern"}</span>
            </div>
            <span className="genlocke-setup-chevron" aria-hidden="true" />
          </summary>
          <div className="genlocke-setup-accordion-body">
            <p className="genlocke-setup-description">
              Speichere deine aktuellen Regeln als eigene Vorlage, beispielsweise für Solo oder Duo.
            </p>
            <div className="genlocke-setup-actions">
              <input className="genlocke-setup-input" style={{ flex: "1 1 180px", width: "auto" }}
                placeholder="Name des Presets" maxLength={60} value={presetName}
                onChange={(e) => setPresetName(e.target.value)} />
              <button type="button" className="genlocke-setup-button"
                onClick={saveRulePreset}>Preset speichern</button>
            </div>
            {Object.keys(presets).map((preset) => (
              <div className="genlocke-setup-actions" key={preset}
                style={{ borderTop: "1px solid rgba(190,212,255,.10)", paddingTop: 12 }}>
                <strong style={{ flex: 1, fontSize: 13 }}>{preset}</strong>
                <button type="button" className="genlocke-setup-button" onClick={() => {
                  setRules(cleanRules(presets[preset]));
                  setError("");
                }}>Laden</button>
                <button type="button" className="genlocke-setup-button subtle"
                  onClick={() => {
                    if (window.confirm('Preset "' + preset + '" löschen?')) {
                      setPresets(deletePreset(preset));
                    }
                  }}>Löschen</button>
              </div>
            ))}
          </div>
        </details>

        {error && <div role="alert" className="genlocke-setup-error">{error}</div>}
        <div className="genlocke-setup-submit">
          <div>
            <strong>Deine Genlocke</strong>
            <span>{mode === "duo" ? "Duo Soullink" : "Solo"} · {editions.length} Editionen</span>
          </div>
          <button type="button" disabled={busy} onClick={create}>
            {busy ? "Wird erstellt …" : "Genlocke erstellen →"}
          </button>
        </div>
      </main>
    </div>
  );
}
