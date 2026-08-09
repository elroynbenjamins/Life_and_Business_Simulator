import React from 'react';
import { View, Text, StyleSheet, Modal, ScrollView, Pressable } from 'react-native';
import { Colors } from '../theme/colors';
import { formatCurrency } from '../utils/format';
import useGameStore from '../store/gameStore';

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
          <Text style={styles.title}>📊 Year {yearNumber} Summary</Text>
          <Text style={styles.subtitle}>Weeks {r.fromWeek} – {r.toWeek} • Yearly Report + Tax</Text>
          <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>

            {/* Financial Overview */}
            <Text style={styles.sectionLabel}>Financial Overview</Text>
            <Row label="Total Income" value={r.totalIncome} positive />
            <Row label="Total Expenses" value={r.totalExpenses} />
            <Row label="Tax Paid" value={r.totalTax} />
            <View style={styles.divider} />
            <View style={styles.row}>
              <Text style={[styles.rowLabel, { fontWeight: '700' }]}>Net Cash Flow</Text>
              <Text style={[styles.rowValue, { color: netFlow >= 0 ? Colors.primary : Colors.negative, fontWeight: '700' }]}>
                {netFlow >= 0 ? '+' : ''}{formatCurrency(netFlow)}
              </Text>
            </View>

            {/* Investment Performance */}
            <Text style={styles.sectionLabel}>Investment Performance</Text>
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
            <Row label="Weeks Unemployed" value={r.weeksUnemployed} count />
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

          <Pressable style={styles.button} onPress={dismissPeriodReport}>
            <Text style={styles.buttonText}>Continue</Text>
          </Pressable>
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
  sheet: { backgroundColor: Colors.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, maxHeight: '85%' },
  title: { color: Colors.textPrimary, fontSize: 22, fontWeight: '700' },
  subtitle: { color: Colors.textMuted, fontSize: 14, marginBottom: 12, marginTop: 4 },
  scroll: { marginBottom: 16 },
  sectionLabel: { color: Colors.textSecondary, fontSize: 13, fontWeight: '600', marginTop: 14, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 1 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5 },
  rowLabel: { color: Colors.textSecondary, fontSize: 14 },
  rowValue: { fontSize: 14, fontWeight: '600' },
  divider: { height: 1, backgroundColor: Colors.cardBorder, marginVertical: 8 },
  button: { backgroundColor: Colors.primary, borderRadius: 12, padding: 16, alignItems: 'center' },
  buttonText: { color: Colors.white, fontSize: 16, fontWeight: '700' },
});
