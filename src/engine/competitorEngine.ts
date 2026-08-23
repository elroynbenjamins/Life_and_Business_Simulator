import { OwnedBusiness, BusinessCompetitor } from '../types/game';
import { getBusinessMarketStrength } from './businessEngine';

const COMPANIES = ['RivalCo', 'FastTrack Inc', 'NextGen Ltd', 'ProEdge', 'Summit Corp', 'Eclipse Ltd', 'Pinnacle Co', 'Vortex Group', 'Alpha Ventures'];
const CEOS = ['Maya Chen', 'Lucas Vermeer', 'Sofia Martins', 'Noah Williams', 'Amara Okafor', 'Daniel Kim', 'Elena Rossi', 'Owen Murphy', 'Priya Shah'];
const PERSONALITIES: NonNullable<BusinessCompetitor['personality']>[] = ['conservative', 'innovator', 'aggressive', 'premium', 'expansionist'];
const STRATEGIES: Record<NonNullable<BusinessCompetitor['personality']>, NonNullable<BusinessCompetitor['strategy']>> = {
  conservative: 'cost_leadership', innovator: 'innovation', aggressive: 'price_war', premium: 'premium_brand', expansionist: 'expansion',
};

function hash(value: string): number {
  let result = 0;
  for (let index = 0; index < value.length; index++) result = ((result * 31) + value.charCodeAt(index)) >>> 0;
  return result;
}

function enrichCompetitor(competitor: BusinessCompetitor, index: number, currentWeek: number): BusinessCompetitor {
  const identityIndex = (hash(competitor.id) + index) % CEOS.length;
  const personality = competitor.personality ?? PERSONALITIES[identityIndex % PERSONALITIES.length];
  return {
    ...competitor,
    ceoName: competitor.ceoName ?? CEOS[identityIndex], personality,
    strategy: competitor.strategy ?? STRATEGIES[personality],
    cash: competitor.cash ?? Math.round(25_000 + competitor.strength * 1_000),
    reputation: competitor.reputation ?? Math.max(15, Math.min(85, 20 + competitor.strength * 0.4)),
    lastDecisionWeek: competitor.lastDecisionWeek ?? competitor.enteredWeek ?? currentWeek,
    lastDecision: competitor.lastDecision ?? 'Entered the local market',
    decisionHistory: competitor.decisionHistory ?? [{ week: competitor.enteredWeek ?? currentWeek, action: 'Entered the local market' }],
  };
}

export function createInitialCompetitors(biz: OwnedBusiness, currentWeek: number): BusinessCompetitor[] {
  const strength = getBusinessMarketStrength(biz) * 3;
  const offset = hash(biz.id) % COMPANIES.length;
  return Array.from({ length: 3 }, (_, index) => {
    const identityIndex = (offset + index) % COMPANIES.length;
    const personality = PERSONALITIES[identityIndex % PERSONALITIES.length];
    return {
      id: `comp_${biz.id}_${index + 1}`, name: COMPANIES[identityIndex], ceoName: CEOS[identityIndex], personality,
      strategy: STRATEGIES[personality], strength, cash: Math.round(25_000 + strength * 1_000),
      reputation: Math.max(15, Math.min(85, 20 + strength * 0.4)), enteredWeek: currentWeek,
      lastDecisionWeek: currentWeek, lastDecision: 'Entered the local market',
      decisionHistory: [{ week: currentWeek, action: 'Entered the local market' }],
    };
  });
}

export function migrateBusinessCompetitors(biz: OwnedBusiness, existing: BusinessCompetitor[], currentWeek: number): BusinessCompetitor[] {
  const initial = createInitialCompetitors(biz, currentWeek);
  const complete = existing.length === 3 ? existing.slice(0, 3) : [...existing.slice(0, 3), ...initial.slice(existing.length)].slice(0, 3);
  return complete.map((competitor, index) => enrichCompetitor(competitor, index, currentWeek));
}

function makeDecision(rival: BusinessCompetitor, currentWeek: number): BusinessCompetitor {
  const strategy = rival.strategy ?? 'cost_leadership';
  let action = 'Focused on steady operations', strengthChange = 0.2, cashChange = 250, reputationChange = 0.05;
  if (strategy === 'price_war') { action = 'Launched an aggressive price campaign'; strengthChange = 1.1; cashChange = -2_000; reputationChange = -0.15; }
  else if (strategy === 'innovation') { action = 'Invested in a new product'; strengthChange = Math.random() < 0.65 ? 1.5 : -0.4; cashChange = -3_000; reputationChange = strengthChange > 0 ? 0.5 : -0.2; }
  else if (strategy === 'premium_brand') { action = 'Expanded its premium brand campaign'; strengthChange = 0.7; cashChange = -1_500; reputationChange = 0.7; }
  else if (strategy === 'expansion') { action = 'Opened a new regional location'; strengthChange = 1.3; cashChange = -4_000; reputationChange = 0.3; }
  else { action = 'Cut operating costs'; strengthChange = 0.35; cashChange = 1_500; reputationChange = 0.1; }
  return {
    ...rival, strength: Math.max(5, rival.strength + strengthChange), cash: Math.max(-50_000, (rival.cash ?? 0) + cashChange),
    reputation: Math.max(0, Math.min(100, (rival.reputation ?? 30) + reputationChange)), lastDecisionWeek: currentWeek, lastDecision: action,
    decisionHistory: [...(rival.decisionHistory ?? []), { week: currentWeek, action }].slice(-12),
  };
}

/** Process persistent rival CEOs and calculate their pressure on each player business. */
export function processCompetitors(businesses: OwnedBusiness[], competitors: Record<string, BusinessCompetitor[]>, currentWeek: number): {
  updatedCompetitors: Record<string, BusinessCompetitor[]>; competitorRevenueMultipliers: Record<string, number>;
} {
  const updatedCompetitors: Record<string, BusinessCompetitor[]> = { ...competitors };
  const competitorRevenueMultipliers: Record<string, number> = {};
  for (const biz of businesses ?? []) {
    let rivals = migrateBusinessCompetitors(biz, updatedCompetitors[biz.id] ?? [], currentWeek);
    rivals = rivals.map((raw, index) => {
      let rival = enrichCompetitor(raw, index, currentWeek);
      const growth = rival.personality === 'expansionist' ? 0.38 : rival.personality === 'aggressive' ? 0.34 : 0.27;
      rival = { ...rival, strength: Math.max(5, rival.strength + growth), cash: (rival.cash ?? 0) + Math.round(rival.strength * 8) };
      if (currentWeek - (rival.lastDecisionWeek ?? currentWeek) >= 4) rival = makeDecision(rival, currentWeek);
      return rival;
    });
    updatedCompetitors[biz.id] = rivals;
    const totalStrength = rivals.reduce((total, rival) => total + rival.strength, 0);
    const aggressivePressure = rivals.filter((rival) => rival.strategy === 'price_war').length * 0.015;
    const reputationDefense = (biz.reputation ?? 50) / 100;
    const impact = totalStrength * 0.002 * (1 - reputationDefense * 0.5) + aggressivePressure;
    competitorRevenueMultipliers[biz.id] = Math.max(0.7, 1 - impact);
  }
  return { updatedCompetitors, competitorRevenueMultipliers };
}
