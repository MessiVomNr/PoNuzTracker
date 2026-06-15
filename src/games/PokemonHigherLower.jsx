import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { comboMatches, isTypingTarget, loadHotkeys } from "../utils/hotkeys";
import {
  FORM_GROUPS,
  buildPokemonPool,
  getPoolEntryKey,
  getSelectedFormBucket,
  getSelectedFormLabel,
} from "./pokemonFormPool";
import "./guessStyles.css";

const HIGHER_LOWER_HIGHSCORES_KEY = "pokemonHigherLowerHighscores_v3";
const HIGHER_LOWER_SETTINGS_KEY = "pokemonHigherLowerSettings_v1";
const LEGACY_HIGHER_LOWER_HIGHSCORES_KEY = "pokemonHigherLowerHighscores_v2";
const LEGACY_HIGHER_LOWER_HIGHSCORE_KEY = "pokemonHigherLowerHighscore_v1";

const GEN_RANGES = {
  1: [1, 151],
  2: [152, 251],
  3: [252, 386],
  4: [387, 493],
  5: [494, 649],
  6: [650, 721],
  7: [722, 809],
  8: [810, 905],
  9: [906, 1025],
};

const GEN_KEYS = Object.keys(GEN_RANGES).map(Number);

const STAT_MODES = [
  { key: "hp", label: "KP" },
  { key: "attack", label: "Angriff" },
  { key: "defense", label: "Verteidigung" },
  { key: "special-attack", label: "Sp.-Angriff" },
  { key: "special-defense", label: "Sp.-Verteidigung" },
  { key: "speed", label: "Initiative" },
  { key: "bst", label: "BST / Gesamt" },
  { key: "random", label: "Zufällig jede Runde" },
];

const PLAYABLE_STAT_KEYS = STAT_MODES
  .filter((mode) => mode.key !== "random")
  .map((mode) => mode.key);

function getAllEnabledFormGroups() {
  return FORM_GROUPS.reduce((next, group) => {
    next[group.key] = true;
    return next;
  }, {});
}

function getDefaultHigherLowerSettings() {
  return {
    statMode: "bst",
    enabledGens: [...GEN_KEYS],
    enabledFormGroups: getAllEnabledFormGroups(),
  };
}

function normalizeSavedStatMode(value) {
  return STAT_MODES.some((mode) => mode.key === value) ? value : "bst";
}

function normalizeSavedGens(value) {
  const selected = Array.isArray(value)
    ? [...new Set(value.map(Number))]
        .filter((gen) => GEN_RANGES[gen])
        .sort((a, b) => a - b)
    : [];

  return selected.length ? selected : [...GEN_KEYS];
}

function normalizeSavedFormGroups(value) {
  const next = {};
  let hasSelectedForm = false;

  FORM_GROUPS.forEach((group) => {
    const enabled =
      value && Object.prototype.hasOwnProperty.call(value, group.key)
        ? !!value[group.key]
        : true;

    next[group.key] = enabled;

    if (enabled) {
      hasSelectedForm = true;
    }
  });

  return hasSelectedForm ? next : getAllEnabledFormGroups();
}

function getSavedHigherLowerSettings() {
  try {
    const raw = localStorage.getItem(HIGHER_LOWER_SETTINGS_KEY);

    if (!raw) {
      return getDefaultHigherLowerSettings();
    }

    const parsed = JSON.parse(raw);

    return {
      statMode: normalizeSavedStatMode(parsed?.statMode),
      enabledGens: normalizeSavedGens(parsed?.enabledGens),
      enabledFormGroups: normalizeSavedFormGroups(parsed?.enabledFormGroups),
    };
  } catch {
    return getDefaultHigherLowerSettings();
  }
}

function saveHigherLowerSettings(settings) {
  try {
    localStorage.setItem(
      HIGHER_LOWER_SETTINGS_KEY,
      JSON.stringify({
        statMode: normalizeSavedStatMode(settings?.statMode),
        enabledGens: normalizeSavedGens(settings?.enabledGens),
        enabledFormGroups: normalizeSavedFormGroups(settings?.enabledFormGroups),
      })
    );
  } catch {
    // localStorage kann in seltenen Browser-/Privacy-Fällen blockiert sein.
  }
}

function getSelectedGenBucket(enabledGens) {
  const selected = Array.isArray(enabledGens)
    ? enabledGens.filter((gen) => GEN_RANGES[gen]).sort((a, b) => a - b)
    : [];

  if (selected.length === GEN_KEYS.length) return "all";
  if (selected.length === 1) return `gen${selected[0]}`;

  return "specific";
}

function getSelectedGenLabel(enabledGens) {
  const bucket = getSelectedGenBucket(enabledGens);

  if (bucket === "all") return "Alle Gens";
  if (bucket.startsWith("gen")) return `Gen ${bucket.replace("gen", "")}`;

  return "Spezifisch";
}

function getHighscoreKey(statMode, enabledGens, enabledFormGroups) {
  return `${statMode}:${getSelectedGenBucket(enabledGens)}:${getSelectedFormBucket(enabledFormGroups)}`;
}

function getHighscoreLabel(statMode, enabledGens, enabledFormGroups) {
  return `${getStatLabel(statMode)} · ${getSelectedGenLabel(enabledGens)} · ${getSelectedFormLabel(enabledFormGroups)}`;
}

