import React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../src/theme/colors';
import GameStatusBar from '../src/components/StatusBar';
import GameCard from '../src/components/GameCard';
import useGameStore from '../src/store/gameStore';
import achievementsData from '../src/data/achievements.json';

export default function AchievementsScreen() {
  const router = useRouter();
  const unlockedAchievements = useGameStore((s) => s?.unlockedAchievements ?? []);

  const unlocked = (achievementsData ?? []).filter((a) => unlockedAchievements.includes(a?.id));
  const locked = (achievementsData ?? []).filter((a) => !unlockedAchievements.includes(a?.id));
  const totalXp = unlocked.reduce((t, a) => t + (a?.xpReward ?? 0), 0);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>Achievements</Text>
      </View>
      <GameStatusBar />
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <GameCard>
          <Text style={styles.statsLabel}>Progress</Text>
          <Text style={styles.statsValue}>{unlocked.length}/{achievementsData.length} Unlocked</Text>
          <Text style={styles.xpText}>Total XP Earned: {totalXp}</Text>
        </GameCard>

        {unlocked.length > 0 && <Text style={styles.sectionHeader}>Unlocked</Text>}
        {unlocked.map((a) => (
          <GameCard key={a?.id}>
            <View style={styles.achRow}>
              <View style={styles.iconWrap}>
                <Ionicons name={(a?.icon ?? 'trophy') as any} size={24} color={Colors.warning} />
              </View>
              <View style={styles.achInfo}>
                <Text style={styles.achName}>{a?.name}</Text>
                <Text style={styles.achDesc}>{a?.description}</Text>
              </View>
              <Text style={styles.achXp}>+{a?.xpReward} XP</Text>
            </View>
          </GameCard>
        ))}

        {locked.length > 0 && <Text style={styles.sectionHeader}>Locked</Text>}
        {locked.map((a) => (
          <GameCard key={a?.id}>
            <View style={[styles.achRow, { opacity: 0.5 }]}>
              <View style={styles.iconWrapLocked}>
                <Ionicons name="lock-closed" size={20} color={Colors.textMuted} />
              </View>
              <View style={styles.achInfo}>
                <Text style={styles.achName}>{a?.name}</Text>
                <Text style={styles.achDesc}>{a?.description}</Text>
              </View>
              <Text style={styles.achXpLocked}>+{a?.xpReward} XP</Text>
            </View>
          </GameCard>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12 },
  headerTitle: { color: Colors.textPrimary, fontSize: 20, fontWeight: '700' },
  scroll: { flex: 1 },
  scrollContent: { padding: 16 },
  statsLabel: { color: Colors.textSecondary, fontSize: 13 },
  statsValue: { color: Colors.textPrimary, fontSize: 22, fontWeight: '700', marginTop: 4 },
  xpText: { color: Colors.warning, fontSize: 14, fontWeight: '600', marginTop: 4 },
  sectionHeader: { color: Colors.textSecondary, fontSize: 16, fontWeight: '600', marginTop: 12, marginBottom: 8 },
  achRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconWrap: { width: 40, height: 40, borderRadius: 20, backgroundColor: `${Colors.warning}22`, justifyContent: 'center', alignItems: 'center' },
  iconWrapLocked: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.elevated, justifyContent: 'center', alignItems: 'center' },
  achInfo: { flex: 1 },
  achName: { color: Colors.textPrimary, fontSize: 15, fontWeight: '600' },
  achDesc: { color: Colors.textMuted, fontSize: 12, marginTop: 2 },
  achXp: { color: Colors.warning, fontSize: 13, fontWeight: '700' },
  achXpLocked: { color: Colors.textMuted, fontSize: 13 },
});
