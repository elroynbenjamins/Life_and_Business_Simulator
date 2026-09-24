import React, { useEffect } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import useGameStore from '../store/gameStore';
import { useTutorialStore } from '../store/tutorialStore';
import { tutorialSnapshot } from './TutorialDock';
import { Colors } from '../theme/colors';

export default function TutorialModal() {
  const router = useRouter();
  const visible = useGameStore((state) => state.showTutorial);
  const ready = useTutorialStore((state) => state.ready);
  const hydrate = useTutorialStore((state) => state.hydrate);
  useEffect(() => { void hydrate(); }, [hydrate]);

  const dismiss = () => {
    // Retire the second education introduction on both the guided and skip paths.
    const state = useGameStore.getState();
    state.dismissTutorial();
    state.dismissEducationOnboarding();
  };
  const explore = () => { useTutorialStore.getState().pause(); dismiss(); };
  const start = () => {
    useTutorialStore.getState().start(tutorialSnapshot(), true);
    dismiss();
    router.navigate('/tabs');
  };
  if (!visible) return null;
  return (
    <Modal visible animationType="fade" onRequestClose={explore}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.iconCircle}><Ionicons name="compass-outline" size={48} color={Colors.primary} /></View>
          <Text style={styles.eyebrow}>WELCOME TO LIFE EMPIRE</Text>
          <Text style={styles.title}>Build your life, one choice at a time.</Text>
          <Text style={styles.body}>Learn on the real screens: review your cash flow, choose education and income, then see the result of one week.</Text>
          <Text style={styles.hint}>Every lesson can be skipped or paused. No purchases, ads or particular career choices are required.</Text>
          <View style={styles.actions}>
            <Pressable accessibilityRole="button" accessibilityState={{ disabled: !ready }} disabled={!ready} onPress={start} style={[styles.primary, !ready && styles.disabled]}>
              <Text style={styles.primaryText}>{ready ? 'Guide me' : 'Loading guidance...'}</Text>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={explore} style={styles.secondary}>
              <Text style={styles.secondaryText}>Explore freely</Text>
            </Pressable>
          </View>
          <Text style={styles.footer}>Resume or replay from How To Play. Your game progress is never reset.</Text>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}
const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.background },
  content: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24, paddingVertical: 28, maxWidth: 480, width: '100%', alignSelf: 'center' },
  iconCircle: { width: 96, height: 96, borderRadius: 48, backgroundColor: `${Colors.primary}18`, alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
  eyebrow: { color: Colors.primary, fontSize: 11, fontWeight: '800', letterSpacing: 1.3, textAlign: 'center' },
  title: { color: Colors.textPrimary, fontSize: 27, lineHeight: 34, fontWeight: '800', textAlign: 'center', marginTop: 12 },
  body: { color: Colors.textSecondary, fontSize: 16, lineHeight: 24, textAlign: 'center', marginTop: 16 },
  hint: { color: Colors.textSecondary, fontSize: 13, lineHeight: 20, textAlign: 'center', marginTop: 18 },
  actions: { width: '100%', gap: 10, marginTop: 26 },
  primary: { minHeight: 52, borderRadius: 12, backgroundColor: Colors.primary, padding: 14, alignItems: 'center', justifyContent: 'center' },
  primaryText: { color: Colors.white, fontSize: 16, fontWeight: '800' },
  secondary: { minHeight: 48, borderRadius: 12, borderWidth: 1, borderColor: Colors.cardBorder, padding: 12, alignItems: 'center', justifyContent: 'center' },
  secondaryText: { color: Colors.textPrimary, fontSize: 15, fontWeight: '700' },
  footer: { color: Colors.textMuted, fontSize: 12, lineHeight: 18, textAlign: 'center', marginTop: 16 },
  disabled: { opacity: 0.5 },
});
