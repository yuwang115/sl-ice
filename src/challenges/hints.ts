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
        en: 'Snowfall adds mass inland, while warm ocean water melts the ice at its edges. Bring the two back into balance.',
        zh: '降雪在内陆增加质量，而暖海水在边缘融化冰体。让两者重新平衡。',
        penalty: 5,
      },
      {
        level: 3,
        en: 'Bring the ocean back towards +0°C within the first century, or offset the warm water with about 1.5x snowfall. On this prograde bed the ice sheet settles again once the forcing eases.',
        zh: '在第一个世纪内把海洋温度调回接近+0°C，或者用约1.5倍的降雪抵消暖水的影响。在这种正坡基岩上，强迫减弱后冰盖会重新稳定下来。',
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
        en: 'Bring the ocean back to +0°C or colder within about 250 years, while the grounding line is still near the sill (530–545 km). Partial cooling is not enough once it is on the retrograde slope, and once the retreat feeds itself, no cooling will stop it.',
        zh: '在大约250年内把海洋温度调回+0°C或更低，趁接地线还在海脊附近（530–545 km）。接地线一旦进入逆坡，部分降温已经不够；一旦退缩自我强化，任何降温都无法阻止。',
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
        en: 'Bring the ocean below about +1°C within the first century. Every century of warm water thins the shelf further and lets the ice behind it speed up.',
        zh: '在第一个世纪内把海洋温度降到约+1°C以下。暖水每多持续一个世纪，冰架就更薄一分，背后的冰流得更快。',
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
        en: 'Raise drainage efficiency to 2 /yr or more within the first century to drain the water. Keeping temperatures modest also reduces meltwater production.',
        zh: '在第一个世纪内把排水效率提高到2 /yr或更高，把水排走。保持温度适中也能减少融水产生。',
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
        en: 'The warm ocean is what drives the retreat. Cool it hard and fast, and increase snowfall to rebuild mass.',
        zh: '驱动退缩的是温暖的海洋。迅速大幅降低海洋温度，并增加降雪来重建质量。',
        penalty: 5,
      },
      {
        level: 3,
        en: 'Cool the ocean to about -1°C and raise snowfall to 1.5x, well within the first two centuries. After about 300 years even that no longer saves it. Act immediately — every year of delay makes recovery harder.',
        zh: '远在头两个世纪结束之前，把海洋温度降到约-1°C，降雪提高到1.5x。大约300年之后，即使这样也救不回来了。立即行动——每年的延迟都会使恢复更困难。',
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
        en: 'The barrier only shields the ice on its landward side, so it must stand on the seafloor seaward of the grounding line. The further out it stands, the more of the ice shelf it protects.',
        zh: '屏障只保护其陆侧的冰，所以必须立在接地线海侧的海底上。屏障越靠外，保护的冰架就越多。',
        penalty: 5,
      },
      {
        level: 3,
        en: 'Move the barrier out to the ice-shelf front (750–800 km) and give it an efficiency of about 0.5. At 400 km it stands under grounded ice and shields nothing.',
        zh: '把屏障移到冰架前缘（750–800 km），效率设为约0.5。放在400 km处时它位于接地冰之下，什么也挡不住。',
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
        en: 'After the run, restart with the ocean 0.1°C warmer (+1.6°C) or cooler (+1.4°C). The first centuries look almost the same — the endings do not.',
        zh: '运行结束后，把海洋温度调暖0.1°C（+1.6°C）或调冷0.1°C（+1.4°C）重新开始。头几个世纪几乎一样——结局却截然不同。',
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
