// Standard-Typentabelle ab Generation 6 (18 regulaere Typen).
// Quelle der Effektivitaeten: https://pokemondb.net/type
export const POKEMON_TYPES = [
  ["normal", "Normal", "#a8a878"],
  ["fire", "Feuer", "#f08030"],
  ["water", "Wasser", "#6890f0"],
  ["electric", "Elektro", "#e4bf37"],
  ["grass", "Pflanze", "#78c850"],
  ["ice", "Eis", "#98d8d8"],
  ["fighting", "Kampf", "#c03028"],
  ["poison", "Gift", "#a040a0"],
  ["ground", "Boden", "#d5ad54"],
  ["flying", "Flug", "#a890f0"],
  ["psychic", "Psycho", "#f85888"],
  ["bug", "Käfer", "#a8b820"],
  ["rock", "Gestein", "#b8a038"],
  ["ghost", "Geist", "#705898"],
  ["dragon", "Drache", "#7038f8"],
  ["dark", "Unlicht", "#705848"],
  ["steel", "Stahl", "#b8b8d0"],
  ["fairy", "Fee", "#ee99ac"],
].map(([key, label, color]) => ({ key, label, color }));

const EFFECTIVENESS = {
  normal: { strong: [], weak: ["rock", "steel"], immune: ["ghost"] },
  fire: { strong: ["grass", "ice", "bug", "steel"], weak: ["fire", "water", "rock", "dragon"], immune: [] },
  water: { strong: ["fire", "ground", "rock"], weak: ["water", "grass", "dragon"], immune: [] },
  electric: { strong: ["water", "flying"], weak: ["electric", "grass", "dragon"], immune: ["ground"] },
  grass: { strong: ["water", "ground", "rock"], weak: ["fire", "grass", "poison", "flying", "bug", "dragon", "steel"], immune: [] },
  ice: { strong: ["grass", "ground", "flying", "dragon"], weak: ["fire", "water", "ice", "steel"], immune: [] },
  fighting: { strong: ["normal", "ice", "rock", "dark", "steel"], weak: ["poison", "flying", "psychic", "bug", "fairy"], immune: ["ghost"] },
  poison: { strong: ["grass", "fairy"], weak: ["poison", "ground", "rock", "ghost"], immune: ["steel"] },
  ground: { strong: ["fire", "electric", "poison", "rock", "steel"], weak: ["grass", "bug"], immune: ["flying"] },
  flying: { strong: ["grass", "fighting", "bug"], weak: ["electric", "rock", "steel"], immune: [] },
  psychic: { strong: ["fighting", "poison"], weak: ["psychic", "steel"], immune: ["dark"] },
  bug: { strong: ["grass", "psychic", "dark"], weak: ["fire", "fighting", "poison", "flying", "ghost", "steel", "fairy"], immune: [] },
  rock: { strong: ["fire", "ice", "flying", "bug"], weak: ["fighting", "ground", "steel"], immune: [] },
  ghost: { strong: ["psychic", "ghost"], weak: ["dark"], immune: ["normal"] },
  dragon: { strong: ["dragon"], weak: ["steel"], immune: ["fairy"] },
  dark: { strong: ["psychic", "ghost"], weak: ["fighting", "dark", "fairy"], immune: [] },
  steel: { strong: ["ice", "rock", "fairy"], weak: ["fire", "water", "electric", "steel"], immune: [] },
  fairy: { strong: ["fighting", "dragon", "dark"], weak: ["fire", "poison", "steel"], immune: [] },
};

export const GEN_RANGES = {
  1: [1, 151], 2: [152, 251], 3: [252, 386],
  4: [387, 493], 5: [494, 649], 6: [650, 721],
  7: [722, 809], 8: [810, 905], 9: [906, 1025],
};


