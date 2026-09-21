import {
  CorporateDepartmentId,
  CorporateKpiHistoryPoint,
  OwnedBusiness,
} from '../types/game';
import {
  CORPORATE_DEPARTMENT_DEFINITIONS,
  getCorporateWorkforceEffects,
  getCorporateWorkforceWeeklyPayroll,
} from './businessWorkforceEngine';
import { getCorporateWeeklyDebtService } from './corporateFinanceEngine';
import {
  BUSINESS_REINVESTMENT_AREAS,
  getBusinessReinvestmentCost,
  normalizeBusinessReinvestmentState,
} from './businessReinvestmentEngine';
import { getCorporateCapexProject } from './corporateScaleEngine';

export type CorporateReportPeriod = 'quarter' | 'annual';
export type CorporateKpiStatus = 'healthy' | 'watch' | 'critical' | 'neutral';

export interface CorporateKpiWarning {
  id: string;
  severity: Exclude<CorporateKpiStatus, 'healthy' | 'neutral'>;
  title: string;
  detail: string;
}

export interface CorporateManagementReport {
  period: CorporateReportPeriod;
  label: string;
  startGlobalWeek: number;
  endGlobalWeek: number;
  expectedWeeks: number;
  weeksTracked: number;
  overallStatus: CorporateKpiStatus;
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
  warnings: CorporateKpiWarning[];
  /** Period totals exposed for group / holding-company rollups. */
  periodRevenue: number;
  periodExpenses: number;
  periodProfit: number;
  periodPayroll: number;
  periodDebtService: number;
  periodEmployeeWeeks: number;
  periodTurnoverCount: number;
  averageHeadcount: number;
  previousPeriodRevenue: number;
  previousPeriodEmployeeWeeks: number;
  previousPeriodTurnoverCount: number;
}

const DEPARTMENT_IDS = Object.keys(CORPORATE_DEPARTMENT_DEFINITIONS) as CorporateDepartmentId[];

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function getPeriodBounds(globalWeek: number, period: CorporateReportPeriod) {
  const safeGlobalWeek = Math.max(1, Math.round(globalWeek || 1));
  const weekInYear = ((safeGlobalWeek - 1) % 20) + 1;
  const year = Math.floor((safeGlobalWeek - 1) / 20) + 1;
  const yearStart = safeGlobalWeek - weekInYear + 1;

  if (period === 'annual') {
    return {
      startGlobalWeek: yearStart,
      endGlobalWeek: safeGlobalWeek,
      expectedWeeks: 20,
      label: `Year ${year} YTD`,
    };
  }

  const quarter = Math.floor((weekInYear - 1) / 5) + 1;
  const quarterStart = yearStart + (quarter - 1) * 5;
  return {
    startGlobalWeek: quarterStart,
    endGlobalWeek: safeGlobalWeek,
    expectedWeeks: 5,
    label: `Q${quarter} • Year ${year}`,
  };
}

function getPreviousBounds(globalWeek: number, period: CorporateReportPeriod) {
  const current = getPeriodBounds(globalWeek, period);
  const span = period === 'quarter' ? 5 : 20;
  return {
    startGlobalWeek: current.startGlobalWeek - span,
    endGlobalWeek: current.startGlobalWeek - 1,
  };
}

function getMaintenanceBacklog(business: OwnedBusiness, inflationMultiplier = 1) {
  const state = normalizeBusinessReinvestmentState(business.reinvestment, 1);
  const averageCondition = (
    state.technology.condition
    + state.premises.condition
    + state.equipment.condition
  ) / 3;

  const backlog = (Object.keys(BUSINESS_REINVESTMENT_AREAS) as Array<keyof typeof BUSINESS_REINVESTMENT_AREAS>)
    .reduce((sum, area) => {
      const condition = clamp(state[area].condition, 0, 100);
      const replacementCost = getBusinessReinvestmentCost(business, area, inflationMultiplier);
      return sum + replacementCost * ((100 - condition) / 100);
    }, 0);

  return {
    averageCondition,
    backlog: Math.round(backlog),
  };
}

