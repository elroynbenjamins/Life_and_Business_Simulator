import React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors } from '../src/theme/colors';
import GameCard from '../src/components/GameCard';
import useGameStore from '../src/store/gameStore';
import { formatCurrency } from '../src/utils/format';
import { inflated } from '../src/engine/economyEngine';
import { getTotalPropertyValue } from '../src/engine/propertyEngine';
import propertiesData from '../src/data/properties.json';
import { showGameDialog } from '../src/components/GameDialog';

export default function PropertiesScreen() {
  const router = useRouter();
  const cash = useGameStore((s) => s?.cash ?? 0);
  const properties = useGameStore((s) => s?.properties ?? []);
  const inflationMultiplier = useGameStore((s) => s?.inflationMultiplier ?? 1);
  const buyProperty = useGameStore((s) => s?.buyProperty);
  const sellProperty = useGameStore((s) => s?.sellProperty);
  const togglePropertyRental = useGameStore((s) => s?.togglePropertyRental);
  const renovatePropertyAction = useGameStore((s) => s?.renovatePropertyAction);

  const totalValue = getTotalPropertyValue(properties);
  const weeklyIncome = properties.filter((p) => p.isRentedOut).reduce((t, p) => t + (p.weeklyIncome ?? 0), 0);

  const confirmAction = (title: string, msg: string, action: () => void) => {
    showGameDialog({ title, message: msg, onConfirm: action });
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>Real Estate</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {/* Portfolio Summary */}
        <GameCard style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Portfolio Value</Text>
          <Text style={styles.summaryValue}>{formatCurrency(totalValue)}</Text>
          <Text style={styles.summaryCaption}>{properties.length} properties | {formatCurrency(weeklyIncome)}/week income</Text>
        </GameCard>

        {/* Owned Properties */}
        {properties.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>My Properties</Text>
            {properties.map((prop) => (
              <GameCard key={prop.id} style={styles.propCard}>
                <View style={styles.propHeader}>
                  <View>
                    <Text style={styles.propName}>{prop.name}</Text>
                    <Text style={styles.propType}>{prop.isRenovated ? '✨ Renovated' : ''} {prop.isRentedOut ? '🔑 Rented Out' : '🏠 Vacant'}</Text>
                  </View>
                  <Text style={styles.propValue}>{formatCurrency(prop.currentValue)}</Text>
                </View>
                <View style={styles.propStats}>
                  <Text style={styles.propStat}>Bought: {formatCurrency(prop.purchasePrice)}</Text>
                  <Text style={[styles.propStat, { color: Colors.primary }]}>
                    {prop.isRentedOut ? `+${formatCurrency(prop.weeklyIncome)}/wk` : 'Not rented'}
                  </Text>
                  <Text style={styles.propStat}>Maint: {formatCurrency(prop.weeklyMaintenance)}/wk</Text>
                </View>
                <View style={styles.propActions}>
                  <Pressable style={styles.actionBtn} onPress={() => togglePropertyRental?.(prop.id)}>
                    <Text style={styles.actionBtnText}>{prop.isRentedOut ? 'Stop Renting' : 'Rent Out'}</Text>
                  </Pressable>
                  {!prop.isRenovated && (
                    <Pressable
                      style={[styles.actionBtn, styles.renovateBtn]}
                      onPress={() => {
                        const typeData = (propertiesData as any[]).find((p) => p?.id === prop.typeId);
                        const cost = inflated(typeData?.renovationCost ?? 0, inflationMultiplier);
                        confirmAction('Renovate', `Cost: ${formatCurrency(cost)}`, () => renovatePropertyAction?.(prop.id));
                      }}
                    >
                      <Text style={styles.actionBtnText}>Renovate</Text>
                    </Pressable>
                  )}
                  <Pressable
                    style={[styles.actionBtn, styles.sellBtn]}
                    onPress={() => confirmAction('Sell Property', `Sell for ${formatCurrency(prop.currentValue)}?`, () => sellProperty?.(prop.id))}
                  >
                    <Text style={styles.actionBtnText}>Sell</Text>
                  </Pressable>
                </View>
              </GameCard>
            ))}
          </>
        )}

        {/* Buy Properties */}
        <Text style={[styles.sectionTitle, { marginTop: 16 }]}>Buy Property</Text>
        {(propertiesData as any[]).map((prop) => {
          const price = inflated(prop.purchasePrice, inflationMultiplier);
          const canAfford = cash >= price;
          return (
            <GameCard key={prop.id} style={styles.propCard}>
              <View style={styles.propHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.propName}>{prop.name}</Text>
                  <Text style={styles.propDesc}>{prop.description}</Text>
                </View>
              </View>
              <View style={styles.propStats}>
                <Text style={styles.propStat}>Price: {formatCurrency(price)}</Text>
                <Text style={[styles.propStat, { color: Colors.primary }]}>Income: {formatCurrency(prop.weeklyRentalIncome)}/wk</Text>
                <Text style={styles.propStat}>Maint: {formatCurrency(prop.weeklyMaintenance)}/wk</Text>
              </View>
              <Pressable
                style={[styles.buyBtn, !canAfford && styles.buyBtnDisabled]}
                onPress={() => canAfford && confirmAction('Buy Property', `Purchase ${prop.name} for ${formatCurrency(price)}?`, () => buyProperty?.(prop.id))}
                disabled={!canAfford}
              >
                <Text style={styles.buyBtnText}>{canAfford ? `Buy ${formatCurrency(price)}` : 'Cannot Afford'}</Text>
              </Pressable>
            </GameCard>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  headerTitle: { color: Colors.textPrimary, fontSize: 20, fontWeight: '700' },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 40 },
  summaryCard: { marginBottom: 16 },
  summaryLabel: { color: Colors.textSecondary, fontSize: 13 },
  summaryValue: { color: Colors.primary, fontSize: 28, fontWeight: '700', marginTop: 4 },
  summaryCaption: { color: Colors.textMuted, fontSize: 12, marginTop: 4 },
  sectionTitle: { color: Colors.textPrimary, fontSize: 18, fontWeight: '700', marginBottom: 12 },
  propCard: { marginBottom: 12 },
  propHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  propName: { color: Colors.textPrimary, fontSize: 16, fontWeight: '600' },
  propType: { color: Colors.textSecondary, fontSize: 12, marginTop: 2 },
  propDesc: { color: Colors.textMuted, fontSize: 12, marginTop: 4 },
  propValue: { color: Colors.primary, fontSize: 18, fontWeight: '700' },
  propStats: { flexDirection: 'row', gap: 12, marginTop: 8, flexWrap: 'wrap' },
  propStat: { color: Colors.textSecondary, fontSize: 12 },
  propActions: { flexDirection: 'row', gap: 8, marginTop: 12 },
  actionBtn: { flex: 1, backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.cardBorder, borderRadius: 8, paddingVertical: 8, alignItems: 'center' },
  renovateBtn: { borderColor: '#F59E0B' },
  sellBtn: { borderColor: Colors.negative },
  actionBtnText: { color: Colors.textPrimary, fontSize: 13, fontWeight: '600' },
  buyBtn: { backgroundColor: Colors.primary, borderRadius: 10, paddingVertical: 12, alignItems: 'center', marginTop: 12 },
  buyBtnDisabled: { backgroundColor: Colors.cardBorder, opacity: 0.5 },
  buyBtnText: { color: Colors.white, fontSize: 14, fontWeight: '700' },
});
