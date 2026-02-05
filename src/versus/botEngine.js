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
  "raushauer",
  "sniper",
  "sammler",
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
  "taktiker",
  "blockierer",
  "fanboy",
  "endgame",
  "adaptive",
  "abfucker",
  "revanchist",
  "pingpong",
  "nachahmer",
  "saboteur",
  "mitlaeufer",
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
  if (difficulty === "easy") return [100, 200];
  if (difficulty === "normal") return [100, 200, 300, 500];
  if (difficulty === "hard") return [200, 300, 500, 700, 900];
  return [100, 300, 500, 800, 1200, 1500]; // chaos
}

function desireFromSpecial({ starter, pseudo, subLegendary, legendary, mythical }, difficulty) {
  let d = 0.35;

  if (starter) d += 0.18;
  if (pseudo) d += 0.22;
  if (subLegendary) d += 0.30;
  if (legendary) d += 0.45;
  if (mythical) d += 0.55;

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

  if (b === "raushauer") {
    // deutlich weniger Reserve, deutlich mehr MaxPay, öfter bieten
    s.reserveMult *= 0.45;
    s.maxPayMult *= 1.28;
    // kleine Schritte wirken natürlicher
    s.incFloor = Math.max(s.incFloor, 100);
    s.freqAdd += 0.20;
  }

if (b === "sniper") {
  const t = Number(ctx?.remainingSec ?? 999);

  // Frühphase: zurückhalten
  if (t > 5) {
    s.freqAdd -= 0.35;       // deutlich weniger bieten
    s.reserveMult *= 1.10;   // mehr Budget behalten
  }

  // Midphase
  if (t <= 5 && t > 2) {
    s.freqAdd -= 0.10;
    s.maxPayMult *= 1.05;
  }

  // Endphase: Sniper aktivieren
  if (t <= 2) {
    s.freqAdd += 0.40;       // massiv öfter bieten
    s.maxPayMult *= 1.18;    // aggressiver
    s.incFloor = Math.max(s.incFloor, 300);
  }
}

  if (b === "sammler") {
    const anySpecial = !!(
      ctx?.specialFlags?.starter ||
      ctx?.specialFlags?.pseudo ||
      ctx?.specialFlags?.subLegendary ||
      ctx?.specialFlags?.legendary ||
      ctx?.specialFlags?.mythical
    );
    s.desire += anySpecial ? 0.10 : 0.05;
    s.freqAdd += 0.04;
  }

  if (b === "blockierer") {
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
    s.reserveMult *= 0.65;
    s.maxPayMult *= 1.10;
    s.freqAdd += 0.06;
  }

  if (b === "absicherer") {
    s.reserveMult *= 1.55;
    s.maxPayMult *= 0.95;
    s.freqAdd -= 0.05;
  }

  if (b === "taktiker") {
    s.freqAdd -= 0.08;
    s.incFloor = Math.max(s.incFloor, 200);
    s.maxPayMult *= 1.02;
  }

  if (b === "paniker") {
    if (Number(ctx?.highestBid || 0) >= 600) s.freqAdd += 0.10;
    if (Number(ctx?.picksLeft || 0) <= 2) {
      s.freqAdd += 0.12;
      s.reserveMult *= 0.70;
    }
  }

  if (b === "fruehstarter") {
    if (Number(ctx?.highestBid || 0) === 0) s.freqAdd += 0.18;
  }

  if (b === "late_bloomer") {
    if (Number(ctx?.picksLeft || 0) <= 3) s.freqAdd += 0.16;
    else s.freqAdd -= 0.06;
  }

  if (b === "eifersuechtig" || b === "revanchist") {
    if (Number(ctx?.highestBid || 0) >= 500) {
      s.maxPayMult *= 1.10;
      s.freqAdd += 0.08;
    }
  }

  if (b === "saboteur" || b === "abfucker" || b === "blockierer") {
    if (Number(ctx?.picksLeft || 0) <= 2) {
      s.maxPayMult *= 1.08;
      s.incFloor = Math.max(s.incFloor, 300);
    }
  }

  if (b === "mitlaeufer" || b === "nachahmer" || b === "pingpong") {
    s.freqAdd += 0.03;
    s.incFloor = Math.max(s.incFloor, 100);
  }

  if (b === "verweigerer") {
    const anySpecial = !!(
      ctx?.specialFlags?.starter ||
      ctx?.specialFlags?.pseudo ||
      ctx?.specialFlags?.subLegendary ||
      ctx?.specialFlags?.legendary ||
      ctx?.specialFlags?.mythical
    );
    if (anySpecial) {
      s.freqAdd -= 0.25;
      s.maxPayMult *= 0.88;
    }
  }

  if (b === "fanboy") {
    const anySpecial = !!(
      ctx?.specialFlags?.starter ||
      ctx?.specialFlags?.pseudo ||
      ctx?.specialFlags?.subLegendary ||
      ctx?.specialFlags?.legendary ||
      ctx?.specialFlags?.mythical
    );
    if (anySpecial) {
      s.desire += 0.12;
      s.freqAdd += 0.06;
    }
  }

  if (b === "meta") {
    const anySpecial = !!(
      ctx?.specialFlags?.pseudo ||
      ctx?.specialFlags?.subLegendary ||
      ctx?.specialFlags?.legendary ||
      ctx?.specialFlags?.mythical
    );
    if (anySpecial) {
      s.desire += 0.10;
      s.maxPayMult *= 1.06;
      s.freqAdd += 0.04;
    }
  }

  if (b === "anti_meta") {
    const anySpecial = !!(
      ctx?.specialFlags?.pseudo ||
      ctx?.specialFlags?.subLegendary ||
      ctx?.specialFlags?.legendary ||
      ctx?.specialFlags?.mythical
    );
    if (anySpecial) {
      s.desire -= 0.08;
      s.freqAdd -= 0.06;
      s.maxPayMult *= 0.95;
    } else {
      s.freqAdd += 0.03;
    }
  }

  return s;
}

