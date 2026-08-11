import React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors } from '../../src/theme/colors';
import GameCard from '../../src/components/GameCard';
import useGameStore from '../../src/store/gameStore';
import { formatCurrency } from '../../src/utils/format';
import { getLevelName, getBusinessType, getAutomationScore, getTotalBusinessValue } from '../../src/engine/businessEngine';

export default function BusinessPortfolioScreen() {
  const router = useRouter();
  const businesses = useGameStore((s) => s?.businesses ?? []);
  const cash = useGameStore((s) => s?.cash ?? 0);

  const totalValue = getTotalBusinessValue(businesses);
  const totalWeeklyProfit = businesses.reduce((t, b) => t + (b?.lastWeekProfit ?? 0), 0);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
        </Pressable>
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
                    <View style={styles.bizIconWrap}>
                      <Ionicons name={(type?.icon as any) ?? 'business'} size={24} color={Colors.primary} />
                    </View>
                    <View style={styles.bizInfo}>
                      <Text style={styles.bizName}>{biz.name}</Text>
                      <Text style={styles.bizLevel}>{getLevelName(biz.level)} • {type?.industry ?? ''}</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color={Colors.textMuted} />
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
  bizInfo: { flex: 1 },
  bizName: { color: Colors.textPrimary, fontSize: 16, fontWeight: '700' },
  bizLevel: { color: Colors.textSecondary, fontSize: 12, marginTop: 2 },
  bizStats: { flexDirection: 'row', marginTop: 12, gap: 8 },
  bizStat: { flex: 1 },
  bizStatLabel: { color: Colors.textMuted, fontSize: 11 },
  bizStatValue: { fontSize: 14, fontWeight: '700', marginTop: 2 },
  bottomRow: { flexDirection: 'row', alignItems: 'center', marginTop: 10, gap: 8 },
  automationBar: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 },
  automationLabel: { color: Colors.textMuted, fontSize: 11 },
  automationTrack: { flex: 1, height: 4, backgroundColor: Colors.elevated, borderRadius: 2 },
  automationFill: { height: 4, backgroundColor: Colors.primary, borderRadius: 2 },
  automationValue: { color: Colors.textSecondary, fontSize: 11, fontWeight: '600', width: 30, textAlign: 'right' },
  startButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: Colors.primary, borderRadius: 14, padding: 16, marginTop: 8 },
  startButtonText: { color: Colors.white, fontSize: 16, fontWeight: '700' },
});
