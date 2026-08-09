import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, Alert, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors } from '../../src/theme/colors';
import GameCard from '../../src/components/GameCard';
import useGameStore from '../../src/store/gameStore';
import { formatCurrency } from '../../src/utils/format';
import { inflated } from '../../src/engine/economyEngine';
import businessTypesData from '../../src/data/business_types.json';

const INDUSTRIES = [...new Set((businessTypesData ?? []).map((t) => t.industry))];

export default function StartBusinessScreen() {
  const router = useRouter();
  const cash = useGameStore((s) => s?.cash ?? 0);
  const inflationMultiplier = useGameStore((s) => s?.inflationMultiplier ?? 1);
  const foundBusiness = useGameStore((s) => s?.foundBusiness);
  const [selectedIndustry, setSelectedIndustry] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [customName, setCustomName] = useState('');

  const filteredTypes = selectedIndustry
    ? (businessTypesData ?? []).filter((t) => t.industry === selectedIndustry)
    : (businessTypesData ?? []);

  const selectedBizType = selectedType ? (businessTypesData ?? []).find((t) => t.id === selectedType) : null;
  const startupCost = selectedBizType ? inflated(selectedBizType.startupCost ?? 0, inflationMultiplier) : 0;
  const canAfford = cash >= startupCost;

  const handleFound = () => {
    if (!selectedType || !canAfford) return;
    foundBusiness?.(selectedType, customName || null);
    if (Platform.OS === 'web') {
      router.back();
    } else {
      router.back();
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>Start a Business</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <Text style={styles.sectionTitle}>Available Cash: <Text style={{ color: Colors.primary }}>{formatCurrency(cash)}</Text></Text>

        {/* Industry Filter */}
        <Text style={styles.label}>Industry</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
          <Pressable
            style={[styles.filterChip, !selectedIndustry && styles.filterChipActive]}
            onPress={() => setSelectedIndustry(null)}
          >
            <Text style={[styles.filterChipText, !selectedIndustry && styles.filterChipTextActive]}>All</Text>
          </Pressable>
          {INDUSTRIES.map((ind) => (
            <Pressable
              key={ind}
              style={[styles.filterChip, selectedIndustry === ind && styles.filterChipActive]}
              onPress={() => { setSelectedIndustry(ind); setSelectedType(null); }}
            >
              <Text style={[styles.filterChipText, selectedIndustry === ind && styles.filterChipTextActive]}>{ind}</Text>
            </Pressable>
          ))}
        </ScrollView>

        {/* Business Types */}
        <Text style={styles.label}>Choose Business Type</Text>
        {filteredTypes.map((type) => {
          const cost = inflated(type.startupCost ?? 0, inflationMultiplier);
          const affordable = cash >= cost;
          const isSelected = selectedType === type.id;
          return (
            <Pressable
              key={type.id}
              onPress={() => setSelectedType(type.id)}
              style={({ pressed }) => [{ transform: [{ scale: pressed ? 0.98 : 1 }] }]}
            >
              <GameCard style={[styles.typeCard, isSelected && styles.typeCardSelected]}>
                <View style={styles.typeHeader}>
                  <View style={[styles.typeIcon, isSelected && { backgroundColor: `${Colors.primary}30` }]}>
                    <Ionicons name={(type.icon as any) ?? 'business'} size={22} color={isSelected ? Colors.primary : Colors.textSecondary} />
                  </View>
                  <View style={styles.typeInfo}>
                    <Text style={styles.typeName}>{type.name}</Text>
                    <Text style={styles.typeIndustry}>{type.industry}</Text>
                  </View>
                  <View style={styles.typeCostWrap}>
                    <Text style={[styles.typeCost, { color: affordable ? Colors.primary : Colors.negative }]}>{formatCurrency(cost)}</Text>
                    {!affordable && <Text style={styles.cantAfford}>Can't afford</Text>}
                  </View>
                </View>
                <Text style={styles.typeDesc}>{type.description}</Text>
                <View style={styles.typeStats}>
                  <MiniStat label="Revenue" value={`${formatCurrency(type.baseWeeklyRevenue)}/wk`} />
                  <MiniStat label="Expenses" value={`${formatCurrency(type.baseWeeklyExpenses)}/wk`} />
                  <MiniStat label="Max Staff" value={`${type.maxEmployees}`} />
                </View>
              </GameCard>
            </Pressable>
          );
        })}

        {/* Custom Name & Confirm */}
        {selectedBizType && (
          <View style={styles.confirmSection}>
            <View style={styles.staffWarning}>
              <Ionicons name="information-circle" size={16} color={Colors.warning} />
              <Text style={styles.staffWarningText}>
                You must hire at least 3 employees before the business can start earning revenue.
              </Text>
            </View>
            <Text style={styles.label}>Business Name (optional)</Text>
            <TextInput
              style={styles.nameInput}
              placeholder={selectedBizType.name}
              placeholderTextColor={Colors.textMuted}
              value={customName}
              onChangeText={setCustomName}
              maxLength={30}
            />
            <View style={styles.confirmDetails}>
              <View style={styles.confirmRow}>
                <Text style={styles.confirmLabel}>Startup Cost</Text>
                <Text style={[styles.confirmValue, { color: canAfford ? Colors.primary : Colors.negative }]}>{formatCurrency(startupCost)}</Text>
              </View>
              <View style={styles.confirmRow}>
                <Text style={styles.confirmLabel}>After Purchase</Text>
                <Text style={[styles.confirmValue, { color: (cash - startupCost) >= 0 ? Colors.textPrimary : Colors.negative }]}>{formatCurrency(cash - startupCost)}</Text>
              </View>
            </View>
            <Pressable
              style={[styles.foundButton, !canAfford && styles.foundButtonDisabled]}
              onPress={handleFound}
              disabled={!canAfford}
            >
              <Ionicons name="rocket" size={20} color={Colors.white} />
              <Text style={styles.foundButtonText}>Found Business</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.miniStat}>
      <Text style={styles.miniStatLabel}>{label}</Text>
      <Text style={styles.miniStatValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  headerTitle: { color: Colors.textPrimary, fontSize: 20, fontWeight: '700' },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 32 },
  sectionTitle: { color: Colors.textPrimary, fontSize: 16, fontWeight: '600', marginBottom: 12 },
  label: { color: Colors.textSecondary, fontSize: 13, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1, marginTop: 16, marginBottom: 8 },
  filterScroll: { marginBottom: 4 },
  filterChip: { backgroundColor: Colors.card, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8, marginRight: 8, borderWidth: 1, borderColor: Colors.cardBorder },
  filterChipActive: { backgroundColor: `${Colors.primary}20`, borderColor: Colors.primary },
  filterChipText: { color: Colors.textSecondary, fontSize: 13, fontWeight: '500' },
  filterChipTextActive: { color: Colors.primary },
  typeCard: { borderWidth: 1, borderColor: Colors.cardBorder },
  typeCardSelected: { borderColor: Colors.primary, borderWidth: 1.5 },
  typeHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  typeIcon: { width: 40, height: 40, borderRadius: 10, backgroundColor: Colors.elevated, justifyContent: 'center', alignItems: 'center' },
  typeInfo: { flex: 1 },
  typeName: { color: Colors.textPrimary, fontSize: 15, fontWeight: '700' },
  typeIndustry: { color: Colors.textMuted, fontSize: 12 },
  typeCostWrap: { alignItems: 'flex-end' },
  typeCost: { fontSize: 15, fontWeight: '700' },
  cantAfford: { color: Colors.negative, fontSize: 10, marginTop: 2 },
  typeDesc: { color: Colors.textSecondary, fontSize: 13, marginTop: 8, lineHeight: 18 },
  typeStats: { flexDirection: 'row', marginTop: 10, gap: 12 },
  miniStat: { flex: 1 },
  miniStatLabel: { color: Colors.textMuted, fontSize: 11 },
  miniStatValue: { color: Colors.textPrimary, fontSize: 13, fontWeight: '600', marginTop: 2 },
  staffWarning: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: `${Colors.warning}15`, borderRadius: 10, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: `${Colors.warning}30` },
  staffWarningText: { color: Colors.warning, fontSize: 12, fontWeight: '500', flex: 1 },
  confirmSection: { marginTop: 8 },
  nameInput: { backgroundColor: Colors.card, borderRadius: 10, padding: 14, color: Colors.textPrimary, fontSize: 15, borderWidth: 1, borderColor: Colors.cardBorder },
  confirmDetails: { backgroundColor: Colors.card, borderRadius: 10, padding: 14, marginTop: 12, borderWidth: 1, borderColor: Colors.cardBorder },
  confirmRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  confirmLabel: { color: Colors.textSecondary, fontSize: 14 },
  confirmValue: { fontSize: 14, fontWeight: '700' },
  foundButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: Colors.primary, borderRadius: 14, padding: 16, marginTop: 16 },
  foundButtonDisabled: { backgroundColor: Colors.textMuted, opacity: 0.5 },
  foundButtonText: { color: Colors.white, fontSize: 16, fontWeight: '700' },
});
