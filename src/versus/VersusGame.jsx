// src/versus/VersusGame.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  arrayUnion,
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { db, auth } from "../firebase";

/* =========================================================
   CONFIG
========================================================= */

const ROOMS_COL = "duoRooms";

/* =========================================================
   HELPERS
========================================================= */

export function normalizeRoomId(v) {
  return String(v || "").trim().replace(/\s+/g, "");
}

async function resolveRoomDocId(roomIdOrCode) {
  const key = normalizeRoomId(roomIdOrCode);
  if (!key) return null;

  const directRef = doc(db, ROOMS_COL, key);
  const directSnap = await getDoc(directRef);

  if (directSnap.exists()) {
    return {
      docId: key,
      data: directSnap.data(),
    };
  }

  const q = query(collection(db, ROOMS_COL), where("code", "==", key));
  const qsnap = await getDocs(q);

  if (!qsnap.empty) {
    const found = qsnap.docs[0];

    return {
      docId: found.id,
      data: found.data(),
    };
  }

  return null;
}

/* =========================================================
   ROOM API
========================================================= */

export async function createRoom({ title = "Versus Run", edition = null, code = null } = {}) {
  const uid = auth?.currentUser?.uid;
  if (!uid) throw new Error("Not authenticated");

  const cleanCode = code ? normalizeRoomId(code) : null;
  const roomRef = cleanCode ? doc(db, ROOMS_COL, cleanCode) : doc(collection(db, ROOMS_COL));

  const roomDoc = {
    title,
    edition,
    code: cleanCode || roomRef.id,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    status: "lobby",
    players: {
      [uid]: {
        uid,
        name: "Player",
        ready: false,
        joinedAt: serverTimestamp(),
        lastSeenAt: serverTimestamp(),
      },
    },
    versus: {
      phase: "setup",
      startedAt: null,
      turn: 0,
      log: [],
    },
  };

  await setDoc(roomRef, roomDoc, { merge: false });
  return roomRef.id;
}

export async function getRoom(roomIdOrCode) {
  const resolved = await resolveRoomDocId(roomIdOrCode);
  if (!resolved) return null;

  return {
    id: resolved.docId,
    ...resolved.data,
  };
}

export async function joinRoom(roomIdOrCode, { name = "Player" } = {}) {
  const uid = auth?.currentUser?.uid;
  if (!uid) throw new Error("Not authenticated");

  const resolved = await resolveRoomDocId(roomIdOrCode);
  if (!resolved) return null;

  const roomRef = doc(db, ROOMS_COL, resolved.docId);

  await updateDoc(roomRef, {
    updatedAt: serverTimestamp(),
    [`players.${uid}`]: {
      uid,
      name,
      ready: false,
      joinedAt: serverTimestamp(),
      lastSeenAt: serverTimestamp(),
    },
  });

  return resolved.docId;
}

export function subscribeRoom(roomIdOrCode, cb) {
  let unsub = () => {};

  (async () => {
    const resolved = await resolveRoomDocId(roomIdOrCode);

    if (!resolved) {
      cb(null);
      return;
    }

    const roomRef = doc(db, ROOMS_COL, resolved.docId);

    unsub = onSnapshot(
      roomRef,
      (snap) => {
        if (!snap.exists()) {
          cb(null);
          return;
        }

        cb({
          id: snap.id,
          ...snap.data(),
        });
      },
      () => cb(null)
    );
  })();

  return () => unsub();
}

export async function setReady(roomIdOrCode, ready) {
  const uid = auth?.currentUser?.uid;
  if (!uid) throw new Error("Not authenticated");

  const resolved = await resolveRoomDocId(roomIdOrCode);
  if (!resolved) return false;

  const roomRef = doc(db, ROOMS_COL, resolved.docId);

  await updateDoc(roomRef, {
    updatedAt: serverTimestamp(),
    [`players.${uid}.ready`]: !!ready,
    [`players.${uid}.lastSeenAt`]: serverTimestamp(),
  });

  return true;
}

