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
const SOLO_HIGH_SCORE_KEY = "pokemon_guess_solo_highscores_v1";
const NEXT_POKEMON_KEYS = ["Enter", " "];

const DEFAULT_SOLO_HIGH_SCORES = {
  normal: {
    score: 0,
    rounds: 0,
    savedAt: null,
  },
  endless: {
    score: 0,
    rounds: 0,
    savedAt: null,
  },
};

function readSoloHighScores() {
  try {
    const raw = localStorage.getItem(SOLO_HIGH_SCORE_KEY);
    if (!raw) return DEFAULT_SOLO_HIGH_SCORES;

    const saved = JSON.parse(raw);

    return {
      normal: {
        ...DEFAULT_SOLO_HIGH_SCORES.normal,
        ...(saved.normal || {}),
      },
      endless: {
        ...DEFAULT_SOLO_HIGH_SCORES.endless,
        ...(saved.endless || {}),
      },
    };
  } catch {
    return DEFAULT_SOLO_HIGH_SCORES;
  }
}

function writeSoloHighScores(nextHighScores) {
  try {
    localStorage.setItem(SOLO_HIGH_SCORE_KEY, JSON.stringify(nextHighScores));
  } catch {
    // ignore
  }
}

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

function getPlayModeDescription(playMode) {
  if (playMode === GUESS_PLAY_MODES.SILHOUETTE) {
    return "Nur die schwarze Form erkennen.";
  }

  if (playMode === GUESS_PLAY_MODES.PIXEL) {
    return "Das Bild ist verpixelt und wird leichter.";
  }

  if (playMode === GUESS_PLAY_MODES.DISTORTED) {
    return "Das Pokémon wird verzerrt dargestellt.";
  }

  if (playMode === GUESS_PLAY_MODES.STATS) {
    return "Du siehst nur die Basiswerte.";
  }

  return "Du spielst mit mehreren Hinweisen.";
}

function getSelectedGensSummary(selectedGens) {
  const safeGens = Array.isArray(selectedGens)
    ? [...selectedGens].sort((a, b) => a - b)
    : [];

  if (safeGens.length === GENERATION_OPTIONS.length) {
    return "Alle";
  }

  if (safeGens.length === 1) {
    return `Gen ${safeGens[0]}`;
  }

  return "Spezifisch";
}

