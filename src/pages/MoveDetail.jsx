// src/pages/MoveDetail.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import dexBg from "../assets/DexBackground.png";

const CACHE_KEY_NAMES_DE = "movedex_names_de_v1";

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

function genNameToNum(genName) {
  const g = String(genName || "").toLowerCase();
  if (g === "generation-i") return 1;
  if (g === "generation-ii") return 2;
  if (g === "generation-iii") return 3;
  if (g === "generation-iv") return 4;
  if (g === "generation-v") return 5;
  if (g === "generation-vi") return 6;
  if (g === "generation-vii") return 7;
  if (g === "generation-viii") return 8;
  if (g === "generation-ix") return 9;
  return null;
}

// Version groups → Gen
const VERSION_GROUP_TO_GEN = {
  "red-blue": 1,
  yellow: 1,
  "gold-silver": 2,
  crystal: 2,
  "ruby-sapphire": 3,
  emerald: 3,
  "firered-leafgreen": 3,
  "diamond-pearl": 4,
  platinum: 4,
  "heartgold-soulsilver": 4,
  "black-white": 5,
  "black-2-white-2": 5,
  "x-y": 6,
  "omega-ruby-alpha-sapphire": 6,
  "sun-moon": 7,
  "ultra-sun-ultra-moon": 7,
};

// Referenz-VersionGroup pro Gen (für Flavor-Text Auswahl)
const GEN_VERSION_GROUP = {
  1: "yellow",
  2: "crystal",
  3: "emerald",
  4: "platinum",
  5: "black-2-white-2",
  6: "omega-ruby-alpha-sapphire",
  7: "ultra-sun-ultra-moon",
  72: "ultra-sun-ultra-moon",
};

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

// Gen 1–3 phys/spez Split über Typ
const PHYSICAL_TYPES_PRE4 = new Set([
  "normal",
  "fighting",
  "flying",
  "poison",
  "ground",
  "rock",
  "bug",
  "ghost",
  "steel",
]);
const SPECIAL_TYPES_PRE4 = new Set([
  "fire",
  "water",
  "grass",
  "electric",
  "psychic",
  "ice",
  "dragon",
  "dark",
]);

const MOVE_DETAIL_CSS = `
  .mdetail-panel {
    border: 1px solid var(--pnt-border, rgba(137, 155, 184, 0.28)) !important;
    background:
      linear-gradient(180deg, rgba(10, 18, 33, 0.94), rgba(6, 12, 24, 0.92)) !important;
    border-radius: var(--pnt-radius, 14px);
    box-shadow:
      var(--pnt-shadow, 0 18px 48px rgba(0, 0, 0, 0.36)),
      inset 0 1px 0 rgba(255, 255, 255, 0.045);
    backdrop-filter: blur(10px);
  }

  .mdetail-button {
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
      border-color 0.15s ease;
  }

  .mdetail-button:hover {
    transform: translateY(-1px);
    border-color: rgba(140, 170, 230, 0.68) !important;
    background:
      linear-gradient(180deg, rgba(18, 38, 70, 0.96), rgba(10, 23, 44, 0.96)) !important;
    color: #ffffff !important;
  }

  .mdetail-select {
    min-height: 42px;
    padding: 0 13px;
    border-radius: var(--pnt-radius-small, 8px);
    border: 1px solid rgba(137, 155, 184, 0.28) !important;
    background:
      linear-gradient(180deg, rgba(10, 19, 34, 0.96), rgba(8, 15, 28, 0.96)) !important;
    background-color: transparent !important;
    color: #f8fafc !important;
    cursor: pointer;
    outline: none;
    font-weight: 950;
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.035);
  }

  .mdetail-select:focus {
    border-color: rgba(96, 165, 250, 0.72) !important;
    box-shadow:
      0 0 0 3px rgba(96, 165, 250, 0.14),
      inset 0 1px 0 rgba(255, 255, 255, 0.035) !important;
  }

  .mdetail-select option {
    background: #08111f;
    color: #f8fafc;
    font-weight: 900;
  }

  .mdetail-card {
    border-radius: var(--pnt-radius, 14px);
    border: 1px solid rgba(137, 155, 184, 0.18) !important;
    background:
      linear-gradient(180deg, rgba(13, 24, 42, 0.68), rgba(9, 17, 31, 0.66)) !important;
    color: var(--pnt-text, #f8fafc);
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.035);
  }

  .mdetail-scroll {
    scrollbar-width: none;
    -ms-overflow-style: none;
  }

  .mdetail-scroll::-webkit-scrollbar {
    width: 0;
    height: 0;
    display: none;
  }

  .mdetail-stat-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 10px;
  }

  @media (max-width: 760px) {
    .mdetail-stat-grid {
      grid-template-columns: 1fr 1fr;
    }
  }

  @media (max-width: 520px) {
    .mdetail-stat-grid {
      grid-template-columns: 1fr;
    }
  }
`;

