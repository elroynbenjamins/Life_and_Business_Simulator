import {
  BusinessBoardGovernance,
  BusinessBoardMandate,
  BusinessExecutive,
  BusinessExecutiveCandidate,
  BusinessExecutiveRole,
  BusinessExecutiveSearch,
  BusinessExecutiveTrait,
  OwnedBusiness,
} from '../types/game';

export const BOARD_GOVERNANCE_UNLOCK_VALUATION = 25_000_000;

export const BUSINESS_EXECUTIVE_ROLES: Record<BusinessExecutiveRole, {
  role: BusinessExecutiveRole;
  label: string;
  shortLabel: string;
  description: string;
  minValuation: number;
  minReputation: number;
  salaryMultiplier: number;
  traits: [BusinessExecutiveTrait, BusinessExecutiveTrait];
}> = {
  cfo: {
    role: 'cfo',
    label: 'Chief Financial Officer',
    shortLabel: 'CFO',
    description: 'Capital structure, budgeting, treasury and financing discipline.',
    minValuation: 10_000_000,
    minReputation: 55,
    salaryMultiplier: 1.05,
    traits: ['capital_allocator', 'conservative_financier'],
  },
  coo: {
    role: 'coo',
    label: 'Chief Operating Officer',
    shortLabel: 'COO',
    description: 'Operating efficiency, capacity, premises and equipment discipline.',
    minValuation: 10_000_000,
    minReputation: 55,
    salaryMultiplier: 1.05,
    traits: ['scale_operator', 'efficiency_expert'],
  },
  cto: {
    role: 'cto',
    label: 'Chief Technology Officer',
    shortLabel: 'CTO/CIO',
    description: 'Technology modernization, systems resilience and cyber preparedness.',
    minValuation: 25_000_000,
    minReputation: 60,
    salaryMultiplier: 1.10,
    traits: ['technologist', 'cyber_specialist'],
  },
  cmo: {
    role: 'cmo',
    label: 'Chief Marketing Officer',
    shortLabel: 'CMO',
    description: 'Brand, customer acquisition, commercial growth and reputation.',
    minValuation: 25_000_000,
    minReputation: 60,
    salaryMultiplier: 1.00,
    traits: ['brand_builder', 'growth_marketer'],
  },
  general_counsel: {
    role: 'general_counsel',
    label: 'General Counsel',
    shortLabel: 'GC',
    description: 'Regulatory, contractual and liability-risk oversight.',
    minValuation: 50_000_000,
    minReputation: 65,
    salaryMultiplier: 0.95,
    traits: ['regulatory_specialist', 'negotiator'],
  },
};

export const BUSINESS_BOARD_MANDATES: Record<BusinessBoardMandate, {
  mandate: BusinessBoardMandate;
  label: string;
  description: string;
}> = {
  founder_led: {
    mandate: 'founder_led',
    label: 'Founder-led',
    description: 'Maximum owner discretion with light board intervention.',
  },
  balanced_oversight: {
    mandate: 'balanced_oversight',
    label: 'Balanced Oversight',
    description: 'Moderate financial and operating oversight without a strong strategic bias.',
  },
  growth_mandate: {
    mandate: 'growth_mandate',
    label: 'Growth Mandate',
    description: 'Push commercial growth while accepting higher cost and operating risk.',
  },
  risk_committee: {
    mandate: 'risk_committee',
    label: 'Risk Committee',
    description: 'Prioritize controls, resilience, insurance and regulatory discipline.',
  },
};

const EXECUTIVE_NAMES = [
  'Adrian Cole', 'Mara Voss', 'Theo Mercer', 'Lena Hart', 'Jonas Reed',
  'Nora Bell', 'Darius Klein', 'Priya Shah', 'Milan Vos', 'Sofia Grant',
  'Hugo Price', 'Elise Warren', 'Noah Smit', 'Amara Brooks', 'Lucas Stone',
  'Eva Vermeer', 'Max Fischer', 'Isla Moore', 'Ruben Hayes', 'Maya Chen',
];

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function executiveQuality(performance: number): number {
  return clamp(((performance ?? 50) - 50) / 50, -0.4, 0.9);
}

