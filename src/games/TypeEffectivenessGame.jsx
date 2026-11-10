import React, { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  POKEMON_TYPES, DAMAGE_OPTIONS, buildTypeQuestionDeck,
  getQuestionChoices, choiceMatchesQuestion, formatMultiplier,
  getTypeColor, getTypeLabel, getTypeIconUrl,
} from "./typeTrainerData";
import "./typeTrainer.css";

const SETTINGS_KEY = "ponuz-type-trainer-settings-v2";
const HIGHSCORE_KEY = "ponuz-type-trainer-effectiveness-best-v1";
const DEFAULT_SETTINGS = { direction: "mixed", multiplier: "mixed", targetKind: "mixed", rounds: 10 };

function readHighscore() {
  try { return Number(localStorage.getItem(HIGHSCORE_KEY)) || 0; }
  catch { return 0; }
}
function readSettings() {
  try {
    const value = JSON.parse(localStorage.getItem(SETTINGS_KEY));
    if (!value || typeof value !== "object") return DEFAULT_SETTINGS;
    return {
      direction: ["mixed", "attack", "defend"].includes(value.direction) ? value.direction : "mixed",
      multiplier: ["mixed", ...DAMAGE_OPTIONS.map((item) => item.key)].includes(value.multiplier) ? value.multiplier : "mixed",
      targetKind: ["mixed", "single", "dual"].includes(value.targetKind) ? value.targetKind : "mixed",
      rounds: [0, 10, 20, 30].includes(Number(value.rounds)) ? Number(value.rounds) : 10,
    };
  } catch { return DEFAULT_SETTINGS; }
}

function TypeLogo({ typeKey }) {
  return (
    <span className="type-trainer-logo-name" style={{ "--tt-color": getTypeColor(typeKey) }}>
      <img src={getTypeIconUrl(typeKey)} alt="" loading="lazy" className="type-trainer-type-icon" />
      <span>{getTypeLabel(typeKey)}</span>
    </span>
  );
}

function ChoiceButton({ choice, selected, feedback, correct, onClick }) {
  const wrong = Boolean(feedback && selected && !correct);
  return (
    <button type="button" aria-pressed={selected} disabled={Boolean(feedback)}
      className={[
        "type-trainer-type", choice.types.length > 1 ? "type-trainer-dual-choice" : "",
        selected ? "is-selected" : "",
        feedback && correct ? "is-answer" : "",
        wrong ? "is-wrong" : "",
      ].filter(Boolean).join(" ")}
      style={{ "--tt-color": getTypeColor(choice.types[0]) }} onClick={onClick}>
      <span className="type-trainer-choice-label">
        {choice.types.map((key) => <TypeLogo key={key} typeKey={key} />)}
      </span>
      {feedback && correct ? <span className="type-trainer-answer-mark" aria-label="Richtig">✓</span> : null}
      {wrong ? <span className="type-trainer-answer-mark" aria-label="Falsch">×</span> : null}
    </button>
  );
}

function questionText(question) {
  const multiplier = formatMultiplier(question.multiplier);
  if (question.direction === "attack") {
    if (question.targetKind === "dual") {
      return "Welche der folgenden Typenkombinationen nehmen durch " +
        getTypeLabel(question.attackType) + "-Attacken " + multiplier + " Schaden?";
    }
    return "Welche einzelnen Pokémon-Typen nehmen durch " +
      getTypeLabel(question.attackType) + "-Attacken " + multiplier + " Schaden?";
  }
  const types = question.defendingTypes.map(getTypeLabel).join(" / ");
  return "Welche Angriffstypen verursachen " + multiplier +
    " Schaden gegen ein Pokémon vom Typ " + types + "?";
}

