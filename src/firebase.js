import { initializeApp, getApps } from "firebase/app";
import { getAuth, signInAnonymously } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID,
};

// ✅ Debug (nur im Dev-Mode). Zeigt dir 100% was wirklich ankommt.
if (process.env.NODE_ENV !== "production") {
  // Key nicht komplett ausgeben (reicht zum Prüfen)
  const key = firebaseConfig.apiKey || "";
  const maskedKey = key ? `${key.slice(0, 6)}...${key.slice(-4)}` : "(missing)";

  // eslint-disable-next-line no-console
  console.log("[Firebase] ENV CHECK", {
    apiKey: maskedKey,
    authDomain: firebaseConfig.authDomain || "(missing)",
    projectId: firebaseConfig.projectId || "(missing)",
    storageBucket: firebaseConfig.storageBucket || "(missing)",
    messagingSenderId: firebaseConfig.messagingSenderId || "(missing)",
    appId: firebaseConfig.appId ? `${String(firebaseConfig.appId).slice(0, 10)}...` : "(missing)",
    origin: typeof window !== "undefined" ? window.location.origin : "(no-window)",
  });
}

export const hasConfig = !!firebaseConfig.apiKey && !!firebaseConfig.projectId;

export const app = hasConfig
  ? (getApps().length ? getApps()[0] : initializeApp(firebaseConfig))
  : null;

export const auth = app ? getAuth(app) : null;
export const db = app ? getFirestore(app) : null;

function hintForApiKeyError(err) {
  const msg = String(err?.message || err || "");
  // häufiges Problem: API Key ist per HTTP Referrer eingeschränkt
  // oder falscher Key / falsches Projekt / PWA Cache
  if (msg.includes("auth/api-key-not-valid") || msg.includes("api-key-not-valid")) {
    return (
      "Firebase meldet: api-key-not-valid.\n" +
      "Das passiert typischerweise durch:\n" +
      "1) API-Key ist in Google Cloud 'Credentials' per HTTP-Referrer eingeschränkt (localhost nicht erlaubt).\n" +
      "   -> Erlaube: http://localhost:3000/* (und ggf. http://127.0.0.1:3000/*) oder setze Restriktion testweise auf 'None'.\n" +
      "2) Key gehört zu einer anderen Firebase-App / anderem Projekt als projectId.\n" +
      "3) PWA/ServiceWorker Cache liefert alte Builds.\n" +
      "   -> Chrome: DevTools > Application > Service Workers > Unregister + Clear storage.\n"
    );
  }
  return "";
}

/**
 * Stellt sicher, dass Firebase bereit ist und die Config geladen wurde.
 */
export function assertFirebaseReady() {
  if (!hasConfig || !app || !db || !auth) {
    throw new Error(
      "Firebase ist nicht bereit.\n" +
        "Prüfe:\n" +
        "- .env im Projekt-Root (neben package.json)\n" +
        "- Variablen REACT_APP_FIREBASE_* korrekt gesetzt\n" +
        "- Dev-Server nach .env Änderungen neu gestartet (Strg+C -> npm start)\n"
    );
  }
}

/**
 * Stellt sicher, dass ein Auth-User existiert (Anonymous).
 * WICHTIG: In Firebase Console muss 'Authentication -> Anonymous' aktiviert sein.
 */
export async function ensureAnonAuth() {
  assertFirebaseReady();

  if (auth.currentUser) return auth.currentUser;

  try {
    const cred = await signInAnonymously(auth);
    return cred.user;
  } catch (err) {
    const extra = hintForApiKeyError(err);
    throw new Error((err?.message || String(err)) + (extra ? "\n\n" + extra : ""));
  }
}
