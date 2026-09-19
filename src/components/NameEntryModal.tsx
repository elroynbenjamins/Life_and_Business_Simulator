import React, { useState } from 'react';
import { View, Text, StyleSheet, Modal, TextInput, Pressable } from 'react-native';
import { Colors } from '../theme/colors';
import useGameStore from '../store/gameStore';

export default function NameEntryModal() {
  const showNameModal = useGameStore((s) => s?.showNameModal);
  const startNewGame = useGameStore((s) => s?.startNewGame);
  const [name, setName] = useState('');
  const [relationshipModeEnabled, setRelationshipModeEnabled] = useState(false);

  if (!showNameModal) return null;

  return (
    <Modal visible transparent animationType="fade">
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.title}>Welcome!</Text>
          <Text style={styles.subtitle}>Enter your name to begin</Text>
          <TextInput
            style={styles.input}
            placeholder="Your name"
            placeholderTextColor={Colors.textMuted}
            value={name}
            onChangeText={setName}
            autoFocus
            maxLength={20}
          />
          <View style={styles.modeBox}>
            <View style={styles.modeHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modeTitle}>Personal Life</Text>
                <Text style={styles.modeDesc}>Optional dating and relationship gameplay that can affect household finances and happiness.</Text>
              </View>
              <Pressable
                style={[styles.toggle, relationshipModeEnabled && styles.toggleOn]}
                onPress={() => setRelationshipModeEnabled((value) => !value)}
                accessibilityRole="switch"
                accessibilityState={{ checked: relationshipModeEnabled }}
              >
                <View style={[styles.toggleThumb, relationshipModeEnabled && styles.toggleThumbOn]} />
              </Pressable>
            </View>
            <Text style={styles.modeStatus}>{relationshipModeEnabled ? 'Enabled for this save' : 'Disabled — economy-only play remains unchanged'}</Text>
          </View>

          <Pressable
            style={styles.button}
            onPress={() => startNewGame?.(name, relationshipModeEnabled)}
          >
            <Text style={styles.buttonText}>Start Game</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 32,
    width: '100%',
    maxWidth: 400,
  },
  title: {
    color: Colors.textPrimary,
    fontSize: 28,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    color: Colors.textSecondary,
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 24,
  },
  input: {
    backgroundColor: Colors.elevated,
    color: Colors.textPrimary,
    borderRadius: 12,
    padding: 16,
    fontSize: 18,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  modeBox: {
    backgroundColor: Colors.elevated,
    borderRadius: 12,
    padding: 14,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  modeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  modeTitle: {
    color: Colors.textPrimary,
    fontSize: 15,
    fontWeight: '700',
  },
  modeDesc: {
    color: Colors.textSecondary,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 3,
  },
  modeStatus: {
    color: Colors.textMuted,
    fontSize: 11,
    marginTop: 10,
  },
  toggle: {
    width: 48,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.cardBorder,
    padding: 3,
    justifyContent: 'center',
  },
  toggleOn: {
    backgroundColor: Colors.happiness,
  },
  toggleThumb: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: Colors.white,
  },
  toggleThumbOn: {
    alignSelf: 'flex-end',
  },
  button: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  buttonText: {
    color: Colors.white,
    fontSize: 17,
    fontWeight: '700',
  },
});
