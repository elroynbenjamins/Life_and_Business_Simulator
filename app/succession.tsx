import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors } from '../src/theme/colors';
import GameStatusBar from '../src/components/StatusBar';
import GameCard from '../src/components/GameCard';
import useGameStore from '../src/store/gameStore';
import { formatCurrency } from '../src/utils/format';
import { getSuccessionPreview } from '../src/engine/lifecycleEngine';
import { SuccessionAssetStrategy } from '../src/types/game';

const STEP_TITLES = ['Estate', 'Choose Heir', 'Tax & Assets'];

export default function SuccessionScreen() {
  const router = useRouter();
  const state = useGameStore();
  const estate = state.relationshipState?.estateSettlement ?? null;
  const children = state.relationshipState?.children ?? [];
  const continueAsChild = useGameStore((s) => s.continueAsChild);
  const beginNewGame = useGameStore((s) => s.beginNewGame);

  const [step, setStep] = useState(0);
  const [selectedChildId, setSelectedChildId] = useState<string | null>(null);
  const [assetStrategy, setAssetStrategy] = useState<SuccessionAssetStrategy>('liquidate');

  const eligible = useMemo(() => children
    .map((child) => ({ child, preview: getSuccessionPreview(state, child.id, 'liquidate') }))
    .filter((item) => !!item.preview), [children, estate, state.year, state.week]);

  const selectedChild = children.find((child) => child.id === selectedChildId) ?? null;
  const preview = selectedChildId ? getSuccessionPreview(state, selectedChildId, assetStrategy) : null;

  const finishSuccession = (financeTaxWithLoan: boolean) => {
    if (!selectedChildId || !preview?.willingToSucceed) return;
    continueAsChild(selectedChildId, financeTaxWithLoan, assetStrategy);
    router.replace('/tabs');
  };

  if (!state.lifecycle?.isDead) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>No succession is pending.</Text>
          <Pressable style={styles.primary} onPress={() => router.replace('/tabs')}>
            <Text style={styles.primaryText}>Return Home</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Family Succession</Text>
        <Text style={styles.headerMeta}>Generation {state.generation}</Text>
      </View>
      <GameStatusBar />
      <StepBar step={step} />

      <ScrollView contentContainerStyle={styles.content}>
        {step === 0 && (
          <>
            <Text style={styles.title}>1. Settle the Estate</Text>
            <Text style={styles.intro}>Review what this generation leaves behind before choosing who continues the family.</Text>

            <GameCard title="Life Complete">
              <Row label="Player" value={state.playerName} />
              <Row label="Age at death" value={String(state.lifecycle.deathAge ?? state.age)} />
              <Row label="Year" value={String(state.lifecycle.deathYear ?? state.year)} />
              <Row label="Cause" value={state.lifecycle.causeOfDeath ?? 'Natural causes'} />
            </GameCard>

            {estate && (
              <GameCard title="Estate">
                <MoneyRow label="Gross estate" value={estate.grossEstate} />
                {estate.outstandingRelationshipObligations > 0 && <MoneyRow label="Outstanding obligations" value={-estate.outstandingRelationshipObligations} negative />}
                <MoneyRow label="Administration" value={-estate.administrationCost} negative />
                <View style={styles.divider} />
                <MoneyRow label="Net estate" value={estate.netEstate} strong />

                {(estate.beneficiaries ?? []).length > 0 && (
                  <>
                    <Text style={styles.subheading}>Beneficiaries</Text>
                    {estate.beneficiaries.map((beneficiary) => (
                      <View key={beneficiary.id} style={styles.beneficiary}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.beneficiaryName}>{beneficiary.name}</Text>
                          <Text style={styles.meta}>{beneficiary.relationship === 'spouse' ? 'Spouse' : 'Child'} • {(beneficiary.share * 100).toFixed(1)}%</Text>
                        </View>
                        <Text style={styles.money}>{formatCurrency(beneficiary.amount)}</Text>
                      </View>
                    ))}
                  </>
                )}

                {(state.relationshipState?.familyTrustCash ?? 0) > 0 && (
                  <View style={styles.trustEstateRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.beneficiaryName}>Family Trust Reserve</Text>
                      <Text style={styles.meta}>Outside the player’s personal estate; remains with the dynasty.</Text>
                    </View>
                    <Text style={styles.money}>{formatCurrency(state.relationshipState.familyTrustCash)}</Text>
                  </View>
                )}

                {estate.businessValue > 0 && (
                  <View style={styles.callout}>
                    <Text style={styles.calloutTitle}>Family Business Succession</Text>
                    <Text style={styles.calloutText}>
                      {estate.successorName
                        ? `${estate.successorName} was designated to inherit the player’s family-business equity worth ${formatCurrency(estate.businessValue)}.`
                        : `No business successor was designated for ${formatCurrency(estate.businessValue)} of family-business equity.`}
                    </Text>
                  </View>
                )}
              </GameCard>
            )}

            <Pressable style={styles.primary} onPress={() => setStep(1)}>
              <Text style={styles.primaryText}>Choose Heir →</Text>
            </Pressable>
          </>
        )}

        {step === 1 && (
          <>
            <Text style={styles.title}>2. Choose the Next Generation</Text>
            <Text style={styles.intro}>Pick an adult child based on the life they built, their relationship with you, and their ability to carry the empire forward.</Text>

            {eligible.length === 0 ? (
              <GameCard>
                <View style={styles.noHeir}>
                  <Ionicons name="people-outline" size={38} color={Colors.textMuted} />
                  <Text style={styles.noHeirTitle}>No Adult Heir</Text>
                  <Text style={styles.noHeirText}>There is no child aged 18+ who can continue this dynasty.</Text>
                </View>
              </GameCard>
            ) : eligible.map(({ child, preview: heir }) => {
              if (!heir) return null;
              const selected = child.id === selectedChildId;
              return (
                <Pressable
                  key={child.id}
                  disabled={!heir.willingToSucceed}
                  style={[styles.heirCard, selected && styles.heirCardSelected, !heir.willingToSucceed && styles.heirCardDisabled]}
                  onPress={() => setSelectedChildId(child.id)}
                >
                  <View style={styles.heirTop}>
                    <View style={styles.avatar}><Ionicons name="person" size={21} color={Colors.info} /></View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.heirName}>{child.name}, {heir.childAge}</Text>
                      <Text style={styles.meta}>{child.occupationTitle ?? 'Independent'}</Text>
                    </View>
                    <View style={styles.potential}>
                      <Text style={styles.potentialScore}>{heir.futurePotentialScore}</Text>
                      <Text style={styles.potentialLabel}>{heir.futurePotentialLabel}</Text>
                    </View>
                  </View>

                  <View style={styles.grid}>
                    <Mini label="Parent bond" value={`${heir.parentRelationship}%`} />
                    <Mini label="Savings" value={formatCurrency(heir.existingSavings)} />
                    <Mini label="Company equity" value={heir.existingBusinessStakeValue > 0 ? formatCurrency(heir.existingBusinessStakeValue) : 'None'} />
                    <Mini label="Housing" value={child.homeStatus === 'homeowner' ? 'Owner' : 'Renting'} />
                    <Mini label="Family" value={child.partnerName ? `${child.descendants?.length ?? child.childrenCount ?? 0} child` : 'Single'} />
                  </View>

                  {child.personality && (
                    <View style={styles.pills}>
                      <Pill text={child.personality.ambition} />
                      <Pill text={child.personality.financialStyle} />
                      <Pill text={child.personality.riskTolerance} />
                      <Pill text={child.personality.resilience} />
                    </View>
                  )}

                  {!heir.willingToSucceed && <Text style={styles.unwilling}>Relationship too damaged: this child refuses succession.</Text>}
                </Pressable>
              );
            })}

            <View style={styles.navRow}>
              <Pressable style={styles.secondary} onPress={() => setStep(0)}><Text style={styles.secondaryText}>← Estate</Text></Pressable>
              {eligible.length === 0 ? (
                <Pressable style={styles.primaryFlex} onPress={beginNewGame}><Text style={styles.primaryText}>Start New Life</Text></Pressable>
              ) : (
                <Pressable disabled={!selectedChildId} style={[styles.primaryFlex, !selectedChildId && styles.disabled]} onPress={() => selectedChildId && setStep(2)}>
                  <Text style={styles.primaryText}>Tax & Assets →</Text>
                </Pressable>
              )}
            </View>
          </>
        )}

        {step === 2 && selectedChild && preview && (
          <>
            <Text style={styles.title}>3. Settle Tax & Assets</Text>
            <Text style={styles.intro}>Decide which inherited assets remain intact. Keeping illiquid assets can force the new generation to finance inheritance tax.</Text>

            <GameCard title={`${selectedChild.name}’s Inheritance`}>
              <View style={styles.strategyGrid}>
                {([
                  ['liquidate', 'Cash', 'Sell inherited stocks and property.'],
                  ['keep_stocks', 'Keep Stocks', 'Retain market holdings where the inheritance share permits.'],
                  ['keep_properties', 'Keep Property', 'Retain whole inherited properties where possible.'],
                  ['keep_both', 'Keep Both', 'Preserve stocks and property; lowest liquidity.'],
                ] as Array<[SuccessionAssetStrategy, string, string]>).map(([key, label, desc]) => (
                  <Pressable key={key} style={[styles.strategy, assetStrategy === key && styles.strategyActive]} onPress={() => setAssetStrategy(key)}>
                    <Text style={[styles.strategyTitle, assetStrategy === key && styles.strategyTitleActive]}>{label}</Text>
                    <Text style={styles.strategyDesc}>{desc}</Text>
                  </Pressable>
                ))}
              </View>

              <Text style={styles.subheading}>Result</Text>
              <MoneyRow label="Existing savings" value={preview.existingSavings} />
              {preview.existingBusinessStakeValue > 0 && <MoneyRow label="Company equity already owned" value={preview.existingBusinessStakeValue} />}
              <MoneyRow label="Cash inherited" value={preview.inheritedCash} />
              {preview.inheritedStockValue > 0 && <MoneyRow label="Stocks retained" value={preview.inheritedStockValue} />}
              {preview.inheritedPropertyValue > 0 && <MoneyRow label="Property retained" value={preview.inheritedPropertyValue} />}
              {preview.inheritedBusinessValue > 0 && <MoneyRow label="Family-business equity" value={preview.inheritedBusinessValue} />}
              <View style={styles.divider} />
              <MoneyRow label="Inheritance tax" value={-preview.inheritanceTax} negative strong />
              {preview.loanNeeded > 0 && <MoneyRow label="Minimum financing need" value={preview.loanNeeded} />}

              <View style={styles.taxNote}><Text style={styles.taxNoteText}>Tax is based on inherited value, not on whether assets are sold. Existing personal savings can be used to pay it.</Text></View>
            </GameCard>

            <View style={styles.navRow}>
              <Pressable style={styles.secondary} onPress={() => setStep(1)}><Text style={styles.secondaryText}>← Heir</Text></Pressable>
              <View style={{ flex: 1, gap: 8 }}>
                {preview.inheritanceTax <= preview.taxCashAvailable && preview.inheritanceTax > 0 && (
                  <Pressable style={styles.primaryFlex} onPress={() => finishSuccession(false)}>
                    <Text style={styles.primaryText}>Pay Tax in Cash & Continue</Text>
                  </Pressable>
                )}
                {preview.inheritanceTax > 0 && (
                  <Pressable style={styles.loanButton} onPress={() => finishSuccession(true)}>
                    <Text style={styles.loanText}>Finance Tax over 80 Weeks</Text>
                  </Pressable>
                )}
                {preview.inheritanceTax <= 0 && (
                  <Pressable style={styles.primaryFlex} onPress={() => finishSuccession(false)}>
                    <Text style={styles.primaryText}>Continue as {selectedChild.name}</Text>
                  </Pressable>
                )}
              </View>
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function StepBar({ step }: { step: number }) {
  return (
    <View style={styles.stepBar}>
      {STEP_TITLES.map((title, index) => (
        <React.Fragment key={title}>
          <View style={styles.stepItem}>
            <View style={[styles.stepCircle, index <= step && styles.stepCircleActive]}><Text style={[styles.stepNumber, index <= step && styles.stepNumberActive]}>{index + 1}</Text></View>
            <Text style={[styles.stepLabel, index === step && styles.stepLabelActive]}>{title}</Text>
          </View>
          {index < STEP_TITLES.length - 1 && <View style={[styles.stepLine, index < step && styles.stepLineActive]} />}
        </React.Fragment>
      ))}
    </View>
  );
}
function Row({ label, value }: { label: string; value: string }) {
  return <View style={styles.row}><Text style={styles.rowLabel}>{label}</Text><Text style={styles.rowValue}>{value}</Text></View>;
}
function MoneyRow({ label, value, negative, strong }: { label: string; value: number; negative?: boolean; strong?: boolean }) {
  return <View style={styles.row}><Text style={[styles.rowLabel, strong && { fontWeight: '800', color: Colors.textPrimary }]}>{label}</Text><Text style={[styles.money, negative && { color: Colors.negative }, strong && { fontSize: 15 }]}>{value < 0 ? '-' : ''}{formatCurrency(Math.abs(value))}</Text></View>;
}
function Mini({ label, value }: { label: string; value: string }) {
  return <View style={styles.mini}><Text style={styles.miniLabel}>{label}</Text><Text style={styles.miniValue} numberOfLines={1}>{value}</Text></View>;
}
function Pill({ text }: { text: string }) {
  return <View style={styles.pill}><Text style={styles.pillText}>{text.replace(/_/g, ' ')}</Text></View>;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerTitle: { color: Colors.textPrimary, fontSize: 21, fontWeight: '800' },
  headerMeta: { color: Colors.warning, fontSize: 12, fontWeight: '700' },
  content: { padding: 16, paddingBottom: 50 },
  title: { color: Colors.textPrimary, fontSize: 22, fontWeight: '900' },
  intro: { color: Colors.textSecondary, fontSize: 13, lineHeight: 19, marginTop: 5, marginBottom: 12 },
  stepBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 9, borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: Colors.cardBorder },
  stepItem: { alignItems: 'center', minWidth: 66 },
  stepCircle: { width: 25, height: 25, borderRadius: 13, borderWidth: 1, borderColor: Colors.cardBorder, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.elevated },
  stepCircleActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  stepNumber: { color: Colors.textMuted, fontSize: 11, fontWeight: '800' },
  stepNumberActive: { color: Colors.white },
  stepLabel: { color: Colors.textMuted, fontSize: 9, fontWeight: '700', marginTop: 3 },
  stepLabelActive: { color: Colors.textPrimary },
  stepLine: { flex: 1, height: 2, backgroundColor: Colors.cardBorder, marginBottom: 14 },
  stepLineActive: { backgroundColor: Colors.primary },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, paddingVertical: 5 },
  rowLabel: { color: Colors.textSecondary, fontSize: 12, flex: 1 },
  rowValue: { color: Colors.textPrimary, fontSize: 12, fontWeight: '700', textAlign: 'right', flex: 1 },
  money: { color: Colors.primary, fontSize: 12, fontWeight: '800' },
  divider: { height: 1, backgroundColor: Colors.cardBorder, marginVertical: 7 },
  subheading: { color: Colors.textPrimary, fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.7, marginTop: 12, marginBottom: 5 },
  beneficiary: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 7, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.cardBorder },
  beneficiaryName: { color: Colors.textPrimary, fontSize: 13, fontWeight: '700' },
  meta: { color: Colors.textMuted, fontSize: 10, marginTop: 2 },
  trustEstateRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10, paddingTop: 9, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.cardBorder },
  callout: { marginTop: 10, backgroundColor: `${Colors.warning}10`, borderRadius: 9, padding: 10, borderWidth: 1, borderColor: `${Colors.warning}28` },
  calloutTitle: { color: Colors.warning, fontSize: 12, fontWeight: '800' },
  calloutText: { color: Colors.textSecondary, fontSize: 11, lineHeight: 16, marginTop: 3 },
  heirCard: { backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.cardBorder, borderRadius: 13, padding: 13, marginBottom: 9 },
  heirCardSelected: { borderColor: Colors.primary, backgroundColor: `${Colors.primary}0D` },
  heirCardDisabled: { opacity: 0.48 },
  heirTop: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: `${Colors.info}14`, alignItems: 'center', justifyContent: 'center' },
  heirName: { color: Colors.textPrimary, fontSize: 15, fontWeight: '800' },
  potential: { minWidth: 58, alignItems: 'center', backgroundColor: `${Colors.primary}10`, borderRadius: 9, padding: 6 },
  potentialScore: { color: Colors.primary, fontSize: 17, fontWeight: '900' },
  potentialLabel: { color: Colors.textSecondary, fontSize: 9, fontWeight: '700' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 9 },
  mini: { width: '48%', backgroundColor: Colors.elevated, borderRadius: 8, padding: 8 },
  miniLabel: { color: Colors.textMuted, fontSize: 9 },
  miniValue: { color: Colors.textPrimary, fontSize: 11, fontWeight: '700', marginTop: 2 },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 8 },
  pill: { borderRadius: 6, paddingHorizontal: 7, paddingVertical: 4, backgroundColor: `${Colors.info}12` },
  pillText: { color: Colors.info, fontSize: 9, fontWeight: '700', textTransform: 'capitalize' },
  unwilling: { color: Colors.negative, fontSize: 10, marginTop: 8, lineHeight: 15 },
  noHeir: { alignItems: 'center', paddingVertical: 18 },
  noHeirTitle: { color: Colors.textPrimary, fontSize: 16, fontWeight: '800', marginTop: 8 },
  noHeirText: { color: Colors.textSecondary, fontSize: 12, textAlign: 'center', marginTop: 4 },
  strategyGrid: { gap: 7 },
  strategy: { borderWidth: 1, borderColor: Colors.cardBorder, borderRadius: 9, padding: 10 },
  strategyActive: { borderColor: Colors.primary, backgroundColor: `${Colors.primary}0D` },
  strategyTitle: { color: Colors.textPrimary, fontSize: 12, fontWeight: '800' },
  strategyTitleActive: { color: Colors.primary },
  strategyDesc: { color: Colors.textMuted, fontSize: 10, lineHeight: 14, marginTop: 2 },
  taxNote: { backgroundColor: `${Colors.info}0D`, borderRadius: 8, padding: 8, marginTop: 8 },
  taxNoteText: { color: Colors.textSecondary, fontSize: 10, lineHeight: 15 },
  navRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', marginTop: 12 },
  primary: { backgroundColor: Colors.primary, borderRadius: 10, minHeight: 48, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14, marginTop: 10 },
  primaryFlex: { flex: 1, backgroundColor: Colors.primary, borderRadius: 10, minHeight: 48, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10 },
  primaryText: { color: Colors.white, fontSize: 13, fontWeight: '800', textAlign: 'center' },
  secondary: { borderWidth: 1, borderColor: Colors.cardBorder, borderRadius: 10, minHeight: 48, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 13 },
  secondaryText: { color: Colors.textSecondary, fontSize: 12, fontWeight: '700' },
  loanButton: { borderWidth: 1, borderColor: Colors.warning, borderRadius: 10, minHeight: 46, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10 },
  loanText: { color: Colors.warning, fontSize: 12, fontWeight: '800' },
  disabled: { opacity: 0.35 },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  emptyTitle: { color: Colors.textPrimary, fontSize: 18, fontWeight: '800', marginBottom: 12 },
});
