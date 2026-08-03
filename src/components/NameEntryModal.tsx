import React, { useState } from 'react';
import { View, Text, StyleSheet, Modal, TextInput, Pressable } from 'react-native';
import { Colors } from '../theme/colors';
import useGameStore from '../store/gameStore';

export default function NameEntryModal() {
  const showNameModal = useGameStore((s) => s?.showNameModal);
  const startNewGame = useGameStore((s) => s?.startNewGame);
  const [name, setName] = useState('');

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
          <Pressable
            style={styles.button}
            onPress={() => startNewGame?.(name)}
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
