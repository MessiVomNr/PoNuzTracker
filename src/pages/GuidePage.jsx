import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import editionData from "../data/editionData";
import { getGenFromEdition } from "../utils/editionHelpers";
import guideByGen from "../guides/guideByGen";
import levelCapsByGen from "../guides/level_caps";
import TMStoryPanel from "../components/TMStoryPanel";
import TMStoryEmbedded from "./TMStoryEmbedded";

function GuidePage() {
  const navigate = useNavigate();
  const activeSave = localStorage.getItem("activeSave");
  const savegames = JSON.parse(localStorage.getItem("savegames") || "{}");
  const currentSave = savegames[activeSave] || {};
  const edition = currentSave.edition || "";
  const gen = getGenFromEdition(edition);

  const guide = guideByGen[gen] || [];
  const levelCaps = levelCapsByGen[gen] || [];

  const genData = Object.values(editionData).find((e) => e.gen === gen);
  const vms = genData?.vms || [];

  const [completedSteps, setCompletedSteps] = useState([]);
  const [rules, setRules] = useState(currentSave.rules || []);
  const [newRule, setNewRule] = useState("");

  useEffect(() => {
    const saved = localStorage.getItem(`guideProgress_${activeSave}`);
    if (saved) {
      setCompletedSteps(JSON.parse(saved));
    }
  }, [activeSave]);

  const toggleStep = (index) => {
    const newSteps = completedSteps.includes(index)
      ? completedSteps.filter((i) => i !== index)
      : [...completedSteps, index];

    setCompletedSteps(newSteps);
    localStorage.setItem(`guideProgress_${activeSave}`, JSON.stringify(newSteps));
  };

  const saveRulesToStorage = (newRules) => {
    const updatedSave = { ...currentSave, rules: newRules };
    const updatedSavegames = { ...savegames, [activeSave]: updatedSave };
    localStorage.setItem("savegames", JSON.stringify(updatedSavegames));
    setRules(newRules);
  };

  return (
    <div
      className="guide-page"
      style={{
        position: "relative",
        paddingRight: "320px",
        minHeight: "100vh",
        overflowX: "hidden",
      }}
    >
      <button
        onClick={() => navigate("/table")}
        style={{
          position: "absolute",
          top: "1rem",
          left: "1rem",
          zIndex: 20,
        }}
      >
        Zurück zur Encounter-Tabelle
      </button>

      <h1 style={{ textAlign: "center", marginTop: "3rem" }}>
        Story-Guide für {edition}
      </h1>

      <div
        style={{
          display: "flex",
          justifyContent: "center",
          gap: "2rem",
          alignItems: "flex-start",
          marginBottom: "3rem",
          marginTop: "2rem",
        }}
      >
        <div
          style={{
            flex: "0 0 350px",
            background: "#111",
            padding: "1rem",
            borderRadius: "10px",
            maxHeight: "50vh",
            overflowY: "auto",
          }}
        >
          <h2>Regeln</h2>
          <ul style={{ paddingLeft: "1rem" }}>
            {rules.map((rule, idx) => (
              <li key={idx} style={{ marginBottom: "0.5rem" }}>
                {rule}
                <button
                  onClick={() => {
                    const updated = [...rules];
                    updated.splice(idx, 1);
                    saveRulesToStorage(updated);
                  }}
                  style={{ marginLeft: "0.5rem" }}
                >
                  Entfernen
                </button>
              </li>
            ))}
          </ul>

          <div style={{ display: "flex", marginTop: "0.5rem" }}>
            <input
              type="text"
              placeholder="Neue Regel"
              value={newRule}
              onChange={(e) => setNewRule(e.target.value)}
              style={{
                flex: 1,
                padding: "0.4rem",
                borderRadius: "5px",
                border: "1px solid #555",
                background: "#222",
                color: "white",
              }}
            />
            <button
              onClick={() => {
                if (!newRule.trim()) return;
                const updated = [...rules, newRule.trim()];
                saveRulesToStorage(updated);
                setNewRule("");
              }}
              style={{
                marginLeft: "0.5rem",
                padding: "0.4rem 1rem",
                borderRadius: "5px",
              }}
            >
              ➕
            </button>
          </div>
        </div>

        <div style={{ flex: "1" }}>
          {guide.length === 0 ? (
            <p>Kein Guide für diese Edition vorhanden.</p>
          ) : (
            <ol>
              {guide.map((step, idx) => (
                <li
                  key={idx}
                  onClick={() => toggleStep(idx)}
                  style={{
                    cursor: "pointer",
                    textDecoration: completedSteps.includes(idx) ? "line-through" : "none",
                    opacity: completedSteps.includes(idx) ? 0.6 : 1,
                  }}
                >
                  {step}
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>

      {levelCaps.length > 0 && (
        <div
          className="levelcap-box"
          style={{
            position: "fixed",
            top: "1rem",
            right: "1rem",
            width: "300px",
            maxHeight: "55vh",
            overflowY: "auto",
            paddingRight: "0.5rem",
            zIndex: 10,
          }}
        >
          <h3 style={{ marginTop: 0 }}>Level-Caps</h3>
          {levelCaps.map((cap) => (
            <div key={cap.order} style={{ marginBottom: "0.6rem" }}>
              <strong>{cap.order} :</strong> {cap.name}
              <br />
              <span style={{ fontSize: "0.85rem" }}>
                ({cap.location}) – <em>Level {cap.level}</em>
              </span>
            </div>
          ))}
        </div>
      )}
<div
  style={{
    position: "fixed",
    bottom: "1rem",
    right: "320px",
    width: "300px",
    maxHeight: "35vh",
    overflowY: "auto",
    paddingRight: "0.5rem",
    zIndex: 9,
    background: "#111",
    padding: "1rem",
    borderRadius: "10px",
    border: "1px solid rgba(255,255,255,0.12)",
  }}
>
  <h3 style={{ marginTop: 0 }}>TM Story</h3>
  <TMStoryEmbedded gen={gen} />
</div>

      {vms.length > 0 && (
        <div
          className="vm-box"
          style={{
            position: "fixed",
            bottom: "1rem",
            right: "1rem",
            width: "300px",
            maxHeight: "35vh",
            overflowY: "auto",
            paddingRight: "0.5rem",
            zIndex: 9,
          }}
        >
          <h3 style={{ marginTop: 0 }}>VM-Fundorte</h3>
          {vms.map((vm, index) => (
            <div key={index} style={{ marginBottom: "0.5rem" }}>
              <strong>{vm.name}</strong>
              <br />
              <span style={{ fontSize: "0.85rem" }}>{vm.location}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default GuidePage;