export const DAMAGE_OPTIONS = [
  { key: "4", label: "4× Schaden", multiplier: 4 },
  { key: "2", label: "2× Schaden", multiplier: 2 },
  { key: "1", label: "1× Schaden", multiplier: 1 },
  { key: "0.5", label: "½× Schaden", multiplier: 0.5 },
  { key: "0.25", label: "¼× Schaden", multiplier: 0.25 },
  { key: "0", label: "0× Schaden (immun)", multiplier: 0 },
];

export const TYPE_ICON_BASE = "https://raw.githubusercontent.com/partywhale/pokemon-type-icons/main/icons/";
export function getTypeIconUrl(key) {
  return TYPE_ICON_BASE + encodeURIComponent(key) + ".svg";
}
export function getTypeLabel(key) {
  return POKEMON_TYPES.find((type) => type.key === key)?.label || key;
}
export function getTypeColor(key) {
  return POKEMON_TYPES.find((type) => type.key === key)?.color || "#a3b4d4";
}
export function formatMultiplier(multiplier) {
  if (multiplier === 0.5) return "½×";
  if (multiplier === 0.25) return "¼×";
  return multiplier + "×";
}
export function getTypeMultiplier(attackingType, defendingTypes) {
  const types = Array.isArray(defendingTypes) ? defendingTypes : [defendingTypes];
  const data = EFFECTIVENESS[attackingType];
  if (!data) return 1;
  return types.reduce((total, defendingType) => {
    if (data.immune.includes(defendingType)) return 0;
    if (data.strong.includes(defendingType)) return total * 2;
    if (data.weak.includes(defendingType)) return total * 0.5;
    return total;
  }, 1);
}
export function shuffleItems(values) {
  const copy = [...values];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy;
}
const SINGLE_CHOICES = POKEMON_TYPES.map((type) => ({ key: type.key, types: [type.key] }));
const DUAL_CHOICES = POKEMON_TYPES.flatMap((type, index) =>
  POKEMON_TYPES.slice(index + 1).map((other) => ({
    key: type.key + "/" + other.key,
    types: [type.key, other.key],
  }))
);
export function getDefendingChoices(targetKind) {
  return targetKind === "dual" ? DUAL_CHOICES : SINGLE_CHOICES;
}
export function choiceMatchesQuestion(question, choice) {
  const multiplier = question.direction === "attack"
    ? getTypeMultiplier(question.attackType, choice.types)
    : getTypeMultiplier(choice.types[0], question.defendingTypes);
  return multiplier === question.multiplier;
}
export function getQuestionChoices(question) {
  const all = question.direction === "attack"
    ? getDefendingChoices(question.targetKind)
    : SINGLE_CHOICES;
  if (question.direction === "attack" && question.targetKind === "dual") {
    // Show a manageable mix of true answers and distractors, rather than 153 buttons.
    const matches = shuffleItems(all.filter((choice) => choiceMatchesQuestion(question, choice)));
    const others = shuffleItems(all.filter((choice) => !choiceMatchesQuestion(question, choice)));
    const correct = matches.slice(0, 6);
    return shuffleItems([...correct, ...others.slice(0, 18 - correct.length)]);
  }
  return all;
}
export function buildTypeQuestionDeck(directionSetting, multiplierSetting, targetSetting) {
  const directions = directionSetting === "mixed" ? ["attack", "defend"] : [directionSetting];
  const multipliers = multiplierSetting === "mixed"
    ? DAMAGE_OPTIONS.map((item) => item.multiplier)
    : [Number(multiplierSetting)];
  const targetKinds = targetSetting === "mixed" ? ["single", "dual"] : [targetSetting];
  const deck = [];

  for (const direction of directions) {
    for (const targetKind of targetKinds) {
      const defenseChoices = getDefendingChoices(targetKind);
      if (direction === "attack") {
        for (const attackType of POKEMON_TYPES.map((type) => type.key)) {
          for (const multiplier of multipliers) {
            const q = { direction, targetKind, attackType, multiplier };
            if (defenseChoices.some((choice) => choiceMatchesQuestion(q, choice))) deck.push(q);
          }
        }
      } else {
        for (const defendingChoice of defenseChoices) {
          for (const multiplier of multipliers) {
            const q = {
              direction, targetKind, defendingTypes: defendingChoice.types, multiplier,
            };
            if (SINGLE_CHOICES.some((choice) => choiceMatchesQuestion(q, choice))) deck.push(q);
          }
        }
      }
    }
  }
  return shuffleItems(deck);
}
export function buildPokemonIdDeck(generations) {
  const ids = [];
  generations.forEach((gen) => {
    const range = GEN_RANGES[gen];
    if (!range) return;
    for (let id = range[0]; id <= range[1]; id += 1) ids.push(id);
  });
  return shuffleItems(ids);
}


