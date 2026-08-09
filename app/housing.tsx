import React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Alert, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../src/theme/colors';
import GameStatusBar from '../src/components/StatusBar';
import GameCard from '../src/components/GameCard';
import StatusPill from '../src/components/StatusPill';
import useGameStore from '../src/store/gameStore';
import { formatCurrency } from '../src/utils/format';
import { getWeeklyUtilityCost } from '../src/engine/financeEngine';
import { inflated } from '../src/engine/economyEngine';
import housingData from '../src/data/housing.json';
import carsData from '../src/data/cars.json';
import foodData from '../src/data/food.json';
// house upgrades removed

const UTILITY_BASE: Record<string, number> = {
  cheap_apartment: 25,
  studio_apartment: 35,
  small_house: 50,
  family_house: 70,
  luxury_villa: 120,
  mansion: 200,
};

export default function LifestyleScreen() {
  const router = useRouter();
  const currentHousingId = useGameStore((s) => s?.currentHousingId);
  const currentCarId = useGameStore((s) => s?.currentCarId ?? 'none');
  const foodLevel = useGameStore((s) => s?.foodLevel ?? 'basic');
  const cash = useGameStore((s) => s?.cash ?? 0);
  const inflationMultiplier = useGameStore((s) => s?.inflationMultiplier ?? 1);
  const changeHousing = useGameStore((s) => s?.changeHousing);
  const changeCar = useGameStore((s) => s?.changeCar);
  const changeFoodLevel = useGameStore((s) => s?.changeFoodLevel);
  // buyHouseUpgrade removed

  const currentHIdx = (housingData ?? []).findIndex((h) => h?.id === currentHousingId);

  const handleHousing = (h: (typeof housingData)[0]) => {
    const idx = (housingData ?? []).findIndex((hh) => hh?.id === h?.id);
    const dir = idx > currentHIdx ? 'Upgrade' : 'Downgrade';
    const utilCost = inflated(UTILITY_BASE[h?.id] ?? 25, inflationMultiplier);
    const message = `${dir} to ${h?.name}? Rent: ${formatCurrency(inflated(h?.weeklyRent, inflationMultiplier))}/week + Utilities: ${formatCurrency(utilCost)}/week.`;
    if (Platform.OS === 'web') {
      if (window.confirm(`${dir} Housing: ${message}`)) changeHousing?.(h?.id);
      return;
    }
    Alert.alert(
      `${dir} Housing`, message,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: dir, onPress: () => changeHousing?.(h?.id) },
      ]
    );
  };

  const handleCar = (c: (typeof carsData)[0]) => {
    const oldCar = (carsData ?? []).find((cc) => cc?.id === currentCarId);
    const tradeIn = Math.round(((oldCar?.purchaseCost ?? 0) * 0.4));
    const inflatedPurchase = inflated(c?.purchaseCost ?? 0, inflationMultiplier);
    const cost = inflatedPurchase - tradeIn;
    const desc = tradeIn > 0 ? `Trade-in: ${formatCurrency(tradeIn)}. Net cost: ${formatCurrency(cost)}.` : `Cost: ${formatCurrency(inflatedPurchase)}.`;
    const message = `Get a ${c?.name}? ${desc} Running cost: ${formatCurrency(inflated(c?.weeklyCost ?? 0, inflationMultiplier))}/week.`;
    if (Platform.OS === 'web') {
      if (window.confirm(`Change Vehicle: ${message}`)) changeCar?.(c?.id);
      return;
    }
    Alert.alert('Change Vehicle', message, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Buy', onPress: () => changeCar?.(c?.id) },
    ]);
  };

  const handleFood = (f: (typeof foodData)[0]) => {
    changeFoodLevel?.(f?.id);
  };

  // handleUpgrade removed

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>Lifestyle</Text>
      </View>
      <GameStatusBar />
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {/* HOUSING */}
        <Text style={styles.sectionHeader}>🏠 Housing</Text>
        {(housingData ?? []).map((h, idx) => {
          const isCurrent = h?.id === currentHousingId;
          const isUpgrade = idx > currentHIdx;
          const utilBase = UTILITY_BASE[h?.id] ?? 25;
          const utilCost = inflated(utilBase, inflationMultiplier);
          return (
            <GameCard key={h?.id}>
              <View style={styles.row}>
                <View style={styles.info}>
                  <Text style={styles.name}>{h?.name}</Text>
                  <Text style={styles.cost}>{formatCurrency(inflated(h?.weeklyRent, inflationMultiplier))}/week rent</Text>
                  <Text style={styles.utilityCost}>⚡ Utilities: {formatCurrency(utilCost)}/week</Text>
                  {/* happiness hidden */}
                </View>
                {isCurrent ? <StatusPill label="Current" color={Colors.info} /> : null}
              </View>
              {!isCurrent && (
                <Pressable style={[styles.actionBtn, { borderColor: isUpgrade ? Colors.primary : Colors.warning }]} onPress={() => handleHousing(h)}>
                  <Text style={[styles.actionText, { color: isUpgrade ? Colors.primary : Colors.warning }]}>{isUpgrade ? 'Upgrade' : 'Downgrade'}</Text>
                </Pressable>
              )}
            </GameCard>
          );
        })}

        {/* CARS */}
        <Text style={styles.sectionHeader}>🚗 Vehicle</Text>
        {(carsData ?? []).map((c) => {
          const isCurrent = c?.id === currentCarId;
          const oldCar = (carsData ?? []).find((cc) => cc?.id === currentCarId);
          const tradeIn = Math.round(((oldCar?.purchaseCost ?? 0) * 0.4));
          const inflatedPurchase = inflated(c?.purchaseCost ?? 0, inflationMultiplier);
          const netCost = inflatedPurchase - tradeIn;
          const canAfford = cash >= netCost;
          return (
            <GameCard key={c?.id}>
              <View style={styles.row}>
                <View style={styles.info}>
                  <Text style={styles.name}>{c?.name}</Text>
                  <Text style={styles.desc}>{c?.description}</Text>
                  <Text style={styles.cost}>{(c?.weeklyCost ?? 0) > 0 ? `${formatCurrency(inflated(c?.weeklyCost ?? 0, inflationMultiplier))}/week` : 'Free'}</Text>
                  {(c?.purchaseCost ?? 0) > 0 && <Text style={styles.happinessText}>Buy: {formatCurrency(inflatedPurchase)}</Text>}
                </View>
                {isCurrent ? <StatusPill label="Current" color={Colors.info} /> : null}
              </View>
              {!isCurrent && c?.id !== 'none' && canAfford && (
                <Pressable style={[styles.actionBtn, { borderColor: Colors.primary }]} onPress={() => handleCar(c)}>
                  <Text style={[styles.actionText, { color: Colors.primary }]}>Buy{tradeIn > 0 ? ` (Net: ${formatCurrency(netCost)})` : ''}</Text>
                </Pressable>
              )}
              {!isCurrent && c?.id !== 'none' && !canAfford && <Text style={styles.cantAfford}>Can't afford</Text>}
              {!isCurrent && c?.id === 'none' && currentCarId !== 'none' && (
                <Pressable style={[styles.actionBtn, { borderColor: Colors.warning }]} onPress={() => changeCar?.('none')}>
                  <Text style={[styles.actionText, { color: Colors.warning }]}>Sell Car</Text>
                </Pressable>
              )}
            </GameCard>
          );
        })}

        {/* FOOD */}
        <Text style={styles.sectionHeader}>🍔 Food Allowance</Text>
        {(foodData ?? []).map((f) => {
          const isCurrent = f?.id === foodLevel;
          return (
            <GameCard key={f?.id}>
              <View style={styles.row}>
                <View style={styles.info}>
                  <Text style={styles.name}>{f?.name}</Text>
                  <Text style={styles.desc}>{f?.description}</Text>
                  <Text style={styles.cost}>{formatCurrency(inflated(f?.weeklyCost ?? 0, inflationMultiplier))}/week</Text>
                  {/* happiness hidden */}
                </View>
                {isCurrent ? <StatusPill label="Current" color={Colors.info} /> : null}
              </View>
              {!isCurrent && (
                <Pressable style={[styles.actionBtn, { borderColor: Colors.primary }]} onPress={() => handleFood(f)}>
                  <Text style={[styles.actionText, { color: Colors.primary }]}>Select</Text>
                </Pressable>
              )}
            </GameCard>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12 },
  headerTitle: { color: Colors.textPrimary, fontSize: 20, fontWeight: '700' },
  scroll: { flex: 1 },
  scrollContent: { padding: 16 },
  sectionHeader: { color: Colors.textPrimary, fontSize: 18, fontWeight: '700', marginTop: 16, marginBottom: 12 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  info: { flex: 1 },
  name: { color: Colors.textPrimary, fontSize: 16, fontWeight: '700' },
  cost: { color: Colors.primary, fontSize: 14, fontWeight: '600', marginTop: 4 },
  utilityCost: { color: Colors.info, fontSize: 13, marginTop: 2 },
  desc: { color: Colors.textMuted, fontSize: 12, marginTop: 2 },
  happinessText: { color: Colors.happiness, fontSize: 12, marginTop: 2 },
  actionBtn: { borderWidth: 1, borderRadius: 8, paddingVertical: 10, alignItems: 'center', marginTop: 10 },
  actionText: { fontWeight: '600', fontSize: 14 },
  cantAfford: { color: Colors.textMuted, fontSize: 12, marginTop: 8, fontStyle: 'italic' },
});
