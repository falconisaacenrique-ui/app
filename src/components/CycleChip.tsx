interface Props<T extends string> {
  value: T;
  options: readonly T[];
  format: (value: T) => string;
  label: string;
  active?: boolean;
  onChange: (value: T) => void;
}

/** A chip that cycles through its options on tap — fast, thumb-friendly input. */
export default function CycleChip<T extends string>({
  value,
  options,
  format,
  label,
  active,
  onChange,
}: Props<T>) {
  const idx = options.indexOf(value);
  return (
    <button
      type="button"
      className={`chip ${active ? 'active' : ''}`}
      aria-label={label}
      title={label}
      onClick={() => onChange(options[(idx + 1) % options.length])}
    >
      {format(value)}
    </button>
  );
}