function getSavedHighscores() {
  try {
    const raw = localStorage.getItem(HIGHER_LOWER_HIGHSCORES_KEY);

    if (raw) {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? parsed : {};
    }

    const legacyRaw = localStorage.getItem(LEGACY_HIGHER_LOWER_HIGHSCORES_KEY);
    if (legacyRaw) {
      const legacyParsed = JSON.parse(legacyRaw);
      const migrated = {};

      STAT_MODES.forEach((mode) => {
        const value = Number(legacyParsed?.[mode.key] || 0);
        if (Number.isFinite(value) && value > 0) {
          migrated[`${mode.key}:specific:normal`] = value;
        }
      });

      return migrated;
    }

    const oldSingleHighscore = Number(localStorage.getItem(LEGACY_HIGHER_LOWER_HIGHSCORE_KEY) || 0);
    if (Number.isFinite(oldSingleHighscore) && oldSingleHighscore > 0) {
      return {
        "bst:specific:normal": oldSingleHighscore,
      };
    }

    return {};
  } catch {
    return {};
  }
}

function saveHighscores(next) {
  try {
    localStorage.setItem(HIGHER_LOWER_HIGHSCORES_KEY, JSON.stringify(next));
  } catch {
    // localStorage kann in seltenen Browser-/Privacy-Fällen blockiert sein.
  }
}

function getModeHighscore(highscores, highscoreKey) {
  const value = Number(highscores?.[highscoreKey] || 0);
  return Number.isFinite(value) ? value : 0;
}

function randomArrayItem(items) {
  return items[Math.floor(Math.random() * items.length)];
}

function getStatLabel(statKey) {
  return STAT_MODES.find((mode) => mode.key === statKey)?.label || statKey;
}

function getPokemonStatValue(pokemon, statKey) {
  if (!pokemon) return 0;

  if (statKey === "bst") {
    return Object.values(pokemon.stats).reduce((sum, value) => sum + value, 0);
  }

  return pokemon.stats[statKey] || 0;
}

function getRelation(leftValue, rightValue) {
  if (rightValue > leftValue) return "higher";
  if (rightValue < leftValue) return "lower";
  return "equal";
}

function getFallbackSpriteUrl(dexId) {
  return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${dexId}.png`;
}

function getBestSprite(pokemonData, dexId) {
  return (
    pokemonData?.sprites?.other?.["official-artwork"]?.front_default ||
    pokemonData?.sprites?.other?.home?.front_default ||
    pokemonData?.sprites?.front_default ||
    getFallbackSpriteUrl(dexId)
  );
}

async function fetchPokemon(poolEntry) {
  const entry =
    typeof poolEntry === "number"
      ? {
          group: "normal",
          dexId: poolEntry,
          speciesId: poolEntry,
          apiName: String(poolEntry),
        }
      : poolEntry;

  const pokemonKey = entry.apiName || String(entry.dexId);
  const speciesId = entry.speciesId || entry.dexId;

  const [pokemonRes, speciesRes] = await Promise.all([
    fetch(`https://pokeapi.co/api/v2/pokemon/${pokemonKey}`),
    fetch(`https://pokeapi.co/api/v2/pokemon-species/${speciesId}`),
  ]);

  if (!pokemonRes.ok || !speciesRes.ok) {
    throw new Error("Pokémon konnte nicht geladen werden.");
  }

  const pokemonData = await pokemonRes.json();
  const speciesData = await speciesRes.json();

  const baseName =
    speciesData.names?.find((item) => item.language?.name === "de")?.name ||
    speciesData.names?.find((item) => item.language?.name === "en")?.name ||
    pokemonData.name;

  const displayName = entry.formLabel ? `${baseName} (${entry.formLabel})` : baseName;

  const stats = {};
  pokemonData.stats.forEach((item) => {
    stats[item.stat.name] = item.base_stat;
  });

  return {
    dexId: speciesId,
    poolKey: getPoolEntryKey(entry),
    apiName: pokemonKey,
    group: entry.group || "normal",
    name: displayName,
    sprite: getBestSprite(pokemonData, speciesId),
    stats,
  };
}

