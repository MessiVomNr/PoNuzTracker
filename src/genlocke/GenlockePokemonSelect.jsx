import React, { useMemo } from "react";
import CreatableSelect from "react-select/creatable";
import { versionToPokedex } from "../data/versionToPokedex";

// Same searchable, creatable Select component as the normal encounter table.
// The options come from the same edition-specific Pokédex, including randomizer
// Pokémon beyond the vanilla regional Pokédex when supplied by the version map.
export function genlockePokemonOptionsForEdition(edition) {
  const dex = versionToPokedex[edition] || {};
  return [...new Set(Object.values(dex).filter(Boolean))]
    .map(name => ({ value: name, label: name }));
}

export default function GenlockePokemonSelect({
  edition, value = "", onChange, placeholder = "Pokémon eingeben …",
  disabled = false, ariaLabel = "Pokémon auswählen",
}) {
  const options = useMemo(() => genlockePokemonOptionsForEdition(edition), [edition]);
  const selected = value ? options.find(option => option.value === value)
    || { value, label: value } : null;

  const styles = {
    control: (base, state) => ({
      ...base, minHeight: 40, borderRadius: 10, cursor: "text",
      background: "linear-gradient(130deg,#233655,#172842)",
      color: "#f3f7ff",
      borderColor: state.isFocused ? "#8baef0" : "#577098",
      boxShadow: state.isFocused ? "0 0 0 2px rgba(115,163,250,.22)" : "none",
    }),
    singleValue: base => ({ ...base, color: "#f4f7ff", fontWeight: 750 }),
    input: base => ({ ...base, color: "#fff" }),
    placeholder: base => ({ ...base, color: "#afc1df" }),
    menu: base => ({
      ...base, background: "#16253f", border: "1px solid #506790",
      borderRadius: 10, overflow: "hidden", zIndex: 1000020,
      boxShadow: "0 18px 45px #0007",
    }),
    menuPortal: base => ({ ...base, zIndex: 1000020 }),
    option: (base, state) => ({
      ...base, cursor: "pointer", fontWeight: 720,
      color: "#f1f5ff",
      background: state.isSelected ? "#315d8b" : state.isFocused ? "#263f64" : "transparent",
    }),
    noOptionsMessage: base => ({ ...base, color: "#a9bbda" }),
  };

  return (
    <CreatableSelect
      aria-label={ariaLabel}
      value={selected}
      options={options}
      isSearchable
      isClearable
      isDisabled={disabled}
      placeholder={placeholder}
      menuPlacement="auto"
      menuPosition="fixed"
      menuPortalTarget={document.body}
      formatCreateLabel={name => `"${name}" verwenden`}
      onChange={choice => onChange(choice?.value || "")}
      styles={styles}
    />
  );
}
