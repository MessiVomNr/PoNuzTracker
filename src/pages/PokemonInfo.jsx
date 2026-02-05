import React, { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";

function cap(s) {
  return String(s || "")
    .replace(/-/g, " ")
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

function getIdFromSpeciesUrl(url) {
  // z.B. https://pokeapi.co/api/v2/pokemon-species/25/
  const m = String(url || "").match(/\/pokemon-species\/(\d+)\//);
  return m ? Number(m[1]) : null;
}

function compactSprite(pokemon) {
  return (
    pokemon?.sprites?.other?.["official-artwork"]?.front_default ||
    pokemon?.sprites?.front_default ||
    ""
  );
}

export default function PokemonInfo() {
  const { dexId } = useParams();
  const navigate = useNavigate();
  const id = Number(dexId);

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [pokemon, setPokemon] = useState(null);
  const [species, setSpecies] = useState(null);
  const [evoChain, setEvoChain] = useState(null);

  useEffect(() => {
    let alive = true;
    async function run() {
      try {
        setLoading(true);
        setErr("");

        const [pRes, sRes] = await Promise.all([
          fetch(`https://pokeapi.co/api/v2/pokemon/${id}`),
          fetch(`https://pokeapi.co/api/v2/pokemon-species/${id}`),
        ]);

        if (!pRes.ok) throw new Error("Pokémon konnte nicht geladen werden.");
        if (!sRes.ok) throw new Error("Species konnte nicht geladen werden.");

        const p = await pRes.json();
        const s = await sRes.json();

        // Evo chain nachladen
        let chain = null;
        const evoUrl = s?.evolution_chain?.url;
        if (evoUrl) {
          const eRes = await fetch(evoUrl);
          if (eRes.ok) chain = await eRes.json();
        }

        if (!alive) return;
        setPokemon(p);
        setSpecies(s);
        setEvoChain(chain);
      } catch (e) {
        if (!alive) return;
        setErr(e?.message || "Fehler beim Laden.");
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    }
    if (Number.isFinite(id) && id > 0) run();
    else {
      setLoading(false);
      setErr("Ungültige Dex-ID.");
    }
    return () => {
      alive = false;
    };
  }, [id]);

  const types = useMemo(() => {
    const arr = pokemon?.types || [];
    return arr
      .slice()
      .sort((a, b) => (a?.slot ?? 0) - (b?.slot ?? 0))
      .map((t) => cap(t?.type?.name));
  }, [pokemon]);

  const catchRate = species?.capture_rate ?? null;

  const stats = useMemo(() => {
    const s = pokemon?.stats || [];
    const map = {};
    for (const it of s) map[it?.stat?.name] = it?.base_stat;
    return {
      HP: map.hp ?? "-",
      Atk: map.attack ?? "-",
      Def: map.defense ?? "-",
      SpA: map["special-attack"] ?? "-",
      SpD: map["special-defense"] ?? "-",
      Spe: map.speed ?? "-",
    };
  }, [pokemon]);

  const levelUpMoves = useMemo(() => {
    const mv = pokemon?.moves || [];
    const out = [];

    for (const m of mv) {
      const name = cap(m?.move?.name);
      const details = m?.version_group_details || [];
      for (const d of details) {
        if (d?.move_learn_method?.name !== "level-up") continue;
        const lvl = d?.level_learned_at ?? 0;
        out.push({ level: lvl, name });
      }
    }

    // sort + de-dupe (same move at same level)
    out.sort((a, b) => a.level - b.level || a.name.localeCompare(b.name));
    const seen = new Set();
    return out.filter((x) => {
      const key = `${x.level}|${x.name}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [pokemon]);

  function flattenEvo(chainNode, acc = []) {
    if (!chainNode) return acc;
    const speciesName = cap(chainNode?.species?.name);
    const speciesId = getIdFromSpeciesUrl(chainNode?.species?.url);
    acc.push({ name: speciesName, id: speciesId });

    const next = chainNode?.evolves_to || [];
    for (const n of next) flattenEvo(n, acc);
    return acc;
  }

  const evoList = useMemo(() => {
    const root = evoChain?.chain;
    if (!root) return [];
    // Simple “alle in einer Liste” (V1). Später können wir das als Baum darstellen.
    const flat = flattenEvo(root, []);
    // de-dupe by id/name
    const seen = new Set();
    return flat.filter((x) => {
      const key = `${x.id || ""}|${x.name}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [evoChain]);

  const page = {
    padding: 16,
    maxWidth: 980,
    margin: "0 auto",
    color: "white",
  };
  const card = {
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.06)",
    borderRadius: 14,
    padding: 14,
  };
  const row = { display: "flex", gap: 16, flexWrap: "wrap" };
  const pill = {
    display: "inline-block",
    padding: "4px 10px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(0,0,0,0.25)",
    fontSize: 12,
    marginRight: 8,
  };
  const btn = {
    padding: "10px 12px",
    borderRadius: 10,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(0,0,0,0.25)",
    color: "white",
    cursor: "pointer",
  };

  return (
    <div style={page}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <h2 style={{ margin: 0 }}>Pokémon Info</h2>
        <button style={btn} onClick={() => navigate(-1)}>
          Zurück
        </button>
      </div>

      {loading && <div style={{ marginTop: 12, opacity: 0.8 }}>Lade…</div>}
      {!loading && err && (
        <div style={{ marginTop: 12, ...card, borderColor: "rgba(255,80,80,0.35)" }}>
          {err}
        </div>
      )}

      {!loading && !err && pokemon && species && (
        <>
          <div style={{ ...card, marginTop: 12 }}>
            <div style={row}>
              <div style={{ width: 180 }}>
                {compactSprite(pokemon) ? (
                  <img
                    src={compactSprite(pokemon)}
                    alt={pokemon?.name || "pokemon"}
                    style={{ width: 180, height: 180, objectFit: "contain" }}
                  />
                ) : (
                  <div style={{ width: 180, height: 180, opacity: 0.6 }}>Kein Bild</div>
                )}
              </div>

              <div style={{ flex: 1, minWidth: 240 }}>
                <div style={{ fontSize: 22, fontWeight: 800 }}>
                  {cap(pokemon?.name)} <span style={{ opacity: 0.6, fontWeight: 600 }}>#{id}</span>
                </div>

                <div style={{ marginTop: 8 }}>
                  {types.map((t) => (
                    <span key={t} style={pill}>
                      {t}
                    </span>
                  ))}
                </div>

                <div style={{ marginTop: 10, opacity: 0.85 }}>
                  Catchrate: <b>{catchRate ?? "-"}</b>
                </div>

                <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8 }}>
                  {Object.entries(stats).map(([k, v]) => (
                    <div key={k} style={{ ...card, padding: 10 }}>
                      <div style={{ fontSize: 12, opacity: 0.75 }}>{k}</div>
                      <div style={{ fontSize: 18, fontWeight: 800 }}>{v}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 12 }}>
            <div style={card}>
              <div style={{ fontWeight: 800, marginBottom: 8 }}>Level-Up Moves</div>
              <div style={{ maxHeight: 360, overflow: "auto" }}>
                {levelUpMoves.length === 0 && <div style={{ opacity: 0.75 }}>Keine Daten</div>}
                {levelUpMoves.map((m, idx) => (
                  <div key={`${m.level}-${m.name}-${idx}`} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                    <div style={{ opacity: 0.9 }}>{m.name}</div>
                    <div style={{ opacity: 0.7 }}>Lv {m.level}</div>
                  </div>
                ))}
              </div>
            </div>

            <div style={card}>
              <div style={{ fontWeight: 800, marginBottom: 8 }}>Entwicklung</div>
              {evoList.length === 0 && <div style={{ opacity: 0.75 }}>Keine Daten</div>}
              {evoList.map((e) => (
                <div
                  key={`${e.id || e.name}`}
                  style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid rgba(255,255,255,0.08)", cursor: e.id ? "pointer" : "default" }}
                  onClick={() => e.id && navigate(`/pokemon/${e.id}`)}
                  title={e.id ? "Öffnen" : ""}
                >
                  <div>{e.name}</div>
                  <div style={{ opacity: 0.65 }}>{e.id ? `#${e.id}` : ""}</div>
                </div>
              ))}
              <div style={{ marginTop: 10, opacity: 0.6, fontSize: 12 }}>
                (V1: einfache Liste. Baum/Methoden können wir später ergänzen.)
              </div>
            </div>
          </div>

          {/* Optional Buttons (noch ohne Content) */}
          <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button style={{ ...btn, opacity: 0.6 }} disabled>
              TM Moves (später)
            </button>
            <button style={{ ...btn, opacity: 0.6 }} disabled>
              Egg Moves (später)
            </button>
          </div>
        </>
      )}
    </div>
  );
}