export default function TypeEffectivenessGame() {
  const navigate = useNavigate();
  const [settings, setSettings] = useState(readSettings);
  const [started, setStarted] = useState(false);
  const [finished, setFinished] = useState(false);
  const [round, setRound] = useState(1);
  const [question, setQuestion] = useState(null);
  const [choices, setChoices] = useState([]);
  const [selected, setSelected] = useState([]);
  const [feedback, setFeedback] = useState(null);
  const [score, setScore] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [highscore, setHighscore] = useState(readHighscore);
  const [setupError, setSetupError] = useState("");
  const deckRef = useRef([]);

  function updateSetting(key, value) {
    setSettings((previous) => {
      const updated = { ...previous, [key]: value };
      try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(updated)); } catch { /* optional */ }
      return updated;
    });
    setSetupError("");
  }

  function presentQuestion(nextQuestion) {
    setQuestion(nextQuestion);
    setChoices(nextQuestion ? getQuestionChoices(nextQuestion) : []);
    setSelected([]);
    setFeedback(null);
  }

  function startGame() {
    const deck = buildTypeQuestionDeck(settings.direction, settings.multiplier, settings.targetKind);
    if (!deck.length) {
      setSetupError("Für diese Einstellungen gibt es keine passenden Fragen. Bitte eine andere Kombination wählen.");
      return;
    }
    deckRef.current = deck;
    setRound(1);
    setScore(0);
    setCorrectCount(0);
    setFinished(false);
    presentQuestion(deckRef.current.pop());
    setStarted(true);
  }

  function submit() {
    if (!question || feedback || !selected.length) return;
    const answers = choices.filter((choice) => choiceMatchesQuestion(question, choice)).map((choice) => choice.key);
    const correct = answers.length === selected.length && answers.every((key) => selected.includes(key));
    const nextScore = score + (correct ? 100 : 0);
    setScore(nextScore);
    if (correct) setCorrectCount((value) => value + 1);
    setFeedback({ correct, answers });
    if (nextScore > highscore) {
      setHighscore(nextScore);
      try { localStorage.setItem(HIGHSCORE_KEY, String(nextScore)); } catch { /* optional */ }
    }
  }

  function next() {
    if (!feedback) return;
    if ((settings.rounds && round >= settings.rounds) || !deckRef.current.length) {
      setFinished(true);
      return;
    }
    setRound((value) => value + 1);
    presentQuestion(deckRef.current.pop());
  }

  function toggle(key) {
    if (feedback) return;
    setSelected((current) => current.includes(key)
      ? current.filter((item) => item !== key)
      : [...current, key]);
  }

  const focusTypes = question
    ? question.direction === "attack" ? [question.attackType] : question.defendingTypes
    : [];

  return (
    <main className="games-page type-trainer-page">
      <section className="type-trainer-panel">
        <div className="type-trainer-topline">
          <button type="button" className="type-trainer-back" onClick={() => navigate("/games/type-trainer")}>
            <span aria-hidden="true">‹</span> Zurück
          </button>
          <button type="button" className="type-trainer-home-link" onClick={() => navigate("/")}>Zur Startseite</button>
        </div>
        <p className="type-trainer-eyebrow">Typen-Trainer / Effektivität</p>
        <h1>Typen-Matchups</h1>
        <p className="type-trainer-subtitle">
          Wähle alle passenden Antworten. Es gilt die aktuelle Typentabelle ohne Fähigkeiten,
          Items oder andere Effekte. Zwei Verteidigungstypen werden miteinander verrechnet.
        </p>

        {!started ? (
          <div className="type-trainer-setup">
            <label className="type-trainer-field">
              <span>Fragerichtung</span>
              <span className="type-trainer-select-shell">
                <select value={settings.direction} onChange={(event) => updateSetting("direction", event.target.value)}>
                  <option value="mixed">Gemischt</option>
                  <option value="attack">Angriff → Was trifft der Typ?</option>
                  <option value="defend">Verteidigung → Was trifft den Typ?</option>
                </select>
              </span>
            </label>
            <label className="type-trainer-field">
              <span>Schadensfaktor</span>
              <span className="type-trainer-select-shell">
                <select value={settings.multiplier} onChange={(event) => updateSetting("multiplier", event.target.value)}>
                  <option value="mixed">Gemischt (alle Multiplikatoren)</option>
                  {DAMAGE_OPTIONS.map((item) => (
                    <option key={item.key} value={item.key}>{item.label}</option>
                  ))}
                </select>
              </span>
            </label>
            <label className="type-trainer-field">
              <span>Verteidigungstypen</span>
              <span className="type-trainer-select-shell">
                <select value={settings.targetKind} onChange={(event) => updateSetting("targetKind", event.target.value)}>
                  <option value="mixed">Einzeltypen und Kombinationen</option>
                  <option value="single">Nur einzelne Typen</option>
                  <option value="dual">Nur Zweier-Kombinationen</option>
                </select>
              </span>
            </label>
            <label className="type-trainer-field">
              <span>Runden</span>
              <span className="type-trainer-select-shell">
                <select value={settings.rounds} onChange={(event) => updateSetting("rounds", Number(event.target.value))}>
                  <option value={10}>10 Runden</option>
                  <option value={20}>20 Runden</option>
                  <option value={30}>30 Runden</option>
                  <option value={0}>Endlos (bis alle Fragen gespielt sind)</option>
                </select>
              </span>
            </label>
            <div className="type-trainer-setup-note type-trainer-wide">
              <strong>So funktioniert es:</strong> Bei „Angriff“ siehst du einen Angriffstyp und suchst
              passende Verteidigungstypen. Bei „Verteidigung“ siehst du die Typen eines
              Pokémon und wählst alle Angriffstypen mit dem angegebenen Schaden.
              Bei Zweier-Kombinationen stehen übersichtliche Antwortmöglichkeiten zur Auswahl.
            </div>
            {setupError ? <p className="type-trainer-settings-error type-trainer-wide" role="alert">{setupError}</p> : null}
            <div className="type-trainer-setup-footer">
              <span>Bisheriger Rekord: <strong>{highscore} Punkte</strong></span>
              <button type="button" className="type-trainer-primary" onClick={startGame}>Training starten</button>
            </div>
          </div>
        ) : finished ? (
          <div className="type-trainer-finish" role="status">
            <span className="type-trainer-finish-number">{score}</span>
            <h2>Punkte erspielt</h2>
            <p>{correctCount} von {round} Aufgaben vollständig richtig.</p>
            <div className="type-trainer-actions">
              <button type="button" className="type-trainer-primary" onClick={startGame}>Nochmal spielen</button>
              <button type="button" className="type-trainer-secondary" onClick={() => setStarted(false)}>Einstellungen</button>
            </div>
          </div>
        ) : question ? (
          <>
            <div className="type-trainer-score-row">
              <span>Runde {round}{settings.rounds ? " / " + settings.rounds : " · Endlos"}</span>
              <span>{score} Punkte</span>
              <span>{correctCount} richtig</span>
            </div>
            <section className="type-trainer-question">
              <span className="type-trainer-eyebrow">
                {question.direction === "attack" ? "Angriff → Verteidigung" : "Verteidigung ← Angriff"}
                {" · "}{formatMultiplier(question.multiplier)} Schaden
              </span>
              <div className="type-trainer-focus-types">
                {focusTypes.map((key) => (
                  <span key={key} className="type-trainer-focus-type" style={{ "--tt-color": getTypeColor(key) }}>
                    <img src={getTypeIconUrl(key)} alt="" />{getTypeLabel(key)}
                  </span>
                ))}
              </div>
              <h2>{questionText(question)}</h2>
              {question.direction === "attack" && question.targetKind === "dual" ? (
                <p className="type-trainer-question-note">Wähle alle richtigen Kombinationen aus den 18 angezeigten Möglichkeiten.</p>
              ) : null}
            </section>
            <div className={"type-trainer-type-grid " + (choices.some((choice) => choice.types.length > 1) ? "has-dual-choices" : "")}
              role="group" aria-label="Antwortmöglichkeiten">
              {choices.map((choice) => (
                <ChoiceButton key={choice.key} choice={choice}
                  selected={selected.includes(choice.key)}
                  feedback={feedback}
                  correct={feedback?.answers.includes(choice.key)}
                  onClick={() => toggle(choice.key)} />
              ))}
            </div>
            {feedback ? (
              <div className={"type-trainer-feedback " + (feedback.correct ? "is-correct" : "is-incorrect")} role="status">
                <strong>{feedback.correct ? "Richtig! +100 Punkte" : "Nicht ganz richtig – versuche es bei der nächsten Frage erneut."}</strong>
                <span>Richtige Antworten: {choices.filter((choice) => feedback.answers.includes(choice.key))
                  .map((choice) => choice.types.map(getTypeLabel).join(" / ")).join(", ")}.</span>
              </div>
            ) : <p className="type-trainer-hint">{selected.length} ausgewählt · Mehrere Antworten können richtig sein.</p>}
            <div className="type-trainer-actions">
              {feedback ? (
                <button type="button" className="type-trainer-primary" onClick={next}>
                  {(settings.rounds && round >= settings.rounds) || !deckRef.current.length
                    ? "Ergebnis ansehen" : "Nächste Frage"}
                </button>
              ) : (
                <button type="button" className="type-trainer-primary" disabled={!selected.length} onClick={submit}>
                  Antwort überprüfen
                </button>
              )}
              <button type="button" className="type-trainer-secondary" onClick={() => setStarted(false)}>Beenden</button>
            </div>
          </>
        ) : <p>Keine Frage verfügbar.</p>}
      </section>
    </main>
  );
}
