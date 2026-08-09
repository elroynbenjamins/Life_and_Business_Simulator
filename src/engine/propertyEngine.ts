import { OwnedProperty } from '../types/game';
import propertiesData from '../data/properties.json';
import { inflated } from './economyEngine';

export interface PropertyTickResult {
  updatedProperties: OwnedProperty[];
  totalIncome: number;
  totalMaintenance: number;
}

/**
 * Process all owned properties for a week.
 * Rental income collected, maintenance paid, values appreciate.
 */
export function processProperties(
  properties: OwnedProperty[],
  inflationMultiplier: number
): PropertyTickResult {
  let totalIncome = 0;
  let totalMaintenance = 0;

  const updatedProperties = (properties ?? []).map((prop) => {
    const typeData = (propertiesData as any[]).find((p) => p?.id === prop.typeId);
    const updated = { ...prop };

    // Appreciate value
    const rate = typeData?.appreciationRate ?? 0.001;
    updated.currentValue = Math.round((prop.currentValue ?? prop.purchasePrice) * (1 + rate));

    // Collect rent if rented out
    if (prop.isRentedOut) {
      const income = inflated(prop.weeklyIncome ?? 0, inflationMultiplier);
      totalIncome += income;
    }

    // Pay maintenance
    const maintenance = inflated(prop.weeklyMaintenance ?? 0, inflationMultiplier);
    totalMaintenance += maintenance;

    return updated;
  });

  return { updatedProperties, totalIncome, totalMaintenance };
}

/**
 * Create a new owned property from a type ID.
 */
export function createProperty(typeId: string, week: number, year: number, inflationMultiplier: number): OwnedProperty | null {
  const typeData = (propertiesData as any[]).find((p) => p?.id === typeId);
  if (!typeData) return null;

  return {
    id: `prop_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    typeId,
    name: typeData.name,
    purchasePrice: inflated(typeData.purchasePrice, inflationMultiplier),
    currentValue: inflated(typeData.purchasePrice, inflationMultiplier),
    isRentedOut: false,
    isRenovated: false,
    purchaseWeek: week,
    purchaseYear: year,
    weeklyIncome: typeData.weeklyRentalIncome,
    weeklyMaintenance: typeData.weeklyMaintenance,
  };
}

/**
 * Renovate a property — increases value.
 */
export function renovateProperty(property: OwnedProperty, inflationMultiplier: number): { property: OwnedProperty; cost: number } | null {
  if (property.isRenovated) return null;
  const typeData = (propertiesData as any[]).find((p) => p?.id === property.typeId);
  if (!typeData) return null;

  const cost = inflated(typeData.renovationCost, inflationMultiplier);
  const boostPercent = typeData.renovationValueBoost ?? 0.15;
  const updated = {
    ...property,
    isRenovated: true,
    currentValue: Math.round(property.currentValue * (1 + boostPercent)),
    weeklyIncome: Math.round((property.weeklyIncome ?? 0) * 1.15), // 15% more rent
  };

  return { property: updated, cost };
}

/**
 * Get total property portfolio value.
 */
export function getTotalPropertyValue(properties: OwnedProperty[]): number {
  return (properties ?? []).reduce((t, p) => t + (p.currentValue ?? 0), 0);
}

/**
 * Get property type data by ID.
 */
export function getPropertyType(typeId: string): any | null {
  return (propertiesData as any[]).find((p) => p?.id === typeId) ?? null;
}
