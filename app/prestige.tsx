import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors } from '../src/theme/colors';
import GameCard from '../src/components/GameCard';
import ScreenHeader from '../src/components/ScreenHeader';
import StatusPill from '../src/components/StatusPill';
import useGameStore from '../src/store/gameStore';
import { getPrestigeBonuses } from '../src/engine/prestigeEngine';
import { showGameDialog } from '../src/components/GameDialog';
import { prestigeImages, prestigeImageKey } from '../src/assets/progressionImages';

const PRESTIGE_CATEGORIES = ['All', 'Career', 'Business', 'Investing', 'Real Estate', 'Family', 'Money'] as const;
type PrestigeCategory = typeof PRESTIGE_CATEGORIES[number];

function getPrestigeCategory(bonus: any): PrestigeCategory {
  const effect = bonus?.effect?.type ?? '';
  if (['salary_multiplier', 'study_speed'].includes(effect)) return 'Career';
  if (['business_cost_reduction', 'business_crisis_reduction', 'negotiation'].includes(effect)) return 'Business';
  if (['dividend_boost', 'crypto_downside_reduction'].includes(effect)) return 'Investing';
  if (['property_income', 'rental_growth'].includes(effect)) return 'Real Estate';
  if (['family_governance_bonus', 'inheritance_tax_reduction'].includes(effect)) return 'Family';
  return 'Money';
}

