import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { GenerationFilter } from "./GenerationFilter";
import { getPokemonNameSuggestions, doesGuessMatch } from "./guessGameEngine";
import { loadTrainerPokemon } from "./trainerPokemonApi";
import { getGenerationTypes, getTypeColor, getTypeIconUrl, shuffleItems } from "./typeTrainerData";
import {
  EXAM_CATEGORIES, ABILITY_CASES, TRAP_SCENARIOS,
  examPokemonList, examCategories, buildExamSchedule, pokemonArtwork,
  makeDamageQuestion, makeWeaknessQuestion, makeAbilityQuestion,
  makeScenarioQuestion, examResult, NUZLOCKE_TESTS, NUZLOCKE_EXAM_ROUNDS, examQuestionDifficulty,
} from "./nuzlockeExamData";
import {
  IMPORTANT_ITEMS, SIMPLE_EVOLUTIONS, LEVEL_EVOLUTIONS, MOVE_FACTS,
  availableBattleFacts, finalEvolutionPool,
  makeItemQuestion, makeEvolutionQuestion, makeMoveQuestion,
  makeBattleQuestion, makeOffenseQuestion, makeSpeedQuestion,
} from "./nuzlockeKnowledgeData";
import "./typeTrainer.css";
import "./nuzlockeExam.css";

const GENS = [1,2,3,4,5,6,7,8,9];
const SETTINGS_KEYS = {
  exam: "ponuz-nuzlocke-exam-settings-v2",
  practice: "ponuz-knowledge-training-settings-v1",
};
const BEST_KEYS = {
  practice: "ponuz-knowledge-training-best-v1",
};
const QUALIFICATION_KEY = "ponuz-nuzlocke-exam-qualification-v1";
const QUALIFICATION_LEVELS = { easy: 1, normal: 2, hard: 3 };
const QUALIFICATION_NAMES = {
  easy: "Kommt infrage",
  normal: "Qualifiziert",
  hard: "Nuzlocke-würdig",
};
function readQualification() {
  try {
    const value = localStorage.getItem(QUALIFICATION_KEY);
    return Object.prototype.hasOwnProperty.call(QUALIFICATION_LEVELS, value) ? value : null;
  } catch { return null; }
}
const INITIAL_SETTINGS = {
  generations: [1,2,3], ruleGen: "auto", rounds: 24,
  difficulty: "normal", categories: EXAM_CATEGORIES.map((entry) => entry.key),
};
function readSettings(mode) {
  const defaults = { ...INITIAL_SETTINGS, rounds: mode === "practice" ? 20 : NUZLOCKE_EXAM_ROUNDS };
  if (mode === "exam") {
    // Eine echte Prüfung: keine manuellen Gen-, Runden- oder Schwierigkeitseinstellungen.
    // Alle zwölf Themen sind in Gen 9 mit Pokémon aus allen neun Generationen verfügbar.
    return {
      ...defaults, generations: GENS, ruleGen: "9", rounds: NUZLOCKE_EXAM_ROUNDS,
      categories: EXAM_CATEGORIES.map((entry) => entry.key),
    };
  }
  try {
    const saved = JSON.parse(localStorage.getItem(SETTINGS_KEYS[mode]));
    if (!saved || typeof saved !== "object") return defaults;
    const generations = Array.isArray(saved.generations)
      ? [...new Set(saved.generations.map(Number).filter((gen) => GENS.includes(gen)))].sort((a,b) => a-b)
      : defaults.generations;
    const ruleGen = saved.ruleGen === "auto" || GENS.some((gen) => String(gen) === saved.ruleGen)
      ? saved.ruleGen : "auto";
    const allowedRounds = [0,10,20,30,50];
    return {
      generations, ruleGen,
      rounds: allowedRounds.includes(Number(saved.rounds)) ? Number(saved.rounds) : defaults.rounds,
      difficulty: ["easy","normal","hard"].includes(saved.difficulty) ? saved.difficulty : "normal",
      categories: Array.isArray(saved.categories)
        ? [...new Set(saved.categories.filter((key) => EXAM_CATEGORIES.some((cat) => cat.key === key)))]
        : defaults.categories,
    };
  } catch { return defaults; }
}
function readBest(mode) {
  if (mode !== "practice") return 0;
  try { return Number(localStorage.getItem(BEST_KEYS.practice)) || 0; }
  catch { return 0; }
}
function pickUnused(array, usedSet, key = (item) => item.id ?? item.dexId) {
  if (!array.length) return null;
  let pool = array.filter((item) => !usedSet.has(key(item)));
  if (!pool.length) { usedSet.clear(); pool = array; }
  const item = pool[Math.floor(Math.random() * pool.length)];
  usedSet.add(key(item));
  return item;
}
function TypeToken({ typeKey }) {
  const type = getGenerationTypes(9).find((entry) => entry.key === typeKey);
  return (
    <span className="exam-type-token" style={{ "--tt-color": getTypeColor(typeKey) }}>
      <img src={getTypeIconUrl(typeKey)} alt="" loading="lazy" />
      {type?.label || typeKey}
    </span>
  );
}
function AnswerOption({ option, checked, selected, correct, onClick }) {
  return (
    <button type="button" disabled={checked} aria-pressed={selected}
      onClick={onClick}
      className={[
        "exam-option", option.type ? "exam-option-type" : "",
        selected ? "exam-option-selected" : "",
        checked && correct ? "exam-option-correct" : "",
        checked && selected && !correct ? "exam-option-wrong" : "",
      ].filter(Boolean).join(" ")}>
      {option.type ? <TypeToken typeKey={option.type} /> : <span>{option.label}</span>}
      {selected && !checked ? <span className="exam-selected-mark" aria-hidden="true">✓</span> : null}
      {checked && correct ? <span className="exam-check" aria-label="Richtig">✓</span> : null}
      {checked && selected && !correct ? <span className="exam-check" aria-label="Falsch">×</span> : null}
    </button>
  );
}
function PokemonArt({ pokemon, hideName = false }) {
  return (
    <img src={pokemon.image} className="exam-pokemon-image"
      alt={hideName ? "Unbekanntes Pokémon" : pokemon.name}
      onError={(event) => {
        const fallback = "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/" + pokemon.id + ".png";
        if (event.currentTarget.src !== fallback) event.currentTarget.src = fallback;
      }}
    />
  );
}

