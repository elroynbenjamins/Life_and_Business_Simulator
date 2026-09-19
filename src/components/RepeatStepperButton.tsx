import React, { useCallback, useEffect, useRef } from 'react';
import { AppState, Pressable, PressableProps } from 'react-native';
import { useFocusEffect } from 'expo-router';

type Props = Omit<PressableProps, 'onPress' | 'onPressIn' | 'onPressOut' | 'onLongPress'> & {
  onStep: (amount: number) => void;
};

/** Tap once, or hold to repeat. Never submits a trade. */
export default function RepeatStepperButton({ onStep, disabled, ...props }: Props) {
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const repeated = useRef(false);
  const callback = useRef(onStep);
  callback.current = onStep;
  const stop = useCallback(() => {
    if (timer.current !== null) clearInterval(timer.current);
    timer.current = null;
  }, []);
  useFocusEffect(useCallback(() => stop, [stop]));
  useEffect(() => {
    if (disabled) stop();
  }, [disabled, stop]);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => { if (state !== 'active') stop(); });
    return () => { subscription.remove(); stop(); };
  }, [stop]);
  const start = () => {
    if (disabled) return;
    stop();
    repeated.current = true;
    const started = Date.now();
    callback.current(1);
    timer.current = setInterval(() => {
      const elapsed = Date.now() - started;
      callback.current(elapsed >= 5000 ? 100 : elapsed >= 2500 ? 25 : elapsed >= 1000 ? 5 : 1);
    }, 100);
  };
  return <Pressable {...props} disabled={disabled} delayLongPress={350}
    onPressIn={() => { stop(); repeated.current = false; }}
    onLongPress={start}
    onPressOut={stop}
    onPress={() => { if (!repeated.current && !disabled) callback.current(1); }}
    accessibilityRole="button"
  />;
}
