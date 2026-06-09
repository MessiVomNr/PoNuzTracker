// src/online/OnlineGuessGame.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ONLINE_GUESS_GAME_MODES,
  getOnlineGuessPlayerId,
  goToNextOnlineGuessRound,
  heartbeatOnlineGuessPlayer,
  revealOnlineGuessRound,
  submitOnlineGuessAnswer,
  buzzOnlineGuess,
  subscribeOnlineGuessAnswers,
  subscribeOnlineGuessPlayers,
  subscribeOnlineGuessRoom,
} from "./onlineGuessService";
import {
  GUESS_CLUE_TYPES,
  GUESS_PLAY_MODES,
  getEffectiveRevealMode,
  getPokemonNameSuggestions,
  getVisibleClues,
} from "../games/guessGameEngine";
import { loadPokemonGuessPool } from "../games/pokemonGuessApi";
import { isTypingTarget } from "../utils/hotkeys";
import "../games/guessStyles.css";

function timestampToMillis(value) {
  if (!value) return 0;
  if (typeof value.toMillis === "function") return value.toMillis();
  if (typeof value.seconds === "number") {
    return value.seconds * 1000 + Math.floor((value.nanoseconds || 0) / 1000000);
  }
  return 0;
}

function getSafeSettings(room) {
  return room?.settings || {};
}

function getPlayerLabel(players, uid) {
  const player = players.find((item) => item.uid === uid || item.id === uid);
  return player?.displayName || "Spieler";
}

function sortScoreboard(players) {
  return [...players]
    .filter((player) => player.online !== false)
    .sort((a, b) => {
      const scoreDiff = (Number(b.score) || 0) - (Number(a.score) || 0);
      if (scoreDiff !== 0) return scoreDiff;
      return String(a.displayName || "").localeCompare(String(b.displayName || ""));
    });
}

