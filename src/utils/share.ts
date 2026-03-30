/**
 * Social sharing utilities.
 */

export interface ShareData {
  region: string;
  years: number;
  volumeChange: number;
  seaLevel: number;
  impactedCities: string[];
}

/**
 * Generate share text for the simulation result.
 */
export function generateShareText(data: ShareData, lang: 'en' | 'zh'): string {
  if (lang === 'zh') {
    return [
      `🧊 SL-ICE | ${data.region}`,
      `⏱️ 模拟时长：${data.years} 年`,
      `📉 冰量变化：${data.volumeChange > 0 ? '+' : ''}${data.volumeChange.toFixed(0)}%`,
      `🌊 海平面上升：+${data.seaLevel.toFixed(2)} m`,
      data.impactedCities.length > 0
        ? `🏙️ 影响：${data.impactedCities.join('、')}`
        : '',
      '',
      '来试试看你能否拯救冰盖 👉',
    ].filter(Boolean).join('\n');
  }

  return [
    `🧊 SL-ICE | ${data.region}`,
    `⏱️ Duration: ${data.years} years`,
    `📉 Volume change: ${data.volumeChange > 0 ? '+' : ''}${data.volumeChange.toFixed(0)}%`,
    `🌊 Sea level rise: +${data.seaLevel.toFixed(2)} m`,
    data.impactedCities.length > 0
      ? `🏙️ Impact: ${data.impactedCities.join(', ')}`
      : '',
    '',
    'Can you save the ice sheet? 👉',
  ].filter(Boolean).join('\n');
}

/**
 * Share via Web Share API or fallback to clipboard.
 */
export async function shareResult(text: string, url: string): Promise<boolean> {
  if (navigator.share) {
    try {
      await navigator.share({ text, url });
      return true;
    } catch {
      // User cancelled or share failed
    }
  }

  // Fallback: copy to clipboard
  try {
    await navigator.clipboard.writeText(`${text}\n${url}`);
    return true;
  } catch {
    return false;
  }
}
