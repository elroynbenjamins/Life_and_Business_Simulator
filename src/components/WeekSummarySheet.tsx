import React from 'react';
import { View, Text, StyleSheet, Modal, ScrollView, Pressable } from 'react-native';
import { Colors } from '../theme/colors';
import { formatCurrency, formatPercent } from '../utils/format';
import useGameStore from '../store/gameStore';
import achievementsData from '../data/achievements.json';

export default function WeekSummarySheet() {
  const showSummary = useGameStore((s) => s?.showSummary);
  const summary = useGameStore((s) => s?.lastSummary);
  const dismissSummary = useGameStore((s) => s?.dismissSummary);

  if (!showSummary || !summary) return null;

  const topGainer = [...(summary?.stockChanges ?? [])].sort((a, b) => (b?.change ?? 0) - (a?.change ?? 0))?.[0];
  const topLoser = [...(summary?.stockChanges ?? [])].sort((a, b) => (a?.change ?? 0) - (b?.change ?? 0))?.[0];
  const totalExpenses = (summary?.rentPaid ?? 0) + (summary?.foodCost ?? 0) + (summary?.carCost ?? 0) + (summary?.courseCost ?? 0) + (summary?.loanPayments ?? 0);
  const netFlow = (summary?.salaryEarned ?? 0) - totalExpenses - (summary?.taxAmount ?? 0);

  return (
    <Modal visible transparent animationType="slide">
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <Text style={styles.title}>Week {summary?.newWeek ?? 0} Summary</Text>
          <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
            <Text style={styles.headline}>"{summary?.headline ?? ''}"</Text>

            {/* Income */}
            <Text style={styles.sectionLabel}>Income</Text>
            <Row label="Salary" value={summary?.salaryEarned ?? 0} positive />

            {/* Expenses */}
            <Text style={styles.sectionLabel}>Expenses</Text>
            <Row label="Rent" value={summary?.rentPaid ?? 0} />
            <Row label="Food" value={summary?.foodCost ?? 0} />
            {(summary?.carCost ?? 0) > 0 && <Row label="Car" value={summary?.carCost ?? 0} />}
            {(summary?.courseCost ?? 0) > 0 && <Row label="Course" value={summary?.courseCost ?? 0} />}
            {(summary?.loanPayments ?? 0) > 0 && <Row label="Loan Payments" value={summary?.loanPayments ?? 0} />}

            {/* Tax */}
            {summary?.isTaxWeek && (
              <>
                <Text style={styles.sectionLabel}>Tax Assessment (20 Weeks)</Text>
                <View style={styles.taxBox}>
                  <Row label="Total Earnings" value={summary?.earningsForTaxPeriod ?? 0} positive neutral />
                  <Row label="Tax Owed" value={summary?.taxAmount ?? 0} />
                </View>
              </>
            )}

            {/* Net Flow */}
            <View style={styles.divider} />
            <View style={styles.row}>
              <Text style={[styles.rowLabel, { fontWeight: '700' }]}>Net Cash Flow</Text>
              <Text style={[styles.rowValue, { color: netFlow >= 0 ? Colors.primary : Colors.negative, fontWeight: '700' }]}>
                {netFlow >= 0 ? '+' : ''}{formatCurrency(netFlow)}
              </Text>
            </View>

            {/* Happiness */}
            <View style={styles.row}>
              <Text style={styles.rowLabel}>Happiness</Text>
              <Text style={[styles.rowValue, { color: Colors.happiness }]}>{summary?.happiness ?? 0}/100</Text>
            </View>

            {summary?.courseProgress ? (
              <View style={styles.row}>
                <Text style={styles.rowLabel}>Course</Text>
                <Text style={[styles.rowValue, { color: Colors.info }]}>{summary.courseProgress}</Text>
              </View>
            ) : null}

            {topGainer && (topGainer?.change ?? 0) > 0 ? (
              <View style={styles.row}>
                <Text style={styles.rowLabel}>Top Gainer</Text>
                <Text style={[styles.rowValue, { color: Colors.primary }]}>{topGainer?.ticker} {formatPercent(topGainer?.change)}</Text>
              </View>
            ) : null}

            {topLoser && (topLoser?.change ?? 0) < 0 ? (
              <View style={styles.row}>
                <Text style={styles.rowLabel}>Top Loser</Text>
                <Text style={[styles.rowValue, { color: Colors.negative }]}>{topLoser?.ticker} {formatPercent(topLoser?.change)}</Text>
              </View>
            ) : null}

            {/* New Achievements */}
            {(summary?.newAchievements?.length ?? 0) > 0 && (
              <>
                <Text style={styles.sectionLabel}>New Achievements!</Text>
                {(summary?.newAchievements ?? []).map((id) => {
                  const ach = (achievementsData ?? []).find((a) => a?.id === id);
                  return (
                    <View key={id} style={styles.achievementRow}>
                      <Text style={styles.achievementName}>{ach?.name ?? id}</Text>
                      <Text style={styles.achievementXp}>+{ach?.xpReward ?? 0} XP</Text>
                    </View>
                  );
                })}
              </>
            )}
          </ScrollView>

          <Pressable style={styles.button} onPress={dismissSummary}>
            <Text style={styles.buttonText}>Continue</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function Row({ label, value, positive, neutral }: { label: string; value: number; positive?: boolean; neutral?: boolean }) {
  const color = neutral ? Colors.textPrimary : positive ? Colors.primary : Colors.negative;
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
  sheet: { backgroundColor: Colors.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, maxHeight: '80%' },
  title: { color: Colors.textPrimary, fontSize: 22, fontWeight: '700', marginBottom: 12 },
  scroll: { marginBottom: 16 },
  headline: { color: Colors.warning, fontSize: 14, fontStyle: 'italic', marginBottom: 12 },
  sectionLabel: { color: Colors.textSecondary, fontSize: 13, fontWeight: '600', marginTop: 12, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 1 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5 },
  rowLabel: { color: Colors.textSecondary, fontSize: 14 },
  rowValue: { fontSize: 14, fontWeight: '600' },
  divider: { height: 1, backgroundColor: Colors.cardBorder, marginVertical: 8 },
  taxBox: { backgroundColor: Colors.elevated, borderRadius: 8, padding: 8, marginTop: 4 },
  achievementRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4, backgroundColor: `${Colors.warning}22`, borderRadius: 6, paddingHorizontal: 8, marginTop: 4 },
  achievementName: { color: Colors.warning, fontSize: 14, fontWeight: '600' },
  achievementXp: { color: Colors.warning, fontSize: 13 },
  button: { backgroundColor: Colors.primary, borderRadius: 12, padding: 16, alignItems: 'center' },
  buttonText: { color: Colors.white, fontSize: 16, fontWeight: '700' },
});
