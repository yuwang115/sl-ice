/**
 * Progressive hint system for challenges.
 *
 * Three levels per challenge:
 * - Level 1 (Concept): Free. Recalls the scientific concept.
 * - Level 2 (Direction): -5 points. Points to the right parameter.
 * - Level 3 (Strategy): -15 points. Near-answer guidance.
 */

export interface HintLevel {
  level: 1 | 2 | 3;
  en: string;
  zh: string;
  /** Score penalty for using this hint (0 = free) */
  penalty: number;
}

export interface ChallengeHints {
  challengeId: number;
  hints: HintLevel[];
}

export const challengeHints: ChallengeHints[] = [
  {
    challengeId: 1,
    hints: [
      {
        level: 1,
        en: 'Think about what "equilibrium" means for an ice sheet. What must be balanced?',
        zh: '想想"平衡"对冰盖意味着什么。什么必须保持平衡？',
        penalty: 0,
      },
      {
        level: 2,
        en: 'Snowfall adds mass, while warming removes it. Keep both in balance.',
        zh: '降雪增加质量，而变暖减少质量。保持两者平衡。',
        penalty: 5,
      },
      {
        level: 3,
        en: 'Leave the temperature near 0°C and snowfall near 1.0x. Small deviations are fine — the ice sheet self-corrects if pushed gently.',
        zh: '将温度保持在接近0°C，降雪保持在1.0x附近。小偏差没问题——如果轻轻推动，冰盖会自我修正。',
        penalty: 15,
      },
    ],
  },
  {
    challengeId: 2,
    hints: [
      {
        level: 1,
        en: 'What happens when a grounding line retreats over a slope that deepens inland? Think about the feedback loop.',
        zh: '当接地线退过向内陆加深的坡度时会发生什么？想想反馈循环。',
        penalty: 0,
      },
      {
        level: 2,
        en: 'Ocean temperature is the key driver. Keep the warm water away from the grounding line.',
        zh: '海洋温度是关键驱动力。让暖水远离接地线。',
        penalty: 5,
      },
      {
        level: 3,
        en: 'Keep ocean temperature delta below +1°C. Any higher risks triggering MISI on the retrograde slope. If MISI starts, even cooling won\'t help.',
        zh: '将海洋温度增量保持在+1°C以下。更高的值有可能在逆坡上触发MISI。一旦MISI开始，即使降温也无济于事。',
        penalty: 15,
      },
    ],
  },
  {
    challengeId: 3,
    hints: [
      {
        level: 1,
        en: 'Why is an ice shelf called "the cork"? What does it hold back?',
        zh: '为什么冰架被称为"瓶塞"？它挡住了什么？',
        penalty: 0,
      },
      {
        level: 2,
        en: 'You can only control ocean temperature. The warmer the water, the faster the shelf melts from below.',
        zh: '你只能控制海洋温度。水越暖，冰架从下方融化得越快。',
        penalty: 5,
      },
      {
        level: 3,
        en: 'Keep ocean temperature below +0.5°C. The shelf is thin — even moderate warming can eliminate it, releasing the ice behind.',
        zh: '将海洋温度保持在+0.5°C以下。冰架很薄——即使适度变暖也可能消除它，释放背后的冰。',
        penalty: 15,
      },
    ],
  },
  {
    challengeId: 4,
    hints: [
      {
        level: 1,
        en: 'Water under ice acts as a lubricant. What happens when drainage is too slow?',
        zh: '冰下水起润滑作用。排水太慢时会发生什么？',
        penalty: 0,
      },
      {
        level: 2,
        en: 'Focus on the drainage efficiency slider. It controls how fast subglacial water is removed.',
        zh: '关注排水效率滑块。它控制冰下水被排出的速度。',
        penalty: 5,
      },
      {
        level: 3,
        en: 'Increase drainage efficiency above 2.0 yr to prevent water buildup. Also keep temperatures modest to reduce meltwater production.',
        zh: '将排水效率提高到2.0年以上以防止积水。同时保持温度适中以减少融水产生。',
        penalty: 15,
      },
    ],
  },
  {
    challengeId: 5,
    hints: [
      {
        level: 1,
        en: 'This ice sheet starts near a tipping point. Is it easier to prevent a collapse or reverse one?',
        zh: '这个冰盖从临界点附近开始。预防崩塌容易还是逆转崩塌容易？',
        penalty: 0,
      },
      {
        level: 2,
        en: 'You need to cool BOTH atmosphere and ocean aggressively, AND increase snowfall to rebuild mass.',
        zh: '你需要大幅降低大气和海洋温度，并增加降雪来重建质量。',
        penalty: 5,
      },
      {
        level: 3,
        en: 'Set T_atm to -3°C or colder, T_ocean to -1°C, and snowfall to 1.5x. Act immediately — every year of delay makes recovery harder.',
        zh: '设定T_atm为-3°C或更低，T_ocean为-1°C，降雪为1.5x。立即行动——每年的延迟都会使恢复更困难。',
        penalty: 15,
      },
    ],
  },
  {
    challengeId: 6,
    hints: [
      {
        level: 1,
        en: 'A seafloor barrier blocks warm water — but where should you place it for maximum effect?',
        zh: '海底屏障阻挡暖水——但应该放在哪里以获得最大效果？',
        penalty: 0,
      },
      {
        level: 2,
        en: 'The barrier position and efficiency both matter. Consider placing it near the grounding line for maximum protection.',
        zh: '屏障位置和效率都很重要。考虑将其放在接地线附近以获得最大保护。',
        penalty: 5,
      },
      {
        level: 3,
        en: 'Place the barrier around 300-400km with efficiency ≥ 0.7. This blocks most warm water while the initial +2°C ocean warming is in effect.',
        zh: '将屏障放置在300-400km处，效率≥0.7。这可以在初始+2°C海洋变暖生效时阻挡大部分暖水。',
        penalty: 15,
      },
    ],
  },
  {
    challengeId: 7,
    hints: [
      {
        level: 1,
        en: 'This is an observational challenge. Watch how two nearly identical worlds diverge. What does this teach about prediction?',
        zh: '这是一个观察性挑战。观察两个几乎相同的世界如何分歧。这对预测有什么启示？',
        penalty: 0,
      },
      {
        level: 2,
        en: 'Try running the simulation multiple times. Notice how the outcomes vary despite identical starting conditions.',
        zh: '尝试多次运行模拟。注意尽管起始条件相同，结果如何变化。',
        penalty: 0,
      },
      {
        level: 3,
        en: 'There is no "winning" this challenge — the point is to understand why ensemble modeling (running many simulations) is essential for ice sheet predictions.',
        zh: '这个挑战没有"获胜"的概念——重点是理解为什么集合模拟（运行多次模拟）对冰盖预测至关重要。',
        penalty: 0,
      },
    ],
  },
  {
    challengeId: 8,
    hints: [
      {
        level: 1,
        en: 'Once an ice shelf disintegrates, the ice cliff behind it is exposed. What determines if the cliff collapses?',
        zh: '一旦冰架解体，身后的冰崖就会暴露。什么决定冰崖是否崩塌？',
        penalty: 0,
      },
      {
        level: 2,
        en: 'MICI sensitivity and ocean temperature both drive the collapse rate. You need to keep the cliff below its critical height.',
        zh: 'MICI灵敏度和海洋温度都驱动崩塌速率。你需要将冰崖保持在其临界高度以下。',
        penalty: 5,
      },
      {
        level: 3,
        en: 'Reduce MICI sensitivity and cool the ocean as much as possible. The cascade is hard to stop once started — prevention is key.',
        zh: '降低MICI灵敏度并尽可能冷却海洋。一旦开始，级联很难停止——预防是关键。',
        penalty: 15,
      },
    ],
  },
];

/** Get hints for a challenge */
export function getHintsForChallenge(challengeId: number): HintLevel[] {
  return challengeHints.find((h) => h.challengeId === challengeId)?.hints ?? [];
}

/** Calculate total score penalty from used hints */
export function hintPenalty(usedLevels: number[]): number {
  // Only count unique levels
  const unique = [...new Set(usedLevels)];
  let total = 0;
  for (const level of unique) {
    if (level === 2) total += 5;
    if (level === 3) total += 15;
  }
  return total;
}