export default function PokemonHigherLower() {
  const navigate = useNavigate();
  const [initialSettings] = useState(getSavedHigherLowerSettings);

  const [screen, setScreen] = useState("menu");
  const [statMode, setStatMode] = useState(initialSettings.statMode);
  const [enabledGens, setEnabledGens] = useState(initialSettings.enabledGens);
  const [enabledFormGroups, setEnabledFormGroups] = useState(initialSettings.enabledFormGroups);
  const [showStatMenu, setShowStatMenu] = useState(false);
  const [showGenMenu, setShowGenMenu] = useState(false);
  const [showFormMenu, setShowFormMenu] = useState(false);
  const [leftPokemon, setLeftPokemon] = useState(null);
  const [rightPokemon, setRightPokemon] = useState(null);
  const [currentStatKey, setCurrentStatKey] = useState("bst");
  const [streak, setStreak] = useState(0);
  const [highscores, setHighscores] = useState(getSavedHighscores);
  const [revealed, setRevealed] = useState(false);
  const [lastGuess, setLastGuess] = useState("");
  const [lastCorrect, setLastCorrect] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const dexPool = useMemo(
    () => buildPokemonPool(enabledGens, enabledFormGroups, GEN_RANGES),
    [enabledGens, enabledFormGroups]
  );

  const currentHighscoreKey = useMemo(
    () => getHighscoreKey(statMode, enabledGens, enabledFormGroups),
    [statMode, enabledGens, enabledFormGroups]
  );

  const currentHighscoreLabel = useMemo(
    () => getHighscoreLabel(statMode, enabledGens, enabledFormGroups),
    [statMode, enabledGens, enabledFormGroups]
  );

  const currentGenHighscoreLabel = useMemo(
    () => getSelectedGenLabel(enabledGens),
    [enabledGens]
  );

  const currentHighscore = useMemo(
    () => getModeHighscore(highscores, currentHighscoreKey),
    [highscores, currentHighscoreKey]
  );

  const leftValue = useMemo(
    () => getPokemonStatValue(leftPokemon, currentStatKey),
    [leftPokemon, currentStatKey]
  );

  const rightValue = useMemo(
    () => getPokemonStatValue(rightPokemon, currentStatKey),
    [rightPokemon, currentStatKey]
  );

  const actualRelation = useMemo(
    () => getRelation(leftValue, rightValue),
    [leftValue, rightValue]
  );

  const canPlay = dexPool.length >= 2;

  const pickRandomPoolEntry = useCallback(
    (blockedKey = null) => {
      if (!dexPool.length) return null;

      let nextEntry = randomArrayItem(dexPool);
      let tries = 0;

      while (getPoolEntryKey(nextEntry) === blockedKey && tries < 30) {
        nextEntry = randomArrayItem(dexPool);
        tries += 1;
      }

      return nextEntry;
    },
    [dexPool]
  );

  const pickRoundStatKey = useCallback(() => {
    if (statMode === "random") {
      return randomArrayItem(PLAYABLE_STAT_KEYS);
    }

    return statMode;
  }, [statMode]);

  const loadPokemonPair = useCallback(async () => {
    if (!canPlay) return;

    setLoading(true);
    setErr("");
    setRevealed(false);
    setLastGuess("");
    setLastCorrect(null);

    try {
      const nextStatKey = pickRoundStatKey();
      const leftEntry = pickRandomPoolEntry();
      const rightEntry = pickRandomPoolEntry(getPoolEntryKey(leftEntry));

      const [nextLeft, nextRight] = await Promise.all([
        fetchPokemon(leftEntry),
        fetchPokemon(rightEntry),
      ]);

      setCurrentStatKey(nextStatKey);
      setLeftPokemon(nextLeft);
      setRightPokemon(nextRight);
      setScreen("game");
    } catch (e) {
      setErr(e?.message || "Fehler beim Laden.");
    } finally {
      setLoading(false);
    }
  }, [canPlay, pickRandomPoolEntry, pickRoundStatKey]);

  const loadNextRightPokemon = useCallback(
    async (newLeftPokemon) => {
      setLoading(true);
      setErr("");
      setRevealed(false);
      setLastGuess("");
      setLastCorrect(null);

      try {
        const nextStatKey = pickRoundStatKey();
        const rightEntry = pickRandomPoolEntry(newLeftPokemon?.poolKey);
        const nextRight = await fetchPokemon(rightEntry);

        setCurrentStatKey(nextStatKey);
        setLeftPokemon(newLeftPokemon);
        setRightPokemon(nextRight);
      } catch (e) {
        setErr(e?.message || "Fehler beim Laden.");
      } finally {
        setLoading(false);
      }
    },
    [pickRandomPoolEntry, pickRoundStatKey]
  );

useEffect(() => {
    if (screen !== "game") return;
    if (leftPokemon || rightPokemon) return;

    loadPokemonPair();
  }, [screen, leftPokemon, rightPokemon, loadPokemonPair]);

  function toggleGen(gen) {
    setEnabledGens((current) => {
      if (current.includes(gen)) {
        return current.filter((item) => item !== gen);
      }

      return [...current, gen].sort((a, b) => a - b);
    });
  }

  function selectAllGens() {
    setEnabledGens(GEN_KEYS);
  }

  function clearGens() {
    setEnabledGens([]);
  }

  function selectOnlyGen(gen) {
    setEnabledGens([gen]);
  }

  function selectAllFormGroups() {
    setEnabledFormGroups(
      FORM_GROUPS.reduce((next, group) => {
        next[group.key] = true;
        return next;
      }, {})
    );
  }

  function clearFormGroups() {
    setEnabledFormGroups(
      FORM_GROUPS.reduce((next, group) => {
        next[group.key] = false;
        return next;
      }, {})
    );
  }

  function toggleFormGroup(groupKey) {
    setEnabledFormGroups((current) => ({
      ...current,
      [groupKey]: !current?.[groupKey],
    }));
  }

  function startGame() {
    saveHigherLowerSettings({
      statMode,
      enabledGens,
      enabledFormGroups,
    });

    setStreak(0);
    setLeftPokemon(null);
    setRightPokemon(null);
    loadPokemonPair();
  }

  function resetHighscore() {
    setHighscores((current) => {
      const next = {
        ...current,
        [currentHighscoreKey]: 0,
      };

      saveHighscores(next);
      return next;
    });
  }

  const handleGuess = useCallback(
    (guess) => {
      if (loading || revealed || !leftPokemon || !rightPokemon) return;

      const correct = guess === actualRelation;
      const nextStreak = correct ? streak + 1 : 0;

      setLastGuess(guess);
      setLastCorrect(correct);
      setRevealed(true);
      setStreak(nextStreak);

      if (nextStreak > currentHighscore) {
        setHighscores((current) => {
          const next = {
            ...current,
            [currentHighscoreKey]: nextStreak,
          };

          saveHighscores(next);
          return next;
        });
      }
    },
    [actualRelation, currentHighscore, currentHighscoreKey, leftPokemon, loading, revealed, rightPokemon, streak]
  );

  const nextRound = useCallback(() => {
    if (!rightPokemon || loading) return;

    if (lastCorrect === false) {
      loadPokemonPair();
      return;
    }

    loadNextRightPokemon(rightPokemon);
  }, [lastCorrect, loadNextRightPokemon, loadPokemonPair, loading, rightPokemon]);

  useEffect(() => {
    function onKeyDown(e) {
      if (isTypingTarget(e)) return;
      if (screen !== "game") return;

      const hotkeys = loadHotkeys();
      const gamesHotkeys = hotkeys.games || {};

      if (!revealed) {
        if (comboMatches(e, gamesHotkeys.higherLowerHigher)) {
          e.preventDefault();
          handleGuess("higher");
          return;
        }

        if (comboMatches(e, gamesHotkeys.higherLowerLower)) {
          e.preventDefault();
          handleGuess("lower");
          return;
        }

        if (comboMatches(e, gamesHotkeys.higherLowerEqual)) {
          e.preventDefault();
          handleGuess("equal");
          return;
        }
      }

      if (revealed && comboMatches(e, gamesHotkeys.nextPokemon)) {
        e.preventDefault();
        nextRound();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleGuess, nextRound, revealed, screen]);

  return (
    <main className="games-page higher-lower-page" style={pageStyle}>
      <section className="higher-lower-panel" style={panelStyle}>
        <button
          type="button"
          className="games-hub-back-button"
          onClick={() => {
            if (screen === "game") {
              setScreen("menu");
              setRevealed(false);
              setLastGuess("");
              setLastCorrect(null);
              setErr("");
              return;
            }

            navigate("/games");
          }}
        >
          <span className="games-hub-back-arrow">‹</span>
          Zurück
        </button>

        <header className="higher-lower-header" style={headerStyle}>
          <p className="higher-lower-eyebrow" style={eyebrowStyle}>Endless Game</p>
          <h1 className="higher-lower-title" style={titleStyle}>Higher oder Lower</h1>
          <p className="higher-lower-subtitle" style={subtitleStyle}>
            Vergleiche Pokémon-Werte und baue die längste Serie auf.
          </p>
        </header>

        {screen === "menu" ? (
          <div className="higher-lower-menu-grid" style={menuGridStyle}>
            <section className="higher-lower-filters-card" style={compactFiltersCardStyle}>
              <div className="higher-lower-filter-grid" style={filterGridStyle}>
                <div style={filterItemStyle}>
                  <div style={compactLabelStyle}>Wert</div>

                  <div style={popupWrapStyle}>
                    <button
                      type="button"
                      style={popupTriggerStyle}
                      onClick={() => {
                        setShowStatMenu((v) => !v);
                        setShowGenMenu(false);
                        setShowFormMenu(false);
                      }}
                    >
                      <span style={popupTriggerContentStyle}>
                        <span style={popupTriggerMainStyle}>
                          {getStatLabel(statMode)}
                        </span>
                        <span style={popupTriggerSubStyle}>
                          Vergleichswert
                        </span>
                      </span>

<span style={popupCaretStyle}>
  <span
    style={{
      ...popupChevronStyle,
      transform: showStatMenu ? "rotate(225deg)" : "rotate(45deg)",
    }}
  />
</span>
                    </button>

                    {showStatMenu && (
                      <div style={popupMenuStyle}>
                        <div style={popupMenuHeaderStyle}>
                          <strong>Wert auswählen</strong>
                        </div>

                        <div style={popupListStyle}>
                          {STAT_MODES.map((mode) => {
                            const active = statMode === mode.key;

                            return (
                              <button
                                key={mode.key}
                                type="button"
                                style={{
                                  ...popupOptionStyle,
                                  ...(active ? popupOptionActiveStyle : {}),
                                }}
                                onClick={() => {
                                  setStatMode(mode.key);
                                  setShowStatMenu(false);
                                }}
                              >
                                <span style={checkStyle}>{active ? "✓" : ""}</span>
                                {mode.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div style={filterItemStyle}>
                  <div style={compactLabelStyle}>Generationen</div>

                  <div style={popupWrapStyle}>
                    <button
                      type="button"
                      style={popupTriggerStyle}
                      onClick={() => {
                        setShowGenMenu((v) => !v);
                        setShowStatMenu(false);
                        setShowFormMenu(false);
                      }}
                    >
                      <span style={popupTriggerContentStyle}>
                        <span style={popupTriggerMainStyle}>
                          {enabledGens.length
                            ? `${enabledGens.length} ausgewählt`
                            : "Keine ausgewählt"}
                        </span>
                        <span style={popupTriggerSubStyle}>
                          {enabledGens.length
                            ? `Gruppe: ${currentGenHighscoreLabel}`
                            : "Spielstart deaktiviert"}
                        </span>
                      </span>

<span style={popupCaretStyle}>
  <span
    style={{
      ...popupChevronStyle,
      transform: showGenMenu ? "rotate(225deg)" : "rotate(45deg)",
    }}
  />
</span>
                    </button>

                    {showGenMenu && (
                      <div style={popupMenuWideStyle}>
                        <div style={popupMenuHeaderStyle}>
                          <strong>Generationen</strong>

                          <div style={popupActionRowStyle}>
                            <button
                              type="button"
                              style={popupActionButtonStyle}
                              onClick={selectAllGens}
                            >
                              Alle
                            </button>
                            <button
                              type="button"
                              style={popupActionButtonStyle}
                              onClick={clearGens}
                            >
                              Keine
                            </button>
                          </div>
                        </div>

                        <div style={genPopupListStyle}>
                          {GEN_KEYS.map((gen) => {
                            const active = enabledGens.includes(gen);

                            return (
                              <div
                                key={gen}
                                style={{
                                  ...genPopupOptionStyle,
                                  ...(active ? popupOptionActiveStyle : {}),
                                }}
                              >
                                <button
                                  type="button"
                                  style={genToggleButtonStyle}
                                  onClick={() => toggleGen(gen)}
                                >
                                  <span style={checkStyle}>{active ? "✓" : ""}</span>
                                  Gen {gen}
                                </button>

                                <button
                                  type="button"
                                  style={onlyGenButtonStyle}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    selectOnlyGen(gen);
                                  }}
                                >
                                  Nur
                                </button>
                              </div>
                            );
                          })}
                        </div>

                        <p style={popupHintStyle}>
                          {enabledGens.length
                            ? `Highscore-Gruppe: ${currentGenHighscoreLabel}`
                            : "Keine Generation ausgewählt. Spielstart ist deaktiviert."}
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                <div style={filterItemStyle}>
                  <div style={compactLabelStyle}>Formen</div>

                  <div style={popupWrapStyle}>
                    <button
                      type="button"
                      style={popupTriggerStyle}
                      onClick={() => {
                        setShowFormMenu((v) => !v);
                        setShowStatMenu(false);
                        setShowGenMenu(false);
                      }}
                    >
                      <span style={popupTriggerContentStyle}>
                        <span style={popupTriggerMainStyle}>
                          {FORM_GROUPS.filter((group) => !!enabledFormGroups?.[group.key]).length} ausgewählt
                        </span>
                        <span style={popupTriggerSubStyle}>
                          {getSelectedFormLabel(enabledFormGroups)}
                        </span>
                      </span>

<span style={popupCaretStyle}>
  <span
    style={{
      ...popupChevronStyle,
      transform: showFormMenu ? "rotate(225deg)" : "rotate(45deg)",
    }}
  />
</span>
                    </button>

                    {showFormMenu && (
                      <div style={popupMenuStyle}>
                        <div style={popupMenuHeaderStyle}>
                          <strong>Formen</strong>

                          <div style={popupActionRowStyle}>
                            <button
                              type="button"
                              style={popupActionButtonStyle}
                              onClick={selectAllFormGroups}
                            >
                              Alle
                            </button>

                            <button
                              type="button"
                              style={popupActionButtonStyle}
                              onClick={clearFormGroups}
                            >
                              Keine
                            </button>
                          </div>
                        </div>

                        <div style={popupListStyle}>
                          {FORM_GROUPS.map((group) => {
                            const active = !!enabledFormGroups?.[group.key];

                            return (
                              <button
                                key={group.key}
                                type="button"
                                style={{
                                  ...popupOptionStyle,
                                  ...(active ? popupOptionActiveStyle : {}),
                                }}
                                onClick={() => toggleFormGroup(group.key)}
                              >
                                <span style={checkStyle}>{active ? "✓" : ""}</span>
                                {group.label}
                              </button>
                            );
                          })}
                        </div>

                        <p style={popupHintStyle}>
                          Aktiver Pool: {getSelectedFormLabel(enabledFormGroups)}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </section>

            <section className="higher-lower-start-card" style={startCardStyle}>
              <div>
                <h2 style={sectionTitleStyle}>Highscore</h2>
                <div style={highscoreBigStyle}>{currentHighscore}</div>
                <p style={smallInfoStyle}>
                  {canPlay
                    ? currentHighscoreLabel
                    : "Wähle mindestens 1 Generation und einen gültigen Formen-Pool."}
                </p>
              </div>

              <div className="higher-lower-start-actions" style={startActionsStyle}>
                <button
                  type="button"
                  style={{
                    ...mainButtonStyle,
                    opacity: canPlay && !loading ? 1 : 0.55,
                    cursor: canPlay && !loading ? "pointer" : "not-allowed",
                  }}
                  disabled={!canPlay || loading}
                  onClick={startGame}
                >
                  {loading ? "Lädt..." : "Spiel starten"}
                </button>

                <button
                  type="button"
                  style={ghostButtonStyle}
                  onClick={resetHighscore}
                >
                  Kategorie-Highscore löschen
                </button>
              </div>
            </section>
          </div>
        ) : (
          <div className="higher-lower-game-wrap" style={gameWrapStyle}>
            <div className="higher-lower-score-row" style={scoreRowStyle}>
              <div className="higher-lower-score-pill" style={scorePillStyle}>
                Serie: <strong>{streak}</strong>
              </div>

              <div className="higher-lower-score-pill" style={scorePillStyle}>
                Highscore: <strong>{currentHighscore}</strong>
              </div>

              <div className="higher-lower-score-pill" style={scorePillStyle}>
                Wert: <strong>{getStatLabel(currentStatKey)}</strong>
              </div>
            </div>

            {err && (
              <div style={errorStyle}>
                {err}
              </div>
            )}

            <div className="higher-lower-versus-grid" style={versusGridStyle}>
              <PokemonCard
                side="links"
                pokemon={leftPokemon}
                statKey={currentStatKey}
                value={leftValue}
                revealed
              />

              <div className="higher-lower-vs-center" style={centerStyle}>
                <div className="higher-lower-vs-badge" style={versusTextStyle}>VS</div>
              </div>

              <PokemonCard
                side="rechts"
                pokemon={rightPokemon}
                statKey={currentStatKey}
                value={rightValue}
                revealed={revealed}
              />
            </div>

            {!revealed ? (
              <div className="higher-lower-guess-row" style={guessRowStyle}>
                <button
                  type="button"
                  className="higher-lower-guess-button"
                  style={guessButtonStyle}
                  disabled={loading}
                  onClick={() => handleGuess("higher")}
                >
                  Höher
                </button>

                <button
                  type="button"
                  className="higher-lower-guess-button"
                  style={guessButtonStyle}
                  disabled={loading}
                  onClick={() => handleGuess("equal")}
                >
                  Gleich
                </button>

                <button
                  type="button"
                  className="higher-lower-guess-button"
                  style={guessButtonStyle}
                  disabled={loading}
                  onClick={() => handleGuess("lower")}
                >
                  Niedriger
                </button>
              </div>
            ) : (
              <div style={resultCardStyle}>
                <div style={resultTitleStyle}>
                  {lastCorrect ? "Richtig!" : "Falsch!"}
                </div>

                {!lastCorrect && (
                  <div style={resetTextStyle}>
                    Deine Serie wurde auf 0 zurückgesetzt.
                  </div>
                )}

                <button
                  type="button"
                  style={mainButtonStyle}
                  disabled={loading}
                  onClick={nextRound}
                >
                  {loading ? "Lädt..." : "Weiter"}
                </button>
              </div>
            )}
          </div>
        )}
      </section>
    </main>
  );
}

function PokemonCard({ side, pokemon, statKey, value, revealed }) {
  return (
    <section className="higher-lower-pokemon-card" style={pokemonCardStyle}>
      <div className="higher-lower-card-side" style={cardSideStyle}>{side}</div>

      <div className="higher-lower-image-wrap" style={imageWrapStyle}>
        {pokemon ? (
          <img
            className="higher-lower-pokemon-image"
            src={pokemon.sprite}
            alt={pokemon.name}
            style={pokemonImageStyle}
            draggable={false}
          />
        ) : (
          <div className="higher-lower-pokemon-placeholder" style={imagePlaceholderStyle}>?</div>
        )}
      </div>

      <h2 className="higher-lower-pokemon-name" style={pokemonNameStyle}>
        {pokemon?.name || "Lädt..."}
      </h2>

      <div className="higher-lower-stat-box" style={statBoxStyle}>
        <div className="higher-lower-stat-label" style={statLabelStyle}>{getStatLabel(statKey)}</div>
        <div className="higher-lower-stat-value" style={statValueStyle}>
          {revealed ? value : "???"}
        </div>
      </div>
    </section>
  );
}

const pageStyle = {
  minHeight: "100dvh",
  padding: "200px 0",
  overflowX: "hidden",
};

const panelStyle = {
  width: "min(1180px, calc(100vw - 28px))",
  margin: "0 auto",
  padding: "20px",
  border: "1px solid rgba(126, 165, 255, 0.22)",
  borderRadius: 24,
  background: "linear-gradient(180deg, rgba(8, 14, 31, 0.96), rgba(5, 10, 23, 0.94))",
  boxShadow: "0 22px 60px rgba(0, 0, 0, 0.4)",
};

const headerStyle = {
  marginTop: 10,
  marginBottom: 14,
};

const eyebrowStyle = {
  margin: 0,
  color: "#42ff9b",
  fontSize: 13,
  fontWeight: 950,
  letterSpacing: 3,
  textTransform: "uppercase",
};

const titleStyle = {
  margin: "10px 0 6px",
  fontSize: "clamp(32px, 5.5vw, 56px)",
  lineHeight: 0.95,
  fontWeight: 950,
  color: "#f6fbff",
  textShadow: "0 4px 0 rgba(54, 255, 150, 0.28)",
};

const subtitleStyle = {
  margin: 0,
  opacity: 0.78,
  fontSize: 16,
  fontWeight: 700,
};

const menuGridStyle = {
  display: "grid",
  gridTemplateColumns: "1fr",
  gap: 12,
};

const settingsCardStyle = {
  padding: 16,
  border: "1px solid rgba(126, 165, 255, 0.22)",
  borderRadius: 20,
  background: "rgba(7, 13, 30, 0.78)",
};

const compactFiltersCardStyle = {
  ...settingsCardStyle,
  gridColumn: "1 / -1",
  position: "relative",
  overflow: "visible",
  zIndex: 5,
};

const filterGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
  gap: 14,
  alignItems: "start",
};

const filterItemStyle = {
  position: "relative",
  display: "grid",
  gap: 8,
  minWidth: 0,
};

const compactLabelStyle = {
  fontSize: 13,
  fontWeight: 950,
  letterSpacing: 1.2,
  textTransform: "uppercase",
  opacity: 0.72,
};

const popupWrapStyle = {
  position: "relative",
};

const popupTriggerStyle = {
  width: "100%",
  minHeight: 56,
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) 28px",
  alignItems: "center",
  gap: 10,
  textAlign: "left",
  border: "1px solid rgba(126, 165, 255, 0.28)",
  borderRadius: 14,
  padding: "10px 12px 10px 14px",
  background: "rgba(16, 29, 55, 0.82)",
  color: "#f5f8ff",
  cursor: "pointer",
};

const popupTriggerContentStyle = {
  minWidth: 0,
};

const popupTriggerMainStyle = {
  display: "block",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  fontSize: 15,
  fontWeight: 950,
};

const popupTriggerSubStyle = {
  display: "block",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  marginTop: 2,
  opacity: 0.66,
  fontSize: 12,
  fontWeight: 700,
};

const popupCaretStyle = {
  width: 26,
  height: 26,
  display: "grid",
  placeItems: "center",
  borderRadius: 999,
  border: "1px solid rgba(255, 255, 255, 0.12)",
  background: "rgba(255, 255, 255, 0.045)",
};

const popupChevronStyle = {
  width: 8,
  height: 8,
  borderRight: "2px solid rgba(66, 255, 155, 0.9)",
  borderBottom: "2px solid rgba(66, 255, 155, 0.9)",
  transition: "transform 140ms ease",
};

const popupMenuStyle = {
  position: "absolute",
  top: "calc(100% + 8px)",
  left: 0,
  width: "100%",
  minWidth: 280,
  zIndex: 30,
  padding: 12,
  border: "1px solid rgba(126, 165, 255, 0.28)",
  borderRadius: 16,
  background: "linear-gradient(180deg, rgba(10, 18, 39, 0.98), rgba(7, 12, 28, 0.98))",
  boxShadow: "0 18px 40px rgba(0, 0, 0, 0.34)",
};

const popupMenuWideStyle = {
  ...popupMenuStyle,
  width: "min(560px, 92vw)",
};

const popupMenuHeaderStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 10,
  marginBottom: 10,
  color: "#f5f8ff",
};

const popupActionRowStyle = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
};

const popupActionButtonStyle = {
  border: "1px solid rgba(126, 165, 255, 0.26)",
  borderRadius: 999,
  padding: "7px 11px",
  background: "rgba(16, 29, 55, 0.88)",
  color: "#f5f8ff",
  fontSize: 12,
  fontWeight: 900,
  cursor: "pointer",
};

const popupListStyle = {
  display: "grid",
  gap: 8,
};

const genPopupListStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
  gap: 8,
};

const popupOptionStyle = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  width: "100%",
  minHeight: 42,
  border: "1px solid rgba(126, 165, 255, 0.24)",
  borderRadius: 12,
  padding: "9px 12px",
  background: "rgba(16, 29, 55, 0.76)",
  color: "#f5f8ff",
  fontSize: 14,
  fontWeight: 900,
  cursor: "pointer",
  textAlign: "left",
};

const genPopupOptionStyle = {
  minHeight: 42,
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) auto",
  alignItems: "center",
  gap: 8,
  border: "1px solid rgba(126, 165, 255, 0.24)",
  borderRadius: 12,
  padding: "6px 7px",
  background: "rgba(16, 29, 55, 0.76)",
};

const genToggleButtonStyle = {
  minWidth: 0,
  height: 30,
  display: "flex",
  alignItems: "center",
  gap: 7,
  border: 0,
  background: "transparent",
  color: "#f5f8ff",
  fontSize: 13,
  fontWeight: 900,
  cursor: "pointer",
  textAlign: "left",
};

const onlyGenButtonStyle = {
  height: 28,
  border: "1px solid rgba(126, 165, 255, 0.26)",
  borderRadius: 999,
  padding: "0 9px",
  background: "rgba(8, 16, 35, 0.72)",
  color: "#f5f8ff",
  fontSize: 11,
  fontWeight: 950,
  cursor: "pointer",
};

const popupOptionActiveStyle = {
  border: "1px solid rgba(66, 255, 155, 0.5)",
  background: "linear-gradient(135deg, rgba(22, 90, 70, 0.96), rgba(12, 54, 62, 0.94))",
};

const popupHintStyle = {
  margin: "10px 0 0",
  opacity: 0.68,
  fontSize: 12,
  fontWeight: 700,
};

const startCardStyle = {
  ...settingsCardStyle,
  gridColumn: "1 / -1",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 18,
  flexWrap: "wrap",
};

const sectionTitleStyle = {
  margin: "0 0 14px",
  fontSize: 20,
  fontWeight: 950,
  color: "#f6fbff",
};

const sectionHeaderRowStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 10,
  marginBottom: 14,
};

const miniGenActionsStyle = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
  justifyContent: "flex-end",
};

const miniGenButtonStyle = {
  border: "1px solid rgba(126, 165, 255, 0.28)",
  borderRadius: 999,
  padding: "8px 12px",
  background: "rgba(16, 29, 55, 0.82)",
  color: "#f5f8ff",
  fontSize: 12,
  fontWeight: 950,
  cursor: "pointer",
  whiteSpace: "nowrap",
};

const optionGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
  gap: 10,
};

const optionButtonStyle = {
  minHeight: 50,
  border: "1px solid rgba(126, 165, 255, 0.28)",
  borderRadius: 14,
  padding: "10px 14px",
  background: "rgba(16, 29, 55, 0.82)",
  color: "#f5f8ff",
  fontWeight: 950,
  cursor: "pointer",
  textAlign: "left",
};

const activeOptionButtonStyle = {
  border: "1px solid rgba(66, 255, 155, 0.55)",
  background: "linear-gradient(135deg, rgba(21, 79, 68, 0.98), rgba(14, 41, 60, 0.98))",
  boxShadow: "0 0 0 3px rgba(66, 255, 155, 0.08)",
};

const formGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
  gap: 10,
};

