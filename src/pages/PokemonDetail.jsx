// src/pages/PokemonDetail.jsx
import React from "react";
import { useParams, useNavigate } from "react-router-dom";
import { moves } from "../data/moves";
import { pokedexGen1 } from "../pokedex/pokedex_gen1";
import { pokedexGen2 } from "../pokedex/pokedex_gen2";
import { pokedexGen3 } from "../pokedex/pokedex_gen3";
import { pokedexGen4 } from "../pokedex/pokedex_gen4";
import { pokedexGen5 } from "../pokedex/pokedex_gen5";
import { pokedexGen6 } from "../pokedex/pokedex_gen6";

const fullPokedex = {
  ...pokedexGen1,
  ...pokedexGen2,
  ...pokedexGen3,
  ...pokedexGen4,
  ...pokedexGen5,
  ...pokedexGen6,
};

function getDexIdFromName(name) {
  const entry = Object.entries(fullPokedex).find(([, n]) => n === name);
  if (!entry) return null;
  return entry[0].replace("pokedex", "");
}

function PokemonDetail() {
  const { name } = useParams();
  const navigate = useNavigate();

  const savegames = JSON.parse(localStorage.getItem("savegames") || "{}");
  const active = localStorage.getItem("activeSave");
  const synced = savegames[active]?.syncedTeam || [];

  let pokemon = synced.find((p) => p?.name === name);
  if (!pokemon) {
    const altName = fullPokedex["pokedex" + getDexIdFromName(name)];
    pokemon = synced.find((p) => p?.name === altName);
  }

  const dexId = getDexIdFromName(name);

  if (!pokemon) {
    return (
      <div style={{ padding: "1rem" }}>
        <h1>{name}</h1>
        <p>Keine Pokémon-Daten gefunden.</p>
        <button onClick={() => navigate(-1)}>Zurück</button>
      </div>
    );
  }

  return (
    <div style={{ padding: "2rem", maxWidth: "600px", margin: "0 auto", color: "white" }}>
      <h1 style={{ fontSize: "2rem", textAlign: "center" }}>{pokemon.name}</h1>

      {dexId && (
        <div style={{ textAlign: "center", marginBottom: "1rem" }}>
          <img
            src={`https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${dexId}.png`}
            alt={pokemon.name}
            style={{ width: "200px" }}
          />
        </div>
      )}

      <div style={{ fontSize: "1.2rem", marginBottom: "1rem" }}>
        <p><strong>Level:</strong> {pokemon.level}</p>
        <p><strong>KP:</strong> {pokemon.currentHP} / {pokemon.maxHP}</p>
        <p><strong>EP:</strong> {pokemon.xp}</p>
      </div>

      <div>
        <h2>Attacken</h2>
        {pokemon.moves?.length > 0 ? (
          <ul style={{ listStyle: "none", padding: 0 }}>
            {pokemon.moves.map((id, i) => {
              const moveEntry = moves[id];
              const moveName = typeof moveEntry === "string" ? moveEntry : moveEntry?.name || `#${id}`;
              const movePower = typeof moveEntry === "object" ? moveEntry.power : null;
              const movePP = typeof moveEntry === "object" ? moveEntry.pp : null;

              return (
                <li key={i} style={{
                  marginBottom: "0.5rem",
                  background: "#222",
                  padding: "0.5rem",
                  borderRadius: "0.5rem"
                }}>
                  <strong>{moveName}</strong><br />
                  {movePower && <span>🗡️ Stärke: {movePower} | </span>}
                  {movePP && <span>🔋 AP: {movePP}</span>}
                </li>
              );
            })}
          </ul>
        ) : (
          <p>Keine Attacken bekannt.</p>
        )}
      </div>

      <button
        onClick={() => navigate(-1)}
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
        Zurück
      </button>
    </div>
  );
}

export default PokemonDetail;