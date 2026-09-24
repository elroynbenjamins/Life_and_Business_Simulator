import {
  AcquisitionCompanyTrait,
  AcquisitionDiligenceFinding,
  AcquisitionFundingMode,
  AcquisitionIntegrationStrategy,
  AcquisitionRisk,
  AcquisitionTier,
  BusinessAcquisitionTarget,
  EconomicCyclePhase,
  GameState,
  HoldingCompany,
  OwnedBusiness,
} from '../types/game';
import businessTypesData from '../data/business_types.json';
import { aggregateEmployeeBuffs, candidateToEmployee, createBusiness, generateCandidates, getAllBusinessLocationTemplates, getBusinessType, getBusinessRevenueCapacity, getScaledLocationCosts } from './businessEngine';
import { createCorporateWorkforce } from './businessWorkforceEngine';
import { getAcquisitionCycleValueMultiplier } from './economyEngine';

export const ACQUISITION_UNLOCK_NET_WORTH = 10_000_000;
export const ACQUISITION_MARKET_REFRESH_WEEKS = 6;
export const HOLDING_COMPANY_SETUP_COST = 500_000;
export const ACQUISITION_TARGET_COUNT = 6;

export interface AcquisitionFinancingQuote {
  mode: AcquisitionFundingMode;
  purchasePrice: number;
  cashContribution: number;
  debtPrincipal: number;
  interestRate: number;
  durationWeeks: number;
  totalRepayment: number;
  weeklyPayment: number;
  leveragePct: number;
}

const COMPANY_PREFIXES = [
  'Northstar', 'Atlas', 'Summit', 'Crown', 'Meridian', 'Sterling',
  'Redwood', 'Vanguard', 'Orion', 'Keystone', 'Harbor', 'Apex',
];
const COMPANY_SUFFIXES = ['Group', 'Partners', 'Industries', 'Works', 'Collective', 'Enterprises'];
const SELLERS = [
  'Founder-led sale', 'Private shareholders', 'Family owners',
  'Growth fund exit', 'Management consortium', 'Strategic divestment',
];

const SELLER_REASONS = [
  { label: 'Founder retirement', premiumMin: 1.11, premiumMax: 1.21 },
  { label: 'Family succession transition', premiumMin: 1.12, premiumMax: 1.23 },
  { label: 'Private equity fund exit', premiumMin: 1.18, premiumMax: 1.30 },
  { label: 'Strategic portfolio divestment', premiumMin: 1.13, premiumMax: 1.25 },
  { label: 'Owners reallocating capital', premiumMin: 1.12, premiumMax: 1.22 },
  { label: 'Performance and liquidity pressure', premiumMin: 1.10, premiumMax: 1.18 },
] as const;

const STRENGTH_TRAITS: AcquisitionCompanyTrait[] = [
  {
    id: 'strong_brand',
    name: 'Strong Brand',
    kind: 'strength',
    description: 'Established customer recognition supports pricing power and repeat demand.',
    revenueModifier: 0.025,
    expenseModifier: 0,
  },
  {
    id: 'efficient_operations',
    name: 'Efficient Operations',
    kind: 'strength',
    description: 'Mature processes keep operating costs below comparable companies.',
    revenueModifier: 0,
    expenseModifier: -0.03,
  },
  {
    id: 'loyal_customers',
    name: 'Loyal Customers',
    kind: 'strength',
    description: 'A sticky customer base provides a modest recurring revenue advantage.',
    revenueModifier: 0.02,
    expenseModifier: 0,
  },
  {
    id: 'experienced_management',
    name: 'Experienced Management',
    kind: 'strength',
    description: 'A seasoned leadership team improves execution and operating discipline.',
    revenueModifier: 0.01,
    expenseModifier: -0.01,
  },
  {
    id: 'premium_customer_base',
    name: 'Premium Customer Base',
    kind: 'strength',
    description: 'Higher-value customers lift revenue, though servicing them is slightly more expensive.',
    revenueModifier: 0.03,
    expenseModifier: 0.01,
  },
];