// Generation-aware effectiveness (Gen 1, Gen 2–5, Gen 6+).
export function getGenerationTypes(gen) {
  return POKEMON_TYPES.filter((type) =>
    Number(gen) >= 6 || (Number(gen) >= 2
      ? type.key !== "fairy"
      : !["fairy", "dark", "steel"].includes(type.key)));
}

export function getTypeMultiplierForGeneration(attackingType, defendingTypes, generation = 9) {
  const gen = Math.max(1, Math.min(9, Number(generation) || 9));
  const types = Array.isArray(defendingTypes) ? defendingTypes : [defendingTypes];
  const valid = new Set(getGenerationTypes(gen).map((type) => type.key));
  if (!valid.has(attackingType) || types.some((t) => !valid.has(t))) return null;
  return types.reduce((multiplier, defendingType) => {
    let value = getTypeMultiplier(attackingType, defendingType);
    if (gen <= 5 && defendingType === "steel" && ["dark", "ghost"].includes(attackingType)) value = 0.5;
    if (gen === 1) {
      if (attackingType === "bug" && defendingType === "poison") value = 2;
      if (attackingType === "poison" && defendingType === "bug") value = 2;
      if (attackingType === "ghost" && defendingType === "psychic") value = 0;
      if (attackingType === "ice" && defendingType === "fire") value = 1;
    }
    return multiplier * value;
  }, 1);
}

const ROMAN_GEN = { i: 1, ii: 2, iii: 3, iv: 4, v: 5, vi: 6, vii: 7, viii: 8, ix: 9 };
export function getPokemonTypesForGeneration(pokemonData, generation = 9) {
  const gen = Math.max(1, Math.min(9, Number(generation) || 9));
  const versions = (pokemonData?.past_types || [])
    .map((entry) => ({
      gen: ROMAN_GEN[String(entry?.generation?.name || "").replace("generation-", "")] || 0,
      types: entry.types,
    }))
    .filter((entry) => entry.gen >= gen && Array.isArray(entry.types) && entry.types.length)
    .sort((a, b) => a.gen - b.gen);
  const source = versions[0]?.types || pokemonData?.types || [];
  return [...source].sort((a, b) => a.slot - b.slot)
    .map((item) => item.type?.name)
    .filter((name) => getGenerationTypes(gen).some((item) => item.key === name));
}

function defenseChoices(ruleGen, count) {
  const types = getGenerationTypes(ruleGen);
  if (count === "single") return types.map((t) => ({ key: t.key, types: [t.key] }));
  return types.flatMap((left, i) => types.slice(i + 1).map((right) => ({
    key: left.key + "/" + right.key, types: [left.key, right.key],
  })));
}

