/**
 * Narrative text for challenge briefings and debriefs.
 * Briefings set the scene; debriefs connect to real-world glaciology.
 */

export interface ChallengeBriefingText {
  challengeId: number;
  /** Briefing shown before challenge starts */
  briefing_en: string;
  briefing_zh: string;
  /** Debrief shown after winning — connects to real science */
  debrief_en: string;
  debrief_zh: string;
}

export const narratives: ChallengeBriefingText[] = [
  {
    challengeId: 1,
    briefing_en: `Year 2040. You've been appointed chief scientist at a remote Antarctic research station. Your first task: understand how an ice sheet stays in balance.

Snowfall adds mass inland. Ocean melting removes mass at the edges. When these forces match, the ice sheet is in equilibrium — alive, flowing, but stable.

Your mission: maintain this balance for 500 years.`,
    briefing_zh: `2040年。你被任命为一个偏远南极研究站的首席科学家。你的第一个任务：理解冰盖如何保持平衡。

内陆降雪增加质量，边缘海洋融化消耗质量。当这些力量匹配时，冰盖处于平衡状态——活跃、流动，但稳定。

你的任务：维持这种平衡500年。`,
    debrief_en: `What you just experienced is the fundamental principle of ice sheet mass balance — the same balance that governs all of Earth's ice sheets today.

Currently, both the Antarctic and Greenland ice sheets are losing mass faster than they gain it, contributing to accelerating sea level rise. The equilibrium you maintained in this simulation is what glaciologists are working to understand and protect.`,
    debrief_zh: `你刚刚体验的是冰盖质量平衡的基本原理——同样的平衡支配着当今地球上所有的冰盖。

目前，南极和格陵兰冰盖失去质量的速度都快于获得的速度，加速了海平面上升。你在这次模拟中维持的平衡，正是冰川学家们努力理解和保护的。`,
  },
  {
    challengeId: 2,
    briefing_en: `Your satellite data reveals something troubling: the bedrock beneath the ice slopes downward toward the interior. This "retrograde slope" creates a hidden vulnerability.

If the grounding line retreats past this slope, a self-reinforcing feedback begins — retreat exposes deeper bedrock, allowing more ice to float, accelerating further retreat.

Scientists call this Marine Ice Sheet Instability. Your mission: prevent it for 1000 years.`,
    briefing_zh: `你的卫星数据揭示了令人不安的信息：冰下基岩向内陆方向倾斜。这种"逆坡"创造了一个隐藏的脆弱点。

如果接地线退过这个斜坡，自强化反馈就会开始——退缩暴露更深的基岩，使更多冰漂浮，加速进一步退缩。

科学家称之为海洋冰盖不稳定性。你的任务：阻止它1000年。`,
    debrief_en: `Marine Ice Sheet Instability (MISI) is the single biggest concern for West Antarctic ice loss. The Thwaites Glacier — nicknamed the "Doomsday Glacier" — sits on exactly this kind of retrograde bedrock.

Scientists at the International Thwaites Glacier Collaboration are racing to determine whether MISI has already begun. If it has, the resulting sea level rise could be unstoppable.`,
    debrief_zh: `海洋冰盖不稳定性（MISI）是西南极冰损失最大的担忧。思韦茨冰川——被称为"末日冰川"——正坐落在这种逆坡基岩上。

国际思韦茨冰川合作组织的科学家们正在竞相确定MISI是否已经开始。如果已经开始，由此导致的海平面上升可能无法阻止。`,
  },
  {
    challengeId: 3,
    briefing_en: `The ice shelf floating at the edge of your ice sheet is thin, fragile, and utterly essential. It acts like a cork in a bottle, bracing the vast ice behind it.

Warm ocean currents are eating it from below. If the shelf collapses, the ice sheet will surge into the ocean.

You have only one control: ocean temperature. Guard the cork.`,
    briefing_zh: `漂浮在冰盖边缘的冰架薄而脆弱，却至关重要。它像瓶中的瓶塞一样，支撑着身后巨大的冰体。

暖洋流正在从下方侵蚀它。如果冰架崩塌，冰盖将涌入海洋。

你只有一个控制手段：海洋温度。守住瓶塞。`,
    debrief_en: `Ice shelf buttressing is a critical concept in glaciology. The collapse of the Larsen B ice shelf in 2002 caused the glaciers behind it to accelerate by up to 8x.

Today, scientists are closely monitoring the Thwaites Ice Shelf, which buttresses one of the largest and most vulnerable glaciers on Earth. Its loss could unlock meters of sea level rise.`,
    debrief_zh: `冰架支撑是冰川学中的关键概念。2002年拉森B冰架的崩塌导致其后方冰川加速高达8倍。

如今，科学家们正密切监测思韦茨冰架——它支撑着地球上最大、最脆弱的冰川之一。它的消失可能释放数米的海平面上升。`,
  },
  {
    challengeId: 4,
    briefing_en: `Beneath the ice, a hidden river system carries meltwater toward the ocean. This water lubricates the ice-bedrock interface, controlling how fast the ice slides.

When drainage is inefficient, water pressure builds. Higher pressure means less friction, faster sliding, more frictional heat, more meltwater — a dangerous positive feedback loop.

Control the drainage. Tame the undercurrents.`,
    briefing_zh: `冰层之下，隐藏的河流系统将融水输送向海洋。这些水润滑冰-基岩界面，控制着冰的滑动速度。

当排水效率低时，水压升高。更高的水压意味着更少的摩擦、更快的滑动、更多的摩擦热、更多的融水——一个危险的正反馈循环。

控制排水。驯服暗流。`,
    debrief_en: `Subglacial hydrology is one of the least understood aspects of ice sheet dynamics, yet it may be one of the most important. Surface melt on the Greenland ice sheet drains to the bed through moulins, temporarily speeding up glacier flow every summer.

In Antarctica, vast subglacial lakes and rivers move water hundreds of kilometers under the ice, influencing glacier behavior in ways scientists are only beginning to understand.`,
    debrief_zh: `冰下水文是冰盖动力学中最不被理解的方面之一，但它可能是最重要的方面之一。格陵兰冰盖上的地表融水通过冰川竖井排到冰底，每年夏天暂时加速冰川流动。

在南极洲，巨大的冰下湖泊和河流在冰层下输送水百公里，以科学家们刚开始理解的方式影响冰川行为。`,
  },
  {
    challengeId: 5,
    briefing_en: `The worst-case scenario. The ice sheet is already on the edge — atmospheric warming of +3°C, ocean warming of +1.5°C. MISI is lurking just beyond the grounding line.

Most glaciologists believe that from this state, recovery is nearly impossible. Prove them wrong.

Warning: most players fail this challenge. And that's the point.`,
    briefing_zh: `最坏情况。冰盖已经处于边缘——大气升温+3°C，海洋升温+1.5°C。MISI正潜伏在接地线之外。

大多数冰川学家认为，从这个状态恢复几乎不可能。证明他们错了。

警告：大多数玩家会在这个挑战中失败。这正是重点所在。`,
    debrief_en: `If you succeeded: congratulations — you achieved something that may be physically impossible in the real world. Recovery from near-collapse would require thousands of years even under ideal conditions.

If you failed: you experienced hysteresis firsthand. Some climate tipping points cannot be reversed by simply returning to previous conditions. This is why climate scientists stress that prevention is infinitely more effective than cure.`,
    debrief_zh: `如果你成功了：恭喜——你实现了在现实世界中可能物理上不可能的事情。即使在理想条件下，从接近崩塌的状态恢复也需要数千年。

如果你失败了：你亲身体验了滞后效应。某些气候临界点不能通过简单地恢复到以前的条件来逆转。这就是为什么气候科学家强调预防比治疗有效得多。`,
  },
  {
    challengeId: 6,
    briefing_en: `A radical idea: build a barrier on the seafloor to block warm ocean currents from reaching the grounding line. It sounds like science fiction, but real scientists are studying this.

The ocean is +2°C warmer than normal. Place your barrier strategically and calibrate its efficiency. Can you buy the ice sheet 500 years?

Remember: geoengineering treats symptoms, not causes.`,
    briefing_zh: `一个激进的想法：在海底建造屏障，阻挡暖洋流到达接地线。这听起来像科幻小说，但真正的科学家正在研究这个。

海洋比正常温暖+2°C。战略性地放置你的屏障并调整其效率。你能为冰盖争取500年吗？

记住：地球工程治标不治本。`,
    debrief_en: `Seafloor barriers to protect glaciers from warm water are a real proposal, most notably studied for the Thwaites Glacier. The concept involves placing artificial sills on the seabed to redirect warm Circumpolar Deep Water away from vulnerable ice.

Scientists emphasize this would be a temporary measure — a way to buy time while the world addresses the root cause: greenhouse gas emissions.`,
    debrief_zh: `海底屏障保护冰川免受暖水侵蚀是一个真实的提案，最著名的是针对思韦茨冰川的研究。该概念涉及在海底放置人工门槛，将温暖的环极深层水引导远离脆弱的冰。

科学家强调这将是临时措施——一种在世界解决根本原因（温室气体排放）时争取时间的方式。`,
  },
  {
    challengeId: 7,
    briefing_en: `Two simulations. Identical parameters. One tiny difference: 0.01°C.

Watch them diverge over 2000 years. This is not a challenge you can win or lose — it's a lesson in humility.

This is why predicting ice sheet collapse requires not one simulation, but hundreds.`,
    briefing_zh: `两次模拟。相同的参数。一个微小的差异：0.01°C。

观察它们在2000年中的分歧。这不是一个你能赢或输的挑战——这是一堂关于谦逊的课。

这就是为什么预测冰盖崩塌需要的不是一次模拟，而是数百次。`,
    debrief_en: `What you witnessed is sensitivity to initial conditions — a hallmark of complex dynamical systems. In ice sheet science, this means that any single simulation is just one possible future.

This is why the IPCC reports present ranges of sea level rise projections, not single numbers. Scientists run "ensemble" simulations — hundreds of runs with slightly different inputs — to capture the full range of possibilities.`,
    debrief_zh: `你所看到的是对初始条件的敏感性——复杂动力系统的标志。在冰盖科学中，这意味着任何单次模拟都只是一种可能的未来。

这就是为什么IPCC报告呈现的是海平面上升预测的范围，而不是单一数字。科学家运行"集合"模拟——数百次输入略有不同的运行——以捕捉全部可能性的范围。`,
  },
  {
    challengeId: 8,
    briefing_en: `The ice shelf is gone. The ice cliffs now stand exposed — vertical walls of ice towering above the ocean. And they're failing.

When an ice cliff grows taller than ~100 meters, it can no longer support its own weight. It fractures and collapses into the sea. On a retrograde slope, each collapse reveals an even taller cliff behind it.

This is the cliff instability cascade. Can you slow it?`,
    briefing_zh: `冰架已经消失。冰崖现在暴露在外——垂直的冰墙耸立在海洋之上。它们正在崩塌。

当冰崖高于约100米时，它无法再支撑自身重量。它断裂并崩入大海。在逆坡上，每次崩塌都会暴露出后面更高的冰崖。

这就是冰崖不稳定性级联。你能减缓它吗？`,
    debrief_en: `Marine Ice Cliff Instability (MICI) is one of the most debated mechanisms in modern glaciology. If it operates as some models suggest, it could dramatically increase the rate of ice sheet collapse.

The good news: recent research suggests that ice may be stronger than early MICI models assumed. The bad news: even without MICI, MISI alone threatens meters of sea level rise over the coming centuries.`,
    debrief_zh: `海洋冰崖不稳定性（MICI）是现代冰川学中最受争议的机制之一。如果它像某些模型所暗示的那样运作，可能会大幅增加冰盖崩塌的速度。

好消息是：最近的研究表明，冰可能比早期MICI模型假设的更坚固。坏消息是：即使没有MICI，仅MISI就威胁着未来几个世纪数米的海平面上升。`,
  },
];

/** Get narrative text for a challenge */
export function getNarrative(challengeId: number): ChallengeBriefingText | undefined {
  return narratives.find((n) => n.challengeId === challengeId);
}
