import { OwnedBusiness, CorporateDepartmentId, BusinessReinvestmentArea } from '../types/game';
import {
  CORPORATE_DEPARTMENT_DEFINITIONS,
  CORPORATE_COMPENSATION_POLICIES,
  CORPORATE_TRAINING_POLICIES,
  getRecommendedDepartmentHeadcounts,
} from './businessWorkforceEngine';
import {
  BUSINESS_REINVESTMENT_AREAS,
  getBusinessReinvestmentCost,
  normalizeBusinessReinvestmentState,
} from './businessReinvestmentEngine';
import {
  CorporateKpiStatus,
  CorporateManagementReport,
} from './corporateReportingEngine';

export type CorporateManagementActionTarget =
  | 'workforce'
  | 'budget'
  | 'finance'
  | 'maintenance'
  | 'investments';

export interface CorporateManagementAction {
  id: string;
  severity: Extract<CorporateKpiStatus, 'critical' | 'watch'>;
  title: string;
  detail: string;
  cta: string;
  target: CorporateManagementActionTarget;
}

const DEPARTMENT_IDS = Object.keys(CORPORATE_DEPARTMENT_DEFINITIONS) as CorporateDepartmentId[];
const REINVESTMENT_AREAS = Object.keys(BUSINESS_REINVESTMENT_AREAS) as BusinessReinvestmentArea[];

function severityRank(severity: CorporateManagementAction['severity']): number {
  return severity === 'critical' ? 0 : 1;
}

function action(
  id: string,
  severity: CorporateManagementAction['severity'],
  title: string,
  detail: string,
  target: CorporateManagementActionTarget,
  cta: string,
): CorporateManagementAction {
  return { id, severity, title, detail, target, cta };
}

function weakestDepartment(report: CorporateManagementReport): CorporateDepartmentId {
  return [...DEPARTMENT_IDS].sort(
    (a, b) => (report.departmentProductivity[a] ?? 100) - (report.departmentProductivity[b] ?? 100),
  )[0];
}

function formatCurrencyShort(value: number): string {
  const amount = Math.max(0, Math.round(value));
  if (amount >= 1_000_000_000) return `€${(amount / 1_000_000_000).toFixed(amount >= 10_000_000_000 ? 0 : 1)}B`;
  if (amount >= 1_000_000) return `€${(amount / 1_000_000).toFixed(amount >= 10_000_000 ? 0 : 1)}M`;
  if (amount >= 1_000) return `€${(amount / 1_000).toFixed(amount >= 10_000 ? 0 : 1)}K`;
  return `€${amount.toLocaleString()}`;
}

