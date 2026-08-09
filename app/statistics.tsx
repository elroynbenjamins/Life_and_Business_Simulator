import React from 'react';
import { ScrollView, View, Text, StyleSheet, Pressable, SafeAreaView, Dimensions } from 'react-native';
import { router } from 'expo-router';
import { LineChart } from 'react-native-chart-kit';
import useGameStore from '../src/store/gameStore';
import { Colors } from '../src/theme/colors';
import GameCard from '../src/components/GameCard';
import { formatCurrency } from '../src/utils/format';

export default function StatisticsScreen({ showBack = true }: { showBack?: boolean } = {}) {
  const s = useGameStore((st: any) => st.statistics);
  const netWorthHistory = useGameStore((st: any) => st.netWorthHistory);
  const week = useGameStore((st: any) => st.week);
  const year = useGameStore((st: any) => st.year);
  const age = useGameStore((st: any) => st.age);
  const nw = (netWorthHistory ?? []).slice(-1)[0] ?? 0;
  const chartWidth = Math.min(Dimensions.get('window').width - 64, 500);
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
                backgroundColor: Colors.card,
                backgroundGradientFrom: Colors.card,
                backgroundGradientTo: Colors.card,
                decimalPlaces: 0,
                color: () => lineColor,
                labelColor: () => Colors.textMuted,
                propsForDots: { r: '3', strokeWidth: '1', stroke: lineColor },
                propsForBackgroundLines: { stroke: Colors.cardBorder },
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
          <Row label="Weeks Unemployed" value={`${s?.weeksUnemployed ?? 0}`} />
          <Row label="Total Salary Earned" value={formatCurrency(s?.totalSalaryEarned ?? 0)} />
          <Row label="Total Taxes Paid" value={formatCurrency(s?.totalTaxesPaid ?? 0)} />
        </GameCard>

        <GameCard title="Education">
          <Row label="Courses Completed" value={`${s?.coursesCompleted ?? 0}`} />
        </GameCard>

        <GameCard title="Investing">
          <Row label="Stocks Purchased" value={`${s?.stocksPurchased ?? 0}`} />
          <Row label="Largest Stock Gain" value={formatCurrency(s?.largestStockGain ?? 0)} />
          <Row label="Largest Stock Loss" value={formatCurrency(Math.abs(s?.largestStockLoss ?? 0))} />
          <Row label="Total Dividends" value={formatCurrency(s?.totalDividendsReceived ?? 0)} />
          <Row label="Realized P/L" value={formatCurrency(s?.totalRealizedProfitLoss ?? 0)} />
        </GameCard>

        <GameCard title="Living">
          <Row label="Total Living Costs" value={formatCurrency(s?.totalLivingCosts ?? 0)} />
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

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
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
});
