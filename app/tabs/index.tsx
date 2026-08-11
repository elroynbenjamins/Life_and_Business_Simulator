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
import { getWeeklySalary, getWeeklyRent, getWeeklyUtilityCost, getWeeklyCarCost, getWeeklyFoodCost, getWeeklyCourseCost, getWeeklyLoanPayments } from '../../src/engine/financeEngine';
import { getCareerSalary } from '../../src/engine/careerEngine';
import coursesData from '../../src/data/courses.json';

export default function DashboardScreen() {
  const router = useRouter();
  const advanceWeek = useGameStore((s) => s?.advanceWeek);
  const currentJobId = useGameStore((s) => s?.currentJobId);
  const currentCourseId = useGameStore((s) => s?.currentCourseId);
  const courseWeeksCompleted = useGameStore((s) => s?.courseWeeksCompleted ?? 0);
  const currentHeadline = useGameStore((s) => s?.currentHeadline ?? '');
  const holdings = useGameStore((s) => s?.holdings ?? []);
  const loans = useGameStore((s) => s?.loans ?? []);
  const businesses = useGameStore((s) => s?.businesses ?? []);
  const properties = useGameStore((s) => s?.properties ?? []);
  const career = useGameStore((s) => s?.career);
  const getPortfolioValueTotal = useGameStore((s) => s?.getPortfolioValueTotal);
  const gems = useGameStore((s) => s?.profile?.gems ?? 0);
  const prestigePoints = useGameStore((s) => s?.profile?.prestigePoints ?? 0);
  const state = useGameStore();

  const partTimeJob = useGameStore((s) => (s as any)?.partTimeJob ?? false);
  const course = (coursesData ?? []).find((c) => c?.id === currentCourseId);
  const portfolioValue = getPortfolioValueTotal?.() ?? 0;
  const hasHoldings = (holdings?.length ?? 0) > 0;
  const totalLoanDebt = (loans ?? []).reduce((t, l) => t + (l?.remainingAmount ?? 0), 0);

  // Use career v2 salary if available, otherwise legacy
  const hasCareerV2 = !!career?.companyId;
  const weeklyIncome = hasCareerV2 ? getCareerSalary(career!, state.inflationMultiplier ?? 1) : getWeeklySalary(state);
  const loanPayments = getWeeklyLoanPayments(state);
  const weeklyExpenses = getWeeklyRent(state) + getWeeklyUtilityCost(state) + getWeeklyCarCost(state) + getWeeklyFoodCost(state) + getWeeklyCourseCost(state) + loanPayments;

  const isEmployed = hasCareerV2 || !!currentJobId;
  const hasIncome = isEmployed || partTimeJob;
  const jobTitle = hasCareerV2
    ? (() => {
        const careerPathsData = require('../../src/data/career_paths.json') as any[];
        const path = careerPathsData.find((p: any) => p?.id === career?.careerPathId);
        const pos = path?.positions?.find((p: any) => p?.level === career?.positionLevel);
        return pos?.title ?? 'Employee';
      })()
    : (currentJobId
        ? require('../../src/data/jobs.json')?.find((j: any) => j?.id === currentJobId)?.title
        : (partTimeJob ? 'Part-Time' : null));
  const displayIncome = isEmployed ? weeklyIncome : (partTimeJob ? 150 : 0); // avg part-time ~€150
  const globalWeek = ((state.year ?? 1) - 1) * 20 + (state.week ?? 1);
  const weeksUntilTax = 20 - (globalWeek % 20);

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
        <View style={styles.headerRight}>
          <Pressable style={styles.gemsBadge} onPress={() => router.push('/support')} hitSlop={8}>
            <Ionicons name="diamond" size={14} color="#8B5CF6" />
            <Text style={styles.gemsText}>{gems}</Text>
          </Pressable>
          <Pressable onPress={() => router.push('/profile')} hitSlop={12}>
            <Ionicons name="settings-outline" size={24} color={Colors.textSecondary} />
          </Pressable>
        </View>
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
            <Text style={[styles.statValue, { color: hasIncome ? Colors.primary : Colors.warning }]}>
              {hasIncome ? (isEmployed ? formatCurrency(weeklyIncome) : '~' + formatCurrency(displayIncome)) : 'Unemployed'}
            </Text>
            <Text style={styles.statCaption}>{jobTitle ?? 'No job'}</Text>
          </GameCard>
          <GameCard style={styles.statCard} onPress={() => router.push('/tabs/statistics')}>
            <Text style={styles.statLabel}>Weekly Expenses</Text>
            <Text style={[styles.statValue, { color: Colors.negative }]}>{formatCurrency(weeklyExpenses)}</Text>
            <Text style={styles.statCaption}>Rent + Utils + Food + Car{loanPayments > 0 ? ' + Loans' : ''}</Text>
          </GameCard>
        </View>

        {/* Tax reminder */}
        <GameCard onPress={() => router.push('/info')}>
          <View style={styles.taxReminderRow}>
            <Ionicons name="receipt-outline" size={22} color={weeksUntilTax <= 3 ? Colors.negative : Colors.warning} />
            <View style={{ flex: 1 }}>
              <Text style={styles.taxReminderTitle}>Tax assessment in {weeksUntilTax} week{weeksUntilTax !== 1 ? 's' : ''}</Text>
              <Text style={styles.taxReminderText}>A tax bill is calculated from your career salary every 20 weeks. Keep enough cash available.</Text>
            </View>
          </View>
        </GameCard>

        {/* Course Progress */}
        {course ? (() => {
          const baseDur = course?.duration ?? 1;
          const adjustedDur = partTimeJob ? Math.ceil(baseDur * 1.5) : baseDur;
          return (
            <GameCard title="Course Progress" onPress={() => router.push('/tabs/education')}>
              <Text style={styles.courseTitle}>{course?.name}</Text>
              <ProgressBar progress={courseWeeksCompleted / adjustedDur} />
              <Text style={styles.courseCaption}>
                Week {courseWeeksCompleted}/{adjustedDur}{partTimeJob ? ' (slower — part-time)' : ''}
              </Text>
            </GameCard>
          );
        })() : null}

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

        {/* Businesses */}
        {businesses.length > 0 ? (
          <GameCard title="My Businesses" onPress={() => router.push('/business')}>
            <Text style={[styles.statValue, { color: Colors.primary }]}>
              {businesses.length} business{businesses.length !== 1 ? 'es' : ''}
            </Text>
            <Text style={styles.statCaption}>
              Weekly P&L: {(() => { const p = businesses.reduce((t, b) => t + (b?.lastWeekProfit ?? 0), 0); return `${p >= 0 ? '+' : ''}${formatCurrency(p)}`; })()}
            </Text>
          </GameCard>
        ) : null}

        {/* Properties */}
        {properties.length > 0 ? (
          <GameCard title="Real Estate" onPress={() => router.push('/properties')}>
            <Text style={[styles.statValue, { color: Colors.primary }]}>
              {properties.length} propert{properties.length !== 1 ? 'ies' : 'y'}
            </Text>
            <Text style={styles.statCaption}>
              Rental Income: {formatCurrency(properties.filter(p => p?.isRentedOut).reduce((t, p) => t + (p?.weeklyIncome ?? 0), 0))}/wk
            </Text>
          </GameCard>
        ) : null}

        {/* Quick Links */}
        <View style={styles.linksRow}>
          <QuickLink icon="home" label="Lifestyle" onPress={() => router.push('/housing')} />
          <QuickLink icon="trophy" label="Achievements" onPress={() => router.push('/achievements')} />
          <QuickLink icon="card" label="Loans" onPress={() => router.push('/loans')} />
          <QuickLink icon="pie-chart" label="Portfolio" onPress={() => router.push('/portfolio')} />
          <QuickLink icon="business" label="Business" onPress={() => router.push('/business')} color="#06B6D4" />
          <QuickLink icon="star" label="Skills" onPress={() => router.push('/skills')} color="#F59E0B" />
          <QuickLink icon="home-outline" label="Properties" onPress={() => router.push('/properties')} color="#06B6D4" />
          <QuickLink icon="ribbon" label="Prestige" onPress={() => router.push('/prestige')} color="#EC4899" />
          <QuickLink icon="diamond" label="Support" onPress={() => router.push('/support')} color="#8B5CF6" />
          <QuickLink icon="information-circle" label="Info" onPress={() => router.push('/info')} color="#3B82F6" />
          <QuickLink icon="stats-chart" label="Statistics" onPress={() => router.push('/tabs/statistics')} color="#10B981" />
          <QuickLink icon="newspaper" label="News" onPress={() => router.push('/news')} color="#F59E0B" />
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

function QuickLink({ icon, label, onPress, color }: { icon: string; label: string; onPress: () => void; color?: string }) {
  return (
    <Pressable style={styles.quickLink} onPress={onPress}>
      <Ionicons name={icon as any} size={20} color={color ?? Colors.primary} />
      <Text style={styles.quickLinkText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 },
  headerTitle: { color: Colors.textPrimary, fontSize: 24, fontWeight: '700' },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  gemsBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#8B5CF620', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 },
  gemsText: { color: '#8B5CF6', fontSize: 14, fontWeight: '700' },
  scroll: { flex: 1 },
  scrollContent: { padding: 16 },
  newsRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  newsText: { color: Colors.warning, fontSize: 14, fontStyle: 'italic', flex: 1 },
  statsRow: { flexDirection: 'row', gap: 12 },
  statCard: { flex: 1 },
  statLabel: { color: Colors.textSecondary, fontSize: 12, marginBottom: 4 },
  statValue: { fontSize: 20, fontWeight: '700' },
  statCaption: { color: Colors.textMuted, fontSize: 12, marginTop: 4 },
  taxReminderRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  taxReminderTitle: { color: Colors.textPrimary, fontSize: 14, fontWeight: '700' },
  taxReminderText: { color: Colors.textMuted, fontSize: 12, lineHeight: 17, marginTop: 3 },
  courseTitle: { color: Colors.textPrimary, fontSize: 15, fontWeight: '600', marginBottom: 8 },
  courseCaption: { color: Colors.textSecondary, fontSize: 12, marginTop: 6 },
  linksRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginVertical: 4 },
  quickLink: { flexBasis: '30%', flexGrow: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, backgroundColor: Colors.card, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 12, borderWidth: 1, borderColor: Colors.cardBorder },
  quickLinkText: { color: Colors.textPrimary, fontSize: 13, fontWeight: '500' },
  nextWeekButton: { backgroundColor: Colors.primary, borderRadius: 16, padding: 20, alignItems: 'center', marginTop: 8 },
  nextWeekText: { color: Colors.white, fontSize: 18, fontWeight: '700' },
});
