import { OwnedBusiness, BusinessEmployee, ActiveBusinessEvent, BusinessLoan, EmployeeCandidate, ActiveBusinessProject, BusinessExpenseBreakdown, EmployeeTier, EmployeeBuff, BusinessTimelineEntry, BusinessPendingDecision, BusinessPendingDecisionChoice, BusinessStrategicFocus, BusinessDelegationPolicy, HoldingCompany } from '../types/game';
import { getHoldingSharedServiceEffects } from './holdingCompanyEngine';
import {
  createDefaultBusinessReinvestmentState,
  getBusinessReinvestmentEffects,
  getBusinessReinvestmentUrgency,
  tickBusinessReinvestment,
} from './businessReinvestmentEngine';
import {
  applyBusinessBudgetWeek,
  createBusinessBudgetPlan,
} from './businessBudgetEngine';
import {
  getBusinessInsuranceTier,
  getBusinessInsuranceTotalWeeklyPremium,
} from './businessInsuranceEngine';
import {
  appendCompletedCorporateCapex,
  getCorporateCapexBookValue,
  getCorporateCapexOperatingEffects,
  getCorporateCapexProject,
  getCorporateCrisisBaseChance,
  getCorporateScaleTier,
  makeCorporateScaleCrisis,
} from './corporateScaleEngine';
import {
  getBusinessGovernanceEffects,
  tickBusinessGovernance,
} from './businessGovernanceEngine';
import {
  CORPORATE_WORKFORCE_UNLOCK_VALUATION,
  applyCorporateHrDecisionChoice,
  createCorporateWorkforce,
  makeCorporateHrDecision,
  scheduleNextCorporateHrEvent,
  tickCorporateWorkforce,
} from './businessWorkforceEngine';
import { appendCorporateKpiSnapshot } from './corporateReportingEngine';
import {
  closeCompletedBusinessManagementQuarter,
  ensureBusinessManagementTargetPlan,
} from './businessManagementTargetsEngine';

// -----------------------------------------------------------------------------
// D&D-style tier system for employees
// -----------------------------------------------------------------------------
export const TIER_CONFIG: Record<EmployeeTier, { chance: number; color: string; salaryMult: number; skillBonus: number; potentialBonus: number; buffMagnitude: number; label: string }> = {
  common:    { chance: 0.65, color: '#9CA3AF', salaryMult: 1.00, skillBonus: 0,  potentialBonus: 0,  buffMagnitude: 1, label: 'Common' },
  rare:      { chance: 0.20, color: '#3B82F6', salaryMult: 1.30, skillBonus: 5,  potentialBonus: 5,  buffMagnitude: 2, label: 'Rare' },
  epic:      { chance: 0.10, color: '#A855F7', salaryMult: 1.75, skillBonus: 10, potentialBonus: 10, buffMagnitude: 4, label: 'Epic' },
  legendary: { chance: 0.05, color: '#F59E0B', salaryMult: 2.50, skillBonus: 15, potentialBonus: 15, buffMagnitude: 7, label: 'Legendary' },
};

function rollTier(): EmployeeTier {
  const r = Math.random();
  if (r < 0.05) return 'legendary';
  if (r < 0.15) return 'epic';
  if (r < 0.35) return 'rare';
  return 'common';
}

/** Buff blueprints — value=magnitude before tier multiplier */
const BUFF_POOL: Array<{ type: EmployeeBuff['type']; base: number; label: (v: number) => string }> = [
  { type: 'revenue',      base: 0.4, label: (v) => `+${v.toFixed(1)}% revenue` },
  { type: 'expense',      base: 0.3, label: (v) => `-${v.toFixed(1)}% expenses` },
  { type: 'morale',       base: 0.3, label: (v) => `+${v.toFixed(1)} morale/wk to team` },
  { type: 'productivity', base: 1.5, label: (v) => `+${v.toFixed(1)}% productivity` },
  { type: 'reputation',   base: 0.06, label: (v) => `+${v.toFixed(2)} rep/wk` },
];

function rollBuffs(tier: EmployeeTier): EmployeeBuff[] {
  const mag = TIER_CONFIG[tier].buffMagnitude;
  const pool = [...BUFF_POOL];
  // Shuffle & pick 2
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, 2).map((b) => {
    const value = +(b.base * mag).toFixed(2);
    return { type: b.type, value, label: b.label(value) };
  });
}

/** Aggregate multipliers/additions across all employees' buffs */
export function aggregateEmployeeBuffs(employees: BusinessEmployee[]): {
  revenueMult: number;
  expenseMult: number;
  weeklyMoraleBoost: number;
  productivityMult: number;
  weeklyRepBoost: number;
} {
  let revenuePct = 0, expensePct = 0, moraleBoost = 0, productivityPct = 0, repBoost = 0;
  for (const e of employees ?? []) {
    for (const b of e.buffs ?? []) {
      if (b.type === 'revenue') revenuePct += b.value;
      else if (b.type === 'expense') expensePct += b.value;
      else if (b.type === 'morale') moraleBoost += b.value;
      else if (b.type === 'productivity') productivityPct += b.value;
      else if (b.type === 'reputation') repBoost += b.value;
    }
  }
  return {
    revenueMult: 1 + revenuePct / 100,
    expenseMult: Math.max(0.5, 1 - expensePct / 100),
    weeklyMoraleBoost: moraleBoost,
    productivityMult: 1 + productivityPct / 100,
    weeklyRepBoost: repBoost,
  };
}

// -----------------------------------------------------------------------------
// Bad seasonal events per industry (fires when that season starts)
// -----------------------------------------------------------------------------
const BAD_SEASONS: Record<string, { seasonIdx: number; title: string; icon: string; revMult: number; expMult: number }[]> = {
  Retail:            [{ seasonIdx: 1, title: 'Post-Holiday Slump',   icon: '🛍️', revMult: 0.75, expMult: 1.08 }],
  'Food & Beverage': [{ seasonIdx: 3, title: 'Supply Chain Squeeze', icon: '🥬', revMult: 0.85, expMult: 1.15 }],
  Hospitality:       [{ seasonIdx: 0, title: 'Off-Season Freeze',    icon: '❄️', revMult: 0.70, expMult: 1.10 }],
  Entertainment:     [{ seasonIdx: 3, title: 'Streaming Wars',       icon: '📺', revMult: 0.80, expMult: 1.08 }],
  Technology:        [{ seasonIdx: 2, title: 'Talent Shortage',      icon: '💻', revMult: 0.90, expMult: 1.15 }],
  Services:          [{ seasonIdx: 0, title: 'Client Budget Freeze', icon: '❄️', revMult: 0.80, expMult: 1.05 }],
  Manufacturing:     [{ seasonIdx: 0, title: 'Material Cost Spike',  icon: '🏭', revMult: 0.90, expMult: 1.20 }],
  Fitness:           [{ seasonIdx: 2, title: 'Summer Cancellations', icon: '🏖️', revMult: 0.75, expMult: 1.05 }],
  Beauty:            [{ seasonIdx: 3, title: 'Post-Wedding Lull',    icon: '💄', revMult: 0.80, expMult: 1.05 }],
  Healthcare:        [{ seasonIdx: 1, title: 'Insurance Delays',     icon: '🏥', revMult: 0.85, expMult: 1.10 }],
  Automotive:        [{ seasonIdx: 0, title: 'Winter Sales Slump',   icon: '🚗', revMult: 0.80, expMult: 1.10 }],
  Construction:      [{ seasonIdx: 0, title: 'Frozen Job Sites',     icon: '🧊', revMult: 0.60, expMult: 1.15 }],
  Real_Estate:       [{ seasonIdx: 0, title: 'Frozen Market',        icon: '🏠', revMult: 0.70, expMult: 1.05 }],
  'Real Estate':     [{ seasonIdx: 3, title: 'Interest Rate Shock',  icon: '📉', revMult: 0.75, expMult: 1.08 }],
};

function getBadSeasonForIndustry(industry: string, seasonIdx: number) {
  return (BAD_SEASONS[industry] ?? []).find((b) => b.seasonIdx === seasonIdx) ?? null;
}
import businessTypesData from '../data/business_types.json';
import businessUpgradesData from '../data/business_upgrades.json';
import businessEventsData from '../data/business_events.json';
import employeeRolesData from '../data/employee_roles.json';
import moraleActionsData from '../data/morale_actions.json';
import trainingData from '../data/employee_training.json';
import projectsData from '../data/business_projects.json';
import moraleEventsData from '../data/business_morale_events.json';
import businessLocationsData from '../data/business_locations.json';

export function getPlayerOwnershipPct(biz: OwnedBusiness): number {
  const ownership = biz.ownership ?? [];
  if (ownership.length === 0) return 100;
  return Math.max(0, Math.min(100, ownership
    .filter((stake) => stake.ownerType === 'player')
    .reduce((sum, stake) => sum + (stake.percent ?? 0), 0)));
}

export function getFamilyOwnershipPct(biz: OwnedBusiness): number {
  const ownership = biz.ownership ?? [];
  if (ownership.length === 0) return 100;
  return Math.max(0, Math.min(100, ownership
    .filter((stake) => ['player', 'child', 'family_trust'].includes(stake.ownerType))
    .reduce((sum, stake) => sum + (stake.percent ?? 0), 0)));
}

export interface HoldingSynergyProfile {
  revenueBonus: number;
  expenseReduction: number;
  crisisReduction: number;
  serviceRevenueBonus: number;
  serviceExpenseReduction: number;
  serviceCrisisReduction: number;
  sameIndustrySiblings: number;
  relatedIndustrySiblings: number;
  uniqueIndustries: number;
}

const HOLDING_INDUSTRY_CLUSTERS: Record<string, string> = {
  Retail: 'consumer',
  'Food & Beverage': 'consumer',
  Hospitality: 'consumer',
  Entertainment: 'consumer',
  Fitness: 'consumer',
  Beauty: 'consumer',
  Technology: 'services',
  Services: 'services',
  'Real Estate': 'services',
  Real_Estate: 'services',
  Automotive: 'industrial',
  Construction: 'industrial',
  Manufacturing: 'industrial',
  Healthcare: 'health',
};

export function getHoldingSynergyProfile(
  biz: OwnedBusiness,
  businesses: OwnedBusiness[],
  holdingCompanies: HoldingCompany[] = [],
): HoldingSynergyProfile {
  const zero = {
    revenueBonus: 0,
    expenseReduction: 0,
    crisisReduction: 0,
    serviceRevenueBonus: 0,
    serviceExpenseReduction: 0,
    serviceCrisisReduction: 0,
    sameIndustrySiblings: 0,
    relatedIndustrySiblings: 0,
    uniqueIndustries: 0,
  };
  if (!biz.holdingCompanyId) return zero;

  const group = (businesses ?? []).filter((item) => item.holdingCompanyId === biz.holdingCompanyId);
  const holding = holdingCompanies.find((item) => item.id === biz.holdingCompanyId);
  const serviceEffects = getHoldingSharedServiceEffects(holding);
  const type = getBusinessType(biz.typeId);
  const industry = type?.industry ?? '';
  const cluster = HOLDING_INDUSTRY_CLUSTERS[industry] ?? industry;
  const siblings = group.filter((item) => item.id !== biz.id);
  const sameIndustrySiblings = siblings.filter((item) => (getBusinessType(item.typeId)?.industry ?? '') === industry).length;
  const relatedIndustrySiblings = siblings.filter((item) => {
    const siblingIndustry = getBusinessType(item.typeId)?.industry ?? '';
    return siblingIndustry !== industry && (HOLDING_INDUSTRY_CLUSTERS[siblingIndustry] ?? siblingIndustry) === cluster;
  }).length;
  const uniqueIndustries = new Set(group.map((item) => getBusinessType(item.typeId)?.industry ?? item.typeId)).size;
  const executivePerformance = Math.max(0, Math.min(100, holding?.executivePerformance ?? 50));
  const executiveMultiplier = 0.90 + executivePerformance / 500;

  let integrationSynergyFactor = 1;
  if (biz.acquisition) {
    if (biz.acquisition.integrationStrategy === 'pending') integrationSynergyFactor = 0.25;
    else if (biz.acquisition.integrationStrategy === 'independent') integrationSynergyFactor = 0.50;
    else if (biz.acquisition.integrationOutcome === 'pending') integrationSynergyFactor = 0.60;
    else if (biz.acquisition.integrationStrategy === 'turnaround' && biz.acquisition.integrationOutcome === 'success') integrationSynergyFactor = 1.10;
  }

  const organicExpense = group.length >= 2
    ? Math.min(0.05, sameIndustrySiblings * 0.02) * executiveMultiplier * integrationSynergyFactor
    : 0;
  const organicRevenue = group.length >= 2
    ? Math.min(0.04, sameIndustrySiblings * 0.005 + relatedIndustrySiblings * 0.0125) * executiveMultiplier * integrationSynergyFactor
    : 0;
  const organicCrisis = group.length >= 2 && uniqueIndustries >= 3
    ? Math.min(0.15, (uniqueIndustries - 2) * 0.05) * executiveMultiplier
    : 0;

  return {
    revenueBonus: Math.max(0, Math.min(0.07, organicRevenue + serviceEffects.revenueBonus)),
    expenseReduction: Math.max(0, Math.min(0.08, organicExpense + serviceEffects.expenseReduction)),
    crisisReduction: Math.max(0, Math.min(0.20, organicCrisis + serviceEffects.crisisReduction)),
    serviceRevenueBonus: serviceEffects.revenueBonus,
    serviceExpenseReduction: serviceEffects.expenseReduction,
    serviceCrisisReduction: serviceEffects.crisisReduction,
    sameIndustrySiblings,
    relatedIndustrySiblings,
    uniqueIndustries,
  };
}

function strategicFocusModifiers(focus: BusinessStrategicFocus | undefined): {
  revenue: number;
  expense: number;
  reputation: number;
  morale: number;
} {
  switch (focus ?? 'balanced') {
    case 'growth': return { revenue: 1.08, expense: 1.06, reputation: 0.04, morale: -0.05 };
    case 'margin': return { revenue: 0.97, expense: 0.91, reputation: -0.02, morale: -0.10 };
    case 'premium': return { revenue: 1.04, expense: 1.02, reputation: 0.10, morale: 0 };
    case 'automation': return { revenue: 1.02, expense: 0.95, reputation: 0, morale: -0.12 };
    case 'rd': return { revenue: 0.98, expense: 1.07, reputation: 0.08, morale: 0.04 };
    default: return { revenue: 1, expense: 1, reputation: 0, morale: 0 };
  }
}

function getStrategyModifierTotals(biz: OwnedBusiness): {
  revenue: number;
  expense: number;
  reputation: number;
  morale: number;
} {
  const focus = strategicFocusModifiers(biz.strategicFocus);
  let revenue = focus.revenue;
  let expense = focus.expense;
  let reputation = focus.reputation;
  let morale = focus.morale;

  for (const modifier of biz.strategyModifiers ?? []) {
    revenue *= modifier.revenueMultiplier ?? 1;
    expense *= modifier.expenseMultiplier ?? 1;
    reputation += modifier.reputationPerWeek ?? 0;
    morale += modifier.moralePerWeek ?? 0;
  }
  for (const familyRole of biz.familyRoles ?? []) {
    const normalized = Math.max(-20, Math.min(20, (familyRole.performance ?? 50) - 50));
    if (familyRole.role === 'manager') {
      expense *= 1 - normalized * 0.0008;
    } else if (familyRole.role === 'executive') {
      revenue *= 1 + normalized * 0.0012;
      expense *= 1 - normalized * 0.0005;
    } else if (familyRole.role === 'board') {
      reputation += normalized * 0.004;
    } else if (familyRole.role === 'successor') {
      revenue *= 1 + normalized * 0.0008;
      reputation += normalized * 0.003;
    }
  }
  return { revenue, expense, reputation, morale };
}

