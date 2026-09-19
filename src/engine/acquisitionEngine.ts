import { BusinessAcquisitionTarget, HoldingCompany, OwnedBusiness, GameState, AcquisitionRisk, AcquisitionTier } from '../types/game';
import businessTypesData from '../data/business_types.json';
import { candidateToEmployee, createBusiness, generateCandidates, getBusinessType } from './businessEngine';

export const ACQUISITION_UNLOCK_NET_WORTH = 10_000_000;
export const ACQUISITION_MARKET_REFRESH_WEEKS = 6;
export const HOLDING_COMPANY_SETUP_COST = 500_000;
export const ACQUISITION_TARGET_COUNT = 6;

const COMPANY_PREFIXES = [
  'Northstar', 'Atlas', 'Summit', 'Crown', 'Meridian', 'Sterling',
  'Redwood', 'Vanguard', 'Orion', 'Keystone', 'Harbor', 'Apex',
];
const COMPANY_SUFFIXES = ['Group', 'Partners', 'Industries', 'Works', 'Collective', 'Enterprises'];
const SELLERS = [
  'Founder-led sale', 'Private shareholders', 'Family owners',
  'Growth fund exit', 'Management consortium', 'Strategic divestment',
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

function diligenceIssues(risk: AcquisitionRisk): string[] {
  if (risk === 'low') {
    return ['Audited financials', Math.random() < 0.5 ? 'Stable management team' : 'Diversified customer base'];
  }
  if (risk === 'medium') {
    const pool = ['Customer concentration', 'Key-person dependency', 'Margin pressure', 'Aging systems'];
    return pool.sort(() => Math.random() - 0.5).slice(0, 2);
  }
  const pool = ['Deferred maintenance', 'Debt refinancing risk', 'Customer concentration', 'Management turnover', 'Margin pressure', 'Compliance remediation'];
  return pool.sort(() => Math.random() - 0.5).slice(0, 3);
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
  return Math.round(Math.max(0, target.askingPrice) * (1 - reduction));
}

export function generateAcquisitionTargets(
  globalWeek: number,
  inflationMultiplier = 1,
  count = ACQUISITION_TARGET_COUNT,
): BusinessAcquisitionTarget[] {
  const typeIds = uniqueTypeIds();
  const targets: BusinessAcquisitionTarget[] = [];
  const safeInflation = Math.max(0.5, inflationMultiplier || 1);

  for (let index = 0; index < Math.max(1, count); index += 1) {
    const band = TARGET_BANDS[index % TARGET_BANDS.length];
    const typeId = typeIds[index % Math.max(1, typeIds.length)];
    const type = getBusinessType(typeId);
    if (!type) continue;

    const estimatedValue = Math.round(randomBetween(band.min, band.max) * safeInflation);
    const reputation = Math.round(randomBetween(52, 92));
    const profitMultiple = 2 + (reputation / 100) * 3;
    const weeklyProfit = Math.max(25_000, Math.round(estimatedValue / (20 * profitMultiple)));
    const margin = randomBetween(0.09, 0.21);
    const weeklyRevenue = Math.round(weeklyProfit / margin);
    const diligenceScore = Math.round(randomBetween(50, 94));
    const risk = riskFromDiligence(diligenceScore);
    const premium = randomBetween(0.91, 1.16);
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
      diligenceNotes: diligenceIssues(risk),
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
): OwnedBusiness | null {
  const type = getBusinessType(target.typeId);
  const base = createBusiness(target.typeId, target.name, state.week, state.year, state.inflationMultiplier);
  if (!base || !type) return null;

  const employees = createAcquisitionEmployees(target, state.inflationMultiplier);
  const upgradeCount = target.tier === 'enterprise' ? 4 : target.tier === 'national' ? 3 : 2;
  const purchasedUpgrades = (type.upgrades ?? []).slice(0, upgradeCount);
  const profitHistory = Array.from({ length: 20 }, () =>
    Math.max(0, Math.round(target.weeklyProfit * randomBetween(0.82, 1.18)))
  );
  const revenueHistory = Array.from({ length: 20 }, () =>
    Math.max(0, Math.round(target.weeklyRevenue * randomBetween(0.85, 1.15)))
  );
  const baseWeeklyRevenue = Math.max(1, (type.baseWeeklyRevenue ?? 1) * Math.max(0.5, state.inflationMultiplier) * 1.121);
  const operatingScaleMultiplier = clamp(target.weeklyRevenue / (baseWeeklyRevenue * 2.25), 1, 1000);
  const businessBalance = Math.round(Math.min(7_500_000, target.estimatedValue * 0.025));
  const currentGlobalWeek = ((state.year - 1) * 20) + state.week;

  return {
    ...base,
    balance: businessBalance,
    totalRevenue: revenueHistory.reduce((sum, value) => sum + value, 0),
    totalExpenses: Math.max(0, revenueHistory.reduce((sum, value) => sum + value, 0) - profitHistory.reduce((sum, value) => sum + value, 0)),
    lastWeekRevenue: target.weeklyRevenue,
    lastWeekExpenses: Math.max(0, target.weeklyRevenue - target.weeklyProfit),
    lastWeekProfit: target.weeklyProfit,
    reputation: target.reputation,
    level: target.tier === 'enterprise' ? 7 : target.tier === 'national' ? 6 : 5,
    valuation: target.estimatedValue,
    employees,
    purchasedUpgrades,
    weeklyProfitHistory: profitHistory,
    weeklyRevenueHistory: revenueHistory,
    annualProfit: target.weeklyProfit * Math.max(1, state.week),
    annualProfitYear: state.year,
    operatingScaleMultiplier,
    holdingCompanyId,
    acquisition: {
      purchasePrice: target.askingPrice,
      sellerName: target.sellerName,
      acquiredGlobalWeek: currentGlobalWeek,
      estimatedValueAtPurchase: target.estimatedValue,
      integrationWeeksRemaining: target.integrationWeeks,
      integrationPenalty: target.integrationPenalty,
      initialRisk: target.risk,
      diligenceScore: target.diligenceScore,
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
        title: `🤝 Acquired for €${Math.round(target.askingPrice).toLocaleString('en-US')}`,
        icon: '🤝',
        kind: 'event',
      },
    ].slice(-50),
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
    createdGlobalWeek: ((state.year - 1) * 20) + state.week,
    founderGeneration: state.generation ?? 1,
    generationsOwned: 1,
    controllerName: state.playerName,
    controllerPersonId: state.familyTree?.currentPlayerId ?? null,
  };
}

export function getHoldingCompanySummary(holding: HoldingCompany, businesses: OwnedBusiness[]) {
  const subsidiaries = (businesses ?? []).filter((business) => business.holdingCompanyId === holding.id);
  const totalValue = subsidiaries.reduce((sum, business) => sum + Math.max(0, business.valuation ?? 0), 0);
  const weeklyProfit = subsidiaries.reduce((sum, business) => sum + (business.lastWeekProfit ?? 0), 0);
  const familyControlledValue = subsidiaries.reduce((sum, business) => {
    const familyPct = business.ownership?.length
      ? business.ownership
          .filter((stake) => ['player', 'child', 'family_trust'].includes(stake.ownerType))
          .reduce((stakeSum, stake) => stakeSum + (stake.percent ?? 0), 0)
      : 100;
    return sum + Math.max(0, business.valuation ?? 0) * clamp(familyPct, 0, 100) / 100;
  }, 0);

  return {
    subsidiaryCount: subsidiaries.length,
    totalValue,
    weeklyProfit,
    familyControlledValue,
    familyControlledPct: totalValue > 0 ? familyControlledValue / totalValue * 100 : 0,
  };
}
