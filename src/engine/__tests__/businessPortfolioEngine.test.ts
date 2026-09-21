import { createBusiness } from '../businessEngine';
import {
  buildSoldBusinessRecord,
  getBusinessEmpireSummary,
  getBusinessEquityReturn,
  getBusinessSaleQuote,
} from '../businessPortfolioEngine';
import { OwnedBusiness } from '../../types/game';

function makeBusiness(): OwnedBusiness {
  const business = createBusiness('coffee_shop', 'Ledger Coffee', 1, 2, 1)!;
  return {
    ...business,
    id: 'biz_test',
    valuation: 300_000,
    balance: 25_000,
    lastWeekProfit: 8_000,
    capitalInvested: 100_000,
    totalPlayerDistributions: 20_000,
    businessLoans: [{
      id: 'loan_test',
      amount: 60_000,
      remainingAmount: 50_000,
      weeklyPayment: 2_000,
      weeksRemaining: 25,
      interestRate: 0.08,
      purpose: 'operating',
    }],
  };
}

describe('business portfolio engine', () => {
  test('builds a transparent sale quote including debt and lifetime distributions', () => {
    const business = makeBusiness();
    const quote = getBusinessSaleQuote(business);

    expect(quote.grossSalePrice).toBe(300_000);
    expect(quote.debtSettlement).toBe(50_000);
    expect(quote.netSaleProceeds).toBe(250_000);
    expect(quote.investmentBasis).toBe(100_000);
    expect(quote.totalPlayerDistributions).toBe(20_000);
    expect(quote.lifetimeCashResult).toBe(170_000);
    expect(quote.lifetimeReturnPct).toBeCloseTo(170);
  });

  test('current portfolio ROI values debt-adjusted equity plus distributions', () => {
    const result = getBusinessEquityReturn(makeBusiness());

    expect(result.equityValue).toBe(250_000);
    expect(result.lifetimeValue).toBe(270_000);
    expect(result.gain).toBe(170_000);
    expect(result.returnPct).toBeCloseTo(170);
  });

  test('legacy acquisition basis falls back to shareholder cash contribution plus later capital', () => {
    const business = {
      ...makeBusiness(),
      capitalInvested: null,
      acquisition: {
        purchasePrice: 400_000,
        cashContribution: 120_000,
        debtFinanced: 280_000,
        fundingMode: 'leveraged' as const,
        sellerName: 'Founder-led sale',
        acquiredGlobalWeek: 30,
        estimatedValueAtPurchase: 400_000,
        baseIntegrationWeeks: 6,
        baseIntegrationPenalty: 0.05,
        integrationStrategy: 'independent' as const,
        integrationOutcome: 'success' as const,
        integrationWeeksRemaining: 0,
        integrationPenalty: 0,
        integrationSuccessChance: 1,
        postIntegrationRevenueBonus: 0,
        postIntegrationExpenseReduction: 0,
        initialRisk: 'low' as const,
        diligenceScore: 90,
        additionalCapitalInvested: 30_000,
      },
    };

    expect(getBusinessEquityReturn(business).investmentBasis).toBe(150_000);
  });

  test('archives sold companies with hold period and closing result', () => {
    const record = buildSoldBusinessRecord(makeBusiness(), 6, 3, 'Family Holdings');

    expect(record.name).toBe('Ledger Coffee');
    expect(record.soldGlobalWeek).toBe(46);
    expect(record.heldWeeks).toBe(25);
    expect(record.netSaleProceeds).toBe(250_000);
    expect(record.lifetimeCashResult).toBe(170_000);
    expect(record.holdingCompanyName).toBe('Family Holdings');
  });

  test('summarizes empire debt, cash and attention without double counting', () => {
    const business = {
      ...makeBusiness(),
      pendingDecision: {
        id: 'decision_1',
        kind: 'strategy' as const,
        title: 'Pricing review',
        description: 'Review pricing.',
        icon: 'cash',
        createdGlobalWeek: 45,
        deadlineGlobalWeek: 49,
        defaultChoiceId: 'hold',
        choices: [],
      },
    };
    const summary = getBusinessEmpireSummary([business], [{
      id: 'holding_1',
      name: 'Family Holdings',
      createdGlobalWeek: 1,
      founderGeneration: 1,
      generationsOwned: 1,
      controllerName: 'Player',
      controllerPersonId: null,
      cashReserve: 75_000,
      totalCapitalDeployed: 0,
      executiveChildId: null,
      executiveChildName: null,
      executivePerformance: 50,
      designatedSuccessorChildId: null,
      designatedSuccessorChildName: null,
    }]);

    expect(summary.totalValue).toBe(300_000);
    expect(summary.totalDebt).toBe(50_000);
    expect(summary.netBusinessEquity).toBe(250_000);
    expect(summary.operatingCash).toBe(25_000);
    expect(summary.holdingCash).toBe(75_000);
    expect(summary.totalEmpireCash).toBe(100_000);
    expect(summary.attentionCount).toBe(1);
  });
});
