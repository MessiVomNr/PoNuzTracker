// src/utils/pokemonPool.js
export const GEN_DEX_CAP = {
  1: 151,
  2: 251,
  3: 386,
  4: 493,
  5: 649,
  6: 721,
  7: 809,
};

export function getDexCapForGen(gen) {
  return GEN_DEX_CAP[gen] ?? 151;
}

export function makeShuffledPool(gen, { excludeDexIds = [] } = {}) {
  const cap = getDexCapForGen(gen);
  const exclude = new Set(excludeDexIds);

  const arr = [];
  for (let i = 1; i <= cap; i++) {
    if (!exclude.has(i)) arr.push(i);
  }

  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function dexIdToImageUrl(dexId) {
  return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${dexId}.png`;
}
