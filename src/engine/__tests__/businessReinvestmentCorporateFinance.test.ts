import { calculateValuation, createBusiness, processBusinessWeek } from '../businessEngine';
import {
  BUSINESS_REINVESTMENT_AREAS,
  canStartBusinessReinvestment,
  createDefaultBusinessReinvestmentState,
  getBusinessConditionLabel,
  getBusinessReinvestmentCost,
  getBusinessReinvestmentEffects,
  getBusinessReinvestmentUrgency,
  tickBusinessReinvestment,
} from '../businessReinvestmentEngine';
import {
  createCorporateLoan,
  getBondQuote,
  getCorporateCreditProfile,
  getProjectFinanceQuote,
  getRevolverDrawQuote,
} from '../corporateFinanceEngine';
import { OwnedBusiness } from '../../types/game';

function makeBusiness(overrides: Partial<OwnedBusiness> = {}): OwnedBusiness {
  const base = createBusiness('coffee_shop', 'Reinvestment Coffee', 1, 3, 1)!;
  return {
    ...base,
    valuation: 50_000_000,
    balance: 10_000_000,
    reputation: 80,
    lastWeekRevenue: 1_000_000,
    lastWeekExpenses: 850_000,
    lastWeekProfit: 150_000,
    weeklyProfitHistory: Array(20).fill(150_000),
    reinvestment: createDefaultBusinessReinvestmentState(41),
    ...overrides,
  };
}

