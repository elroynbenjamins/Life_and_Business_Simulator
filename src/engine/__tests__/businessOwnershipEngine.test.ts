import {
  getBusinessOwnershipTable,
  getInvestmentForPostMoneyIssuePct,
  getPlayerEquityOwnershipPct,
  getRemainingPlayerCapitalBasisAfterShareTransfer,
  getMaxNewEquityIssuePct,
  issueNewBusinessEquity,
} from '../businessOwnershipEngine';
import { createBusiness } from '../businessEngine';

describe('business ownership reconciliation', () => {
  test('defaults a business to 100% player ownership', () => {
    const business = createBusiness('coffee_shop', 'Ownership Coffee', 1, 1, 1)!;
    business.ownership = [];

    const ownership = getBusinessOwnershipTable(business, 'Elroy');
    expect(ownership).toHaveLength(1);
    expect(ownership[0].ownerType).toBe('player');
    expect(ownership[0].percent).toBe(100);
    expect(ownership[0].votingPercent).toBe(100);
  });

  test('player equity ownership ignores outside and trust stakes', () => {
    const business = createBusiness('coffee_shop', 'Ownership Coffee', 1, 1, 1)!;
    business.ownership = [
      { ownerType: 'player', ownerId: 'player', ownerName: 'Player', percent: 70, votingPercent: 70 },
      { ownerType: 'investor', ownerId: 'outside', ownerName: 'Outside', percent: 20, votingPercent: 20 },
      { ownerType: 'family_trust', ownerId: 'trust', ownerName: 'Family Trust', percent: 10, votingPercent: 10 },
    ];

    expect(getPlayerEquityOwnershipPct(business)).toBe(70);
  });

  test('gifting existing shares carries proportional player basis with them', () => {
    expect(getRemainingPlayerCapitalBasisAfterShareTransfer(100_000, 100, 20)).toBe(80_000);
    expect(getRemainingPlayerCapitalBasisAfterShareTransfer(100_000, 80, 20)).toBe(75_000);
  });

  test('new equity issuance preserves the 51% player voting floor', () => {
    const ownership = [{
      ownerType: 'player' as const,
      ownerId: 'player',
      ownerName: 'Player',
      percent: 100,
      votingPercent: 100,
    }];

    const issuance = issueNewBusinessEquity(
      ownership,
      80,
      { ownerType: 'investor', ownerId: 'outside', ownerName: 'Outside Investors' },
      51,
    );

    expect(issuance).not.toBeNull();
    expect(issuance?.playerVotingPct).toBeCloseTo(51, 6);
    expect(issuance?.issuePct).toBeCloseTo(49, 6);
    expect(issuance?.ownership.reduce((sum, stake) => sum + stake.percent, 0)).toBeCloseTo(100, 6);
  });

  test('repeated issuance to the same owner accumulates one stake', () => {
    const ownership = [
      { ownerType: 'player' as const, ownerId: 'player', ownerName: 'Player', percent: 80, votingPercent: 80 },
      { ownerType: 'family_trust' as const, ownerId: 'family_trust', ownerName: 'Family Trust', percent: 20, votingPercent: 20 },
    ];

    const issuance = issueNewBusinessEquity(
      ownership,
      10,
      { ownerType: 'family_trust', ownerId: 'family_trust', ownerName: 'Family Trust' },
      51,
    );

    expect(issuance).not.toBeNull();
    expect(issuance?.ownership.filter((stake) => stake.ownerType === 'family_trust')).toHaveLength(1);
    expect(issuance?.ownership.find((stake) => stake.ownerType === 'family_trust')?.percent).toBeCloseTo(28, 6);
    expect(issuance?.playerVotingPct).toBeCloseTo(72, 6);
  });

  test('post-money investment math matches issued equity percentage', () => {
    expect(getInvestmentForPostMoneyIssuePct(1_000_000, 10)).toBe(111_111);
    expect(getInvestmentForPostMoneyIssuePct(1_000_000, 20)).toBe(250_000);
  });

  test('max issue percentage becomes zero once player is at the control floor', () => {
    const ownership = [
      { ownerType: 'player' as const, ownerId: 'player', ownerName: 'Player', percent: 51, votingPercent: 51 },
      { ownerType: 'investor' as const, ownerId: 'outside', ownerName: 'Outside', percent: 49, votingPercent: 49 },
    ];
    expect(getMaxNewEquityIssuePct(ownership, 51)).toBe(0);
  });
});