export async function setRoomStatus(roomIdOrCode, status) {
  const resolved = await resolveRoomDocId(roomIdOrCode);
  if (!resolved) return false;

  const roomRef = doc(db, ROOMS_COL, resolved.docId);

  await updateDoc(roomRef, {
    updatedAt: serverTimestamp(),
    status: String(status || "lobby"),
  });

  return true;
}

export async function startAuction(roomIdOrCode) {
  const resolved = await resolveRoomDocId(roomIdOrCode);
  if (!resolved) return false;

  const roomRef = doc(db, ROOMS_COL, resolved.docId);

  await updateDoc(roomRef, {
    updatedAt: serverTimestamp(),
    status: "auction",
    "versus.phase": "auction",
    "versus.startedAt": serverTimestamp(),
    "versus.log": arrayUnion({
      t: Date.now(),
      type: "AUCTION_STARTED",
    }),
  });

  return true;
}

/* =========================================================
   PAGE
========================================================= */

export default function VersusGame() {
  const navigate = useNavigate();
  const { roomId } = useParams();

  const roomIdOrCode = roomId || "";

  const [room, setRoom] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [starting, setStarting] = useState(false);

  const uid = auth?.currentUser?.uid || null;

  useEffect(() => {
    document.body.classList.add("versus-page");

    return () => {
      document.body.classList.remove("versus-page");
    };
  }, []);

  const players = useMemo(() => {
    if (!room?.players) return [];
    return Object.values(room.players);
  }, [room]);

  const myPlayer = useMemo(() => {
    if (!room || !uid) return null;
    return room.players?.[uid] || null;
  }, [room, uid]);

  const allReady = useMemo(() => {
    if (!players || players.length === 0) return false;

    if (players.length === 1) {
      return players[0]?.ready === true;
    }

    return players.every((p) => p?.ready === true);
  }, [players]);

  useEffect(() => {
    if (!roomIdOrCode) {
      setNotFound(true);
      setLoading(false);
      return;
    }

    setErr("");
    setLoading(true);

    const unsub = subscribeRoom(roomIdOrCode, (r) => {
      if (!r) {
        setRoom(null);
        setNotFound(true);
        setLoading(false);
        return;
      }

      setRoom(r);
      setNotFound(false);
      setLoading(false);
    });

    return () => unsub();
  }, [roomIdOrCode]);

  useEffect(() => {
    if (!room?.id) return;
    if (room.status !== "auction") return;

    (async () => {
      const resolved = await resolveRoomDocId(roomIdOrCode);
      const targetId = resolved?.docId || room.id;

      navigate(`/duo/${targetId}/versus`, { replace: true });
    })();
  }, [room?.status, room?.id, roomIdOrCode, navigate]);

  async function handleToggleReady() {
    if (!room) return;

    try {
      setErr("");
      await setReady(room.id, !myPlayer?.ready);
    } catch (e) {
      setErr(e?.message || "Fehler beim Ready-Update.");
    }
  }

  async function handleStartGame() {
    if (!room || starting) return;

    try {
      setErr("");
      setStarting(true);

      if (!allReady) {
        setErr("Noch nicht alle bereit. Alle Spieler müssen auf Ready sein.");
        setStarting(false);
        return;
      }

      const resolved = await resolveRoomDocId(roomIdOrCode);
      const targetId = resolved?.docId || room.id;

      const ok = await startAuction(targetId);

      if (!ok) {
        setErr("Konnte Auction nicht starten. Room wurde nicht gefunden.");
        setStarting(false);
        return;
      }

      navigate(`/duo/${targetId}/versus`, { replace: true });
    } catch (e) {
      setErr(e?.message || "Fehler beim Starten.");
      setStarting(false);
    }
  }

  if (loading) {
    return (
      <div className="pnt-page pnt-center-page versus-bridge-page">
        <div className="pnt-panel versus-bridge-panel">
          <span className="pnt-kicker">Versus</span>
          <h1 className="pnt-title">Room laden</h1>
          <div className="pnt-alert pnt-alert-info versus-bridge-alert">
            Room wird geladen ...
          </div>
        </div>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="pnt-page pnt-center-page versus-bridge-page">
        <div className="pnt-panel pnt-panel-with-top-button versus-bridge-panel">
          <button
            type="button"
            className="pnt-back-button"
            onClick={() => navigate("/versus")}
          >
            ← Zurück
          </button>

          <span className="pnt-kicker">Versus</span>
          <h1 className="pnt-title">Room fehlt</h1>

          <div className="pnt-alert pnt-alert-error versus-bridge-alert">
            Room nicht gefunden.
          </div>
        </div>
      </div>
    );
  }

  const phase = room?.versus?.phase || "setup";
  const status = room?.status || "lobby";

  return (
    <div className="pnt-page pnt-center-page versus-bridge-page">
      <div className="pnt-panel pnt-panel-with-top-button versus-bridge-panel">
        <button
          type="button"
          className="pnt-back-button"
          onClick={() => navigate("/versus")}
          disabled={starting}
        >
          ← Zurück
        </button>

        <header className="versus-bridge-header">
          <span className="pnt-kicker">Draft Start</span>
          <h1 className="pnt-title">Versus Lobby</h1>
          <p className="pnt-subtitle">
            Alle Spieler machen sich bereit. Danach startet die eigentliche Auction.
          </p>
        </header>

        {err && (
          <div className="pnt-alert pnt-alert-error versus-bridge-alert">
            <strong>Hinweis:</strong> {err}
          </div>
        )}

        <section className="versus-bridge-room-strip">
          <div>
            <span>Run</span>
            <strong>{room.title || "Versus Run"}</strong>
          </div>

          <div>
            <span>Status</span>
            <strong>{status}</strong>
          </div>

          <div>
            <span>Phase</span>
            <strong>{phase}</strong>
          </div>

          <div>
            <span>Room-ID</span>
            <strong>{room.id}</strong>
          </div>
        </section>

        <div className="versus-bridge-layout">
          <section className="pnt-card pnt-card-primary versus-bridge-player-card">
            <div className="versus-bridge-section-head">
              <span>01</span>
              <div>
                <h2 className="pnt-section-title">Spieler</h2>
                <p className="pnt-section-text">
                  {allReady
                    ? "Alle Spieler sind bereit."
                    : "Warte, bis alle Spieler bereit sind."}
                </p>
              </div>
            </div>

            {players.length === 0 ? (
              <div className="pnt-alert pnt-alert-info">
                Keine Spieler gefunden.
              </div>
            ) : (
              <div className="versus-bridge-player-list">
                {players.map((p) => {
                  const isMe = p.uid === uid;

                  return (
                    <div
                      key={p.uid}
                      className={[
                        "versus-bridge-player-row",
                        isMe ? "versus-bridge-player-row-self" : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                    >
                      <div>
                        <strong>
                          {p.name || "Player"}
                          {isMe ? " (du)" : ""}
                        </strong>

                        <span>
                          {p.ready ? "Bereit für den Draft" : "Noch nicht bereit"}
                        </span>
                      </div>

                      {p.ready ? (
                        <em className="pnt-pill">Ready</em>
                      ) : (
                        <em className="pnt-pill pnt-pill-muted">Wartet</em>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <aside className="pnt-card versus-bridge-action-card">
            <div className="versus-bridge-section-head">
              <span>02</span>
              <div>
                <h2 className="pnt-section-title">Start</h2>
                <p className="pnt-section-text">
                  Sobald alle ready sind, wechselst du in den Draft-Screen.
                </p>
              </div>
            </div>

            <button
              type="button"
              className={[
                "pnt-button",
                myPlayer?.ready ? "pnt-button-danger" : "pnt-button-primary",
                "versus-bridge-action-button",
              ].join(" ")}
              onClick={handleToggleReady}
              disabled={starting}
            >
              {myPlayer?.ready ? "Ready aus" : "Ready"}
            </button>

            <button
              type="button"
              className="pnt-button pnt-button-primary versus-bridge-action-button"
              onClick={handleStartGame}
              disabled={starting || !allReady || status === "auction"}
            >
              {starting ? "Starte ..." : status === "auction" ? "Wechsel ..." : "Spiel starten"}
            </button>

            <div className="pnt-alert pnt-alert-info versus-bridge-note">
              Beide klicken zuerst auf <strong>Ready</strong>. Danach wird zur Auction unter{" "}
              <code>/duo/:roomId/versus</code> gewechselt.
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}