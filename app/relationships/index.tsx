import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors } from '../../src/theme/colors';
import GameStatusBar from '../../src/components/StatusBar';
import GameCard from '../../src/components/GameCard';
import useGameStore from '../../src/store/gameStore';
import { DatingPreference, RelationshipConnection } from '../../src/types/game';
import { formatCurrency } from '../../src/utils/format';
import { getDateCost } from '../../src/engine/relationshipEngine';

const TRAIT_LABELS: Record<string, Record<string, string>> = {
  financialStyle: { frugal: 'Frugal', balanced: 'Balanced spender', luxury: 'Luxury-minded' },
  riskTolerance: { cautious: 'Cautious investor', balanced: 'Balanced risk', risk_taking: 'Risk-taking' },
  ambition: { relaxed: 'Relaxed', career_minded: 'Career-minded', driven: 'Highly ambitious' },
  familyGoal: { no_children: 'Does not want children', unsure: 'Unsure about children', wants_children: 'Wants children' },
};

export default function RelationshipsScreen() {
  const router = useRouter();
  const state = useGameStore();
  const relationship = state.relationshipState;
  const setDatingPreferences = useGameStore((s) => s.setDatingPreferences);
  const inviteOnDate = useGameStore((s) => s.inviteOnDate);
  const planDate = useGameStore((s) => s.planDate);
  const askBecomePartners = useGameStore((s) => s.askBecomePartners);
  const moveInWithPartner = useGameStore((s) => s.moveInWithPartner);
  const [preference, setPreference] = useState<DatingPreference>(relationship?.preference ?? 'everyone');
  const [minAge, setMinAge] = useState(relationship?.minAge ?? 20);
  const [maxAge, setMaxAge] = useState(relationship?.maxAge ?? 35);

  const gw = ((state.year ?? 1) - 1) * 20 + (state.week ?? 1);
  const actionUsed = (relationship?.personalActionWeek ?? 0) === gw;
  const partner = useMemo(
    () => (relationship?.activeConnections ?? []).find((item) => item.id === relationship?.partnerId) ?? null,
    [relationship?.activeConnections, relationship?.partnerId]
  );
  const dating = (relationship?.activeConnections ?? []).filter((item) => item.stage === 'dating');

  if (!relationship?.preferencesSet) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <Header onBack={() => router.back()} />
        <GameStatusBar />
        <ScrollView contentContainerStyle={styles.content}>
          <GameCard>
            <View style={styles.centered}>
              <Ionicons name="heart-outline" size={42} color={Colors.happiness} />
              <Text style={styles.heroTitle}>Personal Life</Text>
              <Text style={styles.heroText}>Set who you'd like to meet. You can change these preferences later.</Text>
            </View>
            <Text style={styles.sectionLabel}>Interested in</Text>
            <View style={styles.choiceRow}>
              {(['women', 'men', 'everyone'] as DatingPreference[]).map((item) => (
                <Pressable key={item} style={[styles.choice, preference === item && styles.choiceSelected]} onPress={() => setPreference(item)}>
                  <Text style={[styles.choiceText, preference === item && styles.choiceTextSelected]}>
                    {item === 'women' ? 'Women' : item === 'men' ? 'Men' : 'Everyone'}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.sectionLabel}>Preferred age range</Text>
            <View style={styles.ageRow}>
              <Counter label="Min" value={minAge} onMinus={() => setMinAge(Math.max(18, minAge - 1))} onPlus={() => setMinAge(Math.min(maxAge, minAge + 1))} />
              <Counter label="Max" value={maxAge} onMinus={() => setMaxAge(Math.max(minAge, maxAge - 1))} onPlus={() => setMaxAge(Math.min(80, maxAge + 1))} />
            </View>

            <Pressable style={styles.primaryButton} onPress={() => setDatingPreferences(preference, minAge, maxAge)}>
              <Text style={styles.primaryText}>Start Meeting People</Text>
            </Pressable>
          </GameCard>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Header onBack={() => router.back()} />
      <GameStatusBar />
      <ScrollView contentContainerStyle={styles.content}>
        {actionUsed && (
          <View style={styles.notice}>
            <Ionicons name="time-outline" size={18} color={Colors.warning} />
            <Text style={styles.noticeText}>Personal action used this week. Advance a week before planning another date.</Text>
          </View>
        )}

        {partner && (
          <>
            <Text style={styles.sectionTitle}>Relationship</Text>
            <ConnectionCard connection={partner}>
              <Text style={styles.meta}>Together • {stageLabel(partner.stage)}</Text>
              {['living_together', 'engaged', 'married'].includes(partner.stage) && (
                <Text style={styles.moneyText}>Income: {formatCurrency(partner.weeklyIncome)}/week • contributes to shared costs</Text>
              )}
              <DateButtons disabled={actionUsed} cash={state.cash} inflation={state.inflationMultiplier} onDate={(kind) => planDate(partner.id, kind)} />
              {partner.stage === 'partner' && partner.relationship >= 75 && partner.weeksKnown >= 8 && (
                <View style={styles.majorBox}>
                  <Text style={styles.majorTitle}>Ready to live together?</Text>
                  <Text style={styles.meta}>Choose how shared household costs are divided.</Text>
                  <Pressable style={styles.secondaryButton} onPress={() => moveInWithPartner('equal')}><Text style={styles.secondaryText}>Move In • 50 / 50</Text></Pressable>
                  <Pressable style={styles.secondaryButton} onPress={() => moveInWithPartner('proportional')}><Text style={styles.secondaryText}>Move In • Proportional</Text></Pressable>
                  <Pressable style={styles.secondaryButton} onPress={() => moveInWithPartner('player_pays_most')}><Text style={styles.secondaryText}>Move In • You Pay Most</Text></Pressable>
                </View>
              )}
            </ConnectionCard>
          </>
        )}

        {dating.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Dating</Text>
            {dating.map((connection) => (
              <ConnectionCard key={connection.id} connection={connection}>
                <Text style={styles.meta}>{connection.dates} date{connection.dates === 1 ? '' : 's'} • known {connection.weeksKnown} week{connection.weeksKnown === 1 ? '' : 's'}</Text>
                <DateButtons disabled={actionUsed} cash={state.cash} inflation={state.inflationMultiplier} onDate={(kind) => planDate(connection.id, kind)} />
                {connection.connection >= 60 && connection.dates >= 3 && (
                  <Pressable style={styles.primaryButton} onPress={() => askBecomePartners(connection.id)}>
                    <Text style={styles.primaryText}>Ask to Become Partners</Text>
                  </Pressable>
                )}
              </ConnectionCard>
            ))}
          </>
        )}

        {!partner && (
          <>
            <Text style={styles.sectionTitle}>Meet People</Text>
            <Text style={styles.helper}>New profiles are generated as game weeks advance. Exact finances and deeper goals are revealed through dating.</Text>
            {(relationship.weeklyCandidates ?? []).map((candidate) => (
              <GameCard key={candidate.id}>
                <View style={styles.profileTop}>
                  <View style={styles.avatar}><Ionicons name="person" size={24} color={Colors.happiness} /></View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.name}>{candidate.name}, {candidate.age}</Text>
                    <Text style={styles.meta}>{candidate.occupationTitle}</Text>
                    <Text style={styles.meta}>Looking for a relationship</Text>
                  </View>
                </View>
                <View style={styles.unknownBox}>
                  <Text style={styles.unknownText}>Financial habits ?   Family plans ?   Risk tolerance ?</Text>
                </View>
                <DateButtons disabled={actionUsed} cash={state.cash} inflation={state.inflationMultiplier} onDate={(kind) => inviteOnDate(candidate.id, kind)} firstDate />
              </GameCard>
            ))}
            {(relationship.weeklyCandidates ?? []).length === 0 && (
              <GameCard><Text style={styles.helper}>No new profiles right now. Advance a week to refresh the pool.</Text></GameCard>
            )}
          </>
        )}

        <Text style={styles.sectionTitle}>Relationship History</Text>
        <GameCard>
          {(relationship.timeline ?? []).length === 0 ? (
            <Text style={styles.helper}>Your personal history will appear here.</Text>
          ) : (
            [...(relationship.timeline ?? [])].reverse().map((entry, index) => (
              <View key={index} style={styles.historyRow}>
                <Text style={styles.historyDate}>Y{entry.year} W{entry.week}</Text>
                <Text style={styles.historyText}>{entry.title}</Text>
              </View>
            ))
          )}
        </GameCard>


      </ScrollView>
    </SafeAreaView>
  );
}

