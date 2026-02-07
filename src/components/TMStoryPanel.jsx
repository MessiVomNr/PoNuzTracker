// src/components/TMStoryPanel.jsx
import React, { useMemo, useState } from "react";
import { TM_STORY_BY_GEN } from "../data/tmStory";

function norm(s) {
  return String(s || "").toLowerCase().trim();
}

export default function TMStoryPanel({ gen }) {
  const [q, setQ] = useState("");

  const list = TM_STORY_BY_GEN[gen] || [];

  const filtered = useMemo(() => {
    const nq = norm(q);
    return list
      .slice()
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      .filter((x) => {
        if (!nq) return true;
        return `${x.title} ${x.where} ${x.notes}`.toLowerCase().includes(nq);
      });
  }, [list, q]);

  return (
    <div>
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 10 }}>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="TM/Ort suchen…"
          style={{
            flex: 1,
            padding: "0.4rem",
            borderRadius: "5px",
            border: "1px solid #555",
            background: "#222",
            color: "white",
          }}
        />
        <div style={{ fontSize: "0.85rem", opacity: 0.85 }}>
          {filtered.length}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div style={{ opacity: 0.75, fontSize: "0.9rem" }}>
          Noch keine TM-Story-Daten für Gen {gen}.
        </div>
      ) : (
        filtered.map((x) => (
          <div key={`${x.order}-${x.title}`} style={{ marginBottom: "0.75rem" }}>
            <strong>{x.order}. {x.title}</strong>
            <br />
            <span style={{ fontSize: "0.85rem" }}>{x.where}</span>

            {(x.requirements?.badges?.length || x.requirements?.hms?.length) ? (
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6 }}>
                {(x.requirements.badges || []).map((b) => (
                  <span
                    key={b}
                    style={{
                      fontSize: 12,
                      padding: "2px 6px",
                      borderRadius: 999,
                      border: "1px solid rgba(79,172,254,0.35)",
                      background: "rgba(79,172,254,0.15)",
                    }}
                  >
                    Badge: {b}
                  </span>
                ))}
                {(x.requirements.hms || []).map((h) => (
                  <span
                    key={h}
                    style={{
                      fontSize: 12,
                      padding: "2px 6px",
                      borderRadius: 999,
                      border: "1px solid rgba(255,183,77,0.35)",
                      background: "rgba(255,183,77,0.15)",
                    }}
                  >
                    HM: {h}
                  </span>
                ))}
              </div>
            ) : null}

            {x.notes ? (
              <div style={{ fontSize: "0.8rem", opacity: 0.75, marginTop: 4 }}>{x.notes}</div>
            ) : null}
          </div>
        ))
      )}
    </div>
  );
}
