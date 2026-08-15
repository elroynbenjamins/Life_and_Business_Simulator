import React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../src/theme/colors';
import GameStatusBar from '../src/components/StatusBar';
import GameCard from '../src/components/GameCard';
import useGameStore from '../src/store/gameStore';
import { formatCurrency } from '../src/utils/format';
import { INITIAL_STATISTICS } from '../src/types/game';
import achievementsData from '../src/data/achievements.json';
import { showGameDialog } from '../src/components/GameDialog';

export default function ProfileScreen() {
  const router = useRouter();
  const playerName = useGameStore((s) => s?.playerName ?? 'Player');
  const age = useGameStore((s) => s?.age ?? 22);
  const week = useGameStore((s) => s?.week ?? 1);
  const year = useGameStore((s) => s?.year ?? 1);
  const completedCourses = useGameStore((s) => s?.completedCourses ?? []);
  const careerHistory = useGameStore((s) => s?.careerHistory ?? []);
  const unlockedAchievements = useGameStore((s) => s?.unlockedAchievements ?? []);
  const statistics = useGameStore((s) => s?.statistics ?? { ...INITIAL_STATISTICS });
  const inflationMultiplier = useGameStore((s) => s?.inflationMultiplier ?? 1);
  const profile = useGameStore((s) => s?.profile);
  const getNetWorthValue = useGameStore((s) => s?.getNetWorthValue);
  const startNewGame = useGameStore((s) => s?.startNewGame);
  const openSlotPicker = useGameStore((s) => s?.openSlotPicker);
  const activeSlot = useGameStore((s) => s?.activeSlot ?? 0);

  const netWorth = getNetWorthValue?.() ?? 0;

  const handleNewGame = () => {
    showGameDialog({ title: 'New Game', message: 'Start a new game? All progress in this slot will be lost.', confirmText: 'New Game', destructive: true, onConfirm: () => startNewGame?.() });
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
          <Text style={styles.playerMeta}>Age {age} • Week {week} • Year {year} • Slot {activeSlot + 1}</Text>
          <View style={styles.statsGrid}>
            <StatItem label="Net Worth" value={formatCurrency(netWorth)} color={Colors.primary} />
            <StatItem label="Weeks Played" value={`${statistics.weeksPlayed}`} color={Colors.info} />
            <StatItem label="Courses Done" value={`${completedCourses.length}`} color={Colors.warning} />
          </View>
        </GameCard>

        {/* Player Profile (cross-game) */}
        <GameCard title="Player Profile">
          <View style={styles.profileRow}>
            <View style={styles.profileItem}>
              <Ionicons name="star" size={22} color={Colors.warning} />
              <Text style={styles.profileValue}>{profile?.totalXp ?? 0} XP</Text>
            </View>
            <View style={styles.profileItem}>
              <Ionicons name="diamond" size={22} color="#8B5CF6" />
              <Text style={styles.profileValue}>{profile?.gems ?? 0} Gems</Text>
            </View>
          </View>
        </GameCard>

        {/* Lifetime Statistics */}
        <GameCard title="Lifetime Statistics">
          <StatRow label="Total Salary Earned" value={formatCurrency(statistics.totalSalaryEarned)} />
          <StatRow label="Total Taxes Paid" value={formatCurrency(statistics.totalTaxesPaid)} />
          <StatRow label="Total Living Costs" value={formatCurrency(statistics.totalLivingCosts)} />
          <View style={styles.divider} />
          <StatRow label="Highest Cash" value={formatCurrency(statistics.highestCash)} color={Colors.primary} />
          <StatRow label="Highest Net Worth" value={formatCurrency(statistics.highestNetWorth)} color={Colors.primary} />
          <View style={styles.divider} />
          <StatRow label="Stocks Purchased" value={`${statistics.stocksPurchased} shares`} />
          <StatRow label="Best Stock Gain" value={`${statistics.largestStockGain.toFixed(1)}%`} color={Colors.primary} />
          <StatRow label="Worst Stock Loss" value={`${statistics.largestStockLoss.toFixed(1)}%`} color={Colors.negative} />
          <View style={styles.divider} />
          <StatRow label="Jobs Worked" value={`${statistics.jobsWorked}`} />
          <StatRow label="Weeks Employed" value={`${statistics.weeksEmployed}`} />
          <StatRow label="Weeks Unemployed" value={`${statistics.weeksUnemployed}`} />
          <StatRow label="Loans Taken" value={`${statistics.loansTaken}`} />
          <StatRow label="Loans Repaid" value={`${statistics.loansRepaid}`} />
          {inflationMultiplier > 1 && (
            <>
              <View style={styles.divider} />
              <StatRow label="Inflation Multiplier" value={`×${inflationMultiplier.toFixed(2)}`} color={Colors.warning} />
            </>
          )}
        </GameCard>

        {/* Achievements */}
        <GameCard title="Achievements" onPress={() => router.push('/achievements')}>
          <Text style={styles.achText}>{unlockedAchievements.length}/{achievementsData.length} unlocked</Text>
          <Text style={styles.xpText}>Total XP: {profile?.totalXp ?? 0}</Text>
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

        {/* Actions */}
        <Pressable style={styles.slotBtn} onPress={openSlotPicker}>
          <Ionicons name="save-outline" size={18} color={Colors.info} />
          <Text style={styles.slotBtnText}>Save Slots</Text>
        </Pressable>

        <Pressable style={styles.supportBtn} onPress={() => router.push('/support')}>
          <Ionicons name="diamond" size={18} color="#8B5CF6" />
          <Text style={styles.supportBtnText}>Support (Gems)</Text>
        </Pressable>

        <Pressable style={styles.feedbackBtn} onPress={() => Linking.openURL('https://github.com/elroynbenjamins/Life_and_Business_Simulator/issues/new')}>
          <Ionicons name="chatbubble-ellipses-outline" size={18} color={Colors.info} />
          <Text style={styles.feedbackBtnText}>Tester Feedback / Report a Bug</Text>
        </Pressable>

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

function StatRow({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <View style={styles.statRow}>
      <Text style={styles.statRowLabel}>{label}</Text>
      <Text style={[styles.statRowValue, color ? { color } : undefined]}>{value}</Text>
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
  profileRow: { flexDirection: 'row', justifyContent: 'space-around' },
  profileItem: { alignItems: 'center', gap: 4 },
  profileValue: { color: Colors.textPrimary, fontSize: 18, fontWeight: '700' },
  divider: { height: 1, backgroundColor: Colors.cardBorder, marginVertical: 6 },
  statRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5 },
  statRowLabel: { color: Colors.textSecondary, fontSize: 14 },
  statRowValue: { color: Colors.textPrimary, fontSize: 14, fontWeight: '600' },
  achText: { color: Colors.textPrimary, fontSize: 16, fontWeight: '600' },
  xpText: { color: Colors.warning, fontSize: 14, fontWeight: '600', marginTop: 4 },
  historyRow: { paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: Colors.cardBorder },
  historyTitle: { color: Colors.textPrimary, fontSize: 15, fontWeight: '600' },
  historyMeta: { color: Colors.textMuted, fontSize: 12, marginTop: 2 },
  slotBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1, borderColor: Colors.info, borderRadius: 12, padding: 16, marginTop: 16 },
  slotBtnText: { color: Colors.info, fontSize: 16, fontWeight: '600' },
  supportBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1, borderColor: '#8B5CF6', borderRadius: 12, padding: 16, marginTop: 10 },
  supportBtnText: { color: '#8B5CF6', fontSize: 16, fontWeight: '600' },
  feedbackBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1, borderColor: Colors.info, borderRadius: 12, padding: 16, marginTop: 10 },
  feedbackBtnText: { color: Colors.info, fontSize: 16, fontWeight: '600' },
  newGameBtn: { borderWidth: 1, borderColor: Colors.negative, borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 10 },
  newGameText: { color: Colors.negative, fontSize: 16, fontWeight: '600' },
});
