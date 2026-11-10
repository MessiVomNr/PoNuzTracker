import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  DAMAGE_OPTIONS, getGenerationTypes, getTypeColor, getTypeLabel, getTypeIconUrl,
  formatMultiplier, buildPokemonIdDeck, createTrainingDeck, createTrainingChoices,
  shuffleItems,
} from "./typeTrainerData";
import { loadTrainerPokemon } from "./trainerPokemonApi";
import { GenerationFilter } from "./GenerationFilter";
import "./typeTrainer.css";

const SETTINGS_KEY = "ponuz-type-trainer-settings-v3";
const HIGHSCORE_KEY = "ponuz-type-trainer-effectiveness-best-v1";
const ALL_GENS = [1,2,3,4,5,6,7,8,9];
const DEFAULT_SETTINGS = {
  questionMode: "mixed", direction: "mixed", targetKind: "mixed",
  multiplier: "mixed", difficulty: "normal", answerMode: "classic",
  ruleGen: "auto", pokemonGens: [1,2,3], rounds: 10,
};
function readHighscore() {
  try { return Number(localStorage.getItem(HIGHSCORE_KEY)) || 0; }
  catch { return 0; }
}
function readSettings() {
  try {
    const parsed = JSON.parse(localStorage.getItem(SETTINGS_KEY));
    if (!parsed || typeof parsed !== "object") return DEFAULT_SETTINGS;
    const allowed = (value, choices, fallback) => choices.includes(value) ? value : fallback;
    return {
      questionMode: allowed(parsed.questionMode, ["types","pokemon","mixed"], "mixed"),
      direction: allowed(parsed.direction, ["attack","defend","mixed"], "mixed"),
      targetKind: allowed(parsed.targetKind, ["single","dual","mixed"], "mixed"),
      multiplier: allowed(parsed.multiplier, ["mixed",...DAMAGE_OPTIONS.map((x) => x.key)], "mixed"),
      difficulty: allowed(parsed.difficulty, ["easy","normal","hard"], "normal"),
      answerMode: allowed(parsed.answerMode, ["classic","one","two","all"], "classic"),
      ruleGen: allowed(String(parsed.ruleGen ?? "auto"), ["auto",...ALL_GENS.map(String)], "auto"),
      pokemonGens: Array.isArray(parsed.pokemonGens)
        ? [...new Set(parsed.pokemonGens.map(Number).filter((gen) => ALL_GENS.includes(gen)))].sort((a,b) => a-b)
        : [1,2,3],
      rounds: [0,10,20,30].includes(Number(parsed.rounds)) ? Number(parsed.rounds) : 10,
    };
  } catch { return DEFAULT_SETTINGS; }
}
function TypeLogo({ typeKey }) {
  return (
    <span className="type-trainer-logo-name" style={{ "--tt-color": getTypeColor(typeKey) }}>
      <img src={getTypeIconUrl(typeKey)} alt="" className="type-trainer-type-icon" loading="lazy" />
      <span>{getTypeLabel(typeKey)}</span>
    </span>
  );
}
function ChoiceButton({ choice, selected, reviewed, correct, onClick }) {
  return (
    <button type="button" disabled={reviewed} aria-pressed={selected}
      className={[
        "type-trainer-type", choice.types.length === 2 ? "type-trainer-dual-choice" : "",
        selected ? "is-selected" : "",
        reviewed && correct ? "is-answer" : "",
        reviewed && selected && !correct ? "is-wrong" : "",
      ].filter(Boolean).join(" ")}
      style={{ "--tt-color": getTypeColor(choice.types[0]) }} onClick={onClick}>
      <span className="type-trainer-choice-label">
        {choice.types.map((key) => <TypeLogo typeKey={key} key={key} />)}
      </span>
      {reviewed && correct ? <span className="type-trainer-answer-mark">✓</span> : null}
      {reviewed && selected && !correct ? <span className="type-trainer-answer-mark">×</span> : null}
    </button>
  );
}
function questionText(question) {
  if (question.kind === "pokemon") {
    return "Welche Angriffstypen treffen " + question.pokemon.name + " sehr effektiv (2× oder 4×)?";
  }
  const damage = formatMultiplier(question.multiplier);
  if (question.direction === "attack") {
    return "Welche der folgenden " +
      (question.targetKind === "dual" ? "Typenkombinationen" : "Einzeltypen") +
      " nehmen durch " + getTypeLabel(question.attackType) + "-Attacken " + damage + " Schaden?";
  }
  const defending = question.defendingTypes.map(getTypeLabel).join(" / ");
  return "Welche Angriffstypen verursachen " + damage +
    " Schaden gegen " + defending + "?";
}
function displayAnswer(choice) { return choice.types.map(getTypeLabel).join(" / "); }
const SCORE_BY_DIFFICULTY = { easy: 100, normal: 150, hard: 200 };

