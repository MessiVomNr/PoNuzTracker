import { evolutionFamiliesByDex } from "../data/evolutionFamilies";
import { versionToPokedex } from "../data/versionToPokedex";

export const CLASSIC_EDITIONS = ["Feuerrot", "Smaragd", "HeartGold", "Platin", "Schwarz 2", "X", "Ultrasonne"];
export const GENLOCKE_PRESETS_KEY = "genlocke-rule-presets-v1";
export const WHEEL_RESULTS = [
  { id: "death", label: "Tod", weight: 5, positive: false },
  { id: "ability", label: "Fähigkeit wählen", weight: 10, positive: true },
  { id: "randomAbility", label: "Zufallsfähigkeit", weight: 10, positive: true },
  { id: "iv", label: "Perfekten IV wählen", weight: 10, positive: true },
  { id: "randomIv", label: "Zufälliger perfekter IV", weight: 10, positive: true },
  { id: "item", label: "Item wählen", weight: 8, positive: true },
  { id: "randomItem", label: "Zufallsitem", weight: 8, positive: true },
  { id: "move", label: "Attacke wählen", weight: 8, positive: true },
  { id: "randomMove", label: "Zufallsattacke", weight: 8, positive: true },
  { id: "nothing", label: "Niete", weight: 8, positive: false },
  { id: "risk", label: "Risiko-Dreh", weight: 5, positive: false },
  { id: "nature", label: "Wesen wählen", weight: 8, positive: true },
  { id: "ivCurse", label: "IV-Fluch", weight: 5, positive: false },
  { id: "jackpot", label: "Jackpot", weight: 5, positive: true },
];

export const DEFAULT_RULES = {
  legendLimit: 0,
  mythicalLimit: 0,
  mythicalShared: true,
  ultraLimit: 0,
  ultraShared: true,
  pseudoLimit: 6,
  globalDeathBan: true,
  giftException: false,
  aceCap: true,
  aceDifference: 2,
  noHealingItems: true,
  ownPrimaryTypeUnique: false,
  crossPrimaryTypeUnique: false,
  linkPairPrimaryTypeUnique: false,
  sameAce: false,
  heirs: 1,
  lockedHeirs: 1,
  releaseChampions: true,
  allowRepeatHeir: true,
  maxRepeatHeir: 0,
  heirInHall: true,
  heirGym: false,
  heirGymAll: false,
  heirLottery: false,
  starterLottery: false,
  wheel: false,
  wheelMode: "oneRandom",
  wheelWithoutHeir: false,
  wheelOnlyLegal: true,
  wheelWeights: Object.fromEntries(WHEEL_RESULTS.map((r) => [r.id, r.weight])),
  riskWinChance: 70,
  wipeMode: "team",
};

export const copy = (value) => JSON.parse(JSON.stringify(value));

export function cleanRules(raw = {}) {
  const next = { ...copy(DEFAULT_RULES), ...(raw || {}) };
  const whole = (value, min, max) => Math.max(min, Math.min(max, Number.isFinite(Number(value)) ? Math.round(Number(value)) : min));
  next.heirs = whole(next.heirs, 0, 6);
  next.lockedHeirs = whole(next.lockedHeirs, 0, next.heirs);
  next.aceDifference = whole(next.aceDifference, 1, 30);
  next.maxRepeatHeir = whole(next.maxRepeatHeir, 0, 30);
  next.riskWinChance = whole(next.riskWinChance, 0, 100);
  ["legendLimit", "mythicalLimit", "ultraLimit", "pseudoLimit"].forEach((key) => {
    next[key] = whole(next[key], 0, 6);
  });
  next.wheelWeights = Object.fromEntries(WHEEL_RESULTS.map((r) => [
    r.id, whole(next.wheelWeights?.[r.id] ?? r.weight, 0, 1000)
  ]));
  if (!["each", "oneChoose", "oneRandom"].includes(next.wheelMode)) next.wheelMode = "oneRandom";
  if (!["team", "run"].includes(next.wipeMode)) next.wipeMode = "team";
  return next;
}

export function makeStage(edition, number) {
  return {
    id: "stage-" + number + "-" + Date.now(),
    edition,
    number,
    completedAt: null,
    hall: [],
    mvp: [],
    hater: [],
    heirs: [],
    snapshot: null,
    issues: [],
  };
}

