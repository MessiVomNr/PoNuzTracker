// Fragensammlung und Generator für den Nuzlocke-Eignungstest.
// Die Fähigkeiten-Fragen verwenden bekannte, real mögliche Standardfähigkeiten.
// Ausnahmen (z. B. Geist-Typen ab Gen 6) sind ausdrücklich berücksichtigt.
import { pokedex } from "../data/pokedex";
import {
  GEN_RANGES, getGenerationTypes, getTypeMultiplierForGeneration,
  shuffleItems, getTypeLabel, createTrainingChoices, formatMultiplier,
} from "./typeTrainerData";

export const EXAM_CATEGORIES = [
  { key: "name", label: "Pokémon erkennen" },
  { key: "types", label: "Typen zuordnen" },
  { key: "weakness", label: "Schwächen erkennen" },
  { key: "damage", label: "Effektivität" },
  { key: "ability", label: "Fähigkeiten zuordnen" },
  { key: "scenario", label: "Nuzlocke-Fallen" },
];

export const ABILITIES = [
  ["overgrow", "Notdünger"], ["blaze", "Großbrand"], ["torrent", "Sturzbach"],
  ["static", "Statik"], ["magnet-pull", "Magnetfalle"], ["shadow-tag", "Wegsperre"],
  ["arena-trap", "Ausweglos"], ["levitate", "Schwebe"],
  ["thick-fat", "Speckschicht"], ["intimidate", "Bedroher"],
  ["wonder-guard", "Wunderwache"], ["inner-focus", "Konzentrator"],
  ["volt-absorb", "Voltabsorber"], ["water-absorb", "H2O-Absorber"],
  ["flash-fire", "Feuerfänger"], ["trace", "Erfassen"],
  ["chlorophyll", "Chlorophyll"], ["sturdy", "Robustheit"],
].map(([key, label]) => ({ key, label }));

const ABILITY_MAP = Object.fromEntries(ABILITIES.map((ability) => [ability.key, ability.label]));
// Nur stabile, belegbare Kombinationen aus Basisform + möglicher Fähigkeit.
export const ABILITY_CASES = [
  { id: 1, key: "overgrow", minGen: 3 },
  { id: 4, key: "blaze", minGen: 3 },
  { id: 7, key: "torrent", minGen: 3 },
  { id: 25, key: "static", minGen: 3 },
  { id: 51, key: "arena-trap", minGen: 3 },
  { id: 81, key: "magnet-pull", minGen: 3 },
  { id: 92, key: "levitate", minGen: 3 },
  { id: 130, key: "intimidate", minGen: 3 },
  { id: 134, key: "water-absorb", minGen: 3 },
  { id: 135, key: "volt-absorb", minGen: 3 },
  { id: 136, key: "flash-fire", minGen: 3 },
  { id: 143, key: "thick-fat", minGen: 3 },
  { id: 202, key: "shadow-tag", minGen: 3 },
  { id: 282, key: "trace", minGen: 3 },
  { id: 292, key: "wonder-guard", minGen: 3 },
  { id: 360, key: "shadow-tag", minGen: 3 },
  { id: 448, key: "inner-focus", minGen: 4 },
  { id: 462, key: "magnet-pull", minGen: 4 },
  { id: 576, key: "shadow-tag", minGen: 5 }, // versteckte Fähigkeit
];

