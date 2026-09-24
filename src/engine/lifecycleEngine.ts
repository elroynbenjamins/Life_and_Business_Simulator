import { EstateBeneficiaryShare, EstateSettlement, GameState, LifecycleState, RelationshipChild, RelationshipConnection, SuccessionAssetStrategy } from '../types/game';
import { getNetWorth, getPortfolioValue } from './financeEngine';
import { getPlayerOwnershipPct } from './businessEngine';
import { getBusinessDebtPrincipal } from './businessDebtEngine';

export interface LifecycleResult {
  lifecycle: LifecycleState;
  diedThisWeek: boolean;
  estateSettlement: EstateSettlement | null;
}


function childCurrentAge(child: RelationshipChild, state: GameState): number {
  const gw = ((state.year ?? 1) - 1) * 20 + (state.week ?? 1);
  return Math.max(0, Math.floor((gw - child.birthGlobalWeek) / 20));
}

function allocateEstateShares(
  state: GameState,
  spouse: RelationshipConnection | null,
  children: RelationshipChild[],
  netEstate: number,
): EstateBeneficiaryShare[] {
  const plan = state.relationshipState?.estatePlan?.planType ?? 'default';
  const shares: EstateBeneficiaryShare[] = [];
  const childCount = children.length;

  let spouseShare = 0;
  let childrenShare = 0;
  if (spouse && childCount > 0) {
    if (plan === 'spouse_first') {
      spouseShare = 0.75;
      childrenShare = 0.25;
    } else if (plan === 'children_first') {
      spouseShare = 0.25;
      childrenShare = 0.75;
    } else if (plan === 'equal_family') {
      spouseShare = 1 / (childCount + 1);
      childrenShare = 1 - spouseShare;
    } else {
      spouseShare = 0.50;
      childrenShare = 0.50;
    }
  } else if (spouse) {
    spouseShare = 1;
  } else if (childCount > 0) {
    childrenShare = 1;
  }

  if (spouse && spouseShare > 0) {
    shares.push({
      id: spouse.id,
      name: spouse.name,
      relationship: 'spouse',
      share: spouseShare,
      amount: Math.round(netEstate * spouseShare),
    });
  }

  if (childCount > 0 && childrenShare > 0) {
    const each = childrenShare / childCount;
    for (const child of children) {
      shares.push({
        id: child.id,
        name: child.name,
        relationship: 'child',
        share: each,
        amount: Math.round(netEstate * each),
      });
    }
  }

  return shares;
}

/** Old saves may only have a name. Never resolve an ambiguous name to an heir. */
export function getEstateSuccessorId(state: GameState): string | null {
  const estate = state.relationshipState?.estateSettlement;
  if (!estate) return null;
  if (estate.successorId !== undefined) return estate.successorId;
  const candidates = [...(state.relationshipState.children ?? []), ...(state.relationshipState.activeConnections ?? [])];
  const planned = candidates.find(p => p.id === state.relationshipState.estatePlan?.successorId && p.name === estate.successorName);
  if (planned) return planned.id;
  const matches = candidates.filter(p => p.name === estate.successorName);
  return matches.length === 1 ? matches[0].id : null;
}

export function calculateEstateSettlement(state: GameState): EstateSettlement {
  const obligations = (state.relationshipState?.financialObligations ?? [])
    .reduce((sum, item) => sum + (item.remainingAmount ?? 0), 0);
  const netWorthAfterObligations = Math.max(0, getNetWorth(state));
  const grossEstate = Math.max(0, netWorthAfterObligations + obligations);

  const structure = state.relationshipState?.estatePlan?.structure ?? 'none';
  const adminRate = structure === 'family_trust' ? 0.0075 : structure === 'will' ? 0.02 : 0.04;
  const minimum = structure === 'family_trust' ? 500 : structure === 'will' ? 750 : 1000;
  const administrationCost = grossEstate > 0
    ? Math.min(grossEstate, Math.max(minimum, Math.round(grossEstate * adminRate)))
    : 0;
  const netEstate = Math.max(0, grossEstate - obligations - administrationCost);

  const spouse = (state.relationshipState?.activeConnections ?? []).find(
    (item) => item.id === state.relationshipState?.partnerId && item.stage === 'married'
  ) ?? null;
  const children = state.relationshipState?.children ?? [];

  const successorId = state.relationshipState?.estatePlan?.successorId ?? null;
  const eligibleSuccessors: Array<{ id: string; name: string }> = [];
  if (spouse) eligibleSuccessors.push({ id: spouse.id, name: spouse.name });
  for (const child of children) {
    if (childCurrentAge(child, state) >= 18) eligibleSuccessors.push({ id: child.id, name: child.name });
  }
  const successorName = eligibleSuccessors.find((item) => item.id === successorId)?.name ?? null;
  const inheritableFamilyBusinesses = (state.businesses ?? [])
    .filter((business) => business.familyBusiness?.isFamilyBusiness);
  const inheritableHoldingIds = new Set(
    inheritableFamilyBusinesses.map((business) => business.holdingCompanyId).filter(Boolean)
  );
  const familyBusinessEquity = inheritableFamilyBusinesses.reduce((sum, business) => {
    const equity = Math.max(0, (business.valuation ?? 0) - getBusinessDebtPrincipal(business));
    return sum + equity * (getPlayerOwnershipPct(business) / 100);
  }, 0);
  const inheritableHoldingCash = (state.holdingCompanies ?? [])
    .filter((holding) => inheritableHoldingIds.has(holding.id))
    .reduce((sum, holding) => sum + Math.max(0, holding.cashReserve ?? 0), 0);
  const grossBusinessValue = Math.max(0, familyBusinessEquity + inheritableHoldingCash);
  // Costs unpaid by liquid assets become a liability of the business successor.
  const businessSettlementDebt = successorName ? Math.max(0, grossBusinessValue - netEstate) : 0;
  const businessValue = grossBusinessValue - businessSettlementDebt;

  // If a business successor was explicitly named, businesses pass outside the
  // residual family split. This makes succession strategically meaningful and
  // can create an illiquid inheritance-tax bill for the successor.
  const distributableEstate = Math.max(0, netEstate - (successorName ? businessValue : 0));
  const beneficiaries = allocateEstateShares(state, spouse, children, distributableEstate);

  return {
    grossEstate,
    outstandingRelationshipObligations: obligations,
    administrationCost,
    netEstate,
    beneficiaries,
    successorName,
    successorId: successorName ? successorId : null,
    businessSettlementDebt,
    businessValue,
  };
}