export function buildCorporateKpiSnapshot(
  business: OwnedBusiness,
  globalWeek: number,
): CorporateKpiHistoryPoint | null {
  const workforce = business.corporateWorkforce;
  if (!workforce) return null;

  const effects = getCorporateWorkforceEffects(business, workforce);
  const departmentProductivity = {} as Record<CorporateDepartmentId, number>;
  let weightedProductivity = 0;
  let headcount = 0;

  for (const id of DEPARTMENT_IDS) {
    const departmentHeadcount = Math.max(0, workforce.departments[id]?.headcount ?? 0);
    const productivity = Math.round((effects.departmentRatios[id] ?? 1) * 1000) / 10;
    departmentProductivity[id] = productivity;
    headcount += departmentHeadcount;
    weightedProductivity += productivity * departmentHeadcount;
  }

  const productivityIndex = headcount > 0
    ? weightedProductivity / headcount
    : average(DEPARTMENT_IDS.map((id) => departmentProductivity[id]));

  const reinvestment = normalizeBusinessReinvestmentState(business.reinvestment, globalWeek);
  const averageMaintenanceCondition = (
    reinvestment.technology.condition
    + reinvestment.premises.condition
    + reinvestment.equipment.condition
  ) / 3;

  return {
    globalWeek: Math.max(1, Math.round(globalWeek)),
    revenue: Math.max(0, Math.round(business.lastWeekRevenue ?? 0)),
    expenses: Math.max(0, Math.round(business.lastWeekExpenses ?? 0)),
    profit: Math.round(business.lastWeekProfit ?? 0),
    headcount,
    payroll: Math.max(0, Math.round(getCorporateWorkforceWeeklyPayroll(workforce))),
    turnover: Math.max(0, Math.round(workforce.recentTurnover ?? 0)),
    productivityIndex: Math.round(productivityIndex * 10) / 10,
    departmentProductivity,
    debtService: Math.max(
      0,
      Math.round(
        business.lastExpenseBreakdown?.loanInterest
        ?? getCorporateWeeklyDebtService(business),
      ),
    ),
    averageMaintenanceCondition: Math.round(averageMaintenanceCondition * 10) / 10,
  };
}

export function appendCorporateKpiSnapshot(
  business: OwnedBusiness,
  globalWeek: number,
): OwnedBusiness {
  const snapshot = buildCorporateKpiSnapshot(business, globalWeek);
  if (!snapshot) return business;

  const history = (business.corporateKpiHistory ?? [])
    .filter((point) => point.globalWeek !== snapshot.globalWeek)
    .concat(snapshot)
    .sort((a, b) => a.globalWeek - b.globalWeek)
    .slice(-60);

  return {
    ...business,
    corporateKpiHistory: history,
  };
}

function getHistoryWithCurrentPoint(
  business: OwnedBusiness,
  globalWeek: number,
): CorporateKpiHistoryPoint[] {
  const existing = (business.corporateKpiHistory ?? [])
    .filter((point) => Number.isFinite(point.globalWeek))
    .sort((a, b) => a.globalWeek - b.globalWeek);
  const current = buildCorporateKpiSnapshot(business, globalWeek);
  if (!current || existing.some((point) => point.globalWeek === current.globalWeek)) {
    return existing;
  }

  return existing.concat(current).sort((a, b) => a.globalWeek - b.globalWeek);
}

