// src/pages/Pokedex.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { pokedex as fullPokedex } from "../data/pokedex.js";
import dexBg from "../assets/DexBackground.png";
import { megaFormsByBaseDexId, specialFormsByBaseDexId } from "../data/megaForms";

// Optional Helper (für normale DexIds ok)
let dexIdToImageUrlFn = null;
try {
  dexIdToImageUrlFn = require("../utils/pokemonPool").dexIdToImageUrl;
} catch {
  dexIdToImageUrlFn = null;
}

function getDexIdFromKey(key) {
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

function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

export default function Pokedex() {
  const nav = useNavigate();

  // normal | withMegas | onlyMegas
  const [dexMode, setDexMode] = useState(() => localStorage.getItem("pokedex_mode_v1") || "normal");
  useEffect(() => localStorage.setItem("pokedex_mode_v1", dexMode), [dexMode]);

  const list = useMemo(() => {
    const baseEntries = Object.entries(fullPokedex || {});
    const baseArr = baseEntries
      .map(([k, name]) => ({ dexId: getDexIdFromKey(k), name, kind: "normal" }))
      .filter((x) => Number.isFinite(x.dexId))
      .sort((a, b) => a.dexId - b.dexId);

    const baseNameById = new Map(baseArr.map((p) => [p.dexId, p.name]));

    const megaArr = [];
    for (const [baseIdStr, forms] of Object.entries(megaFormsByBaseDexId || {})) {
      const baseId = Number(baseIdStr);
      const baseName = baseNameById.get(baseId) || `#${baseId}`;

      (forms || []).forEach((f) => {
        const label = String(f.label || "Mega").trim(); // "Mega", "Mega X", "Mega Y"
        const suffix = label === "Mega" ? "" : ` ${label.replace(/^Mega/i, "").trim()}`; // " X"/" Y"
        megaArr.push({
          dexId: Number(f.id), // PokeAPI pokemon-id der Form
          name: `Mega-${baseName}${suffix}`.trim(),
          kind: "mega",
          baseId,
          variantLabel: label,
        });
      });
    }

    const specialArr = [];
    for (const [baseIdStr, forms] of Object.entries(specialFormsByBaseDexId || {})) {
      const baseId = Number(baseIdStr);
      const baseName = baseNameById.get(baseId) || `#${baseId}`;

      (forms || []).forEach((f) => {
        const label = String(f.label || "Form").trim(); // "Proto"
        specialArr.push({
          dexId: Number(f.id),
          name: `${label}-${baseName}`.trim(),
          kind: "special",
          baseId,
          variantLabel: label,
        });
      });
    }

    if (dexMode === "onlyMegas") return [...megaArr, ...specialArr].sort((a, b) => a.dexId - b.dexId);
    if (dexMode === "withMegas") return [...baseArr, ...megaArr, ...specialArr];
    return baseArr;
  }, [dexMode]);

  const [idx, setIdx] = useState(0);
  const [query, setQuery] = useState("");

  // dexId -> { types: [], img: "" }
  const [infoByDex, setInfoByDex] = useState({});

  // Body nicht scrollen
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

  useEffect(() => {
    setIdx((v) => clamp(v, 0, Math.max(0, list.length - 1)));
  }, [list.length]);

  // Cache in-memory
  const apiCache = useMemo(() => new Map(), []);

  async function fetchInfo(dexId) {
    const id = Number(dexId);
    if (!id) return { types: [], img: "" };
    if (apiCache.has(id)) return apiCache.get(id);

    try {
      const res = await fetch(`https://pokeapi.co/api/v2/pokemon/${id}`);
      if (!res.ok) return { types: [], img: "" };
      const data = await res.json();

      const types = (data?.types || [])
        .slice()
        .sort((a, b) => (a?.slot ?? 0) - (b?.slot ?? 0))
        .map((t) => String(t?.type?.name || "").toLowerCase())
        .filter(Boolean);

      // ✅ HIER ist der entscheidende Fix:
      // Bild kommt DIREKT aus PokeAPI (passt 1:1 zur ID – auch bei Mega/Forms)
      const img =
        data?.sprites?.other?.["official-artwork"]?.front_default ||
        data?.sprites?.other?.home?.front_default ||
        data?.sprites?.front_default ||
        "";

      const packed = { types, img };
      apiCache.set(id, packed);
      return packed;
    } catch {
      return { types: [], img: "" };
    }
  }

  function fallbackImageUrl(dexId) {
    const id = Number(dexId);
    if (!Number.isFinite(id) || id <= 0) return "";
    if (dexIdToImageUrlFn && id < 10000) return dexIdToImageUrlFn(id);
    return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${id}.png`;
  }

  function getImageUrl(dexId) {
    const id = Number(dexId);
    const fromApi = infoByDex[id]?.img;
    return fromApi || fallbackImageUrl(id);
  }

  // Suche (Dex-ID oder Name)
  useEffect(() => {
    const qRaw = String(query || "").trim();
    if (!qRaw) return;

    const q = qRaw.toLowerCase();

    const asNum = Number(q);
    if (Number.isFinite(asNum) && asNum > 0) {
      const targetIdx = list.findIndex((p) => p.dexId === asNum);
      if (targetIdx >= 0) setIdx(targetIdx);
      return;
    }

    const norm = (s) =>
      String(s || "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]/g, "");

    const qn = norm(q);

    let hit = list.findIndex((p) => norm(p.name).startsWith(qn));
    if (hit < 0) hit = list.findIndex((p) => norm(p.name).includes(qn));
    if (hit >= 0) setIdx(hit);
  }, [query, list]);

  const current = list[idx] || null;

  // Preload Info (Typen + Bild) nur für sichtbare 7
  useEffect(() => {
    let alive = true;

    async function run() {
      const ids = [];
      for (let d = -3; d <= 3; d++) {
        const p = list[idx + d];
        if (p?.dexId) ids.push(p.dexId);
      }

      const missing = ids.filter((id) => !infoByDex[id]);
      if (missing.length === 0) return;

      const results = await Promise.all(missing.map(async (id) => [id, await fetchInfo(id)]));

      if (!alive) return;
      setInfoByDex((prev) => {
        const next = { ...prev };
        for (const [id, info] of results) next[id] = info;
        return next;
      });
    }

    if (list.length) run();
    return () => {
      alive = false;
    };
  }, [idx, list, infoByDex]);

  // Scroll / Keyboard
  const lockRef = useRef(false);
  function step(delta) {
    setIdx((v) => clamp(v + delta, 0, list.length - 1));
  }

  function onWheel(e) {
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
    whiteSpace: "nowrap",
  };

  const selectBtn = (active) => ({
    ...btn,
    background: active ? "rgba(0,0,0,0.40)" : "rgba(0,0,0,0.22)",
    border: active ? "1px solid rgba(255,255,255,0.22)" : "1px solid rgba(255,255,255,0.14)",
    opacity: active ? 1 : 0.85,
  });

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
    const types = infoByDex[p.dexId]?.types || [];
    return (
      <div
        key={p.dexId}
        style={smallCard(isActive)}
        onClick={() => setIdx(list.findIndex((x) => x.dexId === p.dexId))}
        title="Auswählen"
      >
        <img
          src={getImageUrl(p.dexId)}
          alt={p.name}
          style={{ width: 45, height: 45, objectFit: "contain" }}
          loading="lazy"
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 900, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {p.name}
          </div>
          <div style={{ opacity: 0.7, fontSize: 12 }}>
            #{p.dexId}
            {p.kind !== "normal" ? (
              <span style={{ marginLeft: 8, opacity: 0.85, fontWeight: 800 }}>
                {p.kind === "mega" ? "MEGA" : "FORM"}
              </span>
            ) : null}
          </div>
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
  const bigTypes = current ? infoByDex[current.dexId]?.types || [] : [];

  return (
    <div style={page}>
      <style>{`
        .dex-scroll { scrollbar-width: none; -ms-overflow-style: none; }
        .dex-scroll::-webkit-scrollbar { display: none; }
      `}</style>

      <div style={{ width: "min(760px, 92vw)", margin: "0 auto", paddingTop: 12 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <h2 style={{ margin: 0 }}>Pokédex</h2>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "flex-end" }}>
            <button style={btn} onClick={() => nav(-1)}>
              Zurück
            </button>
          </div>
        </div>

        <div
          className="dex-scroll"
          style={{ ...shell, marginTop: 12, maxHeight: "calc(100vh - 90px)", overflowY: "auto" }}
        >
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
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

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button style={selectBtn(dexMode === "normal")} onClick={() => setDexMode("normal")}>
                Normal
              </button>
              <button style={selectBtn(dexMode === "withMegas")} onClick={() => setDexMode("withMegas")}>
                Normal + Megas
              </button>
              <button style={selectBtn(dexMode === "onlyMegas")} onClick={() => setDexMode("onlyMegas")}>
                Nur Megas
              </button>
            </div>

            {/* keine ▲▼ Buttons */}
          </div>

          <div
            style={{ marginTop: 14, display: "grid", gridTemplateColumns: "1fr", gap: 10 }}
            onWheel={onWheel}
            onTouchStart={onTouchStart}
            onTouchEnd={onTouchEnd}
          >
            {top3.map((p) => renderSmall(p, false))}

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
                  src={getImageUrl(current.dexId)}
                  alt={current.name}
                  style={{ width: 150, height: 150, objectFit: "contain", cursor: "pointer" }}
                  onClick={() => nav(`/pokemon/${current.dexId}`)}
                  title="Öffnen"
                />

                <div style={{ minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
                    <div style={{ fontSize: 26, fontWeight: 950 }}>{current.name}</div>
                    <div style={{ opacity: 0.7, fontWeight: 800 }}>#{current.dexId}</div>
                    {current.kind !== "normal" && (
                      <div
                        style={{
                          marginLeft: 6,
                          padding: "4px 10px",
                          borderRadius: 999,
                          fontSize: 12,
                          fontWeight: 950,
                          border: "1px solid rgba(255,255,255,0.18)",
                          background: "rgba(255,255,255,0.06)",
                          opacity: 0.95,
                        }}
                      >
                        {current.kind === "mega" ? "MEGA" : "FORM"}
                      </div>
                    )}
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
                    <button style={btn} onClick={() => nav(`/pokemon/${current.dexId}`)}>
                      Info öffnen
                    </button>
                  </div>
                </div>
              </div>
            )}

            {bot3.map((p) => renderSmall(p, false))}
          </div>
        </div>
      </div>
    </div>
  );
}
