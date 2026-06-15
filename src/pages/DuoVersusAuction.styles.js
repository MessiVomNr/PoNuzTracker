// src/versus/DuoVersusAuction.styles.js

const cardBase = {
  boxSizing: "border-box",
  minWidth: 0,
};

const buttonBase = {
  boxSizing: "border-box",
  touchAction: "manipulation",
  WebkitTapHighlightColor: "transparent",
};

export const statPanel = {
  ...cardBase,
  padding: "clamp(10px, 1.6vw, 12px)",
  borderRadius: 12,
  border: "1px solid rgba(137,155,184,0.22)",
  background:
    "radial-gradient(circle at 0% 0%, rgba(96,165,250,0.08), transparent 44%), linear-gradient(180deg, rgba(13,24,42,0.82), rgba(8,15,28,0.82))",
  boxShadow:
    "inset 0 1px 0 rgba(255,255,255,0.035), 0 12px 28px rgba(0,0,0,0.32)",
};

export const auctionGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 340px), 1fr))",
  gap: "clamp(10px, 1.8vw, 14px)",
  alignItems: "start",
  minWidth: 0,
  width: "100%",
  boxSizing: "border-box",
};

export const playerCard = {
  ...cardBase,
  padding: "clamp(10px, 1.6vw, 12px)",
  borderRadius: 12,
  border: "1px solid rgba(100,140,215,0.24)",
  background:
    "radial-gradient(circle at 0% 0%, rgba(96,165,250,0.08), transparent 42%), linear-gradient(180deg, rgba(13,24,42,0.76), rgba(8,15,28,0.76))",
  boxShadow:
    "inset 0 1px 0 rgba(255,255,255,0.035), 0 8px 20px rgba(0,0,0,0.2)",
};

export const teamSlotCard = {
  ...cardBase,
  padding: "clamp(10px, 1.6vw, 12px)",
  borderRadius: 12,
  border: "1px solid rgba(137,155,184,0.2)",
  background:
    "linear-gradient(180deg, rgba(13,24,42,0.72), rgba(8,15,28,0.72))",
  boxShadow:
    "inset 0 1px 0 rgba(255,255,255,0.03), 0 8px 18px rgba(0,0,0,0.18)",
};

export const timerBig = {
  fontSize: "clamp(28px, 8vw, 40px)",
  fontWeight: 900,
  letterSpacing: 1,
  marginBottom: 6,
  lineHeight: 1,
};

export const input = {
  width: "100%",
  minWidth: 0,
  minHeight: 42,
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid rgba(137,155,184,0.34)",
  background:
    "linear-gradient(180deg, rgba(13,24,42,0.96), rgba(8,15,28,0.96))",
  color: "#f8fafc",
  outline: "none",
  fontWeight: 800,
  boxSizing: "border-box",
  boxShadow:
    "inset 0 1px 0 rgba(255,255,255,0.045), 0 8px 18px rgba(0,0,0,0.18)",
};

export const selectDark = {
  ...input,
  padding: "10px 38px 10px 12px",
  backgroundColor: "#101827",
  color: "#f8fafc",
  colorScheme: "dark",
  cursor: "pointer",
  appearance: "auto",
};

export const selectOption = {
  color: "#f8fafc",
  backgroundColor: "#101827",
  fontWeight: 800,
};

export const checkboxStyle = {
  accentColor: "#60a5fa",
};

export const btnPrimary = {
  ...buttonBase,
  padding: "10px 14px",
  minHeight: 42,
  borderRadius: 10,
  border: "1px solid rgba(96,165,250,0.52)",
  background:
    "linear-gradient(180deg, rgba(37,99,235,0.88), rgba(30,64,175,0.88))",
  color: "#ffffff",
  cursor: "pointer",
  fontWeight: 950,
  boxShadow:
    "inset 0 1px 0 rgba(255,255,255,0.10), 0 10px 22px rgba(0,0,0,0.24)",
};

export const btnGhost = {
  ...buttonBase,
  padding: "10px 14px",
  minHeight: 42,
  borderRadius: 10,
  border: "1px solid rgba(120,138,170,0.42)",
  background:
    "linear-gradient(180deg, rgba(13,24,42,0.88), rgba(8,15,28,0.88))",
  color: "#f8fafc",
  cursor: "pointer",
  fontWeight: 850,
  boxShadow:
    "inset 0 1px 0 rgba(255,255,255,0.04), 0 8px 18px rgba(0,0,0,0.18)",
};

