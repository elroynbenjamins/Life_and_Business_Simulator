import { GameState, HoldingCompany, HoldingSharedServiceId, HoldingSharedServices, OwnedBusiness } from '../types/game';
import { getBusinessDebtPrincipal } from './businessDebtEngine';
import { getPlayerEquityOwnershipPct } from './businessOwnershipEngine';

export const EMPTY_HOLDING_SHARED_SERVICES: HoldingSharedServices = {
  finance: 0,
  hr: 0,
  procurement: 0,
  marketing: 0,
  it: 0,
};

export const HOLDING_SHARED_SERVICE_MAX_LEVEL = 3;

export const HOLDING_SHARED_SERVICE_DEFINITIONS: Record<HoldingSharedServiceId, {
  id: HoldingSharedServiceId;
  name: string;
  description: string;
  icon: 'calculator-outline' | 'people-outline' | 'cube-outline' | 'megaphone-outline' | 'hardware-chip-outline';
  baseCost: number;
  revenuePerLevel: number;
  expenseReductionPerLevel: number;
  crisisReductionPerLevel: number;
}> = {
  finance: {
    id: 'finance',
    name: 'Central Finance',
    description: 'Group budgeting, treasury controls and reporting improve cost discipline and risk management.',
    icon: 'calculator-outline',
    baseCost: 2_000_000,
    revenuePerLevel: 0,
    expenseReductionPerLevel: 0.003,
    crisisReductionPerLevel: 0.01,
  },
  hr: {
    id: 'hr',
    name: 'Group HR',
    description: 'Shared recruiting, onboarding and people operations improve execution across subsidiaries.',
    icon: 'people-outline',
    baseCost: 1_500_000,
    revenuePerLevel: 0.003,
    expenseReductionPerLevel: 0.002,
    crisisReductionPerLevel: 0.005,
  },
  procurement: {
    id: 'procurement',
    name: 'Central Procurement',
    description: 'Group purchasing contracts reduce recurring operating costs.',
    icon: 'cube-outline',
    baseCost: 2_500_000,
    revenuePerLevel: 0,
    expenseReductionPerLevel: 0.006,
    crisisReductionPerLevel: 0,
  },
  marketing: {
    id: 'marketing',
    name: 'Group Marketing',
    description: 'Shared brand, media buying and cross-promotion create a modest revenue lift.',
    icon: 'megaphone-outline',
    baseCost: 2_000_000,
    revenuePerLevel: 0.005,
    expenseReductionPerLevel: 0,
    crisisReductionPerLevel: 0,
  },
  it: {
    id: 'it',
    name: 'Shared IT',
    description: 'Common systems and security tooling improve productivity, costs and operational resilience.',
    icon: 'hardware-chip-outline',
    baseCost: 3_000_000,
    revenuePerLevel: 0.003,
    expenseReductionPerLevel: 0.003,
    crisisReductionPerLevel: 0.005,
  },
};

export function normalizeHoldingSharedServices(
  services: Partial<HoldingSharedServices> | null | undefined,
): HoldingSharedServices {
  const clampLevel = (value: number | undefined) =>
    Math.max(0, Math.min(HOLDING_SHARED_SERVICE_MAX_LEVEL, Math.floor(value ?? 0)));
  return {
    finance: clampLevel(services?.finance),
    hr: clampLevel(services?.hr),
    procurement: clampLevel(services?.procurement),
    marketing: clampLevel(services?.marketing),
    it: clampLevel(services?.it),
  };
}

export function getHoldingSharedServiceLevel(
  holding: HoldingCompany,
  serviceId: HoldingSharedServiceId,
): number {
  return normalizeHoldingSharedServices(holding.sharedServices)[serviceId];
}

export function getHoldingSharedServiceUpgradeCost(
  holding: HoldingCompany,
  serviceId: HoldingSharedServiceId,
  inflationMultiplier = 1,
): number {
  const definition = HOLDING_SHARED_SERVICE_DEFINITIONS[serviceId];
  const currentLevel = getHoldingSharedServiceLevel(holding, serviceId);
  if (currentLevel >= HOLDING_SHARED_SERVICE_MAX_LEVEL) return 0;
  const levelMultiplier = Math.pow(2, currentLevel);
  return Math.round(definition.baseCost * levelMultiplier * Math.max(0.5, inflationMultiplier || 1));
}

