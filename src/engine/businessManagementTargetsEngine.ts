import {
  BusinessManagementTargetPlan,
  BusinessManagementTargetProfile,
  CorporateKpiHistoryPoint,
  OwnedBusiness,
} from '../types/game';

export const BUSINESS_MANAGEMENT_TARGET_PROFILES: Record<BusinessManagementTargetProfile, {
  profile: BusinessManagementTargetProfile;
  label: string;
  description: string;
  revenueGrowthPct: number;
  marginImprovementPctPoints: number;
  minimumProfitMargin: number;
  marginRecoveryStep: number;
  payrollCeiling: number;
  payrollImprovementPctPoints: number;
  debtReductionPct: number;
  maintenanceFloor: number;
}> = {
  balanced: {
    profile: 'balanced',
    label: 'Balanced',
    description: 'Steady growth with improving margins, disciplined payroll, modest debt reduction and current infrastructure.',
    revenueGrowthPct: 0.05,
    marginImprovementPctPoints: 0.02,
    minimumProfitMargin: 0.15,
    marginRecoveryStep: 0.05,
    payrollCeiling: 0.32,
    payrollImprovementPctPoints: 0.04,
    debtReductionPct: 0.05,
    maintenanceFloor: 75,
  },
  growth: {
    profile: 'growth',
    label: 'Growth',
    description: 'Push revenue harder while accepting a wider payroll envelope and slower deleveraging.',
    revenueGrowthPct: 0.12,
    marginImprovementPctPoints: 0,
    minimumProfitMargin: 0.12,
    marginRecoveryStep: 0.04,
    payrollCeiling: 0.38,
    payrollImprovementPctPoints: 0.02,
    debtReductionPct: 0,
    maintenanceFloor: 70,
  },
  margin: {
    profile: 'margin',
    label: 'Margin',
    description: 'Prioritize profitability and payroll efficiency over aggressive top-line expansion.',
    revenueGrowthPct: 0.03,
    marginImprovementPctPoints: 0.05,
    minimumProfitMargin: 0.20,
    marginRecoveryStep: 0.06,
    payrollCeiling: 0.28,
    payrollImprovementPctPoints: 0.05,
    debtReductionPct: 0.05,
    maintenanceFloor: 75,
  },
  deleveraging: {
    profile: 'deleveraging',
    label: 'Deleveraging',
    description: 'Protect operating performance while making visible quarterly progress on business debt.',
    revenueGrowthPct: 0.02,
    marginImprovementPctPoints: 0.02,
    minimumProfitMargin: 0.15,
    marginRecoveryStep: 0.05,
    payrollCeiling: 0.32,
    payrollImprovementPctPoints: 0.04,
    debtReductionPct: 0.15,
    maintenanceFloor: 75,
  },
  resilient: {
    profile: 'resilient',
    label: 'Resilient',
    description: 'Favor a healthy operating base: strong upkeep, moderate growth, manageable payroll and steady debt reduction.',
    revenueGrowthPct: 0.03,
    marginImprovementPctPoints: 0.01,
    minimumProfitMargin: 0.15,
    marginRecoveryStep: 0.04,
    payrollCeiling: 0.34,
    payrollImprovementPctPoints: 0.03,
    debtReductionPct: 0.05,
    maintenanceFloor: 85,
  },
};

export type BusinessManagementTargetMetricId =
  | 'revenue'
  | 'margin'
  | 'payroll'
  | 'debt'
  | 'maintenance';

export type BusinessManagementTargetStatus = 'met' | 'near' | 'missed' | 'neutral';

export interface BusinessManagementTargetResult {
  id: BusinessManagementTargetMetricId;
  label: string;
  actual: number;
  target: number;
  variance: number;
  status: BusinessManagementTargetStatus;
  direction: 'higher' | 'lower';
  scheduleBenchmark?: number | null;
}

