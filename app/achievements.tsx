import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../src/theme/colors';
import ScreenHeader from '../src/components/ScreenHeader';
import GameCard from '../src/components/GameCard';
import StatusPill from '../src/components/StatusPill';
import { formatCurrency } from '../src/utils/format';
import { getCareerSalary } from '../src/engine/careerEngine';
import { getAchievementProgress, AchievementProgress } from '../src/engine/achievementEngine';
import { AchievementCategory } from '../src/types/game';
import useGameStore from '../src/store/gameStore';
import achievementsData from '../src/data/achievements.json';

const ACHIEVEMENT_CATEGORIES = ['All', 'Career', 'Education', 'Investing', 'Business', 'Real Estate', 'Family', 'Wealth', 'Lifestyle'] as const;
type AchievementScreenCategory = typeof ACHIEVEMENT_CATEGORIES[number];
type AchievementFilter = 'progress' | 'completed' | 'all';

function getAchievementCategory(achievement: any): AchievementCategory {
  return (achievement?.category ?? 'Lifestyle') as AchievementCategory;
}

function progressRatio(value: AchievementProgress | null | undefined): number {
  if (!value) return 0;
  return Math.max(0, Math.min(1, value.current / Math.max(1, value.target)));
}

function formatProgressValue(value: number, format: AchievementProgress['format']): string {
  if (format === 'currency') return formatCurrency(value);
  if (format === 'percent') return `${Math.floor(value)}%`;
  if (format === 'weeks') return `${Math.floor(value)} wk`;
  if (format === 'level') return `Level ${Math.floor(value)}`;
  return Math.floor(value).toLocaleString();
}

function formatProgressText(value: AchievementProgress): string {
  if (value.format === 'level') {
    return `${formatProgressValue(value.current, value.format)} / Level ${Math.floor(value.target)}`;
  }
  const suffix = value.label ? ` ${value.label}` : '';
  return `${formatProgressValue(value.current, value.format)} / ${formatProgressValue(value.target, value.format)}${suffix}`;
}

