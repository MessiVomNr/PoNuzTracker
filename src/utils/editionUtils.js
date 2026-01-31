import editionData from "../data/editionData";

export function getGenFromEdition(edition) {
  return editionData[edition]?.gen ?? null;
}

export function getPokedexFromEdition(edition) {
  return editionData[edition]?.pokedex ?? null;
}

export function getLocationsFromEdition(edition) {
  return editionData[edition]?.locations ?? null;
}

export function getGuideFromEdition(edition) {
  return editionData[edition]?.guide ?? null;
}

export function getVmsFromEdition(edition) {
  return editionData[edition]?.vms ?? null;
}