function traitBonus(trait: BusinessExecutiveTrait) {
  switch (trait) {
    case 'capital_allocator': return { financing: 0.0015, expense: 0.001 };
    case 'conservative_financier': return { financing: 0.002, crisis: 0.003 };
    case 'scale_operator': return { expense: 0.002, equipmentWear: 0.025 };
    case 'efficiency_expert': return { expense: 0.003, premisesWear: 0.02 };
    case 'technologist': return { revenue: 0.0015, technologyWear: 0.04 };
    case 'cyber_specialist': return { cyberPremium: 0.025, crisis: 0.004 };
    case 'brand_builder': return { revenue: 0.002, reputation: 0.004 };
    case 'growth_marketer': return { revenue: 0.003 };
    case 'regulatory_specialist': return { liabilityPremium: 0.03, crisis: 0.004 };
    case 'negotiator': return { expense: 0.0015, liabilityPremium: 0.02 };
    default: return {};
  }
}

export function getExecutiveRoleEligibility(
  business: OwnedBusiness,
  role: BusinessExecutiveRole,
): { allowed: boolean; reason: string | null } {
  const definition = BUSINESS_EXECUTIVE_ROLES[role];
  if ((business.executives ?? []).some((executive) => executive.role === role)) {
    return { allowed: false, reason: `${definition.shortLabel} position is already filled.` };
  }
  if ((business.valuation ?? 0) < definition.minValuation) {
    return { allowed: false, reason: `Requires €${Math.round(definition.minValuation / 1_000_000)}M company value.` };
  }
  if ((business.reputation ?? 0) < definition.minReputation) {
    return { allowed: false, reason: `Requires ${definition.minReputation} reputation.` };
  }
  return { allowed: true, reason: null };
}

function baseExecutiveSalary(business: OwnedBusiness, role: BusinessExecutiveRole): number {
  const definition = BUSINESS_EXECUTIVE_ROLES[role];
  const valuationMillions = Math.max(1, (business.valuation ?? 0) / 1_000_000);
  const scaleSalary = 1_800 + Math.sqrt(valuationMillions) * 650;
  return scaleSalary * definition.salaryMultiplier;
}

export function generateExecutiveSearch(
  business: OwnedBusiness,
  role: BusinessExecutiveRole,
  globalWeek: number,
): BusinessExecutiveSearch | null {
  if (!getExecutiveRoleEligibility(business, role).allowed) return null;
  const definition = BUSINESS_EXECUTIVE_ROLES[role];
  const usedNames = new Set((business.executives ?? []).map((executive) => executive.name));
  const candidates: BusinessExecutiveCandidate[] = [];

  for (let index = 0; index < 3; index += 1) {
    const availableNames = EXECUTIVE_NAMES.filter((name) => !usedNames.has(name));
    const name = availableNames[Math.floor(Math.random() * Math.max(1, availableNames.length))]
      ?? `Executive ${index + 1}`;
    usedNames.add(name);
    const performance = Math.round(clamp(58 + Math.random() * 32 + index * 1.5, 55, 94));
    const trait = definition.traits[Math.floor(Math.random() * definition.traits.length)];
    const performancePremium = 0.82 + performance / 220;
    const weeklySalary = Math.round(baseExecutiveSalary(business, role) * performancePremium);
    candidates.push({
      id: `exec_candidate_${business.id}_${role}_${globalWeek}_${index}`,
      role,
      name,
      performance,
      weeklySalary,
      signingFee: Math.round(weeklySalary * 8),
      trait,
    });
  }

  return {
    role,
    candidates,
    generatedGlobalWeek: globalWeek,
  };
}

export function hireExecutiveCandidate(
  candidate: BusinessExecutiveCandidate,
  globalWeek: number,
): BusinessExecutive {
  return {
    ...candidate,
    appointedGlobalWeek: globalWeek,
    tenureWeeks: 0,
    nextReviewGlobalWeek: globalWeek + 20,
  };
}

export function createDefaultBoardGovernance(
  year: number,
  mandate: BusinessBoardMandate = 'founder_led',
): BusinessBoardGovernance {
  return {
    mandate,
    confidence: 60,
    establishedYear: Math.max(1, year),
    lastReviewYear: Math.max(1, year),
    lastReviewSummary: 'Board established. First annual review is pending.',
  };
}

