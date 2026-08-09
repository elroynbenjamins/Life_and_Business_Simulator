import { OwnedBusiness, BusinessEmployee, ActiveBusinessEvent, BusinessLoan, EmployeeCandidate, ActiveBusinessProject, BusinessExpenseBreakdown, EmployeeTier, EmployeeBuff, BusinessTimelineEntry, TriggeredEvent } from '../types/game';

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
import choiceEventsData from '../data/business_choice_events.json';

export const MIN_EMPLOYEES_REQUIRED = 3;

// --- Constants ---
const PRICING_MULTIPLIERS: Record<string, { revenue: number; demand: number; reputation: number }> = {
  budget: { revenue: 0.8, demand: 1.2, reputation: -0.02 },
  standard: { revenue: 1.0, demand: 1.0, reputation: 0 },
  premium: { revenue: 1.3, demand: 0.85, reputation: 0.01 },
  luxury: { revenue: 1.6, demand: 0.65, reputation: 0.02 },
};

const ADVERTISING_COSTS: Record<string, { weeklyCost: number; demandBoost: number; reputationBoost: number }> = {
  none: { weeklyCost: 0, demandBoost: 0, reputationBoost: 0 },
  basic: { weeklyCost: 500, demandBoost: 0.10, reputationBoost: 0.3 },
  moderate: { weeklyCost: 1000, demandBoost: 0.22, reputationBoost: 0.6 },
  aggressive: { weeklyCost: 1500, demandBoost: 0.36, reputationBoost: 1.0 },
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
  return (businessUpgradesData ?? []).find((u) => u?.id === upgradeId);
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

export function getAllMoraleActions() { return moraleActionsData as any[]; }
export function getAllTraining() { return trainingData as any[]; }
export function getAllProjects() { return projectsData as any[]; }

/** Business meets minimum staffing? */
export function meetsMinStaffing(biz: OwnedBusiness): boolean {
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
  let score = empRatio * 40 + upgradeRatio * 30 + (hasManager ? 20 : 0) + (biz.level >= 3 ? 10 : 0);
  return Math.min(100, Math.round(score));
}

export function calculateValuation(biz: OwnedBusiness): number {
  const reputation = Math.max(0, Math.min(100, biz.reputation ?? 0));
  const revenueMultiple = 7 + (reputation / 100) * 8;
  const revenueValue = Math.max(0, biz.lastWeekRevenue ?? 0) * revenueMultiple;
  return Math.max(0, Math.round(revenueValue + Math.max(0, biz.balance ?? 0)));
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
    autoPilot: false,
    employees: [],
    purchasedUpgrades: [],
    businessLoans: [],
    activeEvents: [],
    weeklyProfitHistory: [],
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
  };
}

export interface BusinessTickResult {
  updatedBusiness: OwnedBusiness;
  weeklyRevenue: number;
  weeklyExpenses: number;
  weeklyProfit: number;
  playerDividend: number;
  taxRefund: number;
  newEvent: { businessName: string; eventTitle: string; icon: string } | null;
  newRetention: { businessName: string; employeeName: string; type: string } | null;
}

/**
 * Process a single business for one week.
 */
