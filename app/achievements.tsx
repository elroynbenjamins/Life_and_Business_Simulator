import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../src/theme/colors';
import ScreenHeader from '../src/components/ScreenHeader';
import GameCard from '../src/components/GameCard';
import StatusPill from '../src/components/StatusPill';
import useGameStore from '../src/store/gameStore';
import achievementsData from '../src/data/achievements.json';

const ACHIEVEMENT_CATEGORIES = ['All', 'Career', 'Investing', 'Business', 'Real Estate', 'Family', 'Wealth', 'Lifestyle'] as const;
type AchievementCategory = typeof ACHIEVEMENT_CATEGORIES[number];
type AchievementFilter = 'progress' | 'completed' | 'all';

function getAchievementCategory(achievement: any): AchievementCategory {
  const id = String(achievement?.id ?? '');
  const text = `${achievement?.name ?? ''} ${achievement?.description ?? ''}`.toLowerCase();
  if (id.includes('relationship') || id.includes('child') || id.includes('family') || id.includes('legacy') || text.includes('relationship') || text.includes('child')) return 'Family';
  if (id.includes('business') || id.includes('hire') || text.includes('business') || text.includes('employee')) return 'Business';
  if (id.includes('property') || id.includes('housing') || text.includes('property') || text.includes('housing') || text.includes('real estate')) return 'Real Estate';
  if (id.includes('portfolio') || id.includes('stock') || id.includes('profit') || id.includes('diversified') || text.includes('market') || text.includes('portfolio') || text.includes('stock')) return 'Investing';
  if (id.includes('job') || id.includes('career') || id.includes('course') || text.includes('job') || text.includes('career') || text.includes('course')) return 'Career';
  if (id.includes('net_worth') || id.includes('million') || id.includes('cash') || text.includes('net worth') || text.includes('cash')) return 'Wealth';
  return 'Lifestyle';
}