export function createGenlocke({ name, editions = CLASSIC_EDITIONS, rules = DEFAULT_RULES, mode = "solo" }) {
  if (!editions.length) throw new Error("Bitte mindestens eine Edition auswählen.");
  return {
    schemaVersion: 1,
    name: String(name || "Genlocke").trim(),
    mode,
    editions: [...editions],
    rules: cleanRules(rules),
    currentIndex: 0,
    attempt: 1,
    startedAt: Date.now(),
    finishedAt: null,
    stages: [makeStage(editions[0], 1)],
    deaths: [],
    released: [],
    wheelHistory: [],
    archives: [],
    backups: [],
  };
}

export function dexIdFor(pokemon, edition) {
  if (!pokemon) return null;
  const dex = versionToPokedex[edition] || {};
  const match = Object.entries(dex).find(([, value]) => value === pokemon);
  return match ? Number(match[0].replace("pokedex", "")) || null : null;
}

export function inheritBasePokemon(pokemon, oldEdition, nextEdition) {
  const id = dexIdFor(pokemon, oldEdition);
  if (!id) return { pokemon, dexId: null, available: false };
  const family = evolutionFamiliesByDex[id] || [id];
  const futureDex = versionToPokedex[nextEdition] || {};
  const candidate = family.map(Number).filter(n => Number.isInteger(n) && n > 0)
    .find(n => Object.prototype.hasOwnProperty.call(futureDex, "pokedex" + n));
  if (!candidate) return { pokemon, dexId: id, available: false };
  return { pokemon: futureDex["pokedex" + candidate], dexId: candidate, available: true };
}

export function belongsToHeir(heir, pokemon, edition) {
  if (!heir || !pokemon || heir.dead) return false;
  if (heir.pokemon === pokemon) return true;
  const originalId = Number(heir.dexId) || dexIdFor(heir.pokemon, edition);
  const currentId = dexIdFor(pokemon, edition);
  if (!originalId || !currentId) return false;
  const family = evolutionFamiliesByDex[originalId] || [originalId];
  const knownBranches = [
    [133,134,135,136,196,197,470,471,700],
    [236,106,107,237],[280,281,282,475]
  ];
  return family.includes(currentId) ||
    knownBranches.some(branch => branch.includes(originalId) && branch.includes(currentId));
}

export function getTeams(save, players = 1) {
  const src = save?.teams;
  const initial = Array.from({ length: players }, () => Array(6).fill(""));
  if (!src) return initial;
  if (Array.isArray(src)) {
    if (typeof src[0] === "string") return [Array.from({ length: 6 }, (_, i) => src[i] || ""), ...initial.slice(1)];
    return initial.map((blank, i) => blank.map((_, j) => src[i]?.[j] || ""));
  }
  return initial.map((blank, i) => blank.map((_, j) =>
    src["team" + (i + 1)]?.[j] || src[i]?.[j] || src[String(i)]?.[j] || ""));
}

export function teamToStorage(teams, oldSave, players) {
  return players > 1 || (!Array.isArray(oldSave?.teams) && oldSave?.teams)
    ? Object.fromEntries(teams.map((team, i) => ["team" + (i + 1), team]))
    : teams;
}

export function stageSnapshot(save) {
  return copy({
    encounters: save.encounters || {},
    teams: save.teams || {},
    team: save.team || Array(6).fill(""),
    gymsDefeated: save.gymsDefeated || 0,
    globalSinnerStats: save.globalSinnerStats || {},
    runCounter: save.runCounter || 0,
    slotNames: save.slotNames || [],
  });
}

export function getCurrentStage(genlocke) {
  return genlocke?.stages?.[genlocke.currentIndex] || null;
}

// Ambiguous branches intentionally never ban all siblings. Exact unique chains
// use the data map, while split evolutions use the known branch IDs below.
const BRANCHES = [
  [133, 134, 135, 136, 196, 197, 470, 471, 700],
  [236, 106, 107, 237],
  [280, 281, 282, 475],
  [265, 266, 267, 268, 269],
  [290, 291, 292],
  [361, 362, 478],
];
export function bannedEvolutionIds(dexId) {
  const id = Number(dexId);
  if (!Number.isInteger(id) || id < 1) return [];
  const special = BRANCHES.find((branch) => branch.includes(id));
  if (special) return [id];
  const family = evolutionFamiliesByDex[id] || [id];
  if (family.some((v) => BRANCHES.some((b) => b.includes(Number(v))))) return [id];
  return [...new Set(family.map(Number))];
}