function makeStrategicDecision(biz: OwnedBusiness, globalWeek: number): BusinessPendingDecision {
  const options: BusinessPendingDecision[] = [
    {
      id: `strategy_product_${biz.id}_${globalWeek}`,
      kind: 'strategy',
      title: 'Product Positioning Review',
      description: `${biz.name} has room to reposition its offer. The decision will shape several weeks of performance.`,
      icon: '🎯',
      createdGlobalWeek: globalWeek,
      deadlineGlobalWeek: globalWeek + 5,
      defaultChoiceId: 'hold_course',
      choices: [
        { id: 'budget_push', text: 'Push Lower Prices', description: 'Chase volume at thinner margins.', revenueMultiplier: 1.10, expenseMultiplier: 1.05, reputationDelta: -1, marketShareDelta: 2, durationWeeks: 8 },
        { id: 'move_upscale', text: 'Move Upscale', description: 'Accept lower volume for brand and margin.', revenueMultiplier: 1.04, expenseMultiplier: 0.98, reputationDelta: 3, marketShareDelta: -1, durationWeeks: 10 },
        { id: 'hold_course', text: 'Stay Balanced', description: 'Avoid disruption and preserve flexibility.', durationWeeks: 1 },
      ],
    },
    {
      id: `strategy_people_${biz.id}_${globalWeek}`,
      kind: 'strategy',
      title: 'Workforce Strategy',
      description: `${biz.name} needs a clear people strategy for the next phase.`,
      icon: '👥',
      createdGlobalWeek: globalWeek,
      deadlineGlobalWeek: globalWeek + 5,
      defaultChoiceId: 'no_change',
      choices: [
        { id: 'raise_wages', text: 'Increase Wages', description: 'Higher costs, better morale and retention.', businessCashCost: 3000, expenseMultiplier: 1.04, moraleDelta: 7, reputationDelta: 1, durationWeeks: 10 },
        { id: 'automate', text: 'Accelerate Automation', description: 'Lower costs but tougher on morale.', businessCashCost: 7000, revenueMultiplier: 1.03, expenseMultiplier: 0.91, moraleDelta: -6, durationWeeks: 12 },
        { id: 'no_change', text: 'No Major Change', description: 'Keep the current operating model.', durationWeeks: 1 },
      ],
    },
    {
      id: `strategy_invest_${biz.id}_${globalWeek}`,
      kind: 'strategy',
      title: 'Investment Priority',
      description: `Management wants a clear capital priority for ${biz.name}.`,
      icon: '🧭',
      createdGlobalWeek: globalWeek,
      deadlineGlobalWeek: globalWeek + 5,
      defaultChoiceId: 'cash_reserve',
      choices: [
        { id: 'rd', text: 'Invest in R&D', description: 'Expensive now; stronger demand and reputation if sustained.', businessCashCost: 10000, revenueMultiplier: 1.08, expenseMultiplier: 1.04, reputationDelta: 3, durationWeeks: 12 },
        { id: 'cost_program', text: 'Cut Operating Waste', description: 'Improve efficiency, with a small morale cost.', businessCashCost: 4000, expenseMultiplier: 0.90, moraleDelta: -3, durationWeeks: 10 },
        { id: 'cash_reserve', text: 'Protect Cash', description: 'No temporary modifier; retain liquidity.', durationWeeks: 1 },
      ],
    },
  ];
  return options[Math.floor(Math.random() * options.length)];
}

export function makeBusinessCrisis(biz: OwnedBusiness, globalWeek: number): BusinessPendingDecision {
  const absoluteCost = (pct: number, minimum: number, maximum: number) =>
    Math.round(Math.max(minimum, Math.min(maximum, Math.max(0, biz.valuation ?? 0) * pct)));

  const equipmentReplacement = absoluteCost(0.015, 5_000, 500_000);
  const equipmentRepair = absoluteCost(0.006, 3_000, 200_000);
  const propertyRestore = absoluteCost(0.020, 10_000, 750_000);
  const propertyPatch = absoluteCost(0.008, 5_000, 300_000);
  const cyberResponse = absoluteCost(0.012, 7_500, 500_000);
  const cyberOverhaul = absoluteCost(0.020, 12_000, 850_000);
  const liabilitySettle = absoluteCost(0.015, 7_500, 750_000);
  const liabilityDefense = absoluteCost(0.007, 5_000, 300_000);

  const propertyTier = getBusinessInsuranceTier(biz, 'property');
  const equipmentTier = getBusinessInsuranceTier(biz, 'equipment');
  const cyberTier = getBusinessInsuranceTier(biz, 'cyber');
  const liabilityTier = getBusinessInsuranceTier(biz, 'liability');

  const generic: BusinessPendingDecision[] = [
    {
      id: `crisis_supplier_${biz.id}_${globalWeek}`,
      kind: 'crisis',
      title: 'Supplier Cost Shock',
      description: `A key supplier to ${biz.name} has raised prices sharply.`,
      icon: '⚠️',
      createdGlobalWeek: globalWeek,
      deadlineGlobalWeek: globalWeek + 3,
      defaultChoiceId: 'absorb',
      choices: [
        { id: 'absorb', text: 'Absorb the Cost', description: 'Protect customers, accept higher costs.', expenseMultiplier: 1.14, reputationDelta: 2, durationWeeks: 8 },
        { id: 'raise_prices', text: 'Pass It On', description: 'Protect margins but risk demand and reputation.', revenueMultiplier: 0.94, expenseMultiplier: 1.03, reputationDelta: -2, durationWeeks: 7 },
        { id: 'switch_supplier', text: 'Switch Supplier', description: 'Pay to transition and reduce long-term impact.', businessCashCost: 9000, expenseMultiplier: 1.03, reputationDelta: 1, durationWeeks: 4 },
      ],
    },
    {
      id: `crisis_competitor_${biz.id}_${globalWeek}`,
      kind: 'crisis',
      title: 'Competitor Price War',
      description: `A rival is aggressively undercutting ${biz.name}.`,
      icon: '📉',
      createdGlobalWeek: globalWeek,
      deadlineGlobalWeek: globalWeek + 3,
      defaultChoiceId: 'hold',
      choices: [
        { id: 'match', text: 'Match Prices', description: 'Defend share at lower profitability.', revenueMultiplier: 1.02, expenseMultiplier: 1.08, marketShareDelta: 2, durationWeeks: 8 },
        { id: 'differentiate', text: 'Differentiate on Quality', description: 'Spend on quality and protect brand.', businessCashCost: 7500, revenueMultiplier: 1.01, reputationDelta: 4, marketShareDelta: 1, durationWeeks: 10 },
        { id: 'hold', text: 'Hold Pricing', description: 'Accept short-term market-share pressure.', revenueMultiplier: 0.90, marketShareDelta: -3, durationWeeks: 6 },
      ],
    },
    {
      id: `crisis_client_${biz.id}_${globalWeek}`,
      kind: 'crisis',
      title: 'Major Customer Lost',
      description: `${biz.name} has lost a significant customer or account.`,
      icon: '💼',
      createdGlobalWeek: globalWeek,
      deadlineGlobalWeek: globalWeek + 3,
      defaultChoiceId: 'ride_out',
      choices: [
        { id: 'sales_push', text: 'Launch Sales Push', description: 'Spend aggressively to replace the revenue.', businessCashCost: 8000, revenueMultiplier: 0.98, expenseMultiplier: 1.04, marketShareDelta: 2, durationWeeks: 7 },
        { id: 'cut_costs', text: 'Cut Costs Quickly', description: 'Protect cash but damage morale.', expenseMultiplier: 0.88, moraleDelta: -8, reputationDelta: -1, durationWeeks: 8 },
        { id: 'ride_out', text: 'Ride It Out', description: 'Preserve cash, accept a deeper temporary revenue hit.', revenueMultiplier: 0.82, durationWeeks: 6 },
      ],
    },
    {
      id: `crisis_location_${biz.id}_${globalWeek}`,
      kind: 'crisis',
      title: 'Underperforming Operation',
      description: `Part of ${biz.name}'s operation is materially underperforming.`,
      icon: '🏚️',
      createdGlobalWeek: globalWeek,
      deadlineGlobalWeek: globalWeek + 3,
      defaultChoiceId: 'accept',
      choices: [
        { id: 'turnaround', text: 'Fund a Turnaround', description: 'Invest to recover performance.', businessCashCost: 12000, revenueMultiplier: 1.05, expenseMultiplier: 1.03, reputationDelta: 2, durationWeeks: 10 },
        { id: 'restructure', text: 'Restructure', description: 'Lower costs, with a morale and reputation cost.', expenseMultiplier: 0.86, moraleDelta: -7, reputationDelta: -2, durationWeeks: 10 },
        { id: 'accept', text: 'Accept Weak Performance', description: 'Avoid spending, take the revenue hit.', revenueMultiplier: 0.86, durationWeeks: 8 },
      ],
    },
  ];

  const operational: BusinessPendingDecision[] = [
    {
      id: `crisis_equipment_${biz.id}_${globalWeek}`,
      kind: 'crisis',
      title: 'Major Equipment Failure',
      description: `Critical equipment at ${biz.name} has failed, disrupting normal operations.`,
      icon: '🛠️',
      insuranceArea: 'equipment',
      insuranceTierAtCreation: equipmentTier,
      createdGlobalWeek: globalWeek,
      deadlineGlobalWeek: globalWeek + 3,
      defaultChoiceId: 'limp_along',
      choices: [
        { id: 'replace', text: 'Replace Immediately', description: 'Restore dependable capacity quickly.', businessCashCost: equipmentReplacement, cashCostScale: 'absolute', revenueMultiplier: 0.99, reputationDelta: 1, durationWeeks: 3 },
        { id: 'repair', text: 'Emergency Repair', description: 'Cheaper fix with some continuing disruption.', businessCashCost: equipmentRepair, cashCostScale: 'absolute', revenueMultiplier: 0.94, expenseMultiplier: 1.03, durationWeeks: 5 },
        { id: 'limp_along', text: 'Keep Operating', description: 'Avoid the immediate bill and accept severe disruption.', revenueMultiplier: 0.82, expenseMultiplier: 1.08, reputationDelta: -2, durationWeeks: 6 },
      ],
    },
    {
      id: `crisis_property_${biz.id}_${globalWeek}`,
      kind: 'crisis',
      title: 'Premises Damage',
      description: `Part of ${biz.name}'s premises has suffered serious damage and requires remediation.`,
      icon: '🏚️',
      insuranceArea: 'property',
      insuranceTierAtCreation: propertyTier,
      createdGlobalWeek: globalWeek,
      deadlineGlobalWeek: globalWeek + 3,
      defaultChoiceId: 'restrict_area',
      choices: [
        { id: 'full_restore', text: 'Restore Properly', description: 'Repair the premises quickly and protect long-term standards.', businessCashCost: propertyRestore, cashCostScale: 'absolute', revenueMultiplier: 0.99, reputationDelta: 1, durationWeeks: 4 },
        { id: 'temporary_patch', text: 'Temporary Repairs', description: 'Spend less now, but operate around continuing limitations.', businessCashCost: propertyPatch, cashCostScale: 'absolute', revenueMultiplier: 0.93, expenseMultiplier: 1.03, durationWeeks: 6 },
        { id: 'restrict_area', text: 'Restrict Operations', description: 'Delay repairs and accept reduced capacity and customer experience.', revenueMultiplier: 0.84, reputationDelta: -3, durationWeeks: 6 },
      ],
    },
    {
      id: `crisis_cyber_${biz.id}_${globalWeek}`,
      kind: 'crisis',
      title: 'Payment / Systems Breach',
      description: `${biz.name} has suffered a digital-security or payment-system incident.`,
      icon: '🔐',
      insuranceArea: 'cyber',
      insuranceTierAtCreation: cyberTier,
      createdGlobalWeek: globalWeek,
      deadlineGlobalWeek: globalWeek + 3,
      defaultChoiceId: 'internal_fix',
      choices: [
        { id: 'specialist_response', text: 'Hire Incident Specialists', description: 'Contain the breach and restore systems professionally.', businessCashCost: cyberResponse, cashCostScale: 'absolute', revenueMultiplier: 0.98, reputationDelta: 1, durationWeeks: 4 },
        { id: 'security_overhaul', text: 'Full Security Overhaul', description: 'Spend more now to restore trust and reduce immediate disruption.', businessCashCost: cyberOverhaul, cashCostScale: 'absolute', revenueMultiplier: 0.99, expenseMultiplier: 1.01, reputationDelta: 2, durationWeeks: 5 },
        { id: 'internal_fix', text: 'Handle Internally', description: 'Preserve cash but accept a longer outage and confidence hit.', revenueMultiplier: 0.84, reputationDelta: -4, durationWeeks: 6 },
      ],
    },
    {
      id: `crisis_liability_${biz.id}_${globalWeek}`,
      kind: 'crisis',
      title: 'Customer Liability Claim',
      description: `A customer, client or third party has brought a material claim against ${biz.name}.`,
      icon: '⚖️',
      insuranceArea: 'liability',
      insuranceTierAtCreation: liabilityTier,
      createdGlobalWeek: globalWeek,
      deadlineGlobalWeek: globalWeek + 3,
      defaultChoiceId: 'deny_claim',
      choices: [
        { id: 'settle', text: 'Settle Responsibly', description: 'Resolve the claim and protect long-term reputation.', businessCashCost: liabilitySettle, cashCostScale: 'absolute', reputationDelta: 1, durationWeeks: 3 },
        { id: 'legal_defense', text: 'Defend the Claim', description: 'Spend on legal defense with some continuing uncertainty.', businessCashCost: liabilityDefense, cashCostScale: 'absolute', revenueMultiplier: 0.97, expenseMultiplier: 1.02, durationWeeks: 5 },
        { id: 'deny_claim', text: 'Deny and Delay', description: 'Avoid an immediate payment but accept brand and operating pressure.', revenueMultiplier: 0.92, expenseMultiplier: 1.04, reputationDelta: -4, durationWeeks: 7 },
      ],
    },
  ];

  const urgency = getBusinessReinvestmentUrgency(biz);
  const weighted = [...generic, ...operational];
  const preferredTitle = urgency === 'technology'
    ? 'Payment / Systems Breach'
    : urgency === 'premises'
      ? 'Premises Damage'
      : urgency === 'equipment'
        ? 'Major Equipment Failure'
        : null;
  if (preferredTitle) {
    const preferred = operational.find((candidate) => candidate.title === preferredTitle);
    if (preferred) weighted.push(preferred, preferred);
  }

  return weighted[Math.floor(Math.random() * weighted.length)];
}

export const MIN_EMPLOYEES_REQUIRED = 3;
export const BUSINESS_LEVEL_REPUTATION_REQUIREMENTS = [0, 20, 30, 40, 52, 65, 78, 90];

export function getBusinessDecisionChoiceCost(
  choice: Pick<BusinessPendingDecisionChoice, 'businessCashCost' | 'cashCostScale'>,
  inflationMultiplier = 1,
): number {
  const base = Math.max(0, choice.businessCashCost ?? 0);
  return Math.round(choice.cashCostScale === 'absolute' ? base : base * Math.max(0.5, inflationMultiplier || 1));
}