export default function AchievementsScreen() {
  const router = useRouter();
  const unlockedAchievements = useGameStore((s) => s?.unlockedAchievements ?? []);
  const profile = useGameStore((s) => s.profile);
  const [category, setCategory] = useState<AchievementCategory>('All');
  const [filter, setFilter] = useState<AchievementFilter>('progress');

  const allAchievements = achievementsData ?? [];
  const unlocked = allAchievements.filter((a) => unlockedAchievements.includes(a?.id));
  const locked = allAchievements.filter((a) => !unlockedAchievements.includes(a?.id));
  const totalXp = unlocked.reduce((t, a) => t + (a?.xpReward ?? 0), 0);
  const accountRewardedAchievementIds = useMemo(
    () => new Set([...(profile.rewardedAchievementIds ?? []), ...(profile.rewardedAchievementGemIds ?? [])]),
    [profile.rewardedAchievementIds, profile.rewardedAchievementGemIds],
  );
  const totalAvailableGems = allAchievements.reduce((total, achievement) => total + (achievement?.gemReward ?? 0), 0);
  const categoryCounts = useMemo(() => {
    const counts = Object.fromEntries(ACHIEVEMENT_CATEGORIES.map((item) => [item, 0])) as Record<AchievementCategory, number>;
    for (const achievement of allAchievements) {
      counts.All += 1;
      counts[getAchievementCategory(achievement)] += 1;
    }
    return counts;
  }, [allAchievements]);
  const visibleAchievements = useMemo(() => allAchievements.filter((achievement) => {
    const unlockedItem = unlockedAchievements.includes(achievement?.id);
    const categoryMatch = category === 'All' || getAchievementCategory(achievement) === category;
    const filterMatch = filter === 'all' || (filter === 'completed' ? unlockedItem : !unlockedItem);
    return categoryMatch && filterMatch;
  }), [allAchievements, category, filter, unlockedAchievements]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScreenHeader
        title="Achievements"
        subtitle="Milestones across your life and empire"
        showBack
        onBack={() => router.back()}
        accentColor={Colors.warning}
      />
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <GameCard
          variant="hero"
          eyebrow="ACHIEVEMENT PROGRESS"
          title="Lifetime milestones"
          accentColor={Colors.warning}
          titleAccessory={<StatusPill compact icon="trophy-outline" label={`${unlocked.length}/${achievementsData.length}`} color={Colors.warning} />}
        >
          <Text style={styles.statsValue}>{Math.round((unlocked.length / Math.max(1, achievementsData.length)) * 100)}% complete</Text>
          <Text style={styles.xpText}>{totalXp} XP value represented by this save's completed achievements</Text>
          <Text style={styles.achievementRewardNote}>
            XP, Prestige Points and Gems are account-wide and paid once per achievement. Standard achievements award 2 Gems; harder 100+ XP milestones award 3. The full set contains {totalAvailableGems} Gems.
          </Text>
        </GameCard>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
          {ACHIEVEMENT_CATEGORIES.map((item) => (
            <Pressable key={item} style={[styles.chip, category === item && styles.chipActive]} onPress={() => setCategory(item)}>
              <Text style={[styles.chipText, category === item && styles.chipTextActive]}>{item}</Text>
              <Text style={[styles.chipCount, category === item && styles.chipTextActive]}>{categoryCounts[item]}</Text>
            </Pressable>
          ))}
        </ScrollView>

        <View style={styles.toggleRow}>
          {(['progress', 'completed', 'all'] as const).map((item) => (
            <Pressable key={item} style={[styles.toggleButton, filter === item && styles.toggleActive]} onPress={() => setFilter(item)}>
              <Text style={[styles.toggleText, filter === item && styles.toggleTextActive]}>
                {item === 'progress' ? 'In Progress' : item === 'completed' ? 'Completed' : 'All'}
              </Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.sectionHeader}>{visibleAchievements.length} achievement{visibleAchievements.length === 1 ? '' : 's'} shown</Text>
        {visibleAchievements.map((a) => {
          const unlockedItem = unlockedAchievements.includes(a?.id);
          const accountRewardClaimed = accountRewardedAchievementIds.has(a?.id);
          return (
          <GameCard key={a?.id}>
            <View style={[styles.achRow, !unlockedItem && styles.lockedRow]}>
              <View style={unlockedItem ? styles.iconWrap : styles.iconWrapLocked}>
                <Ionicons name={(unlockedItem ? (a?.icon ?? 'trophy') : 'lock-closed') as any} size={unlockedItem ? 24 : 20} color={unlockedItem ? Colors.warning : Colors.textMuted} />
              </View>
              <View style={styles.achInfo}>
                <View style={styles.nameRow}>
                  <Text style={styles.achName}>{a?.name}</Text>
                  <Text style={styles.categoryBadge}>{getAchievementCategory(a)}</Text>
                </View>
                <Text style={styles.achDesc}>{a?.description}</Text>
              </View>
              <View style={styles.rewardCol}>
                <Text style={unlockedItem ? styles.achXp : styles.achXpLocked}>+{a?.xpReward} XP / PP</Text>
                <Text style={unlockedItem ? styles.achGem : styles.achGemLocked}>+{a?.gemReward ?? 0} Gems</Text>
                {accountRewardClaimed && <Text style={styles.rewardClaimed}>Account claimed</Text>}
              </View>
            </View>
          </GameCard>
        );})}
        {visibleAchievements.length === 0 && (
          <GameCard>
            <Text style={styles.emptyText}>No achievements match this filter.</Text>
          </GameCard>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scroll: { flex: 1 },
  scrollContent: { padding: 16 },
  statsLabel: { color: Colors.textSecondary, fontSize: 13 },
  statsValue: { color: Colors.textPrimary, fontSize: 22, fontWeight: '700', marginTop: 4 },
  xpText: { color: Colors.warning, fontSize: 14, fontWeight: '600', marginTop: 4 },
  achievementRewardNote: { color: Colors.textMuted, fontSize: 11, marginTop: 3 },
  sectionHeader: { color: Colors.textSecondary, fontSize: 16, fontWeight: '600', marginTop: 12, marginBottom: 8 },
  chipRow: { gap: 8, marginTop: 12, paddingRight: 16 },
  chip: { minHeight: 36, borderRadius: 18, borderWidth: 1, borderColor: Colors.cardBorder, backgroundColor: Colors.card, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 6 },
  chipActive: { borderColor: Colors.primary, backgroundColor: `${Colors.primary}18` },
  chipText: { color: Colors.textSecondary, fontSize: 12, fontWeight: '800' },
  chipTextActive: { color: Colors.primary },
  chipCount: { color: Colors.textMuted, fontSize: 11, fontWeight: '800' },
  toggleRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  toggleButton: { flex: 1, minHeight: 38, borderRadius: 10, borderWidth: 1, borderColor: Colors.cardBorder, alignItems: 'center', justifyContent: 'center' },
  toggleActive: { backgroundColor: `${Colors.warning}18`, borderColor: Colors.warning },
  toggleText: { color: Colors.textSecondary, fontSize: 12, fontWeight: '800' },
  toggleTextActive: { color: Colors.warning },
  achRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  lockedRow: { opacity: 0.55 },
  iconWrap: { width: 40, height: 40, borderRadius: 20, backgroundColor: `${Colors.warning}22`, justifyContent: 'center', alignItems: 'center' },
  iconWrapLocked: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.elevated, justifyContent: 'center', alignItems: 'center' },
  achInfo: { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  achName: { color: Colors.textPrimary, fontSize: 15, fontWeight: '600' },
  categoryBadge: { color: Colors.info, fontSize: 10, fontWeight: '800', backgroundColor: `${Colors.info}14`, borderRadius: 6, paddingHorizontal: 5, paddingVertical: 2 },
  achDesc: { color: Colors.textMuted, fontSize: 12, marginTop: 2 },
  rewardCol: { alignItems: 'flex-end', minWidth: 58 },
  achXp: { color: Colors.warning, fontSize: 13, fontWeight: '700' },
  achGem: { color: Colors.premium, fontSize: 11, fontWeight: '800', marginTop: 2 },
  achGemLocked: { color: Colors.textMuted, fontSize: 11, fontWeight: '700', marginTop: 2 },
  rewardClaimed: { color: Colors.primary, fontSize: 8, fontWeight: '800', marginTop: 2 },
  achGems: { color: '#A78BFA', fontSize: 11, fontWeight: '700', marginTop: 2 },
  achXpLocked: { color: Colors.textMuted, fontSize: 13 },
  achGemsLocked: { color: Colors.textMuted, fontSize: 11, marginTop: 2 },
  emptyText: { color: Colors.textSecondary, fontSize: 13, textAlign: 'center' },
});