export function isGloballyBanned(g, dexId, { gift = false } = {}) {
  if (!g || (gift && g.rules?.giftException)) return false;
  const id = Number(dexId);
  if (!id) return false;
  const sources = [
    ...(g.rules?.globalDeathBan ? (g.deaths || []) : []),
    ...(g.rules?.releaseChampions ? (g.released || []) : []),
  ];
  return sources.some((event) => bannedEvolutionIds(event.dexId).includes(id));
}

export function registerDeath(g, { pokemon, dexId, player = 0, note = "", stageIndex = g.currentIndex }) {
  if (!pokemon) throw new Error("Bitte ein Pokémon auswählen.");
  const event = { id: "death-" + Date.now() + "-" + Math.random(), pokemon, dexId: Number(dexId) || null, player, note, stageIndex, at: Date.now(), type: "dead" };
  return { ...g, deaths: [...(g.deaths || []), event] };
}

// Shared death handling for manual deaths and lethal wheel outcomes.
// Encounters remain in the history while dead Pokémon leave the active teams.
export function syncCurrentTeamWithDeaths(save) {
  const next = copy(save);
  const g = next.genlocke;
  if (!g) return next;
  const players = g.mode === "duo" ? 2 : 1;
  const teams = getTeams(next, players);
  const died = (g.deaths || []).filter(d => d.stageIndex === g.currentIndex);
  const deadFor = (name, player) => died.some(d => d.player === player && d.pokemon === name);
  const cleanedTeams = teams.map((team, player) =>
    team.map(name => deadFor(name, player) ? "" : name)
  );
  next.teams = teamToStorage(cleanedTeams, next, players);
  next.team = cleanedTeams[0];
  const encounters = next.encounters || {};
  Object.values(encounters).forEach(row => {
    for (let player = 0; player < players; player++) {
      if (deadFor(row["pokemon" + (player + 1)], player)) {
        row["status" + (player + 1)] = "Besiegt";
      }
    }
    if (Array.from({length:players},(_,player)=>row["pokemon"+(player+1)])
      .filter(Boolean).every((name, player) => {
        const actualPlayer = Array.from({length:players},(_,i)=>i).filter(i=>row["pokemon"+(i+1)])[player];
        return deadFor(name, actualPlayer);
      }) && Array.from({length:players},(_,i)=>row["pokemon"+(i+1)]).some(Boolean)) {
      row.status = "Besiegt";
    }
  });
  return next;
}

export function killPokemonInSave(save, { pokemon, player = 0, note = "" }) {
  const g = save?.genlocke;
  if (!g || !pokemon) throw new Error("Genlocke oder Pokémon fehlt.");
  const players = g.mode === "duo" ? 2 : 1;
  if (player < 0 || player >= players) throw new Error("Ungültiger Spieler.");
  const before = getTeams(save, players);
  const stageIndex = g.currentIndex;
  const edition = g.editions[stageIndex];
  const encounter = Object.values(save.encounters || {}).find(row =>
    row?.["pokemon" + (player + 1)] === pokemon
  );
  const targets = [{pokemon, player}];
  if (players > 1 && encounter) {
    const partnerPlayer = player === 0 ? 1 : 0;
    const partner = encounter["pokemon" + (partnerPlayer + 1)];
    if (partner) targets.push({pokemon:partner, player:partnerPlayer});
  }
  let nextG = copy(g);
  targets.forEach(target => {
    const alreadyDead = nextG.deaths.some(d =>
      d.stageIndex === stageIndex && d.player === target.player && d.pokemon === target.pokemon
    );
    if (alreadyDead) return;
    nextG = registerDeath(nextG, {
      ...target, dexId:dexIdFor(target.pokemon, edition), note,
    });
    (getCurrentStage(nextG)?.heirs || []).forEach(heir => {
      if (heir.player === target.player && belongsToHeir(heir,target.pokemon,edition)) heir.dead = true;
    });
  });
  const updated = syncCurrentTeamWithDeaths({...save,genlocke:nextG});
  const after = getTeams(updated, players);
  const wipeMode = nextG.rules.wipeMode || "team";
  let wipe = false;
  if (wipeMode === "team") {
    wipe = before.some((team,i) => team.some(Boolean) && after[i].every(n => !n));
  } else {
    wipe = !Object.values(updated.encounters || {}).some(row =>
      row?.status === "Gefangen" && Array.from({length:players},(_,i) =>
        row["pokemon"+(i+1)] && row["status"+(i+1)] !== "Besiegt"
      ).some(Boolean)
    );
  }
  return {save:updated, wipe, targets};
}

