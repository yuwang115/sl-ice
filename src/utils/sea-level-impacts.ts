/**
 * Sea level rise → city impact mapping.
 */

export interface CityImpact {
  threshold_m: number;
  cities_en: string[];
  cities_zh: string[];
  message_en: string;
  message_zh: string;
}

export const seaLevelImpacts: CityImpact[] = [
  {
    threshold_m: 0.3,
    cities_en: ['Tuvalu', 'Maldives', 'Marshall Islands'],
    cities_zh: ['图瓦卢', '马尔代夫', '马绍尔群岛'],
    message_en: 'Low-lying island nations face existential threat.',
    message_zh: '低洼岛国面临存亡威胁。',
  },
  {
    threshold_m: 0.5,
    cities_en: ['Miami', 'Jakarta', 'Bangkok'],
    cities_zh: ['迈阿密', '雅加达', '曼谷'],
    message_en: 'Major coastal cities experience regular flooding.',
    message_zh: '主要沿海城市经历常态性洪水。',
  },
  {
    threshold_m: 1.0,
    cities_en: ['Shanghai', 'Mumbai', 'Dhaka'],
    cities_zh: ['上海', '孟买', '达卡'],
    message_en: 'Hundreds of millions displaced from coastal megacities.',
    message_zh: '数亿人从沿海大都市流离失所。',
  },
  {
    threshold_m: 2.0,
    cities_en: ['New York', 'London', 'Tokyo'],
    cities_zh: ['纽约', '伦敦', '东京'],
    message_en: 'World\'s financial and cultural centers severely impacted.',
    message_zh: '世界金融和文化中心受到严重影响。',
  },
  {
    threshold_m: 3.0,
    cities_en: ['Amsterdam', 'Venice', 'Ho Chi Minh City'],
    cities_zh: ['阿姆斯特丹', '威尼斯', '胡志明市'],
    message_en: 'Multiple major cities become uninhabitable.',
    message_zh: '多个主要城市变得不适宜居住。',
  },
  {
    threshold_m: 5.0,
    cities_en: ['Global catastrophe'],
    cities_zh: ['全球灾难'],
    message_en: 'Catastrophic global coastal flooding affecting billions.',
    message_zh: '灾难性全球沿海洪水影响数十亿人。',
  },
];

/**
 * Get the most relevant impact for a given sea level rise.
 */
export function getCurrentImpact(seaLevel_m: number): CityImpact | null {
  let best: CityImpact | null = null;
  for (const impact of seaLevelImpacts) {
    if (seaLevel_m >= impact.threshold_m) {
      best = impact;
    }
  }
  return best;
}