export const TRAP_SCENARIOS = [
  {
    id: "magnet", minGen: 3,
    question: "Welche Fähigkeit hält gegnerische Stahl-Pokémon normalerweise am regulären Wechseln?",
    options: ["Magnetfalle", "Wegsperre", "Ausweglos", "Schwebe"], correct: [0],
    explanation: "Magnetfalle hält normalerweise Stahl-Pokémon fest. Geist-Pokémon sind ab Gen 6 davon ausgenommen.",
  },
  {
    id: "shadow", minGen: 3,
    question: "Welche Fähigkeit hält die meisten gegnerischen Pokémon unabhängig vom Typ fest?",
    options: ["Wegsperre", "Magnetfalle", "Robustheit", "Bedroher"], correct: [0],
    explanation: "Wegsperre verhindert normalerweise den regulären Wechsel. Seit Gen 6 sind Geist-Pokémon ausgenommen.",
  },
  {
    id: "arena", minGen: 3,
    question: "Welche Fähigkeit verhindert normalerweise, dass geerdete Gegner regulär wechseln?",
    options: ["Ausweglos", "Wassertempo", "Magnetfalle", "Notdünger"], correct: [0],
    explanation: "Ausweglos betrifft geerdete Gegner. Flug-Pokémon und Pokémon mit Schwebe sind normalerweise nicht betroffen.",
  },
  {
    id: "which-shadow", minGen: 5,
    question: "Welche dieser Pokémon können Wegsperre besitzen? Wähle alle richtigen.",
    options: ["Woingenau", "Isso", "Morbitesse", "Magneton", "Digdri", "Panzaeron"],
    correct: [0,1,2],
    explanation: "Woingenau und Isso besitzen Wegsperre. Morbitesse kann sie als versteckte Fähigkeit besitzen.",
  },
  {
    id: "ghost-shadow", minGen: 6,
    question: "Ein Geist-Pokémon trifft ab Generation 6 auf Wegsperre. Was stimmt?",
    options: ["Es kann normalerweise trotzdem wechseln.", "Es kann niemals wechseln.", "Nur Kampf-Attacken helfen.", "Wegsperre verursacht Schaden."],
    correct: [0],
    explanation: "Seit Gen 6 können Geist-Pokémon vor Effekten, die den Wechsel verhindern, fliehen bzw. wechseln.",
  },
  {
    id: "ghost-magnet", minGen: 6,
    question: "Ein Stahl/Geist-Pokémon steht einem Gegner mit Magnetfalle gegenüber. Was gilt ab Gen 6?",
    options: ["Es kann normalerweise wechseln.", "Es ist immer gefangen.", "Es verliert jede Runde KP.", "Seine Attacken werden blockiert."],
    correct: [0],
    explanation: "Die Geist-Immunität gegen Fang-Effekte greift auch bei Magnetfalle.",
  },
  {
    id: "flying-arena", minGen: 3,
    question: "Welcher Gegner wird von Ausweglos normalerweise NICHT festgehalten?",
    options: ["Ein Flug-Pokémon", "Ein normales Boden-Pokémon", "Ein geerdetes Stahl-Pokémon", "Ein geerdetes Feuer-Pokémon"],
    correct: [0],
    explanation: "Flug-Pokémon gelten normalerweise nicht als geerdet.",
  },
  {
    id: "shed-shell", minGen: 4,
    question: "Welches Item ermöglicht normalerweise den regulären Wechsel trotz Wegsperre?",
    options: ["Wechselhülle", "Fokusgurt", "Leben-Orb", "Wahlband"],
    correct: [0],
    explanation: "Mit der Wechselhülle kann das Pokémon trotz Fang-Effekten normalerweise ausgewechselt werden.",
  },
  {
    id: "levitate", minGen: 3,
    question: "Welche Fähigkeit macht Pokémon normalerweise immun gegen Boden-Attacken?",
    options: ["Schwebe", "Bedroher", "Erzwinger", "Notdünger"],
    correct: [0],
    explanation: "Schwebe verhindert im Normalfall Treffer durch Boden-Attacken. Sonderfälle wie Überbrückung sind möglich.",
  },
  {
    id: "sturdy", minGen: 5,
    question: "Welche Fähigkeit lässt ein Pokémon ab Gen 5 bei vollen KP einen normalen K.-o.-Treffer mit 1 KP überstehen?",
    options: ["Robustheit", "Wegsperre", "Großbrand", "Magnetfalle"],
    correct: [0],
    explanation: "Robustheit verhindert ab Gen 5 bei vollen KP einen direkten K.-o.-Treffer.",
  },
  {
    id: "shadow-moves", minGen: 3,
    question: "Welche Aussage ist bei Wegsperre in der Regel richtig?",
    options: ["Es verhindert reguläres Auswechseln.", "Es erhöht die Fluchtchance.", "Es schützt vor Elektro-Attacken.", "Es halbiert Gegnerschaden."],
    correct: [0],
    explanation: "Wegsperre blockiert reguläre Wechsel. Bestimmte Items, Attacken und Typen sind Ausnahmen.",
  },
  {
    id: "rock-flying", minGen: 1,
    question: "Welche Attacke kann ein Flug-Pokémon ohne Zusatz-Effekte normalerweise nicht treffen?",
    options: ["Erdbeben", "Donnerblitz", "Eisstrahl", "Steinhagel"],
    correct: [0],
    explanation: "Boden-Attacken treffen Flug-Pokémon normalerweise nicht.",
  },
];

export function examPokemonList(generations, ruleGen) {
  const allowedGens = generations.filter((gen) => gen <= ruleGen && GEN_RANGES[gen]);
  return Object.entries(pokedex)
    .map(([key, name]) => ({ dexId: Number(String(key).replace("pokedex", "")), name }))
    .filter((pokemon) => Number.isFinite(pokemon.dexId)
      && allowedGens.some((gen) => pokemon.dexId >= GEN_RANGES[gen][0] && pokemon.dexId <= GEN_RANGES[gen][1]))
    .sort((a,b) => a.dexId - b.dexId);
}

