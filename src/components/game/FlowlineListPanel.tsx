/**
 * Scrollable Antarctic flow line list with search, filter, and simulate.
 * Supports bidirectional hover/selection sync with the 3D scene.
 */

import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useUIStore } from '../../store/ui-store';

export interface FlowlineCatalogEntry {
  id: string;
  scenario: string;
  name_en: string;
  name_zh: string;
  description_en: string;
  description_zh: string;
  region: string;
  basin: string;
  group_id?: string;
  group_name_en?: string;
  group_name_zh?: string;
  line_index?: number;
  location_en: string;
  location_zh: string;
  domain_length: number;
  max_speed: number;
  min_bed: number;
  max_thickness: number;
  sea_level_potential: number;
  has_retrograde: boolean;
  has_floating: boolean;
  enable_hydrology: boolean;
  color: string;
  key_facts_en: string[];
  key_facts_zh: string[];
  geometry_spacing_km?: number;
  /** Spatial path as [lon, lat] pairs for 3D rendering. */
  path_lonlat: [number, number][];
  /** Seed point (inland start) as [lon, lat]. */
  seed_lonlat: [number, number];
}

interface FlowlineListPanelProps {
  catalog: FlowlineCatalogEntry[];
  onSimulate: (entry: FlowlineCatalogEntry) => void;
  /** Currently hovered flowline id (from 3D scene). */
  hoveredFlowlineId?: string | null;
  /** Currently selected flowline id (from 3D scene). */
  selectedFlowlineId?: string | null;
  /** Called when user hovers a row. */
  onHover?: (id: string | null) => void;
  /** Called when user clicks a row to select. */
  onSelect?: (id: string | null) => void;
}

type RegionFilter = 'all' | 'west' | 'east' | 'peninsula';

const regionLabels: Record<RegionFilter, [string, string]> = {
  all: ['All', '\u5168\u90e8'],
  west: ['West', '\u897f\u5357\u6781'],
  east: ['East', '\u4e1c\u5357\u6781'],
  peninsula: ['Peninsula', '\u534a\u5c9b'],
};

const regionColors: Record<string, string> = {
  west: '#ef4444',
  east: '#3b82f6',
  peninsula: '#f59e0b',
};