const formButtonStyle = {
  display: "flex",
  justifyContent: "flex-start",
  alignItems: "center",
  gap: 10,
  minHeight: 46,
  border: "1px solid rgba(126, 165, 255, 0.26)",
  borderRadius: 14,
  padding: "10px 12px",
  background: "linear-gradient(135deg, rgba(16, 29, 55, 0.82), rgba(9, 18, 40, 0.82))",
  color: "#f5f8ff",
  fontSize: 14,
  fontWeight: 950,
  cursor: "pointer",
  whiteSpace: "nowrap",
  boxShadow: "inset 0 1px 0 rgba(255, 255, 255, 0.05)",
};

const activeFormButtonStyle = {
  border: "1px solid rgba(66, 255, 155, 0.52)",
  background: "linear-gradient(135deg, rgba(22, 90, 70, 0.96), rgba(12, 54, 62, 0.94))",
  boxShadow: "0 0 0 3px rgba(66, 255, 155, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.07)",
};

const genGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
  gap: 10,
};

const genButtonStyle = {
  display: "flex",
  justifyContent: "flex-start",
  alignItems: "center",
  gap: 10,
  minHeight: 46,
  border: "1px solid rgba(126, 165, 255, 0.26)",
  borderRadius: 14,
  padding: "10px 12px",
  background: "linear-gradient(135deg, rgba(16, 29, 55, 0.82), rgba(9, 18, 40, 0.82))",
  color: "#f5f8ff",
  fontSize: 14,
  fontWeight: 950,
  cursor: "pointer",
  whiteSpace: "nowrap",
  boxShadow: "inset 0 1px 0 rgba(255, 255, 255, 0.05)",
};

