// src/online/OnlineGuessGame.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ONLINE_GUESS_GAME_MODES,
  getOnlineGuessPlayerId,
  goToNextOnlineGuessRound,
  startOnlineGuessTiebreaker,
  returnOnlineGuessToLobby,
  skipOnlineGuessBuzzer,
  expireOnlineGuessBuzzerResponder,
  finishOnlineGuessCountdown,
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
  const currentGameId = room?.gameId || "";
  const roundNumber = Number(room?.currentRound) || 1;
  const isTiebreakerRound = Boolean(room?.isTiebreaker);
  const tiebreakerPlayerIds = Array.isArray(room?.tiebreakerPlayerIds)
    ? room.tiebreakerPlayerIds
    : [];
  const isHost = Boolean(room && myUid && room.hostId === myUid);
  const isTimerMode =
    !isTiebreakerRound &&
    settings.gameMode === ONLINE_GUESS_GAME_MODES.TIMER;

  const isBuzzerMode =
    isTiebreakerRound ||
    settings.gameMode === ONLINE_GUESS_GAME_MODES.BUZZER;
  const phase = room?.phase || "question";

  const countdownLeft = useMemo(() => {
    if (phase !== "countdown") {
      return 0;
    }

    const endAt = Number(room?.countdownEndsAtMs) || 0;

    if (!endAt) {
      return 0;
    }

    const secondsLeft = Math.ceil((endAt - nowMs) / 1000);
    return Math.min(3, Math.max(0, secondsLeft));
  }, [phase, room?.countdownEndsAtMs, nowMs]);

  useEffect(() => {
    setNowMs(Date.now());

    if (phase !== "question" && phase !== "countdown") return undefined;

    const timer = setInterval(() => {
      setNowMs(Date.now());
    }, 100);

    return () => clearInterval(timer);
  }, [
    phase,
    room?.countdownEndsAtMs,
    room?.roundStartedAt,
    room?.buzzerAnswerDeadlineAtMs,
  ]);

  const onlinePlayers = useMemo(() => {
    return players.filter((player) => player.online !== false && !player.kicked);
  }, [players]);

    const activeRoundPlayers = useMemo(() => {
    if (!isTiebreakerRound) {
      return onlinePlayers;
    }

    return onlinePlayers.filter((player) => {
      return tiebreakerPlayerIds.includes(player.uid || player.id);
    });
  }, [isTiebreakerRound, onlinePlayers, tiebreakerPlayerIds]);

  const canParticipateInRound = useMemo(() => {
    if (!isTiebreakerRound) {
      return true;
    }

    return tiebreakerPlayerIds.includes(myUid);
  }, [isTiebreakerRound, tiebreakerPlayerIds, myUid]);

  const tiebreakerPlayerNames = useMemo(() => {
    return activeRoundPlayers
      .map((player) => player.displayName || "Spieler")
      .join(", ");
  }, [activeRoundPlayers]);

  const currentPlayer = useMemo(() => {
    return players.find((player) => player.uid === myUid || player.id === myUid) || null;
  }, [players, myUid]);

  const scoreboard = useMemo(() => sortScoreboard(players), [players]);

  const topTiePlayers = useMemo(() => {
    if (!scoreboard.length) {
      return [];
    }

    const topScore = Number(scoreboard[0]?.score) || 0;

    return scoreboard.filter((player) => {
      return (Number(player.score) || 0) === topScore;
    });
  }, [scoreboard]);

  const hasTopTie = topTiePlayers.length >= 2;

  const myAnswer = useMemo(() => {
    return answers.find((answer) => answer.uid === myUid) || null;
  }, [answers, myUid]);

  const wrongBuzzerAnswers = useMemo(() => {
    if (!isBuzzerMode) return [];

    return answers
      .filter((answer) => {
        return (
          answer.uid !== myUid &&
          answer.correct === false &&
          Boolean(String(answer.answer || "").trim())
        );
      })
      .sort((a, b) => timestampToMillis(a.submittedAt) - timestampToMillis(b.submittedAt));
  }, [answers, isBuzzerMode, myUid]);

  const buzzedPlayerName = useMemo(() => {
    if (!room?.buzzedBy) return "";
    return getPlayerLabel(players, room.buzzedBy);
  }, [players, room?.buzzedBy]);

  const currentResponderName = useMemo(() => {
    if (!room?.currentResponder) return "";
    return getPlayerLabel(players, room.currentResponder);
  }, [players, room?.currentResponder]);

  const buzzQueue = useMemo(() => {
    const queue = Array.isArray(room?.buzzQueue) ? room.buzzQueue : [];
    const firstTime = Number(queue[0]?.buzzedAtMs) || 0;

    return queue.map((entry, index) => {
      const buzzedAtMs = Number(entry.buzzedAtMs) || 0;
      const diffMs = firstTime ? Math.max(0, buzzedAtMs - firstTime) : 0;

      return {
        ...entry,
        rank: index + 1,
        displayName: getPlayerLabel(players, entry.uid),
        diffSeconds: diffMs / 1000,
      };
    });
  }, [players, room?.buzzQueue]);

  const hasBuzzedThisRound = useMemo(() => {
    return buzzQueue.some((entry) => entry.uid === myUid);
  }, [buzzQueue, myUid]);

  const skippedPlayers = useMemo(() => {
    return Array.isArray(room?.skippedPlayers)
      ? room.skippedPlayers
      : [];
  }, [room?.skippedPlayers]);

  const hasSkippedThisRound = useMemo(() => {
    return skippedPlayers.includes(myUid);
  }, [skippedPlayers, myUid]);

  const currentResponderHasAnswered = useMemo(() => {
    if (!room?.currentResponder) return false;

    return answers.some(
      (answer) => answer.uid === room.currentResponder && Boolean(answer.answer)
    );
  }, [answers, room?.currentResponder]);

  const currentResponderAnswer = useMemo(() => {
    if (!room?.currentResponder) return null;

    return answers.find((answer) => answer.uid === room.currentResponder) || null;
  }, [answers, room?.currentResponder]);

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
    if (!isBuzzerMode || phase !== "question" || !room?.currentResponder) return null;

    const deadlineAtMs = Number(room?.buzzerAnswerDeadlineAtMs) || 0;

    if (!deadlineAtMs) {
      return Math.max(3, Number(settings.buzzerAnswerSeconds) || 7);
    }

    return Math.max(0, Math.ceil((deadlineAtMs - nowMs) / 1000));
  }, [
    isBuzzerMode,
    phase,
    room?.currentResponder,
    room?.buzzerAnswerDeadlineAtMs,
    settings.buzzerAnswerSeconds,
    nowMs,
  ]);

  const answeredCount = answers.filter((answer) => {
    return (
      Boolean(answer.answer) &&
      activeRoundPlayers.some((player) => {
        const uid = player.uid || player.id;
        return uid === answer.uid;
      })
    );
  }).length;

  const completedCount = activeRoundPlayers.filter((player) => {
    const uid = player.uid || player.id;

    return (
      skippedPlayers.includes(uid) ||
      answers.some((answer) => answer.uid === uid && Boolean(answer.answer))
    );
  }).length;

  const allAnswered =
    activeRoundPlayers.length > 0 &&
    activeRoundPlayers.every((player) => {
      const uid = player.uid || player.id;

      return (
        skippedPlayers.includes(uid) ||
        answers.some((answer) => answer.uid === uid && Boolean(answer.answer))
      );
    });

  const canAnswerTimer =
    room?.status === "playing" &&
    phase === "question" &&
    isTimerMode &&
    canParticipateInRound &&
    !myAnswer &&
    !hasSkippedThisRound;

  const canBuzz =
    room?.status === "playing" &&
    phase === "question" &&
    isBuzzerMode &&
    canParticipateInRound &&
    !hasBuzzedThisRound &&
    !hasSkippedThisRound;

  const canAnswerBuzzer =
    room?.status === "playing" &&
    phase === "question" &&
    isBuzzerMode &&
    canParticipateInRound &&
    room?.currentResponder === myUid &&
    !myAnswer &&
    !hasSkippedThisRound &&
    (buzzerTimeLeft === null || buzzerTimeLeft > 0);

  const canAnswer = canAnswerTimer || canAnswerBuzzer;

  const canSkip =
    room?.status === "playing" &&
    phase === "question" &&
    canParticipateInRound &&
    !myAnswer &&
    !hasSkippedThisRound;

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
    setAnswers([]);
    setGuessInput("");
    revealAttemptRef.current = "";

    if (!cleanRoomCode || !currentGameId || !roundNumber || room?.status !== "playing") {
      return undefined;
    }

    const unsubAnswers = subscribeOnlineGuessAnswers(
      cleanRoomCode,
      currentGameId,
      roundNumber,
      (nextAnswers) => {
        setAnswers(nextAnswers);
      }
    );

    return () => {
      setAnswers([]);
      unsubAnswers();
    };
  }, [cleanRoomCode, currentGameId, roundNumber, room?.status, roundStartedAtMs]);

  useEffect(() => {
    if (!myUid || !currentPlayer?.kicked) return;

    navigate("/games/pokemon-guess/online");
  }, [currentPlayer?.kicked, myUid, navigate]);

  useEffect(() => {
    if (!cleanRoomCode || !myUid || currentPlayer?.kicked) return undefined;

    heartbeatOnlineGuessPlayer(cleanRoomCode).catch(() => {});

    const timer = setInterval(() => {
      heartbeatOnlineGuessPlayer(cleanRoomCode).catch(() => {});
    }, 20000);

    return () => clearInterval(timer);
  }, [cleanRoomCode, myUid, currentPlayer?.kicked]);

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
    if (!isHost) return;
    if (!room || room.status !== "playing") return;

    if (phase === "countdown") {
      if (countdownLeft === 0) {
        finishOnlineGuessCountdown(cleanRoomCode).catch((error) => {
          console.error(error);
        });
      }

      return;
    }

    if (phase !== "question") return;

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

    if (isBuzzerMode) {
      const hasCorrectAnswer = answers.some((answer) => answer.correct === true);
      const skippedSet = new Set(skippedPlayers);
      const outByWrongAnswer = new Set(
        answers
          .filter((answer) => answer.correct === false)
          .map((answer) => answer.uid)
      );

      const unansweredBuzzers = buzzQueue.filter((entry) => {
        return (
          !skippedSet.has(entry.uid) &&
          !outByWrongAnswer.has(entry.uid)
        );
      });

      const everyoneOut =
        activeRoundPlayers.length > 0 &&
        activeRoundPlayers.every((player) => {
          return skippedSet.has(player.uid) || outByWrongAnswer.has(player.uid);
        });

      if (
        everyoneOut &&
        unansweredBuzzers.length === 0 &&
        !room.currentResponder
      ) {
        autoReveal("everyoneOut");
        return;
      }
      if (hasCorrectAnswer) {
        autoReveal("buzzerCorrect");
        return;
      }

      if (room.currentResponder && buzzerTimeLeft === 0) {
        expireOnlineGuessBuzzerResponder(cleanRoomCode).catch((error) => {
          console.error(error);
        });
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
    buzzQueue,
    skippedPlayers,
    countdownLeft,
    activeRoundPlayers,
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

  async function handleSkip() {
    if (!canSkip) return;

    setErrorText("");

    try {
      await skipOnlineGuessBuzzer(cleanRoomCode);
    } catch (error) {
      console.error(error);
      setErrorText(error?.message || "Skip fehlgeschlagen.");
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
    setLoadingText(isTiebreakerRound ? "Ergebnis wird vorbereitet..." : "Nächste Runde wird vorbereitet...");

    try {
      await goToNextOnlineGuessRound(cleanRoomCode);
    } catch (error) {
      console.error(error);
      setErrorText(
        error?.message ||
          (isTiebreakerRound
            ? "Ergebnis konnte nicht geöffnet werden."
            : "Nächste Runde konnte nicht gestartet werden.")
      );
    } finally {
      setLoadingText("");
    }
  }

  async function handleStartTiebreaker() {
    if (!isHost) return;

    setErrorText("");
    setLoadingText("Stichfrage wird vorbereitet...");

    try {
      await startOnlineGuessTiebreaker(cleanRoomCode);
    } catch (error) {
      console.error(error);
      setErrorText(error?.message || "Stichfrage konnte nicht gestartet werden.");
    } finally {
      setLoadingText("");
    }
  }

async function handleReturnToLobby() {
  if (!isHost) return;

  console.log("HOST DRÜCKT ZUR LOBBY");

  try {
    await returnOnlineGuessToLobby(cleanRoomCode);

    console.log("RETURN TO LOBBY ERFOLGREICH");
  } catch (error) {
    console.error(error);

    setErrorText(
      error?.message || "Lobby konnte nicht geöffnet werden."
    );
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
        <div className="games-panel guess-panel online-final-panel">
          <div className="guess-page-actions online-final-actions">
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

          <div className="online-final-hero">
            <p className="guess-kicker">Online-Ergebnis</p>
            <h1>Spiel beendet!</h1>
            <p className="games-subtitle">Endstand der Lobby {cleanRoomCode}</p>
          </div>

          {errorText && <div className="guess-error-box">{errorText}</div>}
          {loadingText && room && <div className="guess-loading-box">{loadingText}</div>}

          <FinalPodium players={scoreboard} />

          <div className="online-final-footer">
            {isHost ? (
              <>
                {hasTopTie && (
                  <button
                    className="guess-start-button online-final-main-button"
                    type="button"
                    onClick={handleStartTiebreaker}
                    disabled={Boolean(loadingText)}
                  >
                    Stichfrage starten
                  </button>
                )}

                <button
                  className="guess-secondary-button online-final-main-button"
                  type="button"
                  onClick={handleReturnToLobby}
                  disabled={Boolean(loadingText)}
                >
                  Lobby wieder öffnen
                </button>
              </>
            ) : (
              <p className="guess-small-info online-final-wait-text">
                {hasTopTie
                  ? "Gleichstand auf Platz 1. Warte, ob der Host eine Stichfrage startet."
                  : "Warte, bis der Host die Lobby wieder öffnet."}
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="games-page">
      <div className="games-panel guess-panel">
        <div className="guess-page-actions">
          {isHost ? (
            <button
              className="games-back-button"
              type="button"
              onClick={handleReturnToLobby}
              disabled={Boolean(loadingText)}
            >
              Runde schließen
            </button>
          ) : (
            <button
              className="games-back-button"
              type="button"
              onClick={() => navigate(`/games/pokemon-guess/online/${cleanRoomCode}`)}
            >
              Lobby
            </button>
          )}

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
              {isTiebreakerRound
                ? `Stichfrage · nur für: ${tiebreakerPlayerNames || "Gleichstand"}`
                : `Runde ${roundNumber}/${settings.totalRounds || 10} · ${
                    isBuzzerMode ? "Buzzer-Modus" : "Timer-Modus"
                  }`}
            </p>
          </div>

          <div className="guess-score-box">
            <span>{isHost ? "Host" : "Mitspieler"}</span>
            <strong>
              {isTimerMode && phase === "question"
                ? `${timeLeft}s`
                : isBuzzerMode && phase === "question" && room.buzzedBy
                  ? `${buzzerTimeLeft}s`
                  : isTiebreakerRound
                    ? `${activeRoundPlayers.length} im Gleichstand`
                    : `${onlinePlayers.length} Spieler`}
            </strong>
          </div>
        </div>

        {errorText && <div className="guess-error-box">{errorText}</div>}
        {loadingText && room && <div className="guess-loading-box">{loadingText}</div>}

        {phase === "reveal" && isHost && (
          <div className="guess-action-row online-reveal-top-actions">
            <button
              className="guess-next-button"
              type="button"
              onClick={handleNextRound}
              disabled={Boolean(loadingText)}
            >
              {isTiebreakerRound ? "Zum Ergebnis" : "Nächstes Pokémon"}
            </button>

            <button
              className="guess-secondary-button"
              type="button"
              onClick={handleReturnToLobby}
              disabled={Boolean(loadingText)}
            >
              Zur Lobby
            </button>
          </div>
        )}

        {phase === "countdown" ? (
          <CountdownScreen countdownLeft={countdownLeft} />
        ) : (
          <div className="online-game-layout">
            <main>
              <div className="guess-clue-card">
              <div className="guess-clue-label">
                <span>
                  {phase === "reveal" ? "Aufgedeckt" : "Rätsel läuft"}
                </span>

                {isTimerMode && phase === "question" && (
                  <strong>
                    {completedCount}/{activeRoundPlayers.length} fertig
                  </strong>
                )}

                {isBuzzerMode && phase === "question" && (
                  <strong>
                    {room.currentResponder
                    ? `${currentResponderName}: ${buzzerTimeLeft}s`
                    : "Buzzer offen"}
                  </strong>
                )}
              </div>

              {target ? (
                <ClueStack
                  clues={visibleClues}
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
                isTiebreakerRound={isTiebreakerRound}
                canParticipateInRound={canParticipateInRound}
                tiebreakerPlayerNames={tiebreakerPlayerNames}
                canBuzz={canBuzz}
                canAnswer={canAnswer}
                canSkip={canSkip}
                hasSkippedThisRound={hasSkippedThisRound}
                myAnswer={myAnswer}
                buzzedBy={room.buzzedBy}
                buzzedPlayerName={buzzedPlayerName}
                currentResponder={room.currentResponder}
                currentResponderName={currentResponderName}
                currentResponderHasAnswered={currentResponderHasAnswered}
                currentResponderAnswer={currentResponderAnswer}
                wrongBuzzerAnswers={wrongBuzzerAnswers}
                buzzQueue={buzzQueue}
                hasBuzzedThisRound={hasBuzzedThisRound}
                buzzerTimeLeft={buzzerTimeLeft}
                guessInput={guessInput}
                setGuessInput={setGuessInput}
                suggestions={suggestions}
                handleBuzz={handleBuzz}
                handleSkip={handleSkip}
                handleSubmitAnswer={handleSubmitAnswer}
                isHost={isHost}
                handleManualReveal={handleManualReveal}
                answeredCount={answeredCount}
                onlineCount={activeRoundPlayers.length}
              />
            )}

            {phase === "reveal" && (
              <RevealBox
                room={room}
                answers={answers}
                target={target}
                isHost={false}
                isTiebreakerRound={isTiebreakerRound}
                handleNextRound={handleNextRound}
                handleReturnToLobby={handleReturnToLobby}
                loadingText={loadingText}
              />
            )}
          </main>

              <aside className="online-score-side">
                <Scoreboard players={scoreboard} myUid={myUid} compact />
              </aside>
            </div>
        )}
      </div>
    </div>
  );
}

function CountdownScreen({ countdownLeft }) {
  const label = countdownLeft > 0 ? countdownLeft : "LOS!";

  return (
    <div className="online-countdown-screen">
      <p className="guess-kicker">Gleich geht es los</p>
      <strong>{label}</strong>
      <span>Bereit machen...</span>
    </div>
  );
}


function RoundInputArea({
  isTimerMode,
  isBuzzerMode,
  isTiebreakerRound,
  canParticipateInRound,
  tiebreakerPlayerNames,
  canBuzz,
  canAnswer,
  canSkip,
  hasSkippedThisRound,
  myAnswer,
  buzzedBy,
  buzzedPlayerName,
  currentResponder,
  currentResponderName,
  currentResponderHasAnswered,
  currentResponderAnswer,
  wrongBuzzerAnswers,
  buzzQueue,
  hasBuzzedThisRound,
  buzzerTimeLeft,
  guessInput,
  setGuessInput,
  suggestions,
  handleBuzz,
  handleSkip,
  handleSubmitAnswer,
  isHost,
  handleManualReveal,
  answeredCount,
  onlineCount,
}) {
  if (isTiebreakerRound && !canParticipateInRound) {
    return (
      <div className="guess-result-box">
        <h2>Stichfrage läuft</h2>
        <p>
          Nur die Spieler mit gleicher Höchstpunktzahl dürfen buzzern.
        </p>
        <p>
          Im Gleichstand: <strong>{tiebreakerPlayerNames || "Spieler"}</strong>
        </p>
      </div>
    );
  }

    if (hasSkippedThisRound) {
    return (
      <div className="guess-result-box">
        <h2>Übersprungen</h2>
        <p>
          Du bekommst für dieses Pokémon keine Minuspunkte.
        </p>
        <p>Warte, bis die Runde aufgedeckt wird.</p>

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

  if (myAnswer) {
    return (
      <div className="guess-result-box">
        <h2>Antwort abgegeben</h2>
        <p>
          Deine Antwort: <strong>{myAnswer.answer}</strong>
        </p>

        <WrongGuessList wrongAnswers={wrongBuzzerAnswers} />

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

  if (isBuzzerMode && !canAnswer) {
    return (
      <>
        <BuzzerQueuePanel
          buzzQueue={buzzQueue}
          currentResponder={currentResponder}
          currentResponderName={currentResponderName}
          buzzerTimeLeft={buzzerTimeLeft}
        />

        <WrongGuessList wrongAnswers={wrongBuzzerAnswers} />

        {!hasBuzzedThisRound && (
          <div className="online-buzzer-box">
            <button
              className="online-buzzer-button"
              type="button"
              onClick={handleBuzz}
              disabled={!canBuzz}
            >
              BUZZER
            </button>

            <div className="guess-action-row">
              <button
                className="guess-secondary-button"
                type="button"
                onClick={handleSkip}
                disabled={!canSkip}
              >
                Skip
              </button>
            </div>

            <p>
              Du kannst auch noch buzzern, wenn jemand anderes schon dran ist.
              Jeder darf pro Pokémon nur einmal buzzern.
            </p>
          </div>
        )}

        {hasBuzzedThisRound && (
          <div className="guess-result-box">
            <h2>Du bist in der Buzzer-Liste</h2>
            <p>
              {currentResponderName
                ? `${currentResponderName} ist aktuell dran.`
                : "Warte, bis die Runde aufgedeckt wird."}
            </p>

            <button
              className="guess-secondary-button"
              type="button"
              onClick={handleSkip}
              disabled={!canSkip}
            >
              Skip
            </button>
          </div>
        )}

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

  return (
    <>
      {isBuzzerMode && (
        <>
          <BuzzerQueuePanel
            buzzQueue={buzzQueue}
            currentResponder={currentResponder}
            currentResponderName={currentResponderName}
            buzzerTimeLeft={buzzerTimeLeft}
          />

          <WrongGuessList wrongAnswers={wrongBuzzerAnswers} />
        </>
      )}
      {isTimerMode && (
        <div className="guess-small-info">
          Antworten: {answeredCount}/{onlineCount}
        </div>
      )}

      {canSkip && (
        <div className="guess-action-row">
          <button
            className="guess-secondary-button"
            type="button"
            onClick={handleSkip}
          >
            Skip
          </button>
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

function BuzzerQueuePanel({
  buzzQueue,
  currentResponder,
  currentResponderName,
  buzzerTimeLeft,
}) {
  if (!buzzQueue?.length) {
    return (
      <div className="online-buzz-queue-panel">
        <h2>Noch niemand hat gebuzzert</h2>
        <p>Der erste Buzzer bekommt die erste Antwortchance.</p>
      </div>
    );
  }

  return (
    <div className="online-buzz-queue-panel">
      <div className="online-buzz-queue-head">
        <div>
          <h2>Buzzer-Reihenfolge</h2>
          <p>
            {currentResponderName
              ? `${currentResponderName} ist aktuell dran.`
              : "Alle Buzzer wurden verwendet."}
          </p>
        </div>

        {currentResponderName && (
          <strong>{buzzerTimeLeft ?? "-"}s</strong>
        )}
      </div>

      <div className="online-buzz-queue-list">
        {buzzQueue.map((entry) => (
          <div
            key={entry.uid}
            className={
              entry.uid === currentResponder
                ? "online-buzz-queue-row online-buzz-queue-row-active"
                : "online-buzz-queue-row"
            }
          >
            <div>
              <strong>
                #{entry.rank} {entry.displayName}
              </strong>
              <span>
                {entry.rank === 1
                  ? "zuerst gebuzzert"
                  : `+${entry.diffSeconds.toFixed(2)}s langsamer`}
              </span>
            </div>

            {entry.uid === currentResponder && <em>dran</em>}
          </div>
        ))}
      </div>
    </div>
  );
}

function WrongGuessList({ wrongAnswers }) {
  if (!wrongAnswers?.length) {
    return null;
  }

  return (
    <div className="online-wrong-guess-panel">
      <div className="online-wrong-guess-head">
        <strong>Schon falsch geraten</strong>
        <span>Nicht nochmal nehmen</span>
      </div>

      <div className="online-wrong-guess-list">
        {wrongAnswers.map((answer) => (
          <div
            key={answer.uid || answer.id}
            className="online-wrong-guess-row"
          >
            <span>{answer.displayName || "Spieler"}</span>
            <strong>{answer.answer}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}

function RevealBox({
  room,
  answers,
  target,
  isHost,
  isTiebreakerRound = false,
  handleNextRound,
  handleReturnToLobby,
  loadingText,
}) {
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
                <span>{summary.hadAnswer ? summary.answer : "Keine Antwort"}</span>
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
        <div className="guess-action-row">
          <button
            className="guess-next-button"
            type="button"
            onClick={handleNextRound}
            disabled={Boolean(loadingText)}
          >
            {isTiebreakerRound ? "Zum Ergebnis" : "Nächste Runde"}
          </button>

          <button
            className="guess-secondary-button"
            type="button"
            onClick={handleReturnToLobby}
            disabled={Boolean(loadingText)}
          >
            Zur Lobby
          </button>
        </div>
      ) : (
        <p>Warte, bis der Host die nächste Runde startet.</p>
      )}
    </div>
  );
}

function FinalPodium({ players }) {
  const sorted = [...players].sort((a, b) => {
    const scoreDiff = (Number(b.score) || 0) - (Number(a.score) || 0);
    if (scoreDiff !== 0) return scoreDiff;
    return String(a.displayName || "").localeCompare(String(b.displayName || ""));
  });

  const rankedPlayers = sorted.map((player, index) => ({
    ...player,
    finalRank: index + 1,
    finalKey: player.uid || player.id || `${player.displayName}-${index}`,
  }));

  const topThree = rankedPlayers.slice(0, 3);
  const visualOrder =
    topThree.length >= 3
      ? [topThree[1], topThree[0], topThree[2]]
      : topThree.length === 2
        ? [topThree[1], topThree[0]]
        : topThree;

  const rest = rankedPlayers.slice(3);

  if (rankedPlayers.length === 0) {
    return (
      <div className="online-final-podium">
        <div className="online-final-section-title">
          <span>Endergebnis</span>
          <h2>Keine Spieler gefunden</h2>
        </div>
      </div>
    );
  }

  return (
    <div className={`online-final-podium online-final-count-${topThree.length}`}>
      <div className="online-final-section-title">
        <span>Endergebnis</span>
        <h2>Podium</h2>
      </div>

      <div className="online-podium-layout">
        {visualOrder.map((player) => {
          const score = Number(player.score) || 0;
          const displayName = player.displayName || "Spieler";
          const initial = displayName.trim().charAt(0).toUpperCase() || "?";

          return (
            <div
              key={player.finalKey}
              className={`online-final-card online-final-card-rank-${player.finalRank}`}
            >
              <div className="online-final-rank-badge">
                {player.finalRank}
              </div>

              <div className="online-final-avatar">
                {initial}
              </div>

              <strong className="online-final-card-name">
                {displayName}
              </strong>

              <span className="online-final-card-score">
                {score} Punkte
              </span>

              <div className="online-final-step">
                <span>Platz {player.finalRank}</span>
              </div>
            </div>
          );
        })}
      </div>

      {rest.length > 0 && (
        <div className="online-podium-rest">
          {rest.map((player) => (
            <div
              key={player.finalKey}
              className="online-podium-rest-row"
            >
              <span>{player.finalRank}.</span>
              <strong>{player.displayName || "Spieler"}</strong>
              <span>{Number(player.score) || 0} Punkte</span>
            </div>
          ))}
        </div>
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