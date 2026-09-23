import React from 'react';
import { View, Text, StyleSheet, Modal, ScrollView, Pressable } from 'react-native';
import { Colors } from '../theme/colors';
import { formatCurrency } from '../utils/format';
import useGameStore from '../store/gameStore';
import GameButton from './GameButton';
import StatusPill from './StatusPill';

export default function PeriodReportModal() {
  const showPeriodReport = useGameStore((s) => s?.showPeriodReport);
  const periodReport = useGameStore((s) => s?.periodReport);
  const dismissPeriodReport = useGameStore((s) => s?.dismissPeriodReport);

  if (!showPeriodReport || !periodReport) return null;

  const r = periodReport;
  const netFlow = r.totalIncome - r.totalExpenses - r.totalTax;
  const yearNumber = Math.floor(r.toWeek / 20);

  return (
    <Modal visible transparent animationType="slide">
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.sheetHeader}>
            <View>
              <Text style={styles.eyebrow}>YEARLY REPORT</Text>
              <Text style={styles.title}>Year {yearNumber} Summary</Text>
              <Text style={styles.subtitle}>Weeks {r.fromWeek} – {r.toWeek}</Text>
            </View>
            <StatusPill
              compact
              icon={netFlow >= 0 ? 'trending-up-outline' : 'trending-down-outline'}
              label={netFlow >= 0 ? 'Positive year' : 'Negative year'}
              color={netFlow >= 0 ? Colors.primary : Colors.negative}
            />
          </View>

          <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
            <View style={styles.resultHero}>
              <Text style={styles.resultLabel}>NET CASH FLOW</Text>
              <Text style={[styles.resultValue, { color: netFlow >= 0 ? Colors.primary : Colors.negative }]}>
                {netFlow >= 0 ? '+' : ''}{formatCurrency(netFlow)}
              </Text>

              <View style={styles.resultMetrics}>
                <View style={styles.resultMetric}>
                  <Text style={styles.resultMetricLabel}>Income</Text>
                  <Text style={[styles.resultMetricValue, { color: Colors.primary }]}>{formatCurrency(r.totalIncome)}</Text>
                </View>
                <View style={styles.resultMetric}>
                  <Text style={styles.resultMetricLabel}>Expenses</Text>
                  <Text style={[styles.resultMetricValue, { color: Colors.negative }]}>{formatCurrency(r.totalExpenses)}</Text>
                </View>
                <View style={styles.resultMetric}>
                  <Text style={styles.resultMetricLabel}>Tax</Text>
                  <Text style={[styles.resultMetricValue, { color: Colors.warning }]}>{formatCurrency(r.totalTax)}</Text>
                </View>
              </View>
            </View>

            <Text style={styles.sectionLabel}>Investment Performance</Text>

            {/* Investment Performance */}
            <View style={styles.row}>
              <Text style={styles.rowLabel}>Realized P/L</Text>
              <Text style={[styles.rowValue, { color: (r.totalRealizedProfitLoss ?? 0) >= 0 ? Colors.primary : Colors.negative }]}>
                {(r.totalRealizedProfitLoss ?? 0) >= 0 ? '+' : ''}{formatCurrency(r.totalRealizedProfitLoss ?? 0)}
              </Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.rowLabel}>Unrealized P/L</Text>
              <Text style={[styles.rowValue, { color: (r.totalUnrealizedProfitLoss ?? 0) >= 0 ? Colors.primary : Colors.negative }]}>
                {(r.totalUnrealizedProfitLoss ?? 0) >= 0 ? '+' : ''}{formatCurrency(r.totalUnrealizedProfitLoss ?? 0)}
              </Text>
            </View>
            {(r.totalDividends ?? 0) > 0 && (
              <View style={styles.row}>
                <Text style={styles.rowLabel}>Total Dividends</Text>
                <Text style={[styles.rowValue, { color: Colors.primary }]}>+{formatCurrency(r.totalDividends ?? 0)}</Text>
              </View>
            )}

            {/* Career */}
            <Text style={styles.sectionLabel}>Career</Text>
            <Row label="Weeks Employed" value={r.weeksEmployed} count />
            {r.jobChanges > 0 && <Row label="Job Changes" value={r.jobChanges} count />}

            {/* Education */}
            <Text style={styles.sectionLabel}>Education</Text>
            <Row label="Courses Completed" value={r.coursesCompleted} count />

            {/* Investments */}
            <Text style={styles.sectionLabel}>Activity</Text>
            <Row label="Stocks Purchased" value={r.stocksPurchased} count />
            <Row label="Loans Taken" value={r.loansTaken} count />
            <Row label="Loans Repaid" value={r.loansRepaid} count />

            {/* Status */}
            <Text style={styles.sectionLabel}>Current Status</Text>
            <View style={styles.row}>
              <Text style={styles.rowLabel}>Cash</Text>
              <Text style={[styles.rowValue, { color: r.currentCash >= 0 ? Colors.primary : Colors.negative }]}>
                {formatCurrency(r.currentCash)}
              </Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.rowLabel}>Net Worth</Text>
              <Text style={[styles.rowValue, { color: Colors.info }]}>{formatCurrency(r.currentNetWorth)}</Text>
            </View>
            {/* Achievements */}
            {r.achievementsUnlocked > 0 && (
              <>
                <Text style={styles.sectionLabel}>Achievements Unlocked</Text>
                <Row label="New Achievements" value={r.achievementsUnlocked} count />
              </>
            )}
          </ScrollView>

          <GameButton label="Continue" trailingIcon="arrow-forward" onPress={dismissPeriodReport} />
        </View>
      </View>
    </Modal>
  );
}

