// src/components/DarkSelect.jsx
import React from "react";

export default function DarkSelect({
  value,
  onChange,
  groups = [],
  placeholder,
  customOption, // z.B. { value: "Foo", label: "Benutzerdefiniert: Foo" }
  style,
  className = "",
}) {
  return (
    <select
      className={`darkSelect ${className}`.trim()}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={style}
    >
      {placeholder ? <option value="">{placeholder}</option> : null}

      {customOption ? <option value={customOption.value}>{customOption.label}</option> : null}

      {groups.map((g) => (
        <optgroup key={String(g.gen)} label={`Gen ${g.gen}`}>
          {(g.list || []).map((ed) => (
            <option key={ed} value={ed}>
              {ed}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}
