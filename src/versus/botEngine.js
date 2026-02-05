// src/versus/botEngine.js

function clamp(n, a, b) {
  const x = Number(n);
  if (!Number.isFinite(x)) return a;
  return Math.max(a, Math.min(b, x));
}

function pickUniqueShuffled(arr, n) {
  const a = [...(arr || [])];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a.slice(0, n);
}

function hashStr(s) {
  let h = 2166136261;
  const str = String(s || "");
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function mulberry32(a) {
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function pickRng(arr, rng) {
  const a = arr || [];
  if (!a.length) return null;
  return a[Math.floor(rng() * a.length)];
}


// extra nervig 😄
const BOT_NAME_POOL = [
  "AllIn-Andi",
  "Flex-Fiona",
  "Knauser-Klaus",
  "Tilt-Timo",
  "Biet-Bianca",
  "Rage-Ronny",
  "Sniper-Sascha",
  "GönnDir-Gabi",
  "Schwitzer-Sven",
  "Meta-Maren",
  "Budget-Ben",
  "Overpay-Olli",
  "Hype-Heike",
  "Kalkül-Kai",
  "Nerv-Nico",
  "Tryhard-Tanja",
  "Reset-Rudi",
  "Schlitzohr-Silke",
  "Bid-Boss-Benni",
  "Mies-Malte",
];

export const BOT_DIFFICULTIES = ["easy", "normal", "hard", "veryhard", "chaos"];
export const BOT_BEHAVIORS = [
  "zufall",
  "none",
  "starterfreund",
  "sparer",
  "raushauer",
  "sniper",
  "sammler",
  "minimalist",
  "dominanz",
  "chaos",
  "meta",
  "anti_meta",
  "eifersuechtig",
  "konterspieler",
  "late_bloomer",
  "fruehstarter",
  "absicherer",
  "risiko",
  "paniker",
  "minimal_budget",
  "taktiker",
  "blockierer",
  "fanboy",
  "endgame",
  "adaptive",
  "abfucker",
  "revanchist",
  "pingpong",
  "hoarder",
  "nachahmer",
  "saboteur",
  "mitlaeufer",
  "schlaefer",
  "tunnelblick",
  "verweigerer",
];

const DIFFS = BOT_DIFFICULTIES;

// wird in der Lobby als “Bot Teams” angezeigt & editierbar gemacht
export function generateBotConfigs(botCount, seedBase = Date.now()) {
  const count = clamp(botCount, 0, 9);
  const picks = pickUniqueShuffled(BOT_NAME_POOL, Math.min(count, BOT_NAME_POOL.length));

  const out = [];
  for (let i = 0; i < count; i++) {
    const idx1 = i + 1;

    const name = picks[i] || `Bot-${idx1}`;
    const diff = "veryhard";

    out.push({
      id: `bot:${idx1}`, // ✅ STABIL & EINFACH zu matchen
      // seedBase nur für Optik/Feeling
      name: `${name} #${idx1}`,
      difficulty: diff,
      behavior1: "zufall",
      behavior2: "zufall",
      reserveBias: Math.random(), // 0..1
      seedBase, // optional: falls du später reproduzierbare RNG willst
    });
  }
  return out;
}

// wird beim Draft-Start in den Room geschrieben (draft.bots)
// wird beim Draft-Start in den Room geschrieben (draft.bots)
export function buildBots({ botConfigs = [], startTeamIndex = 0 }) {
  const bots = [];
  const startIdx = Math.max(0, Number(startTeamIndex) || 0);
  // --- NEU: pro Draft einmal vorbereiten (nicht global über mehrere Drafts) ---
  const behaviorPool = (BOT_BEHAVIORS || []).filter((k) => k !== "none" && k !== "zufall");

  const globalSeed = hashStr(
    `global|${(botConfigs?.[0]?.seedBase ?? 0)}|${botConfigs?.length ?? 0}|${startIdx}`
  );
  const globalRng = mulberry32(globalSeed);

  // global gemischt, damit die Reihenfolge pro Draft anders ist
  const shuffledPool = [...behaviorPool];
  for (let s = shuffledPool.length - 1; s > 0; s--) {
    const j = Math.floor(globalRng() * (s + 1));
    [shuffledPool[s], shuffledPool[j]] = [shuffledPool[j], shuffledPool[s]];
  }

  // Wichtig: pro Draft frisch!
  const usedB1 = new Set();

  for (let i = 0; i < botConfigs.length; i++) {
    const cfg = botConfigs[i] || {};
    const teamId = `team${startIdx + i + 1}`; // ✅ team ist 1-based

    const diff = String(cfg.difficulty || "normal");
let b1 = normalizeBehavior(cfg.behavior1 || "zufall");
let b2 = normalizeBehavior(cfg.behavior2 || "zufall");

    // ✅ "zufall" bleibt pro Draft fix (seeded), nicht pro Bid wechselnd
    // --- NEU: globaler Draft-RNG + “nicht alle gleich”-Würfelhilfe ---
    const rng = mulberry32(hashStr(`${cfg.id || `bot:${i + 1}`}|${cfg.seedBase || 0}|${i}`));

    function pickAny() {
      if (!shuffledPool.length) return "none";
      return shuffledPool[Math.floor(rng() * shuffledPool.length)];
    }

    function pickPreferUnused() {
      if (!shuffledPool.length) return "none";
      if (usedB1.size >= shuffledPool.length) return pickAny(); // alles schon benutzt -> normal würfeln

      for (let tries = 0; tries < 12; tries++) {
        const cand = pickAny();
        if (!usedB1.has(cand)) return cand;
      }
      return pickAny();
    }

    if (b1 === "zufall") {
      b1 = pickPreferUnused() || "none";
      usedB1.add(b1);
    }

    if (b2 === "zufall") {
      // b2 möglichst nicht identisch zu b1
      let picked = null;
      for (let tries = 0; tries < 12; tries++) {
        const cand = pickAny();
        if (cand !== b1) {
          picked = cand;
          break;
        }
      }
      b2 = picked || pickAny() || "none";
    }



    // 2. Verhalten nur bei Sehr hart
    const dd = diff.toLowerCase();
    if (dd !== "veryhard" && dd !== "sehrhart") b2 = "none";

    bots.push({
      id: String(cfg.id || `bot:${i + 1}`),
      teamId,
      name: String(cfg.name || `Bot #${i + 1}`),
      difficulty: diff,
      behavior1: b1,
      behavior2: b2,
      reserveBias: typeof cfg.reserveBias === "number" ? cfg.reserveBias : Math.random(),
      seedBase: cfg.seedBase,
    });
  }

  return bots;
}


function bumpStep(difficulty) {
  // mind +100, aber manchmal größere Sprünge
  if (difficulty === "easy") return [100, 200];
  if (difficulty === "normal") return [100, 200, 300, 500];
  if (difficulty === "hard") return [200, 300, 500, 700, 900];
  return [100, 300, 500, 800, 1200, 1500]; // chaos
}

function desireFromSpecial({ starter, pseudo, subLegendary, legendary, mythical }, difficulty) {
  // Basis-Desire
  let d = 0.35;

  // Specials pushen Desire (dein Wunsch)
  if (starter) d += 0.18;
  if (pseudo) d += 0.22;
  if (subLegendary) d += 0.30;
  if (legendary) d += 0.45;
  if (mythical) d += 0.55;

  // Difficulty mod
  if (difficulty === "easy") d -= 0.08;
  if (difficulty === "hard") d += 0.10;
  if (difficulty === "chaos") d += 0.05;

  return clamp(d, 0.05, 0.98);
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function bidFrequencyForDifficulty(difficulty) {
  const d = String(difficulty || "normal").toLowerCase();
  if (d === "easy" || d === "leicht") return 0.50;
  if (d === "normal" || d === "mittel") return 0.66;
  if (d === "hard" || d === "schwer") return 0.80;
  if (d === "veryhard" || d === "sehrhart") return 0.95;
  if (d === "chaos" || d === "chaotisch") return 0.75;
  return 0.66;
}

function normalizeBehavior(v) {
  const x = String(v || "none").toLowerCase().trim();
  if (x === "random") return "zufall";
  return x || "none";
}

function applyBehaviorTuning(state, behavior, ctx) {
  const b = normalizeBehavior(behavior);
  if (b === "none") return state;

  // state: { desire, reserveMult, maxPayMult, incFloor, freqAdd }
  const s = { ...state };

  if (b === "starterfreund") {
    if (ctx?.specialFlags?.starter) s.desire += 0.18;
    else s.desire += 0.04;
    s.freqAdd += 0.03;
  }

  if (b === "sparer" || b === "minimal_budget") {
    s.reserveMult *= 1.45;
    s.maxPayMult *= 0.92;
    s.freqAdd -= 0.10;
  }

  if (b === "minimalist") {
    s.reserveMult *= 1.60;
    s.maxPayMult *= 0.88;
    s.freqAdd -= 0.08;
  }

  if (b === "raushauer") {
  // deutlich weniger Reserve, deutlich mehr MaxPay, öfter bieten
  s.reserveMult *= 0.45;
  s.maxPayMult *= 1.28;
  // kleine Schritte wirken natürlicher
  s.incFloor = Math.max(s.incFloor, 100);
  s.freqAdd += 0.20;
}

  if (b === "sniper") {
    // bietet seltener, dafür größere Sprünge
    s.freqAdd -= 0.18;
    s.incFloor = Math.max(s.incFloor, 300);
    s.maxPayMult *= 1.04;
  }

  if (b === "sammler") {
    // leicht höhere desire generell; specials stärker
    const anySpecial = !!(ctx?.specialFlags?.starter || ctx?.specialFlags?.pseudo || ctx?.specialFlags?.subLegendary || ctx?.specialFlags?.legendary || ctx?.specialFlags?.mythical);
    s.desire += anySpecial ? 0.10 : 0.05;
    s.freqAdd += 0.04;
  }

  if (b === "blockierer") {
    // etwas aggressiver gegen hohe Gebote
    if (Number(ctx?.highestBid || 0) >= 400) s.maxPayMult *= 1.08;
    s.freqAdd += 0.05;
  }

  if (b === "endgame") {
    if (Number(ctx?.picksLeft || 0) <= 2) {
      s.freqAdd += 0.18;
      s.maxPayMult *= 1.12;
      s.reserveMult *= 0.75;
    }
  }

  if (b === "chaos") {
    s.freqAdd += 0.06;
    s.incFloor = Math.max(s.incFloor, 200);
    s.maxPayMult *= 1.06;
  }

  
  if (b === "dominanz") {
    // will "dominieren": oft bieten + größere Sprünge
    s.freqAdd += 0.18;
s.maxPayMult *= 1.18;
s.incFloor = Math.max(s.incFloor, 200);
  }

  if (b === "risiko") {
    // risikofreudig: weniger Reserve, höherer MaxPay
    s.reserveMult *= 0.65;
    s.maxPayMult *= 1.10;
    s.freqAdd += 0.06;
  }

  if (b === "absicherer") {
    // safety first: viel Reserve, weniger overpay
    s.reserveMult *= 1.55;
    s.maxPayMult *= 0.95;
    s.freqAdd -= 0.05;
  }

  if (b === "taktiker") {
    // eher kontrolliert: seltenere bids, aber wenn dann solide jumps
    s.freqAdd -= 0.08;
    s.incFloor = Math.max(s.incFloor, 200);
    s.maxPayMult *= 1.02;
  }

  if (b === "paniker") {
    // wird nervös bei hohen bids / spätem draft
    if (Number(ctx?.highestBid || 0) >= 600) s.freqAdd += 0.10;
    if (Number(ctx?.picksLeft || 0) <= 2) {
      s.freqAdd += 0.12;
      s.reserveMult *= 0.70;
    }
  }

  if (b === "fruehstarter") {
    // lieber früh aktiv (Opening)
    if (Number(ctx?.highestBid || 0) === 0) s.freqAdd += 0.18;
  }

  if (b === "late_bloomer") {
    // erst zum Ende hin aktiv
    if (Number(ctx?.picksLeft || 0) <= 3) s.freqAdd += 0.16;
    else s.freqAdd -= 0.06;
  }

  if (b === "eifersuechtig" || b === "revanchist") {
    // "ich will nicht verlieren": aggressiver bei hohen bids
    if (Number(ctx?.highestBid || 0) >= 500) {
      s.maxPayMult *= 1.10;
      s.freqAdd += 0.08;
    }
  }

  if (b === "saboteur" || b === "abfucker" || b === "blockierer") {
    // blocken: gegen Ende eher overpayen
    if (Number(ctx?.picksLeft || 0) <= 2) {
      s.maxPayMult *= 1.08;
      s.incFloor = Math.max(s.incFloor, 300);
    }
  }

  if (b === "hoarder") {
    // hortet Budget (wie sparer, aber weniger extrem)
    s.reserveMult *= 1.25;
    s.maxPayMult *= 0.96;
    s.freqAdd -= 0.06;
  }

  if (b === "mitlaeufer" || b === "nachahmer" || b === "pingpong") {
    // eher opportunistisch: kleine freq+ und nicht zu große jumps
    s.freqAdd += 0.03;
    s.incFloor = Math.max(s.incFloor, 100);
  }

  if (b === "schlaefer") {
    // schläft oft -> seltene bids
    s.freqAdd -= 0.20;
  }

  if (b === "tunnelblick") {
    // stur: häufig, aber eher kleine Steps (weniger floor)
    s.freqAdd += 0.08;
    s.maxPayMult *= 0.98;
  }

  if (b === "verweigerer") {
    // verweigert specials (einfacher Proxy)
    const anySpecial = !!(ctx?.specialFlags?.starter || ctx?.specialFlags?.pseudo || ctx?.specialFlags?.subLegendary || ctx?.specialFlags?.legendary || ctx?.specialFlags?.mythical);
    if (anySpecial) {
      s.freqAdd -= 0.25;
      s.maxPayMult *= 0.88;
    }
  }

  if (b === "fanboy") {
    // Fanboy: liebt specials etwas mehr
    const anySpecial = !!(ctx?.specialFlags?.starter || ctx?.specialFlags?.pseudo || ctx?.specialFlags?.subLegendary || ctx?.specialFlags?.legendary || ctx?.specialFlags?.mythical);
    if (anySpecial) {
      s.desire += 0.12;
      s.freqAdd += 0.06;
    }
  }

  if (b === "meta") {
    // Meta: priorisiert stark -> specials aggressiver
    const anySpecial = !!(ctx?.specialFlags?.pseudo || ctx?.specialFlags?.subLegendary || ctx?.specialFlags?.legendary || ctx?.specialFlags?.mythical);
    if (anySpecial) {
      s.desire += 0.10;
      s.maxPayMult *= 1.06;
      s.freqAdd += 0.04;
    }
  }

  if (b === "anti_meta") {
    // Anti-Meta: specials eher meiden
    const anySpecial = !!(ctx?.specialFlags?.pseudo || ctx?.specialFlags?.subLegendary || ctx?.specialFlags?.legendary || ctx?.specialFlags?.mythical);
    if (anySpecial) {
      s.desire -= 0.08;
      s.freqAdd -= 0.06;
      s.maxPayMult *= 0.95;
    } else {
      s.freqAdd += 0.03;
    }
  }

// meta / anti-meta aktuell neutral (placeholder)
  return s;
}

/**
 * Entscheidet ein Bot-Gebot.
 * Regeln:
 * - Bot bietet NICHT wenn er gerade höchstbietend ist
 * - Bot bietet nur wenn er Budget hat & mindestens 100 drauf kann
 * - Letztes Pokémon: deutlich aggressiver, “geht Richtung All-in”
 */
export function decideBotBid({
  bot,
  myBudget,
  highestBid,
  highestTeamId,
  highestTeamBudget, // ✅ neu
  minBidIncrement = 100,
  specialFlags,
  picksLeft,
  avgPrice,
  evoMaxTotal,
  remainingSec,
  myTeamSize,
}) {

  if (!bot) return null;

  const budget = clamp(myBudget, 0, 999999999);
  const hb = clamp(highestBid, 0, 999999999);
  if (highestTeamId === bot.teamId) return null; // nicht selbst überbieten
  if (budget < hb + minBidIncrement) return null;

  const diff = bot.difficulty || "normal";
  const b1 = bot.behavior1 || "none";
  const b2 = bot.behavior2 || "none";

  const myCount = Math.max(0, Number(myTeamSize ?? 0));
  const mustGetOne = myCount <= 0; // Team hat noch 0 Pokémon
  const isLast = Number(picksLeft || 0) <= 1;

  // ✅ Bot-Bietfrequenz (Punkt 10)
  // Grundfrequenz nach Difficulty + kleine Adjustments durch Verhalten
  const baseFreq = bidFrequencyForDifficulty(diff);

  // Verhalten-Tuning (Punkt 11) – nicht implementierte Verhalten = neutral
  let tune = { desire: 0, reserveMult: 1, maxPayMult: 1, incFloor: 0, freqAdd: 0 };
  tune = applyBehaviorTuning(tune, b1, { specialFlags, highestBid: hb, picksLeft });
  // VeryHard darf 2 Verhalten haben (sonst behavior2 ignorieren)
  if (String(diff).toLowerCase() === "veryhard" || String(diff).toLowerCase() === "sehrhart") {
    tune = applyBehaviorTuning(tune, b2, { specialFlags, highestBid: hb, picksLeft });
  }

  // Final frequency
  const isLastForFreq = Number(picksLeft || 0) <= 1;
  let freq = clamp(baseFreq + tune.freqAdd + (isLastForFreq ? 0.15 : 0), 0.05, 0.98);

// Opening: deutlich öfter (damit mehr "Leben" reinkommt)
if (hb === 0) freq = clamp(freq + 0.18, 0.05, 0.98);

// Endgame: aggressiver
const pLeft2 = Number(picksLeft || 0);
if (pLeft2 <= 2) freq = clamp(freq + 0.18, 0.05, 0.98);
if (pLeft2 <= 1) freq = clamp(freq + 0.22, 0.05, 0.98);

  // ✅ Kein Bot bleibt leer: wenn Team noch 0 Pokémon hat, gegen Ende quasi sicher bieten
  const tS = Number(remainingSec ?? 0);
  const pL2 = Number(picksLeft || 0);
  if (mustGetOne && (pL2 <= 2 || (tS > 0 && tS <= 4))) {
    freq = clamp(Math.max(freq, 0.98), 0.05, 0.98);
  }

  if (Math.random() > freq) return null;


  // “Desire” = wie sehr will er dieses Pokémon
  let desire = desireFromSpecial(specialFlags || {}, diff);
  if (mustGetOne) {
    // Wenn Bot noch 0 Pokémon hat, MUSS er gegen Ende aktiver werden (kein Bot bleibt leer)
    const pL = Number(picksLeft || 0);
    if (pL <= 4) desire = clamp(desire + 0.18, 0.05, 0.98);
    if (pL <= 2) desire = clamp(desire + 0.28, 0.05, 0.98);
  }
desire = clamp(desire + (tune.desire || 0), 0.05, 0.98);

  const picks = Math.max(1, Number(picksLeft || 1));
// ✅ Endgame-Aggression: je weniger Picks übrig, desto mehr "Geld raus"
// (wenn picksLeft klein ist, sollen sie sich nicht kaputtsparen)
let endgameMult = 1.0;
if (picks <= 3) endgameMult *= 1.15;
if (picks <= 2) endgameMult *= 1.30;
if (picks <= 1) endgameMult *= 1.55;

  // ✅ Specials-Multiplikator (damit Legis/Mythische deutlich teurer werden)
  const sf = specialFlags || {};
  let specialMult = 1.0;
  if (sf.starter) specialMult *= 1.12;
  if (sf.pseudo) specialMult *= 1.22;
  if (sf.subLegendary) specialMult *= 1.35;
  if (sf.legendary) specialMult *= 1.60;
  if (sf.mythical) specialMult *= 1.75;
// ✅ BST/Power-Multiplikator: starke Endentwicklungen teurer (z.B. Kaumalat -> Knakrack)
// stärker skaliert, damit 600+ BST nicht “billig” bleibt
const evoT = Number(evoMaxTotal ?? 0);
let bstMult = 1.0;
if (evoT > 0) {
  // 450 => ~1.00, 600 => ~1.46, 720 => ~1.84
  bstMult = clamp(0.90 + (evoT - 420) / 320, 0.85, 1.90);
}

  // Difficulty-Aggression (wie hart soll er “Geld verbrennen”)
  const dLow = String(diff || "normal").toLowerCase();
  let diffAgg = 1.0;
  if (dLow === "easy" || dLow === "leicht") diffAgg = 0.82;
  if (dLow === "normal" || dLow === "mittel") diffAgg = 1.00;
  if (dLow === "hard" || dLow === "schwer") diffAgg = 1.18;
  if (dLow === "veryhard" || dLow === "sehrhart") diffAgg = 1.32;
  if (dLow === "chaos" || dLow === "chaotisch") diffAgg = 1.10;

  // ✅ Reserve-Gefühl – aber: wenn viel Budget pro Pick da ist, Reserve runter (damit sie nicht bei 100k nur 300 bieten)
  const reserveFactor = clamp(bot.reserveBias, 0, 1);
 let reserve = Math.round(budget * (0.02 + 0.08 * reserveFactor)); // ~2%..10%
  reserve = Math.round(reserve * (tune.reserveMult || 1));
// ✅ Endgame: Reserve stark reduzieren -> Geld MUSS raus
const pLeft = Number(picksLeft || 0);
if (pLeft <= 2) reserve = Math.round(reserve * 0.25);
if (pLeft <= 1) reserve = Math.round(reserve * 0.10);

  const basePerPick = budget / picks;
  const ap = Number(avgPrice || 0);
  if (ap > 0) {
    const affordability = clamp(basePerPick / Math.max(1, ap), 0.4, 6.0); // >1 => viel Geld pro Pick
    // mehr Geld pro Pick => weniger Reserve
    reserve = Math.round(reserve * clamp(1 / affordability, 0.30, 1.00));
    // wenn avgPrice sehr niedrig, noch weniger Reserve
    if (affordability >= 2.5) reserve = Math.round(reserve * 0.85);
  }

  // Hard/VeryHard/Chaos halten weniger Reserve zurück
  if (dLow === "hard" || dLow === "schwer") reserve = Math.round(reserve * 0.70);
  if (dLow === "veryhard" || dLow === "sehrhart") reserve = Math.round(reserve * 0.55);
  if (dLow === "chaos" || dLow === "chaotisch") reserve = Math.round(reserve * 0.60);

  // Letztes Pokémon: Reserve fast egal
  if (isLast) reserve = Math.round(reserve * 0.10);

  reserve = clamp(reserve, 0, budget);

  // ✅ MaxPay: kombiniert “Budget pro Pick” + Desire + Specials + Difficulty
  // Ziel: Bots sollen ihr Geld über den Draft verteilt weitgehend ausgeben.
  const spendable = clamp(budget - reserve, 0, budget);

  // Baseline (ohne avgPrice): orientiert sich am Budget pro Pick
  let targetPay = basePerPick * (0.85 + 0.95 * desire) * specialMult * diffAgg * endgameMult * bstMult;

  // Wenn avgPrice vorhanden: korrigiere targetPay so, dass es nicht absurd niedrig bleibt
  if (ap > 0) {
    // Wenn wir viel mehr Geld als “typischer Preis” haben: targetPay hochziehen
    // (z.B. 100k Budget für 10 Mons, avgPrice 1200 => affordability ~8.3 -> targetPay deutlich höher)
    const affordability = clamp(basePerPick / Math.max(1, ap), 0.4, 10.0);
    if (affordability > 1.25) {
      targetPay *= (1 + Math.min(1.2, (affordability - 1.25) * 0.35));
    }
    // Wenn Pokémon gerade “billig” ist (hb klein): ein bisschen aggressiver rein
    if (hb <= ap * 0.7) targetPay *= 1.08;
  }

  // Sicherheits-Cap: niemals mehr als spendable * Faktor (damit Reserve noch Sinn hat)
  let maxPay = Math.round(
  Math.min(
    budget,
    Math.max(
      hb + minBidIncrement,
      targetPay,
      // ✅ mutiger: mehr Budget darf in maxPay fließen
      spendable * (0.55 + 0.75 * desire) * specialMult
    )
  )
);
  if (isLast) {
    // last pick: sehr nah ans all-in
    maxPay = Math.round(budget * clamp(0.88 + 0.12 * desire, 0.88, 0.995));
  }

  maxPay = Math.round(maxPay * (tune.maxPayMult || 1));
  maxPay = clamp(maxPay, 0, budget);

  if (maxPay <= hb) return null;

  // ✅ Step/Jump: nicht nur 1000er – Mischung aus kleinen + mittleren + großen Sprüngen,
  // und bei Specials öfter “bigger” + gelegentlich ein großer “pressure jump”.
  const room = Math.max(0, maxPay - hb);

  // Basis-Kandidaten (immer klein möglich)
  const small = [100, 200, 300];
  const mid = [400, 500, 700, 900, 1100];
  // big skaliert mit Budget (damit bei 100k auch mal 5k–20k drin ist)
  const bigBase = [1200, 1500, 2000, 2500, 3000, 4000, 5000, 7500, 10000, 15000, 20000];
  const big = bigBase.filter((x) => x <= Math.max(1500, Math.round(budget * 0.25))); // big max 25% Budget

  // weights
  let wSmall = 0.40;
  let wMid = 0.40;
  let wBig = 0.20;

  // Difficulty: härter => weniger small, mehr big
  if (dLow === "hard" || dLow === "schwer") { wSmall -= 0.08; wBig += 0.08; }
  if (dLow === "veryhard" || dLow === "sehrhart") { wSmall -= 0.12; wBig += 0.12; }
  if (dLow === "easy" || dLow === "leicht") { wSmall += 0.10; wBig -= 0.10; }

  // Specials: mehr big (und öfter overtake)
  const anySpecial = !!(sf.starter || sf.pseudo || sf.subLegendary || sf.legendary || sf.mythical);
  if (anySpecial) { wSmall -= 0.06; wBig += 0.06; }
  if (sf.legendary || sf.mythical) { wSmall -= 0.08; wBig += 0.08; }

  // Behavior influence: sniper eher big jumps
  const b1n = normalizeBehavior(b1);
  const b2n = normalizeBehavior(b2);
  const sniperLike = (b1n === "sniper" || b2n === "sniper");
  if (sniperLike) { wSmall -= 0.10; wBig += 0.10; }

  // clamp weights
  wSmall = clamp(wSmall, 0.10, 0.70);
  wBig = clamp(wBig, 0.05, 0.60);
  wMid = clamp(1 - wSmall - wBig, 0.10, 0.70);

  function pickWeightedStep() {
    const r = Math.random();
    if (r < wSmall) return pick(small);
    if (r < wSmall + wMid) return pick(mid);
    return pick(big.length ? big : mid);
  }

  // gelegentlicher “pressure jump”: bei Specials/VeryHard/LastPick
  let inc;
  const pressureChance =
    (isLast ? 0.40 : 0.0) +
    ((dLow === "veryhard" || dLow === "sehrhart") ? 0.18 : 0.0) +
    (sf.legendary || sf.mythical ? 0.22 : (anySpecial ? 0.10 : 0.0));

  if (room >= 800 && Math.random() < clamp(pressureChance, 0, 0.65)) {
    // springe einen spürbaren Teil der verfügbaren “room” (aber nicht direkt all-in)
    const lo = isLast ? 0.45 : 0.28;
    const hi = isLast ? 0.85 : 0.62;
    const frac = lo + Math.random() * (hi - lo);
    inc = Math.round(room * frac);
    // runde auf 100
    inc = Math.ceil(inc / 100) * 100;
  } else {
    inc = pickWeightedStep();
  }

  // Mindest-Increment + incFloor
  if (tune.incFloor) inc = Math.max(inc, tune.incFloor);
  inc = Math.max(minBidIncrement, inc);

  // Zielgebot
  let bid = hb + inc;
  bid = Math.ceil(bid / 100) * 100;

  // nicht über maxPay
  if (bid > maxPay) bid = Math.floor(maxPay / 100) * 100;

  // Safety
  if (bid <= hb) return null;
if (bid > budget) bid = Math.floor(budget / 100) * 100;

// ✅ SAFE-STEAL REGEL
const htBud = Number(highestTeamBudget ?? 0);

if (
  highestTeamId &&
  highestTeamId !== bot.teamId &&
  hb > 0 &&
  myBudget >= hb + minBidIncrement &&
  htBud > 0 &&
  htBud <= hb + minBidIncrement
) {
  const stealBid = hb + minBidIncrement;

  if (bid < stealBid) {
    bid = stealBid;
  }
}

if (bid <= hb) return null;

return bid;

}
