import React from "react";

export default function BackgroundShell({
  bg = "/backgrounds/background_4.png",
  children,
  overlayOpacity = 0.55,
}) {
  return (
    <div style={page}>
      <div style={{ ...bgStyle, backgroundImage: `url("${bg}")` }} />
      <div style={{ ...overlay, background: `rgba(0,0,0,${overlayOpacity})` }} />
      <div style={content}>{children}</div>
    </div>
  );
}

const page = {
  minHeight: "100vh",
  position: "relative",
  overflow: "hidden",
};

const bgStyle = {
  position: "fixed",
  inset: 0,
  backgroundSize: "cover",
  backgroundPosition: "center",
  backgroundRepeat: "no-repeat",
  filter: "blur(0px)",
  transform: "scale(1.02)",
  zIndex: 0,
};

const overlay = {
  position: "fixed",
  inset: 0,
  zIndex: 1,
};

const content = {
  position: "relative",
  zIndex: 2,
  padding: 16,
};
