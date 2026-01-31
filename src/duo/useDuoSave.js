import { useEffect, useMemo, useState, useCallback } from "react";
import { subscribeDuoRoom, updateDuoSave, touchDuoPresence } from "./duoService";

export function useDuoSave(roomId) {
  const [room, setRoom] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const id = String(roomId || "").trim().toUpperCase();
    if (!id) return;

    setError("");

    const unsub = subscribeDuoRoom(id, (data) => {
      if (!data) {
        setRoom(null);
        return;
      }
      if (data.__error) {
        setError(data.__error);
        return;
      }
      setRoom(data);
    });

    return () => unsub && unsub();
  }, [roomId]);

  useEffect(() => {
    const id = String(roomId || "").trim().toUpperCase();
    if (!id) return;

    let timer = null;

    const touch = async (online) => {
      try {
        await touchDuoPresence(id, { online });
      } catch (e) {
        console.warn("presence touch failed:", e?.message || e);
      }
    };

    touch(true);

    timer = setInterval(() => touch(true), 25000);

    const onFocus = () => touch(true);

    const onVisibility = () => {
      if (document.visibilityState === "hidden") touch(false);
      else touch(true);
    };
    const onBeforeUnload = () => touch(false);

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("beforeunload", onBeforeUnload);

    return () => {
      if (timer) clearInterval(timer);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("beforeunload", onBeforeUnload);
      touch(false);
    };
  }, [roomId]);

  const save = useMemo(() => room?.save || null, [room]);

  const patchSave = useCallback(
    async (patch) => {
      const id = String(roomId || "").trim().toUpperCase();
      if (!id) throw new Error("Kein Duo Room aktiv.");
      await updateDuoSave(id, patch);
    },
    [roomId]
  );

  return { room, save, patchSave, error };
}
