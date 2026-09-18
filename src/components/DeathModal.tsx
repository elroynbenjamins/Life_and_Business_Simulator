import React, { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Colors } from '../theme/colors';
import useGameStore from '../store/gameStore';
import { formatCurrency } from '../utils/format';
import { getSuccessionPreview } from '../engine/lifecycleEngine';
import { SuccessionAssetStrategy } from '../types/game';

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
  const relationshipState = useGameStore((s) => s.relationshipState);
  const continueAsChild = useGameStore((s) => s.continueAsChild);
  const state = useGameStore();
  const [reviewLegacy, setReviewLegacy] = useState(false);
  const [assetStrategies, setAssetStrategies] = useState<Record<string, SuccessionAssetStrategy>>({});
  const eligibleChildren = (relationshipState?.children ?? [])
    .map((child) => {
      const strategy = assetStrategies[child.id] ?? 'liquidate';
      return { child, strategy, preview: getSuccessionPreview(state, child.id, strategy) };
    })
    .filter((item) => !!item.preview);

  useEffect(() => {
    if (!lifecycle?.isDead) {
      setReviewLegacy(false);
      setAssetStrategies({});
    }
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
          <View style={styles.successionBox}>
            <Text style={styles.estateTitle}>Continue the Family</Text>
            {eligibleChildren.length > 0 ? (
              <>
                <Text style={styles.successorText}>
                  Continue this save as an adult child. Their inheritance is taxed before the next generation begins.
                </Text>
                {eligibleChildren.map(({ child, strategy, preview }) => {
                  if (!preview) return null;
                  const needsLoan = preview.loanNeeded > 0;
                  const personality = child.personality;
                  return (
                    <View key={child.id} style={[styles.childSuccessionCard, !preview.willingToSucceed && styles.unwillingCard]}>
                      <View style={styles.childSuccessionTop}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.beneficiaryName}>{child.name}, {preview.childAge}</Text>
                          <Text style={styles.beneficiaryMeta}>
                            {child.occupationTitle ?? 'Independent'}
                            {child.adultStatus === 'unemployed' ? ' • Unemployed' : ''}
                            {preview.inheritedBusinessValue > 0 ? ' • Business successor' : ''}
                          </Text>
                        </View>
                        <View style={styles.potentialBox}>
                          <Text style={styles.potentialScore}>{preview.futurePotentialScore}</Text>
                          <Text style={styles.potentialLabel}>{preview.futurePotentialLabel}</Text>
                        </View>
                      </View>

                      <View style={styles.successorMetaGrid}>
                        <MiniMeta label="Parent bond" value={`${preview.parentRelationship}%`} />
                        <MiniMeta label="Savings" value={formatCurrency(preview.existingSavings)} />
                        <MiniMeta label="Home" value={child.homeStatus === 'homeowner' ? 'Owned' : 'Renting'} />
                        <MiniMeta label="Family" value={child.partnerName ? `${child.partnerName} • ${child.descendants?.length ?? child.childrenCount ?? 0} child` : 'Single'} />
                      </View>

                      {personality && (
                        <View style={styles.personalityRow}>
                          <Pill text={personality.ambition.replace('_', ' ')} />
                          <Pill text={personality.riskTolerance.replace('_', ' ')} />
                          <Pill text={personality.financialStyle.replace('_', ' ')} />
                          <Pill text={personality.resilience} />
                        </View>
                      )}

                      {!preview.willingToSucceed && (
                        <View style={styles.unwillingNotice}>
                          <Text style={styles.unwillingText}>
                            Your relationship is too damaged. {child.name} is unwilling to take over the family legacy.
                          </Text>
                        </View>
                      )}

                      <Text style={styles.assetTitle}>Inheritance Asset Strategy</Text>
                      <View style={styles.assetGrid}>
                        {([
                          ['liquidate', 'Cash'],
                          ['keep_stocks', 'Keep Stocks'],
                          ['keep_properties', 'Keep Property'],
                          ['keep_both', 'Keep Both'],
                        ] as Array<[SuccessionAssetStrategy, string]>).map(([key, label]) => (
                          <Pressable
                            key={key}
                            style={[styles.assetChoice, strategy === key && styles.assetChoiceActive]}
                            onPress={() => setAssetStrategies((current) => ({ ...current, [child.id]: key }))}
                          >
                            <Text style={[styles.assetChoiceText, strategy === key && styles.assetChoiceTextActive]}>{label}</Text>
                          </Pressable>
                        ))}
                      </View>

                      <View style={styles.assetBreakdown}>
                        <EstateRow label="Existing savings" value={preview.existingSavings} />
                        <EstateRow label="Cash inherited" value={preview.inheritedCash} />
                        {preview.inheritedStockValue > 0 && <EstateRow label="Stocks retained" value={preview.inheritedStockValue} />}
                        {preview.inheritedPropertyValue > 0 && <EstateRow label="Property retained" value={preview.inheritedPropertyValue} />}
                        {preview.inheritedBusinessValue > 0 && <EstateRow label="Businesses inherited" value={preview.inheritedBusinessValue} />}
                        <View style={styles.divider} />
                        <EstateRow label="Inheritance tax" value={-preview.inheritanceTax} negative />
                        {needsLoan && <EstateRow label="Minimum loan needed" value={preview.loanNeeded} />}
                      </View>

                      {preview.willingToSucceed && (
                        preview.inheritanceTax <= 0 ? (
                          <Pressable
                            style={[styles.primary, { marginTop: 10 }]}
                            onPress={() => continueAsChild(child.id, false, strategy)}
                          >
                            <Text style={styles.primaryText}>Continue as {child.name}</Text>
                          </Pressable>
                        ) : (
                          <>
                            <Pressable
                              disabled={preview.taxCashAvailable < preview.inheritanceTax}
                              style={[
                                styles.primary,
                                { marginTop: 10 },
                                preview.taxCashAvailable < preview.inheritanceTax && styles.disabledButton,
                              ]}
                              onPress={() => continueAsChild(child.id, false, strategy)}
                            >
                              <Text style={styles.primaryText}>
                                Pay {formatCurrency(preview.inheritanceTax)} Cash & Continue
                              </Text>
                            </Pressable>
                            <Pressable
                              style={styles.secondary}
                              onPress={() => continueAsChild(child.id, true, strategy)}
                            >
                              <Text style={styles.secondaryText}>Finance Tax over 80 Weeks</Text>
                            </Pressable>
                          </>
                        )
                      )}
                    </View>
                  );
                })}
              </>
            ) : (
              <Text style={styles.noBeneficiary}>
                No adult child is available to continue this generation. Children must be at least 18 when the player dies.
              </Text>
            )}
          </View>

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

function MiniMeta({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.miniMeta}>
      <Text style={styles.miniMetaLabel}>{label}</Text>
      <Text style={styles.miniMetaValue} numberOfLines={1}>{value}</Text>
    </View>
  );
}