export const btnSecondary =
  "px-3 py-2 rounded-xl bg-white/10 hover:bg-white/15 border border-white/10 text-white transition";

export const btnGhostSmall = {
  ...buttonBase,
  padding: "8px 10px",
  minHeight: 34,
  borderRadius: 9,
  border: "1px solid rgba(120,138,170,0.42)",
  background:
    "linear-gradient(180deg, rgba(13,24,42,0.88), rgba(8,15,28,0.88))",
  color: "#f8fafc",
  cursor: "pointer",
  fontWeight: 850,
  fontSize: 12,
  boxShadow:
    "inset 0 1px 0 rgba(255,255,255,0.04), 0 8px 18px rgba(0,0,0,0.18)",
};

export const imgBtn = {
  ...buttonBase,
  padding: 0,
  border: "none",
  background: "transparent",
  cursor: "pointer",
};

export const pokeHeroWrap = {
  ...cardBase,
  position: "relative",
  width: "min(320px, 100%)",
  maxWidth: "100%",
  aspectRatio: "1 / 1",
  height: "auto",
  margin: "0 auto",
  borderRadius: 18,
  overflow: "hidden",
  border: "1px solid rgba(137,155,184,0.3)",
  background:
    "radial-gradient(circle at 50% 26%, rgba(96,165,250,0.18), transparent 35%), radial-gradient(circle at 50% 70%, rgba(148,163,184,0.12), transparent 42%), linear-gradient(180deg, rgba(13,24,42,0.9), rgba(5,11,21,0.9))",
  boxShadow:
    "inset 0 1px 0 rgba(255,255,255,0.045), 0 20px 48px rgba(0,0,0,0.5)",
};

export const pokeHeroBtn = {
  ...buttonBase,
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
  boxSizing: "border-box",
  minWidth: 0,
};

export const pokeHeroOverlayFlash = {};

export const pokeHeroRightBadge = {
  borderRadius: 10,
  padding: "7px 8px",
  background:
    "linear-gradient(180deg, rgba(13,24,42,0.92), rgba(8,15,28,0.92))",
  border: "1px solid rgba(137,155,184,0.26)",
  minWidth: 7,
  textAlign: "center",
  boxSizing: "border-box",
  boxShadow:
    "inset 0 1px 0 rgba(255,255,255,0.035), 0 8px 16px rgba(0,0,0,0.22)",
};

export const evoCardBtn = {
  ...buttonBase,
  display: "grid",
  justifyItems: "center",
  gap: 4,
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid rgba(137,155,184,0.24)",
  background:
    "radial-gradient(circle at 0% 0%, rgba(96,165,250,0.08), transparent 42%), linear-gradient(180deg, rgba(13,24,42,0.78), rgba(8,15,28,0.78))",
  color: "#f8fafc",
  cursor: "pointer",
  textAlign: "center",
  minWidth: 0,
  boxShadow:
    "inset 0 1px 0 rgba(255,255,255,0.035), 0 10px 22px rgba(0,0,0,0.28)",
};

export const typeIconRow = {
  marginTop: 10,
  display: "flex",
  gap: 8,
  justifyContent: "center",
  alignItems: "center",
  flexWrap: "wrap",
  minWidth: 0,
};

export const typeIcon = {
  width: 28,
  height: 28,
  borderRadius: 8,
  padding: 3,
  background:
    "linear-gradient(180deg, rgba(13,24,42,0.86), rgba(8,15,28,0.86))",
  border: "1px solid rgba(137,155,184,0.24)",
  boxSizing: "border-box",
  boxShadow: "0 6px 12px rgba(0,0,0,0.2)",
};

export const btnDanger = {
  ...buttonBase,
  padding: "10px 14px",
  minHeight: 42,
  borderRadius: 10,
  border: "1px solid rgba(248,113,113,0.38)",
  background:
    "linear-gradient(180deg, rgba(127,29,29,0.42), rgba(69,10,10,0.42))",
  color: "#fee2e2",
  cursor: "pointer",
  fontWeight: 950,
  boxShadow:
    "inset 0 1px 0 rgba(255,255,255,0.035), 0 8px 18px rgba(0,0,0,0.2)",
};

export const pokeHeroOverlayFlashStrong = {
  boxShadow:
    "0 0 0 2px rgba(96,165,250,0.34), 0 0 28px rgba(96,165,250,0.22), 0 18px 40px rgba(0,0,0,0.45)",
};