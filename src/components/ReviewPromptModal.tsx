import React from 'react';
import { Linking, Modal, Platform, Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import useGameStore from '../store/gameStore';
import { Colors } from '../theme/colors';

const ANDROID_PACKAGE = 'com.elroybenjamins.lifeempire';
const PLAY_STORE_URL = `https://play.google.com/store/apps/details?id=${ANDROID_PACKAGE}`;
const PLAY_STORE_MARKET_URL = `market://details?id=${ANDROID_PACKAGE}`;

export default function ReviewPromptModal() {
  const state = useGameStore();
  const visible = state.showReviewPrompt
    && !state.showSummary
    && !state.showEventModal
    && !state.showRelationshipEventModal
    && !state.showPeriodReport
    && !state.showScheduledAd
    && !state.showEducationCareerReminder
    && !state.showNegativeCashModal
    && !state.showMainMenu
    && !state.showTutorial
    && !state.showContentUpdateModal
    && !state.lifecycle?.isDead;
  const dismiss = useGameStore((s) => s.dismissReviewPrompt);
  const milestoneWeek = (state.reviewPromptedWeeks ?? []).slice(-1)[0] ?? 0;

  const openReview = async () => {
    dismiss();
    const url = Platform.OS === 'android' ? PLAY_STORE_MARKET_URL : PLAY_STORE_URL;
    try {
      const supported = await Linking.canOpenURL(url);
      await Linking.openURL(supported ? url : PLAY_STORE_URL);
    } catch {
      await Linking.openURL(PLAY_STORE_URL);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={dismiss}>
      <View style={styles.backdrop}>
        <SafeAreaView style={styles.card}>
          <View style={styles.iconCircle}>
            <Ionicons name="star" size={38} color={Colors.warning} />
          </View>
          <Text style={styles.eyebrow}>MILESTONE REACHED</Text>
          <Text style={styles.title}>{milestoneWeek >= 500 ? '500 weeks played' : '200 weeks played'}</Text>
          <Text style={styles.text}>
            You have built a serious Life Empire save. If you are enjoying the game, a quick Google Play review helps other players discover it.
          </Text>
          <Pressable style={styles.primaryButton} onPress={openReview}>
            <Text style={styles.primaryText}>Review on Google Play</Text>
            <Ionicons name="open-outline" size={20} color={Colors.white} />
          </Pressable>
          <Pressable style={styles.secondaryButton} onPress={dismiss}>
            <Text style={styles.secondaryText}>Maybe later</Text>
          </Pressable>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: '#000000B8', justifyContent: 'center', padding: 22 },
  card: { width: '100%', maxWidth: 460, alignSelf: 'center', backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.cardBorder, borderRadius: 22, padding: 24 },
  iconCircle: { width: 78, height: 78, borderRadius: 39, backgroundColor: `${Colors.warning}20`, borderWidth: 1, borderColor: Colors.warning, alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginBottom: 18 },
  eyebrow: { color: Colors.primary, fontSize: 11, fontWeight: '800', letterSpacing: 1.4, textAlign: 'center', marginBottom: 8 },
  title: { color: Colors.textPrimary, fontSize: 25, fontWeight: '800', textAlign: 'center' },
  text: { color: Colors.textSecondary, fontSize: 15, lineHeight: 23, textAlign: 'center', marginTop: 14 },
  primaryButton: { minHeight: 56, borderRadius: 14, backgroundColor: Colors.primary, flexDirection: 'row', gap: 9, alignItems: 'center', justifyContent: 'center', marginTop: 22 },
  primaryText: { color: Colors.white, fontSize: 16, fontWeight: '800' },
  secondaryButton: { minHeight: 46, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  secondaryText: { color: Colors.textSecondary, fontSize: 14, fontWeight: '700' },
});
