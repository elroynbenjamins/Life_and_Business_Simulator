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
  const beneficiaries = allocateEstateShares(state, spouse, children, netEstate);

  const successorId = state.relationshipState?.estatePlan?.successorId ?? null;
  const eligibleSuccessors: Array<{ id: string; name: string }> = [];
  if (spouse) eligibleSuccessors.push({ id: spouse.id, name: spouse.name });
  for (const child of children) {
    if (childCurrentAge(child, state) >= 18) eligibleSuccessors.push({ id: child.id, name: child.name });
  }
  const successorName = eligibleSuccessors.find((item) => item.id === successorId)?.name ?? null;
  const businessValue = (state.businesses ?? []).reduce((sum, business) => sum + (business.valuation ?? 0), 0);

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

export function annualDeathChance(age: number): number {
  if (age < 60) return 0;
  if (age < 70) return 0.002;
  if (age < 80) return 0.007;
  if (age < 90) return 0.02;
  if (age < 100) return 0.05;
  if (age < 110) return 0.12;
  if (age < 120) return 0.30;
  if (age < 125) return 0.65;
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
