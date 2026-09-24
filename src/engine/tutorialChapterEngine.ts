import type { GameState } from '../types/game';
import { getHoldingCompanySummary } from './holdingCompanyEngine';
import { formatCurrency } from '../utils/format';

// Reference lessons only. No chapter step executes an economic command.
export const TUTORIAL_CHAPTERS = {
  business: {
    title: 'Business basics',
    steps: [
      { id: 'business_balance', target: 'business.summary', section: 'overview', title: 'Company cash is not personal cash', body: 'Balance is the money this company can use. Valuation estimates its worth; it is not spending money. Review operating results and recurring costs before expanding.' },
      { id: 'business_team', target: 'business.team', section: 'people', title: 'Build a team you can afford', body: 'The Team section shows your employees, pay, skills and morale. Review the staffing warning and recruitment availability before hiring. Salaries recur each week. This lesson does not require recruiting anyone.' },
      { id: 'business_cash', target: 'business.cash', section: 'finance', title: 'Move cash deliberately', body: 'Cash Management shows funding and owner-distribution options. Protected operating and budget reserves limit draws. Co-owned companies use pro-rata dividends; subsidiaries use their Holding treasury. Inspect the available route without making a transfer.' },
    ],
  },
  holding: {
    title: 'Holding treasury',
    steps: [
      { id: 'holding_reserve', target: 'holding.reserve', section: 'overview', title: 'Know which cash belongs to the group', body: 'The Holding reserve is separate from your personal cash and subsidiary balances. The reserve target protects owner distributions, not all strategic investments. Check the target before allocating or withdrawing money.' },
      { id: 'holding_cashflows', target: 'holding.cashflows', section: 'overview', title: 'Bring cash up, then pay the owner', body: 'Management fees move cash from eligible wholly owned subsidiaries into the Holding. They require profit, respect protected reserves and are capped. Co-owned subsidiaries use pro-rata dividends. Owner distribution is the separate action that pays personal cash from the amount above the Holding reserve target. No rate change or payout is required.' },
      { id: 'holding_capital', target: 'holding.capital', section: 'subsidiaries', title: 'Compare growth capital with debt repayment', body: 'The Companies section contains capital-allocation previews. Growth capital adds subsidiary cash, not instant revenue. Debt repayment shows principal repaid, future interest avoided and the weekly payment change. Review the preview and confirmation before committing; this tour never confirms a transaction.' },
      { id: 'holding_services', target: 'holding.services', section: 'services', title: 'Check what shared services would add', body: 'Services shows the group upgrades, their costs and estimated direct benefit or payback. Some benefits concern risk rather than direct financial returns. Compare these estimates with the cash needed elsewhere. You can finish without buying an upgrade.' },
    ],
  },
} as const;
export type TutorialChapterId = keyof typeof TUTORIAL_CHAPTERS;
export type TutorialChapterStepId = typeof TUTORIAL_CHAPTERS[TutorialChapterId]['steps'][number]['id'];
export type TutorialChapterTargetId = typeof TUTORIAL_CHAPTERS[TutorialChapterId]['steps'][number]['target'];
export type TutorialChapterSection = typeof TUTORIAL_CHAPTERS[TutorialChapterId]['steps'][number]['section'];
export type TutorialChapterSession = {
  scope: string;
  chapter: TutorialChapterId;
  subjectId: string;
  baselineWeek: number;
  completed: TutorialChapterStepId[];
  skipped: TutorialChapterStepId[];
};
export const chapterSessionKey = (scope: string, chapter: TutorialChapterId) => JSON.stringify([scope, chapter]);
export function getChapterStep(session: TutorialChapterSession | undefined | null) {
  if (!session) return null;
  const step = TUTORIAL_CHAPTERS[session.chapter].steps.find((item) =>
    !session.completed.includes(item.id) && !session.skipped.includes(item.id));
  if (!step) return null;
  const route: '/business/holdings' | `/business/${string}` = session.chapter === 'business'
    ? `/business/${encodeURIComponent(session.subjectId)}` : '/business/holdings';
  return { ...step, route, action: session.chapter === 'business' ? 'Open Business' : 'Open Holdings', kind: 'read' as const };
}
export function settleChapterStep(session: TutorialChapterSession, id: TutorialChapterStepId, skip = false): TutorialChapterSession {
  if (getChapterStep(session)?.id !== id) return session;
  return skip ? { ...session, skipped: [...session.skipped, id] }
    : { ...session, completed: [...session.completed, id] };
}
export function isChapterSubjectId(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= 200 && !/[\u0000-\u001f]/.test(value);
}
export function normalizeChapterSessions(value: unknown): TutorialChapterSession[] {
  if (!value || typeof value !== 'object') return [];
  const raw = value as { version?: unknown; chapters?: unknown };
  if (raw.version !== 1 || !Array.isArray(raw.chapters)) return [];
  const sessions = new Map<string, TutorialChapterSession>();
  for (const item of raw.chapters) {
    if (!item || typeof item !== 'object') continue;
    const row = item as Record<string, unknown>;
    if ((row.chapter !== 'business' && row.chapter !== 'holding')
      || typeof row.scope !== 'string' || !row.scope || row.scope.length > 250
      || !isChapterSubjectId(row.subjectId) || typeof row.baselineWeek !== 'number'
      || !Number.isFinite(row.baselineWeek) || row.baselineWeek < 1) continue;
    const valid = new Set<string>(TUTORIAL_CHAPTERS[row.chapter].steps.map((step) => step.id));
    const ids = (values: unknown): TutorialChapterStepId[] => Array.isArray(values)
      ? [...new Set(values.filter((id): id is TutorialChapterStepId => typeof id === 'string' && valid.has(id)))] : [];
    const completed = ids(row.completed);
    const session: TutorialChapterSession = {
      scope: row.scope, chapter: row.chapter, subjectId: row.subjectId,
      baselineWeek: Math.floor(row.baselineWeek), completed,
      skipped: ids(row.skipped).filter((id) => !completed.includes(id)),
    };
    sessions.set(chapterSessionKey(session.scope, session.chapter), session);
  }
  return [...sessions.values()].slice(-24);
}
export function getChapterContext(session: TutorialChapterSession, state: Pick<GameState, 'cash' | 'businesses' | 'holdingCompanies'>): { exists: boolean; name: string; detail: string } {
  if (session.chapter === 'business') {
    const business = (state.businesses ?? []).find((item) => item.id === session.subjectId);
    return business ? { exists: true, name: business.name,
      detail: `Personal cash ${formatCurrency(state.cash)} · Company balance ${formatCurrency(business.balance)}` }
      : { exists: false, name: '', detail: '' };
  }
  const holding = (state.holdingCompanies ?? []).find((item) => item.id === session.subjectId);
  if (!holding) return { exists: false, name: '', detail: '' };
  const summary = getHoldingCompanySummary(holding, state.businesses ?? []);
  return { exists: true, name: holding.name,
    detail: `Reserve ${formatCurrency(summary.cashReserve)} · Target ${formatCurrency(summary.reserveTarget)} · Available to owner ${formatCurrency(summary.availableDistributionCash)}` };
}
