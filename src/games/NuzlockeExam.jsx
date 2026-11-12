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
  NUZLOCKE_TIER_RULES, buildNuzlockeTierSchedule,
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
  const [pendingExamStart, setPendingExamStart] = useState(false);
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

  const examRules = NUZLOCKE_TIER_RULES[examTier] || NUZLOCKE_TIER_RULES.normal;
  const ruleGen = practice
    ? settings.ruleGen === "auto"
      ? Math.max(1, ...settings.generations) : Number(settings.ruleGen)
    : examRules.ruleGen;
  const generations = practice ? settings.generations : examRules.generations;
  const pool = useMemo(() => examPokemonList(generations, ruleGen),
    [generations, ruleGen]);
  const fullyEvolved = useMemo(() => finalEvolutionPool(pool), [pool]);
  const availableCategories = useMemo(() => examCategories(ruleGen, pool), [ruleGen, pool]);
  const selectedCategories = practice
    ? availableCategories.filter((key) => settings.categories.includes(key))
    : availableCategories;
  // Entwicklungsziele werden als Namen eingetippt. Für die Vorschläge
  // müssen auch Pokémon aus früheren Generationen verfügbar sein,
  // selbst wenn im freien Training nur eine einzelne Gen ausgewählt ist.
  const evolutionNamePool = useMemo(
    () => examPokemonList(GENS.filter((gen) => gen <= ruleGen), ruleGen),
    [ruleGen]
  );
  const isNumericAnswer = question?.responseType === "evolution-level";
  const isPokemonNameAnswer = question?.category === "name" || question?.responseType === "pokemon-name";
  const isTextAnswer = isPokemonNameAnswer || isNumericAnswer;
  const nameSuggestions = useMemo(() =>
    isPokemonNameAnswer && !checked
      ? getPokemonNameSuggestions(
          nameInput,
          question?.responseType === "pokemon-name" ? evolutionNamePool : pool,
          9
        )
      : [],
    [nameInput, isPokemonNameAnswer, question?.responseType, checked, pool, evolutionNamePool]);
  const completion = examResult(correctCount, answered);
  const qualificationLabel = QUALIFICATION_NAMES[qualification] || "Noch nicht qualifiziert";
  const isEndless = practice && settings.rounds === 0;

  function changeSetting(key, value) {
    setSettings((previous) => ({ ...previous, [key]: value }));
  }
  function setGenList(gens) { changeSetting("generations", gens); }
  function toggleCategory(key) {
    changeSetting("categories", settings.categories.includes(key)
      ? settings.categories.filter((value) => value !== key)
      : [...settings.categories, key]);
  }
  // Start only after the chosen tier has been rendered, so the very first
  // question already uses the correct generation pool and question schedule.
  useEffect(() => {
    if (practice || !pendingExamStart) return;
    setPendingExamStart(false);
    start();
  }, [pendingExamStart, examTier]);

  function exit() {
    setPendingExamStart(false);
    requestRef.current += 1;
    setActive(false); setFinished(false); setLoading(false);
    setQuestion(null); setError(""); setBusyHint("");
  }
  function pick(array, key, identity) {
    if (!used.current[key]) used.current[key] = new Set();
    return pickUnused(array, used.current[key], identity);
  }

  async function makeQuestion(category, difficulty) {
    if (category === "scenario") {
      const eligible = TRAP_SCENARIOS.filter((entry) =>
        entry.minGen <= ruleGen && (!entry.maxGen || ruleGen <= entry.maxGen));
      const index = used.current.scenarioPromptCount || 0;
      used.current.scenarioPromptCount = index + 1;
      // In einem Prüfungsdurchlauf kommen festgehaltene UND frei wechselnde
      // Pokémon sowie gelegentlich klassische Nuzlocke-Fragen vor.
      const cases = index % 3 === 2
        ? eligible.filter((entry) => !entry.isTrappingMatchup)
        : eligible.filter((entry) => entry.isTrappingMatchup &&
            entry.correct[0] === (index % 3 === 0 ? 0 : 1));
      const chosen = pick(cases.length ? cases : eligible, "scenario");
      return chosen && makeScenarioQuestion(chosen);
    }
    if (category === "ability") {
      const index = used.current.abilityPromptCount || 0;
      used.current.abilityPromptCount = index + 1;
      // Jede zweite Fähigkeitsfrage testet eine konkrete Wechsel-Situation,
      // z. B. Elektro gegen Ausweglos oder Stahl gegen Magnetfalle.
      if (index % 2 === 1) {
        const cases = TRAP_SCENARIOS.filter((entry) =>
          entry.isTrappingMatchup && entry.minGen <= ruleGen &&
          (!entry.maxGen || ruleGen <= entry.maxGen));
        const situation = pick(cases, "abilitySituation");
        if (situation) {
          return { ...makeScenarioQuestion(situation), category: "ability" };
        }
      }
      const ids = new Set(pool.map((pokemon) => pokemon.dexId));
      const possible = ABILITY_CASES.filter((entry) => entry.minGen <= ruleGen && ids.has(entry.id));
      const chosen = pick(possible, "ability");
      return chosen && makeAbilityQuestion(chosen, difficulty);
    }
    if (category === "items") {
      const eligible = IMPORTANT_ITEMS.filter((item) => item.minGen <= ruleGen);
      const item = pick(eligible, "items");
      return item && makeItemQuestion(item, ruleGen, difficulty);
    }
    if (category === "evolution") {
      const index = used.current.evolutionPromptCount || 0;
      used.current.evolutionPromptCount = index + 1;
      // Regelmäßige Level-Fragen in allen Prüfungen und im Wissenstraining,
      // dazwischen Entwicklungsziele (mit Namenseingabe) und Methoden.
      const variants = !practice && examTier === "normal"
        ? ["level", "target", "level", "method"]
        : !practice && examTier === "hard"
          ? ["level", "level", "method", "target", "level"]
          : ["level", "target", "level", "method", "level"];
      const variant = variants[index % variants.length];
      const eligible = (variant === "method" ? SIMPLE_EVOLUTIONS
        : variant === "level" ? LEVEL_EVOLUTIONS
        : [...SIMPLE_EVOLUTIONS, ...LEVEL_EVOLUTIONS])
        .filter((item) => item.minGen <= ruleGen);
      const fact = pick(eligible, "evolution" + variant);
      // Die Abstände zwischen Level-Antworten hängen vom gewählten Test ab,
      // nicht von der internen Schwierigkeitskurve einer einzelnen Runde.
      const evolutionDifficulty = practice ? difficulty : examTier;
      return fact && makeEvolutionQuestion(fact, ruleGen, evolutionDifficulty, variant);
    }
    if (category === "moves") {
      const eligible = MOVE_FACTS.filter((item) => item.minGen <= ruleGen);
      const move = pick(eligible, "moves");
      if (!move) return null;
      const moveQuestionNumber = used.current.movePromptCount || 0;
      used.current.movePromptCount = moveQuestionNumber + 1;
      // Both type recognition and physical/special classification appear.
      const variant = moveQuestionNumber % 2 === 0 ? "type" : "class";
      return makeMoveQuestion(move, ruleGen, variant, difficulty);
    }
    if (category === "battle") {
      const fact = pick(availableBattleFacts(ruleGen), "battle");
      return fact && makeBattleQuestion(fact);
    }
    if (category === "offense") {
      const laterEvolutions = fullyEvolved.filter((item) => item.dexId >= 387);
      const candidates = !practice && examTier === "normal" && laterEvolutions.length
        ? laterEvolutions : fullyEvolved;
      const chosen = pick(candidates, "offense");
      if (!chosen) return null;
      const pokemon = await loadTrainerPokemon(chosen.dexId, ruleGen);
      return makeOffenseQuestion(pokemon, difficulty);
    }
    if (category === "speed") {
      const laterEvolutions = fullyEvolved.filter((item) => item.dexId >= 387);
      const candidates = !practice && examTier === "normal" && laterEvolutions.length >= 2
        ? laterEvolutions : fullyEvolved;
      if (candidates.length < 2) return null;
      const first = pick(candidates, "speedA");
      const second = pick(candidates.filter((pokemon) => pokemon.dexId !== first.dexId), "speedB");
      if (!first || !second) return null;
      const [left,right] = await Promise.all([
        loadTrainerPokemon(first.dexId, ruleGen),
        loadTrainerPokemon(second.dexId, ruleGen),
      ]);
      return makeSpeedQuestion(left,right,difficulty);
    }
    // The medium test explicitly includes Gen 4–7 encounters alongside classics.
    let eligiblePokemon = pool;
    if (!practice && examTier === "normal") {
      const index = used.current.mediumPokemonCount || 0;
      used.current.mediumPokemonCount = index + 1;
      const later = pool.filter((item) => item.dexId >= 387);
      if (index % 2 === 0 && later.length) eligiblePokemon = later;
    }
    const chosen = pick(eligiblePokemon, "pokemon");
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
        options:(() => {
          const types = getGenerationTypes(ruleGen);
          const correct = types.filter((type) => pokemon.types.includes(type.key));
          const wrong = shuffleItems(types.filter((type) => !pokemon.types.includes(type.key)));
          const count = practice ? types.length : examTier === "easy" ? 6
            : examTier === "normal" ? 10 : types.length;
          return shuffleItems([...correct, ...wrong.slice(0, count-correct.length)])
            .map((type) => ({key:type.key,type:type.key}));
        })(),
        explanation:name + " hat " + pokemon.types.map((key) =>
          getGenerationTypes(ruleGen).find((type) => type.key === key)?.label || key).join(" / ") + ".",
      };
    }
    if (category === "weakness") return makeWeaknessQuestion(pokemon, ruleGen, difficulty);
    if (category === "damage") return makeDamageQuestion(pokemon, ruleGen, difficulty);
    return null;
  }

  // Auswahlfragen: gerade Antwortanzahl, ohne richtige Antworten zu entfernen.
  function normalizeQuestion(prepared) {
    if (!prepared || prepared.category === "name" ||
        prepared.responseType === "pokemon-name" ||
        prepared.responseType === "evolution-level") return prepared;
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

  async function prepareNextQuestion(forcedIndex) {
    const questionIndex = Number.isInteger(forcedIndex) ? forcedIndex : answered;
    const difficulty = practice ? settings.difficulty
      : examQuestionDifficulty(examTierRef.current, questionIndex);
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
          const prepared = normalizeQuestion(await makeQuestion(category, difficulty));
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
    schedule.current = practice
      ? buildExamSchedule({
          ...settings, ruleGen, categories:selectedCategories,
          rounds: isEndless ? 30 : settings.rounds,
        },pool)
      : buildNuzlockeTierSchedule(examTier, availableCategories);
    if (!schedule.current.length) return;
    requestRef.current += 1;
    used.current = {};
    setAnswered(0); setCorrectCount(0); setByCategory({});
    setQuestion(null); setError(""); setFinished(false); setActive(true);
    prepareNextQuestion(0);
  }
  function launchExam(testTier) {
    if (!NUZLOCKE_TIER_RULES[testTier]) return;
    examTierRef.current = testTier;
    setExamTier(testTier);
    setPendingExamStart(true);
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
    const isName = question.category === "name" || question.responseType === "pokemon-name";
    const isLevel = question.responseType === "evolution-level";
    if ((isName || isLevel) ? !nameInput.trim() : !selected.length) return;
    const right = isLevel
      ? /^\\d{1,3}$/.test(nameInput.trim()) && Number(nameInput.trim()) === Number(question.correct[0])
      : isName
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

  const isName = isTextAnswer;
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
                      <input type={isNumericAnswer ? "number" : "text"} className="exam-name-input"
                        inputMode={isNumericAnswer ? "numeric" : "text"}
                        min={isNumericAnswer ? 1 : undefined}
                        max={isNumericAnswer ? 100 : undefined}
                        step={isNumericAnswer ? 1 : undefined}
                        aria-label={isNumericAnswer ? "Entwicklungslevel" : "Pokémon-Name"}
                        placeholder={isNumericAnswer ? "Level eingeben …" : "Pokémon-Name eingeben …"}
                        value={nameInput}
                        autoComplete="off" autoFocus disabled={checked}
                        onChange={(event) => {setNameInput(event.target.value);setSuggestionIndex(-1);}}
                        onKeyDown={isNumericAnswer ? undefined : onNameKeyDown}/>
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
                  <p className="type-trainer-hint">{isNumericAnswer ? "Gib das Entwicklungslevel ein." :
                    isPokemonNameAnswer ? "Tippe den Pokémon-Namen oder wähle einen Vorschlag." :
                    question.correct.length === 1 ? "Wähle eine Antwort." :
                    "Wähle " + question.correct.length + " richtige Antworten."}</p>
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
