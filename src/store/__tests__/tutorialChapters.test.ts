import AsyncStorage from '@react-native-async-storage/async-storage';
import { chapterSessionKey, getChapterStep } from '../../engine/tutorialChapterEngine';
import { getTutorialStep } from '../../engine/tutorialEngine';
import { flushTutorialWrites, TUTORIAL_STORAGE_KEY, useTutorialStore } from '../tutorialStore';
const snapshot = { scope: 'save0', globalWeek: 20, hasEducation: false, isStudying: false, hasIncome: false };
const key = chapterSessionKey(snapshot.scope, 'business');
const current = () => useTutorialStore.getState().chapters.find(entry => chapterSessionKey(entry.scope, entry.chapter) === key);
const ack = (id: 'business_balance' | 'business_team' | 'business_cash', skip = false) => {
  const state = useTutorialStore.getState();
  state.settleChapter(key, id, state.chapterRevision, skip);
};
beforeAll(async () => { await useTutorialStore.getState().hydrate(); });
beforeEach(async () => {
  await flushTutorialWrites();
  useTutorialStore.setState({ ready: true, storageWarning: false, sessions: [], chapters: [], activeScope: null, activeChapterKey: null, chapterRevision: 0, uiBlockers: {}, highlight: null });
  jest.clearAllMocks();
});
afterEach(async () => { await flushTutorialWrites(); });

test('one controller shows only one guide while preserving the paused opening', () => {
  const state = useTutorialStore.getState();
  state.start(snapshot);
  state.settle(snapshot.scope, 'cash_flow', snapshot);
  state.startChapter(snapshot, 'business', 'company1');
  expect(useTutorialStore.getState().activeScope).toBeNull();
  expect(useTutorialStore.getState().activeChapterKey).toBe(key);
  expect(getTutorialStep(useTutorialStore.getState().sessions[0])?.id).toBe('education');
  state.start(snapshot);
  expect(useTutorialStore.getState().activeChapterKey).toBeNull();
  expect(useTutorialStore.getState().activeScope).toBe(snapshot.scope);
});
test('pause/resume retains learned lessons when looking at another owned company', () => {
  useTutorialStore.getState().startChapter(snapshot, 'business', 'company1');
  ack('business_balance');
  useTutorialStore.getState().pause();
  useTutorialStore.getState().startChapter(snapshot, 'business', 'company2');
  expect(current()?.subjectId).toBe('company2');
  expect(getChapterStep(current())?.id).toBe('business_team');
});
test('replay rejects a stale acknowledgement even when its first lesson has the same ID', () => {
  useTutorialStore.getState().startChapter(snapshot, 'business', 'company1');
  const staleRevision = useTutorialStore.getState().chapterRevision;
  useTutorialStore.getState().startChapter(snapshot, 'business', 'company2', true);
  useTutorialStore.getState().settleChapter(key, 'business_balance', staleRevision);
  expect(current()?.completed).toEqual([]);
});
test('completion never auto-launches another chapter or the opening', () => {
  useTutorialStore.getState().start(snapshot);
  useTutorialStore.getState().startChapter(snapshot, 'business', 'company1');
  ack('business_balance'); ack('business_team'); ack('business_cash');
  expect(getChapterStep(current())).toBeNull();
  expect(useTutorialStore.getState().activeScope).toBeNull();
  expect(useTutorialStore.getState().activeChapterKey).toBeNull();
});
test('skipped lessons stay distinct and new save scopes do not inherit them', () => {
  useTutorialStore.getState().startChapter(snapshot, 'business', 'company1');
  ack('business_balance', true);
  useTutorialStore.getState().startChapter({ ...snapshot, scope: 'save1' }, 'business', 'company1');
  expect(useTutorialStore.getState().chapters[1].completed).toEqual([]);
  expect(current()?.skipped).toEqual(['business_balance']);
});
test('local modal blockers reject underlying acknowledgements and clean up independently', () => {
  const state = useTutorialStore.getState();
  state.startChapter(snapshot, 'business', 'company1');
  state.setUiBlocked('modal1', true); state.setUiBlocked('modal2', true);
  state.setUiBlocked('modal1', false);
  ack('business_balance');
  expect(current()?.completed).toEqual([]);
  state.setUiBlocked('modal2', false);
  ack('business_balance');
  expect(current()?.completed).toEqual(['business_balance']);
});
test('serial writes retain both histories but never active presentation or game fields', async () => {
  const state = useTutorialStore.getState();
  state.start(snapshot); state.settle(snapshot.scope, 'cash_flow', snapshot);
  state.startChapter(snapshot, 'business', 'company1'); ack('business_balance');
  state.setUiBlocked('dialog', true); state.pause();
  await flushTutorialWrites();
  const saved = JSON.parse((await AsyncStorage.getItem(TUTORIAL_STORAGE_KEY))!);
  expect(saved.sessions[0].completed).toEqual(['cash_flow']);
  expect(saved.chapters[0].completed).toEqual(['business_balance']);
  for (const field of ['activeScope', 'activeChapterKey', 'uiBlockers', 'chapterRevision', 'cash', 'businesses']) expect(saved[field]).toBeUndefined();
});
test('a replaced save resets its future-baseline chapter', () => {
  useTutorialStore.getState().startChapter(snapshot, 'business', 'company1'); ack('business_balance');
  useTutorialStore.getState().startChapter({ ...snapshot, globalWeek: 1 }, 'business', 'company1');
  expect(current()?.completed).toEqual([]);
  expect(current()?.baselineWeek).toBe(1);
});
test('forget and new-life chapter reset do not erase another save', async () => {
  const state = useTutorialStore.getState();
  state.startChapter({ ...snapshot, scope: 'other' }, 'holding', 'holding1');
  state.startChapter(snapshot, 'business', 'company1');
  state.resetChapters(snapshot.scope);
  expect(current()).toBeUndefined();
  expect(useTutorialStore.getState().chapters[0].scope).toBe('other');
  state.startChapter(snapshot, 'business', 'company1');
  await state.forget(snapshot.scope);
  expect(current()).toBeUndefined();
  expect(useTutorialStore.getState().activeChapterKey).toBeNull();
});
test('write failure leaves guidance usable and a later write recovers', async () => {
  (AsyncStorage.setItem as jest.Mock).mockRejectedValueOnce(new Error('disk full'));
  useTutorialStore.getState().startChapter(snapshot, 'business', 'company1');
  await flushTutorialWrites();
  expect(useTutorialStore.getState().storageWarning).toBe(true);
  ack('business_balance');
  await flushTutorialWrites();
  expect(useTutorialStore.getState().storageWarning).toBe(false);
});
