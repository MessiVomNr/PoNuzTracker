import React from "react";
import "./generationStarter.css";

const FIRST_STARTERS = { 1: 1, 2: 152, 3: 252, 4: 387, 5: 495, 6: 650, 7: 722, 8: 810, 9: 906 };

export function GenerationStarter({ gen }) {
  return (
    <img
      className="trainer-gen-starter"
      src={"https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/" + FIRST_STARTERS[gen] + ".png"}
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
