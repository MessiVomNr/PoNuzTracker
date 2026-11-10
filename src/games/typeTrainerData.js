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

export const RELATION_OPTIONS = [
  { key: "strong", label: "Sehr effektiv", multiplier: 2 },
  { key: "weak", label: "Nicht sehr effektiv", multiplier: 0.5 },
  { key: "immune", label: "Immunität", multiplier: 0 },
];

export function getTypeLabel(key) {
  return POKEMON_TYPES.find((type) => type.key === key)?.label || key;
}

export function getTypeColor(key) {
  return POKEMON_TYPES.find((type) => type.key === key)?.color || "#a3b4d4";
}

export function getTypeMultiplier(attackingType, defendingTypes) {
  const targets = Array.isArray(defendingTypes) ? defendingTypes : [defendingTypes];
  const data = EFFECTIVENESS[attackingType];
  if (!data) return 1;
  return targets.reduce((multiplier, target) => {
    if (data.immune.includes(target)) return 0;
    if (data.strong.includes(target)) return multiplier * 2;
    if (data.weak.includes(target)) return multiplier * 0.5;
    return multiplier;
  }, 1);
}

// "defender": Welche Angriffs-Typen treffen den angezeigten Typ?
// "attacker": Welche Verteidigungs-Typen trifft der angezeigte Typ?
export function getMatchingTypes(question) {
  const { direction, type, relation } = question;
  const wanted = RELATION_OPTIONS.find((item) => item.key === relation)?.multiplier;
  if (wanted === undefined) return [];
  return POKEMON_TYPES.filter((candidate) => {
    const multiplier = direction === "defender"
      ? getTypeMultiplier(candidate.key, type)
      : getTypeMultiplier(type, candidate.key);
    return multiplier === wanted;
  }).map((candidate) => candidate.key);
}

export function shuffleItems(values) {
  const copy = [...values];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy;
}

export function buildTypeQuestionDeck(directionSetting, relationSetting) {
  const directions = directionSetting === "mixed" ? ["defender", "attacker"] : [directionSetting];
  const relations = relationSetting === "mixed"
    ? RELATION_OPTIONS.map((item) => item.key)
    : [relationSetting];
  const questions = [];
  directions.forEach((direction) => relations.forEach((relation) => {
    POKEMON_TYPES.forEach(({ key }) => {
      const question = { direction, relation, type: key };
      // Keine Aufgaben mit null korrekten Antworten.
      if (getMatchingTypes(question).length) questions.push(question);
    });
  }));
  return shuffleItems(questions);
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
