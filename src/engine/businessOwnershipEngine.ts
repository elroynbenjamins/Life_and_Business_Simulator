import { BusinessOwnershipStake, OwnedBusiness } from '../types/game';
import { getBusinessDebtPrincipal } from './businessDebtEngine';

export function getBusinessOwnershipTable(
  business: OwnedBusiness,
  playerName = 'Player',
): BusinessOwnershipStake[] {
  return business.ownership?.length
    ? business.ownership.map((stake) => ({ ...stake }))
    : [{
        ownerType: 'player',
        ownerId: 'player',
        ownerName: playerName,
        percent: 100,
        votingPercent: 100,
      }];
}

export function getPlayerEquityOwnershipPct(
  business: OwnedBusiness,
): number {
  const ownership = getBusinessOwnershipTable(business);
  return Math.max(
    0,
    Math.min(
      100,
      ownership
        .filter((stake) => stake.ownerType === 'player')
        .reduce((sum, stake) => sum + Math.max(0, stake.percent ?? 0), 0),
    ),
  );
}

export function getMaxNewEquityIssuePct(
  ownership: BusinessOwnershipStake[],
  minimumPlayerVotingPct = 51,
): number {
  const playerStake = (ownership ?? []).find((stake) => stake.ownerType === 'player');
  if (!playerStake) return 0;
  const currentVoting = Math.max(0, playerStake.votingPercent ?? 0);
  if (currentVoting <= minimumPlayerVotingPct) return 0;
  return Math.max(
    0,
    Math.min(
      100,
      (1 - minimumPlayerVotingPct / Math.max(0.0001, currentVoting)) * 100,
    ),
  );
}

export function issueNewBusinessEquity(
  ownership: BusinessOwnershipStake[],
  requestedIssuePct: number,
  owner: Pick<BusinessOwnershipStake, 'ownerType' | 'ownerId' | 'ownerName'>,
  minimumPlayerVotingPct = 51,
): {
  ownership: BusinessOwnershipStake[];
  issuePct: number;
  playerVotingPct: number;
} | null {
  if (!Number.isFinite(requestedIssuePct) || requestedIssuePct <= 0) return null;
  const source = (ownership ?? []).map((stake) => ({ ...stake }));
  const maxIssuePct = getMaxNewEquityIssuePct(source, minimumPlayerVotingPct);
  const issuePct = Math.min(Math.max(0, requestedIssuePct), maxIssuePct);
  if (issuePct <= 0) return null;

  const dilution = 1 - issuePct / 100;
  const updated = source.map((stake) => ({
    ...stake,
    percent: Math.max(0, stake.percent * dilution),
    votingPercent: Math.max(0, stake.votingPercent * dilution),
  }));

  const existingIndex = updated.findIndex(
    (stake) => stake.ownerType === owner.ownerType && stake.ownerId === owner.ownerId,
  );
  if (existingIndex >= 0) {
    updated[existingIndex] = {
      ...updated[existingIndex],
      ownerName: owner.ownerName,
      percent: updated[existingIndex].percent + issuePct,
      votingPercent: updated[existingIndex].votingPercent + issuePct,
    };
  } else {
    updated.push({
      ...owner,
      percent: issuePct,
      votingPercent: issuePct,
    });
  }

  const playerVotingPct = updated
    .filter((stake) => stake.ownerType === 'player')
    .reduce((sum, stake) => sum + (stake.votingPercent ?? 0), 0);

  return { ownership: updated, issuePct, playerVotingPct };
}

export function getBusinessOwnershipEquityValue(
  business: OwnedBusiness,
): number {
  return Math.max(
    0,
    Math.round(
      Math.max(0, business.valuation ?? 0)
        - getBusinessDebtPrincipal(business),
    ),
  );
}

export function getBusinessOwnershipStakeValue(
  business: OwnedBusiness,
  ownershipPct: number,
): number {
  const pct = Math.max(0, Math.min(100, ownershipPct));
  return Math.round(getBusinessOwnershipEquityValue(business) * pct / 100);
}

export function getInvestmentForPostMoneyIssuePct(
  preMoneyValuation: number,
  issuePct: number,
): number {
  const pct = Math.max(0, Math.min(99.999, issuePct));
  if (pct <= 0) return 0;
  return Math.max(
    0,
    Math.round(Math.max(0, preMoneyValuation) * pct / (100 - pct)),
  );
}
