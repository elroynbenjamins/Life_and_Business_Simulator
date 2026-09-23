import React from 'react';
import { Pressable, StyleSheet, Text, ViewStyle, StyleProp } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../theme/colors';

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
}: Props) {
  const foreground = variant === 'primary' || variant === 'danger' ? Colors.white
    : variant === 'secondary' ? Colors.textPrimary
      : Colors.textSecondary;
  const iconColor = variant === 'danger' ? Colors.white
    : variant === 'primary' ? Colors.white
      : variant === 'secondary' ? Colors.primary
        : Colors.textSecondary;

  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        compact && styles.compact,
        variant === 'primary' && styles.primary,
        variant === 'secondary' && styles.secondary,
        variant === 'danger' && styles.danger,
        variant === 'ghost' && styles.ghost,
        disabled && styles.disabled,
        pressed && !disabled && styles.pressed,
        style,
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
    minHeight: 44,
    borderRadius: 11,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    borderWidth: 1,
  },
  compact: {
    minHeight: 34,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 9,
  },
  primary: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  secondary: {
    backgroundColor: Colors.elevated,
    borderColor: Colors.cardBorder,
  },
  danger: {
    backgroundColor: Colors.negative,
    borderColor: Colors.negative,
  },
  ghost: {
    backgroundColor: 'transparent',
    borderColor: 'transparent',
  },
  label: {
    fontSize: 14,
    fontWeight: '800',
  },
  compactLabel: {
    fontSize: 12,
  },
  disabled: { opacity: 0.42 },
  pressed: {
    opacity: 0.86,
    transform: [{ scale: 0.985 }],
  },
});
