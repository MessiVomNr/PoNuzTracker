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

function getNameFromDexId(dexId) {
  return fullPokedex[`pokedex${dexId}`] || null;
}

function getArtworkUrl(dexId) {
  if (!dexId) return "";
  return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${dexId}.png`;
}

function getMoveData(id) {
  const moveEntry = moves[id];

  return {
    name: typeof moveEntry === "string" ? moveEntry : moveEntry?.name || `#${id}`,
    power: typeof moveEntry === "object" ? moveEntry.power : null,
    pp: typeof moveEntry === "object" ? moveEntry.pp : null,
  };
}

function PokemonDetail() {
  const { name } = useParams();
  const navigate = useNavigate();

  const savegames = JSON.parse(localStorage.getItem("savegames") || "{}");
  const active = localStorage.getItem("activeSave");
  const synced = savegames[active]?.syncedTeam || [];

  const routeDexId = Number(name);
  const routeIsDexId = Number.isFinite(routeDexId) && routeDexId > 0;
  const dexName = routeIsDexId ? getNameFromDexId(routeDexId) : null;

  let pokemon = synced.find((p) => p?.name === name);

  if (!pokemon && dexName) {
    pokemon = synced.find((p) => p?.name === dexName);
  }

  if (!pokemon) {
    const altDexId = getDexIdFromName(name);
    const altName = fullPokedex[`pokedex${altDexId}`];
    pokemon = synced.find((p) => p?.name === altName);
  }

  const dexId = routeIsDexId ? String(routeDexId) : getDexIdFromName(name);
  const displayName = pokemon?.name || dexName || name;

  if (!pokemon) {
    return (
      <div className="pnt-page pnt-center-page">
        <div className="pnt-panel pnt-panel-with-top-button" style={{ maxWidth: 760 }}>
          <button className="pnt-back-button" onClick={() => navigate(-1)}>
            Zurück
          </button>

          <div style={{ textAlign: "center" }}>
            <span className="pnt-kicker">Pokémon Detail</span>
            <h1 className="pnt-title" style={{ fontSize: "clamp(2rem, 4vw, 3rem)" }}>
              {displayName}
            </h1>
            <p className="pnt-subtitle">Keine Pokémon-Daten gefunden.</p>
          </div>

          <div className="pnt-alert pnt-alert-info" style={{ marginTop: 24 }}>
            Dieses Pokémon wurde nicht im aktuell aktiven Save-Team gefunden.
          </div>
        </div>
      </div>
    );
  }

  const hpPercent =
    Number(pokemon.maxHP) > 0
      ? Math.max(0, Math.min(100, (Number(pokemon.currentHP) / Number(pokemon.maxHP)) * 100))
      : 0;

  return (
    <div className="pnt-page pnt-center-page">
      <div className="pnt-panel pnt-panel-with-top-button" style={{ maxWidth: 900 }}>
        <button className="pnt-back-button" onClick={() => navigate(-1)}>
          Zurück
        </button>

        <div style={{ textAlign: "center", marginBottom: 26 }}>
          <span className="pnt-kicker">Team Pokémon</span>
          <h1 className="pnt-title" style={{ fontSize: "clamp(2.1rem, 4vw, 3.2rem)" }}>
            {pokemon.name}
          </h1>

          {dexId ? (
            <p className="pnt-subtitle" style={{ marginTop: 8 }}>
              Nationaldex #{dexId}
            </p>
          ) : null}
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(220px, 0.45fr) minmax(0, 1fr)",
            gap: 22,
            alignItems: "start",
          }}
        >
          <div className="pnt-card pnt-card-primary" style={{ textAlign: "center" }}>
            {dexId ? (
              <img
                src={getArtworkUrl(dexId)}
                alt={pokemon.name}
                style={{
                  width: "min(240px, 90%)",
                  height: 240,
                  objectFit: "contain",
                  filter: "drop-shadow(0 18px 34px rgba(0, 0, 0, 0.45))",
                }}
              />
            ) : (
              <div
                style={{
                  height: 240,
                  display: "grid",
                  placeItems: "center",
                  color: "var(--pnt-text-muted)",
                  fontWeight: 900,
                }}
              >
                Kein Bild verfügbar
              </div>
            )}

            <div style={{ marginTop: 16, display: "grid", gap: 10 }}>
              <div className="pnt-pill pnt-pill-blue">Level {pokemon.level ?? "?"}</div>
              <div className="pnt-pill pnt-pill-muted">
                EP: {pokemon.xp ?? 0}
              </div>
            </div>
          </div>

          <div style={{ display: "grid", gap: 18 }}>
            <div className="pnt-card">
              <div className="pnt-row-between" style={{ marginBottom: 12 }}>
                <div>
                  <h2 className="pnt-section-title">Status</h2>
                  <p className="pnt-section-text">Aktuelle Team-Daten aus deinem Save.</p>
                </div>
                <span className="pnt-pill">Aktiv</span>
              </div>

              <div style={{ display: "grid", gap: 14 }}>
                <div>
                  <div className="pnt-row-between" style={{ marginBottom: 8 }}>
                    <strong>KP</strong>
                    <span style={{ color: "var(--pnt-text-soft)", fontWeight: 900 }}>
                      {pokemon.currentHP ?? "?"} / {pokemon.maxHP ?? "?"}
                    </span>
                  </div>

                  <div
                    style={{
                      height: 13,
                      borderRadius: 999,
                      border: "1px solid rgba(137, 155, 184, 0.2)",
                      background: "rgba(5, 11, 21, 0.42)",
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        width: `${hpPercent}%`,
                        height: "100%",
                        borderRadius: 999,
                        background:
                          hpPercent <= 25
                            ? "linear-gradient(90deg, rgba(239, 68, 68, 0.95), rgba(248, 113, 113, 0.5))"
                            : hpPercent <= 50
                              ? "linear-gradient(90deg, rgba(245, 158, 11, 0.95), rgba(251, 191, 36, 0.5))"
                              : "linear-gradient(90deg, rgba(34, 197, 94, 0.95), rgba(52, 211, 153, 0.5))",
                        boxShadow: "0 0 18px rgba(34, 197, 94, 0.18)",
                      }}
                    />
                  </div>
                </div>

                <div className="pnt-grid-3" style={{ gap: 12 }}>
                  <div className="pnt-alert pnt-alert-info">
                    <div style={{ fontSize: 12, opacity: 0.72, fontWeight: 950 }}>Level</div>
                    <div style={{ fontSize: 22, fontWeight: 950 }}>{pokemon.level ?? "?"}</div>
                  </div>

                  <div className="pnt-alert pnt-alert-info">
                    <div style={{ fontSize: 12, opacity: 0.72, fontWeight: 950 }}>KP</div>
                    <div style={{ fontSize: 22, fontWeight: 950 }}>{pokemon.currentHP ?? "?"}</div>
                  </div>

                  <div className="pnt-alert pnt-alert-info">
                    <div style={{ fontSize: 12, opacity: 0.72, fontWeight: 950 }}>EP</div>
                    <div style={{ fontSize: 22, fontWeight: 950 }}>{pokemon.xp ?? 0}</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="pnt-card">
              <div style={{ marginBottom: 14 }}>
                <h2 className="pnt-section-title">Attacken</h2>
                <p className="pnt-section-text">Aktuelles Moveset dieses Pokémon.</p>
              </div>

              {pokemon.moves?.length > 0 ? (
                <div style={{ display: "grid", gap: 10 }}>
                  {pokemon.moves.map((id, i) => {
                    const move = getMoveData(id);

                    return (
                      <div
                        key={`${id}-${i}`}
                        style={{
                          display: "grid",
                          gridTemplateColumns: "minmax(0, 1fr) auto",
                          gap: 12,
                          alignItems: "center",
                          padding: "13px 14px",
                          border: "1px solid rgba(137, 155, 184, 0.18)",
                          borderRadius: "var(--pnt-radius)",
                          background:
                            "linear-gradient(180deg, rgba(13, 24, 42, 0.68), rgba(9, 17, 31, 0.66))",
                          boxShadow: "inset 0 1px 0 rgba(255, 255, 255, 0.035)",
                        }}
                      >
                        <div style={{ minWidth: 0 }}>
                          <strong
                            style={{
                              display: "block",
                              color: "var(--pnt-text)",
                              fontSize: "1rem",
                              fontWeight: 950,
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                            }}
                          >
                            {move.name}
                          </strong>

                          <span
                            style={{
                              display: "block",
                              marginTop: 4,
                              color: "var(--pnt-text-muted)",
                              fontSize: "0.86rem",
                              fontWeight: 750,
                            }}
                          >
                            Slot {i + 1}
                          </span>
                        </div>

                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
                          {move.power !== null && move.power !== undefined ? (
                            <span className="pnt-pill pnt-pill-danger">
                              Stärke {move.power}
                            </span>
                          ) : null}

                          {move.pp !== null && move.pp !== undefined ? (
                            <span className="pnt-pill pnt-pill-blue">
                              AP {move.pp}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="pnt-alert pnt-alert-info">
                  Keine Attacken bekannt.
                </div>
              )}
            </div>
          </div>
        </div>

        <div style={{ marginTop: 22, display: "flex", justifyContent: "center" }}>
          <button className="pnt-button pnt-button-ghost" onClick={() => navigate(-1)}>
            Zurück
          </button>
        </div>
      </div>
    </div>
  );
}

export default PokemonDetail;