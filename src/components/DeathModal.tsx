import React from 'react';
import { Modal, StyleSheet, Text, View } from 'react-native';
import { usePathname, useRouter } from 'expo-router';
import { Colors } from '../theme/colors';
import useGameStore from '../store/gameStore';
import { formatCurrency } from '../utils/format';
import GameButton from './GameButton';

export default function DeathModal() {
  const router = useRouter();
  const pathname = usePathname();
  const lifecycle = useGameStore((s) => s.lifecycle);
  const showMainMenu = useGameStore((s) => s.showMainMenu);
  const showSummary = useGameStore((s) => s.showSummary);
  const showEventModal = useGameStore((s) => s.showEventModal);
  const showRelationshipEventModal = useGameStore((s) => s.showRelationshipEventModal);
  const showPeriodReport = useGameStore((s) => s.showPeriodReport);
  const beginNewGame = useGameStore((s) => s.beginNewGame);
  const getNetWorthValue = useGameStore((s) => s.getNetWorthValue);

  if (!lifecycle?.isDead || pathname === '/succession' || pathname === '/family-tree' || showMainMenu || showSummary || showEventModal || showRelationshipEventModal || showPeriodReport) return null;

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

          <View style={styles.actions}>
            <GameButton label="Manage Estate & Succession" icon="documents-outline" trailingIcon="arrow-forward" onPress={() => router.replace('/succession')} />
            <GameButton variant="secondary" label="View Family Tree" icon="git-network-outline" onPress={() => router.push('/family-tree')} />
            <GameButton variant="ghost" label="Start New Life" icon="refresh-outline" onPress={beginNewGame} />
          </View>
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
  actions: { gap: 7 },
});
