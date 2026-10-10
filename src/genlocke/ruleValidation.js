import { dexIdFor } from "./core";

const asSet = (numbers) => new Set(numbers);
export const MYTHICAL = asSet([
  151,251,385,386,489,490,491,492,493,494,647,648,649,719,720,721,
  801,802,807,808,809,893,1025
]);
export const ULTRA_BEAST = asSet([793,794,795,796,797,798,799,803,804,805,806]);
export const PARADOX = asSet([
  984,985,986,987,988,989,990,991,992,993,994,995,
  1005,1006,1009,1010,1020,1021,1022,1023
]);
export const PSEUDO_LEGENDARY = asSet([
  149,248,376,373,445,635,706,784,887,998
]);
export const LEGENDARY = asSet([
  144,145,146,150,243,244,245,249,250,377,378,379,380,381,382,383,384,386,
  480,481,482,483,484,485,486,487,488,641,642,643,644,645,646,
  716,717,718,772,773,785,786,787,788,789,790,791,792,800,
  888,889,890,891,892,894,895,896,897,898,905,1001,1002,1003,1004,
  1007,1008,1014,1015,1016,1017,1024
].filter(id => !MYTHICAL.has(id)));

export function categoryForDex(dexId) {
  const id = Number(dexId);
  if (MYTHICAL.has(id)) return "mythical";
  if (ULTRA_BEAST.has(id) || PARADOX.has(id)) return "ultra";
  if (LEGENDARY.has(id)) return "legendary";
  if (PSEUDO_LEGENDARY.has(id)) return "pseudo";
  return "ordinary";
}

const primaryCache = new Map();
export async function lookupPrimaryType(dexId) {
  const id = Number(dexId);
  if (primaryCache.has(id)) return primaryCache.get(id);
  const response = await fetch("https://pokeapi.co/api/v2/pokemon/" + id);
  if (!response.ok) throw new Error("Typen-Abfrage fehlgeschlagen (" + id + ")");
  const result = await response.json();
  const primary = result.types?.find(x => x.slot === 1)?.type?.name;
  if (!primary) throw new Error("Kein Primärtyp gefunden: " + id);
  primaryCache.set(id, primary);
  return primary;
}

// Validation only checks active, non-empty team slots. It never changes a team.
export async function validateTeamRules(teams, edition, rules, getPrimary = lookupPrimaryType) {
  if (!rules) return [];
  const errors = [];
  const entries = teams.flatMap((team, player) => (team || [])
    .map((pokemon, slot) => ({pokemon, player, slot}))
    .filter(x => !!x.pokemon)
    .map(x => ({...x, dexId:dexIdFor(x.pokemon, edition)})));
  const groups = entries.reduce((acc, mon) => {
    const group = categoryForDex(mon.dexId);
    if (!acc[group]) acc[group] = [];
    acc[group].push(mon);
    return acc;
  }, {});

  const limited = [
    {key:"legendary", label:"Legendäre", limit:rules.legendLimit ?? 6,
      members:[...(groups.legendary || []),
        ...(rules.mythicalShared ? (groups.mythical || []) : []),
        ...(rules.ultraShared ? (groups.ultra || []) : [])]},
    {key:"mythical", label:"Mysteriöse", limit:rules.mythicalLimit ?? 6,
      members:rules.mythicalShared ? [] : (groups.mythical || [])},
    {key:"ultra", label:"Ultrabestien/Paradox", limit:rules.ultraLimit ?? 6,
      members:rules.ultraShared ? [] : (groups.ultra || [])},
    {key:"pseudo", label:"Pseudo-Legendäre", limit:rules.pseudoLimit ?? 6,
      members:groups.pseudo || []}
  ];
  for(const rule of limited) {
    for(let player=0;player<teams.length;player++) {
      const count=rule.members.filter(mon=>mon.player===player).length;
      if(count>rule.limit) errors.push(rule.label + ": Spieler " + (player+1) +
        " hat " + count + " im Team (Limit " + rule.limit + ").");
    }
  }
  if (!rules.ownPrimaryTypeUnique && !rules.crossPrimaryTypeUnique && !rules.linkPairPrimaryTypeUnique) return errors;
  const typed=[];
  for(const mon of entries) {
    if(!mon.dexId) {
      errors.push("Primärtyp nicht prüfbar für " + mon.pokemon + ". Bitte Pokédex-Eintrag kontrollieren.");
      continue;
    }
    try { typed.push({...mon, type:await getPrimary(mon.dexId)}); }
    catch(e) { errors.push(mon.pokemon + ": Primärtyp konnte nicht geladen werden (" + e.message + ")."); }
  }
  if(rules.ownPrimaryTypeUnique) {
    const known = new Set();
    typed.forEach(mon => {
      const key=mon.player + ":" + mon.type;
      if(known.has(key)) errors.push("Doppelter Primärtyp " + mon.type + " im Team " + (mon.player+1) + ".");
      known.add(key);
    });
  }
  if(rules.crossPrimaryTypeUnique && teams.length>1) {
    const known=new Set();
    typed.forEach(mon => {
      if(known.has(mon.type)) errors.push("Primärtyp " + mon.type + " mehrfach über beide Teams.");
      known.add(mon.type);
    });
  }
  if(rules.linkPairPrimaryTypeUnique && teams.length>1) {
    const left=typed.filter(x=>x.player===0);
    const right=typed.filter(x=>x.player===1);
    left.forEach(mon=>{
      const counterpart=right.find(x=>x.slot===mon.slot);
      if(counterpart && counterpart.type===mon.type)
        errors.push("Soul-Paar in Slot " + (mon.slot+1) + " hat denselben Primärtyp (" + mon.type + ").");
    });
  }
  return [...new Set(errors)];
}
