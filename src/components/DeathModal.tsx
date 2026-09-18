import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Colors } from '../theme/colors';
import useGameStore from '../store/gameStore';
import { formatCurrency } from '../utils/format';

export default function DeathModal() {
  const router = useRouter();
  const lifecycle = useGameStore((s) => s.lifecycle);
  const showMainMenu = useGameStore((s) => s.showMainMenu);
  const showSummary = useGameStore((s) => s.showSummary);
  const showEventModal = useGameStore((s) => s.showEventModal);
  const showRelationshipEventModal = useGameStore((s) => s.showRelationshipEventModal);
  const showPeriodReport = useGameStore((s) => s.showPeriodReport);
  const beginNewGame = useGameStore((s) => s.beginNewGame);
  const getNetWorthValue = useGameStore((s) => s.getNetWorthValue);

  if (!lifecycle?.isDead || showMainMenu || showSummary || showEventModal || showRelationshipEventModal || showPeriodReport) return null;

  return (
    <Modal visible transparent animationType="fade">
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.icon}>🕯️</Text>
          <Text style={styles.title}>A Life Completed</Text>
          <Text style={styles.body}>
            You passed away at age {lifecycle.deathAge ?? '?'} from {lifecycle.causeOfDeath ?? 'natural causes'}.
          </Text>

          <View style={styles.legacy}>
            <Text style={styles.legacyLabel}>FINAL NET WORTH</Text>
            <Text style={styles.legacyValue}>{formatCurrency(getNetWorthValue?.() ?? 0)}</Text>
            <Text style={styles.legacyMeta}>Year {lifecycle.deathYear ?? '?'} • Week {lifecycle.deathWeek ?? '?'}</Text>
          </View>

          <Text style={styles.note}>
            Estate distribution, heir selection, inheritance tax and asset choices are handled in the succession flow.
          </Text>

          <Pressable style={styles.primary} onPress={() => router.replace('/succession')}>
            <Text style={styles.primaryText}>Manage Estate & Succession</Text>
          </Pressable>
          <Pressable style={styles.secondary} onPress={() => router.push('/family-tree')}>
            <Text style={styles.secondaryText}>View Family Tree</Text>
          </Pressable>
          <Pressable style={styles.secondary} onPress={beginNewGame}>
            <Text style={styles.secondaryText}>Start New Life</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.82)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  card: { width: '100%', maxWidth: 420, backgroundColor: Colors.card, borderRadius: 18, borderWidth: 1, borderColor: Colors.cardBorder, padding: 22 },
  icon: { fontSize: 42, textAlign: 'center' },
  title: { color: Colors.textPrimary, fontSize: 24, fontWeight: '800', textAlign: 'center', marginTop: 8 },
  body: { color: Colors.textSecondary, fontSize: 14, lineHeight: 20, textAlign: 'center', marginTop: 8 },
  legacy: { backgroundColor: Colors.elevated, borderRadius: 12, padding: 14, marginTop: 18, alignItems: 'center' },
  legacyLabel: { color: Colors.textMuted, fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  legacyValue: { color: Colors.primary, fontSize: 24, fontWeight: '800', marginTop: 4 },
  legacyMeta: { color: Colors.textSecondary, fontSize: 12, marginTop: 3 },
  note: { color: Colors.textMuted, fontSize: 12, lineHeight: 17, textAlign: 'center', marginVertical: 16 },
  primary: { backgroundColor: Colors.primary, borderRadius: 11, minHeight: 48, justifyContent: 'center', alignItems: 'center' },
  primaryText: { color: Colors.white, fontSize: 14, fontWeight: '800' },
  secondary: { borderWidth: 1, borderColor: Colors.cardBorder, borderRadius: 11, minHeight: 46, justifyContent: 'center', alignItems: 'center', marginTop: 9 },
  secondaryText: { color: Colors.textSecondary, fontSize: 13, fontWeight: '700' },
});