export default function PokemonGuessSolo() {
  const navigate = useNavigate();

  const [settings, setSettings] = useState(DEFAULT_GUESS_SETTINGS);
  const [pokemonPool, setPokemonPool] = useState([]);
  const [usedDexIds, setUsedDexIds] = useState([]);
  const [gameStarted, setGameStarted] = useState(false);
  const [roundNumber, setRoundNumber] = useState(1);
  const [score, setScore] = useState(0);
  const [round, setRound] = useState(null);
  const [finished, setFinished] = useState(false);
  const [guessInput, setGuessInput] = useState("");
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(-1);
  const [loadingText, setLoadingText] = useState("");
  const [loadError, setLoadError] = useState("");
  const [paused, setPaused] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [highScores, setHighScores] = useState(readSoloHighScores);
  const [lastResult, setLastResult] = useState(null);
  const [openSections, setOpenSections] = useState({
    fineSettings: false,
    gameRules: false,
    generations: false,
    tipOrder: false,
  });
  const [modeMenuOpen, setModeMenuOpen] = useState(false);

  useEffect(() => {
    const saved = readSavedSoloGame();

    if (saved) {
      setSettings(saved.settings);
      setPokemonPool(Array.isArray(saved.pokemonPool) ? saved.pokemonPool : []);
      setUsedDexIds(Array.isArray(saved.usedDexIds) ? saved.usedDexIds : []);
      setGameStarted(true);
      setRoundNumber(Number(saved.roundNumber) || 1);
      setScore(Number(saved.score) || 0);
      setRound(saved.round);
      setFinished(Boolean(saved.finished));
      setGuessInput("");
      setLoadingText("");
      setLoadError("");
      setPaused(Boolean(saved.paused));
      setLastResult(saved.lastResult || null);
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
        usedDexIds,
        gameStarted,
        roundNumber,
        score,
        round,
        finished,
        paused,
        lastResult,
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
    usedDexIds,
    gameStarted,
    roundNumber,
    score,
    round,
    finished,
    paused,
    lastResult,
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
    const cleanInput = guessInput.trim().toLocaleLowerCase("de-DE");

    if (!cleanInput) {
      return [];
    }

    const nextSuggestions = getPokemonNameSuggestions(guessInput, pokemonPool);
    const hasExactMatch = nextSuggestions.some(
      (pokemon) => pokemon.name.trim().toLocaleLowerCase("de-DE") === cleanInput
    );

    return hasExactMatch ? [] : nextSuggestions;
  }, [guessInput, pokemonPool]);

  useEffect(() => {
    if (!guessInput.trim() || suggestions.length === 0) {
      setSelectedSuggestionIndex(-1);
      return;
    }

    setSelectedSuggestionIndex((current) => {
      if (current >= suggestions.length) {
        return suggestions.length - 1;
      }

      return current;
    });
  }, [guessInput, suggestions.length]);

  const canRevealMore =
    round &&
    !round.answered &&
    round.clueIndex < round.clues.length - 1 &&
    effectiveRevealMode !== GUESS_REVEAL_MODES.DIRECT;

  const activeHighScoreKey = settings.endless ? "endless" : "normal";
  const activeHighScore = highScores[activeHighScoreKey] || {
    score: 0,
    rounds: 0,
  };
  const activeHighScoreLabel = settings.endless
    ? "Endless-Rekord"
    : "Normal-Rekord";

  const pointsPerCorrect = Math.max(
    1,
    Number(settings.pointsPerCorrect) || DEFAULT_GUESS_SETTINGS.pointsPerCorrect
  );
  const minimumPointsPerCorrect = Math.max(
    1,
    Math.round(pointsPerCorrect * 0.15)
  );

  const possiblePoints = settings.endless
    ? 1
    : getScoreForClue(
        cluesUsedForScore,
        round?.clues?.length || 1,
        pointsPerCorrect,
        minimumPointsPerCorrect
      );

  const wrongPenaltyPoints = Math.max(1, Math.round(possiblePoints / 2));

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
    function handleNextPokemonKey(event) {
      if (!gameStarted || finished || paused || loadingText || !round?.answered) {
        return;
      }

      if (!NEXT_POKEMON_KEYS.includes(event.key)) {
        return;
      }

      const tagName = event.target?.tagName?.toLowerCase();

      if (tagName === "input" || tagName === "textarea" || tagName === "select") {
        return;
      }

      event.preventDefault();
      goNextRound();
    }

    window.addEventListener("keydown", handleNextPokemonKey);
    return () => window.removeEventListener("keydown", handleNextPokemonKey);
  }, [
    gameStarted,
    finished,
    paused,
    loadingText,
    round?.answered,
    round?.id,
    round?.correct,
    settings.endless,
    roundNumber,
    settings.totalRounds,
    score,
    usedDexIds,
    pokemonPool,
  ]);

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

  function toggleSection(sectionKey) {
    setOpenSections((current) => ({
      ...current,
      [sectionKey]: !current[sectionKey],
    }));
  }

  function setPlayMode(playMode) {
    setSettings((current) => {
      let nextRevealMode = current.revealMode;

      if (
        playMode === GUESS_PLAY_MODES.PIXEL ||
        playMode === GUESS_PLAY_MODES.DISTORTED
      ) {
        nextRevealMode = GUESS_REVEAL_MODES.WRONG_GUESS;
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

  async function buildRound(pool, blockedDexIds = []) {
    const blockedSet = new Set(blockedDexIds);
    const availablePool = (pool || []).filter(
      (pokemon) => !blockedSet.has(pokemon.dexId)
    );

    if (availablePool.length === 0) {
      throw new Error("No unused Pokemon left.");
    }

    const effectiveSettings = buildEffectiveSettings();
    const baseRound = createGuessRound(effectiveSettings, availablePool);
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
      const firstRound = await buildRound(pool, []);

      setPokemonPool(pool);
      setUsedDexIds([firstRound.target.dexId]);
      setRoundNumber(1);
      setScore(0);
      setFinished(false);
      setGuessInput("");
      setSelectedSuggestionIndex(-1);
      setRound(firstRound);
      setGameStarted(true);
      setPaused(false);
      setLastResult(null);
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
    setUsedDexIds([]);
    setRoundNumber(1);
    setScore(0);
    setGuessInput("");
    setSelectedSuggestionIndex(-1);
    setLoadError("");
    setLastResult(null);
  }

  function backToLobby() {
    clearSavedSoloGame();
    navigate("/games/pokemon-guess");
  }

  async function submitGuess(event) {
    event.preventDefault();

    if (!round || round.answered || finished || loadingText || paused) return;

    const cleanGuess = guessInput.trim();
    if (!cleanGuess) return;

    const isCorrect = doesGuessMatch(round.target, cleanGuess);

    if (settings.endless) {
      const gainedScore = isCorrect ? 1 : 0;
      const nextScore = score + gainedScore;

      if (isCorrect) {
        setScore(nextScore);
        saveEndlessHighScore(nextScore, roundNumber);
      } else {
        saveEndlessHighScore(score, Math.max(0, roundNumber - 1));
        setScore(0);
      }

      setRound((current) => {
        if (!current) return current;

        return {
          ...current,
          answered: true,
          correct: isCorrect,
          selectedName: cleanGuess,
          wrongGuesses: isCorrect ? current.wrongGuesses : current.wrongGuesses + 1,
          gainedScore,
          streakBeforeReset: isCorrect ? nextScore : score,
        };
      });

      setGuessInput("");
      return;
    }

    if (isCorrect) {
      const gainedScore = getScoreForClue(
        cluesUsedForScore,
        round.clues.length,
        pointsPerCorrect,
        minimumPointsPerCorrect
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

    if (settings.wrongPenaltyEnabled) {
      setScore((current) => Math.max(0, current - wrongPenaltyPoints));
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

    function saveEndlessHighScore(nextScore, completedRounds = roundNumber) {
    setHighScores((current) => {
      const previousScore = Number(current.endless?.score) || 0;

      if (nextScore <= previousScore) {
        return current;
      }

      const nextHighScores = {
        ...current,
        endless: {
          score: nextScore,
          rounds: completedRounds,
          playMode: settings.playMode,
          selectedGens: settings.selectedGens,
          savedAt: Date.now(),
        },
      };

      writeSoloHighScores(nextHighScores);
      return nextHighScores;
    });
  }

  async function goNextEndlessRound() {
    setLoadingText("Nächstes Pokémon wird vorbereitet...");

    try {
      const shouldResetUsed =
        pokemonPool.length > 0 && usedDexIds.length >= pokemonPool.length;
      const blockedDexIds = shouldResetUsed ? [] : usedDexIds;
      const nextRound = await buildRound(pokemonPool, blockedDexIds);

      setRoundNumber((current) => current + 1);
      setUsedDexIds((current) =>
        shouldResetUsed
          ? [nextRound.target.dexId]
          : [...current, nextRound.target.dexId]
      );
      setGuessInput("");
      setSelectedSuggestionIndex(-1);
      setRound(nextRound);
      setPaused(false);
    } catch (error) {
      console.error(error);
      setLoadError("Das nächste Pokémon konnte nicht geladen werden.");
    } finally {
      setLoadingText("");
    }
  }

  function finishGame(finalScore = score, completedRounds = usedDexIds.length) {
    const scoreKey = settings.endless ? "endless" : "normal";
    const previousHighScore = highScores[scoreKey] || DEFAULT_SOLO_HIGH_SCORES[scoreKey];
    const previousScore = Number(previousHighScore.score) || 0;
    const safeScore = Number(finalScore) || 0;
    const safeRounds = Math.max(0, Number(completedRounds) || 0);
    const isNewHighScore = safeScore > previousScore;

    const nextResult = {
      score: safeScore,
      rounds: safeRounds,
      scoreKey,
      previousScore,
      highScore: isNewHighScore ? safeScore : previousScore,
      isNewHighScore,
      savedAt: Date.now(),
    };

    if (isNewHighScore) {
      const nextHighScores = {
        ...highScores,
        [scoreKey]: {
          score: safeScore,
          rounds: safeRounds,
          playMode: settings.playMode,
          selectedGens: settings.selectedGens,
          savedAt: Date.now(),
        },
      };

      setHighScores(nextHighScores);
      writeSoloHighScores(nextHighScores);
    }

    setLastResult(nextResult);
    setFinished(true);
  }

  async function goNextRound() {
    if (settings.endless) {
      await goNextEndlessRound();
      return;
    }

    if (!settings.endless && roundNumber >= settings.totalRounds) {
      finishGame(score, usedDexIds.length);
      return;
    }

    setLoadingText("Nächste Runde wird vorbereitet...");

    try {
      const nextRound = await buildRound(pokemonPool, usedDexIds);

      setRoundNumber((current) => current + 1);
      setUsedDexIds((current) => [...current, nextRound.target.dexId]);
      setGuessInput("");
      setSelectedSuggestionIndex(-1);
      setRound(nextRound);
      setPaused(false);
    } catch (error) {
      console.error(error);

      if (settings.endless) {
        finishGame(score, usedDexIds.length);
        setLoadError("Alle ausgewählten Pokémon wurden gespielt. Ergebnis wird angezeigt.");
      } else {
        setLoadError("Die nächste Runde konnte nicht geladen werden.");
      }
    } finally {
      setLoadingText("");
    }
  }

  if (!gameStarted) {
    return (
      <main className="games-page games-hub-page pokemon-guess-solo-page">
        <section className="games-hub-panel pokemon-guess-solo-panel">
          <button
            type="button"
            className="games-hub-back-button"
            onClick={backToLobby}
          >
            <span className="games-hub-back-arrow">‹</span>
            Zurück
          </button>

          <header className="games-hub-header pokemon-guess-solo-header">
            <h1>Solo-Modus</h1>
            <p>
              Wähle deinen Modus, passe die Regeln an und starte deine eigene
              Pokémon-Guess-Runde.
            </p>
          </header>

          {loadError && (
            <div className="solo-clean-alert solo-clean-alert-error">
              {loadError}
            </div>
          )}

          <div className="solo-clean-layout">
            <section className="solo-clean-card solo-clean-card-main">
              <div className="solo-clean-section-head">
                <span>01</span>
                <div>
                  <h2>Modus wählen</h2>
                  <p>
                    Wähle zuerst den Spielmodus. Die Detailoptionen findest du
                    weiter unten übersichtlich in Ausklappbereichen.
                  </p>
                </div>
              </div>

              <button
                type="button"
                className="solo-mode-picker-button"
                onClick={() => setModeMenuOpen(true)}
              >
                <span className="solo-mode-picker-badge">
                  {GUESS_PLAY_MODE_LABELS[settings.playMode].slice(0, 2).toUpperCase()}
                </span>

                <span className="solo-mode-picker-content">
                  <small>Aktueller Modus</small>
                  <strong>{GUESS_PLAY_MODE_LABELS[settings.playMode]}</strong>
                  <em>{getPlayModeDescription(settings.playMode)}</em>
                </span>

                <span className="solo-mode-picker-arrow">›</span>
              </button>

              {modeMenuOpen && (
                <ModePickerModal
                  activeMode={settings.playMode}
                  onClose={() => setModeMenuOpen(false)}
                  onPick={(playMode) => {
                    setPlayMode(playMode);
                    setModeMenuOpen(false);
                  }}
                />
              )}
              <label
                className={
                  settings.endless
                    ? "solo-endless-card solo-endless-card-active"
                    : "solo-endless-card"
                }
              >
                <span className="solo-endless-card-content">
                  <strong>Endless-Modus</strong>
                  <small>
                    1 Versuch pro Pokémon. Richtig gibt 1 Punkt, falsch springt
                    direkt zum nächsten Pokémon.
                  </small>
                </span>

                <span className="solo-endless-card-score">
                  Rekord: {highScores.endless.score}
                </span>

                <input
                  type="checkbox"
                  checked={settings.endless}
                  onChange={(event) =>
                    updateSetting("endless", event.target.checked)
                  }
                />
              </label>
            </section>

            <aside className="solo-clean-card solo-preview-card">
              <div className="solo-clean-section-head">
                <span>02</span>
                <div>
                  <h2>Vorschau</h2>
                </div>
              </div>

              <div className="solo-preview-stage">
                <PreviewImage settings={settings} />
              </div>
            </aside>

            <section className="solo-clean-card solo-wide-card solo-options-card-compact">
              <div className="solo-clean-section-head solo-options-head-compact">
                <span>03</span>
                <div>
                  <h2>Spieloptionen</h2>
                  <p>
                    Öffne nur die Bereiche, die du wirklich anpassen möchtest.
                  </p>
                </div>
              </div>

              <div className="solo-accordion-group">
                <AccordionSection
                  title="Fein-Einstellungen"
                  description="Bild, Hinweise und Aufdecken."
                  open={openSections.fineSettings}
                  onToggle={() => toggleSection("fineSettings")}
                >
                  <ModeOptions
                    settings={settings}
                    updateSetting={updateSetting}
                    updateVisualSettings={updateVisualSettings}
                    effectiveRevealMode={effectiveRevealMode}
                    isEndless={settings.endless}
                  />
                </AccordionSection>

                {!settings.endless && (
                <AccordionSection
                  title="Spielregeln"
                  description="Runden, Endless und Rekorde."
                  open={openSections.gameRules}
                  onToggle={() => toggleSection("gameRules")}
                >
                  <div className="solo-settings-row solo-rules-settings-row">
                    <label>
                      <span>Runden</span>
                      <input
                        className="solo-number-input"
                        type="number"
                        min="1"
                        max="50"
                        value={settings.totalRounds}
                        disabled={settings.endless}
                        onChange={(event) =>
                          updateSetting(
                            "totalRounds",
                            Math.max(1, Number(event.target.value) || 1)
                          )
                        }
                      />
                    </label>

                    <label>
                      <span>Max Punkte pro richtig</span>
                      <input
                        className="solo-number-input"
                        type="number"
                        min="1"
                        max="9999"
                        value={settings.pointsPerCorrect}
                        onChange={(event) =>
                          updateSetting(
                            "pointsPerCorrect",
                            Math.max(1, Number(event.target.value) || 1)
                          )
                        }
                      />
                    </label>

                    <label className="solo-rule-toggle-card">
                      <span>Minus bei Fehler</span>
                      <input
                        type="checkbox"
                        checked={settings.wrongPenaltyEnabled}
                        onChange={(event) =>
                          updateSetting("wrongPenaltyEnabled", event.target.checked)
                        }
                      />
                    </label>

                    {effectiveRevealMode === GUESS_REVEAL_MODES.TIME && (
                      <label>
                        <span>Sekunden pro Stufe</span>
                        <input
                          className="solo-number-input"
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
                </AccordionSection>
                )}

                <AccordionSection
                  title="Generationen"
                  description="Gen-Filter."
                  open={openSections.generations}
                  onToggle={() => toggleSection("generations")}
                  rightSlot={
                    <div className="solo-gen-accordion-actions">
                      <span className="solo-gen-summary-pill">
                        {getSelectedGensSummary(settings.selectedGens)}
                      </span>

                      <button
                        type="button"
                        className="solo-secondary-button"
                        onClick={(event) => {
                          event.stopPropagation();
                          selectAllGenerations();
                        }}
                      >
                        Alle
                      </button>
                    </div>
                  }
                >
                  <div className="solo-gen-grid">
                    {GENERATION_OPTIONS.map((gen) => {
                      const isActive = settings.selectedGens.includes(gen);

                      return (
                        <div
                          key={gen}
                          className={
                            isActive
                              ? "solo-gen-card solo-gen-card-active"
                              : "solo-gen-card"
                          }
                          role="button"
                          tabIndex={0}
                          onClick={() => toggleGeneration(gen)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              toggleGeneration(gen);
                            }
                          }}
                        >
                          <div className="solo-gen-card-top">
                            <span className="solo-gen-mini-switch">
                              <input
                                type="checkbox"
                                checked={isActive}
                                readOnly
                                tabIndex={-1}
                              />
                            </span>

                            <span className="solo-gen-title">Gen {gen}</span>
                          </div>

                          <button
                            type="button"
                            className="solo-gen-only-button"
                            onClick={(event) => {
                              event.stopPropagation();
                              selectOnlyGeneration(gen);
                            }}
                          >
                            Nur
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </AccordionSection>

                {settings.playMode === GUESS_PLAY_MODES.TIPS && (
                  <AccordionSection
                    title="Tipp-Reihenfolge"
                    description="Nur im Tipps-Modus. Die Hinweise oben kommen zuerst."
                    open={openSections.tipOrder}
                    onToggle={() => toggleSection("tipOrder")}
                  >
                    <div className="solo-tip-order-list">
                      {settings.tipOrder.map((clueType, index) => (
                        <div key={clueType} className="solo-tip-order-item">
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

                    <div className="solo-add-tip-list">
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
                  </AccordionSection>
                )}
              </div>
            </section>
          </div>

          {loadingText && (
            <div className="solo-clean-alert solo-clean-alert-loading">
              {loadingText}
            </div>
          )}

          <button
            className="solo-start-button"
            type="button"
            onClick={startGame}
            disabled={Boolean(loadingText)}
          >
            {loadingText ? "Lädt..." : "Spiel starten"}
          </button>
        </section>
      </main>
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
          </div>

          <div className="guess-score-box">
            <span>
              {settings.endless
                ? "Endless"
                : `Runde ${roundNumber}/${settings.totalRounds}`}
            </span>
            <strong>{score === 1 ? "1 Punkt" : `${score} Punkte`}</strong>
            <small>
              {activeHighScoreLabel}: {activeHighScore.score}
            </small>
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

            {lastResult?.isNewHighScore ? (
              <p>
                Neuer {activeHighScoreLabel}:{" "}
                <strong>{lastResult.highScore}</strong> Punkte!
              </p>
            ) : (
              <p>
                {activeHighScoreLabel}:{" "}
                <strong>{activeHighScore.score}</strong> Punkte
              </p>
            )}

            {lastResult?.rounds > 0 && (
              <p>
                Gespielte Runden: <strong>{lastResult.rounds}</strong>
              </p>
            )}

            <button className="guess-next-button" type="button" onClick={backToSettings}>
              Zurück zu den Einstellungen
            </button>
          </div>
        ) : (
          <>
            <div
              className={
                round.answered
                  ? "guess-round-layout guess-round-layout-resolved"
                  : "guess-round-layout"
              }
            >
              <div className="guess-clue-card">
                <div className="guess-clue-label">
                  <span>
                    Hinweise {visibleClues.length}/{round.clues.length}
                  </span>
                  {!round.answered && <strong>{possiblePoints} Punkte möglich</strong>}
                </div>

                <ClueStack clues={visibleClues} target={round.target} revealed={false} />
              </div>

              {round.answered && (
                <div className="guess-result-box guess-resolution-box">
                  <img
                    className="guess-result-pokemon-image"
                    src={round.target.imageUrl}
                    alt={round.target.name}
                    draggable="false"
                  />

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
                      <h2>Falsch!</h2>
                      <p>
                        Es war <strong>{round.target.name}</strong>.
                      </p>

                      {round.selectedName && (
                        <p className="guess-result-small-text">
                          Dein Guess: <strong>{round.selectedName}</strong>
                        </p>
                      )}
                    </>
                  )}

                  <button
                    className="guess-next-button"
                    type="button"
                    onClick={goNextRound}
                    disabled={Boolean(loadingText)}
                  >
                    {!settings.endless && roundNumber >= settings.totalRounds
                      ? "Ergebnis anzeigen"
                      : "Nächstes Pokémon"}
                  </button>

                  <p className="guess-next-shortcut-hint">
                    Enter oder Leertaste für nächstes Pokémon
                  </p>
                </div>
              )}
            </div>

            {!round.answered && (
              <>
                <form className="guess-input-row" onSubmit={submitGuess}>
                  <div className="guess-input-suggestion-wrap">
                    <input
                      className="guess-name-input"
                      value={guessInput}
                      onChange={(event) => {
                        setGuessInput(event.target.value);
                        setSelectedSuggestionIndex(-1);
                      }}
                      onKeyDown={(event) => {
                        if (!guessInput.trim() || suggestions.length === 0) {
                          return;
                        }

                        if (event.key === "ArrowDown") {
                          event.preventDefault();
                          setSelectedSuggestionIndex((current) =>
                            current < suggestions.length - 1 ? current + 1 : 0
                          );
                          return;
                        }

                        if (event.key === "ArrowUp") {
                          event.preventDefault();
                          setSelectedSuggestionIndex((current) =>
                            current > 0 ? current - 1 : suggestions.length - 1
                          );
                          return;
                        }

                        if (event.key === "Enter" && selectedSuggestionIndex >= 0) {
                          event.preventDefault();
                          setGuessInput(suggestions[selectedSuggestionIndex].name);
                          setSelectedSuggestionIndex(-1);
                          return;
                        }

                        if (event.key === "Escape") {
                          setSelectedSuggestionIndex(-1);
                        }
                      }}
                      placeholder="Pokémon-Name eingeben..."
                      autoFocus
                      autoComplete="off"
                      disabled={Boolean(loadingText) || paused}
                    />

                    {guessInput.trim() && suggestions.length > 0 && (
                      <div className="guess-suggestion-menu">
                        {suggestions.map((pokemon, index) => (
                          <button
                            key={pokemon.dexId}
                            type="button"
                            className={
                              selectedSuggestionIndex === index
                                ? "guess-suggestion-option guess-suggestion-option-active"
                                : "guess-suggestion-option"
                            }
                            onMouseEnter={() => setSelectedSuggestionIndex(index)}
                            onMouseDown={(event) => {
                              event.preventDefault();
                              setGuessInput(pokemon.name);
                              setSelectedSuggestionIndex(-1);
                            }}
                          >
                            {pokemon.name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

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

function ModePickerModal({ activeMode, onPick, onClose }) {
  return (
    <div
      className="solo-mode-modal-backdrop"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="solo-mode-modal"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="solo-mode-modal-head">
          <div>
            <h2>Modus wählen</h2>
            <p>Wähle, wie das Pokémon versteckt oder beschrieben wird.</p>
          </div>

          <button
            type="button"
            className="solo-mode-modal-close"
            onClick={onClose}
          >
            ×
          </button>
        </div>

        <div className="solo-mode-modal-grid">
          {Object.entries(GUESS_PLAY_MODE_LABELS).map(([value, label]) => (
            <button
              key={value}
              type="button"
              className={
                activeMode === value
                  ? "solo-mode-modal-card solo-mode-modal-card-active"
                  : "solo-mode-modal-card"
              }
              onClick={() => onPick(value)}
            >
              <span>{label.slice(0, 2).toUpperCase()}</span>

              <div>
                <strong>{label}</strong>
                <small>{getPlayModeDescription(value)}</small>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function AccordionSection({
  title,
  description,
  open,
  onToggle,
  children,
  rightSlot = null,
}) {
  return (
    <div className={open ? "solo-accordion solo-accordion-open" : "solo-accordion"}>
      <div className="solo-accordion-trigger">
        <button
          type="button"
          className="solo-accordion-main-button"
          onClick={onToggle}
        >
          <div className="solo-accordion-trigger-left">
            <div className="solo-accordion-title-row">
              <strong>{title}</strong>
              <span className="solo-accordion-arrow">{open ? "−" : "+"}</span>
            </div>

            {description ? (
              <p className="solo-accordion-description">{description}</p>
            ) : null}
          </div>
        </button>

        {rightSlot ? (
          <div className="solo-accordion-trigger-right">
            {rightSlot}
          </div>
        ) : null}
      </div>

      {open && <div className="solo-accordion-body">{children}</div>}
    </div>
  );
}

function ModeOptions({
  settings,
  updateSetting,
  updateVisualSettings,
  effectiveRevealMode,
  isEndless,
}) {
  const showReveal =
    !isEndless &&
    (
      settings.playMode === GUESS_PLAY_MODES.TIPS ||
      settings.playMode === GUESS_PLAY_MODES.PIXEL ||
      settings.playMode === GUESS_PLAY_MODES.DISTORTED
    );

  return (
    <div className="solo-mode-options">
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
        <div className="solo-reveal-block">
          <span>Aufdecken</span>

          <div className="solo-reveal-choice-grid">
            {Object.entries(GUESS_REVEAL_LABELS).map(([value, label]) => (
              <button
                key={value}
                type="button"
                className={
                  effectiveRevealMode === value
                    ? "solo-choice-button solo-choice-button-active"
                    : "solo-choice-button"
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
        <p className="solo-simple-mode-info">
          Du siehst direkt nur die schwarze Silhouette.
        </p>
      )}

      {settings.playMode === GUESS_PLAY_MODES.STATS && (
        <p className="solo-simple-mode-info">
          Du siehst direkt nur die Basiswerte.
        </p>
      )}

      {settings.playMode === GUESS_PLAY_MODES.TIPS && (
        <p className="solo-simple-mode-info">
          Du spielst mit mehreren Hinweisen. Die Reihenfolge kannst du unten ändern.
        </p>
      )}
    </div>
  );
}

function SliderRow({ label, value, min, max, onChange }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const values = Array.from(
    { length: Math.max(1, max - min + 1) },
    (_, index) => min + index
  );

  return (
    <div className="solo-level-picker">
      <button
        type="button"
        className="solo-level-picker-button"
        onClick={() => setMenuOpen((current) => !current)}
      >
        <span>{label}</span>
        <strong>{value}/{max}</strong>
      </button>

      {menuOpen && (
        <div className="solo-level-picker-menu">
          {values.map((optionValue) => (
            <button
              key={optionValue}
              type="button"
              className={
                optionValue === value
                  ? "solo-level-picker-option solo-level-picker-option-active"
                  : "solo-level-picker-option"
              }
              onClick={() => {
                onChange(optionValue);
                setMenuOpen(false);
              }}
            >
              Stufe {optionValue}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ToggleRow({ label, checked, onChange }) {
  return (
    <label className="solo-toggle-row">
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

      <div className="guess-stats-bars">
        {rows.map(([label, value]) => {
          const safeValue = Number(value) || 0;
          const widthPercent = Math.max(5, Math.min(100, (safeValue / 180) * 100));
          const toneClass = getStatToneClass(safeValue);

          return (
            <div key={label} className="guess-stat-bar-row">
              <div className="guess-stat-bar-top">
                <span>{label}</span>
                <strong>{safeValue}</strong>
              </div>

              <div className="guess-stat-bar-track">
                <div
                  className={`guess-stat-bar-fill ${toneClass}`}
                  style={{ width: `${widthPercent}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function getStatToneClass(value) {
  if (value >= 140) return "guess-stat-blue";
  if (value >= 100) return "guess-stat-green";
  if (value >= 70) return "guess-stat-yellow";
  return "guess-stat-red";
}