export function calculateChildInheritanceTax(amount: number): number {
  let remaining = Math.max(0, amount);
  let tax = 0;

  const allowance = Math.min(remaining, 50000);
  remaining -= allowance;

  const band1 = Math.min(remaining, 200000);
  tax += band1 * 0.10;
  remaining -= band1;

  const band2 = Math.min(remaining, 750000);
  tax += band2 * 0.15;
  remaining -= band2;

  const band3 = Math.min(remaining, 4000000);
  tax += band3 * 0.20;
  remaining -= band3;

  if (remaining > 0) tax += remaining * 0.25;
  return Math.round(tax);
}

function successionPotential(child: RelationshipChild): {
  score: number;
  label: 'Developing' | 'Solid' | 'Strong' | 'Exceptional';
} {
  const ambition = child.personality?.ambition ?? 'career_minded';
  const resilience = child.personality?.resilience ?? 'balanced';
  let score = 40;
  if (child.educationOutcome === 'elite') score += 18;
  else if (child.educationOutcome === 'strong') score += 12;
  else if (child.educationOutcome === 'solid') score += 7;
  else if (child.educationOutcome === 'limited') score -= 5;

  if (ambition === 'driven') score += 12;
  else if (ambition === 'career_minded') score += 7;
  if (resilience === 'resilient') score += 10;
  else if (resilience === 'fragile') score -= 8;
  if ((child.savings ?? 0) >= 100000) score += 10;
  else if ((child.savings ?? 0) >= 25000) score += 5;
  if (child.homeStatus === 'homeowner') score += 4;
  if (child.adultStatus === 'entrepreneur') score += 8;
  if (child.adultStatus === 'unemployed') score -= 10;
  if ((child.debt ?? 0) > Math.max(25000, child.savings ?? 0)) score -= 8;
  const parentRelationship = child.parentRelationship ?? 75;
  if (parentRelationship >= 85) score += 4;
  else if (parentRelationship < 40) score -= 8;

  score = Math.max(0, Math.min(100, Math.round(score)));
  return {
    score,
    label: score >= 82 ? 'Exceptional' : score >= 67 ? 'Strong' : score >= 48 ? 'Solid' : 'Developing',
  };
}

function allocatePropertyInheritance(state: GameState, budget: number): { ids: string[]; value: number } {
  const sorted = [...(state.properties ?? [])].sort((a, b) => (b.currentValue ?? 0) - (a.currentValue ?? 0));
  const ids: string[] = [];
  let value = 0;
  for (const property of sorted) {
    const propertyValue = Math.max(0, property.currentValue ?? 0);
    if (propertyValue <= 0) continue;
    if (value + propertyValue <= budget) {
      ids.push(property.id);
      value += propertyValue;
    }
  }
  return { ids, value };
}

