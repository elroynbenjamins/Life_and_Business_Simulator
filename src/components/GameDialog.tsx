import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { create } from 'zustand';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../theme/colors';

type DialogOptions = {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  destructive?: boolean;
  onConfirm?: () => void;
};

type DialogState = DialogOptions & {
  visible: boolean;
  open: (options: DialogOptions) => void;
  close: () => void;
};

const useDialogStore = create<DialogState>((set) => ({
  visible: false,
  title: '',
  message: '',
  open: (options) => set({ ...options, visible: true }),
  close: () => set({ visible: false, onConfirm: undefined }),
}));

export function showGameDialog(options: DialogOptions) {
  useDialogStore.getState().open(options);
}

export default function GameDialog() {
  const dialog = useDialogStore();
  const confirm = () => {
    const action = dialog.onConfirm;
    dialog.close();
    action?.();
  };

  return (
    <Modal visible={dialog.visible} transparent animationType="fade" onRequestClose={dialog.close}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={[styles.iconWrap, dialog.destructive && styles.dangerIconWrap]}>
            <Ionicons name={dialog.destructive ? 'warning-outline' : 'information-circle-outline'} size={28} color={dialog.destructive ? Colors.negative : Colors.primary} />
          </View>
          <Text style={styles.title}>{dialog.title}</Text>
          <Text style={styles.message}>{dialog.message}</Text>
          <View style={styles.actions}>
            {dialog.onConfirm && (
              <Pressable style={styles.cancelButton} onPress={dialog.close}>
                <Text style={styles.cancelText}>{dialog.cancelText ?? 'Cancel'}</Text>
              </Pressable>
            )}
            <Pressable style={[styles.confirmButton, dialog.destructive && styles.dangerButton]} onPress={confirm}>
              <Text style={styles.confirmText}>{dialog.confirmText ?? (dialog.onConfirm ? 'Confirm' : 'OK')}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.82)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  card: { width: '100%', maxWidth: 400, backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.cardBorder, borderRadius: 18, padding: 22 },
  iconWrap: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#10382D', justifyContent: 'center', alignItems: 'center', alignSelf: 'center', marginBottom: 12 },
  dangerIconWrap: { backgroundColor: '#3A1D1D' },
  title: { color: Colors.textPrimary, fontSize: 21, fontWeight: '800', textAlign: 'center' },
  message: { color: Colors.textSecondary, fontSize: 15, lineHeight: 22, textAlign: 'center', marginTop: 10 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 22 },
  cancelButton: { flex: 1, minHeight: 48, borderRadius: 11, borderWidth: 1, borderColor: Colors.cardBorder, justifyContent: 'center', alignItems: 'center' },
  cancelText: { color: Colors.textSecondary, fontSize: 15, fontWeight: '700' },
  confirmButton: { flex: 1, minHeight: 48, borderRadius: 11, backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center' },
  dangerButton: { backgroundColor: Colors.negative },
  confirmText: { color: Colors.white, fontSize: 15, fontWeight: '800' },
});