/** Player-facing strategic identity for each business type. */
export const BUSINESS_STRATEGIES: Record<string, { advantage: string; weakness: string }> = {
  coffee_shop: { advantage: 'Strong repeat customers and seasonal demand', weakness: 'Reputation drops quickly after service issues' },
  food_truck: { advantage: 'Very low premises overhead', weakness: 'Limited capacity and high demand volatility' },
  restaurant: { advantage: 'High revenue ceiling with a full team', weakness: 'Large staffing and premises costs' },
  clothing_store: { advantage: 'Premium pricing works well with reputation', weakness: 'Fashion cycles can sharply reduce demand' },
  tech_startup: { advantage: 'Upgrades and skilled employees scale revenue strongly', weakness: 'Early products are vulnerable to weak demand' },
  fitness_gym: { advantage: 'Stable recurring membership income', weakness: 'Heavy rent and maintenance overhead' },
  construction_co: { advantage: 'Largest contract revenue potential', weakness: 'Long projects create uneven cash flow' },
  digital_agency: { advantage: 'Flexible low-overhead operation', weakness: 'Client competition suppresses market share' },
  pharmacy: { advantage: 'Defensive demand in weak markets', weakness: 'High compliance and operating costs' },
  auto_repair: { advantage: 'Reliable local service demand', weakness: 'Equipment failures are expensive' },
  real_estate_agency: { advantage: 'Reputation compounds through successful deals', weakness: 'Revenue is sensitive to market cycles' },
  bakery: { advantage: 'Low-cost start with loyal local demand', weakness: 'Thin margins without efficient production' },
};

export function getBusinessHealthScore(biz: OwnedBusiness): number {
  const cashFlow = Math.max(0, Math.min(100, 50 + ((biz.lastWeekProfit ?? 0) / Math.max(1, Math.abs(biz.lastWeekExpenses ?? 1))) * 50));
  const morale = (biz.employees?.length ?? 0) > 0
    ? (biz.employees ?? []).reduce((sum, employee) => sum + (employee.morale ?? 50), 0) / biz.employees.length
    : 0;
  const marketShare = Math.max(0, Math.min(100, 10 + (biz.marketShareModifier ?? 0)));
  return Math.round(cashFlow * 0.35 + (biz.reputation ?? 0) * 0.30 + morale * 0.20 + marketShare * 0.15);
}
export const VALUATION_TARGET_SCALE = 0.4;

export function scaleValuationTargets(thresholds: number[]): number[] {
  return thresholds.map((threshold) => Math.round(threshold * VALUATION_TARGET_SCALE));
}

export function getBusinessLevelForMetrics(thresholds: number[], valuation: number, reputation: number): number {
  for (let level = thresholds.length - 1; level >= 0; level--) {
    if (valuation >= thresholds[level] && reputation >= (BUSINESS_LEVEL_REPUTATION_REQUIREMENTS[level] ?? 100)) return level;
  }
  return 0;
}

export function getStartupRevenueTarget(baseExpenses: number, rent: number, salaries: number, advertising: number, randomRoll: number): number {
  // Young companies should alternate between modest wins and losses instead of
  // entering an unavoidable downward spiral before reputation can grow.
  return Math.round((baseExpenses + rent + salaries + advertising) * (0.94 + Math.max(0, Math.min(1, randomRoll)) * 0.28));
}

// --- Constants ---
const PRICING_MULTIPLIERS: Record<string, { revenue: number; demand: number; reputation: number }> = {
  budget: { revenue: 0.8, demand: 1.2, reputation: -0.02 },
  standard: { revenue: 1.0, demand: 1.0, reputation: 0 },
  premium: { revenue: 1.3, demand: 0.85, reputation: 0.01 },
  luxury: { revenue: 1.6, demand: 0.65, reputation: 0.02 },
};

const ADVERTISING_COSTS: Record<string, { weeklyCost: number; demandBoost: number; reputationBoost: number }> = {
  none: { weeklyCost: 0, demandBoost: 0, reputationBoost: 0 },
  basic: { weeklyCost: 200, demandBoost: 0.10, reputationBoost: 0.24 },
  moderate: { weeklyCost: 500, demandBoost: 0.22, reputationBoost: 0.45 },
  aggressive: { weeklyCost: 1200, demandBoost: 0.36, reputationBoost: 0.70 },
};

const BUSINESS_BALANCE_TUNING: Record<string, {
  highRepRevenueBonus: number;
  highRepExpenseRelief: number;
  highRepVariableRelief: number;
}> = {
  coffee_shop: { highRepRevenueBonus: 0.15, highRepExpenseRelief: 0.14, highRepVariableRelief: 0.08 },
  food_truck: { highRepRevenueBonus: 0.22, highRepExpenseRelief: 0.16, highRepVariableRelief: 0.09 },
  clothing_store: { highRepRevenueBonus: 0.07, highRepExpenseRelief: 0.08, highRepVariableRelief: 0.04 },
  tech_startup: { highRepRevenueBonus: 0.08, highRepExpenseRelief: 0.06, highRepVariableRelief: 0.03 },
  digital_agency: { highRepRevenueBonus: 0.30, highRepExpenseRelief: 0.22, highRepVariableRelief: 0.10 },
  auto_repair: { highRepRevenueBonus: 0.20, highRepExpenseRelief: 0.16, highRepVariableRelief: 0.08 },
  real_estate_agency: { highRepRevenueBonus: 0.15, highRepExpenseRelief: 0.12, highRepVariableRelief: 0.07 },
  bakery: { highRepRevenueBonus: 0.10, highRepExpenseRelief: 0.09, highRepVariableRelief: 0.05 },
  fitness_gym: { highRepRevenueBonus: 0.04, highRepExpenseRelief: 0.03, highRepVariableRelief: 0.02 },
};

const LEVEL_NAMES = [
  'Startup', 'Small Business', 'Growing Company', 'Regional',
  'National', 'International', 'Corporation', 'Global Enterprise',
];

const EMPLOYEE_NAMES = [
  'Alex', 'Jordan', 'Sam', 'Casey', 'Morgan', 'Taylor', 'Riley',
  'Quinn', 'Avery', 'Drew', 'Jamie', 'Skyler', 'Reese', 'Parker',
  'Dana', 'Robin', 'Emery', 'Kai', 'Sage', 'Blair', 'Chris', 'Pat',
  'Erin', 'Lee', 'Noel', 'Rowan', 'Cameron', 'Devon', 'Fran', 'Harper',
  'Elroy', 'Cathly', 'Monique', 'Marcel', 'Reemer', 'Lux', 'Fria', 'Theo',
  'Lee', 'Darius', 'Kata', 'Lisa', 'John', 'Jisoo', 'Mufasa', 'Elsa',
];

export function getLevelName(level: number): string {
  return LEVEL_NAMES[Math.min(level, LEVEL_NAMES.length - 1)] ?? 'Startup';
}

export function getBusinessType(typeId: string) {
  return (businessTypesData ?? []).find((t) => t?.id === typeId);
}

export function getUpgrade(upgradeId: string) {
  const upgrade = (businessUpgradesData ?? []).find((u) => u?.id === upgradeId);
  return upgrade ? { ...upgrade, revenueBoost: 0.02, reputationBoost: upgrade.reputationBoost * 0.75 } : undefined;
}

export function getBusinessUpgradeWeeks(randomRoll = Math.random()): number {
  return Math.max(1, Math.round((16 + Math.floor(Math.max(0, Math.min(0.999999, randomRoll)) * 15)) * 0.75));
}

function getBusinessBalanceTuning(typeId: string, reputation: number) {
  const tuning = BUSINESS_BALANCE_TUNING[typeId];
  const highRepWeight = Math.max(0, Math.min(1, (reputation - 25) / 75));
  if (!tuning) {
    return { revenueMultiplier: 1, expenseMultiplier: 1, variableExpenseMultiplier: 1 };
  }
  return {
    revenueMultiplier: 1 + tuning.highRepRevenueBonus * highRepWeight,
    expenseMultiplier: 1 - tuning.highRepExpenseRelief * highRepWeight,
    variableExpenseMultiplier: 1 - tuning.highRepVariableRelief * highRepWeight,
  };
}

/** Lean premises and overhead gradually expand with customer reputation. Wages are contractual. */
export function getBusinessOperatingScale(reputation: number, maxEmployees = 999) {
  const maturity = Math.max(0, Math.min(1, reputation / 70));
  const compactRelief = maxEmployees <= 5 ? 0.10 : maxEmployees <= 8 ? 0.06 : 0;
  const overhead = 0.25 + (0.75 - compactRelief) * maturity;
  const premises = 0.65 + (0.35 - compactRelief * 0.45) * maturity;
  return { overhead, premises };
}

export function getEmployeeRole(roleId: string) {
  return (employeeRolesData ?? []).find((r) => r?.id === roleId);
}

export function getMoraleAction(actionId: string) {
  return (moraleActionsData ?? []).find((a: any) => a?.id === actionId);
}

export function getTrainingOption(trainingId: string) {
  return (trainingData ?? []).find((t: any) => t?.id === trainingId);
}

export function getProject(projectId: string) {
  return (projectsData ?? []).find((p: any) => p?.id === projectId);
}

export function getBusinessLocationTemplate(templateId: string) {
  return (businessLocationsData as any[]).find((location) => location.id === templateId) ?? null;
}

export function getAllBusinessLocationTemplates() { return businessLocationsData as any[]; }

export function getScaledLocationCosts(biz: OwnedBusiness, templateId: string, inflationMultiplier: number): { purchaseCost: number; weeklyOperatingCost: number } | null {
  const template = getBusinessLocationTemplate(templateId);
  const type = getBusinessType(biz.typeId);
  if (!template || !type) return null;
  const scale = Math.max(0.7, Math.pow((type.startupCost ?? 75_000) / 75_000, 0.45));
  return {
    purchaseCost: Math.round(template.cost * scale * inflationMultiplier),
    weeklyOperatingCost: Math.round(template.weeklyOperatingCost * scale),
  };
}

export function canStartBusinessExpansion(biz: OwnedBusiness, templateId: string): boolean {
  const template = getBusinessLocationTemplate(templateId);
  if (!template || biz.activeExpansion) return false;
  if ((biz.locations ?? []).some((location) => location.templateId === templateId)) return false;
  return (biz.level ?? 0) >= template.requiredLevel && (biz.reputation ?? 0) >= template.requiredReputation;
}

export function getAllMoraleActions() { return moraleActionsData as any[]; }
export function getAllTraining() { return trainingData as any[]; }
export function getAllProjects() { return projectsData as any[]; }

/** Business meets minimum staffing? */
export function meetsMinStaffing(biz: OwnedBusiness): boolean {
  if (biz.corporateWorkforce) {
    const departmentHeadcount = Object.values(biz.corporateWorkforce.departments ?? {})
      .reduce((sum, department: any) => sum + Math.max(0, department?.headcount ?? 0), 0);
    if (departmentHeadcount > 0) return true;
  }
  return (biz.employees?.length ?? 0) >= MIN_EMPLOYEES_REQUIRED;
}

/** Calculate automation score (0-100). */
export function getAutomationScore(biz: OwnedBusiness): number {
  const type = getBusinessType(biz.typeId);
  if (!type) return 0;
  const maxEmp = type.maxEmployees ?? 1;
  const empRatio = Math.min((biz.employees?.length ?? 0) / maxEmp, 1);
  const hasManager = (biz.employees ?? []).some((e) => e.roleId === 'manager' || e.roleId === 'supervisor');
  const upgradeRatio = Math.min(new Set(biz.purchasedUpgrades ?? []).size / (type.upgrades?.length ?? 1), 1);
  const delegationBonus = (biz.delegationPolicy ?? 'manual') !== 'manual' && !!biz.delegatedManagerEmployeeId ? 10 : 0;
  let score = empRatio * 40 + upgradeRatio * 30 + (hasManager ? 20 : 0) + (biz.level >= 3 ? 10 : 0) + delegationBonus;
  return Math.min(100, Math.round(score));
}

export interface BusinessValuationBreakdown {
  cashValue: number;
  corporateAssetValue: number;
  blendedWeeklyProfit: number;
  annualizedProfit: number;
  profitMultiple: number;
  maintenanceDiscount: number;
  distressDiscount: number;
  operatingValue: number;
  tangibleFloor: number;
  valuation: number;
}

export function getBusinessValuationBreakdown(biz: OwnedBusiness): BusinessValuationBreakdown {
  const reputation = Math.max(0, Math.min(100, biz.reputation ?? 0));
  const history = (biz.weeklyProfitHistory ?? [])
    .filter((profit) => Number.isFinite(profit))
    .slice(-20);
  const trailingAverage = history.length > 0
    ? history.reduce((sum, profit) => sum + profit, 0) / history.length
    : 0;
  const recent = history.slice(-6);
  const recentAverage = recent.length > 0
    ? recent.reduce((sum, profit) => sum + profit, 0) / recent.length
    : trailingAverage;

  // Stable run-rate valuation: recent performance matters, but one strong week
  // cannot multiply the company value. New businesses receive only partial
  // confidence until enough operating history exists.
  const blendedWeeklyProfit = trailingAverage * 0.65 + recentAverage * 0.35;
  const historyConfidence = history.length === 0
    ? 0
    : Math.min(1, 0.45 + (history.length / 20) * 0.55);
  const annualizedProfit = blendedWeeklyProfit * 20 * historyConfidence;

  // Lower than the old 2x–5x 20-week-profit multiple. Reputation still matters,
  // while the reduction stays moderate enough that mature acquisitions do not
  // reprice violently on their first player-owned week.
  const profitMultiple = 1.65 + (reputation / 100) * 2.75;

  // Company cash is worth company cash. The old 1.5x equity-cash premium caused
  // retained earnings to create valuation faster than the underlying business.
  const cashValue = Math.max(0, biz.balance ?? 0);
  const corporateAssetBookValue = Math.max(0, getCorporateCapexBookValue(biz));
  const reinvestment = getBusinessReinvestmentEffects(biz);
  const maintenanceDiscount = Math.max(
    0,
    Math.min(
      0.18,
      reinvestment.revenuePenalty * 0.70
        + reinvestment.expenseIncrease * 0.50
        + reinvestment.crisisIncrease * 0.25,
    ),
  );

  const positiveOperatingValue = annualizedProfit > 0
    ? annualizedProfit * profitMultiple * (1 - maintenanceDiscount)
    : 0;
  const lossMultiple = 0.75 + ((100 - reputation) / 100) * 0.50 + maintenanceDiscount;
  const lossPenalty = annualizedProfit < 0 ? Math.abs(annualizedProfit) * lossMultiple : 0;

  let lossStreak = 0;
  for (let index = history.length - 1; index >= 0; index -= 1) {
    if (history[index] >= 0) break;
    lossStreak += 1;
  }
  const distressDiscount = Math.min(0.18, Math.max(0, lossStreak - 1) * 0.025);
  const corporateAssetValue = corporateAssetBookValue
    * (1 - maintenanceDiscount * 0.50)
    * (1 - distressDiscount);

  const operatingValue = positiveOperatingValue * (1 - distressDiscount) - lossPenalty;
  const rawValuation = cashValue
    + corporateAssetValue
    + operatingValue;

  // A distressed company can fall sharply, but cash and a conservative
  // liquidation value for completed corporate assets prevent impossible values.
  const tangibleFloor = cashValue + corporateAssetBookValue * 0.55;
  const valuation = Math.max(0, tangibleFloor, rawValuation);

  return {
    cashValue: Math.round(cashValue),
    corporateAssetValue: Math.round(corporateAssetValue),
    blendedWeeklyProfit,
    annualizedProfit,
    profitMultiple,
    maintenanceDiscount,
    distressDiscount,
    operatingValue,
    tangibleFloor: Math.round(tangibleFloor),
    valuation: Math.round(valuation),
  };
}

export function calculateValuation(biz: OwnedBusiness): number {
  return getBusinessValuationBreakdown(biz).valuation;
}

export function getBusinessMarketStrength(biz: OwnedBusiness): number {
  return Math.max(1, (biz.reputation ?? 25) + (biz.valuation ?? 0) / 5000 + (biz.employees?.length ?? 0) * 3);
}

