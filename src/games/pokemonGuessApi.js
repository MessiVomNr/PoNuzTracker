// src/games/pokemonGuessApi.js

const API_BASE = "https://pokeapi.co/api/v2";
const CACHE_VERSION = "v1";

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
  const match = String(apiName || "").match(/generation-(\d+)/);
  return match ? Number(match[1]) : 0;
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

function pickMoveResources(pokemonMoves) {
  const levelUpMoves = [];

  for (const moveEntry of pokemonMoves || []) {
    const levelDetails = (moveEntry.version_group_details || []).filter(
      (detail) => detail.move_learn_method?.name === "level-up"
    );

    if (levelDetails.length === 0) continue;

    const highestLevel = Math.max(
      ...levelDetails.map((detail) => Number(detail.level_learned_at || 0))
    );

    levelUpMoves.push({
      move: moveEntry.move,
      level: highestLevel,
    });
  }

  const sorted = levelUpMoves
    .sort((a, b) => a.level - b.level)
    .filter((entry, index, array) => {
      return array.findIndex((other) => other.move.name === entry.move.name) === index;
    });

  if (sorted.length <= 4) {
    return sorted.map((entry) => entry.move);
  }

  const pickedIndexes = [
    Math.floor(sorted.length * 0.2),
    Math.floor(sorted.length * 0.45),
    Math.floor(sorted.length * 0.7),
    sorted.length - 1,
  ];

  return [...new Set(pickedIndexes)].map((index) => sorted[index].move).slice(0, 4);
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
    };
  }

  const pokemon = await fetchJson(`${API_BASE}/pokemon/${basePokemon.apiName}`);

  const firstAbility =
    pokemon.abilities?.find((entry) => !entry.is_hidden)?.ability ||
    pokemon.abilities?.[0]?.ability;

  const ability = firstAbility
    ? await getNamedResourceGermanName(firstAbility, makePrettyApiName(firstAbility.name))
    : "";

  const moveResources = pickMoveResources(pokemon.moves);

  const moves = await mapWithLimit(moveResources, 4, async (move) => {
    return getNamedResourceGermanName(move, makePrettyApiName(move.name));
  });

  const imageUrl =
    pokemon.sprites?.other?.["official-artwork"]?.front_default ||
    pokemon.sprites?.front_default ||
    basePokemon.imageUrl;

  const details = {
    imageUrl,
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