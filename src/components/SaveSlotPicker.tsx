import React from 'react';
import { View, Text, StyleSheet, Modal, Pressable, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../theme/colors';
import useGameStore from '../store/gameStore';
import { formatCurrency } from '../utils/format';

export default function SaveSlotPicker() {
  const showSlotPicker = useGameStore((s) => s?.showSlotPicker);
  const closeSlotPicker = useGameStore((s) => s?.closeSlotPicker);
  const loadSlot = useGameStore((s) => s?.loadSlot);
  const deleteSlot = useGameStore((s) => s?.deleteSlot);
  const slotMeta = useGameStore((s) => s?.slotMeta ?? {});
  const activeSlot = useGameStore((s) => s?.activeSlot ?? 0);
  const profile = useGameStore((s) => s?.profile);

  if (!showSlotPicker) return null;

  const handleDelete = (slot: number) => {
    Alert.alert('Delete Save', `Delete save slot ${slot + 1}? This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteSlot?.(slot) },
    ]);
  };

  return (
    <Modal visible transparent animationType="fade">
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.title}>Save Slots</Text>
          <View style={styles.profileRow}>
            <Ionicons name="star" size={16} color={Colors.warning} />
            <Text style={styles.profileText}>Total XP: {profile?.totalXp ?? 0}</Text>
            <Ionicons name="diamond" size={16} color="#8B5CF6" />
            <Text style={styles.profileText}>{profile?.gems ?? 0} Gems</Text>
          </View>

          {[0, 1, 2].map((slot) => {
            const meta = slotMeta[slot];
            const isActive = slot === activeSlot && meta;
            return (
              <View key={slot} style={[styles.slotCard, isActive && styles.slotActive]}>
                <Pressable style={styles.slotContent} onPress={() => loadSlot?.(slot)}>
                  <Text style={styles.slotLabel}>Slot {slot + 1}</Text>
                  {meta ? (
                    <View>
                      <Text style={styles.slotName}>{meta.playerName}</Text>
                      <Text style={styles.slotMeta}>
                        Age {meta.age} • Year {meta.year} Week {meta.week}
                      </Text>
                      <Text style={styles.slotMeta}>
                        Net Worth: {formatCurrency(meta.netWorth ?? 0)}
                      </Text>
                    </View>
                  ) : (
                    <Text style={styles.emptyText}>Empty — Tap to start new game</Text>
                  )}
                </Pressable>
                {meta && (
                  <Pressable style={styles.deleteBtn} onPress={() => handleDelete(slot)} hitSlop={8}>
                    <Ionicons name="trash-outline" size={18} color={Colors.negative} />
                  </Pressable>
                )}
              </View>
            );
          })}

          {/* Only show close if there's a game loaded */}
          {slotMeta[activeSlot] && (
            <Pressable style={styles.closeBtn} onPress={closeSlotPicker}>
              <Text style={styles.closeBtnText}>Back to Game</Text>
            </Pressable>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  card: { backgroundColor: Colors.card, borderRadius: 20, padding: 24, width: '100%', maxWidth: 400 },
  title: { color: Colors.textPrimary, fontSize: 24, fontWeight: '700', textAlign: 'center', marginBottom: 8 },
  profileRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, marginBottom: 16 },
  profileText: { color: Colors.textSecondary, fontSize: 14, fontWeight: '600' },
  slotCard: { backgroundColor: Colors.elevated, borderRadius: 12, borderWidth: 1, borderColor: Colors.cardBorder, padding: 16, marginBottom: 10, flexDirection: 'row', alignItems: 'center' },
  slotActive: { borderColor: Colors.primary },
  slotContent: { flex: 1 },
  slotLabel: { color: Colors.textMuted, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 },
  slotName: { color: Colors.textPrimary, fontSize: 17, fontWeight: '700' },
  slotMeta: { color: Colors.textSecondary, fontSize: 13, marginTop: 2 },
  emptyText: { color: Colors.textMuted, fontSize: 14, fontStyle: 'italic' },
  deleteBtn: { padding: 8 },
  closeBtn: { borderWidth: 1, borderColor: Colors.primary, borderRadius: 12, padding: 14, alignItems: 'center', marginTop: 8 },
  closeBtnText: { color: Colors.primary, fontSize: 16, fontWeight: '600' },
});
