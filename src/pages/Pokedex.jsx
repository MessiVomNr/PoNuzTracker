// src/pages/Pokedex.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { pokedex as fullPokedex } from "../data/pokedex.js";
import dexBg from "../assets/DexBackground.png";
// Optional: wenn du die Helper schon hast, nutzen wir die
let dexIdToImageUrlFn = null;
try {
  // eslint-disable-next-line global-require
  dexIdToImageUrlFn = require("../utils/pokemonPool").dexIdToImageUrl;
} catch {
  dexIdToImageUrlFn = null;
}

function dexIdToImageUrl(dexId) {
  const id = Number(dexId);
  if (dexIdToImageUrlFn) return dexIdToImageUrlFn(id);
  // Fallback: Official Artwork (PokeAPI CDN)
  return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${id}.png`;
}

function getDexIdFromKey(key) {
  // "pokedex737" -> 737
  const m = String(key || "").match(/pokedex(\d+)/i);
  return m ? Number(m[1]) : null;
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

function typeIconUrl(typeKey) {
  const t = String(typeKey || "").toLowerCase();
  return `https://raw.githubusercontent.com/partywhale/pokemon-type-icons/master/icons/${t}.svg`;
}

// in-memory cache: dexId -> ["bug","electric"]
const typeCache = new Map();
async function fetchTypes(dexId) {
  const id = Number(dexId);
  if (!id) return [];
  if (typeCache.has(id)) return typeCache.get(id);

  try {
    const res = await fetch(`https://pokeapi.co/api/v2/pokemon/${id}`);
    if (!res.ok) return [];
    const data = await res.json();
    const types = (data?.types || [])
      .slice()
      .sort((a, b) => (a?.slot ?? 0) - (b?.slot ?? 0))
      .map((t) => String(t?.type?.name || "").toLowerCase())
      .filter(Boolean);

    typeCache.set(id, types);
    return types;
  } catch {
    return [];
  }
}

function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

