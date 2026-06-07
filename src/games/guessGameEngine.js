// src/games/guessGameEngine.js

export const GENERATION_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9];

export const GUESS_PLAY_MODES = {
  TIPS: "tips",
  PIXEL: "pixel",
  DISTORTED: "distorted",
  SILHOUETTE: "silhouette",
  STATS: "stats",
};

export const GUESS_CLUE_TYPES = {
  TYPES: "types",
  GEN: "gen",
  ABILITY: "ability",
  MOVES: "moves",
  STATS: "stats",
  CATEGORY: "category",
  SILHOUETTE: "silhouette",
  PIXEL_CUSTOM: "pixel_custom",
  DISTORTED_CUSTOM: "distorted_custom",
  IMAGE: "image",
};

export const GUESS_REVEAL_MODES = {
  DIRECT: "direct",
  WRONG_GUESS: "wrong_guess",
  TIME: "time",
  MANUAL: "manual",
};

export const GUESS_PLAY_MODE_LABELS = {
  [GUESS_PLAY_MODES.TIPS]: "Tipps",
  [GUESS_PLAY_MODES.PIXEL]: "Verpixelt",
  [GUESS_PLAY_MODES.DISTORTED]: "Verzerrt",
  [GUESS_PLAY_MODES.SILHOUETTE]: "Silhouette",
  [GUESS_PLAY_MODES.STATS]: "Stats",
};

export const GUESS_CLUE_LABELS = {
  [GUESS_CLUE_TYPES.TYPES]: "Typen",
  [GUESS_CLUE_TYPES.GEN]: "Generation",
  [GUESS_CLUE_TYPES.ABILITY]: "Fähigkeit",
  [GUESS_CLUE_TYPES.MOVES]: "Attacken",
  [GUESS_CLUE_TYPES.STATS]: "Stats",
  [GUESS_CLUE_TYPES.CATEGORY]: "Kategorie",
  [GUESS_CLUE_TYPES.SILHOUETTE]: "Silhouette",
  [GUESS_CLUE_TYPES.PIXEL_CUSTOM]: "Verpixelt",
  [GUESS_CLUE_TYPES.DISTORTED_CUSTOM]: "Verzerrt",
  [GUESS_CLUE_TYPES.IMAGE]: "Normales Bild",
};

export const GUESS_REVEAL_LABELS = {
  [GUESS_REVEAL_MODES.DIRECT]: "Direkt",
  [GUESS_REVEAL_MODES.WRONG_GUESS]: "Nach falschem Guess",
  [GUESS_REVEAL_MODES.TIME]: "Nach Zeit",
  [GUESS_REVEAL_MODES.MANUAL]: "Manuell",
};

export const DEFAULT_TIP_ORDER = [
  GUESS_CLUE_TYPES.TYPES,
  GUESS_CLUE_TYPES.GEN,
  GUESS_CLUE_TYPES.ABILITY,
  GUESS_CLUE_TYPES.MOVES,
  GUESS_CLUE_TYPES.STATS,
  GUESS_CLUE_TYPES.SILHOUETTE,
  GUESS_CLUE_TYPES.IMAGE,
];

export const DEFAULT_GUESS_SETTINGS = {
  playMode: GUESS_PLAY_MODES.PIXEL,
  revealMode: GUESS_REVEAL_MODES.TIME,
  totalRounds: 10,
  secondsPerClue: 8,
  selectedGens: [1, 2, 3],

  tipOrder: DEFAULT_TIP_ORDER,

  pixel: {
    strength: 6,
    black: false,
  },

  distorted: {
    horizontal: 6,
    vertical: 6,
    black: true,
  },
};

export function shuffleArray(array) {
  return [...array].sort(() => Math.random() - 0.5);
}

export function pickRandomPokemon(pokemonPool) {
  if (!pokemonPool?.length) {
    throw new Error("Pokemon pool is empty.");
  }

  const index = Math.floor(Math.random() * pokemonPool.length);
  return pokemonPool[index];
}

