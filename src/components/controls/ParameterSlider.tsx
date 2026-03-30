/**
 * Parameter slider component for user controls.
 */

interface ParameterSliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  onChange: (value: number) => void;
  formatValue?: (value: number) => string;
  color?: string;
}

export default function ParameterSlider({
  label,
  value,
  min,
  max,
  step,
  unit,
  onChange,
  formatValue,
  color = 'var(--accent-light)',
}: ParameterSliderProps) {
  const displayValue = formatValue ? formatValue(value) : value.toFixed(1);
  const percentage = ((value - min) / (max - min)) * 100;

  return (
    <div className="mb-4">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
          {label}
        </span>
        <span className="font-data text-xs font-medium" style={{ color }}>
          {displayValue}{unit}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full cursor-pointer"
        style={{
          background: `linear-gradient(to right, ${color} 0%, ${color} ${percentage}%, var(--slider-track-bg) ${percentage}%, var(--slider-track-bg) 100%)`,
        }}
      />
    </div>
  );
}
