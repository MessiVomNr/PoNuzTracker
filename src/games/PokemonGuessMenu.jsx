// src/games/PokemonGuessMenu.jsx
import React from "react";
import { useNavigate } from "react-router-dom";
import "./guessStyles.css";

export default function PokemonGuessMenu() {
  const navigate = useNavigate();

  return (
    <div className="games-page">
      <div className="games-panel">
        <button className="games-back-button" onClick={() => navigate("/games")}>
          Zurück
        </button>

        <h1>Wer ist dieses Pokémon?</h1>
        <p className="games-subtitle">
          Errate Pokémon anhand von Silhouette, Pixelbild, Typen, Stats,
          Verzerrung und weiteren Hinweisen.
        </p>

        <div className="guess-mode-list">
          <button
            className="game-card"
            onClick={() => navigate("/games/pokemon-guess/solo")}
          >
            <span className="game-card-title">Solo spielen</span>
            <span className="game-card-text">
              Einzelspieler-Modus mit Stufen, Tipps und Score.
            </span>
          </button>

          <button
            className="game-card"
            onClick={() => navigate("/games/pokemon-guess/online")}
          >
            <span className="game-card-title">Online spielen</span>
            <span className="game-card-text">
              Lobby erstellen, Freunde einladen und mit Timer oder Buzzer
              gegeneinander spielen.
            </span>
          </button>

          <button className="game-card game-card-disabled" disabled>
            <span className="game-card-title">Daily Challenge</span>
            <span className="game-card-text">
              Später: Jeden Tag dasselbe Pokémon für alle.
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}