import React from 'react';
import { Pressable, StyleSheet, Text, ViewStyle, StyleProp } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../theme/colors';
import { TutorialTargetId } from '../engine/tutorialEngine';
import { useTutorialAnchor } from './TutorialScrollView';

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost';

interface Props {
  label: string;
  onPress: () => void;
  icon?: React.ComponentProps<typeof Ionicons>['name'];
  trailingIcon?: React.ComponentProps<typeof Ionicons>['name'];
  variant?: Variant;
  disabled?: boolean;
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
  accentColor?: string;
  tutorialId?: TutorialTargetId;
}

export default function GameButton({
  label,
  onPress,
  icon,
  trailingIcon,
  variant = 'primary',
  disabled = false,
  compact = false,
  style,
  accentColor = Colors.primary,
  tutorialId,
}: Props) {
  const { ref, onLayout, highlighted } = useTutorialAnchor(tutorialId, disabled);
  const foreground = variant === 'primary' || variant === 'danger' ? Colors.white
    : variant === 'secondary' ? Colors.textPrimary
      : Colors.textSecondary;
  const iconColor = variant === 'danger' ? Colors.white
    : variant === 'primary' ? Colors.white
      : variant === 'secondary' ? accentColor
        : Colors.textSecondary;

  return (
    <Pressable
      ref={ref}
      collapsable={false}
      onLayout={onLayout}
      testID={tutorialId ? `tutorial-target-${tutorialId}` : undefined}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      accessibilityHint={highlighted ? 'Highlighted by the guided introduction. This performs the normal game action.' : undefined}
      disabled={disabled}
      hitSlop={compact ? 5 : undefined}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        compact && styles.compact,
        variant === 'primary' && styles.primary,
        variant === 'primary' && { backgroundColor: accentColor, borderColor: accentColor },
        variant === 'secondary' && styles.secondary,
        variant === 'danger' && styles.danger,
        variant === 'ghost' && styles.ghost,
        disabled && styles.disabled,
        pressed && !disabled && styles.pressed,
        style,
        highlighted && styles.tutorialHighlight,
      ]}
    >
      {icon ? <Ionicons name={icon} size={compact ? 15 : 17} color={iconColor} /> : null}
      <Text style={[styles.label, compact && styles.compactLabel, { color: foreground }]}>{label}</Text>
      {trailingIcon ? <Ionicons name={trailingIcon} size={compact ? 15 : 17} color={iconColor} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 44, borderRadius: 11, paddingHorizontal: 14, paddingVertical: 10,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, borderWidth: 1,
  },
  compact: { minHeight: 34, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 9 },
  primary: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  secondary: { backgroundColor: Colors.elevated, borderColor: Colors.cardBorder },
  danger: { backgroundColor: Colors.negative, borderColor: Colors.negative },
  ghost: { backgroundColor: 'transparent', borderColor: 'transparent' },
  label: { fontSize: 14, fontWeight: '800' },
  compactLabel: { fontSize: 12 },
  disabled: { opacity: 0.42 },
  pressed: { opacity: 0.86, transform: [{ scale: 0.985 }] },
  tutorialHighlight: { borderColor: Colors.warning, shadowColor: Colors.warning, shadowOpacity: 0.65, shadowRadius: 7, shadowOffset: { width: 0, height: 0 }, elevation: 4 },
});
