import { TUTORIAL_STEPS, normalizeTutorialSessions } from '../tutorialEngine';
import { chapterSessionKey, getChapterStep, isChapterSubjectId, normalizeChapterSessions, settleChapterStep, TUTORIAL_CHAPTERS, TutorialChapterSession } from '../tutorialChapterEngine';
const fresh = (chapter: 'business' | 'holding' = 'business'): TutorialChapterSession => ({ scope: 'save0', chapter, subjectId: 'company1', baselineWeek: 20, completed: [], skipped: [] });

test('opening remains six lessons and advanced chapters are separate', () => {
  expect(TUTORIAL_STEPS).toHaveLength(6);
  expect(TUTORIAL_CHAPTERS.business.steps).toHaveLength(3);
  expect(TUTORIAL_CHAPTERS.holding.steps).toHaveLength(4);
});
test.each(['business', 'holding'] as const)('%s consists entirely of read-only steps with explicit targets', (chapter) => {
  let session = fresh(chapter);
  for (const definition of TUTORIAL_CHAPTERS[chapter].steps) {
    const step = getChapterStep(session)!;
    expect(step.kind).toBe('read');
    expect(step.target).toBe(definition.target);
    session = settleChapterStep(session, definition.id);
  }
  expect(getChapterStep(session)).toBeNull();
});
test('encodes dynamic business route segments and leaves holding navigation fixed', () => {
  expect(getChapterStep({ ...fresh(), subjectId: 'name/?#' })?.route).toBe('/business/name%2F%3F%23');
  expect(getChapterStep(fresh('holding'))?.route).toBe('/business/holdings');
});
test('skip is not a successful acknowledgement and stale buttons do nothing', () => {
  const start = fresh();
  const next = settleChapterStep(start, 'business_balance', true);
  expect(next.completed).toEqual([]);
  expect(next.skipped).toEqual(['business_balance']);
  expect(settleChapterStep(next, 'business_balance')).toBe(next);
  expect(settleChapterStep(next, 'holding_cashflows')).toBe(next);
  expect(start.skipped).toEqual([]);
});
test('old v1 payloads remain compatible without auto-inventing chapters', () => {
  const payload = { version: 1, sessions: [{ scope: 'save0', baselineWeek: 1, completed: ['cash_flow'], skipped: [] }] };
  expect(normalizeTutorialSessions(payload)[0].completed).toEqual(['cash_flow']);
  expect(normalizeChapterSessions(payload)).toEqual([]);
});
test('validates chapter identifiers, scopes, subjects and baseline weeks', () => {
  const rows = [null, { ...fresh(), chapter: '__proto__' }, { ...fresh(), subjectId: '' },
    { ...fresh(), baselineWeek: Infinity }, { ...fresh(), baselineWeek: -2 }, { ...fresh(), scope: 'x'.repeat(251) }, fresh()];
  expect(normalizeChapterSessions({ version: 1, chapters: rows })).toEqual([fresh()]);
  expect(normalizeChapterSessions({ version: 99, chapters: [fresh()] })).toEqual([]);
  expect(isChapterSubjectId('valid-id')).toBe(true);
  expect(isChapterSubjectId('bad\ncontrol')).toBe(false);
});
test('removes duplicate, cross-chapter and unknown lesson IDs', () => {
  expect(normalizeChapterSessions({ version: 1, chapters: [{ ...fresh(), completed: ['business_balance', 'business_balance', 'holding_reserve', 'unknown'], skipped: ['business_balance', 'business_team'] }] })).toEqual([
    { ...fresh(), completed: ['business_balance'], skipped: ['business_team'] },
  ]);
});
test('progress is per save and chapter, not another required lesson per company', () => {
  expect(chapterSessionKey('save0', 'business')).not.toBe(chapterSessionKey('save0', 'holding'));
  expect(chapterSessionKey('save0', 'business')).not.toBe(chapterSessionKey('save1', 'business'));
  const latest = { ...fresh(), subjectId: 'company2' };
  expect(normalizeChapterSessions({ version: 1, chapters: [fresh(), latest] })).toEqual([latest]);
});
test('bounds independent chapter history', () => {
  const chapters = Array.from({ length: 40 }, (_, index) => ({ ...fresh(), scope: `save${index}` }));
  expect(normalizeChapterSessions({ version: 1, chapters })).toHaveLength(24);
});
