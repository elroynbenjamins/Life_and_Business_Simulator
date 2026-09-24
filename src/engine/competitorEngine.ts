import { BusinessCompetitor, EconomicCyclePhase, OwnedBusiness } from '../types/game';
import { getBusinessMarketStrength } from './businessEngine';

const COMPANIES = ['RivalCo', 'FastTrack Inc', 'NextGen Ltd', 'ProEdge', 'Summit Corp', 'Eclipse Ltd', 'Pinnacle Co', 'Vortex Group', 'Alpha Ventures'];
const CEOS = ['Maya Chen', 'Lucas Vermeer', 'Sofia Martins', 'Noah Williams', 'Amara Okafor', 'Daniel Kim', 'Elena Rossi', 'Owen Murphy', 'Priya Shah'];
const PERSONALITIES: NonNullable<BusinessCompetitor['personality']>[] = ['conservative', 'innovator', 'aggressive', 'premium', 'expansionist'];
const STRATEGIES: Record<NonNullable<BusinessCompetitor['personality']>, NonNullable<BusinessCompetitor['strategy']>> = {
  conservative: 'cost_leadership',
  innovator: 'innovation',
  aggressive: 'price_war',
  premium: 'premium_brand',
  expansionist: 'expansion',
};

const CYCLE_GROWTH_MULTIPLIER: Record<EconomicCyclePhase, number> = {
  expansion: 1.05,
  boom: 1.30,
  slowdown: 0.78,
  recession: 0.45,
  recovery: 1.08,
};

const CYCLE_CASH_MULTIPLIER: Record<EconomicCyclePhase, number> = {
  expansion: 1.05,
  boom: 1.35,
  slowdown: 0.82,
  recession: 0.48,
  recovery: 1.02,
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
    ceoName: competitor.ceoName ?? CEOS[identityIndex],
    personality,
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
      id: `comp_${biz.id}_${index + 1}`,
      name: COMPANIES[identityIndex],
      ceoName: CEOS[identityIndex],
      personality,
      strategy: STRATEGIES[personality],
      strength,
      cash: Math.round(25_000 + strength * 1_000),
      reputation: Math.max(15, Math.min(85, 20 + strength * 0.4)),
      enteredWeek: currentWeek,
      lastDecisionWeek: currentWeek,
      lastDecision: 'Entered the local market',
      decisionHistory: [{ week: currentWeek, action: 'Entered the local market' }],
    };
  });
}

export function migrateBusinessCompetitors(biz: OwnedBusiness, existing: BusinessCompetitor[], currentWeek: number): BusinessCompetitor[] {
  const initial = createInitialCompetitors(biz, currentWeek);
  const complete = existing.length === 3
    ? existing.slice(0, 3)
    : [...existing.slice(0, 3), ...initial.slice(existing.length)].slice(0, 3);
  return complete.map((competitor, index) => enrichCompetitor(competitor, index, currentWeek));
}

function makeDecision(
  rival: BusinessCompetitor,
  currentWeek: number,
  economicCyclePhase: EconomicCyclePhase,
): BusinessCompetitor {
  const strategy = rival.strategy ?? 'cost_leadership';
  let action = 'Focused on steady operations';
  let strengthChange = 0.2;
  let cashChange = 250;
  let reputationChange = 0.05;

  if (economicCyclePhase === 'recession') {
    if (strategy === 'cost_leadership') {
      action = 'Protected cash and cut operating costs during the recession';
      strengthChange = 0.15;
      cashChange = 3_000;
      reputationChange = 0.05;
    } else if (strategy === 'price_war') {
      action = 'Discounted aggressively to steal share in the recession';
      strengthChange = 0.65;
      cashChange = -3_500;
      reputationChange = -0.25;
    } else if (strategy === 'innovation') {
      const success = Math.random() < 0.55;
      action = 'Invested selectively while weaker competitors pulled back';
      strengthChange = success ? 0.9 : -0.25;
      cashChange = -1_800;
      reputationChange = success ? 0.4 : -0.1;
    } else if (strategy === 'premium_brand') {
      action = 'Protected its premium position and reduced discretionary spending';
      strengthChange = 0.2;
      cashChange = 500;
      reputationChange = 0.35;
    } else {
      action = 'Paused regional expansion to preserve liquidity';
      strengthChange = -0.2;
      cashChange = 1_800;
      reputationChange = 0;
    }
  } else if (economicCyclePhase === 'boom') {
    if (strategy === 'expansion') {
      action = 'Accelerated regional expansion during the boom';
      strengthChange = 1.9;
      cashChange = -5_500;
      reputationChange = 0.45;
    } else if (strategy === 'price_war') {
      action = 'Used strong demand to launch an aggressive market-share push';
      strengthChange = 1.4;
      cashChange = -2_500;
      reputationChange = -0.1;
    } else if (strategy === 'innovation') {
      action = 'Increased product investment while demand was strong';
      strengthChange = Math.random() < 0.72 ? 1.7 : -0.3;
      cashChange = -3_500;
      reputationChange = 0.55;
    } else if (strategy === 'premium_brand') {
      action = 'Raised prices and expanded its premium brand';
      strengthChange = 1.0;
      cashChange = -1_750;
      reputationChange = 0.8;
    } else {
      action = 'Banked boom profits and tightened operating discipline';
      strengthChange = 0.45;
      cashChange = 2_200;
      reputationChange = 0.1;
    }
  } else if (economicCyclePhase === 'recovery') {
    if (strategy === 'expansion') {
      action = 'Restarted expansion early in the recovery';
      strengthChange = 1.45;
      cashChange = -4_000;
      reputationChange = 0.35;
    } else if (strategy === 'innovation') {
      action = 'Launched a recovery-phase product investment';
      strengthChange = Math.random() < 0.68 ? 1.4 : -0.2;
      cashChange = -2_750;
      reputationChange = 0.45;
    } else if (strategy === 'price_war') {
      action = 'Pushed hard for customers returning to the market';
      strengthChange = 1.05;
      cashChange = -2_100;
      reputationChange = -0.1;
    } else if (strategy === 'premium_brand') {
      action = 'Rebuilt premium demand as confidence returned';
      strengthChange = 0.8;
      cashChange = -1_250;
      reputationChange = 0.6;
    } else {
      action = 'Kept costs controlled while demand recovered';
      strengthChange = 0.4;
      cashChange = 1_500;
      reputationChange = 0.1;
    }
  } else if (strategy === 'price_war') {
    action = 'Launched an aggressive price campaign';
    strengthChange = 1.1;
    cashChange = -2_000;
    reputationChange = -0.15;
  } else if (strategy === 'innovation') {
    action = 'Invested in a new product';
    strengthChange = Math.random() < 0.65 ? 1.5 : -0.4;
    cashChange = -3_000;
    reputationChange = strengthChange > 0 ? 0.5 : -0.2;
  } else if (strategy === 'premium_brand') {
    action = 'Expanded its premium brand campaign';
    strengthChange = 0.7;
    cashChange = -1_500;
    reputationChange = 0.7;
  } else if (strategy === 'expansion') {
    action = economicCyclePhase === 'slowdown'
      ? 'Slowed expansion and focused on existing locations'
      : 'Opened a new regional location';
    strengthChange = economicCyclePhase === 'slowdown' ? 0.25 : 1.3;
    cashChange = economicCyclePhase === 'slowdown' ? 500 : -4_000;
    reputationChange = economicCyclePhase === 'slowdown' ? 0.1 : 0.3;
  } else {
    action = economicCyclePhase === 'slowdown'
      ? 'Cut costs ahead of weaker demand'
      : 'Cut operating costs';
    strengthChange = 0.35;
    cashChange = economicCyclePhase === 'slowdown' ? 2_000 : 1_500;
    reputationChange = 0.1;
  }

  return {
    ...rival,
    strength: Math.max(5, rival.strength + strengthChange),
    cash: Math.max(-50_000, (rival.cash ?? 0) + cashChange),
    reputation: Math.max(0, Math.min(100, (rival.reputation ?? 30) + reputationChange)),
    lastDecisionWeek: currentWeek,
    lastDecision: action,
    decisionHistory: [...(rival.decisionHistory ?? []), { week: currentWeek, action }].slice(-12),
  };
}

