import React, { useEffect } from "react";
import { Routes, Route, useLocation } from "react-router-dom";
import EncounterTable from "./EncounterTable";
import TeamManager from "./TeamManager";
import SaveGameManager from "./SaveGameManager";
import GuidePage from "./pages/GuidePage";
import ImportPage from "./pages/ImportPage";
import PokemonDetail from "./pages/PokemonDetail";
import VersusHome from "./versus/VersusHome";
import VersusLobby from "./versus/VersusLobby";
import VersusGame from "./versus/VersusGame";
import DuoHome from "./duo/DuoHome";

// Hook für Theme-Verwaltung
function useInitTheme() {
  useEffect(() => {
    if (!localStorage.getItem("theme")) {
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      const theme = prefersDark ? "dark" : "light";
      document.body.classList.add(`${theme}-mode`);
      localStorage.setItem("theme", theme);
    } else {
      const theme = localStorage.getItem("theme");
      document.body.classList.add(`${theme}-mode`);
    }
  }, []);
}

// Hook für Background-Bild nur auf Startseite
function useBackgroundControl() {
  const location = useLocation();

  useEffect(() => {
    if (location.pathname === "/") {
      document.body.classList.add("background-active");
    } else {
      document.body.classList.remove("background-active");
    }
  }, [location]);
}

function AppContent() {
  useInitTheme();
  useBackgroundControl();

  return (
    <Routes>
      <Route path="/" element={<SaveGameManager />} />
      <Route path="/table" element={<EncounterTable />} />
      <Route path="/team" element={<TeamManager />} />
      <Route path="/guide" element={<GuidePage />} />
      <Route path="/import" element={<ImportPage />} />
      <Route path="/pokemon/:name" element={<PokemonDetail />} />
      <Route path="/versus" element={<VersusHome />} />
      <Route path="/versus/:roomId" element={<VersusLobby />} />
      <Route path="/versus/:roomId/game" element={<VersusGame />} />
      <Route path="/duo" element={<DuoHome />} />
    </Routes>
  );
}

function App() {
  return <AppContent />;
}

export default App;
