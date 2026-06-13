// src/pages/GuidePage.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import editionData from "../data/editionData";
import { getGenFromEdition } from "../utils/editionHelpers";
import guideByGen from "../guides/guideByGen";
import levelCapsByGen from "../guides/level_caps";
import { useDuoSave } from "../duo/useDuoSave";

// TM Story Daten (wichtig: Gen 62 muss dort drin sein)
import { TM_STORY_BY_GEN } from "../data/tmStory"; // <- falls dein Pfad anders ist: anpassen!

function GuidePage() {
  const navigate = useNavigate();

  // ===== Duo/Online (falls aktiv) =====
  const activeDuoRoomId = (localStorage.getItem("activeDuoRoomId") || "").trim().toUpperCase();
  const { save: duoSave } = useDuoSave(activeDuoRoomId);
  const isDuo = !!activeDuoRoomId;

  // ===== Local Save =====
  const activeSave = localStorage.getItem("activeSave") || "";
  const savegames = JSON.parse(localStorage.getItem("savegames") || "{}");
  const currentSave = activeSave ? savegames[activeSave] || {} : {};

  // ===== Effektive Edition/Gen (Duo gewinnt) =====
  const effectiveEdition = isDuo ? (duoSave?.edition || "") : currentSave.edition || "";
  const gen = getGenFromEdition(effectiveEdition);

  // ===== Guide/LevelCaps =====
  const guide = guideByGen[gen] || [];
  const levelCaps = levelCapsByGen[gen] || [];

  // !!! WICHTIG: VM Fundorte über *Edition* ziehen (nicht über gen)
  const genData = useMemo(() => {
    return editionData?.[effectiveEdition] || null;
  }, [effectiveEdition]);

  const vms = genData?.vms || [];

  // ===== Regeln (bleiben lokal im Save – wie bei dir) =====
  const [rules, setRules] = useState(currentSave.rules || []);
  const [newRule, setNewRule] = useState("");

  // ===== Guide Fortschritt =====
  const [completedSteps, setCompletedSteps] = useState([]);

  // ===== Popups =====
  const [openPanel, setOpenPanel] = useState(""); // "" | "levelcaps" | "tm" | "vm"

  // ===== Checklist Storage Keys =====
  const storageBaseKey = useMemo(() => {
    if (isDuo) return `guidecheck_duo_${activeDuoRoomId}_gen_${gen}`;
    return `guidecheck_save_${activeSave}_gen_${gen}`;
  }, [isDuo, activeDuoRoomId, activeSave, gen]);

  // ===== Checklists (Sets) =====
  const [checkedLevelCaps, setCheckedLevelCaps] = useState(() => new Set());
  const [checkedVMs, setCheckedVMs] = useState(() => new Set());
  const [checkedTMs, setCheckedTMs] = useState(() => new Set());

  // ===== Load saved progress (Guide steps + checklists) =====
  useEffect(() => {
    const keySteps = isDuo ? `guideProgress_duo_${activeDuoRoomId}` : `guideProgress_${activeSave}`;
    const saved = localStorage.getItem(keySteps);
    if (saved) setCompletedSteps(JSON.parse(saved));

    const savedChecksRaw = localStorage.getItem(storageBaseKey);
    if (savedChecksRaw) {
      try {
        const parsed = JSON.parse(savedChecksRaw);
        setCheckedLevelCaps(new Set(parsed?.levelcaps || []));
        setCheckedVMs(new Set(parsed?.vms || []));
        setCheckedTMs(new Set(parsed?.tms || []));
      } catch {
        setCheckedLevelCaps(new Set());
        setCheckedVMs(new Set());
        setCheckedTMs(new Set());
      }
    } else {
      setCheckedLevelCaps(new Set());
      setCheckedVMs(new Set());
      setCheckedTMs(new Set());
    }
  }, [isDuo, activeDuoRoomId, activeSave, storageBaseKey]);

  const persistChecks = (next) => {
    localStorage.setItem(storageBaseKey, JSON.stringify(next));
  };

  const toggleStep = (index) => {
    const newSteps = completedSteps.includes(index)
      ? completedSteps.filter((i) => i !== index)
      : [...completedSteps, index];

    setCompletedSteps(newSteps);

    const keySteps = isDuo ? `guideProgress_duo_${activeDuoRoomId}` : `guideProgress_${activeSave}`;
    localStorage.setItem(keySteps, JSON.stringify(newSteps));
  };

  const saveRulesToStorage = (newRules) => {
    const updatedSave = { ...currentSave, rules: newRules };
    const updatedSavegames = { ...savegames, [activeSave]: updatedSave };
    localStorage.setItem("savegames", JSON.stringify(updatedSavegames));
    setRules(newRules);
  };

  // ESC schließt Modal
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") setOpenPanel("");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // ===== TM Liste der Gen =====
  const tmList = useMemo(() => {
    const arr = TM_STORY_BY_GEN?.[gen] || [];
    return [...arr].sort((a, b) => (a.order || 0) - (b.order || 0));
  }, [gen]);

  // ===== Toggle helpers =====
  const toggleChecked = (kind, id) => {
    if (kind === "levelcaps") {
      const next = new Set(checkedLevelCaps);
      next.has(id) ? next.delete(id) : next.add(id);
      setCheckedLevelCaps(next);
      persistChecks({
        levelcaps: Array.from(next),
        vms: Array.from(checkedVMs),
        tms: Array.from(checkedTMs),
      });
      return;
    }
    if (kind === "vms") {
      const next = new Set(checkedVMs);
      next.has(id) ? next.delete(id) : next.add(id);
      setCheckedVMs(next);
      persistChecks({
        levelcaps: Array.from(checkedLevelCaps),
        vms: Array.from(next),
        tms: Array.from(checkedTMs),
      });
      return;
    }
    if (kind === "tms") {
      const next = new Set(checkedTMs);
      next.has(id) ? next.delete(id) : next.add(id);
      setCheckedTMs(next);
      persistChecks({
        levelcaps: Array.from(checkedLevelCaps),
        vms: Array.from(checkedVMs),
        tms: Array.from(next),
      });
    }
  };

  const clearChecksForPanel = (panel) => {
    if (panel === "levelcaps") {
      setCheckedLevelCaps(new Set());
      persistChecks({ levelcaps: [], vms: Array.from(checkedVMs), tms: Array.from(checkedTMs) });
      return;
    }
    if (panel === "vm") {
      setCheckedVMs(new Set());
      persistChecks({ levelcaps: Array.from(checkedLevelCaps), vms: [], tms: Array.from(checkedTMs) });
      return;
    }
    if (panel === "tm") {
      setCheckedTMs(new Set());
      persistChecks({ levelcaps: Array.from(checkedLevelCaps), vms: Array.from(checkedVMs), tms: [] });
    }
  };

  return (
    <div className="guide-page" style={pageWrap}>
      <div style={bg} />
      <div style={bgOverlay} />

      <style>{HIDE_SCROLL_CSS}</style>

      <button onClick={() => navigate("/table")} style={backBtn}>
        Zurück zur Encounter-Tabelle
      </button>

      <div style={topActionsRight}>
        <button style={pillBtn(openPanel === "levelcaps")} onClick={() => setOpenPanel("levelcaps")}>
          Level-Caps
        </button>
        <button style={pillBtn(openPanel === "tm")} onClick={() => setOpenPanel("tm")}>
          TM-Fundliste
        </button>
        <button style={pillBtn(openPanel === "vm")} onClick={() => setOpenPanel("vm")}>
          VM-Fundliste
        </button>
      </div>

      <h1 style={title}>Story-Guide für {effectiveEdition || "—"}</h1>
      <div style={{ textAlign: "center", opacity: 0.75, marginTop: -10, marginBottom: 16 }}>
        Gen erkannt: <b>{gen || "?"}</b>
      </div>

      <div style={mainRow}>
        <div style={rulesCard} className="hide-scroll">
          <h2 style={{ marginTop: 0 }}>Regeln</h2>

          <ul style={{ paddingLeft: "1rem", marginTop: 10 }}>
            {rules.map((rule, idx) => (
              <li key={idx} style={{ marginBottom: "0.5rem" }}>
                {rule}
                <button
                  onClick={() => {
                    const updated = [...rules];
                    updated.splice(idx, 1);
                    saveRulesToStorage(updated);
                  }}
                  style={smallBtn}
                >
                  Entfernen
                </button>
              </li>
            ))}
          </ul>

          <div style={{ display: "flex", marginTop: "0.7rem", gap: 10 }}>
            <input
              type="text"
              placeholder="Neue Regel"
              value={newRule}
              onChange={(e) => setNewRule(e.target.value)}
              style={ruleInput}
            />
            <button
              onClick={() => {
                if (!newRule.trim()) return;
                const updated = [...rules, newRule.trim()];
                saveRulesToStorage(updated);
                setNewRule("");
              }}
              style={plusBtn}
              title="Regel hinzufügen"
            >
              +
            </button>
          </div>
        </div>

        <div style={guideCard} className="hide-scroll">
          {guide.length === 0 ? (
            <p>Kein Guide für diese Edition vorhanden.</p>
          ) : (
            <ol style={{ margin: 0, paddingLeft: 20 }}>
              {guide.map((step, idx) => (
                <li
                  key={idx}
                  onClick={() => toggleStep(idx)}
                  style={{
                    cursor: "pointer",
                    textDecoration: completedSteps.includes(idx) ? "line-through" : "none",
                    opacity: completedSteps.includes(idx) ? 0.55 : 1,
                    padding: "4px 0",
                  }}
                >
                  {step}
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>

      {openPanel !== "" && (
        <div
          style={modalOverlay}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setOpenPanel("");
          }}
        >
          <div style={modalCard}>
            <div style={modalHeader}>
              <div style={{ fontWeight: 900 }}>
                {openPanel === "levelcaps" ? "Level-Caps" : openPanel === "tm" ? "TM-Fundliste" : "VM-Fundliste"}
              </div>

              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <button
                  style={miniBtn}
                  onClick={() => clearChecksForPanel(openPanel)}
                  title="Alle Häkchen in diesem Fenster zurücksetzen"
                >
                  Reset
                </button>
                <button style={closeBtn} onClick={() => setOpenPanel("")} title="Schließen (ESC)">
                  ✕
                </button>
              </div>
            </div>

            <div style={modalBody} className="hide-scroll">
              {openPanel === "levelcaps" && (
                <>
                  {levelCaps.length ? (
                    levelCaps.map((cap) => {
                      const id = `${cap.order}|${cap.name}|${cap.level}`;
                      const done = checkedLevelCaps.has(id);
                      return (
                        <div
                          key={id}
                          style={{ ...checkItem, opacity: done ? 0.65 : 1 }}
                          onClick={() => toggleChecked("levelcaps", id)}
                        >
                          <div style={checkLeft}>
                            <div style={checkBox(done)}>{done ? "✓" : ""}</div>
                          </div>
                          <div style={checkMain}>
                            <div style={{ fontWeight: 800, textDecoration: done ? "line-through" : "none" }}>
                              {cap.order}: {cap.name}
                            </div>
                            <div style={{ opacity: 0.9, marginTop: 2, fontSize: 13 }}>
                              ({cap.location}) – <span style={{ fontStyle: "italic" }}>Level {cap.level}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div style={{ opacity: 0.8 }}>Keine Level-Caps für diese Gen vorhanden.</div>
                  )}
                </>
              )}

              {openPanel === "tm" && (
                <>
                  {tmList.length ? (
                    tmList.map((tm) => {
                      const id = String(tm.order);
                      const done = checkedTMs.has(id);
                      return (
                        <div
                          key={id}
                          style={{ ...checkItem, opacity: done ? 0.65 : 1 }}
                          onClick={() => toggleChecked("tms", id)}
                        >
                          <div style={checkLeft}>
                            <div style={checkBox(done)}>{done ? "✓" : ""}</div>
                          </div>
                          <div style={checkMain}>
                            <div style={{ fontWeight: 900, textDecoration: done ? "line-through" : "none" }}>
                              {tm.order}. {tm.title || "TM"}
                            </div>
                            <div style={{ opacity: 0.92, marginTop: 6, fontSize: 13 }}>
                              <b>Wo:</b> {tm.where || "—"}
                            </div>
                            {!!(tm?.requirements?.badges?.length || tm?.requirements?.hms?.length) && (
                              <div style={{ opacity: 0.8, marginTop: 6, fontSize: 12 }}>
                                {!!tm?.requirements?.badges?.length && (
                                  <div>
                                    <b>Orden:</b> {tm.requirements.badges.join(", ")}
                                  </div>
                                )}
                                {!!tm?.requirements?.hms?.length && (
                                  <div>
                                    <b>VMs:</b> {tm.requirements.hms.join(", ")}
                                  </div>
                                )}
                              </div>
                            )}
                            {!!tm.notes && (
                              <div style={{ opacity: 0.8, marginTop: 6, fontSize: 12 }}>
                                <b>Notiz:</b> {tm.notes}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div style={{ opacity: 0.8 }}>Noch keine TM-Story-Daten für Gen {gen}.</div>
                  )}
                </>
              )}

              {openPanel === "vm" && (
                <>
                  {vms.length ? (
                    vms.map((vm, index) => {
                      const id = `${index}|${vm.name}|${vm.location}`;
                      const done = checkedVMs.has(id);
                      return (
                        <div
                          key={id}
                          style={{ ...checkItem, opacity: done ? 0.65 : 1 }}
                          onClick={() => toggleChecked("vms", id)}
                        >
                          <div style={checkLeft}>
                            <div style={checkBox(done)}>{done ? "✓" : ""}</div>
                          </div>
                          <div style={checkMain}>
                            <div style={{ fontWeight: 800, textDecoration: done ? "line-through" : "none" }}>
                              {vm.name}
                            </div>
                            <div style={{ opacity: 0.9, marginTop: 2, fontSize: 13 }}>{vm.location}</div>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div style={{ opacity: 0.8 }}>Keine VM-Fundorte für diese Gen vorhanden.</div>
                  )}
                </>
              )}
            </div>

            <div style={modalFooter}>
              <button style={footerBtn} onClick={() => setOpenPanel("")}>
                Schließen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default GuidePage;

/* =======================
   CSS Helpers
======================= */

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

  .guide-page button {
    background:
      linear-gradient(180deg, rgba(14, 30, 56, 0.96), rgba(9, 20, 39, 0.96)) !important;
    background-color: transparent !important;
    border: 1px solid rgba(100, 140, 215, 0.55) !important;
    color: #f8fafc !important;
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.04),
      0 10px 24px rgba(0, 0, 0, 0.18);
    transition:
      transform 0.15s ease,
      background 0.15s ease,
      border-color 0.15s ease,
      opacity 0.15s ease;
  }

  .guide-page button:hover {
    transform: translateY(-1px);
    border-color: rgba(140, 170, 230, 0.68) !important;
    background:
      linear-gradient(180deg, rgba(18, 38, 70, 0.96), rgba(10, 23, 44, 0.96)) !important;
    background-color: transparent !important;
    color: #ffffff !important;
  }

  .guide-page button:active {
    transform: translateY(0);
  }

  .guide-page input::placeholder {
    color: rgba(235, 241, 250, 0.46);
  }

  .guide-page input:focus {
    border-color: rgba(96, 165, 250, 0.72) !important;
    box-shadow:
      0 0 0 3px rgba(96, 165, 250, 0.14),
      inset 0 1px 0 rgba(255, 255, 255, 0.035) !important;
  }
`;

/* =======================
   Styles
======================= */

const pageWrap = {
  position: "relative",
  height: "100vh",
  minHeight: "100vh",
  padding: "24px 20px",
  boxSizing: "border-box",
  background: "#050a18",
  color: "var(--pnt-text, white)",
  overflow: "hidden",
};

const bg = {
  position: "fixed",
  inset: 0,
  zIndex: 0,
  backgroundImage: `url("/backgrounds/background_5.png")`,
  backgroundSize: "cover",
  backgroundPosition: "center",
  backgroundRepeat: "no-repeat",
  transform: "scale(1.03)",
  filter: "saturate(0.92) brightness(0.82)",
};

const bgOverlay = {
  position: "fixed",
  inset: 0,
  zIndex: 1,
  background:
    "radial-gradient(circle at 50% 0%, rgba(52, 211, 153, 0.10), transparent 34%), radial-gradient(circle at 0% 25%, rgba(96, 165, 250, 0.12), transparent 38%), linear-gradient(180deg, rgba(5, 10, 24, 0.54), rgba(5, 10, 24, 0.82))",
};

const backBtn = {
  position: "fixed",
  top: 14,
  left: 14,
  zIndex: 50,
  minHeight: 42,
  padding: "0 15px",
  borderRadius: "var(--pnt-radius-small, 8px)",
  cursor: "pointer",
  fontWeight: 950,
  backdropFilter: "blur(10px)",
};

const topActionsRight = {
  position: "fixed",
  top: 14,
  right: 14,
  zIndex: 50,
  display: "flex",
  gap: 10,
  alignItems: "center",
  padding: 6,
  borderRadius: "var(--pnt-radius, 14px)",
  border: "1px solid rgba(137, 155, 184, 0.22)",
  background:
    "linear-gradient(180deg, rgba(10, 18, 33, 0.74), rgba(6, 12, 24, 0.72))",
  boxShadow: "0 18px 48px rgba(0, 0, 0, 0.26)",
  backdropFilter: "blur(10px)",
};

const pillBtn = (active) => ({
  minHeight: 40,
  padding: "0 13px",
  borderRadius: "var(--pnt-radius-small, 8px)",
  cursor: "pointer",
  fontWeight: 950,
  borderColor: active ? "rgba(96, 165, 250, 0.72)" : "rgba(100, 140, 215, 0.55)",
  boxShadow: active
    ? "0 0 0 3px rgba(96, 165, 250, 0.12), inset 0 1px 0 rgba(255, 255, 255, 0.04)"
    : undefined,
});

const title = {
  position: "relative",
  zIndex: 2,
  textAlign: "center",
  marginTop: 90,
  marginBottom: 24,
  fontSize: "clamp(2rem, 4vw, 2.55rem)",
  letterSpacing: 0.4,
  color: "#f8fafc",
  textShadow: "0 18px 40px rgba(0,0,0,0.55)",
};

const mainRow = {
  position: "relative",
  zIndex: 2,
  display: "flex",
  justifyContent: "center",
  gap: 18,
  alignItems: "flex-start",
  marginTop: 12,
  flexWrap: "wrap",
};

const rulesCard = {
  flex: "0 0 350px",
  border: "1px solid var(--pnt-border, rgba(137, 155, 184, 0.28))",
  background:
    "linear-gradient(180deg, rgba(10, 18, 33, 0.92), rgba(6, 12, 24, 0.9))",
  padding: "16px 16px 18px 16px",
  borderRadius: "var(--pnt-radius, 14px)",
  backdropFilter: "blur(10px)",
  boxShadow:
    "var(--pnt-shadow, 0 18px 48px rgba(0, 0, 0, 0.36)), inset 0 1px 0 rgba(255, 255, 255, 0.045)",
  maxHeight: "58vh",
  overflowY: "auto",
};

const guideCard = {
  flex: "1",
  minWidth: 420,
  maxWidth: 880,
  border: "1px solid var(--pnt-border, rgba(137, 155, 184, 0.28))",
  background:
    "linear-gradient(180deg, rgba(10, 18, 33, 0.92), rgba(6, 12, 24, 0.9))",
  padding: 18,
  borderRadius: "var(--pnt-radius, 14px)",
  boxShadow:
    "var(--pnt-shadow, 0 18px 48px rgba(0, 0, 0, 0.36)), inset 0 1px 0 rgba(255, 255, 255, 0.045)",
  maxHeight: "70vh",
  overflowY: "auto",
};

const smallBtn = {
  marginLeft: 10,
  minHeight: 30,
  padding: "0 9px",
  borderRadius: 8,
  cursor: "pointer",
  fontSize: 12,
  fontWeight: 900,
};

const ruleInput = {
  flex: 1,
  minHeight: 42,
  padding: "0 12px",
  borderRadius: 10,
  border: "1px solid rgba(137, 155, 184, 0.28)",
  background:
    "linear-gradient(180deg, rgba(10, 19, 34, 0.94), rgba(8, 15, 28, 0.94))",
  color: "var(--pnt-text, white)",
  outline: "none",
  fontWeight: 900,
  boxShadow: "inset 0 1px 0 rgba(255, 255, 255, 0.035)",
};

const plusBtn = {
  width: 44,
  minHeight: 42,
  borderRadius: 10,
  cursor: "pointer",
  fontWeight: 950,
  fontSize: 20,
  lineHeight: "20px",
};

/* ===== Modal ===== */

const modalOverlay = {
  position: "fixed",
  inset: 0,
  zIndex: 200,
  background: "rgba(0,0,0,0.62)",
  backdropFilter: "blur(8px)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 16,
};

const modalCard = {
  width: "min(860px, 96vw)",
  maxHeight: "min(82vh, 760px)",
  borderRadius: 18,
  border: "1px solid var(--pnt-border, rgba(137, 155, 184, 0.28))",
  background:
    "linear-gradient(180deg, rgba(10, 18, 33, 0.96), rgba(6, 12, 24, 0.94))",
  boxShadow:
    "var(--pnt-shadow, 0 18px 48px rgba(0, 0, 0, 0.36)), inset 0 1px 0 rgba(255, 255, 255, 0.045)",
  overflow: "hidden",
  display: "flex",
  flexDirection: "column",
};

const modalHeader = {
  padding: "13px 15px",
  borderBottom: "1px solid rgba(137, 155, 184, 0.18)",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
};

const closeBtn = {
  width: 42,
  height: 42,
  borderRadius: 12,
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 24,
  fontWeight: 900,
  lineHeight: 1,
  fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial",
};

const miniBtn = {
  minHeight: 36,
  padding: "0 12px",
  borderRadius: 10,
  cursor: "pointer",
  fontWeight: 900,
};

const modalBody = {
  padding: 14,
  overflowY: "auto",
};

const modalFooter = {
  padding: "12px 14px",
  borderTop: "1px solid rgba(137, 155, 184, 0.18)",
  display: "flex",
  alignItems: "center",
  justifyContent: "flex-end",
  gap: 12,
};

const footerBtn = {
  minHeight: 40,
  padding: "0 14px",
  borderRadius: 10,
  cursor: "pointer",
  fontWeight: 900,
};

/* ===== Checklist Item ===== */

const checkItem = {
  display: "flex",
  gap: 12,
  alignItems: "flex-start",
  padding: "12px 12px",
  borderRadius: "var(--pnt-radius, 14px)",
  border: "1px solid rgba(137, 155, 184, 0.18)",
  background:
    "linear-gradient(180deg, rgba(13, 24, 42, 0.68), rgba(9, 17, 31, 0.66))",
  marginBottom: 10,
  cursor: "pointer",
  boxShadow: "inset 0 1px 0 rgba(255, 255, 255, 0.035)",
};

const checkLeft = {
  flex: "0 0 auto",
  paddingTop: 2,
};

const checkBox = (done) => ({
  width: 26,
  height: 26,
  borderRadius: 10,
  border: done ? "1px solid rgba(96, 165, 250, 0.48)" : "1px solid rgba(137, 155, 184, 0.24)",
  background: done
    ? "rgba(30, 64, 175, 0.28)"
    : "rgba(5, 11, 21, 0.34)",
  color: done ? "#bfdbfe" : "transparent",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontWeight: 950,
});

const checkMain = {
  flex: 1,
};