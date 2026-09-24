import AsyncStorage from '@react-native-async-storage/async-storage';
import { getTutorialStep, TutorialSnapshot } from '../../engine/tutorialEngine';
import { flushTutorialWrites, TUTORIAL_STORAGE_KEY, useTutorialStore } from '../tutorialStore';

const snapshot: TutorialSnapshot = { scope: 'slot0_player_gen1', globalWeek: 1, hasEducation: false, isStudying: false, hasIncome: false };
const session = () => useTutorialStore.getState().sessions.find((entry) => entry.scope === snapshot.scope);

beforeAll(async () => { await useTutorialStore.getState().hydrate(); });
beforeEach(async () => {
  await flushTutorialWrites();
  useTutorialStore.setState({ ready: true, storageWarning: false, sessions: [], activeScope: null, highlight: null });
  jest.clearAllMocks();
});
afterEach(async () => { await flushTutorialWrites(); });

test('hydration never automatically starts an old guide', () => {
  expect(useTutorialStore.getState().activeScope).toBeNull();
});

test('pause and resume keep completed lessons', () => {
  useTutorialStore.getState().start(snapshot);
  useTutorialStore.getState().settle(snapshot.scope, 'cash_flow', snapshot);
  useTutorialStore.getState().pause();
  expect(useTutorialStore.getState().activeScope).toBeNull();
  expect(session()?.completed).toEqual(['cash_flow']);
  useTutorialStore.getState().start(snapshot);
  expect(getTutorialStep(session())?.id).toBe('education');
});

test('stale handlers and other saves cannot settle the active lesson', () => {
  useTutorialStore.getState().start(snapshot);
  useTutorialStore.getState().settle('other', 'cash_flow', snapshot);
  useTutorialStore.getState().settle(snapshot.scope, 'cash_flow', { ...snapshot, scope: 'other' });
  expect(session()?.completed).toEqual([]);
  useTutorialStore.getState().pause();
  useTutorialStore.getState().settle(snapshot.scope, 'cash_flow', snapshot);
  expect(session()?.completed).toEqual([]);
});

test('failed actions stay pending, successful actions reconcile from the snapshot', () => {
  useTutorialStore.getState().start(snapshot);
  useTutorialStore.getState().settle(snapshot.scope, 'cash_flow', snapshot);
  useTutorialStore.getState().reconcile(snapshot);
  expect(getTutorialStep(session())?.id).toBe('education');
  useTutorialStore.getState().reconcile({ ...snapshot, hasEducation: true, isStudying: true });
  expect(getTutorialStep(session())?.id).toBe('study_progress');
});

test('replay starts fresh without changing the supplied gameplay snapshot', () => {
  const immutable = Object.freeze({ ...snapshot });
  useTutorialStore.getState().start(immutable);
  useTutorialStore.getState().settle(snapshot.scope, 'cash_flow', immutable);
  useTutorialStore.getState().start(immutable, true);
  expect(getTutorialStep(session())?.id).toBe('cash_flow');
  expect(immutable).toEqual(snapshot);
});

test('replaced saves do not inherit a future week baseline', () => {
  useTutorialStore.getState().start({ ...snapshot, globalWeek: 100 });
  useTutorialStore.getState().settle(snapshot.scope, 'cash_flow', { ...snapshot, globalWeek: 100 });
  useTutorialStore.getState().pause();
  useTutorialStore.getState().start(snapshot);
  expect(session()?.baselineWeek).toBe(1);
  expect(getTutorialStep(session())?.id).toBe('cash_flow');
});

test('exploring a new life can forget only its own old tutorial', async () => {
  useTutorialStore.getState().start({ ...snapshot, scope: 'another-save' });
  useTutorialStore.getState().start(snapshot);
  await useTutorialStore.getState().forget(snapshot.scope);
  expect(session()).toBeUndefined();
  expect(useTutorialStore.getState().sessions.map((entry) => entry.scope)).toEqual(['another-save']);
  expect(useTutorialStore.getState().activeScope).toBeNull();
});

test('sidecar persists ordered completions, never active visibility or game fields', async () => {
  useTutorialStore.getState().start(snapshot);
  useTutorialStore.getState().settle(snapshot.scope, 'cash_flow', snapshot);
  await flushTutorialWrites();
  const raw = await AsyncStorage.getItem(TUTORIAL_STORAGE_KEY);
  const stored = JSON.parse(raw!);
  expect(Object.keys(stored).sort()).toEqual(['sessions', 'version']);
  expect(stored.sessions[0].completed).toEqual(['cash_flow']);
  expect(stored.activeScope).toBeUndefined();
  expect(stored.cash).toBeUndefined();
  expect(AsyncStorage.setItem).toHaveBeenCalledWith(TUTORIAL_STORAGE_KEY, expect.any(String));
});

test('failed persistence does not block the guide and a later write recovers', async () => {
  (AsyncStorage.setItem as jest.Mock).mockRejectedValueOnce(new Error('disk full'));
  useTutorialStore.getState().start(snapshot);
  await flushTutorialWrites();
  expect(useTutorialStore.getState().storageWarning).toBe(true);
  expect(useTutorialStore.getState().activeScope).toBe(snapshot.scope);
  useTutorialStore.getState().settle(snapshot.scope, 'cash_flow', snapshot);
  await flushTutorialWrites();
  expect(useTutorialStore.getState().storageWarning).toBe(false);
  expect(getTutorialStep(session())?.id).toBe('education');
});
