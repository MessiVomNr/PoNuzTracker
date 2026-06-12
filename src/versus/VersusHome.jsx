// src/versus/VersusHome.jsx
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { createRoom, joinRoom, getStoredPlayerId } from "./versusService";
import RecentVersusRoomsPanel from "./recentVersusRoomsPanel";
import { upsertRecentVersusRoom } from "./recentVersusRooms";
import { db } from "../firebase";
import { doc, deleteDoc, getDoc } from "firebase/firestore";

export default function VersusHome() {
  const nav = useNavigate();

  const [name, setName] = useState(() => localStorage.getItem("versusPlayerName") || "Spieler");
  const [roomId, setRoomId] = useState("");
  const [err, setErr] = useState("");
  const [hostMap, setHostMap] = useState({});

  useEffect(() => {
    document.body.classList.add("versus-page");

    return () => {
      document.body.classList.remove("versus-page");
    };
  }, []);

  function normName(v) {
    return String(v || "").trim() || "Spieler";
  }

  function normRoomId(v) {
    return String(v || "").trim().toUpperCase();
  }

  function getSessionPlayerIdForRoom(rid) {
    const key = `versus_player_${rid}`;
    return sessionStorage.getItem(key) || "";
  }

  async function saveRecentRoom(rid) {
    try {
      const snap = await getDoc(doc(db, "versusRooms", rid));
      const data = snap.exists() ? snap.data() : null;
      const title = String(data?.title || data?.roomTitle || "").trim();

      upsertRecentVersusRoom({
        roomId: rid,
        title,
        lastSeenAt: Date.now(),
      });
    } catch {
      upsertRecentVersusRoom({
        roomId: rid,
        title: "",
        lastSeenAt: Date.now(),
      });
    }
  }

  async function onCreate() {
    setErr("");

    try {
      const displayName = normName(name);
      const res = await createRoom(displayName);

      const rid = normRoomId(res.roomId);
      const pid = String(res.playerId || "");

      sessionStorage.setItem(`versus_player_${rid}`, pid);

      await saveRecentRoom(rid);

      nav(`/versus/${rid}`);
    } catch (e) {
      setErr(e?.message || String(e));
    }
  }

  async function onJoin() {
    setErr("");

    try {
      const displayName = normName(name);
      const rid = normRoomId(roomId);

      if (!rid) {
        setErr("Bitte eine Room-ID eingeben.");
        return;
      }

      const res = await joinRoom(rid, displayName);

      const finalRid = normRoomId(res.roomId);
      const pid = String(res.playerId || "");

      sessionStorage.setItem(`versus_player_${finalRid}`, pid);

      await saveRecentRoom(finalRid);

      nav(`/versus/${finalRid}`);
    } catch (e) {
      setErr(e?.message || String(e));
    }
  }

  async function reconnectToRoom(roomIdFromList) {
    setErr("");

    const rid = normRoomId(roomIdFromList);
    if (!rid) return;

    const oldPid = getStoredPlayerId(rid);
    if (oldPid) {
      sessionStorage.setItem(`versus_player_${rid}`, oldPid);
    }

    try {
      const snap = await getDoc(doc(db, "versusRooms", rid));

      if (!snap.exists()) {
        setErr("Lobby nicht gefunden oder bereits gelöscht.");
        return;
      }

      await saveRecentRoom(rid);

      nav(`/versus/${rid}`);
    } catch (e) {
      setErr(e?.message || "Reconnect fehlgeschlagen.");
    }
  }

  async function isHostOfRoom(roomIdFromList) {
    const rid = normRoomId(roomIdFromList);
    if (!rid) return false;

    const myPid = getSessionPlayerIdForRoom(rid);
    if (!myPid) return false;

    try {
      const snap = await getDoc(doc(db, "versusRooms", rid));
      if (!snap.exists()) return false;

      const data = snap.data() || {};
      return String(data?.hostPlayerId || "") === String(myPid);
    } catch {
      return false;
    }
  }

  async function deleteLobby(roomIdFromList) {
    setErr("");

    const rid = normRoomId(roomIdFromList);
    if (!rid) return;

    const okHost = await isHostOfRoom(rid);

    if (!okHost) {
      setErr("Du kannst diese Lobby nicht löschen, weil du nicht als Host gespeichert bist.");
      return;
    }

    const ok = window.confirm(`Lobby ${rid} wirklich aus der Datenbank löschen?`);
    if (!ok) return;

    try {
      await deleteDoc(doc(db, "versusRooms", rid));
      setErr("Raum wurde gelöscht.");
    } catch (e) {
      setErr(e?.message || "Raum konnte nicht gelöscht werden.");
    }
  }

  async function ensureHostFlag(rid) {
    const id = normRoomId(rid);
    if (!id) return false;

    if (Object.prototype.hasOwnProperty.call(hostMap, id)) {
      return hostMap[id];
    }

    const ok = await isHostOfRoom(id);
    setHostMap((prev) => ({ ...prev, [id]: ok }));

    return ok;
  }

  return (
    <div className="pnt-page pnt-center-page versus-home-page">
      <div className="pnt-panel pnt-panel-with-top-button versus-home-panel">
        <button
          type="button"
          className="pnt-back-button"
          onClick={() => nav("/")}
        >
          ← Zur Startseite
        </button>

        <header className="versus-home-header">
          <span className="pnt-kicker">Draft & Versus</span>
          <h1 className="pnt-title">Versus</h1>
          <p className="pnt-subtitle">
            Erstelle eine neue Lobby oder tritt einem bestehenden Draft-Room bei.
          </p>
        </header>

        <div className="versus-home-layout">
          <section className="pnt-card pnt-card-primary versus-home-main-card">
            <div className="versus-home-section-head">
              <span>01</span>
              <div>
                <h2 className="pnt-section-title">Neue Lobby</h2>
                <p className="pnt-section-text">
                  Starte einen neuen Versus-Draft und teile den Raumcode mit deinen Mitspielern.
                </p>
              </div>
            </div>

            <label className="pnt-label">
              <span>Dein Name</span>
              <input
                className="pnt-input"
                value={name}
                onChange={(e) => {
                  const v = e.target.value;
                  setName(v);
                  localStorage.setItem("versusPlayerName", v);
                }}
              />
            </label>

            <button
              type="button"
              className="pnt-button pnt-button-primary versus-home-wide-button"
              onClick={onCreate}
            >
              Room erstellen
            </button>
          </section>

          <section className="pnt-card versus-home-main-card">
            <div className="versus-home-section-head">
              <span>02</span>
              <div>
                <h2 className="pnt-section-title">Room beitreten</h2>
                <p className="pnt-section-text">
                  Gib den Code einer vorhandenen Lobby ein und steige direkt wieder ein.
                </p>
              </div>
            </div>

            <label className="pnt-label">
              <span>Room-ID</span>
              <input
                className="pnt-input versus-home-room-input"
                value={roomId}
                onChange={(e) => setRoomId(e.target.value)}
                placeholder="z.B. ABCD12"
              />
            </label>

            <button
              type="button"
              className="pnt-button versus-home-wide-button"
              onClick={onJoin}
            >
              Beitreten
            </button>
          </section>

          <section className="pnt-card versus-home-recent-card">
            <div className="versus-home-section-head">
              <span>03</span>
              <div>
                <h2 className="pnt-section-title">Letzte Lobbys</h2>
                <p className="pnt-section-text">
                  Springe schnell zurück in deine zuletzt geöffneten Versus-Räume.
                </p>
              </div>
            </div>

            <RecentVersusRoomsPanel
              onReconnect={(rid) => reconnectToRoom(rid)}
              onDeleteRoom={(rid) => deleteLobby(rid)}
              canDeleteRoom={(rid) => {
                const id = normRoomId(rid);
                if (!id) return false;

                if (!Object.prototype.hasOwnProperty.call(hostMap, id)) {
                  ensureHostFlag(id);
                  return false;
                }

                return !!hostMap[id];
              }}
            />
          </section>
        </div>

        {err && (
          <div className="pnt-alert pnt-alert-error versus-home-alert">
            {err}
          </div>
        )}
      </div>
    </div>
  );
}