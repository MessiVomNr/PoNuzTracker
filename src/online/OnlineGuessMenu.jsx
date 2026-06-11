// src/online/OnlineGuessMenu.jsx
import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  createOnlineGuessRoom,
  joinOnlineGuessRoom,
} from "./onlineGuessService";
import "../games/guessStyles.css";

function getSavedName() {
  try {
    return localStorage.getItem("onlineGuessPlayerName") || "";
  } catch {
    return "";
  }
}

function getSavedRoomCode() {
  try {
    return localStorage.getItem("onlineGuessLastRoom") || "";
  } catch {
    return "";
  }
}

export default function OnlineGuessMenu() {
  const navigate = useNavigate();

  function navigateToOnlineRoom(result) {
    const code = String(result?.code || "").trim().toUpperCase();

    if (!code) {
      return;
    }

    if (result?.status === "playing" || result?.status === "finished") {
      navigate(`/games/pokemon-guess/online/${code}/game`);
      return;
    }

    navigate(`/games/pokemon-guess/online/${code}`);
  }

  const [playerName, setPlayerName] = useState(getSavedName);
  const [roomCode, setRoomCode] = useState(getSavedRoomCode);
  const [loadingText, setLoadingText] = useState("");
  const [errorText, setErrorText] = useState("");

  const cleanName = useMemo(() => playerName.trim(), [playerName]);
  const cleanRoomCode = useMemo(
    () => roomCode.trim().toUpperCase(),
    [roomCode]
  );

  const canSubmit = cleanName.length > 0 && !loadingText;

  async function handleCreateRoom() {
    if (!canSubmit) {
      setErrorText("Bitte gib zuerst deinen Spielernamen ein.");
      return;
    }

    setErrorText("");
    setLoadingText("Lobby wird erstellt...");

    try {
      const result = await createOnlineGuessRoom(cleanName);
      navigateToOnlineRoom(result);
    } catch (error) {
      console.error(error);
      setErrorText(error?.message || "Die Lobby konnte nicht erstellt werden.");
    } finally {
      setLoadingText("");
    }
  }

  async function handleJoinRoom(event) {
    event.preventDefault();

    if (!cleanName) {
      setErrorText("Bitte gib zuerst deinen Spielernamen ein.");
      return;
    }

    if (!cleanRoomCode) {
      setErrorText("Bitte gib einen Lobbycode ein.");
      return;
    }

    setErrorText("");
    setLoadingText("Lobby wird gesucht...");

    try {
      const result = await joinOnlineGuessRoom(cleanRoomCode, cleanName);
      navigateToOnlineRoom(result);
    } catch (error) {
      console.error(error);
      setErrorText(error?.message || "Der Lobbybeitritt ist fehlgeschlagen.");
    } finally {
      setLoadingText("");
    }
  }

  return (
    <div className="games-page">
      <div className="games-panel guess-panel">
        <div className="guess-page-actions">
          <button
            className="games-back-button"
            type="button"
            onClick={() => navigate("/games/pokemon-guess")}
          >
            Zurück
          </button>
        </div>

        <div className="guess-header">
          <p className="guess-kicker">Online-Modus</p>
          <h1>Pokémon Guess Online</h1>
          <p className="games-subtitle">
            Erstelle eine Lobby, teile den Code mit Freunden und spielt mit
            Timer oder Buzzer gegeneinander.
          </p>
        </div>

        {errorText && <div className="guess-error-box">{errorText}</div>}
        {loadingText && <div className="guess-loading-box">{loadingText}</div>}

        <div className="guess-clean-setup online-menu-grid">
          <section className="guess-settings-card">
            <h2>Spieler</h2>
            <p>
              Dieser Name wird in der Lobby, beim Buzzer und in der Punkteliste
              angezeigt.
            </p>

            <label className="online-form-label">
              <span>Dein Name</span>
              <input
                className="guess-name-input"
                value={playerName}
                maxLength={18}
                onChange={(event) => setPlayerName(event.target.value)}
                placeholder="z. B. Achim"
                disabled={Boolean(loadingText)}
              />
            </label>
          </section>

          <section className="guess-settings-card">
            <h2>Lobby erstellen</h2>
            <p>
              Du wirst Host der Lobby. Als Host kannst du später Modus,
              Rundenzahl, Zeit, Punkte und Strafen einstellen.
            </p>

            <button
              className="guess-start-button online-card-button"
              type="button"
              onClick={handleCreateRoom}
              disabled={!canSubmit}
            >
              Lobby erstellen
            </button>
          </section>

          <section className="guess-settings-card guess-wide-card">
            <h2>Lobby beitreten</h2>
            <p>
              Gib den Lobbycode ein, den du vom Host bekommen hast.
            </p>

            <form className="online-join-row" onSubmit={handleJoinRoom}>
              <input
                className="guess-name-input online-code-input"
                value={roomCode}
                maxLength={6}
                onChange={(event) =>
                  setRoomCode(event.target.value.toUpperCase())
                }
                placeholder="LOBBYCODE"
                disabled={Boolean(loadingText)}
              />

              <button
                className="guess-submit-button"
                type="submit"
                disabled={!cleanName || !cleanRoomCode || Boolean(loadingText)}
              >
                Beitreten
              </button>
            </form>
          </section>
        </div>
      </div>
    </div>
  );
}