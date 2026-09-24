import {
  BusinessIdentityTrait,
  BusinessIdentityTraitId,
  OwnedBusiness,
} from '../types/game';
import { getBusinessDebtPrincipal } from './businessDebtEngine';

export interface BusinessIdentityDefinition {
  id: BusinessIdentityTraitId;
  name: string;
  description: string;
  icon: string;
  color: 'premium' | 'info' | 'primary' | 'warning' | 'family';
  thresholdWeeks: number;
}

export const BUSINESS_IDENTITY_DEFINITIONS: Record<BusinessIdentityTraitId, BusinessIdentityDefinition> = {
  premium_brand: {
    id: 'premium_brand',
    name: 'Premium Brand',
    description: 'Sustained premium positioning and strong reputation have made this company known for quality.',
    icon: 'diamond-outline',
    color: 'premium',
    thresholdWeeks: 20,
  },
  efficient_operator: {
    id: 'efficient_operator',
    name: 'Efficient Operator',
    description: 'Long-running margin discipline and process focus have become part of the operating culture.',
    icon: 'speedometer-outline',
    color: 'info',
    thresholdWeeks: 20,
  },
  employee_favorite: {
    id: 'employee_favorite',
    name: 'Employee Favorite',
    description: 'Consistently strong morale and employee relations have built a reputation as a great workplace.',
    icon: 'people-outline',
    color: 'primary',
    thresholdWeeks: 20,
  },
  innovation_leader: {
    id: 'innovation_leader',
    name: 'Innovation Leader',
    description: 'Repeated investment in R&D and product improvement has made innovation part of the company identity.',
    icon: 'flask-outline',
    color: 'info',
    thresholdWeeks: 16,
  },
  debt_heavy: {
    id: 'debt_heavy',
    name: 'Debt Heavy',
    description: 'The company has relied heavily on leverage for an extended period.',
    icon: 'card-outline',
    color: 'warning',
    thresholdWeeks: 10,
  },
  family_institution: {
    id: 'family_institution',
    name: 'Family Institution',
    description: 'Family ownership and governance have become a defining part of this company.',
    icon: 'people-circle-outline',
    color: 'family',
    thresholdWeeks: 24,
  },
};

function averageEmployeeMorale(business: OwnedBusiness): number {
  const employees = business.employees ?? [];
  if (employees.length === 0) return 0;
  return employees.reduce((sum, employee) => sum + (employee.morale ?? 50), 0) / employees.length;
}

function averageCorporateMorale(business: OwnedBusiness): number {
  const workforce = business.corporateWorkforce;
  if (!workforce) return 0;
  const departments = Object.values(workforce.departments ?? {});
  const headcount = departments.reduce((sum, department) => sum + Math.max(0, department?.headcount ?? 0), 0);
  if (headcount <= 0) return workforce.employeeRelations ?? 0;
  return departments.reduce(
    (sum, department) => sum + (department?.morale ?? 50) * Math.max(0, department?.headcount ?? 0),
    0,
  ) / headcount;
}

function debtRatio(business: OwnedBusiness): number {
  return getBusinessDebtPrincipal(business) / Math.max(1, business.valuation ?? 1);
}

function hasInnovationSignals(business: OwnedBusiness): boolean {
  if (business.strategicFocus === 'rd') return true;
  const projects = business.activeProjects ?? [];
  if (projects.some((project) =>
    ['research_development', 'product_improvement', 'process_optimization'].includes(project.projectType)
    && (project.resolved || project.succeeded)
  )) return true;
  return (business.completedCorporateCapex ?? []).some((project) =>
    /tech|data|automation|research|innovation/i.test(project.projectName ?? project.projectId)
  );
}

function conditionForTrait(business: OwnedBusiness, id: BusinessIdentityTraitId): boolean {
  if (id === 'premium_brand') {
    return (business.pricingStrategy === 'premium' || business.pricingStrategy === 'luxury' || business.strategicFocus === 'premium')
      && (business.reputation ?? 0) >= 55;
  }
  if (id === 'efficient_operator') {
    const ratio = (business.lastWeekRevenue ?? 0) > 0
      ? (business.lastWeekExpenses ?? 0) / Math.max(1, business.lastWeekRevenue ?? 0)
      : 1;
    return business.strategicFocus === 'margin'
      || business.strategicFocus === 'automation'
      || ((business.lastWeekProfit ?? 0) > 0 && ratio <= 0.74);
  }
  if (id === 'employee_favorite') {
    return averageEmployeeMorale(business) >= 78
      || averageCorporateMorale(business) >= 78
      || (business.corporateWorkforce?.employeeRelations ?? 0) >= 78;
  }
  if (id === 'innovation_leader') return hasInnovationSignals(business);
  if (id === 'debt_heavy') return debtRatio(business) >= 0.35;
  return !!business.familyBusiness?.isFamilyBusiness
    && ((business.familyBusiness.generationsOwned ?? 1) >= 2 || (business.familyRoles ?? []).length >= 1);
}

export function updateBusinessIdentity(
  business: OwnedBusiness,
  globalWeek: number,
): { business: OwnedBusiness; newlyEarned: BusinessIdentityTrait[] } {
  const currentTraits = [...(business.identityTraits ?? [])];
  const owned = new Set(currentTraits.map((trait) => trait.id));
  const progress = { ...(business.identityProgress ?? {}) };
  const newlyEarned: BusinessIdentityTrait[] = [];

  for (const definition of Object.values(BUSINESS_IDENTITY_DEFINITIONS)) {
    if (owned.has(definition.id)) continue;
    const current = progress[definition.id] ?? 0;
    const next = conditionForTrait(business, definition.id)
      ? current + 1
      : Math.max(0, current - 1);
    progress[definition.id] = next;
    if (next >= definition.thresholdWeeks) {
      const trait: BusinessIdentityTrait = { id: definition.id, earnedGlobalWeek: globalWeek };
      currentTraits.push(trait);
      newlyEarned.push(trait);
      owned.add(definition.id);
    }
  }

  return {
    business: {
      ...business,
      identityTraits: currentTraits,
      identityProgress: progress,
    },
    newlyEarned,
  };
}

export function getBusinessIdentityEffects(business: OwnedBusiness): {
  revenueMultiplier: number;
  expenseMultiplier: number;
  reputationPerWeek: number;
  moralePerWeek: number;
} {
  const owned = new Set((business.identityTraits ?? []).map((trait) => trait.id));
  let revenueMultiplier = 1;
  let expenseMultiplier = 1;
  let reputationPerWeek = 0;
  let moralePerWeek = 0;

  if (owned.has('premium_brand')) {
    revenueMultiplier *= 1.015;
    reputationPerWeek += 0.02;
  }
  if (owned.has('efficient_operator')) expenseMultiplier *= 0.985;
  if (owned.has('employee_favorite')) moralePerWeek += 0.15;
  if (owned.has('innovation_leader')) revenueMultiplier *= 1.015;
  if (owned.has('family_institution')) reputationPerWeek += 0.01;
  // Debt Heavy is intentionally descriptive rather than a permanent penalty.

  return { revenueMultiplier, expenseMultiplier, reputationPerWeek, moralePerWeek };
}
