export type LifestyleTab = 'housing' | 'transport';
export function getLifestyleTab(value: unknown): LifestyleTab {
  const first = Array.isArray(value) ? value[0] : value;
  return first === 'transport' ? 'transport' : 'housing';
}

export interface TutorialScrollGeometry {
  targetY: number;
  targetHeight: number;
  viewportY: number;
  viewportHeight: number;
  scrollOffset: number;
  contentHeight: number;
}

/** Window coordinates, never guessed row heights. Returns null for unavailable layout. */
export function getTutorialScrollOffset(g: TutorialScrollGeometry): number | null {
  if (!Object.values(g).every(Number.isFinite)
    || g.targetHeight <= 0 || g.viewportHeight <= 0 || g.contentHeight <= 0) return null;
  const margin = Math.min(12, g.viewportHeight / 10);
  const top = g.viewportY + margin;
  const bottom = g.viewportY + g.viewportHeight - margin;
  const maxOffset = Math.max(0, g.contentHeight - g.viewportHeight);
  let next = g.scrollOffset;
  if (g.targetHeight > bottom - top || g.targetY < top) {
    next += g.targetY - top;
  } else if (g.targetY + g.targetHeight > bottom) {
    next += g.targetY + g.targetHeight - bottom;
  }
  return Math.max(0, Math.min(maxOffset, next));
}
