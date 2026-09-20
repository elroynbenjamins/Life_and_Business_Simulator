import React from 'react';
import { Modal, Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import useGameStore from '../store/gameStore';
import { Colors } from '../theme/colors';

export default function ContentUpdateModal() {
  const router = useRouter();
  const visible = useGameStore((state) => state.showContentUpdateModal);
  const dismiss = useGameStore((state) => state.dismissContentUpdateModal);
  const openRelationships = useGameStore((state) => state.openRelationshipsFromContentUpdate);

  const goToRelationships = () => {
    openRelationships();
    router.replace('/relationships');
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={dismiss}>
      <View style={styles.backdrop}>
        <SafeAreaView style={styles.card}>
          <View style={styles.iconCircle}>
            <Ionicons name="heart" size={38} color={Colors.happiness} />
          </View>
          <Text style={styles.eyebrow}>NEW CONTENT</Text>
          <Text style={styles.title}>Personal Life has grown</Text>
          <Text style={styles.text}>
            Existing saves now have deeper relationship and family systems: children have age-based costs, low-income households can receive childcare support, and families can temporarily reduce spending during hard weeks.
          </Text>
          <View style={styles.tip}>
            <Ionicons name="compass-outline" size={20} color={Colors.info} />
            <Text style={styles.tipText}>Open Personal Life to meet people, build relationships, start a family, and plan your dynasty. If Personal Life was off for this save, this button turns it on.</Text>
          </View>
          <Pressable style={styles.primaryButton} onPress={goToRelationships}>
            <Text style={styles.primaryText}>Open Personal Life</Text>
            <Ionicons name="arrow-forward" size={20} color={Colors.white} />
          </Pressable>
          <Pressable style={styles.secondaryButton} onPress={dismiss}>
            <Text style={styles.secondaryText}>Keep playing</Text>
          </Pressable>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: '#000000B8', justifyContent: 'center', padding: 22 },
  card: { width: '100%', maxWidth: 460, alignSelf: 'center', backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.cardBorder, borderRadius: 22, padding: 24 },
  iconCircle: { width: 78, height: 78, borderRadius: 39, backgroundColor: `${Colors.happiness}20`, borderWidth: 1, borderColor: Colors.happiness, alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginBottom: 18 },
  eyebrow: { color: Colors.primary, fontSize: 11, fontWeight: '800', letterSpacing: 1.4, textAlign: 'center', marginBottom: 8 },
  title: { color: Colors.textPrimary, fontSize: 25, fontWeight: '800', textAlign: 'center' },
  text: { color: Colors.textSecondary, fontSize: 15, lineHeight: 23, textAlign: 'center', marginTop: 14 },
  tip: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, backgroundColor: Colors.elevated, borderRadius: 13, padding: 14, marginTop: 20 },
  tipText: { flex: 1, color: Colors.textPrimary, fontSize: 13, lineHeight: 19 },
  primaryButton: { minHeight: 56, borderRadius: 14, backgroundColor: Colors.primary, flexDirection: 'row', gap: 9, alignItems: 'center', justifyContent: 'center', marginTop: 22 },
  primaryText: { color: Colors.white, fontSize: 16, fontWeight: '800' },
  secondaryButton: { minHeight: 46, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  secondaryText: { color: Colors.textSecondary, fontSize: 14, fontWeight: '700' },
});
