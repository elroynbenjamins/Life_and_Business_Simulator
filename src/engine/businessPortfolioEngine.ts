import { HoldingCompany, OwnedBusiness, SoldBusinessRecord } from '../types/game';
import { getBusinessReinvestmentUrgency } from './businessReinvestmentEngine';
import { getBusinessCoverageGaps } from './businessInsuranceEngine';
import { isBusinessBudgetReviewDue } from './businessBudgetEngine';
import { getBusinessGovernanceAttentionReason } from './businessGovernanceEngine';
import { getCorporateWorkforceAttentionReason } from './businessWorkforceEngine';
import { getCorporateManagementAttentionReason } from './corporateReportingEngine';

export interface BusinessSaleQuote {
  grossSalePrice: number;
  debtSettlement: number;
  saleTransactionCost: number;
  saleTransactionCostRate: number;
  heldWeeks: number | null;
  netSaleProceeds: number;
  investmentBasis: number | null;
  totalPlayerDistributions: number;
  lifetimeCashResult: number | null;
  lifetimeReturnPct: number | null;
}

export interface BusinessEmpireSummary {
  totalValue: number;
  totalDebt: number;
  netBusinessEquity: number;
  weeklyProfit: number;
  operatingCash: number;
  holdingCash: number;
  totalEmpireCash: number;
  attentionCount: number;
  acquisitionCount: number;
  leveragedAcquisitionCount: number;
}

export function getBusinessDebt(business: OwnedBusiness): number {
  return (business.businessLoans ?? []).reduce(
    (sum, loan) => sum + Math.max(0, loan.remainingAmount ?? 0),
    0,
  );
}

export function getBusinessInvestmentBasis(business: OwnedBusiness): number | null {
  const tracked = business.capitalInvested;
  if (typeof tracked === 'number' && Number.isFinite(tracked) && tracked >= 0) return tracked;
  if (business.acquisition) {
    return Math.max(
      0,
      (business.acquisition.cashContribution ?? business.acquisition.purchasePrice ?? 0)
        + (business.acquisition.acquisitionTransactionCost ?? 0)
        + (business.acquisition.additionalCapitalInvested ?? 0),
    );
  }
  return null;
}

export function getBusinessEquityReturn(business: OwnedBusiness) {
  const debt = getBusinessDebt(business);
  const equityValue = Math.max(0, (business.valuation ?? 0) - debt);
  const investmentBasis = getBusinessInvestmentBasis(business);
  const totalPlayerDistributions = Math.max(0, business.totalPlayerDistributions ?? 0);
  const lifetimeValue = equityValue + totalPlayerDistributions;
  const gain = investmentBasis == null ? null : lifetimeValue - investmentBasis;
  const returnPct = investmentBasis != null && investmentBasis > 0 && gain != null
    ? gain / investmentBasis * 100
    : null;

  return {
    debt,
    equityValue,
    investmentBasis,
    totalPlayerDistributions,
    lifetimeValue,
    gain,
    returnPct,
  };
}

export function getBusinessHoldWeeks(
  business: OwnedBusiness,
  week?: number,
  year?: number,
): number | null {
  if (week == null || year == null) return null;
  const currentGlobalWeek = Math.max(1, ((year - 1) * 20) + week);
  const startGlobalWeek = business.acquisition?.acquiredGlobalWeek
    ?? Math.max(1, ((business.foundedYear - 1) * 20) + business.foundedWeek);
  return Math.max(0, currentGlobalWeek - startGlobalWeek);
}

export function getBusinessSaleTransactionCostRate(
  business: OwnedBusiness,
  week?: number,
  year?: number,
): number {
  // Ordinary business sales keep a modest broker/legal cost. Acquisition exits
  // carry extra short-hold friction that fades over two in-game years, so a
  // genuine turnaround can still be sold without an arbitrary lockout.
  if (!business.acquisition) return 0.025;
  const heldWeeks = getBusinessHoldWeeks(business, week, year);
  if (heldWeeks == null) return 0.025;
  const shortHoldWeight = Math.max(0, Math.min(1, 1 - heldWeeks / 40));
  return 0.025 + 0.045 * shortHoldWeight;
}

