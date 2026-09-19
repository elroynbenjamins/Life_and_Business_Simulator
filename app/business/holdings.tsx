import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors } from '../../src/theme/colors';
import GameCard from '../../src/components/GameCard';
import { showGameDialog } from '../../src/components/GameDialog';
import useGameStore from '../../src/store/gameStore';
import { formatCurrency } from '../../src/utils/format';
import {
  ACQUISITION_UNLOCK_NET_WORTH,
  HOLDING_COMPANY_SETUP_COST,
  getHoldingCompanySummary,
} from '../../src/engine/acquisitionEngine';

export default function HoldingCompaniesScreen() {
  const router = useRouter();
  const businesses = useGameStore((s) => s.businesses ?? []);
  const holdings = useGameStore((s) => s.holdingCompanies ?? []);
  const cash = useGameStore((s) => s.cash ?? 0);
  const inflationMultiplier = useGameStore((s) => s.inflationMultiplier ?? 1);
  const getNetWorthValue = useGameStore((s) => s.getNetWorthValue);
  const createHoldingCompany = useGameStore((s) => s.createHoldingCompany);
  const assignBusinessToHolding = useGameStore((s) => s.assignBusinessToHolding);
  const [name, setName] = useState('');

  const netWorth = getNetWorthValue();
  const unlocked = netWorth >= ACQUISITION_UNLOCK_NET_WORTH;
  const setupCost = Math.round(HOLDING_COMPANY_SETUP_COST * Math.max(0.5, inflationMultiplier));
  const unassigned = businesses.filter((business) => !business.holdingCompanyId);

  const summaries = useMemo(() => holdings.map((holding) => ({
    holding,
    ...getHoldingCompanySummary(holding, businesses),
  })), [holdings, businesses]);

  const createHolding = () => {
    const cleanName = name.trim();
    if (!cleanName) return;
    showGameDialog({
      title: 'Create holding company?',
      message: `Establish ${cleanName} for ${formatCurrency(setupCost)}. The holding organizes subsidiaries and follows the dynasty controller across succession when family businesses are inherited.`,
      confirmText: 'Create',
      onConfirm: () => {
        createHoldingCompany(cleanName);
        setName('');
      },
    });
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>Holding Companies</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <GameCard>
          <View style={styles.introHeader}>
            <View style={styles.iconWrap}>
              <Ionicons name="layers" size={24} color={Colors.info} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.introTitle}>Build a business group</Text>
              <Text style={styles.introText}>
                Group operating companies under one portfolio view while each subsidiary keeps its own staff,
                ownership, strategy, valuation and Family Business status.
              </Text>
            </View>
          </View>
        </GameCard>

        {!unlocked ? (
          <GameCard>
            <View style={styles.locked}>
              <Ionicons name="lock-closed" size={30} color={Colors.warning} />
              <Text style={styles.lockedTitle}>Unlocks at {formatCurrency(ACQUISITION_UNLOCK_NET_WORTH)}</Text>
              <Text style={styles.lockedText}>Current net worth: {formatCurrency(netWorth)}</Text>
            </View>
          </GameCard>
        ) : (
          <>
            <GameCard>
              <Text style={styles.sectionTitle}>Create Holding</Text>
              <Text style={styles.sectionSub}>One-time setup cost: {formatCurrency(setupCost)} • Cash: {formatCurrency(cash)}</Text>
              <View style={styles.createRow}>
                <TextInput
                  value={name}
                  onChangeText={setName}
                  placeholder="e.g. Benjamins Group"
                  placeholderTextColor={Colors.textMuted}
                  style={styles.input}
                  maxLength={36}
                />
                <Pressable
                  onPress={createHolding}
                  disabled={!name.trim() || cash < setupCost}
                  style={[styles.createButton, (!name.trim() || cash < setupCost) && styles.disabledButton]}
                >
                  <Ionicons name="add" size={18} color={name.trim() && cash >= setupCost ? Colors.white : Colors.textMuted} />
                </Pressable>
              </View>
            </GameCard>

            {summaries.length === 0 ? (
              <GameCard>
                <Text style={styles.emptyTitle}>No holding companies yet</Text>
                <Text style={styles.emptyText}>
                  Create one when you want to manage several operating companies as a single dynasty portfolio.
                </Text>
              </GameCard>
            ) : summaries.map(({ holding, subsidiaryCount, totalValue, weeklyProfit, familyControlledPct }) => (
              <GameCard key={holding.id}>
                <View style={styles.holdingHeader}>
                  <View style={styles.holdingIcon}>
                    <Ionicons name="business" size={22} color={Colors.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.holdingName}>{holding.name}</Text>
                    <Text style={styles.holdingMeta}>
                      Controller: {holding.controllerName} • Dynasty G{holding.generationsOwned}
                    </Text>
                  </View>
                </View>

                <View style={styles.statsRow}>
                  <View style={styles.stat}>
                    <Text style={styles.statLabel}>Subsidiaries</Text>
                    <Text style={styles.statValue}>{subsidiaryCount}</Text>
                  </View>
                  <View style={styles.stat}>
                    <Text style={styles.statLabel}>Group value</Text>
                    <Text style={styles.statValue}>{formatCurrency(totalValue)}</Text>
                  </View>
                  <View style={styles.stat}>
                    <Text style={styles.statLabel}>Weekly P&L</Text>
                    <Text style={[styles.statValue, { color: weeklyProfit >= 0 ? Colors.primary : Colors.negative }]}>
                      {weeklyProfit >= 0 ? '+' : ''}{formatCurrency(weeklyProfit)}
                    </Text>
                  </View>
                </View>

                <View style={styles.familyControl}>
                  <Ionicons name="people" size={14} color={Colors.warning} />
                  <Text style={styles.familyControlText}>
                    {Math.round(familyControlledPct)}% of group value is family-controlled
                  </Text>
                </View>

                {businesses.filter((business) => business.holdingCompanyId === holding.id).map((business) => (
                  <View key={business.id} style={styles.subsidiaryRow}>
                    <Pressable style={{ flex: 1 }} onPress={() => router.push(`/business/${business.id}`)}>
                      <Text style={styles.subsidiaryName}>{business.name}</Text>
                      <Text style={styles.subsidiaryMeta}>
                        {formatCurrency(business.valuation ?? 0)} • {(business.lastWeekProfit ?? 0) >= 0 ? '+' : ''}{formatCurrency(business.lastWeekProfit ?? 0)}/wk
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={() => assignBusinessToHolding(business.id, null)}
                      hitSlop={10}
                      style={styles.removeButton}
                    >
                      <Ionicons name="remove-circle-outline" size={19} color={Colors.textMuted} />
                    </Pressable>
                  </View>
                ))}
              </GameCard>
            ))}

            {holdings.length > 0 && unassigned.length > 0 && (
              <GameCard>
                <Text style={styles.sectionTitle}>Unassigned Companies</Text>
                <Text style={styles.sectionSub}>Tap a holding to move the company into that group.</Text>
                {unassigned.map((business) => (
                  <View key={business.id} style={styles.assignmentBlock}>
                    <Text style={styles.assignmentName}>{business.name}</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.assignmentChips}>
                      {holdings.map((holding) => (
                        <Pressable
                          key={holding.id}
                          onPress={() => assignBusinessToHolding(business.id, holding.id)}
                          style={styles.assignmentChip}
                        >
                          <Ionicons name="arrow-forward-circle" size={14} color={Colors.primary} />
                          <Text style={styles.assignmentChipText}>{holding.name}</Text>
                        </Pressable>
                      ))}
                    </ScrollView>
                  </View>
                ))}
              </GameCard>
            )}

            <Pressable style={styles.marketButton} onPress={() => router.push('/business/acquisitions')}>
              <Ionicons name="trending-up" size={20} color={Colors.white} />
              <Text style={styles.marketButtonText}>Browse Acquisition Targets</Text>
            </Pressable>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  headerTitle: { color: Colors.textPrimary, fontSize: 20, fontWeight: '800' },
  scroll: { flex: 1 },
  content: { padding: 16, paddingBottom: 36 },
  introHeader: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  iconWrap: { width: 44, height: 44, borderRadius: 11, backgroundColor: '#17263A', alignItems: 'center', justifyContent: 'center' },
  introTitle: { color: Colors.textPrimary, fontSize: 16, fontWeight: '800' },
  introText: { color: Colors.textSecondary, fontSize: 12, lineHeight: 18, marginTop: 4 },
  locked: { alignItems: 'center', paddingVertical: 16, gap: 8 },
  lockedTitle: { color: Colors.textPrimary, fontSize: 16, fontWeight: '800' },
  lockedText: { color: Colors.textSecondary, fontSize: 12 },
  sectionTitle: { color: Colors.textPrimary, fontSize: 15, fontWeight: '800' },
  sectionSub: { color: Colors.textMuted, fontSize: 11, marginTop: 4 },
  createRow: { flexDirection: 'row', gap: 9, marginTop: 12 },
  input: { flex: 1, minHeight: 44, borderWidth: 1, borderColor: Colors.cardBorder, borderRadius: 10, paddingHorizontal: 12, color: Colors.textPrimary, backgroundColor: Colors.elevated },
  createButton: { width: 46, minHeight: 44, borderRadius: 10, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  disabledButton: { backgroundColor: Colors.elevated },
  emptyTitle: { color: Colors.textPrimary, fontSize: 15, fontWeight: '800' },
  emptyText: { color: Colors.textSecondary, fontSize: 12, lineHeight: 18, marginTop: 5 },
  holdingHeader: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  holdingIcon: { width: 40, height: 40, borderRadius: 10, backgroundColor: '#10382D', alignItems: 'center', justifyContent: 'center' },
  holdingName: { color: Colors.textPrimary, fontSize: 16, fontWeight: '800' },
  holdingMeta: { color: Colors.textMuted, fontSize: 10, marginTop: 2 },
  statsRow: { flexDirection: 'row', gap: 7, marginTop: 12 },
  stat: { flex: 1 },
  statLabel: { color: Colors.textMuted, fontSize: 9 },
  statValue: { color: Colors.textPrimary, fontSize: 12, fontWeight: '800', marginTop: 3 },
  familyControl: { flexDirection: 'row', gap: 6, alignItems: 'center', marginTop: 11, backgroundColor: '#33270F', paddingHorizontal: 9, paddingVertical: 7, borderRadius: 8 },
  familyControlText: { color: Colors.warning, fontSize: 10, fontWeight: '700' },
  subsidiaryRow: { flexDirection: 'row', alignItems: 'center', borderTopWidth: 1, borderTopColor: Colors.cardBorder, paddingTop: 10, marginTop: 10 },
  subsidiaryName: { color: Colors.textPrimary, fontSize: 12, fontWeight: '800' },
  subsidiaryMeta: { color: Colors.textMuted, fontSize: 9, marginTop: 2 },
  removeButton: { paddingLeft: 12, paddingVertical: 4 },
  assignmentBlock: { borderTopWidth: 1, borderTopColor: Colors.cardBorder, paddingTop: 10, marginTop: 10 },
  assignmentName: { color: Colors.textPrimary, fontSize: 12, fontWeight: '800' },
  assignmentChips: { gap: 7, paddingTop: 8, paddingBottom: 1 },
  assignmentChip: { flexDirection: 'row', gap: 5, alignItems: 'center', borderRadius: 16, paddingHorizontal: 9, paddingVertical: 7, backgroundColor: Colors.elevated, borderWidth: 1, borderColor: Colors.cardBorder },
  assignmentChipText: { color: Colors.textSecondary, fontSize: 10, fontWeight: '700' },
  marketButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: Colors.primary, borderRadius: 13, padding: 15, marginTop: 7 },
  marketButtonText: { color: Colors.white, fontSize: 14, fontWeight: '800' },
});
