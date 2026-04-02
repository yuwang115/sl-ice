/**
 * Parameter slider with default marker, tooltip, and drag feedback.
 */

import { useState, type ReactNode } from 'react';

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
  defaultValue?: number;
  tooltip?: string;
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
  defaultValue,
  tooltip,
}: ParameterSliderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const displayValue = formatValue ? formatValue(value) : value.toFixed(1);
  const percentage = ((value - min) / (max - min)) * 100;
  const defaultPercentage =
    defaultValue !== undefined ? ((defaultValue - min) / (max - min)) * 100 : undefined;

  return (
    <div className="mb-4">
      <div className="flex items-center justify-between mb-1.5">
        <span className="flex items-center text-xs" style={{ color: 'var(--text-muted)' }}>
          {label}
          {tooltip && <SliderTooltip text={tooltip} />}
        </span>
        <span className="font-data text-sm font-medium" style={{ color }}>
          {displayValue}
          <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
            {unit}
          </span>
        </span>
      </div>
      <div className="relative">
        {/* Default value tick */}
        {defaultPercentage !== undefined && (
          <div
            className="absolute top-1/2 -translate-y-1/2 pointer-events-none z-[1]"
            style={{
              left: `${defaultPercentage}%`,
              width: 2,
              height: 10,
              background: 'var(--text-muted)',
              opacity: 0.35,
              borderRadius: 1,
            }}
          />
        )}

        {/* Drag tooltip */}
        {isDragging && (
          <div
            className="absolute -top-7 -translate-x-1/2 pointer-events-none font-data text-[10px] font-medium rounded px-1.5 py-0.5 z-10"
            style={{
              left: `${percentage}%`,
              background: 'var(--bg-panel-solid)',
              border: '1px solid var(--border)',
              boxShadow: 'var(--shadow-sm)',
              color,
            }}
          >
            {displayValue}{unit}
          </div>
        )}

        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          onPointerDown={() => setIsDragging(true)}
          onPointerUp={() => setIsDragging(false)}
          onPointerCancel={() => setIsDragging(false)}
          className="w-full cursor-pointer"
          style={{
            background: `linear-gradient(to right, ${color} 0%, ${color} ${percentage}%, var(--slider-track-bg) ${percentage}%, var(--slider-track-bg) 100%)`,
          }}
        />
      </div>
    </div>
  );
}

function SliderTooltip({ text }: { text: string }): ReactNode {
  return (
    <span className="group relative inline-flex ml-1 cursor-help">
      <span
        className="flex h-3.5 w-3.5 items-center justify-center rounded-full text-[8px] font-bold"
        style={{
          border: '1px solid var(--border)',
          color: 'var(--text-muted)',
        }}
      >
        i
      </span>
      <span
        className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-44 rounded-lg p-2 text-[11px] leading-snug opacity-0 group-hover:opacity-100 transition-opacity z-50"
        style={{
          background: 'var(--bg-panel-solid)',
          border: '1px solid var(--border)',
          boxShadow: 'var(--shadow-md)',
          color: 'var(--text-secondary)',
        }}
      >
        {text}
      </span>
    </span>
  );
}
