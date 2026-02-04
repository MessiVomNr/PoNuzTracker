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
  "none",
  "starterfreund",
  "sparer",
  "raushauer",
  "sniper",
  "sammler",
  "minimalist",
  "blockierer",
  "endgame",
  "chaos",
  "meta",
  "anti_meta",
  // (weitere können später ergänzt werden; nicht implementierte verhalten = neutral)
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
    const diff = DIFFS[Math.floor(Math.random() * DIFFS.length)];

    out.push({
      id: `bot:${idx1}`, // ✅ STABIL & EINFACH zu matchen
      // seedBase nur für Optik/Feeling
      name: `${name} #${Math.floor(10 + Math.random() * 90)}`,
      difficulty: diff,
      behavior1: "none",
      behavior2: "none",
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

  for (let i = 0; i < botConfigs.length; i++) {
    const cfg = botConfigs[i] || {};
    const teamId = `team${startIdx + i + 1}`; // ✅ team ist 1-based

    bots.push({
      id: String(cfg.id || `bot:${i + 1}`),
      teamId,
      name: String(cfg.name || `Bot #${i + 1}`),
      difficulty: String(cfg.difficulty || "normal"),
      behavior1: String(cfg.behavior1 || "none"),
      behavior2: String(cfg.behavior2 || "none"),
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
    s.reserveMult *= 0.70;
    s.maxPayMult *= 1.10;
    s.incFloor = Math.max(s.incFloor, 300);
    s.freqAdd += 0.10;
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
  minBidIncrement = 100,
  specialFlags,      // {legendary, mythical, starter, pseudo, subLegendary}
  picksLeft,         // wie viele Auktionen inkl. dieser noch kommen
  avgPrice,          // optional
}) {
  if (!bot) return null;

  const budget = clamp(myBudget, 0, 999999999);
  const hb = clamp(highestBid, 0, 999999999);
  if (highestTeamId === bot.teamId) return null; // nicht selbst überbieten
  if (budget < hb + minBidIncrement) return null;

  const diff = bot.difficulty || "normal";
  const b1 = bot.behavior1 || "none";
  const b2 = bot.behavior2 || "none";

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
  let freq = clamp(baseFreq + tune.freqAdd + (isLastForFreq ? 0.10 : 0), 0.05, 0.98);

  // Beim Opening (hb===0) lieber etwas öfter anbieten, sonst startet Runde oft nur durch Humans
  if (hb === 0) freq = clamp(freq + 0.08, 0.05, 0.98);

  if (Math.random() > freq) return null;


  // “Desire” = wie sehr will er dieses Pokémon
  let desire = desireFromSpecial(specialFlags || {}, diff);
  desire = clamp(desire + (tune.desire || 0), 0.05, 0.98);

  // Reserve-Gefühl (kann 0 sein) – aber variiert
  // reserveBias=0 => keine Reserve, reserveBias=1 => eher Reserve
  const reserveFactor = clamp(bot.reserveBias, 0, 1);
  let reserve = Math.round(budget * (0.05 + 0.18 * reserveFactor)); // ~5%..23%
  reserve = Math.round(reserve * (tune.reserveMult || 1));
  if (diff === "hard") reserve = Math.round(reserve * 0.6);
  if (diff === "chaos") reserve = Math.round(reserve * 0.4);

  // Letztes Pokémon: Reserve fast egal + aggressive cap
  const isLast = Number(picksLeft || 0) <= 1;
  if (isLast) reserve = Math.round(reserve * 0.15);

  // Max, das er für dieses Pokémon zahlen will
  // Je specialer & je “last pick” desto näher ans All-in
  let maxPay = Math.round((budget - reserve) * (0.55 + 0.45 * desire));
  if (isLast) maxPay = Math.round(budget * (0.85 + 0.15 * desire)); // sehr nah ans all-in
  maxPay = Math.round(maxPay * (tune.maxPayMult || 1));
  maxPay = clamp(maxPay, 0, budget);

  if (maxPay <= hb) return null;

  // Schritt wählen (mind. +100)
  const steps = bumpStep(diff);
  let inc = pick(steps);
  if (tune.incFloor) inc = Math.max(inc, tune.incFloor);

  // “Randomness” – manchmal nur +100, manchmal dicke Sprünge
  if (diff === "easy" && Math.random() < 0.6) inc = 100;
  if (diff === "normal" && Math.random() < 0.45) inc = 100;

  // Last pick: öfter größere jumps (damit es “all-in feeling” hat)
  if (isLast && Math.random() < 0.55) inc = Math.max(inc, 500);

  // Zielgebot
  let bid = hb + Math.max(minBidIncrement, inc);
  bid = Math.ceil(bid / 100) * 100;

  // nicht über maxPay
  if (bid > maxPay) {
    // wenn last pick, versucht er “bis maxPay” zu gehen
    bid = Math.floor(maxPay / 100) * 100;
  }

  // Safety
  if (bid <= hb) return null;
  if (bid > budget) bid = Math.floor(budget / 100) * 100;
  if (bid <= hb) return null;

  return bid;
}
