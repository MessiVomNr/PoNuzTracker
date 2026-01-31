import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

function SaveGameManager() {
  const [savegames, setSavegames] = useState({});
  const [newName, setNewName] = useState("");
  const [selectedEdition, setSelectedEdition] = useState("Rot");
  const [linkMode, setLinkMode] = useState("solo");
  const [renameKey, setRenameKey] = useState(null);
  const [renameValue, setRenameValue] = useState("");
  const navigate = useNavigate();

  const editions = [
    "Rot", "Blau", "Gelb",
    "Gold", "Silber", "Kristall",
    "Rubin", "Saphir", "Smaragd",
    "Feuerrot", "Blattgrün",
    "Diamant", "Perl", "Platin",
    "HeartGold", "SoulSilver",
    "Schwarz", "Weiß", "Schwarz 2", "Weiß 2",
    "X", "Y", "Omega Rubin", "Alpha Saphir",
    "Sonne", "Mond", "Ultrasonne", "Ultramond"
  ];

  useEffect(() => {
    document.body.classList.add("background-active");
    return () => {
      document.body.classList.remove("background-active");
    };
  }, []);

  useEffect(() => {
    const data = JSON.parse(localStorage.getItem("savegames") || "{}");
    setSavegames(data);
  }, []);

  const selectSave = (name) => {
    localStorage.setItem("activeSave", name);
    navigate("/table");
  };

  const createSave = () => {
    const trimmed = newName.trim();
    if (!trimmed || savegames[trimmed]) return;
    const updated = {
      ...savegames,
      [trimmed]: {
        encounters: {},
        team: ["", "", "", "", "", ""],
        gymsDefeated: 0,
        edition: selectedEdition,
        linkMode: linkMode,
      },
    };
    setSavegames(updated);
    localStorage.setItem("savegames", JSON.stringify(updated));
    localStorage.setItem("activeSave", trimmed);
    navigate("/table");
  };

  const deleteSave = (name) => {
    if (!window.confirm(`Spielstand "${name}" wirklich löschen?`)) return;
    const updated = { ...savegames };
    delete updated[name];
    setSavegames(updated);
    localStorage.setItem("savegames", JSON.stringify(updated));
    const active = localStorage.getItem("activeSave");
    if (active === name) {
      localStorage.removeItem("activeSave");
    }
  };

  const startRename = (name) => {
    setRenameKey(name);
    setRenameValue(name);
  };

  const cancelRename = () => {
    setRenameKey(null);
    setRenameValue("");
  };

  const confirmRename = () => {
    const trimmed = renameValue.trim();
    if (!trimmed || savegames[trimmed]) {
      alert("Ungültiger oder bereits existierender Name.");
      return;
    }

    const updated = { ...savegames };
    updated[trimmed] = updated[renameKey];
    delete updated[renameKey];

    setSavegames(updated);
    localStorage.setItem("savegames", JSON.stringify(updated));

    const active = localStorage.getItem("activeSave");
    if (active === renameKey) {
      localStorage.setItem("activeSave", trimmed);
    }

    setRenameKey(null);
    setRenameValue("");
  };

  const updateGyms = (name, delta) => {
    const updated = {
      ...savegames,
      [name]: {
        ...savegames[name],
        gymsDefeated: Math.max(0, (savegames[name].gymsDefeated || 0) + delta),
      },
    };
    setSavegames(updated);
    localStorage.setItem("savegames", JSON.stringify(updated));
  };

  const exportSavegame = (name) => {
    const data = savegames[name];
    const blob = new Blob([JSON.stringify({ [name]: data }, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${name}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportFile = (file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const imported = JSON.parse(e.target.result);
        if (!imported || typeof imported !== "object") {
          alert("Ungültige Datei");
          return;
        }

        const importedKey = Object.keys(imported)[0];
        let finalKey = importedKey;
        const importedData = imported[importedKey];

        if (savegames[importedKey]) {
          const choice = window.prompt(
            `Spielstand "${importedKey}" existiert bereits.\n\nGib einen neuen Namen ein, um ihn umzubenennen,\noder lasse das Feld leer, um den Import abzubrechen.\n\n(Tipp: Gib denselben Namen ein, um zu überschreiben.)`,
            `${importedKey}_imported`
          );

          if (choice === null || choice.trim() === "") {
            alert("Import abgebrochen.");
            return;
          }

          finalKey = choice.trim();
        }

        const merged = {
          ...savegames,
          [finalKey]: importedData,
        };
        setSavegames(merged);
        localStorage.setItem("savegames", JSON.stringify(merged));
        alert(`Spielstand "${finalKey}" importiert!`);
      } catch (err) {
        alert("Fehler beim Import");
      }
    };
    reader.readAsText(file);
  };

  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      justifyContent: "center",
      alignItems: "center",
      minHeight: "100vh",
      padding: "2rem",
      position: "relative",
      textAlign: "center"
    }}>
      <button
       onClick={() => navigate("/versus")}
      style={{
      position: "absolute",
      top: "18px",
      right: "18px",
      padding: "8px 14px",
      borderRadius: "999px",
      background: "#22c55e",    
      color: "#000",        
      border: "none",
      cursor: "pointer",
      fontWeight: 600,
      boxShadow: "0 2px 6px rgba(0,0,0,0.35)"
  }}
>
  Versus
</button>

  <button
    onClick={() => navigate("/duo")}
    style={{
    position: "absolute",
    top: "18px",
    right: "110px",
    padding: "8px 14px",
    borderRadius: "999px",
    background: "#22c55e",
    color: "#000",
    border: "none",
    cursor: "pointer",
    fontWeight: 600,
    boxShadow: "0 2px 6px rgba(0,0,0,0.35)"
  }}
>
  Duo Online
</button>


      <h1>Spielstände verwalten</h1>

      <div className="savegame-list-scroll" style={{
        display: "flex",
        flexDirection: "column",
        gap: "1.5rem",
        maxWidth: "480px",
        width: "90%",
        paddingRight: "4px"
      }}>
        {Object.keys(savegames).length === 0 && <p>Keine Spielstände vorhanden.</p>}
        {Object.keys(savegames).map((name) => (
          <div
            key={name}
            style={{
              background: "rgba(0, 0, 0, 0.2)",
              padding: "1rem",
              borderRadius: "12px",
              boxShadow: "0 2px 6px rgba(0, 0, 0, 0.2)",
              width: "100%"
            }}
          >
            {renameKey === name ? (
              <>
                <input
                  type="text"
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                />
                <button onClick={confirmRename} style={{ marginLeft: "0.5rem" }}>
                  Speichern
                </button>
                <button onClick={cancelRename} style={{ marginLeft: "0.5rem" }}>
                  Abbrechen
                </button>
              </>
            ) : (
              <>
                <strong style={{ fontSize: "1.2rem", color: "#007c38" }}>{name}</strong>
                <div style={{ margin: "0.3rem 0", fontSize: "0.95rem" }}>
                  Edition: <em>{savegames[name].edition || "Unbekannt"}</em><br />
                  Modus: <em>{savegames[name].linkMode || "solo"}</em>
                </div>
                <div style={{ marginTop: "0.5rem" }}>
                  <button onClick={() => selectSave(name)}>Laden</button>
                  <button onClick={() => startRename(name)} style={{ marginLeft: "0.5rem" }}>
                    Umbenennen
                  </button>
                  <button onClick={() => deleteSave(name)} style={{ marginLeft: "0.5rem" }}>
                    Löschen
                  </button>
                  <button onClick={() => exportSavegame(name)} style={{ marginLeft: "0.5rem" }}>
                    Exportieren
                  </button>
                </div>
                <div style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginTop: "0.5rem",
                  gap: "0.5rem"
                }}>
                  <span>Arenen: {savegames[name].gymsDefeated || 0}</span>
                  <button onClick={() => updateGyms(name, +1)}>+</button>
                  <button onClick={() => updateGyms(name, -1)} disabled={(savegames[name].gymsDefeated || 0) === 0}>–</button>
                </div>
              </>
            )}
          </div>
        ))}
      </div>

      <div style={{ marginTop: "2rem" }}>
        <input
          type="text"
          placeholder="Neuer Spielstand"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
        />
        <select
          value={selectedEdition}
          onChange={(e) => setSelectedEdition(e.target.value)}
          style={{ marginLeft: "1rem", padding: "0.4rem" }}
        >
          {editions.map((ed) => (
            <option key={ed} value={ed}>{ed}</option>
          ))}
        </select>
        <select
          value={linkMode}
          onChange={(e) => setLinkMode(e.target.value)}
          style={{ marginLeft: "1rem", padding: "0.4rem" }}
        >
          <option value="solo">Solo</option>
          <option value="duo">Duo</option>
          <option value="trio">Trio</option>
        </select>
        <button onClick={createSave} style={{ marginLeft: "1rem" }}>
          Erstellen
        </button>
      </div>

      <div
        onDrop={(e) => {
          e.preventDefault();
          if (e.dataTransfer.files.length > 0) {
            handleImportFile(e.dataTransfer.files[0]);
          }
        }}
        onDragOver={(e) => e.preventDefault()}
        style={{
          marginTop: "3rem",
          padding: "1rem",
          border: "2px dashed gray",
          textAlign: "center",
          borderRadius: "12px",
          width: "90%",
          maxWidth: "480px"
        }}
      >
        <p>📂 Datei hierher ziehen oder auswählen</p>
        <input
          type="file"
          accept="application/json"
          onChange={(e) => {
            if (e.target.files.length > 0) {
              handleImportFile(e.target.files[0]);
              e.target.value = null;
            }
          }}
        />
      </div>
    </div>
  );
}

export default SaveGameManager;
