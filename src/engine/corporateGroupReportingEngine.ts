import { CorporateDepartmentId, OwnedBusiness } from '../types/game';
import { CORPORATE_DEPARTMENT_DEFINITIONS } from './businessWorkforceEngine';
import {
  CorporateKpiStatus,
  CorporateKpiWarning,
  CorporateManagementReport,
  CorporateReportPeriod,
  CorporateVarianceArea,
  CorporateVarianceDirection,
  CorporateVarianceDriver,
  getCorporateManagementReport,
} from './corporateReportingEngine';

export interface CorporateGroupPriorityCompany {
  businessId: string;
  businessName: string;
  valuation: number;
  status: CorporateKpiStatus;
  warningCount: number;
  criticalWarningCount: number;
  topWarning: string | null;
}

export interface CorporateGroupManagementReport {
  period: CorporateReportPeriod;
  label: string;
  companyCount: number;
  reportingCompanyCount: number;
  reportingValueCoverage: number;
  weeksTracked: number;
  expectedWeeks: number;
  revenueChangePct: number | null;
  expensesChangePct: number | null;
  profitMargin: number;
  profitMarginChangePctPoints: number | null;
  varianceDrivers: CorporateVarianceDriver[];
  varianceHistoryCoverage: 'baseline' | 'partial' | 'full';
  overallStatus: CorporateKpiStatus;
  criticalCompanyCount: number;
  watchCompanyCount: number;

  departmentProductivity: Record<CorporateDepartmentId, number>;
  productivityIndex: number;
  productivityStatus: CorporateKpiStatus;

  revenuePerEmployee: number;
  revenuePerEmployeeChangePct: number | null;
  revenuePerEmployeeStatus: CorporateKpiStatus;

  payrollToRevenueRatio: number;
  payrollStatus: CorporateKpiStatus;

  annualizedTurnoverRate: number;
  turnoverTrend: 'improving' | 'stable' | 'rising' | 'baseline';
  turnoverChangePctPoints: number | null;
  turnoverStatus: CorporateKpiStatus;

  debtCoverage: number | null;
  debtCoverageStatus: CorporateKpiStatus;

  averageMaintenanceCondition: number;
  maintenanceBacklog: number;
  maintenanceStatus: CorporateKpiStatus;

  projectOperatingRoi: number | null;
  projectAnnualOperatingBenefit: number;
  completedProjectCost: number;
  completedProjectCount: number;
  projectRoiStatus: CorporateKpiStatus;

  totalValue: number;
  totalDebt: number;
  leverageRatio: number;
  valueConcentration: number;
  revenueConcentration: number;
  lossMakingCompanies: number;
  priorityCompanies: CorporateGroupPriorityCompany[];

  warnings: CorporateKpiWarning[];
}

const DEPARTMENT_IDS = Object.keys(CORPORATE_DEPARTMENT_DEFINITIONS) as CorporateDepartmentId[];

function statusForProductivity(value: number): CorporateKpiStatus {
  if (value < 85) return 'critical';
  if (value < 95) return 'watch';
  return 'healthy';
}

function statusForRevenuePerEmployee(changePct: number | null): CorporateKpiStatus {
  if (changePct == null) return 'neutral';
  if (changePct < -0.15) return 'critical';
  if (changePct < -0.08) return 'watch';
  return 'healthy';
}

function statusForPayroll(value: number): CorporateKpiStatus {
  if (value > 0.45) return 'critical';
  if (value > 0.32) return 'watch';
  return 'healthy';
}

function statusForTurnover(value: number, changePctPoints: number | null): CorporateKpiStatus {
  if (value > 0.25 || (changePctPoints ?? 0) > 0.10) return 'critical';
  if (value > 0.15 || (changePctPoints ?? 0) > 0.05) return 'watch';
  return 'healthy';
}

function statusForDebtCoverage(value: number | null): CorporateKpiStatus {
  if (value == null) return 'neutral';
  if (value < 1) return 'critical';
  if (value < 1.5) return 'watch';
  return 'healthy';
}

function statusForMaintenance(value: number): CorporateKpiStatus {
  if (value < 50) return 'critical';
  if (value < 75) return 'watch';
  return 'healthy';
}

function statusForProjectRoi(value: number | null): CorporateKpiStatus {
  if (value == null) return 'neutral';
  if (value < 0) return 'critical';
  if (value < 0.03) return 'watch';
  return 'healthy';
}

