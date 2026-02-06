// src/pages/TMStory.jsx
import React, { useMemo, useState } from "react";
import { tmStoryByGen } from "../data/tmStoryByGen";
import dexBg from "../assets/DexBackground.png";

const GEN_LABELS = {
  1: "Gen 1 (Rot/Blau/Gelb)",
  2: "Gen 2",
  3: "Gen 3",
  4: "Gen 4",
  5: "Gen 5",
  6: "Gen 6",
  7: "Gen 7 (Sonne/Mond)",
  72: "Gen 7.2 (Ultra)",
};

function BadgePill({ children }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "2px 8px",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 800,
        border: "1px solid rgba(255,255,255,0.18)",
        background: "rgba(255,255,255,0.08)",
        marginRight: 6,
        marginTop: 6,
      }}
    >
      {children}
    </span>
  );
}

export default function TMStory() {
  const [gen, setGen] = useState(1);

  const rows = useMemo(() => {
    const arr = tmStoryByGen[gen] || [];
    return [...arr].sort((a, b) => (a.order || 0) - (b.order || 0));
  }, [gen]);

  return (
    <div
      style={{
        minHeight: "100vh",
        padding: 16,
        color: "white",
        backgroundImage: `url(${dexBg})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      <div
        style={{
          maxWidth: 980,
          margin: "0 auto",
          borderRadius: 18,
          border: "1px solid rgba(255,255,255,0.14)",
          background: "rgba(0,0,0,0.55)",
          backdropFilter: "blur(8px)",
          padding: 14,
          boxShadow: "0 30px 90px rgba(0,0,0,0.55)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 950 }}>TM Story Liste</div>
            <div style={{ opacity: 0.8, marginTop: 2 }}>
              Chronologisch • Badge/HM Requirements • TM Nummer egal
            </div>
          </div>

          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <div style={{ opacity: 0.8, fontWeight: 800 }}>Generation</div>
            <select
              value={gen}
              onChange={(e) => setGen(Number(e.target.value))}
              style={{
                padding: "10px 12px",
                borderRadius: 12,
                border: "1px solid rgba(255,255,255,0.18)",
                background: "rgba(10,10,16,0.7)",
                color: "white",
                fontWeight: 800,
              }}
            >
              {Object.keys(GEN_LABELS).map((k) => (
                <option key={k} value={Number(k)}>
                  {GEN_LABELS[k]}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div style={{ marginTop: 12 }}>
          {rows.length === 0 ? (
            <div style={{ opacity: 0.8 }}>
              Noch keine Einträge für {GEN_LABELS[gen] || `Gen ${gen}`}.  
              Fülle `src/data/tmStoryByGen.js`.
            </div>
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              {rows.map((r) => (
                <div
                  key={`${r.order}-${r.title}`}
                  style={{
                    borderRadius: 14,
                    border: "1px solid rgba(255,255,255,0.14)",
                    background: "rgba(255,255,255,0.06)",
                    padding: 12,
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                    <div style={{ fontWeight: 950 }}>
                      {r.order}. {r.title}
                    </div>
                    <div style={{ opacity: 0.85, fontWeight: 800 }}>{r.tmName || "TM"}</div>
                  </div>

                  {(r.requirements?.badges?.length || r.requirements?.hms?.length) ? (
                    <div style={{ marginTop: 8 }}>
                      <div style={{ fontSize: 12, opacity: 0.75, fontWeight: 800 }}>Requirements</div>
                      <div style={{ display: "flex", flexWrap: "wrap" }}>
                        {(r.requirements?.badges || []).map((b) => (
                          <BadgePill key={`b-${b}`}>Badge: {b}</BadgePill>
                        ))}
                        {(r.requirements?.hms || []).map((h) => (
                          <BadgePill key={`h-${h}`}>HM: {h}</BadgePill>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {r.note ? <div style={{ marginTop: 8, opacity: 0.85 }}>{r.note}</div> : null}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
