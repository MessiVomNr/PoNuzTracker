import React, { useMemo, useState } from "react";

export default function RunTitleBar({
  title,
  onSaveTitle, // async (newTitle) => void
}) {
  const cleanTitle = useMemo(() => String(title ?? "").trim(), [title]);
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(cleanTitle);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  // Wenn title von außen kommt und nicht gerade aktiv editiert wird, syncen
  React.useEffect(() => {
    if (!editing) setValue(cleanTitle);
  }, [cleanTitle, editing]);

  async function save() {
    setErr("");
    const next = String(value ?? "").trim();
    const finalTitle = next || "Unbenannter Online-Run";

    try {
      setBusy(true);
      await onSaveTitle?.(finalTitle);
      setEditing(false);
    } catch (e) {
      setErr(e?.message || String(e));
    } finally {
      setBusy(false);
    }
  }

  function cancel() {
    setErr("");
    setValue(cleanTitle);
    setEditing(false);
  }

  return (
    <div
      style={{
        border: "1px solid #222",
        borderRadius: 14,
        padding: "14px 14px",
        marginBottom: 12,
      }}
    >
      {!editing ? (
        <div style={{ position: "relative" }}>
          {/* Titel groß & zentriert */}
          <div
            style={{
              textAlign: "center",
              fontWeight: 900,
              fontSize: 28,
              lineHeight: 1.15,
              padding: "4px 44px", // Platz für Button rechts
              wordBreak: "break-word",
            }}
          >
            {cleanTitle || "Unbenannter Online-Run"}
          </div>

          {/* Umbenennen Button rechts oben */}
          <button
            onClick={() => setEditing(true)}
            title="Titel bearbeiten"
            style={{
              position: "absolute",
              top: 0,
              right: 0,
              padding: "8px 10px",
              borderRadius: 10,
            }}
          >
            ✏️
          </button>
        </div>
      ) : (
        <div style={{ textAlign: "center" }}>
          <div style={{ fontWeight: 800, fontSize: 18, marginBottom: 8 }}>Run umbenennen</div>

          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder='z. B. "Theo & Max - Rot Nuzlocke"'
            style={{
              width: "min(640px, 100%)",
              padding: 12,
              fontSize: 16,
              borderRadius: 12,
            }}
            disabled={busy}
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter") save();
              if (e.key === "Escape") cancel();
            }}
          />

          {err && <div style={{ color: "crimson", fontSize: 12, marginTop: 8 }}>{err}</div>}

          <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 10 }}>
            <button onClick={save} disabled={busy} title="Speichern">
              {busy ? "Speichere..." : "Speichern"}
            </button>
            <button onClick={cancel} disabled={busy} title="Abbrechen">
              Abbrechen
            </button>
          </div>

          <div style={{ opacity: 0.7, fontSize: 12, marginTop: 8 }}>
            Enter = Speichern · Esc = Abbrechen
          </div>
        </div>
      )}
    </div>
  );
}
