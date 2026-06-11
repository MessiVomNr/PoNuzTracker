// src/games/pokemonGuessApi.js

const API_BASE = "https://pokeapi.co/api/v2";
const CACHE_VERSION = "v2";

const TYPE_DE = {
  normal: "Normal",
  fire: "Feuer",
  water: "Wasser",
  electric: "Elektro",
  grass: "Pflanze",
  ice: "Eis",
  fighting: "Kampf",
  poison: "Gift",
  ground: "Boden",
  flying: "Flug",
  psychic: "Psycho",
  bug: "Käfer",
  rock: "Gestein",
  ghost: "Geist",
  dragon: "Drache",
  dark: "Unlicht",
  steel: "Stahl",
  fairy: "Fee",
};

const STAT_KEY_MAP = {
  hp: "kp",
  attack: "atk",
  defense: "def",
  "special-attack": "spAtk",
  "special-defense": "spDef",
  speed: "init",
};

const GENERATION_ROMAN_TO_NUMBER = {
  "generation-i": 1,
  "generation-ii": 2,
  "generation-iii": 3,
  "generation-iv": 4,
  "generation-v": 5,
  "generation-vi": 6,
  "generation-vii": 7,
  "generation-viii": 8,
  "generation-ix": 9,
};

function getCacheKey(name) {
  return `pokemonGuess:${CACHE_VERSION}:${name}`;
}

function readCache(name) {
  try {
    const raw = localStorage.getItem(getCacheKey(name));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeCache(name, value) {
  try {
    localStorage.setItem(getCacheKey(name), JSON.stringify(value));
  } catch {
    // Cache ist nur Komfort. Wenn localStorage voll/blockiert ist, läuft es trotzdem.
  }
}

async function fetchJson(url) {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`PokeAPI request failed: ${response.status}`);
  }

  return response.json();
}

async function mapWithLimit(items, limit, mapper) {
  const results = [];
  let index = 0;

  async function worker() {
    while (index < items.length) {
      const currentIndex = index;
      index += 1;
      results[currentIndex] = await mapper(items[currentIndex], currentIndex);
    }
  }

  const workers = Array.from({ length: Math.min(limit, items.length) }, worker);
  await Promise.all(workers);

  return results;
}

function getIdFromUrl(url) {
  const match = String(url || "").match(/\/(\d+)\/?$/);
  return match ? Number(match[1]) : 0;
}

function getGenNumberFromApiName(apiName) {
  const cleanName = String(apiName || "").toLowerCase();

  if (GENERATION_ROMAN_TO_NUMBER[cleanName]) {
    return GENERATION_ROMAN_TO_NUMBER[cleanName];
  }

  const digitMatch = cleanName.match(/generation-(\d+)/);
  return digitMatch ? Number(digitMatch[1]) : 0;
}

function getLocalizedName(names, language, fallback) {
  const entry = (names || []).find((item) => item.language?.name === language);
  return entry?.name || fallback;
}

function getLocalizedGenus(genera, language, fallback) {
  const entry = (genera || []).find((item) => item.language?.name === language);
  return entry?.genus || fallback;
}