export default function OnlineGuessGame() {
  const navigate = useNavigate();
  const { roomCode } = useParams();

  const cleanRoomCode = String(roomCode || "").trim().toUpperCase();

  const [room, setRoom] = useState(null);
  const [players, setPlayers] = useState([]);
  const [answers, setAnswers] = useState([]);
  const [myUid, setMyUid] = useState("");
  const [guessInput, setGuessInput] = useState("");
  const [pokemonPool, setPokemonPool] = useState([]);
  const [nowMs, setNowMs] = useState(Date.now());
  const [loadingText, setLoadingText] = useState("Spiel wird geladen...");
  const [errorText, setErrorText] = useState("");

  const revealAttemptRef = useRef("");

  const settings = useMemo(() => getSafeSettings(room), [room]);
  const currentQuestion = room?.currentQuestion || null;
  const target = currentQuestion?.target || null;
  const roundNumber = Number(room?.currentRound) || 1;
  const isHost = Boolean(room && myUid && room.hostId === myUid);
  const isTimerMode = settings.gameMode === ONLINE_GUESS_GAME_MODES.TIMER;
  const isBuzzerMode = settings.gameMode === ONLINE_GUESS_GAME_MODES.BUZZER;
  const phase = room?.phase || "question";

  const onlinePlayers = useMemo(() => {
    return players.filter((player) => player.online !== false);
  }, [players]);

  const scoreboard = useMemo(() => sortScoreboard(players), [players]);

  const myAnswer = useMemo(() => {
    return answers.find((answer) => answer.uid === myUid) || null;
  }, [answers, myUid]);

  const buzzedPlayerName = useMemo(() => {
    if (!room?.buzzedBy) return "";
    return getPlayerLabel(players, room.buzzedBy);
  }, [players, room?.buzzedBy]);

  const effectiveRevealMode = getEffectiveRevealMode(settings);

  const rawVisibleClues = useMemo(() => {
    if (!currentQuestion) return [];
    return getVisibleClues(currentQuestion, effectiveRevealMode);
  }, [currentQuestion, effectiveRevealMode]);

  const visibleClues = useMemo(() => {
    const showOnlyCurrentVisualStage =
      settings.playMode === GUESS_PLAY_MODES.PIXEL ||
      settings.playMode === GUESS_PLAY_MODES.DISTORTED;

    if (showOnlyCurrentVisualStage && rawVisibleClues.length > 0) {
      return [rawVisibleClues[rawVisibleClues.length - 1]];
    }

    return rawVisibleClues;
  }, [rawVisibleClues, settings.playMode]);

  const suggestions = useMemo(() => {
    return getPokemonNameSuggestions(guessInput, pokemonPool);
  }, [guessInput, pokemonPool]);

  const roundStartedAtMs = timestampToMillis(room?.roundStartedAt);

  const timeLeft = useMemo(() => {
    if (!isTimerMode || phase !== "question") return null;

    const maxSeconds = Math.max(5, Number(settings.answerTimeSeconds) || 20);

    if (!roundStartedAtMs) {
      return maxSeconds;
    }

    const elapsedSeconds = Math.floor((nowMs - roundStartedAtMs) / 1000);
    return Math.max(0, maxSeconds - elapsedSeconds);
  }, [
    isTimerMode,
    phase,
    settings.answerTimeSeconds,
    roundStartedAtMs,
    nowMs,
  ]);

  const buzzerTimeLeft = useMemo(() => {
    if (!isBuzzerMode || phase !== "question" || !room?.buzzedBy) return null;

    const deadlineAtMs = Number(room?.buzzerAnswerDeadlineAtMs) || 0;

    if (!deadlineAtMs) {
      return Math.max(3, Number(settings.buzzerAnswerSeconds) || 7);
    }

    return Math.max(0, Math.ceil((deadlineAtMs - nowMs) / 1000));
  }, [
    isBuzzerMode,
    phase,
    room?.buzzedBy,
    room?.buzzerAnswerDeadlineAtMs,
    settings.buzzerAnswerSeconds,
    nowMs,
  ]);

  const answeredCount = answers.filter((answer) => Boolean(answer.answer)).length;
  const allAnswered =
    onlinePlayers.length > 0 &&
    onlinePlayers.every((player) =>
      answers.some((answer) => answer.uid === player.uid && Boolean(answer.answer))
    );

  const canAnswerTimer =
    room?.status === "playing" &&
    phase === "question" &&
    isTimerMode &&
    !myAnswer;

  const canBuzz =
    room?.status === "playing" &&
    phase === "question" &&
    isBuzzerMode &&
    !room?.buzzedBy;

  const canAnswerBuzzer =
    room?.status === "playing" &&
    phase === "question" &&
    isBuzzerMode &&
    room?.buzzedBy === myUid &&
    !myAnswer &&
    (buzzerTimeLeft === null || buzzerTimeLeft > 0);

  const canAnswer = canAnswerTimer || canAnswerBuzzer;

  useEffect(() => {
    let mounted = true;

    async function loadMe() {
      try {
        const uid = await getOnlineGuessPlayerId();

        if (mounted) {
          setMyUid(uid);
        }
      } catch (error) {
        console.error(error);

        if (mounted) {
          setErrorText(error?.message || "Firebase-Anmeldung fehlgeschlagen.");
        }
      }
    }

    loadMe();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!cleanRoomCode) return undefined;

    const unsubRoom = subscribeOnlineGuessRoom(cleanRoomCode, (nextRoom) => {
      setRoom(nextRoom);
      setLoadingText("");

      if (!nextRoom) {
        setErrorText("Diese Lobby wurde nicht gefunden.");
        return;
      }

      if (nextRoom.status === "lobby") {
        navigate(`/games/pokemon-guess/online/${cleanRoomCode}`);
      }
    });

    const unsubPlayers = subscribeOnlineGuessPlayers(cleanRoomCode, (nextPlayers) => {
      setPlayers(nextPlayers);
    });

    return () => {
      unsubRoom();
      unsubPlayers();
    };
  }, [cleanRoomCode, navigate]);

  useEffect(() => {
    if (!cleanRoomCode || !roundNumber) return undefined;

    const unsubAnswers = subscribeOnlineGuessAnswers(
      cleanRoomCode,
      roundNumber,
      (nextAnswers) => {
        setAnswers(nextAnswers);
      }
    );

    return () => unsubAnswers();
  }, [cleanRoomCode, roundNumber]);

  useEffect(() => {
    if (!cleanRoomCode || !myUid) return undefined;

    heartbeatOnlineGuessPlayer(cleanRoomCode).catch(() => {});

    const timer = setInterval(() => {
      heartbeatOnlineGuessPlayer(cleanRoomCode).catch(() => {});
    }, 20000);

    return () => clearInterval(timer);
  }, [cleanRoomCode, myUid]);

  useEffect(() => {
    if (!settings?.selectedGens?.length) return undefined;

    let cancelled = false;

    loadPokemonGuessPool(settings.selectedGens)
      .then((pool) => {
        if (!cancelled) setPokemonPool(pool);
      })
      .catch(() => {
        if (!cancelled) setPokemonPool([]);
      });

    return () => {
      cancelled = true;
    };
  }, [settings?.selectedGens]);

  useEffect(() => {
    if (phase !== "question") return undefined;

    const timer = setInterval(() => {
      setNowMs(Date.now());
    }, 250);

    return () => clearInterval(timer);
  }, [phase]);

  useEffect(() => {
    revealAttemptRef.current = "";
    setGuessInput("");
  }, [roundNumber]);

  useEffect(() => {
    if (!isHost) return;
    if (!room || room.status !== "playing" || phase !== "question") return;

    async function autoReveal(reason) {
      const key = `${roundNumber}:${reason}`;

      if (revealAttemptRef.current === key) return;
      revealAttemptRef.current = key;

      try {
        await revealOnlineGuessRound(cleanRoomCode);
      } catch (error) {
        console.error(error);
      }
    }

    if (isTimerMode && timeLeft === 0) {
      autoReveal("timer");
      return;
    }

    if (isTimerMode && allAnswered) {
      autoReveal("allAnswered");
      return;
    }

    if (isBuzzerMode && room.buzzedBy) {
      const buzzerAnswered = answers.some(
        (answer) => answer.uid === room.buzzedBy && Boolean(answer.answer)
      );

      if (buzzerAnswered) {
        autoReveal("buzzerAnswered");
        return;
      }

      if (buzzerTimeLeft === 0) {
        autoReveal("buzzerTimeout");
      }
    }
  }, [
    isHost,
    room,
    phase,
    roundNumber,
    cleanRoomCode,
    isTimerMode,
    isBuzzerMode,
    timeLeft,
    buzzerTimeLeft,
    allAnswered,
    answers,
  ]);

  useEffect(() => {
    function handleKeyDown(event) {
      if (event.repeat) return;
      if (!isBuzzerMode || !canBuzz) return;
      if (isTypingTarget(event.target)) return;

      if (event.code === "Space" || event.key === " ") {
        event.preventDefault();
        handleBuzz();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isBuzzerMode, canBuzz, cleanRoomCode]);

  async function handleBuzz() {
    if (!canBuzz) return;

    setErrorText("");

    try {
      await buzzOnlineGuess(cleanRoomCode);
    } catch (error) {
      console.error(error);
      setErrorText(error?.message || "Buzzer konnte nicht ausgelöst werden.");
    }
  }

  async function handleSubmitAnswer(event) {
    event.preventDefault();

    if (!canAnswer) return;

    const cleanAnswer = guessInput.trim();

    if (!cleanAnswer) {
      setErrorText("Bitte gib eine Antwort ein.");
      return;
    }

    setErrorText("");

    try {
      await submitOnlineGuessAnswer(cleanRoomCode, cleanAnswer);
      setGuessInput("");
    } catch (error) {
      console.error(error);
      setErrorText(error?.message || "Antwort konnte nicht abgegeben werden.");
    }
  }

  async function handleManualReveal() {
    if (!isHost) return;

    setErrorText("");
    setLoadingText("Runde wird aufgedeckt...");

    try {
      await revealOnlineGuessRound(cleanRoomCode);
    } catch (error) {
      console.error(error);
      setErrorText(error?.message || "Runde konnte nicht aufgedeckt werden.");
    } finally {
      setLoadingText("");
    }
  }

  async function handleNextRound() {
    if (!isHost) return;

    setErrorText("");
    setLoadingText("Nächste Runde wird vorbereitet...");

    try {
      await goToNextOnlineGuessRound(cleanRoomCode);
    } catch (error) {
      console.error(error);
      setErrorText(error?.message || "Nächste Runde konnte nicht gestartet werden.");
    } finally {
      setLoadingText("");
    }
  }

  if (loadingText && !room) {
    return (
      <div className="games-page">
        <div className="games-panel guess-panel">
          <button
            className="games-back-button"
            type="button"
            onClick={() => navigate(`/games/pokemon-guess/online/${cleanRoomCode}`)}
          >
            Zur Lobby
          </button>

          <div className="guess-loading-box">{loadingText}</div>
        </div>
      </div>
    );
  }

  if (!room) {
    return (
      <div className="games-page">
        <div className="games-panel guess-panel">
          <button
            className="games-back-button"
            type="button"
            onClick={() => navigate("/games/pokemon-guess/online")}
          >
            Zurück
          </button>

          <div className="guess-error-box">
            {errorText || "Diese Lobby wurde nicht gefunden."}
          </div>
        </div>
      </div>
    );
  }

  if (room.status === "finished" || phase === "finished") {
    return (
      <div className="games-page">
        <div className="games-panel guess-panel">
          <div className="guess-page-actions">
            <button
              className="games-back-button"
              type="button"
              onClick={() => navigate("/games/pokemon-guess")}
            >
              Zum Guess-Menü
            </button>

            <button
              className="games-back-button"
              type="button"
              onClick={() => navigate("/games")}
            >
              Spiele-Hub
            </button>
          </div>

          <div className="guess-header">
            <p className="guess-kicker">Online-Ergebnis</p>
            <h1>Spiel beendet!</h1>
            <p className="games-subtitle">Endstand der Lobby {cleanRoomCode}</p>
          </div>

          <Scoreboard players={scoreboard} myUid={myUid} />

          {isHost && (
            <button
              className="guess-start-button"
              type="button"
              onClick={() => navigate(`/games/pokemon-guess/online/${cleanRoomCode}`)}
            >
              Zur Lobby
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="games-page">
      <div className="games-panel guess-panel">
        <div className="guess-page-actions">
          <button
            className="games-back-button"
            type="button"
            onClick={() => navigate(`/games/pokemon-guess/online/${cleanRoomCode}`)}
          >
            Lobby
          </button>

          <button
            className="games-back-button"
            type="button"
            onClick={() => navigate("/games/pokemon-guess")}
          >
            Guess-Menü
          </button>
        </div>

        <div className="guess-topbar">
          <div>
            <p className="guess-kicker">Pokémon Guess Online</p>
            <h1>Wer ist dieses Pokémon?</h1>
            <p className="games-subtitle">
              Runde {roundNumber}/{settings.totalRounds || 10} ·{" "}
              {isBuzzerMode ? "Buzzer-Modus" : "Timer-Modus"}
            </p>
          </div>

          <div className="guess-score-box">
            <span>{isHost ? "Host" : "Mitspieler"}</span>
            <strong>
              {isTimerMode && phase === "question"
                ? `${timeLeft}s`
                : isBuzzerMode && phase === "question" && room.buzzedBy
                  ? `${buzzerTimeLeft}s`
                  : `${onlinePlayers.length} Spieler`}
            </strong>
          </div>
        </div>

        {errorText && <div className="guess-error-box">{errorText}</div>}
        {loadingText && room && <div className="guess-loading-box">{loadingText}</div>}

        <div className="online-game-layout">
          <main>
            <div className="guess-clue-card">
              <div className="guess-clue-label">
                <span>
                  {phase === "reveal" ? "Aufgedeckt" : "Rätsel läuft"}
                </span>

                {isTimerMode && phase === "question" && (
                  <strong>
                    {answeredCount}/{onlinePlayers.length} Antworten
                  </strong>
                )}

                {isBuzzerMode && phase === "question" && (
                  <strong>
                    {room.buzzedBy
                      ? `${buzzedPlayerName}: ${buzzerTimeLeft}s`
                      : "Leertaste = Buzzer"}
                  </strong>
                )}
              </div>

              {target ? (
                <ClueStack
                  clues={phase === "reveal" ? currentQuestion.clues : visibleClues}
                  target={target}
                  revealed={phase === "reveal"}
                />
              ) : (
                <div className="guess-loading-box">
                  Pokémon wird vorbereitet...
                </div>
              )}
            </div>

            {phase === "question" && (
              <RoundInputArea
                isTimerMode={isTimerMode}
                isBuzzerMode={isBuzzerMode}
                canBuzz={canBuzz}
                canAnswer={canAnswer}
                myAnswer={myAnswer}
                buzzedBy={room.buzzedBy}
                buzzedPlayerName={buzzedPlayerName}
                buzzerTimeLeft={buzzerTimeLeft}
                guessInput={guessInput}
                setGuessInput={setGuessInput}
                suggestions={suggestions}
                handleBuzz={handleBuzz}
                handleSubmitAnswer={handleSubmitAnswer}
                isHost={isHost}
                handleManualReveal={handleManualReveal}
                answeredCount={answeredCount}
                onlineCount={onlinePlayers.length}
              />
            )}

            {phase === "reveal" && (
              <RevealBox
                room={room}
                answers={answers}
                target={target}
                isHost={isHost}
                handleNextRound={handleNextRound}
                loadingText={loadingText}
              />
            )}
          </main>

          <aside className="online-score-side">
            <Scoreboard players={scoreboard} myUid={myUid} compact />
          </aside>
        </div>
      </div>
    </div>
  );
}

function RoundInputArea({
  isTimerMode,
  isBuzzerMode,
  canBuzz,
  canAnswer,
  myAnswer,
  buzzedBy,
  buzzedPlayerName,
  buzzerTimeLeft,
  guessInput,
  setGuessInput,
  suggestions,
  handleBuzz,
  handleSubmitAnswer,
  isHost,
  handleManualReveal,
  answeredCount,
  onlineCount,
}) {
  if (myAnswer) {
    return (
      <div className="guess-result-box">
        <h2>Antwort abgegeben</h2>
        <p>
          Deine Antwort: <strong>{myAnswer.answer}</strong>
        </p>
        <p>Warte, bis alle fertig sind oder der Timer abläuft.</p>

        {isHost && (
          <button
            className="guess-secondary-button"
            type="button"
            onClick={handleManualReveal}
          >
            Jetzt aufdecken
          </button>
        )}
      </div>
    );
  }

  if (isBuzzerMode && !buzzedBy) {
    return (
      <div className="online-buzzer-box">
        <button
          className="online-buzzer-button"
          type="button"
          onClick={handleBuzz}
          disabled={!canBuzz}
        >
          BUZZER
        </button>

        <p>Drücke den Button oder die Leertaste. Wer zuerst buzzert, darf antworten.</p>
      </div>
    );
  }

  if (isBuzzerMode && buzzedBy && !canAnswer) {
    return (
      <div className="guess-result-box">
        <h2>{buzzedPlayerName} war zuerst!</h2>
        <p>
          {buzzerTimeLeft === 0
            ? "Die Antwortzeit ist abgelaufen. Die Runde wird aufgedeckt."
            : "Warte, bis die Antwort abgegeben oder die Zeit abgelaufen ist."}
        </p>

        {isHost && (
          <button
            className="guess-secondary-button"
            type="button"
            onClick={handleManualReveal}
          >
            Jetzt aufdecken
          </button>
        )}
      </div>
    );
  }

  return (
    <>
      {isTimerMode && (
        <div className="guess-small-info">
          Antworten: {answeredCount}/{onlineCount}
        </div>
      )}

      {isBuzzerMode && buzzedBy && (
        <div className="online-buzzer-answer-timer">
          <span>Antwortzeit</span>
          <strong>{buzzerTimeLeft}s</strong>
        </div>
      )}

      <form className="guess-input-row" onSubmit={handleSubmitAnswer}>
        <input
          className="guess-name-input"
          value={guessInput}
          onChange={(event) => setGuessInput(event.target.value)}
          placeholder="Pokémon-Name eingeben..."
          list="online-pokemon-guess-suggestions"
          autoFocus
          disabled={!canAnswer}
        />

        <datalist id="online-pokemon-guess-suggestions">
          {suggestions.map((pokemon) => (
            <option key={pokemon.dexId} value={pokemon.name} />
          ))}
        </datalist>

        <button
          className="guess-submit-button"
          type="submit"
          disabled={!canAnswer}
        >
          Antworten
        </button>
      </form>

      {isHost && (
        <div className="guess-action-row">
          <button
            className="guess-secondary-button"
            type="button"
            onClick={handleManualReveal}
          >
            Jetzt aufdecken
          </button>
        </div>
      )}
    </>
  );
}

function RevealBox({ room, answers, target, isHost, handleNextRound, loadingText }) {
  const summaries = Array.isArray(room?.lastRevealSummary)
    ? room.lastRevealSummary
    : [];

  return (
    <div className="guess-result-box">
      <h2>Es war {target?.name || "..."}</h2>

      <div className="online-answer-list">
        {summaries.length > 0 ? (
          summaries.map((summary) => (
            <div key={summary.uid} className="online-answer-row">
              <div>
                <strong>{summary.displayName}</strong>
                <span>
                  {summary.hadAnswer
                    ? summary.answer
                    : "Keine Antwort"}
                </span>
              </div>

              <em
                className={
                  summary.correct
                    ? "online-answer-correct"
                    : summary.hadAnswer
                      ? "online-answer-wrong"
                      : "online-answer-empty"
                }
              >
                {summary.pointsDelta > 0 ? "+" : ""}
                {summary.pointsDelta}
              </em>
            </div>
          ))
        ) : (
          answers.map((answer) => (
            <div key={answer.uid} className="online-answer-row">
              <div>
                <strong>{answer.displayName}</strong>
                <span>{answer.answer}</span>
              </div>
              <em>...</em>
            </div>
          ))
        )}
      </div>

      {isHost ? (
        <button
          className="guess-next-button"
          type="button"
          onClick={handleNextRound}
          disabled={Boolean(loadingText)}
        >
          Nächste Runde
        </button>
      ) : (
        <p>Warte, bis der Host die nächste Runde startet.</p>
      )}
    </div>
  );
}

function Scoreboard({ players, myUid, compact = false }) {
  return (
    <section className={compact ? "online-scoreboard compact" : "online-scoreboard"}>
      <h2>Punktestand</h2>

      <div className="online-score-list">
        {players.map((player, index) => (
          <div
            key={player.uid || player.id}
            className={
              player.uid === myUid
                ? "online-score-row online-score-row-self"
                : "online-score-row"
            }
          >
            <div>
              <strong>
                #{index + 1} {player.displayName || "Spieler"}
              </strong>
              <span>{player.isHost ? "Host" : "Spieler"}</span>
            </div>

            <em>{Number(player.score) || 0}</em>
          </div>
        ))}
      </div>
    </section>
  );
}

function ClueStack({ clues, target, revealed }) {
  return (
    <div className="guess-clue-stack">
      {(clues || []).map((clue, index) => (
        <SingleClue
          key={`${clue.type}-${index}-${clue.strength || ""}-${clue.horizontal || ""}-${clue.vertical || ""}-${clue.black || ""}`}
          clue={clue}
          target={target}
        />
      ))}

      {revealed && (
        <div className="guess-final-reveal">
          <img
            className="guess-image"
            src={target.imageUrl}
            alt={target.name}
            draggable="false"
          />
          <div className="guess-reveal-name">{target.name}</div>
        </div>
      )}
    </div>
  );
}

function SingleClue({ clue, target }) {
  const clueType = clue.type;

  if (clueType === GUESS_CLUE_TYPES.TYPES) {
    return (
      <div className="guess-text-clue">
        <span className="guess-clue-title">Typen</span>
        <div className="guess-type-list">
          {(target.types || []).map((type) => (
            <strong key={type}>{type}</strong>
          ))}
        </div>
      </div>
    );
  }

  if (clueType === GUESS_CLUE_TYPES.GEN) {
    return (
      <div className="guess-text-clue">
        <span className="guess-clue-title">Generation</span>
        <strong>Generation {target.gen}</strong>
      </div>
    );
  }

  if (clueType === GUESS_CLUE_TYPES.ABILITY) {
    return (
      <div className="guess-text-clue">
        <span className="guess-clue-title">Fähigkeit</span>
        <strong>{target.ability || "Unbekannt"}</strong>
      </div>
    );
  }

  if (clueType === GUESS_CLUE_TYPES.MOVES) {
    return (
      <div className="guess-text-clue">
        <span className="guess-clue-title">Attacken</span>
        <div className="guess-move-list">
          {(target.moves || []).map((move) => (
            <strong key={move}>{move}</strong>
          ))}
        </div>
      </div>
    );
  }

  if (clueType === GUESS_CLUE_TYPES.STATS) {
    return <StatsClue stats={target.stats} />;
  }

  if (clueType === GUESS_CLUE_TYPES.CATEGORY) {
    return (
      <div className="guess-text-clue">
        <span className="guess-clue-title">Kategorie</span>
        <strong>{target.category || "Keine Kategorie"}</strong>
      </div>
    );
  }

  if (clueType === GUESS_CLUE_TYPES.SILHOUETTE) {
    return (
      <div className="guess-image-wrap">
        <span className="guess-clue-title">Silhouette</span>
        <img
          className="guess-image guess-image-silhouette"
          src={target.imageUrl}
          alt="Silhouette"
          draggable="false"
        />
      </div>
    );
  }

  if (clueType === GUESS_CLUE_TYPES.PIXEL_CUSTOM) {
    return (
      <div className="guess-image-wrap">
        <span className="guess-clue-title">
          Verpixelt Stufe {clue.strength}/6
        </span>
        <PixelatedImage
          src={target.imageUrl}
          alt="Verpixeltes Pokémon"
          strength={clue.strength}
          black={clue.black}
        />
      </div>
    );
  }

  if (clueType === GUESS_CLUE_TYPES.DISTORTED_CUSTOM) {
    const horizontal = clue.horizontal ?? clue.strength ?? 6;
    const vertical = clue.vertical ?? clue.strength ?? 6;

    return (
      <div className="guess-image-wrap">
        <span className="guess-clue-title">
          Verzerrt H{horizontal}/6 V{vertical}/6
        </span>
        <DistortedImage
          src={target.imageUrl}
          alt="Verzerrtes Pokémon"
          horizontal={horizontal}
          vertical={vertical}
          black={clue.black}
        />
      </div>
    );
  }

  return (
    <div className="guess-image-wrap">
      <span className="guess-clue-title">Normales Bild</span>
      <img
        className="guess-image"
        src={target.imageUrl}
        alt="Pokémon"
        draggable="false"
      />
    </div>
  );
}

function PixelatedImage({ src, alt, strength = 6, black = false }) {
  const canvasRef = useRef(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !src) return;

    const size = 320;
    const safeStrength = Math.max(1, Math.min(6, Number(strength) || 6));
    const pixelDivisor = black ? safeStrength * 4 + 8 : safeStrength * 10 + 6;
    const minLowSize = black ? 10 : 6;
    const lowSize = Math.max(minLowSize, Math.round(size / pixelDivisor));

    canvas.width = size;
    canvas.height = size;

    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, size, size);

    const image = new Image();
    image.crossOrigin = "anonymous";

    image.onload = () => {
      try {
        const smallCanvas = document.createElement("canvas");
        smallCanvas.width = lowSize;
        smallCanvas.height = lowSize;

        const smallCtx = smallCanvas.getContext("2d");
        smallCtx.clearRect(0, 0, lowSize, lowSize);

        const scale = Math.min(lowSize / image.width, lowSize / image.height) * 0.86;
        const width = image.width * scale;
        const height = image.height * scale;
        const x = (lowSize - width) / 2;
        const y = (lowSize - height) / 2;

        smallCtx.drawImage(image, x, y, width, height);

        ctx.imageSmoothingEnabled = false;
        ctx.clearRect(0, 0, size, size);
        ctx.drawImage(smallCanvas, 0, 0, size, size);

        if (black) {
          const imageData = ctx.getImageData(0, 0, size, size);
          const data = imageData.data;

          for (let i = 0; i < data.length; i += 4) {
            if (data[i + 3] > 20) {
              data[i] = 0;
              data[i + 1] = 0;
              data[i + 2] = 0;
              data[i + 3] = 245;
            }
          }

          ctx.putImageData(imageData, 0, 0);
        }
      } catch (error) {
        console.error(error);
        setFailed(true);
      }
    };

    image.onerror = () => setFailed(true);
    image.src = src;
  }, [src, strength, black]);

  if (failed) {
    return (
      <img
        className={black ? "guess-image guess-image-silhouette" : "guess-image"}
        src={src}
        alt={alt}
        draggable="false"
      />
    );
  }

  return <canvas ref={canvasRef} className="guess-canvas-image" aria-label={alt} />;
}

function DistortedImage({
  src,
  alt,
  horizontal = 6,
  vertical = 6,
  black = true,
}) {
  const safeHorizontal = Math.max(1, Math.min(6, Number(horizontal) || 6));
  const safeVertical = Math.max(1, Math.min(6, Number(vertical) || 6));
  const combined = Math.max(safeHorizontal, safeVertical);

  const style = {
    filter: [
      black ? "brightness(0)" : "saturate(1.28)",
      `blur(${0.25 + combined * 0.32}px)`,
      `contrast(${1.18 + combined * 0.2})`,
      "drop-shadow(0 24px 34px rgba(0,0,0,0.72))",
    ].join(" "),
    transformOrigin: "center",
    transform: [
      `skewX(${-8.5 * safeHorizontal}deg)`,
      `skewY(${5.5 * safeVertical}deg)`,
      `scaleX(${Math.max(0.34, 1 - safeHorizontal * 0.09)})`,
      `scaleY(${1 + safeVertical * 0.105})`,
      `rotate(${-(safeHorizontal * 1.8 + safeVertical * 1.25)}deg)`,
    ].join(" "),
  };

  return (
    <img
      className="guess-image guess-image-distorted-dynamic"
      style={style}
      src={src}
      alt={alt}
      draggable="false"
    />
  );
}

function StatsClue({ stats }) {
  if (!stats) {
    return (
      <div className="guess-text-clue">
        <span className="guess-clue-title">Stats</span>
        <strong>Unbekannt</strong>
      </div>
    );
  }

  const rows = [
    ["KP", stats.kp],
    ["Angriff", stats.atk],
    ["Verteidigung", stats.def],
    ["Sp. Angr.", stats.spAtk],
    ["Sp. Vert.", stats.spDef],
    ["Initiative", stats.init],
  ];

  return (
    <div className="guess-text-clue">
      <span className="guess-clue-title">Basiswerte</span>

      <div className="guess-stats-bars">
        {rows.map(([label, value]) => {
          const safeValue = Number(value) || 0;
          const widthPercent = Math.max(5, Math.min(100, (safeValue / 180) * 100));
          const toneClass = getStatToneClass(safeValue);

          return (
            <div key={label} className="guess-stat-bar-row">
              <div className="guess-stat-bar-top">
                <span>{label}</span>
                <strong>{safeValue}</strong>
              </div>

              <div className="guess-stat-bar-track">
                <div
                  className={`guess-stat-bar-fill ${toneClass}`}
                  style={{ width: `${widthPercent}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function getStatToneClass(value) {
  if (value >= 140) return "guess-stat-blue";
  if (value >= 100) return "guess-stat-green";
  if (value >= 70) return "guess-stat-yellow";
  return "guess-stat-red";
}