const activeGenButtonStyle = {
  border: "1px solid rgba(66, 255, 155, 0.52)",
  background: "linear-gradient(135deg, rgba(22, 90, 70, 0.96), rgba(12, 54, 62, 0.94))",
  boxShadow: "0 0 0 3px rgba(66, 255, 155, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.07)",
};

const checkStyle = {
  width: 20,
  height: 20,
  flex: "0 0 20px",
  display: "inline-grid",
  placeItems: "center",
  borderRadius: 999,
  border: "1px solid rgba(255, 255, 255, 0.18)",
  background: "rgba(255, 255, 255, 0.08)",
  color: "#42ff9b",
  fontSize: 12,
  fontWeight: 950,
  lineHeight: 1,
};

const smallInfoStyle = {
  margin: "12px 0 0",
  opacity: 0.68,
  fontSize: 13,
  fontWeight: 700,
};

const highscoreBigStyle = {
  fontSize: 44,
  lineHeight: 1,
  fontWeight: 950,
  color: "#42ff9b",
};

const startActionsStyle = {
  display: "flex",
  gap: 10,
  flexWrap: "wrap",
};

const mainButtonStyle = {
  border: "1px solid rgba(66, 255, 155, 0.45)",
  borderRadius: 14,
  padding: "13px 18px",
  background: "linear-gradient(135deg, rgba(28, 92, 75, 0.98), rgba(13, 45, 62, 0.98))",
  color: "#f5f8ff",
  fontWeight: 950,
  cursor: "pointer",
};

