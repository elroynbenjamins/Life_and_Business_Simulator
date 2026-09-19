import React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors } from '../src/theme/colors';
import GameCard from '../src/components/GameCard';
import useGameStore from '../src/store/gameStore';
import { getPrestigeBonuses } from '../src/engine/prestigeEngine';
import { showGameDialog } from '../src/components/GameDialog';
import { prestigeImages, prestigeImageKey } from '../src/assets/progressionImages';

export default function PrestigeScreen() {
  const router = useRouter();
  const profile = useGameStore((s) => s?.profile);
  const unlockPrestigeBonus = useGameStore((s) => s?.unlockPrestigeBonus);
  const bonuses = getPrestigeBonuses();

  const handleUnlock = (bonusId: string, cost: number, gemCost: number) => {
    const gemText = gemCost > 0 ? ` + ${gemCost} Gems` : '';
    showGameDialog({
      title: 'Unlock Bonus',
      message: `Spend ${cost} Prestige Points${gemText}?`,
      confirmText: 'Unlock',
      onConfirm: () => unlockPrestigeBonus?.(bonusId),
    });
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

      <View style={styles.currencyRow}>
        <View style={[styles.pointsBar, { flex: 1, marginHorizontal: 0 }]}>
          <Ionicons name="star" size={20} color="#F59E0B" />
          <Text style={styles.pointsText}>{profile?.prestigePoints ?? 0} PP</Text>
        </View>
        <View style={styles.gemsBar}>
          <Ionicons name="diamond" size={18} color="#A78BFA" />
          <Text style={styles.gemsText}>{profile?.gems ?? 0} Gems</Text>
        </View>
      </View>
      <Text style={styles.pointsDesc}>
        Achievements award Prestige Points and Gems. Level 3 bonuses also cost 10 Gems; Level 4 bonuses cost 25 Gems on top of their PP cost.
      </Text>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {bonuses.map((bonus: any) => {
          const isUnlocked = (profile?.unlockedPrestige ?? []).includes(bonus.id);
          const canAffordPP = (profile?.prestigePoints ?? 0) >= (bonus.cost ?? 0);
          const canAffordGems = (profile?.gems ?? 0) >= (bonus.gemCost ?? 0);
          const rawReq = bonus.requires;
          const prereqs: string[] = Array.isArray(rawReq) ? rawReq : rawReq ? [rawReq] : [];
          const hasPrereqs = prereqs.every((rid: string) => (profile?.unlockedPrestige ?? []).includes(rid));
          const canUnlock = canAffordPP && canAffordGems && hasPrereqs;
          const missingPrereqs = prereqs.filter((rid: string) => !(profile?.unlockedPrestige ?? []).includes(rid));
          const missingNames = missingPrereqs.map((rid: string) => {
            const b = bonuses.find((x: any) => x.id === rid);
            return b?.name ?? rid;
          });
          return (
            <GameCard key={bonus.id} style={[styles.bonusCard, isUnlocked && styles.bonusUnlocked]}>
              <View style={styles.bonusRow}>
                <Image source={prestigeImages[prestigeImageKey(bonus.id)]} style={[styles.bonusArtwork, isUnlocked && styles.bonusArtworkActive]} resizeMode="contain" accessibilityLabel={`${bonus.name} pixel art`} />
                <View style={styles.bonusInfo}>
                  <View style={styles.nameRow}>
                    <Text style={styles.bonusName}>{bonus.name}</Text>
                    {bonus.tier ? <Text style={styles.tierBadge}>L{bonus.tier}</Text> : null}
                  </View>
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
                      onPress={() => canUnlock && handleUnlock(bonus.id, bonus.cost, bonus.gemCost ?? 0)}
                      disabled={!canUnlock}
                    >
                      <Text style={styles.unlockBtnText}>{bonus.cost} PP</Text>
                      {(bonus.gemCost ?? 0) > 0 && <Text style={styles.gemCostText}>+ {bonus.gemCost} 💎</Text>}
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
  currencyRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 16 },
  pointsBar: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 8, backgroundColor: '#F59E0B15', marginHorizontal: 16, borderRadius: 12 },
  gemsBar: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, backgroundColor: '#A78BFA15', borderRadius: 12 },
  gemsText: { color: '#A78BFA', fontSize: 15, fontWeight: '700' },
  pointsText: { color: '#F59E0B', fontSize: 18, fontWeight: '700' },
  pointsDesc: { color: Colors.textMuted, fontSize: 13, paddingHorizontal: 16, marginTop: 8, marginBottom: 4 },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 40 },
  bonusCard: { marginBottom: 12 },
  bonusUnlocked: { borderColor: Colors.primary, borderWidth: 1 },
  bonusRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  bonusIcon: { fontSize: 32 },
  bonusArtwork: { width: 58, height: 58, opacity: 0.55 },
  bonusArtworkActive: { opacity: 1 },
  bonusInfo: { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  bonusName: { color: Colors.textPrimary, fontSize: 16, fontWeight: '600' },
  tierBadge: { color: Colors.warning, fontSize: 10, fontWeight: '800', backgroundColor: '#F59E0B15', borderRadius: 6, paddingHorizontal: 5, paddingVertical: 2 },
  bonusDesc: { color: Colors.textSecondary, fontSize: 13, marginTop: 2 },
  prereqText: { color: Colors.warning, fontSize: 11, marginTop: 4, fontStyle: 'italic' },
  bonusRight: { alignItems: 'center' },
  unlockedBadge: { alignItems: 'center' },
  unlockedText: { color: Colors.primary, fontSize: 11, fontWeight: '600', marginTop: 2 },
  unlockBtn: { backgroundColor: '#F59E0B', borderRadius: 8, paddingHorizontal: 16, paddingVertical: 8 },
  unlockBtnDisabled: { backgroundColor: Colors.cardBorder, opacity: 0.5 },
  unlockBtnText: { color: Colors.white, fontSize: 13, fontWeight: '700' },
  gemCostText: { color: Colors.white, fontSize: 10, fontWeight: '700', marginTop: 2, textAlign: 'center' },
});
