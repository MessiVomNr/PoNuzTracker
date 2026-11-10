import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getGenerationTypes, buildPokemonIdDeck, getTypeColor, getTypeLabel, getTypeIconUrl } from "./typeTrainerData";
import { loadTrainerPokemon } from "./trainerPokemonApi";
import { GenerationFilter } from "./GenerationFilter";
import "./typeTrainer.css";

const HIGHSCORE_KEY = "ponuz-type-trainer-pokemon-best-v1";
const ALL_GENS = [1,2,3,4,5,6,7,8,9];
const SETTINGS_KEY = "ponuz-type-trainer-pokemon-settings-v1";
function readSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY));
    const generations = Array.isArray(saved?.generations)
      ? [...new Set(saved.generations.map(Number).filter((gen) => ALL_GENS.includes(gen)))].sort((a, b) => a - b)
      : [1, 2, 3];
    const rounds = [0, 10, 20, 30].includes(Number(saved?.rounds)) ? Number(saved.rounds) : 10;
    const ruleGen = saved?.ruleGen === "auto" || ALL_GENS.some((gen) => String(gen) === String(saved?.ruleGen))
      ? String(saved.ruleGen) : "auto";
    return { generations, rounds, ruleGen };
  } catch { return { generations: [1, 2, 3], rounds: 10, ruleGen: "auto" }; }
}

function readBest() {
  try { return Number(localStorage.getItem(HIGHSCORE_KEY)) || 0; }
  catch { return 0; }
}

