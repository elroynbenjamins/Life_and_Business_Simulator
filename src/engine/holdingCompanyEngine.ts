import { HoldingCompany, HoldingSharedServiceId, HoldingSharedServices } from '../types/game';

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

export function normalizeHoldingManagementFeeRate(rate: number | null | undefined): number {
  const value = Number.isFinite(rate as number) ? Number(rate) : HOLDING_MANAGEMENT_FEE_DEFAULT;
  return Math.max(0, Math.min(HOLDING_MANAGEMENT_FEE_MAX, value));
}

export function getHoldingManagementFeeForWeek(
  holding: HoldingCompany,
  subsidiaryWeeklyRevenue: number,
  subsidiaryBalance: number,
  subsidiaryWeeklyExpenses: number,
): number {
  const rate = normalizeHoldingManagementFeeRate(holding.managementFeeRate);
  if (rate <= 0 || subsidiaryWeeklyRevenue <= 0) return 0;

  // Management fees are based on revenue but cannot raid the operating buffer.
  const operatingBuffer = Math.max(0, subsidiaryWeeklyExpenses) * 4;
  const availableCash = Math.max(0, subsidiaryBalance - operatingBuffer);
  return Math.max(
    0,
    Math.min(
      Math.round(Math.max(0, subsidiaryWeeklyRevenue) * rate),
      Math.round(availableCash),
    ),
  );
}
