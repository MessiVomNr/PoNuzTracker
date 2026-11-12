import React from "react";
import { useNavigate } from "react-router-dom";
import controllerIcon from "../assets/Controller.png";
import "./guessStyles.css";

function CharizardSilhouetteIcon() {
  return (
    <span className="games-hub-card-icon games-hub-card-icon-muted" aria-hidden="true">
      <img
        className="games-hub-charizard-sprite"
        src="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/6.png"
        alt=""
      />
    </span>
  );
}

function HigherLowerIcon() {
  return (
    <span className="games-hub-card-icon games-hub-card-icon-muted" aria-hidden="true">
      <span
        style={{
          display: "grid",
          placeItems: "center",
          width: "100%",
          height: "100%",
          fontSize: 34,
          fontWeight: 950,
          lineHeight: 1,
        }}
      >
        ⇅
      </span>
    </span>
  );
}

function ControllerIcon() {
  return (
    <span className="games-hub-card-icon games-hub-card-icon-muted" aria-hidden="true">
      <img
        className="games-hub-controller-img"
        src={controllerIcon}
        alt=""
      />
    </span>
  );
}

export default function GamesHub() {
  const navigate = useNavigate();

  return (
    <main className="games-page games-hub-page">
      <section className="games-hub-panel">
        <button
          type="button"
          className="games-hub-back-button"
          onClick={() => navigate("/")}
        >
          <span className="games-hub-back-arrow">‹</span>
          Zurück
        </button>

        <header className="games-hub-header">
          <h1>Pokémon Games</h1>
        </header>

        <div className="games-hub-card-grid">
          <button
            type="button"
            className="games-hub-card games-hub-card-primary"
            onClick={() => navigate("/games/pokemon-guess")}
          >
            <CharizardSilhouetteIcon />

            <span className="games-hub-card-content">
              <span className="games-hub-card-title">
                Wer ist dieses Pokémon?
              </span>
              <span className="games-hub-card-text">
                Errate Pokémon mit Silhouette, Pixelbild, Typen, Stats und mehr.
              </span>
            </span>

            <span className="games-hub-card-arrow">›</span>
          </button>

          <button
            type="button"
            className="games-hub-card games-hub-card-primary"
            onClick={() => navigate("/games/higher-lower")}
          >
            <HigherLowerIcon />

            <span className="games-hub-card-content">
              <span className="games-hub-card-title">
                Higher oder Lower
              </span>
              <span className="games-hub-card-text">
                Vergleiche Pokémon-Stats, BST oder jede Runde einen zufälligen Wert.
              </span>
            </span>

            <span className="games-hub-card-arrow">›</span>
          </button>

          <button
            type="button"
            className="games-hub-card games-hub-card-primary"
            onClick={() => navigate("/games/type-trainer")}
          >
            <span className="games-hub-card-icon games-hub-card-icon-muted">
              <span style={{ fontSize: 27, fontWeight: 950, color: "#c7d9ff" }} aria-hidden="true">2×</span>
            </span>
            <span className="games-hub-card-content">
              <span className="games-hub-card-title">Typen-Trainer</span>
              <span className="games-hub-card-text">
                Lerne Effektivitäten, Immunitäten und die Typen aller Pokémon.
              </span>
            </span>
            <span className="games-hub-card-arrow">›</span>
          </button>

          <button
            type="button"
            className="games-hub-card games-hub-card-primary"
            onClick={() => navigate("/games/knowledge-training")}
          >
            <span className="games-hub-card-icon games-hub-card-icon-muted">
              <span style={{ fontSize:29, color:"#c3d8ff", fontWeight:900 }} aria-hidden="true">?</span>
            </span>
            <span className="games-hub-card-content">
              <span className="games-hub-card-title">Pokémon-Wissenstraining</span>
              <span className="games-hub-card-text">
                Items, Stats, Fähigkeiten, Entwicklungen und Kampfmechaniken frei üben.
              </span>
            </span>
            <span className="games-hub-card-arrow">›</span>
          </button>

          <button
            type="button"
            className="games-hub-card games-hub-card-primary"
            onClick={() => navigate("/games/nuzlocke-exam")}
          >
            <ControllerIcon />

            <span className="games-hub-card-content">
              <span className="games-hub-card-title">Nuzlocke-Eignungstest</span>
              <span className="games-hub-card-text">
                Drei Prüfungen mit 30 Fragen aus zwölf Pokémon-Wissensgebieten.
              </span>
            </span>

            <span className="games-hub-card-arrow">›</span>
          </button>
        </div>
      </section>
    </main>
  );
}