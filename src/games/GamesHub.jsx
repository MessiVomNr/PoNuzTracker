import React from "react";
import { useNavigate } from "react-router-dom";
import "./guessStyles.css";
import "./gamesHubLayout.css";

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

        <div className="games-hub-sections">
          <section className="games-hub-section">
            <h2 className="games-hub-section-title">Einzelspiele</h2>
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

            </div>
          </section>
          <section className="games-hub-section">
            <h2 className="games-hub-section-title">Wissen &amp; Training</h2>
            <div className="games-hub-card-grid">
              <button type="button"
                className="games-hub-card games-hub-card-primary games-hub-card-wide"
                onClick={() => navigate("/games/knowledge-trainer")}>
                <span className="games-hub-card-icon games-hub-card-icon-muted">
                  <span className="knowledge-hub-question-icon" aria-hidden="true">?</span>
                </span>
                <span className="games-hub-card-content">
                  <span className="games-hub-card-title">Wissenstrainer</span>
                  <span className="games-hub-card-text">
                    Typen lernen, Pokémon-Wissen üben und Prüfungen ablegen.
                  </span>
                </span>
                <span className="games-hub-card-arrow">›</span>
              </button>
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}