function useQuery() {
  const { search } = useLocation();
  return useMemo(() => new URLSearchParams(search), [search]);
}

function getLocalizedName(namesArr, lang = "de") {
  const arr = Array.isArray(namesArr) ? namesArr : [];
  const hit = arr.find((n) => n?.language?.name === lang);
  return hit?.name || null;
}

function getLocalizedEffect(effectEntries, lang = "de") {
  const arr = Array.isArray(effectEntries) ? effectEntries : [];
  const hit = arr.find((e) => e?.language?.name === lang);
  return hit?.short_effect || hit?.effect || null;
}

function normalizeText(s) {
  return String(s || "")
    .replace(/\f/g, " ")
    .replace(/\n/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function applyEffectTokens(text, move) {
  let out = String(text || "");
  if (move?.effect_chance != null) out = out.replace(/\$effect_chance/g, String(move.effect_chance));
  return out;
}

function pickFlavorText({ flavorTextEntries, lang, preferVersionGroup }) {
  const arr = Array.isArray(flavorTextEntries) ? flavorTextEntries : [];

  // 1) exakt passende VersionGroup + Sprache
  if (preferVersionGroup) {
    const hit = arr.find(
      (x) =>
        x?.language?.name === lang &&
        x?.version_group?.name === preferVersionGroup &&
        x?.flavor_text
    );
    if (hit?.flavor_text) return hit.flavor_text;
  }

  // 2) irgendeine der Sprache
  const any = arr.find((x) => x?.language?.name === lang && x?.flavor_text);
  if (any?.flavor_text) return any.flavor_text;

  return null;
}

function safeLoadNameCache() {
  try {
    const v = JSON.parse(localStorage.getItem(CACHE_KEY_NAMES_DE) || "{}");
    return v && typeof v === "object" ? v : {};
  } catch {
    return {};
  }
}

function safeSaveNameCache(obj) {
  try {
    localStorage.setItem(CACHE_KEY_NAMES_DE, JSON.stringify(obj || {}));
  } catch {
    // ignore
  }
}

function getDamageClassLabelDe(dc) {
  const v = String(dc || "").toLowerCase();
  if (v === "physical") return "Physisch";
  if (v === "special") return "Speziell";
  return "Status";
}

function resolveDamageClassForGen({ gen, typeName, apiDamageClass }) {
  const dc = String(apiDamageClass || "").toLowerCase();
  if (dc === "status") return "status";

  if (gen <= 3) {
    const t = String(typeName || "").toLowerCase();
    if (PHYSICAL_TYPES_PRE4.has(t)) return "physical";
    if (SPECIAL_TYPES_PRE4.has(t)) return "special";
    return dc || "physical";
  }

  return dc || "status";
}

function resolveValuesForGen(move, gen) {
  const selectedGen = (Number(gen) === 72 ? 7 : Number(gen)) || 7;

  const base = {
    type: move?.type?.name || null,
    power: move?.power ?? null,
    accuracy: move?.accuracy ?? null,
    pp: move?.pp ?? null,
    effect_entries: move?.effect_entries || [],
    versionGroup: null,
    usedPast: false,
    snapGen: 99,
  };

  const past = Array.isArray(move?.past_values) ? move.past_values : [];
  const snaps = [];

  for (const p of past) {
    const vg = p?.version_group?.name;
    const vgGen = VERSION_GROUP_TO_GEN[String(vg || "")];
    if (!vgGen) continue;

    snaps.push({
      type: p?.type?.name || base.type,
      power: p?.power ?? base.power,
      accuracy: p?.accuracy ?? base.accuracy,
      pp: p?.pp ?? base.pp,
      effect_entries: p?.effect_entries || base.effect_entries,
      versionGroup: vg,
      usedPast: true,
      snapGen: vgGen,
    });
  }

  if (snaps.length > 0) {
    const candidates = snaps
      .filter((s) => s.snapGen <= selectedGen)
      .sort((a, b) => b.snapGen - a.snapGen);
    if (candidates.length > 0) return { ...candidates[0], selectedGen };

    const earliest = snaps.sort((a, b) => a.snapGen - b.snapGen)[0];
    return { ...earliest, selectedGen };
  }

  return { ...base, selectedGen };
}

export default function MoveDetail() {
  const nav = useNavigate();
  const q = useQuery();
  const { moveKey } = useParams();

  const [gen, setGen] = useState(() => {
    const v = Number(q.get("gen"));
    return Number.isFinite(v) && v ? v : 6;
  });

  const [loading, setLoading] = useState(true);
  const [move, setMove] = useState(null);
  const [introGen, setIntroGen] = useState(null);
  const [err, setErr] = useState("");

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
    let alive = true;

    (async () => {
      try {
        setErr("");
        setLoading(true);

        const res = await fetch(`https://pokeapi.co/api/v2/move/${encodeURIComponent(moveKey)}`);
        if (!res.ok) throw new Error("Attacke nicht gefunden");
        const data = await res.json();
        if (!alive) return;

        setMove(data);

        const ig = genNameToNum(data?.generation?.name) || 1;
        setIntroGen(ig);

        const selected = (Number(gen) === 72 ? 7 : Number(gen)) || 7;
        if (selected < ig) setGen(ig);

        // deutschen Namen cachen
        const deName = getLocalizedName(data?.names, "de");
        if (deName) {
          const cache = safeLoadNameCache();
          if (cache[moveKey] !== deName) {
            cache[moveKey] = deName;
            safeSaveNameCache(cache);
          }
        }
      } catch (e) {
        if (!alive) return;
        setErr(String(e?.message || e));
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [moveKey]);

  const pageBg = `
    radial-gradient(circle at 50% 0%, rgba(52, 211, 153, 0.13), transparent 34%),
    radial-gradient(circle at 0% 25%, rgba(96, 165, 250, 0.12), transparent 38%),
    linear-gradient(180deg, rgba(5, 10, 24, 0.22), rgba(5, 10, 24, 0.78)),
    url(${dexBg})
  `;

  const derived = useMemo(() => {
    if (!move) return null;

    const applied = resolveValuesForGen(move, gen);
    const selectedGen = applied.selectedGen;

    const typeName = applied.type;
    const apiDamageClass = move?.damage_class?.name || "status";
    const resolvedClass = resolveDamageClassForGen({ gen: selectedGen, typeName, apiDamageClass });

    // Flavor-Text VersionGroup: wenn past_values genutzt wurden → dessen VG, sonst Gen-Referenz
    const preferVg =
      (applied.usedPast && applied.versionGroup) ||
      GEN_VERSION_GROUP[selectedGen] ||
      GEN_VERSION_GROUP[7];

    const flavorDeRaw = pickFlavorText({
      flavorTextEntries: move?.flavor_text_entries,
      lang: "de",
      preferVersionGroup: preferVg,
    });

    const flavorEnRaw = pickFlavorText({
      flavorTextEntries: move?.flavor_text_entries,
      lang: "en",
      preferVersionGroup: preferVg,
    });

    const effectDeRaw = getLocalizedEffect(applied.effect_entries, "de");
    const effectEnRaw = getLocalizedEffect(applied.effect_entries, "en");

    const bestRaw =
      flavorDeRaw ||
      effectDeRaw ||
      flavorEnRaw ||
      effectEnRaw ||
      null;

    const effectText =
      bestRaw ? normalizeText(applyEffectTokens(bestRaw, move)) : "Keine Beschreibung verfügbar.";

    return {
      selectedGen,
      preferVg,
      deName: getLocalizedName(move.names, "de") || move.name,
      typeName,
      typeDe: TYPE_LABELS_DE[String(typeName || "").toLowerCase()] || String(typeName || "-"),
      power: applied.power,
      accuracy: applied.accuracy,
      pp: applied.pp,
      damageClass: resolvedClass,
      damageClassDe: getDamageClassLabelDe(resolvedClass),
      effectDe: effectText || "Keine Beschreibung verfügbar.",
      usedPast: applied.usedPast,
      versionGroup: applied.versionGroup,
    };
  }, [move, gen]);

  const availableGenOptions = useMemo(() => {
    const ig = introGen || 1;
    return GEN_OPTIONS.filter((o) => {
      const ng = (Number(o.value) === 72 ? 7 : Number(o.value)) || 7;
      return ng >= ig && ng <= 7;
    });
  }, [introGen]);

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
      <style>{MOVE_DETAIL_CSS}</style>
      <div
        className="mdetail-panel"
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
            <div style={{ fontSize: 22, fontWeight: 950 }}>
              {derived?.deName || moveKey}
            </div>
            <div style={{ opacity: 0.8, marginTop: 2 }}>
              Key: {moveKey}
            </div>
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", justifyContent: "flex-end" }}>
            <div style={{ opacity: 0.82, fontWeight: 950, fontSize: 13 }}>Generation</div>

            <select
              className="mdetail-select"
              value={gen}
              onChange={(e) => {
                const next = Number(e.target.value);
                setGen(next);
                const url = `/move/${encodeURIComponent(moveKey)}?gen=${encodeURIComponent(next)}`;
                nav(url, { replace: true });
              }}
            >
              {availableGenOptions.map((g) => (
                <option key={g.value} value={g.value}>
                  {g.label}
                </option>
              ))}
            </select>

            <button className="mdetail-button" onClick={() => nav("/movedex")}>
              MoveDex
            </button>

            <button className="mdetail-button" onClick={() => nav(-1)}>
              Zurück
            </button>
          </div>
        </div>

        <div style={{ marginTop: 12 }}>
          {loading && <div style={{ opacity: 0.85 }}>Lade Attacke…</div>}
          {err && <div style={{ opacity: 0.95 }}>Fehler: {err}</div>}
        </div>

        {derived && !loading && !err ? (
          <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
            <div
              className="mdetail-card"
              style={{
                padding: 14,
              }}
            >
              <div style={{ fontWeight: 950, marginBottom: 6 }}>Werte</div>

              <div className="mdetail-stat-grid">
                <div>
                  <div style={{ opacity: 0.7, fontSize: 12 }}>Typ</div>
                  <div style={{ fontWeight: 900 }}>{derived.typeDe}</div>
                </div>

                <div>
                  <div style={{ opacity: 0.7, fontSize: 12 }}>Kategorie</div>
                  <div style={{ fontWeight: 900 }}>{derived.damageClassDe}</div>
                </div>

                <div>
                  <div style={{ opacity: 0.7, fontSize: 12 }}>AP</div>
                  <div style={{ fontWeight: 900 }}>{derived.pp ?? "-"}</div>
                </div>

                <div>
                  <div style={{ opacity: 0.7, fontSize: 12 }}>Stärke</div>
                  <div style={{ fontWeight: 900 }}>{derived.power ?? "-"}</div>
                </div>

                <div>
                  <div style={{ opacity: 0.7, fontSize: 12 }}>Genauigkeit</div>
                  <div style={{ fontWeight: 900 }}>{derived.accuracy ?? "-"}</div>
                </div>
              </div>
            </div>

            <div
              className="mdetail-card mdetail-scroll"
              style={{
                padding: 14,
                maxHeight: "38vh",
                overflow: "auto",
              }}
            >
              <div style={{ fontWeight: 950, marginBottom: 6 }}>Effekt</div>
              <div style={{ opacity: 0.92 }}>{derived.effectDe}</div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
