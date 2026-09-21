import {
  BusinessExecutiveRole,
  BusinessPendingDecision,
  BusinessPendingDecisionChoice,
  CorporateCompensationPolicy,
  CorporateDepartmentId,
  CorporateDepartmentState,
  CorporateTrainingPolicy,
  CorporateWorkforceState,
  OwnedBusiness,
} from '../types/game';
import businessTypesData from '../data/business_types.json';

export const CORPORATE_WORKFORCE_UNLOCK_VALUATION = 25_000_000;

export const CORPORATE_COMPENSATION_POLICIES: Record<CorporateCompensationPolicy, {
  id: CorporateCompensationPolicy;
  label: string;
  description: string;
  wageMultiplier: number;
  moralePerWeek: number;
  turnoverMultiplier: number;
  hiringSpeedMultiplier: number;
  hiringSkillBonus: number;
}> = {
  lean: {
    id: 'lean',
    label: 'Lean Pay',
    description: 'Below-market compensation lowers payroll but increases turnover and slows hiring.',
    wageMultiplier: 0.92,
    moralePerWeek: -0.10,
    turnoverMultiplier: 1.45,
    hiringSpeedMultiplier: 0.75,
    hiringSkillBonus: -2,
  },
  market: {
    id: 'market',
    label: 'Market Pay',
    description: 'Pay broadly in line with the labor market.',
    wageMultiplier: 1.00,
    moralePerWeek: 0,
    turnoverMultiplier: 1.00,
    hiringSpeedMultiplier: 1.00,
    hiringSkillBonus: 0,
  },
  competitive: {
    id: 'competitive',
    label: 'Competitive',
    description: 'Above-market pay improves retention and makes open roles easier to fill.',
    wageMultiplier: 1.08,
    moralePerWeek: 0.05,
    turnoverMultiplier: 0.75,
    hiringSpeedMultiplier: 1.15,
    hiringSkillBonus: 2,
  },
  premium: {
    id: 'premium',
    label: 'Premium',
    description: 'Top-of-market compensation strongly supports retention, hiring and talent quality.',
    wageMultiplier: 1.15,
    moralePerWeek: 0.10,
    turnoverMultiplier: 0.55,
    hiringSpeedMultiplier: 1.30,
    hiringSkillBonus: 4,
  },
};

export const CORPORATE_TRAINING_POLICIES: Record<CorporateTrainingPolicy, {
  id: CorporateTrainingPolicy;
  label: string;
  description: string;
  payrollCostPct: number;
  skillGainPerWeek: number;
  moralePerWeek: number;
  turnoverMultiplier: number;
}> = {
  minimal: {
    id: 'minimal',
    label: 'Minimal',
    description: 'Mandatory training only. Cheapest, but skills and retention improve slowly.',
    payrollCostPct: 0,
    skillGainPerWeek: 0.01,
    moralePerWeek: -0.02,
    turnoverMultiplier: 1.10,
  },
  standard: {
    id: 'standard',
    label: 'Standard',
    description: 'Routine role training and professional development.',
    payrollCostPct: 0.008,
    skillGainPerWeek: 0.05,
    moralePerWeek: 0,
    turnoverMultiplier: 1.00,
  },
  development: {
    id: 'development',
    label: 'Development',
    description: 'Meaningful training investment that steadily improves capability and retention.',
    payrollCostPct: 0.018,
    skillGainPerWeek: 0.12,
    moralePerWeek: 0.05,
    turnoverMultiplier: 0.85,
  },
  academy: {
    id: 'academy',
    label: 'Internal Academy',
    description: 'Heavy talent investment for faster skill growth and stronger retention.',
    payrollCostPct: 0.035,
    skillGainPerWeek: 0.22,
    moralePerWeek: 0.10,
    turnoverMultiplier: 0.70,
  },
};

export const CORPORATE_DEPARTMENT_DEFINITIONS: Record<CorporateDepartmentId, {
  id: CorporateDepartmentId;
  name: string;
  icon: string;
  description: string;
  baseWeeklyWage: number;
  executiveRole: BusinessExecutiveRole | null;
}> = {
  operations: {
    id: 'operations',
    name: 'Operations',
    icon: '⚙️',
    description: 'Delivery, production and day-to-day operating capacity.',
    baseWeeklyWage: 850,
    executiveRole: 'coo',
  },
  sales: {
    id: 'sales',
    name: 'Sales',
    icon: '📈',
    description: 'Commercial growth, account management and customer acquisition.',
    baseWeeklyWage: 950,
    executiveRole: 'cmo',
  },
  finance: {
    id: 'finance',
    name: 'Finance',
    icon: '💶',
    description: 'Accounting, planning, treasury and financial control.',
    baseWeeklyWage: 1_050,
    executiveRole: 'cfo',
  },
  technology: {
    id: 'technology',
    name: 'Technology',
    icon: '💻',
    description: 'Systems, engineering, automation, data and cyber operations.',
    baseWeeklyWage: 1_350,
    executiveRole: 'cto',
  },
  support: {
    id: 'support',
    name: 'Support',
    icon: '🎧',
    description: 'Customer support, administration, compliance and shared services.',
    baseWeeklyWage: 800,
    executiveRole: 'general_counsel',
  },
};

const DEFAULT_MIX: Record<CorporateDepartmentId, number> = {
  operations: 0.40,
  sales: 0.20,
  finance: 0.12,
  technology: 0.16,
  support: 0.12,
};