export function getHeirNames(g, player = 0) {
  return (getCurrentStage(g)?.heirs || []).filter((h) => h.player === player && !h.dead).map((h) => h.pokemon);
}

export function getLockedHeirs(g, player = 0) {
  return (getCurrentStage(g)?.heirs || []).filter((h) => h.player === player && h.locked && !h.dead).map((h) => h.pokemon);
}

export function championRoster(save, players = 1) {
  const teams = getTeams(save, players);
  return Array.from({ length: 6 }, (_, slot) => ({
    slot,
    pokemon: teams.map((team) => team[slot] || ""),
  })).filter((r) => r.pokemon.some(Boolean));
}

function freshStartSave(save, g, nextHeirs, players) {
  const next = copy(save);
  const teams = Array.from({ length: players }, () => Array(6).fill(""));
  const encounters = {};
  nextHeirs.forEach((h) => {
    if (!teams[h.player]) return;
    const existing = teams[h.player].findIndex((v) => !v);
    if (existing >= 0) teams[h.player][existing] = h.pokemon;
    // Each inherited Soul-Pair must share one encounter row.
    const key = "Erbe " + (h.sourceSlot + 1);
    if (!encounters[key]) encounters[key] = { status: "Gefangen", inherited: true, originalSlot: h.sourceSlot };
    encounters[key]["pokemon" + (h.player + 1)] = h.pokemon;
    encounters[key]["status" + (h.player + 1)] = "Gefangen";
  });
  next.encounters = encounters;
  next.teams = teamToStorage(teams, save, players);
  next.team = teams[0];
  next.gymsDefeated = 0;
  next.globalSinnerStats = {};
  next.runCounter = 0;
  next.edition = g.editions[g.currentIndex];
  return next;
}

// The first draw is committed to the run immediately and cannot be rerolled.
export function drawChampionLottery(save, players = 1, random = Math.random) {
  const g = copy(save.genlocke);
  const stage = getCurrentStage(g);
  if (!g.rules.heirLottery) throw new Error("Erben-Lotterie ist deaktiviert.");
  if (stage.completedAt) throw new Error("Diese Etappe wurde bereits abgeschlossen.");
  if (stage.lotterySlots) throw new Error("Die Erben wurden bereits ausgelost.");
  const roster = championRoster(save, players).filter(row =>
    row.pokemon.length === players && row.pokemon.every(Boolean));
  const count = Math.min(g.rules.heirs, roster.length);
  if (!roster.length && count) throw new Error("Keine vollständigen Champion-Slots vorhanden.");
  const chosen = [...roster];
  for (let i=chosen.length-1; i>0; i--) {
    const j=Math.floor(random()*(i+1));
    [chosen[i],chosen[j]]=[chosen[j],chosen[i]];
  }
  stage.lotterySlots=chosen.slice(0,count).map(row=>row.slot);
  return {...save,genlocke:g};
}

export function drawStarterLottery(save, player, candidates, random = Math.random) {
  const g=copy(save.genlocke);
  if(!g.rules.starterLottery) throw new Error("Starter-Lotterie ist deaktiviert.");
  if(g.finishedAt) throw new Error("Genlocke ist bereits abgeschlossen.");
  const stage=getCurrentStage(g);
  const players=g.mode==="duo"?2:1;
  if(player<0||player>=players) throw new Error("Ungültiger Spieler.");
  if(stage.starterDraws?.[player]) throw new Error("Starter wurde bereits ausgelost.");
  const options=(candidates||[]).map(x=>String(x||"").trim()).filter(Boolean);
  if(options.length!==3||new Set(options).size!==3) throw new Error("Bitte genau drei unterschiedliche Starter eingeben.");
  const chosen=options[Math.floor(random()*options.length)];
  stage.starterDraws={...(stage.starterDraws||{}),[player]:{options,chosen,at:Date.now()}};
  return {save:{...save,genlocke:g},chosen};
}