function aggregatePeriod(points: CorporateKpiHistoryPoint[]) {
  if (points.length === 0) {
    return {
      weeks: 0,
      revenue: 0,
      expenses: 0,
      profit: 0,
      payroll: 0,
      turnover: 0,
      debtService: 0,
      averageHeadcount: 0,
      revenuePerEmployee: 0,
      annualizedTurnoverRate: 0,
      productivityIndex: 0,
      departmentProductivity: Object.fromEntries(
        DEPARTMENT_IDS.map((id) => [id, 100]),
      ) as Record<CorporateDepartmentId, number>,
    };
  }

  const weeks = points.length;
  const revenue = points.reduce((sum, point) => sum + Math.max(0, point.revenue), 0);
  const expenses = points.reduce((sum, point) => sum + Math.max(0, point.expenses), 0);
  const profit = points.reduce((sum, point) => sum + point.profit, 0);
  const payroll = points.reduce((sum, point) => sum + Math.max(0, point.payroll), 0);
  const turnover = points.reduce((sum, point) => sum + Math.max(0, point.turnover), 0);
  const debtService = points.reduce((sum, point) => sum + Math.max(0, point.debtService), 0);
  const averageHeadcount = average(points.map((point) => Math.max(0, point.headcount)));
  const employeeWeeks = points.reduce((sum, point) => sum + Math.max(0, point.headcount), 0);
  const revenuePerEmployee = employeeWeeks > 0 ? revenue / employeeWeeks : 0;
  const annualizedTurnoverRate = averageHeadcount > 0
    ? (turnover / averageHeadcount) * (20 / weeks)
    : 0;
  const productivityIndex = average(points.map((point) => point.productivityIndex));

  const departmentProductivity = {} as Record<CorporateDepartmentId, number>;
  for (const id of DEPARTMENT_IDS) {
    departmentProductivity[id] = average(
      points.map((point) => point.departmentProductivity?.[id] ?? 100),
    );
  }

  return {
    weeks,
    revenue,
    expenses,
    profit,
    payroll,
    turnover,
    debtService,
    averageHeadcount,
    revenuePerEmployee,
    annualizedTurnoverRate,
    productivityIndex,
    departmentProductivity,
  };
}

function productivityStatus(value: number): CorporateKpiStatus {
  if (value < 85) return 'critical';
  if (value < 95) return 'watch';
  return 'healthy';
}

function payrollStatus(value: number): CorporateKpiStatus {
  if (value > 0.45) return 'critical';
  if (value > 0.32) return 'watch';
  return 'healthy';
}

function turnoverStatus(value: number, changePctPoints: number | null): CorporateKpiStatus {
  if (value > 0.25 || (changePctPoints ?? 0) > 0.10) return 'critical';
  if (value > 0.15 || (changePctPoints ?? 0) > 0.05) return 'watch';
  return 'healthy';
}

function debtCoverageStatus(value: number | null): CorporateKpiStatus {
  if (value == null) return 'neutral';
  if (value < 1) return 'critical';
  if (value < 1.5) return 'watch';
  return 'healthy';
}

function maintenanceStatus(value: number): CorporateKpiStatus {
  if (value < 50) return 'critical';
  if (value < 75) return 'watch';
  return 'healthy';
}

function projectRoiStatus(value: number | null): CorporateKpiStatus {
  if (value == null) return 'neutral';
  if (value < 0) return 'critical';
  if (value < 0.03) return 'watch';
  return 'healthy';
}

function revenuePerEmployeeStatus(changePct: number | null): CorporateKpiStatus {
  if (changePct == null) return 'neutral';
  if (changePct < -0.15) return 'critical';
  if (changePct < -0.08) return 'watch';
  return 'healthy';
}

function overallStatus(warnings: CorporateKpiWarning[]): CorporateKpiStatus {
  if (warnings.some((warning) => warning.severity === 'critical')) return 'critical';
  if (warnings.some((warning) => warning.severity === 'watch')) return 'watch';
  return 'healthy';
}

