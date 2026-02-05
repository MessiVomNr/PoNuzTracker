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
// --- German localization helpers (PokeAPI) ---
const moveNameCache = new Map(); // key: moveUrl, value: germanName

function getLocalizedName(namesArr, lang = "de") {
  const arr = Array.isArray(namesArr) ? namesArr : [];
  const hit = arr.find((n) => n?.language?.name === lang);
  return hit?.name || null;
}
const speciesNameDeCache = new Map(); // key: speciesId, value: germanName

async function fetchSpeciesNameDeById(speciesId) {
  const id = Number(speciesId);
  if (!id) return null;
  if (speciesNameDeCache.has(id)) return speciesNameDeCache.get(id);

  try {
    const res = await fetch(`https://pokeapi.co/api/v2/pokemon-species/${id}`);
    if (!res.ok) return null;
    const json = await res.json();
    const de = getLocalizedName(json?.names, "de");
    const fallback = cap(json?.name);
    const name = de || fallback;
    speciesNameDeCache.set(id, name);
    return name;
  } catch {
    return null;
  }
}

async function fetchMoveNameDe(moveUrl) {
  if (!moveUrl) return null;
  if (moveNameCache.has(moveUrl)) return moveNameCache.get(moveUrl);

  try {
    const res = await fetch(moveUrl);
    if (!res.ok) return null;
    const json = await res.json();
    const de = getLocalizedName(json?.names, "de");
    const fallback = cap(json?.name);
    const name = de || fallback;
    moveNameCache.set(moveUrl, name);
    return name;
  } catch {
    return null;
  }
}

async function fetchTypeNameDe(typeUrl) {
  if (!typeUrl) return null;
  try {
    const res = await fetch(typeUrl);
    if (!res.ok) return null;
    const json = await res.json();
    const de = getLocalizedName(json?.names, "de");
    return de || cap(json?.name);
  } catch {
    return null;
  }
}

// kleine Helper: Promise.all in kleinen Paketen (schont API)
async function mapInBatches(items, batchSize, fn) {
  const out = [];
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    // eslint-disable-next-line no-await-in-loop
    const r = await Promise.all(batch.map(fn));
    out.push(...r);
  }
  return out;
}

function compactSprite(pokemon) {
  return (
    pokemon?.sprites?.other?.["official-artwork"]?.front_default ||
    pokemon?.sprites?.front_default ||
    ""
  );
}
const TYPE_LABELS_DE = {
  normal: "Normal",
  fire: "Feuer",
  water: "Wasser",
  electric: "Elektro",
  grass: "Pflanze",
  ice: "Eis",
  fighting: "Kampf",
  poison: "Gift",
  ground: "Boden",
  flying: "Flug",
  psychic: "Psycho",
  bug: "Käfer",
  rock: "Gestein",
  ghost: "Geist",
  dragon: "Drache",
  dark: "Unlicht",
  steel: "Stahl",
  fairy: "Fee",
};

const typeIconRow = {
  marginTop: 10,
  display: "flex",
  gap: 8,
  justifyContent: "center",
  alignItems: "center",
  flexWrap: "wrap",
};

const typeIcon = {
  width: 28,
  height: 28,
  borderRadius: 8,
  padding: 3,
  background: "rgba(255,255,255,0.06)",
  border: "1px solid rgba(255,255,255,0.14)",
};
const hideScrollbar = {
  maxHeight: 360,
  overflow: "auto",
  scrollbarWidth: "none",        // Firefox
  msOverflowStyle: "none",       // IE / Edge alt
};
const hideScrollbarCss = `
  .hide-scrollbar::-webkit-scrollbar {
    display: none;
  }
`;

