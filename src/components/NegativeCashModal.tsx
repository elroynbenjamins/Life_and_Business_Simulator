import React, { useState } from 'react';
import { View, Text, StyleSheet, Modal, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../theme/colors';
import useGameStore from '../store/gameStore';
import { formatCurrency } from '../utils/format';

export default function NegativeCashModal() {
  const showModal = useGameStore((s) => s?.showNegativeCashModal);
  const dismissNegativeCash = useGameStore((s) => s?.dismissNegativeCash);
  const startNewGame = useGameStore((s) => s?.startNewGame);
  const cash = useGameStore((s) => s?.cash ?? 0);
  const playerName = useGameStore((s) => s?.playerName ?? 'Player');
  const holdings = useGameStore((s) => s?.holdings ?? []);
  const businesses = useGameStore((s) => s?.businesses ?? []);
  const router = useRouter();
  const [showRestartConfirm, setShowRestartConfirm] = useState(false);

  if (!showModal) return null;

  const hasStocks = (holdings ?? []).some((h) => (h?.shares ?? 0) > 0);
  const hasBusinesses = (businesses ?? []).length > 0;

  const handleRestart = () => {
    if (!showRestartConfirm) {
      setShowRestartConfirm(true);
      return;
    }
    setShowRestartConfirm(false);
    dismissNegativeCash?.();
    startNewGame?.(playerName);
  };

  const handleLoan = () => {
    dismissNegativeCash?.();
    router.push('/loans');
  };

  const handleSupport = () => {
    dismissNegativeCash?.();
    router.push('/support');
  };

  const handleSellStocks = () => {
    dismissNegativeCash?.();
    router.push('/portfolio');
  };

  const handleSellBusiness = () => {
    dismissNegativeCash?.();
    router.push('/business');
  };

  return (
    <Modal visible transparent animationType="fade">
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.iconWrap}>
            <Ionicons name="warning" size={48} color={Colors.negative} />
          </View>
          <Text style={styles.title}>Negative Balance!</Text>
          <Text style={styles.subtitle}>
            Your current balance is{' '}
            <Text style={styles.cashAmount}>{formatCurrency(cash)}</Text>
          </Text>
          <Text style={styles.desc}>
            You cannot advance to the next week with a negative balance. Choose an option below:
          </Text>

          {hasStocks && (
            <Pressable style={[styles.btn, styles.stockBtn]} onPress={handleSellStocks}>
              <Ionicons name="trending-up" size={20} color={Colors.white} />
              <Text style={styles.btnText}>Sell Stocks</Text>
            </Pressable>
          )}

          {hasBusinesses && (
            <Pressable style={[styles.btn, styles.bizBtn]} onPress={handleSellBusiness}>
              <Ionicons name="business" size={20} color={Colors.white} />
              <Text style={styles.btnText}>Sell Business</Text>
            </Pressable>
          )}

          <Pressable style={[styles.btn, styles.loanBtn]} onPress={handleLoan}>
            <Ionicons name="card" size={20} color={Colors.white} />
            <Text style={styles.btnText}>Take a Loan</Text>
          </Pressable>

          <Pressable style={[styles.btn, styles.supportBtn]} onPress={handleSupport}>
            <Ionicons name="diamond" size={20} color={Colors.white} />
            <Text style={styles.btnText}>Support (Gems → Cash)</Text>
          </Pressable>

          <Pressable style={[styles.btn, styles.restartBtn]} onPress={handleRestart}>
            <Ionicons name="refresh" size={20} color={Colors.white} />
            <Text style={styles.btnText}>{showRestartConfirm ? 'Confirm Restart?' : 'Restart Game'}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  card: { backgroundColor: Colors.card, borderRadius: 20, padding: 28, width: '100%', maxWidth: 380 },
  iconWrap: { alignItems: 'center', marginBottom: 12 },
  title: { color: Colors.negative, fontSize: 24, fontWeight: '700', textAlign: 'center', marginBottom: 8 },
  subtitle: { color: Colors.textPrimary, fontSize: 16, textAlign: 'center', marginBottom: 8 },
  cashAmount: { color: Colors.negative, fontWeight: '700' },
  desc: { color: Colors.textSecondary, fontSize: 14, textAlign: 'center', marginBottom: 20, lineHeight: 20 },
  btn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, borderRadius: 12, padding: 16, marginBottom: 10 },
  stockBtn: { backgroundColor: '#10B981' },
  bizBtn: { backgroundColor: '#06B6D4' },
  loanBtn: { backgroundColor: Colors.info },
  supportBtn: { backgroundColor: '#8B5CF6' },
  restartBtn: { backgroundColor: Colors.negative },
  btnText: { color: Colors.white, fontSize: 16, fontWeight: '700' },
});
