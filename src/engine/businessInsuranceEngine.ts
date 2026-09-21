import {
  BusinessInsuranceArea,
  BusinessInsuranceClaim,
  BusinessInsuranceTier,
  OwnedBusiness,
} from '../types/game';
import businessTypesData from '../data/business_types.json';
import { normalizeBusinessReinvestmentState } from './businessReinvestmentEngine';

const DEFAULT_POLICIES: Record<BusinessInsuranceArea, BusinessInsuranceTier> = {
  property: 'none',
  equipment: 'none',
  cyber: 'none',
  liability: 'none',
};

const TIER_CONFIG: Record<BusinessInsuranceTier, {
  premiumMultiplier: number;
  coveragePct: number;
  deductiblePct: number;
}> = {
  none: { premiumMultiplier: 0, coveragePct: 0, deductiblePct: 1 },
  basic: { premiumMultiplier: 0.55, coveragePct: 0.45, deductiblePct: 0.15 },
  standard: { premiumMultiplier: 0.85, coveragePct: 0.65, deductiblePct: 0.08 },
  comprehensive: { premiumMultiplier: 1.20, coveragePct: 0.80, deductiblePct: 0.04 },
};

const ANNUAL_RATE: Record<BusinessInsuranceArea, number> = {
  property: 0.0025,
  equipment: 0.0020,
  cyber: 0.0018,
  liability: 0.0022,
};

