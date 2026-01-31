import editionData from "../data/editionData";

/**
 * Gibt den Pokédex für eine bestimmte Edition zurück.
 * @param {string} edition - Der Name der Edition.
 * @returns {object|null} - Der kombinierte Pokédex oder null.
 */
export function getPokedexFromEdition(edition) {
  return editionData[edition]?.pokedex || null;
}