export function recordArenaChoice(save,{name, aceSlot = null, participatingSlots = []}){
  const g=copy(save.genlocke);
  const stage=getCurrentStage(g);
  if(!stage||stage.completedAt) throw new Error("Diese Etappe ist abgeschlossen.");
  const key=String(name||"").trim();
  if(!key) throw new Error("Bitte eine Arena oder ihren Namen eintragen.");
  if((stage.arenas||[]).some(a=>a.name.toLocaleLowerCase("de")===key.toLocaleLowerCase("de")))
    throw new Error("Diese Arena wurde bereits dokumentiert.");
  if(g.rules.sameAce&&g.mode==="duo" && !(Number.isInteger(aceSlot) && aceSlot>=0 && aceSlot<6))
    throw new Error("Bitte für Same Ace das gemeinsame Ace-Paar wählen.");
  const participants=[...new Set(participatingSlots.map(Number))];
  if(g.rules.heirGym && (stage.heirs||[]).some(h=>!h.dead)){
    const alive=(stage.heirs||[]).filter(h=>!h.dead);
    const keys=alive.filter(h=>participants.includes(h.sourceSlot));
    if(!keys.length || (g.rules.heirGymAll && keys.length!==alive.length))
      throw new Error(g.rules.heirGymAll?"Alle lebenden Erben müssen teilnehmen.":"Mindestens ein Erbe muss teilnehmen.");
  }
  stage.arenas=[...(stage.arenas||[]),{
    name:key,aceSlot:g.rules.sameAce&&g.mode==="duo"?aceSlot:null,
    participatingSlots:participants,at:Date.now()
  }];
  return {...save,genlocke:g};
}

export function setWheelEffectDetail(save, recordId, effectIndex, value) {
  const g=copy(save.genlocke);
  const record=g.wheelHistory.find(r=>r.id===recordId);
  if(!record) throw new Error("Glücksrad-Ergebnis nicht gefunden.");
  if(effectIndex<0||effectIndex>=record.effects.length) throw new Error("Unbekanntes Bonusfeld.");
  const kind=record.effects[effectIndex];
  if(kind==="death"||kind==="nothing"||kind==="risk"||kind==="jackpot")
    throw new Error("Dieses Feld benötigt keine Auswahl.");
  const detail=String(value||"").trim();
  if(!detail) throw new Error("Bitte den Bonus vollständig angeben.");
  record.details={...(record.details||{}),[effectIndex]:detail};
  return {...save,genlocke:g};
}

