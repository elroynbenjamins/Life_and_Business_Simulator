import { OwnedBusiness, BusinessCompetitor } from '../types/game';
import { getBusinessMarketStrength } from './businessEngine';

const COMPETITOR_NAMES = [
  'RivalCo', 'FastTrack Inc', 'NextGen Ltd', 'ProEdge', 'MegaTrade',
  'Summit Corp', 'Eclipse Ltd', 'Pinnacle Co', 'VortexGroup', 'AlphaRival',
];

export function createInitialCompetitors(biz: OwnedBusiness, currentWeek: number): BusinessCompetitor[] {
  const strength = getBusinessMarketStrength(biz) * 3;
  return COMPETITOR_NAMES.slice(0, 3).map((name, index) => ({
    id: `comp_${biz.id}_${index + 1}`,
    name,
    strength,
    enteredWeek: currentWeek,
  }));
}

/**
 * Process competitor AI for all businesses.
 * Competitors appear and disappear randomly. They affect revenue.
 */
export function processCompetitors(
  businesses: OwnedBusiness[],
  competitors: Record<string, BusinessCompetitor[]>,
  currentWeek: number
): {
  updatedCompetitors: Record<string, BusinessCompetitor[]>;
  competitorRevenueMultipliers: Record<string, number>;
} {
  const updatedCompetitors: Record<string, BusinessCompetitor[]> = { ...competitors };
  const competitorRevenueMultipliers: Record<string, number> = {};

  for (const biz of businesses ?? []) {
    let bizCompetitors = [...(updatedCompetitors[biz.id] ?? [])];
    if (bizCompetitors.length !== 3) {
      const initial = createInitialCompetitors(biz, currentWeek);
      bizCompetitors = [...bizCompetitors.slice(0, 3), ...initial.slice(bizCompetitors.length)].slice(0, 3);
    }

    // Competitors grow stronger over time
    bizCompetitors = bizCompetitors.map((c) => ({
      ...c,
      strength: c.strength + 0.3,
    }));

    updatedCompetitors[biz.id] = bizCompetitors;

    // Calculate revenue impact: each competitor reduces revenue slightly
    // Player's reputation counters competitor effect
    const totalCompStrength = bizCompetitors.reduce((t, c) => t + c.strength, 0);
    const reputationDefense = (biz.reputation ?? 50) / 100;
    const impact = totalCompStrength * 0.002 * (1 - reputationDefense * 0.5);
    competitorRevenueMultipliers[biz.id] = Math.max(0.7, 1 - impact);
  }

  return { updatedCompetitors, competitorRevenueMultipliers };
}