export function getHoldingSharedServiceEffects(holding: HoldingCompany | null | undefined) {
  const services = normalizeHoldingSharedServices(holding?.sharedServices);
  let revenueBonus = 0;
  let expenseReduction = 0;
  let crisisReduction = 0;

  for (const serviceId of Object.keys(HOLDING_SHARED_SERVICE_DEFINITIONS) as HoldingSharedServiceId[]) {
    const definition = HOLDING_SHARED_SERVICE_DEFINITIONS[serviceId];
    const level = services[serviceId];
    revenueBonus += definition.revenuePerLevel * level;
    expenseReduction += definition.expenseReductionPerLevel * level;
    crisisReduction += definition.crisisReductionPerLevel * level;
  }

  return {
    revenueBonus: Math.max(0, Math.min(0.04, revenueBonus)),
    expenseReduction: Math.max(0, Math.min(0.05, expenseReduction)),
    crisisReduction: Math.max(0, Math.min(0.08, crisisReduction)),
    totalLevels: Object.values(services).reduce((sum, level) => sum + level, 0),
    services,
  };
}


export const HOLDING_MANAGEMENT_FEE_DEFAULT = 0.01;
export const HOLDING_MANAGEMENT_FEE_MAX = 0.03;
export const HOLDING_RESERVE_TARGET_DEFAULT_WEEKS = 4;
export const HOLDING_RESERVE_TARGET_MAX_WEEKS = 20;

export function normalizeHoldingReserveTargetWeeks(weeks: number | null | undefined): number {
  const value = Number.isFinite(weeks as number)
    ? Math.round(Number(weeks))
    : HOLDING_RESERVE_TARGET_DEFAULT_WEEKS;
  return Math.max(0, Math.min(HOLDING_RESERVE_TARGET_MAX_WEEKS, value));
}

export function getHoldingReserveTarget(
  holding: HoldingCompany,
  businesses: OwnedBusiness[],
): number {
  const reserveWeeks = normalizeHoldingReserveTargetWeeks(holding.reserveTargetWeeks);
  if (reserveWeeks <= 0) return 0;
  const subsidiaries = (businesses ?? []).filter((business) => business.holdingCompanyId === holding.id);
  const weeklyOperatingExpenses = subsidiaries.reduce(
    (sum, business) => sum + Math.max(0, business.lastWeekExpenses ?? 0),
    0,
  );
  return Math.round(weeklyOperatingExpenses * reserveWeeks);
}

export function getHoldingAvailableDistributionCash(
  holding: HoldingCompany,
  businesses: OwnedBusiness[],
): number {
  return Math.max(
    0,
    Math.round((holding.cashReserve ?? 0) - getHoldingReserveTarget(holding, businesses)),
  );
}

export function canChargeHoldingManagementFee(
  business: OwnedBusiness,
): boolean {
  // Management fees are a parent-level cash extraction. Once another owner has
  // economic rights in the subsidiary, cash must leave through pro-rata dividends
  // instead of bypassing minority shareholders.
  return getPlayerEquityOwnershipPct(business) >= 99.999;
}

export function normalizeHoldingManagementFeeRate(rate: number | null | undefined): number {
  const value = Number.isFinite(rate as number) ? Number(rate) : HOLDING_MANAGEMENT_FEE_DEFAULT;
  return Math.max(0, Math.min(HOLDING_MANAGEMENT_FEE_MAX, value));
}