export interface BusinessManagementTargetProgress {
  plan: BusinessManagementTargetPlan;
  results: BusinessManagementTargetResult[];
  metCount: number;
  nearCount: number;
  missedCount: number;
  totalCount: number;
}

interface ManagementReportMetrics {
  weeksTracked: number;
  periodRevenue: number;
  profitMargin: number;
  payrollToRevenueRatio: number;
  averageMaintenanceCondition: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function totalDebt(business: OwnedBusiness): number {
  return (business.businessLoans ?? []).reduce(
    (sum, loan) => sum + Math.max(0, loan.remainingAmount ?? 0),
    0,
  );
}

function getQuarterPeriod(globalWeek: number) {
  const safeWeek = Math.max(1, Math.round(globalWeek || 1));
  const weekInYear = ((safeWeek - 1) % 20) + 1;
  const year = Math.floor((safeWeek - 1) / 20) + 1;
  const quarter = Math.floor((weekInYear - 1) / 5) + 1;
  const yearStart = safeWeek - weekInYear + 1;
  const startGlobalWeek = yearStart + (quarter - 1) * 5;
  return { year, quarter, startGlobalWeek };
}

function aggregateBaseline(points: CorporateKpiHistoryPoint[]) {
  if (points.length === 0) {
    return {
      weeklyRevenue: 0,
      profitMargin: 0,
      payrollRatio: 0,
    };
  }
  const revenue = points.reduce((sum, point) => sum + Math.max(0, point.revenue), 0);
  const profit = points.reduce((sum, point) => sum + point.profit, 0);
  const payroll = points.reduce((sum, point) => sum + Math.max(0, point.payroll), 0);
  return {
    weeklyRevenue: revenue / points.length,
    profitMargin: revenue > 0 ? profit / revenue : 0,
    payrollRatio: revenue > 0 ? payroll / revenue : 0,
  };
}

function getBaseline(business: OwnedBusiness, globalWeek: number) {
  const period = getQuarterPeriod(globalWeek);
  const priorStart = period.startGlobalWeek - 5;
  const priorEnd = period.startGlobalWeek - 1;
  const previousQuarter = (business.corporateKpiHistory ?? []).filter(
    (point) => point.globalWeek >= priorStart && point.globalWeek <= priorEnd,
  );
  const historical = aggregateBaseline(previousQuarter);

  const fallbackRevenue = Math.max(0, business.lastWeekRevenue ?? 0);
  const fallbackMargin = fallbackRevenue > 0
    ? (business.lastWeekProfit ?? 0) / fallbackRevenue
    : 0;
  const latestSnapshot = [...(business.corporateKpiHistory ?? [])]
    .filter((point) => point.globalWeek < period.startGlobalWeek)
    .sort((a, b) => b.globalWeek - a.globalWeek)[0];
  const fallbackPayrollRatio = latestSnapshot && latestSnapshot.revenue > 0
    ? latestSnapshot.payroll / latestSnapshot.revenue
    : 0.32;

  return {
    ...period,
    weeklyRevenue: historical.weeklyRevenue > 0 ? historical.weeklyRevenue : fallbackRevenue,
    profitMargin: previousQuarter.length > 0 ? historical.profitMargin : fallbackMargin,
    payrollRatio: previousQuarter.length > 0 ? historical.payrollRatio : fallbackPayrollRatio,
    debt: totalDebt(business),
  };
}

function targetMargin(baseline: number, profile: typeof BUSINESS_MANAGEMENT_TARGET_PROFILES[BusinessManagementTargetProfile]) {
  if (baseline >= profile.minimumProfitMargin) {
    return clamp(baseline + profile.marginImprovementPctPoints, -0.20, 0.60);
  }
  return clamp(
    Math.min(profile.minimumProfitMargin, baseline + profile.marginRecoveryStep),
    -0.20,
    0.60,
  );
}

function targetPayrollRatio(
  baseline: number,
  profile: typeof BUSINESS_MANAGEMENT_TARGET_PROFILES[BusinessManagementTargetProfile],
) {
  if (baseline <= 0) return profile.payrollCeiling;
  if (baseline <= profile.payrollCeiling) return profile.payrollCeiling;
  return Math.max(profile.payrollCeiling, baseline - profile.payrollImprovementPctPoints);
}

function createPlanFromBaseline(
  business: OwnedBusiness,
  profileId: BusinessManagementTargetProfile,
  globalWeek: number,
  preserved?: Pick<BusinessManagementTargetPlan,
    'baselineWeeklyRevenue' | 'baselineProfitMargin' | 'baselinePayrollToRevenueRatio' | 'baselineDebt'
  >,
): BusinessManagementTargetPlan {
  const profile = BUSINESS_MANAGEMENT_TARGET_PROFILES[profileId]
    ?? BUSINESS_MANAGEMENT_TARGET_PROFILES.balanced;
  const baseline = getBaseline(business, globalWeek);
  const baselineWeeklyRevenue = preserved?.baselineWeeklyRevenue ?? baseline.weeklyRevenue;
  const baselineProfitMargin = preserved?.baselineProfitMargin ?? baseline.profitMargin;
  const baselinePayrollToRevenueRatio = preserved?.baselinePayrollToRevenueRatio ?? baseline.payrollRatio;
  const baselineDebt = preserved?.baselineDebt ?? baseline.debt;

  return {
    profile: profileId,
    year: baseline.year,
    quarter: baseline.quarter,
    periodStartGlobalWeek: baseline.startGlobalWeek,
    createdGlobalWeek: Math.max(1, Math.round(globalWeek)),
    baselineWeeklyRevenue: Math.max(0, Math.round(baselineWeeklyRevenue)),
    baselineProfitMargin,
    baselinePayrollToRevenueRatio,
    baselineDebt: Math.max(0, Math.round(baselineDebt)),
    targetWeeklyRevenue: Math.max(0, Math.round(baselineWeeklyRevenue * (1 + profile.revenueGrowthPct))),
    targetProfitMargin: targetMargin(baselineProfitMargin, profile),
    maxPayrollToRevenueRatio: targetPayrollRatio(baselinePayrollToRevenueRatio, profile),
    targetDebtBalance: Math.max(0, Math.round(baselineDebt * (1 - profile.debtReductionPct))),
    minMaintenanceCondition: profile.maintenanceFloor,
  };
}

export function ensureBusinessManagementTargetPlan(
  business: OwnedBusiness,
  globalWeek: number,
  profileOverride?: BusinessManagementTargetProfile,
): BusinessManagementTargetPlan | undefined {
  if (!business.corporateWorkforce) return business.managementTargets;
  const period = getQuarterPeriod(globalWeek);
  const existing = business.managementTargets;
  const samePeriod = !!existing
    && existing.year === period.year
    && existing.quarter === period.quarter
    && existing.periodStartGlobalWeek === period.startGlobalWeek;
  const profile = profileOverride
    ?? existing?.profile
    ?? 'balanced';

  if (samePeriod && !profileOverride) return existing;
  return createPlanFromBaseline(
    business,
    profile,
    globalWeek,
    samePeriod && existing ? {
      baselineWeeklyRevenue: existing.baselineWeeklyRevenue,
      baselineProfitMargin: existing.baselineProfitMargin,
      baselinePayrollToRevenueRatio: existing.baselinePayrollToRevenueRatio,
      baselineDebt: existing.baselineDebt,
    } : undefined,
  );
}

export function setBusinessManagementTargetProfile(
  business: OwnedBusiness,
  profile: BusinessManagementTargetProfile,
  globalWeek: number,
): OwnedBusiness {
  return {
    ...business,
    managementTargets: ensureBusinessManagementTargetPlan(business, globalWeek, profile),
  };
}

function statusHigher(actual: number, target: number, nearTolerancePct = 0.05): BusinessManagementTargetStatus {
  if (target <= 0) return actual >= target ? 'met' : 'neutral';
  if (actual >= target) return 'met';
  if (actual >= target * (1 - nearTolerancePct)) return 'near';
  return 'missed';
}

function statusLower(actual: number, target: number, nearTolerance: number): BusinessManagementTargetStatus {
  if (actual <= target) return 'met';
  if (actual <= target + nearTolerance) return 'near';
  return 'missed';
}

export function getBusinessManagementTargetProgress(
  business: OwnedBusiness,
  report: ManagementReportMetrics,
  globalWeek: number,
): BusinessManagementTargetProgress | null {
  const plan = ensureBusinessManagementTargetPlan(business, globalWeek);
  if (!plan) return null;

  const actualWeeklyRevenue = report.weeksTracked > 0
    ? report.periodRevenue / report.weeksTracked
    : Math.max(0, business.lastWeekRevenue ?? 0);
  const currentDebt = totalDebt(business);
  const quarterWeek = clamp(globalWeek - plan.periodStartGlobalWeek + 1, 1, 5);
  const progress = quarterWeek / 5;
  const scheduledDebtBalance = plan.baselineDebt
    - (plan.baselineDebt - plan.targetDebtBalance) * progress;
  const debtStatus = plan.baselineDebt <= 0
    ? 'met'
    : statusLower(
        currentDebt,
        scheduledDebtBalance,
        Math.max(1, plan.baselineDebt * 0.03),
      );

  const results: BusinessManagementTargetResult[] = [
    {
      id: 'revenue',
      label: 'Weekly revenue',
      actual: actualWeeklyRevenue,
      target: plan.targetWeeklyRevenue,
      variance: actualWeeklyRevenue - plan.targetWeeklyRevenue,
      status: statusHigher(actualWeeklyRevenue, plan.targetWeeklyRevenue),
      direction: 'higher',
    },
    {
      id: 'margin',
      label: 'Profit margin',
      actual: report.profitMargin,
      target: plan.targetProfitMargin,
      variance: report.profitMargin - plan.targetProfitMargin,
      status: report.profitMargin >= plan.targetProfitMargin
        ? 'met'
        : report.profitMargin >= plan.targetProfitMargin - 0.02 ? 'near' : 'missed',
      direction: 'higher',
    },
    {
      id: 'payroll',
      label: 'Payroll / revenue',
      actual: report.payrollToRevenueRatio,
      target: plan.maxPayrollToRevenueRatio,
      variance: report.payrollToRevenueRatio - plan.maxPayrollToRevenueRatio,
      status: statusLower(report.payrollToRevenueRatio, plan.maxPayrollToRevenueRatio, 0.03),
      direction: 'lower',
    },
    {
      id: 'debt',
      label: 'Debt balance',
      actual: currentDebt,
      target: plan.targetDebtBalance,
      variance: currentDebt - plan.targetDebtBalance,
      status: debtStatus,
      direction: 'lower',
      scheduleBenchmark: scheduledDebtBalance,
    },
    {
      id: 'maintenance',
      label: 'Maintenance condition',
      actual: report.averageMaintenanceCondition,
      target: plan.minMaintenanceCondition,
      variance: report.averageMaintenanceCondition - plan.minMaintenanceCondition,
      status: report.averageMaintenanceCondition >= plan.minMaintenanceCondition
        ? 'met'
        : report.averageMaintenanceCondition >= plan.minMaintenanceCondition - 5 ? 'near' : 'missed',
      direction: 'higher',
    },
  ];

  return {
    plan,
    results,
    metCount: results.filter((result) => result.status === 'met').length,
    nearCount: results.filter((result) => result.status === 'near').length,
    missedCount: results.filter((result) => result.status === 'missed').length,
    totalCount: results.length,
  };
}
