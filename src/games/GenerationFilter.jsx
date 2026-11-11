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
// Alle Generationsbilder einer Seite nutzen denselben Starter-Typ.
// Beim erneuten Betreten der Seite wird durch den Provider neu gewürfelt.
export const ACTIVE_STARTER_GROUP = "grass";
const StarterGroupContext = React.createContext(ACTIVE_STARTER_GROUP);

export function StarterThemeProvider({ children }) {
  const starterGroup = React.useContext(StarterGroupContext);
  return (
    <StarterGroupContext.Provider value={starterGroup}>
      {children}
    </StarterGroupContext.Provider>
  );
}
export function getStarterSpecies(gen, group = ACTIVE_STARTER_GROUP) {
  return STARTER_GROUPS[group]?.[Number(gen) - 1] || STARTER_GROUPS.grass[0];
}

export function GenerationStarter({ gen, group }) {
  const inheritedGroup = React.useContext(StarterGroupContext);
  const actualGroup = group || inheritedGroup;
  return (
    <img
      className="trainer-gen-starter"
      src={"https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/" + getStarterSpecies(gen, actualGroup) + ".png"}
      alt=""
      loading="lazy"
      aria-hidden="true"
    />
  );
}

export function GenerationFilter({ generations, onToggle, onOnly, onAll, onClear, title = "Generationen" }) {
  const [starterGroup] = React.useState(chooseStarterGroup);
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
                <GenerationStarter gen={gen} group={starterGroup} />
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