const RISK_TRAITS: AcquisitionCompanyTrait[] = [
  {
    id: 'legacy_systems',
    name: 'Legacy Systems',
    kind: 'risk',
    description: 'Older systems create friction and modestly raise ongoing operating costs.',
    revenueModifier: -0.005,
    expenseModifier: 0.03,
  },
  {
    id: 'customer_concentration',
    name: 'Customer Concentration',
    kind: 'risk',
    description: 'A few major customers account for too much revenue, reducing resilience.',
    revenueModifier: -0.02,
    expenseModifier: 0,
  },
  {
    id: 'high_staff_turnover',
    name: 'High Staff Turnover',
    kind: 'risk',
    description: 'Recruitment and onboarding churn increase costs and weaken execution.',
    revenueModifier: -0.01,
    expenseModifier: 0.025,
  },
  {
    id: 'deferred_maintenance',
    name: 'Deferred Maintenance',
    kind: 'risk',
    description: 'Past underinvestment leaves a higher ongoing maintenance burden.',
    revenueModifier: -0.005,
    expenseModifier: 0.035,
  },
  {
    id: 'founder_dependency',
    name: 'Founder Dependence',
    kind: 'risk',
    description: 'Important customer and operating relationships still depend heavily on the seller.',
    revenueModifier: -0.025,
    expenseModifier: 0,
  },
  {
    id: 'margin_pressure',
    name: 'Margin Pressure',
    kind: 'risk',
    description: 'Competitive pricing pressure reduces revenue quality and pushes costs higher.',
    revenueModifier: -0.015,
    expenseModifier: 0.015,
  },
];

