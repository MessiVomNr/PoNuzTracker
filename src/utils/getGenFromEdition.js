import editionData from "../data/editionData";

/**
 * Gibt die Generation für eine bestimmte Edition zurück.
 * @param {string} edition - Der Name der Edition (z. B. "Rot", "Sonne").
 * @returns {number|null} - Die entsprechende Generation oder null, falls nicht gefunden.
 */
export function getGenFromEdition(edition) {
  return editionData[edition]?.gen ?? null;
}