const ghostButtonStyle = {
  border: "1px solid rgba(126, 165, 255, 0.3)",
  borderRadius: 14,
  padding: "13px 18px",
  background: "rgba(16, 29, 55, 0.78)",
  color: "#f5f8ff",
  fontWeight: 950,
  cursor: "pointer",
};

const gameWrapStyle = {
  display: "grid",
  gap: 12,
};

const scoreRowStyle = {
  display: "flex",
  gap: 10,
  flexWrap: "wrap",
};

const scorePillStyle = {
  border: "1px solid rgba(126, 165, 255, 0.25)",
  borderRadius: 999,
  padding: "9px 13px",
  background: "rgba(16, 29, 55, 0.74)",
  color: "#f5f8ff",
  fontWeight: 850,
};

const scoreSubLabelStyle = {
  marginLeft: 8,
  opacity: 0.62,
  fontSize: 12,
  fontWeight: 850,
};

const versusGridStyle = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) 96px minmax(0, 1fr)",
  gap: 12,
  alignItems: "stretch",
};

const pokemonCardStyle = {
  minHeight: 350,
  display: "grid",
  gridTemplateRows: "auto minmax(150px, 1fr) auto auto",
  gap: 9,
  padding: 14,
  border: "1px solid rgba(126, 165, 255, 0.22)",
  borderRadius: 22,
  background: "linear-gradient(180deg, rgba(10, 18, 39, 0.94), rgba(7, 12, 28, 0.92))",
  boxShadow: "0 16px 38px rgba(0, 0, 0, 0.22)",
};