/** Process persistent rival CEOs and calculate their pressure on each player business. */
export function processCompetitors(
  businesses: OwnedBusiness[],
  competitors: Record<string, BusinessCompetitor[]>,
  currentWeek: number,
  economicCyclePhase: EconomicCyclePhase = 'expansion',
): {
  updatedCompetitors: Record<string, BusinessCompetitor[]>;
  competitorRevenueMultipliers: Record<string, number>;
} {
  const updatedCompetitors: Record<string, BusinessCompetitor[]> = { ...competitors };
  const competitorRevenueMultipliers: Record<string, number> = {};
  const cycleGrowth = CYCLE_GROWTH_MULTIPLIER[economicCyclePhase] ?? 1;
  const cycleCash = CYCLE_CASH_MULTIPLIER[economicCyclePhase] ?? 1;

  for (const biz of businesses ?? []) {
    let rivals = migrateBusinessCompetitors(biz, updatedCompetitors[biz.id] ?? [], currentWeek);
    rivals = rivals.map((raw, index) => {
      let rival = enrichCompetitor(raw, index, currentWeek);
      const baseGrowth = rival.personality === 'expansionist'
        ? 0.38
        : rival.personality === 'aggressive'
          ? 0.34
          : 0.27;
      const recessionRisk = economicCyclePhase === 'recession'
        && ['aggressive', 'expansionist'].includes(rival.personality ?? '')
        && (rival.cash ?? 0) < 20_000
        ? -0.25
        : 0;
      rival = {
        ...rival,
        strength: Math.max(5, rival.strength + baseGrowth * cycleGrowth + recessionRisk),
        cash: (rival.cash ?? 0) + Math.round(rival.strength * 8 * cycleCash),
      };
      if (currentWeek - (rival.lastDecisionWeek ?? currentWeek) >= 4) {
        rival = makeDecision(rival, currentWeek, economicCyclePhase);
      }
      return rival;
    });

    updatedCompetitors[biz.id] = rivals;
    const totalEffectiveStrength = rivals.reduce((total, rival) => {
      const liquidityFactor = (rival.cash ?? 0) < 0
        ? 0.72
        : (rival.cash ?? 0) > 100_000
          ? 1.06
          : 1;
      return total + rival.strength * liquidityFactor;
    }, 0);
    const aggressivePressure = rivals.filter((rival) => rival.strategy === 'price_war').length
      * (economicCyclePhase === 'recession' ? 0.020 : economicCyclePhase === 'boom' ? 0.018 : 0.015);
    const reputationDefense = (biz.reputation ?? 50) / 100;
    const cyclePressure = economicCyclePhase === 'recession'
      ? 0.90
      : economicCyclePhase === 'boom'
        ? 1.10
        : economicCyclePhase === 'slowdown'
          ? 0.94
          : 1;
    const impact = (
      totalEffectiveStrength * 0.002 * (1 - reputationDefense * 0.5)
      + aggressivePressure
    ) * cyclePressure;
    competitorRevenueMultipliers[biz.id] = Math.max(0.7, 1 - impact);
  }

  return { updatedCompetitors, competitorRevenueMultipliers };
}