function formatPct(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

export function getCorporateManagementAttentionReason(
  business: OwnedBusiness,
  globalWeek: number,
  inflationMultiplier = 1,
): string | null {
  const report = getCorporateManagementReport(
    business,
    globalWeek,
    'quarter',
    inflationMultiplier,
  );
  return report?.warnings[0]?.title ?? null;
}

export function getCorporateManagementReport(
  business: OwnedBusiness,
  globalWeek: number,
  period: CorporateReportPeriod,
  inflationMultiplier = 1,
): CorporateManagementReport | null {
  if (!business.corporateWorkforce) return null;

  const bounds = getPeriodBounds(globalWeek, period);
  const previousBounds = getPreviousBounds(globalWeek, period);
  const history = getHistoryWithCurrentPoint(business, globalWeek);
  const currentPoints = history.filter(
    (point) => point.globalWeek >= bounds.startGlobalWeek && point.globalWeek <= bounds.endGlobalWeek,
  );
  const previousPoints = history.filter(
    (point) => point.globalWeek >= previousBounds.startGlobalWeek && point.globalWeek <= previousBounds.endGlobalWeek,
  );

  const current = aggregatePeriod(currentPoints);
  const previous = aggregatePeriod(previousPoints);
  const payrollToRevenueRatio = current.revenue > 0
    ? current.payroll / current.revenue
    : current.payroll > 0 ? 1 : 0;
  const revenuePerEmployeeChangePct = previous.weeks > 0 && previous.revenuePerEmployee > 0
    ? (current.revenuePerEmployee - previous.revenuePerEmployee) / previous.revenuePerEmployee
    : null;
  const turnoverChangePctPoints = previous.weeks > 0
    ? current.annualizedTurnoverRate - previous.annualizedTurnoverRate
    : null;
  const turnoverTrend = turnoverChangePctPoints == null
    ? 'baseline'
    : turnoverChangePctPoints > 0.03
      ? 'rising'
      : turnoverChangePctPoints < -0.03
        ? 'improving'
        : 'stable';

  const debtCoverage = current.debtService > 0
    ? (current.profit + current.debtService) / current.debtService
    : null;

  const maintenance = getMaintenanceBacklog(business, inflationMultiplier);

  const averageWeeklyRevenue = current.weeks > 0 ? current.revenue / current.weeks : Math.max(0, business.lastWeekRevenue ?? 0);
  const averageWeeklyExpenses = current.weeks > 0 ? current.expenses / current.weeks : Math.max(0, business.lastWeekExpenses ?? 0);
  let completedProjectCost = 0;
  let projectAnnualOperatingBenefit = 0;
  let completedProjectCount = 0;

  for (const completed of business.completedCorporateCapex ?? []) {
    const definition = getCorporateCapexProject(completed.projectId);
    if (!definition) continue;
    completedProjectCount += 1;
    completedProjectCost += Math.max(0, completed.costPaid ?? 0);
    projectAnnualOperatingBenefit += (
      averageWeeklyRevenue * 20 * definition.revenueBonus
      + averageWeeklyExpenses * 20 * definition.expenseReduction
    );
  }

  const projectOperatingRoi = completedProjectCost > 0
    ? projectAnnualOperatingBenefit / completedProjectCost
    : null;

  const statuses = {
    productivity: productivityStatus(current.productivityIndex),
    revenuePerEmployee: revenuePerEmployeeStatus(revenuePerEmployeeChangePct),
    payroll: payrollStatus(payrollToRevenueRatio),
    turnover: turnoverStatus(current.annualizedTurnoverRate, turnoverChangePctPoints),
    debt: debtCoverageStatus(debtCoverage),
    maintenance: maintenanceStatus(maintenance.averageCondition),
    projectRoi: projectRoiStatus(projectOperatingRoi),
  };

  const warnings: CorporateKpiWarning[] = [];
  const weakestDepartment = DEPARTMENT_IDS
    .map((id) => ({ id, value: current.departmentProductivity[id] }))
    .sort((a, b) => a.value - b.value)[0];

  if (weakestDepartment && weakestDepartment.value < 95) {
    const severity = weakestDepartment.value < 85 ? 'critical' : 'watch';
    warnings.push({
      id: 'department-productivity',
      severity,
      title: `${CORPORATE_DEPARTMENT_DEFINITIONS[weakestDepartment.id].name} productivity ${weakestDepartment.value.toFixed(0)}%`,
      detail: severity === 'critical'
        ? 'Capacity, skill or morale is materially below the corporate target.'
        : 'Department capacity is drifting below target and may constrain the company.',
    });
  }

  if (statuses.payroll === 'critical' || statuses.payroll === 'watch') {
    warnings.push({
      id: 'payroll-ratio',
      severity: statuses.payroll,
      title: `Payroll is ${formatPct(payrollToRevenueRatio)} of revenue`,
      detail: statuses.payroll === 'critical'
        ? 'Payroll is consuming more than 45% of revenue.'
        : 'Payroll is above the 32% management-watch threshold.',
    });
  }

  if (statuses.turnover === 'critical' || statuses.turnover === 'watch') {
    warnings.push({
      id: 'turnover',
      severity: statuses.turnover,
      title: `Turnover ${formatPct(current.annualizedTurnoverRate)} annualized`,
      detail: turnoverTrend === 'rising'
        ? 'Turnover is rising versus the previous comparable period.'
        : 'Turnover is above the corporate retention threshold.',
    });
  }

  if (statuses.debt === 'critical' || statuses.debt === 'watch') {
    warnings.push({
      id: 'debt-coverage',
      severity: statuses.debt,
      title: `Debt coverage ${(debtCoverage ?? 0).toFixed(2)}×`,
      detail: statuses.debt === 'critical'
        ? 'Operating cash generation does not fully cover scheduled debt service.'
        : 'Debt coverage is below the 1.5× management buffer.',
    });
  }

  if (statuses.maintenance === 'critical' || statuses.maintenance === 'watch') {
    warnings.push({
      id: 'maintenance',
      severity: statuses.maintenance,
      title: `Maintenance condition ${maintenance.averageCondition.toFixed(0)}%`,
      detail: `Estimated deferred upkeep is ${Math.round(maintenance.backlog).toLocaleString()} in current-value costs.`,
    });
  }

  if (statuses.projectRoi === 'critical' || statuses.projectRoi === 'watch') {
    warnings.push({
      id: 'project-roi',
      severity: statuses.projectRoi,
      title: `Corporate project operating ROI ${formatPct(projectOperatingRoi ?? 0)}`,
      detail: statuses.projectRoi === 'critical'
        ? 'Completed projects are currently reducing estimated operating returns.'
        : 'Estimated direct operating ROI is below 3%; asset value and risk protection are not included.',
    });
  }

  if (statuses.revenuePerEmployee === 'critical' || statuses.revenuePerEmployee === 'watch') {
    warnings.push({
      id: 'revenue-per-employee',
      severity: statuses.revenuePerEmployee,
      title: `Revenue per employee ${revenuePerEmployeeChangePct != null ? `${(revenuePerEmployeeChangePct * 100).toFixed(1)}%` : ''} vs prior period`,
      detail: 'Revenue productivity is falling faster than the management threshold.',
    });
  }

  warnings.sort((a, b) => {
    const rank = { critical: 0, watch: 1 } as const;
    return rank[a.severity] - rank[b.severity];
  });

  return {
    period,
    label: bounds.label,
    startGlobalWeek: bounds.startGlobalWeek,
    endGlobalWeek: bounds.endGlobalWeek,
    expectedWeeks: bounds.expectedWeeks,
    weeksTracked: current.weeks,
    overallStatus: overallStatus(warnings),
    departmentProductivity: current.departmentProductivity,
    productivityIndex: current.productivityIndex,
    productivityStatus: statuses.productivity,
    revenuePerEmployee: current.revenuePerEmployee,
    revenuePerEmployeeChangePct,
    revenuePerEmployeeStatus: statuses.revenuePerEmployee,
    payrollToRevenueRatio,
    payrollStatus: statuses.payroll,
    annualizedTurnoverRate: current.annualizedTurnoverRate,
    turnoverTrend,
    turnoverChangePctPoints,
    turnoverStatus: statuses.turnover,
    debtCoverage,
    debtCoverageStatus: statuses.debt,
    averageMaintenanceCondition: maintenance.averageCondition,
    maintenanceBacklog: maintenance.backlog,
    maintenanceStatus: statuses.maintenance,
    projectOperatingRoi,
    projectAnnualOperatingBenefit: Math.round(projectAnnualOperatingBenefit),
    completedProjectCost: Math.round(completedProjectCost),
    completedProjectCount,
    projectRoiStatus: statuses.projectRoi,
    warnings,
    periodRevenue: current.revenue,
    periodExpenses: current.expenses,
    periodProfit: current.profit,
    periodPayroll: current.payroll,
    periodDebtService: current.debtService,
    periodEmployeeWeeks: current.averageHeadcount * current.weeks,
    periodTurnoverCount: current.turnover,
    averageHeadcount: current.averageHeadcount,
    previousPeriodRevenue: previous.revenue,
    previousPeriodEmployeeWeeks: previous.averageHeadcount * previous.weeks,
    previousPeriodTurnoverCount: previous.turnover,
  };
}
