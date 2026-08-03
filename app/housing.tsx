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

export default function HousingScreen() {
  const router = useRouter();
  const currentHousingId = useGameStore((s) => s?.currentHousingId);
  const changeHousing = useGameStore((s) => s?.changeHousing);

  const currentIdx = (housingData ?? []).findIndex((h) => h?.id === currentHousingId);

  const handleChange = (h: typeof housingData[0]) => {
    const targetIdx = (housingData ?? []).findIndex((hh) => hh?.id === h?.id);
    const direction = targetIdx > currentIdx ? 'Upgrade' : 'Downgrade';
    Alert.alert(
      `${direction} Housing`,
      `${direction} to ${h?.name}? Your new weekly rent will be ${formatCurrency(h?.weeklyRent)}.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: direction, onPress: () => changeHousing?.(h?.id) },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>Housing</Text>
      </View>
      <GameStatusBar />
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {(housingData ?? []).map((h, idx) => {
          const isCurrent = h?.id === currentHousingId;
          const isUpgrade = idx > currentIdx;
          const isDowngrade = idx < currentIdx;

          return (
            <GameCard key={h?.id}>
              <View style={styles.row}>
                <View style={styles.info}>
                  <Text style={styles.name}>{h?.name}</Text>
                  <Text style={styles.rent}>{formatCurrency(h?.weeklyRent)}/week</Text>
                  <Text style={styles.desc}>{h?.description}</Text>
                </View>
                {isCurrent ? (
                  <StatusPill label="Current" color={Colors.info} />
                ) : null}
              </View>
              {!isCurrent ? (
                <Pressable
                  style={[styles.actionBtn, { borderColor: isUpgrade ? Colors.primary : Colors.warning }]}
                  onPress={() => handleChange(h)}
                >
                  <Text style={[styles.actionText, { color: isUpgrade ? Colors.primary : Colors.warning }]}>
                    {isUpgrade ? 'Upgrade' : 'Downgrade'}
                  </Text>
                </Pressable>
              ) : null}
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
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  info: { flex: 1 },
  name: { color: Colors.textPrimary, fontSize: 18, fontWeight: '700' },
  rent: { color: Colors.primary, fontSize: 16, fontWeight: '600', marginTop: 4 },
  desc: { color: Colors.textMuted, fontSize: 13, marginTop: 6 },
  actionBtn: {
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
    marginTop: 12,
  },
  actionText: { fontWeight: '600', fontSize: 14 },
});