export default function TypeEffectivenessGame() {
  const navigate = useNavigate();
  const [settings, setSettings] = useState(readSettings);
  const [started, setStarted] = useState(false);
  const [finished, setFinished] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [round, setRound] = useState(1);
  const [question, setQuestion] = useState(null);
  const [choices, setChoices] = useState([]);
  const [answers, setAnswers] = useState([]);
  const [selected, setSelected] = useState([]);
  const [reviewed, setReviewed] = useState(false);
  const [wasCorrect, setWasCorrect] = useState(false);
  const [score, setScore] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [highscore, setHighscore] = useState(readHighscore);
  const deckRef = useRef([]);
  const requestRef = useRef(0);
  useEffect(() => () => { requestRef.current += 1; }, []);

  function updateSetting(key, value) {
    setSettings((previous) => {
      const updated = { ...previous, [key]: value };
      if (updated.targetKind === "single" && ["4", "0.25"].includes(updated.multiplier)) {
        if (key === "targetKind") updated.multiplier = "mixed";
        else updated.targetKind = "dual";
      }
      try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(updated)); } catch { /* optional */ }
      return updated;
    });
  }
  function updatePokemonGens(genList) {
    updateSetting("pokemonGens", genList);
  }
  function effectiveRuleGen() {
    if (settings.ruleGen !== "auto") return Number(settings.ruleGen);
    return Math.max(1, ...settings.pokemonGens);
  }

  function buildQueue(ruleGen) {
    const typeQuestions = createTrainingDeck({ ...settings, ruleGen });
    const availableGens = settings.pokemonGens.filter((gen) => gen <= ruleGen);
    const pokemonIds = buildPokemonIdDeck(availableGens).map((id) => ({ kind: "pokemon", id }));
    if (settings.questionMode === "types") return typeQuestions.map((item) => ({ kind:"types", ...item }));
    if (settings.questionMode === "pokemon") return pokemonIds;
    // Balanced mix – Pokemon questions should not be drowned out by thousands of type matchups.
    return shuffleItems([
      ...typeQuestions.slice(0, 100).map((item) => ({ kind:"types", ...item })),
      ...pokemonIds.slice(0, 100),
    ]);
  }

  async function nextQuestion() {
    const requestId = ++requestRef.current;
    setLoading(true);
    setError("");
    setSelected([]);
    setReviewed(false);
    setWasCorrect(false);
    setQuestion(null);
    let lastError;
    try {
      for (let attempts = 0; attempts < 6 && deckRef.current.length; attempts += 1) {
        const entry = deckRef.current.pop();
        try {
          let next;
          if (entry.kind === "pokemon") {
            const pokemon = await loadTrainerPokemon(entry.id, effectiveRuleGen());
            if (requestId !== requestRef.current) return;
            next = { kind: "pokemon", pokemon, pokemonTypes: pokemon.types, ruleGen: effectiveRuleGen(), multiplier: 2 };
          } else {
            next = entry;
          }
          const result = createTrainingChoices(next, settings);
          if (!result.answers.length || !result.choices.length) continue;
          if (requestId !== requestRef.current) return;
          setQuestion(next);
          setChoices(result.choices);
          setAnswers(result.answers);
          return;
        } catch (caught) { lastError = caught; }
      }
      if (lastError) throw lastError;
      if (requestId === requestRef.current) setFinished(true);
    } catch (caught) {
      if (requestId === requestRef.current) {
        setError(caught.message || "Pokémon konnten nicht geladen werden.");
      }
    } finally {
      if (requestId === requestRef.current) setLoading(false);
    }
  }
  function startGame() {
    const gen = effectiveRuleGen();
    const queue = buildQueue(gen);
    if (!queue.length) {
      setError("Mit diesen Einstellungen sind keine Fragen verfügbar.");
      return;
    }
    requestRef.current += 1;
    deckRef.current = queue;
    setStarted(true);
    setFinished(false);
    setRound(1);
    setScore(0);
    setCorrectCount(0);
    nextQuestion();
  }
  function exitGame() {
    requestRef.current += 1;
    setStarted(false);
    setFinished(false);
    setLoading(false);
    setError("");
    setQuestion(null);
  }
  function toggle(key) {
    if (reviewed) return;
    const max = settings.answerMode === "all" ? Infinity : settings.answerMode === "one" ? 1 : 2;
    setSelected((current) => current.includes(key)
      ? current.filter((item) => item !== key)
      : current.length < max ? [...current, key] : current);
  }
  function submit() {
    if (reviewed || !selected.length) return;
    const correct = answers.length === selected.length && answers.every((key) => selected.includes(key));
    const awarded = correct ? SCORE_BY_DIFFICULTY[settings.difficulty] : 0;
    const nextScore = score + awarded;
    setScore(nextScore);
    setReviewed(true);
    setWasCorrect(correct);
    if (correct) setCorrectCount((x) => x + 1);
    if (nextScore > highscore) {
      setHighscore(nextScore);
      try { localStorage.setItem(HIGHSCORE_KEY, String(nextScore)); } catch { /* optional */ }
    }
  }
  function next() {
    if (!reviewed) return;
    if ((settings.rounds && round >= settings.rounds) || !deckRef.current.length) {
      setFinished(true);
    } else {
      setRound((x) => x + 1);
      nextQuestion();
    }
  }

  const isPokemon = question?.kind === "pokemon";
  const focusTypes = question ? isPokemon ? [] :
    question.direction === "attack" ? [question.attackType] : question.defendingTypes : [];

  return (
    <main className="games-page type-trainer-page">
      <section className="type-trainer-panel">
        <div className="type-trainer-topline">
          <button type="button" className="type-trainer-back" onClick={() => navigate("/games/type-trainer")}>
            <span aria-hidden="true">‹</span> Zurück
          </button>
          <button type="button" className="type-trainer-home-link" onClick={() => navigate("/")}>Zur Startseite</button>
        </div>
        <h1>Typen-Matchups</h1>
        <p className="type-trainer-subtitle">Typen, Schwächen und Immunitäten trainieren.</p>
        {!started ? (
          <div className="type-trainer-setup">
            <label className="type-trainer-field">
              <span>Fragen</span>
              <span className="type-trainer-select-shell">
                <select value={settings.questionMode} onChange={(event) => updateSetting("questionMode", event.target.value)}>
                  <option value="mixed">Gemischt: Typen und Pokémon</option>
                  <option value="types">Typen und Typenkombinationen</option>
                  <option value="pokemon">Pokémon-Schwächen mit Bild</option>
                </select>
              </span>
            </label>
            <label className="type-trainer-field">
              <span>Schwierigkeit</span>
              <span className="type-trainer-select-shell">
                <select value={settings.difficulty} onChange={(event) => updateSetting("difficulty", event.target.value)}>
                  <option value="easy">Einfach · 6 Antworten</option>
                  <option value="normal">Normal · 9 Antworten</option>
                  <option value="hard">Schwer · 12 Antworten</option>
                </select>
              </span>
            </label>
            <label className="type-trainer-field">
              <span>Richtige Antworten</span>
              <span className="type-trainer-select-shell">
                <select value={settings.answerMode} onChange={(event) => updateSetting("answerMode", event.target.value)}>
                  <option value="classic">Klassisch · 1–2 richtig</option>
                  <option value="one">Genau 1 richtig</option>
                  <option value="two">Bis zu 2 richtig</option>
                  <option value="all">Alle richtigen auswählen</option>
                </select>
              </span>
            </label>
            <label className="type-trainer-field">
              <span>Typenstand</span>
              <span className="type-trainer-select-shell">
                <select value={settings.ruleGen} onChange={(event) => updateSetting("ruleGen", event.target.value)}>
                  <option value="auto">Automatisch (Pokémon-Generationen)</option>
                  {ALL_GENS.map((gen) => <option key={gen} value={String(gen)}>Generation {gen}</option>)}
                </select>
              </span>
            </label>
            {settings.questionMode !== "pokemon" && (
              <>
                <label className="type-trainer-field">
                  <span>Fragerichtung</span>
                  <span className="type-trainer-select-shell">
                    <select value={settings.direction} onChange={(event) => updateSetting("direction", event.target.value)}>
                      <option value="mixed">Gemischt</option>
                      <option value="attack">Angriff → Was trifft der Typ?</option>
                      <option value="defend">Verteidigung → Was trifft den Typ?</option>
                    </select>
                  </span>
                </label>
                <label className="type-trainer-field">
                  <span>Schaden</span>
                  <span className="type-trainer-select-shell">
                    <select value={settings.multiplier} onChange={(event) => updateSetting("multiplier", event.target.value)}>
                      <option value="mixed">Gemischt</option>
                      {DAMAGE_OPTIONS.map((entry) => <option key={entry.key} value={entry.key}
                        disabled={settings.targetKind === "single" && (entry.multiplier === 4 || entry.multiplier === .25)}>
                        {entry.label}
                      </option>)}
                    </select>
                  </span>
                </label>
                <label className="type-trainer-field">
                  <span>Verteidigungstypen</span>
                  <span className="type-trainer-select-shell">
                    <select value={settings.targetKind} onChange={(event) => updateSetting("targetKind", event.target.value)}>
                      <option value="mixed">Einzeltypen und Doppelt-Typen</option>
                      <option value="single">Nur Einzeltypen</option>
                      <option value="dual">Nur Doppelt-Typen</option>
                    </select>
                  </span>
                </label>
              </>
            )}
            <label className="type-trainer-field">
              <span>Runden</span>
              <span className="type-trainer-select-shell">
                <select value={settings.rounds} onChange={(event) => updateSetting("rounds", Number(event.target.value))}>
                  <option value={10}>10 Runden</option>
                  <option value={20}>20 Runden</option>
                  <option value={30}>30 Runden</option>
                  <option value={0}>Endlos</option>
                </select>
              </span>
            </label>
            {settings.questionMode !== "types" && (
              <div className="type-trainer-wide">
                <GenerationFilter title="Pokémon-Generationen"
                  generations={settings.pokemonGens}
                  onToggle={(gen) => updatePokemonGens(settings.pokemonGens.includes(gen)
                    ? settings.pokemonGens.filter((x) => x !== gen)
                    : [...settings.pokemonGens, gen].sort((a,b) => a-b))}
                  onOnly={(gen) => updatePokemonGens([gen])}
                  onAll={() => updatePokemonGens(ALL_GENS)}
                  onClear={() => updatePokemonGens([])}
                />
              </div>
            )}
            <div className="type-trainer-setup-footer">
              <span>Rekord: <strong>{highscore} Punkte</strong></span>
              <button className="type-trainer-primary" type="button"
                disabled={settings.questionMode === "pokemon" && !settings.pokemonGens.length}
                onClick={startGame}>Training starten</button>
            </div>
            {error ? <p className="type-trainer-settings-error type-trainer-wide" role="alert">{error}</p> : null}
          </div>
        ) : finished ? (
          <div className="type-trainer-finish">
            <span className="type-trainer-finish-number">{score}</span>
            <h2>Punkte erspielt</h2>
            <p>{correctCount} von {round} vollständig richtig.</p>
            <div className="type-trainer-actions">
              <button className="type-trainer-primary" type="button" onClick={startGame}>Nochmal spielen</button>
              <button className="type-trainer-secondary" type="button" onClick={exitGame}>Einstellungen</button>
            </div>
          </div>
        ) : (
          <>
            <div className="type-trainer-score-row">
              <span>Runde {round}{settings.rounds ? " / " + settings.rounds : " · Endlos"}</span>
              <span>{score} Punkte</span>
              <span>{correctCount} richtig</span>
            </div>
            {loading ? <div className="type-trainer-loading" role="status">Frage wird geladen …</div> :
              error ? <div className="type-trainer-feedback is-incorrect" role="alert">
                <strong>{error}</strong>
                <button className="type-trainer-secondary" type="button" onClick={nextQuestion}>Andere Frage versuchen</button>
              </div> :
              question ? (
                <>
                  <section className="type-trainer-question">
                    <span className="type-trainer-eyebrow">
                      {isPokemon ? "Pokémon-Schwächen" :
                        question.direction === "attack" ? "Angriff → Verteidigung" : "Verteidigung ← Angriff"}
                      {" · Gen " + effectiveRuleGen()}
                    </span>
                    {isPokemon ? (
                      <img className="type-trainer-question-pokemon"
                        src={question.pokemon.image} alt={question.pokemon.name} />
                    ) : (
                      <div className="type-trainer-focus-types">
                        {focusTypes.map((type) =>
                          <span key={type} className="type-trainer-focus-type" style={{ "--tt-color":getTypeColor(type) }}>
                            <img src={getTypeIconUrl(type)} alt="" />{getTypeLabel(type)}
                          </span>)}
                      </div>
                    )}
                    <h2>{questionText(question)}</h2>
                  </section>
                  <div className={"type-trainer-type-grid " + (choices.some((choice) => choice.types.length > 1) ? "has-dual-choices" : "")}
                    role="group" aria-label="Antwortmöglichkeiten">
                    {choices.map((choice) => <ChoiceButton
                      key={choice.key} choice={choice} reviewed={reviewed}
                      selected={selected.includes(choice.key)}
                      correct={answers.includes(choice.key)}
                      onClick={() => toggle(choice.key)}
                    />)}
                  </div>
                  {reviewed ? (
                    <div className={"type-trainer-feedback " + (wasCorrect ? "is-correct" : "is-incorrect")} role="status">
                      <strong>{wasCorrect
                        ? "Richtig! +" + SCORE_BY_DIFFICULTY[settings.difficulty] + " Punkte"
                        : "Leider nicht ganz richtig."}</strong>
                      <span>Richtig: {choices.filter((choice) => answers.includes(choice.key)).map(displayAnswer).join(", ")}.</span>
                    </div>
                  ) : (
                    <p className="type-trainer-hint">
                      {selected.length} ausgewählt · {settings.answerMode === "all"
                        ? "Wähle alle zutreffenden Antworten."
                        : settings.answerMode === "one" ? "Genau eine Antwort ist richtig."
                        : "Höchstens zwei Antworten sind richtig."}
                    </p>
                  )}
                  <div className="type-trainer-actions">
                    {reviewed ? (
                      <button type="button" className="type-trainer-primary" onClick={next}>
                        {(settings.rounds && round >= settings.rounds) || !deckRef.current.length ? "Ergebnis ansehen" : "Nächste Frage"}
                      </button>
                    ) : (
                      <button type="button" className="type-trainer-primary" disabled={!selected.length} onClick={submit}>Antwort überprüfen</button>
                    )}
                    <button type="button" className="type-trainer-secondary" onClick={exitGame}>Beenden</button>
                  </div>
                </>
              ) : null}
          </>
        )}
      </section>
    </main>
  );
}
