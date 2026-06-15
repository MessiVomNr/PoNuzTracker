import React, { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  getRoom,
  subscribeRoom,
  setReady,
  setRoomStatus,
  transferHost,
  heartbeat,
} from "./versusService";

export default function VersusLobby() {
  const { roomId } = useParams();
  const nav = useNavigate();

  const roomKey = String(roomId || "").toUpperCase();

  const myPlayerId = useMemo(() => {
    const k = `versus_player_${roomKey}`;
    return (
      sessionStorage.getItem(k) ||
      localStorage.getItem(k) ||
      localStorage.getItem("versus_device_id") ||
      ""
    );
  }, [roomKey]);

  const [room, setRoom] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  useEffect(() => {
    document.body.classList.add("versus-page");

    return () => {
      document.body.classList.remove("versus-page");
    };
  }, []);

  useEffect(() => {
    let unsub = null;
    let alive = true;

    (async () => {
      try {
        setErr("");
        setLoading(true);

        const r = await getRoom(roomKey);

        if (!alive) return;

        setRoom(r || null);
        setLoading(false);

        unsub = subscribeRoom(roomKey, (next) => {
          setRoom(next || null);
          setLoading(false);
        });
      } catch (e) {
        if (!alive) return;

        setErr(e?.message || String(e));
        setLoading(false);
      }
    })();

    return () => {
      alive = false;
      if (unsub) unsub();
    };
  }, [roomKey]);

  useEffect(() => {
    if (!room) return;

    if (room.status === "auction") {
      nav(`/versus/${roomKey}/auction`, { replace: true });
    }
  }, [room, nav, roomKey]);

  useEffect(() => {
    if (!roomKey || !myPlayerId) return;

    heartbeat(roomKey, myPlayerId);

    const t = setInterval(() => {
      heartbeat(roomKey, myPlayerId);
    }, 12000);

    return () => clearInterval(t);
  }, [roomKey, myPlayerId]);

  const players = room?.players || [];
  const me = players.find((p) => p.id === myPlayerId);
  const isHost = room?.hostPlayerId && myPlayerId && room.hostPlayerId === myPlayerId;

  const allReady = players.length >= 2 && players.every((p) => !!p.ready);
  const canStart =
    isHost &&
    ((players.length === 1 && players[0]?.ready === true) ||
      (players.length > 1 && allReady));

  async function toggleReady() {
    try {
      setErr("");

      if (!myPlayerId) {
        setErr("Dein Spieler-Token fehlt. Bitte tritt der Lobby erneut bei.");
        return;
      }

      await setReady(roomKey, myPlayerId, !me?.ready);
    } catch (e) {
      setErr(e?.message || String(e));
    }
  }

  async function makeAdmin(targetPlayerId, targetName) {
    try {
      setErr("");

      if (!isHost) return;
      if (!targetPlayerId || targetPlayerId === myPlayerId) return;

      const ok = window.confirm(`Admin-Rechte an ${targetName || "Spieler"} übertragen?`);
      if (!ok) return;

      await transferHost(roomKey, myPlayerId, targetPlayerId);
    } catch (e) {
      setErr(e?.message || String(e));
    }
  }

  async function startGame() {
    try {
      setErr("");

      if (!myPlayerId) {
        setErr("Dein Spieler-Token fehlt. Bitte tritt der Lobby erneut bei.");
        return;
      }

      await setRoomStatus(roomKey, myPlayerId, "auction");
      nav(`/versus/${roomKey}/auction`, { replace: true });
    } catch (e) {
      setErr(e?.message || String(e));
    }
  }

  function getLobbyStatusText() {
    if (!room) return "";

    if (players.length === 1) {
      return players[0]?.ready
        ? "Solo-Start ist bereit."
        : "Drücke Bereit, um auch solo starten zu können.";
    }

    if (allReady) {
      return "Alle Spieler sind bereit.";
    }

    return "Warte, bis alle Spieler bereit sind.";
  }

  return (
    <div
      className="pnt-page pnt-center-page versus-lobby-page"
      style={{
        backgroundImage:
          "linear-gradient(180deg, rgba(5, 8, 18, 0.62), rgba(5, 8, 18, 0.82)), url('/backgrounds/draft_background.png')",
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
        backgroundAttachment: "fixed",
      }}
    >
      <style>{`
        .versus-lobby-page .pnt-button,
        .versus-lobby-page .pnt-back-button {
          border-radius: 8px !important;
          font-weight: 950;
        }

        .versus-lobby-page .pnt-back-button {
          padding: 10px 18px !important;
          min-height: 0 !important;
          background: rgba(8, 14, 28, 0.58) !important;
          border: 1px solid rgba(140, 165, 210, 0.42) !important;
          box-shadow: 0 10px 24px rgba(0, 0, 0, 0.20) !important;
        }

        .versus-lobby-page .pnt-button {
          min-height: 42px;
          padding: 10px 18px;
          background:
            linear-gradient(135deg, rgba(70, 105, 165, 0.18), rgba(28, 42, 74, 0.16)),
            rgba(7, 12, 26, 0.54);
          border: 1px solid rgba(120, 155, 220, 0.42);
          box-shadow:
            0 10px 22px rgba(0, 0, 0, 0.18),
            inset 0 1px 0 rgba(255, 255, 255, 0.08);
        }

        .versus-lobby-page .pnt-button:hover,
        .versus-lobby-page .pnt-button:focus-visible,
        .versus-lobby-page .pnt-back-button:hover,
        .versus-lobby-page .pnt-back-button:focus-visible {
          transform: translateY(-2px);
          border-color: rgba(165, 195, 255, 0.62) !important;
          box-shadow:
            0 14px 28px rgba(0, 0, 0, 0.24),
            0 0 18px rgba(120, 165, 255, 0.12),
            inset 0 1px 0 rgba(255, 255, 255, 0.12);
          outline: none;
        }

        .versus-lobby-page .versus-lobby-action-button {
          min-height: 50px;
          border-radius: 8px !important;
        }

        .versus-lobby-page .pnt-button:disabled {
          opacity: 0.48;
          cursor: not-allowed;
          transform: none !important;
          box-shadow:
            0 8px 18px rgba(0, 0, 0, 0.14),
            inset 0 1px 0 rgba(255, 255, 255, 0.05);
        }

        .versus-lobby-page .pnt-button-danger {
          border-color: rgba(255, 110, 130, 0.46) !important;
          background:
            linear-gradient(135deg, rgba(150, 42, 62, 0.28), rgba(70, 18, 32, 0.22)),
            rgba(28, 7, 14, 0.54) !important;
        }
      `}</style>

      <div className="pnt-panel pnt-panel-with-top-button versus-lobby-panel">
        <button
          type="button"
          className="pnt-back-button"
          onClick={() => nav("/")}
        >
          Zur Startseite
        </button>

        <header className="versus-lobby-header">
          <span className="pnt-kicker">Draft Lobby</span>
          <h1 className="pnt-title">Versus Lobby</h1>
          <p className="pnt-subtitle">
            Warte auf deine Mitspieler, übertrage bei Bedarf den Host und starte dann den Draft.
          </p>
        </header>

        <section className="versus-lobby-code-card">
          <div>
            <span>Room-ID</span>
            <strong>{roomKey}</strong>
          </div>

          <button
            type="button"
            className="pnt-button pnt-button-ghost"
            onClick={() => navigator.clipboard?.writeText(roomKey)}
          >
            Code kopieren
          </button>
        </section>

        {loading && (
          <div className="pnt-alert pnt-alert-info versus-lobby-alert">
            Room wird geladen ...
          </div>
        )}

        {err && (
          <div className="pnt-alert pnt-alert-error versus-lobby-alert">
            {err}
          </div>
        )}

        {!loading && !err && !room && (
          <div className="pnt-alert pnt-alert-error versus-lobby-alert">
            Room nicht gefunden.
          </div>
        )}

        {room && (
          <div className="versus-lobby-layout">
            <section className="pnt-card pnt-card-primary versus-lobby-player-card">
              <div className="versus-lobby-section-head">
                <span>01</span>
                <div>
                  <h2 className="pnt-section-title">Spieler</h2>
                  <p className="pnt-section-text">
                    {getLobbyStatusText()}
                  </p>
                </div>
              </div>

              <div className="versus-lobby-player-list">
                {players.map((p) => {
                  const isMe = p.id === myPlayerId;
                  const isPlayerHost = room.hostPlayerId === p.id;

                  return (
                    <div
                      key={p.id}
                      className={[
                        "versus-lobby-player-row",
                        isMe ? "versus-lobby-player-row-self" : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                    >
                      <div className="versus-lobby-player-info">
                        <strong>
                          {p.displayName}
                          {isMe ? " (du)" : ""}
                        </strong>

                        <div className="versus-lobby-player-badges">
                          {p.ready ? (
                            <span className="pnt-pill">Bereit</span>
                          ) : (
                            <span className="pnt-pill pnt-pill-muted">Wartet</span>
                          )}

                          {isPlayerHost && (
                            <span className="pnt-pill pnt-pill-blue">Host</span>
                          )}
                        </div>
                      </div>

                      {isHost && !isMe && (
                        <button
                          type="button"
                          className="pnt-button pnt-button-ghost versus-lobby-admin-button"
                          onClick={() => makeAdmin(p.id, p.displayName)}
                          title="Überträgt die Admin/Host-Rechte an diesen Spieler"
                        >
                          Zum Admin machen
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>

            <aside className="pnt-card versus-lobby-action-card">
              <div className="versus-lobby-section-head">
                <span>02</span>
                <div>
                  <h2 className="pnt-section-title">Aktionen</h2>
                  <p className="pnt-section-text">
                    Markiere dich als bereit. Der Host kann starten, sobald die Lobby bereit ist.
                  </p>
                </div>
              </div>

              <button
                type="button"
                className={[
                  "pnt-button",
                  me?.ready ? "pnt-button-danger" : "pnt-button-primary",
                  "versus-lobby-action-button",
                ].join(" ")}
                onClick={toggleReady}
              >
                {me?.ready ? "Nicht bereit" : "Bereit"}
              </button>

              <button
                type="button"
                className="pnt-button pnt-button-primary versus-lobby-action-button"
                onClick={startGame}
                disabled={!canStart}
                title={
                  !isHost
                    ? "Nur der Host kann starten."
                    : players.length === 1 && !players[0]?.ready
                    ? "Drücke zuerst Bereit."
                    : players.length > 1 && !allReady
                    ? "Alle müssen bereit sein."
                    : ""
                }
              >
                Draft starten
              </button>

              <button
                type="button"
                className="pnt-button pnt-button-ghost versus-lobby-action-button"
                onClick={() => nav("/versus")}
              >
                Zurück
              </button>

              {!isHost && (
                <div className="pnt-alert pnt-alert-info versus-lobby-host-note">
                  Nur der Host kann den Draft starten.
                </div>
              )}
            </aside>
          </div>
        )}
      </div>
    </div>
  );
}