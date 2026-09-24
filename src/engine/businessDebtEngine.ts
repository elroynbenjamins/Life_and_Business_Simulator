import { BusinessLoan, OwnedBusiness } from '../types/game';

export interface BusinessLoanPaymentSplit {
  payment: number;
  interest: number;
  principal: number;
}

export interface BusinessLoanTickResult {
  loans: BusinessLoan[];
  debtService: number;
  interestExpense: number;
  principalRepaid: number;
  loansRepaid: number;
}

/**
 * Business loans store remainingAmount as the remaining contractual payoff
 * (principal + the flat interest priced when the loan was issued).
 * This helper derives the economic principal without changing legacy saves.
 */
export function getBusinessLoanOutstandingPrincipal(loan: BusinessLoan): number {
  const remainingPayoff = Math.max(0, loan.remainingAmount ?? 0);
  const rate = Math.max(0, loan.interestRate ?? 0);
  if (remainingPayoff <= 0) return 0;
  return Math.max(0, Math.min(
    loan.amount ?? remainingPayoff,
    remainingPayoff / Math.max(1, 1 + rate),
  ));
}

export function getBusinessLoanRemainingInterest(loan: BusinessLoan): number {
  return Math.max(
    0,
    Math.max(0, loan.remainingAmount ?? 0) - getBusinessLoanOutstandingPrincipal(loan),
  );
}

export function getBusinessLoanPaymentSplit(
  loan: BusinessLoan,
  requestedPayment = loan.weeklyPayment ?? 0,
): BusinessLoanPaymentSplit {
  const payment = Math.max(
    0,
    Math.min(
      Math.round(requestedPayment ?? 0),
      Math.max(0, Math.round(loan.remainingAmount ?? 0)),
    ),
  );
  if (payment <= 0) return { payment: 0, interest: 0, principal: 0 };

  const rate = Math.max(0, loan.interestRate ?? 0);
  const interestShare = rate > 0 ? rate / (1 + rate) : 0;
  const interest = Math.max(0, Math.min(payment, Math.round(payment * interestShare)));
  return {
    payment,
    interest,
    principal: Math.max(0, payment - interest),
  };
}

export function processScheduledBusinessLoanPayments(
  loans: BusinessLoan[],
): BusinessLoanTickResult {
  const updatedLoans: BusinessLoan[] = [];
  let debtService = 0;
  let interestExpense = 0;
  let principalRepaid = 0;
  let loansRepaid = 0;

  for (const loan of loans ?? []) {
    const split = getBusinessLoanPaymentSplit(loan);
    debtService += split.payment;
    interestExpense += split.interest;
    principalRepaid += split.principal;

    const remainingAmount = Math.max(0, (loan.remainingAmount ?? 0) - split.payment);
    const weeksRemaining = Math.max(0, (loan.weeksRemaining ?? 1) - 1);

    if (remainingAmount > 0 && weeksRemaining > 0) {
      updatedLoans.push({
        ...loan,
        remainingAmount,
        weeksRemaining,
        weeklyPayment: Math.max(1, Math.ceil(remainingAmount / weeksRemaining)),
      });
    } else {
      loansRepaid += 1;
    }
  }

  return {
    loans: updatedLoans,
    debtService: Math.round(debtService),
    interestExpense: Math.round(interestExpense),
    principalRepaid: Math.round(principalRepaid),
    loansRepaid,
  };
}

export function getBusinessDebtPrincipal(business: OwnedBusiness): number {
  return Math.round((business.businessLoans ?? []).reduce(
    (sum, loan) => sum + getBusinessLoanOutstandingPrincipal(loan),
    0,
  ));
}

export function getBusinessDebtPayoffBalance(business: OwnedBusiness): number {
  return Math.round((business.businessLoans ?? []).reduce(
    (sum, loan) => sum + Math.max(0, loan.remainingAmount ?? 0),
    0,
  ));
}

export function getBusinessWeeklyDebtService(business: OwnedBusiness): number {
  return Math.round((business.businessLoans ?? []).reduce(
    (sum, loan) => sum + Math.min(
      Math.max(0, loan.weeklyPayment ?? 0),
      Math.max(0, loan.remainingAmount ?? 0),
    ),
    0,
  ));
}
