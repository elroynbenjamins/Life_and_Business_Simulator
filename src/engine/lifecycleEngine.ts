import { EstateBeneficiaryShare, EstateSettlement, GameState, LifecycleState, RelationshipChild, RelationshipConnection } from '../types/game';
import { getNetWorth } from './financeEngine';

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
  const businessValue = Math.max(0, (state.businesses ?? []).reduce((sum, business) => {
    const debt = (business.businessLoans ?? []).reduce((loanSum, loan) => loanSum + (loan.remainingAmount ?? 0), 0);
    return sum + Math.max(0, (business.valuation ?? 0) - debt);
  }, 0));

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

export function getSuccessionPreview(state: GameState, childId: string) {
  const child = (state.relationshipState?.children ?? []).find((item) => item.id === childId);
  const estate = state.relationshipState?.estateSettlement;
  if (!child || !estate || childCurrentAge(child, state) < 18) return null;

  const beneficiary = (estate.beneficiaries ?? []).find((item) => item.id === childId);
  const existingSavings = Math.max(0, child.savings ?? 0);
  const inheritedCash = beneficiary?.amount ?? 0;
  const inheritedBusinessValue = estate.successorName === child.name ? estate.businessValue : 0;
  const inheritanceTaxBase = inheritedCash + inheritedBusinessValue;
  const inheritanceTax = calculateChildInheritanceTax(inheritanceTaxBase);
  const taxCashAvailable = inheritedCash + existingSavings;
  const loanNeeded = Math.max(0, inheritanceTax - taxCashAvailable);

  return {
    childId: child.id,
    childName: child.name,
    childAge: childCurrentAge(child, state),
    existingSavings,
    inheritedCash,
    inheritedBusinessValue,
    inheritanceTaxBase,
    inheritanceTax,
    taxCashAvailable,
    loanNeeded,
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