export function getHoldingManagementFeeForWeek(
  holding: HoldingCompany,
  subsidiaryWeeklyRevenue: number,
  subsidiaryBalance: number,
  subsidiaryWeeklyExpenses: number,
  protectedCashOverride?: number,
): number {
  const rate = normalizeHoldingManagementFeeRate(holding.managementFeeRate);
  const revenue = Math.max(0, subsidiaryWeeklyRevenue);
  const expenses = Math.max(0, subsidiaryWeeklyExpenses);
  const weeklyProfitBeforeFee = Math.max(0, revenue - expenses);
  if (rate <= 0 || revenue <= 0 || weeklyProfitBeforeFee <= 0) return 0;

  // Management fees remain revenue-based, but they cannot turn an otherwise
  // profitable subsidiary into a cash-extraction vehicle during weak weeks.
  // At most 35% of pre-fee weekly profit can be upstreamed as a management fee.
  const operatingBuffer = expenses * 4;
  const protectedCash = Math.max(
    operatingBuffer,
    Math.max(0, protectedCashOverride ?? 0),
  );
  const availableCash = Math.max(0, subsidiaryBalance - protectedCash);
  const revenueFee = Math.round(revenue * rate);
  const profitCap = Math.round(weeklyProfitBeforeFee * 0.35);
  return Math.max(
    0,
    Math.min(
      revenueFee,
      profitCap,
      Math.round(availableCash),
    ),
  );
}


export const HOLDING_COMPANY_SETUP_COST = 500_000;

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
    sharedServices: { ...EMPTY_HOLDING_SHARED_SERVICES },
    managementFeeRate: HOLDING_MANAGEMENT_FEE_DEFAULT,
    reserveTargetWeeks: HOLDING_RESERVE_TARGET_DEFAULT_WEEKS,
    totalManagementFeesCollected: 0,
    totalDividendsReceived: 0,
    totalOwnerDistributions: 0,
  };
}

export function getHoldingCompanySummary(holding: HoldingCompany, businesses: OwnedBusiness[]) {
  const subsidiaries = (businesses ?? []).filter((business) => business.holdingCompanyId === holding.id);
  const totalValue = subsidiaries.reduce((sum, business) => sum + Math.max(0, business.valuation ?? 0), 0);
  const totalDebt = subsidiaries.reduce(
    (sum, business) => sum + getBusinessDebtPrincipal(business),
    0,
  );
  const weeklyProfit = subsidiaries.reduce((sum, business) => sum + (business.lastWeekProfit ?? 0), 0);
  const ownerNetEquity = subsidiaries.reduce((sum, business) => {
    const equity = Math.max(0, Math.max(0, business.valuation ?? 0) - getBusinessDebtPrincipal(business));
    return sum + equity * getPlayerEquityOwnershipPct(business) / 100;
  }, 0);
  const familyControlledValue = subsidiaries.reduce((sum, business) => {
    const familyPct = business.ownership?.length
      ? business.ownership
          .filter((stake) => ['player', 'child', 'family_trust'].includes(stake.ownerType))
          .reduce((stakeSum, stake) => stakeSum + (stake.percent ?? 0), 0)
      : 100;
    const boundedFamilyPct = Math.max(0, Math.min(100, familyPct));
    return sum + Math.max(0, business.valuation ?? 0) * boundedFamilyPct / 100;
  }, 0);
  const protectedAssets = subsidiaries.filter(
    (business) => business.portfolioIntent === 'long_term_family',
  ).length;
  const reserveTargetWeeks = normalizeHoldingReserveTargetWeeks(holding.reserveTargetWeeks);
  const reserveTarget = getHoldingReserveTarget(holding, businesses);
  const availableDistributionCash = getHoldingAvailableDistributionCash(holding, businesses);

  return {
    subsidiaryCount: subsidiaries.length,
    totalValue,
    totalDebt,
    netGroupEquity: Math.max(0, totalValue - totalDebt),
    ownerNetEquity: Math.round(ownerNetEquity),
    weeklyProfit,
    cashReserve: holding.cashReserve ?? 0,
    totalCapitalDeployed: holding.totalCapitalDeployed ?? 0,
    managementFeeRate: normalizeHoldingManagementFeeRate(holding.managementFeeRate),
    reserveTargetWeeks,
    reserveTarget,
    availableDistributionCash,
    totalManagementFeesCollected: holding.totalManagementFeesCollected ?? 0,
    totalDividendsReceived: holding.totalDividendsReceived ?? 0,
    totalOwnerDistributions: holding.totalOwnerDistributions ?? 0,
    familyControlledValue,
    familyControlledPct: totalValue > 0 ? familyControlledValue / totalValue * 100 : 0,
    protectedAssets,
  };
}
