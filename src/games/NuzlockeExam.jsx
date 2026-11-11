import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { GenerationFilter } from "./GenerationFilter";
import { getPokemonNameSuggestions, doesGuessMatch } from "./guessGameEngine";
import { loadTrainerPokemon } from "./trainerPokemonApi";
import { getGenerationTypes, getTypeColor, getTypeIconUrl } from "./typeTrainerData";
import {
  EXAM_CATEGORIES, ABILITY_CASES, TRAP_SCENARIOS,
  examPokemonList, buildExamSchedule, pokemonArtwork,
  makeDamageQuestion, makeWeaknessQuestion, makeAbilityQuestion,
  makeScenarioQuestion, examResult,
} from "./nuzlockeExamData";
import "./typeTrainer.css";
import "./nuzlockeExam.css";

const SETTINGS_KEY = "ponuz-nuzlocke-exam-settings-v1";
const BEST_KEY = "ponuz-nuzlocke-exam-best-v1";
const GENS = [1,2,3,4,5,6,7,8,9];
const INITIAL_SETTINGS = { generations: [1,2,3], ruleGen: "auto", rounds: 20, difficulty: "normal" };

function readSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY));
    if (!saved || typeof saved !== "object") return INITIAL_SETTINGS;
    const generations = Array.isArray(saved.generations)
      ? [...new Set(saved.generations.map(Number).filter((gen) => GENS.includes(gen)))].sort((a,b) => a-b)
      : INITIAL_SETTINGS.generations;
    const ruleGen = saved.ruleGen === "auto" || GENS.some((gen) => String(gen) === saved.ruleGen)
      ? saved.ruleGen : "auto";
    return {
      generations, ruleGen,
      rounds: [12,20,30].includes(Number(saved.rounds)) ? Number(saved.rounds) : 20,
      difficulty: ["easy","normal","hard"].includes(saved.difficulty) ? saved.difficulty : "normal",
    };
  } catch { return INITIAL_SETTINGS; }
}
function readBest() {
  try { return Number(localStorage.getItem(BEST_KEY)) || 0; }
  catch { return 0; }
}
function chooseNew(array, usedSet) {
  let left = array.filter((item) => !usedSet.has(item.id ?? item.dexId));
  if (!left.length) {
    usedSet.clear();
    left = array;
  }
  if (!left.length) return null;
  const item = left[Math.floor(Math.random()*left.length)];
  usedSet.add(item.id ?? item.dexId);
  return item;
}
function CategoryLabel({ category }) {
  return <span className="exam-kind">{EXAM_CATEGORIES.find((item) => item.key === category)?.label || "Wissen"}</span>;
}
function TypeToken({ typeKey }) {
  const type = getGenerationTypes(9).find((candidate) => candidate.key === typeKey);
  return (
    <span className="exam-type-token" style={{ "--tt-color": getTypeColor(typeKey) }}>
      <img src={getTypeIconUrl(typeKey)} alt="" loading="lazy" />
      {type?.label || typeKey}
    </span>
  );
}
function QuestionOption({ option, checked, selected, correct, onClick, disabled }) {
  const isCorrect = checked && correct;
  const isWrong = checked && selected && !correct;
  return (
    <button type="button" onClick={onClick} disabled={disabled}
      aria-pressed={selected}
      className={[
        "exam-option", option.type ? "exam-option-type" : "",
        selected ? "exam-option-selected" : "",
        isCorrect ? "exam-option-correct" : "",
        isWrong ? "exam-option-wrong" : "",
      ].filter(Boolean).join(" ")}>
      {option.type
        ? <TypeToken typeKey={option.type} />
        : <span>{option.label}</span>}
      {isCorrect ? <span className="exam-check" aria-label="Richtig">✓</span> : null}
      {isWrong ? <span className="exam-check" aria-label="Falsch">×</span> : null}
    </button>
  );
}

