import React from "react";
import { useNavigate } from "react-router-dom";
import controllerIcon from "../assets/Controller.png";
import "./guessStyles.css";
import "./typeTrainer.css";
import "./gamesHubLayout.css";

// Übersicht über alle Wissenstrainings – bestehende Spielrouten bleiben erhalten.
export default function KnowledgeTrainerMenu() {
  const navigate = useNavigate();
  return (
    <main className="games-page games-hub-page type-trainer-page">
      <section className="games-hub-panel">
        <button type="button" className="games-hub-back-button"
          onClick={() => navigate("/games")}>
          <span className="games-hub-back-arrow">‹</span> Zurück
        </button>
        <header className="games-hub-header">
          <h1>Wissenstrainer</h1>
        </header>
        <div className="games-hub-card-grid">
          <button type="button" className="games-hub-card games-hub-card-primary"
            onClick={() => navigate("/games/type-trainer")}>
            <span className="games-hub-card-icon games-hub-card-icon-muted">
              <span className="knowledge-hub-type-icon" aria-hidden="true">2×</span>
            </span>
            <span className="games-hub-card-content">
              <span className="games-hub-card-title">Typen-Trainer</span>
              <span className="games-hub-card-text">
                Typeneffektivität und Pokémon-Typen erraten.
              </span>
            </span>
            <span className="games-hub-card-arrow">›</span>
          </button>
          <button type="button" className="games-hub-card games-hub-card-primary"
            onClick={() => navigate("/games/knowledge-training")}>
            <span className="games-hub-card-icon games-hub-card-icon-muted">
              <span className="knowledge-hub-question-icon" aria-hidden="true">?</span>
            </span>
            <span className="games-hub-card-content">
              <span className="games-hub-card-title">Pokémon-Wissenstraining</span>
              <span className="games-hub-card-text">
                Wissen üben – mit frei wählbaren Themen und Endlosmodus.
              </span>
            </span>
            <span className="games-hub-card-arrow">›</span>
          </button>
          <button type="button" className="games-hub-card games-hub-card-primary games-hub-card-wide"
            onClick={() => navigate("/games/nuzlocke-exam")}>
            <span className="games-hub-card-icon games-hub-card-icon-muted">
              <img className="games-hub-controller-img" src={controllerIcon} alt="" />
            </span>
            <span className="games-hub-card-content">
              <span className="games-hub-card-title">Nuzlocke-Eignungstest</span>
              <span className="games-hub-card-text">
                Allgemeine Prüfungen und Generationen-Tests.
              </span>
            </span>
            <span className="games-hub-card-arrow">›</span>
          </button>
        </div>
        <div className="type-trainer-menu-home">
          <button type="button" className="type-trainer-secondary"
            onClick={() => navigate("/")}>Zur Startseite</button>
        </div>
      </section>
    </main>
  );
}
