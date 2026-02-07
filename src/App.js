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
import DuoVersusAuction from "./pages/DuoVersusAuction";
import PokemonInfo from "./pages/PokemonInfo";
import Pokedex from "./pages/Pokedex";
import GlobalEscapeMenu from "./components/GlobalEscapeMenu";
import MoveDex from "./pages/MoveDex";
import MoveDetail from "./pages/MoveDetail";
import TMStory from "./pages/TMStory";
import Controls from "./pages/Controls";
import ControlsDraft from "./pages/ControlsDraft";
import HomeMode from "./pages/HomeMode";
import OnlineMode from "./pages/OnlineMode";
import SoullinkStart from "./duo/SoullinkStart";
import DuoLobby from "./duo/DuoLobby";

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
    <>
      <GlobalEscapeMenu />
      <Routes>
        <Route path="/" element={<HomeMode />} />
        <Route path="/solo" element={<SaveGameManager/>} />
        <Route path="/table" element={<EncounterTable />} />
        <Route path="/team" element={<TeamManager />} />
        <Route path="/guide" element={<GuidePage />} />
        <Route path="/import" element={<ImportPage />} />
        <Route path="/pokemon-name/:name" element={<PokemonDetail />} />
        <Route path="/versus" element={<VersusHome />} />
        <Route path="/versus/:roomId" element={<VersusLobby />} />
        <Route path="/versus/:roomId/game" element={<VersusGame />} />
        <Route path="/duo" element={<DuoHome />} />
        <Route path="/duo/:roomId" element={<DuoLobby />} />
        <Route path="/duo/:roomId/versus" element={<DuoVersusAuction />} />
        <Route path="/versus/:roomId/auction" element={<DuoVersusAuction />} />
        <Route path="/pokemon/:dexId" element={<PokemonInfo />} />
        <Route path="/pokedex" element={<Pokedex />} />
        <Route path="/movedex" element={<MoveDex />} />
        <Route path="/move/:moveKey" element={<MoveDetail />} />
        <Route path="/tms" element={<TMStory />} />
        <Route path="/controls" element={<Controls />} />
        <Route path="/controls/draft" element={<ControlsDraft />} />
        <Route path="/soullink" element={<SoullinkStart />} />
        
      </Routes>
    </>
  );
}

function App() {
  return <AppContent />;
}

export default App;
