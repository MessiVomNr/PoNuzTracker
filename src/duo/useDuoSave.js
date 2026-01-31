import { useEffect, useMemo, useState, useCallback } from "react";
import { subscribeDuoRoom, updateDuoSave } from "./duoService";

/**
 * Liest den Duo-Run live aus Firestore und bietet eine update-Funktion.
 * - roomId: activeDuoRoomId
 * - save: { encounters, team, gymsDefeated, edition, linkMode, ... }
 */
export function useDuoSave(roomId) {
  const [room, setRoom] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!roomId) return;
    setError("");

    const unsub = subscribeDuoRoom(roomId, (data) => {
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

  const save = useMemo(() => room?.save || null, [room]);

  const patchSave = useCallback(
    async (patch) => {
      if (!roomId) throw new Error("Kein Duo Room aktiv.");
      await updateDuoSave(roomId, patch);
    },
    [roomId]
  );

  return { room, save, patchSave, error };
}
