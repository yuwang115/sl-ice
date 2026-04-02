/**
 * Achievement system store.
 * Tracks unlocked achievements with educational descriptions.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface AchievementDef {
  id: string;
  name_en: string;
  name_zh: string;
  description_en: string;
  description_zh: string;
  icon: string;
  category: 'beginner' | 'explorer' | 'mastery' | 'hidden';
  /** Educational insight revealed when unlocked */
  insight_en: string;
  insight_zh: string;
}

interface AchievementStore {
  unlocked: Record<string, number>; // id → timestamp
  pending: AchievementDef | null; // toast to show
  unlock: (id: string) => void;
  dismissToast: () => void;
  isUnlocked: (id: string) => boolean;
}

export const achievements: AchievementDef[] = [
  // Beginner
  {
    id: 'first_win',
    name_en: 'Glaciology 101',
    name_zh: '冰川学入门',
    description_en: 'Complete your first challenge',
    description_zh: '完成第一个挑战',
    icon: '🎓',
    category: 'beginner',
    insight_en: 'Welcome to ice sheet science! Each challenge teaches a real concept that glaciologists study.',
    insight_zh: '欢迎进入冰盖科学！每个挑战都教授冰川学家实际研究的概念。',
  },
  {
    id: 'first_fail',
    name_en: 'Learning Moment',
    name_zh: '成长时刻',
    description_en: 'Fail your first challenge — failure is part of learning',
    description_zh: '第一次失败——失败是学习的一部分',
    icon: '📚',
    category: 'beginner',
    insight_en: 'Scientists often learn more from failed experiments than successful ones. What went wrong?',
    insight_zh: '科学家经常从失败的实验中学到更多。哪里出了问题？',
  },
  {
    id: 'steady_rock',
    name_en: 'Steady as a Rock',
    name_zh: '稳如磐石',
    description_en: 'Get 3 stars on "The Balance"',
    description_zh: '在"稳态之道"中获得3星',
    icon: '⭐',
    category: 'beginner',
    insight_en: 'Maintaining ice sheet equilibrium requires balancing accumulation and ablation — the same challenge facing real ice sheets today.',
    insight_zh: '维持冰盖平衡需要平衡积累和消融——这正是现实中冰盖面临的挑战。',
  },
  {
    id: 'patient_observer',
    name_en: 'Patient Observer',
    name_zh: '耐心观察者',
    description_en: 'Watch "The Butterfly" for 2000 years',
    description_zh: '在"蝴蝶效应"中观看完整2000年',
    icon: '🦋',
    category: 'beginner',
    insight_en: 'Ensemble modeling runs hundreds of simulations with tiny variations to capture the range of possible futures.',
    insight_zh: '集合模拟运行数百次略有变化的模拟，以捕捉可能未来的范围。',
  },
  {
    id: 'all_overlays',
    name_en: 'Full Spectrum',
    name_zh: '全面了解',
    description_en: 'View all visualization overlays',
    description_zh: '查看所有可视化叠加层',
    icon: '🔬',
    category: 'beginner',
    insight_en: 'Scientists use strain rates, velocity profiles, and isochrones to understand ice flow — now you have too!',
    insight_zh: '科学家使用应变率、速度剖面和等时线来理解冰流——现在你也用了！',
  },

  // Explorer
  {
    id: 'param_tweaker',
    name_en: 'Parameter Tweaker',
    name_zh: '参数调音师',
    description_en: 'Adjust every parameter at least once in Sandbox mode',
    description_zh: '在沙盒模式中至少调整每个参数一次',
    icon: '🎛️',
    category: 'explorer',
    insight_en: 'Each parameter represents a real physical process. Understanding how they interact is key to predicting ice sheet behavior.',
    insight_zh: '每个参数都代表一个真实的物理过程。理解它们如何相互作用是预测冰盖行为的关键。',
  },
  {
    id: 'extremist',
    name_en: 'The Extremist',
    name_zh: '极端主义者',
    description_en: 'Set temperature to +20°C and observe the consequences',
    description_zh: '将温度设为+20°C并观察后果',
    icon: '🔥',
    category: 'explorer',
    insight_en: 'At +20°C, no ice sheet on Earth could survive. The last time temperatures were even 5°C warmer, sea level was 20m higher.',
    insight_zh: '在+20°C时，地球上没有冰盖能够存活。上一次温度哪怕只高5°C时，海平面就高了20米。',
  },
  {
    id: 'time_traveler',
    name_en: 'Time Traveler',
    name_zh: '时间旅行者',
    description_en: 'Simulate more than 10,000 total years',
    description_zh: '累计模拟超过10000年',
    icon: '⏳',
    category: 'explorer',
    insight_en: 'Ice sheets respond to climate over millennia. What we do today will still affect sea level thousands of years from now.',
    insight_zh: '冰盖在数千年的时间尺度上响应气候。我们今天的行为将在数千年后仍然影响海平面。',
  },
  {
    id: 'geoengineer',
    name_en: 'Geoengineering Pioneer',
    name_zh: '地球工程先驱',
    description_en: 'Win "The Geoengineers" challenge',
    description_zh: '通关"地球工程师"挑战',
    icon: '🏗️',
    category: 'explorer',
    insight_en: 'Seafloor barriers are a real proposal being studied by scientists — but they are a complement to emissions reduction, not a replacement.',
    insight_zh: '海底屏障是科学家正在研究的真实方案——但它们是减排的补充，而非替代。',
  },

  // Mastery
  {
    id: 'perfect_balance',
    name_en: 'Perfect Balance',
    name_zh: '完美平衡',
    description_en: 'Complete "The Balance" with volume deviation < 1%',
    description_zh: '完成"稳态之道"时体积偏差<1%',
    icon: '⚖️',
    category: 'mastery',
    insight_en: 'A 1% volume change in the Antarctic ice sheet would raise sea level by about 0.6 meters.',
    insight_zh: '南极冰盖1%的体积变化将使海平面上升约0.6米。',
  },
  {
    id: 'hundred',
    name_en: 'Perfection',
    name_zh: '满分',
    description_en: 'Score 100 on any challenge',
    description_zh: '在任意挑战中获得100分',
    icon: '💯',
    category: 'mastery',
    insight_en: 'You have deeply understood this aspect of ice sheet dynamics. Consider a career in glaciology!',
    insight_zh: '你已经深入理解了冰盖动力学的这一方面。考虑投身冰川学事业吧！',
  },
  {
    id: 'all_clear',
    name_en: 'All Clear',
    name_zh: '全通关',
    description_en: 'Complete all 8 challenges',
    description_zh: '完成全部8个挑战',
    icon: '🏆',
    category: 'mastery',
    insight_en: 'You now understand the major instability mechanisms threatening Earth\'s ice sheets. Share this knowledge!',
    insight_zh: '你现在理解了威胁地球冰盖的主要不稳定机制。传播这些知识！',
  },
  {
    id: 'grand_master',
    name_en: 'Grand Master',
    name_zh: '大师',
    description_en: 'Get 3 stars on every challenge',
    description_zh: '所有挑战获得3星',
    icon: '👑',
    category: 'mastery',
    insight_en: 'You have mastered ice sheet dynamics at a level that would impress professional glaciologists.',
    insight_zh: '你已经掌握了冰盖动力学，达到了令专业冰川学家印象深刻的水平。',
  },

  // Hidden
  {
    id: 'impossible_mission',
    name_en: 'Against All Odds',
    name_zh: '不可能的任务',
    description_en: 'Win "Save the Ice" — most people fail this one',
    description_zh: '通关"拯救冰盖"——大多数人会在这里失败',
    icon: '🎯',
    category: 'hidden',
    insight_en: 'Recovering an ice sheet from near-collapse requires extreme intervention. In reality, such recovery would take millennia.',
    insight_zh: '从接近崩塌的状态恢复冰盖需要极端干预。在现实中，这样的恢复需要数千年。',
  },
  {
    id: 'zero_intervention',
    name_en: 'Zero Intervention',
    name_zh: '零干预',
    description_en: 'Win "The Balance" without changing any parameters',
    description_zh: '不调任何参数就通关"稳态之道"',
    icon: '🧘',
    category: 'hidden',
    insight_en: 'Some ice sheets are naturally stable — they self-correct small perturbations. But this stability has limits.',
    insight_zh: '有些冰盖天然稳定——它们能自我修正小扰动。但这种稳定性有其极限。',
  },
  {
    id: 'last_second',
    name_en: 'Photo Finish',
    name_zh: '最后一秒',
    description_en: 'Win a challenge in the final 10 years',
    description_zh: '在最后10年内满足胜利条件',
    icon: '⏱️',
    category: 'hidden',
    insight_en: 'Cutting it close! In real life, delayed climate action means narrower margins for avoiding tipping points.',
    insight_zh: '好险！在现实中，推迟气候行动意味着避免临界点的余地更小。',
  },
  {
    id: 'sea_level_line',
    name_en: 'Rising Tides',
    name_zh: '潮起',
    description_en: 'Trigger the city_flooded event',
    description_zh: '触发城市洪水事件',
    icon: '🌊',
    category: 'hidden',
    insight_en: 'The cities that flood in this simulation house billions of people. Sea level rise is one of the most consequential impacts of ice sheet loss.',
    insight_zh: '在这个模拟中被淹的城市居住着数十亿人。海平面上升是冰盖损失最重要的影响之一。',
  },
];

export const useAchievementStore = create<AchievementStore>()(persist(
  (set, get) => ({
    unlocked: {},
    pending: null,

    unlock: (id) => {
      if (get().unlocked[id]) return; // Already unlocked
      const def = achievements.find((a) => a.id === id);
      if (!def) return;

      set((s) => ({
        unlocked: { ...s.unlocked, [id]: Date.now() },
        pending: def,
      }));
    },

    dismissToast: () => set({ pending: null }),

    isUnlocked: (id) => !!get().unlocked[id],
  }),
  {
    name: 'sl-ice-achievements',
    partialize: (state) => ({ unlocked: state.unlocked }),
  },
));