export function createTrainingDeck({ direction = "mixed", targetKind = "mixed", multiplier = "mixed", ruleGen = 9 } = {}) {
  const directions = direction === "mixed" ? ["attack", "defend"] : [direction];
  const kinds = targetKind === "mixed" ? ["single", "dual"] : [targetKind];
  const damages = multiplier === "mixed"
    ? [0, .25, .5, 1, 2, 4]
    : [Number(multiplier)];
  const attackers = getGenerationTypes(ruleGen).map((type) => type.key);
  const deck = [];
  directions.forEach((dir) => kinds.forEach((kind) => {
    const defenses = defenseChoices(ruleGen, kind);
    if (dir === "attack") {
      attackers.forEach((attackType) => damages.forEach((damage) => {
        if (defenses.some((option) => getTypeMultiplierForGeneration(attackType, option.types, ruleGen) === damage)) {
          deck.push({ direction: dir, attackType, targetKind: kind, multiplier: damage, ruleGen });
        }
      }));
    } else {
      defenses.forEach((defense) => damages.forEach((damage) => {
        if (attackers.some((attackType) => getTypeMultiplierForGeneration(attackType, defense.types, ruleGen) === damage)) {
          deck.push({ direction: dir, defendingTypes: defense.types, targetKind: kind, multiplier: damage, ruleGen });
        }
      }));
    }
  }));
  return shuffleItems(deck);
}

export function createTrainingChoices(question, { answerMode = "classic", difficulty = "normal" } = {}) {
  const ruleGen = question.ruleGen || 9;
  const candidates = question.pokemonTypes
    ? defenseChoices(ruleGen, "single")
    : question.direction === "attack"
      ? defenseChoices(ruleGen, question.targetKind)
      : defenseChoices(ruleGen, "single");
  const effect = (candidate) => question.pokemonTypes
    ? getTypeMultiplierForGeneration(candidate.types[0], question.pokemonTypes, ruleGen)
    : question.direction === "attack"
      ? getTypeMultiplierForGeneration(question.attackType, candidate.types, ruleGen)
      : getTypeMultiplierForGeneration(candidate.types[0], question.defendingTypes, ruleGen);
  const isRight = (option) => question.pokemonTypes
    ? effect(option) >= 2
    : effect(option) === question.multiplier;
  const good = shuffleItems(candidates.filter(isRight));
  const wrong = shuffleItems(candidates.filter((item) => !isRight(item)));
  if (!good.length) return { choices: [], answers: [] };
  const count = difficulty === "easy" ? 6 : difficulty === "hard" ? 12 : 9;
  let rightCount = answerMode === "all"
    ? Math.min(good.length, difficulty === "hard" ? 8 : difficulty === "normal" ? 6 : 4)
    : answerMode === "one" ? 1 : answerMode === "two" ? 2 : (difficulty === "easy" ? 1 : Math.random() < .5 ? 1 : 2);
  rightCount = Math.max(1, Math.min(rightCount, good.length, count - 2));
  if (answerMode === "all" && question.direction === "defend" && !question.pokemonTypes) {
    // If all single-type choices are shown, they should all be judged.
    rightCount = Math.min(good.length, count - 2);
  }
  const chosenRight = good.slice(0, rightCount);
  let chosenWrong;
  const wrongCount = Math.min(wrong.length, count - rightCount);
  if (difficulty === "easy") {
    chosenWrong = wrong.slice(0, wrongCount);
  } else {
    // Prefer plausible near-misses, e.g. 2x candidates in a 4x question.
    const target = question.pokemonTypes ? 2 : question.multiplier;
    const closeness = (value) => {
      if (value === 0) return target === 0 ? 0 : 5;
      if (target === 0) return 4;
      return Math.abs(Math.log2(value) - Math.log2(target));
    };
    const sorted = [...wrong].sort((a, b) => closeness(effect(a)) - closeness(effect(b)));
    const trickyCount = difficulty === "hard" ? Math.ceil(wrongCount * .85) : Math.ceil(wrongCount * .55);
    chosenWrong = sorted.slice(0, trickyCount);
    chosenWrong.push(...wrong.filter((candidate) => !chosenWrong.includes(candidate)).slice(0, wrongCount - chosenWrong.length));
  }
  const choices = shuffleItems([...chosenRight, ...chosenWrong]);
  return { choices, answers: chosenRight.map((choice) => choice.key) };
}
