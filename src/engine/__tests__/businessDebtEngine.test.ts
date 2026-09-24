import {
  applyBusinessLoanPrincipalPayment,
  getBusinessLoanOutstandingPrincipal,
  getBusinessLoanPaymentSplit,
  getBusinessWeeklyInterestExpense,
  processScheduledBusinessLoanPayments,
} from '../businessDebtEngine';
import { BusinessLoan } from '../../types/game';

function loan(overrides: Partial<BusinessLoan> = {}): BusinessLoan {
  return {
    id: 'loan-1',
    amount: 100_000,
    remainingAmount: 110_000,
    weeklyPayment: 11_000,
    weeksRemaining: 10,
    interestRate: 0.10,
    purpose: 'operating',
    ...overrides,
  };
}

describe('business debt reconciliation', () => {
  test('separates outstanding principal from scheduled future interest', () => {
    const debt = loan();
    expect(getBusinessLoanOutstandingPrincipal(debt)).toBe(100_000);
    const split = getBusinessLoanPaymentSplit(debt);
    expect(split.payment).toBe(11_000);
    expect(split.interest).toBe(1_000);
    expect(split.principal).toBe(10_000);
  });

  test('weekly interest helper excludes principal repayment', () => {
    const business = {
      businessLoans: [loan()],
    } as any;

    expect(getBusinessWeeklyInterestExpense(business)).toBe(1_000);
  });

  test('scheduled payment never exceeds the final contractual balance', () => {
    const final = loan({
      remainingAmount: 550,
      weeklyPayment: 11_000,
      weeksRemaining: 1,
    });
    const result = processScheduledBusinessLoanPayments([final]);

    expect(result.debtService).toBe(550);
    expect(result.principalRepaid + result.interestExpense).toBe(550);
    expect(result.loans).toHaveLength(0);
    expect(result.loansRepaid).toBe(1);
  });

  test('early repayment pays principal and cancels its future interest', () => {
    const result = applyBusinessLoanPrincipalPayment(loan(), 25_000);

    expect(result.cashUsed).toBe(25_000);
    expect(result.principalRepaid).toBe(25_000);
    expect(result.scheduledBalanceReduced).toBe(27_500);
    expect(result.loan?.remainingAmount).toBe(82_500);
    expect(getBusinessLoanOutstandingPrincipal(result.loan!)).toBe(75_000);
  });

  test('early full payoff requires principal, not all future scheduled interest', () => {
    const result = applyBusinessLoanPrincipalPayment(loan(), 110_000);

    expect(result.cashUsed).toBe(100_000);
    expect(result.principalRepaid).toBe(100_000);
    expect(result.scheduledBalanceReduced).toBe(110_000);
    expect(result.loan).toBeNull();
  });
});
