import React from "react";

function SaveUpload({ onTeamParsed }) {
  const handleFile = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const buffer = new Uint8Array(reader.result);

      // VBA-M: Suche Team im SRAM-Bereich (z. B. bei Pokémon Feuerrot: 0x2020 – 0x2100)
      const teamOffset = 0x2020; // 💡 kann je nach ROM abweichen
      const teamSize = 6;
      const dexIds = [];

      for (let i = 0; i < teamSize; i++) {
        const offset = teamOffset + i * 100; // Grob geschätzt 100 Bytes pro Pokémon
        const dexId = buffer[offset];
        if (dexId && dexId > 0 && dexId < 722) {
          dexIds.push(dexId);
        }
      }

      onTeamParsed(dexIds);
    };

    reader.readAsArrayBuffer(file);
  };

  return (
    <div>
      <input type="file" accept=".sav" onChange={handleFile} />
    </div>
  );
}

export default SaveUpload;
