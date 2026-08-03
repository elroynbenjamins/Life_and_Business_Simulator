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

export default function ProfileScreen() {
  const router = useRouter();
  const playerName = useGameStore((s) => s?.playerName ?? 'Player');
  const age = useGameStore((s) => s?.age ?? 22);
  const week = useGameStore((s) => s?.week ?? 1);
  const year = useGameStore((s) => s?.year ?? 1);
  const completedCourses = useGameStore((s) => s?.completedCourses ?? []);
  const careerHistory = useGameStore((s) => s?.careerHistory ?? []);
  const holdings = useGameStore((s) => s?.holdings ?? []);
  const getNetWorthValue = useGameStore((s) => s?.getNetWorthValue);
  const startNewGame = useGameStore((s) => s?.startNewGame);

  const netWorth = getNetWorthValue?.() ?? 0;
  const hasJob = (careerHistory?.length ?? 0) > 0;
  const hasStocks = (holdings?.length ?? 0) > 0;
  const allCoursesComplete = (completedCourses?.length ?? 0) >= 6;

  const milestones = [
    { label: 'First Job', done: hasJob },
    { label: 'First Stock Purchase', done: hasStocks },
    { label: 'Net Worth €50,000', done: netWorth >= 50000 },
    { label: 'Net Worth €100,000', done: netWorth >= 100000 },
    { label: 'All Courses Completed', done: allCoursesComplete },
    { label: 'CEO Level', done: false, locked: true },
  ];

  const handleNewGame = () => {
    Alert.alert(
      'New Game',
      'Start a new game? All progress will be lost.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'New Game', style: 'destructive', onPress: () => startNewGame?.() },
      ]
    );
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
        {/* Player Card */}
        <GameCard>
          <Text style={styles.playerName}>{playerName}</Text>
          <Text style={styles.playerMeta}>Age {age} • Week {week} • Year {year}</Text>
        </GameCard>

        {/* Milestones */}
        <GameCard title="Milestones">
          {milestones.map((m, i) => (
            <View key={i} style={styles.milestoneRow}>
              <Text style={styles.milestoneLabel}>{m?.label}</Text>
              {m?.locked ? (
                <StatusPill label="🔒 Coming Soon" color={Colors.textMuted} />
              ) : (
                <Text style={{ color: m?.done ? Colors.primary : Colors.textMuted, fontSize: 16 }}>
                  {m?.done ? '✅' : '❌'}
                </Text>
              )}
            </View>
          ))}
        </GameCard>

        {/* Career History */}
        {(careerHistory?.length ?? 0) > 0 ? (
          <GameCard title="Career History">
            {(careerHistory ?? []).map((entry, i) => (
              <View key={i} style={styles.historyRow}>
                <Text style={styles.historyTitle}>{entry?.title}</Text>
                <Text style={styles.historyMeta}>
                  Week {entry?.startWeek}{entry?.endWeek ? ` – ${entry.endWeek}` : ' – Present'}
                </Text>
              </View>
            ))}
          </GameCard>
        ) : null}

        {/* Completed Courses */}
        {(completedCourses?.length ?? 0) > 0 ? (
          <GameCard title="Completed Courses">
            {(completedCourses ?? []).map((c, i) => (
              <View key={i} style={styles.historyRow}>
                <Text style={styles.historyTitle}>{c?.name}</Text>
                <Text style={styles.historyMeta}>Completed Week {c?.completedWeek}</Text>
              </View>
            ))}
          </GameCard>
        ) : null}

        {/* New Game */}
        <Pressable style={styles.newGameBtn} onPress={handleNewGame}>
          <Text style={styles.newGameText}>New Game</Text>
        </Pressable>
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
  playerName: { color: Colors.textPrimary, fontSize: 24, fontWeight: '700' },
  playerMeta: { color: Colors.textSecondary, fontSize: 14, marginTop: 4 },
  milestoneRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.cardBorder,
  },
  milestoneLabel: { color: Colors.textPrimary, fontSize: 15 },
  historyRow: { paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: Colors.cardBorder },
  historyTitle: { color: Colors.textPrimary, fontSize: 15, fontWeight: '600' },
  historyMeta: { color: Colors.textMuted, fontSize: 12, marginTop: 2 },
  newGameBtn: {
    borderWidth: 1,
    borderColor: Colors.negative,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 16,
  },
  newGameText: { color: Colors.negative, fontSize: 16, fontWeight: '600' },
});