const INDUSTRY_RISK: Record<string, Partial<Record<BusinessInsuranceArea, number>>> = {
  Technology: { cyber: 1.45, liability: 1.05 },
  Services: { cyber: 1.20, liability: 1.10, property: 0.85, equipment: 0.80 },
  Retail: { property: 1.15, liability: 1.20 },
  'Food & Beverage': { property: 1.20, equipment: 1.20, liability: 1.25 },
  Hospitality: { property: 1.30, liability: 1.25 },
  Entertainment: { property: 1.10, liability: 1.25, cyber: 1.10 },
  Fitness: { equipment: 1.30, liability: 1.35 },
  Beauty: { liability: 1.25, equipment: 1.10 },
  Manufacturing: { equipment: 1.45, property: 1.20, liability: 1.20 },
  Construction: { equipment: 1.35, liability: 1.45, property: 1.10 },
  Healthcare: { cyber: 1.30, liability: 1.45, equipment: 1.20 },
  Automotive: { equipment: 1.40, liability: 1.25 },
  'Real Estate': { property: 1.20, liability: 1.10, cyber: 0.90 },
  Real_Estate: { property: 1.20, liability: 1.10, cyber: 0.90 },
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function getBusinessType(typeId: string) {
  return (businessTypesData as any[]).find((type) => type?.id === typeId);
}

export function normalizeBusinessInsurancePolicies(
  policies: Partial<Record<BusinessInsuranceArea, BusinessInsuranceTier>> | null | undefined,
): Record<BusinessInsuranceArea, BusinessInsuranceTier> {
  const valid = new Set<BusinessInsuranceTier>(['none', 'basic', 'standard', 'comprehensive']);
  const normalize = (value: BusinessInsuranceTier | undefined): BusinessInsuranceTier =>
    value && valid.has(value) ? value : 'none';
  return {
    property: normalize(policies?.property),
    equipment: normalize(policies?.equipment),
    cyber: normalize(policies?.cyber),
    liability: normalize(policies?.liability),
  };
}

export function getBusinessInsuranceTier(
  business: OwnedBusiness,
  area: BusinessInsuranceArea,
): BusinessInsuranceTier {
  return normalizeBusinessInsurancePolicies(business.insurancePolicies)[area];
}

export function getBusinessInsuranceTierConfig(tier: BusinessInsuranceTier) {
  return TIER_CONFIG[tier];
}

function conditionRiskMultiplier(business: OwnedBusiness, area: BusinessInsuranceArea): number {
  const reinvestment = normalizeBusinessReinvestmentState(business.reinvestment, 1);
  const condition = area === 'property'
    ? reinvestment.premises.condition
    : area === 'equipment'
      ? reinvestment.equipment.condition
      : area === 'cyber'
        ? reinvestment.technology.condition
        : (reinvestment.premises.condition + reinvestment.equipment.condition) / 2;

  if (condition >= 80) return 1;
  if (condition >= 60) return 1.10;
  if (condition >= 40) return 1.25;
  return 1.45;
}

function recentClaimMultiplier(business: OwnedBusiness, currentGlobalWeek: number): number {
  const recentClaims = (business.insuranceClaims ?? []).filter(
    (claim) => currentGlobalWeek - (claim.globalWeek ?? 0) <= 40,
  ).length;
  return 1 + Math.min(0.50, recentClaims * 0.12);
}

export function getBusinessInsuranceWeeklyPremium(
  business: OwnedBusiness,
  area: BusinessInsuranceArea,
  currentGlobalWeek = 1,
): number {
  const tier = getBusinessInsuranceTier(business, area);
  if (tier === 'none') return 0;
  const type = getBusinessType(business.typeId);
  const industry = type?.industry ?? '';
  const industryMultiplier = INDUSTRY_RISK[industry]?.[area] ?? 1;
  const valuation = Math.max(
    type?.startupCost ?? 10_000,
    business.valuation ?? 0,
  );
  const annualPremium = valuation
    * ANNUAL_RATE[area]
    * TIER_CONFIG[tier].premiumMultiplier
    * industryMultiplier
    * conditionRiskMultiplier(business, area)
    * recentClaimMultiplier(business, currentGlobalWeek);
  // One game year = 20 weeks.
  return Math.max(0, Math.round(annualPremium / 20));
}

export function getBusinessInsuranceTotalWeeklyPremium(
  business: OwnedBusiness,
  currentGlobalWeek = 1,
): number {
  return (Object.keys(DEFAULT_POLICIES) as BusinessInsuranceArea[]).reduce(
    (sum, area) => sum + getBusinessInsuranceWeeklyPremium(business, area, currentGlobalWeek),
    0,
  );
}

export function getBusinessInsuranceQuote(
  business: OwnedBusiness,
  area: BusinessInsuranceArea,
  tier: BusinessInsuranceTier,
  currentGlobalWeek = 1,
) {
  const synthetic: OwnedBusiness = {
    ...business,
    insurancePolicies: {
      ...normalizeBusinessInsurancePolicies(business.insurancePolicies),
      [area]: tier,
    },
  };
  return {
    tier,
    weeklyPremium: getBusinessInsuranceWeeklyPremium(synthetic, area, currentGlobalWeek),
    coveragePct: TIER_CONFIG[tier].coveragePct,
    deductiblePct: TIER_CONFIG[tier].deductiblePct,
  };
}

export function resolveBusinessInsuranceLoss(
  business: OwnedBusiness,
  area: BusinessInsuranceArea,
  policyTier: BusinessInsuranceTier,
  grossLoss: number,
  incidentTitle: string,
  globalWeek: number,
): { netLoss: number; payout: number; deductible: number; claim: BusinessInsuranceClaim | null } {
  const loss = Math.max(0, Math.round(grossLoss));
  if (loss <= 0 || policyTier === 'none') {
    return { netLoss: loss, payout: 0, deductible: loss, claim: null };
  }

  const config = TIER_CONFIG[policyTier];
  const deductible = Math.min(loss, Math.round(loss * config.deductiblePct));
  const coveredBase = Math.max(0, loss - deductible);
  const payout = Math.min(loss, Math.round(coveredBase * config.coveragePct));
  const netLoss = Math.max(0, loss - payout);

  return {
    netLoss,
    payout,
    deductible,
    claim: payout > 0
      ? {
          id: `claim_${business.id}_${globalWeek}_${Math.random().toString(36).slice(2, 7)}`,
          area,
          policyTier,
          incidentTitle,
          globalWeek,
          grossLoss: loss,
          deductible,
          payout,
          netLoss,
        }
      : null,
  };
}

export function getBusinessCoverageGaps(business: OwnedBusiness): BusinessInsuranceArea[] {
  const policies = normalizeBusinessInsurancePolicies(business.insurancePolicies);
  const reinvestment = normalizeBusinessReinvestmentState(business.reinvestment, 1);
  const gaps: BusinessInsuranceArea[] = [];

  if (reinvestment.premises.condition < 60 && policies.property === 'none') gaps.push('property');
  if (reinvestment.equipment.condition < 60 && policies.equipment === 'none') gaps.push('equipment');
  if (reinvestment.technology.condition < 60 && policies.cyber === 'none') gaps.push('cyber');

  if ((business.valuation ?? 0) >= 25_000_000) {
    if (policies.cyber === 'none' && !gaps.includes('cyber')) gaps.push('cyber');
    if (policies.liability === 'none') gaps.push('liability');
  }

  return gaps;
}

export function getBusinessInsuranceRiskSummary(business: OwnedBusiness) {
  const policies = normalizeBusinessInsurancePolicies(business.insurancePolicies);
  const coveredAreas = (Object.keys(policies) as BusinessInsuranceArea[])
    .filter((area) => policies[area] !== 'none').length;
  const comprehensiveAreas = (Object.keys(policies) as BusinessInsuranceArea[])
    .filter((area) => policies[area] === 'comprehensive').length;
  const coverageGaps = getBusinessCoverageGaps(business);
  return {
    coveredAreas,
    comprehensiveAreas,
    coverageGaps,
    score: clamp(coveredAreas * 20 + comprehensiveAreas * 5 - coverageGaps.length * 10, 0, 100),
  };
}