export function getDemandLabel(demand: number): string {
  if (demand >= 1.3) return 'Very High';
  if (demand >= 1.1) return 'High';
  if (demand >= 0.9) return 'Normal';
  if (demand >= 0.7) return 'Low';
  return 'Very Low';
}

function randomEmployeeName(existing: string[]): string {
  const usedNames = new Set(existing);
  const available = EMPLOYEE_NAMES.filter((n) => !usedNames.has(n));
  return available.length > 0
    ? available[Math.floor(Math.random() * available.length)]
    : `Employee ${existing.length + 1}`;
}

/** Generate 3 recruitment candidates (young/balanced/veteran archetypes) */
export function generateCandidates(roleId: string, existingNames: string[], inflationMultiplier: number): EmployeeCandidate[] {
  const role = getEmployeeRole(roleId);
  const baseSalary = (role?.baseSalary ?? 280) * (inflationMultiplier ?? 1);
  const candidates: EmployeeCandidate[] = [];
  const archetypes: Array<'young' | 'balanced' | 'veteran'> = ['young', 'balanced', 'veteran'];
  const usedNames = [...existingNames];

  for (const archetype of archetypes) {
    const name = randomEmployeeName(usedNames);
    usedNames.push(name);
    let skill = 30, potential = 60, age = 25, experience = 0, salaryMod = 1.0;

    if (archetype === 'young') {
      skill = 25 + Math.floor(Math.random() * 15); // 25-40
      potential = 80 + Math.floor(Math.random() * 15); // 80-95 high potential
      age = 20 + Math.floor(Math.random() * 6); // 20-25
      experience = Math.floor(Math.random() * 10); // 0-10 weeks
      salaryMod = 0.75; // lower salary
    } else if (archetype === 'balanced') {
      skill = 45 + Math.floor(Math.random() * 20); // 45-65
      potential = 55 + Math.floor(Math.random() * 20); // 55-75
      age = 28 + Math.floor(Math.random() * 8); // 28-35
      experience = 30 + Math.floor(Math.random() * 60); // 30-90 weeks
      salaryMod = 1.0;
    } else {
      // veteran
      skill = 70 + Math.floor(Math.random() * 20); // 70-90
      potential = 30 + Math.floor(Math.random() * 20); // 30-50 lower ceiling
      age = 40 + Math.floor(Math.random() * 15); // 40-55
      experience = 150 + Math.floor(Math.random() * 200); // 150-350 weeks
      salaryMod = 1.5; // higher salary
    }

    const tier = rollTier();
    const tierCfg = TIER_CONFIG[tier];
    const buffs = rollBuffs(tier);
    candidates.push({
      id: `cand_${Date.now()}_${Math.random().toString(36).slice(2, 6)}_${archetype}`,
      roleId,
      name,
      skill: Math.min(100, skill + tierCfg.skillBonus),
      potential: Math.min(100, potential + tierCfg.potentialBonus),
      experience,
      age,
      weeklySalary: Math.round(baseSalary * salaryMod * tierCfg.salaryMult),
      archetype,
      tier,
      buffs,
    });
  }
  return candidates;
}

/** Convert a candidate into a full employee (on hire) */
export function candidateToEmployee(candidate: EmployeeCandidate): BusinessEmployee {
  return {
    id: `emp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    roleId: candidate.roleId,
    name: candidate.name,
    skill: candidate.skill,
    morale: 70 + Math.floor(Math.random() * 15),
    experience: candidate.experience,
    potential: candidate.potential,
    age: candidate.age,
    weeksEmployed: 0,
    weeklySalary: candidate.weeklySalary,
    inTrainingId: null,
    trainingWeeksRemaining: 0,
    tier: candidate.tier ?? 'common',
    buffs: candidate.buffs ?? [],
  };
}

/** Create a new business instance (no starting employees - player must hire 3) */
export function createBusiness(typeId: string, customName: string | null, week: number, year: number, inflationMultiplier: number): OwnedBusiness | null {
  const type = getBusinessType(typeId);
  if (!type) return null;
  const name = customName?.trim() || type.name;
  return {
    id: `biz_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    typeId,
    name,
    foundedWeek: week,
    foundedYear: year,
    balance: 0,
    totalRevenue: 0,
    totalExpenses: 0,
    lastWeekRevenue: 0,
    lastWeekExpenses: 0,
    lastWeekProfit: 0,
    reputation: 25,
    level: 0,
    valuation: type.startupCost ?? 10000,
    marketShareModifier: 0,
    pricingStrategy: 'standard',
    advertisingLevel: 'none',
    employees: [],
    purchasedUpgrades: [],
    locations: [],
    activeExpansion: null,
    activeCorporateCapex: null,
    completedCorporateCapex: [],
    reinvestment: createDefaultBusinessReinvestmentState(((year - 1) * 20) + week),
    activeReinvestment: null,
    insurancePolicies: { property: 'none', equipment: 'none', cyber: 'none', liability: 'none' },
    insuranceClaims: [],
    budgetPlan: createBusinessBudgetPlan('standard', year),
    budgetReserves: { reinvestment: 0, growth: 0 },
    lastBudgetAllocation: null,
    businessLoans: [],
    activeEvents: [],
    weeklyProfitHistory: [],
    corporateKpiHistory: [],
    pendingCandidates: null,
    pendingCandidateRoleId: null,
    activeProjects: [],
    lastExpenseBreakdown: null,
    weeklyRevenueHistory: [],
    annualProfit: 0,
    annualProfitYear: year,
    pendingRetention: null,
    freeRecruits: 3,
    recruitCharges: 0,
    recruitProgress: 0,
    timeline: [{ week, year, title: `${name} founded`, icon: '🎉', kind: 'founded' }],
    strategicFocus: 'balanced',
    strategyModifiers: [],
    pendingDecision: null,
    nextStrategicDecisionWeek: ((year - 1) * 20 + week) + 6 + Math.floor(Math.random() * 7),
    nextCrisisCheckWeek: ((year - 1) * 20 + week) + 10 + Math.floor(Math.random() * 11),
    ownership: [{
      ownerType: 'player',
      ownerId: 'player',
      ownerName: 'Player',
      percent: 100,
      votingPercent: 100,
    }],
    familyRoles: [],
    executives: [],
    pendingExecutiveSearch: null,
    executiveSearchCooldowns: {},
    boardGovernance: null,
    corporateWorkforce: null,
    capitalInvested: null,
    totalPlayerDistributions: 0,
    delegationPolicy: 'manual',
    delegatedManagerEmployeeId: null,
    delegatedManagerName: null,
    lastDelegationReviewWeek: 0,
    lastDelegationSummary: null,
  };
}

export interface BusinessTickResult {
  updatedBusiness: OwnedBusiness;
  weeklyRevenue: number;
  weeklyExpenses: number;
  weeklyProfit: number;
  playerDividend: number;
  ownershipDistributions: Array<{ ownerType: 'player' | 'child' | 'family_trust' | 'investor'; ownerId: string; ownerName: string; amount: number }>;
  taxRefund: number;
  newEvent: { businessName: string; eventTitle: string; icon: string } | null;
  newRetention: { businessName: string; employeeName: string; type: string } | null;
}

export interface BusinessSimulationModifiers {
  /** Decimal reduction, e.g. 0.075 means 7.5% lower operating expenses. */
  businessCostReduction?: number;
  competitorRevenueMultipliers?: Record<string, number>;
  /** Decimal reduction applied to the chance of new business crises. */
  businessCrisisReduction?: number;
  /** Capped portfolio synergy from a parent holding company. */
  holdingRevenueBonus?: number;
  holdingExpenseReduction?: number;
  holdingCrisisReduction?: number;
}

/**
 * Process a single business for one week.
 */
export function getBusinessRevenueCapacity(biz: OwnedBusiness): number {
  const type = getBusinessType(biz.typeId);
  if (!type) return 1;
  const pricing = PRICING_MULTIPLIERS[biz.pricingStrategy ?? 'standard'] ?? PRICING_MULTIPLIERS.standard;
  const advertising = ADVERTISING_COSTS[biz.advertisingLevel ?? 'none'] ?? ADVERTISING_COSTS.none;
  const employees = biz.employees ?? [];
  const buffs = aggregateEmployeeBuffs(employees);
  const productivity = employees.reduce((sum, employee) => sum +
    (getEmployeeRole(employee.roleId)?.productivityMultiplier ?? 1) *
    (0.4 + (employee.skill ?? 50) / 100 * 0.8) * (0.5 + (employee.morale ?? 50) / 100 * 0.7), 0);
  const upgrades = 1 - Math.exp(-[...new Set(biz.purchasedUpgrades ?? [])].reduce((sum, id) => sum + (getUpgrade(id)?.revenueBoost ?? 0), 0));
  const locations = (biz.locations ?? []).reduce((sum, location) => sum + (location.revenueBoost ?? 0), 0);
  const compact = (type.maxEmployees ?? 4) <= 3 ? 1.18 : (type.maxEmployees ?? 6) <= 5 ? 1.45 : 1;
  return Math.max(1, type.baseWeeklyRevenue * 1.121 * compact * Math.max(1, Math.min(1000, biz.operatingScaleMultiplier ?? 1)) *
    pricing.demand * (1 + advertising.demandBoost) * (0.6 + biz.reputation / 100 * 0.8) * (1 - (type.competitionLevel ?? 0.5) * 0.15) *
    pricing.revenue * Math.max(0.4, 0.4 + productivity * 0.14) * (employees.length > 12 ? 0.92 : 1) * buffs.productivityMult *
    (1 + upgrades + locations) * (1 + biz.level * 0.1) * buffs.revenueMult);
}

