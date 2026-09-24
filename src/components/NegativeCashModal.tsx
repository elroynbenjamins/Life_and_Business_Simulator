import React, { useState } from 'react';
import { View, Text, StyleSheet, Modal } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../theme/colors';
import useGameStore from '../store/gameStore';
import { formatCurrency } from '../utils/format';
import GameButton from './GameButton';

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

          <View style={styles.actions}>
            {hasStocks && <GameButton label="Sell Stocks" icon="trending-up-outline" onPress={handleSellStocks} />}
            {hasBusinesses && <GameButton accentColor={Colors.business} label="Sell Business" icon="business-outline" onPress={handleSellBusiness} />}
            <GameButton accentColor={Colors.info} label="Take a Loan" icon="card-outline" onPress={handleLoan} />
            <GameButton accentColor={Colors.premium} label="Support • Gems to Cash" icon="diamond-outline" onPress={handleSupport} />
            <GameButton
              variant="danger"
              label={showRestartConfirm ? 'Confirm Restart' : 'Restart Game'}
              icon="refresh-outline"
              onPress={handleRestart}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  card: { backgroundColor: Colors.card, borderRadius: 20, padding: 28, width: '100%', maxWidth: 380 },
  iconWrap: { alignSelf: 'center', width: 56, height: 56, borderRadius: 18, backgroundColor: `${Colors.negative}12`, borderWidth: 1, borderColor: `${Colors.negative}44`, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  title: { color: Colors.negative, fontSize: 24, fontWeight: '700', textAlign: 'center', marginBottom: 8 },
  subtitle: { color: Colors.textPrimary, fontSize: 16, textAlign: 'center', marginBottom: 8 },
  cashAmount: { color: Colors.negative, fontWeight: '700' },
  desc: { color: Colors.textSecondary, fontSize: 14, textAlign: 'center', marginBottom: 20, lineHeight: 20 },
  actions: { gap: 8 },
});
