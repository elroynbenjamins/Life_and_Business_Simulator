import React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Alert, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors } from '../src/theme/colors';
import GameCard from '../src/components/GameCard';
import useGameStore from '../src/store/gameStore';
import { getPrestigeBonuses } from '../src/engine/prestigeEngine';

export default function PrestigeScreen() {
  const router = useRouter();
  const profile = useGameStore((s) => s?.profile);
  const unlockPrestigeBonus = useGameStore((s) => s?.unlockPrestigeBonus);
  const bonuses = getPrestigeBonuses();

  const handleUnlock = (bonusId: string, cost: number) => {
    if (Platform.OS === 'web') {
      if (window.confirm(`Unlock for ${cost} Prestige Points?`)) {
        unlockPrestigeBonus?.(bonusId);
      }
    } else {
      Alert.alert('Unlock Bonus', `Spend ${cost} Prestige Points?`, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Unlock', onPress: () => unlockPrestigeBonus?.(bonusId) },
      ]);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>Prestige Tree</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.pointsBar}>
        <Ionicons name="star" size={20} color="#F59E0B" />
        <Text style={styles.pointsText}>{profile?.prestigePoints ?? 0} Prestige Points</Text>
      </View>
      <Text style={styles.pointsDesc}>Earn Prestige Points by unlocking achievements. Spend them on permanent bonuses.</Text>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {bonuses.map((bonus: any) => {
          const isUnlocked = (profile?.unlockedPrestige ?? []).includes(bonus.id);
          const canAfford = (profile?.prestigePoints ?? 0) >= (bonus.cost ?? 0);
          const rawReq = bonus.requires;
          const prereqs: string[] = Array.isArray(rawReq) ? rawReq : rawReq ? [rawReq] : [];
          const hasPrereqs = prereqs.every((rid: string) => (profile?.unlockedPrestige ?? []).includes(rid));
          const canUnlock = canAfford && hasPrereqs;
          const missingPrereqs = prereqs.filter((rid: string) => !(profile?.unlockedPrestige ?? []).includes(rid));
          const missingNames = missingPrereqs.map((rid: string) => {
            const b = bonuses.find((x: any) => x.id === rid);
            return b?.name ?? rid;
          });
          return (
            <GameCard key={bonus.id} style={[styles.bonusCard, isUnlocked && styles.bonusUnlocked]}>
              <View style={styles.bonusRow}>
                <Text style={styles.bonusIcon}>{bonus.icon}</Text>
                <View style={styles.bonusInfo}>
                  <Text style={styles.bonusName}>{bonus.name}</Text>
                  <Text style={styles.bonusDesc}>{bonus.description}</Text>
                  {missingNames.length > 0 && !isUnlocked && (
                    <Text style={styles.prereqText}>Requires: {missingNames.join(', ')}</Text>
                  )}
                </View>
                <View style={styles.bonusRight}>
                  {isUnlocked ? (
                    <View style={styles.unlockedBadge}>
                      <Ionicons name="checkmark-circle" size={20} color={Colors.primary} />
                      <Text style={styles.unlockedText}>Active</Text>
                    </View>
                  ) : (
                    <Pressable
                      style={[styles.unlockBtn, !canUnlock && styles.unlockBtnDisabled]}
                      onPress={() => canUnlock && handleUnlock(bonus.id, bonus.cost)}
                      disabled={!canUnlock}
                    >
                      <Text style={styles.unlockBtnText}>{bonus.cost} PP</Text>
                    </Pressable>
                  )}
                </View>
              </View>
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
  pointsBar: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 8, backgroundColor: '#F59E0B15', marginHorizontal: 16, borderRadius: 12 },
  pointsText: { color: '#F59E0B', fontSize: 18, fontWeight: '700' },
  pointsDesc: { color: Colors.textMuted, fontSize: 13, paddingHorizontal: 16, marginTop: 8, marginBottom: 4 },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 40 },
  bonusCard: { marginBottom: 12 },
  bonusUnlocked: { borderColor: Colors.primary, borderWidth: 1 },
  bonusRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  bonusIcon: { fontSize: 32 },
  bonusInfo: { flex: 1 },
  bonusName: { color: Colors.textPrimary, fontSize: 16, fontWeight: '600' },
  bonusDesc: { color: Colors.textSecondary, fontSize: 13, marginTop: 2 },
  prereqText: { color: Colors.warning, fontSize: 11, marginTop: 4, fontStyle: 'italic' },
  bonusRight: { alignItems: 'center' },
  unlockedBadge: { alignItems: 'center' },
  unlockedText: { color: Colors.primary, fontSize: 11, fontWeight: '600', marginTop: 2 },
  unlockBtn: { backgroundColor: '#F59E0B', borderRadius: 8, paddingHorizontal: 16, paddingVertical: 8 },
  unlockBtnDisabled: { backgroundColor: Colors.cardBorder, opacity: 0.5 },
  unlockBtnText: { color: Colors.white, fontSize: 13, fontWeight: '700' },
});
