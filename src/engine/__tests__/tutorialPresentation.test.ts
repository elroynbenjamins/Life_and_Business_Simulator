import { getLifestyleTab, getTutorialScrollOffset, TutorialScrollGeometry } from '../tutorialPresentation';
import { getFirstLifeJourney } from '../firstLifeJourney';
import { INITIAL_GAME_STATE } from '../../types/game';
const geometry: TutorialScrollGeometry = {
  viewportY: 100, viewportHeight: 400, scrollOffset: 200, contentHeight: 1500,
  targetY: 200, targetHeight: 44,
};

describe('measured tutorial scrolling', () => {
  test('does not move a visible target', () => expect(getTutorialScrollOffset(geometry)).toBe(200));
  test('brings a target below the visible area into view', () => {
    expect(getTutorialScrollOffset({ ...geometry, targetY: 700 })).toBe(456);
  });
  test('brings a target above the visible area into view', () => {
    expect(getTutorialScrollOffset({ ...geometry, targetY: 50 })).toBe(138);
  });
  test('aligns an oversized card to its start rather than hiding the choices header', () => {
    expect(getTutorialScrollOffset({ ...geometry, targetY: 600, targetHeight: 800 })).toBe(688);
  });
  test('clamps to the scrollable range', () => {
    expect(getTutorialScrollOffset({ ...geometry, targetY: -1000 })).toBe(0);
    expect(getTutorialScrollOffset({ ...geometry, targetY: 5000 })).toBe(1100);
    expect(getTutorialScrollOffset({ ...geometry, contentHeight: 100 })).toBe(0);
  });
  test.each([
    { targetHeight: 0 }, { viewportHeight: 0 }, { contentHeight: 0 },
    { targetY: NaN }, { scrollOffset: Infinity }, { viewportY: NaN },
  ])('rejects missing or corrupt measurements %p', (override) => {
    expect(getTutorialScrollOffset({ ...geometry, ...override })).toBeNull();
  });
  test('recalculates for a smaller viewport instead of assuming a phone height', () => {
    expect(getTutorialScrollOffset({ ...geometry, viewportHeight: 160, targetY: 200, targetHeight: 60 })).toBe(212);
  });
});

describe('Lifestyle routing', () => {
  test.each([undefined, null, '', 'invalid', 'housing', [], ['unknown'], 12])('defaults safely to Housing for %p', (value) => {
    expect(getLifestyleTab(value)).toBe('housing');
  });
  test.each(['transport', ['transport']])('accepts the explicit Transport section %p', (value) => {
    expect(getLifestyleTab(value)).toBe('transport');
  });
  test('the transport objective names and opens the Transport section', () => {
    const step = getFirstLifeJourney(INITIAL_GAME_STATE).steps.find((entry) => entry.id === 'transport');
    expect(step?.route).toBe('/housing?section=transport');
    expect(step?.actionLabel).toBe('Open Transport');
  });
});