export default function PrestigeScreen() {
  const router = useRouter();
  const profile = useGameStore((s) => s?.profile);
  const unlockPrestigeBonus = useGameStore((s) => s?.unlockPrestigeBonus);
  const bonuses = getPrestigeBonuses();
  const [category, setCategory] = useState<PrestigeCategory>('All');
  const [filter, setFilter] = useState<'all' | 'available'>('all');

  const handleUnlock = (bonusId: string, cost: number, gemCost: number) => {
    const gemText = gemCost > 0 ? ` + ${gemCost} Gems` : '';
    showGameDialog({
      title: 'Unlock Bonus',
      message: `Spend ${cost} Prestige Points${gemText}?`,
      confirmText: 'Unlock',
      onConfirm: () => unlockPrestigeBonus?.(bonusId),
    });
  };

  const isUnlocked = (bonus: any) => (profile?.unlockedPrestige ?? []).includes(bonus.id);
  const prereqs = (bonus: any): string[] => {
    const rawReq = bonus.requires;
    return Array.isArray(rawReq) ? rawReq : rawReq ? [rawReq] : [];
  };
  const canUnlockBonus = (bonus: any) => {
    if (isUnlocked(bonus)) return false;
    const hasPrereqs = prereqs(bonus).every((rid) => (profile?.unlockedPrestige ?? []).includes(rid));
    return hasPrereqs
      && (profile?.prestigePoints ?? 0) >= (bonus.cost ?? 0)
      && (profile?.gems ?? 0) >= (bonus.gemCost ?? 0);
  };
  const categoryCounts = useMemo(() => {
    const counts = Object.fromEntries(PRESTIGE_CATEGORIES.map((item) => [item, 0])) as Record<PrestigeCategory, number>;
    for (const bonus of bonuses) {
      counts.All += 1;
      counts[getPrestigeCategory(bonus)] += 1;
    }
    return counts;
  }, [bonuses]);
  const visibleBonuses = useMemo(() => bonuses.filter((bonus: any) => {
    const categoryMatch = category === 'All' || getPrestigeCategory(bonus) === category;
    const filterMatch = filter === 'all' || canUnlockBonus(bonus);
    return categoryMatch && filterMatch;
  }), [bonuses, category, filter, profile]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScreenHeader
        title="Prestige Tree"
        subtitle="Permanent account-wide progression"
        showBack
        onBack={() => router.back()}
        accentColor={Colors.premium}
      />

      <View style={styles.prestigeHeroWrap}>
        <GameCard
          variant="hero"
          eyebrow="PRESTIGE RESOURCES"
          title="Permanent progression"
          accentColor={Colors.premium}
          titleAccessory={<StatusPill compact icon="ribbon-outline" label={`${profile?.unlockedPrestige?.length ?? 0} active`} color={Colors.premium} />}
        >
          <View style={styles.currencyRow}>
            <View style={styles.pointsBar}>
              <Ionicons name="star" size={20} color={Colors.warning} />
              <Text style={styles.pointsText}>{profile?.prestigePoints ?? 0} PP</Text>
            </View>
            <View style={styles.gemsBar}>
              <Ionicons name="diamond" size={18} color={Colors.premium} />
              <Text style={styles.gemsText}>{profile?.gems ?? 0} Gems</Text>
            </View>
          </View>
          <Text style={styles.pointsDesc}>
            Prestige Points come from achievement progression. Level 3 bonuses also cost 10 Gems; Level 4 bonuses cost 25 Gems on top of their PP cost.
          </Text>
        </GameCard>
      </View>

      <View style={styles.filterBlock}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
          {PRESTIGE_CATEGORIES.map((item) => (
            <Pressable
              key={item}
              accessibilityRole="button"
              hitSlop={{ top: 6, bottom: 6 }}
              style={[styles.chip, category === item && styles.chipActive]}
              onPress={() => setCategory(item)}
            >
              <Text style={[styles.chipText, category === item && styles.chipTextActive]}>{item}</Text>
              <Text style={[styles.chipCount, category === item && styles.chipTextActive]}>{categoryCounts[item]}</Text>
            </Pressable>
          ))}
        </ScrollView>
        <View style={styles.toggleRow}>
          {(['all', 'available'] as const).map((item) => (
            <Pressable
              key={item}
              accessibilityRole="button"
              hitSlop={{ top: 5, bottom: 5 }}
              style={[styles.toggleButton, filter === item && styles.toggleActive]}
              onPress={() => setFilter(item)}
            >
              <Text style={[styles.toggleText, filter === item && styles.toggleTextActive]}>{item === 'all' ? 'All' : 'Available'}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <Text style={styles.listSummary}>{visibleBonuses.length} upgrade{visibleBonuses.length === 1 ? '' : 's'} shown</Text>
        {visibleBonuses.map((bonus: any) => {
          const unlocked = isUnlocked(bonus);
          const canAffordPP = (profile?.prestigePoints ?? 0) >= (bonus.cost ?? 0);
          const canAffordGems = (profile?.gems ?? 0) >= (bonus.gemCost ?? 0);
          const requirements = prereqs(bonus);
          const hasPrereqs = requirements.every((rid: string) => (profile?.unlockedPrestige ?? []).includes(rid));
          const canUnlock = canAffordPP && canAffordGems && hasPrereqs;
          const missingPrereqs = requirements.filter((rid: string) => !(profile?.unlockedPrestige ?? []).includes(rid));
          const missingNames = missingPrereqs.map((rid: string) => {
            const b = bonuses.find((x: any) => x.id === rid);
            return b?.name ?? rid;
          });
          return (
            <GameCard key={bonus.id} style={[styles.bonusCard, unlocked && styles.bonusUnlocked]}>
              <View style={styles.bonusRow}>
                <Image source={prestigeImages[prestigeImageKey(bonus.id)]} style={[styles.bonusArtwork, unlocked && styles.bonusArtworkActive]} resizeMode="contain" accessibilityLabel={`${bonus.name} pixel art`} />
                <View style={styles.bonusInfo}>
                  <View style={styles.nameRow}>
                    <Text style={styles.bonusName}>{bonus.name}</Text>
                    {bonus.tier ? <Text style={styles.tierBadge}>L{bonus.tier}</Text> : null}
                    <Text style={styles.categoryBadge}>{getPrestigeCategory(bonus)}</Text>
                  </View>
                  <Text style={styles.bonusDesc}>{bonus.description}</Text>
                  {missingNames.length > 0 && !unlocked && (
                    <Text style={styles.prereqText}>Requires: {missingNames.join(', ')}</Text>
                  )}
                </View>
                <View style={styles.bonusRight}>
                  {unlocked ? (
                    <View style={styles.unlockedBadge}>
                      <Ionicons name="checkmark-circle" size={20} color={Colors.primary} />
                      <Text style={styles.unlockedText}>Active</Text>
                    </View>
                  ) : (
                    <Pressable
                      style={[styles.unlockBtn, !canUnlock && styles.unlockBtnDisabled]}
                      onPress={() => canUnlock && handleUnlock(bonus.id, bonus.cost, bonus.gemCost ?? 0)}
                      disabled={!canUnlock}
                    >
                      <Text style={styles.unlockBtnText}>{bonus.cost} PP</Text>
                      {(bonus.gemCost ?? 0) > 0 && <Text style={styles.gemCostText}>+ {bonus.gemCost} 💎</Text>}
                    </Pressable>
                  )}
                </View>
              </View>
            </GameCard>
          );
        })}
        {visibleBonuses.length === 0 && (
          <GameCard>
            <Text style={styles.emptyText}>No upgrades match this filter yet.</Text>
          </GameCard>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  prestigeHeroWrap: { paddingHorizontal: 16, paddingTop: 4 },
  currencyRow: { flexDirection: 'row', gap: 8 },
  pointsBar: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: `${Colors.warning}12`, borderWidth: 1, borderColor: `${Colors.warning}33`, borderRadius: 10 },
  gemsBar: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: `${Colors.premium}12`, borderWidth: 1, borderColor: `${Colors.premium}33`, borderRadius: 10 },
  gemsText: { color: Colors.premium, fontSize: 15, fontWeight: '700' },
  pointsText: { color: Colors.warning, fontSize: 18, fontWeight: '700' },
  pointsDesc: { color: Colors.textMuted, fontSize: 11, lineHeight: 16, marginTop: 9 },
  filterBlock: { paddingTop: 8 },
  chipRow: { paddingHorizontal: 16, gap: 8 },
  chip: { minHeight: 36, borderRadius: 18, borderWidth: 1, borderColor: Colors.cardBorder, backgroundColor: Colors.card, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 6 },
  chipActive: { borderColor: Colors.primary, backgroundColor: `${Colors.primary}18` },
  chipText: { color: Colors.textSecondary, fontSize: 12, fontWeight: '800' },
  chipTextActive: { color: Colors.primary },
  chipCount: { color: Colors.textMuted, fontSize: 11, fontWeight: '800' },
  toggleRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, marginTop: 8 },
  toggleButton: { flex: 1, minHeight: 38, borderRadius: 10, borderWidth: 1, borderColor: Colors.cardBorder, alignItems: 'center', justifyContent: 'center' },
  toggleActive: { backgroundColor: `${Colors.warning}18`, borderColor: Colors.warning },
  toggleText: { color: Colors.textSecondary, fontSize: 13, fontWeight: '800' },
  toggleTextActive: { color: Colors.warning },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 40 },
  listSummary: { color: Colors.textMuted, fontSize: 12, fontWeight: '700', marginBottom: 8 },
  bonusCard: { marginBottom: 12 },
  bonusUnlocked: { borderColor: Colors.primary, borderWidth: 1 },
  bonusRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  bonusIcon: { fontSize: 32 },
  bonusArtwork: { width: 58, height: 58, opacity: 0.55 },
  bonusArtworkActive: { opacity: 1 },
  bonusInfo: { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  bonusName: { color: Colors.textPrimary, fontSize: 16, fontWeight: '600' },
  tierBadge: { color: Colors.warning, fontSize: 10, fontWeight: '800', backgroundColor: '#F59E0B15', borderRadius: 6, paddingHorizontal: 5, paddingVertical: 2 },
  categoryBadge: { color: Colors.info, fontSize: 10, fontWeight: '800', backgroundColor: `${Colors.info}14`, borderRadius: 6, paddingHorizontal: 5, paddingVertical: 2 },
  bonusDesc: { color: Colors.textSecondary, fontSize: 13, marginTop: 2 },
  prereqText: { color: Colors.warning, fontSize: 11, marginTop: 4, fontStyle: 'italic' },
  bonusRight: { alignItems: 'center' },
  unlockedBadge: { alignItems: 'center' },
  unlockedText: { color: Colors.primary, fontSize: 11, fontWeight: '600', marginTop: 2 },
  unlockBtn: { backgroundColor: '#F59E0B', borderRadius: 8, paddingHorizontal: 16, paddingVertical: 8 },
  unlockBtnDisabled: { backgroundColor: Colors.cardBorder, opacity: 0.5 },
  unlockBtnText: { color: Colors.white, fontSize: 13, fontWeight: '700' },
  gemCostText: { color: Colors.white, fontSize: 10, fontWeight: '700', marginTop: 2, textAlign: 'center' },
  emptyText: { color: Colors.textSecondary, fontSize: 13, textAlign: 'center' },
});
