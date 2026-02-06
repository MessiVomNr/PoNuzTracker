// src/pages/MoveDex.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import dexBg from "../assets/DexBackground.png";

const CACHE_KEY_LIST = "movedex_move_list_v2";
const CACHE_KEY_NAMES_DE = "movedex_names_de_v1";
const CACHE_KEY_GEN = "movedex_selected_gen_v1";

const GEN_OPTIONS = [
  { value: 1, label: "Gen 1" },
  { value: 2, label: "Gen 2" },
  { value: 3, label: "Gen 3" },
  { value: 4, label: "Gen 4" },
  { value: 5, label: "Gen 5" },
  { value: 6, label: "Gen 6" },
  { value: 7, label: "Gen 7" },
  { value: 72, label: "Gen 7.2 (Ultra)" },
];
const GEN_TO_POKEAPI_GENERATION = {
  1: 1,
  2: 2,
  3: 3,
  4: 4,
  5: 5,
  6: 6,
  7: 7,
  72: 7, // ✅ USUM ist trotzdem Gen 7
};

const HIDE_SCROLL_CSS = `
.hide-scroll { scrollbar-width: none; -ms-overflow-style: none; }
.hide-scroll::-webkit-scrollbar { width: 0px; height: 0px; }
`;

function useQuery() {
  const { search } = useLocation();
  return useMemo(() => new URLSearchParams(search), [search]);
}

function loadNameCache() {
  try {
    const v = JSON.parse(localStorage.getItem(CACHE_KEY_NAMES_DE) || "{}");
    return v && typeof v === "object" ? v : {};
  } catch {
    return {};
  }
}

async function fetchMoveList() {
  const res = await fetch("https://pokeapi.co/api/v2/move?limit=100000&offset=0");
  if (!res.ok) throw new Error("Move-Liste konnte nicht geladen werden");
  const data = await res.json();
  return (data?.results || []).map((x) => ({ name: x.name, url: x.url }));
}
async function fetchGenMoveSetUpTo(gen) {
  const g = GEN_TO_POKEAPI_GENERATION[gen] || gen;

  const cacheKey = `movedex_allowed_moves_upto_gen_${g}_v1`;
  try {
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      const arr = JSON.parse(cached);
      if (Array.isArray(arr)) return new Set(arr);
    }
  } catch {
    // ignore
  }

  // ✅ Union Gen 1..g
  const sets = await Promise.all(
    Array.from({ length: g }, (_, i) => i + 1).map(async (id) => {
      const res = await fetch(`https://pokeapi.co/api/v2/generation/${id}`);
      if (!res.ok) throw new Error(`Generation ${id} konnte nicht geladen werden`);
      const data = await res.json();
      const names = (data?.moves || []).map((m) => m?.name).filter(Boolean);
      return names;
    })
  );

  const merged = new Set();
  for (const arr of sets) for (const n of arr) merged.add(n);

  // Cache als Array speichern
  try {
    localStorage.setItem(cacheKey, JSON.stringify(Array.from(merged)));
  } catch {
    // ignore
  }

  return merged;
}


function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function getMoveNameDe(namesArr) {
  const arr = Array.isArray(namesArr) ? namesArr : [];
  const hit = arr.find((n) => n?.language?.name === "de");
  return hit?.name || null;
}

async function fetchMoveDeName(moveKey, signal) {
  const res = await fetch(`https://pokeapi.co/api/v2/move/${encodeURIComponent(moveKey)}`, { signal });
  if (!res.ok) throw new Error("Move konnte nicht geladen werden");
  const data = await res.json();
  return getMoveNameDe(data?.names);
}

