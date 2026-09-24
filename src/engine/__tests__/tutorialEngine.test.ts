import {
  getTutorialScope, getTutorialStep, isTutorialRoute, newTutorialSession, normalizeTutorialSessions,
  reconcileTutorial, settleTutorialStep, TUTORIAL_STEPS, tutorialButtonTarget, tutorialCardTarget, TutorialSnapshot,
} from '../tutorialEngine';

const fresh: TutorialSnapshot = {
  scope: getTutorialScope(0, 'Player', 1), globalWeek: 1,
  hasEducation: false, isStudying: false, hasIncome: false,
};
const start = () => newTutorialSession(fresh);

describe('guided introduction progression', () => {
  test('starts with cash flow without mutating the game snapshot', () => {
    const snapshot = Object.freeze({ ...fresh });
    expect(getTutorialStep(newTutorialSession(snapshot))?.id).toBe('cash_flow');
    expect(snapshot).toEqual(fresh);
  });
  test('does not complete an action from navigation or a failed enrollment', () => {
    const session = settleTutorialStep(start(), 'cash_flow');
    expect(reconcileTutorial(session, fresh)).toBe(session);
    expect(getTutorialStep(session)?.id).toBe('education');
  });
  test('completes enrollment only after the actual save reflects it', () => {
    const session = settleTutorialStep(start(), 'cash_flow');
    const next = reconcileTutorial(session, { ...fresh, hasEducation: true, isStudying: true });
    expect(next.completed).toContain('education');
    expect(getTutorialStep(next)?.id).toBe('study_progress');
  });
  test('graduated saves do not get stuck on a missing course panel', () => {
    const session = settleTutorialStep(start(), 'cash_flow');
    const next = reconcileTutorial(session, { ...fresh, hasEducation: true });
    expect(next.skipped).toContain('study_progress');
    expect(getTutorialStep(next)?.id).toBe('student_income');
  });
  test('existing careers count as established income', () => {
    const next = reconcileTutorial(settleTutorialStep(start(), 'cash_flow'), { ...fresh, hasEducation: true, hasIncome: true });
    expect(next.completed).toEqual(['cash_flow', 'education', 'student_income']);
    expect(getTutorialStep(next)?.id).toBe('advance_week');
  });
  test('skipped income is not reported as a completed lesson', () => {
    let session = settleTutorialStep(start(), 'cash_flow');
    session = settleTutorialStep(session, 'education', true);
    session = reconcileTutorial(session, fresh);
    session = settleTutorialStep(session, 'student_income', true);
    expect(session.skipped).toContain('student_income');
    expect(session.completed).not.toContain('student_income');
    expect(getTutorialStep(session)?.id).toBe('advance_week');
  });
  test('a failed week advance does not complete the time lesson', () => {
    const session = { ...start(), completed: ['cash_flow', 'education', 'study_progress', 'student_income'] as const };
    const input = { ...session, completed: [...session.completed] };
    expect(reconcileTutorial(input, fresh)).toBe(input);
  });
  test('successful week advance waits for acknowledgement of the result', () => {
    const session = { ...start(), completed: TUTORIAL_STEPS.slice(0, 4).map((step) => step.id) };
    const next = reconcileTutorial(session, { ...fresh, globalWeek: 2 });
    expect(getTutorialStep(next)?.id).toBe('weekly_result');
    expect(next.completed).toContain('advance_week');
    expect(getTutorialStep(settleTutorialStep(next, 'weekly_result'))).toBeNull();
  });
  test('uses absolute weeks across year boundaries', () => {
    const session = { ...start(), baselineWeek: 20, completed: TUTORIAL_STEPS.slice(0, 4).map((step) => step.id) };
    expect(getTutorialStep(reconcileTutorial(session, { ...fresh, globalWeek: 21 }))?.id).toBe('weekly_result');
  });
  test('replaying a late save requires a new real week, not its existing age', () => {
    const snapshot = { ...fresh, globalWeek: 300, hasEducation: true, hasIncome: true };
    const session = reconcileTutorial(settleTutorialStep(newTutorialSession(snapshot), 'cash_flow'), snapshot);
    expect(getTutorialStep(session)?.id).toBe('advance_week');
  });
  test('does not show a fake result when the time lesson was skipped', () => {
    const session = { ...start(), completed: TUTORIAL_STEPS.slice(0, 4).map((step) => step.id) };
    const next = reconcileTutorial(settleTutorialStep(session, 'advance_week', true), fresh);
    expect(next.skipped).toContain('weekly_result');
    expect(getTutorialStep(next)).toBeNull();
  });
  test('rejects stale double taps', () => {
    const next = settleTutorialStep(start(), 'cash_flow');
    expect(settleTutorialStep(next, 'cash_flow')).toBe(next);
    expect(settleTutorialStep(start(), 'weekly_result')).toEqual(start());
  });
  test('never carries actions between save slots or generations', () => {
    expect(getTutorialScope(0, 'Player', 1)).not.toBe(getTutorialScope(1, 'Player', 1));
    expect(getTutorialScope(0, 'Player', 1)).not.toBe(getTutorialScope(0, 'Player', 2));
    const session = settleTutorialStep(start(), 'cash_flow');
    expect(reconcileTutorial(session, { ...fresh, scope: 'different', hasEducation: true })).toBe(session);
  });
  test('completed knowledge stays complete after a job or course changes', () => {
    const session = { ...start(), completed: TUTORIAL_STEPS.slice(0, 4).map((step) => step.id) };
    expect(reconcileTutorial(session, fresh).completed).toEqual(session.completed);
  });
});

