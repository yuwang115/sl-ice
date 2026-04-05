export interface ChallengeDisplay {
  id: number;
  name_en: string;
  name_zh: string;
  subtitle_en: string;
  subtitle_zh: string;
  difficulty: number;
  concepts: string[];
  locked?: boolean;
  lockReason_en?: string;
  lockReason_zh?: string;
}

export const challenges: readonly ChallengeDisplay[] = [
  {
    id: 1,
    name_en: 'The Balance',
    name_zh: '\u7A33\u6001\u4E4B\u9053',
    subtitle_en: 'Find equilibrium \u2014 keep the ice sheet stable for 500 years.',
    subtitle_zh: '\u627E\u5230\u5E73\u8861\u2014\u2014\u8BA9\u51B0\u76D6\u7A33\u5B9A500\u5E74\u3002',
    difficulty: 1,
    concepts: ['mass_balance', 'equilibrium'],
  },
  {
    id: 2,
    name_en: 'Point of No Return',
    name_zh: '\u4E0D\u5F52\u4E4B\u8DEF',
    subtitle_en: 'Can you prevent the grounding line from crossing the danger zone?',
    subtitle_zh: '\u4F60\u80FD\u963B\u6B62\u63A5\u5730\u7EBF\u8D8A\u8FC7\u5371\u9669\u533A\u57DF\u5417\uFF1F',
    difficulty: 3,
    concepts: ['misi', 'retrograde_slope', 'tipping_point'],
  },
  {
    id: 3,
    name_en: 'The Cork',
    name_zh: '\u74F6\u585E\u6548\u5E94',
    subtitle_en: "Keep the ice shelf alive \u2014 it's the only thing holding back the ice.",
    subtitle_zh: '\u4FDD\u4F4F\u51B0\u67B6\u2014\u2014\u5B83\u662F\u963B\u6321\u51B0\u76D6\u7684\u552F\u4E00\u5C4F\u969C\u3002',
    difficulty: 2,
    concepts: ['buttressing', 'ice_shelf', 'ocean_melt'],
  },
  {
    id: 4,
    name_en: 'Undercurrents',
    name_zh: '\u51B0\u4E0B\u6697\u6D41',
    subtitle_en: 'Subglacial water lubricates the ice \u2014 control the drainage.',
    subtitle_zh: '\u51B0\u4E0B\u6C34\u6DA6\u6ED1\u51B0\u76D6\u2014\u2014\u63A7\u5236\u6392\u6C34\u6548\u7387\u3002',
    difficulty: 3,
    concepts: ['hydrology', 'effective_pressure', 'positive_feedback'],
  },
  {
    id: 5,
    name_en: 'Save the Ice',
    name_zh: '\u62EF\u6551\u51B0\u76D6',
    subtitle_en: 'The ice sheet is on the edge. Can you pull it back?',
    subtitle_zh: '\u51B0\u76D6\u5DF2\u5728\u4E34\u754C\u8FB9\u7F18\u3002\u4F60\u80FD\u628A\u5B83\u62C9\u56DE\u6765\u5417\uFF1F',
    difficulty: 4,
    concepts: ['hysteresis', 'irreversibility', 'tipping_point'],
  },
  {
    id: 6,
    name_en: 'The Geoengineers',
    name_zh: '\u5730\u7403\u5DE5\u7A0B\u5E08',
    subtitle_en: 'Build a seafloor barrier to slow the collapse.',
    subtitle_zh: '\u5EFA\u9020\u6D77\u5E95\u5C4F\u969C\u6765\u5EF6\u7F13\u5D29\u584C\u3002',
    difficulty: 4,
    concepts: ['geoengineering', 'intervention', 'ocean_circulation'],
  },
  {
    id: 7,
    name_en: 'The Butterfly',
    name_zh: '\u8774\u8776\u6548\u5E94',
    subtitle_en: 'Two worlds diverge from a 0.01\u00B0C difference.',
    subtitle_zh: '\u4E24\u4E2A\u4E16\u754C\u56E00.01\u00B0C\u7684\u5DEE\u5F02\u800C\u5206\u9053\u626C\u9573\u3002',
    difficulty: 3,
    concepts: ['sensitivity', 'uncertainty', 'ensemble'],
    locked: true,
    lockReason_en: 'Complete 6 challenges to unlock',
    lockReason_zh: '\u5B8C\u62106\u4E2A\u6311\u6218\u540E\u89E3\u9501',
  },
  {
    id: 8,
    name_en: 'The Cliff',
    name_zh: '\u51B0\u5D16\u5371\u673A',
    subtitle_en: 'The shelf is gone. Now the cliffs are failing.',
    subtitle_zh: '\u51B0\u67B6\u5DF2\u7ECF\u6D88\u5931\u3002\u73B0\u5728\u51B0\u5D16\u6B63\u5728\u5D29\u584C\u3002',
    difficulty: 5,
    concepts: ['mici', 'cliff_failure', 'positive_feedback'],
    locked: true,
    lockReason_en: "Complete 'The Cork' to unlock",
    lockReason_zh: "\u5B8C\u6210\u300A\u74F6\u585E\u6548\u5E94\u300B\u540E\u89E3\u9501",
  },
] as const;

export const conceptLabels: Record<string, { en: string; zh: string }> = {
  mass_balance: { en: 'Mass Balance', zh: '\u8D28\u91CF\u5E73\u8861' },
  equilibrium: { en: 'Equilibrium', zh: '\u5E73\u8861\u6001' },
  misi: { en: 'MISI', zh: 'MISI' },
  retrograde_slope: { en: 'Retrograde Slope', zh: '\u9006\u5761' },
  tipping_point: { en: 'Tipping Point', zh: '\u4E34\u754C\u70B9' },
  buttressing: { en: 'Buttressing', zh: '\u652F\u6491\u6548\u5E94' },
  ice_shelf: { en: 'Ice Shelf', zh: '\u51B0\u67B6' },
  ocean_melt: { en: 'Ocean Melt', zh: '\u6D77\u6D0B\u878D\u5316' },
  hydrology: { en: 'Hydrology', zh: '\u6C34\u6587' },
  effective_pressure: { en: 'Effective Pressure', zh: '\u6709\u6548\u538B\u529B' },
  positive_feedback: { en: 'Positive Feedback', zh: '\u6B63\u53CD\u9988' },
  hysteresis: { en: 'Hysteresis', zh: '\u8FDF\u6EDE\u6548\u5E94' },
  irreversibility: { en: 'Irreversibility', zh: '\u4E0D\u53EF\u9006\u6027' },
  geoengineering: { en: 'Geoengineering', zh: '\u5730\u7403\u5DE5\u7A0B' },
  intervention: { en: 'Intervention', zh: '\u4EBA\u5DE5\u5E72\u9884' },
  ocean_circulation: { en: 'Circulation', zh: '\u6D77\u6D0B\u73AF\u6D41' },
  sensitivity: { en: 'Sensitivity', zh: '\u654F\u611F\u6027' },
  uncertainty: { en: 'Uncertainty', zh: '\u4E0D\u786E\u5B9A\u6027' },
  ensemble: { en: 'Ensemble', zh: '\u96C6\u5408\u6A21\u62DF' },
  mici: { en: 'MICI', zh: 'MICI' },
  cliff_failure: { en: 'Cliff Failure', zh: '\u51B0\u5D16\u5D29\u584C' },
  cascading_instability: { en: 'Cascading', zh: '\u7EA7\u8054\u5931\u7A33' },
};