const TARGET_BANDS: Array<{ tier: AcquisitionTier; min: number; max: number }> = [
  { tier: 'regional', min: 7_500_000, max: 18_000_000 },
  { tier: 'regional', min: 10_000_000, max: 24_000_000 },
  { tier: 'national', min: 25_000_000, max: 55_000_000 },
  { tier: 'national', min: 40_000_000, max: 85_000_000 },
  { tier: 'enterprise', min: 80_000_000, max: 140_000_000 },
  { tier: 'enterprise', min: 120_000_000, max: 220_000_000 },
];

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function randomBetween(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function riskFromDiligence(score: number): AcquisitionRisk {
  if (score >= 80) return 'low';
  if (score >= 64) return 'medium';
  return 'high';
}

function integrationWeeksForRisk(risk: AcquisitionRisk): number {
  return risk === 'low' ? 6 : risk === 'medium' ? 10 : 14;
}

function integrationPenaltyForRisk(risk: AcquisitionRisk): number {
  return risk === 'low' ? 0.05 : risk === 'medium' ? 0.10 : 0.16;
}

function acquisitionCompanyAgeYears(tier: AcquisitionTier): number {
  if (tier === 'enterprise') return Math.round(randomBetween(14, 45));
  if (tier === 'national') return Math.round(randomBetween(9, 30));
  return Math.round(randomBetween(5, 18));
}

function pickTrait(pool: AcquisitionCompanyTrait[], excludedIds = new Set<string>()): AcquisitionCompanyTrait {
  const eligible = pool.filter((trait) => !excludedIds.has(trait.id));
  return eligible[Math.floor(Math.random() * Math.max(1, eligible.length))] ?? pool[0];
}

function acquisitionTraitsForRisk(risk: AcquisitionRisk): AcquisitionCompanyTrait[] {
  const selected: AcquisitionCompanyTrait[] = [];
  const ids = new Set<string>();
  const add = (trait: AcquisitionCompanyTrait) => {
    if (!ids.has(trait.id)) {
      selected.push({ ...trait });
      ids.add(trait.id);
    }
  };

  if (risk === 'low') {
    add(pickTrait(STRENGTH_TRAITS, ids));
    if (Math.random() < 0.65) add(pickTrait(STRENGTH_TRAITS, ids));
  } else if (risk === 'medium') {
    add(pickTrait(STRENGTH_TRAITS, ids));
    add(pickTrait(RISK_TRAITS, ids));
  } else {
    add(pickTrait(RISK_TRAITS, ids));
    if (Math.random() < 0.70) add(pickTrait(RISK_TRAITS, ids));
    else add(pickTrait(STRENGTH_TRAITS, ids));
  }
  return selected.slice(0, 2);
}

function buildDiligenceFindings(
  diligenceScore: number,
  risk: AcquisitionRisk,
  traits: AcquisitionCompanyTrait[],
): AcquisitionDiligenceFinding[] {
  const findings: AcquisitionDiligenceFinding[] = traits.map((trait) => ({
    id: `trait_${trait.id}`,
    title: trait.name,
    kind: trait.kind,
    description: trait.description,
  }));
  findings.push({
    id: 'financial_quality',
    title: diligenceScore >= 80 ? 'Clean Financial Reporting' : diligenceScore >= 64 ? 'Some Normalization Required' : 'Financial Quality Concerns',
    kind: diligenceScore >= 80 ? 'strength' : diligenceScore >= 64 ? 'neutral' : 'risk',
    description: diligenceScore >= 80
      ? 'Historical reporting is consistent and requires little adjustment.'
      : diligenceScore >= 64
        ? 'Some owner-specific or one-off costs need normalization, but the earnings picture is usable.'
        : 'Working-capital, accounting, or one-off items make the earnings picture less certain.',
  });
  if (risk === 'high') {
    findings.push({
      id: 'integration_complexity',
      title: 'Higher Integration Complexity',
      kind: 'risk',
      description: 'The operating model will require more time and management attention after closing.',
    });
  }
  return findings.slice(0, 4);
}

function getTraitOperatingModifiers(traits: AcquisitionCompanyTrait[]): { revenue: number; expense: number } {
  return {
    revenue: clamp(traits.reduce((sum, trait) => sum + (trait.revenueModifier ?? 0), 0), -0.05, 0.05),
    expense: clamp(traits.reduce((sum, trait) => sum + (trait.expenseModifier ?? 0), 0), -0.05, 0.05),
  };
}

export function getAcquisitionTransactionCostRate(tier: AcquisitionTier): number {
  if (tier === 'enterprise') return 0.02;
  if (tier === 'national') return 0.0175;
  return 0.015;
}

export function getAcquisitionTransactionCost(
  target: Pick<BusinessAcquisitionTarget, 'tier' | 'acquisitionTransactionCostRate'>,
  purchasePrice: number,
): number {
  const rate = clamp(target.acquisitionTransactionCostRate ?? getAcquisitionTransactionCostRate(target.tier), 0.01, 0.03);
  return Math.round(Math.max(0, purchasePrice) * rate);
}

function uniqueTypeIds(): string[] {
  const ids = (businessTypesData as any[]).map((type) => type.id).filter(Boolean);
  for (let i = ids.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [ids[i], ids[j]] = [ids[j], ids[i]];
  }
  return ids;
}

export function getAcquisitionPrice(target: BusinessAcquisitionTarget, negotiationBonus = 0): number {
  const reduction = clamp(negotiationBonus, 0, 0.15);
  const negotiatedPrice = Math.max(0, target.askingPrice) * (1 - reduction);
  // Negotiation can reduce the seller's control premium, but cannot turn the
  // acquisition into a below-estimated-value instant resale arbitrage.
  return Math.round(Math.max(target.estimatedValue ?? 0, negotiatedPrice));
}

export function getAcquisitionFinancingQuote(
  purchasePrice: number,
  mode: AcquisitionFundingMode,
  loanRateReduction = 0,
  macroInterestRateModifier = 0,
): AcquisitionFinancingQuote {
  const price = Math.max(0, Math.round(purchasePrice));
  const cashRatio = mode === 'cash' ? 1 : mode === 'balanced' ? 0.60 : 0.30;
  const baseRate = mode === 'cash' ? 0 : mode === 'balanced' ? 0.08 : 0.105;
  const durationWeeks = mode === 'cash' ? 0 : mode === 'balanced' ? 160 : 200;
  const interestRate = Math.max(
    0.025,
    baseRate + clamp(macroInterestRateModifier, -0.025, 0.035) - clamp(loanRateReduction, 0, 0.05),
  );
  const cashContribution = Math.round(price * cashRatio);
  const debtPrincipal = Math.max(0, price - cashContribution);
  const totalRepayment = debtPrincipal > 0
    ? Math.round(debtPrincipal * (1 + interestRate))
    : 0;
  const weeklyPayment = durationWeeks > 0 ? Math.ceil(totalRepayment / durationWeeks) : 0;

  return {
    mode,
    purchasePrice: price,
    cashContribution,
    debtPrincipal,
    interestRate: debtPrincipal > 0 ? interestRate : 0,
    durationWeeks,
    totalRepayment,
    weeklyPayment,
    leveragePct: price > 0 ? debtPrincipal / price : 0,
  };
}

export function getIntegrationStrategyProfile(
  baseWeeks: number,
  basePenalty: number,
  diligenceScore: number,
  strategy: Exclude<AcquisitionIntegrationStrategy, 'pending'>,
) {
  const diligence = clamp(diligenceScore, 0, 100);
  if (strategy === 'independent') {
    return {
      weeks: Math.max(3, Math.ceil(baseWeeks * 0.70)),
      penalty: clamp(basePenalty * 0.45, 0.01, 0.10),
      successChance: 1,
      label: 'Keep Independent',
      description: 'Safest route. Shorter disruption, but no permanent operating synergies.',
    };
  }
  if (strategy === 'integrate') {
    return {
      weeks: Math.max(5, baseWeeks),
      penalty: clamp(basePenalty, 0.03, 0.20),
      successChance: clamp(0.75 + diligence * 0.002, 0.82, 0.95),
      label: 'Integrate Operations',
      description: 'Moderate disruption. Successful integration can reduce costs and improve cross-selling.',
    };
  }
  return {
    weeks: Math.max(6, Math.ceil(baseWeeks * 1.15)),
    penalty: clamp(basePenalty * 1.35, 0.06, 0.24),
    successChance: clamp(0.48 + diligence * 0.0022, 0.58, 0.72),
    label: 'Aggressive Turnaround',
    description: 'Highest disruption and risk, with the strongest upside if execution succeeds.',
  };
}

export function applyIntegrationStrategy(
  business: OwnedBusiness,
  strategy: Exclude<AcquisitionIntegrationStrategy, 'pending'>,
): OwnedBusiness {
  const acquisition = business.acquisition;
  if (!acquisition || acquisition.integrationStrategy !== 'pending') return business;
  const profile = getIntegrationStrategyProfile(
    acquisition.baseIntegrationWeeks ?? acquisition.integrationWeeksRemaining ?? 8,
    acquisition.baseIntegrationPenalty ?? acquisition.integrationPenalty ?? 0.08,
    acquisition.diligenceScore ?? 65,
    strategy,
  );
  return {
    ...business,
    acquisition: {
      ...acquisition,
      integrationStrategy: strategy,
      integrationOutcome: 'pending',
      integrationWeeksRemaining: profile.weeks,
      integrationPenalty: profile.penalty,
      integrationSuccessChance: profile.successChance,
    },
  };
}

export function generateAcquisitionTargets(
  globalWeek: number,
  inflationMultiplier = 1,
  count = ACQUISITION_TARGET_COUNT,
  economicCyclePhase?: EconomicCyclePhase,
): BusinessAcquisitionTarget[] {
  const typeIds = uniqueTypeIds();
  const targets: BusinessAcquisitionTarget[] = [];
  const safeInflation = Math.max(0.5, inflationMultiplier || 1);
  const cycleValueMultiplier = economicCyclePhase
    ? getAcquisitionCycleValueMultiplier(economicCyclePhase)
    : 1;

  for (let index = 0; index < Math.max(1, count); index += 1) {
    const band = TARGET_BANDS[index % TARGET_BANDS.length];
    const typeId = typeIds[index % Math.max(1, typeIds.length)];
    const type = getBusinessType(typeId);
    if (!type) continue;

    const estimatedValue = Math.round(randomBetween(band.min, band.max) * safeInflation * cycleValueMultiplier);
    const isDistressed = economicCyclePhase === 'recession'
      && (index === 0 || Math.random() < 0.35);
    const marketCondition: BusinessAcquisitionTarget['marketCondition'] = isDistressed
      ? 'distressed'
      : economicCyclePhase === 'boom'
        ? 'competitive'
        : 'normal';
    const reputation = Math.round(randomBetween(isDistressed ? 45 : 52, isDistressed ? 80 : 92));
    const profitMultiple = 2 + (reputation / 100) * 3;
    const baselineWeeklyProfit = Math.max(25_000, Math.round(estimatedValue / (20 * profitMultiple)));
    const weeklyProfit = Math.max(
      20_000,
      Math.round(baselineWeeklyProfit * (isDistressed ? randomBetween(0.68, 0.82) : 1)),
    );
    const margin = isDistressed ? randomBetween(0.06, 0.14) : randomBetween(0.09, 0.21);
    const weeklyRevenue = Math.round(weeklyProfit / margin);
    const diligenceScore = Math.round(randomBetween(isDistressed ? 45 : 50, isDistressed ? 78 : 94));
    const risk = riskFromDiligence(diligenceScore);
    const traits = acquisitionTraitsForRisk(risk);
    const traitModifiers = getTraitOperatingModifiers(traits);
    const diligenceFindings = buildDiligenceFindings(diligenceScore, risk, traits);
    const sellerReasonProfile = isDistressed
      ? { label: 'Recession-driven liquidity pressure', premiumMin: 1.10, premiumMax: 1.14 }
      : SELLER_REASONS[Math.floor(Math.random() * SELLER_REASONS.length)];
    // Established companies still command a control premium. Distressed targets
    // receive a smaller premium, but never spawn below estimated fair value.
    const boomPremiumLift = economicCyclePhase === 'boom' ? 0.02 : 0;
    const premium = randomBetween(
      Math.min(1.30, sellerReasonProfile.premiumMin + boomPremiumLift),
      Math.min(1.30, sellerReasonProfile.premiumMax + boomPremiumLift),
    );
    const askingPrice = Math.round(estimatedValue * premium);
    const prefix = COMPANY_PREFIXES[Math.floor(Math.random() * COMPANY_PREFIXES.length)];
    const suffix = COMPANY_SUFFIXES[Math.floor(Math.random() * COMPANY_SUFFIXES.length)];

    targets.push({
      id: `acq_${globalWeek}_${index}_${Math.random().toString(36).slice(2, 7)}`,
      name: `${prefix} ${type.name} ${suffix}`,
      typeId,
      industry: type.industry ?? 'Business',
      tier: band.tier,
      askingPrice,
      estimatedValue,
      weeklyRevenue,
      weeklyProfit,
      reputation,
      diligenceScore,
      risk,
      diligenceNotes: diligenceFindings.map((finding) => finding.title),
      marketCondition,
      companyAgeYears: acquisitionCompanyAgeYears(band.tier),
      sellerReason: sellerReasonProfile.label,
      traits,
      diligenceFindings,
      persistentRevenueModifier: traitModifiers.revenue,
      persistentExpenseModifier: traitModifiers.expense,
      acquisitionTransactionCostRate: getAcquisitionTransactionCostRate(band.tier),
      integrationWeeks: integrationWeeksForRisk(risk),
      integrationPenalty: integrationPenaltyForRisk(risk),
      sellerName: SELLERS[Math.floor(Math.random() * SELLERS.length)],
      generatedGlobalWeek: globalWeek,
    });
  }

  return targets;
}

function acquisitionEmployeeCount(tier: AcquisitionTier, maxEmployees: number): number {
  const desired = tier === 'enterprise' ? 7 : tier === 'national' ? 5 : 4;
  return Math.max(3, Math.min(maxEmployees || desired, desired));
}

function createAcquisitionEmployees(target: BusinessAcquisitionTarget, inflationMultiplier: number) {
  const type = getBusinessType(target.typeId);
  const count = acquisitionEmployeeCount(target.tier, type?.maxEmployees ?? 6);
  const roles = ['manager', 'supervisor', 'skilled_worker', 'specialist', 'worker'];
  const employees = [];
  const usedNames: string[] = [];

  for (let index = 0; index < count; index += 1) {
    const roleId = roles[index % roles.length];
    const candidates = generateCandidates(roleId, usedNames, inflationMultiplier);
    const candidate = candidates[1] ?? candidates[0];
    if (!candidate) continue;
    usedNames.push(candidate.name);
    const employee = candidateToEmployee(candidate);
    employees.push({
      ...employee,
      skill: Math.min(100, (employee.skill ?? 50) + (target.tier === 'enterprise' ? 12 : target.tier === 'national' ? 7 : 3)),
      morale: Math.max(55, employee.morale ?? 70),
    });
  }
  return employees;
}

export function createAcquiredBusiness(
  target: BusinessAcquisitionTarget,
  state: Pick<GameState, 'week' | 'year' | 'inflationMultiplier' | 'playerName' | 'familyTree'>,
  holdingCompanyId: string | null = null,
  purchasePrice = target.askingPrice,
  fundingMode: AcquisitionFundingMode = 'cash',
  loanRateReduction = 0,
  macroInterestRateModifier = 0,
): OwnedBusiness | null {
  const type = getBusinessType(target.typeId);
  const base = createBusiness(target.typeId, target.name, state.week, state.year, state.inflationMultiplier);
  if (!base || !type) return null;

  const financing = getAcquisitionFinancingQuote(
    purchasePrice,
    fundingMode,
    loanRateReduction,
    macroInterestRateModifier,
  );
  const acquisitionTransactionCost = getAcquisitionTransactionCost(target, financing.purchasePrice);
  const employees = createAcquisitionEmployees(target, state.inflationMultiplier);
  const level = target.tier === 'enterprise' ? 7 : target.tier === 'national' ? 6 : 5;
  const currentGlobalWeek = ((state.year - 1) * 20) + state.week;

  // Acquisitions represent mature operating companies, not fresh startups.
  // Carry in every upgrade already available to the business type and every
  // expansion its current level/reputation supports. This prevents cheap
  // startup-priced improvements from multiplying an acquisition-scale revenue base.
  const purchasedUpgrades = [...new Set(type.upgrades ?? [])];
  const locations = getAllBusinessLocationTemplates()
    .filter((template) =>
      level >= (template.requiredLevel ?? 0)
      && target.reputation >= (template.requiredReputation ?? 0)
    )
    .map((template, index) => {
      const scaledCosts = getScaledLocationCosts(base, template.id, state.inflationMultiplier);
      return {
        id: `acq_location_${target.id}_${template.id}`,
        templateId: template.id,
        name: template.name,
        region: template.region,
        revenueBoost: template.revenueBoost ?? 0,
        weeklyOperatingCost: scaledCosts?.weeklyOperatingCost ?? template.weeklyOperatingCost ?? 0,
        openedWeek: Math.max(1, currentGlobalWeek - ((index + 1) * 10)),
      };
    });

  const profitHistory = Array.from({ length: 20 }, () =>
    Math.max(0, Math.round(target.weeklyProfit * randomBetween(0.82, 1.18)))
  );
  const revenueHistory = Array.from({ length: 20 }, () =>
    Math.max(0, Math.round(target.weeklyRevenue * randomBetween(0.85, 1.15)))
  );
  const baseWeeklyRevenue = Math.max(1, (type.baseWeeklyRevenue ?? 1) * Math.max(0.5, state.inflationMultiplier) * 1.121);
  const operatingScaleMultiplier = clamp(target.weeklyRevenue / (baseWeeklyRevenue * 2.25), 1, 1000);
  const businessBalance = Math.round(Math.min(7_500_000, target.estimatedValue * 0.025));
  const acquisitionLoan = financing.debtPrincipal > 0
    ? [{
        id: `acquisition_${currentGlobalWeek}_${Math.random().toString(36).slice(2, 7)}`,
        amount: financing.debtPrincipal,
        remainingAmount: financing.totalRepayment,
        weeklyPayment: financing.weeklyPayment,
        weeksRemaining: financing.durationWeeks,
        interestRate: financing.interestRate,
        purpose: 'acquisition' as const,
      }]
    : [];

  const acquired: OwnedBusiness = {
    ...base,
    balance: businessBalance,
    totalRevenue: revenueHistory.reduce((sum, value) => sum + value, 0),
    totalExpenses: Math.max(0, revenueHistory.reduce((sum, value) => sum + value, 0) - profitHistory.reduce((sum, value) => sum + value, 0)),
    lastWeekRevenue: target.weeklyRevenue,
    lastWeekExpenses: Math.max(0, target.weeklyRevenue - target.weeklyProfit),
    lastWeekProfit: target.weeklyProfit,
    reputation: target.reputation,
    level,
    valuation: target.estimatedValue,
    employees,
    purchasedUpgrades,
    activeUpgrade: null,
    locations,
    activeExpansion: null,
    businessLoans: acquisitionLoan,
    weeklyProfitHistory: profitHistory,
    weeklyRevenueHistory: revenueHistory,
    annualProfit: target.weeklyProfit * Math.max(1, state.week),
    annualProfitYear: state.year,
    operatingScaleMultiplier,
    holdingCompanyId,
    portfolioIntent: 'active',
    capitalInvested: financing.cashContribution + acquisitionTransactionCost,
    totalPlayerDistributions: 0,
    acquisition: {
      assetBaselineVersion: 1,
      purchasePrice: financing.purchasePrice,
      cashContribution: financing.cashContribution,
      debtFinanced: financing.debtPrincipal,
      fundingMode,
      sellerName: target.sellerName,
      acquiredGlobalWeek: currentGlobalWeek,
      estimatedValueAtPurchase: target.estimatedValue,
      baseIntegrationWeeks: target.integrationWeeks,
      baseIntegrationPenalty: target.integrationPenalty,
      integrationStrategy: 'pending',
      integrationOutcome: 'pending',
      integrationWeeksRemaining: target.integrationWeeks,
      integrationPenalty: target.integrationPenalty,
      integrationSuccessChance: 0,
      postIntegrationRevenueBonus: 0,
      postIntegrationExpenseReduction: 0,
      initialRisk: target.risk,
      diligenceScore: target.diligenceScore,
      companyAgeYears: target.companyAgeYears ?? 8,
      sellerReason: target.sellerReason ?? target.sellerName,
      traits: (target.traits ?? []).map((trait) => ({ ...trait })),
      diligenceFindings: (target.diligenceFindings ?? []).map((finding) => ({ ...finding })),
      persistentRevenueModifier: target.persistentRevenueModifier ?? 0,
      persistentExpenseModifier: target.persistentExpenseModifier ?? 0,
      acquisitionTransactionCost,
      acquisitionTransactionCostRate: target.acquisitionTransactionCostRate ?? getAcquisitionTransactionCostRate(target.tier),
      additionalCapitalInvested: 0,
      quotedWeeklyRevenue: target.weeklyRevenue,
      quotedWeeklyProfit: target.weeklyProfit,
      quoteInflation: state.inflationMultiplier,
      referenceStaffCost: employees.reduce((sum, employee) => sum + employee.weeklySalary, 0),
      referenceExpenseMultiplier: aggregateEmployeeBuffs(employees).expenseMult,
    },
    ownership: [{
      ownerType: 'player',
      ownerId: state.familyTree?.currentPlayerId ?? 'player',
      ownerName: state.playerName,
      percent: 100,
      votingPercent: 100,
    }],
    timeline: [
      ...(base.timeline ?? []),
      {
        week: state.week,
        year: state.year,
        title: fundingMode === 'cash'
          ? `🤝 Acquired for €${Math.round(financing.purchasePrice).toLocaleString('en-US')} + €${Math.round(acquisitionTransactionCost).toLocaleString('en-US')} closing costs`
          : `🤝 Acquired with ${Math.round(financing.leveragePct * 100)}% financing + €${Math.round(acquisitionTransactionCost).toLocaleString('en-US')} closing costs`,
        icon: '🤝',
        kind: 'event' as const,
      },
    ].slice(-50),
  };
  acquired.acquisition!.referenceRevenueCapacity = getBusinessRevenueCapacity(acquired);
  acquired.corporateWorkforce = createCorporateWorkforce(
    acquired,
    currentGlobalWeek,
    state.inflationMultiplier ?? 1,
  );
  return acquired;
}

export function migrateAcquiredBusinessAssets(
  business: OwnedBusiness,
  inflationMultiplier = 1,
  currentGlobalWeek = 1,
): OwnedBusiness {
  if (!business.acquisition || (business.acquisition.assetBaselineVersion ?? 0) >= 1) return business;
  const type = getBusinessType(business.typeId);
  if (!type) return business;

  const templates = getAllBusinessLocationTemplates();
  const existingLocations = business.locations ?? [];
  const existingTemplateIds = new Set(existingLocations.map((location) => location.templateId));
  const activeExpansionId = business.activeExpansion?.templateId ?? null;
  const missingLocations = templates
    .filter((template) =>
      !existingTemplateIds.has(template.id)
      && (
        ((business.level ?? 0) >= (template.requiredLevel ?? 0)
          && (business.reputation ?? 0) >= (template.requiredReputation ?? 0))
        || template.id === activeExpansionId
      )
    )
    .map((template, index) => {
      const scaledCosts = getScaledLocationCosts(business, template.id, inflationMultiplier);
      return {
        id: `acq_migrated_location_${business.id}_${template.id}`,
        templateId: template.id,
        name: template.name,
        region: template.region,
        revenueBoost: template.revenueBoost ?? 0,
        weeklyOperatingCost: scaledCosts?.weeklyOperatingCost ?? template.weeklyOperatingCost ?? 0,
        openedWeek: Math.max(1, currentGlobalWeek - ((index + 1) * 10)),
      };
    });

  const migrated: OwnedBusiness = {
    ...business,
    purchasedUpgrades: [...new Set(type.upgrades ?? [])],
    activeUpgrade: null,
    locations: [...existingLocations, ...missingLocations],
    activeExpansion: null,
  };

  return {
    ...migrated,
    acquisition: {
      ...business.acquisition,
      assetBaselineVersion: 1,
      // Rebase old saves to the mature asset footprint so inherited branches and
      // upgrades do not become an instant revenue multiplier after migration.
      referenceRevenueCapacity: getBusinessRevenueCapacity(migrated),
    },
  };
}

export function createHoldingCompany(
  name: string,
  state: Pick<GameState, 'week' | 'year' | 'generation' | 'playerName' | 'familyTree'>,
): HoldingCompany {
  const cleanName = name.trim() || `${state.playerName} Holdings`;
  return {
    id: `holding_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    name: cleanName,
    createdGlobalWeek: ((state.year - 1) * 20 + state.week),
    founderGeneration: state.generation ?? 1,
    generationsOwned: 1,
    controllerName: state.playerName,
    controllerPersonId: state.familyTree?.currentPlayerId ?? null,
    cashReserve: 0,
    totalCapitalDeployed: 0,
    executiveChildId: null,
    executiveChildName: null,
    executivePerformance: 50,
    designatedSuccessorChildId: null,
    designatedSuccessorChildName: null,
    sharedServices: {
      finance: 0,
      hr: 0,
      procurement: 0,
      marketing: 0,
      it: 0,
    },
    managementFeeRate: 0.01,
    totalManagementFeesCollected: 0,
    totalDividendsReceived: 0,
    totalOwnerDistributions: 0,
  };
}

export function getAcquisitionReturn(business: OwnedBusiness) {
  if (!business.acquisition) return null;
  const investedCapital = Math.max(
    1,
    business.capitalInvested
      ?? ((business.acquisition.cashContribution ?? business.acquisition.purchasePrice ?? 0)
        + (business.acquisition.acquisitionTransactionCost ?? 0)
        + (business.acquisition.additionalCapitalInvested ?? 0)),
  );
  const debt = (business.businessLoans ?? []).reduce((sum, loan) => sum + Math.max(0, loan.remainingAmount ?? 0), 0);
  const equityValue = Math.max(0, (business.valuation ?? 0) - debt);
  const gain = equityValue + Math.max(0, business.totalPlayerDistributions ?? 0) - investedCapital;
  return {
    investedCapital,
    debt,
    equityValue,
    gain,
    returnPct: investedCapital > 0 ? gain / investedCapital * 100 : 0,
  };
}

export function getHoldingCompanySummary(holding: HoldingCompany, businesses: OwnedBusiness[]) {
  const subsidiaries = (businesses ?? []).filter((business) => business.holdingCompanyId === holding.id);
  const totalValue = subsidiaries.reduce((sum, business) => sum + Math.max(0, business.valuation ?? 0), 0);
  const totalDebt = subsidiaries.reduce(
    (sum, business) => sum + (business.businessLoans ?? []).reduce((loanSum, loan) => loanSum + Math.max(0, loan.remainingAmount ?? 0), 0),
    0,
  );
  const weeklyProfit = subsidiaries.reduce((sum, business) => sum + (business.lastWeekProfit ?? 0), 0);
  const familyControlledValue = subsidiaries.reduce((sum, business) => {
    const familyPct = business.ownership?.length
      ? business.ownership
          .filter((stake) => ['player', 'child', 'family_trust'].includes(stake.ownerType))
          .reduce((stakeSum, stake) => stakeSum + (stake.percent ?? 0), 0)
      : 100;
    return sum + Math.max(0, business.valuation ?? 0) * clamp(familyPct, 0, 100) / 100;
  }, 0);
  const protectedAssets = subsidiaries.filter((business) => business.portfolioIntent === 'long_term_family').length;

  return {
    subsidiaryCount: subsidiaries.length,
    totalValue,
    totalDebt,
    netGroupEquity: Math.max(0, totalValue - totalDebt),
    weeklyProfit,
    cashReserve: holding.cashReserve ?? 0,
    totalCapitalDeployed: holding.totalCapitalDeployed ?? 0,
    managementFeeRate: holding.managementFeeRate ?? 0.01,
    totalManagementFeesCollected: holding.totalManagementFeesCollected ?? 0,
    totalDividendsReceived: holding.totalDividendsReceived ?? 0,
    totalOwnerDistributions: holding.totalOwnerDistributions ?? 0,
    familyControlledValue,
    familyControlledPct: totalValue > 0 ? familyControlledValue / totalValue * 100 : 0,
    protectedAssets,
  };
}