function makePrettyApiName(apiName) {
  return String(apiName || "")
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function uniqueById(items) {
  const map = new Map();

  for (const item of items) {
    const id = getIdFromUrl(item.url);
    if (!map.has(id)) {
      map.set(id, item);
    }
  }

  return [...map.entries()]
    .sort(([a], [b]) => a - b)
    .map(([, item]) => item);
}

function buildStats(stats) {
  const result = {
    kp: 0,
    atk: 0,
    def: 0,
    spAtk: 0,
    spDef: 0,
    init: 0,
  };

  for (const stat of stats || []) {
    const key = STAT_KEY_MAP[stat.stat?.name];
    if (key) {
      result[key] = stat.base_stat;
    }
  }

  return result;
}

async function getNamedResourceGermanName(resource, fallback) {
  if (!resource?.url) return fallback;

  const cacheName = `resource:${resource.url}`;
  const cached = readCache(cacheName);

  if (cached) {
    return cached;
  }

  const data = await fetchJson(resource.url);
  const germanName = getLocalizedName(data.names, "de", fallback || data.name);

  writeCache(cacheName, germanName);

  return germanName;
}

function getMoveVersionGroupGeneration(versionGroupName) {
  const name = String(versionGroupName || "").toLowerCase();

  if (
    name.includes("red-blue") ||
    name.includes("yellow")
  ) {
    return 1;
  }

  if (
    name.includes("gold-silver") ||
    name.includes("crystal")
  ) {
    return 2;
  }

  if (
    name.includes("ruby-sapphire") ||
    name.includes("emerald") ||
    name.includes("firered-leafgreen")
  ) {
    return 3;
  }

  if (
    name.includes("diamond-pearl") ||
    name.includes("platinum") ||
    name.includes("heartgold-soulsilver")
  ) {
    return 4;
  }

  if (
    name.includes("black-white") ||
    name.includes("black-2-white-2")
  ) {
    return 5;
  }

  if (
    name.includes("x-y") ||
    name.includes("omega-ruby-alpha-sapphire")
  ) {
    return 6;
  }

  if (
    name.includes("sun-moon") ||
    name.includes("ultra-sun-ultra-moon") ||
    name.includes("lets-go")
  ) {
    return 7;
  }

  if (
    name.includes("sword-shield") ||
    name.includes("brilliant-diamond-and-shining-pearl") ||
    name.includes("legends-arceus")
  ) {
    return 8;
  }

  if (
    name.includes("scarlet-violet")
  ) {
    return 9;
  }

  return 0;
}

function pickMoveResources(pokemonMoves, pokemonGen) {
  const levelUpMoves = [];
  const targetGen = Math.max(1, Math.min(9, Number(pokemonGen) || 1));

  for (const moveEntry of pokemonMoves || []) {
    const levelDetails = (moveEntry.version_group_details || []).filter((detail) => {
      if (detail.move_learn_method?.name !== "level-up") return false;

      const versionGroupUrl = detail.version_group?.url || "";
      const versionGroupId = getIdFromUrl(versionGroupUrl);

      return versionGroupId > 0;
    });

    if (levelDetails.length === 0) continue;

    const matchingGenDetails = levelDetails.filter((detail) => {
      const versionGroupName = detail.version_group?.name || "";
      const gen = getMoveVersionGroupGeneration(versionGroupName);
      return gen === targetGen;
    });

    const usableDetails = matchingGenDetails.length > 0 ? matchingGenDetails : levelDetails;

    const lowestLevel = Math.min(
      ...usableDetails.map((detail) => Number(detail.level_learned_at || 0))
    );

    levelUpMoves.push({
      move: moveEntry.move,
      level: lowestLevel,
    });
  }

  const sorted = levelUpMoves
    .sort((a, b) => a.level - b.level)
    .filter((entry, index, array) => {
      return array.findIndex((other) => other.move.name === entry.move.name) === index;
    });

  const levelFiveMoves = sorted.filter((entry) => entry.level <= 5).slice(0, 4);

  if (levelFiveMoves.length > 0) {
    return levelFiveMoves.map((entry) => entry.move);
  }

  return sorted.slice(0, 4).map((entry) => entry.move);
}

export async function loadPokemonGuessPool(selectedGens) {
  const cleanGens = [...new Set(selectedGens)]
    .map(Number)
    .filter((gen) => gen >= 1 && gen <= 9)
    .sort((a, b) => a - b);

  const cacheName = `pool:${cleanGens.join("-")}`;
  const cached = readCache(cacheName);

  if (cached?.length) {
    return cached;
  }

  const generationData = await Promise.all(
    cleanGens.map((gen) => fetchJson(`${API_BASE}/generation/${gen}/`))
  );

  const speciesRefs = uniqueById(
    generationData.flatMap((generation) => generation.pokemon_species || [])
  );

  const speciesList = await mapWithLimit(speciesRefs, 12, async (ref) => {
    const species = await fetchJson(ref.url);

    const defaultVariety =
      species.varieties?.find((item) => item.is_default)?.pokemon ||
      species.varieties?.[0]?.pokemon;

    const englishName = getLocalizedName(species.names, "en", species.name);
    const germanName = getLocalizedName(species.names, "de", englishName);
    const germanCategory = getLocalizedGenus(species.genera, "de", "");

    return {
      dexId: species.id,
      apiName: defaultVariety?.name || species.name,
      speciesApiName: species.name,
      name: germanName,
      aliases: [englishName, species.name, defaultVariety?.name].filter(Boolean),
      gen: getGenNumberFromApiName(species.generation?.name),
      category: germanCategory,
      imageUrl: `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${species.id}.png`,
    };
  });

  const cleanSpeciesList = speciesList
    .filter((pokemon) => pokemon.dexId && pokemon.name)
    .sort((a, b) => a.dexId - b.dexId);

  writeCache(cacheName, cleanSpeciesList);

  return cleanSpeciesList;
}

export async function loadPokemonGuessDetails(basePokemon) {
  if (!basePokemon?.dexId) {
    throw new Error("No Pokemon selected.");
  }

  const cacheName = `detail:${basePokemon.dexId}:${basePokemon.apiName}`;
  const cached = readCache(cacheName);

  if (cached) {
    return {
      ...basePokemon,
      ...cached,
      gen: basePokemon.gen || cached.gen || 0,
    };
  }

  const pokemon = await fetchJson(`${API_BASE}/pokemon/${basePokemon.apiName}`);

  const firstAbility =
    pokemon.abilities?.find((entry) => !entry.is_hidden)?.ability ||
    pokemon.abilities?.[0]?.ability;

  const ability = firstAbility
    ? await getNamedResourceGermanName(firstAbility, makePrettyApiName(firstAbility.name))
    : "";

  const moveResources = pickMoveResources(pokemon.moves, basePokemon.gen);

  const moves = await mapWithLimit(moveResources, 4, async (move) => {
    return getNamedResourceGermanName(move, makePrettyApiName(move.name));
  });

  const imageUrl =
    pokemon.sprites?.other?.["official-artwork"]?.front_default ||
    pokemon.sprites?.front_default ||
    basePokemon.imageUrl;

  const details = {
    imageUrl,
    gen: basePokemon.gen,
    types: (pokemon.types || [])
      .sort((a, b) => a.slot - b.slot)
      .map((entry) => TYPE_DE[entry.type?.name] || makePrettyApiName(entry.type?.name)),
    stats: buildStats(pokemon.stats),
    ability,
    moves,
  };

  writeCache(cacheName, details);

  return {
    ...basePokemon,
    ...details,
  };
}