export default function FlowlineListPanel({
  catalog, onSimulate,
  hoveredFlowlineId, selectedFlowlineId,
  onHover, onSelect,
}: FlowlineListPanelProps) {
  const language = useUIStore((s) => s.language);
  const isZh = language === 'zh';

  const [search, setSearch] = useState('');
  const [regionFilter, setRegionFilter] = useState<RegionFilter>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const rowRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // Auto-expand and scroll to selected flowline (from 3D scene click)
  useEffect(() => {
    if (selectedFlowlineId) {
      // Keep the panel expansion in sync with scene-driven selection.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setExpandedId(selectedFlowlineId);
      const el = rowRefs.current[selectedFlowlineId];
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }
  }, [selectedFlowlineId]);

  const filtered = useMemo(() => {
    let items = catalog;
    if (regionFilter !== 'all') {
      items = items.filter(f => f.region === regionFilter);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      items = items.filter(f =>
        f.name_en.toLowerCase().includes(q) ||
        f.name_zh.includes(q) ||
        f.basin.toLowerCase().includes(q) ||
        f.group_name_en?.toLowerCase().includes(q) ||
        f.group_name_zh?.includes(q) ||
        f.location_en.toLowerCase().includes(q) ||
        f.location_zh.includes(q)
      );
    }
    return items;
  }, [catalog, regionFilter, search]);

  const handleToggle = useCallback((id: string) => {
    setExpandedId(prev => prev === id ? null : id);
  }, []);

  return (
    <div
      className="glass-panel flex flex-col h-full"
      style={{ width: 340, borderRadius: 0, borderLeft: '1px solid var(--border)' }}
    >
      {/* Header */}
      <div className="px-4 pt-4 pb-2">
        <h2 className="text-sm font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
          {isZh ? '\u51b0\u6d41\u7ebf\u9009\u62e9' : 'Flow Lines'}
          <span className="font-data text-[10px] ml-2" style={{ color: 'var(--text-muted)' }}>
            {filtered.length}/{catalog.length}
          </span>
        </h2>

        {/* Search */}
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder={isZh ? '\u641c\u7d22\u51b0\u5ddd...' : 'Search glacier...'}
          className="w-full px-3 py-1.5 text-xs rounded-lg mb-2"
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            color: 'var(--text-primary)',
            outline: 'none',
          }}
        />

        {/* Region filter */}
        <div className="flex gap-1">
          {(Object.keys(regionLabels) as RegionFilter[]).map(key => (
            <button
              key={key}
              onClick={() => setRegionFilter(key)}
              className={`pill-btn text-[10px] py-0.5 px-2 ${regionFilter === key ? 'active' : ''}`}
            >
              {isZh ? regionLabels[key][1] : regionLabels[key][0]}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto px-2 pb-2">
        {filtered.map(fl => {
          const isExpanded = expandedId === fl.id;
          const isHovered3D = hoveredFlowlineId === fl.id;
          const isSelected3D = selectedFlowlineId === fl.id;
          const highlighted = isHovered3D || isSelected3D;

          return (
            <div
              key={fl.id}
              ref={(el) => { rowRefs.current[fl.id] = el; }}
              className="mb-1.5 rounded-xl transition-all"
              style={{
                background: isSelected3D
                  ? 'var(--bg-card-hover)'
                  : isHovered3D
                    ? 'var(--bg-card)'
                    : isExpanded
                      ? 'var(--bg-card-hover)'
                      : 'transparent',
                border: highlighted || isExpanded
                  ? `1px solid ${isSelected3D ? fl.color : 'var(--border-hover)'}`
                  : '1px solid transparent',
              }}
              onMouseEnter={() => onHover?.(fl.id)}
              onMouseLeave={() => onHover?.(null)}
            >
              {/* Compact row */}
              <button
                onClick={() => {
                  handleToggle(fl.id);
                  onSelect?.(fl.id);
                }}
                className="w-full text-left px-3 py-2 flex items-start gap-2 rounded-xl transition-colors"
                style={{ cursor: 'pointer' }}
                onMouseEnter={e => {
                  if (!isExpanded && !highlighted) e.currentTarget.style.background = 'var(--bg-card)';
                }}
                onMouseLeave={e => {
                  if (!isExpanded && !highlighted) e.currentTarget.style.background = 'transparent';
                }}
              >
                {/* Region dot */}
                <div
                  className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0"
                  style={{ background: regionColors[fl.region] || '#6b7280' }}
                />

                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                    {isZh ? fl.name_zh : fl.name_en}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="font-data text-[9px]" style={{ color: 'var(--text-muted)' }}>
                      {fl.domain_length} km
                    </span>
                    <span className="font-data text-[9px]" style={{ color: 'var(--text-muted)' }}>
                      {fl.max_speed} m/yr
                    </span>
                    <span className="font-data text-[9px]" style={{ color: 'var(--accent-warm)' }}>
                      ~{fl.sea_level_potential} m SLE
                    </span>
                  </div>
                </div>

                {/* Expand indicator */}
                <span
                  className="text-[10px] mt-1 flex-shrink-0 transition-transform"
                  style={{
                    color: 'var(--text-muted)',
                    transform: isExpanded ? 'rotate(90deg)' : 'rotate(0)',
                  }}
                >
                  {'\u25b6'}
                </span>
              </button>

              {/* Expanded detail */}
              {isExpanded && (
                <div className="px-3 pb-3 animate-in">
                  {/* Description */}
                  <p className="text-[11px] leading-relaxed mb-2 ml-4" style={{ color: 'var(--text-secondary)' }}>
                    {isZh ? fl.description_zh : fl.description_en}
                  </p>

                  {/* Stats */}
                  <div className="grid grid-cols-2 gap-1.5 mb-2 ml-4">
                    <MiniStat label={isZh ? '\u6700\u4f4e\u57fa\u5ca9' : 'Min Bed'} value={`${fl.min_bed} m`} />
                    <MiniStat label={isZh ? '\u6700\u5927\u51b0\u539a' : 'Max Ice'} value={`${fl.max_thickness} m`} />
                  </div>

                  {/* Tags */}
                  <div className="flex flex-wrap gap-1 mb-2 ml-4">
                    {fl.has_retrograde && (
                      <Tag label={isZh ? '\u9006\u5761' : 'Retrograde'} />
                    )}
                    {fl.has_floating && (
                      <Tag label={isZh ? '\u51b0\u67b6' : 'Ice shelf'} />
                    )}
                    {fl.enable_hydrology && (
                      <Tag label={isZh ? '\u6c34\u6587' : 'Hydrology'} />
                    )}
                  </div>

                  {/* Key facts */}
                  <ul className="space-y-0.5 mb-3 ml-4">
                    {(isZh ? fl.key_facts_zh : fl.key_facts_en).map((fact, i) => (
                      <li key={i} className="text-[10px] leading-relaxed flex gap-1" style={{ color: 'var(--text-secondary)' }}>
                        <span style={{ color: 'var(--accent)', flexShrink: 0 }}>{'\u2022'}</span>
                        {fact}
                      </li>
                    ))}
                  </ul>

                  {/* Simulate button */}
                  <button
                    onClick={(e) => { e.stopPropagation(); onSimulate(fl); }}
                    className="w-full ml-4 py-2 rounded-lg text-xs font-semibold transition-all"
                    style={{
                      width: 'calc(100% - 16px)',
                      background: 'var(--accent)',
                      color: '#fff',
                      border: 'none',
                      cursor: 'pointer',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = 'var(--shadow-sm)'; }}
                    onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; }}
                  >
                    {'\u25b6'} {isZh ? '\u5f00\u59cb\u6a21\u62df' : 'Start Simulation'}
                  </button>
                </div>
              )}
            </div>
          );
        })}

        {filtered.length === 0 && (
          <p className="text-center text-xs py-8" style={{ color: 'var(--text-muted)' }}>
            {isZh ? '\u672a\u627e\u5230\u5339\u914d\u7684\u51b0\u6d41\u7ebf' : 'No matching flow lines'}
          </p>
        )}
      </div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md px-2 py-1" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
      <p className="font-data text-[8px] uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{label}</p>
      <p className="font-data text-[10px] font-semibold" style={{ color: 'var(--text-primary)' }}>{value}</p>
    </div>
  );
}

function Tag({ label }: { label: string }) {
  return (
    <span
      className="font-data text-[8px] px-1.5 py-0.5 rounded-full"
      style={{ background: 'var(--badge-bg)', border: '1px solid var(--badge-border)', color: 'var(--badge-text)' }}
    >
      {label}
    </span>
  );
}