/**
 * Entscheidet ein Bot-Gebot.
 *
 * avgPrice (Markt-Anker) muss von außen kommen:
 *   avgPrice = SummeBudgetsAll / verbleibendeMonsTotal
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
  // avgPrice = Markt-Anker: (Summe Budgets aller Teams) / (verbleibende Pokémon insgesamt)
  // -> wird in DuoVersusAuction pro Runde berechnet und hier nur als Referenz genutzt
  avgPrice,
  evoMaxTotal,
  remainingSec,
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
  const baseFreq = bidFrequencyForDifficulty(diff);

  let tune = { desire: 0, reserveMult: 1, maxPayMult: 1, incFloor: 0, freqAdd: 0 };
  tune = applyBehaviorTuning(tune, b1, {
  specialFlags,
  highestBid: hb,
  picksLeft,
  remainingSec,
});
  if (String(diff).toLowerCase() === "veryhard" || String(diff).toLowerCase() === "sehrhart") {
    tune = applyBehaviorTuning(tune, b2, { specialFlags, highestBid: hb, picksLeft });
  }

  const isLastForFreq = Number(picksLeft || 0) <= 1;
  let freq = clamp(baseFreq + tune.freqAdd + (isLastForFreq ? 0.15 : 0), 0.05, 0.98);

  // Opening: deutlich öfter (damit mehr "Leben" reinkommt)
  if (hb === 0) freq = clamp(freq + 0.18, 0.05, 0.98);

  // Endgame: aggressiver
  const pLeft2 = Number(picksLeft || 0);
  if (pLeft2 <= 2) freq = clamp(freq + 0.18, 0.05, 0.98);
  if (pLeft2 <= 1) freq = clamp(freq + 0.22, 0.05, 0.98);

  if (Math.random() > freq) return null;

  let desire = desireFromSpecial(specialFlags || {}, diff);
  desire = clamp(desire + (tune.desire || 0), 0.05, 0.98);

  const isLast = Number(picksLeft || 0) <= 1;
  const picks = Math.max(1, Number(picksLeft || 1));

  let endgameMult = 1.0;
  if (picks <= 3) endgameMult *= 1.15;
  if (picks <= 2) endgameMult *= 1.30;
  if (picks <= 1) endgameMult *= 1.55;

  const sf = specialFlags || {};
  let specialMult = 1.0;
  if (sf.starter) specialMult *= 1.12;
  if (sf.pseudo) specialMult *= 1.22;
  if (sf.subLegendary) specialMult *= 1.35;
  if (sf.legendary) specialMult *= 1.60;
  if (sf.mythical) specialMult *= 1.75;

  // ✅ BST/Power-Multiplikator (stärker, damit 600+ wirklich teurer wird)
  // 300 => ~0.55, 450 => ~1.00, 600 => ~1.55, 720 => ~1.80
  const evoT = Number(evoMaxTotal ?? 0);
  let bstMult = 1.0;
  if (evoT > 0) {
    bstMult = clamp(0.55 + ((evoT - 300) / 300) * 1.0, 0.55, 1.80);
  }

  const dLow = String(diff || "normal").toLowerCase();
  let diffAgg = 1.0;
  if (dLow === "easy" || dLow === "leicht") diffAgg = 0.82;
  if (dLow === "normal" || dLow === "mittel") diffAgg = 1.00;
  if (dLow === "hard" || dLow === "schwer") diffAgg = 1.18;
  if (dLow === "veryhard" || dLow === "sehrhart") diffAgg = 1.32;
  if (dLow === "chaos" || dLow === "chaotisch") diffAgg = 1.10;

  // Reserve
  const reserveFactor = clamp(bot.reserveBias, 0, 1);
  let reserve = Math.round(budget * (0.02 + 0.08 * reserveFactor)); // ~2%..10%
  reserve = Math.round(reserve * (tune.reserveMult || 1));

  const pLeft = Number(picksLeft || 0);
  if (pLeft <= 2) reserve = Math.round(reserve * 0.25);
  if (pLeft <= 1) reserve = Math.round(reserve * 0.10);

  const basePerPick = budget / picks;
  const ap = Number(avgPrice || 0);

  if (ap > 0) {
    const affordability = clamp(basePerPick / Math.max(1, ap), 0.4, 6.0);
    reserve = Math.round(reserve * clamp(1 / affordability, 0.30, 1.00));
    if (affordability >= 2.5) reserve = Math.round(reserve * 0.85);
  }

  if (dLow === "hard" || dLow === "schwer") reserve = Math.round(reserve * 0.70);
  if (dLow === "veryhard" || dLow === "sehrhart") reserve = Math.round(reserve * 0.55);
  if (dLow === "chaos" || dLow === "chaotisch") reserve = Math.round(reserve * 0.60);

  if (isLast) reserve = Math.round(reserve * 0.10);

  reserve = clamp(reserve, 0, budget);

  // ✅ MaxPay: orientiert sich primär am Markt-Anker (avgPrice)
  const spendable = clamp(budget - reserve, 0, budget);
  const anchor = ap > 0 ? ap : basePerPick;

  // Marktwert des aktuellen Mons relativ zum Anchor
  let targetPay =
    anchor *
    (0.70 + 0.95 * desire) *
    specialMult *
    bstMult *
    diffAgg *
    endgameMult;

  // Budget pro Pick vs Markt: leicht anpassen
  if (ap > 0) {
    const affordability = clamp(basePerPick / Math.max(1, ap), 0.35, 3.0);
    targetPay *= clamp(0.75 + 0.35 * affordability, 0.55, 1.65);

    if (hb <= ap * 0.65) targetPay *= 1.06;
    if (!isLast && hb >= ap * 1.35) targetPay *= 0.92;
  }

  let maxPay = Math.round(
    Math.min(
      budget,
      Math.max(
        hb + minBidIncrement,
        targetPay,
        spendable * (0.55 + 0.75 * desire) * specialMult
      )
    )
  );

  if (isLast) {
    maxPay = Math.round(budget * clamp(0.88 + 0.12 * desire, 0.88, 0.995));
  }

  maxPay = Math.round(maxPay * (tune.maxPayMult || 1));
  maxPay = clamp(maxPay, 0, budget);

  if (maxPay <= hb) return null;

  const room = Math.max(0, maxPay - hb);

  const small = [100, 200, 300];
  const mid = [400, 500, 700, 900, 1100];
  const bigBase = [1200, 1500, 2000, 2500, 3000, 4000, 5000, 7500, 10000, 15000, 20000];
  const big = bigBase.filter((x) => x <= Math.max(1500, Math.round(budget * 0.25)));

  let wSmall = 0.40;
  let wMid = 0.40;
  let wBig = 0.20;

  if (dLow === "hard" || dLow === "schwer") {
    wSmall -= 0.08;
    wBig += 0.08;
  }
  if (dLow === "veryhard" || dLow === "sehrhart") {
    wSmall -= 0.12;
    wBig += 0.12;
  }
  if (dLow === "easy" || dLow === "leicht") {
    wSmall += 0.10;
    wBig -= 0.10;
  }

  const anySpecial = !!(sf.starter || sf.pseudo || sf.subLegendary || sf.legendary || sf.mythical);
  if (anySpecial) {
    wSmall -= 0.06;
    wBig += 0.06;
  }
  if (sf.legendary || sf.mythical) {
    wSmall -= 0.08;
    wBig += 0.08;
  }

  const b1n = normalizeBehavior(b1);
  const b2n = normalizeBehavior(b2);
  const sniperLike = b1n === "sniper" || b2n === "sniper";
  if (sniperLike) {
    wSmall -= 0.10;
    wBig += 0.10;
  }

  wSmall = clamp(wSmall, 0.10, 0.70);
  wBig = clamp(wBig, 0.05, 0.60);
  wMid = clamp(1 - wSmall - wBig, 0.10, 0.70);

  function pickWeightedStep() {
    const r = Math.random();
    if (r < wSmall) return pick(small);
    if (r < wSmall + wMid) return pick(mid);
    return pick(big.length ? big : mid);
  }

  let inc;
  const pressureChance =
    (isLast ? 0.40 : 0.0) +
    (dLow === "veryhard" || dLow === "sehrhart" ? 0.18 : 0.0) +
    (sf.legendary || sf.mythical ? 0.22 : anySpecial ? 0.10 : 0.0);

  if (room >= 800 && Math.random() < clamp(pressureChance, 0, 0.65)) {
    const lo = isLast ? 0.45 : 0.28;
    const hi = isLast ? 0.85 : 0.62;
    const frac = lo + Math.random() * (hi - lo);
    inc = Math.round(room * frac);
    inc = Math.ceil(inc / 100) * 100;
  } else {
    inc = pickWeightedStep();
  }

  if (tune.incFloor) inc = Math.max(inc, tune.incFloor);
  inc = Math.max(minBidIncrement, inc);

  let bid = hb + inc;
  bid = Math.ceil(bid / 100) * 100;

  if (bid > maxPay) bid = Math.floor(maxPay / 100) * 100;

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
    if (bid < stealBid) bid = stealBid;
  }

  if (bid <= hb) return null;
  return bid;
}
