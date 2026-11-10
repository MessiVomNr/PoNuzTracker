import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { POKEMON_TYPES, buildPokemonIdDeck, getTypeColor, getTypeLabel } from "./typeTrainerData";
import "./typeTrainer.css";

const CACHE_PREFIX = "ponuz-type-trainer-pokemon-v1-";
const HIGHSCORE_KEY = "ponuz-type-trainer-pokemon-best-v1";
const ALL_GENS = [1,2,3,4,5,6,7,8,9];

function readBest() {
  try { return Number(localStorage.getItem(HIGHSCORE_KEY)) || 0; }
  catch { return 0; }
}

async function fetchPokemon(id) {
  const key = CACHE_PREFIX + id;
  try {
    const cached = localStorage.getItem(key);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (parsed?.types?.length && parsed?.image) return parsed;
    }
  } catch { /* cache optional */ }

  const baseUrl = "https://pokeapi.co/api/v2";
  const [pokemonResponse, speciesResponse] = await Promise.all([
    fetch(baseUrl + "/pokemon/" + id),
    fetch(baseUrl + "/pokemon-species/" + id),
  ]);
  if (!pokemonResponse.ok || !speciesResponse.ok) throw new Error("Pokémon-Daten konnten nicht geladen werden.");
  const [pokemon, species] = await Promise.all([pokemonResponse.json(), speciesResponse.json()]);
  const name = species.names?.find((entry) => entry.language?.name === "de")?.name
    || species.names?.find((entry) => entry.language?.name === "en")?.name
    || pokemon.name;
  const types = [...(pokemon.types || [])]
    .sort((a, b) => a.slot - b.slot)
    .map((entry) => entry.type.name)
    .filter((type) => POKEMON_TYPES.some((candidate) => candidate.key === type));
  const image = pokemon.sprites?.other?.["official-artwork"]?.front_default
    || pokemon.sprites?.front_default
    || "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/" + id + ".png";
  if (!types.length) throw new Error("Für dieses Pokémon sind keine Typen vorhanden.");
  const result = { id, name, types, image };
  try { localStorage.setItem(key, JSON.stringify(result)); } catch { /* cache optional */ }
  return result;
}

export default function PokemonTypeGuessGame() {
  const navigate = useNavigate();
  const [generations, setGenerations] = useState([1, 2, 3]);
  const [roundLimit, setRoundLimit] = useState(10);
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
          const next = await fetchPokemon(id);
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
    if (!generations.length) return;
    deckRef.current = buildPokemonIdDeck(generations);
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
          <span className="type-trainer-eyebrow">Typen-Trainer · Pokémon-Typen</span>
        </div>
        <h1>Pokémon-Typen erraten</h1>
        <p className="type-trainer-subtitle">
          Schau dir das Pokémon an und wähle seinen Typ oder seine beiden Typen.
          Es gelten die Standardformen und ihre aktuellen Typen.
        </p>

        {!started ? (
          <div className="type-trainer-setup">
            <div className="type-trainer-wide">
              <span className="type-trainer-field-title">Generationen auswählen</span>
              <div className="type-trainer-generation-grid">
                {ALL_GENS.map((gen) => (
                  <button key={gen} type="button" aria-pressed={generations.includes(gen)}
                    className={"type-trainer-generation " + (generations.includes(gen) ? "is-active" : "")}
                    onClick={() => toggleGeneration(gen)}>
                    Gen {gen}
                  </button>
                ))}
              </div>
              <div className="type-trainer-inline">
                <button type="button" className="type-trainer-link" onClick={() => setGenerations(ALL_GENS)}>Alle auswählen</button>
                <button type="button" className="type-trainer-link" onClick={() => setGenerations([1])}>Nur Gen 1</button>
                <button type="button" className="type-trainer-link" onClick={() => setGenerations([])}>Auswahl leeren</button>
              </div>
            </div>
            <label className="type-trainer-field">
              <span>Runden</span>
              <select value={roundLimit} onChange={(event) => setRoundLimit(Number(event.target.value))}>
                <option value={10}>10 Runden</option>
                <option value={20}>20 Runden</option>
                <option value={0}>Endlos (bis zum Pool-Ende)</option>
              </select>
            </label>
            <div className="type-trainer-setup-footer">
              <span>Bisheriger Rekord: <strong>{best} Punkte</strong></span>
              <button type="button" className="type-trainer-primary" disabled={!generations.length} onClick={begin}>Training starten</button>
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
                            {getTypeLabel(type)}
                          </span>
                        ))}
                      </div>
                    ) : <span className="type-trainer-unknown">? / ?</span>}
                  </div>
                </div>
                <div className="type-trainer-type-grid" role="group" aria-label="Pokémon-Typen wählen">
                  {POKEMON_TYPES.map((type) => {
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
                        <span className="type-trainer-type-dot" aria-hidden="true" />
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
