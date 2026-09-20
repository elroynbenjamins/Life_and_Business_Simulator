import React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Colors, resolveThemeColor } from '../../src/theme/colors';
import GameStatusBar from '../../src/components/StatusBar';
import GameCard from '../../src/components/GameCard';
import useGameStore from '../../src/store/gameStore';
import { useShallow } from 'zustand/react/shallow';
import { formatCurrency } from '../../src/utils/format';
import { getWeeklySalary, getWeeklyRent, getWeeklyUtilityCost, getWeeklyCarCost, getWeeklyFoodCost, getWeeklyCourseCost, getWeeklyLoanPayments } from '../../src/engine/financeEngine';
import { calculatePartnerContribution } from '../../src/engine/relationshipEngine';
import { getCareerSalary } from '../../src/engine/careerEngine';
import { BarChart } from 'react-native-chart-kit';

export default function FinanceScreen() {
  const { width: screenWidth } = useWindowDimensions();
  const router = useRouter();
  const state = useGameStore(useShallow((s) => ({
    cash: s.cash,
    week: s.week,
    year: s.year,
    partTimeJob: s.partTimeJob,
    relationshipModeEnabled: s.relationshipModeEnabled,
    relationshipState: s.relationshipState,
    currentJobId: s.currentJobId,
    currentCourseId: s.currentCourseId,
    currentHousingId: s.currentHousingId,
    currentCarId: s.currentCarId,
    inflationMultiplier: s.inflationMultiplier,
    career: s.career,
    profile: s.profile,
    loans: s.loans,
    bankDeposits: s.bankDeposits,
    stocks: s.stocks,
    holdings: s.holdings,
    businesses: s.businesses,
    properties: s.properties,
    netWorthHistory: s.netWorthHistory,
    totalTaxPaid: s.totalTaxPaid,
    getPortfolioValueTotal: s.getPortfolioValueTotal,
    getNetWorthValue: s.getNetWorthValue,
  }))) as ReturnType<typeof useGameStore.getState>;
  const salary = state.career?.companyId ? getCareerSalary(state.career, state.inflationMultiplier ?? 1, state.profile)
    : state.currentJobId ? getWeeklySalary(state) : state.partTimeJob ? 350 : 0;
  const rent = getWeeklyRent(state);
  const utilityCost = getWeeklyUtilityCost(state);
  const carCost = getWeeklyCarCost(state);
  const foodCost = getWeeklyFoodCost(state);
  const courseCost = getWeeklyCourseCost(state);
  const loanPayments = getWeeklyLoanPayments(state);
  const inflationMultiplier = state?.inflationMultiplier ?? 1;
  const partner = state?.relationshipModeEnabled
    ? (state?.relationshipState?.activeConnections ?? []).find((item) => item.id === state?.relationshipState?.partnerId) ?? null
    : null;
  const household = calculatePartnerContribution(partner, state);
  const relationshipNet = household.contribution - household.householdExtraCost - household.familyCost - household.obligationCost;
  const totalExpenses = rent + utilityCost + carCost + foodCost + courseCost + loanPayments + household.householdExtraCost + household.familyCost + household.obligationCost;
  const netFlow = salary + household.contribution - totalExpenses;
  const portfolioValue = state?.getPortfolioValueTotal?.() ?? 0;
  const netWorth = state?.getNetWorthValue?.() ?? 0;
  const netWorthHistory = state?.netWorthHistory ?? [];
  const totalTaxPaid = state?.totalTaxPaid ?? 0;
  const loanDebt = (state?.loans ?? []).reduce((t, l) => t + (l?.remainingAmount ?? 0), 0);
  const relationshipDebt = (state?.relationshipState?.financialObligations ?? [])
    .reduce((total, obligation) => total + (obligation?.remainingAmount ?? 0), 0);

  const last8 = netWorthHistory.slice(-8);
  const chartWidth = Math.min(screenWidth - 64, 500);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Text style={styles.headerTitle}>Finance</Text>
      <GameStatusBar />
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {/* Inflation indicator */}
        {inflationMultiplier > 1 && (
          <View style={styles.inflationBadge}>
            <Text style={styles.inflationText}>📈 Inflation: ×{inflationMultiplier.toFixed(2)}</Text>
          </View>
        )}

        {/* Weekly Summary */}
        <GameCard title="Weekly Summary">
          <FRow label="Job Income" value={salary} color={Colors.primary} prefix="+" />
          {household.contribution > 0 && <FRow label="Partner Household Contribution" value={household.contribution} color={Colors.primary} prefix="+" />}
          <View style={styles.divider} />
          <FRow label="Rent" value={rent} color={Colors.negative} prefix="-" />
          <FRow label="Utilities" value={utilityCost} color={Colors.negative} prefix="-" />
          <FRow label="Food" value={foodCost} color={Colors.negative} prefix="-" />
          {carCost > 0 && <FRow label="Car" value={carCost} color={Colors.negative} prefix="-" />}
          {courseCost > 0 && <FRow label="Course" value={courseCost} color={Colors.negative} prefix="-" />}
          {loanPayments > 0 && <FRow label="Loan Payments" value={loanPayments} color={Colors.negative} prefix="-" />}
          {household.householdExtraCost > 0 && <FRow label="Additional Household Costs" value={household.householdExtraCost} color={Colors.negative} prefix="-" />}
          {household.familyCost > 0 && <FRow label="Children & Family Costs" value={household.familyCost} color={Colors.negative} prefix="-" />}
          {household.familySupport > 0 && <FRow label="Childcare Support Applied" value={household.familySupport} color={Colors.primary} prefix="+" />}
          {household.obligationCost > 0 && <FRow label="Relationship Legal / Settlement" value={household.obligationCost} color={Colors.negative} prefix="-" />}
          <View style={styles.divider} />
          <View style={styles.row}>
            <Text style={[styles.label, { fontWeight: '600' }]}>Net Cash Flow</Text>
            <Text style={[styles.value, { color: netFlow >= 0 ? Colors.primary : Colors.negative, fontWeight: '700' }]}>
              {netFlow >= 0 ? '+' : ''}{formatCurrency(netFlow)}
            </Text>
          </View>
        </GameCard>

        {partner && (partner.isCohabiting || partner.stage === 'living_together' || partner.stage === 'married') && (
          <GameCard title="Household">
            <View style={styles.row}>
              <Text style={styles.label}>Partner</Text>
              <Text style={styles.value}>{partner.name}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Shared-cost arrangement</Text>
              <Text style={styles.value}>
                {partner.householdSplit === 'proportional' ? 'Proportional' : partner.householdSplit === 'player_pays_most' ? 'You pay most' : '50 / 50'}
              </Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Net household effect</Text>
              <Text style={[styles.value, { color: relationshipNet >= 0 ? Colors.primary : Colors.negative }]}>
                {relationshipNet >= 0 ? '+' : ''}{formatCurrency(relationshipNet)}/wk
              </Text>
            </View>
          </GameCard>
        )}

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
                backgroundColor: resolveThemeColor(Colors.card) as string,
                backgroundGradientFrom: resolveThemeColor(Colors.card) as string,
                backgroundGradientTo: resolveThemeColor(Colors.card) as string,
                decimalPlaces: 0,
                color: (opacity = 1) => `rgba(16, 185, 129, ${opacity})`,
                labelColor: () => resolveThemeColor(Colors.textMuted) as string,
                barPercentage: 0.6,
                propsForBackgroundLines: { stroke: resolveThemeColor(Colors.cardBorder) as string },
              }}
              style={{ borderRadius: 8 }}
            />
          </GameCard>
        ) : null}

        {/* Assets */}
        <GameCard title="Assets & Liabilities">
          <FRow label="Cash" value={state?.cash ?? 0} color={Colors.textPrimary} />
          <FRow label="Stock Portfolio" value={portfolioValue} color={Colors.textPrimary} />
          {loanDebt > 0 && <FRow label="Loan Debt" value={-loanDebt} color={Colors.negative} />}
          {relationshipDebt > 0 && <FRow label="Relationship / Legal Liability" value={-relationshipDebt} color={Colors.negative} />}
          <View style={styles.divider} />
          <View style={styles.row}>
            <Text style={[styles.label, { fontWeight: '700' }]}>Total Net Worth</Text>
            <Text style={[styles.value, { fontWeight: '700', color: Colors.primary }]}>{formatCurrency(netWorth)}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Total Tax Paid</Text>
            <Text style={[styles.value, { color: Colors.textMuted }]}>{formatCurrency(totalTaxPaid)}</Text>
          </View>
          <View style={styles.linkRow}>
            <Pressable style={styles.linkBtn} onPress={() => router.push('/portfolio')}>
              <Text style={styles.linkText}>Portfolio →</Text>
            </Pressable>
            <Pressable style={styles.linkBtn} onPress={() => router.push('/loans')}>
              <Text style={styles.linkText}>Loans →</Text>
            </Pressable>
          </View>
        </GameCard>
      </ScrollView>
    </SafeAreaView>
  );
}

function FRow({ label, value, color, prefix }: { label: string; value: number; color: string; prefix?: string }) {
  const display = prefix ? `${prefix}${formatCurrency(Math.abs(value))}` : formatCurrency(value);
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text style={[styles.value, { color }]}>{display}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  headerTitle: { color: Colors.textPrimary, fontSize: 24, fontWeight: '700', padding: 16, paddingBottom: 0 },
  scroll: { flex: 1 },
  scrollContent: { padding: 16 },
  inflationBadge: { backgroundColor: `${Colors.warning}22`, borderRadius: 8, padding: 8, marginBottom: 8 },
  inflationText: { color: Colors.warning, fontSize: 13, fontWeight: '600', textAlign: 'center' },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  label: { color: Colors.textSecondary, fontSize: 14 },
  value: { color: Colors.textPrimary, fontSize: 14, fontWeight: '600' },
  divider: { height: 1, backgroundColor: Colors.cardBorder, marginVertical: 4 },
  linkRow: { flexDirection: 'row', gap: 16, marginTop: 12, justifyContent: 'center' },
  linkBtn: {},
  linkText: { color: Colors.primary, fontSize: 14, fontWeight: '600' },
});
