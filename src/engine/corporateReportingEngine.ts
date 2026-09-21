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
  getBusinessReinvestmentEffects,
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

export type CorporateVarianceDirection = 'positive' | 'negative' | 'neutral';
export type CorporateVarianceArea =
  | 'headcount'
  | 'productivity'
  | 'skill'
  | 'morale'
  | 'payroll'
  | 'maintenance'
  | 'debt'
  | 'integration'
  | 'reputation'
  | 'market_share'
  | 'untracked';

export interface CorporateVarianceDriver {
  id: string;
  area: CorporateVarianceArea;
  direction: CorporateVarianceDirection;
  title: string;
  detail: string;
  impactScore: number;
}

export interface CorporateManagementReport {
  period: CorporateReportPeriod;
  label: string;
  startGlobalWeek: number;
  endGlobalWeek: number;
  expectedWeeks: number;
  weeksTracked: number;
  revenueChangePct: number | null;
  expensesChangePct: number | null;
  profitMargin: number;
  profitMarginChangePctPoints: number | null;
  varianceDrivers: CorporateVarianceDriver[];
  varianceHistoryCoverage: 'baseline' | 'partial' | 'full';
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

function averageOptional(values: Array<number | null | undefined>): number | null {
  const usable = values.filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
  return usable.length > 0 ? average(usable) : null;
}

function pctChange(current: number, previous: number): number | null {
  if (!Number.isFinite(current) || !Number.isFinite(previous) || Math.abs(previous) < 1e-9) return null;
  return (current - previous) / Math.abs(previous);
}

function getAcquisitionReportingModifiers(business: OwnedBusiness) {
  const acquisition = business.acquisition;
  if (!acquisition) {
    return { revenueModifier: 0, expenseModifier: 0, integrationWeeksRemaining: 0 };
  }

  let revenueMultiplier = 1;
  let expenseMultiplier = 1;
  if (acquisition.integrationStrategy === 'pending') {
    const penalty = Math.max(
      0.01,
      Math.min(0.05, (acquisition.baseIntegrationPenalty ?? acquisition.integrationPenalty ?? 0.08) * 0.35),
    );
    revenueMultiplier *= 1 - penalty;
    expenseMultiplier *= 1 + penalty * 0.50;
  } else if ((acquisition.integrationWeeksRemaining ?? 0) > 0) {
    const penalty = Math.max(0, Math.min(0.25, acquisition.integrationPenalty ?? 0));
    revenueMultiplier *= 1 - penalty;
    expenseMultiplier *= 1 + penalty * 0.75;
  } else if (acquisition.integrationOutcome !== 'pending') {
    revenueMultiplier *= 1 + Math.max(-0.05, Math.min(0.08, acquisition.postIntegrationRevenueBonus ?? 0));
    expenseMultiplier *= 1 - Math.max(-0.05, Math.min(0.08, acquisition.postIntegrationExpenseReduction ?? 0));
  }

  revenueMultiplier *= 1 + Math.max(-0.05, Math.min(0.05, acquisition.persistentRevenueModifier ?? 0));
  expenseMultiplier *= 1 + Math.max(-0.05, Math.min(0.05, acquisition.persistentExpenseModifier ?? 0));

  return {
    revenueModifier: revenueMultiplier - 1,
    expenseModifier: expenseMultiplier - 1,
    integrationWeeksRemaining: Math.max(0, acquisition.integrationWeeksRemaining ?? 0),
  };
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
  let weightedSkill = 0;
  let weightedMorale = 0;
  let headcount = 0;

  for (const id of DEPARTMENT_IDS) {
    const department = workforce.departments[id];
    const departmentHeadcount = Math.max(0, department?.headcount ?? 0);
    const productivity = Math.round((effects.departmentRatios[id] ?? 1) * 1000) / 10;
    departmentProductivity[id] = productivity;
    headcount += departmentHeadcount;
    weightedProductivity += productivity * departmentHeadcount;
    weightedSkill += Math.max(0, department?.averageSkill ?? 0) * departmentHeadcount;
    weightedMorale += Math.max(0, department?.morale ?? 0) * departmentHeadcount;
  }

  const productivityIndex = headcount > 0
    ? weightedProductivity / headcount
    : average(DEPARTMENT_IDS.map((id) => departmentProductivity[id]));
  const averageDepartmentSkill = headcount > 0 ? weightedSkill / headcount : 0;
  const averageDepartmentMorale = headcount > 0 ? weightedMorale / headcount : 0;

  const reinvestment = normalizeBusinessReinvestmentState(business.reinvestment, globalWeek);
  const averageMaintenanceCondition = (
    reinvestment.technology.condition
    + reinvestment.premises.condition
    + reinvestment.equipment.condition
  ) / 3;
  const reinvestmentEffects = getBusinessReinvestmentEffects(business);
  const acquisitionModifiers = getAcquisitionReportingModifiers(business);

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
    averageDepartmentSkill: Math.round(averageDepartmentSkill * 10) / 10,
    averageDepartmentMorale: Math.round(averageDepartmentMorale * 10) / 10,
    employeeRelations: Math.round((workforce.employeeRelations ?? 70) * 10) / 10,
    maintenanceRevenuePenalty: reinvestmentEffects.revenuePenalty,
    maintenanceExpenseIncrease: reinvestmentEffects.expenseIncrease,
    acquisitionRevenueModifier: acquisitionModifiers.revenueModifier,
    acquisitionExpenseModifier: acquisitionModifiers.expenseModifier,
    integrationWeeksRemaining: acquisitionModifiers.integrationWeeksRemaining,
    reputation: Math.round((business.reputation ?? 0) * 10) / 10,
    marketShareModifier: Math.round((business.marketShareModifier ?? 0) * 10) / 10,
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
