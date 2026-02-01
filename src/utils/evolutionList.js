// src/utils/evolutionLine.js
// Holt die komplette Evolutionsreihe für ein Pokemon (über PokeAPI) und cached im Speicher.
// Rückgabe: [{ dexId: number, name: string }, ...]

const memCache = new Map(); // key: dexId -> line array

function extractChainNames(chainNode, out) {
  if (!chainNode) return;
  out.push(chainNode.species?.name);
  const next = chainNode.evolves_to || [];
  for (const n of next) extractChainNames(n, out);
}

async function nameToDexId(name) {
  // pokemon endpoint enthält "id"
  const res = await fetch(`https://pokeapi.co/api/v2/pokemon/${name}`);
  if (!res.ok) throw new Error(`pokemon fetch failed for ${name}`);
  const data = await res.json();
  return data.id;
}

export async function getEvolutionLineByDexId(dexId) {
  const key = Number(dexId);
  if (!key || Number.isNaN(key)) return [];

  if (memCache.has(key)) return memCache.get(key);

  // 1) Species holen -> evolution_chain.url
  const sRes = await fetch(`https://pokeapi.co/api/v2/pokemon-species/${key}`);
  if (!sRes.ok) {
    memCache.set(key, []);
    return [];
  }
  const species = await sRes.json();
  const evoUrl = species?.evolution_chain?.url;
  if (!evoUrl) {
    memCache.set(key, []);
    return [];
  }

  // 2) Chain holen -> Namen extrahieren
  const eRes = await fetch(evoUrl);
  if (!eRes.ok) {
    memCache.set(key, []);
    return [];
  }
  const evoData = await eRes.json();

  const names = [];
  extractChainNames(evoData?.chain, names);

  // 3) Namen -> dexId
  const line = [];
  for (const n of names) {
    if (!n) continue;
    try {
      const id = await nameToDexId(n);
      line.push({ dexId: id, name: n });
    } catch {
      // ignoriere einzelne fails
    }
  }

  // Fallback: wenn nix kam, wenigstens current
  const finalLine = line.length ? line : [{ dexId: key, name: species?.name || String(key) }];

  // Cache für alle Mitglieder der Line (damit spätere calls schnell sind)
  for (const entry of finalLine) memCache.set(entry.dexId, finalLine);

  return finalLine;
}

export async function getBaseFormDexId(dexId) {
  const line = await getEvolutionLineByDexId(dexId);
  return line?.[0]?.dexId ? Number(line[0].dexId) : Number(dexId);
}
