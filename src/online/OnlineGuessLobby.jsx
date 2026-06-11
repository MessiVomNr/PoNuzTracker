// src/online/OnlineGuessLobby.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  DEFAULT_ONLINE_GUESS_SETTINGS,
  ONLINE_GUESS_GAME_MODES,
  closeOnlineGuessRoom,
  kickOnlineGuessPlayer,
  transferOnlineGuessHost,
  getOnlineGuessPlayerId,
  heartbeatOnlineGuessPlayer,
  leaveOnlineGuessRoom,
  setOnlineGuessReady,
  startOnlineGuessGame,
  subscribeOnlineGuessPlayers,
  subscribeOnlineGuessRoom,
  updateOnlineGuessSettings,
} from "./onlineGuessService";
import {
  GENERATION_OPTIONS,
  GUESS_CLUE_TYPES,
  GUESS_PLAY_MODE_LABELS,
  GUESS_PLAY_MODES,
} from "../games/guessGameEngine";
import "../games/guessStyles.css";

const LEVEL_OPTIONS = [1, 2, 3, 4, 5, 6];

const PIKACHU_PREVIEW = {
  name: "Pikachu",
  gen: 1,
  category: "Maus-Pokémon",
  types: ["Elektro"],
  ability: "Statik",
  moves: ["Donnerschock", "Ruckzuckhieb", "Donnerwelle", "Volt Tackle"],
  imageUrl:
    "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/25.png",
  stats: {
    kp: 35,
    atk: 55,
    def: 40,
    spAtk: 50,
    spDef: 50,
    init: 90,
  },
};

function getSafeSettings(room) {
  return {
    ...DEFAULT_ONLINE_GUESS_SETTINGS,
    ...(room?.settings || {}),
    pixel: {
      ...DEFAULT_ONLINE_GUESS_SETTINGS.pixel,
      ...(room?.settings?.pixel || {}),
    },
    distorted: {
      ...DEFAULT_ONLINE_GUESS_SETTINGS.distorted,
      ...(room?.settings?.distorted || {}),
    },
  };
}

function getPlayerName(player) {
  return player?.displayName || "Spieler";
}

function FancySelect({ value, onChange, options, disabled }) {
  return (
    <div className="online-fancy-select-wrap">
      <select
        className="guess-name-input online-fancy-select"
        value={value}
        onChange={onChange}
        disabled={disabled}
      >
        {options.map((option) => {
          const item =
            typeof option === "object"
              ? option
              : { value: option, label: String(option) };

          return (
            <option key={String(item.value)} value={item.value}>
              {item.label}
            </option>
          );
        })}
      </select>
      <span className="online-fancy-select-arrow">▾</span>
    </div>
  );
}

function NumberInput({
  value,
  min = 1,
  max = 9999,
  step = 1,
  disabled,
  onCommit,
}) {
  const [draft, setDraft] = useState(String(value ?? ""));

  useEffect(() => {
    setDraft(String(value ?? ""));
  }, [value]);

  function commitValue() {
    let next = Number(draft);

    if (!Number.isFinite(next)) {
      next = Number(value) || min;
    }

    next = Math.max(min, Math.min(max, next));

    if (step === 1) {
      next = Math.round(next);
    }

    setDraft(String(next));
    onCommit(next);
  }

  return (
    <input
      className="guess-number-input online-manual-number-input"
      type="number"
      inputMode="numeric"
      min={min}
      max={max}
      step={step}
      value={draft}
      disabled={disabled}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commitValue}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.currentTarget.blur();
        }
      }}
    />
  );
}

