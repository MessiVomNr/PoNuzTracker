import React, { useEffect, useMemo, useState } from "react";
import { makeShuffledPool, dexIdToImageUrl, getDexCapForGen } from "../utils/pokemonPool";
import { pokedex as fullPokedex } from "../data/pokedex.js";

function getPokemonName(dexId) {
  const key = `pokedex${dexId}`;
  return fullPokedex?.[key] ?? `#${dexId}`;
}

function labelPlayer(playerId, room) {
  const arr = room?.players || [];
  const p = arr.find((x) => x.id === playerId);
  return p?.displayName || p?.name || playerId?.slice?.(0, 6) || String(playerId);
}

function clampInt(v, min, max) {
  const n = Number(v);
  if (Number.isNaN(n)) return min;
  return Math.max(min, Math.min(max, Math.floor(n)));
}

function fmtSecs(s) {
  const sec = Math.max(0, Math.ceil(s));
  return `${sec}s`;
}

function teamIdFor(i) {
  return `team${i + 1}`;
}

export default function DuoVersusAuction({ roomId, room }) {
  if (!roomId) return <div style={{ padding: 12 }}>Keine Room-ID in der URL.</div>;
  if (!room) return <div style={{ padding: 12 }}>Lade Versus-Room …</div>;

  const players = room.players || [];
  const hostPlayerId = players[0]?.id || "";
  const myPlayerId = useMemo(() => {
    return sessionStorage.getItem(`versus_player_${String(roomId || "").toUpperCase()}`) || "";
  }, [roomId]);

  const meIsHost = myPlayerId && hostPlayerId ? myPlayerId === hostPlayerId : false;

  // ===== PHASE =====
  const [phase, setPhase] = useState("lobby"); // lobby | auction | results

  const [settings, setSettings] = useState({
    generation: 1,
    participants: 2,
    budgetPerTeam: 10000,
    totalPokemon: 12,
    secondsPerBid: 10,
  });

  // ===== TEAM SLOTS (Host bestimmt Anzahl, Spieler joinen ein Team) =====
  // teamOwners: { team1: playerId|null, team2: playerId|null, ... }
  const [teamOwners, setTeamOwners] = useState({});

  // Ensure team slots exist when participants changes
  useEffect(() => {
    const count = Math.max(2, clampInt(settings.participants, 2, 8));
    setTeamOwners((prev) => {
      const next = { ...prev };
      // add missing
      for (let i = 0; i < count; i++) {
        const tid = teamIdFor(i);
        if (!(tid in next)) next[tid] = null;
      }
      // remove extra (only if not in auction/results)
      if (phase === "lobby") {
        for (const k of Object.keys(next)) {
          const idx = Number(String(k).replace("team", "")) - 1;
          if (Number.isFinite(idx) && idx >= count) delete next[k];
        }
      }
      return next;
    });
  }, [settings.participants, phase]);

  const teamIds = useMemo(() => {
    const count = Math.max(2, clampInt(settings.participants, 2, 8));
    return Array.from({ length: count }, (_, i) => teamIdFor(i));
  }, [settings.participants]);

  const myTeamId = useMemo(() => {
    if (!myPlayerId) return null;
    for (const tid of teamIds) {
      if (teamOwners?.[tid] === myPlayerId) return tid;
    }
    return null;
  }, [myPlayerId, teamOwners, teamIds]);

  function claimTeam(tid) {
    if (phase !== "lobby") return;
    if (!myPlayerId) return;

    setTeamOwners((prev) => {
      // already in a team? block
      const already = Object.values(prev).some((pid) => pid === myPlayerId);
      if (already) return prev;

      // team already taken
      if (prev?.[tid]) return prev;

      return { ...prev, [tid]: myPlayerId };
    });
  }

  function leaveMyTeam() {
    if (phase !== "lobby") return;
    if (!myTeamId) return;

    setTeamOwners((prev) => ({ ...prev, [myTeamId]: null }));
  }

  // ===== DRAFT STATE =====
  const [draft, setDraft] = useState({
    auctionCountDone: 0,
    current: null,

    teamIds: [],
    budgets: {},   // budgets[teamId]
    teams: {},     // teams[teamId] = [{dexId,name,price}]

    pool: [],
    poolIndex: 0,
    totalPokemon: 12,

    highestBid: 0,
    highestTeamId: null,
    hasStarted: false, // Timer läuft erst ab erstem Gebot >= 100
  });

  // ===== TIMER =====
  const [timerRunning, setTimerRunning] = useState(false);
  const [timerPaused, setTimerPaused] = useState(false);
  const [timerRemaining, setTimerRemaining] = useState(0);

  // ===== BID UI =====
  const [bidInput, setBidInput] = useState(100);

  // Timer tick
  useEffect(() => {
    if (phase !== "auction") return;
    if (!timerRunning) return;
    if (timerPaused) return;

    const iv = setInterval(() => {
      setTimerRemaining((t) => (t <= 0 ? 0 : t - 1));
    }, 1000);

    return () => clearInterval(iv);
  }, [phase, timerRunning, timerPaused]);

  // Wenn Timer auf 0 -> Pokémon vergeben
  useEffect(() => {
    if (phase !== "auction") return;
    if (!timerRunning) return;
    if (timerPaused) return;
    if (timerRemaining > 0) return;

    if (!draft.hasStarted || !draft.highestTeamId || draft.highestBid <= 0 || !draft.current) {
      setTimerRunning(false);
      return;
    }

    const winnerTeam = draft.highestTeamId;
    const price = draft.highestBid;
    const poke = draft.current;

    setDraft((prev) => {
      const budgets = { ...(prev.budgets || {}) };
      budgets[winnerTeam] = Math.max(0, (budgets[winnerTeam] ?? 0) - price);

      const teams = { ...(prev.teams || {}) };
      const teamArr = Array.isArray(teams[winnerTeam]) ? [...teams[winnerTeam]] : [];
      teamArr.push({ dexId: poke.dexId, name: poke.name, price });
      teams[winnerTeam] = teamArr;

      const nextAuctionCount = (prev.auctionCountDone ?? 0) + 1;
      const done = nextAuctionCount >= (prev.totalPokemon ?? settings.totalPokemon);

      const nextPoolIndex = (prev.poolIndex ?? 0) + 1;
      const nextDex = prev.pool?.[nextPoolIndex] ?? null;
      const nextCurrent = nextDex
        ? { dexId: nextDex, name: getPokemonName(nextDex), imageUrl: dexIdToImageUrl(nextDex) }
        : null;

      if (done || !nextCurrent) {
        setPhase("results");
        setTimerRunning(false);
        setTimerPaused(false);
        setTimerRemaining(0);

        return {
          ...prev,
          budgets,
          teams,
          auctionCountDone: nextAuctionCount,
          current: null,
          hasStarted: false,
          highestBid: 0,
          highestTeamId: null,
        };
      }

      // reset next pokemon
      setTimerRunning(false);
      setTimerPaused(false);
      setTimerRemaining(settings.secondsPerBid);

      return {
        ...prev,
        budgets,
        teams,
        auctionCountDone: nextAuctionCount,
        poolIndex: nextPoolIndex,
        current: nextCurrent,
        hasStarted: false,
        highestBid: 0,
        highestTeamId: null,
      };
    });
    // eslint-disable-next-line
  }, [timerRemaining]); // (bei dir ist die eslint-regel nicht aktiv, daher safe)

  function updateSettings(partial) {
    if (!meIsHost) return;
    setSettings((s) => ({ ...s, ...partial }));
  }

  function startDraft() {
    if (!meIsHost) return;

    const gen = clampInt(settings.generation, 1, 7);
    const participants = Math.max(2, clampInt(settings.participants, 2, 8));
    const budgetPerTeam = Math.max(0, clampInt(settings.budgetPerTeam, 0, 9999999));
    const totalPokemon = Math.max(1, clampInt(settings.totalPokemon, 1, 999));
    const secondsPerBid = Math.max(5, clampInt(settings.secondsPerBid, 5, 60));

    const pool = makeShuffledPool(gen);
    const poolIndex = 0;
    const firstDex = pool[poolIndex] ?? null;

    const current = firstDex
      ? { dexId: firstDex, name: getPokemonName(firstDex), imageUrl: dexIdToImageUrl(firstDex) }
      : null;

    const budgets = {};
    const teams = {};
    const localTeamIds = Array.from({ length: participants }, (_, i) => teamIdFor(i));

    for (const tid of localTeamIds) {
      budgets[tid] = budgetPerTeam;
      teams[tid] = [];
    }

    setDraft({
      auctionCountDone: 0,
      current,

      teamIds: localTeamIds,
      budgets,
      teams,

      pool,
      poolIndex,
      totalPokemon,

      highestBid: 0,
      highestTeamId: null,
      hasStarted: false,
    });

    setTimerRunning(false);
    setTimerPaused(false);
    setTimerRemaining(secondsPerBid);

    setBidInput(100);
    setPhase("auction");
  }

  function pauseTimer() {
    if (!meIsHost) return;
    if (!timerRunning) return;
    setTimerPaused(true);
  }

  function resumeTimerPlus5() {
    if (!meIsHost) return;
    if (!timerRunning) return;
    setTimerPaused(false);
    setTimerRemaining((t) => t + 5);
  }

  function myBudget() {
    if (!myTeamId) return 0;
    return draft.budgets?.[myTeamId] ?? 0;
  }

  function placeBid(amountRaw) {
    if (phase !== "auction") return;
    if (!draft.current) return;
    if (!myTeamId) return; // must have joined a team
    if (!draft.teamIds.includes(myTeamId)) return;

    const amt = clampInt(amountRaw, 0, 999999999);

    if (amt < 100) return;
    if (amt % 100 !== 0) return;

    const budget = myBudget();
    if (amt > budget) return;

    if (amt <= (draft.highestBid ?? 0)) return;

    setDraft((d) => ({
      ...d,
      highestBid: amt,
      highestTeamId: myTeamId,
      hasStarted: true,
    }));

    setTimerPaused(false);
    setTimerRunning(true);
    setTimerRemaining(settings.secondsPerBid);
  }

  // ===== UI helpers for team labels/colors =====
  function teamTitle(tid) {
  const owner = teamOwners?.[tid] ?? null;
  if (!owner) return "Frei";
  return labelPlayer(owner, room);
}

  function teamIsFree(tid) {
    return !teamOwners?.[tid];
  }
  function teamIsMine(tid) {
    return teamOwners?.[tid] === myPlayerId;
  }

  // ===== RENDER =====
  return (
    <div style={outer}>
      <div style={topLine}>
        <div style={{ fontWeight: 900 }}>Versus — Auction Draft</div>
        <div style={{ opacity: 0.8, fontSize: 12 }}>
          Room: <b>{String(roomId).toUpperCase()}</b>
          {" · "}Host: <b>{labelPlayer(hostPlayerId, room)}</b>
          {" · "}Du: <b>{labelPlayer(myPlayerId, room)}</b>
        </div>
      </div>

      {phase === "lobby" && (
        <section style={panel}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, alignItems: "start" }}>
            {/* Settings */}
            <div>
              <div style={{ fontWeight: 900, marginBottom: 10 }}>Host Einstellungen</div>

              {!meIsHost ? (
                <div style={{ opacity: 0.8 }}>Warte auf Host…</div>
              ) : (
                <div style={{ display: "grid", gap: 8, maxWidth: 560 }}>
                  <Row label="Generation">
                    <select
                      value={settings.generation}
                      onChange={(e) => updateSettings({ generation: Number(e.target.value) })}
                    >
                      {[1, 2, 3, 4, 5, 6, 7].map((g) => (
                        <option key={g} value={g}>
                          Gen {g} (bis #{getDexCapForGen(g)})
                        </option>
                      ))}
                    </select>
                  </Row>

                  <Row label="Teams (Teilnehmer)">
                    <input
                      type="number"
                      min={2}
                      max={8}
                      value={settings.participants}
                      onChange={(e) => updateSettings({ participants: Number(e.target.value) })}
                    />
                  </Row>

                  <Row label="Budget pro Team">
                    <input
                      type="number"
                      min={0}
                      step={100}
                      value={settings.budgetPerTeam}
                      onChange={(e) => updateSettings({ budgetPerTeam: Number(e.target.value) })}
                    />
                  </Row>

                  <Row label="Pokémon insgesamt">
                    <input
                      type="number"
                      min={1}
                      max={200}
                      value={settings.totalPokemon}
                      onChange={(e) => updateSettings({ totalPokemon: Number(e.target.value) })}
                    />
                  </Row>

                  <Row label="Sekunden nach Gebot (Reset)">
                    <input
                      type="number"
                      min={5}
                      max={60}
                      value={settings.secondsPerBid}
                      onChange={(e) => updateSettings({ secondsPerBid: Number(e.target.value) })}
                    />
                  </Row>

                  <button onClick={startDraft} style={btnPrimary}>
                    Draft starten
                  </button>
                </div>
              )}
            </div>

            {/* Team slots */}
            <div>
              <div style={{ fontWeight: 900, marginBottom: 10 }}>Teams auswählen</div>
              <div style={{ opacity: 0.8, fontSize: 12, marginBottom: 10 }}>
                Freie Teams sind <b>rot</b>. Belegte Teams <b>grün</b>. Klicke auf ein Team zum Joinen.
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10 }}>
                {teamIds.map((tid) => {
                  const free = teamIsFree(tid);
                  const mine = teamIsMine(tid);
                  const owner = teamOwners?.[tid] ?? null;

                  return (
                    <div
                      key={tid}
                      style={{
                        ...teamSlotCard,
                        borderColor: free ? "rgba(239,68,68,0.55)" : "rgba(34,197,94,0.55)",
                        background: free ? "rgba(239,68,68,0.08)" : "rgba(34,197,94,0.08)",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                        <div style={{ fontWeight: 900 }}>
                          {tid.toUpperCase()}
                          {mine ? " (deins)" : ""}
                        </div>
                        <div style={{ opacity: 0.85, fontWeight: 800 }}>
                          {owner ? "belegt" : "frei"}
                        </div>
                      </div>

                      <div style={{ marginTop: 6, fontWeight: 800 }}>
                        {teamTitle(tid)}
                      </div>

                      <div style={{ marginTop: 10, display: "flex", gap: 8 }}>
                        {free ? (
                          <button
                            style={btnGhost}
                            onClick={() => claimTeam(tid)}
                            disabled={!myPlayerId || !!myTeamId}
                            title={myTeamId ? "Du bist schon in einem Team" : "Team beitreten"}
                          >
                            Team beitreten
                          </button>
                        ) : mine ? (
                          <button style={btnGhost} onClick={leaveMyTeam}>
                            Team verlassen
                          </button>
                        ) : (
                          <button style={{ ...btnGhost, opacity: 0.5 }} disabled>
                            Belegt
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div style={{ marginTop: 10, fontSize: 12, opacity: 0.8 }}>
                Dein Team: <b>{myTeamId ? myTeamId.toUpperCase() : "— (nicht gewählt)"}</b>
              </div>
            </div>
          </div>
        </section>
      )}

      {phase === "auction" && (
        <div style={auctionGrid}>
          {/* Teams oben (2 Spalten) */}
          <section style={{ ...panel, gridColumn: "1 / 3" }}>
            <div style={{ fontWeight: 900, marginBottom: 10 }}>Teams</div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10 }}>
              {draft.teamIds.map((tid) => {
                const money = draft.budgets?.[tid] ?? 0;
                const team = draft.teams?.[tid] ?? [];
                const free = teamIsFree(tid);
                const mine = teamIsMine(tid);

                return (
                  <div
                    key={tid}
                    style={{
                      ...playerCard,
                      borderColor: free ? "rgba(239,68,68,0.35)" : "rgba(34,197,94,0.35)",
                      background: free ? "rgba(239,68,68,0.05)" : "rgba(34,197,94,0.05)",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                      <div style={{ fontWeight: 900 }}>
                        {teamTitle(tid)} {mine ? "(du)" : ""}
                      </div>
                      <div style={{ fontWeight: 900 }}>{money}€</div>
                    </div>

                    {/* Sprites: größer + horizontal scroll */}
                    <div
                      style={{
                        marginTop: 10,
                        display: "flex",
                        gap: 8,
                        overflowX: "auto",
                        overflowY: "hidden",
                        paddingBottom: 6,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {team.length === 0 ? (
                        <span style={{ opacity: 0.7, fontSize: 12 }}>Noch keine Pokémon</span>
                      ) : (
                        team.map((p) => (
                          <img
                            key={`${tid}-${p.dexId}-${p.price}`}
                            src={dexIdToImageUrl(p.dexId)}
                            alt={p.name}
                            width={44}
                            height={44}
                            title={`${p.name} (${p.price}€)`}
                            style={{ imageRendering: "pixelated", flex: "0 0 auto" }}
                          />
                        ))
                      )}
                    </div>

                    {/* Join hint (wenn frei) */}
                    {free && (
                      <div style={{ fontSize: 12, opacity: 0.75 }}>
                        (frei) — Teams werden in der Lobby belegt
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          {/* Links: Pokémon groß */}
          <section style={{ ...panel, gridColumn: "1 / 2", height: "min(48vh, 420px)" }}>
            <div style={{ fontWeight: 900, marginBottom: 10 }}>
              Aktuelles Pokémon ({draft.auctionCountDone}/{draft.totalPokemon})
            </div>

            {draft.current ? (
              <div style={{ display: "grid", gap: 10, justifyItems: "center" }}>
                <img
                  src={draft.current.imageUrl}
                  alt={draft.current.name}
                  width={160}
                  height={160}
                  style={{ imageRendering: "pixelated", filter: "drop-shadow(0 10px 18px rgba(0,0,0,0.6))" }}
                />
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 20, fontWeight: 900 }}>{draft.current.name}</div>
                  <div style={{ opacity: 0.8 }}>Dex #{draft.current.dexId}</div>
                  <div style={{ marginTop: 6, opacity: 0.85 }}>
                    {draft.hasStarted ? (
                      <>
                        Höchstgebot: <b>{draft.highestBid}€</b> von <b>{teamTitle(draft.highestTeamId)}</b>
                      </>
                    ) : (
                      "Warte auf erstes Gebot (min. 100)"
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ opacity: 0.8 }}>Kein Pokémon geladen.</div>
            )}
          </section>

          {/* Rechts: Timer + Bieten */}
          <section style={{ ...panel, gridColumn: "2 / 3", height: "min(48vh, 420px)" }}>
            <div style={{ fontWeight: 900, marginBottom: 10 }}>Timer</div>

            <div style={timerBig}>{timerRunning ? fmtSecs(timerRemaining) : "--"}</div>
            <div style={{ opacity: 0.8, marginBottom: 12 }}>
              {timerRunning ? (timerPaused ? "Pausiert" : "Läuft") : "Startet bei erstem Gebot (≥ 100)"}
            </div>

            {/* Bid UI */}
            <div style={{ borderTop: "1px solid rgba(255,255,255,0.12)", paddingTop: 10, marginTop: 10 }}>
              <div style={{ fontWeight: 900, marginBottom: 8 }}>Bieten</div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8 }}>
                <input
                  type="number"
                  step={100}
                  min={100}
                  value={bidInput}
                  onChange={(e) => setBidInput(Number(e.target.value))}
                  style={input}
                  disabled={!myTeamId}
                />
                <button
                  onClick={() => placeBid(bidInput)}
                  style={{ ...btnPrimary, opacity: myTeamId ? 1 : 0.5 }}
                  disabled={!myTeamId}
                  title={myTeamId ? "Muss höher sein als das aktuelle Höchstgebot" : "Du musst erst ein Team wählen (Lobby)"}
                >
                  Bieten
                </button>
              </div>

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
                <button style={btnGhost} onClick={() => setBidInput((v) => Math.max(100, (v || 0) - 100))} disabled={!myTeamId}>
                  -100
                </button>
                <button style={btnGhost} onClick={() => setBidInput((v) => Math.max(0, v || 0) + 100)} disabled={!myTeamId}>
                  +100
                </button>
                <button style={btnGhost} onClick={() => setBidInput((v) => Math.max(0, v || 0) + 500)} disabled={!myTeamId}>
                  +500
                </button>
                <button style={btnGhost} onClick={() => setBidInput(myBudget() - (myBudget() % 100))} disabled={!myTeamId}>
                  All-in
                </button>
              </div>

              <div style={{ marginTop: 8, fontSize: 12, opacity: 0.8 }}>
                Dein Team: <b>{myTeamId ? myTeamId.toUpperCase() : "—"}</b> · Budget: <b>{myBudget()}€</b> · 100er Schritte · Timer reset bei jedem Gebot
              </div>
            </div>

            {/* Pause / Resume */}
            <div style={{ marginTop: 12, display: "grid", gap: 8 }}>
              <button
                onClick={pauseTimer}
                disabled={!meIsHost || !timerRunning || timerPaused}
                style={{ ...btnGhost, opacity: !meIsHost || !timerRunning || timerPaused ? 0.5 : 1 }}
              >
                Pause
              </button>
              <button
                onClick={resumeTimerPlus5}
                disabled={!meIsHost || !timerRunning || !timerPaused}
                style={{ ...btnGhost, opacity: !meIsHost || !timerRunning || !timerPaused ? 0.5 : 1 }}
              >
                Fortfahren (+5s)
              </button>
            </div>
          </section>
        </div>
      )}

      {phase === "results" && (
        <section style={panel}>
          <div style={{ fontWeight: 900, fontSize: 18, marginBottom: 10 }}>Draft fertig ✅</div>
          <div style={{ opacity: 0.85, marginBottom: 10 }}>
            Jetzt kann jeder sein Team in der ROM nachbauen.
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 }}>
            {draft.teamIds.map((tid) => {
              const team = draft.teams?.[tid] ?? [];
              const money = draft.budgets?.[tid] ?? 0;
              const free = teamIsFree(tid);
              return (
                <div
                  key={tid}
                  style={{
                    ...playerCard,
                    borderColor: free ? "rgba(239,68,68,0.35)" : "rgba(34,197,94,0.35)",
                    background: free ? "rgba(239,68,68,0.05)" : "rgba(34,197,94,0.05)",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                    <div style={{ fontWeight: 900 }}>{teamTitle(tid)}</div>
                    <div style={{ fontWeight: 900, opacity: 0.9 }}>{money}€ übrig</div>
                  </div>

                  <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
                    {team.length === 0 ? (
                      <div style={{ opacity: 0.7 }}>Keine Pokémon</div>
                    ) : (
                      team.map((p, idx) => (
                        <div key={`${tid}-${idx}`} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <img
                            src={dexIdToImageUrl(p.dexId)}
                            alt={p.name}
                            width={44}
                            height={44}
                            style={{ imageRendering: "pixelated" }}
                          />
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 900 }}>{p.name}</div>
                            <div style={{ opacity: 0.8, fontSize: 12 }}>Preis: {p.price}€</div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}

function Row({ label, children }) {
  return (
    <label style={{ display: "grid", gridTemplateColumns: "220px 1fr", gap: 10, alignItems: "center" }}>
      <span style={{ opacity: 0.85 }}>{label}</span>
      {children}
    </label>
  );
}

const outer = {
  width: "100%",
  height: "100%",
  display: "grid",
  gap: 10,
  overflow: "hidden",
};

const topLine = {
  display: "flex",
  flexDirection: "column",
  gap: 2,
  padding: "6px 0",
};

const panel = {
  padding: 12,
  border: "1px solid rgba(255,255,255,0.12)",
  borderRadius: 12,
  background: "rgba(0,0,0,0.15)",
};

const auctionGrid = {
  display: "grid",
  gridTemplateColumns: "1.6fr 1fr",
  gap: 10,
  alignItems: "start",
};

const playerCard = {
  padding: 12,
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.14)",
  background: "rgba(255,255,255,0.04)",
};

const teamSlotCard = {
  padding: 12,
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.14)",
  background: "rgba(255,255,255,0.04)",
};

const timerBig = {
  fontSize: 40,
  fontWeight: 900,
  letterSpacing: 1,
  marginBottom: 6,
};

const input = {
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.18)",
  background: "rgba(255,255,255,0.06)",
  color: "white",
  outline: "none",
};

const btnPrimary = {
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.28)",
  background: "rgba(255,255,255,0.16)",
  color: "white",
  cursor: "pointer",
  fontWeight: 900,
};

const btnGhost = {
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.18)",
  background: "rgba(255,255,255,0.06)",
  color: "white",
  cursor: "pointer",
  fontWeight: 800,
};
