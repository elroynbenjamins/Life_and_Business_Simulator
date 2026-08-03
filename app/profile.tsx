import React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../src/theme/colors';
import GameStatusBar from '../src/components/StatusBar';
import GameCard from '../src/components/GameCard';
import StatusPill from '../src/components/StatusPill';
import useGameStore from '../src/store/gameStore';
import { formatCurrency } from '../src/utils/format';
import achievementsData from '../src/data/achievements.json';

export default function ProfileScreen() {
  const router = useRouter();
  const playerName = useGameStore((s) => s?.playerName ?? 'Player');
  const age = useGameStore((s) => s?.age ?? 22);
  const week = useGameStore((s) => s?.week ?? 1);
  const year = useGameStore((s) => s?.year ?? 1);
  const happiness = useGameStore((s) => s?.happiness ?? 30);
  const totalWeeksWorked = useGameStore((s) => s?.totalWeeksWorked ?? 0);
  const completedCourses = useGameStore((s) => s?.completedCourses ?? []);
  const careerHistory = useGameStore((s) => s?.careerHistory ?? []);
  const unlockedAchievements = useGameStore((s) => s?.unlockedAchievements ?? []);
  const getNetWorthValue = useGameStore((s) => s?.getNetWorthValue);
  const startNewGame = useGameStore((s) => s?.startNewGame);

  const netWorth = getNetWorthValue?.() ?? 0;
  const totalXp = unlockedAchievements.reduce((t, id) => {
    const ach = (achievementsData ?? []).find((a) => a?.id === id);
    return t + (ach?.xpReward ?? 0);
  }, 0);

  const handleNewGame = () => {
    Alert.alert('New Game', 'Start a new game? All progress will be lost.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'New Game', style: 'destructive', onPress: () => startNewGame?.() },
    ]);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>Profile & Stats</Text>
      </View>
      <GameStatusBar />
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <GameCard>
          <Text style={styles.playerName}>{playerName}</Text>
          <Text style={styles.playerMeta}>Age {age} • Week {week} • Year {year}</Text>
          <View style={styles.statsGrid}>
            <StatItem label="Net Worth" value={formatCurrency(netWorth)} color={Colors.primary} />
            <StatItem label="Happiness" value={`${happiness}/100`} color={Colors.happiness} />
            <StatItem label="Weeks Worked" value={`${totalWeeksWorked}`} color={Colors.info} />
            <StatItem label="Courses Done" value={`${completedCourses.length}`} color={Colors.warning} />
          </View>
        </GameCard>

        {/* Achievements */}
        <GameCard title="Achievements" onPress={() => router.push('/achievements')}>
          <Text style={styles.achText}>{unlockedAchievements.length}/{achievementsData.length} unlocked</Text>
          <Text style={styles.xpText}>Total XP: {totalXp}</Text>
        </GameCard>

        {/* Career History */}
        {careerHistory.length > 0 && (
          <GameCard title="Career History">
            {careerHistory.slice(-5).reverse().map((entry, i) => (
              <View key={i} style={styles.historyRow}>
                <Text style={styles.historyTitle}>{entry?.title}</Text>
                <Text style={styles.historyMeta}>
                  Week {entry?.startWeek}{entry?.endWeek ? ` – ${entry.endWeek}` : ' – Present'}
                </Text>
              </View>
            ))}
          </GameCard>
        )}

        {/* Completed Courses */}
        {completedCourses.length > 0 && (
          <GameCard title="Completed Courses">
            {completedCourses.map((c, i) => (
              <View key={i} style={styles.historyRow}>
                <Text style={styles.historyTitle}>{c?.name}</Text>
                <Text style={styles.historyMeta}>Completed Week {c?.completedWeek}</Text>
              </View>
            ))}
          </GameCard>
        )}

        <Pressable style={styles.newGameBtn} onPress={handleNewGame}>
          <Text style={styles.newGameText}>New Game</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function StatItem({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View style={statStyles.item}>
      <Text style={statStyles.value} numberOfLines={1}>{value}</Text>
      <Text style={statStyles.label}>{label}</Text>
    </View>
  );
}

const statStyles = StyleSheet.create({
  item: { width: '48%', marginBottom: 12 },
  value: { color: Colors.textPrimary, fontSize: 18, fontWeight: '700' },
  label: { color: Colors.textMuted, fontSize: 12, marginTop: 2 },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12 },
  headerTitle: { color: Colors.textPrimary, fontSize: 20, fontWeight: '700' },
  scroll: { flex: 1 },
  scrollContent: { padding: 16 },
  playerName: { color: Colors.textPrimary, fontSize: 24, fontWeight: '700' },
  playerMeta: { color: Colors.textSecondary, fontSize: 14, marginTop: 4, marginBottom: 12 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  achText: { color: Colors.textPrimary, fontSize: 16, fontWeight: '600' },
  xpText: { color: Colors.warning, fontSize: 14, fontWeight: '600', marginTop: 4 },
  historyRow: { paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: Colors.cardBorder },
  historyTitle: { color: Colors.textPrimary, fontSize: 15, fontWeight: '600' },
  historyMeta: { color: Colors.textMuted, fontSize: 12, marginTop: 2 },
  newGameBtn: { borderWidth: 1, borderColor: Colors.negative, borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 16 },
  newGameText: { color: Colors.negative, fontSize: 16, fontWeight: '600' },
});
