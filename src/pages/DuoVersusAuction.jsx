import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { subscribeRoom } from "../versus/versusService"; // System A: versusRooms
import { db } from "../firebase";
import { doc, runTransaction, updateDoc, serverTimestamp } from "firebase/firestore";

import { makeShuffledPool, dexIdToImageUrl, getDexCapForGen } from "../utils/pokemonPool";
import { pokedex as fullPokedex } from "../data/pokedex.js";

function getPokemonName(dexId) {
  const key = `pokedex${dexId}`;
  return fullPokedex?.[key] ?? `#${dexId}`;
}

function labelPlayer(playerId, room) {
  const arr = room?.players || [];
  const p = arr.find((x) => x.id === playerId);
  return p?.displayName || playerId?.slice?.(0, 6) || String(playerId);
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

function ensureTeamOwners(count, prev = {}) {
  const next = { ...(prev || {}) };
  for (let i = 0; i < count; i++) {
    const tid = teamIdFor(i);
    if (!(tid in next)) next[tid] = null;
  }
  // trim extras
  for (const k of Object.keys(next)) {
    const idx = Number(String(k).replace("team", "")) - 1;
    if (Number.isFinite(idx) && idx >= count) delete next[k];
  }
  return next;
}

export default function DuoVersusAuction() {
  const nav = useNavigate();
  const { roomId: roomIdParam } = useParams();
  const roomId = String(roomIdParam || "").toUpperCase();

  const [room, setRoom] = useState(null);
  const [err, setErr] = useState("");

  // live room
  useEffect(() => {
    if (!roomId) return;
    setErr("");
    const unsub = subscribeRoom(roomId, (r) => setRoom(r));
    return () => unsub && unsub();
  }, [roomId]);

  const players = room?.players || [];
  const hostPlayerId = room?.hostPlayerId || "";

  const myPlayerId = useMemo(() => {
    return sessionStorage.getItem(`versus_player_${roomId}`) || "";
  }, [roomId]);

  const meIsHost = myPlayerId && hostPlayerId ? myPlayerId === hostPlayerId : false;

  // Guard: only valid in auction status
  useEffect(() => {
    if (!room) return;
    if (room.status !== "auction") {
      nav(`/versus/${roomId}`, { replace: true });
    }
  }, [room, roomId, nav]);

  const roomRef = useMemo(() => doc(db, "versusRooms", roomId), [roomId]);

  // ===== Shared Auction State in Firestore =====
  const auction = room?.versus?.auction || null;

  const phase = auction?.phase || "lobby"; // lobby | auction | results
  const settings = auction?.settings || {
    generation: 1,
    participants: 2,
    budgetPerTeam: 10000,
    totalPokemon: 12,
    secondsPerBid: 10,
  };

  const teamOwners = auction?.teamOwners || {};
  const draft = auction?.draft || {
    auctionCountDone: 0,
    current: null,

    teamIds: [],
    budgets: {},
    teams: {},

    pool: [],
    poolIndex: 0,
    totalPokemon: settings.totalPokemon,

    highestBid: 0,
    highestTeamId: null,
    hasStarted: false,
  };

  const timer = auction?.timer || { running: false, paused: false, remaining: settings.secondsPerBid };

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

  // Local-only input (ok to keep local)
  const [bidInput, setBidInput] = useState(100);

  // ===== Init auction state once (host) =====
  const didInitRef = useRef(false);
  useEffect(() => {
    if (!room || !meIsHost) return;
    if (didInitRef.current) return;
    if (room.status !== "auction") return;

    // if already exists, don't overwrite
    if (room?.versus?.auction) {
      didInitRef.current = true;
      return;
    }

    didInitRef.current = true;

    const initial = {
      phase: "lobby",
      settings: {
        generation: 1,
        participants: 2,
        budgetPerTeam: 10000,
        totalPokemon: 12,
        secondsPerBid: 10,
      },
      teamOwners: ensureTeamOwners(2, {}),
      draft: {
        auctionCountDone: 0,
        current: null,

        teamIds: [],
        budgets: {},
        teams: {},

        pool: [],
        poolIndex: 0,
        totalPokemon: 12,

        highestBid: 0,
        highestTeamId: null,
        hasStarted: false,
      },
      timer: { running: false, paused: false, remaining: 10 },
      updatedAt: serverTimestamp(),
    };

    updateDoc(roomRef, {
      "versus.auction": initial,
      "versus.phase": "auction",
      updatedAt: serverTimestamp(),
    }).catch(() => {});
  }, [room, meIsHost, roomRef]);

  // ===== Host updates settings (sync) =====
  async function updateSettings(partial) {
    if (!meIsHost) return;

    const nextSettings = { ...settings, ...partial };
    const count = Math.max(2, clampInt(nextSettings.participants, 2, 8));

    await updateDoc(roomRef, {
      "versus.auction.settings": nextSettings,
      "versus.auction.teamOwners": ensureTeamOwners(count, teamOwners),
      "versus.auction.updatedAt": serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }

  // ===== Team join/leave (sync, transaction) =====
  async function claimTeam(tid) {
    if (phase !== "lobby") return;
    if (!myPlayerId) return;

    await runTransaction(db, async (tx) => {
      const snap = await tx.get(roomRef);
      if (!snap.exists()) throw new Error("Room nicht gefunden.");

      const data = snap.data();
      const a = data?.versus?.auction;
      if (!a) throw new Error("Auction nicht initialisiert.");
      if (data.status !== "auction") throw new Error("Room nicht in Auction.");

      const s = a.settings || settings;
      const count = Math.max(2, clampInt(s.participants, 2, 8));
      const owners = ensureTeamOwners(count, a.teamOwners || {});

      // already in a team?
      if (Object.values(owners).some((pid) => pid === myPlayerId)) return;
      // team taken?
      if (owners[tid]) return;

      owners[tid] = myPlayerId;

      tx.update(roomRef, {
        "versus.auction.teamOwners": owners,
        "versus.auction.updatedAt": serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    });
  }

  async function leaveMyTeam() {
    if (phase !== "lobby") return;
    if (!myTeamId || !myPlayerId) return;

    await runTransaction(db, async (tx) => {
      const snap = await tx.get(roomRef);
      if (!snap.exists()) throw new Error("Room nicht gefunden.");

      const data = snap.data();
      const a = data?.versus?.auction;
      if (!a) throw new Error("Auction nicht initialisiert.");

      const owners = { ...(a.teamOwners || {}) };
      if (owners[myTeamId] !== myPlayerId) return;

      owners[myTeamId] = null;

      tx.update(roomRef, {
        "versus.auction.teamOwners": owners,
        "versus.auction.updatedAt": serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    });
  }

  // ===== Start Draft (host) =====
  async function startDraft() {
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

    // ensure owners exist
    const owners = ensureTeamOwners(participants, teamOwners);

    await updateDoc(roomRef, {
      "versus.auction.phase": "auction",
      "versus.auction.settings": { generation: gen, participants, budgetPerTeam, totalPokemon, secondsPerBid },
      "versus.auction.teamOwners": owners,
      "versus.auction.draft": {
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
      },
      "versus.auction.timer": { running: false, paused: false, remaining: secondsPerBid },
      "versus.auction.updatedAt": serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    setBidInput(100);
  }

  // ===== Bidding (transaction sync) =====
  function myBudget() {
    if (!myTeamId) return 0;
    return draft.budgets?.[myTeamId] ?? 0;
  }

  async function placeBid(amountRaw) {
    if (phase !== "auction") return;
    if (!draft.current) return;
    if (!myTeamId) return;
    if (!draft.teamIds.includes(myTeamId)) return;

    const amt = clampInt(amountRaw, 0, 999999999);
    if (amt < 100) return;
    if (amt % 100 !== 0) return;

    await runTransaction(db, async (tx) => {
      const snap = await tx.get(roomRef);
      if (!snap.exists()) throw new Error("Room nicht gefunden.");

      const data = snap.data();
      const a = data?.versus?.auction;
      if (!a) throw new Error("Auction nicht initialisiert.");
      if (a.phase !== "auction") return;

      const d = a.draft || {};
      const t = a.timer || {};
      const s = a.settings || settings;

      const cur = d.current;
      if (!cur) return;

      const teamIdsHere = d.teamIds || [];
      if (!teamIdsHere.includes(myTeamId)) return;

      const budgetsHere = d.budgets || {};
      const budget = budgetsHere[myTeamId] ?? 0;
      if (amt > budget) return;

      const highestBid = d.highestBid ?? 0;
      if (amt <= highestBid) return;

      tx.update(roomRef, {
        "versus.auction.draft.highestBid": amt,
        "versus.auction.draft.highestTeamId": myTeamId,
        "versus.auction.draft.hasStarted": true,
        "versus.auction.timer.paused": false,
        "versus.auction.timer.running": true,
        "versus.auction.timer.remaining": clampInt(s.secondsPerBid ?? 10, 5, 60),
        "versus.auction.updatedAt": serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    });
  }

  // ===== Host-only timer tick + award =====
  useEffect(() => {
    if (!meIsHost) return;
    if (phase !== "auction") return;
    if (!timer?.running) return;
    if (timer?.paused) return;

    const iv = setInterval(async () => {
      try {
        await runTransaction(db, async (tx) => {
          const snap = await tx.get(roomRef);
          if (!snap.exists()) return;
          const data = snap.data();
          const a = data?.versus?.auction;
          if (!a || a.phase !== "auction") return;

          const t = a.timer || {};
          if (!t.running || t.paused) return;

          const remaining = Number(t.remaining ?? 0);
          const next = remaining <= 0 ? 0 : remaining - 1;

          tx.update(roomRef, {
            "versus.auction.timer.remaining": next,
            "versus.auction.updatedAt": serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        });
      } catch {
        // ignore
      }
    }, 1000);

    return () => clearInterval(iv);
  }, [meIsHost, phase, timer?.running, timer?.paused, roomRef]);

  // When timer hits 0 -> host awards
  useEffect(() => {
    if (!meIsHost) return;
    if (phase !== "auction") return;
    if (!timer?.running) return;
    if (timer?.paused) return;
    if ((timer?.remaining ?? 0) > 0) return;

    (async () => {
      try {
        await runTransaction(db, async (tx) => {
          const snap = await tx.get(roomRef);
          if (!snap.exists()) return;

          const data = snap.data();
          const a = data?.versus?.auction;
          if (!a || a.phase !== "auction") return;

          const d = a.draft || {};
          const s = a.settings || settings;

          if (!d.hasStarted || !d.highestTeamId || !d.highestBid || !d.current) {
            // no valid bid -> stop timer
            tx.update(roomRef, {
              "versus.auction.timer.running": false,
              "versus.auction.updatedAt": serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
            return;
          }

          const winnerTeam = d.highestTeamId;
          const price = d.highestBid;
          const poke = d.current;

          const budgets = { ...(d.budgets || {}) };
          budgets[winnerTeam] = Math.max(0, (budgets[winnerTeam] ?? 0) - price);

          const teams = { ...(d.teams || {}) };
          const teamArr = Array.isArray(teams[winnerTeam]) ? [...teams[winnerTeam]] : [];
          teamArr.push({ dexId: poke.dexId, name: poke.name, price });
          teams[winnerTeam] = teamArr;

          const nextAuctionCount = (d.auctionCountDone ?? 0) + 1;
          const totalPokemon = d.totalPokemon ?? s.totalPokemon ?? 12;
          const done = nextAuctionCount >= totalPokemon;

          const nextPoolIndex = (d.poolIndex ?? 0) + 1;
          const nextDex = (d.pool || [])?.[nextPoolIndex] ?? null;
          const nextCurrent = nextDex
            ? { dexId: nextDex, name: getPokemonName(nextDex), imageUrl: dexIdToImageUrl(nextDex) }
            : null;

          if (done || !nextCurrent) {
            tx.update(roomRef, {
              "versus.auction.phase": "results",
              "versus.auction.draft": {
                ...d,
                budgets,
                teams,
                auctionCountDone: nextAuctionCount,
                current: null,
                hasStarted: false,
                highestBid: 0,
                highestTeamId: null,
              },
              "versus.auction.timer": { running: false, paused: false, remaining: 0 },
              "versus.auction.updatedAt": serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
            return;
          }

          const secondsPerBid = clampInt(s.secondsPerBid ?? 10, 5, 60);

          tx.update(roomRef, {
            "versus.auction.draft": {
              ...d,
              budgets,
              teams,
              auctionCountDone: nextAuctionCount,
              poolIndex: nextPoolIndex,
              current: nextCurrent,
              hasStarted: false,
              highestBid: 0,
              highestTeamId: null,
            },
            "versus.auction.timer": { running: false, paused: false, remaining: secondsPerBid },
            "versus.auction.updatedAt": serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        });
      } catch {
        // ignore
      }
    })();
  }, [meIsHost, phase, timer?.running, timer?.paused, timer?.remaining, roomRef, settings]);

  // ===== UI helpers =====
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

  // ===== Render Guards
  if (!roomId) return <div style={{ padding: 12 }}>Keine Room-ID in der URL.</div>;
  if (!room && !err) return <div style={{ padding: 12 }}>Lade Versus-Room …</div>;
  if (err) return <div style={{ padding: 12, color: "crimson" }}>{err}</div>;
  if (room === null) return <div style={{ padding: 12, color: "crimson" }}>Room nicht gefunden.</div>;

  return (
    <div style={outer}>
      <div style={topLine}>
        <div style={{ fontWeight: 900 }}>Versus — Auction Draft</div>
        <div style={{ opacity: 0.8, fontSize: 12 }}>
          Room: <b>{roomId}</b>
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
                        <div style={{ opacity: 0.85, fontWeight: 800 }}>{owner ? "belegt" : "frei"}</div>
                      </div>

                      <div style={{ marginTop: 6, fontWeight: 800 }}>{teamTitle(tid)}</div>

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
          {/* Teams */}
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

                    {free && <div style={{ fontSize: 12, opacity: 0.75 }}>(frei) — Teams werden in der Lobby belegt</div>}
                  </div>
                );
              })}
            </div>
          </section>

          {/* Current Pokémon */}
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

          {/* Timer + Bid */}
          <section style={{ ...panel, gridColumn: "2 / 3", height: "min(48vh, 420px)" }}>
            <div style={{ fontWeight: 900, marginBottom: 10 }}>Timer</div>

            <div style={timerBig}>{timer.running ? fmtSecs(timer.remaining) : "--"}</div>
            <div style={{ opacity: 0.8, marginBottom: 12 }}>
              {timer.running ? (timer.paused ? "Pausiert" : "Läuft") : "Startet bei erstem Gebot (≥ 100)"}
            </div>

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
                <button
                  style={btnGhost}
                  onClick={() => setBidInput((v) => Math.max(100, (v || 0) - 100))}
                  disabled={!myTeamId}
                >
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

            <div style={{ marginTop: 12, display: "grid", gap: 8 }}>
              <button
                onClick={async () => {
                  if (!meIsHost) return;
                  if (!timer.running || timer.paused) return;
                  await updateDoc(roomRef, {
                    "versus.auction.timer.paused": true,
                    "versus.auction.updatedAt": serverTimestamp(),
                    updatedAt: serverTimestamp(),
                  });
                }}
                disabled={!meIsHost || !timer.running || timer.paused}
                style={{ ...btnGhost, opacity: !meIsHost || !timer.running || timer.paused ? 0.5 : 1 }}
              >
                Pause
              </button>

              <button
                onClick={async () => {
                  if (!meIsHost) return;
                  if (!timer.running || !timer.paused) return;
                  await updateDoc(roomRef, {
                    "versus.auction.timer.paused": false,
                    "versus.auction.timer.remaining": (timer.remaining ?? 0) + 5,
                    "versus.auction.updatedAt": serverTimestamp(),
                    updatedAt: serverTimestamp(),
                  });
                }}
                disabled={!meIsHost || !timer.running || !timer.paused}
                style={{ ...btnGhost, opacity: !meIsHost || !timer.running || !timer.paused ? 0.5 : 1 }}
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
          <div style={{ opacity: 0.85, marginBottom: 10 }}>Jetzt kann jeder sein Team in der ROM nachbauen.</div>

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
                          <img src={dexIdToImageUrl(p.dexId)} alt={p.name} width={44} height={44} style={{ imageRendering: "pixelated" }} />
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
