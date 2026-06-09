// src/online/onlineGuessService.js
import {
  collection,
  doc,
  getDoc,
  getDocs,
  increment,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { db, ensureAnonAuth, assertFirebaseReady } from "../firebase";
import {
  DEFAULT_GUESS_SETTINGS,
  buildClueOrderFromSettings,
  createGuessRound,
  doesGuessMatch,
  getEffectiveRevealMode,
} from "../games/guessGameEngine";
import {
  loadPokemonGuessDetails,
  loadPokemonGuessPool,
} from "../games/pokemonGuessApi";

export const ONLINE_GUESS_COLLECTION = "onlineGuessRooms";

export const ONLINE_GUESS_GAME_MODES = {
  TIMER: "timer",
  BUZZER: "buzzer",
};

export const DEFAULT_ONLINE_GUESS_SETTINGS = {
  ...DEFAULT_GUESS_SETTINGS,

  // Online-Regeln
  gameMode: ONLINE_GUESS_GAME_MODES.TIMER,
  answerTimeSeconds: 20,

  // Nur im Buzzer-Modus:
  // Nach dem Buzz hat der Spieler so viele Sekunden zum Antworten.
  buzzerAnswerSeconds: 7,

  pointsCorrect: 100,
  penaltyWrong: true,

  // Wichtig: pro Lobby-Spiel keine doppelten Pokémon
  allowDuplicatePokemon: false,
};

function normalizeRoomCode(roomCode) {
  return String(roomCode || "").trim().toUpperCase();
}

function normalizePlayerName(name) {
  const clean = String(name || "").trim();
  if (!clean) return "Spieler";
  return clean.slice(0, 18);
}

function makeRoomCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";

  for (let i = 0; i < 6; i += 1) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }

  return code;
}

function roomRef(roomCode) {
  return doc(db, ONLINE_GUESS_COLLECTION, normalizeRoomCode(roomCode));
}

function playersRef(roomCode) {
  return collection(db, ONLINE_GUESS_COLLECTION, normalizeRoomCode(roomCode), "players");
}

function playerRef(roomCode, playerId) {
  return doc(
    db,
    ONLINE_GUESS_COLLECTION,
    normalizeRoomCode(roomCode),
    "players",
    playerId
  );
}

function answersRef(roomCode) {
  return collection(db, ONLINE_GUESS_COLLECTION, normalizeRoomCode(roomCode), "answers");
}

function answerRef(roomCode, roundNumber, playerId) {
  return doc(
    db,
    ONLINE_GUESS_COLLECTION,
    normalizeRoomCode(roomCode),
    "answers",
    `${Number(roundNumber) || 1}_${playerId}`
  );
}

function mergeOnlineGuessSettings(settings) {
  const safe = settings || {};

  return {
    ...DEFAULT_ONLINE_GUESS_SETTINGS,
    ...safe,

    selectedGens:
      Array.isArray(safe.selectedGens) && safe.selectedGens.length > 0
        ? safe.selectedGens
        : DEFAULT_ONLINE_GUESS_SETTINGS.selectedGens,

    tipOrder:
      Array.isArray(safe.tipOrder) && safe.tipOrder.length > 0
        ? safe.tipOrder
        : DEFAULT_ONLINE_GUESS_SETTINGS.tipOrder,

    pixel: {
      ...DEFAULT_ONLINE_GUESS_SETTINGS.pixel,
      ...(safe.pixel || {}),
    },

    distorted: {
      ...DEFAULT_ONLINE_GUESS_SETTINGS.distorted,
      ...(safe.distorted || {}),
    },
  };
}

function buildEffectiveGuessSettings(settings) {
  const merged = mergeOnlineGuessSettings(settings);

  return {
    ...merged,
    revealMode: getEffectiveRevealMode(merged),
    clueOrder: buildClueOrderFromSettings(merged),
  };
}

function serializeRound(round) {
  return {
    id: round.id,
    target: round.target,
    clues: round.clues,
    clueIndex: round.clueIndex,
    answered: false,
    correct: false,
    selectedName: "",
    wrongGuesses: 0,
    gainedScore: 0,
  };
}

async function buildOnlineRound(settings, blockedDexIds = []) {
  const mergedSettings = mergeOnlineGuessSettings(settings);
  const pool = await loadPokemonGuessPool(mergedSettings.selectedGens);

  const blockedSet = new Set((blockedDexIds || []).map(Number));

  const availablePool = mergedSettings.allowDuplicatePokemon
    ? pool
    : pool.filter((pokemon) => !blockedSet.has(Number(pokemon.dexId)));

  if (!availablePool.length) {
    throw new Error("Es sind keine ungenutzten Pokémon mehr übrig.");
  }

  const effectiveSettings = buildEffectiveGuessSettings(mergedSettings);
  const baseRound = createGuessRound(effectiveSettings, availablePool);
  const detailedTarget = await loadPokemonGuessDetails(baseRound.target);

  return serializeRound({
    ...baseRound,
    target: detailedTarget,
  });
}