export function processBusinessWeek(
  biz: OwnedBusiness,
  inflationMultiplier: number,
  currentWeek: number,
  currentYear: number,
): BusinessTickResult {
  const type = getBusinessType(biz.typeId);
  if (!type) {
    return { updatedBusiness: biz, weeklyRevenue: 0, weeklyExpenses: 0, weeklyProfit: 0, playerDividend: 0, taxRefund: 0, newEvent: null, newRetention: null };
  }

  // Minimum staffing check - business earns NOTHING if under staffed
  if (!meetsMinStaffing(biz)) {
    return {
      updatedBusiness: { ...biz, lastWeekRevenue: 0, lastWeekExpenses: 0, lastWeekProfit: 0, lastExpenseBreakdown: null },
      weeklyRevenue: 0,
      weeklyExpenses: 0,
      weeklyProfit: 0,
      playerDividend: 0,
      taxRefund: 0,
      newEvent: null,
      newRetention: null,
    };
  }

  const pricingMod = PRICING_MULTIPLIERS[biz.pricingStrategy ?? 'standard'] ?? PRICING_MULTIPLIERS.standard;
  const adMod = ADVERTISING_COSTS[biz.advertisingLevel ?? 'none'] ?? ADVERTISING_COSTS.none;
  const reputationFactor = 0.6 + (biz.reputation / 100) * 0.8; // 0.6 at 0 rep, 1.4 at 100 rep
  const competitionPenalty = 1 - (type.competitionLevel ?? 0.5) * 0.15;

  // ---- Seasons: every 5 weeks = new season; industry-specific multipliers ----
  const globalWeek = ((currentYear - 1) * 20) + currentWeek;
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
  // Larger random fluctuation ±15%
  const revenueFluctuation = 0.85 + Math.random() * 0.30;
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
  const productivityMultiplier = Math.max(0.4, 0.4 + totalProductivity * 0.14) * buffAgg.productivityMult;

  const upgradeRevenueBoost = [...new Set(biz.purchasedUpgrades ?? [])].reduce((t, uid) => {
    const u = getUpgrade(uid);
    return t + (u?.revenueBoost ?? 0);
  }, 0);

  // Active event & project multipliers
  let eventRevenueMultiplier = 1;
  let eventExpenseMultiplier = 1;
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

  // Revenue (rebalanced +10% base)
  const baseRev = (type.baseWeeklyRevenue ?? 0) * inflationMultiplier * 1.1;
  const levelBonus = 1 + biz.level * 0.1;
  const revenue = Math.round(
    baseRev * demand * pricingMod.revenue * productivityMultiplier *
    (1 + upgradeRevenueBoost) * levelBonus * eventRevenueMultiplier * buffAgg.revenueMult
  );

  // Expenses (detailed breakdown) — variable costs SCALE with actual revenue.
  const baseExp = (type.baseWeeklyExpenses ?? 0) * inflationMultiplier;
  // Revenue scaling factor: if revenue is 5x the expected base, variable costs go up ~4x
  const revScale = baseRev > 0 ? revenue / baseRev : 1;
  // Variable-cost scaling: 60% fixed baseline + 40% × revScale (dampened)
  const variableScale = 0.6 + 0.4 * Math.min(6, revScale);
  // Rent scales with revenue: base rent + 2% of revenue above baseline
  const baseRent = (type.baseWeeklyRent ?? 0) * inflationMultiplier;
  const rentScale = revenue > baseRev ? baseRent + (revenue - baseRev) * 0.02 : baseRent;
  const rent = Math.round(rentScale);
  const salaries = Math.round((biz.employees ?? []).reduce((t, e) => t + (e.weeklySalary ?? 0), 0));
  const adCost = Math.round((adMod.weeklyCost ?? 0) * inflationMultiplier);
  // COGS is highly variable — scales strongly with revenue (11% of revenue floor)
  const cogs = Math.round(Math.max(baseExp * 0.45, revenue * 0.11) * eventExpenseMultiplier * buffAgg.expenseMult);
  // Utilities/maintenance/misc scale moderately, insurance is mostly fixed
  const utilities = Math.round(baseExp * 0.15 * variableScale * eventExpenseMultiplier * buffAgg.expenseMult);
  const insurance = Math.round(baseExp * 0.10 * (0.8 + 0.2 * variableScale) * eventExpenseMultiplier * buffAgg.expenseMult);
  const maintenance = Math.round(baseExp * 0.15 * variableScale * eventExpenseMultiplier * buffAgg.expenseMult);
  const misc = Math.round(baseExp * 0.15 * variableScale * eventExpenseMultiplier * buffAgg.expenseMult);

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

  const expensesBeforeTax = rent + salaries + adCost + cogs + utilities + insurance + maintenance + misc;
  const preTaxProfit = revenue - (expensesBeforeTax + loanInterest);
  // Corporate tax: 20% of positive weekly profit
  const businessTax = preTaxProfit > 0 ? Math.round(preTaxProfit * 0.20) : 0;
  const totalExpenses = expensesBeforeTax + loanInterest + businessTax;
  const profit = revenue - totalExpenses;

  const expenseBreakdown: BusinessExpenseBreakdown = {
    rent, salaries, cogs, utilities,
    marketing: adCost,
    insurance, maintenance, taxes: businessTax,
    loanInterest, misc,
  };

  // Tick down active events
  let newActiveEvents = (biz.activeEvents ?? []).filter((ae) => (ae.weeksRemaining ?? 0) > 1)
    .map((ae) => ({ ...ae, weeksRemaining: (ae.weeksRemaining ?? 1) - 1 }));

  // Bad seasonal event injection: fires on the first week of a season
  const seasonStart = (globalWeek - 1) % 5 === 0;
  const timelineAdds: BusinessTimelineEntry[] = [];
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

  // Morale incident: a single 10% roll, only for teams averaging at least 55 morale.
  let newEvent: { businessName: string; eventTitle: string; icon: string } | null = null;
  let eventRepChange = 0;
  let moraleDrop = 0;
  const averageMorale = (biz.employees?.length ?? 0) > 0
    ? (biz.employees ?? []).reduce((total, employee) => total + (employee.morale ?? 50), 0) / (biz.employees?.length ?? 1)
    : 0;
  if (averageMorale >= 55 && Math.random() < 0.10) {
    const moraleEvent: any = (moraleEventsData as any[])[Math.floor(Math.random() * (moraleEventsData as any[]).length)];
    if (moraleEvent) {
      moraleDrop = Math.min(20, Math.max(1, moraleEvent.moraleDecrease ?? 1));
      newEvent = { businessName: biz.name, eventTitle: moraleEvent.title, icon: moraleEvent.icon };
    }
  }

  const eligibleEvents = (businessEventsData ?? []).filter((ev: any) => {
    if ((ev.minReputation ?? 0) > (biz.reputation ?? 0)) return false;
    const industries = ev.industries ?? [];
    if (industries.includes('all') || industries.includes(type.industry)) return true;
    return false;
  });

  for (const ev of newEvent ? [] : eligibleEvents) {
    if (Math.random() < ((ev as any).chance ?? 0)) {
      if (newActiveEvents.some((ae) => ae.eventId === (ev as any).id)) continue;

      newEvent = { businessName: biz.name, eventTitle: (ev as any).title, icon: (ev as any).icon };
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
  const repGrowth = (type.reputationGrowthRate ?? 0.5) * (profit > 0 ? 0.3 : -0.15);
  const adRepBoost = adMod.reputationBoost ?? 0;
  const pricingRepEffect = pricingMod.reputation ?? 0;
  const projectRepBoost = updatedProjects.filter(p => p.resolved && p.succeeded).reduce((t, p) => t + p.reputationBonus, 0);
  let newReputation = (biz.reputation ?? 25) + repGrowth + adRepBoost + pricingRepEffect + eventRepChange + projectRepBoost + buffAgg.weeklyRepBoost;
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
      morale: Math.max(10, Math.min(100, (emp.morale ?? 50) + moraleChange + buffAgg.weeklyMoraleBoost - moraleDrop)),
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
  const thresholds = type.levelThresholds ?? [0];
  let valuation = calculateValuation({
    ...biz,
    reputation: newReputation,
    lastWeekRevenue: revenue,
    lastWeekProfit: profit,
    employees: updatedEmployees,
  });
  let newLevel = 0;
  for (let i = thresholds.length - 1; i >= 0; i--) {
    if (valuation >= thresholds[i]) { newLevel = i; break; }
  }

  // Balance & dividend
  let newBalance = (biz.balance ?? 0) + profit + extraCashDelta;
  let playerDividend = 0;
  if (newBalance > 0 && profit > 0) {
    const dividendRate = biz.autoPilot ? 0.5 : 0.7;
    playerDividend = Math.round(Math.max(0, profit * dividendRate));
    newBalance -= playerDividend;
  }
  valuation = calculateValuation({
    ...biz,
    balance: newBalance,
    reputation: newReputation,
    lastWeekRevenue: revenue,
    lastWeekProfit: profit,
    employees: updatedEmployees,
  });
  newLevel = 0;
  for (let i = thresholds.length - 1; i >= 0; i--) {
    if (valuation >= thresholds[i]) { newLevel = i; break; }
  }

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
      }
      timelineAdds.push({ week: currentWeek, year: currentYear, title: `Upgrade completed: ${activeUpgrade.upgradeId}`, icon: '🔧', kind: 'upgrade' as any });
      activeUpgrade = null;
    }
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
  const timeline = [...(biz.timeline ?? []), ...timelineAdds].slice(-50);

  const updatedBusiness: OwnedBusiness = {
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
    employees: updatedEmployees,
    businessLoans: updatedLoans,
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
    purchasedUpgrades: [...new Set([
      ...(biz.purchasedUpgrades ?? []),
      ...(completedUpgradeId ? [completedUpgradeId] : []),
    ])],
  };

  return {
    updatedBusiness,
    weeklyRevenue: revenue,
    weeklyExpenses: totalExpenses,
    weeklyProfit: profit,
    playerDividend,
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
  // Check required role
  const hasRequiredRole = (biz.employees ?? []).some((e) => e.roleId === project.requiredRoleId);
  if (!hasRequiredRole) return { updatedBusiness: null, cost: 0, success: false, roll: 0, needed: 0 };

  const cost = Math.round((project.baseCost ?? 0) * (inflationMultiplier ?? 1));
  // Skill check with best matching employee
  const eligible = (biz.employees ?? []).filter((e) => e.roleId === project.requiredRoleId);
  const bestSkill = eligible.reduce((max, e) => Math.max(max, e.skill ?? 0), 0);
  const needed = getProjectDifficulty(project);
  const roll = Math.floor(Math.random() * 20) + 1; // 1-20
  const success = (roll + bestSkill / 10) >= needed;

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
    reputationBonus: success ? (project.reputationBonus ?? 0) : 0,
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

function rollBusinessChoiceEvent(businesses: OwnedBusiness[]): TriggeredEvent | null {
  if ((businesses?.length ?? 0) === 0 || Math.random() >= 0.08) return null;
  const biz = businesses[Math.floor(Math.random() * businesses.length)];
  const template: any = (choiceEventsData as any[])[Math.floor(Math.random() * (choiceEventsData as any[]).length)];
  if (!biz || !template) return null;
  return {
    ...template,
    id: `${template.id}_${biz.id}`,
    businessId: biz.id,
    description: String(template.description ?? '').replace('{business}', biz.name),
  } as TriggeredEvent;
}

/** Process all businesses for one week. */
export function processAllBusinesses(
  businesses: OwnedBusiness[],
  inflationMultiplier: number,
  currentWeek: number,
  currentYear: number,
): {
  updatedBusinesses: OwnedBusiness[];
  totalProfit: number;
  totalDividend: number;
  totalTaxRefund: number;
  events: { businessName: string; eventTitle: string; icon: string }[];
  retentionEvents: { businessName: string; employeeName: string; type: string }[];
  decisionEvent: TriggeredEvent | null;
} {
  let totalProfit = 0;
  let totalDividend = 0;
  let totalTaxRefund = 0;
  const events: { businessName: string; eventTitle: string; icon: string }[] = [];
  const retentionEvents: { businessName: string; employeeName: string; type: string }[] = [];
  const updatedBusinesses: OwnedBusiness[] = [];

  for (const biz of businesses ?? []) {
    const result = processBusinessWeek(biz, inflationMultiplier, currentWeek, currentYear);
    updatedBusinesses.push(result.updatedBusiness);
    totalProfit += result.weeklyProfit;
    totalDividend += result.playerDividend;
    totalTaxRefund += result.taxRefund;
    if (result.newEvent) events.push(result.newEvent);
    if (result.newRetention) retentionEvents.push(result.newRetention);
  }

  return { updatedBusinesses, totalProfit, totalDividend, totalTaxRefund, events, retentionEvents, decisionEvent: rollBusinessChoiceEvent(updatedBusinesses) };
}

export function getTotalBusinessValue(businesses: OwnedBusiness[]): number {
  return (businesses ?? []).reduce((t, b) => t + (b.valuation ?? 0), 0);
}

export function getTotalBusinessLoanDebt(businesses: OwnedBusiness[]): number {
  return (businesses ?? []).reduce((total, biz) => {
    return total + (biz.businessLoans ?? []).reduce((t, l) => t + (l.remainingAmount ?? 0), 0);
  }, 0);
}