describe('business reinvestment and corporate financing', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('all businesses receive three recurring reinvestment tracks', () => {
    const state = createDefaultBusinessReinvestmentState(41);
    expect(state.technology.condition).toBe(100);
    expect(state.premises.condition).toBe(100);
    expect(state.equipment.condition).toBe(100);
    expect(Object.keys(BUSINESS_REINVESTMENT_AREAS)).toEqual(['technology', 'premises', 'equipment']);
  });

  test('business infrastructure wears gradually and urgency starts below 75 condition', () => {
    const business = makeBusiness();
    let current = business;
    for (let week = 42; week <= 90; week += 1) {
      const tick = tickBusinessReinvestment(current, week);
      current = {
        ...current,
        reinvestment: tick.reinvestment,
        activeReinvestment: tick.activeReinvestment,
      };
    }

    expect(current.reinvestment!.technology.condition).toBeLessThan(75);
    expect(getBusinessReinvestmentUrgency(current)).not.toBeNull();
    expect(getBusinessConditionLabel(current.reinvestment!.technology.condition).label).not.toBe('Current');
  });

  test('neglected reinvestment creates meaningful but capped operating drag', () => {
    const business = makeBusiness({
      reinvestment: {
        technology: { condition: 20, lastRenewedGlobalWeek: 1 },
        premises: { condition: 20, lastRenewedGlobalWeek: 1 },
        equipment: { condition: 20, lastRenewedGlobalWeek: 1 },
      },
    });
    const effects = getBusinessReinvestmentEffects(business);

    expect(effects.revenuePenalty).toBeGreaterThan(0.10);
    expect(effects.revenuePenalty).toBeLessThanOrEqual(0.15);
    expect(effects.expenseIncrease).toBeGreaterThan(0.08);
    expect(effects.expenseIncrease).toBeLessThanOrEqual(0.12);
    expect(effects.crisisIncrease).toBeLessThanOrEqual(0.10);
  });

  test('renewal costs scale with company value while staying bounded', () => {
    const small = makeBusiness({ valuation: 1_000_000 });
    const large = makeBusiness({ valuation: 500_000_000 });

    // The coffee-shop startup-cost floor prevents renewal from becoming trivial.
    expect(getBusinessReinvestmentCost(small, 'technology', 1)).toBe(41_250);
    expect(getBusinessReinvestmentCost(small, 'premises', 1)).toBe(41_250);
    expect(getBusinessReinvestmentCost(large, 'technology', 1)).toBe(10_000_000);
    expect(getBusinessReinvestmentCost(large, 'premises', 1)).toBe(15_000_000);
    expect(getBusinessReinvestmentCost({ ...large, valuation: 2_000_000_000 }, 'premises', 1)).toBe(20_000_000);
  });

  test('neglected infrastructure flows through the weekly business simulation', () => {
    const employee = (id: string) => ({
      id,
      roleId: 'worker',
      name: id,
      skill: 60,
      morale: 75,
      experience: 20,
      potential: 75,
      age: 30,
      weeksEmployed: 20,
      weeklySalary: 260,
      inTrainingId: null,
      trainingWeeksRemaining: 0,
      tier: 'common' as const,
      buffs: [],
    });
    const base = makeBusiness({
      employees: [employee('A'), employee('B'), employee('C')],
      operatingScaleMultiplier: 1,
      reputation: 80,
    });
    const neglected = {
      ...base,
      reinvestment: {
        technology: { condition: 20, lastRenewedGlobalWeek: 1 },
        premises: { condition: 20, lastRenewedGlobalWeek: 1 },
        equipment: { condition: 20, lastRenewedGlobalWeek: 1 },
      },
    };

    jest.spyOn(Math, 'random').mockReturnValue(0.5);
    const healthyWeek = processBusinessWeek(base, 1, 5, 3);
    const neglectedWeek = processBusinessWeek(neglected, 1, 5, 3);

    expect(neglectedWeek.weeklyRevenue).toBeLessThan(healthyWeek.weeklyRevenue);
  });

  test('reinvestment cannot be spammed at pristine condition and completes back at 100', () => {
    const pristine = makeBusiness();
    expect(canStartBusinessReinvestment(pristine, 'technology').allowed).toBe(false);

    const aging = makeBusiness({
      reinvestment: {
        technology: { condition: 60, lastRenewedGlobalWeek: 1 },
        premises: { condition: 80, lastRenewedGlobalWeek: 1 },
        equipment: { condition: 80, lastRenewedGlobalWeek: 1 },
      },
      activeReinvestment: {
        area: 'technology',
        projectName: 'Technology Refresh',
        costPaid: 500_000,
        startedGlobalWeek: 80,
        weeksRemaining: 1,
        totalWeeks: 4,
      },
    });
    const tick = tickBusinessReinvestment(aging, 84);

    expect(tick.completedArea).toBe('technology');
    expect(tick.activeReinvestment).toBeNull();
    expect(tick.reinvestment.technology.condition).toBe(100);
  });

  test('credit rating tightens as leverage rises', () => {
    const lowDebt = makeBusiness();
    const highDebt = makeBusiness({
      businessLoans: [{
        id: 'debt',
        amount: 22_000_000,
        remainingAmount: 24_200_000,
        weeklyPayment: 121_000,
        weeksRemaining: 200,
        interestRate: 0.10,
        purpose: 'corporate_bond',
      }],
    });

    const strong = getCorporateCreditProfile(lowDebt);
    const leveraged = getCorporateCreditProfile(highDebt);

    expect(strong.score).toBeGreaterThan(leveraged.score);
    expect(strong.remainingDebtCapacity).toBeGreaterThan(leveraged.remainingDebtCapacity);
    expect(leveraged.debtToValue).toBeGreaterThan(0.4);
  });

  test('project finance funds 60 percent debt and requires equity plus its fee', () => {
    const business = makeBusiness({ valuation: 100_000_000, lastWeekProfit: 1_000_000 });
    const quote = getProjectFinanceQuote(business, 50_000_000, 0);

    expect(quote.allowed).toBe(true);
    expect(quote.debtPrincipal).toBe(30_000_000);
    expect(quote.arrangementFee).toBe(300_000);
    expect(quote.cashContribution).toBe(20_300_000);
    expect(quote.weeklyPayment).toBeGreaterThan(0);
  });

  test('bonds require major scale and investment-grade credit', () => {
    const tooSmall = makeBusiness({ valuation: 50_000_000 });
    expect(getBondQuote(tooSmall, 10_000_000).allowed).toBe(false);

    const major = makeBusiness({
      valuation: 100_000_000,
      reputation: 95,
      lastWeekRevenue: 2_000_000,
      lastWeekExpenses: 1_500_000,
      lastWeekProfit: 500_000,
    });
    const quote = getBondQuote(major, 10_000_000);
    expect(quote.allowed).toBe(true);
    expect(['AAA', 'AA', 'A', 'BBB']).toContain(getCorporateCreditProfile(major).rating);
  });

  test('revolver is capped by both facility size and company debt capacity', () => {
    const business = makeBusiness({ valuation: 50_000_000 });
    const profile = getCorporateCreditProfile(business);
    const smallDraw = getRevolverDrawQuote(business, 2_500_000);
    const oversizedDraw = getRevolverDrawQuote(business, profile.revolverLimit + 1_000_000);

    expect(smallDraw.allowed).toBe(true);
    expect(oversizedDraw.allowed).toBe(false);
  });

  test('corporate loan creation enters the ordinary debt ledger shape', () => {
    const business = makeBusiness();
    const quote = getRevolverDrawQuote(business, 2_500_000);
    const loan = createCorporateLoan(quote, 80);

    expect(loan.purpose).toBe('corporate_revolver');
    expect(loan.financingType).toBe('revolver');
    expect(loan.remainingAmount).toBe(quote.totalRepayment);
    expect(loan.issuedGlobalWeek).toBe(80);
  });

  test('debt-funded cash is not given the 1.5x equity-cash valuation premium', () => {
    const debtFunded = makeBusiness({
      weeklyProfitHistory: [],
      balance: 10_000_000,
      completedCorporateCapex: [],
      activeCorporateCapex: null,
      businessLoans: [{
        id: 'borrowed_cash',
        amount: 10_000_000,
        remainingAmount: 10_000_000,
        weeklyPayment: 100_000,
        weeksRemaining: 100,
        interestRate: 0,
        purpose: 'corporate_revolver',
      }],
    });

    expect(calculateValuation(debtFunded)).toBe(10_000_000);
  });
});
