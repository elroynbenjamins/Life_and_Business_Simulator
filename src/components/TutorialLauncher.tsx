import React, { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useShallow } from 'zustand/react/shallow';
import useGameStore from '../store/gameStore';
import { useTutorialStore } from '../store/tutorialStore';
import { getTutorialScope, getTutorialStep } from '../engine/tutorialEngine';
import { tutorialSnapshot } from './TutorialDock';
import { Colors } from '../theme/colors';

export default function TutorialLauncher({ resumeOnly = false }: { resumeOnly?: boolean }) {
  const router = useRouter();
  const scope = useGameStore((state) => getTutorialScope(state.activeSlot ?? 0, state.playerName ?? 'Player', state.generation ?? 1));
  const { ready, sessions, activeScope, hydrate, start } = useTutorialStore(useShallow((state) => ({
    ready: state.ready, sessions: state.sessions, activeScope: state.activeScope, hydrate: state.hydrate, start: state.start,
  })));
  useEffect(() => { void hydrate(); }, [hydrate]);
  const session = sessions.find((entry) => entry.scope === scope);
  const unfinished = Boolean(getTutorialStep(session));
  if (activeScope === scope || (resumeOnly && !unfinished)) return null;
  const label = unfinished ? 'Resume guided introduction' : session ? 'Replay guided introduction' : 'Start guided introduction';
  return (
    <View style={styles.wrap}>
      <Pressable
        accessibilityRole="button" accessibilityState={{ disabled: !ready }} disabled={!ready}
        style={[styles.button, !ready && { opacity: 0.5 }]}
        onPress={() => {
          start(tutorialSnapshot(), !unfinished);
          const current = useTutorialStore.getState().sessions.find((entry) => entry.scope === scope);
          const step = getTutorialStep(current);
          if (step) router.navigate(step.route);
        }}
      >
        <Text style={styles.text}>{ready ? label : 'Loading guidance...'}</Text>
      </Pressable>
      {!resumeOnly && <Text style={styles.hint}>Optional, skippable and based on your current save. Replaying never resets your game or grants rewards.</Text>}
    </View>
  );
}
const styles = StyleSheet.create({
  wrap: { marginBottom: 12 },
  button: { minHeight: 44, borderRadius: 11, borderWidth: 1, borderColor: Colors.primary, backgroundColor: Colors.card, padding: 12, justifyContent: 'center', alignItems: 'center' },
  text: { color: Colors.primary, fontSize: 13, fontWeight: '800', textAlign: 'center' },
  hint: { color: Colors.textMuted, fontSize: 12, lineHeight: 17, marginTop: 6 },
});
