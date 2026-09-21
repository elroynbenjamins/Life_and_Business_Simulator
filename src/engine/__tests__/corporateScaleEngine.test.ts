import {
  calculateValuation,
  candidateToEmployee,
  createBusiness,
  generateCandidates,
  getBusinessDecisionChoiceCost,
  processBusinessWeek,
} from '../businessEngine';
import {
  CORPORATE_CAPEX_PROJECTS,
  canStartCorporateCapex,
  getCorporateCapexBookValue,
  getCorporateCapexCost,
  getCorporateCapexOperatingEffects,
  getCorporateScaleLabel,
  getCorporateScaleTier,
  makeCorporateScaleCrisis,
} from '../corporateScaleEngine';

function staffedCorporateBusiness() {
  jest.spyOn(Math, 'random').mockReturnValue(0.5);
  const business = createBusiness('coffee_shop', 'Corporate Coffee Group', 1, 8, 1)!;
  const employees = [];
  const names: string[] = [];
  for (let index = 0; index < 3; index += 1) {
    const candidate = generateCandidates('worker', names, 1)[1];
    names.push(candidate.name);
    employees.push(candidateToEmployee(candidate));
  }
  return {
    ...business,
    balance: 120_000_000,
    valuation: 200_000_000,
    reputation: 90,
    level: 7,
    employees,
  };
}

describe('corporate scale and capital expenditure', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('classifies company scale using late-game valuation thresholds', () => {
    expect(getCorporateScaleTier({ valuation: 24_999_999 })).toBe('local');
    expect(getCorporateScaleTier({ valuation: 25_000_000 })).toBe('corporate');
    expect(getCorporateScaleTier({ valuation: 75_000_000 })).toBe('major');
    expect(getCorporateScaleTier({ valuation: 175_000_000 })).toBe('global');
    expect(getCorporateScaleLabel('global')).toBe('Global Corporation');
  });

  test('corporate projects span meaningful late-game costs and scale with inflation', () => {
    expect(CORPORATE_CAPEX_PROJECTS[0].baseCost).toBe(5_000_000);
    expect(CORPORATE_CAPEX_PROJECTS[CORPORATE_CAPEX_PROJECTS.length - 1].baseCost).toBe(90_000_000);
    expect(getCorporateCapexCost(CORPORATE_CAPEX_PROJECTS[0], 1.5)).toBe(7_500_000);
  });

  test('project gates use valuation, reputation and one-active-project rule', () => {
    const project = CORPORATE_CAPEX_PROJECTS.find((item) => item.id === 'corporate_hq')!;
    const business = staffedCorporateBusiness();

    expect(canStartCorporateCapex(business, project).allowed).toBe(true);
    expect(canStartCorporateCapex({ ...business, valuation: 20_000_000 }, project).allowed).toBe(false);
    expect(canStartCorporateCapex({ ...business, reputation: 50 }, project).allowed).toBe(false);
    expect(canStartCorporateCapex({
      ...business,
      activeCorporateCapex: {
        projectId: 'other',
        projectName: 'Other',
        costPaid: 1,
        startedGlobalWeek: 1,
        weeksRemaining: 2,
        totalWeeks: 2,
      },
    }, project).allowed).toBe(false);
  });

  test('completed projects stack only within hard permanent-effect caps', () => {
    const business = {
      ...staffedCorporateBusiness(),
      completedCorporateCapex: CORPORATE_CAPEX_PROJECTS.map((project, index) => ({
        projectId: project.id,
        projectName: project.name,
        costPaid: project.baseCost,
        completedGlobalWeek: 100 + index,
      })),
    };

    const effects = getCorporateCapexOperatingEffects(business);
    expect(effects.revenueBonus).toBeLessThanOrEqual(0.10);
    expect(effects.expenseReduction).toBeLessThanOrEqual(0.07);
    expect(effects.crisisReduction).toBeLessThanOrEqual(0.08);
    expect(effects.revenueBonus).toBeCloseTo(0.10);
  });

  test('corporate assets retain partial book value while work in progress is discounted', () => {
    const hq = CORPORATE_CAPEX_PROJECTS.find((item) => item.id === 'corporate_hq')!;
    const business = {
      ...staffedCorporateBusiness(),
      balance: 0,
      weeklyProfitHistory: [],
      completedCorporateCapex: [{
        projectId: hq.id,
        projectName: hq.name,
        costPaid: 5_000_000,
        completedGlobalWeek: 100,
      }],
      activeCorporateCapex: {
        projectId: 'automation_platform',
        projectName: 'Automation & Data Platform',
        costPaid: 12_000_000,
        startedGlobalWeek: 101,
        weeksRemaining: 6,
        totalWeeks: 12,
      },
    };

    expect(getCorporateCapexBookValue(business)).toBe(9_400_000);
    expect(calculateValuation(business)).toBe(9_400_000);
  });

  test('finishing a corporate project converts construction into a permanent asset next week', () => {
    const project = CORPORATE_CAPEX_PROJECTS.find((item) => item.id === 'corporate_hq')!;
    const business = {
      ...staffedCorporateBusiness(),
      activeCorporateCapex: {
        projectId: project.id,
        projectName: project.name,
        costPaid: 5_000_000,
        startedGlobalWeek: 141,
        weeksRemaining: 1,
        totalWeeks: project.weeks,
      },
      completedCorporateCapex: [],
    };

    const result = processBusinessWeek(business, 1, 2, 8);

    expect(result.updatedBusiness.activeCorporateCapex).toBeNull();
    expect(result.updatedBusiness.completedCorporateCapex).toHaveLength(1);
    expect(result.updatedBusiness.completedCorporateCapex?.[0].projectId).toBe('corporate_hq');
    expect(result.updatedBusiness.timeline?.some((entry) => entry.kind === 'corporate_capex')).toBe(true);
  });

  test('large-company crises use absolute current-euro costs rather than double inflation scaling', () => {
    jest.spyOn(Math, 'random').mockReturnValue(0);
    const business = staffedCorporateBusiness();
    const crisis = makeCorporateScaleCrisis(business, 160);
    const paidChoice = crisis.choices.find((choice) => (choice.businessCashCost ?? 0) > 0)!;

    expect(crisis.title).toBe('Cybersecurity Incident');
    expect(paidChoice.cashCostScale).toBe('absolute');
    expect(getBusinessDecisionChoiceCost(paidChoice, 3)).toBe(paidChoice.businessCashCost);
    expect(getBusinessDecisionChoiceCost({ businessCashCost: 10_000 }, 3)).toBe(30_000);
  });
});
