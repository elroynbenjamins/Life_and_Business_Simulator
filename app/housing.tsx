import React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../src/theme/colors';
import GameStatusBar from '../src/components/StatusBar';
import GameCard from '../src/components/GameCard';
import StatusPill from '../src/components/StatusPill';
import useGameStore from '../src/store/gameStore';
import { formatCurrency } from '../src/utils/format';
import housingData from '../src/data/housing.json';
import carsData from '../src/data/cars.json';
import foodData from '../src/data/food.json';
import houseUpgradesData from '../src/data/house_upgrades.json';

export default function LifestyleScreen() {
  const router = useRouter();
  const currentHousingId = useGameStore((s) => s?.currentHousingId);
  const currentCarId = useGameStore((s) => s?.currentCarId ?? 'none');
  const foodLevel = useGameStore((s) => s?.foodLevel ?? 'basic');
  const houseUpgrades = useGameStore((s) => s?.houseUpgrades ?? []);
  const cash = useGameStore((s) => s?.cash ?? 0);
  const changeHousing = useGameStore((s) => s?.changeHousing);
  const changeCar = useGameStore((s) => s?.changeCar);
  const changeFoodLevel = useGameStore((s) => s?.changeFoodLevel);
  const buyHouseUpgrade = useGameStore((s) => s?.buyHouseUpgrade);

  const currentHIdx = (housingData ?? []).findIndex((h) => h?.id === currentHousingId);
  const currentCar = (carsData ?? []).find((c) => c?.id === currentCarId);

  const handleHousing = (h: (typeof housingData)[0]) => {
    const idx = (housingData ?? []).findIndex((hh) => hh?.id === h?.id);
    const dir = idx > currentHIdx ? 'Upgrade' : 'Downgrade';
    const upgradeWarning = (houseUpgrades?.length ?? 0) > 0 ? '\n\nWarning: Moving will reset your house upgrades!' : '';
    Alert.alert(`${dir} Housing`, `${dir} to ${h?.name}? Rent: ${formatCurrency(h?.weeklyRent)}/week.${upgradeWarning}`, [
      { text: 'Cancel', style: 'cancel' },
      { text: dir, onPress: () => changeHousing?.(h?.id) },
    ]);
  };

  const handleCar = (c: (typeof carsData)[0]) => {
    const oldCar = (carsData ?? []).find((cc) => cc?.id === currentCarId);
    const tradeIn = Math.round(((oldCar?.purchaseCost ?? 0) * 0.4));
    const cost = (c?.purchaseCost ?? 0) - tradeIn;
    const desc = tradeIn > 0 ? `Trade-in: ${formatCurrency(tradeIn)}. Net cost: ${formatCurrency(cost)}.` : `Cost: ${formatCurrency(c?.purchaseCost)}.`;
    Alert.alert('Change Vehicle', `Get a ${c?.name}? ${desc} Running cost: ${formatCurrency(c?.weeklyCost)}/week.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Buy', onPress: () => changeCar?.(c?.id) },
    ]);
  };

  const handleFood = (f: (typeof foodData)[0]) => {
    changeFoodLevel?.(f?.id);
  };

  const handleUpgrade = (u: (typeof houseUpgradesData)[0]) => {
    Alert.alert('Buy Upgrade', `${u?.name} for ${formatCurrency(u?.cost)}? +${u?.happiness} happiness.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Buy', onPress: () => buyHouseUpgrade?.(u?.id) },
    ]);
  };

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
          return (
            <GameCard key={h?.id}>
              <View style={styles.row}>
                <View style={styles.info}>
                  <Text style={styles.name}>{h?.name}</Text>
                  <Text style={styles.cost}>{formatCurrency(h?.weeklyRent)}/week</Text>
                  <Text style={styles.happinessText}>+{h?.happiness ?? 0} happiness</Text>
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

        {/* HOUSE UPGRADES */}
        <Text style={styles.sectionHeader}>🛠 House Upgrades</Text>
        {(houseUpgradesData ?? []).map((u) => {
          const owned = houseUpgrades.includes(u?.id);
          const canAfford = cash >= (u?.cost ?? 0);
          return (
            <GameCard key={u?.id}>
              <View style={styles.row}>
                <View style={styles.info}>
                  <Text style={styles.name}>{u?.name}</Text>
                  <Text style={styles.desc}>{u?.description}</Text>
                  <Text style={styles.happinessText}>+{u?.happiness} happiness | {formatCurrency(u?.cost)}</Text>
                </View>
                {owned ? <StatusPill label="✅ Owned" color={Colors.primary} /> : null}
              </View>
              {!owned && canAfford && (
                <Pressable style={[styles.actionBtn, { borderColor: Colors.primary }]} onPress={() => handleUpgrade(u)}>
                  <Text style={[styles.actionText, { color: Colors.primary }]}>Buy — {formatCurrency(u?.cost)}</Text>
                </Pressable>
              )}
              {!owned && !canAfford && <Text style={styles.cantAfford}>Can't afford</Text>}
            </GameCard>
          );
        })}

        {/* CARS */}
        <Text style={styles.sectionHeader}>🚗 Vehicle</Text>
        {(carsData ?? []).map((c) => {
          const isCurrent = c?.id === currentCarId;
          const oldCar = (carsData ?? []).find((cc) => cc?.id === currentCarId);
          const tradeIn = Math.round(((oldCar?.purchaseCost ?? 0) * 0.4));
          const netCost = (c?.purchaseCost ?? 0) - tradeIn;
          const canAfford = cash >= netCost;
          return (
            <GameCard key={c?.id}>
              <View style={styles.row}>
                <View style={styles.info}>
                  <Text style={styles.name}>{c?.name}</Text>
                  <Text style={styles.desc}>{c?.description}</Text>
                  <Text style={styles.cost}>{(c?.weeklyCost ?? 0) > 0 ? `${formatCurrency(c?.weeklyCost)}/week` : 'Free'}</Text>
                  <Text style={styles.happinessText}>+{c?.happiness} happiness{(c?.purchaseCost ?? 0) > 0 ? ` | Buy: ${formatCurrency(c?.purchaseCost)}` : ''}</Text>
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
                  <Text style={styles.cost}>{formatCurrency(f?.weeklyCost)}/week</Text>
                  <Text style={styles.happinessText}>+{f?.happiness} happiness</Text>
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
  desc: { color: Colors.textMuted, fontSize: 12, marginTop: 2 },
  happinessText: { color: Colors.happiness, fontSize: 12, marginTop: 2 },
  actionBtn: { borderWidth: 1, borderRadius: 8, paddingVertical: 10, alignItems: 'center', marginTop: 10 },
  actionText: { fontWeight: '600', fontSize: 14 },
  cantAfford: { color: Colors.textMuted, fontSize: 12, marginTop: 8, fontStyle: 'italic' },
});
