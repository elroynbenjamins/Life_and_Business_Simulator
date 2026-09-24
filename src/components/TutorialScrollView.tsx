import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef } from 'react';
import { ScrollView, ScrollViewProps, View } from 'react-native';
import { getTutorialScrollOffset } from '../engine/tutorialPresentation';
import type { TutorialTargetId } from '../engine/tutorialEngine';
import { useTutorialStore } from '../store/tutorialStore';
import { useTutorialFocusStore } from '../store/tutorialFocusStore';

interface TutorialScrollContextValue {
  reveal: (node: View, valid: () => boolean, done: () => void) => void;
}
const TutorialScrollContext = createContext<TutorialScrollContextValue | null>(null);

/** Normal ScrollView behaviour and caller callbacks are retained. Manual drag wins. */
export default function TutorialScrollView({
  onScroll, onScrollBeginDrag, onContentSizeChange, children, ...props
}: ScrollViewProps) {
  const scroll = useRef<ScrollView>(null);
  const offset = useRef(0);
  const contentHeight = useRef(0);
  const reveal = useCallback<TutorialScrollContextValue['reveal']>((node, valid, done) => {
    const host = scroll.current;
    if (!host || !valid()) return;
    try {
      host.measureInWindow((_sx, sy, sw, sh) => {
        if (!valid() || host !== scroll.current || sw <= 0 || sh <= 0) return;
        node.measureInWindow((_x, y, width, height) => {
          if (!valid() || host !== scroll.current || width <= 0) return;
          const next = getTutorialScrollOffset({
            targetY: y, targetHeight: height, viewportY: sy, viewportHeight: sh,
            scrollOffset: offset.current, contentHeight: contentHeight.current,
          });
          if (next === null) return;
          // Non-animated locating respects reduced motion and avoids racing gestures.
          if (Math.abs(next - offset.current) > 1) {
            host.scrollTo({ y: next, animated: false });
            offset.current = next;
          }
          done();
        });
      });
    } catch {
      // Detached/unmeasurable nodes fall back to the dock's bounded timeout.
    }
  }, []);
  const context = useMemo(() => ({ reveal }), [reveal]);
  return (
    <TutorialScrollContext.Provider value={context}>
      <ScrollView
        {...props}
        ref={scroll}
        removeClippedSubviews={false}
        scrollEventThrottle={16}
        onContentSizeChange={(width, height) => {
          contentHeight.current = height;
          onContentSizeChange?.(width, height);
        }}
        onScroll={(event) => {
          offset.current = event.nativeEvent.contentOffset.y;
          onScroll?.(event);
        }}
        onScrollBeginDrag={(event) => {
          const focus = useTutorialFocusStore.getState();
          focus.report(focus.request, 'cancelled');
          onScrollBeginDrag?.(event);
        }}
      >{children}</ScrollView>
    </TutorialScrollContext.Provider>
  );
}

/** Attach directly to the existing native control: no overlay or extra layout wrapper. */
export function useTutorialAnchor(id: TutorialTargetId | undefined, disabled = false) {
  const ref = useRef<View>(null);
  const context = useContext(TutorialScrollContext);
  const highlighted = useTutorialStore((state) => Boolean(id && !disabled && state.highlight === id));
  const request = useTutorialFocusStore((state) => id && state.target === id ? state.request : -1);
  const alive = useRef(false);
  const latest = useRef({ id, disabled, request });
  latest.current = { id, disabled, request };
  const attempt = useCallback(() => {
    const node = ref.current;
    const valid = () => {
      const focus = useTutorialFocusStore.getState();
      return alive.current && latest.current.id === id && !latest.current.disabled
        && latest.current.request === request && ref.current === node
        && useTutorialStore.getState().highlight === id
        && focus.target === id && focus.request === request && focus.status === 'locating';
    };
    if (!node || !context || !valid()) return;
    context.reveal(node, valid, () => useTutorialFocusStore.getState().report(request, 'located'));
  }, [context, id, request]);
  useEffect(() => {
    alive.current = true;
    // Route transitions and content layout may settle after the first effect.
    // Retries are bounded; they never restart after a drag, pause or new step.
    if (!highlighted) return () => { alive.current = false; };
    const timers = [80, 240, 600].map((delay) => setTimeout(attempt, delay));
    return () => { alive.current = false; timers.forEach(clearTimeout); };
  }, [highlighted, attempt]);
  return { ref, onLayout: attempt, highlighted };
}
