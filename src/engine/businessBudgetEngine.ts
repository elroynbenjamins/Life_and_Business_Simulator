import {
  BusinessBudgetAllocationSnapshot,
  BusinessBudgetPlan,
  BusinessBudgetProfile,
  BusinessBudgetReserves,
  BusinessLoan,
  OwnedBusiness,
} from '../types/game';
import { BUSINESS_REINVESTMENT_AREAS, getBusinessReinvestmentCost } from './businessReinvestmentEngine';
import { getBusinessGovernanceEffects } from './businessGovernanceEngine';

export const BUSINESS_BUDGET_PRESETS: Record<BusinessBudgetProfile, {
  profile: BusinessBudgetProfile;
  label: string;
  description: string;
  targetReserveWeeks: number;
  dividendPct: number;
  debtPaydownPct: number;
  reinvestmentPct: number;
  growthPct: number;
}> = {
  // Legacy save alias. Runtime normalization maps this to Balanced so there is
  // no second "default" policy that actually behaves like Shareholder Returns.
  standard: {
    profile: 'standard',
    label: 'Legacy Standard',
    description: 'Legacy policy retained only for save compatibility; it normalizes to Balanced.',
    targetReserveWeeks: 8,
    dividendPct: 0.25,
    debtPaydownPct: 0.20,
    reinvestmentPct: 0.25,
    growthPct: 0.30,
  },
  balanced: {
    profile: 'balanced',
    label: 'Balanced',
    description: 'Split profit between owners, debt reduction, upkeep and growth.',
    targetReserveWeeks: 8,
    dividendPct: 0.25,
    debtPaydownPct: 0.20,
    reinvestmentPct: 0.25,
    growthPct: 0.30,
  },
  growth: {
    profile: 'growth',
    label: 'Growth',
    description: 'Retain most earnings for expansion and major capital investment.',
    targetReserveWeeks: 6,
    dividendPct: 0.10,
    debtPaydownPct: 0.10,
    reinvestmentPct: 0.20,
    growthPct: 0.60,
  },
  deleveraging: {
    profile: 'deleveraging',
    label: 'Deleveraging',
    description: 'Prioritize extra debt repayment until leverage is under control.',
    targetReserveWeeks: 10,
    dividendPct: 0.10,
    debtPaydownPct: 0.55,
    reinvestmentPct: 0.25,
    growthPct: 0.10,
  },
  resilient: {
    profile: 'resilient',
    label: 'Resilient',
    description: 'Build a deeper cash buffer and reserve heavily for required reinvestment.',
    targetReserveWeeks: 12,
    dividendPct: 0.10,
    debtPaydownPct: 0.15,
    reinvestmentPct: 0.45,
    growthPct: 0.30,
  },
  shareholder_returns: {
    profile: 'shareholder_returns',
    label: 'Returns',
    description: 'Favor distributions while still funding debt service and essential upkeep.',
    targetReserveWeeks: 6,
    dividendPct: 0.55,
    debtPaydownPct: 0.15,
    reinvestmentPct: 0.20,
    growthPct: 0.10,
  },
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function createBusinessBudgetPlan(
  profile: BusinessBudgetProfile = 'balanced',
  reviewYear = 1,
): BusinessBudgetPlan {
  const normalizedProfile: BusinessBudgetProfile = profile === 'standard' ? 'balanced' : profile;
  const preset = BUSINESS_BUDGET_PRESETS[normalizedProfile] ?? BUSINESS_BUDGET_PRESETS.balanced;
  return {
    profile: normalizedProfile,
    targetReserveWeeks: preset.targetReserveWeeks,
    dividendPct: preset.dividendPct,
    debtPaydownPct: preset.debtPaydownPct,
    reinvestmentPct: preset.reinvestmentPct,
    growthPct: preset.growthPct,
    reviewYear: Math.max(1, Math.round(reviewYear)),
  };
}

export function normalizeBusinessBudgetPlan(
  plan: Partial<BusinessBudgetPlan> | null | undefined,
  reviewYear = 1,
): BusinessBudgetPlan {
  const requestedProfile = plan?.profile && BUSINESS_BUDGET_PRESETS[plan.profile]
    ? plan.profile
    : 'balanced';
  const profile: BusinessBudgetProfile = requestedProfile === 'standard' ? 'balanced' : requestedProfile;
  const preset = BUSINESS_BUDGET_PRESETS[profile];
  const normalized = {
    profile,
    targetReserveWeeks: clamp(Math.round(plan?.targetReserveWeeks ?? preset.targetReserveWeeks), 4, 20),
    dividendPct: clamp(plan?.dividendPct ?? preset.dividendPct, 0, 0.80),
    debtPaydownPct: clamp(plan?.debtPaydownPct ?? preset.debtPaydownPct, 0, 0.70),
    reinvestmentPct: clamp(plan?.reinvestmentPct ?? preset.reinvestmentPct, 0, 0.70),
    growthPct: clamp(plan?.growthPct ?? preset.growthPct, 0, 0.80),
    reviewYear: Math.max(1, Math.round(plan?.reviewYear ?? reviewYear)),
  };
  const sum = normalized.dividendPct + normalized.debtPaydownPct + normalized.reinvestmentPct + normalized.growthPct;
  if (sum <= 1.0001) return normalized;

  const scale = 1 / sum;
  return {
    ...normalized,
    dividendPct: normalized.dividendPct * scale,
    debtPaydownPct: normalized.debtPaydownPct * scale,
    reinvestmentPct: normalized.reinvestmentPct * scale,
    growthPct: normalized.growthPct * scale,
  };
}

export function normalizeBusinessBudgetReserves(
  reserves: Partial<BusinessBudgetReserves> | null | undefined,
): BusinessBudgetReserves {
  return {
    reinvestment: Math.max(0, Math.round(reserves?.reinvestment ?? 0)),
    growth: Math.max(0, Math.round(reserves?.growth ?? 0)),
  };
}

export function getBusinessBudgetReserveTargets(
  business: OwnedBusiness,
  totalExpenses: number,
  inflationMultiplier = 1,
) {
  const plan = normalizeBusinessBudgetPlan(business.budgetPlan, business.foundedYear ?? 1);
  const governanceEffects = getBusinessGovernanceEffects(business);
  const operatingReserveTarget = Math.max(
    0,
    Math.round(Math.max(0, totalExpenses) * plan.targetReserveWeeks * (1 - governanceEffects.treasuryEfficiency)),
  );
  const reinvestmentReserveTarget = (Object.keys(BUSINESS_REINVESTMENT_AREAS) as Array<keyof typeof BUSINESS_REINVESTMENT_AREAS>)
    .reduce((sum, area) => sum + getBusinessReinvestmentCost(business, area, inflationMultiplier), 0);
  const growthReserveTarget = Math.round(
    Math.min(
      100_000_000,
      Math.max(50_000, Math.max(0, business.valuation ?? 0) * 0.08),
    ),
  );
  return {
    operatingReserveTarget,
    reinvestmentReserveTarget,
    growthReserveTarget,
  };
}

function applyExtraDebtPayment(
  loans: BusinessLoan[],
  amount: number,
): { loans: BusinessLoan[]; paid: number } {
  let remainingPayment = Math.max(0, Math.round(amount));
  if (remainingPayment <= 0) return { loans, paid: 0 };

  const ordered = [...loans].sort((a, b) => (b.interestRate ?? 0) - (a.interestRate ?? 0));
  const updates = new Map<string, BusinessLoan | null>();
  let paid = 0;

  for (const loan of ordered) {
    if (remainingPayment <= 0) break;
    const currentRemaining = Math.max(0, loan.remainingAmount ?? 0);
    if (currentRemaining <= 0) continue;
    const payment = Math.min(remainingPayment, currentRemaining);
    remainingPayment -= payment;
    paid += payment;
    const newRemaining = Math.max(0, currentRemaining - payment);
    if (newRemaining <= 0) {
      updates.set(loan.id, null);
      continue;
    }
    const weeksRemaining = Math.max(1, loan.weeksRemaining ?? 1);
    updates.set(loan.id, {
      ...loan,
      remainingAmount: newRemaining,
      weeklyPayment: Math.ceil(newRemaining / weeksRemaining),
    });
  }

  return {
    loans: loans
      .map((loan) => updates.has(loan.id) ? updates.get(loan.id)! : loan)
      .filter((loan): loan is BusinessLoan => !!loan),
    paid,
  };
}

export function applyBusinessBudgetWeek(args: {
  business: OwnedBusiness;
  balanceBeforeBudget: number;
  profit: number;
  totalExpenses: number;
  loans: BusinessLoan[];
  currentWeek: number;
  currentYear: number;
  inflationMultiplier: number;
}) {
  const {
    business,
    profit,
    totalExpenses,
    currentWeek,
    currentYear,
    inflationMultiplier,
  } = args;
  const plan = normalizeBusinessBudgetPlan(business.budgetPlan, currentYear);
  const existingReserves = normalizeBusinessBudgetReserves(business.budgetReserves);
  const targets = getBusinessBudgetReserveTargets(business, totalExpenses, inflationMultiplier);
  let balance = Math.round(args.balanceBeforeBudget);
  let loans = [...args.loans];

  const positiveProfit = Math.max(0, profit);
  const protectedBeforeDebt = targets.operatingReserveTarget
    + existingReserves.reinvestment
    + existingReserves.growth;
  const discretionaryCashBeforeDebt = Math.max(0, balance - protectedBeforeDebt);
  const desiredDebtPaydown = positiveProfit * plan.debtPaydownPct;
  const debtResult = applyExtraDebtPayment(
    loans,
    Math.min(desiredDebtPaydown, discretionaryCashBeforeDebt),
  );
  loans = debtResult.loans;
  balance -= debtResult.paid;

  const cashAboveOperatingReserve = Math.max(0, balance - targets.operatingReserveTarget);
  let reinvestmentReserve = existingReserves.reinvestment;
  let growthReserve = existingReserves.growth;

  const desiredReinvestment = positiveProfit * plan.reinvestmentPct;
  const reinvestmentRoom = Math.max(0, targets.reinvestmentReserveTarget - reinvestmentReserve);
  const reinvestmentAllocated = Math.min(
    desiredReinvestment,
    reinvestmentRoom,
    Math.max(0, cashAboveOperatingReserve - reinvestmentReserve - growthReserve),
  );
  reinvestmentReserve += reinvestmentAllocated;

  const desiredGrowth = positiveProfit * plan.growthPct;
  const growthRoom = Math.max(0, targets.growthReserveTarget - growthReserve);
  const growthAllocated = Math.min(
    desiredGrowth,
    growthRoom,
    Math.max(0, cashAboveOperatingReserve - reinvestmentReserve - growthReserve),
  );
  growthReserve += growthAllocated;

  const protectedCash = targets.operatingReserveTarget + reinvestmentReserve + growthReserve;
  const desiredDividend = positiveProfit * plan.dividendPct;
  const dividendPaid = Math.round(
    Math.min(desiredDividend, Math.max(0, balance - protectedCash)),
  );
  balance -= dividendPaid;

  // Earmarks are labels inside the same bank balance, not extra assets.
  // Clamp them if a shock or debt payment consumed cash unexpectedly.
  const maxEarmarked = Math.max(0, balance - targets.operatingReserveTarget);
  const earmarkedTotal = reinvestmentReserve + growthReserve;
  if (earmarkedTotal > maxEarmarked && earmarkedTotal > 0) {
    const factor = maxEarmarked / earmarkedTotal;
    reinvestmentReserve = Math.round(reinvestmentReserve * factor);
    growthReserve = Math.round(growthReserve * factor);
  }

  const snapshot: BusinessBudgetAllocationSnapshot = {
    year: currentYear,
    week: currentWeek,
    profitBasis: Math.round(positiveProfit),
    operatingReserveTarget: targets.operatingReserveTarget,
    reinvestmentReserveTarget: targets.reinvestmentReserveTarget,
    growthReserveTarget: targets.growthReserveTarget,
    reinvestmentAllocated: Math.round(reinvestmentAllocated),
    growthAllocated: Math.round(growthAllocated),
    extraDebtPaid: Math.round(debtResult.paid),
    dividendPaid,
    closingReinvestmentReserve: Math.round(reinvestmentReserve),
    closingGrowthReserve: Math.round(growthReserve),
  };

  return {
    plan,
    balance: Math.round(balance),
    loans,
    reserves: {
      reinvestment: Math.round(reinvestmentReserve),
      growth: Math.round(growthReserve),
    },
    dividendPaid,
    snapshot,
  };
}

export function consumeBusinessBudgetReserve(
  reserves: Partial<BusinessBudgetReserves> | null | undefined,
  bucket: keyof BusinessBudgetReserves,
  amount: number,
): BusinessBudgetReserves {
  const normalized = normalizeBusinessBudgetReserves(reserves);
  const used = Math.min(normalized[bucket], Math.max(0, Math.round(amount)));
  return {
    ...normalized,
    [bucket]: Math.max(0, normalized[bucket] - used),
  };
}

export function isBusinessBudgetReviewDue(
  business: OwnedBusiness,
  currentYear: number,
): boolean {
  if ((business.level ?? 0) < 3) return false;
  const plan = normalizeBusinessBudgetPlan(business.budgetPlan, business.foundedYear ?? currentYear);
  return plan.reviewYear < currentYear;
}
