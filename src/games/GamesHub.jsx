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
            className="games-hub-card games-hub-card-disabled"
            disabled
          >
            <ControllerIcon />

            <span className="games-hub-card-content">
              <span className="games-hub-card-title">
                Weitere Games
              </span>
              <span className="games-hub-card-text">
                Später kommen mehr Modi dazu.
              </span>
            </span>

            <span className="games-hub-card-arrow">›</span>
          </button>
        </div>
      </section>
    </main>
  );
}