const INDUSTRY_MIX: Record<string, Partial<Record<CorporateDepartmentId, number>>> = {
  Technology: { operations: 0.24, sales: 0.20, finance: 0.10, technology: 0.31, support: 0.15 },
  Services: { operations: 0.25, sales: 0.25, finance: 0.13, technology: 0.15, support: 0.22 },
  Retail: { operations: 0.46, sales: 0.22, finance: 0.10, technology: 0.10, support: 0.12 },
  'Food & Beverage': { operations: 0.52, sales: 0.15, finance: 0.10, technology: 0.08, support: 0.15 },
  Hospitality: { operations: 0.48, sales: 0.14, finance: 0.10, technology: 0.08, support: 0.20 },
  Manufacturing: { operations: 0.56, sales: 0.13, finance: 0.10, technology: 0.12, support: 0.09 },
  Construction: { operations: 0.58, sales: 0.12, finance: 0.10, technology: 0.08, support: 0.12 },
  Healthcare: { operations: 0.42, sales: 0.10, finance: 0.11, technology: 0.15, support: 0.22 },
  Automotive: { operations: 0.52, sales: 0.13, finance: 0.10, technology: 0.10, support: 0.15 },
  Fitness: { operations: 0.40, sales: 0.17, finance: 0.10, technology: 0.08, support: 0.25 },
  Beauty: { operations: 0.42, sales: 0.18, finance: 0.10, technology: 0.08, support: 0.22 },
  Entertainment: { operations: 0.34, sales: 0.22, finance: 0.10, technology: 0.16, support: 0.18 },
  'Real Estate': { operations: 0.30, sales: 0.30, finance: 0.15, technology: 0.10, support: 0.15 },
  Real_Estate: { operations: 0.30, sales: 0.30, finance: 0.15, technology: 0.10, support: 0.15 },
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function getBusinessType(typeId: string) {
  return (businessTypesData as any[]).find((type) => type?.id === typeId);
}

function normalizedMix(business: OwnedBusiness): Record<CorporateDepartmentId, number> {
  const industry = getBusinessType(business.typeId)?.industry ?? '';
  const raw = { ...DEFAULT_MIX, ...(INDUSTRY_MIX[industry] ?? {}) };
  const total = Object.values(raw).reduce((sum, value) => sum + value, 0) || 1;
  return {
    operations: raw.operations / total,
    sales: raw.sales / total,
    finance: raw.finance / total,
    technology: raw.technology / total,
    support: raw.support / total,
  };
}

export function getRecommendedCorporateHeadcount(business: OwnedBusiness): number {
  if ((business.valuation ?? 0) < CORPORATE_WORKFORCE_UNLOCK_VALUATION && !business.corporateWorkforce) return 0;
  const valuationMillions = Math.max(1, (business.valuation ?? 0) / 1_000_000);
  return Math.round(clamp(30 + Math.sqrt(valuationMillions) * 12, 60, 1_200));
}

export function getRecommendedDepartmentHeadcounts(
  business: OwnedBusiness,
): Record<CorporateDepartmentId, number> {
  const total = getRecommendedCorporateHeadcount(business);
  if (total <= 0) {
    return { operations: 0, sales: 0, finance: 0, technology: 0, support: 0 };
  }
  const mix = normalizedMix(business);
  const ids = Object.keys(CORPORATE_DEPARTMENT_DEFINITIONS) as CorporateDepartmentId[];
  const result = {} as Record<CorporateDepartmentId, number>;
  let allocated = 0;
  ids.forEach((id, index) => {
    const value = index === ids.length - 1
      ? Math.max(1, total - allocated)
      : Math.max(1, Math.round(total * mix[id]));
    result[id] = value;
    allocated += value;
  });
  return result;
}

export function getDepartmentWeeklyWage(
  departmentId: CorporateDepartmentId,
  inflationMultiplier = 1,
  compensationPolicy: CorporateCompensationPolicy = 'market',
): number {
  const base = CORPORATE_DEPARTMENT_DEFINITIONS[departmentId].baseWeeklyWage;
  const compensation = CORPORATE_COMPENSATION_POLICIES[compensationPolicy]
    ?? CORPORATE_COMPENSATION_POLICIES.market;
  return Math.round(
    base
    * Math.max(0.5, inflationMultiplier || 1)
    * compensation.wageMultiplier,
  );
}

function getExecutiveEfficiency(
  business: OwnedBusiness,
  departmentId: CorporateDepartmentId,
): number {
  const executiveRole = CORPORATE_DEPARTMENT_DEFINITIONS[departmentId].executiveRole;
  if (!executiveRole) return 0;
  const executive = (business.executives ?? []).find((item) => item.role === executiveRole);
  if (!executive) return 0;
  const quality = clamp(((executive.performance ?? 50) - 50) / 50, -0.4, 0.9);
  return clamp(quality * 0.10, -0.04, 0.09);
}

function makeDepartment(
  business: OwnedBusiness,
  id: CorporateDepartmentId,
  headcount: number,
  globalWeek: number,
  inflationMultiplier: number,
): CorporateDepartmentState {
  return {
    id,
    headcount,
    targetHeadcount: headcount,
    averageSkill: clamp(62 + (business.reputation ?? 50) * 0.12, 60, 78),
    morale: 72,
    weeklyWage: getDepartmentWeeklyWage(id, inflationMultiplier, 'market'),
    lastHeadcountChangeWeek: globalWeek,
    turnoverAccumulator: 0,
  };
}

export function createCorporateWorkforce(
  business: OwnedBusiness,
  globalWeek: number,
  inflationMultiplier = 1,
): CorporateWorkforceState | null {
  if ((business.valuation ?? 0) < CORPORATE_WORKFORCE_UNLOCK_VALUATION) return null;
  const recommended = getRecommendedDepartmentHeadcounts(business);
  return {
    initializedGlobalWeek: Math.max(1, globalWeek),
    departments: {
      operations: makeDepartment(business, 'operations', recommended.operations, globalWeek, inflationMultiplier),
      sales: makeDepartment(business, 'sales', recommended.sales, globalWeek, inflationMultiplier),
      finance: makeDepartment(business, 'finance', recommended.finance, globalWeek, inflationMultiplier),
      technology: makeDepartment(business, 'technology', recommended.technology, globalWeek, inflationMultiplier),
      support: makeDepartment(business, 'support', recommended.support, globalWeek, inflationMultiplier),
    },
    lastPlanWeek: Math.max(1, globalWeek),
    lastChangeSummary: 'Corporate departments established at recommended staffing.',
    compensationPolicy: 'market',
    trainingPolicy: 'standard',
    employeeRelations: 70,
    laborMarketPressure: 50,
    nextHrEventWeek: Math.max(1, globalWeek) + 12,
    lastHrEventWeek: 0,
    recentTurnover: 0,
    lastPolicyChangeWeek: 0,
  };
}

export function normalizeCorporateWorkforce(
  business: OwnedBusiness,
  workforce: CorporateWorkforceState | null | undefined,
  globalWeek: number,
  inflationMultiplier = 1,
): CorporateWorkforceState | null {
  const fallback = workforce ?? createCorporateWorkforce(business, globalWeek, inflationMultiplier);
  if (!fallback) return null;
  const recommended = getRecommendedDepartmentHeadcounts({ ...business, corporateWorkforce: fallback });
  const normalizedDepartments = {} as Record<CorporateDepartmentId, CorporateDepartmentState>;

  for (const id of Object.keys(CORPORATE_DEPARTMENT_DEFINITIONS) as CorporateDepartmentId[]) {
    const existing = fallback.departments?.[id];
    const defaultHeadcount = Math.max(1, recommended[id] || 1);
    normalizedDepartments[id] = {
      id,
      headcount: Math.max(1, Math.round(existing?.headcount ?? defaultHeadcount)),
      targetHeadcount: Math.max(1, Math.round(existing?.targetHeadcount ?? existing?.headcount ?? defaultHeadcount)),
      averageSkill: clamp(existing?.averageSkill ?? 68, 40, 95),
      morale: clamp(existing?.morale ?? 70, 35, 95),
      weeklyWage: getDepartmentWeeklyWage(
        id,
        inflationMultiplier,
        fallback.compensationPolicy ?? 'market',
      ),
      lastHeadcountChangeWeek: Math.max(1, existing?.lastHeadcountChangeWeek ?? globalWeek),
      turnoverAccumulator: Math.max(0, existing?.turnoverAccumulator ?? 0),
    };
  }

  return {
    initializedGlobalWeek: Math.max(1, fallback.initializedGlobalWeek ?? globalWeek),
    departments: normalizedDepartments,
    lastPlanWeek: Math.max(1, fallback.lastPlanWeek ?? globalWeek),
    lastChangeSummary: fallback.lastChangeSummary ?? null,
    compensationPolicy: fallback.compensationPolicy ?? 'market',
    trainingPolicy: fallback.trainingPolicy ?? 'standard',
    employeeRelations: clamp(fallback.employeeRelations ?? 70, 0, 100),
    laborMarketPressure: clamp(fallback.laborMarketPressure ?? 50, 20, 90),
    nextHrEventWeek: Math.max(1, fallback.nextHrEventWeek ?? (globalWeek + 12)),
    lastHrEventWeek: Math.max(0, fallback.lastHrEventWeek ?? 0),
    recentTurnover: Math.max(0, fallback.recentTurnover ?? 0),
    lastPolicyChangeWeek: Math.max(0, fallback.lastPolicyChangeWeek ?? 0),
  };
}

function departmentCapacityRatio(
  business: OwnedBusiness,
  workforce: CorporateWorkforceState,
  id: CorporateDepartmentId,
): number {
  const recommended = Math.max(1, getRecommendedDepartmentHeadcounts({ ...business, corporateWorkforce: workforce })[id]);
  const department = workforce.departments[id];
  const skillFactor = 1 + (department.averageSkill - 70) * 0.003;
  const moraleFactor = 1 + (department.morale - 70) * 0.002;
  const executiveFactor = 1 + getExecutiveEfficiency(business, id);
  return clamp((department.headcount / recommended) * skillFactor * moraleFactor * executiveFactor, 0.35, 1.60);
}

export function getCorporateWorkforceEffects(
  business: OwnedBusiness,
  workforce = business.corporateWorkforce ?? null,
) {
  if (!workforce) {
    return {
      revenueBonus: 0,
      expenseReduction: 0,
      crisisReduction: 0,
      reputationPerWeek: 0,
      staffingScore: 100,
      departmentRatios: {
        operations: 1,
        sales: 1,
        finance: 1,
        technology: 1,
        support: 1,
      } as Record<CorporateDepartmentId, number>,
    };
  }

  const departmentRatios = {} as Record<CorporateDepartmentId, number>;
  for (const id of Object.keys(CORPORATE_DEPARTMENT_DEFINITIONS) as CorporateDepartmentId[]) {
    departmentRatios[id] = departmentCapacityRatio(business, workforce, id);
  }

  const operationsDelta = departmentRatios.operations - 1;
  const salesDelta = departmentRatios.sales - 1;
  const financeDelta = departmentRatios.finance - 1;
  const technologyDelta = departmentRatios.technology - 1;
  const supportDelta = departmentRatios.support - 1;

  const revenueBonus = clamp(
    operationsDelta * 0.08
      + salesDelta * 0.07
      + technologyDelta * 0.025,
    -0.15,
    0.06,
  );
  const expenseReduction = clamp(financeDelta * 0.04, -0.05, 0.025);
  const relationsDelta = ((workforce.employeeRelations ?? 70) - 70) / 30;
  const crisisReduction = clamp(
    technologyDelta * 0.025 + supportDelta * 0.02 + relationsDelta * 0.006,
    -0.07,
    0.04,
  );
  const reputationPerWeek = clamp(
    supportDelta * 0.02 + salesDelta * 0.005 + relationsDelta * 0.004,
    -0.035,
    0.025,
  );
  const staffingScore = Math.round(clamp(
    Object.values(departmentRatios).reduce((sum, ratio) => sum + Math.min(1, ratio), 0) / 5 * 100,
    0,
    100,
  ));

  return {
    revenueBonus,
    expenseReduction,
    crisisReduction,
    reputationPerWeek,
    staffingScore,
    departmentRatios,
  };
}

export function getCorporateWorkforceWeeklyPayroll(
  workforce: CorporateWorkforceState | null | undefined,
): number {
  if (!workforce) return 0;
  return Math.round(
    (Object.keys(CORPORATE_DEPARTMENT_DEFINITIONS) as CorporateDepartmentId[])
      .reduce((sum, id) => {
        const department = workforce.departments[id];
        return sum + Math.max(0, department.headcount) * Math.max(0, department.weeklyWage);
      }, 0),
  );
}

export function tickCorporateWorkforce(
  business: OwnedBusiness,
  globalWeek: number,
  inflationMultiplier = 1,
): {
  workforce: CorporateWorkforceState | null;
  weeklyPayroll: number;
  trainingCost: number;
  transitionCost: number;
  turnoverCount: number;
  effects: ReturnType<typeof getCorporateWorkforceEffects>;
} {
  const workforce = normalizeCorporateWorkforce(
    business,
    business.corporateWorkforce,
    globalWeek,
    inflationMultiplier,
  );
  if (!workforce) {
    return {
      workforce: null,
      weeklyPayroll: 0,
      trainingCost: 0,
      transitionCost: 0,
      turnoverCount: 0,
      effects: getCorporateWorkforceEffects(business, null),
    };
  }

  const compensationPolicy = workforce.compensationPolicy ?? 'market';
  const trainingPolicy = workforce.trainingPolicy ?? 'standard';
  const compensation = CORPORATE_COMPENSATION_POLICIES[compensationPolicy];
  const training = CORPORATE_TRAINING_POLICIES[trainingPolicy];
  const laborMarketPressure = clamp(
    (workforce.laborMarketPressure ?? 50) + (Math.random() - 0.5) * 4,
    20,
    90,
  );
  const laborHiringMultiplier = clamp(1 - (laborMarketPressure - 50) * 0.008, 0.55, 1.20);
  const laborTurnoverMultiplier = clamp(1 + (laborMarketPressure - 50) * 0.012, 0.65, 1.55);
  const relations = clamp(workforce.employeeRelations ?? 70, 0, 100);
  const relationsTurnoverMultiplier = clamp(1 + (65 - relations) * 0.012, 0.65, 1.60);

  const recommended = getRecommendedDepartmentHeadcounts({ ...business, corporateWorkforce: workforce });
  const nextDepartments = {} as Record<CorporateDepartmentId, CorporateDepartmentState>;
  let transitionCost = 0;
  let turnoverCount = 0;
  let layoffsThisWeek = 0;
  let transitionCashAvailable = Math.max(
    0,
    (business.balance ?? 0) - Math.max(0, business.lastWeekExpenses ?? 0) * 3,
  );
  const changes: string[] = [];

  for (const id of Object.keys(CORPORATE_DEPARTMENT_DEFINITIONS) as CorporateDepartmentId[]) {
    const department = workforce.departments[id];
    const policyWage = getDepartmentWeeklyWage(id, inflationMultiplier, compensationPolicy);
    const difference = department.targetHeadcount - department.headcount;
    const rawMaxWeeklyChange = Math.max(
      2,
      Math.ceil(Math.max(department.headcount, department.targetHeadcount) * 0.06),
    );
    const maxWeeklyChange = difference > 0
      ? Math.max(1, Math.floor(rawMaxWeeklyChange * compensation.hiringSpeedMultiplier * laborHiringMultiplier))
      : rawMaxWeeklyChange;
    const desiredChange = difference === 0
      ? 0
      : Math.sign(difference) * Math.min(Math.abs(difference), maxWeeklyChange);
    const perPersonTransitionCost = desiredChange > 0
      ? policyWage * 2
      : desiredChange < 0
        ? policyWage * 1.5
        : 0;
    const affordableCount = perPersonTransitionCost > 0
      ? Math.floor(transitionCashAvailable / perPersonTransitionCost)
      : Math.abs(desiredChange);
    const plannedChange = desiredChange === 0
      ? 0
      : Math.sign(desiredChange) * Math.min(Math.abs(desiredChange), Math.max(0, affordableCount));
    let nextHeadcount = Math.max(1, department.headcount + plannedChange);

    if (plannedChange !== 0) {
      const cost = Math.round(Math.abs(plannedChange) * perPersonTransitionCost);
      transitionCost += cost;
      transitionCashAvailable = Math.max(0, transitionCashAvailable - cost);
      if (plannedChange < 0) layoffsThisWeek += Math.abs(plannedChange);
      changes.push(`${plannedChange > 0 ? '+' : ''}${plannedChange} ${CORPORATE_DEPARTMENT_DEFINITIONS[id].name}`);
    }

    const moraleTurnoverMultiplier = clamp(
      1 + (65 - department.morale) * 0.012,
      0.65,
      1.55,
    );
    const expectedTurnover = nextHeadcount
      * 0.003
      * compensation.turnoverMultiplier
      * training.turnoverMultiplier
      * laborTurnoverMultiplier
      * relationsTurnoverMultiplier
      * moraleTurnoverMultiplier;
    let turnoverAccumulator = Math.max(0, department.turnoverAccumulator ?? 0) + expectedTurnover;
    const maxTurnover = Math.max(1, Math.ceil(nextHeadcount * 0.03));
    const voluntaryTurnover = Math.min(
      Math.floor(turnoverAccumulator),
      maxTurnover,
      Math.max(0, nextHeadcount - 1),
    );
    turnoverAccumulator = Math.max(0, turnoverAccumulator - voluntaryTurnover);
    if (voluntaryTurnover > 0) {
      nextHeadcount = Math.max(1, nextHeadcount - voluntaryTurnover);
      turnoverCount += voluntaryTurnover;
      changes.push(`-${voluntaryTurnover} turnover in ${CORPORATE_DEPARTMENT_DEFINITIONS[id].name}`);
    }

    const hiringSkill = clamp(
      60
      + (business.reputation ?? 50) * 0.10
      + compensation.hiringSkillBonus
      - Math.max(0, laborMarketPressure - 60) * 0.08,
      55,
      78,
    );
    const hires = Math.max(0, plannedChange);
    const skillAfterHiring = hires > 0
      ? ((department.averageSkill * department.headcount) + (hiringSkill * hires)) / Math.max(1, department.headcount + hires)
      : department.averageSkill;
    const averageSkill = clamp(
      skillAfterHiring + training.skillGainPerWeek,
      45,
      95,
    );
    const staffingPressure = nextHeadcount < recommended[id] * 0.80 ? -0.20 : 0;
    const profitMorale = (business.lastWeekProfit ?? 0) >= 0 ? 0.10 : -0.30;
    const changeMorale = plannedChange < 0 ? -1.75 : plannedChange > 0 ? -0.15 : 0;
    const turnoverMorale = voluntaryTurnover > 0 ? -Math.min(1.5, voluntaryTurnover * 0.20) : 0;
    const morale = clamp(
      department.morale
      + staffingPressure
      + profitMorale
      + changeMorale
      + turnoverMorale
      + compensation.moralePerWeek
      + training.moralePerWeek,
      35,
      92,
    );

    nextDepartments[id] = {
      ...department,
      headcount: nextHeadcount,
      averageSkill,
      morale,
      weeklyWage: policyWage,
      lastHeadcountChangeWeek: plannedChange !== 0 ? globalWeek : department.lastHeadcountChangeWeek,
      turnoverAccumulator,
    };
  }

  const nextWorkforceBase: CorporateWorkforceState = {
    ...workforce,
    departments: nextDepartments,
    laborMarketPressure,
    recentTurnover: turnoverCount,
    lastChangeSummary: changes.length > 0 ? changes.join(' • ') : 'No department headcount changes this week.',
  };
  const weeklyPayroll = getCorporateWorkforceWeeklyPayroll(nextWorkforceBase);
  const trainingCost = Math.round(weeklyPayroll * training.payrollCostPct);
  const relationsRecovery = layoffsThisWeek === 0 && turnoverCount === 0 ? 0.12 : 0;
  const relationsChange = relationsRecovery
    + compensation.moralePerWeek * 0.8
    + training.moralePerWeek * 0.8
    - Math.min(8, layoffsThisWeek * 0.35)
    - Math.min(4, turnoverCount * 0.12);
  const nextWorkforce: CorporateWorkforceState = {
    ...nextWorkforceBase,
    employeeRelations: clamp(relations + relationsChange, 0, 100),
  };
  const workforceBusiness = { ...business, corporateWorkforce: nextWorkforce };

  return {
    workforce: nextWorkforce,
    weeklyPayroll,
    trainingCost,
    transitionCost,
    turnoverCount,
    effects: getCorporateWorkforceEffects(workforceBusiness, nextWorkforce),
  };
}

export function setCorporateDepartmentTarget(
  business: OwnedBusiness,
  departmentId: CorporateDepartmentId,
  targetHeadcount: number,
  globalWeek: number,
  inflationMultiplier = 1,
): CorporateWorkforceState | null {
  const workforce = normalizeCorporateWorkforce(
    business,
    business.corporateWorkforce,
    globalWeek,
    inflationMultiplier,
  );
  if (!workforce) return null;
  const recommended = Math.max(1, getRecommendedDepartmentHeadcounts({ ...business, corporateWorkforce: workforce })[departmentId]);
  const minimum = Math.max(1, Math.floor(recommended * 0.40));
  const maximum = Math.max(minimum, Math.ceil(recommended * 1.60));
  const nextTarget = Math.round(clamp(targetHeadcount, minimum, maximum));

  return {
    ...workforce,
    lastPlanWeek: Math.max(1, globalWeek),
    lastChangeSummary: `${CORPORATE_DEPARTMENT_DEFINITIONS[departmentId].name} target set to ${nextTarget}.`,
    departments: {
      ...workforce.departments,
      [departmentId]: {
        ...workforce.departments[departmentId],
        targetHeadcount: nextTarget,
      },
    },
  };
}

export function getCorporateHrPolicyCooldownWeeks(
  business: OwnedBusiness,
  globalWeek: number,
): number {
  const lastChange = business.corporateWorkforce?.lastPolicyChangeWeek ?? 0;
  if (lastChange <= 0) return 0;
  return Math.max(0, 6 - (Math.max(1, globalWeek) - lastChange));
}

export function setCorporateHrPolicy(
  business: OwnedBusiness,
  policyType: 'compensation' | 'training',
  policy: CorporateCompensationPolicy | CorporateTrainingPolicy,
  globalWeek: number,
  inflationMultiplier = 1,
  force = false,
): CorporateWorkforceState | null {
  const workforce = normalizeCorporateWorkforce(
    business,
    business.corporateWorkforce,
    globalWeek,
    inflationMultiplier,
  );
  if (!workforce) return null;
  if (!force && getCorporateHrPolicyCooldownWeeks({ ...business, corporateWorkforce: workforce }, globalWeek) > 0) {
    return null;
  }

  const next = {
    ...workforce,
    lastPolicyChangeWeek: Math.max(1, globalWeek),
    lastChangeSummary: policyType === 'compensation'
      ? `Compensation policy changed to ${CORPORATE_COMPENSATION_POLICIES[policy as CorporateCompensationPolicy].label}.`
      : `Training policy changed to ${CORPORATE_TRAINING_POLICIES[policy as CorporateTrainingPolicy].label}.`,
  };
  if (policyType === 'compensation') {
    next.compensationPolicy = policy as CorporateCompensationPolicy;
    for (const id of Object.keys(next.departments) as CorporateDepartmentId[]) {
      next.departments[id] = {
        ...next.departments[id],
        weeklyWage: getDepartmentWeeklyWage(
          id,
          inflationMultiplier,
          policy as CorporateCompensationPolicy,
        ),
      };
    }
  } else {
    next.trainingPolicy = policy as CorporateTrainingPolicy;
  }
  return next;
}

export function scheduleNextCorporateHrEvent(
  workforce: CorporateWorkforceState,
  globalWeek: number,
): CorporateWorkforceState {
  return {
    ...workforce,
    lastHrEventWeek: Math.max(1, globalWeek),
    nextHrEventWeek: Math.max(1, globalWeek) + 10 + Math.floor(Math.random() * 7),
  };
}

export function applyCorporateHrDecisionChoice(
  business: OwnedBusiness,
  workforce: CorporateWorkforceState,
  choice: BusinessPendingDecisionChoice,
  globalWeek: number,
  inflationMultiplier = 1,
): CorporateWorkforceState {
  let next: CorporateWorkforceState = {
    ...workforce,
    departments: Object.fromEntries(
      (Object.keys(workforce.departments) as CorporateDepartmentId[])
        .map((id) => [id, { ...workforce.departments[id] }]),
    ) as Record<CorporateDepartmentId, CorporateDepartmentState>,
  };

  if (choice.workforceCompensationPolicy) {
    next = setCorporateHrPolicy(
      { ...business, corporateWorkforce: next },
      'compensation',
      choice.workforceCompensationPolicy,
      globalWeek,
      inflationMultiplier,
      true,
    ) ?? next;
  }
  if (choice.workforceTrainingPolicy) {
    next = setCorporateHrPolicy(
      { ...business, corporateWorkforce: next },
      'training',
      choice.workforceTrainingPolicy,
      globalWeek,
      inflationMultiplier,
      true,
    ) ?? next;
  }
  if (choice.workforceRelationsDelta) {
    next.employeeRelations = clamp(
      (next.employeeRelations ?? 70) + choice.workforceRelationsDelta,
      0,
      100,
    );
  }
  if (choice.workforceTargetMultiplier && choice.workforceTargetMultiplier > 0) {
    const multiplier = clamp(choice.workforceTargetMultiplier, 0.70, 1.30);
    for (const id of Object.keys(CORPORATE_DEPARTMENT_DEFINITIONS) as CorporateDepartmentId[]) {
      const updated = setCorporateDepartmentTarget(
        { ...business, corporateWorkforce: next },
        id,
        Math.round(next.departments[id].targetHeadcount * multiplier),
        globalWeek,
        inflationMultiplier,
      );
      if (updated) next = updated;
    }
  }

  next = {
    ...scheduleNextCorporateHrEvent(next, globalWeek),
    lastChangeSummary: `HR decision: ${choice.text}.`,
  };
  return next;
}

function totalWorkforceHeadcount(workforce: CorporateWorkforceState): number {
  return (Object.keys(CORPORATE_DEPARTMENT_DEFINITIONS) as CorporateDepartmentId[])
    .reduce((sum, id) => sum + Math.max(0, workforce.departments[id].headcount), 0);
}

export function makeCorporateHrDecision(
  business: OwnedBusiness,
  globalWeek: number,
): BusinessPendingDecision | null {
  const workforce = business.corporateWorkforce;
  if (!workforce) return null;
  const payroll = getCorporateWorkforceWeeklyPayroll(workforce);
  const totalHeadcount = totalWorkforceHeadcount(workforce);
  const effects = getCorporateWorkforceEffects(business, workforce);
  const averageSkill = (Object.keys(CORPORATE_DEPARTMENT_DEFINITIONS) as CorporateDepartmentId[])
    .reduce((sum, id) => sum + workforce.departments[id].averageSkill, 0) / 5;
  const candidates: BusinessPendingDecision[] = [];

  if ((workforce.laborMarketPressure ?? 50) >= 58) {
    candidates.push({
      id: `hr_wage_pressure_${business.id}_${globalWeek}`,
      kind: 'strategy',
      title: 'Wage Pressure',
      description: `The labor market has tightened around ${business.name}. Recruiters and employees are pushing compensation upward.`,
      icon: '💶',
      createdGlobalWeek: globalWeek,
      deadlineGlobalWeek: globalWeek + 4,
      defaultChoiceId: 'hold_pay',
      choices: [
        {
          id: 'raise_market',
          text: 'Move to Competitive Pay',
          description: 'Pay above market to improve retention and hiring power.',
          workforceCompensationPolicy: 'competitive',
          workforceRelationsDelta: 6,
          reputationDelta: 1,
          durationWeeks: 1,
        },
        {
          id: 'develop_people',
          text: 'Invest in Development',
          description: 'Keep base pay near market and improve careers through training.',
          workforceTrainingPolicy: 'development',
          workforceRelationsDelta: 4,
          durationWeeks: 1,
        },
        {
          id: 'hold_pay',
          text: 'Hold the Pay Line',
          description: 'Protect payroll but accept weaker relations and retention pressure.',
          workforceRelationsDelta: -8,
          revenueMultiplier: 0.98,
          durationWeeks: 4,
        },
      ],
    });
  }

  if (effects.staffingScore < 88 || (workforce.laborMarketPressure ?? 50) >= 68) {
    candidates.push({
      id: `hr_talent_shortage_${business.id}_${globalWeek}`,
      kind: 'strategy',
      title: 'Talent Shortage',
      description: `${business.name} is struggling to fill enough roles at the pace management wants.`,
      icon: '🔎',
      createdGlobalWeek: globalWeek,
      deadlineGlobalWeek: globalWeek + 4,
      defaultChoiceId: 'slow_hiring',
      choices: [
        {
          id: 'premium_recruiting',
          text: 'Pay for Scarce Talent',
          description: 'Use premium compensation to improve hiring speed and quality.',
          workforceCompensationPolicy: 'premium',
          workforceRelationsDelta: 4,
          durationWeeks: 1,
        },
        {
          id: 'academy',
          text: 'Build Internal Talent',
          description: 'Invest heavily in internal development rather than chasing the market.',
          workforceTrainingPolicy: 'academy',
          workforceRelationsDelta: 5,
          durationWeeks: 1,
        },
        {
          id: 'slow_hiring',
          text: 'Accept Slower Hiring',
          description: 'Avoid a cost escalation and let vacancies close gradually.',
          workforceRelationsDelta: -2,
          durationWeeks: 1,
        },
      ],
    });
  }

  if (totalHeadcount >= 200) {
    candidates.push({
      id: `hr_employee_council_${business.id}_${globalWeek}`,
      kind: 'strategy',
      title: 'Employee Council Negotiation',
      description: `Workforce representatives at ${business.name} want a formal response on pay, development and restructuring safeguards.`,
      icon: '🤝',
      createdGlobalWeek: globalWeek,
      deadlineGlobalWeek: globalWeek + 4,
      defaultChoiceId: 'minimal_concessions',
      choices: [
        {
          id: 'pay_framework',
          text: 'Agree a Pay Framework',
          description: 'Commit to competitive compensation and improve workforce relations.',
          workforceCompensationPolicy: 'competitive',
          workforceRelationsDelta: 10,
          reputationDelta: 1,
          durationWeeks: 1,
        },
        {
          id: 'skills_agreement',
          text: 'Training & Mobility Deal',
          description: 'Expand development and retraining instead of a broad pay commitment.',
          businessCashCost: Math.round(payroll * 1.5),
          cashCostScale: 'absolute',
          workforceTrainingPolicy: 'development',
          workforceRelationsDelta: 8,
          durationWeeks: 1,
        },
        {
          id: 'minimal_concessions',
          text: 'Reject Most Demands',
          description: 'Protect near-term costs but risk morale, reputation and disruption.',
          workforceRelationsDelta: -15,
          revenueMultiplier: 0.96,
          reputationDelta: -2,
          durationWeeks: 6,
        },
      ],
    });
  }

  if ((business.lastWeekProfit ?? 0) < 0 || Object.values(effects.departmentRatios).some((ratio) => ratio > 1.22)) {
    candidates.push({
      id: `hr_restructure_${business.id}_${globalWeek}`,
      kind: 'strategy',
      title: 'Restructuring Review',
      description: `Management is questioning whether ${business.name}'s current staffing plan still fits the business.`,
      icon: '✂️',
      createdGlobalWeek: globalWeek,
      deadlineGlobalWeek: globalWeek + 4,
      defaultChoiceId: 'hold_structure',
      choices: [
        {
          id: 'targeted_restructure',
          text: 'Targeted Restructuring',
          description: 'Reduce department targets by roughly 10%. Layoffs execute gradually with severance.',
          workforceTargetMultiplier: 0.90,
          workforceRelationsDelta: -12,
          reputationDelta: -1,
          durationWeeks: 1,
        },
        {
          id: 'retrain_redeploy',
          text: 'Retrain & Redeploy',
          description: 'Spend more to improve skills and avoid most structural cuts.',
          businessCashCost: Math.round(payroll * 2),
          cashCostScale: 'absolute',
          workforceTrainingPolicy: 'academy',
          workforceRelationsDelta: 6,
          durationWeeks: 1,
        },
        {
          id: 'hold_structure',
          text: 'Hold Current Structure',
          description: 'Avoid disruption and keep the current staffing plan.',
          workforceRelationsDelta: 1,
          durationWeeks: 1,
        },
      ],
    });
  }

  if (averageSkill < 67) {
    candidates.push({
      id: `hr_skills_gap_${business.id}_${globalWeek}`,
      kind: 'strategy',
      title: 'Capability Gap',
      description: `Department leaders report that employee skills are starting to lag behind ${business.name}'s operating complexity.`,
      icon: '🎓',
      createdGlobalWeek: globalWeek,
      deadlineGlobalWeek: globalWeek + 4,
      defaultChoiceId: 'standard_training',
      choices: [
        {
          id: 'academy_program',
          text: 'Launch Internal Academy',
          description: 'Commit to the highest training investment and accelerate skill growth.',
          workforceTrainingPolicy: 'academy',
          workforceRelationsDelta: 5,
          durationWeeks: 1,
        },
        {
          id: 'development_program',
          text: 'Expand Development',
          description: 'Increase ongoing training without the full academy cost.',
          workforceTrainingPolicy: 'development',
          workforceRelationsDelta: 3,
          durationWeeks: 1,
        },
        {
          id: 'standard_training',
          text: 'Keep Standard Training',
          description: 'Avoid a larger training budget and improve skills gradually.',
          workforceTrainingPolicy: 'standard',
          durationWeeks: 1,
        },
      ],
    });
  }

  if (candidates.length === 0) {
    candidates.push({
      id: `hr_retention_review_${business.id}_${globalWeek}`,
      kind: 'strategy',
      title: 'Retention Review',
      description: `HR is reviewing whether ${business.name}'s employee proposition remains competitive as the organization grows.`,
      icon: '👥',
      createdGlobalWeek: globalWeek,
      deadlineGlobalWeek: globalWeek + 4,
      defaultChoiceId: 'stay_market',
      choices: [
        {
          id: 'competitive_package',
          text: 'Strengthen Compensation',
          description: 'Move to competitive pay and improve retention.',
          workforceCompensationPolicy: 'competitive',
          workforceRelationsDelta: 5,
          durationWeeks: 1,
        },
        {
          id: 'development_focus',
          text: 'Strengthen Development',
          description: 'Keep pay at market and invest more in careers.',
          workforceTrainingPolicy: 'development',
          workforceRelationsDelta: 4,
          durationWeeks: 1,
        },
        {
          id: 'stay_market',
          text: 'Stay the Course',
          description: 'Keep current people policies unchanged.',
          durationWeeks: 1,
        },
      ],
    });
  }

  return candidates[Math.floor(Math.random() * candidates.length)];
}

export function getCorporateWorkforceAttentionReason(business: OwnedBusiness): string | null {
  if ((business.valuation ?? 0) >= CORPORATE_WORKFORCE_UNLOCK_VALUATION && !business.corporateWorkforce) {
    return 'Corporate workforce structure has not been established.';
  }
  if (!business.corporateWorkforce) return null;
  const effects = getCorporateWorkforceEffects(business, business.corporateWorkforce);
  if (effects.staffingScore < 78) return `Corporate departments are only ${effects.staffingScore}% staffed for current scale.`;
  if ((business.corporateWorkforce.employeeRelations ?? 70) < 45) {
    return 'Employee relations are deteriorating.';
  }
  const totalHeadcount = totalWorkforceHeadcount(business.corporateWorkforce);
  if ((business.corporateWorkforce.recentTurnover ?? 0) >= Math.max(3, Math.ceil(totalHeadcount * 0.015))) {
    return `High employee turnover: ${business.corporateWorkforce.recentTurnover} departures this week.`;
  }
  const lowMorale = (Object.keys(CORPORATE_DEPARTMENT_DEFINITIONS) as CorporateDepartmentId[])
    .find((id) => business.corporateWorkforce!.departments[id].morale < 50);
  if (lowMorale) return `${CORPORATE_DEPARTMENT_DEFINITIONS[lowMorale].name} department morale is low.`;
  return null;
}
