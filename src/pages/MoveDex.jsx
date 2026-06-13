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
  .hide-scroll {
    scrollbar-width: none;
    -ms-overflow-style: none;
  }

  .hide-scroll::-webkit-scrollbar {
    width: 0;
    height: 0;
    display: none;
  }

  .mdx-panel {
    border: 1px solid var(--pnt-border, rgba(137, 155, 184, 0.28)) !important;
    background:
      linear-gradient(180deg, rgba(10, 18, 33, 0.94), rgba(6, 12, 24, 0.92)) !important;
    border-radius: var(--pnt-radius, 14px);
    box-shadow:
      var(--pnt-shadow, 0 18px 48px rgba(0, 0, 0, 0.36)),
      inset 0 1px 0 rgba(255, 255, 255, 0.045);
    backdrop-filter: blur(10px);
  }

  .mdx-button {
    min-height: 42px;
    padding: 0 15px;
    border-radius: var(--pnt-radius-small, 8px);
    border: 1px solid rgba(100, 140, 215, 0.55) !important;
    background:
      linear-gradient(180deg, rgba(14, 30, 56, 0.96), rgba(9, 20, 39, 0.96)) !important;
    background-color: transparent !important;
    color: #f8fafc !important;
    cursor: pointer;
    font-weight: 950;
    white-space: nowrap;
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.04),
      0 10px 24px rgba(0, 0, 0, 0.18);
    transition:
      transform 0.15s ease,
      background 0.15s ease,
      border-color 0.15s ease,
      opacity 0.15s ease;
  }

  .mdx-button:hover:not(:disabled) {
    transform: translateY(-1px);
    border-color: rgba(140, 170, 230, 0.68) !important;
    background:
      linear-gradient(180deg, rgba(18, 38, 70, 0.96), rgba(10, 23, 44, 0.96)) !important;
    background-color: transparent !important;
    color: #ffffff !important;
  }

  .mdx-button:disabled {
    opacity: 0.5 !important;
    cursor: not-allowed;
    transform: none;
    background:
      linear-gradient(180deg, rgba(14, 30, 56, 0.7), rgba(9, 20, 39, 0.7)) !important;
    background-color: transparent !important;
    color: rgba(248, 250, 252, 0.62) !important;
  }

  .mdx-button-ghost {
    background:
      linear-gradient(180deg, rgba(11, 22, 40, 0.92), rgba(7, 15, 29, 0.92)) !important;
    background-color: transparent !important;
    color: #f8fafc !important;
  }

  .mdx-filter-row {
    margin-top: 14px;
    display: grid;
    grid-template-columns: 160px minmax(260px, 1fr) auto;
    gap: 10px;
    align-items: end;
  }

  .mdx-select,
  .mdx-input {
    width: 100%;
    min-height: 44px;
    box-sizing: border-box;
    padding: 10px 12px;
    border-radius: 10px;
    border: 1px solid rgba(137, 155, 184, 0.28) !important;
    background:
      linear-gradient(180deg, rgba(10, 19, 34, 0.96), rgba(8, 15, 28, 0.96)) !important;
    background-color: transparent !important;
    color: #f8fafc !important;
    outline: none;
    font-weight: 900;
    font-size: 14px;
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.035);
  }

  .mdx-select {
    cursor: pointer;
  }

  .mdx-select option {
    background: #08111f;
    color: #f8fafc;
    font-weight: 900;
  }

  .mdx-input::placeholder {
    color: rgba(235, 241, 250, 0.46);
  }

  .mdx-select:focus,
  .mdx-input:focus {
    border-color: rgba(96, 165, 250, 0.72) !important;
    box-shadow:
      0 0 0 3px rgba(96, 165, 250, 0.14),
      inset 0 1px 0 rgba(255, 255, 255, 0.035) !important;
  }

  .mdx-move-list {
    margin-top: 12px;
    max-height: 65vh;
    overflow-y: auto;
    overflow-x: hidden;
    display: grid;
    gap: 8px;
    padding: 2px;
    box-sizing: border-box;
  }

  .mdx-move-row {
    width: 100%;
    box-sizing: border-box;
    text-align: left;
    padding: 12px 14px;
    border-radius: var(--pnt-radius, 14px);
    border: 1px solid rgba(137, 155, 184, 0.18) !important;
    background:
      linear-gradient(180deg, rgba(13, 24, 42, 0.76), rgba(9, 17, 31, 0.72)) !important;
    background-color: transparent !important;
    color: #f8fafc !important;
    cursor: pointer;
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.035);
    transition:
      transform 0.15s ease,
      background 0.15s ease,
      border-color 0.15s ease;
  }

  .mdx-move-row:hover {
    transform: translateY(-1px);
    border-color: rgba(160, 178, 210, 0.34) !important;
    background:
      linear-gradient(180deg, rgba(16, 31, 56, 0.86), rgba(10, 22, 42, 0.82)) !important;
    background-color: transparent !important;
    color: #ffffff !important;
  }

  .mdx-move-row div {
    color: inherit;
  }

  .mdx-move-row div:first-child {
    color: #f8fafc !important;
  }

  .mdx-move-row div:last-child {
    color: rgba(235, 241, 250, 0.62) !important;
  }

  @media (max-width: 760px) {
    .mdx-filter-row {
      grid-template-columns: 1fr;
    }
  }
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
    arr = arr.filter((m) =>
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


  const pageBg = `
    radial-gradient(circle at 50% 0%, rgba(52, 211, 153, 0.13), transparent 34%),
    radial-gradient(circle at 0% 25%, rgba(96, 165, 250, 0.12), transparent 38%),
    linear-gradient(180deg, rgba(5, 10, 24, 0.22), rgba(5, 10, 24, 0.78)),
    url(${dexBg})
  `;

  return (
    <div
      style={{
        height: "100vh",
        minHeight: "100vh",
        padding: 18,
        boxSizing: "border-box",
        color: "var(--pnt-text, white)",
        backgroundImage: pageBg,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
        backgroundAttachment: "fixed",
        overflow: "hidden",
      }}
    >
      <style>{HIDE_SCROLL_CSS}</style>

      <div
        className="mdx-panel"
        style={{
          width: "min(980px, 96vw)",
          maxHeight: "calc(100vh - 36px)",
          margin: "0 auto",
          padding: 16,
          boxSizing: "border-box",
          overflow: "hidden",
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
            className="mdx-button"
            onClick={preloadAllGermanNames}
            disabled={deLoading || !moves.length}
            title="Lädt deutsche Attacken-Namen (einmalig, wird gecached)"
          >
            {deLoading ? `Deutsch… ${deDone}/${deTotal}` : "Alles auf Deutsch"}
          </button>

          <button className="mdx-button mdx-button-ghost" onClick={() => nav(-1)}>
            Zurück
          </button>
        </div>

        <div className="mdx-filter-row">
          <div>
            <div style={{ opacity: 0.82, fontWeight: 950, fontSize: 13, marginBottom: 6 }}>
              Generation
            </div>

            <select
              className="mdx-select"
              value={gen}
              onChange={(e) => setGen(Number(e.target.value))}
            >
              {GEN_OPTIONS.map((g) => (
                <option key={g.value} value={g.value}>
                  {g.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <div style={{ opacity: 0.82, fontWeight: 950, fontSize: 13, marginBottom: 6 }}>
              Suche
            </div>

            <input
              className="mdx-input"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Attacke suchen"
            />
          </div>

          <button className="mdx-button mdx-button-ghost" onClick={() => setQuery("")}>
            Leeren
          </button>
        </div>

        <div
          style={{
            marginTop: 12,
            color: "var(--pnt-text-muted)",
            fontSize: 13,
            fontWeight: 850,
          }}
        >
          {loading
            ? "Lade Attacken..."
            : `${(allowedSet?.size || 0)} Attacken geladen`}
          {allowedLoading ? " · Gen-Filter lädt..." : ""}
          {deError ? ` · ${deError}` : ""}
        </div>

        <div className="hide-scroll mdx-move-list">
          {filtered.map((m) => {
            const de = nameDeCache[m.name];
            return (
              <button
                key={m.name}
                className="mdx-move-row"
                onClick={() => nav(`/move/${m.name}?gen=${encodeURIComponent(gen)}`)}
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