export function getBusinessGovernanceEffects(business: OwnedBusiness) {
  let revenueBonus = 0;
  let expenseReduction = 0;
  let crisisReduction = 0;
  let financingRateReduction = 0;
  let technologyWearReduction = 0;
  let premisesWearReduction = 0;
  let equipmentWearReduction = 0;
  let cyberPremiumReduction = 0;
  let liabilityPremiumReduction = 0;
  let reputationPerWeek = 0;

  for (const executive of business.executives ?? []) {
    const quality = executiveQuality(executive.performance);
    if (executive.role === 'cfo') {
      financingRateReduction += Math.max(0, quality * 0.010);
      expenseReduction += quality * 0.004;
    } else if (executive.role === 'coo') {
      expenseReduction += quality * 0.015;
      premisesWearReduction += Math.max(0, quality * 0.10);
      equipmentWearReduction += Math.max(0, quality * 0.15);
    } else if (executive.role === 'cto') {
      revenueBonus += quality * 0.006;
      technologyWearReduction += Math.max(0, quality * 0.20);
      cyberPremiumReduction += Math.max(0, quality * 0.10);
      crisisReduction += Math.max(0, quality * 0.008);
    } else if (executive.role === 'cmo') {
      revenueBonus += quality * 0.020;
      reputationPerWeek += quality * 0.020;
    } else if (executive.role === 'general_counsel') {
      crisisReduction += Math.max(0, quality * 0.020);
      liabilityPremiumReduction += Math.max(0, quality * 0.12);
    }

    const bonus = traitBonus(executive.trait) as any;
    revenueBonus += bonus.revenue ?? 0;
    expenseReduction += bonus.expense ?? 0;
    crisisReduction += bonus.crisis ?? 0;
    financingRateReduction += bonus.financing ?? 0;
    technologyWearReduction += bonus.technologyWear ?? 0;
    premisesWearReduction += bonus.premisesWear ?? 0;
    equipmentWearReduction += bonus.equipmentWear ?? 0;
    cyberPremiumReduction += bonus.cyberPremium ?? 0;
    liabilityPremiumReduction += bonus.liabilityPremium ?? 0;
    reputationPerWeek += bonus.reputation ?? 0;
  }

  let boardWeeklyCost = 0;
  const board = business.boardGovernance;
  if (board && (business.valuation ?? 0) >= BOARD_GOVERNANCE_UNLOCK_VALUATION) {
    const confidenceMultiplier = 0.8 + clamp(board.confidence ?? 50, 0, 100) / 250;
    boardWeeklyCost = Math.round(clamp((business.valuation ?? 0) * 0.00004, 2_500, 75_000));
    if (board.mandate === 'founder_led') {
      revenueBonus += 0.003 * confidenceMultiplier;
    } else if (board.mandate === 'balanced_oversight') {
      revenueBonus += 0.005 * confidenceMultiplier;
      expenseReduction += 0.005 * confidenceMultiplier;
      crisisReduction += 0.010 * confidenceMultiplier;
    } else if (board.mandate === 'growth_mandate') {
      revenueBonus += 0.015 * confidenceMultiplier;
      expenseReduction -= 0.005;
      crisisReduction -= 0.005;
    } else if (board.mandate === 'risk_committee') {
      expenseReduction -= 0.003;
      crisisReduction += 0.030 * confidenceMultiplier;
      cyberPremiumReduction += 0.05;
      liabilityPremiumReduction += 0.05;
    }
  }

  return {
    revenueBonus: clamp(revenueBonus, -0.02, 0.05),
    expenseReduction: clamp(expenseReduction, -0.02, 0.05),
    crisisReduction: clamp(crisisReduction, -0.01, 0.08),
    financingRateReduction: clamp(financingRateReduction, 0, 0.0125),
    technologyWearReduction: clamp(technologyWearReduction, 0, 0.30),
    premisesWearReduction: clamp(premisesWearReduction, 0, 0.20),
    equipmentWearReduction: clamp(equipmentWearReduction, 0, 0.25),
    cyberPremiumReduction: clamp(cyberPremiumReduction, 0, 0.20),
    liabilityPremiumReduction: clamp(liabilityPremiumReduction, 0, 0.20),
    reputationPerWeek: clamp(reputationPerWeek, -0.03, 0.05),
    executiveWeeklySalary: Math.round((business.executives ?? []).reduce(
      (sum, executive) => sum + Math.max(0, executive.weeklySalary ?? 0),
      0,
    )),
    boardWeeklyCost,
  };
}

function averageInfrastructureCondition(business: OwnedBusiness): number {
  const state = business.reinvestment;
  if (!state) return 100;
  return (
    (state.technology?.condition ?? 100)
    + (state.premises?.condition ?? 100)
    + (state.equipment?.condition ?? 100)
  ) / 3;
}