export default function MoveDex() {
  const nav = useNavigate();
  const q = useQuery();

  const [loading, setLoading] = useState(true);
  const [moves, setMoves] = useState([]);
  const [query, setQuery] = useState(q.get("q") || "");
  const [nameDeCache, setNameDeCache] = useState(() => loadNameCache());
  const [gen, setGen] = useState(() => {
    const fromUrl = Number(q.get("gen"));
    if (Number.isFinite(fromUrl) && fromUrl) return fromUrl;
    const fromStorage = Number(localStorage.getItem(CACHE_KEY_GEN));
    return Number.isFinite(fromStorage) && fromStorage ? fromStorage : 6;
  });
const [allowedSet, setAllowedSet] = useState(() => new Set());
const [allowedLoading, setAllowedLoading] = useState(false);

  const abortRef = useRef(null);

  const [deLoading, setDeLoading] = useState(false);
  const [deDone, setDeDone] = useState(0);
  const [deTotal, setDeTotal] = useState(0);
  const [deError, setDeError] = useState("");

  async function preloadAllGermanNames() {
    if (deLoading) return;
    if (!moves?.length) return;

    // Missing keys
    const missing = moves.map((m) => m.name).filter((k) => !nameDeCache[k]);
    setDeTotal(missing.length);
    setDeDone(0);
    setDeError("");

    if (missing.length === 0) return;

    setDeLoading(true);

    // Abort any previous run
    try {
      abortRef.current?.abort?.();
    } catch {}
    const controller = new AbortController();
    abortRef.current = controller;

    const localCache = { ...nameDeCache };
    let done = 0;

    // Concurrency-limited workers
    const queue = [...missing];
    const concurrency = 4;

    async function worker() {
      while (queue.length && !controller.signal.aborted) {
        const key = queue.shift();
        try {
          const de = await fetchMoveDeName(key, controller.signal);
          if (de) localCache[key] = de;
        } catch (e) {
          // ignore single failures, continue
        } finally {
          done += 1;
          setDeDone(done);

          // persist every 25 results to reduce localStorage spam
          if (done % 25 === 0) {
            try {
              localStorage.setItem(CACHE_KEY_NAMES_DE, JSON.stringify(localCache));
            } catch {}
            setNameDeCache({ ...localCache });
          }
          // small delay to be nice to the API
          await sleep(60);
        }
      }
    }

    try {
      await Promise.all(Array.from({ length: concurrency }, () => worker()));
      // final persist
      try {
        localStorage.setItem(CACHE_KEY_NAMES_DE, JSON.stringify(localCache));
      } catch {}
      setNameDeCache({ ...localCache });
    } catch (e) {
      setDeError(String(e?.message || e));
    } finally {
      setDeLoading(false);
    }
  }

  useEffect(() => {
    // cleanup: abort preloader if user leaves the page
    return () => {
      try {
        abortRef.current?.abort?.();
      } catch {}
    };
  }, []);

  // ✅ wie Pokédex: Background/Body darf NICHT scrollen
  useEffect(() => {
    const prevHtml = document.documentElement.style.overflow;
    const prevBody = document.body.style.overflow;
    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    return () => {
      document.documentElement.style.overflow = prevHtml;
      document.body.style.overflow = prevBody;
    };
  }, []);

  // Name-Cache aktuell halten (falls Detailseite etwas rein schreibt)
  useEffect(() => {
    const id = window.setInterval(() => setNameDeCache(loadNameCache()), 900);
    return () => window.clearInterval(id);
  }, []);
useEffect(() => {
  function onKeyDown(e) {
    if (e.key === "Escape") {
      // wie beim Pokédex: ESC = zurück, sonst Home
      if (window.history.length > 1) nav(-1);
      else nav("/");
    }
  }

  window.addEventListener("keydown", onKeyDown);
  return () => window.removeEventListener("keydown", onKeyDown);
}, [nav]);

  useEffect(() => {
    localStorage.setItem(CACHE_KEY_GEN, String(gen));
  }, [gen]);

  useEffect(() => {
  let alive = true;

  (async () => {
    try {
      setAllowedLoading(true);
      const set = await fetchGenMoveSetUpTo(gen);
      if (!alive) return;
      setAllowedSet(set);
    } catch (e) {
      console.error(e);
      if (!alive) return;
      setAllowedSet(new Set()); // fallback
    } finally {
      if (alive) setAllowedLoading(false);
    }
  })();

  return () => {
    alive = false;
  };
}, [gen]);

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setLoading(true);

        const cached = localStorage.getItem(CACHE_KEY_LIST);
        if (cached) {
          const arr = JSON.parse(cached);
          if (alive && Array.isArray(arr)) setMoves(arr);
        }

        const fresh = await fetchMoveList();
        if (!alive) return;
        setMoves(fresh);
        localStorage.setItem(CACHE_KEY_LIST, JSON.stringify(fresh));
      } catch (e) {
        console.error(e);
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  const labelFor = (m) => {
  const de = nameDeCache[m.name];
  return (de || m.name || "").trim();
};

const filtered = useMemo(() => {
  const s = String(query || "").trim().toLowerCase();

  let arr = moves;
if (allowedSet && allowedSet.size > 0) {
  arr = arr.filter((m) => allowedSet.has(m.name));
}

  // Filter
  if (s) {
    arr = moves.filter((m) =>
      labelFor(m).toLowerCase().includes(s) ||
      String(m.name || "").includes(s)
    );
  }

  // Sortieren nach deutschem Namen
  const sorted = [...arr].sort((a, b) =>
    labelFor(a).localeCompare(labelFor(b), "de", { sensitivity: "base" })
  );

  return sorted.slice(0, s ? 600 : 250);
}, [moves, query, nameDeCache, allowedSet]);


  const pageBg = `radial-gradient(circle at 10% 0%, rgba(255,0,150,0.18) 0%, transparent 55%),
                  radial-gradient(circle at 85% 0%, rgba(0,255,200,0.16) 0%, transparent 55%),
                  radial-gradient(circle at 50% 20%, rgba(0,120,255,0.14) 0%, transparent 60%),
                  linear-gradient(to bottom, rgba(0,0,0,0.6), rgba(0,0,0,0.75)),
                  url(${dexBg})`;

  return (
    <div
      style={{
        minHeight: "100vh",
        padding: 16,
        color: "white",
        backgroundImage: pageBg,
        backgroundSize: "cover",
        backgroundPosition: "center",
        overflow: "hidden",
      }}
    >
      <style>{HIDE_SCROLL_CSS}</style>

      <div
        style={{
          maxWidth: 980,
          margin: "0 auto",
          borderRadius: 18,
          border: "1px solid rgba(255,255,255,0.14)",
          background: "rgba(0,0,0,0.50)",
          backdropFilter: "blur(8px)",
          padding: 14,
          boxShadow: "0 30px 90px rgba(0,0,0,0.55)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 950 }}>MoveDex</div>
            <div style={{ opacity: 0.82, marginTop: 2 }}>
              Suche • Klick öffnet Detail • Werte je nach Generation
            </div>
          </div>

          
          <button
            onClick={preloadAllGermanNames}
            disabled={deLoading || !moves.length}
            style={{
              padding: "10px 12px",
              borderRadius: 12,
              border: "1px solid rgba(255,255,255,0.18)",
              background: "rgba(255,255,255,0.08)",
              color: "white",
              fontWeight: 900,
              cursor: deLoading ? "default" : "pointer",
              opacity: deLoading ? 0.7 : 1,
            }}
            title="Lädt deutsche Attacken-Namen (einmalig, wird gecached)"
          >
            {deLoading ? `Deutsch… ${deDone}/${deTotal}` : "Alles auf Deutsch"}
          </button>

<button
            onClick={() => nav(-1)}
            style={{
              padding: "10px 12px",
              borderRadius: 12,
              border: "1px solid rgba(255,255,255,0.18)",
              background: "rgba(255,255,255,0.08)",
              color: "white",
              fontWeight: 900,
              cursor: "pointer",
            }}
          >
            Zurück
          </button>
        </div>

        <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ opacity: 0.85, fontWeight: 900 }}>Generation</div>
          <select
            value={gen}
            onChange={(e) => setGen(Number(e.target.value))}
            style={{
              padding: "10px 12px",
              borderRadius: 12,
              border: "1px solid rgba(255,255,255,0.18)",
              background: "rgba(10,10,16,0.7)",
              color: "white",
              fontWeight: 900,
            }}
          >
            {GEN_OPTIONS.map((g) => (
              <option key={g.value} value={g.value}>
                {g.label}
              </option>
            ))}
          </select>

          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Attacke suchen"
            style={{
              flex: 1,
              minWidth: 260,
              padding: "12px 12px",
              borderRadius: 12,
              border: "1px solid rgba(255,255,255,0.18)",
              background: "rgba(10,10,16,0.7)",
              color: "white",
              outline: "none",
              fontWeight: 750,
            }}
          />

          <button
            onClick={() => setQuery("")}
            style={{
              padding: "12px 12px",
              borderRadius: 12,
              border: "1px solid rgba(255,255,255,0.18)",
              background: "rgba(255,255,255,0.08)",
              color: "white",
              fontWeight: 900,
              cursor: "pointer",
            }}
          >
            Leeren
          </button>
        </div>

        <div style={{ marginTop: 10, opacity: 0.85 }}>
          {loading
  ? "Lade Attacken..."
  : `${(allowedSet?.size || 0)} Attacken geladen`}
        </div>

        <div className="hide-scroll" style={{ marginTop: 10, maxHeight: "65vh", overflowY: "auto", overflowX: "hidden", display: "grid", gap: 8 }}>
          {filtered.map((m) => {
            const de = nameDeCache[m.name];
            return (
              <button
                key={m.name}
                onClick={() => nav(`/move/${m.name}?gen=${encodeURIComponent(gen)}`)}
                style={{
                  textAlign: "left",
                  padding: "10px 12px",
                  borderRadius: 14,
                  border: "1px solid rgba(255,255,255,0.14)",
                  background: "rgba(255,255,255,0.06)",
                  color: "white",
                  cursor: "pointer",
                }}
                title="Attacke öffnen"
              >
                <div style={{ fontWeight: 950 }}>{de || m.name}</div>
                {de ? <div style={{ opacity: 0.65, fontSize: 12 }}>{m.name}</div> : null}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