function Pill({ text }: { text: string }) {
  const pretty = text.charAt(0).toUpperCase() + text.slice(1);
  return <View style={styles.pill}><Text style={styles.pillText}>{pretty}</Text></View>;
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
  successionBox: { backgroundColor: 'rgba(16,185,129,0.07)', borderWidth: 1, borderColor: 'rgba(16,185,129,0.22)', borderRadius: 12, padding: 13, marginTop: 12 },
  childSuccessionCard: { backgroundColor: Colors.card, borderRadius: 10, borderWidth: 1, borderColor: Colors.cardBorder, padding: 11, marginTop: 10 },
  childSuccessionTop: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 5 },
  potentialBox: { alignItems: 'center', minWidth: 58, backgroundColor: 'rgba(16,185,129,0.10)', borderRadius: 9, paddingVertical: 5, paddingHorizontal: 7 },
  potentialScore: { color: Colors.primary, fontSize: 17, fontWeight: '900' },
  potentialLabel: { color: Colors.textSecondary, fontSize: 9, fontWeight: '700' },
  successorMetaGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  miniMeta: { width: '48%', backgroundColor: Colors.elevated, borderRadius: 7, padding: 7 },
  miniMetaLabel: { color: Colors.textMuted, fontSize: 9 },
  miniMetaValue: { color: Colors.textPrimary, fontSize: 11, fontWeight: '700', marginTop: 2 },
  personalityRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 8 },
  pill: { backgroundColor: 'rgba(59,130,246,0.10)', borderRadius: 7, paddingHorizontal: 7, paddingVertical: 4 },
  pillText: { color: Colors.info, fontSize: 9, fontWeight: '700' },
  unwillingCard: { borderColor: Colors.negative, opacity: 0.78 },
  unwillingNotice: { marginTop: 9, padding: 8, borderRadius: 8, backgroundColor: 'rgba(239,68,68,0.10)' },
  unwillingText: { color: Colors.negative, fontSize: 10, lineHeight: 15 },
  assetTitle: { color: Colors.textSecondary, fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.7, marginTop: 11, marginBottom: 6 },
  assetGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  assetChoice: { width: '48%', borderWidth: 1, borderColor: Colors.cardBorder, borderRadius: 8, paddingVertical: 8, alignItems: 'center' },
  assetChoiceActive: { borderColor: Colors.primary, backgroundColor: 'rgba(16,185,129,0.10)' },
  assetChoiceText: { color: Colors.textSecondary, fontSize: 10, fontWeight: '700' },
  assetChoiceTextActive: { color: Colors.primary },
  assetBreakdown: { marginTop: 8 },
  successorText: { color: Colors.textSecondary, fontSize: 11, lineHeight: 16 },
  note: { color: Colors.textMuted, fontSize: 12, lineHeight: 17, textAlign: 'center', marginVertical: 16 },
  primary: { backgroundColor: Colors.primary, borderRadius: 11, minHeight: 48, justifyContent: 'center', alignItems: 'center' },
  primaryText: { color: Colors.white, fontSize: 15, fontWeight: '800' },
  secondary: { borderWidth: 1, borderColor: Colors.cardBorder, borderRadius: 11, minHeight: 46, justifyContent: 'center', alignItems: 'center', marginTop: 9 },
  secondaryText: { color: Colors.textSecondary, fontSize: 14, fontWeight: '700' },
  disabledButton: { opacity: 0.35 },
});