export function tickBusinessGovernance(
  business: OwnedBusiness,
  currentRevenue: number,
  currentProfit: number,
  currentWeek: number,
  currentYear: number,
): {
  executives: BusinessExecutive[];
  boardGovernance: BusinessBoardGovernance | null;
  timelineEntries: Array<{ week: number; year: number; title: string; icon: string; kind: 'event' }>;
} {
  const globalWeek = ((currentYear - 1) * 20) + currentWeek;
  const debt = (business.businessLoans ?? []).reduce((sum, loan) => sum + Math.max(0, loan.remainingAmount ?? 0), 0);
  const debtToValue = debt / Math.max(1, business.valuation ?? 1);
  const policies = business.insurancePolicies ?? {};
  const budgetReviewed = (business.budgetPlan?.reviewYear ?? business.foundedYear ?? currentYear) >= currentYear;
  const timelineEntries: Array<{ week: number; year: number; title: string; icon: string; kind: 'event' }> = [];
  const executives: BusinessExecutive[] = [];

  for (const executive of business.executives ?? []) {
    let delta = currentProfit > 0 ? 0.08 : -0.20;
    if (executive.role === 'cfo') {
      delta += debtToValue <= 0.35 ? 0.08 : debtToValue > 0.50 ? -0.16 : 0;
      delta += budgetReviewed ? 0.05 : -0.10;
    } else if (executive.role === 'coo') {
      const condition = averageInfrastructureCondition(business);
      delta += condition >= 75 ? 0.07 : condition < 55 ? -0.14 : 0;
    } else if (executive.role === 'cto') {
      const tech = business.reinvestment?.technology?.condition ?? 100;
      delta += tech >= 75 ? 0.08 : tech < 55 ? -0.16 : 0;
    } else if (executive.role === 'cmo') {
      delta += currentRevenue >= (business.lastWeekRevenue ?? 0) ? 0.08 : -0.07;
    } else if (executive.role === 'general_counsel') {
      delta += policies.liability && policies.liability !== 'none' ? 0.05 : -0.08;
      delta += policies.cyber && policies.cyber !== 'none' ? 0.03 : -0.04;
    }

    const updated: BusinessExecutive = {
      ...executive,
      performance: clamp((executive.performance ?? 50) + delta, 20, 98),
      tenureWeeks: (executive.tenureWeeks ?? 0) + 1,
    };

    if (globalWeek >= (executive.nextReviewGlobalWeek ?? globalWeek + 20)) {
      const boardConfidence = business.boardGovernance?.confidence ?? 60;
      const turnoverChance = clamp(
        0.03
        + (updated.performance < 45 ? 0.08 : 0)
        + (updated.performance > 86 ? 0.025 : 0)
        + (boardConfidence < 35 ? 0.05 : 0),
        0.02,
        0.18,
      );
      if (Math.random() < turnoverChance) {
        timelineEntries.push({
          week: currentWeek,
          year: currentYear,
          title: `🚪 ${updated.name} left the ${BUSINESS_EXECUTIVE_ROLES[updated.role].shortLabel} role`,
          icon: '🚪',
          kind: 'event',
        });
        continue;
      }
      updated.nextReviewGlobalWeek = globalWeek + 20;
    }
    executives.push(updated);
  }

  let boardGovernance = business.boardGovernance ? { ...business.boardGovernance } : null;
  if (boardGovernance && currentYear > (boardGovernance.lastReviewYear ?? currentYear)) {
    let confidenceChange = currentProfit > 0 ? 4 : -6;
    confidenceChange += budgetReviewed ? 4 : -4;
    confidenceChange += debtToValue < 0.35 ? 2 : debtToValue > 0.50 ? -4 : 0;
    const condition = averageInfrastructureCondition(business);
    confidenceChange += condition >= 70 ? 2 : condition < 50 ? -4 : 0;
    const requiredRoles = (Object.keys(BUSINESS_EXECUTIVE_ROLES) as BusinessExecutiveRole[])
      .filter((role) => (business.valuation ?? 0) >= BUSINESS_EXECUTIVE_ROLES[role].minValuation);
    const vacancies = requiredRoles.filter((role) => !executives.some((executive) => executive.role === role)).length;
    confidenceChange -= vacancies * 2;
    const nextConfidence = clamp((boardGovernance.confidence ?? 60) + confidenceChange, 10, 100);
    boardGovernance = {
      ...boardGovernance,
      confidence: nextConfidence,
      lastReviewYear: currentYear,
      lastReviewSummary: `Annual review: ${currentProfit > 0 ? 'profitable' : 'loss-making'} year • debt/value ${Math.round(debtToValue * 100)}% • ${vacancies} executive ${vacancies === 1 ? 'vacancy' : 'vacancies'}.`,
    };
    timelineEntries.push({
      week: currentWeek,
      year: currentYear,
      title: `📋 Board annual review completed • Confidence ${Math.round(nextConfidence)}`,
      icon: '📋',
      kind: 'event',
    });
  }

  return { executives, boardGovernance, timelineEntries };
}