function getPenalty(pointsCorrect) {
  return Math.ceil((Number(pointsCorrect) || 100) / 2);
}

function getAnswerPoints({ isCorrect, hasAnswer, settings }) {
  const pointsCorrect = Number(settings.pointsCorrect) || 100;

  if (isCorrect) {
    return pointsCorrect;
  }

  if (!hasAnswer) {
    return 0;
  }

  if (!settings.penaltyWrong) {
    return 0;
  }

  return -getPenalty(pointsCorrect);
}

async function getCurrentUser() {
  assertFirebaseReady();
  return ensureAnonAuth();
}

export async function getOnlineGuessPlayerId() {
  const user = await getCurrentUser();
  return user.uid;
}

export async function createOnlineGuessRoom(displayName) {
  const user = await getCurrentUser();
  const playerName = normalizePlayerName(displayName);

  for (let attempt = 0; attempt < 20; attempt += 1) {
    const code = makeRoomCode();
    const ref = roomRef(code);

    try {
      await runTransaction(db, async (transaction) => {
        const snap = await transaction.get(ref);

        if (snap.exists()) {
          throw new Error("ROOM_CODE_EXISTS");
        }

        transaction.set(ref, {
          code,
          hostId: user.uid,
          status: "lobby", // lobby | playing | finished
          phase: "lobby", // lobby | question | reveal | finished
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),

          settings: DEFAULT_ONLINE_GUESS_SETTINGS,

          currentRound: 0,
          currentQuestion: null,
          usedDexIds: [],

          buzzedBy: null,
          buzzedAt: null,
          buzzedAtMs: 0,
          buzzerAnswerDeadlineAtMs: 0,
          buzzLocked: false,
        });
      });

      await setDoc(playerRef(code, user.uid), {
        uid: user.uid,
        displayName: playerName,
        isHost: true,
        ready: false,
        score: 0,
        online: true,
        joinedAt: serverTimestamp(),
        lastActiveAt: serverTimestamp(),
      });

      localStorage.setItem("onlineGuessPlayerName", playerName);
      localStorage.setItem("onlineGuessLastRoom", code);

      return {
        code,
        uid: user.uid,
      };
    } catch (error) {
      if (String(error?.message || error) === "ROOM_CODE_EXISTS") {
        continue;
      }

      throw error;
    }
  }

  throw new Error("Konnte keinen freien Lobbycode erstellen. Bitte nochmal versuchen.");
}

export async function joinOnlineGuessRoom(roomCode, displayName) {
  const user = await getCurrentUser();

  const code = normalizeRoomCode(roomCode);
  if (!code) {
    throw new Error("Bitte gib einen Lobbycode ein.");
  }

  const playerName = normalizePlayerName(displayName);
  const snap = await getDoc(roomRef(code));

  if (!snap.exists()) {
    throw new Error("Diese Lobby wurde nicht gefunden.");
  }

  const room = snap.data();

  if (room.status !== "lobby") {
    throw new Error("Diese Lobby läuft bereits.");
  }

  await setDoc(
    playerRef(code, user.uid),
    {
      uid: user.uid,
      displayName: playerName,
      isHost: room.hostId === user.uid,
      ready: false,
      score: 0,
      online: true,
      joinedAt: serverTimestamp(),
      lastActiveAt: serverTimestamp(),
    },
    { merge: true }
  );

  localStorage.setItem("onlineGuessPlayerName", playerName);
  localStorage.setItem("onlineGuessLastRoom", code);

  return {
    code,
    uid: user.uid,
  };
}

export function subscribeOnlineGuessRoom(roomCode, callback) {
  assertFirebaseReady();

  const code = normalizeRoomCode(roomCode);

  return onSnapshot(roomRef(code), (snap) => {
    if (!snap.exists()) {
      callback(null);
      return;
    }

    callback({
      id: snap.id,
      ...snap.data(),
      settings: mergeOnlineGuessSettings(snap.data().settings),
    });
  });
}

