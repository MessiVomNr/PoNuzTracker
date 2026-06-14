// src/games/pokemonFormPool.js

export const FORM_GROUPS = [
  { key: "normal", label: "Normal" },
  { key: "mega", label: "Mega" },
  { key: "primal", label: "Proto" },
  { key: "regional", label: "Regional" },
  { key: "special", label: "Spezial" },
];

export const DEFAULT_ENABLED_FORM_GROUPS = {
  normal: true,
  mega: false,
  primal: false,
  regional: false,
  special: false,
};

export function getPoolEntryKey(entry) {
  if (!entry) return "";
  if (typeof entry === "number") return `normal:${entry}`;
  return `${entry.group || "normal"}:${entry.apiName || entry.dexId}`;
}

export function getSelectedFormBucket(enabledFormGroups) {
  const active = FORM_GROUPS
    .filter((group) => !!enabledFormGroups?.[group.key])
    .map((group) => group.key);

  if (active.length === 1 && active[0] === "normal") return "normal";
  if (active.length === FORM_GROUPS.length) return "allforms";
  if (!active.length) return "none";

  return active.join("-");
}

export function getSelectedFormLabel(enabledFormGroups) {
  const active = FORM_GROUPS.filter((group) => !!enabledFormGroups?.[group.key]);

  if (!active.length) return "Keine Formen";
  if (active.length === 1 && active[0].key === "normal") return "Normal";
  if (active.length === FORM_GROUPS.length) return "Alle Formen";

  return active.map((group) => group.label).join(" + ");
}

export function buildPokemonPool(enabledGens, enabledFormGroups, genRanges) {
  const selectedGens = Array.isArray(enabledGens) ? enabledGens : [];
  const pool = [];

  if (enabledFormGroups?.normal) {
    selectedGens.forEach((gen) => {
      const range = genRanges?.[gen];
      if (!range) return;

      const [from, to] = range;
      for (let dexId = from; dexId <= to; dexId += 1) {
        pool.push({
          group: "normal",
          dexId,
          speciesId: dexId,
          apiName: String(dexId),
        });
      }
    });
  }

  EXTRA_FORM_ENTRIES.forEach((entry) => {
    if (!enabledFormGroups?.[entry.group]) return;
    if (!selectedGens.includes(entry.gen)) return;
    pool.push(entry);
  });

  return pool;
}

