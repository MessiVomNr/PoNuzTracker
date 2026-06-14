// src/games/PokemonGuessMenu.jsx
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import controllerIcon from "../assets/Controller.png";
import "./guessStyles.css";

const ROTATING_MENU_POKEMON = [
  { dexId: 25, size: 66 },   // Pikachu
  { dexId: 6, size: 56 },    // Glurak
  { dexId: 3, size: 58 },    // Bisaflor
  { dexId: 9, size: 58 },    // Turtok
  { dexId: 94, size: 62 },   // Gengar
  { dexId: 133, size: 64 },  // Evoli
  { dexId: 149, size: 58 },  // Dragoran
  { dexId: 150, size: 60 },  // Mewtu
  { dexId: 383, size: 54 },  // Groudon
  { dexId: 382, size: 54 },  // Kyogre
  { dexId: 384, size: 52 },  // Rayquaza
  { dexId: 448, size: 62 },  // Lucario
  { dexId: 130, size: 52 },  // Garados
];

function PokemonSpriteIcon() {
  const [pokemonIndex, setPokemonIndex] = useState(0);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setPokemonIndex((currentIndex) =>
        (currentIndex + 1) % ROTATING_MENU_POKEMON.length
      );
    }, 3000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  const currentPokemon = ROTATING_MENU_POKEMON[pokemonIndex];

  return (
    <span className="games-hub-card-icon games-hub-card-icon-muted" aria-hidden="true">
      <img
        key={currentPokemon.dexId}
        className="pokemon-guess-menu-sprite"
        src={`https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${currentPokemon.dexId}.png`}
        alt=""
        style={{
          "--pokemon-guess-menu-sprite-size": `${currentPokemon.size}px`,
        }}
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
            <PokemonSpriteIcon />

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
            <ControllerIcon />

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