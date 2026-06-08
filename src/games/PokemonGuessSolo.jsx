// src/games/PokemonGuessSolo.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  DEFAULT_GUESS_SETTINGS,
  GENERATION_OPTIONS,
  GUESS_CLUE_LABELS,
  GUESS_CLUE_TYPES,
  GUESS_PLAY_MODE_LABELS,
  GUESS_PLAY_MODES,
  GUESS_REVEAL_LABELS,
  GUESS_REVEAL_MODES,
  buildClueOrderFromSettings,
  createGuessRound,
  doesGuessMatch,
  getAvailableTipTypes,
  getEffectiveRevealMode,
  getPokemonNameSuggestions,
  getScoreForClue,
  getVisibleClues,
} from "./guessGameEngine";
import {
  loadPokemonGuessDetails,
  loadPokemonGuessPool,
} from "./pokemonGuessApi";
import "./guessStyles.css";

const PREVIEW_PIKACHU_URL =
  "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/25.png";

const PREVIEW_PIKACHU_STATS = {
  kp: 35,
  atk: 55,
  def: 40,
  spAtk: 50,
  spDef: 50,
  init: 90,
};

const SOLO_GAME_STATE_KEY = "pokemon_guess_solo_state_v1";

function mergeGuessSettings(savedSettings) {
  const safeSettings = savedSettings || {};

  return {
    ...DEFAULT_GUESS_SETTINGS,
    ...safeSettings,
    selectedGens:
      Array.isArray(safeSettings.selectedGens) && safeSettings.selectedGens.length > 0
        ? safeSettings.selectedGens
        : DEFAULT_GUESS_SETTINGS.selectedGens,
    tipOrder:
      Array.isArray(safeSettings.tipOrder) && safeSettings.tipOrder.length > 0
        ? safeSettings.tipOrder
        : DEFAULT_GUESS_SETTINGS.tipOrder,
    pixel: {
      ...DEFAULT_GUESS_SETTINGS.pixel,
      ...(safeSettings.pixel || {}),
    },
    distorted: {
      ...DEFAULT_GUESS_SETTINGS.distorted,
      ...(safeSettings.distorted || {}),
    },
  };
}

function readSavedSoloGame() {
  try {
    const raw = sessionStorage.getItem(SOLO_GAME_STATE_KEY);
    if (!raw) return null;

    const saved = JSON.parse(raw);

    if (!saved?.gameStarted || !saved?.round) {
      return null;
    }

    return {
      ...saved,
      settings: mergeGuessSettings(saved.settings),
    };
  } catch {
    return null;
  }
}

function clearSavedSoloGame() {
  try {
    sessionStorage.removeItem(SOLO_GAME_STATE_KEY);
  } catch {
    // ignore
  }
}