function Row({ label, value, positive, count }: { label: string; value: number; positive?: boolean; count?: boolean }) {
  if (count) {
    return (
      <View style={styles.row}>
        <Text style={styles.rowLabel}>{label}</Text>
        <Text style={[styles.rowValue, { color: Colors.textPrimary }]}>{value}</Text>
      </View>
    );
  }
  const color = positive ? Colors.primary : Colors.negative;
  const prefix = positive ? '+' : '-';
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={[styles.rowValue, { color }]}>{prefix}{formatCurrency(Math.abs(value))}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: Colors.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: '86%' },
  sheetHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: 12 },
  eyebrow: { color: Colors.info, fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  title: { color: Colors.textPrimary, fontSize: 21, fontWeight: '900', marginTop: 2 },
  subtitle: { color: Colors.textMuted, fontSize: 10, marginTop: 2 },
  resultHero: { backgroundColor: Colors.elevated, borderWidth: 1, borderColor: Colors.cardBorder, borderRadius: 14, padding: 14, marginBottom: 8 },
  resultLabel: { color: Colors.textMuted, fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  resultValue: { fontSize: 28, lineHeight: 34, fontWeight: '900', marginTop: 1, marginBottom: 11 },
  resultMetrics: { flexDirection: 'row', gap: 7 },
  resultMetric: { flex: 1, minWidth: 0, backgroundColor: Colors.card, borderRadius: 9, borderWidth: 1, borderColor: Colors.cardBorder, paddingHorizontal: 8, paddingVertical: 7 },
  resultMetricLabel: { color: Colors.textMuted, fontSize: 8, fontWeight: '800', textTransform: 'uppercase' },
  resultMetricValue: { fontSize: 11, fontWeight: '900', marginTop: 2 },
  scroll: { marginBottom: 16 },
  sectionLabel: { color: Colors.textMuted, fontSize: 9, fontWeight: '900', marginTop: 13, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.8 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5 },
  rowLabel: { color: Colors.textSecondary, fontSize: 14 },
  rowValue: { fontSize: 14, fontWeight: '600' },
  divider: { height: 1, backgroundColor: Colors.cardBorder, marginVertical: 8 },
});
