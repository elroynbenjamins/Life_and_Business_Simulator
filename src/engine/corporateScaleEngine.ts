import {
  BusinessPendingDecision,
  CompletedCorporateCapex,
  CorporateScaleTier,
  OwnedBusiness,
} from '../types/game';
import { getBusinessInsuranceTier } from './businessInsuranceEngine';

export const CORPORATE_SCALE_MIN_VALUATION = 25_000_000;

export interface CorporateCapexDefinition {
  id: string;
  name: string;
  icon: string;
  description: string;
  baseCost: number;
  weeks: number;
  minValuation: number;
  minReputation: number;
  revenueBonus: number;
  expenseReduction: number;
  crisisReduction: number;
  reputationBonus: number;
  assetValueRetention: number;
  constructionRevenuePenalty: number;
  constructionExpensePenalty: number;
}

export const CORPORATE_CAPEX_PROJECTS: CorporateCapexDefinition[] = [
  {
    id: 'corporate_hq',
    name: 'Corporate Headquarters',
    icon: '🏢',
    description: 'Build a dedicated headquarters for finance, leadership and group operations.',
    baseCost: 5_000_000,
    weeks: 10,
    minValuation: 25_000_000,
    minReputation: 60,
    revenueBonus: 0.005,
    expenseReduction: 0.005,
    crisisReduction: 0.005,
    reputationBonus: 2,
    assetValueRetention: 0.80,
    constructionRevenuePenalty: 0.005,
    constructionExpensePenalty: 0.005,
  },
  {
    id: 'automation_platform',
    name: 'Automation & Data Platform',
    icon: '🤖',
    description: 'Modernize core systems, workflows and analytics across the company.',
    baseCost: 12_000_000,
    weeks: 12,
    minValuation: 35_000_000,
    minReputation: 65,
    revenueBonus: 0.005,
    expenseReduction: 0.020,
    crisisReduction: 0.005,
    reputationBonus: 1,
    assetValueRetention: 0.72,
    constructionRevenuePenalty: 0.010,
    constructionExpensePenalty: 0.010,
  },
  {
    id: 'national_logistics',
    name: 'National Logistics Network',
    icon: '🚚',
    description: 'Create a national distribution and fulfillment backbone for higher operating scale.',
    baseCost: 20_000_000,
    weeks: 14,
    minValuation: 50_000_000,
    minReputation: 70,
    revenueBonus: 0.018,
    expenseReduction: 0.012,
    crisisReduction: 0.005,
    reputationBonus: 1,
    assetValueRetention: 0.78,
    constructionRevenuePenalty: 0.012,
    constructionExpensePenalty: 0.008,
  },
  {
    id: 'international_division',
    name: 'International Division',
    icon: '🌍',
    description: 'Establish the commercial, legal and operating structure needed to sell internationally.',
    baseCost: 35_000_000,
    weeks: 18,
    minValuation: 75_000_000,
    minReputation: 75,
    revenueBonus: 0.025,
    expenseReduction: 0,
    crisisReduction: 0.005,
    reputationBonus: 3,
    assetValueRetention: 0.72,
    constructionRevenuePenalty: 0.018,
    constructionExpensePenalty: 0.010,
  },
  {
    id: 'rd_campus',
    name: 'R&D Campus',
    icon: '🔬',
    description: 'Build a permanent research organization for new products, services and process innovation.',
    baseCost: 50_000_000,
    weeks: 20,
    minValuation: 100_000_000,
    minReputation: 80,
    revenueBonus: 0.028,
    expenseReduction: -0.005,
    crisisReduction: 0.005,
    reputationBonus: 3,
    assetValueRetention: 0.75,
    constructionRevenuePenalty: 0.020,
    constructionExpensePenalty: 0.012,
  },
  {
    id: 'global_distribution',
    name: 'Global Distribution Network',
    icon: '🛰️',
    description: 'Build a global supply, distribution and partner network for truly multinational scale.',
    baseCost: 90_000_000,
    weeks: 24,
    minValuation: 175_000_000,
    minReputation: 85,
    revenueBonus: 0.035,
    expenseReduction: 0.018,
    crisisReduction: 0.020,
    reputationBonus: 3,
    assetValueRetention: 0.80,
    constructionRevenuePenalty: 0.025,
    constructionExpensePenalty: 0.015,
  },
];

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function getCorporateScaleTier(business: Pick<OwnedBusiness, 'valuation'>): CorporateScaleTier {
  const valuation = Math.max(0, business.valuation ?? 0);
  if (valuation >= 175_000_000) return 'global';
  if (valuation >= 75_000_000) return 'major';
  if (valuation >= CORPORATE_SCALE_MIN_VALUATION) return 'corporate';
  return 'local';
}

