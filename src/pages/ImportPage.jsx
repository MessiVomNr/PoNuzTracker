// src/pages/ImportPage.jsx
import React from "react";
import { useNavigate } from "react-router-dom";

function ImportPage() {
  const navigate = useNavigate();

  return (
    <div style={{ padding: "2rem", color: "white" }}>
      <h1>Import-Funktion deaktiviert</h1>
      <p>Der automatische Team-Import wurde deaktiviert. Du kannst dein Team manuell über die Tabelle oder Team-Seite verwalten.</p>
      <button
        onClick={() => navigate("/team")}
        style={{
          marginTop: "1rem",
          padding: "0.5rem 1rem",
          backgroundColor: "#00cc66",
          color: "white",
          border: "none",
          borderRadius: "0.5rem",
          cursor: "pointer"
        }}
      >
        Zurück zum Team
      </button>
    </div>
  );
}

export default ImportPage;
