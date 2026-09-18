import React, { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Colors } from '../theme/colors';
import useGameStore from '../store/gameStore';
import { formatCurrency } from '../utils/format';

export default function DeathModal() {
  const lifecycle = useGameStore((s) => s.lifecycle);
  const showMainMenu = useGameStore((s) => s.showMainMenu);
  const showSummary = useGameStore((s) => s.showSummary);
  const showEventModal = useGameStore((s) => s.showEventModal);
  const showRelationshipEventModal = useGameStore((s) => s.showRelationshipEventModal);
  const showPeriodReport = useGameStore((s) => s.showPeriodReport);
  const beginNewGame = useGameStore((s) => s.beginNewGame);
  const getNetWorthValue = useGameStore((s) => s.getNetWorthValue);
  const estateSettlement = useGameStore((s) => s.relationshipState?.estateSettlement ?? null);
  const [reviewLegacy, setReviewLegacy] = useState(false);

  useEffect(() => {
    if (!lifecycle?.isDead) setReviewLegacy(false);
  }, [lifecycle?.isDead]);

  if (!lifecycle?.isDead || showMainMenu || reviewLegacy || showSummary || showEventModal || showRelationshipEventModal || showPeriodReport) return null;

  return (
    <Modal visible transparent animationType="fade">
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
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
          {estateSettlement && (
            <View style={styles.estateBox}>
              <Text style={styles.estateTitle}>Estate Settlement</Text>
              <EstateRow label="Gross estate" value={estateSettlement.grossEstate} />
              {estateSettlement.outstandingRelationshipObligations > 0 && (
                <EstateRow label="Outstanding obligations" value={-estateSettlement.outstandingRelationshipObligations} negative />
              )}
              <EstateRow label="Administration" value={-estateSettlement.administrationCost} negative />
              <View style={styles.divider} />
              <EstateRow label="Net estate" value={estateSettlement.netEstate} strong />

              {(estateSettlement.beneficiaries ?? []).length > 0 ? (
                <View style={styles.beneficiaries}>
                  <Text style={styles.estateSubtitle}>Beneficiaries</Text>
                  {estateSettlement.beneficiaries.map((beneficiary) => (
                    <View key={beneficiary.id} style={styles.beneficiaryRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.beneficiaryName}>{beneficiary.name}</Text>
                        <Text style={styles.beneficiaryMeta}>
                          {beneficiary.relationship === 'spouse' ? 'Spouse' : 'Child'} • {(beneficiary.share * 100).toFixed(1)}%
                        </Text>
                      </View>
                      <Text style={styles.beneficiaryAmount}>{formatCurrency(beneficiary.amount)}</Text>
                    </View>
                  ))}
                </View>
              ) : (
                <Text style={styles.noBeneficiary}>No spouse or children were available to receive the estate.</Text>
              )}

              {(estateSettlement.businessValue ?? 0) > 0 && (
                <View style={styles.successorBox}>
                  <Text style={styles.estateSubtitle}>Business succession</Text>
                  <Text style={styles.successorText}>
                    {estateSettlement.successorName
                      ? `${estateSettlement.successorName} was named to carry forward businesses valued at ${formatCurrency(estateSettlement.businessValue)}.`
                      : `No successor was named for businesses valued at ${formatCurrency(estateSettlement.businessValue)}.`}
                  </Text>
                </View>
              )}
            </View>
          )}
          <Text style={styles.note}>This save is now complete. You can review your empire and statistics, or begin a new life.</Text>
          <Pressable style={styles.primary} onPress={() => setReviewLegacy(true)}>
            <Text style={styles.primaryText}>View Legacy</Text>
          </Pressable>
          <Pressable style={styles.secondary} onPress={beginNewGame}>
            <Text style={styles.secondaryText}>Start New Life</Text>
          </Pressable>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function EstateRow({ label, value, negative, strong }: { label: string; value: number; negative?: boolean; strong?: boolean }) {
  return (
    <View style={styles.estateRow}>
      <Text style={[styles.estateRowLabel, strong && { color: Colors.textPrimary, fontWeight: '800' }]}>{label}</Text>
      <Text
        style={[
          styles.estateRowValue,
          { color: negative ? Colors.negative : strong ? Colors.primary : Colors.textPrimary },
          strong && { fontWeight: '800' },
        ]}
      >
        {value < 0 ? '-' : ''}{formatCurrency(Math.abs(value))}
      </Text>
    </View>
  );
}
const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.82)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  card: { width: '100%', maxWidth: 420, maxHeight: '88%', backgroundColor: Colors.card, borderRadius: 18, borderWidth: 1, borderColor: Colors.cardBorder },
  scrollContent: { padding: 22 },
  icon: { fontSize: 42, textAlign: 'center' },
  title: { color: Colors.textPrimary, fontSize: 24, fontWeight: '800', textAlign: 'center', marginTop: 8 },
  body: { color: Colors.textSecondary, fontSize: 14, lineHeight: 20, textAlign: 'center', marginTop: 8 },
  legacy: { backgroundColor: Colors.elevated, borderRadius: 12, padding: 14, marginTop: 18, alignItems: 'center' },
  legacyLabel: { color: Colors.textMuted, fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  legacyValue: { color: Colors.primary, fontSize: 24, fontWeight: '800', marginTop: 4 },
  legacyMeta: { color: Colors.textSecondary, fontSize: 12, marginTop: 3 },
  estateBox: { backgroundColor: Colors.elevated, borderRadius: 12, padding: 13, marginTop: 12 },
  estateTitle: { color: Colors.textPrimary, fontSize: 16, fontWeight: '800', marginBottom: 8 },
  estateSubtitle: { color: Colors.textSecondary, fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: 6 },
  estateRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, paddingVertical: 4 },
  estateRowLabel: { color: Colors.textSecondary, fontSize: 12 },
  estateRowValue: { fontSize: 12, fontWeight: '700' },
  divider: { height: 1, backgroundColor: Colors.cardBorder, marginVertical: 6 },
  beneficiaries: { marginTop: 10 },
  beneficiaryRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.cardBorder },
  beneficiaryName: { color: Colors.textPrimary, fontSize: 13, fontWeight: '700' },
  beneficiaryMeta: { color: Colors.textMuted, fontSize: 10, marginTop: 2 },
  beneficiaryAmount: { color: Colors.primary, fontSize: 12, fontWeight: '800' },
  noBeneficiary: { color: Colors.textMuted, fontSize: 11, lineHeight: 16, marginTop: 8 },
  successorBox: { marginTop: 10 },
  successorText: { color: Colors.textSecondary, fontSize: 11, lineHeight: 16 },
  note: { color: Colors.textMuted, fontSize: 12, lineHeight: 17, textAlign: 'center', marginVertical: 16 },
  primary: { backgroundColor: Colors.primary, borderRadius: 11, minHeight: 48, justifyContent: 'center', alignItems: 'center' },
  primaryText: { color: Colors.white, fontSize: 15, fontWeight: '800' },
  secondary: { borderWidth: 1, borderColor: Colors.cardBorder, borderRadius: 11, minHeight: 46, justifyContent: 'center', alignItems: 'center', marginTop: 9 },
  secondaryText: { color: Colors.textSecondary, fontSize: 14, fontWeight: '700' },
});