export default function NuzlockeExam({ mode = "exam" }) {
  const nav = useNavigate();
  const practice = mode === "practice";
  const [settings, setSettings] = useState(() => readSettings(mode));
  const [examTier, setExamTier] = useState("normal");
  const examTierRef = useRef("normal");
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
  const [best, setBest] = useState(() => readBest(mode));
  const [qualification, setQualification] = useState(readQualification);
  const requestRef = useRef(0);
  const schedule = useRef([]);
  const used = useRef({});
  const [busyHint, setBusyHint] = useState("");

  useEffect(() => () => { requestRef.current += 1; }, []);
  useEffect(() => {
    try { localStorage.setItem(SETTINGS_KEYS[mode], JSON.stringify(settings)); }
    catch { /* local storage optional */ }
  }, [settings, mode]);

  const ruleGen = settings.ruleGen === "auto"
    ? Math.max(1, ...settings.generations) : Number(settings.ruleGen);
  const pool = useMemo(() => examPokemonList(settings.generations, ruleGen),
    [settings.generations, ruleGen]);
  const fullyEvolved = useMemo(() => finalEvolutionPool(pool), [pool]);
  const availableCategories = useMemo(() => examCategories(ruleGen, pool), [ruleGen, pool]);
  const selectedCategories = practice
    ? availableCategories.filter((key) => settings.categories.includes(key))
    : availableCategories;
  const nameSuggestions = useMemo(() =>
    question?.category === "name" && !checked
      ? getPokemonNameSuggestions(nameInput, pool, 9) : [],
    [nameInput, question?.category, checked, pool]);
  const completion = examResult(correctCount, answered);
  const qualificationLabel = QUALIFICATION_NAMES[qualification] || "Noch nicht qualifiziert";
  const isEndless = practice && settings.rounds === 0;
  const roundDifficulty = practice ? settings.difficulty
    : examQuestionDifficulty(examTierRef.current, answered);

  function changeSetting(key, value) {
    setSettings((previous) => ({ ...previous, [key]: value }));
  }
  function setGenList(gens) { changeSetting("generations", gens); }
  function toggleCategory(key) {
    changeSetting("categories", settings.categories.includes(key)
      ? settings.categories.filter((value) => value !== key)
      : [...settings.categories, key]);
  }
  function exit() {
    requestRef.current += 1;
    setActive(false); setFinished(false); setLoading(false);
    setQuestion(null); setError(""); setBusyHint("");
  }
  function pick(array, key, identity) {
    if (!used.current[key]) used.current[key] = new Set();
    return pickUnused(array, used.current[key], identity);
  }

  async function makeQuestion(category) {
    if (category === "scenario") {
      const candidates = TRAP_SCENARIOS.filter((entry) => entry.minGen <= ruleGen);
      return makeScenarioQuestion(pick(candidates, "scenario"));
    }
    if (category === "ability") {
      const ids = new Set(pool.map((pokemon) => pokemon.dexId));
      const possible = ABILITY_CASES.filter((entry) => entry.minGen <= ruleGen && ids.has(entry.id));
      const chosen = pick(possible, "ability");
      return chosen && makeAbilityQuestion(chosen, roundDifficulty);
    }
    if (category === "items") {
      const eligible = IMPORTANT_ITEMS.filter((item) => item.minGen <= ruleGen);
      const item = pick(eligible, "items");
      return item && makeItemQuestion(item, ruleGen, roundDifficulty);
    }
    if (category === "evolution") {
      const eligible = [...SIMPLE_EVOLUTIONS, ...LEVEL_EVOLUTIONS]
        .filter((item) => item.minGen <= ruleGen);
      const fact = pick(eligible, "evolution");
      return fact && makeEvolutionQuestion(fact, ruleGen, roundDifficulty);
    }
    if (category === "moves") {
      const eligible = MOVE_FACTS.filter((item) => item.minGen <= ruleGen);
      const move = pick(eligible, "moves");
      return move && makeMoveQuestion(move, ruleGen);
    }
    if (category === "battle") {
      const fact = pick(availableBattleFacts(ruleGen), "battle");
      return fact && makeBattleQuestion(fact);
    }
    if (category === "offense") {
      const chosen = pick(fullyEvolved, "offense");
      if (!chosen) return null;
      const pokemon = await loadTrainerPokemon(chosen.dexId, ruleGen);
      return makeOffenseQuestion(pokemon, roundDifficulty);
    }
    if (category === "speed") {
      if (fullyEvolved.length < 2) return null;
      const first = pick(fullyEvolved, "speedA");
      const second = pick(fullyEvolved.filter((pokemon) => pokemon.dexId !== first.dexId), "speedB");
      if (!first || !second) return null;
      const [left,right] = await Promise.all([
        loadTrainerPokemon(first.dexId, ruleGen),
        loadTrainerPokemon(second.dexId, ruleGen),
      ]);
      return makeSpeedQuestion(left,right,roundDifficulty);
    }
    const chosen = pick(pool, "pokemon");
    if (!chosen) return null;
    const name = chosen.name;
    if (category === "name") {
      return { category, title: "Wie heißt dieses Pokémon?",
        pokemon: { id:chosen.dexId, name, image:pokemonArtwork(chosen.dexId) },
        correct:[name], explanation:"Gesucht war " + name + "." };
    }
    const pokemon = await loadTrainerPokemon(chosen.dexId, ruleGen);
    if (!pokemon.types?.length) return null;
    if (category === "types") {
      return {
        category, title:"Welche Typen hat " + name + "?", pokemon,
        correct:pokemon.types, maxAnswers:pokemon.types.length,
        options:getGenerationTypes(ruleGen).map((type) => ({key:type.key,type:type.key})),
        explanation:name + " hat " + pokemon.types.map((key) =>
          getGenerationTypes(ruleGen).find((type) => type.key === key)?.label || key).join(" / ") + ".",
      };
    }
    if (category === "weakness") return makeWeaknessQuestion(pokemon, ruleGen, roundDifficulty);
    if (category === "damage") return makeDamageQuestion(pokemon, ruleGen, roundDifficulty);
    return null;
  }

  // Auswahlfragen: gerade Antwortanzahl, ohne richtige Antworten zu entfernen.
  function normalizeQuestion(prepared) {
    if (!prepared || prepared.category === "name") return prepared;
    if (!Array.isArray(prepared.options) || prepared.options.length < 4) return null;
    const options = shuffleItems([...prepared.options]);
    if (options.length % 2 !== 0) {
      const removable = options.findIndex((option) => !prepared.correct.includes(option.key));
      if (removable < 0) return null;
      options.splice(removable, 1);
    }
    if (options.length < 4 || !prepared.correct.every((key) => options.some((option) => option.key === key))) return null;
    return { ...prepared, options };
  }
  function refillEndlessQueue() {
    schedule.current.push(...buildExamSchedule({
      ...settings, ruleGen, categories:selectedCategories, rounds:30,
    },pool));
  }

  async function prepareNextQuestion() {
    const requestId = ++requestRef.current;
    setLoading(true); setError(""); setBusyHint(""); setQuestion(null);
    setSelected([]); setChecked(false); setWasCorrect(false);
    setNameInput(""); setSuggestionIndex(-1);
    let reason = "";
    try {
      if (isEndless && !schedule.current.length) refillEndlessQueue();
      for (let attempt = 0; attempt < 32 && schedule.current.length; attempt += 1) {
        const category = schedule.current.shift();
        try {
          if (attempt > 5) setBusyHint("Suche eine passende Frage …");
          const prepared = normalizeQuestion(await makeQuestion(category));
          if (requestId !== requestRef.current) return;
          if (!prepared || !prepared.correct?.length || (prepared.options && !prepared.options.length)) {
            schedule.current.push(category);
            continue;
          }
          setQuestion(prepared);
          return;
        } catch (caught) {
          // If fetching Pokémon fails, preserve the exam category and offer retry.
          schedule.current.unshift(category);
          reason = caught?.message || "Frage nicht verfügbar.";
          break;
        }
      }
      if (requestId !== requestRef.current) return;
      if (!schedule.current.length) setFinished(true);
      else setError(reason || "Für diese Auswahl konnte keine lösbare Frage erzeugt werden. Probiere eine andere Generation oder Schwierigkeit.");
    } finally {
      if (requestId === requestRef.current) { setLoading(false); setBusyHint(""); }
    }
  }
  function start() {
    if (!pool.length || !selectedCategories.length) return;
    schedule.current = buildExamSchedule({
      ...settings, ruleGen, categories:selectedCategories,
      rounds: isEndless ? 30 : settings.rounds,
    },pool);
    if (!schedule.current.length) return;
    requestRef.current += 1;
    used.current = {};
    setAnswered(0); setCorrectCount(0); setByCategory({});
    setQuestion(null); setError(""); setFinished(false); setActive(true);
    prepareNextQuestion();
  }
  function launchExam(testTier) {
    examTierRef.current = testTier;
    setExamTier(testTier);
    start();
  }
  function toggleOption(key) {
    if (checked) return;
    const maximum = question?.maxAnswers || question?.correct?.length || 1;
    setSelected((previous) => previous.includes(key)
      ? previous.filter((item) => item !== key)
      : previous.length < maximum ? [...previous,key] : previous);
  }
  function submit() {
    if (!question || checked) return;
    const isName = question.category === "name";
    if (isName ? !nameInput.trim() : !selected.length) return;
    const right = isName
      ? doesGuessMatch({ name:question.correct[0] }, nameInput)
      : selected.length === question.correct.length && question.correct.every((item) => selected.includes(item));
    setChecked(true); setWasCorrect(right);
    setAnswered((value) => value + 1);
    setCorrectCount((value) => value + Number(right));
    setByCategory((previous) => ({
      ...previous,
      [question.category]:{
        total:(previous[question.category]?.total||0)+1,
        correct:(previous[question.category]?.correct||0)+Number(right),
      },
    }));
  }
  function finish() {
    if (!practice && answered === NUZLOCKE_EXAM_ROUNDS && correctCount === NUZLOCKE_EXAM_ROUNDS) {
      // Der Status wird ausschließlich bei einer perfekten, abgeschlossenen Prüfung erhöht.
      // Ein neuer Versuch mit weniger Punkten kann ihn nicht herabsetzen.
      const achieved = examTierRef.current;
      if (QUALIFICATION_LEVELS[achieved] > (QUALIFICATION_LEVELS[qualification] || 0)) {
        setQualification(achieved);
        try { localStorage.setItem(QUALIFICATION_KEY, achieved); }
        catch { /* optional */ }
      }
    }
    if (practice) {
      const percentage = examResult(correctCount, answered).percent;
      if (percentage > best) {
        setBest(percentage);
        try { localStorage.setItem(BEST_KEYS.practice, String(percentage)); }
        catch { /* optional */ }
      }
    }
    setFinished(true);
  }
  function advance() {
    if (!checked) return;
    if (isEndless && !schedule.current.length) refillEndlessQueue();
    if ((!isEndless && answered >= settings.rounds) || !schedule.current.length) finish();
    else prepareNextQuestion();
  }
  function onNameKeyDown(event) {
    if (!nameSuggestions.length) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setSuggestionIndex((index) => (index + 1) % nameSuggestions.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setSuggestionIndex((index) => index <= 0 ? nameSuggestions.length-1 : index-1);
    } else if (event.key === "Enter" && suggestionIndex >= 0) {
      event.preventDefault();
      setNameInput(nameSuggestions[suggestionIndex].name);
      setSuggestionIndex(-1);
    } else if (event.key === "Escape") {
      setSuggestionIndex(-1);
    }
  }

  const isName = question?.category === "name";
  const categoryInfo = EXAM_CATEGORIES.find((category) => category.key === question?.category);
  const title = practice ? "Pokémon-Wissenstraining" : "Nuzlocke-Eignungstest";

  return (
    <main className="games-page type-trainer-page">
      <section className="type-trainer-panel exam-panel">
        <div className="type-trainer-topline">
          <button type="button" className="type-trainer-back" onClick={() => nav("/games")}>‹ Zurück</button>
          <button type="button" className="type-trainer-home-link" onClick={() => nav("/")}>Zur Startseite</button>
        </div>
        <h1>{title}</h1>
        {practice ? (
          <p className="type-trainer-subtitle">Trainiere einzelne oder mehrere Wissensgebiete.</p>
        ) : null}
        {!active ? (
          practice ? (
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
              <span>{practice ? "Trainingsrunden" : "Prüfungsfragen"}</span>
              <span className="type-trainer-select-shell">
                <select value={settings.rounds} onChange={(event) => changeSetting("rounds", Number(event.target.value))}>
                  <option value={0}>Endlos</option>
                  {[10,20,30,50].map((count) => (
                    <option key={count} value={count}>{count} Fragen</option>
                  ))}
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
              {practice ? (
                <>
                  <span className="exam-pass-number">+100</span>
                  <span>pro richtige Antwort</span>
                </>
              ) : (
                <>
                  <span className="exam-pass-number">100 %</span>
                  <span>Nuzlocke-würdig</span>
                </>
              )}
              <span className="exam-pass-divider"/>
              <span>Bestwert: <strong>{best} %</strong></span>
            </div>
            <div className="type-trainer-wide">
              <GenerationFilter title="Pokémon-Generationen"
                generations={settings.generations}
                onToggle={(gen) => setGenList(settings.generations.includes(gen)
                  ? settings.generations.filter((value) => value !== gen)
                  : [...settings.generations,gen].sort((a,b)=>a-b))}
                onOnly={(gen) => setGenList([gen])}
                onAll={() => setGenList(GENS)}
                onClear={() => setGenList([])}
              />
            </div>
            <div className="type-trainer-wide">
              <div className="exam-knowledge-header">
                <span className="type-trainer-field-title">{practice ? "Wissensgebiete auswählen" : "Prüfungsgebiete"}</span>
                {practice ? <div className="exam-knowledge-actions">
                  <button type="button" onClick={() => changeSetting("categories",availableCategories)}>Alle</button>
                  <button type="button" onClick={() => changeSetting("categories",[])}>Keine</button>
                </div> : null}
              </div>
              <div className="exam-knowledge-grid">
                {EXAM_CATEGORIES.map((category) => {
                  const available = availableCategories.includes(category.key);
                  const chosen = available && (!practice || settings.categories.includes(category.key));
                  return (
                    <div key={category.key} className="exam-knowledge-unit">
                      <button type="button"
                        className={"exam-knowledge-chip" + (chosen?" is-selected":"")}
                        disabled={!available || !practice}
                        aria-pressed={chosen}
                        onClick={() => toggleCategory(category.key)}>
                        <span>{chosen ? "✓" : "○"}</span>
                        <span>{category.label}</span>
                      </button>
                      {practice && available ? (
                        <button type="button" className="exam-knowledge-only"
                          title={"Nur " + category.label + " trainieren"}
                          onClick={() => changeSetting("categories", [category.key])}>Nur</button>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="type-trainer-setup-footer">
              <span>{pool.length} Pokémon · Gen {ruleGen} · {selectedCategories.length} Wissensgebiete</span>
              <button type="button" className="type-trainer-primary"
                disabled={!pool.length || !selectedCategories.length}
                onClick={start}>{practice ? "Training starten" : "Prüfung starten"}</button>
            </div>
            {!pool.length ? <p className="type-trainer-settings-error type-trainer-wide">Wähle mindestens eine Generation, die zum Regelstand passt.</p> : null}
            {pool.length>0&&!selectedCategories.length ? <p className="type-trainer-settings-error type-trainer-wide">Wähle mindestens ein verfügbares Wissensgebiet.</p> : null}
          </div>

          ) : (
            <div className="exam-fixed-tests">
              <div className="exam-fixed-header">
                <strong>Welche Prüfung willst du ablegen?</strong>
                <span>30 Fragen pro Prüfung</span>
              </div>
              <div className="exam-test-grid">
                {NUZLOCKE_TESTS.map((tier, index) => (
                  <button key={tier.key} type="button"
                    className={"exam-test-card exam-test-" + tier.key}
                    onClick={() => launchExam(tier.key)}>
                    <span className="exam-test-step">{index + 1}</span>
                    <strong>{tier.label}</strong>
                    <span>{tier.subtitle}</span>
                    <span className="exam-test-start">Prüfung starten ›</span>
                  </button>
                ))}
              </div>
              <div className="exam-fixed-footer">
                <span className="exam-qualification-status">Status: <strong>{qualificationLabel}</strong></span>
              </div>
            </div>
          )
        ) : finished ? (
          <section className="exam-results" role="status">
            <div className="exam-rank-icon" aria-hidden="true">{!practice && completion.passed ? "★" : "◇"}</div>
            <div className="exam-result-percent">{completion.percent} %</div>
            <h2>{practice ? "Training abgeschlossen" : completion.passed ? "Prüfung bestanden!" : "Prüfung abgeschlossen"}</h2>
            {!practice ? (
              <p>Test: {NUZLOCKE_TESTS.find((test) => test.key === examTier)?.label} · Status: <strong>{qualificationLabel}</strong></p>
            ) : null}
            <p>{correctCount} von {answered} Fragen richtig · {correctCount * 100} Punkte</p>
            <div className="exam-category-results">
              {EXAM_CATEGORIES.filter((category) => byCategory[category.key]?.total).map((category) => (
                <div key={category.key} className="exam-category-row">
                  <span>{category.label}</span>
                  <strong>{byCategory[category.key].correct} / {byCategory[category.key].total}</strong>
                </div>
              ))}
            </div>
            <div className="type-trainer-actions">
              <button type="button" className="type-trainer-primary"
                onClick={practice ? start : () => launchExam(examTier)}>
                {practice ? "Weiter trainieren" : "Prüfung wiederholen"}
              </button>
              <button type="button" className="type-trainer-secondary" onClick={exit}>Einstellungen</button>
              {!practice ? <button type="button" className="type-trainer-secondary"
                onClick={() => nav("/games/knowledge-training")}>Gezielt trainieren</button> : null}
            </div>
          </section>
        ) : (
          <>
            <div className="type-trainer-score-row">
              <span>{practice ? "Training" : NUZLOCKE_TESTS.find((test) => test.key === examTier)?.label + "-Test"} · Frage {isEndless ? answered+1 : Math.min(answered+1,settings.rounds)} / {isEndless ? "∞" : settings.rounds}</span>
              <span>{correctCount * 100} Punkte</span>
              <span>{correctCount} richtig</span>
            </div>
            {!isEndless ? <div className="exam-progress"><span style={{width: (answered/settings.rounds*100)+"%"}}/></div> : null}
            {loading ? (
              <div className="type-trainer-loading" role="status">Frage wird geladen … {busyHint}</div>
            ) : error ? (
              <div className="type-trainer-feedback is-incorrect" role="alert">
                <strong>{error}</strong>
                <div className="type-trainer-actions">
                  <button className="type-trainer-secondary" type="button" onClick={prepareNextQuestion}>Erneut versuchen</button>
                  <button className="type-trainer-secondary" type="button" onClick={exit}>Einstellungen</button>
                </div>
              </div>
            ) : question ? (
              <>
                <section className="exam-question-block">
                  <span className="exam-kind">{categoryInfo?.label || "Wissen"}</span>
                  {question.pokemon ? <PokemonArt pokemon={question.pokemon} hideName={isName}/> : null}
                  {question.pokemonPair ? (
                    <div className="exam-pokemon-pair">
                      {question.pokemonPair.map((pokemon) => (
                        <div key={pokemon.id}><PokemonArt pokemon={pokemon}/><strong>{pokemon.name}</strong></div>
                      ))}
                    </div>
                  ) : null}
                  {question.itemImage ? <img className="exam-item-art" src={question.itemImage} alt=""
                    onError={(event) => { event.currentTarget.style.display="none"; }}/> : null}
                  <h2>{question.title}</h2>
                  {question.questionNote ? <p className="exam-question-note">{question.questionNote}</p> : null}
                  {question.attackingType ? <TypeToken typeKey={question.attackingType}/> : null}
                </section>
                {isName ? (
                  <form className="exam-name-form" onSubmit={(event) => {event.preventDefault();submit();}}>
                    <div className="exam-input-wrap">
                      <input type="text" className="exam-name-input"
                        placeholder="Pokémon-Name eingeben …" value={nameInput}
                        autoComplete="off" autoFocus disabled={checked}
                        onChange={(event) => {setNameInput(event.target.value);setSuggestionIndex(-1);}}
                        onKeyDown={onNameKeyDown}/>
                      {!checked && nameInput.trim() && nameSuggestions.length > 0 ? (
                        <div className="exam-suggestions" role="listbox" aria-label="Pokémon-Vorschläge">
                          {nameSuggestions.map((pokemon,index) => (
                            <button type="button" key={pokemon.dexId} role="option"
                              aria-selected={index===suggestionIndex}
                              className={index===suggestionIndex?"is-active":""}
                              onMouseDown={(event) => {event.preventDefault();setNameInput(pokemon.name);setSuggestionIndex(-1);}}
                              onClick={() => {setNameInput(pokemon.name);setSuggestionIndex(-1);}}>
                              {pokemon.name}
                            </button>
                          ))}
                        </div>
                      ) : null}
                    </div>
                    {!checked ? <button type="submit" className="type-trainer-primary" disabled={!nameInput.trim()}>Prüfen</button> : null}
                  </form>
                ) : (
                  <div className={"exam-options-grid" + (question.options.some((option)=>option.type)?" has-types":"")}
                    role="group" aria-label="Antwortmöglichkeiten">
                    {question.options.map((option) => (
                      <AnswerOption key={option.key} option={option}
                        checked={checked} selected={selected.includes(option.key)}
                        correct={question.correct.includes(option.key)}
                        onClick={() => toggleOption(option.key)}/>
                    ))}
                  </div>
                )}
                {checked ? (
                  <div className={"type-trainer-feedback "+(wasCorrect?"is-correct":"is-incorrect")} role="status">
                    <strong>{wasCorrect?"Richtig! +100 Punkte":"Leider nicht richtig."}</strong>
                    <span>{question.explanation}</span>
                  </div>
                ) : (
                  <p className="type-trainer-hint">{isName?"Tippe den Pokémon-Namen oder wähle einen Vorschlag.":
                    question.correct.length===1?"Wähle eine Antwort.":
                      "Wähle "+question.correct.length+" richtige Antworten."}</p>
                )}
                <div className="type-trainer-actions">
                  {checked ? (
                    <button type="button" className="type-trainer-primary" onClick={advance}>
                      {!isEndless && (answered>=settings.rounds||!schedule.current.length)?"Ergebnis anzeigen":"Nächste Frage"}
                    </button>
                  ) : !isName ? (
                    <button type="button" className="type-trainer-primary" disabled={!selected.length} onClick={submit}>
                      Antwort prüfen
                    </button>
                  ) : null}
                  <button type="button" className="type-trainer-secondary" onClick={() => { if (isEndless && answered > 0) finish(); else exit(); }}>
                    {practice?"Training beenden":"Prüfung verlassen"}
                  </button>
                </div>
              </>
            ) : null}
          </>
        )}
      </section>
    </main>
  );
}
