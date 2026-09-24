import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors } from '../../src/theme/colors';
import ScreenHeader from '../../src/components/ScreenHeader';
import GameCard from '../../src/components/GameCard';
import ProgressBar from '../../src/components/ProgressBar';
import GameButton from '../../src/components/GameButton';
import StatusPill from '../../src/components/StatusPill';
import useGameStore from '../../src/store/gameStore';
import { useShallow } from 'zustand/react/shallow';
import { formatCurrency } from '../../src/utils/format';
import { getWeeklySalary, getWeeklyRent, getWeeklyUtilityCost, getWeeklyCarCost, getWeeklyFoodCost, getWeeklyCourseCost, getWeeklyLoanPayments } from '../../src/engine/financeEngine';
import { getCareerSalary } from '../../src/engine/careerEngine';
import { calculatePartnerContribution } from '../../src/engine/relationshipEngine';
import coursesData from '../../src/data/courses.json';
import FirstStepsCard from '../../src/components/FirstStepsCard';
import { averageStudentWorkIncome, getStudentStudyDuration, getStudentWorkOption, getStudentWorkTier } from '../../src/engine/studentWork';
import achievementsData from '../../src/data/achievements.json';

export default function DashboardScreen() {
  const router = useRouter();
  const advanceWeek = useGameStore((s) => s?.advanceWeek);
  const [advancingWeek, setAdvancingWeek] = useState(false);
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
  const loginRewardAvailable = useGameStore((s) => s.getDailyLoginStatus().available);
  const annualReports = useGameStore((s) => s.annualReports ?? []);
  const annualReportUnread = useGameStore((s) => s.annualReportUnread ?? false);
  const openAnnualReport = useGameStore((s) => s.openAnnualReport);
  const pinnedAchievementGoals = useGameStore((s) => s.pinnedAchievementGoals ?? []);
  const unlockedAchievements = useGameStore((s) => s.unlockedAchievements ?? []);
  const state = useGameStore(useShallow((s) => ({
    currentJobId: s.currentJobId,
    currentCourseId: s.currentCourseId,
    currentHousingId: s.currentHousingId,
    currentCarId: s.currentCarId,
    inflationMultiplier: s.inflationMultiplier,
    career: s.career,
    loans: s.loans,
    year: s.year,
    week: s.week,
    relationshipModeEnabled: s.relationshipModeEnabled,
    relationshipState: s.relationshipState,
    partTimeJob: s.partTimeJob,
    studentWorkTier: s.studentWorkTier,
  }))) as ReturnType<typeof useGameStore.getState>;
  const relationshipModeEnabled = useGameStore((s) => s?.relationshipModeEnabled ?? false);
  const relationshipState = useGameStore((s) => s?.relationshipState);
  const lifecycle = useGameStore((s) => s?.lifecycle);
  const partner = (relationshipState?.activeConnections ?? []).find((item) => item.id === relationshipState?.partnerId) ?? null;

  const partTimeJob = useGameStore((s) => s?.partTimeJob ?? false);
  const studentWorkTier = useGameStore((s) => s?.studentWorkTier ?? null);
  const studentWork = getStudentWorkOption(getStudentWorkTier({ partTimeJob, studentWorkTier }));
  const course = (coursesData ?? []).find((c) => c?.id === currentCourseId);
  const portfolioValue = getPortfolioValueTotal?.() ?? 0;
  const hasHoldings = (holdings?.length ?? 0) > 0;
  const totalLoanDebt = (loans ?? []).reduce((t, l) => t + (l?.remainingAmount ?? 0), 0);
  const businessAttentionCount = businesses.filter((business) => !!business.pendingDecision).length;
  const businessCrisisCount = businesses.filter((business) => business.pendingDecision?.kind === 'crisis').length;
  const latestAnnualReport = annualReports[0] ?? null;
  const latestAnnualNetFlow = latestAnnualReport
    ? latestAnnualReport.totalIncome - latestAnnualReport.totalExpenses - latestAnnualReport.totalTax
    : 0;
  const activePinnedGoals = pinnedAchievementGoals
    .filter((id) => !unlockedAchievements.includes(id))
    .map((id) => (achievementsData as any[]).find((achievement) => achievement.id === id))
    .filter(Boolean);

  // Use career v2 salary if available, otherwise legacy
  const hasCareerV2 = !!career?.companyId;
  const weeklyIncome = hasCareerV2 ? getCareerSalary(career!, state.inflationMultiplier ?? 1) : getWeeklySalary(state);
  const loanPayments = getWeeklyLoanPayments(state);
  const household = relationshipModeEnabled ? calculatePartnerContribution(partner, state) : { contribution: 0, householdExtraCost: 0, familyCost: 0, obligationCost: 0 };
  const weeklyExpenses = getWeeklyRent(state) + getWeeklyUtilityCost(state) + getWeeklyCarCost(state) + getWeeklyFoodCost(state) + getWeeklyCourseCost(state) + loanPayments + household.householdExtraCost + household.familyCost + household.obligationCost;

  const isEmployed = hasCareerV2 || !!currentJobId;
  const coupleTripActive = (state.relationshipState?.coupleTripWeeksRemaining ?? 0) > 0;
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
        : (partTimeJob ? (studentWork?.shortName ?? 'Part-Time') : null));
  const displayIncome = coupleTripActive ? 0 : (isEmployed ? weeklyIncome : (partTimeJob ? averageStudentWorkIncome(studentWork?.id ?? null) : 0));
  const effectivePartnerContribution = coupleTripActive ? 0 : household.contribution;
  const projectedWeeklyFlow = displayIncome + effectivePartnerContribution - weeklyExpenses;
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

  const handleNextWeek = () => {
    if (lifecycle?.isDead || advancingWeek) return;
    setAdvancingWeek(true);
    void tryHaptic();

    const runAfterPaint = typeof requestAnimationFrame === 'function'
      ? (callback: () => void) => requestAnimationFrame(callback)
      : (callback: () => void) => setTimeout(callback, 0);

    runAfterPaint(() => {
      try {
        advanceWeek?.();
      } finally {
        setAdvancingWeek(false);
      }
    });
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScreenHeader
        title="Dashboard"
        accentColor={Colors.primary}
        right={(
          <>
            <Pressable style={styles.gemsBadge} onPress={() => router.push('/support')} hitSlop={8}>
              <Ionicons name="diamond" size={14} color={Colors.premium} />
              <Text style={styles.gemsText}>{gems}</Text>
            </Pressable>
            <Pressable onPress={() => router.push('/profile')} hitSlop={12}>
              <Ionicons name="settings-outline" size={22} color={Colors.textSecondary} />
            </Pressable>
          </>
        )}
      />
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <GameCard
          variant="hero"
          eyebrow="THIS WEEK"
          title="Weekly cash flow"
          accentColor={projectedWeeklyFlow >= 0 ? Colors.primary : Colors.negative}
          titleAccessory={(
            <StatusPill
              compact
              icon="receipt-outline"
              label={`Tax in ${weeksUntilTax}w`}
              color={weeksUntilTax <= 3 ? Colors.negative : Colors.warning}
            />
          )}
        >
          <View style={styles.flowHero}>
            <Text style={styles.flowLabel}>PROJECTED NET</Text>
            <Text style={[styles.flowValue, { color: projectedWeeklyFlow >= 0 ? Colors.primary : Colors.negative }]}>
              {projectedWeeklyFlow >= 0 ? '+' : ''}{formatCurrency(projectedWeeklyFlow)}
              <Text style={styles.flowPerWeek}> /wk</Text>
            </Text>
            <Text style={styles.flowHint}>Income and household contribution minus recurring weekly costs. Tax settles separately.</Text>
          </View>

          <View style={styles.weeklyMetrics}>
            <Pressable style={styles.weeklyMetric} onPress={() => router.push('/tabs/career')}>
              <View style={styles.metricHeader}>
                <Ionicons name="arrow-up-circle-outline" size={15} color={hasIncome ? Colors.primary : Colors.warning} />
                <Text style={styles.metricLabel}>Income</Text>
              </View>
              <Text style={[styles.metricValue, { color: hasIncome ? Colors.primary : Colors.warning }]}>
                {hasIncome ? formatCurrency(displayIncome) : 'Unemployed'}
              </Text>
              <Text style={styles.metricCaption} numberOfLines={1}>
                {coupleTripActive ? `World trip • ${state.relationshipState?.coupleTripWeeksRemaining ?? 0}w unpaid` : (jobTitle ?? 'No active job')}
              </Text>
            </Pressable>

            <Pressable style={styles.weeklyMetric} onPress={() => router.push('/tabs/statistics')}>
              <View style={styles.metricHeader}>
                <Ionicons name="arrow-down-circle-outline" size={15} color={Colors.negative} />
                <Text style={styles.metricLabel}>Expenses</Text>
              </View>
              <Text style={[styles.metricValue, { color: Colors.negative }]}>{formatCurrency(weeklyExpenses)}</Text>
              <Text style={styles.metricCaption} numberOfLines={1}>Recurring household costs</Text>
            </Pressable>
          </View>

          {effectivePartnerContribution > 0 && (
            <View style={styles.sharedContribution}>
              <Ionicons name="heart-outline" size={14} color={Colors.family} />
              <Text style={styles.sharedContributionText}>
                {partner?.name ?? 'Partner'} contributes {formatCurrency(effectivePartnerContribution)}/wk to shared costs
              </Text>
            </View>
          )}

          <GameButton
            label={lifecycle?.isDead ? 'Life Complete' : advancingWeek ? 'Processing Week...' : 'Advance to Next Week'}
            icon={advancingWeek ? 'hourglass-outline' : undefined}
            trailingIcon={lifecycle?.isDead || advancingWeek ? undefined : 'arrow-forward'}
            disabled={!!lifecycle?.isDead || advancingWeek}
            onPress={handleNextWeek}
            style={styles.advanceButton}
          />
        </GameCard>

        <FirstStepsCard />

        {latestAnnualReport && (
          <GameCard
            variant="subtle"
            eyebrow="YEARLY REPORT"
            title={`Year ${Math.floor(latestAnnualReport.toWeek / 20)} Summary`}
            accentColor={latestAnnualNetFlow >= 0 ? Colors.primary : Colors.negative}
            onPress={() => openAnnualReport(0)}
            titleAccessory={annualReportUnread
              ? <StatusPill compact label="NEW" color={Colors.info} />
              : <StatusPill compact label="Saved" color={Colors.textSecondary} />}
          >
            <View style={styles.annualReportRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.annualReportLabel}>NET CASH FLOW</Text>
                <Text style={[styles.annualReportValue, { color: latestAnnualNetFlow >= 0 ? Colors.primary : Colors.negative }]}>
                  {latestAnnualNetFlow >= 0 ? '+' : ''}{formatCurrency(latestAnnualNetFlow)}
                </Text>
              </View>
              <View style={styles.annualReportMetric}>
                <Text style={styles.annualReportLabel}>NET WORTH</Text>
                <Text style={styles.annualReportMetricValue}>{formatCurrency(latestAnnualReport.currentNetWorth)}</Text>
              </View>
              <Ionicons name="chevron-forward" size={17} color={Colors.textMuted} />
            </View>
            <Text style={styles.annualReportHint}>Saved automatically. Open only when you want the full breakdown.</Text>
          </GameCard>
        )}

        {activePinnedGoals.length > 0 && (
          <GameCard
            variant="subtle"
            eyebrow="PERSONAL GOALS"
            title="Pinned Milestones"
            accentColor={Colors.warning}
            onPress={() => router.push('/achievements')}
            titleAccessory={<StatusPill compact label={`${activePinnedGoals.length}/3`} color={Colors.warning} />}
          >
            <View style={styles.goalList}>
              {activePinnedGoals.map((goal: any) => (
                <View key={goal.id} style={styles.goalRow}>
                  <View style={styles.goalIcon}>
                    <Ionicons name="flag-outline" size={15} color={Colors.warning} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.goalTitle}>{goal.name}</Text>
                    <Text style={styles.goalDesc} numberOfLines={1}>{goal.description}</Text>
                  </View>
                </View>
              ))}
            </View>
            <Text style={styles.goalHint}>Manage pinned goals from Achievements.</Text>
          </GameCard>
        )}

        {course ? (() => {
          const baseDur = course?.duration ?? 1;
          const adjustedDur = getStudentStudyDuration(baseDur, studentWork?.id ?? null);
          return (
            <GameCard
              eyebrow="EDUCATION"
              title={course?.name}
              accentColor={Colors.education}
              onPress={() => router.push('/tabs/education')}
              titleAccessory={<StatusPill compact label={`${courseWeeksCompleted}/${adjustedDur} wk`} color={Colors.education} />}
            >
              <ProgressBar progress={courseWeeksCompleted / adjustedDur} color={Colors.education} />
              <Text style={styles.courseCaption}>
                {studentWork
                  ? `${studentWork.shortName} increases study time by ${Math.round((studentWork.studyDurationMultiplier - 1) * 100)}%`
                  : `${Math.max(0, adjustedDur - courseWeeksCompleted)} week${Math.max(0, adjustedDur - courseWeeksCompleted) === 1 ? '' : 's'} remaining`}
              </Text>
            </GameCard>
          );
        })() : null}

        <GameCard variant="subtle" compact>
          <View style={styles.newsRow}>
            <Ionicons name="newspaper-outline" size={17} color={Colors.warning} />
            <Text style={styles.newsText} numberOfLines={2}>{currentHeadline}</Text>
          </View>
        </GameCard>

        {/* Personal Life */}
        {relationshipModeEnabled && (
          <GameCard title="Personal Life" onPress={() => router.push('/relationships')}>
            {partner ? (
              <>
                <Text style={[styles.statValue, { color: Colors.happiness }]}>{partner.name} • {partner.stage === 'married' ? 'Married' : partner.stage === 'engaged' ? 'Engaged' : (partner.isCohabiting || partner.stage === 'living_together') ? 'Living Together' : 'Partner'}</Text>
                <Text style={styles.statCaption}>Relationship: {Math.round(partner.relationship ?? 0)}%{effectivePartnerContribution > 0 ? ` • +${formatCurrency(effectivePartnerContribution)}/wk shared costs` : ''}</Text>
              </>
            ) : (
              <>
                <Text style={[styles.statValue, { color: Colors.happiness }]}>Single</Text>
                <Text style={styles.statCaption}>Meet someone and build a life together</Text>
              </>
            )}
          </GameCard>
        )}

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
            {businessAttentionCount > 0 && (
              <Text style={[styles.statCaption, { color: businessCrisisCount > 0 ? Colors.negative : Colors.warning, fontWeight: '700' }]}>
                {businessAttentionCount} compan{businessAttentionCount === 1 ? 'y needs' : 'ies need'} attention
                {businessCrisisCount > 0 ? ` • ${businessCrisisCount} crisis${businessCrisisCount === 1 ? '' : 'es'}` : ''}
              </Text>
            )}
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

        {/* Utility Links */}
        <Text style={styles.sectionLabel}>More</Text>
        <View style={styles.linksRow}>
          <QuickLink icon="home" label="Lifestyle" onPress={() => router.push('/housing')} />
          <QuickLink icon="trophy" label="Achievements" onPress={() => router.push('/achievements')} color={Colors.warning} />
          <QuickLink icon="card" label="Bank" onPress={() => router.push('/loans')} color={Colors.info} />
          <QuickLink icon="ribbon" label="Prestige" onPress={() => router.push('/prestige')} color={Colors.family} />
          <QuickLink icon="diamond" label="Support" onPress={() => router.push('/support')} color={Colors.premium} notification={loginRewardAvailable} />
          <QuickLink icon="newspaper" label="News" onPress={() => router.push('/news')} color={Colors.warning} />
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