const cardSideStyle = {
  opacity: 0.65,
  fontSize: 12,
  fontWeight: 950,
  letterSpacing: 2,
  textTransform: "uppercase",
};

const imageWrapStyle = {
  display: "grid",
  placeItems: "center",
  minHeight: 170,
};

const pokemonImageStyle = {
  width: "min(220px, 76%)",
  maxHeight: 205,
  objectFit: "contain",
  filter: "drop-shadow(0 20px 22px rgba(0, 0, 0, 0.3))",
  userSelect: "none",
};

const imagePlaceholderStyle = {
  width: 190,
  height: 190,
  display: "grid",
  placeItems: "center",
  borderRadius: "50%",
  border: "1px solid rgba(126, 165, 255, 0.22)",
  background: "rgba(255, 255, 255, 0.04)",
  fontSize: 58,
  fontWeight: 950,
  opacity: 0.6,
};

const pokemonNameStyle = {
  margin: 0,
  textAlign: "center",
  fontSize: "clamp(24px, 3.4vw, 38px)",
  fontWeight: 950,
  color: "#f6fbff",
};

const statBoxStyle = {
  display: "grid",
  gap: 4,
  justifyItems: "center",
  padding: "13px 14px",
  border: "1px solid rgba(126, 165, 255, 0.22)",
  borderRadius: 17,
  background: "rgba(2, 8, 20, 0.52)",
};