export function normalizePokemonName(value) {
  return String(value || "")
    .toLowerCase()
    .replaceAll("ä", "ae")
    .replaceAll("ö", "oe")
    .replaceAll("ü", "ue")
    .replaceAll("ß", "ss")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

export function doesGuessMatch(target, guess) {
  if (!target || !guess) return false;

  const normalizedGuess = normalizePokemonName(guess);
  const validNames = [target.name, ...(target.aliases || [])];

  return validNames.some(
    (name) => normalizePokemonName(name) === normalizedGuess
  );
}

export function getPokemonNameSuggestions(input, pokemonPool, limit = 10) {
  const query = normalizePokemonName(input);

  if (!query || !pokemonPool?.length) return [];

  const startsWith = pokemonPool.filter((pokemon) =>
    normalizePokemonName(pokemon.name).startsWith(query)
  );

  const includes = pokemonPool.filter((pokemon) => {
    const name = normalizePokemonName(pokemon.name);
    return !name.startsWith(query) && name.includes(query);
  });

  return [...startsWith, ...includes].slice(0, limit);
}

export function getEffectiveRevealMode(settings) {
  if (
    settings.playMode === GUESS_PLAY_MODES.SILHOUETTE ||
    settings.playMode === GUESS_PLAY_MODES.STATS
  ) {
    return GUESS_REVEAL_MODES.DIRECT;
  }

  return settings.revealMode;
}

export function buildClueOrderFromSettings(settings) {
  const revealMode = getEffectiveRevealMode(settings);

  if (settings.playMode === GUESS_PLAY_MODES.TIPS) {
    return settings.tipOrder.map((type) => ({ type }));
  }

  if (settings.playMode === GUESS_PLAY_MODES.SILHOUETTE) {
    return [{ type: GUESS_CLUE_TYPES.SILHOUETTE }];
  }

  if (settings.playMode === GUESS_PLAY_MODES.STATS) {
    return [{ type: GUESS_CLUE_TYPES.STATS }];
  }

  if (settings.playMode === GUESS_PLAY_MODES.PIXEL) {
    const strength = Math.max(1, Math.min(6, Number(settings.pixel.strength) || 6));
    const black = Boolean(settings.pixel.black);

    if (revealMode === GUESS_REVEAL_MODES.DIRECT) {
      return [{ type: GUESS_CLUE_TYPES.PIXEL_CUSTOM, strength, black }];
    }

    const clues = [];

    for (let level = strength; level >= 1; level -= 1) {
      clues.push({
        type: GUESS_CLUE_TYPES.PIXEL_CUSTOM,
        strength: level,
        black,
      });
    }

    clues.push({ type: GUESS_CLUE_TYPES.IMAGE });
    return clues;
  }

  if (settings.playMode === GUESS_PLAY_MODES.DISTORTED) {
    const horizontal = Math.max(
      1,
      Math.min(6, Number(settings.distorted.horizontal ?? settings.distorted.strength) || 6)
    );
    const vertical = Math.max(
      1,
      Math.min(6, Number(settings.distorted.vertical ?? settings.distorted.strength) || 6)
    );
    const black = Boolean(settings.distorted.black);
    const maxSteps = Math.max(horizontal, vertical);

    if (revealMode === GUESS_REVEAL_MODES.DIRECT) {
      return [
        {
          type: GUESS_CLUE_TYPES.DISTORTED_CUSTOM,
          horizontal,
          vertical,
          black,
        },
      ];
    }

    const clues = [];

    for (let step = maxSteps; step >= 1; step -= 1) {
      const horizontalLevel = Math.max(
        1,
        Math.ceil((horizontal * step) / maxSteps)
      );
      const verticalLevel = Math.max(
        1,
        Math.ceil((vertical * step) / maxSteps)
      );

      clues.push({
        type: GUESS_CLUE_TYPES.DISTORTED_CUSTOM,
        horizontal: horizontalLevel,
        vertical: verticalLevel,
        black,
      });
    }

    clues.push({ type: GUESS_CLUE_TYPES.IMAGE });
    return clues;
  }

  return DEFAULT_TIP_ORDER.map((type) => ({ type }));
}

export function sanitizeClueOrder(clueOrder) {
  const validTypes = Object.values(GUESS_CLUE_TYPES);
  const cleanOrder = [];

  for (const clue of clueOrder || []) {
    const normalizedClue = typeof clue === "string" ? { type: clue } : clue;

    if (validTypes.includes(normalizedClue?.type)) {
      cleanOrder.push(normalizedClue);
    }
  }

  return cleanOrder.length > 0
    ? cleanOrder
    : DEFAULT_TIP_ORDER.map((type) => ({ type }));
}

export function createGuessRound(settings, pokemonPool) {
  const target = pickRandomPokemon(pokemonPool);
  const clueOrder = sanitizeClueOrder(settings.clueOrder);

  return {
    id: `${Date.now()}-${Math.random()}`,
    target,
    clues: clueOrder,
    clueIndex: 0,
    answered: false,
    correct: false,
    gaveUp: false,
    selectedName: "",
    wrongGuesses: 0,
    gainedScore: 0,
  };
}

export function getVisibleClues(round, revealMode) {
  if (!round) return [];

  if (revealMode === GUESS_REVEAL_MODES.DIRECT) {
    return round.clues;
  }

  return round.clues.slice(0, round.clueIndex + 1);
}

export function getScoreForClue(visibleClueCount, totalClues = visibleClueCount) {
  const maxScore = 300;
  const minScore = 40;

  const cluesTotal = Math.max(1, totalClues);
  const cluesUsed = Math.max(1, visibleClueCount);

  if (cluesTotal === 1) {
    return maxScore;
  }

  const deductionPerStep = Math.round((maxScore - minScore) / (cluesTotal - 1));

  return Math.max(minScore, maxScore - (cluesUsed - 1) * deductionPerStep);
}

export function getAvailableTipTypes() {
  return [
    GUESS_CLUE_TYPES.TYPES,
    GUESS_CLUE_TYPES.GEN,
    GUESS_CLUE_TYPES.ABILITY,
    GUESS_CLUE_TYPES.MOVES,
    GUESS_CLUE_TYPES.STATS,
    GUESS_CLUE_TYPES.CATEGORY,
    GUESS_CLUE_TYPES.SILHOUETTE,
    GUESS_CLUE_TYPES.IMAGE,
  ];
}
