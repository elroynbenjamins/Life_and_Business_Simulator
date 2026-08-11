import React, { useState } from 'react';
import { View, Text, StyleSheet, Modal, Pressable, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../theme/colors';
import useGameStore from '../store/gameStore';
import { formatCurrency } from '../utils/format';

export default function SaveSlotPicker() {
  const showSlotPicker = useGameStore((s) => s.showSlotPicker);
  const closeSlotPicker = useGameStore((s) => s.closeSlotPicker);
  const loadSlot = useGameStore((s) => s.loadSlot);
  const deleteSlot = useGameStore((s) => s.deleteSlot);
  const slotMeta = useGameStore((s) => s.slotMeta ?? {});
  const activeSlot = useGameStore((s) => s.activeSlot ?? 0);
  const profile = useGameStore((s) => s.profile);
  const slotPickerMode = useGameStore((s) => s.slotPickerMode ?? 'load');
  const selectNewGameSlot = useGameStore((s) => s.selectNewGameSlot);
  const showMainMenu = useGameStore((s) => s.showMainMenu);
  const [replaceSlot, setReplaceSlot] = useState<number | null>(null);

  if (!showSlotPicker) return null;

  const handleDelete = (slot: number) => {
    Alert.alert('Delete Save', `Delete save slot ${slot + 1}? This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteSlot(slot) },
    ]);
  };

  const handleSlotPress = (slot: number, occupied: boolean) => {
    if (slotPickerMode === 'load') loadSlot(slot);
    else if (occupied) setReplaceSlot(slot);
    else selectNewGameSlot(slot);
  };

  return (
    <Modal visible transparent animationType="fade">
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.title}>{slotPickerMode === 'new' ? 'Choose a New Game Slot' : 'Save Slots'}</Text>
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
                <Pressable style={styles.slotContent} onPress={() => handleSlotPress(slot, !!meta)}>
                  <Text style={styles.slotLabel}>Slot {slot + 1}</Text>
                  {meta ? (
                    <View>
                      <Text style={styles.slotName}>{meta.playerName}</Text>
                      <Text style={styles.slotMeta}>Age {meta.age} · Year {meta.year} Week {meta.week}</Text>
                      <Text style={styles.slotMeta}>Net Worth: {formatCurrency(meta.netWorth ?? 0)}</Text>
                      {slotPickerMode === 'new' && <Text style={styles.replaceHint}>Tap to replace this save</Text>}
                    </View>
                  ) : (
                    <Text style={styles.emptyText}>Empty — Tap to start new game</Text>
                  )}
                </Pressable>
                {meta && slotPickerMode === 'load' && (
                  <Pressable style={styles.deleteBtn} onPress={() => handleDelete(slot)} hitSlop={8}>
                    <Ionicons name="trash-outline" size={18} color={Colors.negative} />
                  </Pressable>
                )}
              </View>
            );
          })}

          {replaceSlot !== null && (
            <View style={styles.confirmBox}>
              <Text style={styles.confirmTitle}>Replace Slot {replaceSlot + 1}?</Text>
              <Text style={styles.confirmText}>Starting the new game will permanently replace this save.</Text>
              <View style={styles.confirmActions}>
                <Pressable style={styles.cancelBtn} onPress={() => setReplaceSlot(null)}>
                  <Text style={styles.cancelText}>Cancel</Text>
                </Pressable>
                <Pressable style={styles.replaceBtn} onPress={() => selectNewGameSlot(replaceSlot)}>
                  <Text style={styles.replaceText}>Replace Save</Text>
                </Pressable>
              </View>
            </View>
          )}

          <Pressable style={styles.closeBtn} onPress={() => { setReplaceSlot(null); closeSlotPicker(); }}>
            <Text style={styles.closeBtnText}>{showMainMenu ? 'Back to Main Menu' : 'Back to Game'}</Text>
          </Pressable>
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
  replaceHint: { color: Colors.warning, fontSize: 12, fontWeight: '700', marginTop: 6 },
  emptyText: { color: Colors.textMuted, fontSize: 14, fontStyle: 'italic' },
  deleteBtn: { padding: 8 },
  confirmBox: { backgroundColor: '#301B1B', borderWidth: 1, borderColor: Colors.negative, borderRadius: 12, padding: 14, marginTop: 4 },
  confirmTitle: { color: Colors.textPrimary, fontSize: 16, fontWeight: '700', marginBottom: 4 },
  confirmText: { color: Colors.textSecondary, fontSize: 13, lineHeight: 18 },
  confirmActions: { flexDirection: 'row', gap: 10, marginTop: 12 },
  cancelBtn: { flex: 1, borderWidth: 1, borderColor: Colors.cardBorder, borderRadius: 10, padding: 11, alignItems: 'center' },
  cancelText: { color: Colors.textSecondary, fontWeight: '700' },
  replaceBtn: { flex: 1, backgroundColor: Colors.negative, borderRadius: 10, padding: 11, alignItems: 'center' },
  replaceText: { color: Colors.white, fontWeight: '700' },
  closeBtn: { borderWidth: 1, borderColor: Colors.primary, borderRadius: 12, padding: 14, alignItems: 'center', marginTop: 8 },
  closeBtnText: { color: Colors.primary, fontSize: 16, fontWeight: '600' },
});