export default function Pokedex() {
  const nav = useNavigate();

  const list = useMemo(() => {
    const entries = Object.entries(fullPokedex || {});
    const arr = entries
      .map(([k, name]) => ({ dexId: getDexIdFromKey(k), name }))
      .filter((x) => Number.isFinite(x.dexId))
      .sort((a, b) => a.dexId - b.dexId);

    return arr;
  }, []);

  const [idx, setIdx] = useState(0);
  const [query, setQuery] = useState("");
  const [typesByDex, setTypesByDex] = useState({}); // dexId -> ["bug","electric"]
  // ✅ Background/Body darf NICHT scrollen (nur der Dex-Container)
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

  // Initial: wenn query eine Dex-ID ist, springe dahin
  useEffect(() => {
  const qRaw = String(query || "").trim();
  if (!qRaw) return;

  const q = qRaw.toLowerCase();

  // 1) Nummern-Jump (wie jetzt)
  const asNum = Number(q);
  if (Number.isFinite(asNum) && asNum > 0) {
    const targetIdx = list.findIndex((p) => p.dexId === asNum);
    if (targetIdx >= 0) {
      setIdx(targetIdx);
      return;
    }
  }

  // 2) Name-Suche (Prefix bevorzugen, dann "contains")
  const norm = (s) =>
    String(s || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "") // accents raus
      .replace(/[^a-z0-9]/g, "");      // leerzeichen/sonderzeichen raus

  const qn = norm(q);

  // Prefix
  let hit = list.findIndex((p) => norm(p.name).startsWith(qn));

  // Fallback: contains
  if (hit < 0) hit = list.findIndex((p) => norm(p.name).includes(qn));

  if (hit >= 0) setIdx(hit);
}, [query, list]);


  const current = list[idx] || null;

  // Lade Typen nur für die sichtbaren 7 (idx-3..idx+3)
  useEffect(() => {
    let alive = true;

    async function run() {
      const ids = [];
      for (let d = -3; d <= 3; d++) {
        const p = list[idx + d];
        if (p?.dexId) ids.push(p.dexId);
      }

      const missing = ids.filter((id) => !typesByDex[id]);
      if (missing.length === 0) return;

      const results = await Promise.all(
        missing.map(async (id) => [id, await fetchTypes(id)])
      );

      if (!alive) return;
      setTypesByDex((prev) => {
        const next = { ...prev };
        for (const [id, types] of results) next[id] = types;
        return next;
      });
    }

    if (list.length) run();
    return () => {
      alive = false;
    };
  }, [idx, list, typesByDex]);

  // Scroll / Keyboard
  const lockRef = useRef(false);

  function step(delta) {
    setIdx((v) => clamp(v + delta, 0, list.length - 1));
  }

  function onWheel(e) {
    // nur 1 Step pro Wheel-Impulse
    if (lockRef.current) return;
    const dy = e.deltaY || 0;
    if (Math.abs(dy) < 8) return;

    lockRef.current = true;
    step(dy > 0 ? 1 : -1);

    window.setTimeout(() => {
      lockRef.current = false;
    }, 120);
  }

  // Touch swipe
  const touchRef = useRef({ y: 0 });
  function onTouchStart(e) {
    touchRef.current.y = e.touches?.[0]?.clientY ?? 0;
  }
  function onTouchEnd(e) {
    const y2 = e.changedTouches?.[0]?.clientY ?? 0;
    const y1 = touchRef.current.y ?? 0;
    const dy = y2 - y1;
    if (Math.abs(dy) < 25) return;
    step(dy < 0 ? 1 : -1);
  }

  // Keyboard
  useEffect(() => {
    function onKey(e) {
      if (e.key === "ArrowDown") step(1);
      if (e.key === "ArrowUp") step(-1);
      if (e.key === "PageDown") step(5);
      if (e.key === "PageUp") step(-5);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [list.length]);

    const page = {
  height: "100vh",
  overflow: "hidden",
  padding: 16,
  color: "white",
  backgroundImage: `url(${dexBg})`,
  backgroundSize: "cover",
  backgroundPosition: "center",
  backgroundRepeat: "no-repeat",
  backgroundAttachment: "fixed",
};


  const shell = {
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(0, 0, 0, 0.46)",
    borderRadius: 16,
    padding: 14,
  };

  const btn = {
    padding: "10px 12px",
    borderRadius: 10,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(0,0,0,0.25)",
    color: "white",
    cursor: "pointer",
    fontWeight: 800,
  };

  const smallCard = (active) => ({
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "10px 12px",
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.12)",
    background: active ? "rgba(0,0,0,0.35)" : "rgba(0,0,0,0.18)",
    opacity: active ? 1 : 0.7,
    transform: active ? "scale(1.02)" : "scale(1.0)",
    transition: "120ms ease",
    cursor: "pointer",
  });

  const typeIcon = {
    width: 28,
    height: 28,
    borderRadius: 8,
    padding: 3,
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.14)",
    filter: "drop-shadow(0 0 4px rgba(0,0,0,0.6))",
  };

  function renderSmall(p, isActive) {
    const types = typesByDex[p.dexId] || [];
    return (
      <div
        key={p.dexId}
        style={smallCard(isActive)}
        onClick={() => setIdx(list.findIndex((x) => x.dexId === p.dexId))}
        title="Auswählen"
      >
        <img
          src={dexIdToImageUrl(p.dexId)}
          alt={p.name}
          style={{ width: 45, height: 45, objectFit: "contain" }}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 900, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {p.name}
          </div>
          <div style={{ opacity: 0.7, fontSize: 12 }}>#{p.dexId}</div>
        </div>

        <div style={{ display: "flex", gap: 6 }}>
          {types.slice(0, 2).map((t) => (
            <img
              key={t}
              src={typeIconUrl(t)}
              alt={t}
              title={TYPE_LABELS_DE[t] ?? t}
              style={typeIcon}
              onError={(e) => {
                e.currentTarget.style.display = "none";
              }}
            />
          ))}
        </div>
      </div>
    );
  }

  const top3 = [list[idx - 3], list[idx - 2], list[idx - 1]].filter(Boolean);
  const bot3 = [list[idx + 1], list[idx + 2], list[idx + 3]].filter(Boolean);
  const bigTypes = current ? (typesByDex[current.dexId] || []) : [];

  return (
  <div style={page}>
    {/* Scrollbar verstecken (nur für den Dex-Scrollbereich) */}
    <style>{`
      .dex-scroll { scrollbar-width: none; -ms-overflow-style: none; }
      .dex-scroll::-webkit-scrollbar { display: none; }
    `}</style>

    {/* Zentrierter Pokédex-Bereich (das ist dein roter Rahmen) */}
    <div
      style={{
        width: "min(760px, 92vw)",   // <- hier schmaler/breiter machen
        margin: "0 auto",
        paddingTop: 12
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <h2 style={{ margin: 0 }}>Pokédex</h2>
        <div style={{ display: "flex", gap: 10 }}>
          <button style={btn} onClick={() => nav(-1)}>Zurück</button>
        </div>
      </div>

      {/* NUR der Pokédex scrollt, Background bleibt fix */}
      <div
        className="dex-scroll"
        style={{
          ...shell,
          marginTop: 12,
          maxHeight: "calc(100vh - 90px)", // <- Platz für Header oben
          overflowY: "auto",
        }}
      >

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Suche Name oder Dex-ID…"
            style={{
              flex: 1,
              minWidth: 220,
              padding: "10px 12px",
              borderRadius: 12,
              border: "1px solid rgba(255,255,255,0.14)",
              background: "rgba(0,0,0,0.25)",
              color: "white",
              outline: "none",
            }}
          />
          <button style={btn} onClick={() => step(-1)}>▲</button>
          <button style={btn} onClick={() => step(1)}>▼</button>
        </div>

        <div
          style={{
            marginTop: 14,
            display: "grid",
            gridTemplateColumns: "1fr",
            gap: 10,
          }}
          onWheel={onWheel}
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
        >
          {/* 3 oben */}
          {top3.map((p) => renderSmall(p, false))}

          {/* groß */}
          {current && (
            <div
              style={{
                borderRadius: 18,
                border: "1px solid rgba(255,255,255,0.14)",
                background: "rgba(0,0,0,0.35)",
                padding: 14,
                display: "grid",
                gridTemplateColumns: "140px 1fr",
                gap: 14,
                alignItems: "center",
              }}
            >
              <img
                src={dexIdToImageUrl(current.dexId)}
                alt={current.name}
                style={{ width: 150, height: 150, objectFit: "contain", cursor: "pointer" }}
                onClick={() => nav(`/pokemon/${current.dexId}`)}
                title="Öffnen"
              />

              <div style={{ minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
                  <div style={{ fontSize: 26, fontWeight: 950 }}>{current.name}</div>
                  <div style={{ opacity: 0.7, fontWeight: 800 }}>#{current.dexId}</div>
                </div>

                <div style={{ marginTop: 10, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  {bigTypes.map((t) => (
                    <img
                      key={t}
                      src={typeIconUrl(t)}
                      alt={t}
                      title={TYPE_LABELS_DE[t] ?? t}
                      style={{ ...typeIcon, width: 38, height: 38 }}
                      onError={(e) => {
                        e.currentTarget.style.display = "none";
                      }}
                    />
                  ))}
                </div>
                <div style={{ marginTop: 10 }}>
                  <button style={btn} onClick={() => nav(`/pokemon/${current.dexId}`)}>Info öffnen</button>
                </div>
              </div>
            </div>
          )}

          {/* 3 unten */}
          {bot3.map((p) => renderSmall(p, false))}
              </div> {/* Ende Shell */}
    </div>   {/* Ende Zentrier-Wrapper */}
  </div>     {/* Ende page */}
    </div>
  );
}