export function getBusinessSaleQuote(
  business: OwnedBusiness,
  week?: number,
  year?: number,
): BusinessSaleQuote {
  const grossSalePrice = Math.max(0, business.valuation ?? 0);
  const debtSettlement = getBusinessDebt(business);
  const heldWeeks = getBusinessHoldWeeks(business, week, year);
  const saleTransactionCostRate = getBusinessSaleTransactionCostRate(business, week, year);
  const saleTransactionCost = Math.round(grossSalePrice * saleTransactionCostRate);
  const netSaleProceeds = Math.max(0, grossSalePrice - debtSettlement - saleTransactionCost);
  const investmentBasis = getBusinessInvestmentBasis(business);
  const totalPlayerDistributions = Math.max(0, business.totalPlayerDistributions ?? 0);
  const lifetimeCashResult = investmentBasis == null
    ? null
    : netSaleProceeds + totalPlayerDistributions - investmentBasis;
  const lifetimeReturnPct = investmentBasis != null && investmentBasis > 0 && lifetimeCashResult != null
    ? lifetimeCashResult / investmentBasis * 100
    : null;

  return {
    grossSalePrice,
    debtSettlement,
    saleTransactionCost,
    saleTransactionCostRate,
    heldWeeks,
    netSaleProceeds,
    investmentBasis,
    totalPlayerDistributions,
    lifetimeCashResult,
    lifetimeReturnPct,
  };
}

export function buildSoldBusinessRecord(
  business: OwnedBusiness,
  week: number,
  year: number,
  holdingCompanyName: string | null = null,
): SoldBusinessRecord {
  const soldGlobalWeek = Math.max(1, ((year - 1) * 20) + week);
  const startGlobalWeek = business.acquisition?.acquiredGlobalWeek
    ?? Math.max(1, ((business.foundedYear - 1) * 20) + business.foundedWeek);
  const quote = getBusinessSaleQuote(business, week, year);

  return {
    id: `sold_${business.id}_${soldGlobalWeek}`,
    businessId: business.id,
    name: business.name,
    typeId: business.typeId,
    soldWeek: week,
    soldYear: year,
    soldGlobalWeek,
    foundedWeek: business.foundedWeek,
    foundedYear: business.foundedYear,
    heldWeeks: Math.max(0, soldGlobalWeek - startGlobalWeek),
    grossSalePrice: quote.grossSalePrice,
    debtSettlement: quote.debtSettlement,
    saleTransactionCost: quote.saleTransactionCost,
    saleTransactionCostRate: quote.saleTransactionCostRate,
    netSaleProceeds: quote.netSaleProceeds,
    investmentBasis: quote.investmentBasis,
    totalPlayerDistributions: quote.totalPlayerDistributions,
    lifetimeCashResult: quote.lifetimeCashResult,
    lifetimeReturnPct: quote.lifetimeReturnPct,
    wasAcquisition: Boolean(business.acquisition),
    acquisitionPurchasePrice: business.acquisition?.purchasePrice ?? null,
    acquisitionTransactionCost: business.acquisition?.acquisitionTransactionCost ?? null,
    holdingCompanyName,
  };
}

export function getBusinessEmpireSummary(
  businesses: OwnedBusiness[],
  holdingCompanies: HoldingCompany[] = [],
  currentYear = 1,
  currentWeek = 1,
  inflationMultiplier = 1,
): BusinessEmpireSummary {
  const totalValue = (businesses ?? []).reduce((sum, business) => sum + Math.max(0, business.valuation ?? 0), 0);
  const totalDebt = (businesses ?? []).reduce((sum, business) => sum + getBusinessDebt(business), 0);
  const weeklyProfit = (businesses ?? []).reduce((sum, business) => sum + (business.lastWeekProfit ?? 0), 0);
  const operatingCash = (businesses ?? []).reduce((sum, business) => sum + Math.max(0, business.balance ?? 0), 0);
  const holdingCash = (holdingCompanies ?? []).reduce((sum, holding) => sum + Math.max(0, holding.cashReserve ?? 0), 0);
  const globalWeek = Math.max(1, ((currentYear - 1) * 20) + currentWeek);
  const attentionCount = (businesses ?? []).filter((business) =>
    Boolean(business.pendingDecision)
    || Boolean(business.pendingRetention)
    || (business.acquisition?.integrationStrategy === 'pending')
    || Boolean(getBusinessReinvestmentUrgency(business))
    || getBusinessCoverageGaps(business).length > 0
    || isBusinessBudgetReviewDue(business, currentYear)
    || Boolean(getBusinessGovernanceAttentionReason(business))
    || Boolean(getCorporateWorkforceAttentionReason(business))
    || Boolean(getCorporateManagementAttentionReason(business, globalWeek, inflationMultiplier))
  ).length;
  const acquisitionCount = (businesses ?? []).filter((business) => Boolean(business.acquisition)).length;
  const leveragedAcquisitionCount = (businesses ?? []).filter((business) =>
    Boolean(business.acquisition) && getBusinessDebt(business) > 0
  ).length;

  return {
    totalValue,
    totalDebt,
    netBusinessEquity: Math.max(0, totalValue - totalDebt),
    weeklyProfit,
    operatingCash,
    holdingCash,
    totalEmpireCash: operatingCash + holdingCash,
    attentionCount,
    acquisitionCount,
    leveragedAcquisitionCount,
  };
}
