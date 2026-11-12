import { getPokemonTypesForGeneration } from "./typeTrainerData";
const CACHE_PREFIX = "ponuz-trainer-pokemon-species-v3-";
async function readJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error("Pokémon konnte nicht geladen werden.");
  return response.json();
}
async function fetchPokemonBase(id) {
  const cacheKey = CACHE_PREFIX + id;
  try {
    const cached = JSON.parse(localStorage.getItem(cacheKey));
    if (cached?.name && cached?.types && Array.isArray(cached?.pastTypes) && cached?.stats) return cached;
  } catch { /* optional cache */ }
  const base = "https://pokeapi.co/api/v2";
  const [pokemon, species] = await Promise.all([
    readJson(base + "/pokemon/" + id),
    readJson(base + "/pokemon-species/" + id),
  ]);
  const name = species.names?.find((entry) => entry.language?.name === "de")?.name
    || species.names?.find((entry) => entry.language?.name === "en")?.name
    || pokemon.name;
  const data = {
    id, name,
    types: pokemon.types || [],
    pastTypes: pokemon.past_types || [],
    stats: Object.fromEntries((pokemon.stats || []).map((stat) => [stat.stat.name, stat.base_stat])),
    image: pokemon.sprites?.other?.["official-artwork"]?.front_default
      || pokemon.sprites?.front_default
      || "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/" + id + ".png",
  };
  try { localStorage.setItem(cacheKey, JSON.stringify(data)); } catch { /* optional */ }
  return data;
}
export async function loadTrainerPokemon(id, ruleGen = 9) {
  const data = await fetchPokemonBase(id);
  return {
    id: data.id, name: data.name, image: data.image, stats: data.stats || {},
    types: getPokemonTypesForGeneration({
      types: data.types, past_types: data.pastTypes,
    }, ruleGen),
  };
}
