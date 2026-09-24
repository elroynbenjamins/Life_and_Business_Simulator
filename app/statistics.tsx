import React, { useState } from 'react';
import { ScrollView, View, Text, StyleSheet, Pressable, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { LineChart } from 'react-native-chart-kit';
import useGameStore from '../src/store/gameStore';
import { useShallow } from 'zustand/react/shallow';
import { Colors, resolveThemeColor } from '../src/theme/colors';
import GameCard from '../src/components/GameCard';
import ScreenHeader from '../src/components/ScreenHeader';
import ScreenTabs from '../src/components/ScreenTabs';
import StatusPill from '../src/components/StatusPill';
import { formatCurrency } from '../src/utils/format';
import { getWeeklySalary, processExpenses } from '../src/engine/financeEngine';
import { getCareerSalary } from '../src/engine/careerEngine';
import { calculatePartnerContribution } from '../src/engine/relationshipEngine';
import { averageStudentWorkIncome, getStudentWorkTier } from '../src/engine/studentWork';

export default function StatisticsScreen({ showBack = true }: { showBack?: boolean } = {}) {
  const { width: screenWidth } = useWindowDimensions();
  const s = useGameStore((st: any) => st.statistics);
  const netWorthHistory = useGameStore((st: any) => st.netWorthHistory);
  const week = useGameStore((st: any) => st.week);
  const year = useGameStore((st: any) => st.year);
  const age = useGameStore((st: any) => st.age);
  const gameState = useGameStore(useShallow((st) => ({
    currentJobId: st.currentJobId,
    cash: st.cash,
    currentCourseId: st.currentCourseId,
    currentHousingId: st.currentHousingId,
    currentCarId: st.currentCarId,
    inflationMultiplier: st.inflationMultiplier,
    career: st.career,
    profile: st.profile,
    loans: st.loans,
    partTimeJob: st.partTimeJob,
    studentWorkTier: st.studentWorkTier,
    holdings: st.holdings,
    week: st.week,
    year: st.year,
    relationshipModeEnabled: st.relationshipModeEnabled,
    relationshipState: st.relationshipState,
  }))) as ReturnType<typeof useGameStore.getState>;
  const expenses = processExpenses(gameState);
  const coupleTripActive = (gameState.relationshipState?.coupleTripWeeksRemaining ?? 0) > 0;
  const baseCareerIncome = gameState.career?.companyId
    ? getCareerSalary(gameState.career, gameState.inflationMultiplier ?? 1, gameState.profile)
    : getWeeklySalary(gameState);
  const careerIncome = coupleTripActive ? 0 : baseCareerIncome;
  const studentWorkTier = getStudentWorkTier({
    partTimeJob: gameState.partTimeJob,
    studentWorkTier: gameState.studentWorkTier,
  });
  const partTimeIncome = !coupleTripActive && !gameState.career?.companyId && !gameState.currentJobId && studentWorkTier
    ? averageStudentWorkIncome(studentWorkTier)
    : 0;
  const totalStocksOwned = (gameState.holdings ?? []).reduce((total, holding) => total + (holding.shares ?? 0), 0);
  const partner = gameState.relationshipState?.activeConnections?.find(item => item.id === gameState.relationshipState.partnerId) ?? null;
  const household = calculatePartnerContribution(partner, gameState);
  const partnerContribution = coupleTripActive ? 0 : household.contribution;
  const weeklyIncome = careerIncome + partTimeIncome + partnerContribution;
  const weeklyExpenses = expenses.totalExpenses + household.householdExtraCost + household.familyCost + household.obligationCost;
  const nw = (netWorthHistory ?? []).slice(-1)[0] ?? 0;
  const chartWidth = Math.min(screenWidth - 64, 500);
  const history: number[] = netWorthHistory ?? [];
  const hasChart = history.length >= 2;
  const firstNW = history[0] ?? 0;
  const lineColor = nw >= firstNW ? Colors.primary : Colors.negative;
  // For negative support, offset data so the chart min is 0, then relabel
  const minNW = hasChart ? Math.min(...history) : 0;
  const offset = minNW < 0 ? Math.abs(minNW) : 0;
  const chartData = hasChart ? history.map((v) => (v ?? 0) + offset) : [];
  const weeklyFlow = weeklyIncome - weeklyExpenses;
  const netWorthChange = nw - firstNW;
  const [showCashFlowDetails, setShowCashFlowDetails] = useState(false);
  const [activeView, setActiveView] = useState<'overview' | 'lifetime'>('overview');

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScreenHeader
        title="Life Statistics"
        subtitle="Cash flow, progress and lifetime records"
        showBack={showBack}
        onBack={() => router.back()}
        accentColor={Colors.primary}
      />
      <ScrollView contentContainerStyle={styles.content}>
        <GameCard
          variant="hero"
          eyebrow="FINANCIAL POSITION"
          title="Net Worth"
          accentColor={lineColor}
          titleAccessory={(
            <StatusPill
              compact
              icon={weeklyFlow >= 0 ? 'trending-up-outline' : 'trending-down-outline'}
              label={`${weeklyFlow >= 0 ? '+' : ''}${formatCurrency(weeklyFlow)}/wk`}
              color={weeklyFlow >= 0 ? Colors.primary : Colors.negative}
            />
          )}
        >
          <Text style={[styles.heroValue, { color: lineColor }]}>{formatCurrency(nw)}</Text>
          <Text style={styles.heroChange}>
            {netWorthChange >= 0 ? '+' : ''}{formatCurrency(netWorthChange)} since tracking began
          </Text>

          <View style={styles.heroMetrics}>
            <View style={styles.heroMetric}>
              <Text style={styles.heroMetricLabel}>Weekly Income</Text>
              <Text style={[styles.heroMetricValue, { color: Colors.primary }]}>{formatCurrency(weeklyIncome)}</Text>
            </View>
            <View style={styles.heroMetric}>
              <Text style={styles.heroMetricLabel}>Weekly Expenses</Text>
              <Text style={[styles.heroMetricValue, { color: Colors.negative }]}>{formatCurrency(weeklyExpenses)}</Text>
            </View>
            <View style={styles.heroMetric}>
              <Text style={styles.heroMetricLabel}>Cash</Text>
              <Text style={[styles.heroMetricValue, { color: (gameState.cash ?? 0) >= 0 ? Colors.primary : Colors.negative }]}>
                {formatCurrency(gameState.cash ?? 0)}
              </Text>
            </View>
          </View>
        </GameCard>

        <ScreenTabs
          items={[
            { key: 'overview', label: 'Overview', icon: 'pulse-outline' },
            { key: 'lifetime', label: 'Lifetime', icon: 'trophy-outline' },
          ]}
          activeKey={activeView}
          onChange={setActiveView}
          accentColor={Colors.primary}
        />

        {activeView === 'overview' && (
          <>
        {hasChart && (
          <GameCard variant="subtle" eyebrow="TREND" title={`Net Worth History • ${history.length} weeks`} accentColor={lineColor}>
            <View style={styles.chartPriceRow}>
              <Text style={[styles.chartBigPrice, { color: lineColor }]}>{formatCurrency(nw)}</Text>
              <Text style={[styles.chartChange, { color: lineColor }]}>
                {nw >= firstNW ? '▲' : '▼'} {formatCurrency(Math.abs(netWorthChange))}
              </Text>
            </View>
            <LineChart
              data={{
                labels: history.map((_, i) => {
                  const len = history.length;
                  const weeksAgo = len - 1 - i;
                  if (weeksAgo === 0) return 'Now';
                  if (len <= 10) return `${weeksAgo}w`;
                  const step = len <= 20 ? 5 : 10;
                  return weeksAgo % step === 0 ? `${weeksAgo}w` : '';
                }),
                datasets: [{ data: chartData, color: () => lineColor, strokeWidth: 2 }],
              }}
              width={chartWidth}
              height={190}
              yAxisLabel="€"
              yAxisSuffix=""
              chartConfig={{
                backgroundColor: resolveThemeColor(Colors.elevated) as string,
                backgroundGradientFrom: resolveThemeColor(Colors.elevated) as string,
                backgroundGradientTo: resolveThemeColor(Colors.elevated) as string,
                decimalPlaces: 0,
                color: () => lineColor,
                labelColor: () => resolveThemeColor(Colors.textMuted) as string,
                propsForDots: { r: '2', strokeWidth: '1', stroke: lineColor },
                propsForBackgroundLines: { stroke: resolveThemeColor(Colors.cardBorder) as string },
              }}
              formatYLabel={(val) => {
                const num = parseFloat(val) - offset;
                if (Math.abs(num) >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
                if (Math.abs(num) >= 1000) return `${(num / 1000).toFixed(0)}K`;
                return `${Math.round(num)}`;
              }}
              bezier
              style={styles.chart}
            />
            {minNW < 0 && (
              <Text style={styles.negativeHistory}>Lowest recorded net worth: {formatCurrency(minNW)}</Text>
            )}
          </GameCard>
        )}

        <GameCard variant="subtle" compact>
          <Pressable style={styles.breakdownHeader} onPress={() => setShowCashFlowDetails((value) => !value)}>
            <View style={styles.breakdownHeaderCopy}>
              <Text style={styles.breakdownTitle}>Weekly Cash Flow</Text>
              <Text style={styles.breakdownSubtitle}>
                {formatCurrency(weeklyIncome)} in • {formatCurrency(weeklyExpenses)} out
              </Text>
            </View>
            <StatusPill
              compact
              label={weeklyFlow >= 0 ? `+${formatCurrency(weeklyFlow)}` : formatCurrency(weeklyFlow)}
              color={weeklyFlow >= 0 ? Colors.primary : Colors.negative}
            />
            <Text style={styles.expandIcon}>{showCashFlowDetails ? '−' : '+'}</Text>
          </Pressable>

          {showCashFlowDetails && (
            <View style={styles.breakdownDetails}>
              <Text style={styles.detailSection}>INCOME</Text>
              <Row label="Job income" value={formatCurrency(careerIncome)} tone={careerIncome > 0 ? 'positive' : undefined} />
              {partTimeIncome > 0 && <Row label="Student work" value={formatCurrency(partTimeIncome)} tone="positive" />}
              {partnerContribution > 0 && <Row label="Partner contribution" value={formatCurrency(partnerContribution)} tone="positive" />}

              <Text style={styles.detailSection}>EXPENSES</Text>
              <Row label="Housing rent" value={formatCurrency(expenses.rent)} tone="negative" />
              <Row label="Utilities" value={formatCurrency(expenses.utilityCost)} tone="negative" />
              <Row label="Food" value={formatCurrency(expenses.foodCost)} tone="negative" />
              <Row label="Vehicle" value={formatCurrency(expenses.carCost)} tone="negative" />
              {expenses.courseCost > 0 && <Row label="Education" value={formatCurrency(expenses.courseCost)} tone="negative" />}
              {expenses.loanPayments > 0 && <Row label="Loan payments" value={formatCurrency(expenses.loanPayments)} tone="negative" />}
              {household.householdExtraCost > 0 && <Row label="Partner household costs" value={formatCurrency(household.householdExtraCost)} tone="negative" />}
              {household.familyCost > 0 && <Row label="Children's recurring costs" value={formatCurrency(household.familyCost)} tone="negative" />}
              {household.familySupport > 0 && <Row label="Childcare support applied" value={formatCurrency(household.familySupport)} tone="positive" />}
              {household.obligationCost > 0 && <Row label="Family settlement payments" value={formatCurrency(household.obligationCost)} tone="negative" />}
            </View>
          )}
        </GameCard>

          </>
        )}

        {activeView === 'lifetime' && (
          <>
        <View style={styles.sectionHeading}>
          <Text style={styles.sectionHeadingTitle}>Lifetime Progress</Text>
          <Text style={styles.sectionHeadingSub}>{s?.weeksPlayed ?? 0} weeks played</Text>
        </View>

        <GameCard compact eyebrow="CAREER" title="Work" accentColor={Colors.info}>
          <Row label="Jobs Worked" value={`${s?.jobsWorked ?? 0}`} />
          <Row label="Weeks Employed" value={`${s?.weeksEmployed ?? 0}`} />
          <Row label="Total Salary Earned" value={formatCurrency(s?.totalSalaryEarned ?? 0)} tone="positive" />
          <Row label="Total Taxes Paid" value={formatCurrency(s?.totalTaxesPaid ?? 0)} tone="negative" />
        </GameCard>

        <GameCard compact eyebrow="EDUCATION" title="Learning" accentColor={Colors.education}>
          <Row label="Courses Completed" value={`${s?.coursesCompleted ?? 0}`} />
        </GameCard>

        <GameCard compact eyebrow="MARKETS" title="Investments" accentColor={Colors.info}>
          <Row label="Dividends / Staking" value={formatCurrency(s?.totalDividendsReceived ?? 0)} tone="positive" />
          <Row label="Best Sold Asset" value={`${(s?.highestSoldStockProfitPercent ?? 0).toFixed(1)}%`} tone="positive" />
          <Row label="Lifetime Realized P/L" value={formatCurrency(s?.totalRealizedProfitLoss ?? 0)} amount={s?.totalRealizedProfitLoss ?? 0} />
          <Row label="Units Owned" value={`${totalStocksOwned}`} />
          <Row label="Peak Portfolio Value" value={formatCurrency(s?.highestStockPortfolioValue ?? 0)} tone="positive" />
        </GameCard>

        <GameCard compact eyebrow="LIFETIME" title="Records" accentColor={Colors.primary}>
          <Row label="Total Living Costs" value={formatCurrency(s?.totalLivingCosts ?? 0)} tone="negative" />
          <Row label="Highest Cash" value={formatCurrency(s?.highestCash ?? 0)} />
          <Row label="Highest Net Worth" value={formatCurrency(s?.highestNetWorth ?? 0)} />
        </GameCard>

        <GameCard compact eyebrow="DEBT" title="Loans" accentColor={Colors.warning}>
          <Row label="Loans Taken" value={`${s?.loansTaken ?? 0}`} />
          <Row label="Loans Repaid" value={`${s?.loansRepaid ?? 0}`} />
        </GameCard>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Row({ label, value, amount, tone }: { label: string; value: string; amount?: number; tone?: 'positive' | 'negative' }) {
  const color = tone === 'positive' ? Colors.primary : tone === 'negative' ? Colors.negative
    : typeof amount === 'number' ? (amount > 0 ? Colors.primary : amount < 0 ? Colors.negative : Colors.textPrimary)
    : Colors.textPrimary;
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text style={[styles.value, { color }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 16, paddingBottom: 40 },
  heroValue: { fontSize: 30, lineHeight: 36, fontWeight: '900' },
  heroChange: { color: Colors.textMuted, fontSize: 11, marginTop: 2, marginBottom: 13 },
  heroMetrics: { flexDirection: 'row', gap: 7 },
  heroMetric: { flex: 1, minWidth: 0, backgroundColor: Colors.elevated, borderWidth: 1, borderColor: Colors.cardBorder, borderRadius: 9, paddingHorizontal: 8, paddingVertical: 8 },
  heroMetricLabel: { color: Colors.textMuted, fontSize: 8, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.35 },
  heroMetricValue: { color: Colors.textPrimary, fontSize: 12, fontWeight: '900', marginTop: 3 },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, paddingVertical: 5 },
  label: { flex: 1, color: Colors.textMuted, fontSize: 12 },
  value: { color: Colors.textPrimary, fontWeight: '700', fontSize: 12, textAlign: 'right' },
  chartPriceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 9, marginBottom: 10 },
  chartBigPrice: { fontSize: 21, fontWeight: '800' },
  chartChange: { fontSize: 12, fontWeight: '700' },
  chart: { borderRadius: 10, marginLeft: -10 },
  negativeHistory: { color: Colors.negative, fontSize: 10, marginTop: 5, textAlign: 'center' },
  breakdownHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  breakdownHeaderCopy: { flex: 1, minWidth: 0 },
  breakdownTitle: { color: Colors.textPrimary, fontSize: 13, fontWeight: '800' },
  breakdownSubtitle: { color: Colors.textMuted, fontSize: 10, marginTop: 2 },
  expandIcon: { color: Colors.textMuted, fontSize: 18, fontWeight: '700', width: 18, textAlign: 'center' },
  breakdownDetails: { marginTop: 10, paddingTop: 8, borderTopWidth: 1, borderTopColor: Colors.cardBorder },
  detailSection: { color: Colors.textMuted, fontSize: 9, fontWeight: '900', letterSpacing: 0.8, marginTop: 5, marginBottom: 2 },
  sectionHeading: { marginTop: 4, marginBottom: 9 },
  sectionHeadingTitle: { color: Colors.textPrimary, fontSize: 17, fontWeight: '900' },
  sectionHeadingSub: { color: Colors.textMuted, fontSize: 10, marginTop: 2 },
});
