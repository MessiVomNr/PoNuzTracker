import editionData from "../data/editionData";

export function getGenFromEdition(edition) {
  return editionData[edition]?.gen || 1;
}

export function getPokedexFromEdition(edition) {
  return editionData[edition]?.pokedex || {};
}

export function getLocationListFromEdition(edition) {
  return editionData[edition]?.locations || [];
}

export function getGuideFromEdition(edition) {
  return editionData[edition]?.guide || [];
}

export function getVmsFromEdition(edition) {
  return editionData[edition]?.vms || {};
}