describe('tutorial storage and target safety', () => {
  test.each([null, undefined, false, [], 'invalid', { version: 100, sessions: [start()] }])('ignores incompatible payload %p', (value) => {
    expect(normalizeTutorialSessions(value)).toEqual([]);
  });
  test('normalizes ids and rejects corrupt session records', () => {
    const result = normalizeTutorialSessions({ version: 1, sessions: [
      null, { ...start(), baselineWeek: Infinity }, { ...start(), baselineWeek: -1 },
      { ...start(), completed: ['cash_flow', 'cash_flow', 'unknown'], skipped: ['cash_flow', 'education'] },
    ] });
    expect(result).toEqual([{ ...start(), completed: ['cash_flow'], skipped: ['education'] }]);
  });
  test('bounds stored history and deduplicates scopes', () => {
    const sessions = Array.from({ length: 20 }, (_, index) => ({ ...start(), scope: `scope${index}` }));
    expect(normalizeTutorialSessions({ version: 1, sessions }).length).toBe(12);
    expect(normalizeTutorialSessions({ version: 1, sessions: [start(), start()] }).length).toBe(1);
  });
  test('matches Home aliases without mistaking nested routes for Home', () => {
    expect(isTutorialRoute('/tabs/index', '/tabs')).toBe(true);
    expect(isTutorialRoute('/tabs/education', '/tabs')).toBe(false);
    expect(isTutorialRoute('/tabs/education', '/tabs/education')).toBe(true);
  });
  test('never targets a purchase, ad or processing button', () => {
    expect(tutorialButtonTarget('Enroll')).toBe('education.enroll');
    expect(tutorialButtonTarget('Advance to Next Week')).toBe('home.advance');
    for (const label of ['Watch Ad • Finish Education', 'Processing Week...', 'Buy', 'Claim Daily Instant Completion']) {
      expect(tutorialButtonTarget(label)).toBeUndefined();
    }
    expect(tutorialCardTarget('Weekly cash flow')).toBe('home.cashflow');
    expect(tutorialCardTarget('Any course', 'CURRENT EDUCATION')).toBe('education.progress');
    expect(tutorialCardTarget('Buy gems')).toBeUndefined();
  });
});
