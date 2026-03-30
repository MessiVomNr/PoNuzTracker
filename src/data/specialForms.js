// src/data/specialForms.js

const normalize = (value) =>
  String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");

export const SPECIAL_FORMS = {
  mega: [
    "mega venusaur",
    "mega charizard x",
    "mega charizard y",
    "mega blastoise",
    "mega beedrill",
    "mega pidgeot",
    "mega alakazam",
    "mega slowbro",
    "mega gengar",
    "mega kangaskhan",
    "mega pinsir",
    "mega gyarados",
    "mega aerodactyl",
    "mega mewtwo x",
    "mega mewtwo y",
    "mega ampharos",
    "mega steelix",
    "mega scizor",
    "mega heracross",
    "mega houndoom",
    "mega tyranitar",
    "mega sceptile",
    "mega blaziken",
    "mega swampert",
    "mega gardevoir",
    "mega sableye",
    "mega mawile",
    "mega aggron",
    "mega medicham",
    "mega manectric",
    "mega sharpedo",
    "mega camerupt",
    "mega altaria",
    "mega banette",
    "mega absol",
    "mega glalie",
    "mega salamence",
    "mega metagross",
    "mega latias",
    "mega latios",
    "mega rayquaza",
    "mega lopunny",
    "mega garchomp",
    "mega lucario",
    "mega abomasnow",
    "mega gallade",
    "mega audino",
    "mega diancie"
  ],

  gigantamax: [
    "gigantamax venusaur",
    "gigantamax charizard",
    "gigantamax blastoise",
    "gigantamax butterfree",
    "gigantamax pikachu",
    "gigantamax meowth",
    "gigantamax machamp",
    "gigantamax gengar",
    "gigantamax kingler",
    "gigantamax lapras",
    "gigantamax eevee",
    "gigantamax snorlax",
    "gigantamax garbodor",
    "gigantamax melmetal",
    "gigantamax rillaboom",
    "gigantamax cinderace",
    "gigantamax inteleon",
    "gigantamax corviknight",
    "gigantamax orbeetle",
    "gigantamax drednaw",
    "gigantamax coalossal",
    "gigantamax flapple",
    "gigantamax appletun",
    "gigantamax sandaconda",
    "gigantamax toxtricity",
    "gigantamax centiskorch",
    "gigantamax hatterene",
    "gigantamax grimmsnarl",
    "gigantamax alcremie",
    "gigantamax copperajah",
    "gigantamax duraludon",
    "gigantamax urshifu single strike",
    "gigantamax urshifu rapid strike"
  ],

  special: [
    "giratina altered",
    "giratina origin",
    "deoxys attack",
    "deoxys defense",
    "deoxys speed",
    "shaymin sky",
    "rotom heat",
    "rotom wash",
    "rotom frost",
    "rotom fan",
    "rotom mow",
    "kyurem black",
    "kyurem white",
    "hoopa unbound",
    "necrozma dusk mane",
    "necrozma dawn wings",
    "ultra necrozma",
    "zacian crowned",
    "zamazenta crowned",
    "eternamax eternatus",
    "palafin hero",
    "ogerpon wellspring",
    "ogerpon hearthflame",
    "ogerpon cornerstone",
    "terapagos stellar"
  ]
};

const lookup = Object.entries(SPECIAL_FORMS).reduce((acc, [group, list]) => {
  list.forEach((name) => {
    acc[normalize(name)] = group;
  });
  return acc;
}, {});

export function getSpecialFormType(name) {
  return lookup[normalize(name)] || null;
}

export function isSpecialForm(name) {
  return !!getSpecialFormType(name);
}

export function getSpecialFormLabel(name) {
  const type = getSpecialFormType(name);

  if (type === "mega") return "Mega";
  if (type === "gigantamax") return "Gigadynamax";
  if (type === "special") return "Sonderform";

  return null;
}