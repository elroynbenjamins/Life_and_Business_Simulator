import React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../src/theme/colors';
import GameStatusBar from '../src/components/StatusBar';
import GameCard from '../src/components/GameCard';
import ProgressBar from '../src/components/ProgressBar';
import useGameStore from '../src/store/gameStore';
import { formatCurrency } from '../src/utils/format';
import loansData from '../src/data/loans.json';

export default function LoansScreen() {
  const router = useRouter();
  const loans = useGameStore((s) => s?.loans ?? []);
  const cash = useGameStore((s) => s?.cash ?? 0);
  const takeLoan = useGameStore((s) => s?.takeLoan);
  const payOffLoan = useGameStore((s) => s?.payOffLoan);

  const totalDebt = loans.reduce((t, l) => t + (l?.remainingAmount ?? 0), 0);
  const totalWeeklyPayments = loans.reduce((t, l) => t + (l?.weeklyPayment ?? 0), 0);

  const handleTakeLoan = (template: (typeof loansData)[0]) => {
    const totalRepayment = (template?.amount ?? 0) * (1 + (template?.interestRate ?? 0));
    const weeklyPayment = Math.ceil(totalRepayment / (template?.durationWeeks ?? 1));
    Alert.alert(
      'Take Loan',
      `Borrow ${formatCurrency(template?.amount)}?\n\nInterest: ${((template?.interestRate ?? 0) * 100).toFixed(0)}%\nDuration: ${template?.durationWeeks} weeks\nWeekly payment: ${formatCurrency(weeklyPayment)}\nTotal repayment: ${formatCurrency(Math.round(totalRepayment))}`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Borrow', onPress: () => takeLoan?.(template?.id) },
      ]
    );
  };

  const handlePayOff = (loan: (typeof loans)[0]) => {
    Alert.alert(
      'Pay Off Loan',
      `Pay off ${loan?.name} early? Remaining: ${formatCurrency(loan?.remainingAmount)}`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Pay Off', onPress: () => payOffLoan?.(loan?.loanId) },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>Loans</Text>
      </View>
      <GameStatusBar />
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {/* Summary */}
        <GameCard>
          <View style={styles.summaryRow}>
            <View>
              <Text style={styles.sumLabel}>Total Debt</Text>
              <Text style={[styles.sumValue, { color: totalDebt > 0 ? Colors.negative : Colors.primary }]}>
                {formatCurrency(totalDebt)}
              </Text>
            </View>
            <View>
              <Text style={styles.sumLabel}>Weekly Payments</Text>
              <Text style={[styles.sumValue, { color: Colors.negative }]}>{formatCurrency(totalWeeklyPayments)}</Text>
            </View>
          </View>
          <Text style={styles.loanCount}>{loans.length}/3 loan slots used</Text>
        </GameCard>

        {/* Active Loans */}
        {loans.length > 0 && <Text style={styles.sectionHeader}>Active Loans</Text>}
        {loans.map((loan, i) => {
          const template = (loansData ?? []).find((l) => l?.id === loan?.loanId);
          const totalDuration = template?.durationWeeks ?? 1;
          const progress = 1 - ((loan?.weeksRemaining ?? 0) / totalDuration);
          const canPayOff = cash >= (loan?.remainingAmount ?? 0);
          return (
            <GameCard key={`${loan?.loanId}-${i}`}>
              <Text style={styles.loanName}>{loan?.name}</Text>
              <View style={styles.loanRow}>
                <Text style={styles.loanMeta}>Remaining: {formatCurrency(loan?.remainingAmount)}</Text>
                <Text style={styles.loanMeta}>{loan?.weeksRemaining} weeks left</Text>
              </View>
              <Text style={styles.loanMeta}>Weekly payment: {formatCurrency(loan?.weeklyPayment)}</Text>
              <ProgressBar progress={progress} color={Colors.info} />
              {canPayOff && (
                <Pressable style={styles.payOffBtn} onPress={() => handlePayOff(loan)}>
                  <Text style={styles.payOffText}>Pay Off Early — {formatCurrency(loan?.remainingAmount)}</Text>
                </Pressable>
              )}
            </GameCard>
          );
        })}

        {/* Available Loans */}
        <Text style={styles.sectionHeader}>Available Loans</Text>
        {(loansData ?? []).map((template) => {
          const alreadyHas = loans.some((l) => l?.loanId === template?.id);
          const slotsFull = loans.length >= 3;
          const available = !alreadyHas && !slotsFull;
          return (
            <GameCard key={template?.id}>
              <Text style={styles.loanName}>{template?.name}</Text>
              <View style={styles.loanRow}>
                <Text style={styles.loanMeta}>Amount: {formatCurrency(template?.amount)}</Text>
                <Text style={styles.loanMeta}>Interest: {((template?.interestRate ?? 0) * 100).toFixed(0)}%</Text>
              </View>
              <Text style={styles.loanMeta}>Duration: {template?.durationWeeks} weeks</Text>
              {available ? (
                <Pressable style={[styles.actionBtn, { borderColor: Colors.primary }]} onPress={() => handleTakeLoan(template)}>
                  <Text style={[styles.actionText, { color: Colors.primary }]}>Borrow {formatCurrency(template?.amount)}</Text>
                </Pressable>
              ) : (
                <Text style={styles.unavailable}>{alreadyHas ? 'Already active' : 'Max 3 loans'}</Text>
              )}
            </GameCard>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12 },
  headerTitle: { color: Colors.textPrimary, fontSize: 20, fontWeight: '700' },
  scroll: { flex: 1 },
  scrollContent: { padding: 16 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between' },
  sumLabel: { color: Colors.textSecondary, fontSize: 13 },
  sumValue: { fontSize: 22, fontWeight: '700', marginTop: 4 },
  loanCount: { color: Colors.textMuted, fontSize: 12, marginTop: 8 },
  sectionHeader: { color: Colors.textSecondary, fontSize: 16, fontWeight: '600', marginTop: 16, marginBottom: 8 },
  loanName: { color: Colors.textPrimary, fontSize: 16, fontWeight: '700', marginBottom: 4 },
  loanRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  loanMeta: { color: Colors.textMuted, fontSize: 13, marginBottom: 4 },
  payOffBtn: { backgroundColor: Colors.primary, borderRadius: 8, paddingVertical: 10, alignItems: 'center', marginTop: 8 },
  payOffText: { color: Colors.white, fontWeight: '600', fontSize: 14 },
  actionBtn: { borderWidth: 1, borderRadius: 8, paddingVertical: 10, alignItems: 'center', marginTop: 8 },
  actionText: { fontWeight: '600', fontSize: 14 },
  unavailable: { color: Colors.textMuted, fontSize: 12, marginTop: 8, fontStyle: 'italic' },
});
