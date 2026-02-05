// src/pages/DuoVersusAuction.styles.js

export const statPanel = {
  padding: 12,
  borderRadius: 14,
  border: "1px solid rgba(255,255,255,0.14)",
  background: "rgba(0,0,0,0.22)",
  boxShadow: "0 12px 28px rgba(0,0,0,0.35)",
};

export const auctionGrid = {
  display: "grid",
  gridTemplateColumns: "1.6fr 1fr",
  gap: 10,
  alignItems: "start",
};

export const playerCard = {
  padding: 12,
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.14)",
  background: "rgba(255,255,255,0.04)",
};

export const teamSlotCard = {
  padding: 12,
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.14)",
  background: "rgba(255,255,255,0.04)",
};

export const timerBig = {
  fontSize: 40,
  fontWeight: 900,
  letterSpacing: 1,
  marginBottom: 6,
};

export const input = {
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.18)",
  background: "rgba(255,255,255,0.06)",
  color: "white",
  outline: "none",
};

export const selectDark = {
  ...input,
  colorScheme: "dark",
};

export const selectOption = {
  color: "white",
  backgroundColor: "rgb(35,35,35)",
};


export const btnPrimary = {
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.28)",
  background: "rgba(255,255,255,0.16)",
  color: "white",
  cursor: "pointer",
  fontWeight: 900,
};

export const btnGhost = {
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.18)",
  background: "rgba(255,255,255,0.06)",
  color: "white",
  cursor: "pointer",
  fontWeight: 800,
};

export const btnSecondary =
  "px-3 py-2 rounded-xl bg-white/10 hover:bg-white/15 border border-white/10 text-white transition";

export const btnGhostSmall = {
  padding: "8px 10px",
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.18)",
  background: "rgba(255,255,255,0.06)",
  color: "white",
  cursor: "pointer",
  fontWeight: 800,
  fontSize: 12,
};

export const imgBtn = {
  padding: 0,
  border: "none",
  background: "transparent",
  cursor: "pointer",
};

export const pokeHeroWrap = {
  position: "relative",
  width: 320,
  height: 320,
  borderRadius: 18,
  overflow: "hidden",
  border: "1px solid rgba(255,255,255,0.14)",
  background: "rgba(0,0,0,0.18)",
  boxShadow: "0 18px 40px rgba(0,0,0,0.45)",
};

export const pokeHeroBtn = {
  padding: 0,
  border: "none",
  background: "transparent",
  cursor: "pointer",
  width: "100%",
  height: "100%",
  display: "grid",
  placeItems: "center",
};

export const pokeHeroImg = {
  width: "100%",
  height: "100%",
  objectFit: "contain",
  imageRendering: "pixelated",
  filter: "drop-shadow(0 12px 22px rgba(0,0,0,0.65))",
};

export const pokeHeroOverlay = {
  position: "absolute",
  left: 0,
  right: 0,
  bottom: 0,
  padding: "14px 14px 12px",
  background:
    "linear-gradient(to top, rgba(0,0,0,0.88), rgba(0,0,0,0.28), rgba(0,0,0,0))",
  color: "white",
};

// ✅ absichtlich leer -> kein weißer Rahmen/Glow beim Bieten
export const pokeHeroOverlayFlash = {};

export const pokeHeroRightBadge = {
  borderRadius: 12,
  padding: "7px 7px",
  background: "rgba(0,0,0,0.40)",
  border: "1px solid rgba(255,255,255,0.14)",
  minWidth: 7,
  textAlign: "center",
};

export const evoCardBtn = {
  display: "grid",
  justifyItems: "center",
  gap: 4,
  padding: "10px 12px",
  borderRadius: 14,
  border: "1px solid rgba(255,255,255,0.22)",
  background: "rgba(0,0,0,0.22)",
  color: "white",
  cursor: "pointer",
  textAlign: "center",
  boxShadow: "0 10px 22px rgba(0,0,0,0.35)",
};

export const typeIconRow = {
  marginTop: 10,
  display: "flex",
  gap: 8,
  justifyContent: "center",
  alignItems: "center",
  flexWrap: "wrap",
};

export const typeIcon = {
  width: 28,
  height: 28,
  borderRadius: 8,
  padding: 3,
  background: "rgba(255,255,255,0.06)",
  border: "1px solid rgba(255,255,255,0.14)",
};

export const btnDanger = {
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid rgba(239,68,68,0.55)",
  background: "rgba(239,68,68,0.12)",
  color: "white",
  cursor: "pointer",
  fontWeight: 900,
};

export const pokeHeroOverlayFlashStrong = {
  boxShadow:
    "0 0 0 2px rgba(255,255,255,0.22), 0 18px 40px rgba(0,0,0,0.45)",
};