export default function PokemonGuessSolo() {
  const navigate = useNavigate();

  const [settings, setSettings] = useState(DEFAULT_GUESS_SETTINGS);
  const [pokemonPool, setPokemonPool] = useState([]);
  const [gameStarted, setGameStarted] = useState(false);
  const [roundNumber, setRoundNumber] = useState(1);
  const [score, setScore] = useState(0);
  const [round, setRound] = useState(null);
  const [finished, setFinished] = useState(false);
  const [guessInput, setGuessInput] = useState("");
  const [loadingText, setLoadingText] = useState("");
  const [loadError, setLoadError] = useState("");
  const [paused, setPaused] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const saved = readSavedSoloGame();

    if (saved) {
      setSettings(saved.settings);
      setPokemonPool(Array.isArray(saved.pokemonPool) ? saved.pokemonPool : []);
      setGameStarted(true);
      setRoundNumber(Number(saved.roundNumber) || 1);
      setScore(Number(saved.score) || 0);
      setRound(saved.round);
      setFinished(Boolean(saved.finished));
      setGuessInput("");
      setLoadingText("");
      setLoadError("");
      setPaused(Boolean(saved.paused));
    }

    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;

    if (!gameStarted || !round) {
      return;
    }

    try {
      const snapshot = {
        settings,
        pokemonPool,
        gameStarted,
        roundNumber,
        score,
        round,
        finished,
        paused,
        savedAt: Date.now(),
      };

      sessionStorage.setItem(SOLO_GAME_STATE_KEY, JSON.stringify(snapshot));
    } catch {
      // ignore
    }
  }, [
    hydrated,
    settings,
    pokemonPool,
    gameStarted,
    roundNumber,
    score,
    round,
    finished,
    paused,
  ]);

  const effectiveRevealMode = getEffectiveRevealMode(settings);

  const rawVisibleClues = useMemo(() => {
    return getVisibleClues(round, effectiveRevealMode);
  }, [round, effectiveRevealMode]);

  const visibleClues = useMemo(() => {
    const showOnlyCurrentVisualStage =
      settings.playMode === GUESS_PLAY_MODES.PIXEL ||
      settings.playMode === GUESS_PLAY_MODES.DISTORTED;

    if (showOnlyCurrentVisualStage && rawVisibleClues.length > 0) {
      return [rawVisibleClues[rawVisibleClues.length - 1]];
    }

    return rawVisibleClues;
  }, [rawVisibleClues, settings.playMode]);

  const cluesUsedForScore =
    effectiveRevealMode === GUESS_REVEAL_MODES.DIRECT
      ? 1
      : Math.max(1, rawVisibleClues.length || 1);

  const suggestions = useMemo(() => {
    return getPokemonNameSuggestions(guessInput, pokemonPool);
  }, [guessInput, pokemonPool]);

  const canRevealMore =
    round &&
    !round.answered &&
    round.clueIndex < round.clues.length - 1 &&
    effectiveRevealMode !== GUESS_REVEAL_MODES.DIRECT;

  const possiblePoints = getScoreForClue(
    cluesUsedForScore,
    round?.clues?.length || 1
  );

  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key !== "Escape") return;
      if (!gameStarted || finished) return;

      event.preventDefault();
      setPaused((current) => !current);
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [gameStarted, finished]);

  useEffect(() => {
    if (!gameStarted || finished || paused || !round || round.answered) return;
    if (effectiveRevealMode !== GUESS_REVEAL_MODES.TIME) return;
    if (round.clueIndex >= round.clues.length - 1) return;

    const timer = setTimeout(() => {
      setRound((current) => {
        if (!current || current.answered) return current;
        if (current.clueIndex >= current.clues.length - 1) return current;

        return {
          ...current,
          clueIndex: current.clueIndex + 1,
        };
      });
    }, settings.secondsPerClue * 1000);

    return () => clearTimeout(timer);
  }, [
    gameStarted,
    finished,
    paused,
    round?.id,
    round?.clueIndex,
    round?.answered,
    effectiveRevealMode,
    settings.secondsPerClue,
  ]);

  function updateSetting(key, value) {
    setSettings((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function updateVisualSettings(group, key, value) {
    setSettings((current) => ({
      ...current,
      [group]: {
        ...current[group],
        [key]: value,
      },
    }));
  }

  function setPlayMode(playMode) {
    setSettings((current) => {
      let nextRevealMode = current.revealMode;

      if (
        playMode === GUESS_PLAY_MODES.PIXEL ||
        playMode === GUESS_PLAY_MODES.DISTORTED
      ) {
        nextRevealMode = GUESS_REVEAL_MODES.TIME;
      }

      if (
        playMode === GUESS_PLAY_MODES.SILHOUETTE ||
        playMode === GUESS_PLAY_MODES.STATS
      ) {
        nextRevealMode = GUESS_REVEAL_MODES.DIRECT;
      }

      if (playMode === GUESS_PLAY_MODES.TIPS) {
        nextRevealMode = GUESS_REVEAL_MODES.WRONG_GUESS;
      }

      return {
        ...current,
        playMode,
        revealMode: nextRevealMode,
      };
    });
  }

  function toggleGeneration(gen) {
    setSettings((current) => {
      const hasGen = current.selectedGens.includes(gen);
      let nextGens = hasGen
        ? current.selectedGens.filter((item) => item !== gen)
        : [...current.selectedGens, gen];

      if (nextGens.length === 0) {
        nextGens = [gen];
      }

      return {
        ...current,
        selectedGens: nextGens.sort((a, b) => a - b),
      };
    });
  }

  function selectAllGenerations() {
    updateSetting("selectedGens", GENERATION_OPTIONS);
  }

  function selectOnlyGeneration(gen) {
    updateSetting("selectedGens", [gen]);
  }

  function moveTip(index, direction) {
    setSettings((current) => {
      const nextOrder = [...current.tipOrder];
      const targetIndex = index + direction;

      if (targetIndex < 0 || targetIndex >= nextOrder.length) {
        return current;
      }

      const temp = nextOrder[index];
      nextOrder[index] = nextOrder[targetIndex];
      nextOrder[targetIndex] = temp;

      return {
        ...current,
        tipOrder: nextOrder,
      };
    });
  }

  function removeTip(index) {
    setSettings((current) => {
      if (current.tipOrder.length <= 1) return current;

      return {
        ...current,
        tipOrder: current.tipOrder.filter((_, clueIndex) => clueIndex !== index),
      };
    });
  }

  function addTip(clueType) {
    setSettings((current) => {
      if (current.tipOrder.includes(clueType)) return current;

      return {
        ...current,
        tipOrder: [...current.tipOrder, clueType],
      };
    });
  }

  function buildEffectiveSettings() {
    return {
      ...settings,
      revealMode: getEffectiveRevealMode(settings),
      clueOrder: buildClueOrderFromSettings(settings),
    };
  }

  async function buildRound(pool) {
    const effectiveSettings = buildEffectiveSettings();
    const baseRound = createGuessRound(effectiveSettings, pool);
    const detailedTarget = await loadPokemonGuessDetails(baseRound.target);

    return {
      ...baseRound,
      target: detailedTarget,
    };
  }

  async function startGame() {
    clearSavedSoloGame();
    setLoadError("");
    setLoadingText("Pokémon-Daten werden geladen...");

    try {
      const pool = await loadPokemonGuessPool(settings.selectedGens);
      const firstRound = await buildRound(pool);

      setPokemonPool(pool);
      setRoundNumber(1);
      setScore(0);
      setFinished(false);
      setGuessInput("");
      setRound(firstRound);
      setGameStarted(true);
      setPaused(false);
    } catch (error) {
      console.error(error);
      setLoadError(
        "Die Pokémon-Daten konnten nicht geladen werden. Prüfe deine Internetverbindung oder lade die Seite neu."
      );
    } finally {
      setLoadingText("");
    }
  }

  function backToSettings() {
    clearSavedSoloGame();
    setGameStarted(false);
    setFinished(false);
    setPaused(false);
    setRound(null);
    setRoundNumber(1);
    setScore(0);
    setGuessInput("");
    setLoadError("");
  }

  function backToLobby() {
    clearSavedSoloGame();
    navigate("/games/pokemon-guess");
  }

  function submitGuess(event) {
    event.preventDefault();

    if (!round || round.answered || finished || loadingText || paused) return;

    const cleanGuess = guessInput.trim();
    if (!cleanGuess) return;

    const isCorrect = doesGuessMatch(round.target, cleanGuess);

    if (isCorrect) {
      const gainedScore = getScoreForClue(
        cluesUsedForScore,
        round.clues.length
      );

      setScore((current) => current + gainedScore);
      setRound((current) => ({
        ...current,
        answered: true,
        correct: true,
        selectedName: cleanGuess,
        gainedScore,
      }));
      setGuessInput("");
      return;
    }

    setRound((current) => {
      if (!current) return current;

      const shouldRevealNext =
        effectiveRevealMode === GUESS_REVEAL_MODES.WRONG_GUESS &&
        current.clueIndex < current.clues.length - 1;

      return {
        ...current,
        selectedName: cleanGuess,
        wrongGuesses: current.wrongGuesses + 1,
        clueIndex: shouldRevealNext ? current.clueIndex + 1 : current.clueIndex,
      };
    });

    setGuessInput("");
  }

  function revealNextClue() {
    if (!canRevealMore || paused) return;

    setRound((current) => ({
      ...current,
      clueIndex: current.clueIndex + 1,
    }));
  }

  function giveUpRound() {
    if (!round || round.answered || paused) return;

    setRound((current) => ({
      ...current,
      answered: true,
      correct: false,
      gaveUp: true,
      gainedScore: 0,
    }));
  }

  async function goNextRound() {
    if (roundNumber >= settings.totalRounds) {
      setFinished(true);
      return;
    }

    setLoadingText("Nächste Runde wird vorbereitet...");

    try {
      const nextRound = await buildRound(pokemonPool);

      setRoundNumber((current) => current + 1);
      setGuessInput("");
      setRound(nextRound);
      setPaused(false);
    } catch (error) {
      console.error(error);
      setLoadError("Die nächste Runde konnte nicht geladen werden.");
    } finally {
      setLoadingText("");
    }
  }

  if (!gameStarted) {
    return (
      <div className="games-page">
        <div className="games-panel guess-panel">
          <div className="guess-page-actions">
            <button className="games-back-button" type="button" onClick={backToLobby}>
              Zurück zur Lobby
            </button>
          </div>

          <div className="guess-header">
            <p className="guess-kicker">Pokémon Guess</p>
            <h1>Wer ist dieses Pokémon?</h1>
            <p className="games-subtitle">
              Wähle einen Modus, passe ihn an und sieh rechts direkt eine Vorschau.
            </p>
          </div>

          {loadError && <div className="guess-error-box">{loadError}</div>}

          <div className="guess-clean-setup">
            <section className="guess-settings-card">
              <h2>Modus</h2>

              <div className="guess-mode-chip-grid">
                {Object.entries(GUESS_PLAY_MODE_LABELS).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    className={
                      settings.playMode === value
                        ? "guess-mode-chip guess-mode-chip-active"
                        : "guess-mode-chip"
                    }
                    onClick={() => setPlayMode(value)}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <ModeOptions
                settings={settings}
                updateSetting={updateSetting}
                updateVisualSettings={updateVisualSettings}
                effectiveRevealMode={effectiveRevealMode}
              />

              <div className="guess-settings-row">
                <label>
                  <span>Runden</span>
                  <input
                    className="guess-number-input"
                    type="number"
                    min="1"
                    max="50"
                    value={settings.totalRounds}
                    onChange={(event) =>
                      updateSetting(
                        "totalRounds",
                        Math.max(1, Number(event.target.value) || 1)
                      )
                    }
                  />
                </label>

                {effectiveRevealMode === GUESS_REVEAL_MODES.TIME && (
                  <label>
                    <span>Sekunden pro Stufe</span>
                    <input
                      className="guess-number-input"
                      type="number"
                      min="2"
                      max="60"
                      value={settings.secondsPerClue}
                      onChange={(event) =>
                        updateSetting(
                          "secondsPerClue",
                          Math.max(2, Number(event.target.value) || 8)
                        )
                      }
                    />
                  </label>
                )}
              </div>

              <div className="guess-points-note">
                Punkte: Früh lösen gibt bis zu <strong>300 Punkte</strong>. Je mehr
                Hinweise du brauchst, desto weniger Punkte gibt es.
              </div>
            </section>

            <aside className="guess-preview-card">
              <div>
                <h2>Vorschau</h2>
                <p>Beispiel mit Pikachu. Die Einstellungen wirken später genauso im Spiel.</p>
              </div>

              <PreviewImage settings={settings} />
            </aside>

            <section className="guess-settings-card guess-wide-card">
              <div className="guess-section-title-row">
                <div>
                  <h2>Generationen</h2>
                  <p>
                    Wähle einzelne Generationen oder direkt alle. Die Pokémon werden aus
                    der API geladen und danach zwischengespeichert.
                  </p>
                </div>

                <button
                  type="button"
                  className="guess-secondary-button"
                  onClick={selectAllGenerations}
                >
                  Alle auswählen
                </button>
              </div>

              <div className="guess-gen-grid">
                {GENERATION_OPTIONS.map((gen) => (
                  <div
                    key={gen}
                    className={
                      settings.selectedGens.includes(gen)
                        ? "guess-gen-card guess-gen-card-active"
                        : "guess-gen-card"
                    }
                  >
                    <label>
                      <input
                        type="checkbox"
                        checked={settings.selectedGens.includes(gen)}
                        onChange={() => toggleGeneration(gen)}
                      />
                      <span>Gen {gen}</span>
                    </label>

                    <button type="button" onClick={() => selectOnlyGeneration(gen)}>
                      Nur
                    </button>
                  </div>
                ))}
              </div>
            </section>

            {settings.playMode === GUESS_PLAY_MODES.TIPS && (
              <section className="guess-settings-card guess-wide-card">
                <h2>Tipp-Reihenfolge</h2>
                <p>Nur im Tipps-Modus. Die Hinweise oben kommen zuerst.</p>

                <div className="guess-tip-order-list">
                  {settings.tipOrder.map((clueType, index) => (
                    <div key={clueType} className="guess-tip-order-item">
                      <span>
                        {index + 1}. {GUESS_CLUE_LABELS[clueType]}
                      </span>

                      <div>
                        <button type="button" onClick={() => moveTip(index, -1)}>
                          ↑
                        </button>
                        <button type="button" onClick={() => moveTip(index, 1)}>
                          ↓
                        </button>
                        <button type="button" onClick={() => removeTip(index)}>
                          Entfernen
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="guess-add-tip-list">
                  {getAvailableTipTypes()
                    .filter((clueType) => !settings.tipOrder.includes(clueType))
                    .map((clueType) => (
                      <button
                        key={clueType}
                        type="button"
                        onClick={() => addTip(clueType)}
                      >
                        + {GUESS_CLUE_LABELS[clueType]}
                      </button>
                    ))}
                </div>
              </section>
            )}
          </div>

          {loadingText && <div className="guess-loading-box">{loadingText}</div>}

          <button
            className="guess-start-button"
            type="button"
            onClick={startGame}
            disabled={Boolean(loadingText)}
          >
            {loadingText ? "Lädt..." : "Spiel starten"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="games-page">
      <div className="games-panel guess-panel">
        <div className="guess-page-actions">
          <button className="games-back-button" type="button" onClick={backToLobby}>
            Lobby
          </button>

          <button className="games-back-button" type="button" onClick={backToSettings}>
            Einstellungen
          </button>

          {!finished && (
            <button
              className="games-back-button"
              type="button"
              onClick={() => setPaused((current) => !current)}
            >
              {paused ? "Fortsetzen" : "Pause"}
            </button>
          )}
        </div>

        <div className="guess-topbar">
          <div>
            <p className="guess-kicker">Pokémon Guess</p>
            <h1>Wer ist dieses Pokémon?</h1>
            <p className="games-subtitle">
              Schreibe den deutschen Namen. Mit <strong>ESC</strong> pausierst du.
            </p>
          </div>

          <div className="guess-score-box">
            <span>
              Runde {roundNumber}/{settings.totalRounds}
            </span>
            <strong>{score} Punkte</strong>
          </div>
        </div>

        {loadError && <div className="guess-error-box">{loadError}</div>}
        {loadingText && <div className="guess-loading-box">{loadingText}</div>}

        {finished ? (
          <div className="guess-result-box">
            <h2>Spiel beendet!</h2>
            <p>
              Dein Ergebnis: <strong>{score}</strong> Punkte
            </p>

            <button className="guess-next-button" type="button" onClick={backToSettings}>
              Zurück zu den Einstellungen
            </button>
          </div>
        ) : (
          <>
            <div className="guess-clue-card">
              <div className="guess-clue-label">
                <span>
                  Hinweise {visibleClues.length}/{round.clues.length}
                </span>
                {!round.answered && <strong>{possiblePoints} Punkte möglich</strong>}
              </div>

              <ClueStack clues={visibleClues} target={round.target} revealed={round.answered} />
            </div>

            {!round.answered && (
              <>
                <form className="guess-input-row" onSubmit={submitGuess}>
                  <input
                    className="guess-name-input"
                    value={guessInput}
                    onChange={(event) => setGuessInput(event.target.value)}
                    placeholder="Pokémon-Name eingeben..."
                    list="pokemon-guess-suggestions"
                    autoFocus
                    disabled={Boolean(loadingText) || paused}
                  />

                  <datalist id="pokemon-guess-suggestions">
                    {suggestions.map((pokemon) => (
                      <option key={pokemon.dexId} value={pokemon.name} />
                    ))}
                  </datalist>

                  <button
                    className="guess-submit-button"
                    type="submit"
                    disabled={Boolean(loadingText) || paused}
                  >
                    Raten
                  </button>
                </form>

                {round.selectedName && (
                  <div className="guess-small-info">
                    <strong>{round.selectedName}</strong> war falsch.
                    {effectiveRevealMode === GUESS_REVEAL_MODES.WRONG_GUESS && canRevealMore
                      ? " Neuer Hinweis wurde aufgedeckt."
                      : ""}
                  </div>
                )}

                <div className="guess-action-row">
                  {effectiveRevealMode === GUESS_REVEAL_MODES.MANUAL && (
                    <button
                      className="guess-secondary-button"
                      type="button"
                      onClick={revealNextClue}
                      disabled={!canRevealMore || paused}
                    >
                      Nächster Hinweis
                    </button>
                  )}

                  <button
                    className="guess-secondary-button"
                    type="button"
                    onClick={giveUpRound}
                    disabled={paused}
                  >
                    Auflösen
                  </button>
                </div>
              </>
            )}

            {round.answered && (
              <div className="guess-result-box">
                {round.correct ? (
                  <>
                    <h2>Richtig!</h2>
                    <p>
                      Es war <strong>{round.target.name}</strong>.
                    </p>
                    <p>+{round.gainedScore} Punkte</p>
                  </>
                ) : (
                  <>
                    <h2>Aufgelöst!</h2>
                    <p>
                      Es war <strong>{round.target.name}</strong>.
                    </p>
                  </>
                )}

                <button
                  className="guess-next-button"
                  type="button"
                  onClick={goNextRound}
                  disabled={Boolean(loadingText)}
                >
                  {roundNumber >= settings.totalRounds
                    ? "Ergebnis anzeigen"
                    : "Nächste Runde"}
                </button>
              </div>
            )}
          </>
        )}

        {paused && !finished && (
          <div className="guess-pause-overlay">
            <div className="guess-pause-box">
              <h2>Pausiert</h2>
              <p>Das Spiel ist angehalten. Timer laufen erst weiter, wenn du fortsetzt.</p>

              <button type="button" onClick={() => setPaused(false)}>
                Fortsetzen
              </button>
              <button type="button" onClick={backToSettings}>
                Zurück zu Einstellungen
              </button>
              <button type="button" onClick={backToLobby}>
                Zurück zur Lobby
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ModeOptions({ settings, updateSetting, updateVisualSettings, effectiveRevealMode }) {
  const showReveal =
    settings.playMode === GUESS_PLAY_MODES.TIPS ||
    settings.playMode === GUESS_PLAY_MODES.PIXEL ||
    settings.playMode === GUESS_PLAY_MODES.DISTORTED;

  return (
    <div className="guess-mode-options">
      {settings.playMode === GUESS_PLAY_MODES.PIXEL && (
        <>
          <SliderRow
            label="Verpixelung"
            value={settings.pixel.strength}
            min={1}
            max={6}
            onChange={(value) => updateVisualSettings("pixel", "strength", value)}
          />

          <ToggleRow
            label="Silhouette + Verpixelung"
            checked={settings.pixel.black}
            onChange={(value) => updateVisualSettings("pixel", "black", value)}
          />
        </>
      )}

      {settings.playMode === GUESS_PLAY_MODES.DISTORTED && (
        <>
          <SliderRow
            label="Horizontal verzerren"
            value={settings.distorted.horizontal ?? settings.distorted.strength ?? 6}
            min={1}
            max={6}
            onChange={(value) =>
              updateVisualSettings("distorted", "horizontal", value)
            }
          />

          <SliderRow
            label="Vertikal verzerren"
            value={settings.distorted.vertical ?? settings.distorted.strength ?? 6}
            min={1}
            max={6}
            onChange={(value) =>
              updateVisualSettings("distorted", "vertical", value)
            }
          />

          <ToggleRow
            label="Silhouette + Verzerrung"
            checked={settings.distorted.black}
            onChange={(value) => updateVisualSettings("distorted", "black", value)}
          />
        </>
      )}

      {showReveal && (
        <div className="guess-reveal-block">
          <span>Aufdecken</span>

          <div className="guess-reveal-choice-grid">
            {Object.entries(GUESS_REVEAL_LABELS).map(([value, label]) => (
              <button
                key={value}
                type="button"
                className={
                  effectiveRevealMode === value
                    ? "guess-choice-button guess-choice-button-active"
                    : "guess-choice-button"
                }
                onClick={() => updateSetting("revealMode", value)}
              >
                {label}
              </button>
            ))}
          </div>

          {effectiveRevealMode === GUESS_REVEAL_MODES.TIME && (
            <p>
              Bei „Nach Zeit“ wird das Bild automatisch leichter, also z. B.
              entpixelt oder entzerrt.
            </p>
          )}
        </div>
      )}

      {settings.playMode === GUESS_PLAY_MODES.SILHOUETTE && (
        <p className="guess-simple-mode-info">
          Du siehst direkt nur die schwarze Silhouette.
        </p>
      )}

      {settings.playMode === GUESS_PLAY_MODES.STATS && (
        <p className="guess-simple-mode-info">
          Du siehst direkt nur die Basiswerte.
        </p>
      )}

      {settings.playMode === GUESS_PLAY_MODES.TIPS && (
        <p className="guess-simple-mode-info">
          Du spielst mit mehreren Hinweisen. Die Reihenfolge kannst du unten ändern.
        </p>
      )}
    </div>
  );
}

function SliderRow({ label, value, min, max, onChange }) {
  return (
    <label className="guess-slider-row">
      <div>
        <span>{label}</span>
        <strong>{value}/{max}</strong>
      </div>

      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
}

function ToggleRow({ label, checked, onChange }) {
  return (
    <label className="guess-toggle-row">
      <span>{label}</span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
    </label>
  );
}

function PreviewImage({ settings }) {
  if (settings.playMode === GUESS_PLAY_MODES.PIXEL) {
    return (
      <PixelatedImage
        src={PREVIEW_PIKACHU_URL}
        alt="Pikachu Vorschau"
        strength={settings.pixel.strength}
        black={settings.pixel.black}
      />
    );
  }

  if (settings.playMode === GUESS_PLAY_MODES.DISTORTED) {
    return (
      <DistortedImage
        src={PREVIEW_PIKACHU_URL}
        alt="Pikachu Vorschau"
        horizontal={settings.distorted.horizontal ?? settings.distorted.strength ?? 6}
        vertical={settings.distorted.vertical ?? settings.distorted.strength ?? 6}
        black={settings.distorted.black}
      />
    );
  }

  if (settings.playMode === GUESS_PLAY_MODES.SILHOUETTE) {
    return (
      <img
        className="guess-image guess-image-silhouette"
        src={PREVIEW_PIKACHU_URL}
        alt="Pikachu Silhouette"
        draggable="false"
      />
    );
  }

  if (settings.playMode === GUESS_PLAY_MODES.STATS) {
    return <StatsClue stats={PREVIEW_PIKACHU_STATS} />;
  }

  return (
    <img
      className="guess-image"
      src={PREVIEW_PIKACHU_URL}
      alt="Pikachu Vorschau"
      draggable="false"
    />
  );
}

function ClueStack({ clues, target, revealed }) {
  return (
    <div className="guess-clue-stack">
      {clues.map((clue, index) => (
        <SingleClue
          key={`${clue.type}-${index}-${clue.strength || ""}-${clue.horizontal || ""}-${clue.vertical || ""}-${clue.black || ""}`}
          clue={clue}
          target={target}
        />
      ))}

      {revealed && (
        <div className="guess-final-reveal">
          <img
            className="guess-image"
            src={target.imageUrl}
            alt={target.name}
            draggable="false"
          />
          <div className="guess-reveal-name">{target.name}</div>
        </div>
      )}
    </div>
  );
}

function SingleClue({ clue, target }) {
  const clueType = clue.type;

  if (clueType === GUESS_CLUE_TYPES.TYPES) {
    return (
      <div className="guess-text-clue">
        <span className="guess-clue-title">Typen</span>
        <div className="guess-type-list">
          {(target.types || []).map((type) => (
            <strong key={type}>{type}</strong>
          ))}
        </div>
      </div>
    );
  }

  if (clueType === GUESS_CLUE_TYPES.GEN) {
    return (
      <div className="guess-text-clue">
        <span className="guess-clue-title">Generation</span>
        <strong>Generation {target.gen}</strong>
      </div>
    );
  }

  if (clueType === GUESS_CLUE_TYPES.ABILITY) {
    return (
      <div className="guess-text-clue">
        <span className="guess-clue-title">Fähigkeit</span>
        <strong>{target.ability || "Unbekannt"}</strong>
      </div>
    );
  }

  if (clueType === GUESS_CLUE_TYPES.MOVES) {
    return (
      <div className="guess-text-clue">
        <span className="guess-clue-title">Attacken</span>
        <div className="guess-move-list">
          {(target.moves || []).map((move) => (
            <strong key={move}>{move}</strong>
          ))}
        </div>
      </div>
    );
  }

  if (clueType === GUESS_CLUE_TYPES.STATS) {
    return <StatsClue stats={target.stats} />;
  }

  if (clueType === GUESS_CLUE_TYPES.CATEGORY) {
    return (
      <div className="guess-text-clue">
        <span className="guess-clue-title">Kategorie</span>
        <strong>{target.category || "Keine Kategorie"}</strong>
      </div>
    );
  }

  if (clueType === GUESS_CLUE_TYPES.SILHOUETTE) {
    return (
      <div className="guess-image-wrap">
        <span className="guess-clue-title">Silhouette</span>
        <img
          className="guess-image guess-image-silhouette"
          src={target.imageUrl}
          alt="Silhouette"
          draggable="false"
        />
      </div>
    );
  }

  if (clueType === GUESS_CLUE_TYPES.PIXEL_CUSTOM) {
    return (
      <div className="guess-image-wrap">
        <span className="guess-clue-title">
          Verpixelt Stufe {clue.strength}/6
        </span>
        <PixelatedImage
          src={target.imageUrl}
          alt="Verpixeltes Pokémon"
          strength={clue.strength}
          black={clue.black}
        />
      </div>
    );
  }

  if (clueType === GUESS_CLUE_TYPES.DISTORTED_CUSTOM) {
    const horizontal = clue.horizontal ?? clue.strength ?? 6;
    const vertical = clue.vertical ?? clue.strength ?? 6;

    return (
      <div className="guess-image-wrap">
        <span className="guess-clue-title">
          Verzerrt H{horizontal}/6 V{vertical}/6
        </span>
        <DistortedImage
          src={target.imageUrl}
          alt="Verzerrtes Pokémon"
          horizontal={horizontal}
          vertical={vertical}
          black={clue.black}
        />
      </div>
    );
  }

  return (
    <div className="guess-image-wrap">
      <span className="guess-clue-title">Normales Bild</span>
      <img
        className="guess-image"
        src={target.imageUrl}
        alt="Pokémon"
        draggable="false"
      />
    </div>
  );
}

function PixelatedImage({ src, alt, strength = 6, black = false }) {
  const canvasRef = useRef(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !src) return;

    const size = 320;
    const safeStrength = Math.max(1, Math.min(6, Number(strength) || 6));
    const pixelDivisor = black ? safeStrength * 4 + 8 : safeStrength * 10 + 6;
    const minLowSize = black ? 10 : 6;
    const lowSize = Math.max(minLowSize, Math.round(size / pixelDivisor));

    canvas.width = size;
    canvas.height = size;

    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, size, size);

    const image = new Image();
    image.crossOrigin = "anonymous";

    image.onload = () => {
      try {
        const smallCanvas = document.createElement("canvas");
        smallCanvas.width = lowSize;
        smallCanvas.height = lowSize;

        const smallCtx = smallCanvas.getContext("2d");
        smallCtx.clearRect(0, 0, lowSize, lowSize);

        const scale = Math.min(lowSize / image.width, lowSize / image.height) * 0.86;
        const width = image.width * scale;
        const height = image.height * scale;
        const x = (lowSize - width) / 2;
        const y = (lowSize - height) / 2;

        smallCtx.drawImage(image, x, y, width, height);

        ctx.imageSmoothingEnabled = false;
        ctx.clearRect(0, 0, size, size);
        ctx.drawImage(smallCanvas, 0, 0, size, size);

        if (black) {
          const imageData = ctx.getImageData(0, 0, size, size);
          const data = imageData.data;

          for (let i = 0; i < data.length; i += 4) {
            if (data[i + 3] > 20) {
              data[i] = 0;
              data[i + 1] = 0;
              data[i + 2] = 0;
              data[i + 3] = 245;
            }
          }

          ctx.putImageData(imageData, 0, 0);
        }
      } catch (error) {
        console.error(error);
        setFailed(true);
      }
    };

    image.onerror = () => setFailed(true);
    image.src = src;
  }, [src, strength, black]);

  if (failed) {
    return (
      <img
        className={black ? "guess-image guess-image-silhouette" : "guess-image"}
        src={src}
        alt={alt}
        draggable="false"
      />
    );
  }

  return <canvas ref={canvasRef} className="guess-canvas-image" aria-label={alt} />;
}

function DistortedImage({
  src,
  alt,
  horizontal = 6,
  vertical = 6,
  black = true,
}) {
  const safeHorizontal = Math.max(1, Math.min(6, Number(horizontal) || 6));
  const safeVertical = Math.max(1, Math.min(6, Number(vertical) || 6));
  const combined = Math.max(safeHorizontal, safeVertical);

  const style = {
    filter: [
      black ? "brightness(0)" : "saturate(1.28)",
      `blur(${0.25 + combined * 0.32}px)`,
      `contrast(${1.18 + combined * 0.2})`,
      "drop-shadow(0 24px 34px rgba(0,0,0,0.72))",
    ].join(" "),
    transformOrigin: "center",
    transform: [
      `skewX(${-8.5 * safeHorizontal}deg)`,
      `skewY(${5.5 * safeVertical}deg)`,
      `scaleX(${Math.max(0.34, 1 - safeHorizontal * 0.09)})`,
      `scaleY(${1 + safeVertical * 0.105})`,
      `rotate(${-(safeHorizontal * 1.8 + safeVertical * 1.25)}deg)`,
    ].join(" "),
  };

  return (
    <img
      className="guess-image guess-image-distorted-dynamic"
      style={style}
      src={src}
      alt={alt}
      draggable="false"
    />
  );
}

function StatsClue({ stats }) {
  if (!stats) {
    return (
      <div className="guess-text-clue">
        <span className="guess-clue-title">Stats</span>
        <strong>Unbekannt</strong>
      </div>
    );
  }

  const rows = [
    ["KP", stats.kp],
    ["Angriff", stats.atk],
    ["Verteidigung", stats.def],
    ["Sp. Angr.", stats.spAtk],
    ["Sp. Vert.", stats.spDef],
    ["Initiative", stats.init],
  ];

  return (
    <div className="guess-text-clue">
      <span className="guess-clue-title">Basiswerte</span>

      <div className="guess-stats-grid">
        {rows.map(([label, value]) => (
          <div key={label} className="guess-stat-pill">
            <span>{label}</span>
            <strong>{value}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}