export function processBusinessWeek(
  biz: OwnedBusiness,
  inflationMultiplier: number,
  currentWeek: number,
  currentYear: number,
  modifiers: BusinessSimulationModifiers = {},
): BusinessTickResult {
  const type = getBusinessType(biz.typeId);
  if (!type) {
    return { updatedBusiness: biz, weeklyRevenue: 0, weeklyExpenses: 0, weeklyProfit: 0, playerDividend: 0, ownershipDistributions: [], taxRefund: 0, newEvent: null, newRetention: null };
  }
  const globalWeek = ((currentYear - 1) * 20) + currentWeek;
  const workforceTick = tickCorporateWorkforce(biz, globalWeek, inflationMultiplier);
  let corporateWorkforce = workforceTick.workforce;
  const workforceBiz = corporateWorkforce
    ? { ...biz, corporateWorkforce }
    : biz;
  const reinvestmentTick = tickBusinessReinvestment(workforceBiz, globalWeek);

  // Minimum staffing check - business earns NOTHING if under staffed
  if (!meetsMinStaffing(biz)) {
    return {
      updatedBusiness: {
        ...biz,
        corporateWorkforce,
        reinvestment: reinvestmentTick.reinvestment,
        activeReinvestment: reinvestmentTick.activeReinvestment,
        lastWeekRevenue: 0,
        lastWeekExpenses: 0,
        lastWeekProfit: 0,
        lastExpenseBreakdown: null,
      },
      weeklyRevenue: 0,
      weeklyExpenses: 0,
      weeklyProfit: 0,
      playerDividend: 0,
      ownershipDistributions: [],
      taxRefund: 0,
      newEvent: null,
      newRetention: null,
    };
  }

  const pricingMod = PRICING_MULTIPLIERS[biz.pricingStrategy ?? 'standard'] ?? PRICING_MULTIPLIERS.standard;
  const adMod = ADVERTISING_COSTS[biz.advertisingLevel ?? 'none'] ?? ADVERTISING_COSTS.none;
  const reputationFactor = 0.6 + (biz.reputation / 100) * 0.8; // 0.6 at 0 rep, 1.4 at 100 rep
  const competitionPenalty = 1 - (type.competitionLevel ?? 0.5) * 0.15;
  const acquisitionOperatingScale = Math.max(1, Math.min(1000, biz.operatingScaleMultiplier ?? 1));

  // ---- Seasons: every 5 weeks = new season; industry-specific multipliers ----
  const seasonIdx = Math.floor((globalWeek - 1) / 5) % 4; // 0=winter,1=spring,2=summer,3=fall
  const SEASON_MULT: Record<string, number[]> = {
    Retail: [1.1, 0.9, 0.95, 1.10],
    'Food & Beverage': [1.05, 1.00, 1.15, 1.00],
    Hospitality: [0.85, 1.05, 1.2, 1.00],
    Entertainment: [1.10, 0.95, 1, 0.90],
    Technology: [1.00, 1.00, 0.95, 1.05],
    Services: [0.95, 1.05, 1.05, 1.00],
    Manufacturing: [0.90, 1.05, 1.0, 1.05],
    Fitness: [1.20, 1.10, 0.85, 0.95],
    Beauty: [1.05, 1.1, 1.05, 0.95],
    Healthcare: [1.05, 0.95, 0.95, 1.05],
    Automotive: [0.90, 1.10, 1.10, 0.95],
    Construction: [0.75, 1.10, 1.20, 1.05],
    Real_Estate: [0.85, 1.15, 1.1, 0.90],
    'Real Estate': [0.85, 1.15, 1.15, 0.90],
  };
  const seasonMult = SEASON_MULT[type.industry ?? '']?.[seasonIdx] ?? 1.0;
  // Young companies face wider demand swings while they establish repeat
  // customers. Mature firms still benefit from the same market variance.
  const revenueFluctuation = 0.80 + Math.random() * 0.40;
  const demand = pricingMod.demand * (1 + adMod.demandBoost) * reputationFactor * competitionPenalty * seasonMult * revenueFluctuation;

  // Employee productivity — increased impact of skill
  const totalProductivity = (biz.employees ?? []).reduce((t, emp) => {
    const role = getEmployeeRole(emp.roleId);
    const skillFactor = 0.4 + (emp.skill ?? 50) / 100 * 0.8; // 0.4-1.2
    const moraleFactor = 0.5 + (emp.morale ?? 50) / 100 * 0.7; // 0.5-1.2
    return t + (role?.productivityMultiplier ?? 1.0) * skillFactor * moraleFactor;
  }, 0);
  // Aggregate buffs across all employees (D&D tier bonuses)
  const buffAgg = aggregateEmployeeBuffs(biz.employees ?? []);
  const employeeScaleDampening = (biz.employees?.length ?? 0) > 12 ? 0.92 : 1;
  const productivityMultiplier = Math.max(0.4, 0.4 + totalProductivity * 0.14) * employeeScaleDampening * buffAgg.productivityMult;

  const rawUpgradeRevenueBoost = [...new Set(biz.purchasedUpgrades ?? [])].reduce((t, uid) => {
    const u = getUpgrade(uid);
    return t + (u?.revenueBoost ?? 0);
  }, 0);
  // Preserve every listed upgrade benefit while preventing five additive boosts
  // from turning into a risk-free exponential late-game advantage.
  const upgradeRevenueBoost = 1 - Math.exp(-rawUpgradeRevenueBoost);
  const locationRevenueBoost = (biz.locations ?? []).reduce((total, location) => total + (location.revenueBoost ?? 0), 0);

  // Active event, strategic and project multipliers
  const strategyTotals = getStrategyModifierTotals(biz);
  let eventRevenueMultiplier = strategyTotals.revenue;
  let eventExpenseMultiplier = strategyTotals.expense;
  const acquisition = biz.acquisition ? { ...biz.acquisition } : null;
  if (acquisition?.integrationStrategy === 'pending') {
    // A newly acquired company waits for an integration decision. It suffers a
    // small coordination drag, but the actual integration clock does not start.
    const holdingPatternPenalty = Math.max(0.01, Math.min(0.05, (acquisition.baseIntegrationPenalty ?? acquisition.integrationPenalty ?? 0.08) * 0.35));
    eventRevenueMultiplier *= (1 - holdingPatternPenalty);
    eventExpenseMultiplier *= (1 + holdingPatternPenalty * 0.50);
  } else if ((acquisition?.integrationWeeksRemaining ?? 0) > 0) {
    const integrationPenalty = Math.max(0, Math.min(0.25, acquisition?.integrationPenalty ?? 0));
    eventRevenueMultiplier *= (1 - integrationPenalty);
    eventExpenseMultiplier *= (1 + integrationPenalty * 0.75);
  } else if (acquisition && acquisition.integrationOutcome !== 'pending') {
    eventRevenueMultiplier *= 1 + Math.max(-0.05, Math.min(0.08, acquisition.postIntegrationRevenueBonus ?? 0));
    eventExpenseMultiplier *= 1 - Math.max(-0.05, Math.min(0.08, acquisition.postIntegrationExpenseReduction ?? 0));
  }
  if (acquisition) {
    // Acquired-company traits are deliberately modest and persistent. They make
    // targets feel structurally different without overwhelming player choices.
    eventRevenueMultiplier *= 1 + Math.max(-0.05, Math.min(0.05, acquisition.persistentRevenueModifier ?? 0));
    eventExpenseMultiplier *= 1 + Math.max(-0.05, Math.min(0.05, acquisition.persistentExpenseModifier ?? 0));
  }
  const corporateCapexEffects = getCorporateCapexOperatingEffects(biz);
  const reinvestmentEffects = getBusinessReinvestmentEffects(workforceBiz);
  const governanceEffects = getBusinessGovernanceEffects(workforceBiz);
  const workforceEffects = workforceTick.effects;
  eventRevenueMultiplier *= 1 + corporateCapexEffects.revenueBonus;
  eventRevenueMultiplier *= 1 + governanceEffects.revenueBonus;
  eventRevenueMultiplier *= 1 + workforceEffects.revenueBonus;
  eventExpenseMultiplier *= 1 - governanceEffects.expenseReduction;
  eventExpenseMultiplier *= 1 - workforceEffects.expenseReduction;
  eventExpenseMultiplier *= 1 - corporateCapexEffects.expenseReduction;
  eventRevenueMultiplier *= 1 - corporateCapexEffects.constructionRevenuePenalty;
  eventExpenseMultiplier *= 1 + corporateCapexEffects.constructionExpensePenalty;
  eventRevenueMultiplier *= 1 - reinvestmentEffects.revenuePenalty;
  eventExpenseMultiplier *= 1 + reinvestmentEffects.expenseIncrease;
  eventRevenueMultiplier *= 1 + Math.max(0, Math.min(0.05, modifiers.holdingRevenueBonus ?? 0));
  for (const ae of biz.activeEvents ?? []) {
    eventRevenueMultiplier *= ae.revenueMultiplier ?? 1;
    eventExpenseMultiplier *= ae.expenseMultiplier ?? 1;
  }
  for (const p of biz.activeProjects ?? []) {
    if (p.succeeded && !p.resolved) {
      eventRevenueMultiplier *= p.revenueMultiplier ?? 1;
      eventExpenseMultiplier *= p.expenseMultiplier ?? 1;
    }
  }

  // Base revenue reduced by 3% from the previous balance pass.
  // Very small businesses cannot add more than three employees, so they receive
  // a compact-operation boost that substitutes for unavailable staff scaling.
  const compactBusinessRevenueBoost = (type.maxEmployees ?? 4) <= 3 ? 1.18 : (type.maxEmployees ?? 6) <= 5 ? 1.45 : 1;
  const baseRev = (type.baseWeeklyRevenue ?? 0) * inflationMultiplier * 1.121 * compactBusinessRevenueBoost * acquisitionOperatingScale;
  const businessAge = globalWeek - (((biz.foundedYear ?? currentYear) - 1) * 20 + (biz.foundedWeek ?? currentWeek));
  const startupSupport = !acquisition && businessAge > 0 && businessAge <= 75;
  const balanceTuning = !acquisition
    ? getBusinessBalanceTuning(type.id, biz.reputation ?? 25)
    : { revenueMultiplier: 1, expenseMultiplier: 1, variableExpenseMultiplier: 1 };
  const levelBonus = 1 + biz.level * 0.1;
  let revenue = Math.round(
    baseRev * demand * pricingMod.revenue * productivityMultiplier *
    (1 + upgradeRevenueBoost + locationRevenueBoost) * levelBonus * eventRevenueMultiplier * buffAgg.revenueMult * balanceTuning.revenueMultiplier
  );
  if (acquisition) {
    // Persist the purchase baseline: improvements change output, but the large
    // acquisition scale must not multiply the seller's quoted margin again.
    acquisition.quoteInflation ??= inflationMultiplier;
    acquisition.quotedWeeklyProfit ??= acquisition.estimatedValueAtPurchase / (20 * (2 + biz.reputation / 100 * 3));
    acquisition.quotedWeeklyRevenue ??= acquisition.quotedWeeklyProfit / 0.15;
    if (
      acquisition.workforceBaselineVersion !== 1
      && acquisition.referenceStaffCost != null
      && workforceTick.weeklyPayroll > 0
    ) {
      acquisition.referenceStaffCost += workforceTick.weeklyPayroll + workforceTick.trainingCost;
      acquisition.workforceBaselineVersion = 1;
    }
    acquisition.referenceStaffCost ??=
      (biz.employees ?? []).reduce((sum, employee) => sum + employee.weeklySalary, 0)
      + workforceTick.weeklyPayroll
      + workforceTick.trainingCost;
    acquisition.workforceBaselineVersion ??= 1;
    acquisition.referenceExpenseMultiplier ??= buffAgg.expenseMult;
    acquisition.referenceRevenueCapacity ??= getBusinessRevenueCapacity(biz);
    revenue = Math.round(revenue * acquisition.quotedWeeklyRevenue /
      Math.max(1, acquisition.quoteInflation * acquisition.referenceRevenueCapacity));
  }
  // Expenses (detailed breakdown) — variable costs SCALE with actual revenue.
  const combinedCostReduction = 1 - (1 - Math.max(0, Math.min(0.5, modifiers.businessCostReduction ?? 0))) * (1 - Math.max(0, Math.min(0.10, modifiers.holdingExpenseReduction ?? 0)));
  const prestigeCostMultiplier = 1 - Math.max(0, Math.min(0.55, combinedCostReduction));
  const reputationOperatingScale = getBusinessOperatingScale(biz.reputation ?? 25, type.maxEmployees ?? 8);
  const fullBaseExp = (type.baseWeeklyExpenses ?? 0) * inflationMultiplier * 0.95 * prestigeCostMultiplier * acquisitionOperatingScale * balanceTuning.expenseMultiplier;
  const baseExp = fullBaseExp * reputationOperatingScale.overhead;
  // Revenue scaling factor: if revenue is 5x the expected base, variable costs go up ~4x
  let revScale = baseRev > 0 ? revenue / baseRev : 1;
  // Variable-cost scaling: 60% fixed baseline + 40% × revScale (dampened)
  let variableScale = 0.6 + 0.4 * Math.min(6, revScale);
  // Rent scales with revenue: base rent + 2% of revenue above baseline
  const fullBaseRent = (type.baseWeeklyRent ?? 0) * inflationMultiplier * prestigeCostMultiplier * Math.sqrt(acquisitionOperatingScale) * balanceTuning.expenseMultiplier;
  const baseRent = fullBaseRent * reputationOperatingScale.premises;
  let rentScale = revenue > baseRev ? baseRent + (revenue - baseRev) * 0.02 : baseRent;
  let rent = Math.round(rentScale);
  const employeeSalaries = (biz.employees ?? []).reduce((t, e) => t + (e.weeklySalary ?? 0), 0);
  const familyGovernanceSalaries = (biz.familyRoles ?? []).reduce((t, role) => t + (role.weeklySalary ?? 0), 0);
  const executiveSalaries = governanceEffects.executiveWeeklySalary;
  const corporateDepartmentPayroll = workforceTick.weeklyPayroll;
  const normalSalaries = employeeSalaries + familyGovernanceSalaries + executiveSalaries + corporateDepartmentPayroll;
  // Startup wage support applies only to ordinary employees. Family governance
  // and professional executive appointments remain contractual.
  const salaries = Math.round(
    employeeSalaries * (startupSupport ? 0.95 : 1)
    + familyGovernanceSalaries
    + executiveSalaries
    + corporateDepartmentPayroll
  );
  const adCost = Math.round((adMod.weeklyCost ?? 0) * inflationMultiplier * prestigeCostMultiplier);
  const starterDemandWeight = acquisition ? 0 : Math.max(0, Math.min(1, (70 - (biz.reputation ?? 25)) / 30));
  if (starterDemandWeight > 0) {
    // Local contracts taper smoothly; a level-up never removes all starting customers.
    const compactStarterSupport = (type.maxEmployees ?? 6) <= 3 ? 1.12 : (type.maxEmployees ?? 6) <= 5 ? 1.04 : 1;
    const starterRevenue = getStartupRevenueTarget(fullBaseExp * eventExpenseMultiplier, fullBaseRent, normalSalaries, adCost, Math.random()) * compactStarterSupport;
    revenue += Math.max(0, starterRevenue - revenue) * starterDemandWeight;
    revScale = baseRev > 0 ? revenue / baseRev : 1;
    variableScale = 0.6 + 0.4 * Math.min(6, revScale);
    rentScale = revenue > baseRev ? baseRent + (revenue - baseRev) * 0.02 : baseRent;
    rent = Math.round(rentScale);
  }
  // Apply competition and temporary support before costs, taxes, dividends and balances.
  revenue = Math.round(revenue * (startupSupport ? 1.03 : 1) * (modifiers.competitorRevenueMultipliers?.[biz.id] ?? 1) * Math.max(0.7, 1 + (biz.marketShareModifier ?? 0) / 100));
  // Occasional cancelled local orders keep young firms risky, not guaranteed profitable.
  if ((biz.reputation ?? 25) < 55 && revenueFluctuation < 0.88) revenue = Math.round(revenue * 0.64);
  revScale = baseRev > 0 ? revenue / baseRev : 1;
  variableScale = 0.6 + 0.4 * Math.min(6, revScale);
  rent = Math.round(revenue > baseRev ? baseRent + (revenue - baseRev) * 0.02 : baseRent);
  // COGS and delivery costs rise with scale, preventing unrealistically large
  // margins once employee and upgrade multipliers compound.
  let cogs = Math.round(Math.max(baseExp * 0.45, revenue * 0.17 * balanceTuning.variableExpenseMultiplier) * eventExpenseMultiplier * buffAgg.expenseMult);
  // Utilities/maintenance/misc scale moderately, insurance is mostly fixed
  let utilities = Math.round(baseExp * 0.15 * variableScale * eventExpenseMultiplier * buffAgg.expenseMult);
  const explicitInsurancePremium = getBusinessInsuranceTotalWeeklyPremium(workforceBiz, globalWeek);
  let baseInsurance = Math.round(baseExp * 0.10 * (0.8 + 0.2 * variableScale) * eventExpenseMultiplier * buffAgg.expenseMult);
  let insurance = baseInsurance + explicitInsurancePremium;
  let maintenance = Math.round(baseExp * 0.15 * variableScale * eventExpenseMultiplier * buffAgg.expenseMult);
  const locationOperatingCosts = Math.round((biz.locations ?? []).reduce((total, location) => total + (location.weeklyOperatingCost ?? 0), 0) * inflationMultiplier * prestigeCostMultiplier);
  let baseMisc = Math.round(baseExp * 0.15 * variableScale * eventExpenseMultiplier * buffAgg.expenseMult)
    + locationOperatingCosts;
  const boardFees = governanceEffects.boardWeeklyCost;
  const workforceTraining = workforceTick.trainingCost;
  const workforceTransition = workforceTick.transitionCost;
  let misc = baseMisc;
  if (acquisition) {
    const quotedRevenue = Math.max(1, acquisition.quotedWeeklyRevenue!);
    const inflationRatio = inflationMultiplier / Math.max(0.01, acquisition.quoteInflation!);
    // Seller profit is after corporate tax, before buyer-specific debt service.
    const operatingBudget = Math.max(0, quotedRevenue - acquisition.quotedWeeklyProfit! / 0.8 - acquisition.referenceStaffCost!);
    const volume = Math.max(0, revenue / (quotedRevenue * inflationRatio));
    const expenseBuffChange = buffAgg.expenseMult / Math.max(0.01, acquisition.referenceExpenseMultiplier!);
    const overhead = Math.round(operatingBudget * inflationRatio * (0.6 + 0.4 * volume) * prestigeCostMultiplier * eventExpenseMultiplier * expenseBuffChange);
    const originalOverhead = Math.max(1, rent + cogs + utilities + baseInsurance + maintenance + baseMisc - locationOperatingCosts);
    const scale = overhead / originalOverhead;
    rent = Math.round(rent * scale);
    cogs = Math.round(cogs * scale);
    utilities = Math.round(utilities * scale);
    baseInsurance = Math.round(baseInsurance * scale);
    insurance = baseInsurance + explicitInsurancePremium;
    maintenance = Math.round(maintenance * scale);
    baseMisc = Math.max(0, overhead - rent - cogs - utilities - baseInsurance - maintenance) + locationOperatingCosts;
    misc = baseMisc;
  }

  let loanInterest = 0;
  const updatedLoans: BusinessLoan[] = [];
  for (const loan of biz.businessLoans ?? []) {
    const payment = loan.weeklyPayment ?? 0;
    const interestPortion = Math.round(payment * ((loan.interestRate ?? 0.1) / (loan.weeksRemaining || 1)));
    loanInterest += payment;
    const remaining = (loan.remainingAmount ?? 0) - payment;
    const weeksLeft = (loan.weeksRemaining ?? 1) - 1;
    if (weeksLeft > 0 && remaining > 0) {
      updatedLoans.push({ ...loan, remainingAmount: Math.max(0, remaining), weeksRemaining: weeksLeft });
    }
  }

  const expensesBeforeTax = rent + salaries + adCost + cogs + utilities + insurance + maintenance
    + boardFees + workforceTraining + workforceTransition + misc;
  const preTaxProfit = revenue - (expensesBeforeTax + loanInterest);
  // Corporate tax: 20% of positive weekly profit
  const businessTax = preTaxProfit > 0 ? Math.round(preTaxProfit * 0.20) : 0;
  const totalExpenses = expensesBeforeTax + loanInterest + businessTax;
  const profit = revenue - totalExpenses;

  const expenseBreakdown: BusinessExpenseBreakdown = {
    rent, salaries, cogs, utilities,
    marketing: adCost,
    insurance, maintenance, taxes: businessTax,
    loanInterest,
    boardFees,
    workforceTraining,
    workforceTransition,
    misc,
  };

  // Tick down active events
  let newActiveEvents = (biz.activeEvents ?? []).filter((ae) => (ae.weeksRemaining ?? 0) > 1)
    .map((ae) => ({ ...ae, weeksRemaining: (ae.weeksRemaining ?? 1) - 1 }));

  // Bad seasonal event injection: fires on the first week of a season
  const seasonStart = (globalWeek - 1) % 5 === 0;
  const timelineAdds: BusinessTimelineEntry[] = [];
  let updatedAcquisition = acquisition ? { ...acquisition } : null;
  let integrationRepDelta = 0;
  if (updatedAcquisition && updatedAcquisition.integrationStrategy !== 'pending') {
    const remaining = Math.max(0, updatedAcquisition.integrationWeeksRemaining ?? 0);
    if (remaining === 1) {
      const strategy = updatedAcquisition.integrationStrategy;
      const roll = Math.random();
      const successChance = Math.max(0, Math.min(1, updatedAcquisition.integrationSuccessChance ?? 0.8));
      const outcome = roll < successChance ? 'success' : roll < Math.min(1, successChance + 0.18) ? 'mixed' : 'failed';
      let revenueBonus = 0;
      let expenseReduction = 0;
      if (strategy === 'integrate') {
        if (outcome === 'success') { revenueBonus = 0.015; expenseReduction = 0.02; integrationRepDelta = 2; }
        else if (outcome === 'mixed') { revenueBonus = 0.005; expenseReduction = 0.01; }
        else { expenseReduction = -0.005; integrationRepDelta = -2; }
      } else if (strategy === 'turnaround') {
        if (outcome === 'success') { revenueBonus = 0.04; expenseReduction = 0.04; integrationRepDelta = 4; }
        else if (outcome === 'mixed') { revenueBonus = 0.015; expenseReduction = 0.015; integrationRepDelta = -1; }
        else { revenueBonus = -0.02; expenseReduction = -0.02; integrationRepDelta = -5; }
      }
      updatedAcquisition = {
        ...updatedAcquisition,
        integrationOutcome: outcome,
        integrationWeeksRemaining: 0,
        postIntegrationRevenueBonus: revenueBonus,
        postIntegrationExpenseReduction: expenseReduction,
      };
      timelineAdds.push({
        week: currentWeek,
        year: currentYear,
        title: `Acquisition integration ${outcome}: ${strategy.replace('_', ' ')}`,
        icon: outcome === 'success' ? '✅' : outcome === 'mixed' ? '⚖️' : '⚠️',
        kind: 'event',
      });
    } else if (remaining > 1) {
      updatedAcquisition = { ...updatedAcquisition, integrationWeeksRemaining: remaining - 1 };
    }
  }
  if (seasonStart) {
    const bad = getBadSeasonForIndustry(type.industry ?? '', seasonIdx);
    const badId = bad ? `bad_season_${type.industry}_${seasonIdx}` : null;
    if (bad && !newActiveEvents.some((ae) => ae.eventId === badId)) {
      newActiveEvents.push({
        eventId: badId!,
        revenueMultiplier: bad.revMult,
        expenseMultiplier: bad.expMult,
        weeksRemaining: 5,
      });
      timelineAdds.push({ week: currentWeek, year: currentYear, title: bad.title, icon: bad.icon, kind: 'season' });
    }
  }

  // Tick down projects & resolve completed ones
  let updatedProjects: ActiveBusinessProject[] = [];
  for (const p of biz.activeProjects ?? []) {
    if (p.weeksRemaining <= 1 && !p.resolved) {
      updatedProjects.push({ ...p, weeksRemaining: 0, resolved: true });
    } else if (p.weeksRemaining > 1) {
      updatedProjects.push({ ...p, weeksRemaining: p.weeksRemaining - 1 });
    }
  }

  // Morale incident: a single 5% roll, only for teams averaging at least 75 morale.
  let newEvent: { businessName: string; eventTitle: string; icon: string } | null = null;
  let eventRepChange = 0;
  let moraleDrop = 0;
  const averageMorale = (biz.employees?.length ?? 0) > 0
    ? (biz.employees ?? []).reduce((total, employee) => total + (employee.morale ?? 50), 0) / (biz.employees?.length ?? 1)
    : 0;
  const eventSpacingReady = globalWeek - (biz.lastBusinessEventWeek ?? -100) >= 10;
  const eventCooldowns = { ...(biz.businessEventCooldowns ?? {}) };
  const availableMoraleEvents = (moraleEventsData as any[]).filter((event: any) => globalWeek - (eventCooldowns[event.id] ?? -100) >= 40);
  let triggeredEventId: string | null = null;
  if (eventSpacingReady && averageMorale >= 75 && availableMoraleEvents.length > 0 && Math.random() < 0.05) {
    const moraleEvent: any = availableMoraleEvents[Math.floor(Math.random() * availableMoraleEvents.length)];
    if (moraleEvent) {
      moraleDrop = Math.min(10, Math.max(5, moraleEvent.moraleDecrease ?? 5));
      newEvent = { businessName: biz.name, eventTitle: moraleEvent.title, icon: moraleEvent.icon };
      triggeredEventId = moraleEvent.id;
    }
  }

  const eligibleEvents = (businessEventsData ?? []).filter((ev: any) => {
    // Major negative surprises use the persistent crisis-choice system so the
    // player can respond. Automatic events are upside/flavour only.
    if (ev.positive === false) return false;
    if ((ev.minReputation ?? 0) > (biz.reputation ?? 0)) return false;
    if (!eventSpacingReady || globalWeek - (eventCooldowns[ev.id] ?? -100) < 40) return false;
    const industries = ev.industries ?? [];
    if (industries.includes('all') || industries.includes(type.industry)) return true;
    return false;
  });

  for (const ev of newEvent ? [] : eligibleEvents) {
    if (Math.random() < ((ev as any).chance ?? 0)) {
      if (newActiveEvents.some((ae) => ae.eventId === (ev as any).id)) continue;

      newEvent = { businessName: biz.name, eventTitle: (ev as any).title, icon: (ev as any).icon };
      triggeredEventId = (ev as any).id;
      const eff = (ev as any).effects ?? {};

      if (eff.expenseCost) {
        // One-time expense cost — deduct from balance below
        // Applied via balance below
      }
      if (eff.reputationHigh != null) {
        eventRepChange += eff.reputationHigh ?? 0;
      }
      if (eff.duration && eff.duration > 0) {
        newActiveEvents.push({
          eventId: (ev as any).id,
          revenueMultiplier: eff.revenueMultiplier ?? 1,
          expenseMultiplier: eff.expenseMultiplier ?? 1,
          weeksRemaining: eff.duration,
        });
      }

      break;
    }
  }

  // Apply one-time event cost/bonus to balance
  let extraCashDelta = 0;
  if (newEvent) {
    const ev: any = eligibleEvents.find((e: any) => e.title === newEvent!.eventTitle);
    const eff = ev?.effects ?? {};
    if (eff.expenseCost) extraCashDelta -= Math.round((biz.valuation ?? 10000) * eff.expenseCost);
    if (eff.cashBonus) extraCashDelta += Math.round(eff.cashBonus);
  }

  // Reputation update
  const reputationHeadroom = Math.max(0, 1 - (biz.reputation ?? 25) / 100);
  const reputationGrowthRate = (biz.reputation ?? 25) < 40 ? 0.16 : 0.24;
  const repGrowth = (type.reputationGrowthRate ?? 0.5) * (profit > 0 ? reputationGrowthRate * reputationHeadroom : -0.07);
  const adRepBoost = (adMod.reputationBoost ?? 0) * reputationHeadroom * (profit >= 0 ? 1 : 0.35);
  const pricingRepEffect = pricingMod.reputation ?? 0;
  const projectRepBoost = updatedProjects
    .filter((project) => project.resolved && project.succeeded && !biz.activeProjects?.find((old) => old.id === project.id)?.resolved)
    .reduce((total, project) => total + project.reputationBonus, 0);
  let newReputation = (biz.reputation ?? 25)
    + repGrowth + adRepBoost + pricingRepEffect + eventRepChange + projectRepBoost
    + buffAgg.weeklyRepBoost + strategyTotals.reputation + integrationRepDelta
    + governanceEffects.reputationPerWeek
    + workforceEffects.reputationPerWeek
    - reinvestmentEffects.reputationDrag;
  newReputation = Math.max(0, Math.min(100, newReputation));

  // Employee morale & skill growth
  let updatedEmployees = (biz.employees ?? []).map((emp) => {
    const moraleChange = profit > 0 ? 0.5 : -1.5;
    const skillGrowth = 0.3 + (emp.morale / 100) * 0.4;
    let newSkill = Math.min(emp.potential ?? 100, Math.min(100, (emp.skill ?? 50) + skillGrowth));
    // Training completion
    let trainingWeeks = emp.trainingWeeksRemaining ?? 0;
    let inTrainingId = emp.inTrainingId ?? null;
    if (inTrainingId && trainingWeeks > 0) {
      trainingWeeks -= 1;
      if (trainingWeeks <= 0) {
        const t = getTrainingOption(inTrainingId);
        if (t && Math.random() > (t.failChance ?? 0.1)) {
          newSkill = Math.min(emp.potential ?? 100, Math.min(100, newSkill + (t.skillGain ?? 10)));
        }
        inTrainingId = null;
        trainingWeeks = 0;
      }
    }
    return {
      ...emp,
      morale: Math.max(10, Math.min(100, (emp.morale ?? 50) + moraleChange + buffAgg.weeklyMoraleBoost + strategyTotals.morale - moraleDrop)),
      skill: newSkill,
      experience: (emp.experience ?? 0) + 1,
      weeksEmployed: (emp.weeksEmployed ?? 0) + 1,
      inTrainingId,
      trainingWeeksRemaining: trainingWeeks,
    };
  });

  // Retention events (rare, only if not already pending)
  let newRetention: { businessName: string; employeeName: string; type: string } | null = null;
  let pendingRetention = biz.pendingRetention ?? null;
  if (!pendingRetention && updatedEmployees.length > 0 && Math.random() < 0.02) {
    const emp = updatedEmployees[Math.floor(Math.random() * updatedEmployees.length)];
    // Higher skill/experience = more likely to be poached
    if ((emp.skill ?? 0) > 60 || (emp.experience ?? 0) > 100) {
      const types: Array<'poach' | 'raise' | 'promotion' | 'training'> = ['poach', 'raise', 'promotion', 'training'];
      const type = types[Math.floor(Math.random() * types.length)];
      pendingRetention = { employeeId: emp.id, type };
      newRetention = { businessName: biz.name, employeeName: emp.name, type };
    }
  }

  // Level check
  const thresholds = scaleValuationTargets(type.levelThresholds ?? [0]);
  const valuationProfitHistory = [...(biz.weeklyProfitHistory ?? []), profit].slice(-52);
  let valuation = calculateValuation({
    ...biz,
    reputation: newReputation,
    lastWeekRevenue: revenue,
    lastWeekProfit: profit,
    weeklyProfitHistory: valuationProfitHistory,
    employees: updatedEmployees,
  });
  let newLevel = getBusinessLevelForMetrics(thresholds, valuation, newReputation);

  // Balance, annual budget allocation, extra debt paydown, and dividends.
  let newBalance = (biz.balance ?? 0) + profit + extraCashDelta;
  const budgetResult = applyBusinessBudgetWeek({
    business: biz,
    balanceBeforeBudget: newBalance,
    profit,
    totalExpenses,
    loans: updatedLoans,
    currentWeek,
    currentYear,
    inflationMultiplier,
  });
  newBalance = budgetResult.balance;
  let playerDividend = 0;
  let ownershipDistributions: BusinessTickResult['ownershipDistributions'] = [];
  if (budgetResult.dividendPaid > 0) {
    const ownership = biz.ownership?.length
      ? biz.ownership
      : [{ ownerType: 'player' as const, ownerId: 'player', ownerName: 'Player', percent: 100, votingPercent: 100 }];
    ownershipDistributions = ownership
      .filter((stake) => (stake.percent ?? 0) > 0)
      .map((stake) => ({
        ownerType: stake.ownerType,
        ownerId: stake.ownerId,
        ownerName: stake.ownerName,
        amount: Math.round(budgetResult.dividendPaid * (stake.percent ?? 0) / 100),
      }));
    playerDividend = ownershipDistributions
      .filter((distribution) => distribution.ownerType === 'player')
      .reduce((sum, distribution) => sum + distribution.amount, 0);
  }
  valuation = calculateValuation({
    ...biz,
    balance: newBalance,
    reputation: newReputation,
    lastWeekRevenue: revenue,
    lastWeekProfit: profit,
    weeklyProfitHistory: valuationProfitHistory,
    employees: updatedEmployees,
    businessLoans: budgetResult.loans,
  });
  newLevel = getBusinessLevelForMetrics(thresholds, valuation, newReputation);

  // Track annual profit; give tax refund if new year starts and last year was negative
  let annualProfit = biz.annualProfit ?? 0;
  let annualProfitYear = biz.annualProfitYear ?? currentYear;
  let taxRefund = 0;
  if (currentYear !== annualProfitYear) {
    if (annualProfit < 0) {
      // Refund 25% of losses to business balance
      taxRefund = Math.round(Math.abs(annualProfit) * 0.25);
      newBalance += taxRefund;
    }
    annualProfit = profit;
    annualProfitYear = currentYear;
  } else {
    annualProfit += profit;
  }

  // History
  const profitHistory = [...(biz.weeklyProfitHistory ?? [])];
  profitHistory.push(profit);
  if (profitHistory.length > 52) profitHistory.shift();

  const revHistory = [...(biz.weeklyRevenueHistory ?? [])];
  revHistory.push(revenue);
  if (revHistory.length > 52) revHistory.shift();

  // Recruit charge accrual: +1 charge every 5 weeks worked, max 5
  let recruitProgress = (biz.recruitProgress ?? 0) + 1;
  let recruitCharges = biz.recruitCharges ?? 0;
  if (recruitProgress >= 5 && recruitCharges < 5) {
    recruitCharges += 1;
    recruitProgress = 0;
  } else if (recruitCharges >= 5) {
    recruitProgress = 0;
  }

  // Upgrade timer countdown
  let activeUpgrade = biz.activeUpgrade ? { ...biz.activeUpgrade } : null;
  let completedUpgradeId: string | null = null;
  if (activeUpgrade) {
    activeUpgrade.weeksRemaining = Math.max(0, activeUpgrade.weeksRemaining - 1);
    if (activeUpgrade.weeksRemaining <= 0) {
      // Complete the upgrade
      if (!(biz.purchasedUpgrades ?? []).includes(activeUpgrade.upgradeId)) {
        completedUpgradeId = activeUpgrade.upgradeId;
        newReputation = Math.min(100, newReputation + (getUpgrade(completedUpgradeId)?.reputationBoost ?? 0));
      }
      timelineAdds.push({ week: currentWeek, year: currentYear, title: `Upgrade completed: ${activeUpgrade.upgradeId}`, icon: '🔧', kind: 'upgrade' as any });
      activeUpgrade = null;
    }
  }

  // Geographic expansion timer. New locations start affecting finances next week.
  let activeExpansion = biz.activeExpansion ? { ...biz.activeExpansion } : null;
  let locations = [...(biz.locations ?? [])];
  if (activeExpansion) {
    activeExpansion.weeksRemaining = Math.max(0, activeExpansion.weeksRemaining - 1);
    if (activeExpansion.weeksRemaining <= 0) {
      const template = getBusinessLocationTemplate(activeExpansion.templateId);
      const costs = getScaledLocationCosts(biz, activeExpansion.templateId, inflationMultiplier);
      if (template && costs && !locations.some((location) => location.templateId === template.id)) {
        locations.push({ id: `location_${biz.id}_${template.id}`, templateId: template.id, name: template.name, region: template.region, revenueBoost: template.revenueBoost, weeklyOperatingCost: costs.weeklyOperatingCost, openedWeek: globalWeek });
        timelineAdds.push({ week: currentWeek, year: currentYear, title: `Opened ${template.name} in ${template.region}`, icon: '🌍', kind: 'expansion' });
      }
      activeExpansion = null;
    }
  }

  // Long-horizon corporate capex. Only one investment can be under construction.
  let activeCorporateCapex = biz.activeCorporateCapex ? { ...biz.activeCorporateCapex } : null;
  let completedCorporateCapex = [...(biz.completedCorporateCapex ?? [])];
  if (activeCorporateCapex) {
    if ((activeCorporateCapex.weeksRemaining ?? 0) <= 1) {
      const completedDefinition = getCorporateCapexProject(activeCorporateCapex.projectId);
      completedCorporateCapex = appendCompletedCorporateCapex(completedCorporateCapex, {
        projectId: activeCorporateCapex.projectId,
        projectName: activeCorporateCapex.projectName,
        costPaid: activeCorporateCapex.costPaid,
        completedGlobalWeek: globalWeek,
      });
      if (completedDefinition) {
        newReputation = Math.min(100, newReputation + (completedDefinition.reputationBonus ?? 0));
      }
      timelineAdds.push({
        week: currentWeek,
        year: currentYear,
        title: `Corporate investment completed: ${activeCorporateCapex.projectName}`,
        icon: completedDefinition?.icon ?? '🏢',
        kind: 'corporate_capex',
      });
      activeCorporateCapex = null;
    } else {
      activeCorporateCapex = {
        ...activeCorporateCapex,
        weeksRemaining: Math.max(0, activeCorporateCapex.weeksRemaining - 1),
      };
    }
  }

  if (reinvestmentTick.completedArea) {
    const completedName = reinvestmentTick.completedArea === 'technology'
      ? 'Technology Refresh'
      : reinvestmentTick.completedArea === 'premises'
        ? 'Premises Renovation'
        : 'Equipment Renewal';
    timelineAdds.push({
      week: currentWeek,
      year: currentYear,
      title: `Reinvestment completed: ${completedName}`,
      icon: reinvestmentTick.completedArea === 'technology' ? '💻' : reinvestmentTick.completedArea === 'premises' ? '🏗️' : '🛠️',
      kind: 'event',
    });
  }

  // Level-up timeline entry
  if (newLevel > (biz.level ?? 0)) {
    timelineAdds.push({ week: currentWeek, year: currentYear, title: `Reached level ${newLevel + 1}`, icon: '⭐', kind: 'level' });
  }
  // Project completion timeline entries (only when resolving)
  for (const p of updatedProjects) {
    if (p.resolved && !biz.activeProjects?.find((op) => op.id === p.id)?.resolved) {
      const projName = p.projectName ?? p.projectType;
      timelineAdds.push({
        week: currentWeek, year: currentYear,
        title: p.succeeded ? `Project succeeded: ${projName}` : `Project failed: ${projName}`,
        icon: p.succeeded ? '✅' : '❌', kind: 'project',
      });
    }
  }
  // Major event timeline entry
  if (newEvent) {
    timelineAdds.push({ week: currentWeek, year: currentYear, title: newEvent.eventTitle, icon: newEvent.icon, kind: 'event' });
  }
  let timeline = [...(biz.timeline ?? []), ...timelineAdds].slice(-50);

  let strategyModifiers = (biz.strategyModifiers ?? [])
    .filter((modifier) => (modifier.weeksRemaining ?? 0) > 1)
    .map((modifier) => ({ ...modifier, weeksRemaining: (modifier.weeksRemaining ?? 1) - 1 }));

  const familyRoles = (biz.familyRoles ?? []).map((role) => ({
    ...role,
    experienceWeeks: (role.experienceWeeks ?? 0) + 1,
    performance: Math.max(0, Math.min(100, (role.performance ?? 50) + ((role.performance ?? 50) >= 50 ? 0.05 : -0.02))),
  }));
  const governanceTick = tickBusinessGovernance(
    workforceBiz,
    revenue,
    profit,
    currentWeek,
    currentYear,
  );
  if (governanceTick.timelineEntries.length > 0) {
    timeline = [...timeline, ...governanceTick.timelineEntries].slice(-50);
  }

  let pendingDecision = biz.pendingDecision ?? null;
  let nextStrategicDecisionWeek = biz.nextStrategicDecisionWeek ?? (globalWeek + 8);
  let nextCrisisCheckWeek = biz.nextCrisisCheckWeek ?? (globalWeek + 14);
  let autoResolvedDecision = false;
  let resolvedMarketShareModifier = biz.marketShareModifier ?? 0;

  if (pendingDecision && globalWeek > (pendingDecision.deadlineGlobalWeek ?? pendingDecision.createdGlobalWeek + 4)) {
    const fallback = pendingDecision.choices.find((choice) => choice.id === pendingDecision!.defaultChoiceId)
      ?? pendingDecision.choices[pendingDecision.choices.length - 1];

    if (fallback) {
      if ((fallback.durationWeeks ?? 0) > 1) {
        strategyModifiers.push({
          id: `${pendingDecision.id}:${fallback.id}:auto`,
          title: `${pendingDecision.title} — ignored / ${fallback.text}`,
          revenueMultiplier: fallback.revenueMultiplier ?? 1,
          expenseMultiplier: fallback.expenseMultiplier ?? 1,
          reputationPerWeek: 0,
          moralePerWeek: 0,
          weeksRemaining: fallback.durationWeeks ?? 1,
        });
      }
      newReputation = Math.max(0, Math.min(100, newReputation + (fallback.reputationDelta ?? 0)));
      resolvedMarketShareModifier = Math.max(-30, Math.min(30, resolvedMarketShareModifier + (fallback.marketShareDelta ?? 0)));
      if (fallback.moraleDelta) {
        updatedEmployees = updatedEmployees.map((employee) => ({
          ...employee,
          morale: Math.max(10, Math.min(100, (employee.morale ?? 50) + (fallback.moraleDelta ?? 0))),
        }));
      }
      if (
        corporateWorkforce
        && (
          fallback.workforceCompensationPolicy
          || fallback.workforceTrainingPolicy
          || fallback.workforceRelationsDelta
          || fallback.workforceTargetMultiplier
        )
      ) {
        corporateWorkforce = applyCorporateHrDecisionChoice(
          { ...biz, corporateWorkforce },
          corporateWorkforce,
          fallback,
          globalWeek,
          inflationMultiplier,
        );
      }
      timeline = [
        ...timeline,
        {
          week: currentWeek,
          year: currentYear,
          title: `⏱️ ${pendingDecision.title}: no response — ${fallback.text}`,
          icon: '⏱️',
          kind: 'event' as const,
        },
      ].slice(-50);
    }
    pendingDecision = null;
    autoResolvedDecision = true;
  }

  if (
    !pendingDecision
    && !autoResolvedDecision
    && corporateWorkforce
    && globalWeek >= (corporateWorkforce.nextHrEventWeek ?? globalWeek + 12)
  ) {
    pendingDecision = makeCorporateHrDecision({ ...biz, corporateWorkforce }, globalWeek);
    if (pendingDecision) {
      corporateWorkforce = scheduleNextCorporateHrEvent(corporateWorkforce, globalWeek);
    }
  } else if (!pendingDecision && !autoResolvedDecision && globalWeek >= nextStrategicDecisionWeek) {
    pendingDecision = makeStrategicDecision(biz, globalWeek);
    nextStrategicDecisionWeek = globalWeek + 6 + Math.floor(Math.random() * 7);
  } else if (!pendingDecision && !autoResolvedDecision && globalWeek >= nextCrisisCheckWeek) {
    const corporateTier = getCorporateScaleTier(biz);
    const baseCrisisChance = corporateTier === 'local'
      ? Math.max(0.10, 0.24 - (biz.reputation ?? 0) * 0.001)
      : getCorporateCrisisBaseChance(biz);
    const capexCrisisReduction = getCorporateCapexOperatingEffects(biz).crisisReduction;
    const combinedCrisisReduction = 1
      - (1 - Math.max(0, Math.min(0.8, modifiers.businessCrisisReduction ?? 0)))
      * (1 - Math.max(0, Math.min(0.25, modifiers.holdingCrisisReduction ?? 0)))
      * (1 - Math.max(0, Math.min(0.12, capexCrisisReduction)))
      * (1 - Math.max(-0.05, Math.min(0.12, governanceEffects.crisisReduction)))
      * (1 - Math.max(-0.08, Math.min(0.08, workforceEffects.crisisReduction)));
    const crisisChance = Math.max(0.04, baseCrisisChance * (1 + reinvestmentEffects.crisisIncrease) * (1 - combinedCrisisReduction));
    if (Math.random() < crisisChance) {
      pendingDecision = corporateTier === 'local'
        ? makeBusinessCrisis(biz, globalWeek)
        : makeCorporateScaleCrisis(biz, globalWeek);
    }
    nextCrisisCheckWeek = globalWeek + 8 + Math.floor(Math.random() * 10);
  }

  let updatedBusiness: OwnedBusiness = {
    ...biz,
    balance: newBalance,
    totalRevenue: (biz.totalRevenue ?? 0) + revenue,
    totalExpenses: (biz.totalExpenses ?? 0) + totalExpenses,
    lastWeekRevenue: revenue,
    lastWeekExpenses: totalExpenses,
    lastWeekProfit: profit,
    reputation: Math.round(newReputation * 10) / 10,
    level: newLevel,
    valuation,
    marketShareModifier: resolvedMarketShareModifier,
    employees: updatedEmployees,
    businessLoans: budgetResult.loans,
    budgetPlan: budgetResult.plan,
    budgetReserves: budgetResult.reserves,
    lastBudgetAllocation: budgetResult.snapshot,
    activeEvents: newActiveEvents,
    activeProjects: updatedProjects,
    lastExpenseBreakdown: expenseBreakdown,
    weeklyProfitHistory: profitHistory,
    weeklyRevenueHistory: revHistory,
    annualProfit,
    annualProfitYear,
    pendingRetention,
    freeRecruits: biz.freeRecruits ?? 3,
    recruitCharges,
    recruitProgress,
    timeline,
    activeUpgrade,
    activeExpansion,
    activeCorporateCapex,
    completedCorporateCapex,
    reinvestment: reinvestmentTick.reinvestment,
    activeReinvestment: reinvestmentTick.activeReinvestment,
    locations,
    purchasedUpgrades: [...new Set([
      ...(biz.purchasedUpgrades ?? []),
      ...(completedUpgradeId ? [completedUpgradeId] : []),
    ])],
    lastBusinessEventWeek: triggeredEventId ? globalWeek : biz.lastBusinessEventWeek,
    businessEventCooldowns: triggeredEventId ? { ...eventCooldowns, [triggeredEventId]: globalWeek } : eventCooldowns,
    strategicFocus: biz.strategicFocus ?? 'balanced',
    strategyModifiers,
    familyRoles,
    executives: governanceTick.executives,
    pendingExecutiveSearch: biz.pendingExecutiveSearch ?? null,
    boardGovernance: governanceTick.boardGovernance,
    corporateWorkforce,
    ownership: biz.ownership?.length ? biz.ownership : [{
      ownerType: 'player',
      ownerId: 'player',
      ownerName: 'Player',
      percent: 100,
      votingPercent: 100,
    }],
    pendingDecision,
    nextStrategicDecisionWeek,
    nextCrisisCheckWeek,
    operatingScaleMultiplier: acquisitionOperatingScale,
    acquisition: updatedAcquisition,
    totalPlayerDistributions: (biz.totalPlayerDistributions ?? 0) + playerDividend,
  };
  updatedBusiness.valuation = calculateValuation(updatedBusiness);
  if (!updatedBusiness.corporateWorkforce && updatedBusiness.valuation >= CORPORATE_WORKFORCE_UNLOCK_VALUATION) {
    updatedBusiness.corporateWorkforce = createCorporateWorkforce(
      updatedBusiness,
      globalWeek,
      inflationMultiplier,
    );
  }
  updatedBusiness.level = getBusinessLevelForMetrics(thresholds, updatedBusiness.valuation, updatedBusiness.reputation);
  updatedBusiness = closeCompletedBusinessManagementQuarter(updatedBusiness, globalWeek);
  updatedBusiness.managementTargets = ensureBusinessManagementTargetPlan(updatedBusiness, globalWeek);
  const reportedBusiness = appendCorporateKpiSnapshot(updatedBusiness, globalWeek);

  return {
    updatedBusiness: reportedBusiness,
    weeklyRevenue: revenue,
    weeklyExpenses: totalExpenses,
    weeklyProfit: profit,
    playerDividend,
    ownershipDistributions,
    taxRefund,
    newEvent,
    newRetention,
  };
}

