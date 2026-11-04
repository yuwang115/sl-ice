/**
 * Challenge definitions for all 7 levels.
 */

import type { ChallengeDefinition } from '../engine/types';

export const challenges: ChallengeDefinition[] = [
  // Challenge 1: The Balance
  {
    id: 1,
    name_en: 'The Balance',
    name_zh: '稳态之道',
    subtitle_en: 'Find equilibrium — keep the ice sheet stable for 500 years.',
    subtitle_zh: '找到平衡——让冰盖稳定500年。',
    description_en: 'The ocean around the ice sheet is already 1.5°C warmer than normal. Adjust ocean temperature and snowfall to keep the ice sheet volume within ±5% for 500 simulated years. Learn that an ice sheet is a dynamic equilibrium system.',
    description_zh: '冰盖周围的海洋已比正常温暖1.5°C。调节海洋温度和降雪，使冰盖体积在500模拟年内波动不超过±5%。理解冰盖是一个动态平衡系统。',
    difficulty: 1,
    scenario: 'scenario_a_stable',
    concepts: ['mass_balance', 'equilibrium'],
    // Untouched, the warm ocean costs ~8% of the volume in 500 years.
    initial_params: { T_ocean_delta: 1.5 },
    enable_hydrology: false,
    duration_years: 500,
    check_win: (state, elapsed) => {
      if (elapsed < 500) return false;
      const change = Math.abs(state.volume - state.initial_volume) / state.initial_volume;
      return change < 0.05;
    },
    check_lose: (state) => {
      const change = Math.abs(state.volume - state.initial_volume) / state.initial_volume;
      return change > 0.3; // Lost too much or gained too much
    },
  },

  // Challenge 2: Point of No Return
  {
    id: 2,
    name_en: 'Point of No Return',
    name_zh: '不归之路',
    subtitle_en: 'Can you prevent the grounding line from crossing the danger zone?',
    subtitle_zh: '你能阻止接地线越过危险区域吗？',
    description_en: 'The bedrock has a hidden retrograde slope, and the ocean has already warmed by 3°C. If the grounding line retreats too far down that slope, Marine Ice Sheet Instability takes over — and even cooling the climate won\'t bring the ice back.',
    description_zh: '基岩隐藏着逆坡，而海洋已经升温3°C。一旦接地线沿逆坡退得太远，海洋冰盖不稳定性将接管——即使降温也无法恢复冰盖。',
    difficulty: 3,
    scenario: 'scenario_b_misi',
    concepts: ['misi', 'retrograde_slope', 'tipping_point'],
    // Untouched, MISI starts at the sill after ~120 years and runs away. Back
    // to +0°C by year ~250 still stops it; by year 400 it no longer does.
    initial_params: { T_ocean_delta: 3 },
    enable_hydrology: false,
    duration_years: 1000,
    check_win: (state, elapsed) => {
      if (elapsed < 1000) return false;
      return !state.is_misi_active;
    },
    check_lose: (state) => state.hysteresis_locked,
  },

  // Challenge 3: The Cork
  {
    id: 3,
    name_en: 'The Cork',
    name_zh: '瓶塞效应',
    subtitle_en: 'Keep the ice shelf alive — it\'s the only thing holding back the ice.',
    subtitle_zh: '保住冰架——它是阻挡冰盖的唯一屏障。',
    description_en: 'You can only control ocean temperature, and the water is already 3°C warmer than normal. Warm water melts the ice shelf from below; the thinner the shelf, the less ice it holds back and the faster the grounded ice flows into the ocean. Keep sea-level rise below 10 cm for 500 years.',
    description_zh: '你只能控制海洋温度，而海水已比正常温暖3°C。暖水从下方融化冰架；冰架越薄，挡住的冰越少，接地冰流入海洋越快。让海平面上升在500年内保持在10厘米以下。',
    difficulty: 2,
    scenario: 'scenario_c_shelf',
    concepts: ['buttressing', 'ice_shelf', 'ocean_melt'],
    // Untouched, +3°C raises sea level ~17 cm in 500 years; +5°C passes 30 cm.
    initial_params: { T_ocean_delta: 3 },
    enable_hydrology: false,
    duration_years: 500,
    check_win: (state, elapsed) => {
      if (elapsed < 500) return false;
      return state.sea_level < 0.1;
    },
    check_lose: (state) => state.sea_level > 0.3,
  },

  // Challenge 4: Undercurrents
  {
    id: 4,
    name_en: 'Undercurrents',
    name_zh: '冰下暗流',
    subtitle_en: 'Subglacial water lubricates the ice — control the drainage.',
    subtitle_zh: '冰下水润滑冰盖——控制排水效率。',
    description_en: 'This level enables subglacial hydrology, and the drainage system starts out clogged. Low drainage efficiency means high water pressure, fast sliding, more frictional heat, more water — a positive feedback loop. Keep the volume change within ±4% for 500 years.',
    description_zh: '本关开启冰下水文模块，且排水系统一开始就被堵塞。低排水效率意味着高水压、快速滑动、更多摩擦生热、更多水——一个正反馈循环。让冰盖体积在500年内变化不超过±4%。',
    difficulty: 3,
    scenario: 'scenario_b_misi',
    concepts: ['hydrology', 'effective_pressure', 'positive_feedback'],
    // Untouched, the clogged bed loses 8% of the volume by year ~370; raising
    // drainage to 2–3 /yr within the first century keeps it within ±4%.
    initial_params: { enable_hydrology: true, drain_efficiency: 0.2 },
    enable_hydrology: true,
    duration_years: 500,
    check_win: (state, elapsed) => {
      if (elapsed < 500) return false;
      const change = Math.abs(state.volume - state.initial_volume) / state.initial_volume;
      return change < 0.04;
    },
    check_lose: (state) => {
      const change = (state.initial_volume - state.volume) / state.initial_volume;
      return change > 0.08;
    },
  },

  // Challenge 5: Save the Ice
  {
    id: 5,
    name_en: 'Save the Ice',
    name_zh: '拯救冰盖',
    subtitle_en: 'The ice sheet is on the edge. Can you pull it back?',
    subtitle_zh: '冰盖已在临界边缘。你能把它拉回来吗？',
    description_en: 'The climate has already warmed: +3°C in the atmosphere and +4°C in the ocean, and the grounding line is heading for the retrograde slope. Find the combination of cooling and snowfall that saves the ice sheet — and find it fast. Most people will fail — and learn that prevention is far easier than cure.',
    description_zh: '气候已经变暖：大气升温3°C，海洋升温4°C，接地线正朝逆坡退去。找到降温和增雪的组合来拯救冰盖——而且要快。大多数人会失败——并学到预防远比补救容易。',
    difficulty: 4,
    scenario: 'scenario_b_misi',
    concepts: ['hysteresis', 'irreversibility', 'tipping_point'],
    // Untouched, MISI starts within ~70 years and takes ~70% of the volume.
    // Only cooling the ocean below normal within ~two centuries saves it.
    initial_params: { T_atm_delta: 3, T_ocean_delta: 4 },
    enable_hydrology: false,
    duration_years: 1000,
    check_win: (state, elapsed) => {
      if (elapsed < 1000) return false;
      return !state.is_misi_active && state.volume > state.initial_volume * 0.8;
    },
    check_lose: (state) => state.hysteresis_locked,
  },

  // Challenge 6: The Geoengineers
  {
    id: 6,
    name_en: 'The Geoengineers',
    name_zh: '地球工程师',
    subtitle_en: 'Build a seafloor barrier to slow the collapse.',
    subtitle_zh: '建造海底屏障来延缓崩塌。',
    description_en: 'The ocean is 3.5°C warmer than normal. A barrier on the seafloor keeps warm water out of the cavity on its landward side, so it only helps between the grounding line and the open ocean. Place it and set its efficiency to keep the ice sheet from collapsing for 500 years, with the minimum intervention.',
    description_zh: '海洋比正常温暖3.5°C。海底屏障能把暖水挡在其陆侧的冰架空腔之外，因此只有放在接地线和开阔海洋之间才起作用。放置屏障并设定其效率，用最小的干预让冰盖500年不崩塌。',
    difficulty: 4,
    scenario: 'scenario_b_misi',
    concepts: ['geoengineering', 'intervention', 'ocean_circulation'],
    // The barrier starts under grounded ice, where it shields nothing; then
    // MISI starts within ~100 years. At the shelf front with ≥ 40% efficiency
    // it holds the grounding line on the sill.
    initial_params: {
      T_ocean_delta: 3.5,
      curtain_position: 400,
      curtain_efficiency: 0.5,
    },
    enable_hydrology: false,
    duration_years: 500,
    check_win: (state, elapsed) => {
      if (elapsed < 500) return false;
      return !state.is_misi_active && state.volume > state.initial_volume * 0.9;
    },
    check_lose: (state) => {
      const change = (state.initial_volume - state.volume) / state.initial_volume;
      return change > 0.3;
    },
  },

  // Challenge 7: The Butterfly (hidden)
  {
    id: 7,
    name_en: 'The Butterfly',
    name_zh: '蝴蝶效应',
    subtitle_en: 'Two worlds diverge from a 0.1°C difference.',
    subtitle_zh: '两个世界因0.1°C的差异而分道扬镳。',
    description_en: 'Run a world that sits just below a tipping point for 2000 years, then restart it 0.1°C warmer or cooler and compare the endings. This is why predicting ice sheet collapse requires ensemble modeling.',
    description_zh: '让一个刚好处在临界点之下的世界运行2000年，然后把它调暖或调冷0.1°C重新开始，比较两种结局。这就是为什么预测冰盖崩塌需要集合模拟。',
    difficulty: 3,
    scenario: 'scenario_b_misi',
    concepts: ['sensitivity', 'uncertainty', 'ensemble'],
    // After 2000 years the grounding line ends near 523 km at +1.4°C, 499 km at
    // +1.5°C and 444 km at +1.6°C, where MISI has set in (year ~1800).
    initial_params: { T_ocean_delta: 1.5 },
    enable_hydrology: false,
    duration_years: 2000,
    // Observational: watching the full run is the win.
    check_win: (_state, elapsed) => elapsed >= 2000,
    check_lose: () => false,
    unlock_condition: (completed) => completed.length >= 6,
  },

  // Challenge 8: The Cliff
  {
    id: 8,
    name_en: 'The Cliff',
    name_zh: '冰崖危机',
    subtitle_en: 'The shelf is gone. Now the cliffs are failing.',
    subtitle_zh: '冰架已经消失。现在冰崖正在崩塌。',
    description_en: 'With MICI enabled, ice cliffs collapse when they grow too tall to support their own weight. After the ice shelf disintegrates, the exposed cliff triggers a runaway positive feedback — especially on retrograde slopes where retreat exposes even thicker, taller ice. Can you slow the cascade?',
    description_zh: '启用MICI后，过高的冰崖会因自重超过冰的屈服强度而发生结构性崩塌。冰架解体后，暴露的冰崖触发失控的正反馈——尤其在逆坡上，退缩暴露出更厚、更高的冰。你能减缓这场连锁崩塌吗？',
    difficulty: 5,
    scenario: 'scenario_b_misi',
    concepts: ['mici', 'cliff_failure', 'positive_feedback', 'cascading_instability'],
    initial_params: {
      T_ocean_delta: 2,
      enable_mici: true,
      mici_sensitivity: 1.0,
    },
    enable_hydrology: false,
    duration_years: 500,
    check_win: (state, elapsed) => {
      if (elapsed < 500) return false;
      return state.sea_level < 1.0;
    },
    check_lose: (state) => state.sea_level > 3.0,
    unlock_condition: (completed) => completed.includes(3),
  },
];