function Header({ onBack }: { onBack: () => void }) {
  return <View style={styles.header}>
    <Pressable onPress={onBack} hitSlop={12}><Ionicons name="arrow-back" size={24} color={Colors.textPrimary} /></Pressable>
    <Text style={styles.headerTitle}>Personal Life</Text>
  </View>;
}

function Counter({ label, value, onMinus, onPlus }: { label: string; value: number; onMinus: () => void; onPlus: () => void }) {
  return <View style={styles.counter}>
    <Text style={styles.meta}>{label}</Text>
    <View style={styles.counterRow}>
      <Pressable onPress={onMinus} style={styles.counterButton}><Text style={styles.counterSymbol}>−</Text></Pressable>
      <Text style={styles.counterValue}>{value}</Text>
      <Pressable onPress={onPlus} style={styles.counterButton}><Text style={styles.counterSymbol}>+</Text></Pressable>
    </View>
  </View>;
}

function ConnectionCard({ connection, children }: { connection: RelationshipConnection; children: React.ReactNode }) {
  const value = connection.stage === 'dating' ? connection.connection : connection.relationship;
  return <GameCard>
    <View style={styles.profileTop}>
      <View style={styles.avatar}><Ionicons name="person" size={24} color={Colors.happiness} /></View>
      <View style={{ flex: 1 }}>
        <Text style={styles.name}>{connection.name}, {connection.age}</Text>
        <Text style={styles.meta}>{connection.occupationTitle}</Text>
      </View>
    </View>
    <Text style={styles.progressLabel}>{connection.stage === 'dating' ? 'Connection' : 'Relationship'} {Math.round(value)}%</Text>
    <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${Math.max(0, Math.min(100, value))}%` }]} /></View>
    <View style={styles.traits}>
      {(connection.visibleTraits ?? []).map((trait) => (
        <View key={trait} style={styles.trait}><Text style={styles.traitText}>{TRAIT_LABELS[trait]?.[(connection as any)[trait]] ?? (connection as any)[trait]}</Text></View>
      ))}
      {(connection.visibleTraits ?? []).length < 4 && <View style={styles.traitUnknown}><Text style={styles.traitUnknownText}>More to discover</Text></View>}
    </View>
    {children}
  </GameCard>;
}

function DateButtons({ disabled, cash, inflation, onDate, firstDate }: { disabled: boolean; cash: number; inflation: number; onDate: (kind: 'coffee' | 'dinner' | 'activity') => void; firstDate?: boolean }) {
  return <View style={styles.dateArea}>
    <Text style={styles.dateLabel}>{firstDate ? 'Invite on a first date' : 'Plan a date'}</Text>
    <View style={styles.dateRow}>
      {([
        ['coffee', 'Coffee', 'cafe-outline'],
        ['dinner', 'Dinner', 'restaurant-outline'],
        ['activity', 'Activity', 'game-controller-outline'],
      ] as const).map(([kind, label, icon]) => {
        const cost = getDateCost(kind, inflation);
        const unavailable = disabled || cash < cost;
        return <Pressable key={kind} disabled={unavailable} style={[styles.dateButton, unavailable && styles.disabled]} onPress={() => onDate(kind)}>
          <Ionicons name={icon} size={17} color={unavailable ? Colors.textMuted : Colors.happiness} />
          <Text style={styles.dateButtonText}>{label}</Text>
          <Text style={styles.dateCost}>{formatCurrency(cost)}</Text>
        </Pressable>;
      })}
    </View>
  </View>;
}

function stageLabel(stage: RelationshipConnection['stage']) {
  if (stage === 'living_together') return 'Living together';
  if (stage === 'engaged') return 'Engaged';
  if (stage === 'married') return 'Married';
  return stage === 'partner' ? 'Partner' : 'Dating';
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 },
  headerTitle: { color: Colors.textPrimary, fontSize: 20, fontWeight: '700' },
  content: { padding: 16, paddingBottom: 40 },
  centered: { alignItems: 'center', marginBottom: 18 },
  heroTitle: { color: Colors.textPrimary, fontSize: 22, fontWeight: '800', marginTop: 8 },
  heroText: { color: Colors.textSecondary, fontSize: 13, lineHeight: 18, textAlign: 'center', marginTop: 6 },
  sectionTitle: { color: Colors.textPrimary, fontSize: 18, fontWeight: '800', marginTop: 10, marginBottom: 10 },
  sectionLabel: { color: Colors.textSecondary, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8, marginTop: 12, marginBottom: 8 },
  choiceRow: { flexDirection: 'row', gap: 8 },
  choice: { flex: 1, borderWidth: 1, borderColor: Colors.cardBorder, borderRadius: 10, paddingVertical: 11, alignItems: 'center' },
  choiceSelected: { borderColor: Colors.happiness, backgroundColor: `${Colors.happiness}18` },
  choiceText: { color: Colors.textSecondary, fontWeight: '600' },
  choiceTextSelected: { color: Colors.happiness },
  ageRow: { flexDirection: 'row', gap: 10 },
  counter: { flex: 1, backgroundColor: Colors.elevated, borderRadius: 10, padding: 10 },
  counterRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
  counterButton: { width: 36, height: 36, borderRadius: 8, borderWidth: 1, borderColor: Colors.cardBorder, alignItems: 'center', justifyContent: 'center' },
  counterSymbol: { color: Colors.textPrimary, fontSize: 20, fontWeight: '700' },
  counterValue: { color: Colors.textPrimary, fontSize: 18, fontWeight: '800' },
  primaryButton: { backgroundColor: Colors.happiness, borderRadius: 10, minHeight: 46, alignItems: 'center', justifyContent: 'center', marginTop: 12, paddingHorizontal: 12 },
  primaryText: { color: Colors.white, fontWeight: '800', fontSize: 14 },
  secondaryButton: { borderWidth: 1, borderColor: Colors.happiness, borderRadius: 9, paddingVertical: 10, alignItems: 'center', marginTop: 7 },
  secondaryText: { color: Colors.happiness, fontWeight: '700', fontSize: 13 },
  notice: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: `${Colors.warning}18`, borderWidth: 1, borderColor: `${Colors.warning}40`, padding: 11, borderRadius: 10, marginBottom: 10 },
  noticeText: { color: Colors.warning, fontSize: 12, flex: 1 },
  helper: { color: Colors.textMuted, fontSize: 12, lineHeight: 17, marginBottom: 10 },
  profileTop: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  avatar: { width: 46, height: 46, borderRadius: 23, backgroundColor: `${Colors.happiness}18`, alignItems: 'center', justifyContent: 'center' },
  name: { color: Colors.textPrimary, fontSize: 16, fontWeight: '800' },
  meta: { color: Colors.textSecondary, fontSize: 12, marginTop: 2 },
  moneyText: { color: Colors.primary, fontSize: 12, marginTop: 6 },
  unknownBox: { backgroundColor: Colors.elevated, borderRadius: 8, padding: 9, marginTop: 10 },
  unknownText: { color: Colors.textMuted, fontSize: 11 },
  progressLabel: { color: Colors.textSecondary, fontSize: 12, fontWeight: '600', marginTop: 12 },
  progressTrack: { height: 8, borderRadius: 4, backgroundColor: Colors.elevated, overflow: 'hidden', marginTop: 5 },
  progressFill: { height: 8, borderRadius: 4, backgroundColor: Colors.happiness },
  traits: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  trait: { backgroundColor: `${Colors.info}18`, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 5 },
  traitText: { color: Colors.info, fontSize: 11, fontWeight: '600' },
  traitUnknown: { backgroundColor: Colors.elevated, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 5 },
  traitUnknownText: { color: Colors.textMuted, fontSize: 11 },
  dateArea: { marginTop: 12 },
  dateLabel: { color: Colors.textSecondary, fontSize: 12, fontWeight: '700', marginBottom: 7 },
  dateRow: { flexDirection: 'row', gap: 7 },
  dateButton: { flex: 1, minHeight: 64, borderWidth: 1, borderColor: Colors.cardBorder, borderRadius: 9, alignItems: 'center', justifyContent: 'center', padding: 6 },
  dateButtonText: { color: Colors.textPrimary, fontSize: 11, fontWeight: '700', marginTop: 2 },
  dateCost: { color: Colors.textMuted, fontSize: 10, marginTop: 1 },
  disabled: { opacity: 0.35 },
  majorBox: { marginTop: 12, padding: 10, borderRadius: 10, backgroundColor: `${Colors.happiness}10` },
  majorTitle: { color: Colors.textPrimary, fontWeight: '800', fontSize: 14 },
  historyRow: { flexDirection: 'row', gap: 10, paddingVertical: 7, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.cardBorder },
  historyDate: { color: Colors.textMuted, fontSize: 11, width: 52 },
  historyText: { color: Colors.textSecondary, fontSize: 12, flex: 1 },
  settingsLink: { alignItems: 'center', paddingVertical: 12 },
  settingsLinkText: { color: Colors.info, fontSize: 12, fontWeight: '600' },
});