export default function NuzlockeExam() {
  const nav = useNavigate();
  const [settings, setSettings] = useState(readSettings);
  const [active, setActive] = useState(false);
  const [finished, setFinished] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [question, setQuestion] = useState(null);
  const [nameInput, setNameInput] = useState("");
  const [suggestionIndex, setSuggestionIndex] = useState(-1);
  const [selected, setSelected] = useState([]);
  const [checked, setChecked] = useState(false);
  const [wasCorrect, setWasCorrect] = useState(false);
  const [answered, setAnswered] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [byCategory, setByCategory] = useState({});
  const [best, setBest] = useState(readBest);
  const currentRun = useRef(0);
  const schedule = useRef([]);
  const usedPokemon = useRef(new Set());
  const usedAbilities = useRef(new Set());
  const usedScenarios = useRef(new Set());

  useEffect(() => () => { currentRun.current += 1; }, []);
  useEffect(() => {
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); }
    catch { /* optional */ }
  }, [settings]);

  const ruleGen = settings.ruleGen === "auto"
    ? Math.max(1, ...settings.generations) : Number(settings.ruleGen);
  const pool = useMemo(() =>
    examPokemonList(settings.generations, ruleGen),
    [settings.generations, ruleGen]);
  const guessSuggestions = useMemo(
    () => question?.category === "name" && !checked
      ? getPokemonNameSuggestions(nameInput, pool, 8)
      : [],
    [nameInput, pool, question?.category, checked]);
  const completion = examResult(correctCount, answered);

  function changeSetting(key, value) { setSettings((previous) => ({ ...previous, [key]: value })); }
  function changeGens(next) { changeSetting("generations", next); }
  function exit() {
    currentRun.current += 1;
    setActive(false); setFinished(false); setLoading(false);
    setQuestion(null); setError("");
  }

  async function prepareNextQuestion() {
    const runId = ++currentRun.current;
    setLoading(true); setError(""); setQuestion(null);
    setSelected([]); setChecked(false); setWasCorrect(false);
    setNameInput(""); setSuggestionIndex(-1);
    let lastError = null;
    try {
      // Skip impossible encounters and transiently unavailable PokeAPI Pokémon.
      for (let attempt = 0; attempt < 24 && schedule.current.length; attempt += 1) {
        const category = schedule.current.shift();
        let prepared = null;
        try {
          if (category === "scenario") {
            const candidates = TRAP_SCENARIOS.filter((q) => q.minGen <= ruleGen);
            const selectedScenario = chooseNew(candidates, usedScenarios.current);
            prepared = selectedScenario && makeScenarioQuestion(selectedScenario);
          } else if (category === "ability") {
            const available = ABILITY_CASES.filter((entry) => entry.minGen <= ruleGen &&
              pool.some((item) => item.dexId === entry.id));
            const abilityCase = chooseNew(available, usedAbilities.current);
            prepared = abilityCase && makeAbilityQuestion(abilityCase, settings.difficulty);
          } else {
            const chosen = chooseNew(pool, usedPokemon.current);
            if (!chosen) continue;
            const name = chosen.name;
            if (category === "name") {
              prepared = {
                category, title: "Wie heißt dieses Pokémon?",
                pokemon: { id: chosen.dexId, name, image: pokemonArtwork(chosen.dexId) },
                correct: [name],
                explanation: "Gesucht war " + name + ".",
              };
            } else {
              const pokemon = await loadTrainerPokemon(chosen.dexId, ruleGen);
              if (runId !== currentRun.current) return;
              if (!pokemon.types.length) continue;
              if (category === "types") {
                prepared = {
                  category, title: "Welche Typen hat " + name + "?",
                  pokemon, correct: pokemon.types, maxAnswers: pokemon.types.length,
                  options: getGenerationTypes(ruleGen).map((type) => ({
                    key: type.key, type: type.key,
                  })),
                  explanation: name + " hat den Typ " + pokemon.types
                    .map((key) => getGenerationTypes(ruleGen).find((x) => x.key === key)?.label || key).join(" / ") + ".",
                };
              } else if (category === "weakness") {
                prepared = makeWeaknessQuestion(pokemon, ruleGen, settings.difficulty);
              } else if (category === "damage") {
                prepared = makeDamageQuestion(pokemon, ruleGen, settings.difficulty);
              }
            }
          }
          if (!prepared || (prepared.options && !prepared.correct?.length)) {
            // Don't silently shorten the exam if a particular Pokémon has
            // no usable weakness question under the selected rules.
            schedule.current.push(category);
            continue;
          }
          if (runId !== currentRun.current) return;
          setQuestion(prepared);
          return;
        } catch (err) {
          lastError = err;
          // Put this category back so a slow API does not silently remove a topic.
          if (category) schedule.current.push(category);
        }
      }
      if (runId !== currentRun.current) return;
      if (!schedule.current.length) {
        setFinished(true);
      } else {
        setError(lastError?.message || "Diese Frage konnte nicht geladen werden.");
      }
    } finally {
      if (runId === currentRun.current) setLoading(false);
    }
  }

  function start() {
    if (!pool.length) return;
    schedule.current = buildExamSchedule({ ...settings, ruleGen }, pool);
    usedPokemon.current.clear();
    usedAbilities.current.clear();
    usedScenarios.current.clear();
    setAnswered(0); setCorrectCount(0); setByCategory({});
    setError(""); setFinished(false); setActive(true);
    prepareNextQuestion();
  }

  function toggleOption(key) {
    if (checked) return;
    setSelected((previous) => previous.includes(key)
      ? previous.filter((item) => item !== key)
      : previous.length < (question.maxAnswers || question.correct.length)
        ? [...previous, key] : previous);
  }

  function submit() {
    if (!question || checked) return;
    const isName = question.category === "name";
    if (isName ? !nameInput.trim() : !selected.length) return;
    const correct = isName
      ? doesGuessMatch({ name: question.correct[0] }, nameInput)
      : selected.length === question.correct.length
        && question.correct.every((item) => selected.includes(item));
    const nextAnswered = answered + 1;
    const nextCorrect = correctCount + (correct ? 1 : 0);
    setChecked(true); setWasCorrect(correct);
    setAnswered(nextAnswered); setCorrectCount(nextCorrect);
    setByCategory((previous) => ({
      ...previous,
      [question.category]: {
        total: (previous[question.category]?.total || 0) + 1,
        correct: (previous[question.category]?.correct || 0) + (correct ? 1 : 0),
      },
    }));
    const percent = examResult(nextCorrect, nextAnswered).percent;
    // Bestwert erst bei regulärem Prüfungsabschluss gespeichert.
    if (nextAnswered === settings.rounds && percent > best) {
      setBest(percent);
      try { localStorage.setItem(BEST_KEY, String(percent)); } catch { /* optional */ }
    }
  }

  function advance() {
    if (!checked) return;
    if (answered >= settings.rounds || !schedule.current.length) {
      const finalPercent = examResult(correctCount, answered).percent;
      if (finalPercent > best) {
        setBest(finalPercent);
        try { localStorage.setItem(BEST_KEY, String(finalPercent)); } catch { /* optional */ }
      }
      setFinished(true);
      return;
    }
    prepareNextQuestion();
  }

  function onNameKeyDown(event) {
    if (!guessSuggestions.length) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setSuggestionIndex((index) => (index + 1) % guessSuggestions.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setSuggestionIndex((index) => index <= 0 ? guessSuggestions.length - 1 : index - 1);
    } else if (event.key === "Enter" && suggestionIndex >= 0) {
      event.preventDefault();
      setNameInput(guessSuggestions[suggestionIndex].name);
      setSuggestionIndex(-1);
    } else if (event.key === "Escape") {
      setSuggestionIndex(-1);
    }
  }

  const displayedCategory = question?.category;
  const isNameQuestion = displayedCategory === "name";

  return (
    <main className="games-page type-trainer-page">
      <section className="type-trainer-panel exam-panel">
        <div className="type-trainer-topline">
          <button type="button" className="type-trainer-back" onClick={() => nav("/games")}>‹ Zurück</button>
          <button type="button" className="type-trainer-home-link" onClick={() => nav("/")}>Zur Startseite</button>
        </div>
        <h1>Nuzlocke-Eignungstest</h1>
        <p className="type-trainer-subtitle">Sechs Wissensgebiete. Eine Prüfung. Bist du bereit für deine Nuzlocke?</p>
        {!active ? (
          <div className="type-trainer-setup">
            <label className="type-trainer-field">
              <span>Schwierigkeit</span>
              <span className="type-trainer-select-shell">
                <select value={settings.difficulty} onChange={(event) => changeSetting("difficulty", event.target.value)}>
                  <option value="easy">Einfach</option>
                  <option value="normal">Normal</option>
                  <option value="hard">Schwer</option>
                </select>
              </span>
            </label>
            <label className="type-trainer-field">
              <span>Prüfungsfragen</span>
              <span className="type-trainer-select-shell">
                <select value={settings.rounds} onChange={(event) => changeSetting("rounds", Number(event.target.value))}>
                  <option value={12}>12 Fragen</option>
                  <option value={20}>20 Fragen</option>
                  <option value={30}>30 Fragen</option>
                </select>
              </span>
            </label>
            <label className="type-trainer-field">
              <span>Typen- und Regelstand</span>
              <span className="type-trainer-select-shell">
                <select value={settings.ruleGen} onChange={(event) => changeSetting("ruleGen", event.target.value)}>
                  <option value="auto">Automatisch (höchste Generation)</option>
                  {GENS.map((gen) => <option value={String(gen)} key={gen}>Generation {gen}</option>)}
                </select>
              </span>
            </label>
            <div className="exam-pass-info">
              <span className="exam-pass-number">75 %</span>
              <span>zum Bestehen</span>
              <span className="exam-pass-divider" />
              <span>Bestwert: <strong>{best} %</strong></span>
            </div>
            <div className="type-trainer-wide">
              <GenerationFilter title="Pokémon-Generationen"
                generations={settings.generations}
                onToggle={(gen) => changeGens(settings.generations.includes(gen)
                  ? settings.generations.filter((value) => value !== gen)
                  : [...settings.generations, gen].sort((a,b) => a-b))}
                onOnly={(gen) => changeGens([gen])}
                onAll={() => changeGens(GENS)}
                onClear={() => changeGens([])}
              />
            </div>
            <div className="type-trainer-setup-footer">
              <span>{pool.length} Pokémon im Fragenpool · Gen {ruleGen}</span>
              <button type="button" className="type-trainer-primary" disabled={!pool.length} onClick={start}>Prüfung starten</button>
            </div>
            {!pool.length ? <div className="type-trainer-settings-error type-trainer-wide">Wähle mindestens eine Generation, die zum Typenstand passt.</div> : null}
          </div>
        ) : finished ? (
          <section className="exam-results" role="status">
            <div className="exam-rank-icon" aria-hidden="true">{completion.passed ? "★" : "◇"}</div>
            <div className="exam-result-percent">{completion.percent} %</div>
            <h2>{completion.rank}</h2>
            <p>{correctCount} von {answered} Fragen richtig · {correctCount * 100} Punkte</p>
            <div className="exam-category-results">
              {EXAM_CATEGORIES.filter((category) => byCategory[category.key]?.total).map((category) => (
                <div className="exam-category-row" key={category.key}>
                  <span>{category.label}</span>
                  <strong>{byCategory[category.key].correct}/{byCategory[category.key].total}</strong>
                </div>
              ))}
            </div>
            <div className="type-trainer-actions">
              <button className="type-trainer-primary" type="button" onClick={start}>Erneut versuchen</button>
              <button className="type-trainer-secondary" type="button" onClick={exit}>Einstellungen</button>
            </div>
          </section>
        ) : (
          <>
            <div className="type-trainer-score-row">
              <span>Frage {Math.min(answered + 1, settings.rounds)} / {settings.rounds}</span>
              <span>{correctCount * 100} Punkte</span>
              <span>{correctCount} richtig</span>
            </div>
            <div className="exam-progress"><span style={{width: (answered / settings.rounds * 100) + "%"}} /></div>
            {loading ? <div className="type-trainer-loading" role="status">Nächste Frage wird geladen …</div> :
              error ? <div className="type-trainer-feedback is-incorrect">
                <strong>{error}</strong>
                <button className="type-trainer-secondary" type="button" onClick={prepareNextQuestion}>Erneut versuchen</button>
                <button className="type-trainer-secondary" type="button" onClick={exit}>Beenden</button>
              </div> :
              question ? (
                <>
                  <section className="exam-question-block">
                    <CategoryLabel category={question.category} />
                    {question.pokemon ? (
                      <img src={question.pokemon.image} className="exam-pokemon-image"
                        alt={isNameQuestion ? "Unbekanntes Pokémon" : question.pokemon.name}
                        onError={(event) => {
                          const fallback = "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/" + question.pokemon.id + ".png";
                          if (event.currentTarget.src !== fallback) event.currentTarget.src = fallback;
                        }}
                      />
                    ) : null}
                    <h2>{question.title}</h2>
                    {question.attackingType ? (
                      <TypeToken typeKey={question.attackingType} />
                    ) : null}
                  </section>
                  {isNameQuestion ? (
                    <form className="exam-name-form" onSubmit={(event) => { event.preventDefault(); submit(); }}>
                      <div className="exam-input-wrap">
                        <input type="text" className="exam-name-input"
                          placeholder="Pokémon-Name eingeben …" value={nameInput}
                          autoComplete="off" autoFocus disabled={checked}
                          onChange={(event) => { setNameInput(event.target.value); setSuggestionIndex(-1); }}
                          onKeyDown={onNameKeyDown} />
                        {!checked && nameInput.trim() && guessSuggestions.length > 0 ? (
                          <div className="exam-suggestions" role="listbox" aria-label="Pokémon-Vorschläge">
                            {guessSuggestions.map((pokemon,index) => (
                              <button type="button" key={pokemon.dexId} role="option"
                                aria-selected={index===suggestionIndex}
                                className={index===suggestionIndex ? "is-active" : ""}
                                onMouseDown={(event) => {
                                  event.preventDefault();
                                  setNameInput(pokemon.name);
                                  setSuggestionIndex(-1);
                                }}
                                onClick={() => { setNameInput(pokemon.name); setSuggestionIndex(-1); }}>
                                {pokemon.name}
                              </button>
                            ))}
                          </div>
                        ) : null}
                      </div>
                      {!checked ? <button type="submit" className="type-trainer-primary" disabled={!nameInput.trim()}>Prüfen</button> : null}
                    </form>
                  ) : (
                    <div className={"exam-options-grid" + (question.options.some((option) => option.type) ? " has-types" : "")}
                      role="group" aria-label="Antwortmöglichkeiten">
                      {question.options.map((option) => (
                        <QuestionOption key={option.key} option={option}
                          checked={checked} selected={selected.includes(option.key)}
                          correct={question.correct.includes(option.key)}
                          disabled={checked}
                          onClick={() => toggleOption(option.key)}
                        />
                      ))}
                    </div>
                  )}
                  {checked ? (
                    <div className={"type-trainer-feedback " + (wasCorrect ? "is-correct" : "is-incorrect")} role="status">
                      <strong>{wasCorrect ? "Richtig! +100 Punkte" : "Nicht richtig – hier ist die Auflösung:"}</strong>
                      <span>{question.explanation}</span>
                    </div>
                  ) : <p className="type-trainer-hint">{isNameQuestion ? "Tippe den Namen oder wähle einen Vorschlag." :
                    "Wähle " + (question.correct.length === 1 ? "eine Antwort." : question.correct.length + " Antworten.")}</p>}
                  <div className="type-trainer-actions">
                    {checked ? (
                      <button type="button" className="type-trainer-primary" onClick={advance}>
                        {answered >= settings.rounds || !schedule.current.length ? "Ergebnis anzeigen" : "Nächste Frage"}
                      </button>
                    ) : !isNameQuestion ? (
                      <button type="button" className="type-trainer-primary" disabled={!selected.length} onClick={submit}>Antwort prüfen</button>
                    ) : null}
                    <button type="button" className="type-trainer-secondary" onClick={exit}>Prüfung verlassen</button>
                  </div>
                </>
              ) : null}
          </>
        )}
      </section>
    </main>
  );
}
