import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../theme/colors';

export type ScreenTabItem<T extends string> = {
  key: T;
  label: string;
  icon?: React.ComponentProps<typeof Ionicons>['name'];
};

interface Props<T extends string> {
  items: ScreenTabItem<T>[];
  activeKey: T;
  onChange: (key: T) => void;
  accentColor?: string;
}

export default function ScreenTabs<T extends string>({
  items,
  activeKey,
  onChange,
  accentColor = Colors.primary,
}: Props<T>) {
  return (
    <View style={styles.container}>
      {items.map((item) => {
        const active = item.key === activeKey;
        return (
          <Pressable
            key={item.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            hitSlop={{ top: 3, bottom: 3 }}
            style={[
              styles.tab,
              active && { backgroundColor: `${accentColor}16`, borderColor: `${accentColor}55` },
            ]}
            onPress={() => onChange(item.key)}
          >
            {item.icon ? (
              <Ionicons
                name={item.icon}
                size={15}
                color={active ? accentColor : Colors.textMuted}
              />
            ) : null}
            <Text style={[styles.label, active && { color: accentColor }]} numberOfLines={1}>
              {item.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: 6,
    padding: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    backgroundColor: Colors.card,
    marginBottom: 12,
  },
  tab: {
    flex: 1,
    minWidth: 0,
    minHeight: 40,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 5,
    paddingHorizontal: 7,
    paddingVertical: 7,
  },
  label: {
    color: Colors.textSecondary,
    fontSize: 11,
    fontWeight: '800',
  },
});
