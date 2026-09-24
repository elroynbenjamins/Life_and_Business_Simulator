import React, { useState } from 'react';
import { Modal, View, Text, TextInput, Pressable, StyleSheet, ScrollView } from 'react-native';
import useGameStore from '../store/gameStore';
import { Colors } from '../theme/colors';
import { formatCurrency } from '../utils/format';
import { getPrestigeEffects } from '../engine/prestigeEngine';

export default function BusinessBalanceWarning() {
  const state = useGameStore();
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [amount, setAmount] = useState('25000');
  const keyFor = (id: string) => `${state.activeSlot}:${state.year}:${state.week}:${id}`;
  const business = state.businesses.find(b => b.balance < -15000 && !dismissed.includes(keyFor(b.id)));
  const blocked =
    state.showMainMenu ||
    state.showTutorial ||
    state.showEducationOnboarding ||
    state.showContentUpdateModal ||
    state.showReviewPrompt ||
    state.showNameModal ||
    state.showSlotPicker ||
    state.showSummary ||
    state.showEventModal ||
    state.showRelationshipEventModal ||
    state.showPeriodReport ||
    state.showScheduledAd ||
    state.showEducationCareerReminder ||
    state.showNegativeCashModal ||
    !!state.lifecycle?.isDead;
  if (!business || blocked) return null;
  const dismiss = () => setDismissed(previous => [...previous, keyFor(business.id)]);
  const cashAmount = Number(amount);
  const canInject = Number.isFinite(cashAmount) && cashAmount > 0 && cashAmount <= state.cash;
  const canBorrow = (business.businessLoans?.length ?? 0) < 3;
  const rate = Math.max(0, 0.10 - (getPrestigeEffects(state.profile).loan_rate_reduction ?? 0));
  return <Modal visible transparent animationType="fade" onRequestClose={dismiss}>
    <View style={styles.backdrop}><ScrollView style={styles.card} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Business balance warning</Text>
      <Text style={styles.text}>{business.name} has {formatCurrency(business.balance)}. Inject personal cash or take a business loan.</Text>
      <Text style={styles.text}>Personal cash: {formatCurrency(state.cash)}</Text>
      <TextInput accessibilityLabel="Cash to inject" keyboardType="numeric" value={amount} onChangeText={setAmount} style={styles.input} />
      <Pressable disabled={!canInject} style={[styles.button, !canInject && styles.disabled]} onPress={() => { state.injectCashIntoBusiness(business.id, cashAmount); dismiss(); }}>
        <Text style={styles.buttonText}>Inject personal cash</Text>
      </Pressable>
      <Pressable disabled={!canBorrow} style={[styles.button, !canBorrow && styles.disabled]} onPress={() => { state.takeBusinessLoan(business.id, 25000, 0.10, 52); dismiss(); }}>
        <Text style={styles.buttonText}>Take €25,000 business loan</Text>
      </Pressable>
      <Text style={styles.text}>{canBorrow ? `52 weeks · ${Math.round(rate * 100)}% total interest · ${formatCurrency(Math.ceil(25000 * (1 + rate) / 52))}/week` : 'Maximum 3 active business loans reached.'}</Text>
      <Pressable style={styles.dismiss} onPress={dismiss}><Text style={styles.text}>Not now</Text></Pressable>
    </ScrollView></View>
  </Modal>;
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'center', padding: 24 },
  card: { flexGrow: 0, maxHeight: '85%', backgroundColor: Colors.card, borderRadius: 18 },
  content: { padding: 22, gap: 12 },
  title: { color: Colors.textPrimary, fontSize: 21, fontWeight: '700' },
  text: { color: Colors.textSecondary, fontSize: 15, lineHeight: 22 },
  input: { backgroundColor: Colors.elevated, color: Colors.textPrimary, borderRadius: 8, padding: 12 },
  button: { backgroundColor: '#047857', borderRadius: 10, minHeight: 48, padding: 12, alignItems: 'center', justifyContent: 'center' },
  buttonText: { color: '#FFFFFF', fontWeight: '700', textAlign: 'center' },
  disabled: { opacity: 0.5 },
  dismiss: { padding: 12, alignItems: 'center' },
});
