// src/data/megaForms.js

// Mapping: Basis-DexID -> Mega/Sonderform(en) (PokeAPI Pokémon-IDs)
// id = PokeAPI "pokemon" id der Form (z.B. 10034 = Charizard-Mega-X)
// label = Anzeige-Text (kurz)

export const megaFormsByBaseDexId = {
  // Gen 1
  3: [{ id: 10033, label: "Mega" }], // Venusaur
  6: [
    { id: 10034, label: "Mega X" }, // Charizard X
    { id: 10035, label: "Mega Y" }, // Charizard Y
  ],
  9: [{ id: 10036, label: "Mega" }], // Blastoise
  15: [{ id: 10090, label: "Mega" }], // Beedrill
  18: [{ id: 10073, label: "Mega" }], // Pidgeot
  65: [{ id: 10037, label: "Mega" }], // Alakazam
  80: [{ id: 10071, label: "Mega" }], // Slowbro
  94: [{ id: 10038, label: "Mega" }], // Gengar
  115: [{ id: 10039, label: "Mega" }], // Kangaskhan
  127: [{ id: 10040, label: "Mega" }], // Pinsir
  130: [{ id: 10041, label: "Mega" }], // Gyarados
  142: [{ id: 10042, label: "Mega" }], // Aerodactyl
  150: [
    { id: 10043, label: "Mega X" }, // Mewtwo X
    { id: 10044, label: "Mega Y" }, // Mewtwo Y
  ],

  // Gen 2
  181: [{ id: 10045, label: "Mega" }], // Ampharos
  208: [{ id: 10072, label: "Mega" }], // Steelix
  212: [{ id: 10046, label: "Mega" }], // Scizor
  214: [{ id: 10047, label: "Mega" }], // Heracross
  229: [{ id: 10048, label: "Mega" }], // Houndoom
  248: [{ id: 10049, label: "Mega" }], // Tyranitar

  // Gen 3
  254: [{ id: 10065, label: "Mega" }], // Sceptile
  257: [{ id: 10050, label: "Mega" }], // Blaziken
  260: [{ id: 10064, label: "Mega" }], // Swampert
  282: [{ id: 10051, label: "Mega" }], // Gardevoir
  302: [{ id: 10066, label: "Mega" }], // Sableye
  303: [{ id: 10052, label: "Mega" }], // Mawile
  306: [{ id: 10053, label: "Mega" }], // Aggron
  308: [{ id: 10054, label: "Mega" }], // Medicham
  310: [{ id: 10055, label: "Mega" }], // Manectric
  319: [{ id: 10070, label: "Mega" }], // Sharpedo
  323: [{ id: 10087, label: "Mega" }], // Camerupt
  334: [{ id: 10067, label: "Mega" }], // Altaria
  354: [{ id: 10056, label: "Mega" }], // Banette
  359: [{ id: 10057, label: "Mega" }], // Absol
  362: [{ id: 10074, label: "Mega" }], // Glalie
  373: [{ id: 10089, label: "Mega" }], // Salamence
  376: [{ id: 10076, label: "Mega" }], // Metagross
  380: [{ id: 10062, label: "Mega" }], // Latias
  381: [{ id: 10063, label: "Mega" }], // Latios
  384: [{ id: 10079, label: "Mega" }], // Rayquaza

  // Gen 4
  428: [{ id: 10088, label: "Mega" }], // Lopunny
  445: [{ id: 10058, label: "Mega" }], // Garchomp
  448: [{ id: 10059, label: "Mega" }], // Lucario
  460: [{ id: 10060, label: "Mega" }], // Abomasnow

  // Gen 6
  475: [{ id: 10068, label: "Mega" }], // Gallade
  531: [{ id: 10069, label: "Mega" }], // Audino
  719: [{ id: 10075, label: "Mega" }], // Diancie
};

export const specialFormsByBaseDexId = {
  382: [{ id: 10077, label: "Proto" }], // Kyogre Primal
  383: [{ id: 10078, label: "Proto" }], // Groudon Primal
};