export function getCorporateScaleLabel(tier: CorporateScaleTier): string {
  if (tier === 'global') return 'Global Corporation';
  if (tier === 'major') return 'Major Corporation';
  if (tier === 'corporate') return 'Corporation';
  return 'Local / Growth Business';
}

export function getCorporateCapexProject(projectId: string): CorporateCapexDefinition | null {
  return CORPORATE_CAPEX_PROJECTS.find((project) => project.id === projectId) ?? null;
}

export function getCorporateCapexCost(project: CorporateCapexDefinition, inflationMultiplier = 1): number {
  return Math.round(project.baseCost * Math.max(0.5, inflationMultiplier || 1));
}

export function getCorporateCapexOperatingEffects(business: OwnedBusiness) {
  let revenueBonus = 0;
  let expenseReduction = 0;
  let crisisReduction = 0;

  for (const completed of business.completedCorporateCapex ?? []) {
    const project = getCorporateCapexProject(completed.projectId);
    if (!project) continue;
    revenueBonus += project.revenueBonus;
    expenseReduction += project.expenseReduction;
    crisisReduction += project.crisisReduction;
  }

  const activeProject = business.activeCorporateCapex
    ? getCorporateCapexProject(business.activeCorporateCapex.projectId)
    : null;

  return {
    revenueBonus: clamp(revenueBonus, 0, 0.10),
    expenseReduction: clamp(expenseReduction, -0.02, 0.07),
    crisisReduction: clamp(crisisReduction, 0, 0.08),
    constructionRevenuePenalty: activeProject?.constructionRevenuePenalty ?? 0,
    constructionExpensePenalty: activeProject?.constructionExpensePenalty ?? 0,
  };
}

export function getCorporateCapexBookValue(business: OwnedBusiness): number {
  const completedValue = (business.completedCorporateCapex ?? []).reduce((sum, completed) => {
    const project = getCorporateCapexProject(completed.projectId);
    if (!project) return sum;
    return sum + Math.max(0, completed.costPaid ?? 0) * project.assetValueRetention;
  }, 0);
  const workInProgress = business.activeCorporateCapex
    ? Math.max(0, business.activeCorporateCapex.costPaid ?? 0) * 0.45
    : 0;
  return Math.round(completedValue + workInProgress);
}

export function canStartCorporateCapex(
  business: OwnedBusiness,
  project: CorporateCapexDefinition,
): { allowed: boolean; reason: string | null } {
  if (business.activeCorporateCapex) return { allowed: false, reason: 'Another corporate investment is already under construction.' };
  if ((business.completedCorporateCapex ?? []).some((item) => item.projectId === project.id)) {
    return { allowed: false, reason: 'Already completed.' };
  }
  if ((business.valuation ?? 0) < project.minValuation) {
    return { allowed: false, reason: `Requires €${Math.round(project.minValuation / 1_000_000)}M company value.` };
  }
  if ((business.reputation ?? 0) < project.minReputation) {
    return { allowed: false, reason: `Requires ${project.minReputation} reputation.` };
  }
  return { allowed: true, reason: null };
}

export function getNextCorporateCapexUnlock(business: OwnedBusiness): CorporateCapexDefinition | null {
  const completedIds = new Set((business.completedCorporateCapex ?? []).map((item) => item.projectId));
  return CORPORATE_CAPEX_PROJECTS
    .filter((project) => !completedIds.has(project.id))
    .sort((a, b) => a.minValuation - b.minValuation)[0] ?? null;
}

export function getCorporateCrisisBaseChance(business: OwnedBusiness): number {
  const tier = getCorporateScaleTier(business);
  const reputation = clamp(business.reputation ?? 50, 0, 100);
  const base = tier === 'global' ? 0.16 : tier === 'major' ? 0.145 : tier === 'corporate' ? 0.13 : 0.10;
  return Math.max(0.07, base - reputation * 0.00035);
}

function corporateCashCost(business: OwnedBusiness, pct: number, minimum: number, maximum: number): number {
  return Math.round(clamp((business.valuation ?? 0) * pct, minimum, maximum));
}

