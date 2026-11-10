import React, { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  POKEMON_TYPES, RELATION_OPTIONS, buildTypeQuestionDeck,
  getMatchingTypes, getTypeColor, getTypeLabel,
} from "./typeTrainerData";
import "./typeTrainer.css";

const HIGHSCORE_KEY = "ponuz-type-trainer-effectiveness-best-v1";

function readHighscore() {
  try { return Number(localStorage.getItem(HIGHSCORE_KEY)) || 0; }
  catch { return 0; }
}

function questionText(question) {
  const typeName = getTypeLabel(question.type);
  if (question.direction === "defender") {
    if (question.relation === "strong") return "Welche Angriffstypen treffen " + typeName + " sehr effektiv?";
    if (question.relation === "weak") return "Welche Angriffstypen treffen " + typeName + " nicht sehr effektiv?";
    return "Gegen welche Angriffstypen ist " + typeName + " immun?";
  }
  if (question.relation === "strong") return "Welche Typen trifft " + typeName + " sehr effektiv?";
  if (question.relation === "weak") return "Welche Typen trifft " + typeName + " nicht sehr effektiv?";
  return "Gegen welche Typen sind " + typeName + "-Attacken wirkungslos?";
}

export default function TypeEffectivenessGame() {
  const navigate = useNavigate();
  const [direction, setDirection] = useState("mixed");
  const [relation, setRelation] = useState("mixed");
  const [roundLimit, setRoundLimit] = useState(10);
  const [started, setStarted] = useState(false);
  const [finished, setFinished] = useState(false);
  const [round, setRound] = useState(1);
  const [question, setQuestion] = useState(null);
  const [selected, setSelected] = useState([]);
  const [feedback, setFeedback] = useState(null);
  const [score, setScore] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [highscore, setHighscore] = useState(readHighscore);
  const deckRef = useRef([]);

  function getNextQuestion() {
    if (!deckRef.current.length) {
      deckRef.current = buildTypeQuestionDeck(direction, relation);
    }
    return deckRef.current.pop() || null;
  }

  function startGame() {
    deckRef.current = buildTypeQuestionDeck(direction, relation);
    setRound(1);
    setScore(0);
    setCorrectCount(0);
    setSelected([]);
    setFeedback(null);
    setFinished(false);
    setQuestion(getNextQuestion());
    setStarted(true);
  }

  function submit() {
    if (!question || feedback || !selected.length) return;
    const answers = getMatchingTypes(question);
    const correct = answers.length === selected.length
      && answers.every((type) => selected.includes(type));
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
    if (roundLimit && round >= roundLimit) {
      setFinished(true);
      return;
    }
    setRound((value) => value + 1);
    setQuestion(getNextQuestion());
    setSelected([]);
    setFeedback(null);
  }

  function toggle(key) {
    if (feedback) return;
    setSelected((values) => values.includes(key)
      ? values.filter((value) => value !== key)
      : [...values, key]);
  }

  const category = RELATION_OPTIONS.find((item) => item.key === question?.relation);
  const roundDescription = question?.direction === "defender" ? "Angriffe auf den Typ" : "Angriffe mit dem Typ";

  return (
    <main className="games-page type-trainer-page">
      <section className="type-trainer-panel">
        <div className="type-trainer-topline">
          <button type="button" className="type-trainer-back" onClick={() => navigate("/games/type-trainer")}>
            <span aria-hidden="true">‹</span> Zurück
          </button>
          <span className="type-trainer-eyebrow">Typen-Trainer · Effektivität</span>
        </div>
        <h1>Typen-Matchups</h1>
        <p className="type-trainer-subtitle">
          Finde alle passenden Typen. Mehrere Antworten können richtig sein.
          Es gilt die normale Typentabelle ab Generation 6, ohne Fähigkeiten oder Items.
        </p>

        {!started ? (
          <div className="type-trainer-setup">
            <label className="type-trainer-field">
              <span>Fragerichtung</span>
              <select value={direction} onChange={(event) => setDirection(event.target.value)}>
                <option value="mixed">Gemischt</option>
                <option value="defender">Was trifft diesen Typ?</option>
                <option value="attacker">Wen trifft dieser Typ?</option>
              </select>
            </label>
            <label className="type-trainer-field">
              <span>Effektivität</span>
              <select value={relation} onChange={(event) => setRelation(event.target.value)}>
                <option value="mixed">Gemischt</option>
                <option value="strong">Sehr effektiv (2×)</option>
                <option value="weak">Nicht sehr effektiv (½×)</option>
                <option value="immune">Immunität (0×)</option>
              </select>
            </label>
            <label className="type-trainer-field">
              <span>Runden</span>
              <select value={roundLimit} onChange={(event) => setRoundLimit(Number(event.target.value))}>
                <option value={10}>10 Runden</option>
                <option value={20}>20 Runden</option>
                <option value={0}>Endlos</option>
              </select>
            </label>
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
              <span>Runde {round}{roundLimit ? " / " + roundLimit : " · Endlos"}</span>
              <span>{score} Punkte</span>
              <span>{correctCount} richtig</span>
            </div>
            <section className="type-trainer-question">
              <span className="type-trainer-eyebrow">{roundDescription} · {category?.label}</span>
              <span className="type-trainer-focus-type" style={{ "--tt-color": getTypeColor(question.type) }}>
                {getTypeLabel(question.type)}
              </span>
              <h2>{questionText(question)}</h2>
            </section>
            <div className="type-trainer-type-grid" role="group" aria-label="Antwortmöglichkeiten">
              {POKEMON_TYPES.map((type) => {
                const picked = selected.includes(type.key);
                const isAnswer = feedback?.answers.includes(type.key);
                const wrong = feedback && picked && !isAnswer;
                return (
                  <button
                    key={type.key}
                    type="button"
                    className={[
                      "type-trainer-type", picked ? "is-selected" : "",
                      isAnswer ? "is-answer" : "", wrong ? "is-wrong" : "",
                    ].filter(Boolean).join(" ")}
                    style={{ "--tt-color": type.color }}
                    aria-pressed={picked}
                    disabled={Boolean(feedback)}
                    onClick={() => toggle(type.key)}
                  >
                    <span className="type-trainer-type-dot" aria-hidden="true" />
                    {type.label}
                    {feedback && isAnswer ? <span className="type-trainer-answer-mark" aria-label="Richtig">✓</span> : null}
                    {wrong ? <span className="type-trainer-answer-mark" aria-label="Falsch">×</span> : null}
                  </button>
                );
              })}
            </div>
            {feedback ? (
              <div className={"type-trainer-feedback " + (feedback.correct ? "is-correct" : "is-incorrect")} role="status">
                <strong>{feedback.correct ? "Richtig! +100 Punkte" : "Noch nicht ganz richtig."}</strong>
                <span>Richtige Typen: {feedback.answers.map(getTypeLabel).join(", ")}.</span>
              </div>
            ) : (
              <p className="type-trainer-hint">Wähle alle richtigen Typen aus und überprüfe deine Antwort.</p>
            )}
            <div className="type-trainer-actions">
              {feedback ? (
                <button type="button" className="type-trainer-primary" onClick={next}>
                  {roundLimit && round >= roundLimit ? "Ergebnis ansehen" : "Nächste Frage"}
                </button>
              ) : (
                <button type="button" className="type-trainer-primary" disabled={!selected.length} onClick={submit}>
                  Antwort überprüfen
                </button>
              )}
              <button type="button" className="type-trainer-secondary" onClick={() => setStarted(false)}>Beenden</button>
            </div>
          </>
        ) : (
          <p>Für diese Einstellungen sind keine Fragen verfügbar.</p>
        )}
      </section>
    </main>
  );
}