export function pokemonArtwork(id) {
  return "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/" + id + ".png";
}

export function examCategories(ruleGen, pokemonPool, generations) {
  const available = ["name", "types", "weakness", "damage"];
  if (ruleGen >= 3 && ABILITY_CASES.some((entry) => pokemonPool.some((p) => p.dexId === entry.id && ruleGen >= entry.minGen))) {
    available.push("ability");
  }
  if (TRAP_SCENARIOS.some((scenario) => scenario.minGen <= ruleGen)) available.push("scenario");
  return available;
}

// Gleiche Anzahl Fragen je Kategorie, danach erst Wiederholungen.
export function buildExamSchedule(settings, pool) {
  const categories = examCategories(settings.ruleGen, pool, settings.generations);
  const result = [];
  while (result.length < settings.rounds) {
    result.push(...shuffleItems(categories).slice(0, settings.rounds - result.length));
  }
  return result;
}

export function makeDamageQuestion(pokemon, ruleGen, difficulty = "normal") {
  const attacks = shuffleItems(getGenerationTypes(ruleGen));
  const attack = attacks.find((type) =>
    getTypeMultiplierForGeneration(type.key, pokemon.types, ruleGen) !== null);
  if (!attack) return null;
  const right = getTypeMultiplierForGeneration(attack.key, pokemon.types, ruleGen);
  const possible = [0, .25, .5, 1, 2, 4].filter((multiplier) => multiplier !== right);
  const max = difficulty === "easy" ? 3 : difficulty === "hard" ? 6 : 4;
  const sorted = [...possible].sort((a,b) => Math.abs(a-right)-Math.abs(b-right));
  const options = shuffleItems([right, ...sorted.slice(0, max-1)]).map((value) => ({
    key: String(value), label: formatMultiplier(value), value,
  }));
  return { category: "damage", title: "Wie effektiv ist " + getTypeLabel(attack.key) +
    " gegen " + pokemon.name + "?", pokemon, attackingType: attack.key,
    options, correct: [String(right)],
    explanation: "Der Angriff verursacht " + formatMultiplier(right) + " Schaden." };
}

export function makeWeaknessQuestion(pokemon, ruleGen, difficulty = "normal") {
  const { choices, answers } = createTrainingChoices(
    { pokemonTypes: pokemon.types, ruleGen, multiplier: 2 },
    { difficulty: difficulty === "easy" ? "easy" : difficulty === "hard" ? "hard" : "normal", answerMode: "classic" });
  if (!answers.length) return null;
  return {
    category: "weakness", title: "Welche Angriffstypen treffen " + pokemon.name + " sehr effektiv?",
    pokemon, options: choices.map((choice) => ({ key: choice.key, type: choice.types[0] })),
    correct: answers, maxAnswers: 2, explanation: "Schwächen: " + getGenerationTypes(ruleGen)
      .filter((type) => getTypeMultiplierForGeneration(type.key, pokemon.types, ruleGen) > 1)
      .map((type) => type.label + " (" + formatMultiplier(getTypeMultiplierForGeneration(type.key, pokemon.types, ruleGen)) + ")").join(", ") + ".",
  };
}

export function makeAbilityQuestion(entry, difficulty = "normal") {
  const name = pokedex["pokedex" + entry.id] || "Pokémon";
  const count = difficulty === "easy" ? 3 : difficulty === "hard" ? 5 : 4;
  const wrong = shuffleItems(ABILITIES.filter((ability) => ability.key !== entry.key)).slice(0, count-1);
  return {
    category: "ability", title: "Welche Fähigkeit kann " + name + " besitzen?",
    pokemon: { id: entry.id, name, image: pokemonArtwork(entry.id) },
    options: shuffleItems([{ key: entry.key, label: ABILITY_MAP[entry.key] }, ...wrong]),
    correct: [entry.key],
    explanation: name + " kann " + ABILITY_MAP[entry.key] + " besitzen. Eine mögliche Fähigkeit genügt.",
  };
}

export function makeScenarioQuestion(scenario) {
  return {
    category: "scenario", title: scenario.question,
    options: scenario.options.map((label, index) => ({ key: String(index), label })),
    correct: scenario.correct.map(String),
    maxAnswers: scenario.correct.length,
    explanation: scenario.explanation,
  };
}

export function examResult(correct, total) {
  const percent = Math.round((correct / Math.max(1,total)) * 100);
  if (percent >= 90) return { percent, rank: "Nuzlocke-Meister", passed: true };
  if (percent >= 75) return { percent, rank: "Nuzlocke-würdig", passed: true };
  if (percent >= 50) return { percent, rank: "Aufstrebender Trainer", passed: false };
  return { percent, rank: "Noch nicht bereit", passed: false };
}
