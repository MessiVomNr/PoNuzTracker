// bis Gen 6 gibt es neue Fossilien; Gen 7 hat keine neuen Fossilien (revived mostly older ones)
export const FOSSILS = [
  { key: "old-amber", label: "Altbernstein" , maxGen: 1 },
  { key: "helix", label: "Helixfossil", maxGen: 1 },
  { key: "dome", label: "Domfossil", maxGen: 1 },

  { key: "root", label: "Wurzelfossil", maxGen: 3 },
  { key: "claw", label: "Krallenfossil", maxGen: 3 },

  { key: "skull", label: "Kopffossil", maxGen: 4 },
  { key: "armor", label: "Panzerfossil", maxGen: 4 },

  { key: "cover", label: "Deckelfossil", maxGen: 5 },
  { key: "plume", label: "Federfossil", maxGen: 5 },

  { key: "jaw", label: "Kieferfossil", maxGen: 6 },
  { key: "sail", label: "Flossenfossil", maxGen: 6 },
];

// “Gen 7” Pool == bis Gen 6 (keine neuen Fossilien in Gen 7)
export function getFossilPoolForRunGen(genNumber) {
  let maxGen = 3;
  if ([4,5,42,52].includes(genNumber)) maxGen = 5;
  if ([6,62].includes(genNumber)) maxGen = 6;
  if ([7,72].includes(genNumber)) maxGen = 6; // effektiv Gen 6 Fossilien

  // Gen 1-3 und 32 => bis 3
  if ([1,2,3,32].includes(genNumber)) maxGen = 3;

  return FOSSILS.filter(f => f.maxGen <= maxGen);
}