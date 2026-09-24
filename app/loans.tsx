import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../src/theme/colors';
import ScreenHeader from '../src/components/ScreenHeader';
import GameCard from '../src/components/GameCard';
import StatusPill from '../src/components/StatusPill';
import ProgressBar from '../src/components/ProgressBar';
import useGameStore from '../src/store/gameStore';
import { useShallow } from 'zustand/react/shallow';
import { formatCurrency } from '../src/utils/format';
import { getNetWorth } from '../src/engine/financeEngine';
import loansData from '../src/data/loans.json';
import { showGameDialog } from '../src/components/GameDialog';
import { getPrestigeEffects } from '../src/engine/prestigeEngine';
import { getEconomicCycleEffects } from '../src/engine/economyEngine';

export default function LoansScreen() {
  const router = useRouter();
  const loans = useGameStore((s) => s?.loans ?? []);
  const cash = useGameStore((s) => s?.cash ?? 0);
  const currentJobId = useGameStore((s) => s?.currentJobId);
  const career = useGameStore((s) => s?.career);
  const takeLoan = useGameStore((s) => s?.takeLoan);
  const payOffLoan = useGameStore((s) => s?.payOffLoan);
  const bankDeposits = useGameStore((s) => s?.bankDeposits ?? []);
  const openBankDeposit = useGameStore((s) => s.openBankDeposit);
  const [activeTab, setActiveTab] = useState<'loans' | 'deposits'>('loans');
  const [depositAmount, setDepositAmount] = useState('');
  const [depositTerm, setDepositTerm] = useState<20 | 40 | 60>(20);
  const hasJob = !!(currentJobId || career?.companyId);
  const state = useGameStore(useShallow((s) => ({
    cash: s.cash,
    stocks: s.stocks,
    holdings: s.holdings,
    loans: s.loans,
    bankDeposits: s.bankDeposits,
    businesses: s.businesses,
    properties: s.properties,
    economicCycle: s.economicCycle,
    profile: s.profile,
  }))) as ReturnType<typeof useGameStore.getState>;
  const netWorth = getNetWorth(state);
  const prestigeEffects = getPrestigeEffects(state.profile);
  const loanRateReduction = prestigeEffects.loan_rate_reduction ?? 0;
  const depositInterestBonus = prestigeEffects.bank_deposit_interest_bonus ?? 0;
  const macroRateModifier = getEconomicCycleEffects(state.economicCycle?.phase ?? 'expansion').interestRateModifier;

  const totalDebt = loans.reduce((t, l) => t + (l?.remainingAmount ?? 0), 0);
  const totalWeeklyPayments = loans.reduce((t, l) => t + (l?.weeklyPayment ?? 0), 0);

  const handleTakeLoan = (template: (typeof loansData)[0]) => {
    const effectiveRate = Math.max(0, (template?.interestRate ?? 0) + macroRateModifier - loanRateReduction);
    const totalRepayment = (template?.amount ?? 0) * (1 + effectiveRate);
    const weeklyPayment = Math.ceil(totalRepayment / (template?.durationWeeks ?? 1));
    showGameDialog({ title: 'Take Loan', message: `Borrow ${formatCurrency(template?.amount)}?\n\nInterest: ${(effectiveRate * 100).toFixed(1)}%${loanRateReduction > 0 ? ` (Prestige reduced by ${(loanRateReduction * 100).toFixed(0)}%)` : ''}\nDuration: ${template?.durationWeeks} weeks\nWeekly payment: ${formatCurrency(weeklyPayment)}\nTotal repayment: ${formatCurrency(Math.round(totalRepayment))}`, confirmText: 'Borrow', onConfirm: () => takeLoan?.(template?.id) });
  };

  const handlePayOff = (loan: (typeof loans)[0]) => {
    showGameDialog({ title: 'Pay Off Loan', message: `Pay off ${loan?.name} early? Remaining: ${formatCurrency(loan?.remainingAmount)}`, confirmText: 'Pay Off', onConfirm: () => payOffLoan?.(loan?.loanId) });
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScreenHeader
        title="Bank"
        subtitle="Loans, repayments and fixed-term deposits"
        showBack
        onBack={() => router.back()}
        accentColor={Colors.info}
      />
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <View style={styles.tabs}>
          <Pressable style={[styles.tab, activeTab === 'loans' && styles.activeTab]} onPress={() => setActiveTab('loans')}><Text style={[styles.tabText, activeTab === 'loans' && styles.activeTabText]}>Loans</Text></Pressable>
          <Pressable style={[styles.tab, activeTab === 'deposits' && styles.activeTab]} onPress={() => setActiveTab('deposits')}><Text style={[styles.tabText, activeTab === 'deposits' && styles.activeTabText]}>Deposits</Text></Pressable>
        </View>
        {activeTab === 'loans' && <>
        {/* Summary */}
        <GameCard
          variant="hero"
          eyebrow="CREDIT POSITION"
          title="Personal debt"
          accentColor={totalDebt > 0 ? Colors.warning : Colors.primary}
          titleAccessory={(
            <StatusPill
              compact
              icon="card-outline"
              label={`${loans.length}/3 loans`}
              color={totalDebt > 0 ? Colors.warning : Colors.primary}
            />
          )}
        >
          <Text style={[styles.debtHeroValue, { color: totalDebt > 0 ? Colors.negative : Colors.primary }]}>
            {formatCurrency(totalDebt)}
          </Text>
          <View style={styles.debtMetrics}>
            <View style={styles.debtMetric}>
              <Text style={styles.sumLabel}>Weekly Payments</Text>
              <Text style={[styles.sumValue, { color: totalWeeklyPayments > 0 ? Colors.negative : Colors.primary }]}>
                {formatCurrency(totalWeeklyPayments)}
              </Text>
            </View>
            <View style={styles.debtMetric}>
              <Text style={styles.sumLabel}>Cash</Text>
              <Text style={[styles.sumValue, { color: cash >= 0 ? Colors.primary : Colors.negative }]}>{formatCurrency(cash)}</Text>
            </View>
          </View>
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
        {!hasJob && (
          <GameCard>
            <View style={styles.noJobBanner}>
              <Ionicons name="briefcase-outline" size={20} color={Colors.warning} />
              <Text style={styles.noJobText}>You need a job before you can take out a loan</Text>
            </View>
          </GameCard>
        )}
        {(loansData ?? []).map((template) => {
          const alreadyHas = loans.some((l) => l?.loanId === template?.id);
          const slotsFull = loans.length >= 3;
          const meetsNetWorth = netWorth >= (template?.amount ?? 0);
          const available = !alreadyHas && !slotsFull && hasJob && meetsNetWorth;
          const reason = !hasJob ? 'Requires a job'
            : !meetsNetWorth ? `Need ${formatCurrency(template?.amount)} net worth (you have ${formatCurrency(netWorth)})`
            : alreadyHas ? 'Already active' : 'Max 3 loans';
          return (
            <GameCard key={template?.id}>
              <Text style={styles.loanName}>{template?.name}</Text>
              <View style={styles.loanRow}>
                <Text style={styles.loanMeta}>Amount: {formatCurrency(template?.amount)}</Text>
                <Text style={styles.loanMeta}>Interest: {(Math.max(0, (template?.interestRate ?? 0) + macroRateModifier - loanRateReduction) * 100).toFixed(1)}%</Text>
              </View>
              <Text style={styles.loanMeta}>Duration: {template?.durationWeeks} weeks</Text>
              <Text style={styles.loanMeta}>Required net worth: {formatCurrency(template?.amount)}</Text>
              {available ? (
                <Pressable style={[styles.actionBtn, { borderColor: Colors.primary }]} onPress={() => handleTakeLoan(template)}>
                  <Text style={[styles.actionText, { color: Colors.primary }]}>Borrow {formatCurrency(template?.amount)}</Text>
                </Pressable>
              ) : (
                <Text style={styles.unavailable}>{reason}</Text>
              )}
            </GameCard>
          );
        })}
        </>}

        {activeTab === 'deposits' && <>
          <GameCard>
            <Text style={styles.loanName}>Fixed-Term Deposits</Text>
            <Text style={styles.loanMeta}>Lock personal cash for a guaranteed return. Up to three deposits can be active at once.</Text>
            <Text style={styles.loanCount}>{bankDeposits.length}/3 deposit slots used</Text>
          </GameCard>
          {bankDeposits.map((deposit) => (
            <GameCard key={deposit.id}>
              <Text style={styles.loanName}>{deposit.durationWeeks}-Week Deposit</Text>
              <View style={styles.loanRow}><Text style={styles.loanMeta}>Principal: {formatCurrency(deposit.amount)}</Text><Text style={styles.loanMeta}>{deposit.weeksRemaining} weeks left</Text></View>
              <Text style={[styles.loanMeta, { color: Colors.primary }]}>Maturity value: {formatCurrency(Math.round(deposit.amount * (1 + deposit.interestRate)))}</Text>
              <ProgressBar progress={1 - deposit.weeksRemaining / deposit.durationWeeks} color={Colors.primary} />
            </GameCard>
          ))}
          <GameCard title="Open Deposit">
            <TextInput style={styles.input} value={depositAmount} onChangeText={setDepositAmount} keyboardType="number-pad" placeholder="Amount to deposit" placeholderTextColor={Colors.textMuted} />
            <View style={styles.termRow}>
              {([20, 40, 60] as const).map((term) => {
                const rate = Math.max(1, (term === 20 ? 5 : term === 40 ? 9 : 14) + depositInterestBonus * 100 + macroRateModifier * 75);
                return <Pressable key={term} style={[styles.term, depositTerm === term && styles.activeTerm]} onPress={() => setDepositTerm(term)}><Text style={styles.termTitle}>{term} weeks</Text><Text style={styles.termRate}>+{rate.toFixed(1)}%</Text></Pressable>;
              })}
            </View>
            <Pressable
              style={[styles.payOffBtn, (bankDeposits.length >= 3 || Number(depositAmount) <= 0 || Number(depositAmount) > cash) && { opacity: 0.45 }]}
              disabled={bankDeposits.length >= 3 || Number(depositAmount) <= 0 || Number(depositAmount) > cash}
              onPress={() => showGameDialog({ title: 'Open Deposit', message: `Lock ${formatCurrency(Number(depositAmount))} for ${depositTerm} weeks?`, confirmText: 'Deposit', onConfirm: () => { openBankDeposit(Number(depositAmount), depositTerm); setDepositAmount(''); } })}
            ><Text style={styles.payOffText}>Open Fixed-Term Deposit</Text></Pressable>
          </GameCard>
        </>}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scroll: { flex: 1 },
  scrollContent: { padding: 16 },
  debtHeroValue: { fontSize: 28, lineHeight: 34, fontWeight: '900', marginBottom: 11 },
  debtMetrics: { flexDirection: 'row', gap: 8 },
  debtMetric: { flex: 1, backgroundColor: Colors.elevated, borderWidth: 1, borderColor: Colors.cardBorder, borderRadius: 9, padding: 9 },
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
  noJobBanner: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: `${Colors.warning}15`, borderRadius: 8, padding: 12 },
  noJobText: { color: Colors.warning, fontSize: 14, fontWeight: '600', flex: 1 },
  tabs: { flexDirection: 'row', backgroundColor: Colors.card, borderRadius: 10, padding: 4, marginBottom: 12 },
  tab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 8 },
  activeTab: { backgroundColor: Colors.primary },
  tabText: { color: Colors.textSecondary, fontWeight: '700' },
  activeTabText: { color: Colors.white },
  input: { backgroundColor: Colors.elevated, borderWidth: 1, borderColor: Colors.cardBorder, borderRadius: 9, padding: 12, color: Colors.textPrimary, marginBottom: 12 },
  termRow: { flexDirection: 'row', gap: 8 },
  term: { flex: 1, borderWidth: 1, borderColor: Colors.cardBorder, borderRadius: 9, paddingVertical: 10, alignItems: 'center' },
  activeTerm: { borderColor: Colors.primary, backgroundColor: `${Colors.primary}18` },
  termTitle: { color: Colors.textPrimary, fontSize: 12, fontWeight: '700' },
  termRate: { color: Colors.primary, fontSize: 12, marginTop: 2 },
});
