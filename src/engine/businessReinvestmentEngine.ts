import {
  BusinessReinvestmentArea,
  BusinessReinvestmentState,
  OwnedBusiness,
} from '../types/game';
import businessTypesData from '../data/business_types.json';

function getBusinessType(typeId: string) {
  return (businessTypesData as any[]).find((type) => type?.id === typeId);
}

export const BUSINESS_REINVESTMENT_AREAS: Record<BusinessReinvestmentArea, {
  area: BusinessReinvestmentArea;
  name: string;
  icon: string;
  description: string;
  valuationCostPct: number;
  minCost: number;
  maxCost: number;
  weeks: number;
  baseDecayPerWeek: number;
}> = {
  technology: {
    area: 'technology',
    name: 'Technology Refresh',
    icon: '💻',
    description: 'Replace aging software, systems, digital tools and core technology before they drag on productivity.',
    valuationCostPct: 0.020,
    minCost: 15_000,
    maxCost: 12_000_000,
    weeks: 4,
    baseDecayPerWeek: 0.55,
  },
  premises: {
    area: 'premises',
    name: 'Premises Renovation',
    icon: '🏗️',
    description: 'Renovate customer areas, offices, utilities and building infrastructure to maintain standards.',
    valuationCostPct: 0.030,
    minCost: 25_000,
    maxCost: 20_000_000,
    weeks: 6,
    baseDecayPerWeek: 0.38,
  },
  equipment: {
    area: 'equipment',
    name: 'Equipment Renewal',
    icon: '🛠️',
    description: 'Replace worn operating equipment, machinery and essential business hardware before failures compound.',
    valuationCostPct: 0.025,
    minCost: 20_000,
    maxCost: 15_000_000,
    weeks: 5,
    baseDecayPerWeek: 0.48,
  },
};

