import React, { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../theme/colors';

export type FeatureTourStep = {
  title: string;
  body: string;
  icon?: React.ComponentProps<typeof Ionicons>['name'];
};

type FeatureTourModalProps = {
  visible: boolean;
  title: string;
  steps: FeatureTourStep[];
  onClose: () => void;
};

export default function FeatureTourModal({ visible, title, steps, onClose }: FeatureTourModalProps) {
  const { width, height } = useWindowDimensions();
  const [index, setIndex] = useState(0);
  const compact = width < 360 || height < 650;

  useEffect(() => {
    if (visible) setIndex(0);
  }, [visible]);

  if (steps.length === 0) return null;

  const step = steps[Math.min(index, steps.length - 1)];
  const last = index >= steps.length - 1;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Pressable
        style={styles.backdrop}
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel="Close tour"
      >
        <Pressable
          style={[styles.card, compact && styles.cardCompact]}
          onPress={(event) => event.stopPropagation()}
          accessibilityViewIsModal
          testID="feature-tour"
        >
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={styles.eyebrow}>OPTIONAL TOUR · {index + 1}/{steps.length}</Text>
              <Text style={styles.title}>{title}</Text>
            </View>
            <Pressable
              onPress={onClose}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Close tour"
              style={styles.closeButton}
            >
              <Ionicons name="close" size={20} color={Colors.textSecondary} />
            </Pressable>
          </View>

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            bounces={false}
          >
            <View style={[styles.lesson, compact && styles.lessonCompact]}>
              <View style={[styles.iconWrap, compact && styles.iconWrapCompact]}>
                <Ionicons name={step.icon ?? 'information-circle-outline'} size={compact ? 22 : 25} color={Colors.primary} />
              </View>
              <Text style={[styles.stepTitle, compact && styles.stepTitleCompact]}>{step.title}</Text>
              <Text style={[styles.body, compact && styles.bodyCompact]}>{step.body}</Text>
            </View>

            <View style={styles.progressRow} accessibilityLabel={`Step ${index + 1} of ${steps.length}`}>
              {steps.map((_, stepIndex) => (
                <View
                  key={stepIndex}
                  style={[styles.dot, stepIndex === index && styles.dotActive]}
                />
              ))}
            </View>

            <View style={styles.actions}>
              {index > 0 ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Previous tour step"
                  onPress={() => setIndex((value) => Math.max(0, value - 1))}
                  style={styles.secondaryButton}
                >
                  <Text style={styles.secondaryText}>Back</Text>
                </Pressable>
              ) : (
                <View style={styles.actionSpacer} />
              )}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={last ? 'Finish tour' : 'Next tour step'}
                onPress={() => {
                  if (last) onClose();
                  else setIndex((value) => Math.min(steps.length - 1, value + 1));
                }}
                style={styles.primaryButton}
              >
                <Text style={styles.primaryText}>{last ? 'Done' : 'Next'}</Text>
              </Pressable>
            </View>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: '#000000B8',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 440,
    maxHeight: '88%',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    backgroundColor: Colors.card,
    padding: 18,
  },
  cardCompact: { padding: 14, maxHeight: '94%' },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  eyebrow: { color: Colors.primary, fontSize: 10, fontWeight: '900', letterSpacing: 0.6 },
  title: { color: Colors.textPrimary, fontSize: 19, fontWeight: '900', marginTop: 3 },
  closeButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.elevated,
  },
  scroll: { flexShrink: 1 },
  scrollContent: { paddingBottom: 1 },
  lesson: {
    marginTop: 18,
    borderRadius: 14,
    backgroundColor: Colors.elevated,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    padding: 16,
  },
  lessonCompact: { marginTop: 12, padding: 13 },
  iconWrap: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: `${Colors.primary}18`,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  iconWrapCompact: { width: 36, height: 36, borderRadius: 10, marginBottom: 9 },
  stepTitle: { color: Colors.textPrimary, fontSize: 16, fontWeight: '900' },
  stepTitleCompact: { fontSize: 15 },
  body: { color: Colors.textSecondary, fontSize: 13, lineHeight: 19, marginTop: 7 },
  bodyCompact: { fontSize: 12, lineHeight: 17, marginTop: 5 },
  progressRow: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: 16 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: Colors.cardBorder },
  dotActive: { width: 20, backgroundColor: Colors.primary },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 18 },
  actionSpacer: { flex: 1 },
  secondaryButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.elevated,
  },
  secondaryText: { color: Colors.textSecondary, fontSize: 13, fontWeight: '800' },
  primaryButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
  },
  primaryText: { color: '#FFFFFF', fontSize: 13, fontWeight: '900' },
});
