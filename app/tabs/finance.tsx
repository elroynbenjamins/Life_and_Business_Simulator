import React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Colors } from '../../src/theme/colors';
import GameStatusBar from '../../src/components/StatusBar';
import GameCard from '../../src/components/GameCard';
import useGameStore from '../../src/store/gameStore';
import { formatCurrency } from '../../src/utils/format';
import { getWeeklySalary, getWeeklyRent } from '../../src/engine/financeEngine';
import { BarChart } from 'react-native-chart-kit';

export default function FinanceScreen() {
  const router = useRouter();
  const state = useGameStore();
  const salary = getWeeklySalary(state);
  const rent = getWeeklyRent(state);
  const netFlow = salary - rent;
  const portfolioValue = state?.getPortfolioValueTotal?.() ?? 0;
  const netWorth = state?.getNetWorthValue?.() ?? 0;
  const netWorthHistory = state?.netWorthHistory ?? [];

  const last8 = netWorthHistory.slice(-8);
  const chartWidth = Math.min(Dimensions.get('window').width - 64, 500);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Text style={styles.headerTitle}>Finance</Text>
      <GameStatusBar />
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {/* Weekly Summary */}
        <GameCard title="Weekly Summary">
          <View style={styles.row}>
            <Text style={styles.label}>Job Income</Text>
            <Text style={[styles.value, { color: Colors.primary }]}>
              +{formatCurrency(salary)}
            </Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Rent</Text>
            <Text style={[styles.value, { color: Colors.negative }]}>
              -{formatCurrency(rent)}
            </Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.row}>
            <Text style={[styles.label, { fontWeight: '600' }]}>Net Cash Flow</Text>
            <Text style={[styles.value, { color: netFlow >= 0 ? Colors.primary : Colors.negative, fontWeight: '700' }]}>
              {netFlow >= 0 ? '+' : ''}{formatCurrency(netFlow)}
            </Text>
          </View>
        </GameCard>

        {/* Net Worth Chart */}
        {(last8?.length ?? 0) > 1 ? (
          <GameCard title="Net Worth History">
            <BarChart
              data={{
                labels: last8.map((_, i) => `W${(netWorthHistory?.length ?? 0) - (last8?.length ?? 0) + i + 1}`),
                datasets: [{ data: last8.map((v) => Math.max(0, v ?? 0)) }],
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
                color: (opacity = 1) => `rgba(16, 185, 129, ${opacity})`,
                labelColor: () => Colors.textMuted,
                barPercentage: 0.6,
                propsForBackgroundLines: { stroke: Colors.cardBorder },
              }}
              style={{ borderRadius: 8 }}
            />
          </GameCard>
        ) : null}

        {/* Assets Breakdown */}
        <GameCard title="Assets Breakdown">
          <View style={styles.row}>
            <Text style={styles.label}>Cash</Text>
            <Text style={styles.value}>{formatCurrency(state?.cash ?? 0)}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Stock Portfolio</Text>
            <Text style={styles.value}>{formatCurrency(portfolioValue)}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.row}>
            <Text style={[styles.label, { fontWeight: '700' }]}>Total Net Worth</Text>
            <Text style={[styles.value, { fontWeight: '700', color: Colors.primary }]}>
              {formatCurrency(netWorth)}
            </Text>
          </View>
          <Pressable style={styles.linkBtn} onPress={() => router.push('/portfolio')}>
            <Text style={styles.linkText}>View Portfolio →</Text>
          </Pressable>
        </GameCard>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  headerTitle: { color: Colors.textPrimary, fontSize: 24, fontWeight: '700', padding: 16, paddingBottom: 0 },
  scroll: { flex: 1 },
  scrollContent: { padding: 16 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  label: { color: Colors.textSecondary, fontSize: 15 },
  value: { color: Colors.textPrimary, fontSize: 15, fontWeight: '600' },
  divider: {
    height: 1,
    backgroundColor: Colors.cardBorder,
    marginVertical: 4,
  },
  linkBtn: { marginTop: 12, alignItems: 'center' },
  linkText: { color: Colors.primary, fontSize: 14, fontWeight: '600' },
});
