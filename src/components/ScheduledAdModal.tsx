import React, { useEffect, useState } from 'react';
import { Modal, View, Text, Pressable, StyleSheet, Platform } from 'react-native';
import Constants from 'expo-constants';
import { Colors } from '../theme/colors';
import useGameStore from '../store/gameStore';
import { loadInterstitialAd, showInterstitialAd } from '../services/adManager';

export default function ScheduledAdModal() {
  const visible = useGameStore((state) => state.showScheduledAd);
  const dismiss = useGameStore((state) => state.dismissScheduledAd);
  const [ready, setReady] = useState(false);
  const simulated = Platform.OS === 'web' || Constants.expoGoConfig != null;

  useEffect(() => {
    if (!visible) { setReady(false); return; }
    if (simulated) {
      const timer = setTimeout(() => setReady(true), 2500);
      return () => clearTimeout(timer);
    }
    (async () => {
      if (await loadInterstitialAd()) {
        const shown = await showInterstitialAd(dismiss);
        if (!shown) setReady(true);
      } else setReady(true);
    })();
  }, [visible, simulated, dismiss]);

  if (!visible || (!simulated && !ready)) return null;
  return (
    <Modal visible transparent={false} animationType="fade">
      <View style={styles.screen}>
        <Text style={styles.sponsor}>SPONSORED</Text>
        <Text style={styles.title}>Advertisement</Text>
        <Text style={styles.copy}>This simulated ad is shown in Expo Go and on web. Development builds use the configured AdMob interstitial.</Text>
        <Pressable disabled={!ready} onPress={dismiss} style={[styles.button, !ready && styles.disabled]}>
          <Text style={styles.buttonText}>{ready ? 'Continue' : 'Ad playing...'}</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background, alignItems: 'center', justifyContent: 'center', padding: 28 },
  sponsor: { color: Colors.textMuted, fontSize: 11, letterSpacing: 2 },
  title: { color: Colors.textPrimary, fontSize: 30, fontWeight: '800', marginTop: 12 },
  copy: { color: Colors.textSecondary, textAlign: 'center', lineHeight: 21, marginTop: 14, maxWidth: 380 },
  button: { marginTop: 32, backgroundColor: Colors.primary, borderRadius: 10, paddingHorizontal: 28, paddingVertical: 12 },
  disabled: { opacity: 0.45 },
  buttonText: { color: Colors.white, fontWeight: '700' },
});
