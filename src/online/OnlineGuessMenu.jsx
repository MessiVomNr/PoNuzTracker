// src/online/OnlineGuessMenu.jsx
import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  createOnlineGuessRoom,
  joinOnlineGuessRoom,
} from "./onlineGuessService";
import controllerIcon from "../assets/Controller.png";
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

function OnlineMenuIcon({ label, children }) {
  return (
    <span className="online-menu-icon" aria-hidden="true">
      {children || <span>{label}</span>}
    </span>
  );
}

function ControllerIcon() {
  return (
    <OnlineMenuIcon>
      <img
        className="online-menu-controller-img"
        src={controllerIcon}
        alt=""
      />
    </OnlineMenuIcon>
  );
}

export default function OnlineGuessMenu() {
  const navigate = useNavigate();

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
    <main className="games-page games-hub-page online-menu-page">
      <section className="games-hub-panel online-menu-panel">
        <button
          type="button"
          className="games-hub-back-button"
          onClick={() => navigate("/games/pokemon-guess")}
        >
          <span className="games-hub-back-arrow">‹</span>
          Zurück
        </button>

        <header className="games-hub-header online-menu-header">
          <h1>Pokémon Guess Online</h1>
          <p>
            Erstelle eine Lobby, teile den Code mit Freunden und spielt mit
            Timer oder Buzzer gegeneinander.
          </p>
        </header>

        {errorText && (
          <div className="online-menu-alert online-menu-alert-error">
            {errorText}
          </div>
        )}

        {loadingText && (
          <div className="online-menu-alert online-menu-alert-loading">
            {loadingText}
          </div>
        )}

        <div className="online-menu-layout">
          <section className="online-menu-card online-menu-player-card">
            <div className="online-menu-card-head">
              <OnlineMenuIcon label="DU" />

              <div>
                <h2>Spieler</h2>
                <p>
                  Dieser Name wird in der Lobby, beim Buzzer und in der
                  Punkteliste angezeigt.
                </p>
              </div>
            </div>

            <label className="online-menu-label">
              <span>Dein Name</span>
              <input
                className="online-menu-input"
                value={playerName}
                maxLength={18}
                onChange={(event) => setPlayerName(event.target.value)}
                placeholder="z. B. Achim"
                disabled={Boolean(loadingText)}
              />
            </label>
          </section>

          <section className="online-menu-card online-menu-create-card">
            <div className="online-menu-card-head">
              <ControllerIcon />

              <div>
                <h2>Lobby erstellen</h2>
                <p>
                  Du wirst Host der Lobby und kannst danach Modus, Rundenzahl,
                  Timer, Punkte und Strafen einstellen.
                </p>
              </div>
            </div>

            <button
              className="online-menu-main-button"
              type="button"
              onClick={handleCreateRoom}
              disabled={!canSubmit}
            >
              Lobby erstellen
            </button>
          </section>

          <section className="online-menu-card online-menu-join-card">
            <div className="online-menu-card-head">
              <OnlineMenuIcon label="ID" />

              <div>
                <h2>Lobby beitreten</h2>
                <p>
                  Gib den Lobbycode ein, den du vom Host bekommen hast. Wenn die
                  Runde schon läuft, kommst du direkt wieder ins Spiel.
                </p>
              </div>
            </div>

            <form className="online-menu-join-form" onSubmit={handleJoinRoom}>
              <label className="online-menu-label">
                <span>Lobbycode</span>
                <input
                  className="online-menu-input online-menu-code-input"
                  value={roomCode}
                  maxLength={6}
                  onChange={(event) =>
                    setRoomCode(event.target.value.toUpperCase())
                  }
                  placeholder="LOBBY"
                  disabled={Boolean(loadingText)}
                />
              </label>

              <button
                className="online-menu-secondary-button"
                type="submit"
                disabled={!cleanName || !cleanRoomCode || Boolean(loadingText)}
              >
                Beitreten
              </button>
            </form>
          </section>
        </div>
      </section>
    </main>
  );
}