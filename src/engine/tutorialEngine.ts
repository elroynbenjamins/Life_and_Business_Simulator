import type { TutorialChapterTargetId } from './tutorialChapterEngine';
// Guidance is UI-only: never call game commands or grant tutorial rewards here.
export const TUTORIAL_VERSION = 1;
export const TUTORIAL_STEPS = [
  { id: 'cash_flow', route: '/tabs', target: 'home.cashflow', title: 'Understand this week', body: 'Available cash pays your bills. Weekly cash flow estimates income minus recurring costs; tax settles separately. You decide when time moves.', action: 'Open Home', kind: 'read' },
  { id: 'education', route: '/tabs/education', target: 'education.enroll', title: 'Choose your first course', body: 'Select Basics, then compare course costs, duration and career direction. The highlighted Enroll button is an example, not a required choice. Choose any eligible Basic course. Show me returns to Basics. You can also leave education for later.', action: 'Open Education', kind: 'action' },
  { id: 'study_progress', route: '/tabs/education', target: 'education.progress', title: 'Your course is running', body: 'Current Education shows progress and remaining weeks. Advance weeks to study normally. The visible education boost is optional: neither an ad nor a purchase is required for this guide.', action: 'Open Education', kind: 'read' },
  { id: 'student_income', route: '/tabs/career', target: 'career.studentWork', title: 'Choose how to support yourself', body: 'Compare the two highlighted student-work options on Career. Compare their income and study-time trade-off. Choose an option, or use Do this later to study without a student job.', action: 'Open Career', kind: 'action' },
  { id: 'advance_week', route: '/tabs', target: 'home.advance', title: 'Run one real week', body: 'Go Home and press Advance to Next Week to start earning income and make progress on your education. The game processes income, costs, study and events; the guide will never advance time for you.', action: 'Open Home', kind: 'action' },
  { id: 'weekly_result', route: '/tabs', target: 'home.cashflow', title: 'Read the result and keep building', body: 'The weekly result separates income, expenses and tax, with activity details below. Compare the result with your plans. Your First Steps on Home continues the longer journey; the guided opening ends here.', action: 'Open Home', kind: 'read' },
] as const;

export type TutorialStepId = typeof TUTORIAL_STEPS[number]['id'];
export type TutorialTargetId = Exclude<typeof TUTORIAL_STEPS[number]['target'], null> | TutorialChapterTargetId;
export type TutorialSnapshot = {
  scope: string;
  globalWeek: number;
  hasEducation: boolean;
  isStudying: boolean;
  hasIncome: boolean;
};
export type TutorialSession = {
  scope: string;
  baselineWeek: number;
  completed: TutorialStepId[];
  skipped: TutorialStepId[];
};

export function getTutorialScope(slot: number, name: string, generation: number): string {
  return JSON.stringify([slot, name, generation]);
}

export function newTutorialSession(snapshot: TutorialSnapshot): TutorialSession {
  return { scope: snapshot.scope, baselineWeek: snapshot.globalWeek, completed: [], skipped: [] };
}

export function getTutorialStep(session: TutorialSession | null | undefined) {
  if (!session) return null;
  return TUTORIAL_STEPS.find((step) => !session.completed.includes(step.id) && !session.skipped.includes(step.id)) ?? null;
}

export function settleTutorialStep(session: TutorialSession, id: TutorialStepId, skipped = false): TutorialSession {
  // Reject stale/double button events rather than completing the next lesson.
  if (getTutorialStep(session)?.id !== id) return session;
  return skipped
    ? { ...session, skipped: [...session.skipped, id] }
    : { ...session, completed: [...session.completed, id] };
}

export function reconcileTutorial(session: TutorialSession, snapshot: TutorialSnapshot): TutorialSession {
  if (session.scope !== snapshot.scope) return session;
  let result = session;
  for (let i = 0; i < TUTORIAL_STEPS.length; i++) {
    const step = getTutorialStep(result);
    if (!step) break;
    const complete = (step.id === 'education' && snapshot.hasEducation)
      || (step.id === 'student_income' && snapshot.hasIncome)
      || (step.id === 'advance_week' && snapshot.globalWeek > session.baselineWeek);
    const notApplicable = (step.id === 'study_progress' && !snapshot.isStudying)
      || (step.id === 'weekly_result' && snapshot.globalWeek <= session.baselineWeek);
    if (!complete && !notApplicable) break;
    result = settleTutorialStep(result, step.id, notApplicable);
  }
  return result;
}

export function isTutorialRoute(pathname: string, route: string): boolean {
  return pathname === route || (route === '/tabs' && (pathname === '/tabs/index' || pathname === '/'));
}

// Legacy adapters retained for compatibility; live controls now use explicit tutorialId props. New screens can pass tutorialId explicitly.
// These never run a command and are deliberately restricted to exact known labels.
export function tutorialButtonTarget(label: string): TutorialTargetId | undefined {
  if (label === 'Advance to Next Week') return 'home.advance';
  if (label === 'Enroll') return 'education.enroll';
  return undefined;
}
export function tutorialCardTarget(title?: string, eyebrow?: string): TutorialTargetId | undefined {
  if (title === 'Weekly cash flow') return 'home.cashflow';
  if (eyebrow === 'CURRENT EDUCATION') return 'education.progress';
  return undefined;
}

export function normalizeTutorialSessions(value: unknown): TutorialSession[] {
  if (!value || typeof value !== 'object') return [];
  const raw = value as { version?: unknown; sessions?: unknown };
  if (raw.version !== TUTORIAL_VERSION || !Array.isArray(raw.sessions)) return [];
  const validIds = new Set<string>(TUTORIAL_STEPS.map((step) => step.id));
  const ids = (input: unknown): TutorialStepId[] => Array.isArray(input)
    ? [...new Set(input.filter((id): id is TutorialStepId => typeof id === 'string' && validIds.has(id)))]
    : [];
  const sessions = new Map<string, TutorialSession>();
  for (const item of raw.sessions) {
    if (!item || typeof item !== 'object') continue;
    const record = item as Record<string, unknown>;
    if (typeof record.scope !== 'string' || record.scope.length > 250
      || typeof record.baselineWeek !== 'number' || !Number.isFinite(record.baselineWeek)
      || record.baselineWeek < 1) continue;
    const completed = ids(record.completed);
    sessions.set(record.scope, {
      scope: record.scope, baselineWeek: Math.floor(record.baselineWeek), completed,
      skipped: ids(record.skipped).filter((id) => !completed.includes(id)),
    });
  }
  return [...sessions.values()].slice(-12);
}
