// src/games/GamesHub.jsx
import React from "react";
import { useNavigate } from "react-router-dom";
import "./guessStyles.css";

export default function GamesHub() {
  const navigate = useNavigate();

  return (
    <div className="games-page">
      <div className="games-panel">
        <button className="games-back-button" onClick={() => navigate("/")}>
          Zurück
        </button>

        <h1>Pokémon Games</h1>
        <p className="games-subtitle">
          Kleine Pokémon-Minispiele für Solo und später Online mit Freunden.
        </p>

        <div className="games-grid">
          <button
            className="game-card"
            onClick={() => navigate("/games/pokemon-guess")}
          >
            <span className="game-card-title">Wer ist dieses Pokémon?</span>
            <span className="game-card-text">
              Errate Pokémon mit Silhouette, Pixelbild, Typen, Stats und mehr.
            </span>
          </button>

          <button className="game-card game-card-disabled" disabled>
            <span className="game-card-title">Weitere Games</span>
            <span className="game-card-text">
              Später kommen mehr Modi dazu.
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}