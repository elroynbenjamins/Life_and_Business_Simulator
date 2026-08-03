import React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors } from '../../src/theme/colors';
import GameStatusBar from '../../src/components/StatusBar';
import GameCard from '../../src/components/GameCard';
import ProgressBar from '../../src/components/ProgressBar';
import useGameStore from '../../src/store/gameStore';
import { formatCurrency } from '../../src/utils/format';
import coursesData from '../../src/data/courses.json';
import jobsData from '../../src/data/jobs.json';
import housingData from '../../src/data/housing.json';
import carsData from '../../src/data/cars.json';
import foodData from '../../src/data/food.json';

export default function DashboardScreen() {
  const router = useRouter();
  const advanceWeek = useGameStore((s) => s?.advanceWeek);
  const currentJobId = useGameStore((s) => s?.currentJobId);
  const currentCourseId = useGameStore((s) => s?.currentCourseId);
  const courseWeeksCompleted = useGameStore((s) => s?.courseWeeksCompleted ?? 0);
  const currentHousingId = useGameStore((s) => s?.currentHousingId);
  const currentCarId = useGameStore((s) => s?.currentCarId ?? 'none');
  const foodLevel = useGameStore((s) => s?.foodLevel ?? 'basic');
  const currentHeadline = useGameStore((s) => s?.currentHeadline ?? '');
  const holdings = useGameStore((s) => s?.holdings ?? []);
  const loans = useGameStore((s) => s?.loans ?? []);
  const getPortfolioValueTotal = useGameStore((s) => s?.getPortfolioValueTotal);

  const job = (jobsData ?? []).find((j) => j?.id === currentJobId);
  const course = (coursesData ?? []).find((c) => c?.id === currentCourseId);
  const housing = (housingData ?? []).find((h) => h?.id === currentHousingId);
  const car = (carsData ?? []).find((c) => c?.id === currentCarId);
  const food = (foodData ?? []).find((f) => f?.id === foodLevel);
  const portfolioValue = getPortfolioValueTotal?.() ?? 0;
  const hasHoldings = (holdings?.length ?? 0) > 0;

  const weeklyIncome = job?.weeklySalary ?? 0;
  const weeklyExpenses = (housing?.weeklyRent ?? 150) + (car?.weeklyCost ?? 0) + (food?.weeklyCost ?? 50) + (course?.weeklyCost ?? 0);
  const totalLoanDebt = (loans ?? []).reduce((t, l) => t + (l?.remainingAmount ?? 0), 0);

  const tryHaptic = async () => {
    if (Platform.OS !== 'web') {
      try {
        const Haptics = await import('expo-haptics');
        Haptics?.impactAsync?.(Haptics.ImpactFeedbackStyle.Medium);
      } catch {}
    }
  };

  const handleNextWeek = () => { tryHaptic(); advanceWeek?.(); };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Dashboard</Text>
        <Pressable onPress={() => router.push('/profile')} hitSlop={12}>
          <Ionicons name="settings-outline" size={24} color={Colors.textSecondary} />
        </Pressable>
      </View>
      <GameStatusBar />
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {/* News */}
        <GameCard>
          <View style={styles.newsRow}>
            <Ionicons name="newspaper-outline" size={20} color={Colors.warning} />
            <Text style={styles.newsText}>{currentHeadline}</Text>
          </View>
        </GameCard>

        {/* Income vs Expenses */}
        <View style={styles.statsRow}>
          <GameCard style={styles.statCard} onPress={() => router.push('/tabs/career')}>
            <Text style={styles.statLabel}>Weekly Income</Text>
            <Text style={[styles.statValue, { color: job ? Colors.primary : Colors.warning }]}>
              {job ? formatCurrency(weeklyIncome) : 'Unemployed'}
            </Text>
            <Text style={styles.statCaption}>{job?.title ?? 'No job'}</Text>
          </GameCard>
          <GameCard style={styles.statCard} onPress={() => router.push('/tabs/finance')}>
            <Text style={styles.statLabel}>Weekly Expenses</Text>
            <Text style={[styles.statValue, { color: Colors.negative }]}>{formatCurrency(weeklyExpenses)}</Text>
            <Text style={styles.statCaption}>Rent + Food + Car</Text>
          </GameCard>
        </View>

        {/* Course Progress */}
        {course ? (
          <GameCard title="Course Progress" onPress={() => router.push('/tabs/education')}>
            <Text style={styles.courseTitle}>{course?.name}</Text>
            <ProgressBar progress={courseWeeksCompleted / (course?.duration ?? 1)} />
            <Text style={styles.courseCaption}>Week {courseWeeksCompleted}/{course?.duration}</Text>
          </GameCard>
        ) : null}

        {/* Portfolio */}
        {hasHoldings ? (
          <GameCard title="Portfolio" onPress={() => router.push('/portfolio')}>
            <Text style={[styles.statValue, { color: Colors.primary }]}>{formatCurrency(portfolioValue)}</Text>
            <Text style={styles.statCaption}>{holdings?.length ?? 0} stock(s) owned</Text>
          </GameCard>
        ) : null}

        {/* Loans */}
        {totalLoanDebt > 0 ? (
          <GameCard title="Active Loans" onPress={() => router.push('/loans')}>
            <Text style={[styles.statValue, { color: Colors.negative }]}>{formatCurrency(totalLoanDebt)}</Text>
            <Text style={styles.statCaption}>{loans?.length ?? 0} active loan(s)</Text>
          </GameCard>
        ) : null}

        {/* Quick Links */}
        <View style={styles.linksRow}>
          <QuickLink icon="home" label="Lifestyle" onPress={() => router.push('/housing')} />
          <QuickLink icon="trophy" label="Achievements" onPress={() => router.push('/achievements')} />
          <QuickLink icon="card" label="Loans" onPress={() => router.push('/loans')} />
          <QuickLink icon="pie-chart" label="Portfolio" onPress={() => router.push('/portfolio')} />
        </View>

        {/* Next Week Button */}
        <Pressable
          style={({ pressed }) => [styles.nextWeekButton, { transform: [{ scale: pressed ? 0.97 : 1 }] }]}
          onPress={handleNextWeek}
        >
          <Text style={styles.nextWeekText}>Advance to Next Week →</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function QuickLink({ icon, label, onPress }: { icon: string; label: string; onPress: () => void }) {
  return (
    <Pressable style={styles.quickLink} onPress={onPress}>
      <Ionicons name={icon as any} size={20} color={Colors.primary} />
      <Text style={styles.quickLinkText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 },
  headerTitle: { color: Colors.textPrimary, fontSize: 24, fontWeight: '700' },
  scroll: { flex: 1 },
  scrollContent: { padding: 16 },
  newsRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  newsText: { color: Colors.warning, fontSize: 14, fontStyle: 'italic', flex: 1 },
  statsRow: { flexDirection: 'row', gap: 12 },
  statCard: { flex: 1 },
  statLabel: { color: Colors.textSecondary, fontSize: 12, marginBottom: 4 },
  statValue: { fontSize: 20, fontWeight: '700' },
  statCaption: { color: Colors.textMuted, fontSize: 12, marginTop: 4 },
  courseTitle: { color: Colors.textPrimary, fontSize: 15, fontWeight: '600', marginBottom: 8 },
  courseCaption: { color: Colors.textSecondary, fontSize: 12, marginTop: 6 },
  linksRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginVertical: 4 },
  quickLink: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Colors.card, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1, borderColor: Colors.cardBorder },
  quickLinkText: { color: Colors.textPrimary, fontSize: 13, fontWeight: '500' },
  nextWeekButton: { backgroundColor: Colors.primary, borderRadius: 16, padding: 20, alignItems: 'center', marginTop: 8 },
  nextWeekText: { color: Colors.white, fontSize: 18, fontWeight: '700' },
});
