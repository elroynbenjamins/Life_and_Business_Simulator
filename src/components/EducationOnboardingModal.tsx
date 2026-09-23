import React from 'react';
import { Modal, Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import useGameStore from '../store/gameStore';
import { Colors } from '../theme/colors';

export default function EducationOnboardingModal() {
  const router = useRouter();
  const visible = useGameStore((state) => state.showEducationOnboarding && !state.showTutorial);
  const dismiss = useGameStore((state) => state.dismissEducationOnboarding);

  const chooseEducation = () => {
    dismiss();
    router.replace('/tabs/education');
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={dismiss}>
      <View style={styles.backdrop}>
        <SafeAreaView style={styles.card}>
          <View style={styles.iconCircle}>
            <Ionicons name="school" size={42} color={Colors.info} />
          </View>
          <Text style={styles.eyebrow}>YOUR FIRST STEP</Text>
          <Text style={styles.title}>Choose your education</Text>
          <Text style={styles.text}>
            Education unlocks career paths. Pick the Basic course that matches the career you want—such as Technology, Finance, Marketing or Sales. This completes the first objective in Your First Steps on Home.
          </Text>
          <View style={styles.tip}>
            <Ionicons name="bulb-outline" size={20} color={Colors.warning} />
            <Text style={styles.tipText}>You can choose freely. After completing it, the game will remind you which career becomes available.</Text>
          </View>
          <Pressable style={styles.primaryButton} onPress={chooseEducation}>
            <Text style={styles.primaryText}>Choose an education</Text>
            <Ionicons name="arrow-forward" size={20} color={Colors.white} />
          </Pressable>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: '#000000B8', justifyContent: 'center', padding: 22 },
  card: { width: '100%', maxWidth: 460, alignSelf: 'center', backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.cardBorder, borderRadius: 22, padding: 24 },
  iconCircle: { width: 82, height: 82, borderRadius: 41, backgroundColor: `${Colors.info}22`, borderWidth: 1, borderColor: Colors.info, alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginBottom: 18 },
  eyebrow: { color: Colors.primary, fontSize: 11, fontWeight: '800', letterSpacing: 1.4, textAlign: 'center', marginBottom: 8 },
  title: { color: Colors.textPrimary, fontSize: 25, fontWeight: '800', textAlign: 'center' },
  text: { color: Colors.textSecondary, fontSize: 15, lineHeight: 23, textAlign: 'center', marginTop: 14 },
  tip: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, backgroundColor: Colors.elevated, borderRadius: 13, padding: 14, marginTop: 20 },
  tipText: { flex: 1, color: Colors.textPrimary, fontSize: 13, lineHeight: 19 },
  primaryButton: { minHeight: 56, borderRadius: 14, backgroundColor: Colors.primary, flexDirection: 'row', gap: 9, alignItems: 'center', justifyContent: 'center', marginTop: 22 },
  primaryText: { color: Colors.white, fontSize: 16, fontWeight: '800' },
});
