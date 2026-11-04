/**
 * Animated slide toggle switch.
 */

interface ToggleSwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  /** Shown greyed out and ignores clicks (e.g. fixed by the running challenge). */
  disabled?: boolean;
  /** Hover text, e.g. why the switch is disabled. */
  title?: string;
}

export default function ToggleSwitch({ checked, onChange, label, disabled = false, title }: ToggleSwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className="toggle-switch"
      disabled={disabled}
      title={title}
      style={disabled ? { opacity: 0.5, cursor: 'not-allowed' } : undefined}
      onClick={() => onChange(!checked)}
    />
  );
}
