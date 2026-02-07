// src/pages/TMStory.jsx
import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { TM_STORY_BY_GEN, TM_STORY_GEN_OPTIONS } from "../data/tmStory";

const hideScrollbar = {
  scrollbarWidth: "none",
  msOverflowStyle: "none",
};
const hideScrollbarWebkit = `
  .tmstory-scroll::-webkit-scrollbar { width: 0px; height: 0px; }
`;

function norm(s) {
  return String(s || "").toLowerCase().trim();
}

export default function TMStory() {
  const nav = useNavigate();

  const [gen, setGen] = useState(1);
  const [q, setQ] = useState("");
  const [onlyAvailable, setOnlyAvailable] = useState(false);

  // Minimal UI für Requirements-Check (später kannst du das mit Run-State koppeln)
  const [ownedBadges, setOwnedBadges] = useState([]);
  const [ownedHms, setOwnedHms] = useState([]);

  const list = TM_STORY_BY_GEN[gen] || [];

  const allBadges = useMemo(() => {
    const set = new Set();
    list.forEach((x) => (x.requirements?.badges || []).forEach((b) => set.add(b)));
    return Array.from(set);
  }, [list]);

  const allHms = useMemo(() => {
    const set = new Set();
    list.forEach((x) => (x.requirements?.hms || []).forEach((h) => set.add(h)));
    return Array.from(set);
  }, [list]);

  const filtered = useMemo(() => {
    const nq = norm(q);

    return list
      .slice()
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      .filter((x) => {
        if (!nq) return true;
        const hay = `${x.title} ${x.where} ${x.notes}`.toLowerCase();
        return hay.includes(nq);
      })
      .filter((x) => {
        if (!onlyAvailable) return true;
        const needB = x.requirements?.badges || [];
        const needH = x.requirements?.hms || [];
        const okB = needB.every((b) => ownedBadges.includes(b));
        const okH = needH.every((h) => ownedHms.includes(h));
        return okB && okH;
      });
  }, [list, q, onlyAvailable, ownedBadges, ownedHms]);

  function toggleIn(arr, value, setArr) {
    setArr((prev) => (prev.includes(value) ? prev.filter((x) => x !== value) : [...prev, value]));
  }

  return (
    <div style={page}>
      <style>{hideScrollbarWebkit}</style>

      <div style={topbar}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 950 }}>TM Story Liste</div>
          <div style={{ opacity: 0.8, fontSize: 13 }}>Chronologisch • Badge/HM Requirements • TM-Nummer egal</div>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <button style={btn} onClick={() => nav(-1)}>Zurück</button>
        </div>
      </div>

      <div style={controls}>
        <div style={{ display: "grid", gap: 6 }}>
          <div style={label}>Generation</div>
          <select style={select} value={gen} onChange={(e) => setGen(Number(e.target.value))}>
            {TM_STORY_GEN_OPTIONS.map((o) => (
              <option key={o.gen} value={o.gen}>{o.label}</option>
            ))}
          </select>
        </div>

        <div style={{ display: "grid", gap: 6, flex: 1 }}>
          <div style={label}>Suche</div>
          <input
            style={input}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="TM/Ort/Notiz suchen…"
          />
        </div>

        <div style={{ display: "grid", gap: 6 }}>
          <div style={label}>Filter</div>
          <button style={onlyAvailable ? btnOn : btn} onClick={() => setOnlyAvailable((v) => !v)}>
            {onlyAvailable ? "Nur verfügbar" : "Alle anzeigen"}
          </button>
        </div>
      </div>

      {(allBadges.length > 0 || allHms.length > 0) && (
        <div style={reqBox}>
          <div style={{ fontWeight: 900, marginBottom: 8 }}>Requirements (Test)</div>
          <div style={{ opacity: 0.75, fontSize: 12, marginBottom: 10 }}>
            Später koppeln wir das an deinen Run-Fortschritt. Aktuell kannst du hier “Besitz” simulieren.
          </div>

          {allBadges.length > 0 && (
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontWeight: 800, marginBottom: 6 }}>Badges</div>
              <div style={chipWrap}>
                {allBadges.map((b) => (
                  <button
                    key={b}
                    style={ownedBadges.includes(b) ? chipOn : chip}
                    onClick={() => toggleIn(ownedBadges, b, setOwnedBadges)}
                  >
                    {b}
                  </button>
                ))}
              </div>
            </div>
          )}

          {allHms.length > 0 && (
            <div>
              <div style={{ fontWeight: 800, marginBottom: 6 }}>HMs</div>
              <div style={chipWrap}>
                {allHms.map((h) => (
                  <button
                    key={h}
                    style={ownedHms.includes(h) ? chipOn : chip}
                    onClick={() => toggleIn(ownedHms, h, setOwnedHms)}
                  >
                    {h}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <div style={{ opacity: 0.85, marginTop: 10 }}>
        {filtered.length} Einträge (Gen {gen})
      </div>

      <div className="tmstory-scroll" style={{ ...listWrap, ...hideScrollbar }}>
        {filtered.map((x) => {
          const needB = x.requirements?.badges || [];
          const needH = x.requirements?.hms || [];

          return (
            <div key={`${x.order}-${x.title}`} style={row}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                <div style={{ fontWeight: 950, fontSize: 16 }}>{x.title}</div>
                <div style={{ opacity: 0.7, fontSize: 12 }}>#{x.order}</div>
              </div>

              <div style={{ marginTop: 6, opacity: 0.9 }}>{x.where}</div>

              {(needB.length > 0 || needH.length > 0) && (
                <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {needB.map((b) => (
                    <span key={b} style={badgePill}>Badge: {b}</span>
                  ))}
                  {needH.map((h) => (
                    <span key={h} style={hmPill}>HM: {h}</span>
                  ))}
                </div>
              )}

              {x.notes && (
                <div style={{ marginTop: 8, opacity: 0.75, fontSize: 12 }}>
                  {x.notes}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

const page = {
  minHeight: "100vh",
  padding: 16,
  color: "white",
};

const topbar = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
  marginBottom: 14,
};

const controls = {
  display: "flex",
  gap: 12,
  alignItems: "end",
  flexWrap: "wrap",
  padding: 12,
  borderRadius: 16,
  border: "1px solid rgba(255,255,255,0.14)",
  background: "rgba(10,10,16,0.55)",
  backdropFilter: "blur(10px)",
};

const reqBox = {
  marginTop: 12,
  padding: 12,
  borderRadius: 16,
  border: "1px solid rgba(255,255,255,0.14)",
  background: "rgba(10,10,16,0.55)",
  backdropFilter: "blur(10px)",
};

const label = { fontSize: 12, opacity: 0.8, fontWeight: 800 };

const input = {
  width: "min(720px, 92vw)",
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.14)",
  background: "rgba(255,255,255,0.06)",
  color: "white",
  outline: "none",
};

const select = {
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.14)",
  background: "rgba(255,255,255,0.06)",
  color: "white",
  outline: "none",
};

const btn = {
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.14)",
  background: "rgba(255,255,255,0.06)",
  color: "white",
  cursor: "pointer",
  fontWeight: 900,
};

const btnOn = {
  ...btn,
  background: "linear-gradient(135deg, rgba(67,233,123,0.30), rgba(56,249,215,0.16))",
};

const listWrap = {
  marginTop: 12,
  display: "grid",
  gap: 10,
  maxHeight: "68vh",
  overflow: "auto",
  paddingRight: 6,
};

const row = {
  padding: 12,
  borderRadius: 16,
  border: "1px solid rgba(255,255,255,0.14)",
  background: "rgba(10,10,16,0.55)",
  backdropFilter: "blur(10px)",
};

const badgePill = {
  fontSize: 12,
  padding: "4px 8px",
  borderRadius: 999,
  border: "1px solid rgba(79,172,254,0.30)",
  background: "rgba(79,172,254,0.16)",
};

const hmPill = {
  fontSize: 12,
  padding: "4px 8px",
  borderRadius: 999,
  border: "1px solid rgba(255,183,77,0.30)",
  background: "rgba(255,183,77,0.16)",
};

const chipWrap = { display: "flex", gap: 8, flexWrap: "wrap" };

const chip = {
  padding: "6px 10px",
  borderRadius: 999,
  border: "1px solid rgba(255,255,255,0.14)",
  background: "rgba(255,255,255,0.06)",
  color: "white",
  cursor: "pointer",
  fontWeight: 900,
  fontSize: 12,
};

const chipOn = {
  ...chip,
  background: "linear-gradient(135deg, rgba(161,140,209,0.32), rgba(251,194,235,0.16))",
};