export default function PokemonTypeGuessGame() {
  const navigate = useNavigate();
  const [generations, setGenerations] = useState(() => readSettings().generations);
  const [roundLimit, setRoundLimit] = useState(() => readSettings().rounds);
  const [ruleGen, setRuleGen] = useState(() => readSettings().ruleGen);
  const activeRuleGen = ruleGen === "auto" ? Math.max(1, ...generations) : Number(ruleGen);
  const [started, setStarted] = useState(false);
  const [finished, setFinished] = useState(false);
  const [round, setRound] = useState(1);
  const [pokemon, setPokemon] = useState(null);
  const [selected, setSelected] = useState([]);
  const [feedback, setFeedback] = useState(null);
  const [score, setScore] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [best, setBest] = useState(readBest);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const deckRef = useRef([]);
  const fetchSequence = useRef(0);

  useEffect(() => () => { fetchSequence.current += 1; }, []);
  useEffect(() => {
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify({ generations, rounds: roundLimit, ruleGen })); }
    catch { /* optional */ }
  }, [generations, roundLimit, ruleGen]);

  async function loadNextPokemon() {
    const requestId = ++fetchSequence.current;
    setLoading(true);
    setError("");
    setPokemon(null);
    setSelected([]);
    setFeedback(null);
    try {
      let lastError = null;
      for (let tries = 0; tries < 4; tries += 1) {
        if (!deckRef.current.length) break;
        const id = deckRef.current.pop();
        try {
          const next = await loadTrainerPokemon(id, activeRuleGen);
          if (requestId !== fetchSequence.current) return;
          setPokemon(next);
          return;
        } catch (err) {
          lastError = err;
        }
      }
      throw lastError || new Error("Keine weiteren Pokémon vorhanden.");
    } catch (err) {
      if (requestId === fetchSequence.current) setError(err.message || "Daten konnten nicht geladen werden.");
    } finally {
      if (requestId === fetchSequence.current) setLoading(false);
    }
  }

  function begin() {
    if (!generations.length || !generations.some((gen) => gen <= activeRuleGen)) return;
    deckRef.current = buildPokemonIdDeck(generations.filter((gen) => gen <= activeRuleGen));
    setRound(1);
    setScore(0);
    setCorrectCount(0);
    setFinished(false);
    setStarted(true);
    loadNextPokemon();
  }

  function chooseType(key) {
    if (feedback || loading) return;
    setSelected((current) => current.includes(key)
      ? current.filter((value) => value !== key)
      : current.length < 2 ? [...current, key] : current);
  }

  function check() {
    if (feedback || !pokemon || !selected.length) return;
    const correct = selected.length === pokemon.types.length
      && pokemon.types.every((value) => selected.includes(value));
    const next = score + (correct ? 100 : 0);
    setScore(next);
    if (correct) setCorrectCount((value) => value + 1);
    setFeedback({ correct });
    if (next > best) {
      setBest(next);
      try { localStorage.setItem(HIGHSCORE_KEY, String(next)); } catch { /* optional */ }
    }
  }

  function next() {
    if (!feedback) return;
    if ((roundLimit && round >= roundLimit) || deckRef.current.length === 0) {
      setFinished(true);
      return;
    }
    setRound((value) => value + 1);
    loadNextPokemon();
  }

  function exit() {
    fetchSequence.current += 1;
    setStarted(false);
    setLoading(false);
    setError("");
    setPokemon(null);
  }

  function toggleGeneration(gen) {
    setGenerations((current) => current.includes(gen)
      ? current.filter((value) => value !== gen)
      : [...current, gen].sort((a, b) => a - b));
  }

  return (
    <main className="games-page type-trainer-page">
      <section className="type-trainer-panel">
        <div className="type-trainer-topline">
          <button type="button" className="type-trainer-back" onClick={() => navigate("/games/type-trainer")}>
            <span aria-hidden="true">‹</span> Zurück
          </button>
          <button type="button" className="type-trainer-home-link" onClick={() => navigate("/")}>Zur Startseite</button>
        </div>
        <h1>Pokémon-Typen erraten</h1>
        <p className="type-trainer-subtitle">
          Schau dir das Pokémon an und wähle seinen Typ oder seine beiden Typen.
          Die Typen richten sich nach deinem ausgewählten Spielstand.
        </p>

        {!started ? (
          <div className="type-trainer-setup">
            <div className="type-trainer-wide">
              <GenerationFilter title="Generationen auswählen" generations={generations}
                onToggle={toggleGeneration}
                onOnly={(gen) => setGenerations([gen])}
                onAll={() => setGenerations(ALL_GENS)}
                onClear={() => setGenerations([])}
              />
            </div>
            <label className="type-trainer-field">
              <span>Typenstand</span>
              <span className="type-trainer-select-shell">
                <select value={ruleGen} onChange={(event) => setRuleGen(event.target.value)}>
                  <option value="auto">Automatisch (höchste ausgewählte Gen)</option>
                  {ALL_GENS.map((gen) => <option value={String(gen)} key={gen}>Generation {gen}</option>)}
                </select>
              </span>
            </label>
            <label className="type-trainer-field">
              <span>Runden</span>
              <span className="type-trainer-select-shell">
              <select value={roundLimit} onChange={(event) => setRoundLimit(Number(event.target.value))}>
                <option value={10}>10 Runden</option>
                <option value={20}>20 Runden</option>
                <option value={30}>30 Runden</option>
                <option value={0}>Endlos (bis zum Pool-Ende)</option>
              </select>
              </span>
            </label>
            {generations.length > 0 && !generations.some((gen) => gen <= activeRuleGen)
              ? <p className="type-trainer-settings-error type-trainer-wide">Wähle einen Typenstand ab Gen {Math.min(...generations)}.</p>
              : null}
            <div className="type-trainer-setup-footer">
              <span>Bisheriger Rekord: <strong>{best} Punkte</strong></span>
              <button type="button" className="type-trainer-primary" disabled={!generations.some((gen) => gen <= activeRuleGen)} onClick={begin}>Training starten</button>
            </div>
          </div>
        ) : finished ? (
          <div className="type-trainer-finish" role="status">
            <span className="type-trainer-finish-number">{score}</span>
            <h2>Punkte erspielt</h2>
            <p>{correctCount} von {round} Pokémon vollständig richtig zugeordnet.</p>
            <div className="type-trainer-actions">
              <button type="button" className="type-trainer-primary" onClick={begin}>Nochmal spielen</button>
              <button type="button" className="type-trainer-secondary" onClick={exit}>Einstellungen</button>
            </div>
          </div>
        ) : (
          <>
            <div className="type-trainer-score-row">
              <span>Runde {round}{roundLimit ? " / " + roundLimit : " · Endlos"}</span>
              <span>{score} Punkte</span>
              <span>{correctCount} richtig</span>
            </div>
            {loading ? (
              <div className="type-trainer-loading" role="status">Pokémon wird geladen …</div>
            ) : error ? (
              <div className="type-trainer-feedback is-incorrect" role="alert">
                <strong>{error}</strong>
                <div className="type-trainer-actions">
                  <button type="button" className="type-trainer-secondary" onClick={loadNextPokemon}>Anderes Pokémon versuchen</button>
                  <button type="button" className="type-trainer-secondary" onClick={exit}>Einstellungen</button>
                </div>
              </div>
            ) : pokemon ? (
              <>
                <div className="type-trainer-pokemon-display">
                  <img src={pokemon.image} alt={pokemon.name}
                    onError={(event) => {
                      const fallback = "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/" + pokemon.id + ".png";
                      if (event.currentTarget.src !== fallback) event.currentTarget.src = fallback;
                    }}
                  />
                  <div>
                    <span className="type-trainer-eyebrow">Pokédex #{String(pokemon.id).padStart(4, "0")}</span>
                    <h2>{pokemon.name}</h2>
                    <p>Welche Typen hat dieses Pokémon?</p>
                    {feedback ? (
                      <div className="type-trainer-answer-types">
                        {pokemon.types.map((type) => (
                          <span key={type} className="type-trainer-type is-answer" style={{ "--tt-color": getTypeColor(type) }}>
                            <img className="type-trainer-type-icon" src={getTypeIconUrl(type)} alt="" />
                            {getTypeLabel(type)}
                          </span>
                        ))}
                      </div>
                    ) : <span className="type-trainer-unknown">? / ?</span>}
                  </div>
                </div>
                <div className="type-trainer-type-grid" role="group" aria-label="Pokémon-Typen wählen">
                  {getGenerationTypes(activeRuleGen).map((type) => {
                    const picked = selected.includes(type.key);
                    const isAnswer = feedback && pokemon.types.includes(type.key);
                    return (
                      <button type="button" key={type.key} disabled={Boolean(feedback)}
                        aria-pressed={picked}
                        onClick={() => chooseType(type.key)}
                        className={[
                          "type-trainer-type", picked ? "is-selected" : "",
                          isAnswer ? "is-answer" : "",
                          feedback && picked && !isAnswer ? "is-wrong" : "",
                        ].filter(Boolean).join(" ")}
                        style={{ "--tt-color": type.color }}>
                        <img className="type-trainer-type-icon" src={getTypeIconUrl(type.key)} alt="" loading="lazy" />
                        {type.label}
                        {isAnswer ? <span className="type-trainer-answer-mark">✓</span> : null}
                        {feedback && picked && !isAnswer ? <span className="type-trainer-answer-mark">×</span> : null}
                      </button>
                    );
                  })}
                </div>
                {feedback ? (
                  <div className={"type-trainer-feedback " + (feedback.correct ? "is-correct" : "is-incorrect")} role="status">
                    <strong>{feedback.correct ? "Richtig! +100 Punkte" : "Leider nicht vollständig richtig."}</strong>
                    <span>{pokemon.name} ist {pokemon.types.map(getTypeLabel).join(" / ")}.</span>
                  </div>
                ) : <p className="type-trainer-hint">{selected.length} / 2 Typen gewählt. Ein Pokémon kann auch nur einen Typ haben.</p>}
                <div className="type-trainer-actions">
                  {feedback ? (
                    <button type="button" className="type-trainer-primary" onClick={next}>
                      {roundLimit && round >= roundLimit ? "Ergebnis ansehen" : "Nächstes Pokémon"}
                    </button>
                  ) : (
                    <button type="button" className="type-trainer-primary" disabled={!selected.length} onClick={check}>Antwort überprüfen</button>
                  )}
                  <button type="button" className="type-trainer-secondary" onClick={exit}>Beenden</button>
                </div>
              </>
            ) : null}
          </>
        )}
      </section>
    </main>
  );
}