export function subscribeOnlineGuessPlayers(roomCode, callback) {
  assertFirebaseReady();

  const code = normalizeRoomCode(roomCode);

  return onSnapshot(playersRef(code), (snapshot) => {
    const players = snapshot.docs
      .map((playerDoc) => ({
        id: playerDoc.id,
        ...playerDoc.data(),
      }))
      .sort((a, b) => {
        if (a.isHost && !b.isHost) return -1;
        if (!a.isHost && b.isHost) return 1;
        return String(a.displayName || "").localeCompare(String(b.displayName || ""));
      });

    callback(players);
  });
}

export function subscribeOnlineGuessAnswers(roomCode, roundNumber, callback) {
  assertFirebaseReady();

  const code = normalizeRoomCode(roomCode);
  const q = query(answersRef(code), where("roundNumber", "==", Number(roundNumber) || 1));

  return onSnapshot(q, (snapshot) => {
    const answers = snapshot.docs.map((answerDoc) => ({
      id: answerDoc.id,
      ...answerDoc.data(),
    }));

    callback(answers);
  });
}

export async function setOnlineGuessReady(roomCode, ready) {
  const user = await getCurrentUser();

  await updateDoc(playerRef(roomCode, user.uid), {
    ready: !!ready,
    lastActiveAt: serverTimestamp(),
  });
}

export async function updateOnlineGuessSettings(roomCode, patch) {
  const user = await getCurrentUser();
  const code = normalizeRoomCode(roomCode);

  await runTransaction(db, async (transaction) => {
    const ref = roomRef(code);
    const snap = await transaction.get(ref);

    if (!snap.exists()) {
      throw new Error("Lobby wurde nicht gefunden.");
    }

    const room = snap.data();

    if (room.hostId !== user.uid) {
      throw new Error("Nur der Host kann die Einstellungen ändern.");
    }

    if (room.status !== "lobby") {
      throw new Error("Die Einstellungen können nur in der Lobby geändert werden.");
    }

    const oldSettings = mergeOnlineGuessSettings(room.settings);

    transaction.update(ref, {
      settings: {
        ...oldSettings,
        ...patch,
      },
      updatedAt: serverTimestamp(),
    });
  });
}

