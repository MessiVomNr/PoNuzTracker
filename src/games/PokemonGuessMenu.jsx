// src/games/PokemonGuessMenu.jsx
import React from "react";
import { useNavigate } from "react-router-dom";
import "./guessStyles.css";

function PokemonSilhouetteIcon({ dexId, size }) {
  return (
    <span className="games-hub-card-icon games-hub-card-icon-muted" aria-hidden="true">
      <img
        className="pokemon-guess-menu-sprite"
        src={`https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${dexId}.png`}
        alt=""
        style={{
          "--pokemon-guess-menu-sprite-size": `${size}px`,
        }}
      />
    </span>
  );
}

function DailyIcon() {
  return (
    <span className="games-hub-card-icon games-hub-card-icon-muted" aria-hidden="true">
      <span className="pokemon-guess-menu-daily-icon">24</span>
    </span>
  );
}

export default function PokemonGuessMenu() {
  const navigate = useNavigate();

  return (
    <main className="games-page games-hub-page pokemon-guess-menu-page">
      <section className="games-hub-panel pokemon-guess-menu-panel">
        <button
          type="button"
          className="games-hub-back-button"
          onClick={() => navigate("/games")}
        >
          <span className="games-hub-back-arrow">‹</span>
          Zurück
        </button>

        <header className="games-hub-header pokemon-guess-menu-header">
          <h1>Wer ist dieses Pokémon?</h1>
          <p>
            Wähle deinen Spielmodus und teste, wie gut du Pokémon an Silhouette,
            Pixelbild, Typen, Stats und Hinweisen erkennst.
          </p>
        </header>

        <div className="games-hub-card-grid pokemon-guess-menu-grid">
          <button
            type="button"
            className="games-hub-card games-hub-card-primary"
            onClick={() => navigate("/games/pokemon-guess/solo")}
          >
            <PokemonSilhouetteIcon dexId={327} size={66} />

            <span className="games-hub-card-content">
              <span className="games-hub-card-title">
                Solo spielen
              </span>
              <span className="games-hub-card-text">
                Einzelspieler-Modus mit Stufen, Tipps, Score, Endless und Highscore.
              </span>
            </span>

            <span className="games-hub-card-arrow">›</span>
          </button>

          <button
            type="button"
            className="games-hub-card games-hub-card-primary"
            onClick={() => navigate("/games/pokemon-guess/online")}
          >
            <PokemonSilhouetteIcon dexId={925} size={66} />

            <span className="games-hub-card-content">
              <span className="games-hub-card-title">
                Online spielen
              </span>
              <span className="games-hub-card-text">
                Lobby erstellen, Freunde einladen und mit Timer oder Buzzer
                gegeneinander spielen.
              </span>
            </span>

            <span className="games-hub-card-arrow">›</span>
          </button>

          <button
            type="button"
            className="games-hub-card games-hub-card-disabled pokemon-guess-menu-card-wide"
            disabled
          >
            <DailyIcon />

            <span className="games-hub-card-content">
              <span className="games-hub-card-title">
                Daily Challenge
              </span>
              <span className="games-hub-card-text">
                Später: Jeden Tag dasselbe Pokémon für alle.
              </span>
            </span>

            <span className="games-hub-card-arrow">›</span>
          </button>
        </div>
      </section>
    </main>
  );
}