export const EXTRA_FORM_ENTRIES = [
  // Mega
  { group: "mega", gen: 1, speciesId: 3, apiName: "venusaur-mega", formLabel: "Mega" },
  { group: "mega", gen: 1, speciesId: 6, apiName: "charizard-mega-x", formLabel: "Mega X" },
  { group: "mega", gen: 1, speciesId: 6, apiName: "charizard-mega-y", formLabel: "Mega Y" },
  { group: "mega", gen: 1, speciesId: 9, apiName: "blastoise-mega", formLabel: "Mega" },
  { group: "mega", gen: 1, speciesId: 15, apiName: "beedrill-mega", formLabel: "Mega" },
  { group: "mega", gen: 1, speciesId: 18, apiName: "pidgeot-mega", formLabel: "Mega" },
  { group: "mega", gen: 1, speciesId: 65, apiName: "alakazam-mega", formLabel: "Mega" },
  { group: "mega", gen: 1, speciesId: 80, apiName: "slowbro-mega", formLabel: "Mega" },
  { group: "mega", gen: 1, speciesId: 94, apiName: "gengar-mega", formLabel: "Mega" },
  { group: "mega", gen: 1, speciesId: 115, apiName: "kangaskhan-mega", formLabel: "Mega" },
  { group: "mega", gen: 1, speciesId: 127, apiName: "pinsir-mega", formLabel: "Mega" },
  { group: "mega", gen: 1, speciesId: 130, apiName: "gyarados-mega", formLabel: "Mega" },
  { group: "mega", gen: 1, speciesId: 142, apiName: "aerodactyl-mega", formLabel: "Mega" },
  { group: "mega", gen: 1, speciesId: 150, apiName: "mewtwo-mega-x", formLabel: "Mega X" },
  { group: "mega", gen: 1, speciesId: 150, apiName: "mewtwo-mega-y", formLabel: "Mega Y" },

  { group: "mega", gen: 2, speciesId: 181, apiName: "ampharos-mega", formLabel: "Mega" },
  { group: "mega", gen: 2, speciesId: 208, apiName: "steelix-mega", formLabel: "Mega" },
  { group: "mega", gen: 2, speciesId: 212, apiName: "scizor-mega", formLabel: "Mega" },
  { group: "mega", gen: 2, speciesId: 214, apiName: "heracross-mega", formLabel: "Mega" },
  { group: "mega", gen: 2, speciesId: 229, apiName: "houndoom-mega", formLabel: "Mega" },
  { group: "mega", gen: 2, speciesId: 248, apiName: "tyranitar-mega", formLabel: "Mega" },

  { group: "mega", gen: 3, speciesId: 254, apiName: "sceptile-mega", formLabel: "Mega" },
  { group: "mega", gen: 3, speciesId: 257, apiName: "blaziken-mega", formLabel: "Mega" },
  { group: "mega", gen: 3, speciesId: 260, apiName: "swampert-mega", formLabel: "Mega" },
  { group: "mega", gen: 3, speciesId: 282, apiName: "gardevoir-mega", formLabel: "Mega" },
  { group: "mega", gen: 3, speciesId: 302, apiName: "sableye-mega", formLabel: "Mega" },
  { group: "mega", gen: 3, speciesId: 303, apiName: "mawile-mega", formLabel: "Mega" },
  { group: "mega", gen: 3, speciesId: 306, apiName: "aggron-mega", formLabel: "Mega" },
  { group: "mega", gen: 3, speciesId: 308, apiName: "medicham-mega", formLabel: "Mega" },
  { group: "mega", gen: 3, speciesId: 310, apiName: "manectric-mega", formLabel: "Mega" },
  { group: "mega", gen: 3, speciesId: 319, apiName: "sharpedo-mega", formLabel: "Mega" },
  { group: "mega", gen: 3, speciesId: 323, apiName: "camerupt-mega", formLabel: "Mega" },
  { group: "mega", gen: 3, speciesId: 334, apiName: "altaria-mega", formLabel: "Mega" },
  { group: "mega", gen: 3, speciesId: 354, apiName: "banette-mega", formLabel: "Mega" },
  { group: "mega", gen: 3, speciesId: 359, apiName: "absol-mega", formLabel: "Mega" },
  { group: "mega", gen: 3, speciesId: 362, apiName: "glalie-mega", formLabel: "Mega" },
  { group: "mega", gen: 3, speciesId: 373, apiName: "salamence-mega", formLabel: "Mega" },
  { group: "mega", gen: 3, speciesId: 376, apiName: "metagross-mega", formLabel: "Mega" },
  { group: "mega", gen: 3, speciesId: 380, apiName: "latias-mega", formLabel: "Mega" },
  { group: "mega", gen: 3, speciesId: 381, apiName: "latios-mega", formLabel: "Mega" },

  { group: "mega", gen: 4, speciesId: 428, apiName: "lopunny-mega", formLabel: "Mega" },
  { group: "mega", gen: 4, speciesId: 445, apiName: "garchomp-mega", formLabel: "Mega" },
  { group: "mega", gen: 4, speciesId: 448, apiName: "lucario-mega", formLabel: "Mega" },
  { group: "mega", gen: 4, speciesId: 460, apiName: "abomasnow-mega", formLabel: "Mega" },
  { group: "mega", gen: 4, speciesId: 475, apiName: "gallade-mega", formLabel: "Mega" },

  { group: "mega", gen: 5, speciesId: 531, apiName: "audino-mega", formLabel: "Mega" },
  { group: "mega", gen: 6, speciesId: 719, apiName: "diancie-mega", formLabel: "Mega" },

  // Proto
  { group: "primal", gen: 3, speciesId: 382, apiName: "kyogre-primal", formLabel: "Proto" },
  { group: "primal", gen: 3, speciesId: 383, apiName: "groudon-primal", formLabel: "Proto" },

  // Regionalformen
  { group: "regional", gen: 1, speciesId: 19, apiName: "rattata-alola", formLabel: "Alola" },
  { group: "regional", gen: 1, speciesId: 20, apiName: "raticate-alola", formLabel: "Alola" },
  { group: "regional", gen: 1, speciesId: 26, apiName: "raichu-alola", formLabel: "Alola" },
  { group: "regional", gen: 1, speciesId: 27, apiName: "sandshrew-alola", formLabel: "Alola" },
  { group: "regional", gen: 1, speciesId: 28, apiName: "sandslash-alola", formLabel: "Alola" },
  { group: "regional", gen: 1, speciesId: 37, apiName: "vulpix-alola", formLabel: "Alola" },
  { group: "regional", gen: 1, speciesId: 38, apiName: "ninetales-alola", formLabel: "Alola" },
  { group: "regional", gen: 1, speciesId: 50, apiName: "diglett-alola", formLabel: "Alola" },
  { group: "regional", gen: 1, speciesId: 51, apiName: "dugtrio-alola", formLabel: "Alola" },
  { group: "regional", gen: 1, speciesId: 52, apiName: "meowth-alola", formLabel: "Alola" },
  { group: "regional", gen: 1, speciesId: 53, apiName: "persian-alola", formLabel: "Alola" },
  { group: "regional", gen: 1, speciesId: 74, apiName: "geodude-alola", formLabel: "Alola" },
  { group: "regional", gen: 1, speciesId: 75, apiName: "graveler-alola", formLabel: "Alola" },
  { group: "regional", gen: 1, speciesId: 76, apiName: "golem-alola", formLabel: "Alola" },
  { group: "regional", gen: 1, speciesId: 88, apiName: "grimer-alola", formLabel: "Alola" },
  { group: "regional", gen: 1, speciesId: 89, apiName: "muk-alola", formLabel: "Alola" },
  { group: "regional", gen: 1, speciesId: 103, apiName: "exeggutor-alola", formLabel: "Alola" },
  { group: "regional", gen: 1, speciesId: 105, apiName: "marowak-alola", formLabel: "Alola" },

  { group: "regional", gen: 1, speciesId: 52, apiName: "meowth-galar", formLabel: "Galar" },
  { group: "regional", gen: 1, speciesId: 77, apiName: "ponyta-galar", formLabel: "Galar" },
  { group: "regional", gen: 1, speciesId: 78, apiName: "rapidash-galar", formLabel: "Galar" },
  { group: "regional", gen: 1, speciesId: 79, apiName: "slowpoke-galar", formLabel: "Galar" },
  { group: "regional", gen: 1, speciesId: 80, apiName: "slowbro-galar", formLabel: "Galar" },
  { group: "regional", gen: 1, speciesId: 83, apiName: "farfetchd-galar", formLabel: "Galar" },
  { group: "regional", gen: 1, speciesId: 110, apiName: "weezing-galar", formLabel: "Galar" },
  { group: "regional", gen: 1, speciesId: 122, apiName: "mr-mime-galar", formLabel: "Galar" },
  { group: "regional", gen: 1, speciesId: 144, apiName: "articuno-galar", formLabel: "Galar" },
  { group: "regional", gen: 1, speciesId: 145, apiName: "zapdos-galar", formLabel: "Galar" },
  { group: "regional", gen: 1, speciesId: 146, apiName: "moltres-galar", formLabel: "Galar" },
  { group: "regional", gen: 2, speciesId: 199, apiName: "slowking-galar", formLabel: "Galar" },
  { group: "regional", gen: 2, speciesId: 222, apiName: "corsola-galar", formLabel: "Galar" },
  { group: "regional", gen: 3, speciesId: 263, apiName: "zigzagoon-galar", formLabel: "Galar" },
  { group: "regional", gen: 3, speciesId: 264, apiName: "linoone-galar", formLabel: "Galar" },
  { group: "regional", gen: 5, speciesId: 554, apiName: "darumaka-galar", formLabel: "Galar" },
  { group: "regional", gen: 5, speciesId: 555, apiName: "darmanitan-galar-standard", formLabel: "Galar" },
  { group: "regional", gen: 5, speciesId: 562, apiName: "yamask-galar", formLabel: "Galar" },
  { group: "regional", gen: 5, speciesId: 618, apiName: "stunfisk-galar", formLabel: "Galar" },

  { group: "regional", gen: 1, speciesId: 58, apiName: "growlithe-hisui", formLabel: "Hisui" },
  { group: "regional", gen: 1, speciesId: 59, apiName: "arcanine-hisui", formLabel: "Hisui" },
  { group: "regional", gen: 1, speciesId: 100, apiName: "voltorb-hisui", formLabel: "Hisui" },
  { group: "regional", gen: 1, speciesId: 101, apiName: "electrode-hisui", formLabel: "Hisui" },
  { group: "regional", gen: 2, speciesId: 157, apiName: "typhlosion-hisui", formLabel: "Hisui" },
  { group: "regional", gen: 2, speciesId: 211, apiName: "qwilfish-hisui", formLabel: "Hisui" },
  { group: "regional", gen: 2, speciesId: 215, apiName: "sneasel-hisui", formLabel: "Hisui" },
  { group: "regional", gen: 5, speciesId: 503, apiName: "samurott-hisui", formLabel: "Hisui" },
  { group: "regional", gen: 5, speciesId: 549, apiName: "lilligant-hisui", formLabel: "Hisui" },
  { group: "regional", gen: 5, speciesId: 570, apiName: "zorua-hisui", formLabel: "Hisui" },
  { group: "regional", gen: 5, speciesId: 571, apiName: "zoroark-hisui", formLabel: "Hisui" },
  { group: "regional", gen: 5, speciesId: 628, apiName: "braviary-hisui", formLabel: "Hisui" },
  { group: "regional", gen: 6, speciesId: 705, apiName: "sliggoo-hisui", formLabel: "Hisui" },
  { group: "regional", gen: 6, speciesId: 706, apiName: "goodra-hisui", formLabel: "Hisui" },
  { group: "regional", gen: 6, speciesId: 713, apiName: "avalugg-hisui", formLabel: "Hisui" },
  { group: "regional", gen: 7, speciesId: 724, apiName: "decidueye-hisui", formLabel: "Hisui" },

  { group: "regional", gen: 1, speciesId: 128, apiName: "tauros-paldea-combat-breed", formLabel: "Paldea" },
  { group: "regional", gen: 2, speciesId: 194, apiName: "wooper-paldea", formLabel: "Paldea" },

  // Spezialformen mit eigenen Stats
  { group: "special", gen: 3, speciesId: 386, apiName: "deoxys-attack", formLabel: "Angriff" },
  { group: "special", gen: 3, speciesId: 386, apiName: "deoxys-defense", formLabel: "Verteidigung" },
  { group: "special", gen: 3, speciesId: 386, apiName: "deoxys-speed", formLabel: "Initiative" },
  { group: "special", gen: 4, speciesId: 479, apiName: "rotom-heat", formLabel: "Hitze" },
  { group: "special", gen: 4, speciesId: 479, apiName: "rotom-wash", formLabel: "Wasch" },
  { group: "special", gen: 4, speciesId: 479, apiName: "rotom-frost", formLabel: "Frost" },
  { group: "special", gen: 4, speciesId: 479, apiName: "rotom-fan", formLabel: "Wirbel" },
  { group: "special", gen: 4, speciesId: 479, apiName: "rotom-mow", formLabel: "Schneid" },
  { group: "special", gen: 4, speciesId: 487, apiName: "giratina-origin", formLabel: "Urform" },
  { group: "special", gen: 4, speciesId: 492, apiName: "shaymin-sky", formLabel: "Zenitform" },
  { group: "special", gen: 5, speciesId: 641, apiName: "tornadus-therian", formLabel: "Tiergeistform" },
  { group: "special", gen: 5, speciesId: 642, apiName: "thundurus-therian", formLabel: "Tiergeistform" },
  { group: "special", gen: 5, speciesId: 645, apiName: "landorus-therian", formLabel: "Tiergeistform" },
  { group: "special", gen: 5, speciesId: 646, apiName: "kyurem-black", formLabel: "Schwarz" },
  { group: "special", gen: 5, speciesId: 646, apiName: "kyurem-white", formLabel: "Weiss" },
  { group: "special", gen: 6, speciesId: 681, apiName: "aegislash-blade", formLabel: "Klingenform" },
  { group: "special", gen: 6, speciesId: 720, apiName: "hoopa-unbound", formLabel: "Entfesselt" },
  { group: "special", gen: 7, speciesId: 745, apiName: "lycanroc-midnight", formLabel: "Mitternacht" },
  { group: "special", gen: 7, speciesId: 745, apiName: "lycanroc-dusk", formLabel: "Zwielicht" },
  { group: "special", gen: 7, speciesId: 746, apiName: "wishiwashi-school", formLabel: "Schwarmform" },
  { group: "special", gen: 7, speciesId: 800, apiName: "necrozma-dusk", formLabel: "Abendmähne" },
  { group: "special", gen: 7, speciesId: 800, apiName: "necrozma-dawn", formLabel: "Morgenschwingen" },
  { group: "special", gen: 7, speciesId: 800, apiName: "necrozma-ultra", formLabel: "Ultra" },
  { group: "special", gen: 8, speciesId: 888, apiName: "zacian-crowned", formLabel: "Koenig des Schwertes" },
  { group: "special", gen: 8, speciesId: 889, apiName: "zamazenta-crowned", formLabel: "Koenig des Schildes" },
  { group: "special", gen: 8, speciesId: 898, apiName: "calyrex-ice", formLabel: "Schimmelreiter" },
  { group: "special", gen: 8, speciesId: 898, apiName: "calyrex-shadow", formLabel: "Rappenreiter" },
];