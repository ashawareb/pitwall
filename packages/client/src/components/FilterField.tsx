interface FilterFieldProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

// Plain controlled input. No debounce — substring matching against typical
// session counts is cheap and the spec rules debounce out explicitly.
export default function FilterField({
  value,
  onChange,
  placeholder,
}: FilterFieldProps) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      spellCheck={false}
      autoComplete="off"
      className="w-full rounded-interactive bg-pw-bg-panel-hover px-2 py-1 text-ui text-pw-fg-primary placeholder:text-pw-fg-faint outline-none focus:ring-1 focus:ring-pw-accent"
      style={{ border: '0.5px solid rgba(255,255,255,0.08)' }}
    />
  );
}
