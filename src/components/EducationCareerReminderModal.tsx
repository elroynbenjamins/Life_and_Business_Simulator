import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import useGameStore from '../store/gameStore';
import { Colors } from '../theme/colors';

export default function EducationCareerReminderModal() {
  const router = useRouter();
  const visible = useGameStore((state) => state.showEducationCareerReminder);
  const reminder = useGameStore((state) => state.educationCareerReminder);
  const dismiss = useGameStore((state) => state.dismissEducationCareerReminder);
  if (!visible || !reminder) return null;

  const ready = reminder.missingRequirements.length === 0;
  const openCareer = () => {
    dismiss();
    router.push('/tabs/career');
  };

  return (
    <Modal visible transparent animationType="fade">
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.icon}><Ionicons name="school" size={30} color={Colors.primary} /></View>
          <Text style={styles.title}>Education Completed</Text>
          <Text style={styles.message}>You completed {reminder.courseName}.</Text>
          {ready ? (
            <Text style={styles.ready}>You can now visit Career and apply for {reminder.jobTitle}.</Text>
          ) : (
            <View style={styles.requirements}>
              <Text style={styles.requirementTitle}>Before applying for {reminder.jobTitle}:</Text>
              {reminder.missingRequirements.map((item) => <Text key={item} style={styles.requirement}>• {item}</Text>)}
            </View>
          )}
          <Pressable style={styles.primaryButton} onPress={openCareer}><Text style={styles.primaryText}>Open Career</Text></Pressable>
          <Pressable style={styles.secondaryButton} onPress={dismiss}><Text style={styles.secondaryText}>Later</Text></Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.72)', justifyContent: 'center', padding: 24 },
  card: { backgroundColor: Colors.card, borderColor: Colors.cardBorder, borderWidth: 1, borderRadius: 18, padding: 22 },
  icon: { alignSelf: 'center', width: 58, height: 58, borderRadius: 29, backgroundColor: '#10382D', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  title: { color: Colors.textPrimary, fontSize: 22, fontWeight: '800', textAlign: 'center' },
  message: { color: Colors.textSecondary, fontSize: 15, textAlign: 'center', marginTop: 8 },
  ready: { color: Colors.primary, fontSize: 14, lineHeight: 20, textAlign: 'center', marginTop: 14 },
  requirements: { backgroundColor: Colors.background, borderRadius: 10, padding: 12, marginTop: 14 },
  requirementTitle: { color: Colors.warning, fontSize: 14, fontWeight: '700', marginBottom: 6 },
  requirement: { color: Colors.textSecondary, fontSize: 14, lineHeight: 21 },
  primaryButton: { backgroundColor: Colors.primary, minHeight: 48, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginTop: 18 },
  primaryText: { color: Colors.white, fontSize: 16, fontWeight: '800' },
  secondaryButton: { minHeight: 42, alignItems: 'center', justifyContent: 'center' },
  secondaryText: { color: Colors.textMuted, fontSize: 14, fontWeight: '600' },
});