export default function PokemonInfo() {
  const { dexId } = useParams();
  const navigate = useNavigate();
  const id = Number(dexId);
  const [typesDe, setTypesDe] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [pokemon, setPokemon] = useState(null);
  const [species, setSpecies] = useState(null);
  const [evoChain, setEvoChain] = useState(null);
  const [moveNameDeByUrl, setMoveNameDeByUrl] = useState({}); 
  const [evoNameDeById, setEvoNameDeById] = useState({});

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
useEffect(() => {
  let alive = true;
  async function run() {
    const arr = pokemon?.types || [];
    const sorted = arr
      .slice()
      .sort((a, b) => (a?.slot ?? 0) - (b?.slot ?? 0));

    const names = await Promise.all(
      sorted.map((t) => fetchTypeNameDe(t?.type?.url))
    );

    if (!alive) return;
    setTypesDe(names.filter(Boolean));
  }

  if (pokemon) run();
  return () => {
    alive = false;
  };
}, [pokemon]);

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
const typeKeys = useMemo(() => {
  const arr = pokemon?.types || [];
  return arr
    .slice()
    .sort((a, b) => (a?.slot ?? 0) - (b?.slot ?? 0))
    .map((t) => String(t?.type?.name || "").toLowerCase())
    .filter(Boolean);
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
        out.push({ level: lvl, name, url: m?.move?.url });
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
useEffect(() => {
  let alive = true;

  async function run() {
    const uniqueUrls = Array.from(
      new Set((levelUpMoves || []).map((m) => m.url).filter(Boolean))
    );

    // schon bekannte nicht nochmal laden
    const missing = uniqueUrls.filter((u) => !moveNameDeByUrl[u]);

    if (missing.length === 0) return;

    const names = await mapInBatches(missing, 12, async (u) => {
      const de = await fetchMoveNameDe(u);
      return [u, de];
    });

    if (!alive) return;

    setMoveNameDeByUrl((prev) => {
      const next = { ...prev };
      for (const [u, de] of names) {
        if (de) next[u] = de;
      }
      return next;
    });
  }

  run();
  return () => {
    alive = false;
  };
}, [levelUpMoves]);

  function flattenEvo(chainNode, acc = []) {
    if (!chainNode) return acc;
    const speciesId = getIdFromSpeciesUrl(chainNode?.species?.url);
acc.push({ id: speciesId, fallbackName: cap(chainNode?.species?.name) });


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
useEffect(() => {
  let alive = true;

  async function run() {
    const ids = Array.from(new Set((evoList || []).map((e) => e.id).filter(Boolean)));
    const missing = ids.filter((id) => !evoNameDeById[id]);

    if (missing.length === 0) return;

    const pairs = await mapInBatches(missing, 10, async (id) => {
      const de = await fetchSpeciesNameDeById(id);
      return [id, de];
    });

    if (!alive) return;

    setEvoNameDeById((prev) => {
      const next = { ...prev };
      for (const [id, de] of pairs) {
        if (de) next[id] = de;
      }
      return next;
    });
  }

  run();
  return () => {
    alive = false;
  };
}, [evoList, evoNameDeById]);

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
                  {getLocalizedName(species?.names, "de") || cap(pokemon?.name)}{" "}
<span style={{ opacity: 0.6, fontWeight: 600 }}>#{id}</span>

                </div>

                <div style={{ marginTop: 8 }}>
                  {typeKeys.length > 0 && (
  <div style={typeIconRow}>
    {typeKeys.map((t) => (
      <img
        key={t}
        src={`https://raw.githubusercontent.com/partywhale/pokemon-type-icons/master/icons/${t}.svg`}
        alt={t}
        title={TYPE_LABELS_DE[t] ?? t}
        style={{
          ...typeIcon,
          filter: "drop-shadow(0 0 4px rgba(0,0,0,0.6))",
        }}
        onError={(e) => {
          // Fallback auf zweites CDN (wie im Draft)
          e.currentTarget.src = `https://raw.githubusercontent.com/duiker101/pokemon-type-svg-icons/master/icons/${t}.svg`;
        }}
      />
    ))}
  </div>
)}

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
              <div className="hide-scrollbar" style={hideScrollbar}>
                {levelUpMoves.length === 0 && <div style={{ opacity: 0.75 }}>Keine Daten</div>}
                {levelUpMoves.map((m, idx) => (
                  <div key={`${m.level}-${m.name}-${idx}`} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                    <div style={{ opacity: 0.9 }}>
  {moveNameDeByUrl[m.url] || m.name}
</div>
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
                  <div>{evoNameDeById[e.id] || e.fallbackName}</div>
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
