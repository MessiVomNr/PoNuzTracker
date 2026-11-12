import React from "react";
import { useNavigate } from "react-router-dom";
import "./guessStyles.css";
import "./typeTrainer.css";

export default function TypeTrainerMenu() {
  const navigate = useNavigate();
  return (
    <main className="games-page games-hub-page type-trainer-page">
      <section className="games-hub-panel">
        <button type="button" className="games-hub-back-button" onClick={() => navigate("/games/knowledge-trainer")}>
          <span className="games-hub-back-arrow">‹</span> Zurück
        </button>
        <header className="games-hub-header">
          <h1>Typen-Trainer</h1>
          <p>Lerne alle 18 Pokémon-Typen – ganz entspannt oder auf Punktejagd.</p>
        </header>
        <div className="games-hub-card-grid">
          <button type="button" className="games-hub-card games-hub-card-primary" onClick={() => navigate("/games/type-trainer/effectiveness")}>
            <span className="games-hub-card-icon games-hub-card-icon-muted"><span className="type-trainer-menu-icon" aria-hidden="true">2×</span></span>
            <span className="games-hub-card-content">
              <span className="games-hub-card-title">Typeneffektivität</span>
              <span className="games-hub-card-text">Sehr effektiv, resistent oder immun? Finde alle passenden Typen.</span>
            </span>
            <span className="games-hub-card-arrow">›</span>
          </button>
          <button type="button" className="games-hub-card games-hub-card-primary" onClick={() => navigate("/games/type-trainer/pokemon-types")}>
            <span className="games-hub-card-icon games-hub-card-icon-muted">
              <img className="games-hub-charizard-sprite" src="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/448.png" alt="" />
            </span>
            <span className="games-hub-card-content">
              <span className="games-hub-card-title">Pokémon-Typen erraten</span>
              <span className="games-hub-card-text">Ordne Pokémon ihren Typen zu – Generationen und Rundenzahl einstellbar.</span>
            </span>
            <span className="games-hub-card-arrow">›</span>
          </button>

        </div>
        <div className="type-trainer-menu-home">
          <button type="button" className="type-trainer-secondary" onClick={() => navigate("/")}>Zur Startseite</button>
        </div>
      </section>
    </main>
  );
}