export function getCorporateManagementActions(
  business: OwnedBusiness,
  report: CorporateManagementReport,
  inflationMultiplier = 1,
): CorporateManagementAction[] {
  const workforce = business.corporateWorkforce;
  if (!workforce) return [];

  const actions: CorporateManagementAction[] = [];
  const warningMap = new Map(report.warnings.map((warning) => [warning.id, warning]));
  const recommended = getRecommendedDepartmentHeadcounts(business);
  const currentHeadcount = DEPARTMENT_IDS.reduce(
    (sum, departmentId) => sum + Math.max(0, workforce.departments[departmentId]?.headcount ?? 0),
    0,
  );
  const targetHeadcount = DEPARTMENT_IDS.reduce(
    (sum, departmentId) => sum + Math.max(0, workforce.departments[departmentId]?.targetHeadcount ?? 0),
    0,
  );
  const recommendedHeadcount = DEPARTMENT_IDS.reduce(
    (sum, departmentId) => sum + Math.max(0, recommended[departmentId] ?? 0),
    0,
  );

  const productivityWarning = warningMap.get('department-productivity');
  if (productivityWarning) {
    const departmentId = weakestDepartment(report);
    const department = workforce.departments[departmentId];
    const definition = CORPORATE_DEPARTMENT_DEFINITIONS[departmentId];
    const recommendedCount = Math.max(1, recommended[departmentId] ?? department.headcount);

    if (department.targetHeadcount < recommendedCount || department.headcount < recommendedCount * 0.95) {
      actions.push(action(
        'restore-department-capacity',
        productivityWarning.severity,
        `Restore ${definition.name} capacity`,
        `${department.headcount} current • ${department.targetHeadcount} target • ${recommendedCount} recommended. Bring the target closer to the recommended level before adding pressure elsewhere.`,
        'workforce',
        'Review workforce',
      ));
    } else if (
      department.averageSkill < 68
      && (workforce.trainingPolicy === 'minimal' || workforce.trainingPolicy === 'standard' || !workforce.trainingPolicy)
    ) {
      actions.push(action(
        'strengthen-department-training',
        productivityWarning.severity,
        `Strengthen ${definition.name} training`,
        `Headcount is near plan, but average skill is ${Math.round(department.averageSkill)}. The current ${CORPORATE_TRAINING_POLICIES[workforce.trainingPolicy ?? 'standard'].label} policy may be too light for this bottleneck.`,
        'workforce',
        'Review training',
      ));
    } else {
      actions.push(action(
        'review-department-capacity',
        productivityWarning.severity,
        `Review ${definition.name} staffing and morale`,
        `${definition.name} is the weakest department at ${(report.departmentProductivity[departmentId] ?? 0).toFixed(0)}% productivity. Check staffing, skill, morale and executive coverage together.`,
        'workforce',
        'Review workforce',
      ));
    }
  }

  const payrollWarning = warningMap.get('payroll-ratio');
  if (payrollWarning) {
    if (targetHeadcount > recommendedHeadcount * 1.08) {
      actions.push(action(
        'reduce-excess-hiring-targets',
        payrollWarning.severity,
        'Reduce excess hiring targets',
        `Department targets total ${targetHeadcount} versus ${recommendedHeadcount} recommended while payroll consumes ${(report.payrollToRevenueRatio * 100).toFixed(1)}% of revenue. Trim future hiring before cutting productive staff.`,
        'workforce',
        'Review targets',
      ));
    } else if (currentHeadcount > recommendedHeadcount * 1.10) {
      actions.push(action(
        'rebalance-current-headcount',
        payrollWarning.severity,
        'Rebalance corporate headcount',
        `Current department headcount is ${currentHeadcount} versus ${recommendedHeadcount} recommended. Payroll is ${(report.payrollToRevenueRatio * 100).toFixed(1)}% of revenue, so avoid replacing every departure automatically.`,
        'workforce',
        'Review workforce',
      ));
    } else {
      actions.push(action(
        'hold-payroll-growth',
        payrollWarning.severity,
        'Hold payroll growth until revenue catches up',
        `Payroll is ${(report.payrollToRevenueRatio * 100).toFixed(1)}% of revenue even though staffing is close to plan. Keep targets stable and focus on output before expanding the workforce.`,
        'workforce',
        'Review workforce',
      ));
    }
  }

  const turnoverWarning = warningMap.get('turnover');
  if (turnoverWarning) {
    const compensation = workforce.compensationPolicy ?? 'market';
    const training = workforce.trainingPolicy ?? 'standard';
    if (compensation === 'lean' || compensation === 'market') {
      actions.push(action(
        'raise-compensation-policy',
        turnoverWarning.severity,
        'Consider a stronger compensation policy',
        `Turnover is ${(report.annualizedTurnoverRate * 100).toFixed(1)}% annualized. Compensation is currently ${CORPORATE_COMPENSATION_POLICIES[compensation].label}; a stronger policy trades higher payroll for better retention.`,
        'workforce',
        'Review compensation',
      ));
    } else if (training === 'minimal' || training === 'standard') {
      actions.push(action(
        'improve-retention-training',
        turnoverWarning.severity,
        'Use training to improve retention',
        `Compensation is already competitive, but turnover remains elevated. The ${CORPORATE_TRAINING_POLICIES[training].label} training policy leaves room for a stronger development offer.`,
        'workforce',
        'Review training',
      ));
    } else {
      actions.push(action(
        'stabilize-employee-relations',
        turnoverWarning.severity,
        'Stabilize employee relations',
        `Compensation and training are already strong. Employee relations are ${Math.round(workforce.employeeRelations ?? 70)}/100, so prioritize retention-friendly choices in the next HR decision.`,
        'workforce',
        'Review workforce',
      ));
    }
  }

  const debtWarning = warningMap.get('debt-coverage');
  if (debtWarning) {
    const highestCostLoan = [...(business.businessLoans ?? [])]
      .filter((loan) => (loan.remainingAmount ?? 0) > 0)
      .sort((a, b) => (b.interestRate ?? 0) - (a.interestRate ?? 0))[0];

    if (highestCostLoan) {
      actions.push(action(
        'repay-high-cost-debt',
        debtWarning.severity,
        'Repay the highest-cost debt first',
        `${formatCurrencyShort(highestCostLoan.remainingAmount ?? 0)} remains at ${((highestCostLoan.interestRate ?? 0) * 100).toFixed(1)}%. Current debt coverage is ${(report.debtCoverage ?? 0).toFixed(2)}×; extra repayment reduces scheduled pressure.`,
        'finance',
        'Review financing',
      ));
    }

    if ((business.budgetPlan?.debtPaydownPct ?? 0) < 0.20) {
      actions.push(action(
        'increase-debt-paydown-budget',
        debtWarning.severity,
        'Direct more free cash toward debt',
        `The annual cash plan currently sends ${Math.round((business.budgetPlan?.debtPaydownPct ?? 0) * 100)}% to debt paydown. A more debt-focused plan can improve coverage without taking new financing.`,
        'budget',
        'Review cash plan',
      ));
    }
  }

  const maintenanceWarning = warningMap.get('maintenance');
  if (maintenanceWarning) {
    const state = normalizeBusinessReinvestmentState(business.reinvestment, 1);
    const area = [...REINVESTMENT_AREAS].sort(
      (a, b) => state[a].condition - state[b].condition,
    )[0];
    const definition = BUSINESS_REINVESTMENT_AREAS[area];
    const cost = getBusinessReinvestmentCost(business, area, inflationMultiplier);
    actions.push(action(
      'renew-lowest-condition-area',
      maintenanceWarning.severity,
      `Schedule ${definition.name}`,
      `${definition.name.replace(' Renewal', '').replace(' Refresh', '').replace(' Renovation', '')} condition is ${state[area].condition.toFixed(0)}%. The current renewal estimate is about ${formatCurrencyShort(cost)}; total deferred upkeep is ${formatCurrencyShort(report.maintenanceBacklog)}.`,
      'maintenance',
      'Review upkeep',
    ));
  }

  const projectWarning = warningMap.get('project-roi');
  if (projectWarning) {
    actions.push(action(
      'review-next-capex',
      projectWarning.severity,
      'Review the next corporate investment carefully',
      `Direct operating ROI is ${((report.projectOperatingRoi ?? 0) * 100).toFixed(1)}%. Compare revenue and cost effects before starting another project; retained asset value and risk protection are separate benefits.`,
      'investments',
      'Review investments',
    ));
  }

  const revenuePerEmployeeWarning = warningMap.get('revenue-per-employee');
  if (revenuePerEmployeeWarning) {
    const change = report.revenuePerEmployeeChangePct ?? 0;
    if (targetHeadcount > recommendedHeadcount) {
      actions.push(action(
        'slow-headcount-growth',
        revenuePerEmployeeWarning.severity,
        'Slow headcount growth',
        `Revenue per employee is ${(change * 100).toFixed(1)}% versus the prior period while staffing targets sit above recommended levels. Let output catch up before adding more positions.`,
        'workforce',
        'Review targets',
      ));
    } else {
      actions.push(action(
        'improve-output-per-employee',
        revenuePerEmployeeWarning.severity,
        'Improve output per employee',
        `Revenue per employee is ${(change * 100).toFixed(1)}% versus the prior period. Staffing is not materially above plan, so focus on the weakest department's skill, morale and capacity rather than broad cuts.`,
        'workforce',
        'Review workforce',
      ));
    }
  }

  const seen = new Set<string>();
  return actions
    .sort((a, b) => severityRank(a.severity) - severityRank(b.severity))
    .filter((item) => {
      if (seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    })
    .slice(0, 3);
}