const statLabelStyle = {
  opacity: 0.72,
  fontSize: 13,
  fontWeight: 900,
};

const statValueStyle = {
  fontSize: 32,
  lineHeight: 1,
  fontWeight: 950,
  color: "#42ff9b",
};

const centerStyle = {
  display: "grid",
  placeItems: "center",
  alignContent: "center",
  gap: 10,
};

const versusTextStyle = {
  width: 78,
  height: 78,
  display: "grid",
  placeItems: "center",
  borderRadius: "50%",
  border: "1px solid rgba(66, 255, 155, 0.3)",
  background: "rgba(20, 70, 65, 0.72)",
  color: "#f5f8ff",
  fontSize: 25,
  fontWeight: 950,
};

const compareTextStyle = {
  opacity: 0.72,
  fontSize: 13,
  fontWeight: 800,
  textAlign: "center",
};

const guessRowStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
  gap: 12,
};

const guessButtonStyle = {
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  gap: 10,
  border: "1px solid rgba(126, 165, 255, 0.28)",
  borderRadius: 16,
  padding: "13px 18px",
  background: "linear-gradient(135deg, rgba(18, 37, 70, 0.98), rgba(11, 23, 48, 0.98))",
  color: "#f5f8ff",
  fontSize: 18,
  fontWeight: 950,
  cursor: "pointer",
};

const resultCardStyle = {
  display: "grid",
  gap: 10,
  justifyItems: "center",
  padding: 18,
  border: "1px solid rgba(66, 255, 155, 0.3)",
  borderRadius: 20,
  background: "rgba(8, 22, 33, 0.84)",
  textAlign: "center",
};

const resultTitleStyle = {
  fontSize: 30,
  fontWeight: 950,
  color: "#42ff9b",
};

const resetTextStyle = {
  color: "#ffb86b",
  fontSize: 14,
  fontWeight: 900,
};

const errorStyle = {
  padding: "12px 14px",
  border: "1px solid rgba(255, 110, 110, 0.35)",
  borderRadius: 14,
  background: "rgba(80, 20, 30, 0.42)",
  color: "#ffd6d6",
  fontWeight: 850,
};