export function getSuccessionPreview(
  state: GameState,
  childId: string,
  assetStrategy: SuccessionAssetStrategy = 'liquidate',
  inheritanceTaxReduction = 0,
) {
  const child = (state.relationshipState?.children ?? []).find((item) => item.id === childId);
  const estate = state.relationshipState?.estateSettlement;
  if (!child || !estate || childCurrentAge(child, state) < 18) return null;

  const beneficiary = (estate.beneficiaries ?? []).find((item) => item.id === childId);
  const distributableShare = Math.max(0, beneficiary?.amount ?? 0);
  const existingSavings = Math.max(0, child.savings ?? 0);
  const existingBusinessStakeValue = (state.businesses ?? []).reduce((sum, business) => {
    const childPct = (business.ownership ?? [])
      .filter((stake) => stake.ownerType === 'child' && stake.ownerId === child.id)
      .reduce((stakeSum, stake) => stakeSum + (stake.percent ?? 0), 0);
    const debt = getBusinessDebtPrincipal(business);
    return sum + ((business.valuation ?? 0) - debt) * childPct / 100;
  }, 0);
  const inheritsFamilyBusinesses = getEstateSuccessorId(state) === child.id;
  const inheritedBusinessValue = inheritsFamilyBusinesses ? Math.min(estate.businessValue, estate.netEstate) : 0;
  const businessSettlementDebt = inheritsFamilyBusinesses
    ? (estate.businessSettlementDebt ?? Math.max(0, estate.businessValue - estate.netEstate))
    : 0;

  const portfolioValue = Math.max(0, getPortfolioValue(state.stocks ?? [], state.holdings ?? []));
  const wantsStocks = assetStrategy === 'keep_stocks' || assetStrategy === 'keep_both';
  const wantsProperties = assetStrategy === 'keep_properties' || assetStrategy === 'keep_both';

  let remainingShare = distributableShare;
  let inheritedPropertyValue = 0;
  let inheritedPropertyIds: string[] = [];
  if (wantsProperties && remainingShare > 0) {
    const allocation = allocatePropertyInheritance(state, remainingShare);
    inheritedPropertyIds = allocation.ids;
    inheritedPropertyValue = allocation.value;
    remainingShare = Math.max(0, remainingShare - inheritedPropertyValue);
  }

  const inheritedStockValue = wantsStocks ? Math.min(portfolioValue, remainingShare) : 0;
  remainingShare = Math.max(0, remainingShare - inheritedStockValue);
  const inheritedCash = remainingShare;

  const inheritanceTaxBase = distributableShare + inheritedBusinessValue;
  const baseInheritanceTax = calculateChildInheritanceTax(inheritanceTaxBase);
  const inheritanceTax = Math.max(0, Math.round(
    baseInheritanceTax * (1 - Math.max(0, Math.min(0.07, inheritanceTaxReduction)))
  ));
  const taxCashAvailable = inheritedCash + existingSavings;
  const loanNeeded = Math.max(0, inheritanceTax - taxCashAvailable);
  const parentRelationship = Math.max(0, Math.min(100, child.parentRelationship ?? 75));
  const potential = successionPotential(child);

  return {
    childId: child.id,
    childName: child.name,
    childAge: childCurrentAge(child, state),
    existingSavings,
    existingBusinessStakeValue,
    assetStrategy,
    inheritedCash,
    inheritedStockValue,
    inheritedPropertyValue,
    inheritedPropertyIds,
    inheritedBusinessValue,
    inheritsFamilyBusinesses,
    businessSettlementDebt,
    inheritanceTaxBase,
    inheritanceTax,
    taxCashAvailable,
    loanNeeded,
    parentRelationship,
    willingToSucceed: parentRelationship >= 30,
    futurePotentialScore: potential.score,
    futurePotentialLabel: potential.label,
  };
}

export function annualDeathChance(age: number): number {
  if (age < 55) return 0;
  if (age < 60) return 0.0025;
  if (age < 65) return 0.005;
  if (age < 70) return 0.01;
  if (age < 75) return 0.02;
  if (age < 80) return 0.04;
  if (age < 85) return 0.07;
  if (age < 90) return 0.12;
  if (age < 95) return 0.20;
  if (age < 100) return 0.35;
  if (age < 105) return 0.55;
  if (age < 110) return 0.80;
  return 1;
}

export function processLifecycle(state: GameState, previousAge: number): LifecycleResult {
  const lifecycle = state.lifecycle ?? {
    isDead: false,
    deathAge: null,
    deathWeek: null,
    deathYear: null,
    causeOfDeath: null,
  };
  if (lifecycle.isDead || state.age <= previousAge) return { lifecycle, diedThisWeek: false, estateSettlement: state.relationshipState?.estateSettlement ?? null };

  const chance = annualDeathChance(state.age);
  if (chance <= 0 || Math.random() >= chance) return { lifecycle, diedThisWeek: false, estateSettlement: null };

  const causes = state.age >= 100
    ? ['natural causes', 'age-related illness']
    : ['natural causes', 'a sudden illness', 'age-related complications'];
  const cause = causes[Math.floor(Math.random() * causes.length)];

  return {
    lifecycle: {
      isDead: true,
      deathAge: state.age,
      deathWeek: state.week,
      deathYear: state.year,
      causeOfDeath: cause,
    },
    diedThisWeek: true,
    estateSettlement: calculateEstateSettlement(state),
  };
}
