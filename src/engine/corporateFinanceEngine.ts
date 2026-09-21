import {
  BusinessLoan,
  CorporateCreditRating,
  CorporateFinancingType,
  OwnedBusiness,
} from '../types/game';
import { getCorporateScaleTier } from './corporateScaleEngine';

export interface CorporateCreditProfile {
  rating: CorporateCreditRating;
  score: number;
  totalDebt: number;
  debtToValue: number;
  weeklyDebtService: number;
  interestCoverage: number;
  maxDebtCapacity: number;
  remainingDebtCapacity: number;
  revolverLimit: number;
  revolverOutstanding: number;
  revolverAvailable: number;
}

export interface CorporateFinancingQuote {
  type: CorporateFinancingType;
  amount: number;
  cashContribution: number;
  arrangementFee: number;
  debtPrincipal: number;
  interestRate: number;
  durationWeeks: number;
  totalRepayment: number;
  weeklyPayment: number;
  allowed: boolean;
  reason: string | null;
}

const RATING_RATE: Record<CorporateCreditRating, number> = {
  AAA: 0.045,
  AA: 0.0525,
  A: 0.060,
  BBB: 0.0725,
  BB: 0.090,
  B: 0.115,
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function getCorporateDebt(business: OwnedBusiness): number {
  return (business.businessLoans ?? []).reduce(
    (sum, loan) => sum + Math.max(0, loan.remainingAmount ?? 0),
    0,
  );
}

export function getCorporateWeeklyDebtService(business: OwnedBusiness): number {
  return (business.businessLoans ?? []).reduce(
    (sum, loan) => sum + Math.max(0, loan.weeklyPayment ?? 0),
    0,
  );
}

function ratingFromScore(score: number): CorporateCreditRating {
  if (score >= 90) return 'AAA';
  if (score >= 80) return 'AA';
  if (score >= 70) return 'A';
  if (score >= 60) return 'BBB';
  if (score >= 48) return 'BB';
  return 'B';
}

export function getCorporateCreditProfile(business: OwnedBusiness): CorporateCreditProfile {
  const valuation = Math.max(1, business.valuation ?? 0);
  const totalDebt = getCorporateDebt(business);
  const weeklyDebtService = getCorporateWeeklyDebtService(business);
  const debtToValue = totalDebt / valuation;
  const revenue = Math.max(1, business.lastWeekRevenue ?? 0);
  const profit = business.lastWeekProfit ?? 0;
  const operatingCashFlowBeforeDebt = profit + weeklyDebtService;
  const interestCoverage = weeklyDebtService > 0
    ? operatingCashFlowBeforeDebt / weeklyDebtService
    : operatingCashFlowBeforeDebt > 0 ? 10 : 1;

  const scaleTier = getCorporateScaleTier(business);
  const scaleScore = scaleTier === 'global' ? 20 : scaleTier === 'major' ? 17 : scaleTier === 'corporate' ? 14 : 5;
  const reputationScore = clamp((business.reputation ?? 0) / 100 * 25, 0, 25);
  const margin = profit / revenue;
  const profitabilityScore = margin >= 0.15 ? 20
    : margin >= 0.08 ? 17
      : margin >= 0.03 ? 13
        : margin >= 0 ? 9
          : 2;
  const leverageScore = debtToValue <= 0.10 ? 25
    : debtToValue <= 0.20 ? 21
      : debtToValue <= 0.30 ? 16
        : debtToValue <= 0.40 ? 10
          : debtToValue <= 0.50 ? 5
            : 0;
  const coverageScore = interestCoverage >= 4 ? 10
    : interestCoverage >= 2.5 ? 8
      : interestCoverage >= 1.5 ? 5
        : interestCoverage >= 1 ? 2
          : 0;

  const score = Math.round(clamp(scaleScore + reputationScore + profitabilityScore + leverageScore + coverageScore, 0, 100));
  const rating = ratingFromScore(score);

  // Corporate debt is capped at 45% of enterprise value. Lower-rated firms
  // receive a tighter effective ceiling even if the hard leverage cap is unused.
  const ratingCapacityFactor: Record<CorporateCreditRating, number> = {
    AAA: 0.45,
    AA: 0.45,
    A: 0.42,
    BBB: 0.38,
    BB: 0.30,
    B: 0.20,
  };
  const maxDebtCapacity = Math.round(valuation * ratingCapacityFactor[rating]);
  const remainingDebtCapacity = Math.max(0, maxDebtCapacity - totalDebt);

  const revolverBase = valuation * (rating === 'B' ? 0.04 : rating === 'BB' ? 0.06 : 0.08);
  const revolverLimit = Math.round(Math.min(25_000_000, Math.max(1_000_000, revolverBase)));
  const revolverOutstanding = (business.businessLoans ?? [])
    .filter((loan) => loan.purpose === 'corporate_revolver')
    .reduce((sum, loan) => sum + Math.max(0, loan.remainingAmount ?? 0), 0);
  const revolverAvailable = Math.max(0, Math.min(revolverLimit - revolverOutstanding, remainingDebtCapacity));

  return {
    rating,
    score,
    totalDebt,
    debtToValue,
    weeklyDebtService,
    interestCoverage,
    maxDebtCapacity,
    remainingDebtCapacity,
    revolverLimit,
    revolverOutstanding,
    revolverAvailable,
  };
}

export function getCorporateBaseRate(rating: CorporateCreditRating): number {
  return RATING_RATE[rating];
}

function buildDebtQuote(
  business: OwnedBusiness,
  type: CorporateFinancingType,
  amount: number,
  durationWeeks: number,
  ratePremium: number,
  arrangementFeeRate: number,
  loanRateReduction = 0,
): CorporateFinancingQuote {
  const profile = getCorporateCreditProfile(business);
  const requested = Math.max(0, Math.round(amount));
  const rate = Math.max(0.03, getCorporateBaseRate(profile.rating) + ratePremium - clamp(loanRateReduction, 0, 0.05));
  const arrangementFee = Math.round(requested * arrangementFeeRate);
  const totalRepayment = Math.round(requested * (1 + rate));
  const weeklyPayment = durationWeeks > 0 ? Math.ceil(totalRepayment / durationWeeks) : 0;

  let allowed = true;
  let reason: string | null = null;
  if (getCorporateScaleTier(business) === 'local') {
    allowed = false;
    reason = 'Corporate financing unlocks at €25M company value.';
  } else if (requested <= 0) {
    allowed = false;
    reason = 'Choose a positive financing amount.';
  } else if (totalRepayment > profile.remainingDebtCapacity) {
    allowed = false;
    reason = 'This would exceed the company’s credit capacity after scheduled interest.';
  }

  const operatingCashFlowBeforeDebt = Math.max(
    0,
    (business.lastWeekProfit ?? 0) + profile.weeklyDebtService,
  );
  const projectedDebtService = profile.weeklyDebtService + weeklyPayment;
  if (allowed && operatingCashFlowBeforeDebt <= 0) {
    allowed = false;
    reason = 'The company needs positive operating cash flow before taking new corporate debt.';
  } else if (allowed && projectedDebtService > operatingCashFlowBeforeDebt * 0.65) {
    allowed = false;
    reason = 'Projected debt service would consume too much current operating cash flow.';
  }

  return {
    type,
    amount: requested,
    cashContribution: arrangementFee,
    arrangementFee,
    debtPrincipal: requested,
    interestRate: rate,
    durationWeeks,
    totalRepayment,
    weeklyPayment,
    allowed,
    reason,
  };
}

export function getRevolverDrawQuote(
  business: OwnedBusiness,
  amount: number,
  loanRateReduction = 0,
): CorporateFinancingQuote {
  const profile = getCorporateCreditProfile(business);
  const quote = buildDebtQuote(business, 'revolver', amount, 60, 0.025, 0.005, loanRateReduction);
  if (quote.allowed && quote.amount > profile.revolverAvailable) {
    return { ...quote, allowed: false, reason: 'Requested draw exceeds the available revolving credit line.' };
  }
  if (quote.allowed && profile.rating === 'B') {
    return { ...quote, allowed: false, reason: 'B-rated companies cannot draw the corporate revolver.' };
  }
  return quote;
}

export function getBondQuote(
  business: OwnedBusiness,
  amount: number,
  loanRateReduction = 0,
): CorporateFinancingQuote {
  const profile = getCorporateCreditProfile(business);
  const quote = buildDebtQuote(business, 'bond', amount, 200, 0.005, 0.0075, loanRateReduction);
  const tier = getCorporateScaleTier(business);
  if (quote.allowed && tier !== 'major' && tier !== 'global') {
    return { ...quote, allowed: false, reason: 'Corporate bonds unlock at €75M company value.' };
  }
  if (quote.allowed && (profile.rating === 'B' || profile.rating === 'BB')) {
    return { ...quote, allowed: false, reason: 'A BBB credit rating or better is required to issue bonds.' };
  }
  const existingBonds = (business.businessLoans ?? []).filter((loan) => loan.purpose === 'corporate_bond').length;
  if (quote.allowed && existingBonds >= 2) {
    return { ...quote, allowed: false, reason: 'Maximum of two bond tranches outstanding.' };
  }
  return quote;
}

export function getProjectFinanceQuote(
  business: OwnedBusiness,
  projectCost: number,
  loanRateReduction = 0,
): CorporateFinancingQuote {
  const profile = getCorporateCreditProfile(business);
  const debtPrincipal = Math.round(Math.max(0, projectCost) * 0.60);
  const equityContribution = Math.max(0, Math.round(projectCost) - debtPrincipal);
  const rate = Math.max(0.03, getCorporateBaseRate(profile.rating) + 0.015 - clamp(loanRateReduction, 0, 0.05));
  const arrangementFee = Math.round(debtPrincipal * 0.01);
  const durationWeeks = 120;
  const totalRepayment = Math.round(debtPrincipal * (1 + rate));
  const weeklyPayment = Math.ceil(totalRepayment / durationWeeks);
  let allowed = getCorporateScaleTier(business) !== 'local';
  let reason: string | null = allowed ? null : 'Project finance unlocks at €25M company value.';

  if (allowed && profile.rating === 'B') {
    allowed = false;
    reason = 'A BB credit rating or better is required for project finance.';
  }
  if (allowed && totalRepayment > profile.remainingDebtCapacity) {
    allowed = false;
    reason = 'This project would exceed the company’s credit capacity after scheduled interest.';
  }
  // Avoid financing structures where scheduled debt service would absorb almost
  // all current operating profit before construction disruption.
  const projectedDebtService = profile.weeklyDebtService + weeklyPayment;
  if (allowed && projectedDebtService > Math.max(1, business.lastWeekProfit ?? 0) * 0.70) {
    allowed = false;
    reason = 'Projected debt service is too high for current earnings.';
  }

  return {
    type: 'project_finance',
    amount: Math.round(projectCost),
    cashContribution: equityContribution + arrangementFee,
    arrangementFee,
    debtPrincipal,
    interestRate: rate,
    durationWeeks,
    totalRepayment,
    weeklyPayment,
    allowed,
    reason,
  };
}

export function createCorporateLoan(
  quote: CorporateFinancingQuote,
  globalWeek: number,
  projectId: string | null = null,
): BusinessLoan {
  const purpose: BusinessLoan['purpose'] = quote.type === 'revolver'
    ? 'corporate_revolver'
    : quote.type === 'project_finance'
      ? 'project_finance'
      : 'corporate_bond';

  return {
    id: `corp_${quote.type}_${globalWeek}_${Math.random().toString(36).slice(2, 7)}`,
    amount: quote.debtPrincipal,
    remainingAmount: quote.totalRepayment,
    weeklyPayment: quote.weeklyPayment,
    weeksRemaining: quote.durationWeeks,
    interestRate: quote.interestRate,
    purpose,
    financingType: quote.type,
    projectId,
    issuedGlobalWeek: globalWeek,
  };
}