export function finishStage(save, pickedSlots, lockedSlots, mvp = [], hater = [], players = 1) {
  const g = copy(save.genlocke);
  const stage = getCurrentStage(g);
  if (!stage || stage.completedAt) throw new Error("Diese Etappe ist bereits abgeschlossen.");
  const hall = championRoster(save, players);
  const usable=hall.filter(r=>r.pokemon.length===players && r.pokemon.every(Boolean));
  const limit = Math.min(g.rules.heirs, usable.length);
  const picks = g.rules.heirLottery
    ? (stage.lotterySlots || [])
    : [...new Set(pickedSlots)].filter((slot) => usable.some(row => row.slot===slot));
  if (g.rules.heirLottery && !stage.lotterySlots && g.currentIndex<g.editions.length-1)
    throw new Error("Bitte zuerst die Erben-Lotterie drehen.");
  if (g.rules.heirInHall && stage.heirs?.some(h=>!h.dead)) {
    const active=stage.heirs.filter(h=>!h.dead);
    const stillInHall=active.some(h=>hall.some(row=>row.pokemon[h.player] &&
      belongsToHeir(h,row.pokemon[h.player],stage.edition)));
    if(!stillInHall) throw new Error("Mindestens ein lebender Erbe muss im Champion-Team stehen.");
  }
  for(const slot of picks) {
    const roster=usable.find(row=>row.slot===slot);
    if(!roster) throw new Error("Ausgewählter Erbe ist kein vollständiges Champion-Paar.");
    for(let player=0;player<players;player++){
      const prev=(stage.heirs||[]).find(h=>h.player===player && !h.dead &&
        belongsToHeir(h,roster.pokemon[player],stage.edition));
      if(prev && !g.rules.allowRepeatHeir)
        throw new Error(roster.pokemon[player]+" wurde bereits vererbt und darf nicht erneut Erbe werden.");
      if(prev && g.rules.maxRepeatHeir>0 && (prev.chain||1)+1>g.rules.maxRepeatHeir)
        throw new Error(roster.pokemon[player]+" hat sein konfiguriertes Erben-Limit erreicht.");
    }
  }
  if (picks.length !== limit && g.currentIndex < g.editions.length - 1) {
    throw new Error("Bitte genau " + limit + " Erben-Slots auswählen.");
  }
  if (lockedSlots.length !== Math.min(g.rules.lockedHeirs, picks.length)) throw new Error("Bitte genau " + Math.min(g.rules.lockedHeirs, picks.length) + " Erben für den Teamlock auswählen.");
  stage.hall = hall;
  stage.mvp = mvp;
  stage.hater = hater;
  stage.completedAt = Date.now();
  stage.snapshot = stageSnapshot(save);
  stage.selectedSlots = picks;
  stage.heirs = getCurrentStage(g).heirs || [];
  const nextIndex = g.currentIndex + 1;
  if (nextIndex >= g.editions.length) {
    g.finishedAt = Date.now();
    return { ...save, genlocke: g };
  }
  const nextHeirs = picks.flatMap((slot) => {
    const item = hall.find((r) => r.slot === slot);
    return item.pokemon.flatMap((pokemon, player) => {
      if (!pokemon) return [];
      const base = inheritBasePokemon(pokemon, stage.edition, g.editions[nextIndex]);
      if (!base.available) throw new Error("Der Erbe " + pokemon + " ist in " + g.editions[nextIndex] + " nicht verfügbar. Bitte die Erbenauswahl oder Reihenfolge prüfen.");
      const prev=(stage.heirs||[]).find(h=>h.player===player && !h.dead &&
        belongsToHeir(h,pokemon,stage.edition));
      return [{ pokemon: base.pokemon, originalPokemon: pokemon, dexId: base.dexId,
        level: 5, player, fromStage: g.currentIndex,
        locked: lockedSlots.includes(slot), dead: false, sourceSlot: slot,
        chain:prev?(prev.chain||1)+1:1 }];
    });
  });
  if (g.rules.releaseChampions) {
    hall.filter((r) => !picks.includes(r.slot)).forEach((r) => {
      r.pokemon.forEach((pokemon, player) => {
        if (pokemon) g.released.push({ pokemon, player, dexId: dexIdFor(pokemon, stage.edition), stageIndex: g.currentIndex, type: "released", at: Date.now() });
      });
    });
  }
  g.currentIndex = nextIndex;
  const newStage = makeStage(g.editions[nextIndex], nextIndex + 1);
  newStage.heirs = nextHeirs;
  g.stages.push(newStage);
  return { ...freshStartSave(save, g, nextHeirs, players), genlocke: g };
}

export function adjustHistoricalStage(g, stageIndex, snapshot) {
  if (stageIndex >= g.currentIndex) throw new Error("Nur abgeschlossene Etappen lassen sich hier korrigieren.");
  const updated = copy(g);
  const stage = updated.stages[stageIndex];
  if (!stage || !stage.completedAt) throw new Error("Etappe nicht gefunden.");
  updated.backups = [...updated.backups.slice(-4), {
    at: Date.now(), stageIndex, snapshot: copy(stage.snapshot),
  }];
  stage.snapshot = copy(snapshot);
  stage.issues = ["Historische Daten geändert: spätere Etappen und Sperren kontrollieren."];
  for (let i = stageIndex + 1; i < updated.stages.length; i++) {
    updated.stages[i].issues = ["Vorherige Etappe wurde nachträglich verändert; bitte prüfen."];
  }
  return updated;
}

export function spinWeighted(results, random = Math.random) {
  const available = results.filter((r) => r.weight > 0);
  const sum = available.reduce((n, r) => n + r.weight, 0);
  if (!sum) throw new Error("Mindestens ein Glücksrad-Feld braucht eine positive Gewichtung.");
  let value = random() * sum;
  for (const item of available) {
    value -= item.weight;
    if (value < 0) return item;
  }
  return available[available.length - 1];
}

