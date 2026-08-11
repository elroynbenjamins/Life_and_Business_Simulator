import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, Alert, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { Colors } from '../src/theme/colors';
import GameStatusBar from '../src/components/StatusBar';
import GameCard from '../src/components/GameCard';
import useGameStore from '../src/store/gameStore';
import { formatCurrency } from '../src/utils/format';
import { AD_CONFIG } from '../src/services/adConfig';
import { loadRewardedAd, showRewardedAd } from '../src/services/adManager';
import { AD_GEM_REWARD, GEM_CASH_RATE } from '../src/constants/rewards';

const GEM_PACKS = [
  { gems: 100, price: '$0.99' },
  { gems: 250, price: '$2.49' },
  { gems: 500, price: '$4.99' },
  { gems: 1000, price: '$8.99' },
  { gems: 2500, price: '$19.99' },
];

export default function SupportScreen() {
  const router = useRouter();
  const profile = useGameStore((s) => s?.profile);
  const convertGemsToCash = useGameStore((s) => s?.convertGemsToCash);
  const grantAdReward = useGameStore((s) => s?.grantAdReward);
  const getAdUsage = useGameStore((s) => s?.getAdUsage);
  const cash = useGameStore((s) => s?.cash ?? 0);
  const [convertAmount, setConvertAmount] = useState('');
  const [adState, setAdState] = useState<'idle' | 'loading' | 'showing' | 'success' | 'error'>('idle');
  const [adMessage, setAdMessage] = useState('');

  const gems = profile?.gems ?? 0;
  const adUsage = getAdUsage?.() ?? { watchedToday: 0, remaining: 5, limitReached: false };
  const useSimulatedAd = Platform.OS === 'web' || Constants.expoGoConfig != null;

  const handleWatchAd = useCallback(async () => {
    if (adState === 'loading' || adState === 'showing') return;
    if (adUsage.limitReached) {
      setAdMessage('Daily ad limit reached');
      return;
    }

    // Web and Expo Go do not include the native AdMob module, so use the same
    // timed reward flow without attempting to load unavailable native code.
    if (useSimulatedAd) {
      setAdState('loading');
      setAdMessage('');
      setTimeout(() => {
        setAdState('success');
        grantAdReward?.();
        setAdMessage(`Advertisement completed! +${AD_GEM_REWARD} gems`);
        setTimeout(() => { setAdState('idle'); setAdMessage(''); }, 3000);
      }, 2000);
      return;
    }

    setAdState('loading');
    setAdMessage('');

    const loaded = await loadRewardedAd();
    if (!loaded) {
      setAdState('error');
      setAdMessage('Ad unavailable right now. Please try again later.');
      setTimeout(() => { setAdState('idle'); setAdMessage(''); }, 3000);
      return;
    }

    const shown = await showRewardedAd(() => {
      grantAdReward?.();
      setAdState('success');
      setAdMessage(`Advertisement completed! +${AD_GEM_REWARD} gems`);
    });

    if (!shown) {
      setAdState('error');
      setAdMessage('No reward earned. Watch the complete ad to receive gems.');
    }

    setTimeout(() => { setAdState('idle'); setAdMessage(''); }, 3000);
  }, [adState, adUsage.limitReached, grantAdReward, useSimulatedAd]);

  const handleBuyGems = (pack: typeof GEM_PACKS[0]) => {
    Alert.alert(
      'Purchase Gems',
      `Buy ${pack.gems} gems for ${pack.price}?\n\n(In-app purchases are simulated in this demo. Gems will be added immediately.)`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Buy',
          onPress: () => {
            // Simulate purchase — in production use expo-in-app-purchases
            const state = useGameStore.getState();
            const newProfile = { ...state.profile, gems: (state.profile.gems ?? 0) + pack.gems };
            useGameStore.setState({ profile: newProfile });
            import('../src/utils/storage').then(({ saveProfile }) => saveProfile(newProfile));
            Alert.alert('Success!', `${pack.gems} gems added to your account!`);
          },
        },
      ]
    );
  };

  const handleConvert = () => {
    const amount = parseInt(convertAmount, 10);
    if (isNaN(amount) || amount <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid number of gems.');
      return;
    }
    if (amount > gems) {
      Alert.alert('Not Enough Gems', `You only have ${gems} gems.`);
      return;
    }
    const cashGain = amount * GEM_CASH_RATE;
    const message = `Convert ${amount} gems into ${formatCurrency(cashGain)}?`;
    const convert = () => {
      convertGemsToCash?.(amount);
      setConvertAmount('');
    };
    if (Platform.OS === 'web') {
      if (window.confirm(`Convert Gems: ${message}`)) convert();
      return;
    }
    Alert.alert('Convert Gems', message, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Convert', onPress: convert },
    ]);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>Support</Text>
      </View>
      <GameStatusBar />
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {/* Gem Balance */}
        <GameCard>
          <View style={styles.balanceRow}>
            <View style={styles.balanceItem}>
              <Ionicons name="diamond" size={28} color="#8B5CF6" />
              <Text style={styles.balanceValue}>{gems}</Text>
              <Text style={styles.balanceLabel}>Gems</Text>
            </View>
            <View style={styles.balanceDivider} />
            <View style={styles.balanceItem}>
              <Ionicons name="cash" size={28} color={Colors.primary} />
              <Text style={styles.balanceValue}>{formatCurrency(cash)}</Text>
              <Text style={styles.balanceLabel}>Cash</Text>
            </View>
          </View>
        </GameCard>

        {/* Watch Ad */}
        <GameCard title="Watch an Ad">
          <Text style={styles.desc}>
            {useSimulatedAd ? 'Complete a short simulated ad' : 'Watch a short ad'} and earn {AD_GEM_REWARD} gems!
          </Text>
          <Pressable
            style={[styles.adBtn, (adState === 'loading' || adState === 'showing' || adUsage.limitReached) && styles.disabledBtn]}
            onPress={handleWatchAd}
            disabled={adState === 'loading' || adState === 'showing' || adUsage.limitReached}
          >
            <Ionicons name="play-circle" size={22} color={Colors.white} />
            <Text style={styles.adBtnText}>
              {adState === 'loading' ? 'Loading Ad...' :
               adState === 'showing' ? 'Showing Ad...' :
               adUsage.limitReached ? 'Daily ad limit reached' :
               `Watch Ad — ${adUsage.remaining}/${AD_CONFIG.DAILY_AD_LIMIT} remaining today`}
            </Text>
          </Pressable>
          {adMessage !== '' && (
            <Text style={[styles.adMsg, { color: adState === 'success' ? Colors.primary : adState === 'error' ? Colors.negative : Colors.textMuted }]}>
              {adMessage}
            </Text>
          )}
        </GameCard>

        {/* Convert Gems to Cash */}
        <GameCard title="Convert Gems → Cash">
          <Text style={styles.desc}>1 gem = {formatCurrency(GEM_CASH_RATE)} in-game cash</Text>
          <View style={styles.convertRow}>
            <TextInput
              style={styles.convertInput}
              placeholder="Gems to convert"
              placeholderTextColor={Colors.textMuted}
              value={convertAmount}
              onChangeText={setConvertAmount}
              keyboardType="number-pad"
            />
            <Pressable
              style={[styles.convertBtn, (!convertAmount || parseInt(convertAmount, 10) <= 0) && styles.disabledBtn]}
              onPress={handleConvert}
              disabled={!convertAmount || parseInt(convertAmount, 10) <= 0}
            >
              <Text style={styles.convertBtnText}>Convert</Text>
            </Pressable>
          </View>
          {convertAmount && parseInt(convertAmount, 10) > 0 && (
            <Text style={styles.convertPreview}>
              {convertAmount} gems = {formatCurrency(parseInt(convertAmount, 10) * GEM_CASH_RATE)} cash
            </Text>
          )}
        </GameCard>

        {/* Buy Gems */}
        <GameCard title="Purchase Gems">
          <Text style={styles.desc}>Get gems instantly to boost your game!</Text>
          {GEM_PACKS.map((pack) => (
            <Pressable key={pack.gems} style={styles.packRow} onPress={() => handleBuyGems(pack)}>
              <View style={styles.packLeft}>
                <Ionicons name="diamond" size={20} color="#8B5CF6" />
                <Text style={styles.packGems}>{pack.gems} Gems</Text>
              </View>
              <View style={styles.packPriceBtn}>
                <Text style={styles.packPrice}>{pack.price}</Text>
              </View>
            </Pressable>
          ))}
        </GameCard>
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
  balanceRow: { flexDirection: 'row', alignItems: 'center' },
  balanceItem: { flex: 1, alignItems: 'center', gap: 4 },
  balanceValue: { color: Colors.textPrimary, fontSize: 22, fontWeight: '700' },
  balanceLabel: { color: Colors.textMuted, fontSize: 12 },
  balanceDivider: { width: 1, height: 50, backgroundColor: Colors.cardBorder },
  desc: { color: Colors.textSecondary, fontSize: 14, marginBottom: 12 },
  adBtn: { backgroundColor: '#8B5CF6', borderRadius: 12, padding: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  adBtnText: { color: Colors.white, fontSize: 16, fontWeight: '700' },
  disabledBtn: { opacity: 0.5 },
  packRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: Colors.elevated, borderRadius: 10, padding: 14, marginBottom: 8 },
  packLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  packGems: { color: Colors.textPrimary, fontSize: 16, fontWeight: '600' },
  packPriceBtn: { backgroundColor: Colors.primary, borderRadius: 8, paddingHorizontal: 16, paddingVertical: 8 },
  packPrice: { color: Colors.white, fontSize: 14, fontWeight: '700' },
  convertRow: { flexDirection: 'row', gap: 10 },
  convertInput: { flex: 1, backgroundColor: Colors.elevated, color: Colors.textPrimary, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, borderWidth: 1, borderColor: Colors.cardBorder },
  convertBtn: { backgroundColor: '#8B5CF6', borderRadius: 10, paddingHorizontal: 20, justifyContent: 'center' },
  convertBtnText: { color: Colors.white, fontSize: 14, fontWeight: '700' },
  convertPreview: { color: Colors.primary, fontSize: 13, marginTop: 8, textAlign: 'center' },
  adMsg: { fontSize: 13, marginTop: 10, textAlign: 'center', fontWeight: '600' },
});