function QuickLink({ icon, label, onPress, color, notification }: { icon: string; label: string; onPress: () => void; color?: string; notification?: boolean }) {
  return (
    <Pressable style={styles.quickLink} onPress={onPress}>
      <Ionicons name={icon as any} size={20} color={color ?? Colors.primary} />
      <Text style={styles.quickLinkText}>{label}</Text>
      {notification && <View style={styles.notificationDot} />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  gemsBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: `${Colors.premium}20`, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 },
  gemsText: { color: Colors.premium, fontSize: 14, fontWeight: '700' },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 28 },
  flowHero: { marginBottom: 13 },
  flowLabel: { color: Colors.textMuted, fontSize: 9, fontWeight: '800', letterSpacing: 1 },
  flowValue: { fontSize: 28, lineHeight: 34, fontWeight: '900', marginTop: 1 },
  flowPerWeek: { color: Colors.textMuted, fontSize: 12, fontWeight: '700' },
  flowHint: { color: Colors.textMuted, fontSize: 11, lineHeight: 16, marginTop: 2 },
  weeklyMetrics: { flexDirection: 'row', gap: 8, marginBottom: 9 },
  weeklyMetric: { flex: 1, minWidth: 0, backgroundColor: Colors.elevated, borderRadius: 10, borderWidth: 1, borderColor: Colors.cardBorder, padding: 10 },
  metricHeader: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 5 },
  metricLabel: { color: Colors.textSecondary, fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
  metricValue: { fontSize: 16, fontWeight: '800' },
  metricCaption: { color: Colors.textMuted, fontSize: 10, marginTop: 2 },
  sharedContribution: { minHeight: 30, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 9, paddingVertical: 6, borderRadius: 8, backgroundColor: `${Colors.family}10`, marginBottom: 10 },
  sharedContributionText: { flex: 1, color: Colors.textSecondary, fontSize: 11, fontWeight: '600' },
  advanceButton: { marginTop: 2 },
  newsRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  newsText: { color: Colors.textSecondary, fontSize: 12, lineHeight: 17, flex: 1 },
  statValue: { fontSize: 20, fontWeight: '700' },
  statCaption: { color: Colors.textMuted, fontSize: 12, marginTop: 4 },
  courseCaption: { color: Colors.textSecondary, fontSize: 11, marginTop: 7 },
  annualReportRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  annualReportLabel: { color: Colors.textMuted, fontSize: 8, fontWeight: '900', letterSpacing: 0.5 },
  annualReportValue: { fontSize: 18, fontWeight: '900', marginTop: 2 },
  annualReportMetric: { alignItems: 'flex-end' },
  annualReportMetricValue: { color: Colors.textPrimary, fontSize: 11, fontWeight: '800', marginTop: 2 },
  annualReportHint: { color: Colors.textMuted, fontSize: 9, lineHeight: 13, marginTop: 7 },
  goalList: { gap: 4 },
  goalRow: { minHeight: 38, flexDirection: 'row', alignItems: 'center', gap: 8 },
  goalIcon: { width: 28, height: 28, borderRadius: 8, backgroundColor: `${Colors.warning}12`, alignItems: 'center', justifyContent: 'center' },
  goalTitle: { color: Colors.textPrimary, fontSize: 11, fontWeight: '800' },
  goalDesc: { color: Colors.textMuted, fontSize: 9, marginTop: 1 },
  goalHint: { color: Colors.textMuted, fontSize: 9, marginTop: 5 },
  sectionLabel: { color: Colors.textMuted, fontSize: 10, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase', marginTop: 4, marginBottom: 8 },
  linksRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginVertical: 4 },
  quickLink: { flexBasis: '31%', flexGrow: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, backgroundColor: Colors.card, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 12, borderWidth: 1, borderColor: Colors.cardBorder },
  quickLinkText: { color: Colors.textPrimary, fontSize: 13, fontWeight: '500' },
  notificationDot: { position: 'absolute', top: 7, right: 7, width: 9, height: 9, borderRadius: 5, backgroundColor: Colors.negative },
});