export function resolveWheel(g, pokemon, player = 0, random = Math.random) {
  const next = copy(g);
  const results = WHEEL_RESULTS.map((r) => ({ ...r, weight: next.rules.wheelWeights[r.id] || 0 }));
  const result = spinWeighted(results, random);
  let effects = [result.id];
  const positive = results.filter((r) => r.positive && r.id !== "jackpot");
  if (result.id === "risk") {
    effects = random() * 100 < next.rules.riskWinChance
      ? [spinWeighted(positive, random).id, spinWeighted(positive, random).id] : ["death"];
  } else if (result.id === "jackpot") {
    effects = [spinWeighted(positive, random).id, spinWeighted(positive, random).id];
  }
  const record = { id: "spin-" + Date.now() + "-" + Math.random(), at: Date.now(), stageIndex: next.currentIndex, player, pokemon, result: result.id, effects };
  if (next.wheelHistory.some((entry) => entry.stageIndex === next.currentIndex && entry.player === player && entry.pokemon === pokemon)) {
    throw new Error("Für dieses Pokémon wurde in dieser Etappe bereits gedreht.");
  }
  next.wheelHistory.push(record);
  if (effects.includes("death")) {
    const stage = getCurrentStage(next);
    const heirs = (stage?.heirs || []);
    const h = heirs.find((x) => x.player === player && x.pokemon === pokemon);
    const died = [{ pokemon, player, dexId: dexIdFor(pokemon, next.editions[next.currentIndex]) }];
    if (h) {
      h.dead = true;
      if (next.mode === "duo") {
        const partner = heirs.find((x) => x.player !== player && x.sourceSlot === h.sourceSlot && !x.dead);
        if (partner) {
          partner.dead = true;
          died.push({ pokemon: partner.pokemon, player: partner.player, dexId: dexIdFor(partner.pokemon, next.editions[next.currentIndex]) });
        }
      }
    }
    died.forEach((d) => {
      next.deaths.push({ type: "dead", ...d, stageIndex: next.currentIndex, note: "Glücksrad / Soul-Link", at: Date.now() });
    });
  }
  return { genlocke: next, record };
}

export function archiveWipe(save, reason = "FULLWIPE", feedback = {}) {
  const g = copy(save.genlocke);
  const summary = {
    at: Date.now(), reason, attempt: g.attempt,
    mvp: feedback.mvp || "", hater: feedback.hater || "",
    reachedStage: g.currentIndex + 1, edition: g.editions[g.currentIndex],
    deaths: g.deaths.length, released: g.released.length,
    champions: g.stages.filter((s) => s.completedAt).length,
    stages: copy(g.stages),
    wheelHistory: copy(g.wheelHistory),
  };
  g.archives = [...(g.archives || []), summary];
  g.attempt += 1;
  g.currentIndex = 0;
  g.finishedAt = null;
  g.startedAt = Date.now();
  g.stages = [makeStage(g.editions[0], 1)];
  g.deaths = [];
  g.released = [];
  g.wheelHistory = [];
  return { ...freshStartSave(save, g, [], g.mode === "duo" ? 2 : 1), genlocke: g };
}

export function clearCurrentList(save) {
  return { ...save, encounters: {} };
}

export function clearAllLists(save) {
  const next = copy(save);
  next.encounters = {};
  if (next.genlocke) {
    next.genlocke.stages.forEach(stage => {
      if (stage.snapshot) stage.snapshot.encounters = {};
    });
  }
  return next;
}

export function restartGenlocke(save) {
  if (!save?.genlocke) return save;
  const g = copy(save.genlocke);
  g.attempt = 1;
  g.currentIndex = 0;
  g.finishedAt = null;
  g.startedAt = Date.now();
  g.stages = [makeStage(g.editions[0], 1)];
  g.deaths = [];
  g.released = [];
  g.wheelHistory = [];
  g.backups = [];
  return { ...freshStartSave(save, g, [], g.mode === "duo" ? 2 : 1), genlocke:g };
}

export function getPresets() {
  try {
    const parsed = JSON.parse(localStorage.getItem(GENLOCKE_PRESETS_KEY) || "{}");
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch { return {}; }
}

export function savePreset(name, rules) {
  const presets = { ...getPresets(), [name]: cleanRules(rules) };
  localStorage.setItem(GENLOCKE_PRESETS_KEY, JSON.stringify(presets));
  return presets;
}

export function deletePreset(name) {
  const presets = getPresets();
  delete presets[name];
  localStorage.setItem(GENLOCKE_PRESETS_KEY, JSON.stringify(presets));
  return presets;
}
