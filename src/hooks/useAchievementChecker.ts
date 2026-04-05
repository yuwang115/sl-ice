/**
 * Hook that periodically checks achievement conditions.
 * Throttled to ~1Hz to minimize performance impact.
 */

import { useEffect, useRef } from 'react';
import { useGameStore } from '../store/game-store';
import { usePhysicsStore } from '../store/physics-store';
import { useAchievementStore } from '../store/achievement-store';
import { challenges } from '../challenges';

export function useAchievementChecker() {
  const unlock = useAchievementStore((s) => s.unlock);
  const isUnlocked = useAchievementStore((s) => s.isUnlocked);
  const lastCheckRef = useRef(0);

  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      if (now - lastCheckRef.current < 1000) return; // 1Hz throttle
      lastCheckRef.current = now;

      const game = useGameStore.getState();
      const physics = usePhysicsStore.getState();
      const state = physics.state;

      const progress = game.challengeProgress;
      const wonIds = progress.filter((p) => p.status === 'won').map((p) => p.id);
      const lostAny = progress.some((p) => p.status === 'lost');

      // Beginner achievements
      if (wonIds.length >= 1 && !isUnlocked('first_win')) {
        unlock('first_win');
      }
      if (lostAny && !isUnlocked('first_fail')) {
        unlock('first_fail');
      }
      const ch1 = progress.find((p) => p.id === 1);
      if (ch1?.bestStars && ch1.bestStars >= 3 && !isUnlocked('steady_rock')) {
        unlock('steady_rock');
      }

      // Explorer achievements
      if (state && state.year > 10000 && !isUnlocked('time_traveler')) {
        unlock('time_traveler');
      }
      if (game.params.T_atm_delta >= 20 && !isUnlocked('extremist')) {
        unlock('extremist');
      }
      if (wonIds.includes(6) && !isUnlocked('geoengineer')) {
        unlock('geoengineer');
      }

      // Mastery achievements
      const anyHundred = progress.some((p) => p.bestScore != null && p.bestScore >= 100);
      if (anyHundred && !isUnlocked('hundred')) {
        unlock('hundred');
      }
      if (wonIds.length >= 8 && !isUnlocked('all_clear')) {
        unlock('all_clear');
      }
      const allThreeStars = progress.every((p) => p.bestStars != null && p.bestStars >= 3);
      if (allThreeStars && wonIds.length >= 8 && !isUnlocked('grand_master')) {
        unlock('grand_master');
      }

      // Hidden achievements
      if (wonIds.includes(5) && !isUnlocked('impossible_mission')) {
        unlock('impossible_mission');
      }

      // Events-based achievements
      if (state?.events) {
        if (state.events.some((e) => e.type === 'city_flooded') && !isUnlocked('sea_level_line')) {
          unlock('sea_level_line');
        }
      }

      // Challenge result-based achievements
      const result = game.challengeResult;
      if (result) {
        // Zero intervention: won Challenge 1 with 0 param changes
        if (result.challengeId === 1 && result.won && game.challengeParamChanges === 0 && !isUnlocked('zero_intervention')) {
          unlock('zero_intervention');
        }
        // Last second: won in final 10 years
        const challenge = challenges.find((c) => c.id === result.challengeId);
        if (challenge && result.won) {
          const margin = challenge.duration_years - result.elapsedYears;
          if (margin <= 10 && margin >= 0 && !isUnlocked('last_second')) {
            unlock('last_second');
          }
        }
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [unlock, isUnlocked]);
}
