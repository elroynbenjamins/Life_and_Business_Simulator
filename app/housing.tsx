import React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../src/theme/colors';
import ScreenHeader from '../src/components/ScreenHeader';
import GameCard from '../src/components/GameCard';
import StatusPill from '../src/components/StatusPill';
import GameButton from '../src/components/GameButton';
import useGameStore from '../src/store/gameStore';
import { formatCurrency } from '../src/utils/format';
import { inflated } from '../src/engine/economyEngine';
import { getHouseholdSize, getHousingCapacity } from '../src/engine/relationshipEngine';
import housingData from '../src/data/housing.json';
import carsData from '../src/data/cars.json';
import { showGameDialog } from '../src/components/GameDialog';
import { carItemImages, housingItemImages } from '../src/assets/itemImages';
// house upgrades removed

export default function LifestyleScreen() {
  const router = useRouter();
  const currentHousingId = useGameStore((s) => s?.currentHousingId);
  const currentCarId = useGameStore((s) => s?.currentCarId ?? 'none');
  const pendingCarDelivery = useGameStore((s) => s?.pendingCarDelivery);
  const cash = useGameStore((s) => s?.cash ?? 0);
  const inflationMultiplier = useGameStore((s) => s?.inflationMultiplier ?? 1);
  const relationshipModeEnabled = useGameStore((s) => s?.relationshipModeEnabled ?? false);
  const fullState = useGameStore();
  const householdSize = relationshipModeEnabled ? getHouseholdSize(fullState) : 1;
  const changeHousing = useGameStore((s) => s?.changeHousing);
  const changeCar = useGameStore((s) => s?.changeCar);
  // buyHouseUpgrade removed

  const currentHIdx = (housingData ?? []).findIndex((h) => h?.id === currentHousingId);

  const currentHousing = (housingData ?? []).find((h) => h?.id === currentHousingId) ?? null;
  const currentCar = (carsData ?? []).find((car) => car?.id === currentCarId) ?? null;
  const currentHousingRent = currentHousing ? inflated(currentHousing.weeklyRent ?? 0, inflationMultiplier) : 0;
  const currentUtilities = Math.round(currentHousingRent * 0.15);
  const currentCarCost = currentCar ? inflated(currentCar.weeklyCost ?? 0, inflationMultiplier) : 0;
  const currentLifestyleCost = currentHousingRent + currentUtilities + currentCarCost;

  const handleHousing = (h: (typeof housingData)[0]) => {
    const idx = (housingData ?? []).findIndex((hh) => hh?.id === h?.id);
    const dir = idx > currentHIdx ? 'Upgrade' : 'Downgrade';
    const utilCost = Math.round(inflated(h?.weeklyRent ?? 0, inflationMultiplier) * 0.15);
    const message = `${dir} to ${h?.name}? Rent: ${formatCurrency(inflated(h?.weeklyRent, inflationMultiplier))}/week + Utilities: ${formatCurrency(utilCost)}/week.`;
    showGameDialog({ title: `${dir} Housing`, message, confirmText: dir, onConfirm: () => changeHousing?.(h?.id) });
  };

  const handleCar = (c: (typeof carsData)[0]) => {
    const oldCar = (carsData ?? []).find((cc) => cc?.id === currentCarId);
    const tradeIn = Math.round(((oldCar?.purchaseCost ?? 0) * 0.4));
    const inflatedPurchase = inflated(c?.purchaseCost ?? 0, inflationMultiplier);
    const cost = inflatedPurchase - tradeIn;
    const desc = tradeIn > 0 ? `Trade-in: ${formatCurrency(tradeIn)}. Net cost: ${formatCurrency(cost)}.` : `Cost: ${formatCurrency(inflatedPurchase)}.`;
    const message = `Get a ${c?.name}? ${desc} Running cost: ${formatCurrency(inflated(c?.weeklyCost ?? 0, inflationMultiplier))}/week. It will be delivered after you advance one week.`;
    showGameDialog({ title: 'Change Vehicle', message, confirmText: 'Buy', onConfirm: () => changeCar?.(c?.id) });
  };

  // handleUpgrade removed

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScreenHeader
        title="Lifestyle"
        subtitle="Housing, vehicles and household needs"
        showBack
        onBack={() => router.back()}
        accentColor={Colors.happiness}
      />
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <GameCard
          variant="hero"
          eyebrow="CURRENT LIFESTYLE"
          title="Weekly lifestyle cost"
          accentColor={Colors.happiness}
          titleAccessory={<StatusPill compact icon="wallet-outline" label={`${formatCurrency(currentLifestyleCost)}/wk`} color={Colors.happiness} />}
        >
          <View style={styles.currentLifestyleGrid}>
            <View style={styles.currentLifestyleItem}>
              <Ionicons name="home-outline" size={16} color={Colors.business} />
              <View style={styles.currentLifestyleCopy}>
                <Text style={styles.currentLifestyleLabel}>Home</Text>
                <Text style={styles.currentLifestyleValue} numberOfLines={1}>{currentHousing?.name ?? 'None'}</Text>
              </View>
            </View>
            <View style={styles.currentLifestyleItem}>
              <Ionicons name="car-outline" size={16} color={Colors.info} />
              <View style={styles.currentLifestyleCopy}>
                <Text style={styles.currentLifestyleLabel}>Vehicle</Text>
                <Text style={styles.currentLifestyleValue} numberOfLines={1}>{currentCar?.name ?? 'None'}</Text>
              </View>
            </View>
          </View>
        </GameCard>

        {/* HOUSING */}
        <View style={styles.sectionHeading}>
          <View style={styles.sectionTitleRow}>
            <Ionicons name="home-outline" size={17} color={Colors.business} />
            <Text style={styles.sectionHeader}>Housing</Text>
          </View>
          <Text style={styles.sectionSub}>Compare total weekly cost and household capacity.</Text>
        </View>
        <View style={styles.pixelArtCard}>
          <Image source={require('../assets/pixel-art/housing.png')} style={styles.housingArt} resizeMode="contain" accessibilityLabel="Pixel art showing apartment, house, and villa upgrades" />
        </View>
        {(housingData ?? []).map((h, idx) => {
          const isCurrent = h?.id === currentHousingId;
          const isUpgrade = idx > currentHIdx;
          const rent = inflated(h?.weeklyRent ?? 0, inflationMultiplier);
          const utilCost = Math.round(rent * 0.15);
          const totalWeekly = rent + utilCost;
          const delta = totalWeekly - (currentHousingRent + currentUtilities);
          const capacity = getHousingCapacity(h.id);
          const crowded = relationshipModeEnabled && householdSize > capacity;

          return (
            <GameCard key={h?.id} compact variant={isCurrent ? 'subtle' : 'standard'}>
              <View style={styles.row}>
                <Image source={housingItemImages[h.id]} style={styles.itemIcon} resizeMode="contain" accessibilityLabel={`${h.name} pixel art`} />
                <View style={styles.info}>
                  <View style={styles.nameLine}>
                    <Text style={styles.name} numberOfLines={1}>{h?.name}</Text>
                    {isCurrent && <StatusPill compact label="Current" icon="checkmark-circle-outline" color={Colors.info} />}
                  </View>
                  <View style={styles.comparisonRow}>
                    <StatusPill compact icon="cash-outline" label={`${formatCurrency(totalWeekly)}/wk total`} color={Colors.primary} />
                    {!isCurrent && (
                      <StatusPill
                        compact
                        icon={delta > 0 ? 'arrow-up-outline' : delta < 0 ? 'arrow-down-outline' : 'remove-outline'}
                        label={delta === 0 ? 'Same weekly cost' : `${delta > 0 ? '+' : ''}${formatCurrency(delta)}/wk`}
                        color={delta > 0 ? Colors.warning : delta < 0 ? Colors.primary : Colors.textSecondary}
                      />
                    )}
                  </View>
                  {relationshipModeEnabled && (
                    <View style={styles.comparisonRow}>
                      <StatusPill compact icon="people-outline" label={`Comfortable for ${capacity}`} color={crowded ? Colors.negative : Colors.business} />
                      {crowded && <StatusPill compact icon="warning-outline" label="Too small" color={Colors.negative} />}
                    </View>
                  )}
                </View>
              </View>

              <View style={styles.costBreakdown}>
                <View style={styles.costCell}>
                  <Text style={styles.costLabel}>Rent</Text>
                  <Text style={styles.costValue}>{formatCurrency(rent)}/wk</Text>
                </View>
                <View style={styles.costCell}>
                  <Text style={styles.costLabel}>Utilities</Text>
                  <Text style={styles.costValue}>{formatCurrency(utilCost)}/wk</Text>
                </View>
              </View>

              {!isCurrent && (
                <GameButton
                  compact
                  variant={isUpgrade ? 'primary' : 'secondary'}
                  accentColor={isUpgrade ? Colors.business : Colors.warning}
                  icon={isUpgrade ? 'arrow-up-circle-outline' : 'arrow-down-circle-outline'}
                  label={isUpgrade ? 'Upgrade Home' : 'Downgrade Home'}
                  onPress={() => handleHousing(h)}
                />
              )}
            </GameCard>
          );
        })}

        {/* CARS */}
        <View style={styles.sectionHeading}>
          <View style={styles.sectionTitleRow}>
            <Ionicons name="car-outline" size={17} color={Colors.info} />
            <Text style={styles.sectionHeader}>Vehicle</Text>
          </View>
          <Text style={styles.sectionSub}>Compare purchase cost, trade-in value and weekly running cost.</Text>
        </View>
        <View style={styles.pixelArtCard}>
          <Image source={require('../assets/pixel-art/cars.png')} style={styles.carArt} resizeMode="contain" accessibilityLabel="Pixel art showing used car, sedan, and SUV progression" />
        </View>
        {pendingCarDelivery && (
          <GameCard variant="attention" compact eyebrow="DELIVERY PENDING" title={carsData.find((car) => car.id === pendingCarDelivery.carId)?.name ?? 'Your vehicle'} accentColor={Colors.warning}>
            <Text style={styles.desc}>Arrives after advancing one week.</Text>
          </GameCard>
        )}
        {(carsData ?? []).map((vehicle) => {
          const isCurrent = vehicle?.id === currentCarId;
          const tradeIn = Math.round(((currentCar?.purchaseCost ?? 0) * 0.4));
          const inflatedPurchase = inflated(vehicle?.purchaseCost ?? 0, inflationMultiplier);
          const netCost = inflatedPurchase - tradeIn;
          const weeklyCost = inflated(vehicle?.weeklyCost ?? 0, inflationMultiplier);
          const weeklyDelta = weeklyCost - currentCarCost;
          const canAfford = cash >= netCost;

          return (
            <GameCard key={vehicle?.id} compact variant={isCurrent ? 'subtle' : 'standard'}>
              <View style={styles.row}>
                {carItemImages[vehicle.id] ? <Image source={carItemImages[vehicle.id]} style={styles.itemIcon} resizeMode="contain" accessibilityLabel={`${vehicle.name} pixel art`} /> : null}
                <View style={styles.info}>
                  <View style={styles.nameLine}>
                    <Text style={styles.name} numberOfLines={1}>{vehicle?.name}</Text>
                    {isCurrent && <StatusPill compact label="Current" icon="checkmark-circle-outline" color={Colors.info} />}
                  </View>
                  <Text style={styles.desc} numberOfLines={2}>{vehicle?.description}</Text>
                  <View style={styles.comparisonRow}>
                    <StatusPill compact icon="speedometer-outline" label={weeklyCost > 0 ? `${formatCurrency(weeklyCost)}/wk` : 'No running cost'} color={Colors.info} />
                    {!isCurrent && vehicle.id !== 'none' && (
                      <StatusPill
                        compact
                        icon={weeklyDelta > 0 ? 'arrow-up-outline' : weeklyDelta < 0 ? 'arrow-down-outline' : 'remove-outline'}
                        label={weeklyDelta === 0 ? 'Same running cost' : `${weeklyDelta > 0 ? '+' : ''}${formatCurrency(weeklyDelta)}/wk`}
                        color={weeklyDelta > 0 ? Colors.warning : weeklyDelta < 0 ? Colors.primary : Colors.textSecondary}
                      />
                    )}
                  </View>
                </View>
              </View>

              {!isCurrent && vehicle?.id !== 'none' && (
                <View style={styles.purchaseSummary}>
                  <View>
                    <Text style={styles.costLabel}>Purchase</Text>
                    <Text style={styles.purchaseValue}>{formatCurrency(inflatedPurchase)}</Text>
                  </View>
                  {tradeIn > 0 && (
                    <View style={styles.purchaseRight}>
                      <Text style={styles.costLabel}>{netCost < 0 ? 'Trade-in credit' : 'After trade-in'}</Text>
                      <Text style={[styles.purchaseValue, { color: netCost < 0 || canAfford ? Colors.primary : Colors.negative }]}>
                        {netCost < 0 ? `+${formatCurrency(Math.abs(netCost))}` : formatCurrency(netCost)}
                      </Text>
                    </View>
                  )}
                </View>
              )}

              {!pendingCarDelivery && !isCurrent && vehicle?.id !== 'none' && (
                <GameButton
                  compact
                  accentColor={Colors.info}
                  icon="car-sport-outline"
                  label={canAfford
                    ? netCost < 0
                      ? `Change • Receive ${formatCurrency(Math.abs(netCost))}`
                      : tradeIn > 0
                        ? `Buy • Net ${formatCurrency(netCost)}`
                        : `Buy • ${formatCurrency(inflatedPurchase)}`
                    : `Need ${formatCurrency(Math.max(0, netCost - cash))} more`}
                  onPress={() => handleCar(vehicle)}
                  disabled={!canAfford}
                />
              )}

              {!pendingCarDelivery && !isCurrent && vehicle?.id === 'none' && currentCarId !== 'none' && (
                <GameButton compact variant="secondary" accentColor={Colors.warning} icon="cash-outline" label="Sell Current Vehicle" onPress={() => changeCar?.('none')} />
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
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 36 },
  currentLifestyleGrid: { flexDirection: 'row', gap: 8 },
  currentLifestyleItem: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: Colors.elevated, borderWidth: 1, borderColor: Colors.cardBorder, borderRadius: 9, padding: 9 },
  currentLifestyleCopy: { flex: 1, minWidth: 0 },
  currentLifestyleLabel: { color: Colors.textMuted, fontSize: 8, fontWeight: '800', textTransform: 'uppercase' },
  currentLifestyleValue: { color: Colors.textPrimary, fontSize: 11, fontWeight: '800', marginTop: 2 },
  sectionHeading: { marginTop: 10, marginBottom: 8 },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  sectionHeader: { color: Colors.textPrimary, fontSize: 17, fontWeight: '900' },
  sectionSub: { color: Colors.textMuted, fontSize: 10, marginTop: 2 },
  pixelArtCard: { alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.cardBorder, borderRadius: 12, marginBottom: 9, overflow: 'hidden' },
  housingArt: { width: '100%', height: 118 },
  carArt: { width: '100%', height: 106 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  info: { flex: 1, minWidth: 0 },
  itemIcon: { width: 58, height: 58, flexShrink: 0, alignSelf: 'center' },
  nameLine: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6 },
  name: { flex: 1, minWidth: 0, color: Colors.textPrimary, fontSize: 14, fontWeight: '800' },
  comparisonRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 5 },
  desc: { color: Colors.textMuted, fontSize: 12, marginTop: 2 },
  costBreakdown: { flexDirection: 'row', gap: 6, marginTop: 8, marginBottom: 8 },
  costCell: { flex: 1, backgroundColor: Colors.elevated, borderWidth: 1, borderColor: Colors.cardBorder, borderRadius: 8, padding: 7 },
  costLabel: { color: Colors.textMuted, fontSize: 8, fontWeight: '800', textTransform: 'uppercase' },
  costValue: { color: Colors.textPrimary, fontSize: 11, fontWeight: '800', marginTop: 2 },
  purchaseSummary: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 8, marginTop: 8, marginBottom: 8 },
  purchaseRight: { alignItems: 'flex-end' },
  purchaseValue: { color: Colors.textPrimary, fontSize: 12, fontWeight: '800', marginTop: 2 },
});
