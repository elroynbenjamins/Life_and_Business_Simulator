import {
  calculateTax,
  getNetWorth,
  getPortfolioValue,
  processLoans,
  processTaxes,
} from '../financeEngine';
import { GameState, INITIAL_GAME_STATE } from '../../types/game';

function state(overrides: Partial<GameState> = {}): GameState {
  return {
    ...INITIAL_GAME_STATE,
    ...overrides,
  };
}

describe('financeEngine', () => {
  test.each([
    [0, 0],
    [5_000, 750],
    [10_000, 2_000],
    [20_000, 5_000],
  ])('calculates progressive tax for %i earnings', (earnings, expected) => {
    expect(calculateTax(earnings)).toBe(expected);
  });

  test('collects tax every 20 weeks and resets period earnings', () => {
    const result = processTaxes(state({ earningsSinceLastTax: 9_000 }), 1_000, 20);

    expect(result).toEqual({
      isTaxWeek: true,
      taxAmount: 2_000,
      earningsForPeriod: 10_000,
      newEarningsSinceLastTax: 0,
    });
  });

  test('values only holdings with a matching stock', () => {
    const value = getPortfolioValue(
      [{ ticker: 'ACME', currentPrice: 25, priceHistory: [25] }],
      [
        { ticker: 'ACME', shares: 4, avgBuyPrice: 20 },
        { ticker: 'MISSING', shares: 10, avgBuyPrice: 5 },
      ],
    );

    expect(value).toBe(100);
  });

  test('subtracts personal and business debt from net worth', () => {
    const result = getNetWorth(state({
      cash: 1_000,
      stocks: [{ ticker: 'ACME', currentPrice: 50, priceHistory: [50] }],
      holdings: [{ ticker: 'ACME', shares: 2, avgBuyPrice: 40 }],
      loans: [{
        loanId: 'personal',
        name: 'Personal loan',
        originalAmount: 500,
        remainingAmount: 300,
        weeklyPayment: 25,
        weeksRemaining: 12,
      }],
      businesses: [{
        valuation: 2_000,
        balance: 500,
        businessLoans: [{ remainingAmount: 400 }],
      } as GameState['businesses'][number]],
      properties: [{ currentValue: 3_000 } as GameState['properties'][number]],
    }));

    expect(result).toBe(5_900);
  });

  test('removes a loan after its final payment', () => {
    const result = processLoans(state({
      loans: [{
        loanId: 'final-payment',
        name: 'Final payment',
        originalAmount: 100,
        remainingAmount: 25,
        weeklyPayment: 25,
        weeksRemaining: 1,
      }],
    }));

    expect(result).toEqual({ loans: [], totalPaid: 25, loansRepaid: 1 });
  });
});
