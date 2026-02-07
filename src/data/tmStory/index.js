// src/data/tmStory/index.js

// Eintrag-Schema:
// {
//   order: 1,
//   title: "Solarstrahl",
//   where: "Ort / NPC / Route / etc.",
//   requirements: { badges: ["Steinorden"], hms: ["Zerschneider"] },
//   notes: "Optionaler Hinweis"
// }

export const TM_STORY_BY_GEN = {
  1: [],
  2: [],
   3: [
    {
      order: 1,
      title: "Schaufler",
      where: "Metarost City – Haus",
      requirements: { badges: ["Steinorden"], hms: [] },
      notes: "Früh praktisch für Backtracking.",},],
  4: [],
  5: [],
  6: [],
  7: [],
  72: [],
  32: [],
  42: [],
  52: [],
  62: [],
};

export const TM_STORY_GEN_OPTIONS = [
  { gen: 1, label: "Gen 1" },
  { gen: 2, label: "Gen 2" },
  { gen: 3, label: "Gen 3" },
  { gen: 4, label: "Gen 4" },
  { gen: 5, label: "Gen 5" },
  { gen: 6, label: "Gen 6" },
  { gen: 7, label: "Gen 7" },
  { gen: 72, label: "Gen 7.2 (US/UM)" },
  { gen: 32, label: "Gen 3.2 (FR/BG)" },
  { gen: 42, label: "Gen 4.2 (HG/SS)" },
  { gen: 52, label: "Gen 5.2 (S2/W2)" },
  { gen: 62, label: "Gen 6.2 (OR/AS)" },
];
