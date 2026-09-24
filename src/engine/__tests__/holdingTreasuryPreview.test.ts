import { getHoldingTreasuryTransactionPreview } from '../holdingCompanyEngine';

describe('holding treasury transaction preview', () => {
  test('funding moves personal cash into the holding reserve', () => {
    const preview = getHoldingTreasuryTransactionPreview({
      action: 'fund',
      personalCash: 5_000_000,
      cashReserve: 2_000_000,
      amount: 1_000_000,
      reserveTarget: 750_000,
    });

    expect(preview.canExecute).toBe(true);
    expect(preview.transactionAmount).toBe(1_000_000);
    expect(preview.personalCashAfter).toBe(4_000_000);
    expect(preview.cashReserveAfter).toBe(3_000_000);
    expect(preview.cashAboveTargetAfter).toBe(2_250_000);
  });

  test('owner distributions preserve the protected reserve target', () => {
    const preview = getHoldingTreasuryTransactionPreview({
      action: 'distribution',
      personalCash: 600_000,
      cashReserve: 3_000_000,
      amount: 1_000_000,
      reserveTarget: 1_500_000,
    });

    expect(preview.canExecute).toBe(true);
    expect(preview.personalCashAfter).toBe(1_600_000);
    expect(preview.cashReserveAfter).toBe(2_000_000);
    expect(preview.cashAboveTargetAfter).toBe(500_000);
  });

  test('preview reports an oversized owner distribution as unavailable', () => {
    const preview = getHoldingTreasuryTransactionPreview({
      action: 'distribution',
      personalCash: 600_000,
      cashReserve: 3_000_000,
      amount: 2_000_000,
      reserveTarget: 1_500_000,
    });

    expect(preview.canExecute).toBe(false);
    expect(preview.transactionAmount).toBe(1_500_000);
    expect(preview.cashReserveAfter).toBe(1_500_000);
    expect(preview.cashAboveTargetAfter).toBe(0);
  });

  test('preview reports funding above personal cash as unavailable', () => {
    const preview = getHoldingTreasuryTransactionPreview({
      action: 'fund',
      personalCash: 500_000,
      cashReserve: 4_000_000,
      amount: 1_000_000,
    });

    expect(preview.canExecute).toBe(false);
    expect(preview.transactionAmount).toBe(500_000);
    expect(preview.personalCashAfter).toBe(0);
    expect(preview.cashReserveAfter).toBe(4_500_000);
  });
});
