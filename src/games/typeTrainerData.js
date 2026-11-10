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
