import React from 'react';
import { View, Text, StyleSheet, Pressable, StyleProp, ViewStyle } from 'react-native';
import { Colors } from '../theme/colors';
import { tutorialCardTarget, TutorialTargetId } from '../engine/tutorialEngine';
import { useTutorialHighlight } from '../store/tutorialStore';

export type GameCardVariant = 'standard' | 'hero' | 'subtle' | 'attention' | 'danger';

interface Props {
  title?: string;
  eyebrow?: string;
  titleAccessory?: React.ReactNode;
  onPress?: () => void;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  variant?: GameCardVariant;
  accentColor?: string;
  compact?: boolean;
  tutorialId?: TutorialTargetId;
}

export default function GameCard({
  title, eyebrow, titleAccessory, onPress, children, style,
  variant = 'standard', accentColor, compact = false, tutorialId,
}: Props) {
  const highlighted = useTutorialHighlight(tutorialId ?? tutorialCardTarget(title, eyebrow));
  const accent = accentColor
    ?? (variant === 'danger' ? Colors.negative : variant === 'attention' ? Colors.warning : Colors.primary);
  const content = (
    <View
      style={[
        styles.card, compact && styles.compact,
        variant === 'hero' && styles.hero, variant === 'subtle' && styles.subtle,
        variant === 'attention' && styles.attention, variant === 'danger' && styles.danger,
        (variant === 'hero' || variant === 'attention' || variant === 'danger') && { borderColor: accent },
        style, highlighted && styles.tutorialHighlight,
      ]}
    >
      {(eyebrow || title || titleAccessory) ? (
        <View style={styles.headingRow}>
          <View style={styles.headingCopy}>
            {eyebrow ? <Text style={[styles.eyebrow, { color: accent }]}>{eyebrow}</Text> : null}
            {title ? <Text style={[styles.title, variant === 'hero' && styles.heroTitle]}>{title}</Text> : null}
          </View>
          {titleAccessory ? <View style={styles.titleAccessory}>{titleAccessory}</View> : null}
        </View>
      ) : null}
      {children}
    </View>
  );
  if (onPress) {
    return <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [pressed && styles.pressed]}>{content}</Pressable>;
  }
  return content;
}
const styles = StyleSheet.create({
  card: { backgroundColor: Colors.card, borderRadius: 12, borderWidth: 1, borderColor: Colors.cardBorder, padding: 16, marginBottom: 12 },
  compact: { padding: 12, marginBottom: 10 },
  hero: { backgroundColor: Colors.card, borderWidth: 1, borderRadius: 16 },
  subtle: { backgroundColor: Colors.elevated, borderColor: Colors.cardBorder },
  attention: { backgroundColor: Colors.card, borderWidth: 1 },
  danger: { backgroundColor: Colors.card, borderWidth: 1 },
  headingRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 9 },
  headingCopy: { flex: 1, minWidth: 0 },
  eyebrow: { fontSize: 10, fontWeight: '800', letterSpacing: 1.05, marginBottom: 2 },
  title: { color: Colors.textPrimary, fontSize: 16, fontWeight: '700' },
  heroTitle: { fontSize: 18, fontWeight: '800' },
  titleAccessory: { alignItems: 'flex-end', justifyContent: 'center' },
  pressed: { opacity: 0.88, transform: [{ scale: 0.992 }] },
  tutorialHighlight: { borderColor: Colors.warning, shadowColor: Colors.warning, shadowOpacity: 0.4, shadowRadius: 7, shadowOffset: { width: 0, height: 0 }, elevation: 3 },
});
