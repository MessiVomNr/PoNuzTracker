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

// Version groups die wir nutzen → Gen Nummer
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


// “Referenz”-Versiongruppe pro Gen (für past_values)
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

  // Base = aktuelle Werte (neueste)
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

  // Falls es Snapshots gibt: wähle den Snapshot, dessen Gen <= selectedGen und am nächsten dran ist
  if (snaps.length > 0) {
    const candidates = snaps.filter((s) => s.snapGen <= selectedGen).sort((a, b) => b.snapGen - a.snapGen);
    if (candidates.length > 0) return { ...candidates[0], selectedGen };
    // sonst (sehr selten): frühester Snapshot > selectedGen
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

  // ✅ wie Pokédex: Body nicht scrollen
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
        // Wenn ausgewählte Gen kleiner ist als Einführungs-Gen: hochsetzen
        const selected = (Number(gen) === 72 ? 7 : Number(gen)) || 7;
        if (selected < ig) setGen(ig);


        // ✅ deutschen Namen in Cache speichern (damit MoveDex-Liste später deutsch kann)
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

  const pageBg = `radial-gradient(circle at 10% 0%, rgba(255,0,150,0.18) 0%, transparent 55%),
                  radial-gradient(circle at 85% 0%, rgba(0,255,200,0.16) 0%, transparent 55%),
                  radial-gradient(circle at 50% 20%, rgba(0,120,255,0.14) 0%, transparent 60%),
                  linear-gradient(to bottom, rgba(0,0,0,0.6), rgba(0,0,0,0.75)),
                  url(${dexBg})`;

  const derived = useMemo(() => {
    if (!move) return null;

    const applied = resolveValuesForGen(move, gen);
    const typeName = applied.type;
    const apiDamageClass = move?.damage_class?.name || "status";
    const resolvedClass = resolveDamageClassForGen({ gen, typeName, apiDamageClass });

    return {
      deName: getLocalizedName(move.names, "de") || move.name,
      typeName,
      typeDe: TYPE_LABELS_DE[String(typeName || "").toLowerCase()] || String(typeName || "-"),
      power: applied.power,
      accuracy: applied.accuracy,
      pp: applied.pp,
      damageClass: resolvedClass,
      damageClassDe: getDamageClassLabelDe(resolvedClass),
      effectDe:
        getLocalizedEffect(applied.effect_entries, "de") ||
        getLocalizedEffect(applied.effect_entries, "en") ||
        "Keine Beschreibung verfügbar.",
      usedPast: applied.usedPast,
      versionGroup: applied.versionGroup,
    };
  }, [move, gen]);

  const availableGenOptions = useMemo(() => {
    const ig = introGen || 1;
    return GEN_OPTIONS.filter((o) => {
      const ng = (Number(o.value) === 72 ? 7 : Number(o.value)) || 7;
      return ng >= ig && ng <= 7; // App: bis Gen 7/USUM
    });
  }, [introGen]);

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
            <div style={{ fontSize: 22, fontWeight: 950 }}>
              {derived?.deName || moveKey}
            </div>
            <div style={{ opacity: 0.8, marginTop: 2 }}>
              Key: {moveKey}
            </div>
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <div style={{ opacity: 0.85, fontWeight: 900 }}>Generation</div>
            <select
              value={gen}
              onChange={(e) => {
                const next = Number(e.target.value);
                setGen(next);
                // URL nicht zwingend ändern, aber nice: so bleibt’s sharebar
                const url = `/move/${encodeURIComponent(moveKey)}?gen=${encodeURIComponent(next)}`;
                nav(url, { replace: true });
              }}
              style={{
                padding: "10px 12px",
                borderRadius: 12,
                border: "1px solid rgba(255,255,255,0.18)",
                background: "rgba(10,10,16,0.7)",
                color: "white",
                fontWeight: 900,
              }}
            >
              {availableGenOptions.map((g) => (
                <option key={g.value} value={g.value}>
                  {g.label}
                </option>
              ))}
            </select>

            <button
              onClick={() => nav("/movedex")}
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
              MoveDex
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
        </div>

        <div style={{ marginTop: 12 }}>
          {loading && <div style={{ opacity: 0.85 }}>Lade Attacke…</div>}
          {err && <div style={{ opacity: 0.95 }}>Fehler: {err}</div>}
        </div>

        {derived && !loading && !err ? (
          <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
            <div
              style={{
                borderRadius: 14,
                border: "1px solid rgba(255,255,255,0.14)",
                background: "rgba(255,255,255,0.06)",
                padding: 12,
              }}
            >
              <div style={{ fontWeight: 950, marginBottom: 6 }}>Werte</div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 10 }}>
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

                <div>
                  <div style={{ opacity: 0.7, fontSize: 12 }}>Quelle</div>
                  <div style={{ fontWeight: 900 }}>
                    {derived.usedPast ? `Gen-Override (${derived.versionGroup})` : "Aktuelle Werte"}
                  </div>
                </div>
              </div>
            </div>

            <div
              style={{
                borderRadius: 14,
                border: "1px solid rgba(255,255,255,0.14)",
                background: "rgba(255,255,255,0.06)",
                padding: 12,
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
