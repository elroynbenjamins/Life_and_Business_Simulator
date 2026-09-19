import React from 'react';
import { ScrollView, View, Text, StyleSheet, Pressable, SafeAreaView, useWindowDimensions } from 'react-native';
import { router } from 'expo-router';
import { LineChart } from 'react-native-chart-kit';
import useGameStore from '../src/store/gameStore';
import { useShallow } from 'zustand/react/shallow';
import { Colors, resolveThemeColor } from '../src/theme/colors';
import GameCard from '../src/components/GameCard';
import { formatCurrency } from '../src/utils/format';
import { getWeeklySalary, processExpenses } from '../src/engine/financeEngine';
import { getCareerSalary } from '../src/engine/careerEngine';

export default function StatisticsScreen({ showBack = true }: { showBack?: boolean } = {}) {
  const { width: screenWidth } = useWindowDimensions();
  const s = useGameStore((st: any) => st.statistics);
  const netWorthHistory = useGameStore((st: any) => st.netWorthHistory);
  const week = useGameStore((st: any) => st.week);
  const year = useGameStore((st: any) => st.year);
  const age = useGameStore((st: any) => st.age);
  const gameState = useGameStore(useShallow((st) => ({
    currentJobId: st.currentJobId,
    currentCourseId: st.currentCourseId,
    currentHousingId: st.currentHousingId,
    currentCarId: st.currentCarId,
    inflationMultiplier: st.inflationMultiplier,
    career: st.career,
    profile: st.profile,
    loans: st.loans,
    partTimeJob: st.partTimeJob,
    holdings: st.holdings,
  }))) as ReturnType<typeof useGameStore.getState>;
  const expenses = processExpenses(gameState);
  const careerIncome = gameState.career?.companyId
    ? getCareerSalary(gameState.career, gameState.inflationMultiplier ?? 1, gameState.profile)
    : getWeeklySalary(gameState);
  const partTimeIncome = !gameState.career?.companyId && !gameState.currentJobId && gameState.partTimeJob ? 350 : 0;
  const totalStocksOwned = (gameState.holdings ?? []).reduce((total, holding) => total + (holding.shares ?? 0), 0);
  const weeklyIncome = careerIncome + partTimeIncome;
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

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        {showBack && <Pressable onPress={() => router.back()} style={styles.back}><Text style={styles.backText}>← Back</Text></Pressable>}
        <Text style={styles.title}>Life Statistics</Text>
      </View>
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <GameCard title="Weekly Income & Expenses">
          <Row label="Job income" value={formatCurrency(careerIncome)} tone={careerIncome > 0 ? 'positive' : undefined} />
          {partTimeIncome > 0 && <Row label="Part-time income" value={formatCurrency(partTimeIncome)} tone="positive" />}
          <View style={styles.sectionDivider} />
          <Row label="Housing rent" value={formatCurrency(expenses.rent)} tone="negative" />
          <Row label="Utilities" value={formatCurrency(expenses.utilityCost)} tone="negative" />
          <Row label="Food" value={formatCurrency(expenses.foodCost)} tone="negative" />
          <Row label="Vehicle" value={formatCurrency(expenses.carCost)} tone="negative" />
          {expenses.courseCost > 0 && <Row label="Education" value={formatCurrency(expenses.courseCost)} tone="negative" />}
          {expenses.loanPayments > 0 && <Row label="Loan payments" value={formatCurrency(expenses.loanPayments)} tone="negative" />}
          <View style={styles.sectionDivider} />
          <Row label="Total weekly income" value={formatCurrency(weeklyIncome)} tone="positive" />
          <Row label="Total weekly expenses" value={formatCurrency(expenses.totalExpenses)} tone="negative" />
          <Row label="Weekly cash flow" value={formatCurrency(weeklyIncome - expenses.totalExpenses)} amount={weeklyIncome - expenses.totalExpenses} />
        </GameCard>

        <GameCard title="Current Life">
          <Row label="Age" value={`${age}`} />
          <Row label="Year / Week" value={`Y${year} W${week}`} />
          <Row label="Weeks Played" value={`${s?.weeksPlayed ?? 0}`} />
          <Row label="Current Net Worth" value={formatCurrency(nw)} />
        </GameCard>

        {/* Net Worth Chart */}
        {hasChart && (
          <GameCard title={`Net Worth History (${history.length} Weeks)`}>
            <View style={styles.chartPriceRow}>
              <Text style={[styles.chartBigPrice, { color: lineColor }]}>{formatCurrency(nw)}</Text>
              <Text style={[styles.chartChange, { color: lineColor }]}>
                {nw >= firstNW ? '▲' : '▼'} {formatCurrency(Math.abs(nw - firstNW))}
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
              height={200}
              yAxisLabel="€"
              yAxisSuffix=""
              chartConfig={{
                backgroundColor: resolveThemeColor(Colors.card) as string,
                backgroundGradientFrom: resolveThemeColor(Colors.card) as string,
                backgroundGradientTo: resolveThemeColor(Colors.card) as string,
                decimalPlaces: 0,
                color: () => lineColor,
                labelColor: () => resolveThemeColor(Colors.textMuted) as string,
                propsForDots: { r: '3', strokeWidth: '1', stroke: lineColor },
                propsForBackgroundLines: { stroke: resolveThemeColor(Colors.cardBorder) as string },
              }}
              formatYLabel={(val) => {
                const num = parseFloat(val) - offset;
                if (Math.abs(num) >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
                if (Math.abs(num) >= 1000) return `${(num / 1000).toFixed(0)}K`;
                return `${Math.round(num)}`;
              }}
              bezier
              style={{ borderRadius: 8 }}
            />
            {minNW < 0 && (
              <Text style={{ color: Colors.negative, fontSize: 11, marginTop: 4, textAlign: 'center' }}>
                ⚠ Net worth went negative (lowest: {formatCurrency(minNW)})
              </Text>
            )}
          </GameCard>
        )}

        <GameCard title="Career">
          <Row label="Jobs Worked" value={`${s?.jobsWorked ?? 0}`} />
          <Row label="Weeks Employed" value={`${s?.weeksEmployed ?? 0}`} />
          <Row label="Total Salary Earned" value={formatCurrency(s?.totalSalaryEarned ?? 0)} tone="positive" />
          <Row label="Total Taxes Paid" value={formatCurrency(s?.totalTaxesPaid ?? 0)} tone="negative" />
        </GameCard>

        <GameCard title="Education">
          <Row label="Courses Completed" value={`${s?.coursesCompleted ?? 0}`} />
        </GameCard>

        <GameCard title="Stocks">
          <Row label="Total Dividends Received" value={formatCurrency(s?.totalDividendsReceived ?? 0)} tone="positive" />
          <Row label="Highest Profit on a Sold Stock" value={`${(s?.highestSoldStockProfitPercent ?? 0).toFixed(1)}%`} tone="positive" />
          <Row label="Lifetime Realized Profit / Loss" value={formatCurrency(s?.totalRealizedProfitLoss ?? 0)} amount={s?.totalRealizedProfitLoss ?? 0} />
          <Row label="Total Stocks Owned" value={`${totalStocksOwned} shares`} />
          <Row label="Highest Stock Portfolio Value" value={formatCurrency(s?.highestStockPortfolioValue ?? 0)} tone="positive" />
        </GameCard>

        <GameCard title="Living">
          <Row label="Total Living Costs" value={formatCurrency(s?.totalLivingCosts ?? 0)} tone="negative" />
          <Row label="Highest Cash" value={formatCurrency(s?.highestCash ?? 0)} />
          <Row label="Highest Net Worth" value={formatCurrency(s?.highestNetWorth ?? 0)} />
        </GameCard>

        <GameCard title="Loans">
          <Row label="Loans Taken" value={`${s?.loansTaken ?? 0}`} />
          <Row label="Loans Repaid" value={`${s?.loansRepaid ?? 0}`} />
        </GameCard>
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
  header: { flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: Colors.cardBorder },
  back: { marginRight: 12 },
  backText: { color: Colors.primary, fontSize: 16 },
  title: { fontSize: 20, fontWeight: '700', color: Colors.textPrimary },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  label: { color: Colors.textMuted, fontSize: 14 },
  value: { color: Colors.textPrimary, fontWeight: '600', fontSize: 14 },
  chartPriceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 10, marginBottom: 12 },
  chartBigPrice: { fontSize: 24, fontWeight: '700' },
  chartChange: { fontSize: 14, fontWeight: '600' },
  sectionDivider: { height: 1, backgroundColor: Colors.cardBorder, marginVertical: 6 },
});