function pct(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function overallStatus(warnings: CorporateKpiWarning[]): CorporateKpiStatus {
  if (warnings.some((warning) => warning.severity === 'critical')) return 'critical';
  if (warnings.some((warning) => warning.severity === 'watch')) return 'watch';
  return 'healthy';
}

function debtForBusiness(business: OwnedBusiness): number {
  return (business.businessLoans ?? []).reduce(
    (sum, loan) => sum + Math.max(0, loan.remainingAmount ?? 0),
    0,
  );
}

function groupVarianceTitle(
  area: CorporateVarianceArea,
  direction: CorporateVarianceDirection,
  companyCount: number,
): string {
  const subject = companyCount === 1 ? 'company' : 'companies';
  const verb = direction === 'positive' ? 'improved' : direction === 'negative' ? 'weakened' : 'changed';
  if (area === 'productivity') return `Productivity ${verb} in ${companyCount} ${subject}`;
  if (area === 'headcount') return `Headcount shifted in ${companyCount} ${subject}`;
  if (area === 'skill') return `Department skill ${verb} in ${companyCount} ${subject}`;
  if (area === 'morale') return `Morale ${verb} in ${companyCount} ${subject}`;
  if (area === 'payroll') return `Payroll pressure changed in ${companyCount} ${subject}`;
  if (area === 'maintenance') return `Upkeep conditions ${verb} in ${companyCount} ${subject}`;
  if (area === 'debt') return `Debt-service pressure changed in ${companyCount} ${subject}`;
  if (area === 'integration') return `Acquisition integration ${verb} in ${companyCount} ${subject}`;
  if (area === 'reputation') return `Reputation ${verb} in ${companyCount} ${subject}`;
  if (area === 'market_share') return `Market-share position ${verb} in ${companyCount} ${subject}`;
  return `Other market effects remain in ${companyCount} ${subject}`;
}

function aggregateVarianceDrivers(
  reportPairs: Array<{ business: OwnedBusiness; report: CorporateManagementReport }>,
): CorporateVarianceDriver[] {
  const buckets = new Map<string, {
    area: CorporateVarianceArea;
    direction: CorporateVarianceDirection;
    companyNames: string[];
    impactScore: number;
  }>();

  for (const { business, report } of reportPairs) {
    for (const driver of report.varianceDrivers) {
      const key = `${driver.area}:${driver.direction}`;
      const bucket = buckets.get(key) ?? {
        area: driver.area,
        direction: driver.direction,
        companyNames: [],
        impactScore: 0,
      };
      if (!bucket.companyNames.includes(business.name)) bucket.companyNames.push(business.name);
      bucket.impactScore += driver.impactScore;
      buckets.set(key, bucket);
    }
  }

  return [...buckets.values()]
    .map((bucket) => ({
      id: `group-${bucket.area}-${bucket.direction}`,
      area: bucket.area,
      direction: bucket.direction,
      title: groupVarianceTitle(bucket.area, bucket.direction, bucket.companyNames.length),
      detail: bucket.companyNames.length <= 3
        ? bucket.companyNames.join(' • ')
        : `${bucket.companyNames.slice(0, 3).join(' • ')} • +${bucket.companyNames.length - 3} more`,
      impactScore: bucket.impactScore + bucket.companyNames.length * 2,
    }))
    .sort((a, b) => b.impactScore - a.impactScore)
    .slice(0, 4);
}

function weightedAverage(
  items: Array<{ value: number; weight: number }>,
  fallback = 0,
): number {
  const totalWeight = items.reduce((sum, item) => sum + Math.max(0, item.weight), 0);
  if (totalWeight <= 0) return fallback;
  return items.reduce(
    (sum, item) => sum + item.value * Math.max(0, item.weight),
    0,
  ) / totalWeight;
}

export function getCorporateGroupManagementReport(
  businesses: OwnedBusiness[],
  globalWeek: number,
  period: CorporateReportPeriod,
  inflationMultiplier = 1,
): CorporateGroupManagementReport | null {
  const companies = businesses ?? [];
  if (companies.length === 0) return null;

  const reportPairs: Array<{ business: OwnedBusiness; report: CorporateManagementReport }> = [];
  for (const business of companies) {
    const report = getCorporateManagementReport(
      business,
      globalWeek,
      period,
      inflationMultiplier,
    );
    if (report) reportPairs.push({ business, report });
  }
  if (reportPairs.length === 0) return null;

  const reports = reportPairs.map((pair) => pair.report);
  const periodRevenue = reports.reduce((sum, report) => sum + report.periodRevenue, 0);
  const periodExpenses = reports.reduce((sum, report) => sum + report.periodExpenses, 0);
  const periodPayroll = reports.reduce((sum, report) => sum + report.periodPayroll, 0);
  const periodProfit = reports.reduce((sum, report) => sum + report.periodProfit, 0);
  const periodDebtService = reports.reduce((sum, report) => sum + report.periodDebtService, 0);
  const employeeWeeks = reports.reduce((sum, report) => sum + report.periodEmployeeWeeks, 0);
  const turnoverCount = reports.reduce((sum, report) => sum + report.periodTurnoverCount, 0);

  const comparisonPairs = reportPairs.filter(({ report }) => report.previousWeeksTracked > 0);
  const currentComparableWeeklyRevenue = comparisonPairs.reduce(
    (sum, { report }) => sum + report.periodRevenue / Math.max(1, report.weeksTracked),
    0,
  );
  const previousComparableWeeklyRevenue = comparisonPairs.reduce(
    (sum, { report }) => sum + report.previousPeriodRevenue / Math.max(1, report.previousWeeksTracked),
    0,
  );
  const currentComparableWeeklyExpenses = comparisonPairs.reduce(
    (sum, { report }) => sum + report.periodExpenses / Math.max(1, report.weeksTracked),
    0,
  );
  const previousComparableWeeklyExpenses = comparisonPairs.reduce(
    (sum, { report }) => sum + report.previousPeriodExpenses / Math.max(1, report.previousWeeksTracked),
    0,
  );
  const currentComparableWeeklyProfit = comparisonPairs.reduce(
    (sum, { report }) => sum + report.periodProfit / Math.max(1, report.weeksTracked),
    0,
  );
  const currentComparableEmployeeWeeks = comparisonPairs.reduce(
    (sum, { report }) => sum + report.periodEmployeeWeeks,
    0,
  );
  const previousComparableEmployeeWeeks = comparisonPairs.reduce(
    (sum, { report }) => sum + report.previousPeriodEmployeeWeeks,
    0,
  );
  const currentComparableTurnover = comparisonPairs.reduce(
    (sum, { report }) => sum + report.periodTurnoverCount,
    0,
  );
  const previousComparableTurnover = comparisonPairs.reduce(
    (sum, { report }) => sum + report.previousPeriodTurnoverCount,
    0,
  );
  const currentComparableRevenueTotal = comparisonPairs.reduce(
    (sum, { report }) => sum + report.periodRevenue,
    0,
  );
  const previousComparableRevenueTotal = comparisonPairs.reduce(
    (sum, { report }) => sum + report.previousPeriodRevenue,
    0,
  );
  const previousComparableWeeklyProfit = comparisonPairs.reduce(
    (sum, { report }) => sum + report.previousPeriodProfit / Math.max(1, report.previousWeeksTracked),
    0,
  );
  const revenueChangePct = comparisonPairs.length > 0 && previousComparableWeeklyRevenue > 0
    ? (currentComparableWeeklyRevenue - previousComparableWeeklyRevenue) / previousComparableWeeklyRevenue
    : null;
  const expensesChangePct = comparisonPairs.length > 0 && previousComparableWeeklyExpenses > 0
    ? (currentComparableWeeklyExpenses - previousComparableWeeklyExpenses) / previousComparableWeeklyExpenses
    : null;
  const profitMargin = periodRevenue > 0 ? (periodRevenue - periodExpenses) / periodRevenue : 0;
  const comparableCurrentProfitMargin = currentComparableWeeklyRevenue > 0
    ? currentComparableWeeklyProfit / currentComparableWeeklyRevenue
    : 0;
  const previousProfitMargin = previousComparableWeeklyRevenue > 0
    ? previousComparableWeeklyProfit / previousComparableWeeklyRevenue
    : 0;
  const profitMarginChangePctPoints = comparisonPairs.length > 0
    ? (comparableCurrentProfitMargin - previousProfitMargin) * 100
    : null;
  const varianceDrivers = aggregateVarianceDrivers(comparisonPairs);
  const varianceHistoryCoverage: CorporateGroupManagementReport['varianceHistoryCoverage'] = comparisonPairs.length === 0
    ? 'baseline'
    : comparisonPairs.length === reportPairs.length
      && comparisonPairs.every(({ report }) => report.varianceHistoryCoverage === 'full')
      ? 'full'
      : 'partial';

  const totalValue = companies.reduce((sum, business) => sum + Math.max(0, business.valuation ?? 0), 0);
  const reportingValue = reportPairs.reduce(
    (sum, pair) => sum + Math.max(0, pair.business.valuation ?? 0),
    0,
  );
  const reportingValueCoverage = totalValue > 0 ? reportingValue / totalValue : 1;

  const revenuePerEmployee = employeeWeeks > 0 ? periodRevenue / employeeWeeks : 0;
  const comparableRevenuePerEmployee = currentComparableEmployeeWeeks > 0
    ? currentComparableRevenueTotal / currentComparableEmployeeWeeks
    : 0;
  const previousRevenuePerEmployee = previousComparableEmployeeWeeks > 0
    ? previousComparableRevenueTotal / previousComparableEmployeeWeeks
    : 0;
  const revenuePerEmployeeChangePct = previousRevenuePerEmployee > 0
    ? (comparableRevenuePerEmployee - previousRevenuePerEmployee) / previousRevenuePerEmployee
    : null;

  const payrollToRevenueRatio = periodRevenue > 0
    ? periodPayroll / periodRevenue
    : periodPayroll > 0 ? 1 : 0;

  const annualizedTurnoverRate = employeeWeeks > 0
    ? turnoverCount / employeeWeeks * 20
    : 0;
  const comparableAnnualizedTurnoverRate = currentComparableEmployeeWeeks > 0
    ? currentComparableTurnover / currentComparableEmployeeWeeks * 20
    : 0;
  const previousAnnualizedTurnoverRate = previousComparableEmployeeWeeks > 0
    ? previousComparableTurnover / previousComparableEmployeeWeeks * 20
    : 0;
  const turnoverChangePctPoints = previousComparableEmployeeWeeks > 0
    ? comparableAnnualizedTurnoverRate - previousAnnualizedTurnoverRate
    : null;
  const turnoverTrend = turnoverChangePctPoints == null
    ? 'baseline'
    : turnoverChangePctPoints > 0.03
      ? 'rising'
      : turnoverChangePctPoints < -0.03
        ? 'improving'
        : 'stable';

  const debtCoverage = periodDebtService > 0
    ? (periodProfit + periodDebtService) / periodDebtService
    : null;

  const productivityIndex = weightedAverage(
    reports.map((report) => ({
      value: report.productivityIndex,
      weight: Math.max(1, report.averageHeadcount),
    })),
    100,
  );

  const departmentProductivity = {} as Record<CorporateDepartmentId, number>;
  for (const departmentId of DEPARTMENT_IDS) {
    departmentProductivity[departmentId] = weightedAverage(
      reports.map((report) => ({
        value: report.departmentProductivity[departmentId] ?? 100,
        weight: Math.max(1, report.averageHeadcount),
      })),
      100,
    );
  }

  const averageMaintenanceCondition = weightedAverage(
    reportPairs.map(({ business, report }) => ({
      value: report.averageMaintenanceCondition,
      weight: Math.max(1, business.valuation ?? 0),
    })),
    100,
  );
  const maintenanceBacklog = reports.reduce((sum, report) => sum + report.maintenanceBacklog, 0);

  const completedProjectCost = reports.reduce((sum, report) => sum + report.completedProjectCost, 0);
  const projectAnnualOperatingBenefit = reports.reduce(
    (sum, report) => sum + report.projectAnnualOperatingBenefit,
    0,
  );
  const completedProjectCount = reports.reduce((sum, report) => sum + report.completedProjectCount, 0);
  const projectOperatingRoi = completedProjectCost > 0
    ? projectAnnualOperatingBenefit / completedProjectCost
    : null;

  const totalDebt = companies.reduce((sum, business) => sum + debtForBusiness(business), 0);
  const leverageRatio = totalValue > 0 ? totalDebt / totalValue : 0;

  const largestValue = companies.reduce(
    (max, business) => Math.max(max, Math.max(0, business.valuation ?? 0)),
    0,
  );
  const valueConcentration = totalValue > 0 ? largestValue / totalValue : 0;

  const currentPortfolioRevenue = companies.reduce(
    (sum, business) => sum + Math.max(0, business.lastWeekRevenue ?? 0),
    0,
  );
  const largestRevenue = companies.reduce(
    (max, business) => Math.max(max, Math.max(0, business.lastWeekRevenue ?? 0)),
    0,
  );
  const revenueConcentration = currentPortfolioRevenue > 0
    ? largestRevenue / currentPortfolioRevenue
    : 0;

  const lossMakingCompanies = companies.filter(
    (business) => (business.lastWeekProfit ?? 0) < 0,
  ).length;

  const statuses = {
    productivity: statusForProductivity(productivityIndex),
    revenuePerEmployee: statusForRevenuePerEmployee(revenuePerEmployeeChangePct),
    payroll: statusForPayroll(payrollToRevenueRatio),
    turnover: statusForTurnover(annualizedTurnoverRate, turnoverChangePctPoints),
    debtCoverage: statusForDebtCoverage(debtCoverage),
    maintenance: statusForMaintenance(averageMaintenanceCondition),
    projectRoi: statusForProjectRoi(projectOperatingRoi),
  };

  const criticalCompanyCount = reports.filter((report) => report.overallStatus === 'critical').length;
  const watchCompanyCount = reports.filter((report) => report.overallStatus === 'watch').length;

  const priorityCompanies = reportPairs
    .map(({ business, report }) => ({
      businessId: business.id,
      businessName: business.name,
      valuation: Math.max(0, business.valuation ?? 0),
      status: report.overallStatus,
      warningCount: report.warnings.length,
      criticalWarningCount: report.warnings.filter((warning) => warning.severity === 'critical').length,
      topWarning: report.warnings[0]?.title ?? null,
    }))
    .filter((company) => company.status === 'critical' || company.status === 'watch')
    .sort((a, b) => {
      const rank = (status: CorporateKpiStatus) => status === 'critical' ? 0 : status === 'watch' ? 1 : 2;
      return rank(a.status) - rank(b.status)
        || b.criticalWarningCount - a.criticalWarningCount
        || b.warningCount - a.warningCount
        || b.valuation - a.valuation;
    });

  const warnings: CorporateKpiWarning[] = [];

  if (criticalCompanyCount > 0) {
    warnings.push({
      id: 'critical-companies',
      severity: 'critical',
      title: `${criticalCompanyCount} reporting ${criticalCompanyCount === 1 ? 'company has' : 'companies have'} critical KPIs`,
      detail: 'Open the affected company reports to see the underlying payroll, debt, maintenance, workforce or ROI flags.',
    });
  } else if (watchCompanyCount > 0) {
    warnings.push({
      id: 'watch-companies',
      severity: 'watch',
      title: `${watchCompanyCount} reporting ${watchCompanyCount === 1 ? 'company is' : 'companies are'} on watch`,
      detail: 'At least one subsidiary has crossed a management warning threshold.',
    });
  }

  if (statuses.payroll === 'critical' || statuses.payroll === 'watch') {
    warnings.push({
      id: 'group-payroll',
      severity: statuses.payroll,
      title: `Group payroll is ${pct(payrollToRevenueRatio)} of reported revenue`,
      detail: statuses.payroll === 'critical'
        ? 'Payroll exceeds 45% of reported revenue across the corporate portfolio.'
        : 'Payroll is above the 32% management-watch threshold.',
    });
  }

  if (statuses.turnover === 'critical' || statuses.turnover === 'watch') {
    warnings.push({
      id: 'group-turnover',
      severity: statuses.turnover,
      title: `Group turnover ${pct(annualizedTurnoverRate)} annualized`,
      detail: turnoverTrend === 'rising'
        ? 'Turnover is rising across the reporting portfolio.'
        : 'Aggregate turnover is above the group retention threshold.',
    });
  }

  if (statuses.debtCoverage === 'critical' || statuses.debtCoverage === 'watch') {
    warnings.push({
      id: 'group-debt-coverage',
      severity: statuses.debtCoverage,
      title: `Group debt coverage ${(debtCoverage ?? 0).toFixed(2)}×`,
      detail: statuses.debtCoverage === 'critical'
        ? 'Reported operating cash generation does not cover scheduled business debt service.'
        : 'Aggregate debt coverage is below the 1.5× management buffer.',
    });
  }

  if (statuses.maintenance === 'critical' || statuses.maintenance === 'watch') {
    warnings.push({
      id: 'group-maintenance',
      severity: statuses.maintenance,
      title: `Group maintenance condition ${averageMaintenanceCondition.toFixed(0)}%`,
      detail: `Estimated deferred upkeep across reporting companies is ${Math.round(maintenanceBacklog).toLocaleString()}.`,
    });
  }

  if (statuses.revenuePerEmployee === 'critical' || statuses.revenuePerEmployee === 'watch') {
    warnings.push({
      id: 'group-revenue-per-employee',
      severity: statuses.revenuePerEmployee,
      title: `Revenue per employee ${revenuePerEmployeeChangePct != null ? `${(revenuePerEmployeeChangePct * 100).toFixed(1)}%` : ''} vs prior period`,
      detail: 'Group employee productivity is declining faster than the management threshold.',
    });
  }

  if (companies.length >= 3) {
    const concentration = Math.max(valueConcentration, revenueConcentration);
    if (concentration > 0.80) {
      warnings.push({
        id: 'concentration',
        severity: 'critical',
        title: `Portfolio concentration ${pct(concentration)}`,
        detail: 'One company represents more than 80% of group value or current revenue.',
      });
    } else if (concentration > 0.65) {
      warnings.push({
        id: 'concentration',
        severity: 'watch',
        title: `Portfolio concentration ${pct(concentration)}`,
        detail: 'One company represents more than 65% of group value or current revenue.',
      });
    }
  }

  if (leverageRatio > 0.70) {
    warnings.push({
      id: 'group-leverage',
      severity: 'critical',
      title: `Group leverage ${pct(leverageRatio)} of business value`,
      detail: 'Outstanding business debt exceeds 70% of portfolio value.',
    });
  } else if (leverageRatio > 0.50) {
    warnings.push({
      id: 'group-leverage',
      severity: 'watch',
      title: `Group leverage ${pct(leverageRatio)} of business value`,
      detail: 'Outstanding business debt exceeds 50% of portfolio value.',
    });
  }

  const lossShare = companies.length > 0 ? lossMakingCompanies / companies.length : 0;
  if (companies.length >= 2 && lossShare > 0.67) {
    warnings.push({
      id: 'loss-making-companies',
      severity: 'critical',
      title: `${lossMakingCompanies}/${companies.length} companies are loss-making this week`,
      detail: 'Most of the portfolio is currently operating at a weekly loss.',
    });
  } else if (companies.length >= 2 && lossShare >= 0.50) {
    warnings.push({
      id: 'loss-making-companies',
      severity: 'watch',
      title: `${lossMakingCompanies}/${companies.length} companies are loss-making this week`,
      detail: 'At least half of the portfolio is currently operating at a weekly loss.',
    });
  }

  warnings.sort((a, b) => {
    const rank = { critical: 0, watch: 1 } as const;
    return rank[a.severity] - rank[b.severity];
  });

  return {
    period,
    label: reports[0].label,
    companyCount: companies.length,
    reportingCompanyCount: reports.length,
    reportingValueCoverage,
    weeksTracked: Math.min(...reports.map((report) => report.weeksTracked)),
    expectedWeeks: reports[0].expectedWeeks,
    revenueChangePct,
    expensesChangePct,
    profitMargin,
    profitMarginChangePctPoints,
    varianceDrivers,
    varianceHistoryCoverage,
    overallStatus: overallStatus(warnings),
    criticalCompanyCount,
    watchCompanyCount,
    departmentProductivity,
    productivityIndex,
    productivityStatus: statuses.productivity,
    revenuePerEmployee,
    revenuePerEmployeeChangePct,
    revenuePerEmployeeStatus: statuses.revenuePerEmployee,
    payrollToRevenueRatio,
    payrollStatus: statuses.payroll,
    annualizedTurnoverRate,
    turnoverTrend,
    turnoverChangePctPoints,
    turnoverStatus: statuses.turnover,
    debtCoverage,
    debtCoverageStatus: statuses.debtCoverage,
    averageMaintenanceCondition,
    maintenanceBacklog,
    maintenanceStatus: statuses.maintenance,
    projectOperatingRoi,
    projectAnnualOperatingBenefit,
    completedProjectCost,
    completedProjectCount,
    projectRoiStatus: statuses.projectRoi,
    totalValue,
    totalDebt,
    leverageRatio,
    valueConcentration,
    revenueConcentration,
    lossMakingCompanies,
    priorityCompanies,
    warnings,
  };
}