/** Compute project difficulty (D20 threshold needed to succeed). */
export function getProjectDifficulty(project: any): number {
  const revBenefit = Math.max(0, (project?.revenueMultiplier ?? 1) - 1);
  const repBenefit = (project?.reputationBonus ?? 0);
  // Baseline 8, +2 per 10% rev boost, +0.5 per rep pt (capped at 20)
  return Math.min(20, Math.max(5, Math.round(8 + revBenefit * 20 + repBenefit * 0.5)));
}

/** Compute success odds (%) given best matching employee skill. */
export function getProjectOdds(project: any, bestSkill: number): number {
  const needed = getProjectDifficulty(project);
  const bonus = bestSkill / 10; // 0-10
  // Success if d20 + bonus >= needed. Effective needed on die = needed - bonus (1-20).
  const dieNeeded = needed - bonus;
  if (dieNeeded <= 1) return 100;
  if (dieNeeded > 20) return 0;
  return Math.round(((21 - dieNeeded) / 20) * 100);
}

/** Attempt project execution (D20-style skill check on start). */
export function startProject(
  biz: OwnedBusiness,
  projectId: string,
  inflationMultiplier: number,
): { updatedBusiness: OwnedBusiness | null; cost: number; success: boolean; roll: number; needed: number } {
  const project: any = getProject(projectId);
  if (!project) return { updatedBusiness: null, cost: 0, success: false, roll: 0, needed: 0 };
  // ONE active project at a time
  const hasActive = (biz.activeProjects ?? []).some((p) => !p.resolved);
  if (hasActive) return { updatedBusiness: null, cost: 0, success: false, roll: 0, needed: 0 };
  // Accessible projects such as Local Marketing do not require a specialist.
  const hasRequiredRole = !project.requiredRoleId || (biz.employees ?? []).some((e) => e.roleId === project.requiredRoleId);
  if (!hasRequiredRole) return { updatedBusiness: null, cost: 0, success: false, roll: 0, needed: 0 };

  const levelScale = project.scalesWithLevel ? 1 + (biz.level ?? 0) * 0.75 : 1;
  const cost = Math.round((project.baseCost ?? 0) * levelScale * (inflationMultiplier ?? 1));
  // Skill check with best matching employee
  const eligible = project.requiredRoleId
    ? (biz.employees ?? []).filter((e) => e.roleId === project.requiredRoleId)
    : (biz.employees ?? []);
  const bestSkill = eligible.reduce((max, e) => Math.max(max, e.skill ?? 0), 0);
  const needed = getProjectDifficulty(project);
  const roll = Math.floor(Math.random() * 20) + 1; // 1-20
  const success = project.guaranteed === true || (roll + bestSkill / 10) >= needed;
  const reputationBonus = project.scalesWithLevel
    ? Math.min(project.maxReputationBonus ?? 4, (project.reputationBonus ?? 0) + (biz.level ?? 0) * 0.4)
    : (project.reputationBonus ?? 0);

  const newProject: ActiveBusinessProject = {
    id: `proj_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    projectType: project.id,
    projectName: project.name ?? project.id,
    requiredRoleId: project.requiredRoleId,
    cost,
    weeksRemaining: project.weeks ?? 4,
    totalWeeks: project.weeks ?? 4,
    revenueMultiplier: success ? (project.revenueMultiplier ?? 1) : 1,
    expenseMultiplier: success ? (project.expenseMultiplier ?? 1) : 1.02,
    reputationBonus: success ? reputationBonus : 0,
    succeeded: success,
    neededRoll: needed,
    actualRoll: roll,
    resolved: false,
  };

  return {
    updatedBusiness: {
      ...biz,
      activeProjects: [...(biz.activeProjects ?? []), newProject],
    },
    cost,
    success,
    roll,
    needed,
  };
}

/** Apply a morale action (payment from business balance) */
export function applyMoraleAction(biz: OwnedBusiness, actionId: string): { updatedBusiness: OwnedBusiness | null; cost: number } {
  const action: any = getMoraleAction(actionId);
  if (!action) return { updatedBusiness: null, cost: 0 };
  const numEmp = biz.employees?.length ?? 0;
  if (numEmp === 0) return { updatedBusiness: null, cost: 0 };
  const cost = Math.round((action.costPerEmployee ?? 0) * numEmp);
  const boost = action.moraleBoost ?? 10;
  const updated: OwnedBusiness = {
    ...biz,
    employees: (biz.employees ?? []).map((e) => ({
      ...e,
      morale: Math.min(100, (e.morale ?? 50) + boost),
    })),
  };
  return { updatedBusiness: updated, cost };
}

/** Start training for an employee */
export function startTraining(biz: OwnedBusiness, employeeId: string, trainingId: string, inflationMultiplier: number): { updatedBusiness: OwnedBusiness | null; cost: number } {
  const training: any = getTrainingOption(trainingId);
  if (!training) return { updatedBusiness: null, cost: 0 };
  const emp = (biz.employees ?? []).find((e) => e.id === employeeId);
  if (!emp) return { updatedBusiness: null, cost: 0 };
  if ((biz.employees ?? []).some((employee) => !!employee.inTrainingId)) return { updatedBusiness: null, cost: 0 };
  if (emp.inTrainingId) return { updatedBusiness: null, cost: 0 };
  if (training.requiresRole && !training.requiresRole.includes(emp.roleId)) return { updatedBusiness: null, cost: 0 };

  const cost = Math.round((training.cost ?? 0) * (inflationMultiplier ?? 1));
  const updated: OwnedBusiness = {
    ...biz,
    employees: (biz.employees ?? []).map((e) =>
      e.id === employeeId
        ? { ...e, inTrainingId: trainingId, trainingWeeksRemaining: training.weeks ?? 4 }
        : e
    ),
  };
  return { updatedBusiness: updated, cost };
}

/** Resolve a pending retention event with player choice */
export function resolveRetention(
  biz: OwnedBusiness,
  choice: 'accept' | 'match_salary' | 'increase_salary' | 'promote' | 'let_go' | 'training' | 'deny',
): { updatedBusiness: OwnedBusiness; costDelta: number; salaryDelta: number } {
  const ret = biz.pendingRetention;
  if (!ret) return { updatedBusiness: biz, costDelta: 0, salaryDelta: 0 };

  let updatedEmployees = biz.employees ?? [];
  let costDelta = 0;
  let salaryDelta = 0;

  const idx = updatedEmployees.findIndex((e) => e.id === ret.employeeId);
  if (idx < 0) return { updatedBusiness: { ...biz, pendingRetention: null }, costDelta: 0, salaryDelta: 0 };

  const emp = updatedEmployees[idx];

  if (ret.type === 'poach') {
    if (choice === 'match_salary') {
      const bump = Math.round(emp.weeklySalary * 0.15);
      updatedEmployees = updatedEmployees.map((e, i) => i === idx ? { ...e, weeklySalary: e.weeklySalary + bump, morale: Math.min(100, e.morale + 10) } : e);
      salaryDelta = bump;
    } else if (choice === 'increase_salary') {
      const bump = Math.round(emp.weeklySalary * 0.25);
      updatedEmployees = updatedEmployees.map((e, i) => i === idx ? { ...e, weeklySalary: e.weeklySalary + bump, morale: Math.min(100, e.morale + 20) } : e);
      salaryDelta = bump;
    } else if (choice === 'promote') {
      // Increase salary 20% and morale
      updatedEmployees = updatedEmployees.map((e, i) => i === idx ? { ...e, weeklySalary: Math.round(e.weeklySalary * 1.2), morale: Math.min(100, e.morale + 25) } : e);
      salaryDelta = Math.round(emp.weeklySalary * 0.2);
    } else if (choice === 'let_go') {
      updatedEmployees = updatedEmployees.filter((_, i) => i !== idx);
    }
  } else if (ret.type === 'raise') {
    if (choice === 'accept') {
      const bump = Math.round(emp.weeklySalary * 0.15);
      updatedEmployees = updatedEmployees.map((e, i) => i === idx ? { ...e, weeklySalary: e.weeklySalary + bump, morale: Math.min(100, e.morale + 15) } : e);
      salaryDelta = bump;
    } else if (choice === 'deny') {
      updatedEmployees = updatedEmployees.map((e, i) => i === idx ? { ...e, morale: Math.max(10, e.morale - 20) } : e);
    }
  } else if (ret.type === 'promotion') {
    if (choice === 'promote') {
      updatedEmployees = updatedEmployees.map((e, i) => i === idx ? { ...e, weeklySalary: Math.round(e.weeklySalary * 1.25), morale: Math.min(100, e.morale + 20) } : e);
      salaryDelta = Math.round(emp.weeklySalary * 0.25);
    } else if (choice === 'deny') {
      updatedEmployees = updatedEmployees.map((e, i) => i === idx ? { ...e, morale: Math.max(10, e.morale - 15) } : e);
    }
  } else if (ret.type === 'training') {
    if (choice === 'accept') {
      costDelta = 5000;
      updatedEmployees = updatedEmployees.map((e, i) => i === idx ? { ...e, skill: Math.min(e.potential ?? 100, Math.min(100, e.skill + 12)), morale: Math.min(100, e.morale + 10) } : e);
    } else if (choice === 'deny') {
      updatedEmployees = updatedEmployees.map((e, i) => i === idx ? { ...e, morale: Math.max(10, e.morale - 8) } : e);
    }
  }

  return {
    updatedBusiness: { ...biz, employees: updatedEmployees, pendingRetention: null },
    costDelta,
    salaryDelta,
  };
}

/** Compute market share for a business relative to procedural competitors */
export function computeMarketShare(biz: OwnedBusiness, competitorStrengths: number[]): { player: number; competitors: number[] } {
  const playerStrength = getBusinessMarketStrength(biz);
  const totalCompetitor = competitorStrengths.reduce((t, s) => t + s, 0);
  const total = playerStrength + totalCompetitor || 1;
  const basePlayer = (playerStrength / total) * 100;
  const player = Math.max(1, Math.min(95, basePlayer + (biz.marketShareModifier ?? 0)));
  const competitorPool = Math.max(0, 100 - player);
  return {
    player: Math.round(player * 10) / 10,
    competitors: competitorStrengths.map((s) => Math.round((totalCompetitor > 0 ? (s / totalCompetitor) * competitorPool : 0) * 10) / 10),
  };
}

export const BUSINESS_DELEGATION_POLICIES: Record<BusinessDelegationPolicy, {
  label: string;
  description: string;
  pricing: OwnedBusiness['pricingStrategy'];
  advertising: OwnedBusiness['advertisingLevel'];
  targetStaffRatio: number;
  reserveWeeks: number;
}> = {
  manual: {
    label: 'Manual',
    description: 'You control routine company settings and hiring.',
    pricing: 'standard',
    advertising: 'none',
    targetStaffRatio: 0,
    reserveWeeks: 0,
  },
  balanced: {
    label: 'Balanced',
    description: 'Maintain sensible staffing, standard pricing and moderate marketing.',
    pricing: 'standard',
    advertising: 'moderate',
    targetStaffRatio: 0.75,
    reserveWeeks: 8,
  },
  growth: {
    label: 'Growth',
    description: 'Prioritize staffing and demand generation while protecting a smaller reserve.',
    pricing: 'standard',
    advertising: 'aggressive',
    targetStaffRatio: 1,
    reserveWeeks: 6,
  },
  profit: {
    label: 'Profit',
    description: 'Favor margin, premium pricing and leaner staffing.',
    pricing: 'premium',
    advertising: 'basic',
    targetStaffRatio: 0.70,
    reserveWeeks: 10,
  },
  conservative: {
    label: 'Conservative',
    description: 'Protect cash with standard pricing, light marketing and modest staffing.',
    pricing: 'standard',
    advertising: 'none',
    targetStaffRatio: 0.60,
    reserveWeeks: 12,
  },
};

export function getDelegationManagers(biz: OwnedBusiness): BusinessEmployee[] {
  return (biz.employees ?? []).filter((employee) =>
    employee.roleId === 'manager' || employee.roleId === 'supervisor'
  );
}

export function applyDelegatedBusinessRoutine(
  biz: OwnedBusiness,
  inflationMultiplier: number,
  currentWeek: number,
  currentYear: number,
): OwnedBusiness {
  const policy = biz.delegationPolicy ?? 'manual';
  if (policy === 'manual') return biz;
  if (!biz.holdingCompanyId) {
    return {
      ...biz,
      delegationPolicy: 'manual',
      delegatedManagerEmployeeId: null,
      delegatedManagerName: null,
      lastDelegationSummary: 'Delegation ended because the company is no longer part of a holding group.',
    };
  }

  const manager = getDelegationManagers(biz).find((employee) => employee.id === biz.delegatedManagerEmployeeId);
  if (!manager) {
    return {
      ...biz,
      lastDelegationSummary: 'Delegation paused — appointed manager is unavailable.',
    };
  }

  if (biz.pendingDecision?.kind === 'crisis') {
    return {
      ...biz,
      lastDelegationSummary: 'Delegation paused while a crisis requires your decision.',
    };
  }

  const globalWeek = ((currentYear - 1) * 20) + currentWeek;
  const lastReview = biz.lastDelegationReviewWeek ?? 0;
  if (lastReview > 0 && globalWeek - lastReview < 4) return biz;

  const type = getBusinessType(biz.typeId);
  if (!type) return biz;
  const config = BUSINESS_DELEGATION_POLICIES[policy];
  const estimatedWeeklyCosts = Math.max(1, biz.lastWeekExpenses ?? type.baseWeeklyExpenses ?? 1);
  const protectedReserve = estimatedWeeklyCosts * config.reserveWeeks;
  let pricingStrategy = config.pricing;
  let advertisingLevel = config.advertising;
  const notes: string[] = [];

  if ((biz.balance ?? 0) < protectedReserve) {
    advertisingLevel = policy === 'growth' ? 'basic' : 'none';
    notes.push('protected cash reserves');
  } else {
    notes.push('reviewed pricing and marketing');
  }

  let employees = [...(biz.employees ?? [])];
  let freeRecruits = biz.freeRecruits ?? 3;
  let recruitCharges = biz.recruitCharges ?? 0;
  let balance = biz.balance ?? 0;
  const maxEmployees = type.maxEmployees ?? employees.length;
  const targetEmployees = Math.max(
    MIN_EMPLOYEES_REQUIRED,
    Math.min(maxEmployees, Math.ceil(maxEmployees * config.targetStaffRatio)),
  );

  if (employees.length < targetEmployees && employees.length < maxEmployees && !(biz.pendingCandidates?.length)) {
    const canUseRecruit = freeRecruits > 0 || (recruitCharges > 0 && balance >= 10_000);
    if (canUseRecruit) {
      const roleId = employees.length < MIN_EMPLOYEES_REQUIRED ? 'worker' : 'skilled_worker';
      const candidates = generateCandidates(roleId, employees.map((employee) => employee.name), inflationMultiplier);
      const candidate = policy === 'growth'
        ? [...candidates].sort((a, b) => (b.skill ?? 0) - (a.skill ?? 0))[0]
        : policy === 'conservative'
          ? [...candidates].sort((a, b) => (a.weeklySalary ?? 0) - (b.weeklySalary ?? 0))[0]
          : candidates[1] ?? candidates[0];
      if (candidate) {
        if (freeRecruits > 0) freeRecruits -= 1;
        else {
          recruitCharges -= 1;
          balance -= 10_000;
        }
        employees.push(candidateToEmployee(candidate));
        notes.push(`hired ${candidate.name}`);
      }
    }
  }

  return {
    ...biz,
    pricingStrategy,
    advertisingLevel,
    employees,
    freeRecruits,
    recruitCharges,
    balance,
    lastDelegationReviewWeek: globalWeek,
    lastDelegationSummary: notes.join(' • ') || 'Routine management review completed.',
    timeline: [
      ...(biz.timeline ?? []),
      {
        week: currentWeek,
        year: currentYear,
        title: `Management review: ${BUSINESS_DELEGATION_POLICIES[policy].label}`,
        icon: '🧑‍💼',
        kind: 'event' as const,
      },
    ].slice(-50),
  };
}

/** Process all businesses for one week. */
export function processAllBusinesses(
  businesses: OwnedBusiness[],
  inflationMultiplier: number,
  currentWeek: number,
  currentYear: number,
  modifiers: BusinessSimulationModifiers = {},
  holdingCompanies: HoldingCompany[] = [],
): {
  updatedBusinesses: OwnedBusiness[];
  totalProfit: number;
  totalDividend: number;
  ownershipDistributions: BusinessTickResult['ownershipDistributions'];
  totalTaxRefund: number;
  events: { businessName: string; eventTitle: string; icon: string }[];
  retentionEvents: { businessName: string; employeeName: string; type: string }[];
} {
  let totalProfit = 0;
  let totalDividend = 0;
  let totalTaxRefund = 0;
  const ownershipDistributions: BusinessTickResult['ownershipDistributions'] = [];
  const events: { businessName: string; eventTitle: string; icon: string }[] = [];
  const retentionEvents: { businessName: string; employeeName: string; type: string }[] = [];
  const updatedBusinesses: OwnedBusiness[] = [];
  const globalWeek = ((currentYear - 1) * 20) + currentWeek;
  let createdDecisionThisWeek = false;

  for (const biz of businesses ?? []) {
    const managedBiz = applyDelegatedBusinessRoutine(biz, inflationMultiplier, currentWeek, currentYear);
    const holdingSynergy = getHoldingSynergyProfile(managedBiz, businesses, holdingCompanies);
    const result = processBusinessWeek(managedBiz, inflationMultiplier, currentWeek, currentYear, {
      ...modifiers,
      holdingRevenueBonus: holdingSynergy.revenueBonus,
      holdingExpenseReduction: holdingSynergy.expenseReduction,
      holdingCrisisReduction: holdingSynergy.crisisReduction,
    });
    let updatedBusiness = result.updatedBusiness;

    const createdNewDecision = !managedBiz.pendingDecision && !!updatedBusiness.pendingDecision;
    if (createdNewDecision) {
      if (createdDecisionThisWeek) {
        const deferred = updatedBusiness.pendingDecision!;
        updatedBusiness = {
          ...updatedBusiness,
          pendingDecision: null,
          nextStrategicDecisionWeek: deferred.kind === 'strategy'
            ? globalWeek + 2
            : updatedBusiness.nextStrategicDecisionWeek,
          nextCrisisCheckWeek: deferred.kind === 'crisis'
            ? globalWeek + 2
            : updatedBusiness.nextCrisisCheckWeek,
        };
      } else {
        createdDecisionThisWeek = true;
      }
    }

    updatedBusinesses.push(updatedBusiness);
    totalProfit += result.weeklyProfit;
    totalDividend += result.playerDividend;
    ownershipDistributions.push(...result.ownershipDistributions);
    totalTaxRefund += result.taxRefund;
    if (result.newEvent) events.push(result.newEvent);
    if (result.newRetention) retentionEvents.push(result.newRetention);
  }

  return { updatedBusinesses, totalProfit, totalDividend, ownershipDistributions, totalTaxRefund, events, retentionEvents };
}

export function getTotalBusinessValue(businesses: OwnedBusiness[]): number {
  return (businesses ?? []).reduce((t, b) => t + (b.valuation ?? 0), 0);
}

export function getTotalBusinessLoanDebt(businesses: OwnedBusiness[]): number {
  return (businesses ?? []).reduce((total, biz) => {
    return total + (biz.businessLoans ?? []).reduce((t, l) => t + (l.remainingAmount ?? 0), 0);
  }, 0);
}
