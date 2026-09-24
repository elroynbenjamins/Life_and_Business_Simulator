import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../theme/colors';
import GameStatusBar from './StatusBar';

interface Props {
  title: string;
  subtitle?: string;
  showBack?: boolean;
  onBack?: () => void;
  right?: React.ReactNode;
  showHud?: boolean;
  accentColor?: string;
}

export default function ScreenHeader({
  title,
  subtitle,
  showBack = false,
  onBack,
  right,
  showHud = true,
  accentColor,
}: Props) {
  return (
    <>
      <View style={styles.header}>
        <View style={styles.left}>
          {showBack ? (
            <Pressable accessibilityRole="button" onPress={onBack} hitSlop={12} style={styles.backButton}>
              <Ionicons name="arrow-back" size={22} color={Colors.textPrimary} />
            </Pressable>
          ) : null}
          <View style={styles.copy}>
            <Text style={styles.title}>{title}</Text>
            {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
            {accentColor ? <View style={[styles.accent, { backgroundColor: accentColor }]} /> : null}
          </View>
        </View>
        {right ? <View style={styles.right}>{right}</View> : null}
      </View>
      {showHud ? <GameStatusBar /> : null}
    </>
  );
}

const styles = StyleSheet.create({
  header: {
    minHeight: 54,
    paddingHorizontal: 16,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    backgroundColor: Colors.background,
  },
  left: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  copy: { flex: 1, minWidth: 0 },
  title: {
    color: Colors.textPrimary,
    fontSize: 22,
    lineHeight: 27,
    fontWeight: '800',
  },
  subtitle: {
    color: Colors.textMuted,
    fontSize: 11,
    lineHeight: 15,
    marginTop: 1,
  },
  accent: {
    width: 26,
    height: 2,
    borderRadius: 1,
    marginTop: 5,
  },
  backButton: {
    width: 34,
    height: 34,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    backgroundColor: Colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
});