const INDUSTRY_WEAR_MULTIPLIERS: Record<string, Partial<Record<BusinessReinvestmentArea, number>>> = {
  Technology: { technology: 1.35, equipment: 0.85 },
  Services: { technology: 1.15, premises: 0.85, equipment: 0.75 },
  Retail: { premises: 1.20, equipment: 1.05 },
  'Food & Beverage': { premises: 1.25, equipment: 1.20 },
  Hospitality: { premises: 1.35, equipment: 1.10 },
  Entertainment: { premises: 1.10, technology: 1.10 },
  Fitness: { premises: 1.10, equipment: 1.30 },
  Beauty: { premises: 1.15, equipment: 1.10 },
  Manufacturing: { equipment: 1.40, technology: 1.05 },
  Construction: { equipment: 1.35, technology: 0.90 },
  Healthcare: { technology: 1.10, equipment: 1.20, premises: 1.10 },
  Automotive: { equipment: 1.40, premises: 1.05 },
  'Real Estate': { technology: 0.95, premises: 0.90, equipment: 0.70 },
  Real_Estate: { technology: 0.95, premises: 0.90, equipment: 0.70 },
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function createDefaultBusinessReinvestmentState(
  globalWeek = 1,
): BusinessReinvestmentState {
  const startWeek = Math.max(1, globalWeek);
  return {
    technology: { condition: 100, lastRenewedGlobalWeek: startWeek },
    premises: { condition: 100, lastRenewedGlobalWeek: startWeek },
    equipment: { condition: 100, lastRenewedGlobalWeek: startWeek },
  };
}

export function normalizeBusinessReinvestmentState(
  state: Partial<BusinessReinvestmentState> | null | undefined,
  globalWeek = 1,
): BusinessReinvestmentState {
  const fallback = createDefaultBusinessReinvestmentState(globalWeek);
  const normalizeTrack = (track: any, fallbackTrack: any) => ({
    condition: clamp(
      typeof track?.condition === 'number' && Number.isFinite(track.condition)
        ? track.condition
        : fallbackTrack.condition,
      0,
      100,
    ),
    lastRenewedGlobalWeek: Math.max(
      1,
      Math.round(track?.lastRenewedGlobalWeek ?? fallbackTrack.lastRenewedGlobalWeek),
    ),
  });

  return {
    technology: normalizeTrack(state?.technology, fallback.technology),
    premises: normalizeTrack(state?.premises, fallback.premises),
    equipment: normalizeTrack(state?.equipment, fallback.equipment),
  };
}

function getWearMultiplier(business: OwnedBusiness, area: BusinessReinvestmentArea): number {
  const industry = getBusinessType(business.typeId)?.industry ?? '';
  const industryMultiplier = INDUSTRY_WEAR_MULTIPLIERS[industry]?.[area] ?? 1;
  const scaleMultiplier = (business.valuation ?? 0) >= 100_000_000
    ? 1.10
    : (business.valuation ?? 0) >= 25_000_000
      ? 1.05
      : 1;
  return industryMultiplier * scaleMultiplier;
}

export function tickBusinessReinvestment(
  business: OwnedBusiness,
  currentGlobalWeek: number,
): {
  reinvestment: BusinessReinvestmentState;
  activeReinvestment: OwnedBusiness['activeReinvestment'];
  completedArea: BusinessReinvestmentArea | null;
} {
  const current = normalizeBusinessReinvestmentState(business.reinvestment, currentGlobalWeek);
  const active = business.activeReinvestment ? { ...business.activeReinvestment } : null;
  let completedArea: BusinessReinvestmentArea | null = null;

  const next: BusinessReinvestmentState = {
    technology: { ...current.technology },
    premises: { ...current.premises },
    equipment: { ...current.equipment },
  };

  for (const area of Object.keys(BUSINESS_REINVESTMENT_AREAS) as BusinessReinvestmentArea[]) {
    if (active?.area === area) continue;
    const definition = BUSINESS_REINVESTMENT_AREAS[area];
    const decay = definition.baseDecayPerWeek * getWearMultiplier(business, area);
    next[area].condition = clamp(next[area].condition - decay, 0, 100);
  }

  let nextActive = active;
  if (nextActive) {
    if ((nextActive.weeksRemaining ?? 0) <= 1) {
      completedArea = nextActive.area;
      next[completedArea] = {
        condition: 100,
        lastRenewedGlobalWeek: Math.max(1, currentGlobalWeek),
      };
      nextActive = null;
    } else {
      nextActive = {
        ...nextActive,
        weeksRemaining: Math.max(0, nextActive.weeksRemaining - 1),
      };
    }
  }

  return {
    reinvestment: next,
    activeReinvestment: nextActive,
    completedArea,
  };
}

function conditionDeficit(condition: number, threshold: number): number {
  if (condition >= threshold) return 0;
  return clamp((threshold - condition) / threshold, 0, 1);
}

export function getBusinessReinvestmentEffects(business: OwnedBusiness) {
  const state = normalizeBusinessReinvestmentState(business.reinvestment, 1);
  const technologyDeficit = conditionDeficit(state.technology.condition, 75);
  const premisesDeficit = conditionDeficit(state.premises.condition, 75);
  const equipmentDeficit = conditionDeficit(state.equipment.condition, 75);

  const revenuePenalty = clamp(
    technologyDeficit * 0.08 + premisesDeficit * 0.05 + equipmentDeficit * 0.06,
    0,
    0.15,
  );
  const expenseIncrease = clamp(
    technologyDeficit * 0.025 + premisesDeficit * 0.035 + equipmentDeficit * 0.065,
    0,
    0.12,
  );
  const crisisIncrease = clamp(
    technologyDeficit * 0.025 + premisesDeficit * 0.035 + equipmentDeficit * 0.04,
    0,
    0.10,
  );
  const reputationDrag = clamp(premisesDeficit * 0.05 + technologyDeficit * 0.02, 0, 0.06);

  return {
    revenuePenalty,
    expenseIncrease,
    crisisIncrease,
    reputationDrag,
    averageCondition: (
      state.technology.condition
      + state.premises.condition
      + state.equipment.condition
    ) / 3,
  };
}

export function getBusinessReinvestmentCost(
  business: OwnedBusiness,
  area: BusinessReinvestmentArea,
  inflationMultiplier = 1,
): number {
  const definition = BUSINESS_REINVESTMENT_AREAS[area];
  const type = getBusinessType(business.typeId);
  const startupFloor = Math.max(0, (type?.startupCost ?? 0) * 0.55);
  const valuationBased = Math.max(0, business.valuation ?? 0) * definition.valuationCostPct;
  const preInflation = clamp(
    Math.max(definition.minCost, startupFloor, valuationBased),
    definition.minCost,
    definition.maxCost,
  );
  return Math.round(preInflation * Math.max(0.5, inflationMultiplier || 1));
}

export function canStartBusinessReinvestment(
  business: OwnedBusiness,
  area: BusinessReinvestmentArea,
): { allowed: boolean; reason: string | null } {
  if (business.activeReinvestment) {
    return { allowed: false, reason: 'Another reinvestment project is already in progress.' };
  }
  const state = normalizeBusinessReinvestmentState(business.reinvestment, 1);
  if (state[area].condition >= 92) {
    return { allowed: false, reason: 'This area is still in excellent condition.' };
  }
  return { allowed: true, reason: null };
}

export function getBusinessConditionLabel(condition: number): {
  label: 'Current' | 'Aging' | 'Outdated' | 'Critical';
  severity: 'good' | 'warning' | 'bad';
} {
  if (condition >= 75) return { label: 'Current', severity: 'good' };
  if (condition >= 60) return { label: 'Aging', severity: 'warning' };
  if (condition >= 40) return { label: 'Outdated', severity: 'warning' };
  return { label: 'Critical', severity: 'bad' };
}

export function getBusinessReinvestmentUrgency(business: OwnedBusiness): BusinessReinvestmentArea | null {
  const state = normalizeBusinessReinvestmentState(business.reinvestment, 1);
  const entries = (Object.keys(BUSINESS_REINVESTMENT_AREAS) as BusinessReinvestmentArea[])
    .map((area) => ({ area, condition: state[area].condition }))
    .sort((a, b) => a.condition - b.condition);
  return entries[0]?.condition < 75 ? entries[0].area : null;
}
