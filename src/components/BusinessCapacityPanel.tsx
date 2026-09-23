import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../theme/colors';
import useGameStore from '../store/gameStore';
import GameCard from './GameCard';
import GameButton from './GameButton';
import StatusPill from './StatusPill';
import {
  getBusinessCapacity,
  getNextBusinessCapacityCost,
  MAX_BUSINESS_CAPACITY,
} from '../engine/businessCapacityEngine';
import { loadRewardedAd, showRewardedAd } from '../services/adManager';
import { shouldSimulateNativeFeatures } from '../services/runtimeEnvironment';

export default function BusinessCapacityPanel({ compact = false }: { compact?: boolean }) {
  const profile = useGameStore((state) => state.profile);
  const businesses = useGameStore((state) => state.businesses ?? []);
  const purchaseSlot = useGameStore((state) => state.purchaseBusinessCapacitySlot);
  const grantAdSlot = useGameStore((state) => state.grantBusinessCapacityAdUnlock);
  const [message, setMessage] = useState('');
  const [loadingAd, setLoadingAd] = useState(false);

  const capacity = getBusinessCapacity(profile);
  const nextCost = getNextBusinessCapacityCost(profile);
  const isFull = capacity >= MAX_BUSINESS_CAPACITY;
  const currencyAffordable = !!nextCost
    && (profile.prestigePoints ?? 0) >= nextCost.prestigePoints
    && (profile.gems ?? 0) >= nextCost.gems;

  const buyWithCurrency = () => {
    const success = purchaseSlot();
    setMessage(success ? 'Permanent company slot unlocked.' : 'You need both the required PP and Gems.');
  };

  const unlockWithAd = async () => {
    if (isFull || loadingAd) return;
    if (profile.adsRemoved || shouldSimulateNativeFeatures()) {
      const success = grantAdSlot();
      setMessage(success
        ? (profile.adsRemoved ? 'Ad-free permanent company slot unlocked.' : 'Simulated rewarded ad completed — permanent slot unlocked.')
        : 'This daily company-slot unlock is not available right now.');
      return;
    }

    setLoadingAd(true);
    setMessage('Loading rewarded ad...');
    const loaded = await loadRewardedAd('business_company_slot');
    if (!loaded) {
      setLoadingAd(false);
      setMessage('Ad unavailable. Please try again later.');
      return;
    }

    const earned = await showRewardedAd(() => {
      const success = grantAdSlot();
      if (success) setMessage('Permanent company slot unlocked.');
    });
    setLoadingAd(false);
    if (!earned) setMessage('Watch the full ad to unlock the permanent company slot.');
  };

  return (
    <GameCard
      compact={compact}
      variant={isFull ? 'subtle' : 'standard'}
      eyebrow="COMPANY CAPACITY"
      title={isFull ? 'Maximum capacity reached' : `${businesses.length} of ${capacity} company slots in use`}
      accentColor={Colors.business}
      titleAccessory={(
        <StatusPill
          compact
          icon={isFull ? 'checkmark-circle-outline' : 'business-outline'}
          label={`${capacity}/${MAX_BUSINESS_CAPACITY}`}
          color={isFull ? Colors.primary : Colors.business}
        />
      )}
    >
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${capacity / MAX_BUSINESS_CAPACITY * 100}%` }]} />
      </View>

      {isFull ? (
        <Text style={styles.helper}>You can own up to {MAX_BUSINESS_CAPACITY} companies at the same time.</Text>
      ) : (
        <>
          <Text style={styles.helper}>
            Two company slots are free. Extra slots are permanent and account-wide across every save.
          </Text>

          <View style={styles.costRow}>
            <View style={styles.costItem}>
              <Ionicons name="ribbon-outline" size={15} color={Colors.family} />
              <Text style={styles.costValue}>{nextCost?.prestigePoints ?? 0} PP</Text>
            </View>
            <Text style={styles.plus}>+</Text>
            <View style={styles.costItem}>
              <Ionicons name="diamond-outline" size={15} color={Colors.premium} />
              <Text style={styles.costValue}>{nextCost?.gems ?? 0} Gems</Text>
            </View>
          </View>

          <GameButton
            compact
            accentColor={Colors.business}
            icon="lock-open-outline"
            label={`Unlock Slot ${capacity + 1} with PP + Gems`}
            onPress={buyWithCurrency}
            disabled={!currencyAffordable}
          />

          <View style={styles.orRow}>
            <View style={styles.line} />
            <Text style={styles.orText}>OR</Text>
            <View style={styles.line} />
          </View>

          <GameButton
            compact
            variant="secondary"
            accentColor={Colors.info}
            icon={profile.adsRemoved ? 'gift-outline' : 'play-circle-outline'}
            label={
              loadingAd
                ? 'Loading Ad...'
                : profile.adsRemoved
                  ? 'Claim Ad-Free +1 Company Slot'
                  : 'Watch Ad • +1 Company Slot'
            }
            onPress={unlockWithAd}
            disabled={loadingAd}
          />
          <Text style={styles.adHelper}>Each completed rewarded ad permanently unlocks +1 slot, up to 10 companies.</Text>
        </>
      )}

      {!!message && <Text style={styles.message}>{message}</Text>}
    </GameCard>
  );
}

const styles = StyleSheet.create({
  track: {
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.elevated,
    overflow: 'hidden',
    marginBottom: 9,
  },
  fill: {
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.business,
  },
  helper: {
    color: Colors.textMuted,
    fontSize: 10,
    lineHeight: 15,
    marginBottom: 10,
  },
  costRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 9,
  },
  costItem: {
    minHeight: 28,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    backgroundColor: Colors.elevated,
    paddingHorizontal: 9,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  costValue: {
    color: Colors.textPrimary,
    fontSize: 11,
    fontWeight: '800',
  },
  plus: {
    color: Colors.textMuted,
    fontSize: 12,
    fontWeight: '900',
  },
  orRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginVertical: 8,
  },
  line: { flex: 1, height: 1, backgroundColor: Colors.cardBorder },
  orText: { color: Colors.textMuted, fontSize: 8, fontWeight: '900' },
  adHelper: {
    color: Colors.textMuted,
    fontSize: 9,
    textAlign: 'center',
    marginTop: 5,
  },
  message: {
    color: Colors.textSecondary,
    fontSize: 10,
    lineHeight: 14,
    textAlign: 'center',
    marginTop: 7,
  },
});
