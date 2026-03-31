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
    description_en: 'Adjust temperature and snowfall to keep the ice sheet volume within ±5% for 500 simulated years. Learn that an ice sheet is a dynamic equilibrium system.',
    description_zh: '调节温度和降雪，使冰盖体积在500模拟年内波动不超过±5%。理解冰盖是一个动态平衡系统。',
    difficulty: 1,
    scenario: 'scenario_a_stable',
    concepts: ['mass_balance', 'equilibrium'],
    initial_params: {},
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
    description_en: 'The bedrock has a hidden retrograde slope. If the grounding line retreats past it, Marine Ice Sheet Instability kicks in — and even cooling the climate won\'t bring the ice back.',
    description_zh: '基岩隐藏着逆坡。一旦接地线退过该处，海洋冰盖不稳定性将启动——即使降温也无法恢复冰盖。',
    difficulty: 3,
    scenario: 'scenario_b_misi',
    concepts: ['misi', 'retrograde_slope', 'tipping_point'],
    initial_params: {},
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
    description_en: 'You can only control ocean temperature. Warm water melts the ice shelf from below. Once the shelf is gone, the ice sheet accelerates into the ocean.',
    description_zh: '你只能控制海洋温度。暖水从下方融化冰架。一旦冰架消失，冰盖将加速涌入海洋。',
    difficulty: 2,
    scenario: 'scenario_c_shelf',
    concepts: ['buttressing', 'ice_shelf', 'ocean_melt'],
    initial_params: {},
    enable_hydrology: false,
    duration_years: 500,
    check_win: (state, elapsed) => {
      if (elapsed < 500) return false;
      return state.sea_level < 0.5;
    },
    check_lose: (state) => state.sea_level > 2.0,
  },

  // Challenge 4: Undercurrents
  {
    id: 4,
    name_en: 'Undercurrents',
    name_zh: '冰下暗流',
    subtitle_en: 'Subglacial water lubricates the ice — control the drainage.',
    subtitle_zh: '冰下水润滑冰盖——控制排水效率。',
    description_en: 'This level enables subglacial hydrology. Low drainage efficiency means high water pressure, fast sliding, more frictional heat, more water — a positive feedback loop.',
    description_zh: '本关开启冰下水文模块。低排水效率意味着高水压、快速滑动、更多摩擦生热、更多水——一个正反馈循环。',
    difficulty: 3,
    scenario: 'scenario_b_misi',
    concepts: ['hydrology', 'effective_pressure', 'positive_feedback'],
    initial_params: { enable_hydrology: true },
    enable_hydrology: true,
    duration_years: 500,
    check_win: (state, elapsed) => {
      if (elapsed < 500) return false;
      const change = Math.abs(state.volume - state.initial_volume) / state.initial_volume;
      return change < 0.15;
    },
    check_lose: (state) => {
      const change = (state.initial_volume - state.volume) / state.initial_volume;
      return change > 0.4;
    },
  },

  // Challenge 5: Save the Ice
  {
    id: 5,
    name_en: 'Save the Ice',
    name_zh: '拯救冰盖',
    subtitle_en: 'The ice sheet is on the edge. Can you pull it back?',
    subtitle_zh: '冰盖已在临界边缘。你能把它拉回来吗？',
    description_en: 'Starting near the tipping point, find the exact combination of cooling and increased snowfall to save the ice sheet. Most people will fail — and learn that prevention is far easier than cure.',
    description_zh: '从临界点附近开始，找到降温和增雪的精确组合来拯救冰盖。大多数人会失败——并学到预防远比补救容易。',
    difficulty: 4,
    scenario: 'scenario_b_misi',
    concepts: ['hysteresis', 'irreversibility', 'tipping_point'],
    initial_params: { T_atm_delta: 3, T_ocean_delta: 1.5 },
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
    description_en: 'Place a barrier on the seafloor to block warm water from reaching the grounding line. Use the minimum intervention to delay collapse by 500 years.',
    description_zh: '在海底放置屏障阻挡暖水到达接地线。用最小干预延缓崩塌500年。',
    difficulty: 4,
    scenario: 'scenario_b_misi',
    concepts: ['geoengineering', 'intervention', 'ocean_circulation'],
    initial_params: {
      T_ocean_delta: 2,
      curtain_position: 400,
      curtain_efficiency: 0.5,
    },
    enable_hydrology: false,
    duration_years: 500,
    check_win: (state, elapsed) => {
      if (elapsed < 500) return false;
      return state.volume > state.initial_volume * 0.7;
    },
    check_lose: (state) => {
      const change = (state.initial_volume - state.volume) / state.initial_volume;
      return change > 0.5;
    },
  },

  // Challenge 7: The Butterfly (hidden)
  {
    id: 7,
    name_en: 'The Butterfly',
    name_zh: '蝴蝶效应',
    subtitle_en: 'Two worlds diverge from a 0.01°C difference.',
    subtitle_zh: '两个世界因0.01°C的差异而分道扬镳。',
    description_en: 'Watch two nearly identical simulations diverge over centuries. This is why predicting ice sheet collapse requires ensemble modeling.',
    description_zh: '观察两个几乎相同的模拟在数百年后产生巨大分歧。这就是为什么预测冰盖崩塌需要集合模拟。',
    difficulty: 3,
    scenario: 'scenario_b_misi',
    concepts: ['sensitivity', 'uncertainty', 'ensemble'],
    initial_params: {},
    enable_hydrology: false,
    duration_years: 2000,
    check_win: () => false, // No win condition — observational
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
