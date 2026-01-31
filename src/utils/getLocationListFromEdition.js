import editionData from "../data/editionData";

/**
 * Gibt das Location-Modul für eine bestimmte Edition zurück.
 * @param {string} edition - Der Name der Edition.
 * @returns {object|null} - Die importierte Location-Liste oder null.
 */
export function getLocationListFromEdition(edition) {
  return editionData[edition]?.locations || null;
}
