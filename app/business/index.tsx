import React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { usePathname, useRouter } from 'expo-router';
import { Colors } from '../../src/theme/colors';
import GameCard from '../../src/components/GameCard';
import useGameStore from '../../src/store/gameStore';
import { formatCurrency } from '../../src/utils/format';
import { getLevelName, getBusinessType, getAutomationScore, getTotalBusinessValue } from '../../src/engine/businessEngine';
import { businessTypeImages } from '../../src/assets/progressionImages';
import { ACQUISITION_UNLOCK_NET_WORTH } from '../../src/engine/acquisitionEngine';

export default function BusinessPortfolioScreen() {
  const router = useRouter();
  const pathname = usePathname();
  const isBusinessTab = pathname === '/tabs/business';
  const businesses = useGameStore((s) => s?.businesses ?? []);
  const cash = useGameStore((s) => s?.cash ?? 0);
  const holdingCompanies = useGameStore((s) => s?.holdingCompanies ?? []);
  const getNetWorthValue = useGameStore((s) => s.getNetWorthValue);

  const netWorth = getNetWorthValue();
  const acquisitionsUnlocked = netWorth >= ACQUISITION_UNLOCK_NET_WORTH;
  const totalValue = getTotalBusinessValue(businesses);
  const totalWeeklyProfit = businesses.reduce((t, b) => t + (b?.lastWeekProfit ?? 0), 0);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        {isBusinessTab ? (
          <View style={{ width: 24 }} />
        ) : (
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
          </Pressable>
        )}
        <Text style={styles.headerTitle}>My Businesses</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {/* Summary */}
        <View style={styles.summaryRow}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Total Value</Text>
            <Text style={[styles.summaryValue, { color: Colors.primary }]}>{formatCurrency(totalValue)}</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Weekly Profit</Text>
            <Text style={[styles.summaryValue, { color: totalWeeklyProfit >= 0 ? Colors.primary : Colors.negative }]}>
              {totalWeeklyProfit >= 0 ? '+' : ''}{formatCurrency(totalWeeklyProfit)}
            </Text>
          </View>
        </View>

        <GameCard>
          <View style={styles.capitalHeader}>
            <View style={styles.capitalIcon}>
              <Ionicons name="layers" size={22} color={Colors.info} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.capitalTitle}>Capital Allocation</Text>
              <Text style={styles.capitalSub}>
                {acquisitionsUnlocked
                  ? 'Buy established companies and organize the dynasty under holding companies.'
                  : `Unlock M&A at ${formatCurrency(ACQUISITION_UNLOCK_NET_WORTH)} net worth.`}
              </Text>
            </View>
          </View>
          <View style={styles.capitalActions}>
            <Pressable
              style={[styles.capitalButton, !acquisitionsUnlocked && styles.capitalButtonLocked]}
              onPress={() => router.push('/business/acquisitions')}
            >
              <Ionicons name={acquisitionsUnlocked ? 'trending-up' : 'lock-closed'} size={17} color={acquisitionsUnlocked ? Colors.primary : Colors.textMuted} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.capitalButtonTitle, !acquisitionsUnlocked && { color: Colors.textMuted }]}>Acquisitions</Text>
                <Text style={styles.capitalButtonSub}>{acquisitionsUnlocked ? 'Browse M&A targets' : `${Math.min(100, Math.round(netWorth / ACQUISITION_UNLOCK_NET_WORTH * 100))}% unlocked`}</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
            </Pressable>
            <Pressable
              style={[styles.capitalButton, !acquisitionsUnlocked && styles.capitalButtonLocked]}
              onPress={() => router.push('/business/holdings')}
            >
              <Ionicons name="business" size={17} color={acquisitionsUnlocked ? Colors.warning : Colors.textMuted} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.capitalButtonTitle, !acquisitionsUnlocked && { color: Colors.textMuted }]}>Holdings</Text>
                <Text style={styles.capitalButtonSub}>{holdingCompanies.length} holding {holdingCompanies.length === 1 ? 'company' : 'companies'}</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
            </Pressable>
          </View>
        </GameCard>

        {/* Business List */}
        {businesses.length === 0 ? (
          <GameCard>
            <View style={styles.emptyState}>
              <Ionicons name="business-outline" size={48} color={Colors.textMuted} />
              <Text style={styles.emptyTitle}>No Businesses Yet</Text>
              <Text style={styles.emptySubtitle}>Start your first business and build an empire!</Text>
            </View>
          </GameCard>
        ) : (
          businesses.map((biz) => {
            const type = getBusinessType(biz.typeId);
            const automation = getAutomationScore(biz);
            return (
              <Pressable
                key={biz.id}
                onPress={() => router.push(`/business/${biz.id}`)}
                style={({ pressed }) => [{ transform: [{ scale: pressed ? 0.98 : 1 }] }]}
              >
                <GameCard>
                  <View style={styles.bizHeader}>
                    <Image source={businessTypeImages[biz.typeId]} style={styles.bizArtwork} resizeMode="contain" accessibilityLabel={`${type?.name ?? 'Business'} pixel art`} />
                    <View style={styles.bizInfo}>
                      <Text style={styles.bizName}>{biz.name}</Text>
                      <Text style={styles.bizLevel}>{getLevelName(biz.level)} • {type?.industry ?? ''}</Text>
                      {biz.familyBusiness?.isFamilyBusiness && (
                        <View style={styles.familyBadge}>
                          <Ionicons name="people" size={11} color={Colors.warning} />
                          <Text style={styles.familyBadgeText}>Family Business • G{biz.familyBusiness.generationsOwned}</Text>
                        </View>
                      )}
                      {biz.holdingCompanyId && (
                        <View style={styles.holdingBadge}>
                          <Ionicons name="layers" size={11} color={Colors.info} />
                          <Text style={styles.holdingBadgeText}>
                            {holdingCompanies.find((holding) => holding.id === biz.holdingCompanyId)?.name ?? 'Holding Company'}
                          </Text>
                        </View>
                      )}
                    </View>
                    <View style={styles.bizRight}>
                      {biz.pendingDecision && (
                        <View style={[styles.attentionBadge, biz.pendingDecision.kind === 'crisis' && styles.crisisAttention]}>
                          <Text style={styles.attentionText}>{biz.pendingDecision.kind === 'crisis' ? '!' : '•'}</Text>
                        </View>
                      )}
                      <Ionicons name="chevron-forward" size={20} color={Colors.textMuted} />
                    </View>
                  </View>

                  <View style={styles.bizStats}>
                    <View style={styles.bizStat}>
                      <Text style={styles.bizStatLabel}>Valuation</Text>
                      <Text style={[styles.bizStatValue, { color: Colors.info }]}>{formatCurrency(biz.valuation)}</Text>
                    </View>
                    <View style={styles.bizStat}>
                      <Text style={styles.bizStatLabel}>Weekly P&L</Text>
                      <Text style={[styles.bizStatValue, { color: (biz.lastWeekProfit ?? 0) >= 0 ? Colors.primary : Colors.negative }]}>
                        {(biz.lastWeekProfit ?? 0) >= 0 ? '+' : ''}{formatCurrency(biz.lastWeekProfit)}
                      </Text>
                    </View>
                    <View style={styles.bizStat}>
                      <Text style={styles.bizStatLabel}>Rep</Text>
                      <Text style={[styles.bizStatValue, { color: Colors.warning }]}>{Math.round(biz.reputation)}/100</Text>
                    </View>
                  </View>

                  {biz.pendingDecision && (
                    <View style={[styles.pendingStrip, biz.pendingDecision.kind === 'crisis' && styles.pendingStripCrisis]}>
                      <Text style={styles.pendingStripText}>
                        {biz.pendingDecision.kind === 'crisis' ? 'Crisis' : 'Decision'}: {biz.pendingDecision.title}
                      </Text>
                    </View>
                  )}

                  {/* Automation & Autopilot */}
                  <View style={styles.bottomRow}>
                    <View style={styles.automationBar}>
                      <Text style={styles.automationLabel}>Automation</Text>
                      <View style={styles.automationTrack}>
                        <View style={[styles.automationFill, { width: `${automation}%` }]} />
                      </View>
                      <Text style={styles.automationValue}>{automation}%</Text>
                    </View>
                  </View>
                </GameCard>
              </Pressable>
            );
          })
        )}

        {/* Start New Business Button */}
        <Pressable
          style={({ pressed }) => [styles.startButton, { transform: [{ scale: pressed ? 0.97 : 1 }] }]}
          onPress={() => router.push('/business/start')}
        >
          <Ionicons name="add-circle" size={22} color={Colors.white} />
          <Text style={styles.startButtonText}>Start New Business</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  headerTitle: { color: Colors.textPrimary, fontSize: 20, fontWeight: '700' },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 32 },
  summaryRow: { flexDirection: 'row', gap: 12, marginBottom: 4 },
  summaryCard: { flex: 1, backgroundColor: Colors.card, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: Colors.cardBorder },
  summaryLabel: { color: Colors.textSecondary, fontSize: 12, marginBottom: 4 },
  summaryValue: { fontSize: 18, fontWeight: '700' },
  emptyState: { alignItems: 'center', paddingVertical: 32 },
  emptyTitle: { color: Colors.textPrimary, fontSize: 18, fontWeight: '700', marginTop: 12 },
  emptySubtitle: { color: Colors.textSecondary, fontSize: 14, marginTop: 4, textAlign: 'center' },
  bizHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  bizIconWrap: { width: 40, height: 40, borderRadius: 10, backgroundColor: `${Colors.primary}20`, justifyContent: 'center', alignItems: 'center' },
  bizArtwork: { width: 58, height: 58 },
  bizInfo: { flex: 1 },
  bizName: { color: Colors.textPrimary, fontSize: 16, fontWeight: '700' },
  bizLevel: { color: Colors.textSecondary, fontSize: 12, marginTop: 2 },
  familyBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', marginTop: 4, paddingHorizontal: 6, paddingVertical: 3, borderRadius: 6, backgroundColor: `${Colors.warning}15` },
  familyBadgeText: { color: Colors.warning, fontSize: 9, fontWeight: '800' },
  holdingBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', marginTop: 4, paddingHorizontal: 6, paddingVertical: 3, borderRadius: 6, backgroundColor: '#17263A' },
  holdingBadgeText: { color: Colors.info, fontSize: 9, fontWeight: '800' },
  capitalHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  capitalIcon: { width: 40, height: 40, borderRadius: 10, backgroundColor: '#17263A', justifyContent: 'center', alignItems: 'center' },
  capitalTitle: { color: Colors.textPrimary, fontSize: 15, fontWeight: '800' },
  capitalSub: { color: Colors.textSecondary, fontSize: 11, lineHeight: 16, marginTop: 3 },
  capitalActions: { gap: 8, marginTop: 12 },
  capitalButton: { flexDirection: 'row', alignItems: 'center', gap: 9, minHeight: 48, borderWidth: 1, borderColor: Colors.cardBorder, backgroundColor: Colors.elevated, borderRadius: 10, paddingHorizontal: 11, paddingVertical: 9 },
  capitalButtonLocked: { opacity: 0.75 },
  capitalButtonTitle: { color: Colors.textPrimary, fontSize: 12, fontWeight: '800' },
  capitalButtonSub: { color: Colors.textMuted, fontSize: 9, marginTop: 2 },
  bizStats: { flexDirection: 'row', marginTop: 12, gap: 8 },
  bizStat: { flex: 1 },
  bizStatLabel: { color: Colors.textMuted, fontSize: 11 },
  bizStatValue: { fontSize: 14, fontWeight: '700', marginTop: 2 },
  bizRight: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  attentionBadge: { width: 20, height: 20, borderRadius: 10, backgroundColor: `${Colors.warning}22`, borderWidth: 1, borderColor: Colors.warning, alignItems: 'center', justifyContent: 'center' },
  crisisAttention: { backgroundColor: `${Colors.negative}22`, borderColor: Colors.negative },
  attentionText: { color: Colors.white, fontSize: 11, fontWeight: '900' },
  pendingStrip: { backgroundColor: `${Colors.warning}10`, borderRadius: 7, paddingHorizontal: 8, paddingVertical: 6, marginTop: 9 },
  pendingStripCrisis: { backgroundColor: `${Colors.negative}10` },
  pendingStripText: { color: Colors.textSecondary, fontSize: 10, fontWeight: '700' },
  bottomRow: { flexDirection: 'row', alignItems: 'center', marginTop: 10, gap: 8 },
  automationBar: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 },
  automationLabel: { color: Colors.textMuted, fontSize: 11 },
  automationTrack: { flex: 1, height: 4, backgroundColor: Colors.elevated, borderRadius: 2 },
  automationFill: { height: 4, backgroundColor: Colors.primary, borderRadius: 2 },
  automationValue: { color: Colors.textSecondary, fontSize: 11, fontWeight: '600', width: 30, textAlign: 'right' },
  startButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: Colors.primary, borderRadius: 14, padding: 16, marginTop: 8 },
  startButtonText: { color: Colors.white, fontSize: 16, fontWeight: '700' },
});
