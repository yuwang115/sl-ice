/**
 * Real World region selector — pick an Antarctic flowline to simulate.
 */

import { useGameStore } from '../../store/game-store';
import { usePhysicsStore } from '../../store/physics-store';
import { useUIStore } from '../../store/ui-store';

interface RegionDef {
  id: string;
  scenario: string;
  name_en: string;
  name_zh: string;
  location_en: string;
  location_zh: string;
  sea_level_m: number;
  desc_en: string;
  desc_zh: string;
  variant: 'blue' | 'red' | 'teal';
}

const regions: RegionDef[] = [
  {
    id: 'wilkes',
    scenario: 'wilkes_flowline',
    name_en: 'Wilkes Subglacial Basin',
    name_zh: '\u5a01\u5c14\u514b\u65af\u51b0\u4e0b\u76c6\u5730',
    location_en: 'East Antarctica',
    location_zh: '\u4e1c\u5357\u6781',
    sea_level_m: 3.8,
    desc_en: 'A massive basin behind a narrow coastal ridge. If breached, irreversible retreat could raise sea level by nearly 4 meters.',
    desc_zh: '\u6cbf\u6d77\u7a84\u810a\u540e\u65b9\u7684\u5de8\u5927\u76c6\u5730\u3002\u4e00\u65e6\u7a81\u7834\uff0c\u4e0d\u53ef\u9006\u9000\u7f29\u53ef\u80fd\u4f7f\u6d77\u5e73\u9762\u4e0a\u5347\u8fd14\u7c73\u3002',
    variant: 'blue',
  },
  {
    id: 'thwaites',
    scenario: 'thwaites_flowline',
    name_en: 'Thwaites Glacier',
    name_zh: '\u601d\u97e6\u8328\u51b0\u5ddd',
    location_en: 'West Antarctica',
    location_zh: '\u897f\u5357\u6781',
    sea_level_m: 0.65,
    desc_en: 'The "Doomsday Glacier" \u2014 its bed deepens inland, making it a textbook case of Marine Ice Sheet Instability.',
    desc_zh: '\u201c\u672b\u65e5\u51b0\u5ddd\u201d\u2014\u2014\u57fa\u5ca9\u5411\u5185\u9646\u52a0\u6df1\uff0c\u662f\u6d77\u6d0b\u51b0\u76d6\u4e0d\u7a33\u5b9a\u6027\u7684\u6559\u79d1\u4e66\u6848\u4f8b\u3002',
    variant: 'red',
  },
  {
    id: 'totten',
    scenario: 'totten_flowline',
    name_en: 'Totten Glacier',
    name_zh: '\u6258\u6ee5\u51b0\u5ddd',
    location_en: 'East Antarctica',
    location_zh: '\u4e1c\u5357\u6781',
    sea_level_m: 3.5,
    desc_en: 'Warm ocean water infiltrates through deep channels. Subglacial hydrology plays a key role in its vulnerability.',
    desc_zh: '\u6696\u6d0b\u6d41\u901a\u8fc7\u6df1\u6c34\u9053\u5165\u4fb5\u3002\u51b0\u4e0b\u6c34\u6587\u5728\u5176\u8106\u5f31\u6027\u4e2d\u8d77\u5173\u952e\u4f5c\u7528\u3002',
    variant: 'teal',
  },
];

const variantStyles: Record<string, { bg: string; border: string }> = {
  blue: { bg: 'var(--card-accent-blue)', border: 'var(--card-border-blue)' },
  red: { bg: 'var(--card-accent-red)', border: 'var(--card-border-red)' },
  teal: { bg: 'var(--card-accent-teal)', border: 'var(--card-border-teal)' },
};

export default function RealWorldSelector() {
  const { setMode, selectRegion, setRunning } = useGameStore();
  const { loadScenario } = usePhysicsStore();
  const language = useUIStore((s) => s.language);
  const isZh = language === 'zh';

  const handleSelect = async (region: RegionDef) => {
    try {
      const resp = await fetch(`/data/scenarios/${region.scenario}.json`);
      const config = await resp.json();
      loadScenario(config);
      selectRegion(region.id);
      setRunning(true);
    } catch (err) {
      console.error('Failed to load real-world scenario:', err);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center h-full p-8">
      <h2 className="text-3xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
        {isZh ? '\u771f\u5b9e\u4e16\u754c' : 'Real World'}
      </h2>
      <p className="text-sm mb-10 max-w-lg text-center" style={{ color: 'var(--text-secondary)' }}>
        {isZh
          ? '\u9009\u62e9\u4e00\u4e2a\u771f\u5b9e\u7684\u5357\u6781\u51b0\u5ddd\u6d41\u7ebf\uff0c\u8fd0\u884c\u57fa\u4e8e\u5b9e\u9645\u5730\u5f62\u7684\u6a21\u62df\u3002'
          : 'Choose a real Antarctic flowline and run a simulation based on actual terrain data.'}
      </p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 max-w-4xl w-full">
        {regions.map((region) => {
          const vs = variantStyles[region.variant];
          return (
            <button
              key={region.id}
              onClick={() => handleSelect(region)}
              className="glass-card group text-left p-5"
              style={{
                background: vs.bg,
                borderColor: vs.border,
              }}
            >
              <h3 className="text-base font-semibold mb-1 group-hover:text-[var(--accent)] transition-colors" style={{ color: 'var(--text-primary)' }}>
                {isZh ? region.name_zh : region.name_en}
              </h3>
              <p className="font-data text-[10px] uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>
                {isZh ? region.location_zh : region.location_en}
              </p>
              <p className="text-xs leading-relaxed mb-3" style={{ color: 'var(--text-secondary)' }}>
                {isZh ? region.desc_zh : region.desc_en}
              </p>
              <div
                className="inline-flex items-center gap-1.5 font-data text-[11px] px-2 py-0.5 rounded-full"
                style={{ background: 'var(--badge-bg)', border: '1px solid var(--badge-border)', color: 'var(--badge-text)' }}
              >
                {'\u223c'} {region.sea_level_m} m SLE
              </div>
            </button>
          );
        })}
      </div>

      <button
        onClick={() => setMode('menu')}
        className="mt-10 text-sm transition-colors"
        style={{ color: 'var(--text-muted)' }}
        onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-secondary)')}
        onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
      >
        {'\u2190'} {isZh ? '\u8fd4\u56de\u83dc\u5355' : 'Back to menu'}
      </button>
    </div>
  );
}