export default function AchievementsScreen() {
  const router = useRouter();
  const gameState = useGameStore((s) => s);
  const unlockedAchievements = gameState?.unlockedAchievements ?? [];
  const profile = gameState.profile;
  const [category, setCategory] = useState<AchievementScreenCategory>('All');
  const [filter, setFilter] = useState<AchievementFilter>('progress');

  const allAchievements = achievementsData ?? [];
  const unlocked = allAchievements.filter((achievement) => unlockedAchievements.includes(achievement?.id));
  const locked = allAchievements.filter((achievement) => !unlockedAchievements.includes(achievement?.id));
  const totalXp = unlocked.reduce((total, achievement) => total + (achievement?.xpReward ?? 0), 0);
  const accountRewardedAchievementIds = useMemo(
    () => new Set([...(profile.rewardedAchievementIds ?? []), ...(profile.rewardedAchievementGemIds ?? [])]),
    [profile.rewardedAchievementIds, profile.rewardedAchievementGemIds],
  );
  const currentWeeklySalary = useMemo(
    () => getCareerSalary(gameState.career, gameState.inflationMultiplier ?? 1, profile),
    [gameState.career, gameState.inflationMultiplier, profile],
  );
  const progressById = useMemo(() => {
    const entries = allAchievements.map((achievement) => [
      achievement.id,
      getAchievementProgress(gameState, achievement.id, currentWeeklySalary),
    ] as const);
    return new Map(entries);
  }, [allAchievements, gameState, currentWeeklySalary]);
  const totalAvailableGems = allAchievements.reduce((total, achievement) => total + (achievement?.gemReward ?? 0), 0);
  const categoryCounts = useMemo(() => {
    const counts = Object.fromEntries(
      ACHIEVEMENT_CATEGORIES.map((item) => [item, { completed: 0, total: 0 }])
    ) as Record<AchievementScreenCategory, { completed: number; total: number }>;
    for (const achievement of allAchievements) {
      const achievementCategory = getAchievementCategory(achievement);
      const completed = unlockedAchievements.includes(achievement.id);
      counts.All.total += 1;
      counts[achievementCategory].total += 1;
      if (completed) {
        counts.All.completed += 1;
        counts[achievementCategory].completed += 1;
      }
    }
    return counts;
  }, [allAchievements, unlockedAchievements]);
  const visibleAchievements = useMemo(() => {
    const items = allAchievements.filter((achievement) => {
      const unlockedItem = unlockedAchievements.includes(achievement?.id);
      const categoryMatch = category === 'All' || getAchievementCategory(achievement) === category;
      const filterMatch = filter === 'all' || (filter === 'completed' ? unlockedItem : !unlockedItem);
      return categoryMatch && filterMatch;
    });
    if (filter === 'progress') {
      items.sort((a, b) => {
        const progressDelta = progressRatio(progressById.get(b.id)) - progressRatio(progressById.get(a.id));
        if (Math.abs(progressDelta) > 0.001) return progressDelta;
        return (a.xpReward ?? 0) - (b.xpReward ?? 0);
      });
      return items.slice(0, 20);
    }
    return items;
  }, [allAchievements, category, filter, unlockedAchievements, progressById]);
  const closestAchievement = useMemo(
    () => [...locked]
      .map((achievement) => ({ achievement, progress: progressById.get(achievement.id) }))
      .filter((item) => !!item.progress && progressRatio(item.progress) > 0)
      .sort((a, b) => progressRatio(b.progress) - progressRatio(a.progress))[0] ?? null,
    [locked, progressById],
  );

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
          <View style={styles.heroMetaRow}>
            <Text style={styles.heroMetaText}>Account rewards claimed {accountRewardedAchievementIds.size}/{allAchievements.length}</Text>
            <Text style={styles.heroMetaText}>{totalAvailableGems} total Gems</Text>
          </View>
        </GameCard>

        {closestAchievement?.progress && (
          <GameCard variant="subtle" eyebrow="CLOSEST MILESTONE" title={closestAchievement.achievement.name} accentColor={Colors.primary}>
            <View style={styles.closestHeader}>
              <Text style={styles.closestDescription}>{closestAchievement.achievement.description}</Text>
              <Text style={styles.closestReward}>+{closestAchievement.achievement.gemReward} Gems</Text>
            </View>
            <View style={styles.progressHeader}>
              <Text style={styles.progressText}>{formatProgressText(closestAchievement.progress)}</Text>
              <Text style={styles.progressPct}>{Math.round(progressRatio(closestAchievement.progress) * 100)}%</Text>
            </View>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${Math.round(progressRatio(closestAchievement.progress) * 100)}%` }]} />
            </View>
          </GameCard>
        )}

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
          {ACHIEVEMENT_CATEGORIES.map((item) => (
            <Pressable key={item} style={[styles.chip, category === item && styles.chipActive]} onPress={() => setCategory(item)}>
              <Text style={[styles.chipText, category === item && styles.chipTextActive]}>{item}</Text>
              <Text style={[styles.chipCount, category === item && styles.chipTextActive]}>
                {categoryCounts[item].completed}/{categoryCounts[item].total}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        <View style={styles.toggleRow}>
          {(['progress', 'completed', 'all'] as const).map((item) => (
            <Pressable key={item} style={[styles.toggleButton, filter === item && styles.toggleActive]} onPress={() => setFilter(item)}>
              <Text style={[styles.toggleText, filter === item && styles.toggleTextActive]}>
                {item === 'progress' ? 'Closest' : item === 'completed' ? 'Completed' : 'All'}
              </Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.sectionHeader}>
          {filter === 'progress'
            ? `${visibleAchievements.length} closest achievement${visibleAchievements.length === 1 ? '' : 's'}`
            : `${visibleAchievements.length} achievement${visibleAchievements.length === 1 ? '' : 's'} shown`}
        </Text>
        {filter === 'progress' && locked.length > visibleAchievements.length && (
          <Text style={styles.closestHint}>Showing the nearest 20 locked milestones. Use a category or All to browse the full set.</Text>
        )}
        {visibleAchievements.map((a) => {
          const unlockedItem = unlockedAchievements.includes(a?.id);
          const accountRewardClaimed = accountRewardedAchievementIds.has(a?.id);
          const achievementProgress = progressById.get(a.id);
          const ratio = progressRatio(achievementProgress);
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
                  {(a?.gemReward ?? 0) >= 3 && <Text style={styles.hardBadge}>HARD</Text>}
                </View>
                <Text style={styles.achDesc}>{a?.description}</Text>
                {!unlockedItem && achievementProgress && (
                  <View style={styles.rowProgressBlock}>
                    <View style={styles.progressHeader}>
                      <Text style={styles.progressText}>{formatProgressText(achievementProgress)}</Text>
                      <Text style={styles.progressPct}>{Math.round(ratio * 100)}%</Text>
                    </View>
                    <View style={styles.progressTrack}>
                      <View style={[styles.progressFill, { width: `${Math.round(ratio * 100)}%` }]} />
                    </View>
                  </View>
                )}
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
  heroMetaRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 10, marginTop: 8 },
  heroMetaText: { color: Colors.textSecondary, fontSize: 9, fontWeight: '700' },
  closestHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  closestDescription: { flex: 1, color: Colors.textSecondary, fontSize: 11, lineHeight: 16 },
  closestReward: { color: Colors.premium, fontSize: 11, fontWeight: '900' },
  progressHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 7 },
  progressText: { flex: 1, color: Colors.textSecondary, fontSize: 9, fontWeight: '700' },
  progressPct: { color: Colors.primary, fontSize: 9, fontWeight: '900' },
  progressTrack: { height: 5, borderRadius: 3, backgroundColor: Colors.elevated, overflow: 'hidden', marginTop: 4 },
  progressFill: { height: '100%', borderRadius: 3, backgroundColor: Colors.primary },
  rowProgressBlock: { marginTop: 4 },
  sectionHeader: { color: Colors.textSecondary, fontSize: 16, fontWeight: '600', marginTop: 12, marginBottom: 8 },
  closestHint: { color: Colors.textMuted, fontSize: 9, lineHeight: 13, marginTop: -4, marginBottom: 8 },
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
  hardBadge: { color: Colors.premium, fontSize: 8, fontWeight: '900', backgroundColor: `${Colors.premium}14`, borderRadius: 6, paddingHorizontal: 5, paddingVertical: 2 },
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