export default function OnlineGuessLobby() {
  const navigate = useNavigate();
  const { roomCode } = useParams();

  const cleanRoomCode = String(roomCode || "").trim().toUpperCase();

  const [room, setRoom] = useState(null);
  const [players, setPlayers] = useState([]);
  const [myUid, setMyUid] = useState("");
  const [copied, setCopied] = useState(false);
  const [openPlayerMenuUid, setOpenPlayerMenuUid] = useState("");
  const [loadingText, setLoadingText] = useState("Lobby wird geladen...");
  const [errorText, setErrorText] = useState("");

  const settings = useMemo(() => getSafeSettings(room), [room]);

  const currentPlayer = useMemo(() => {
    return players.find((player) => player.uid === myUid || player.id === myUid) || null;
  }, [players, myUid]);

  const onlinePlayers = useMemo(() => {
    return players.filter((player) => player.online !== false);
  }, [players]);

  const isHost = Boolean(room && myUid && room.hostId === myUid);
  const allReady =
    onlinePlayers.length > 0 && onlinePlayers.every((player) => Boolean(player.ready));

  useEffect(() => {
    if (!myUid || !currentPlayer?.kicked) return;

    navigate("/games/pokemon-guess/online");
  }, [currentPlayer?.kicked, myUid, navigate]);

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

    setLoadingText("Lobby wird geladen...");

    const unsubRoom = subscribeOnlineGuessRoom(cleanRoomCode, (nextRoom) => {
      setRoom(nextRoom);
      setLoadingText("");

      if (!nextRoom) {
        setErrorText("Diese Lobby wurde nicht gefunden.");
        return;
      }

      if (nextRoom.status === "playing") {
        navigate(`/games/pokemon-guess/online/${cleanRoomCode}/game`);
      }

      if (nextRoom.status === "finished") {
        navigate(`/games/pokemon-guess/online/${cleanRoomCode}/game`);
      }
      
      if (nextRoom.status === "closed") {
        navigate("/games/pokemon-guess/online");
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
    if (!cleanRoomCode || !myUid) return undefined;

    heartbeatOnlineGuessPlayer(cleanRoomCode).catch(() => {});

    const timer = setInterval(() => {
      heartbeatOnlineGuessPlayer(cleanRoomCode).catch(() => {});
    }, 20000);

    return () => clearInterval(timer);
  }, [cleanRoomCode, myUid]);

  async function copyLobbyCode() {
    setCopied(false);

    try {
      await navigator.clipboard.writeText(cleanRoomCode);
      setCopied(true);

      window.setTimeout(() => {
        setCopied(false);
      }, 1600);
    } catch {
      setErrorText("Code konnte nicht automatisch kopiert werden.");
    }
  }

  async function toggleReady() {
    if (!currentPlayer) return;

    setErrorText("");

    try {
      await setOnlineGuessReady(cleanRoomCode, !currentPlayer.ready);
    } catch (error) {
      console.error(error);
      setErrorText(error?.message || "Bereit-Status konnte nicht geändert werden.");
    }
  }

    async function kickPlayer(playerUid) {
    try {
      await kickOnlineGuessPlayer(cleanRoomCode, playerUid);
    } catch (error) {
      console.error(error);
      setErrorText(error?.message || "Spieler konnte nicht gekickt werden.");
    }
  }

  async function makeHost(playerUid) {
    try {
      await transferOnlineGuessHost(cleanRoomCode, playerUid);
    } catch (error) {
      console.error(error);
      setErrorText(error?.message || "Host konnte nicht übertragen werden.");
    }
  }

  async function closeLobby() {
    if (!window.confirm("Lobby wirklich schließen?")) {
      return;
    }

    try {
      await closeOnlineGuessRoom(cleanRoomCode);
      navigate("/games/pokemon-guess/online");
    } catch (error) {
      console.error(error);
      setErrorText(error?.message || "Lobby konnte nicht geschlossen werden.");
    }
  }

  async function leaveLobbyAction() {
    setErrorText("");

    try {
      await leaveOnlineGuessRoom(cleanRoomCode);
    } catch {
      // lokal trotzdem raus
    }

    navigate("/games/pokemon-guess/online");
  }

  async function updateSetting(patch) {
    if (!isHost) return;

    setErrorText("");

    try {
      await updateOnlineGuessSettings(cleanRoomCode, patch);
    } catch (error) {
      console.error(error);
      setErrorText(error?.message || "Einstellung konnte nicht gespeichert werden.");
    }
  }

  async function updateNestedSetting(group, patch) {
    if (!isHost) return;

    const currentGroup = settings[group] || {};

    await updateSetting({
      [group]: {
        ...currentGroup,
        ...patch,
      },
    });
  }

  async function toggleGeneration(gen) {
    if (!isHost) return;

    const currentGens = Array.isArray(settings.selectedGens)
      ? settings.selectedGens
      : DEFAULT_ONLINE_GUESS_SETTINGS.selectedGens;

    const hasGen = currentGens.includes(gen);

    let nextGens = hasGen
      ? currentGens.filter((item) => item !== gen)
      : [...currentGens, gen];

    if (nextGens.length === 0) {
      nextGens = [gen];
    }

    await updateSetting({
      selectedGens: nextGens.sort((a, b) => a - b),
    });
  }

  async function selectAllGenerations() {
    if (!isHost) return;

    await updateSetting({
      selectedGens: GENERATION_OPTIONS,
    });
  }

  async function selectOnlyGeneration(gen) {
    if (!isHost) return;

    await updateSetting({
      selectedGens: [gen],
    });
  }

  async function startGame() {
    setErrorText("");
    setLoadingText("Spiel wird gestartet...");

    try {
      await startOnlineGuessGame(cleanRoomCode);
      navigate(`/games/pokemon-guess/online/${cleanRoomCode}/game`);
    } catch (error) {
      console.error(error);
      setErrorText(error?.message || "Spiel konnte nicht gestartet werden.");
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
            onClick={() => navigate("/games/pokemon-guess/online")}
          >
            Zurück
          </button>

          <div className="guess-loading-box">{loadingText}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="games-page">
      <div className="games-panel guess-panel">
        <div className="guess-page-actions">
          <button className="games-back-button" type="button" onClick={leaveLobbyAction}>
            Lobby verlassen
          </button>

          <button
            className="games-back-button"
            type="button"
            onClick={() => navigate("/games/pokemon-guess")}
          >
            Zum Guess-Menü
          </button>
        </div>

        <div className="online-lobby-hero">
          <div>
            <p className="guess-kicker">Online-Lobby</p>
            <h1>Lobby {cleanRoomCode}</h1>
            <p className="games-subtitle">
              Teile den Code mit deinen Freunden. Der Host stellt alles ein,
              danach müssen alle bereit sein.
            </p>
          </div>

          <div className="online-code-card">
            <span>Lobbycode</span>
            <strong>{cleanRoomCode}</strong>
            <button type="button" onClick={copyLobbyCode}>
              {copied ? "Kopiert" : "Code kopieren"}
            </button>
          </div>
        </div>

        {errorText && <div className="guess-error-box">{errorText}</div>}
        {loadingText && room && <div className="guess-loading-box">{loadingText}</div>}

        <div className="online-lobby-grid">
          <section className="guess-settings-card">
            <div className="guess-section-title-row">
              <div>
                <h2>Spieler</h2>
                <p>
                  Alle Spieler müssen bereit sein, damit der Host starten kann.
                </p>
              </div>

              <button
                className={
                  currentPlayer?.ready
                    ? "online-ready-button online-ready-button-active"
                    : "online-ready-button"
                }
                type="button"
                onClick={toggleReady}
                disabled={!currentPlayer}
              >
                {currentPlayer?.ready ? "Bereit" : "Nicht bereit"}
              </button>
            </div>

            <div className="online-player-list">
                            {onlinePlayers.map((player) => {
                const canOpenPlayerMenu = isHost && player.uid !== myUid;

                return (
                  <div
                    key={player.uid || player.id}
                    className={
                      canOpenPlayerMenu
                        ? "online-player-row online-player-row-clickable"
                        : "online-player-row"
                    }
                    role={canOpenPlayerMenu ? "button" : undefined}
                    tabIndex={canOpenPlayerMenu ? 0 : undefined}
                    onClick={() => {
                      if (!canOpenPlayerMenu) return;

                      setOpenPlayerMenuUid((current) =>
                        current === player.uid ? "" : player.uid
                      );
                    }}
                    onKeyDown={(event) => {
                      if (!canOpenPlayerMenu) return;

                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();

                        setOpenPlayerMenuUid((current) =>
                          current === player.uid ? "" : player.uid
                        );
                      }
                    }}
                  >
                    <div>
                      <strong>{getPlayerName(player)}</strong>
                      <span>
                        {player.uid === room?.hostId ? "Host" : "Spieler"}
                        {player.uid === myUid ? " · Du" : ""}
                      </span>
                    </div>

                    <div className="online-player-actions">
                      <em className={player.ready ? "online-ready-pill" : "online-wait-pill"}>
                        {player.ready ? "Bereit" : "Wartet"}
                      </em>

                      {canOpenPlayerMenu && openPlayerMenuUid === player.uid && (
                        <div
                          className="online-player-popover"
                          onClick={(event) => event.stopPropagation()}
                        >
                          <button
                            type="button"
                            onClick={() => {
                              setOpenPlayerMenuUid("");
                              makeHost(player.uid);
                            }}
                          >
                            Zum Host machen
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setOpenPlayerMenuUid("");
                              kickPlayer(player.uid);
                            }}
                          >
                            Spieler kicken
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}

              {onlinePlayers.length === 0 && (
                <div className="guess-small-info">Noch keine Spieler online.</div>
              )}
            </div>
          </section>

          <section className="guess-settings-card">
            <h2>Status</h2>

            <div className="online-status-list">
              <div>
                <span>Du bist</span>
                <strong>{isHost ? "Host" : "Mitspieler"}</strong>
              </div>

              <div>
                <span>Spieler online</span>
                <strong>{onlinePlayers.length}</strong>
              </div>

              <div>
                <span>Bereit</span>
                <strong>
                  {onlinePlayers.filter((player) => player.ready).length}/
                  {onlinePlayers.length}
                </strong>
              </div>
            </div>

            {isHost && (
              <div className="guess-action-row">
                <button
                  className="guess-secondary-button"
                  type="button"
                  onClick={closeLobby}
                >
                  Lobby schließen
                </button>
              </div>
            )}

            {isHost ? (
              <button
                className="guess-start-button"
                type="button"
                onClick={startGame}
                disabled={!allReady || Boolean(loadingText)}
              >
                Spiel starten
              </button>
            ) : (
              <div className="guess-points-note">
                Nur der Host kann das Spiel starten. Mach dich bereit und warte
                auf den Start.
              </div>
            )}

            {isHost && !allReady && (
              <div className="guess-small-info">
                Start ist erst möglich, wenn alle Spieler bereit sind.
              </div>
            )}
          </section>

          <section className="guess-settings-card guess-wide-card">
            <div className="guess-section-title-row">
              <div>
                <h2>Host-Einstellungen</h2>
                <p>
                  Nur der Host kann diese Einstellungen ändern. Alle anderen
                  sehen sie live mit.
                </p>
              </div>

              {!isHost && <strong className="online-readonly-badge">Nur Anzeige</strong>}
            </div>

            <div className="online-settings-shell">
              <div className="online-settings-left">
                <div className="online-settings-grid">
                  <label className="online-form-label">
                    <span>Spielart</span>
                    <FancySelect
                      value={settings.gameMode}
                      disabled={!isHost}
                      onChange={(event) =>
                        updateSetting({ gameMode: event.target.value })
                      }
                      options={[
                        {
                          value: ONLINE_GUESS_GAME_MODES.TIMER,
                          label: "Timer: alle antworten",
                        },
                        {
                          value: ONLINE_GUESS_GAME_MODES.BUZZER,
                          label: "Buzzer: erster Spieler antwortet",
                        },
                      ]}
                    />
                  </label>

                  <label className="online-form-label">
                    <span>Guess-Modus</span>
                    <FancySelect
                      value={settings.playMode}
                      disabled={!isHost}
                      onChange={(event) =>
                        updateSetting({ playMode: event.target.value })
                      }
                      options={Object.entries(GUESS_PLAY_MODE_LABELS).map(
                        ([value, label]) => ({
                          value,
                          label,
                        })
                      )}
                    />
                  </label>

                  <label className="online-form-label">
                    <span>Runden</span>
                    <NumberInput
                      value={settings.totalRounds}
                      min={1}
                      max={99}
                      disabled={!isHost}
                      onCommit={(value) =>
                        updateSetting({
                          totalRounds: value,
                        })
                      }
                    />
                  </label>

                  <label className="online-form-label">
                    <span>Runden-Timer</span>
                    <NumberInput
                      value={settings.answerTimeSeconds}
                      min={3}
                      max={300}
                      disabled={!isHost}
                      onCommit={(value) =>
                        updateSetting({
                          answerTimeSeconds: value,
                        })
                      }
                    />
                  </label>

                  <label className="online-form-label">
                    <span>Buzzer-Antwortzeit</span>
                    <NumberInput
                      value={settings.buzzerAnswerSeconds}
                      min={3}
                      max={60}
                      disabled={
                        !isHost ||
                        settings.gameMode !== ONLINE_GUESS_GAME_MODES.BUZZER
                      }
                      onCommit={(value) =>
                        updateSetting({
                          buzzerAnswerSeconds: value,
                        })
                      }
                    />
                  </label>

                  <label className="online-form-label">
                    <span>Punkte für richtig</span>
                    <NumberInput
                      value={settings.pointsCorrect}
                      min={1}
                      max={9999}
                      disabled={!isHost}
                      onCommit={(value) =>
                        updateSetting({
                          pointsCorrect: value,
                        })
                      }
                    />
                  </label>

                  <label className="online-toggle-card">
                    <span>Falsche Antwort bestrafen</span>
                    <input
                      type="checkbox"
                      checked={Boolean(settings.penaltyWrong)}
                      disabled={!isHost}
                      onChange={(event) =>
                        updateSetting({ penaltyWrong: event.target.checked })
                      }
                    />
                  </label>

                  <label className="online-toggle-card">
                    <span>Doppelte Pokémon erlauben</span>
                    <input
                      type="checkbox"
                      checked={Boolean(settings.allowDuplicatePokemon)}
                      disabled={!isHost}
                      onChange={(event) =>
                        updateSetting({ allowDuplicatePokemon: event.target.checked })
                      }
                    />
                  </label>

                  {settings.playMode === GUESS_PLAY_MODES.PIXEL && (
                    <>
                      <label className="online-form-label">
                        <span>Verpixelung</span>
                        <FancySelect
                          value={settings.pixel?.strength || 6}
                          disabled={!isHost}
                          onChange={(event) =>
                            updateNestedSetting("pixel", {
                              strength: Number(event.target.value),
                            })
                          }
                          options={LEVEL_OPTIONS.map((value) => ({
                            value,
                            label: `Stufe ${value}`,
                          }))}
                        />
                      </label>

                      <label className="online-toggle-card">
                        <span>Silhouette + Verpixelung</span>
                        <input
                          type="checkbox"
                          checked={Boolean(settings.pixel?.black)}
                          disabled={!isHost}
                          onChange={(event) =>
                            updateNestedSetting("pixel", {
                              black: event.target.checked,
                            })
                          }
                        />
                      </label>
                    </>
                  )}

                  {settings.playMode === GUESS_PLAY_MODES.DISTORTED && (
                    <>
                      <label className="online-form-label">
                        <span>Horizontal verzerren</span>
                        <FancySelect
                          value={settings.distorted?.horizontal || 6}
                          disabled={!isHost}
                          onChange={(event) =>
                            updateNestedSetting("distorted", {
                              horizontal: Number(event.target.value),
                            })
                          }
                          options={LEVEL_OPTIONS.map((value) => ({
                            value,
                            label: `Stufe ${value}`,
                          }))}
                        />
                      </label>

                      <label className="online-form-label">
                        <span>Vertikal verzerren</span>
                        <FancySelect
                          value={settings.distorted?.vertical || 6}
                          disabled={!isHost}
                          onChange={(event) =>
                            updateNestedSetting("distorted", {
                              vertical: Number(event.target.value),
                            })
                          }
                          options={LEVEL_OPTIONS.map((value) => ({
                            value,
                            label: `Stufe ${value}`,
                          }))}
                        />
                      </label>

                      <label className="online-toggle-card">
                        <span>Silhouette + Verzerrung</span>
                        <input
                          type="checkbox"
                          checked={Boolean(settings.distorted?.black)}
                          disabled={!isHost}
                          onChange={(event) =>
                            updateNestedSetting("distorted", {
                              black: event.target.checked,
                            })
                          }
                        />
                      </label>
                    </>
                  )}
                </div>

                <div className="online-gen-settings">
                  <div className="guess-section-title-row">
                    <div>
                      <h3>Generationen</h3>
                      <p>Diese Generationen werden für die Pokémon-Auswahl genutzt.</p>
                    </div>

                    <button
                      className="guess-secondary-button"
                      type="button"
                      onClick={selectAllGenerations}
                      disabled={!isHost}
                    >
                      Alle auswählen
                    </button>
                  </div>

                  <div className="guess-gen-grid online-gen-grid-clean">
  {GENERATION_OPTIONS.map((gen) => {
    const active = settings.selectedGens?.includes(gen);

    function handleCardClick() {
      if (!isHost) return;
      toggleGeneration(gen);
    }

    function handleCardKeyDown(event) {
      if (!isHost) return;

      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        toggleGeneration(gen);
      }
    }

    return (
      <div
        key={gen}
        className={
          active
            ? "guess-gen-card guess-gen-card-active"
            : "guess-gen-card"
        }
        role="button"
        tabIndex={isHost ? 0 : -1}
        onClick={handleCardClick}
        onKeyDown={handleCardKeyDown}
      >
        <div className="online-gen-card-top">
          <span className="online-gen-mini-switch" aria-hidden="true">
            <input
              type="checkbox"
              checked={Boolean(active)}
              readOnly
              tabIndex={-1}
              disabled={!isHost}
            />
          </span>

          <span className="online-gen-title">Gen {gen}</span>
        </div>

        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            selectOnlyGeneration(gen);
          }}
          disabled={!isHost}
        >
          Nur
        </button>
      </div>
    );
  })}
</div>
                </div>
              </div>

              <div className="online-settings-preview">
                <GuessPreviewCard settings={settings} />
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function GuessPreviewCard({ settings }) {
  const previewClues = useMemo(() => {
    switch (settings.playMode) {
      case GUESS_PLAY_MODES.PIXEL:
        return [
          {
            type: GUESS_CLUE_TYPES.PIXEL_CUSTOM,
            strength: settings.pixel?.strength || 6,
            black: Boolean(settings.pixel?.black),
          },
        ];

      case GUESS_PLAY_MODES.DISTORTED:
        return [
          {
            type: GUESS_CLUE_TYPES.DISTORTED_CUSTOM,
            horizontal: settings.distorted?.horizontal || 6,
            vertical: settings.distorted?.vertical || 6,
            black: Boolean(settings.distorted?.black),
          },
        ];

      case GUESS_PLAY_MODES.SILHOUETTE:
        return [{ type: GUESS_CLUE_TYPES.SILHOUETTE }];

      case GUESS_PLAY_MODES.STATS:
        return [{ type: GUESS_CLUE_TYPES.STATS }];

      case GUESS_PLAY_MODES.TIPS:
      default:
        return [
          { type: GUESS_CLUE_TYPES.TYPES },
          { type: GUESS_CLUE_TYPES.GEN },
          { type: GUESS_CLUE_TYPES.ABILITY },
        ];
    }
  }, [settings]);

  return (
    <div className="guess-preview-card online-guess-preview-card">
      <div className="online-preview-head">
        <span>Vorschau</span>
        <strong>{PIKACHU_PREVIEW.name}</strong>
      </div>

      <p>
        So sieht dein aktueller Guess-Modus ungefähr aus. Damit kannst du die
        Einstellungen direkt besser einschätzen.
      </p>

      <div className="guess-clue-stack">
        {previewClues.map((clue, index) => (
          <PreviewClue
            key={`${clue.type}-${index}-${clue.strength || ""}-${clue.horizontal || ""}-${clue.vertical || ""}-${clue.black || ""}`}
            clue={clue}
          />
        ))}
      </div>
    </div>
  );
}

function PreviewClue({ clue }) {
  const target = PIKACHU_PREVIEW;

  if (clue.type === GUESS_CLUE_TYPES.TYPES) {
    return (
      <div className="guess-text-clue">
        <span className="guess-clue-title">Typen</span>
        <div className="guess-type-list">
          {target.types.map((type) => (
            <strong key={type}>{type}</strong>
          ))}
        </div>
      </div>
    );
  }

  if (clue.type === GUESS_CLUE_TYPES.GEN) {
    return (
      <div className="guess-text-clue">
        <span className="guess-clue-title">Generation</span>
        <strong>Generation {target.gen}</strong>
      </div>
    );
  }

  if (clue.type === GUESS_CLUE_TYPES.ABILITY) {
    return (
      <div className="guess-text-clue">
        <span className="guess-clue-title">Fähigkeit</span>
        <strong>{target.ability}</strong>
      </div>
    );
  }

  if (clue.type === GUESS_CLUE_TYPES.STATS) {
    return <PreviewStats stats={target.stats} />;
  }

  if (clue.type === GUESS_CLUE_TYPES.SILHOUETTE) {
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

  if (clue.type === GUESS_CLUE_TYPES.PIXEL_CUSTOM) {
    return (
      <div className="guess-image-wrap">
        <span className="guess-clue-title">
          Verpixelt Stufe {clue.strength}/6
        </span>
        <PreviewPixelatedImage
          src={target.imageUrl}
          alt="Verpixeltes Pikachu"
          strength={clue.strength}
          black={clue.black}
        />
      </div>
    );
  }

  if (clue.type === GUESS_CLUE_TYPES.DISTORTED_CUSTOM) {
    return (
      <div className="guess-image-wrap">
        <span className="guess-clue-title">
          Verzerrt H{clue.horizontal}/6 V{clue.vertical}/6
        </span>
        <PreviewDistortedImage
          src={target.imageUrl}
          alt="Verzerrtes Pikachu"
          horizontal={clue.horizontal}
          vertical={clue.vertical}
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
        alt={target.name}
        draggable="false"
      />
    </div>
  );
}

function PreviewPixelatedImage({ src, alt, strength = 6, black = false }) {
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

function PreviewDistortedImage({
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

function PreviewStats({ stats }) {
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