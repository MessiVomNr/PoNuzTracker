import React from "react";
import "./generationStarter.css";

// Je Seitenaufruf EIN Starter-Typ für alle Generationen.
// Ein neuer Aufruf wählt zufällig einen anderen der drei Typen, damit
// nicht jedes Mal nur Pflanzenstarter gezeigt werden.
export const STARTER_GROUPS = {
  grass: [1, 152, 252, 387, 495, 650, 722, 810, 906],
  fire: [4, 155, 255, 390, 498, 653, 725, 813, 909],
  water: [7, 158, 258, 393, 501, 656, 728, 816, 912],
};
const GROUP_NAMES = Object.keys(STARTER_GROUPS);
function chooseStarterGroup() {
  let previous = "";
  try { previous = localStorage.getItem("ponuz-last-starter-group") || ""; } catch { /* optional */ }
  const options = GROUP_NAMES.filter((group) => group !== previous);
  const next = options[Math.floor(Math.random() * options.length)] || "grass";
  try { localStorage.setItem("ponuz-last-starter-group", next); } catch { /* optional */ }
  return next;
}
export const ACTIVE_STARTER_GROUP = chooseStarterGroup();
export function getStarterSpecies(gen, group = ACTIVE_STARTER_GROUP) {
  return STARTER_GROUPS[group]?.[Number(gen) - 1] || STARTER_GROUPS.grass[0];
}

export function GenerationStarter({ gen }) {
  return (
    <img
      className="trainer-gen-starter"
      src={"https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/" + getStarterSpecies(gen) + ".png"}
      alt=""
      loading="lazy"
      aria-hidden="true"
    />
  );
}

export function GenerationFilter({ generations, onToggle, onOnly, onAll, onClear, title = "Generationen" }) {
  return (
    <div className="trainer-generation-filter">
      <div className="trainer-generation-filter-header">
        <strong>{title}</strong>
        <div className="trainer-generation-header-actions">
          <button type="button" onClick={onAll}>Alle</button>
          <button type="button" onClick={onClear}>Keine</button>
        </div>
      </div>
      <div className="trainer-generation-list">
        {Array.from({ length: 9 }, (_, index) => index + 1).map((gen) => {
          const active = generations.includes(gen);
          return (
            <div key={gen} className={"trainer-generation-option" + (active ? " is-active" : "")}>
              <button
                type="button" className="trainer-generation-toggle"
                aria-pressed={active}
                onClick={() => onToggle(gen)}
              >
                <GenerationStarter gen={gen} />
                <span>Gen {gen}</span>
                <span className="trainer-generation-check" aria-hidden="true">{active ? "✓" : ""}</span>
              </button>
              <button type="button" className="trainer-generation-only" onClick={() => onOnly(gen)} title={"Nur Gen " + gen}>
                Nur
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
