import { PlayerProfile } from '../types/game';
import prestigeData from '../data/prestige_tree_v2.json';

/**
 * Get all prestige bonuses.
 */
export function getPrestigeBonuses(): any[] {
  return prestigeData ?? [];
}

/**
 * Check if player can afford a prestige bonus.
 */
export function canUnlockPrestige(profile: PlayerProfile, bonusId: string): boolean {
  if ((profile.unlockedPrestige ?? []).includes(bonusId)) return false;
  const bonus = (prestigeData as any[]).find((b) => b?.id === bonusId);
  if (!bonus) return false;
  if ((profile.prestigePoints ?? 0) < (bonus.cost ?? 0)) return false;
  // Check prerequisites
  if (bonus.requires) {
    const requirements: string[] = Array.isArray(bonus.requires) ? bonus.requires : [bonus.requires];
    const hasAllPrereqs = requirements.every((reqId: string) =>
      (profile.unlockedPrestige ?? []).includes(reqId)
    );
    if (!hasAllPrereqs) return false;
  }
  return true;
}

/**
 * Unlock a prestige bonus.
 */
export function unlockPrestige(
  profile: PlayerProfile,
  bonusId: string
): PlayerProfile | null {
  if (!canUnlockPrestige(profile, bonusId)) return null;
  const bonus = (prestigeData as any[]).find((b) => b?.id === bonusId);
  if (!bonus) return null;

  return {
    ...profile,
    prestigePoints: (profile.prestigePoints ?? 0) - (bonus.cost ?? 0),
    unlockedPrestige: [...(profile.unlockedPrestige ?? []), bonusId],
  };
}

/**
 * Get active prestige effect values.
 */
export function getPrestigeEffects(profile: PlayerProfile): Record<string, number> {
  const effects: Record<string, number> = {};
  for (const bonusId of profile.unlockedPrestige ?? []) {
    const bonus = (prestigeData as any[]).find((b) => b?.id === bonusId);
    if (bonus?.effect) {
      effects[bonus.effect.type] = (effects[bonus.effect.type] ?? 0) + bonus.effect.value;
    }
  }
  return effects;
}