export function makeCorporateScaleCrisis(
  business: OwnedBusiness,
  globalWeek: number,
): BusinessPendingDecision {
  const cyberRapid = corporateCashCost(business, 0.006, 250_000, 4_000_000);
  const cyberRebuild = corporateCashCost(business, 0.012, 500_000, 8_000_000);
  const complianceFull = corporateCashCost(business, 0.010, 300_000, 8_000_000);
  const complianceLegal = corporateCashCost(business, 0.004, 200_000, 3_500_000);
  const leadershipInternal = corporateCashCost(business, 0.003, 150_000, 2_500_000);
  const leadershipSearch = corporateCashCost(business, 0.007, 300_000, 5_000_000);
  const supplyReroute = corporateCashCost(business, 0.008, 300_000, 6_000_000);
  const supplyDual = corporateCashCost(business, 0.012, 500_000, 9_000_000);
  const salesPush = corporateCashCost(business, 0.006, 250_000, 5_000_000);
  const diversify = corporateCashCost(business, 0.009, 400_000, 7_000_000);
  const recallFull = corporateCashCost(business, 0.010, 350_000, 8_000_000);
  const recallLimited = corporateCashCost(business, 0.005, 200_000, 4_000_000);

  const cyberTier = getBusinessInsuranceTier(business, 'cyber');
  const liabilityTier = getBusinessInsuranceTier(business, 'liability');

  const candidates: BusinessPendingDecision[] = [
    {
      id: `corporate_cyber_${business.id}_${globalWeek}`,
      kind: 'crisis',
      title: 'Cybersecurity Incident',
      description: `${business.name} has suffered a serious systems and data-security incident. At this scale, the response affects customers, operations and regulators.`,
      icon: '🛡️',
      insuranceArea: 'cyber',
      insuranceTierAtCreation: cyberTier,
      createdGlobalWeek: globalWeek,
      deadlineGlobalWeek: globalWeek + 3,
      defaultChoiceId: 'accept_outage',
      choices: [
        { id: 'rapid_response', text: 'Emergency Containment', description: 'Bring in specialist response teams and contain the incident quickly.', businessCashCost: cyberRapid, cashCostScale: 'absolute', revenueMultiplier: 0.99, expenseMultiplier: 1.02, reputationDelta: 1, durationWeeks: 4 },
        { id: 'rebuild_systems', text: 'Rebuild Critical Systems', description: 'Spend more now to harden the platform and restore confidence.', businessCashCost: cyberRebuild, cashCostScale: 'absolute', revenueMultiplier: 0.99, expenseMultiplier: 0.98, reputationDelta: 2, durationWeeks: 8 },
        { id: 'accept_outage', text: 'Contain Internally', description: 'Preserve cash but accept a longer outage and reputational damage.', revenueMultiplier: 0.85, expenseMultiplier: 1.03, reputationDelta: -3, durationWeeks: 6 },
      ],
    },
    {
      id: `corporate_regulatory_${business.id}_${globalWeek}`,
      kind: 'crisis',
      title: 'Regulatory Investigation',
      description: `Regulators have opened a formal review into part of ${business.name}'s operations.`,
      icon: '⚖️',
      insuranceArea: 'liability',
      insuranceTierAtCreation: liabilityTier,
      createdGlobalWeek: globalWeek,
      deadlineGlobalWeek: globalWeek + 3,
      defaultChoiceId: 'minimal_response',
      choices: [
        { id: 'full_remediation', text: 'Launch Full Remediation', description: 'Fund a comprehensive compliance program and cooperate fully.', businessCashCost: complianceFull, cashCostScale: 'absolute', revenueMultiplier: 0.98, expenseMultiplier: 1.01, reputationDelta: 2, durationWeeks: 5 },
        { id: 'legal_defense', text: 'Mount Legal Defense', description: 'Contest the broadest findings while maintaining operations.', businessCashCost: complianceLegal, cashCostScale: 'absolute', revenueMultiplier: 0.96, expenseMultiplier: 1.02, reputationDelta: -1, durationWeeks: 6 },
        { id: 'minimal_response', text: 'Minimum Required Response', description: 'Spend little now, but accept deeper operating and brand disruption.', revenueMultiplier: 0.90, expenseMultiplier: 1.08, reputationDelta: -4, durationWeeks: 8 },
      ],
    },
    {
      id: `corporate_executive_${business.id}_${globalWeek}`,
      kind: 'crisis',
      title: 'Executive Departure',
      description: `A senior leader has unexpectedly left ${business.name}, creating a coordination gap across the company.`,
      icon: '🧑‍💼',
      createdGlobalWeek: globalWeek,
      deadlineGlobalWeek: globalWeek + 3,
      defaultChoiceId: 'interim',
      choices: [
        { id: 'internal_succession', text: 'Promote Internal Leadership', description: 'Back an internal successor and stabilize teams quickly.', businessCashCost: leadershipInternal, cashCostScale: 'absolute', revenueMultiplier: 0.99, moraleDelta: 4, reputationDelta: 1, durationWeeks: 4 },
        { id: 'external_search', text: 'Hire an External Executive', description: 'Run an expensive search for stronger long-term capability.', businessCashCost: leadershipSearch, cashCostScale: 'absolute', revenueMultiplier: 0.96, expenseMultiplier: 1.03, durationWeeks: 6 },
        { id: 'interim', text: 'Use Interim Leadership', description: 'Preserve cash but accept weaker execution for a period.', revenueMultiplier: 0.90, moraleDelta: -5, durationWeeks: 6 },
      ],
    },
    {
      id: `corporate_supply_${business.id}_${globalWeek}`,
      kind: 'crisis',
      title: 'Supply Network Failure',
      description: `A major supply or distribution dependency has failed across ${business.name}'s wider operating network.`,
      icon: '🚧',
      createdGlobalWeek: globalWeek,
      deadlineGlobalWeek: globalWeek + 3,
      defaultChoiceId: 'wait_supply',
      choices: [
        { id: 'reroute', text: 'Emergency Rerouting', description: 'Pay for temporary logistics capacity and protect customer deliveries.', businessCashCost: supplyReroute, cashCostScale: 'absolute', revenueMultiplier: 0.98, expenseMultiplier: 1.04, durationWeeks: 4 },
        { id: 'dual_source', text: 'Build Dual Sourcing', description: 'Invest heavily in redundancy to stabilize the network.', businessCashCost: supplyDual, cashCostScale: 'absolute', revenueMultiplier: 0.99, expenseMultiplier: 1.01, reputationDelta: 1, durationWeeks: 8 },
        { id: 'wait_supply', text: 'Wait for Recovery', description: 'Avoid exceptional spending and accept a deep temporary revenue hit.', revenueMultiplier: 0.84, expenseMultiplier: 1.05, durationWeeks: 5 },
      ],
    },
    {
      id: `corporate_customer_${business.id}_${globalWeek}`,
      kind: 'crisis',
      title: 'Major Contract Lost',
      description: `${business.name} has lost a customer, contract or channel large enough to affect corporate-level planning.`,
      icon: '📑',
      createdGlobalWeek: globalWeek,
      deadlineGlobalWeek: globalWeek + 3,
      defaultChoiceId: 'absorb_loss',
      choices: [
        { id: 'replacement_campaign', text: 'Launch Replacement Campaign', description: 'Fund a major commercial push to replace the lost volume.', businessCashCost: salesPush, cashCostScale: 'absolute', revenueMultiplier: 0.98, expenseMultiplier: 1.04, marketShareDelta: 2, durationWeeks: 8 },
        { id: 'diversify_channels', text: 'Diversify Channels', description: 'Rebuild the sales mix more broadly, accepting a slower recovery.', businessCashCost: diversify, cashCostScale: 'absolute', revenueMultiplier: 0.96, expenseMultiplier: 1.02, reputationDelta: 2, durationWeeks: 10 },
        { id: 'absorb_loss', text: 'Absorb the Loss', description: 'Protect liquidity and accept the missing revenue temporarily.', revenueMultiplier: 0.82, marketShareDelta: -3, durationWeeks: 7 },
      ],
    },
    {
      id: `corporate_recall_${business.id}_${globalWeek}`,
      kind: 'crisis',
      title: 'Product / Service Recall',
      description: `A quality failure at ${business.name} has become large enough to require a coordinated corporate response.`,
      icon: '📣',
      insuranceArea: 'liability',
      insuranceTierAtCreation: liabilityTier,
      createdGlobalWeek: globalWeek,
      deadlineGlobalWeek: globalWeek + 3,
      defaultChoiceId: 'deny_scope',
      choices: [
        { id: 'full_recall', text: 'Voluntary Full Recall', description: 'Take the financial hit, fix the problem and protect long-term trust.', businessCashCost: recallFull, cashCostScale: 'absolute', revenueMultiplier: 0.94, reputationDelta: 1, durationWeeks: 5 },
        { id: 'limited_recall', text: 'Targeted Recall', description: 'Limit the scope and accept some continuing brand pressure.', businessCashCost: recallLimited, cashCostScale: 'absolute', revenueMultiplier: 0.90, reputationDelta: -2, durationWeeks: 6 },
        { id: 'deny_scope', text: 'Contest the Scope', description: 'Avoid a major immediate cost but risk a severe customer backlash.', revenueMultiplier: 0.80, expenseMultiplier: 1.06, reputationDelta: -6, durationWeeks: 8 },
      ],
    },
  ];

  return candidates[Math.floor(Math.random() * candidates.length)];
}

export function appendCompletedCorporateCapex(
  completed: CompletedCorporateCapex[],
  item: CompletedCorporateCapex,
): CompletedCorporateCapex[] {
  if (completed.some((existing) => existing.projectId === item.projectId)) return completed;
  return [...completed, item];
}