export async function startOnlineGuessGame(roomCode) {
  const user = await getCurrentUser();
  const code = normalizeRoomCode(roomCode);

  const roomSnap = await getDoc(roomRef(code));

  if (!roomSnap.exists()) {
    throw new Error("Lobby wurde nicht gefunden.");
  }

  const room = roomSnap.data();

  if (room.hostId !== user.uid) {
    throw new Error("Nur der Host kann das Spiel starten.");
  }

  if (room.status !== "lobby") {
    throw new Error("Das Spiel wurde bereits gestartet.");
  }

  const playerSnap = await getDocs(playersRef(code));
  const players = playerSnap.docs.map((playerDoc) => playerDoc.data());
  const onlinePlayers = players.filter((player) => player.online !== false);

  if (!onlinePlayers.length) {
    throw new Error("Es sind keine Spieler in der Lobby.");
  }

  const notReadyPlayers = onlinePlayers.filter((player) => !player.ready);

  if (notReadyPlayers.length > 0) {
    throw new Error("Alle Spieler müssen bereit sein, bevor das Spiel startet.");
  }

  const settings = mergeOnlineGuessSettings(room.settings);
  const firstRound = await buildOnlineRound(settings, []);

  await runTransaction(db, async (transaction) => {
    const ref = roomRef(code);
    const freshSnap = await transaction.get(ref);

    if (!freshSnap.exists()) {
      throw new Error("Lobby wurde nicht gefunden.");
    }

    const freshRoom = freshSnap.data();

    if (freshRoom.hostId !== user.uid) {
      throw new Error("Nur der Host kann das Spiel starten.");
    }

    if (freshRoom.status !== "lobby") {
      throw new Error("Das Spiel wurde bereits gestartet.");
    }

    transaction.update(ref, {
      status: "playing",
      phase: "question",
      currentRound: 1,
      currentQuestion: firstRound,
      usedDexIds: [firstRound.target.dexId],
      buzzedBy: null,
      buzzedAt: null,
      buzzedAtMs: 0,
      buzzerAnswerDeadlineAtMs: 0,
      buzzLocked: false,
      startedAt: serverTimestamp(),
      roundStartedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  });
}

export async function submitOnlineGuessAnswer(roomCode, answerText) {
  const user = await getCurrentUser();
  const code = normalizeRoomCode(roomCode);
  const cleanAnswer = String(answerText || "").trim();

  if (!cleanAnswer) {
    throw new Error("Bitte gib eine Antwort ein.");
  }

  const roomSnap = await getDoc(roomRef(code));

  if (!roomSnap.exists()) {
    throw new Error("Lobby wurde nicht gefunden.");
  }

  const room = roomSnap.data();

  if (room.status !== "playing" || room.phase !== "question") {
    throw new Error("Aktuell können keine Antworten abgegeben werden.");
  }

  const settings = mergeOnlineGuessSettings(room.settings);

  if (settings.gameMode === ONLINE_GUESS_GAME_MODES.BUZZER) {
    if (!room.buzzedBy) {
      throw new Error("Du musst erst buzzern.");
    }

    if (room.buzzedBy !== user.uid) {
      throw new Error("Ein anderer Spieler hat zuerst gebuzzert.");
    }

    const deadlineAtMs = Number(room.buzzerAnswerDeadlineAtMs) || 0;

    if (deadlineAtMs > 0 && Date.now() > deadlineAtMs) {
      throw new Error("Deine Antwortzeit ist abgelaufen.");
    }
  }

  const playerSnap = await getDoc(playerRef(code, user.uid));
  const player = playerSnap.exists() ? playerSnap.data() : null;

  await setDoc(
    answerRef(code, room.currentRound, user.uid),
    {
      uid: user.uid,
      displayName: player?.displayName || "Spieler",
      roundNumber: room.currentRound,
      answer: cleanAnswer,
      submittedAt: serverTimestamp(),
      revealed: false,
      correct: null,
      pointsDelta: 0,
    },
    { merge: true }
  );

  await setDoc(
    playerRef(code, user.uid),
    {
      uid: user.uid,
      lastActiveAt: serverTimestamp(),
      online: true,
    },
    { merge: true }
  );
}

export async function buzzOnlineGuess(roomCode) {
  const user = await getCurrentUser();
  const code = normalizeRoomCode(roomCode);

  await runTransaction(db, async (transaction) => {
    const ref = roomRef(code);
    const snap = await transaction.get(ref);

    if (!snap.exists()) {
      throw new Error("Lobby wurde nicht gefunden.");
    }

    const room = snap.data();
    const settings = mergeOnlineGuessSettings(room.settings);

    if (room.status !== "playing" || room.phase !== "question") {
      throw new Error("Aktuell kann nicht gebuzzert werden.");
    }

    if (settings.gameMode !== ONLINE_GUESS_GAME_MODES.BUZZER) {
      throw new Error("Diese Lobby spielt nicht im Buzzer-Modus.");
    }

    if (room.buzzLocked || room.buzzedBy) {
      throw new Error("Es hat bereits jemand gebuzzert.");
    }

    const buzzedAtMs = Date.now();
    const answerSeconds = Math.max(
      3,
      Math.min(30, Number(settings.buzzerAnswerSeconds) || 7)
    );

    transaction.update(ref, {
      buzzedBy: user.uid,
      buzzedAt: serverTimestamp(),
      buzzedAtMs,
      buzzerAnswerDeadlineAtMs: buzzedAtMs + answerSeconds * 1000,
      buzzLocked: true,
      updatedAt: serverTimestamp(),
    });
  });
}

export async function revealOnlineGuessRound(roomCode) {
  const user = await getCurrentUser();
  const code = normalizeRoomCode(roomCode);

  const roomSnap = await getDoc(roomRef(code));

  if (!roomSnap.exists()) {
    throw new Error("Lobby wurde nicht gefunden.");
  }

  const room = roomSnap.data();

  if (room.hostId !== user.uid) {
    throw new Error("Nur der Host kann aufdecken.");
  }

  if (room.status !== "playing" || room.phase !== "question") {
    throw new Error("Diese Runde kann gerade nicht aufgedeckt werden.");
  }

  const settings = mergeOnlineGuessSettings(room.settings);
  const roundNumber = Number(room.currentRound) || 1;

  const playerSnap = await getDocs(playersRef(code));
  const players = playerSnap.docs.map((playerDoc) => ({
    id: playerDoc.id,
    ...playerDoc.data(),
  }));

  const answerQuery = query(answersRef(code), where("roundNumber", "==", roundNumber));
  const answerSnap = await getDocs(answerQuery);
  const answers = answerSnap.docs.map((answerDoc) => ({
    id: answerDoc.id,
    ref: answerDoc.ref,
    ...answerDoc.data(),
  }));

  await runTransaction(db, async (transaction) => {
    const ref = roomRef(code);
    const freshSnap = await transaction.get(ref);

    if (!freshSnap.exists()) {
      throw new Error("Lobby wurde nicht gefunden.");
    }

    const freshRoom = freshSnap.data();

    if (freshRoom.hostId !== user.uid) {
      throw new Error("Nur der Host kann aufdecken.");
    }

    if (freshRoom.status !== "playing" || freshRoom.phase !== "question") {
      throw new Error("Diese Runde wurde bereits aufgedeckt.");
    }

    const target = freshRoom.currentQuestion?.target;

    if (!target) {
      throw new Error("Für diese Runde wurde kein Pokémon gefunden.");
    }

    const answerByUid = new Map();
    for (const answer of answers) {
      answerByUid.set(answer.uid, answer);
    }

    const summaries = [];

    for (const player of players) {
      if (player.online === false) continue;

      const answer = answerByUid.get(player.uid);
      const hasAnswer = Boolean(answer?.answer);

      let isCorrect = false;

      if (hasAnswer) {
        isCorrect = doesGuessMatch(target, answer.answer);
      }

      if (
        settings.gameMode === ONLINE_GUESS_GAME_MODES.BUZZER &&
        freshRoom.buzzedBy &&
        player.uid !== freshRoom.buzzedBy
      ) {
        isCorrect = false;
      }

      const pointsDelta = getAnswerPoints({
        isCorrect,
        hasAnswer,
        settings,
      });

      if (pointsDelta !== 0) {
        transaction.update(playerRef(code, player.uid), {
          score: increment(pointsDelta),
          lastActiveAt: serverTimestamp(),
        });
      }

      if (hasAnswer) {
        transaction.set(
          answerRef(code, roundNumber, player.uid),
          {
            correct: isCorrect,
            pointsDelta,
            revealed: true,
            resolvedAt: serverTimestamp(),
          },
          { merge: true }
        );
      }

      summaries.push({
        uid: player.uid,
        displayName: player.displayName || "Spieler",
        answer: answer?.answer || "",
        correct: isCorrect,
        pointsDelta,
        hadAnswer: hasAnswer,
      });
    }

    transaction.update(ref, {
      phase: "reveal",
      lastRevealSummary: summaries,
      revealedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  });
}

export async function goToNextOnlineGuessRound(roomCode) {
  const user = await getCurrentUser();
  const code = normalizeRoomCode(roomCode);

  const roomSnap = await getDoc(roomRef(code));

  if (!roomSnap.exists()) {
    throw new Error("Lobby wurde nicht gefunden.");
  }

  const room = roomSnap.data();

  if (room.hostId !== user.uid) {
    throw new Error("Nur der Host kann die nächste Runde starten.");
  }

  const settings = mergeOnlineGuessSettings(room.settings);
  const currentRound = Number(room.currentRound) || 1;

  if (currentRound >= Number(settings.totalRounds || 10)) {
    await updateDoc(roomRef(code), {
      status: "finished",
      phase: "finished",
      finishedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    return;
  }

  const usedDexIds = Array.isArray(room.usedDexIds) ? room.usedDexIds : [];
  const nextRound = await buildOnlineRound(settings, usedDexIds);

  await runTransaction(db, async (transaction) => {
    const ref = roomRef(code);
    const freshSnap = await transaction.get(ref);

    if (!freshSnap.exists()) {
      throw new Error("Lobby wurde nicht gefunden.");
    }

    const freshRoom = freshSnap.data();

    if (freshRoom.hostId !== user.uid) {
      throw new Error("Nur der Host kann die nächste Runde starten.");
    }

    if (freshRoom.status !== "playing") {
      throw new Error("Das Spiel läuft gerade nicht.");
    }

    const freshUsedDexIds = Array.isArray(freshRoom.usedDexIds)
      ? freshRoom.usedDexIds
      : [];

    transaction.update(ref, {
      phase: "question",
      currentRound: currentRound + 1,
      currentQuestion: nextRound,
      usedDexIds: [...freshUsedDexIds, nextRound.target.dexId],
      buzzedBy: null,
      buzzedAt: null,
      buzzedAtMs: 0,
      buzzerAnswerDeadlineAtMs: 0,
      buzzLocked: false,
      lastRevealSummary: [],
      roundStartedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  });
}

export async function heartbeatOnlineGuessPlayer(roomCode) {
  const user = await getCurrentUser();

  await setDoc(
    playerRef(roomCode, user.uid),
    {
      uid: user.uid,
      online: true,
      lastActiveAt: serverTimestamp(),
    },
    { merge: true }
  );
}

export async function leaveOnlineGuessRoom(roomCode) {
  const user = await getCurrentUser();

  await setDoc(
    playerRef(roomCode, user.uid),
    {
      uid: user.uid,
      online: false,
      ready: false,
      lastActiveAt: serverTimestamp(),
    },
    { merge: true }
  );
}