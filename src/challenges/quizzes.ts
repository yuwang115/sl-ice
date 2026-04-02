/**
 * Knowledge checkpoint quizzes triggered by physics events.
 * Each quiz tests understanding of the science behind what just happened.
 */

export interface QuizOption {
  en: string;
  zh: string;
  correct: boolean;
}

export interface QuizQuestion {
  /** Physics event that triggers this quiz */
  trigger: string;
  question_en: string;
  question_zh: string;
  options: QuizOption[];
  /** Explanation shown after answering (regardless of correctness) */
  explanation_en: string;
  explanation_zh: string;
}

export const quizQuestions: QuizQuestion[] = [
  {
    trigger: 'misi_triggered',
    question_en: 'The grounding line is retreating rapidly. Why?',
    question_zh: '接地线正在快速后退。为什么？',
    options: [
      { en: 'The ice shelf broke apart', zh: '冰架破裂了', correct: false },
      { en: 'The bedrock slopes deeper inland (retrograde slope)', zh: '基岩向内陆方向变深（逆坡）', correct: true },
      { en: 'Snowfall decreased suddenly', zh: '降雪突然减少', correct: false },
      { en: 'The temperature jumped too fast', zh: '温度跳升太快', correct: false },
    ],
    explanation_en: 'On a retrograde slope, grounding line retreat exposes deeper bedrock, allowing more ice to float and accelerating further retreat — a self-reinforcing positive feedback called Marine Ice Sheet Instability (MISI).',
    explanation_zh: '在逆坡上，接地线后退会暴露更深的基岩，使更多冰漂浮并加速进一步后退——这是一种自强化的正反馈，称为海洋冰盖不稳定性（MISI）。',
  },
  {
    trigger: 'shelf_collapsed',
    question_en: 'The ice shelf just collapsed. What happens next?',
    question_zh: '冰架刚刚崩塌。接下来会发生什么？',
    options: [
      { en: 'The ice sheet slows down (less weight)', zh: '冰盖减速（重量减轻）', correct: false },
      { en: 'The ice sheet accelerates into the ocean (lost buttressing)', zh: '冰盖加速涌入海洋（失去支撑）', correct: true },
      { en: 'Sea level drops temporarily', zh: '海平面暂时下降', correct: false },
      { en: 'New ice shelf forms immediately', zh: '新冰架立即形成', correct: false },
    ],
    explanation_en: 'Ice shelves provide "buttressing" — they push back against the ice flowing from inland. When the shelf collapses, this back-pressure vanishes and the ice behind accelerates dramatically into the ocean, raising sea level.',
    explanation_zh: '冰架提供"支撑"——它们对从内陆流出的冰施加反向压力。当冰架崩塌时，这种反压消失，背后的冰戏剧性地加速涌入海洋，使海平面上升。',
  },
  {
    trigger: 'hysteresis_locked',
    question_en: 'The system has passed a point of no return. Why can\'t we recover?',
    question_zh: '系统已经越过了不归点。为什么无法恢复？',
    options: [
      { en: 'The ice melted completely', zh: '冰完全融化了', correct: false },
      { en: 'The feedback loop is self-sustaining even under original conditions', zh: '即使在原始条件下，反馈循环也能自我维持', correct: true },
      { en: 'The bedrock changed shape', zh: '基岩改变了形状', correct: false },
      { en: 'The ocean is too salty now', zh: '海洋现在太咸了', correct: false },
    ],
    explanation_en: 'This is hysteresis — a tipping point where the system enters a new stable state. Even returning temperature to original levels cannot rebuild the ice sheet, because the geometry has changed. Prevention is far easier than cure.',
    explanation_zh: '这就是滞后——一个临界点，系统进入新的稳定状态。即使将温度恢复到原始水平也无法重建冰盖，因为几何形状已经改变。预防远比治疗容易。',
  },
  {
    trigger: 'gl_retreat_accelerating',
    question_en: 'The grounding line is retreating faster. Which factor most affects retreat speed?',
    question_zh: '接地线正在加速后退。哪个因素最影响退缩速度？',
    options: [
      { en: 'Wind speed', zh: '风速', correct: false },
      { en: 'Ocean temperature near the grounding line', zh: '接地线附近的海洋温度', correct: true },
      { en: 'Distance from the equator', zh: '与赤道的距离', correct: false },
      { en: 'Time of year', zh: '一年中的时间', correct: false },
    ],
    explanation_en: 'Warm ocean water reaching the grounding line melts ice from below, thinning it until it floats. This is why ocean temperature is the dominant control on grounding line retreat in marine ice sheets.',
    explanation_zh: '到达接地线的暖海水从下方融化冰，使其变薄直到漂浮。这就是为什么海洋温度是海洋冰盖接地线退缩的主导控制因素。',
  },
  {
    trigger: 'mici_triggered',
    question_en: 'Ice cliffs are now exposed and unstable. What makes a cliff collapse?',
    question_zh: '冰崖现在暴露且不稳定。什么导致冰崖崩塌？',
    options: [
      { en: 'The cliff is too tall to support its own weight', zh: '冰崖太高，无法支撑自身重量', correct: true },
      { en: 'Wind erosion', zh: '风蚀', correct: false },
      { en: 'Tidal forces pull it apart', zh: '潮汐力将其拉开', correct: false },
      { en: 'Sunlight weakens the ice', zh: '阳光削弱了冰', correct: false },
    ],
    explanation_en: 'Marine Ice Cliff Instability (MICI) occurs when ice cliffs exceed ~100m height. At this point, the ice exceeds its yield strength and collapses structurally. On retrograde slopes, retreat exposes even taller cliffs — a cascading feedback.',
    explanation_zh: '海洋冰崖不稳定性（MICI）在冰崖超过约100m高度时发生。此时，冰超过其屈服强度并发生结构性崩塌。在逆坡上，退缩暴露出更高的冰崖——一种级联反馈。',
  },
  {
    trigger: 'city_flooded',
    question_en: 'Sea level has risen significantly. Where does the water come from?',
    question_zh: '海平面显著上升。水来自哪里？',
    options: [
      { en: 'Thermal expansion of ocean water', zh: '海水热膨胀', correct: false },
      { en: 'Ice that was grounded on land flowing into the ocean', zh: '陆地上的冰流入海洋', correct: true },
      { en: 'Increased rainfall', zh: '降雨增加', correct: false },
      { en: 'Melting of floating sea ice', zh: '漂浮海冰的融化', correct: false },
    ],
    explanation_en: 'Only grounded ice (sitting on bedrock) contributes to sea level rise when it enters the ocean. Floating ice (like ice shelves and sea ice) is already displacing water, so its melting doesn\'t change sea level — think of ice cubes in a glass.',
    explanation_zh: '只有接地冰（坐落在基岩上的冰）进入海洋时才会导致海平面上升。漂浮冰（如冰架和海冰）已经在排水，所以它的融化不会改变海平面——想想杯子里的冰块。',
  },
  {
    trigger: 'cliff_failure',
    question_en: 'A massive cliff failure just occurred. Why is this particularly dangerous on retrograde slopes?',
    question_zh: '刚刚发生了大规模冰崖崩塌。为什么这在逆坡上特别危险？',
    options: [
      { en: 'Retrograde slopes are steeper', zh: '逆坡更陡', correct: false },
      { en: 'Retreat exposes thicker ice, creating even taller unstable cliffs', zh: '退缩暴露更厚的冰，形成更高的不稳定冰崖', correct: true },
      { en: 'The bedrock is weaker on retrograde slopes', zh: '逆坡上的基岩更弱', correct: false },
      { en: 'Gravity is stronger there', zh: '那里的重力更强', correct: false },
    ],
    explanation_en: 'On retrograde slopes, the ice gets thicker as you go inland. Each cliff collapse exposes a new, taller cliff behind it — which is even more unstable. This creates a cascading chain reaction that is nearly impossible to stop.',
    explanation_zh: '在逆坡上，越往内陆冰越厚。每次冰崖崩塌都会暴露出后面更高的新冰崖——这更加不稳定。这创造了一个几乎不可能停止的级联连锁反应。',
  },
];

/** Get the quiz for a specific event type (returns first match not yet answered) */
export function getQuizForEvent(eventType: string, answeredIds: Set<string>): QuizQuestion | null {
  const quiz = quizQuestions.find(
    (q) => q.trigger === eventType && !answeredIds.has(q.trigger)
  );
  return quiz ?? null;
}
