import { Check as CheckIcon } from 'lucide-react';

interface Props {
  checked: boolean;
  onToggle: () => void;
  label: string;
}

/** Large animated check control — replaces tiny native checkboxes. */
export default function Check({ checked, onToggle, label }: Props) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      className={`check-circle ${checked ? 'on' : ''}`}
      onClick={onToggle}
    >
      <CheckIcon size={14} strokeWidth={2.5} />
    </button>
  );
}
