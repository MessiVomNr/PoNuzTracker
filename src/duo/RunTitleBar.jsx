import React, { useMemo, useState } from "react";

function PencilIcon({ size = 18 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      aria-hidden="true"
      focusable="false"
      style={{
        display: "block",
        filter:
          "drop-shadow(0 2px 5px rgba(0, 0, 0, 0.35)) drop-shadow(0 0 8px rgba(160, 190, 255, 0.14))",
      }}
    >
      <path
        d="M43.5 8.5L55.5 20.5L24.5 51.5L10.5 55.5L14.5 41.5L43.5 8.5Z"
        fill="rgba(255, 255, 255, 0.96)"
        stroke="rgba(220, 235, 255, 0.96)"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      <path
        d="M38.5 14.5L49.5 25.5"
        fill="none"
        stroke="rgba(82, 122, 190, 0.72)"
        strokeWidth="3.5"
        strokeLinecap="round"
      />
      <path
        d="M14.5 41.5L24.5 51.5"
        fill="none"
        stroke="rgba(82, 122, 190, 0.72)"
        strokeWidth="3.5"
        strokeLinecap="round"
      />
      <path
        d="M10.5 55.5L15.3 43.5L22.5 50.7L10.5 55.5Z"
        fill="rgba(67, 233, 123, 0.92)"
        stroke="rgba(210, 255, 230, 0.88)"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path
        d="M43.5 8.5L55.5 20.5L59 17C61 15 61 11.8 59 9.8L54.2 5C52.2 3 49 3 47 5L43.5 8.5Z"
        fill="rgba(255, 145, 88, 0.95)"
        stroke="rgba(255, 224, 205, 0.86)"
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const titleEditIconBtn = {
  width: 40,
  height: 40,
  padding: 0,
  borderRadius: 10,
  border: "1px solid rgba(150, 180, 235, 0.34)",
  background:
    "linear-gradient(145deg, rgba(42, 58, 92, 0.52), rgba(8, 14, 30, 0.54))",
  color: "white",
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  boxShadow:
    "0 10px 22px rgba(0, 0, 0, 0.18), inset 0 1px 0 rgba(255, 255, 255, 0.10)",
};

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
              ...titleEditIconBtn,
              position: "absolute",
              top: 2,
              right: 2,
            }}
          >
            <PencilIcon size={18} />
          </button>
        </div>
      ) : (
        <div style={{ textAlign: "center" }}>
          <div style={{ fontWeight: 800, fontSize: 18, marginBottom: 8 }}>Run umbenennen</div>

          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder='z. B. "Rot Nuzlocke"'
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
