import React from 'react';
import { Modal, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import useGameStore from '../store/gameStore';
import { Colors } from '../theme/colors';
import GameButton from './GameButton';

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
          {(reminder.courseLevel ?? 1) > 1 ? (
            <Text style={styles.ready}>Your qualification is complete. Career promotions still require promotion progress and the required housing and vehicle.</Text>
          ) : ready ? (
            <Text style={styles.ready}>You can now visit Career and apply for {reminder.jobTitle}.</Text>
          ) : (
            <View style={styles.requirements}>
              <Text style={styles.requirementTitle}>Before applying for {reminder.jobTitle}:</Text>
              {reminder.missingRequirements.map((item) => <Text key={item} style={styles.requirement}>• {item}</Text>)}
            </View>
          )}
          <View style={styles.actions}>
            <GameButton accentColor={Colors.education} label="Open Career" icon="briefcase-outline" onPress={openCareer} />
            <GameButton variant="ghost" label="Later" onPress={dismiss} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.72)', justifyContent: 'center', padding: 24 },
  card: { backgroundColor: Colors.card, borderColor: Colors.cardBorder, borderWidth: 1, borderRadius: 18, padding: 22 },
  icon: { alignSelf: 'center', width: 58, height: 58, borderRadius: 18, backgroundColor: `${Colors.education}12`, borderWidth: 1, borderColor: `${Colors.education}44`, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  title: { color: Colors.textPrimary, fontSize: 22, fontWeight: '800', textAlign: 'center' },
  message: { color: Colors.textSecondary, fontSize: 15, textAlign: 'center', marginTop: 8 },
  ready: { color: Colors.education, fontSize: 14, lineHeight: 20, textAlign: 'center', marginTop: 14 },
  requirements: { backgroundColor: Colors.background, borderRadius: 10, padding: 12, marginTop: 14 },
  requirementTitle: { color: Colors.warning, fontSize: 14, fontWeight: '700', marginBottom: 6 },
  requirement: { color: Colors.textSecondary, fontSize: 14, lineHeight: 21 },
  actions: { marginTop: 18, gap: 6 },
});
