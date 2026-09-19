import { GameState } from '../types/game';
import jobs from '../data/jobs.json';

export function canUseCareerAsset(state: GameState, kind: 'housing' | 'car', id: string): boolean {
  const level = state.career?.companyId ? state.career.positionLevel : jobs.find(job => job.id === state.currentJobId)?.level ?? 0;
  if (!level) return true;
  const housing = ['cheap_apartment', 'studio_apartment', 'small_house', 'family_house', 'luxury_villa', 'mansion'];
  const cars = ['none', 'used_car', 'sedan', 'suv', 'sports_car', 'luxury_car'];
  const required = kind === 'housing'
    ? level >= 7 ? 4 : level >= 6 ? 3 : level >= 5 ? 2 : level >= 3 ? 1 : 0
    : level >= 5 ? 3 : level >= 3 ? 2 : 1;
  return (kind === 'housing' ? housing : cars).indexOf(id) >= required;
}
