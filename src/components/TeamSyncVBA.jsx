import React, { useState } from "react";
import { pokedex } from "../data/pokedex";

function TeamSyncVBA({ onTeamExtracted }) {
  const [error, setError] = useState("");
  const [team, setTeam] = useState([]);

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const buffer = new Uint8Array(event.target.result);
      const teamOffset = 0x2020;
      const newTeam = [];

      for (let i = 0; i < 6; i++) {
        const slotOffset = teamOffset + i * 100;

        // Debug-Ausgabe der rohen Slot-Daten
        const rawBytes = buffer.slice(slotOffset, slotOffset + 16);
        console.log(`Slot ${i} Raw:`, Array.from(rawBytes));

        const dexId = buffer[slotOffset];
        if (dexId === 0 || dexId > 721) continue;

        const name = `#${dexId}`;

        const move1 = buffer[slotOffset + 0x08] + (buffer[slotOffset + 0x09] << 8);
        const move2 = buffer[slotOffset + 0x0A] + (buffer[slotOffset + 0x0B] << 8);
        const move3 = buffer[slotOffset + 0x0C] + (buffer[slotOffset + 0x0D] << 8);
        const move4 = buffer[slotOffset + 0x0E] + (buffer[slotOffset + 0x0F] << 8);

        const level = buffer[slotOffset + 0x84];
        const currentHP = buffer[slotOffset + 0x86] + (buffer[slotOffset + 0x87] << 8);
        const maxHP = buffer[slotOffset + 0x88] + (buffer[slotOffset + 0x89] << 8);
        const xp =
          buffer[slotOffset + 0x8A] +
          (buffer[slotOffset + 0x8B] << 8) +
          (buffer[slotOffset + 0x8C] << 16);

        newTeam.push({
          dexId,
          name,
          level,
          currentHP,
          maxHP,
          xp,
          moves: [move1, move2, move3, move4],
        });
      }

      if (newTeam.length === 0) {
        setError("Kein Team im Save gefunden.");
        setTeam([]);
      } else {
        setError("");
        setTeam(newTeam);
        onTeamExtracted(newTeam);
      }
    };

    reader.readAsArrayBuffer(file);
  };

  return (
    <div style={{ marginTop: "2rem" }}>
      <h2>📥 Team aus GBA-Save (VBA-M / iGBA)</h2>
      <input type="file" accept=".sav" onChange={handleFileUpload} />
      {error && <p style={{ color: "red" }}>{error}</p>}

      {team.length > 0 && (
        <div style={{ marginTop: "1rem" }}>
          <h3>Team-Vorschau:</h3>
          <ul>
            {team.map((poke, index) => (
              <li key={index}>
                {poke.name} (Lv. {poke.level}) – {poke.currentHP}/{poke.maxHP} KP
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default TeamSyncVBA;
