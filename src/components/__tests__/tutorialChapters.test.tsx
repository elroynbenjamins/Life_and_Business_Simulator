import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import { View } from 'react-native';
import BusinessDetailScreen from '../../../app/business/[id]';
import HoldingCompaniesScreen from '../../../app/business/holdings';
import TutorialDock, { tutorialSnapshot } from '../TutorialDock';
import TutorialChapterLauncher, { useTutorialScreenBlocker } from '../TutorialChapterLauncher';
import GameDialog, { showGameDialog } from '../GameDialog';
import useGameStore from '../../store/gameStore';
import { flushTutorialWrites, useTutorialStore } from '../../store/tutorialStore';
import { useTutorialFocusStore } from '../../store/tutorialFocusStore';
import { chapterSessionKey, getChapterStep } from '../../engine/tutorialChapterEngine';
import { createAcquiredBusiness, generateAcquisitionTargets } from '../../engine/acquisitionEngine';
import { INITIAL_GAME_STATE, INITIAL_RELATIONSHIP_STATE, HoldingCompany } from '../../types/game';

let mockPathname = '/business/company1';
let mockId = 'company1';
const mockNavigate = jest.fn();
jest.mock('expo-router', () => ({
  usePathname: () => mockPathname,
  useRouter: () => ({ navigate: mockNavigate, push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
  useLocalSearchParams: () => ({ id: mockId }),
}));
jest.mock('../../store/gameStore', () => ({ __esModule: true, default: require('zustand').create(() => ({})) }));
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
jest.mock('react-native-chart-kit', () => ({ PieChart: () => null }));
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: require('react-native').View, useSafeAreaInsets: () => ({ top: 0, bottom: 24, left: 0, right: 0 }) }));
const holding: HoldingCompany = {
  id: 'holding1', name: 'Test Group', createdGlobalWeek: 1, founderGeneration: 1, generationsOwned: 1,
  controllerName: 'Test', controllerPersonId: null, cashReserve: 4_000_000, totalCapitalDeployed: 0,
  executiveChildId: null, executiveChildName: null, executivePerformance: 50,
  designatedSuccessorChildId: null, designatedSuccessorChildName: null,
  sharedServices: { finance: 0, hr: 0, procurement: 0, marketing: 0, it: 0 },
  managementFeeRate: 0.01, totalManagementFeesCollected: 0, totalDividendsReceived: 0, totalOwnerDistributions: 0,
};
const commandNames = ['hireCandidate', 'injectCashIntoBusiness', 'withdrawFromBusiness', 'buyBusinessUpgrade', 'startBusinessExpansion',
  'createHoldingCompany', 'fundHoldingCompany', 'distributeHoldingCash', 'setHoldingManagementFeeRate', 'setHoldingReserveTargetWeeks',
  'allocateHoldingCapital', 'upgradeHoldingSharedService', 'assignBusinessToHolding', 'setBusinessDelegation', 'sellBusiness', 'advanceWeek'] as const;

beforeAll(async () => { await useTutorialStore.getState().hydrate(); });
beforeEach(async () => {
  await act(async () => { await flushTutorialWrites(); });
  mockPathname = '/business/company1'; mockId = 'company1'; mockNavigate.mockClear();
  useTutorialStore.setState({ ready: true, storageWarning: false, sessions: [], chapters: [], activeScope: null, activeChapterKey: null, chapterRevision: 0, uiBlockers: {}, highlight: null });
  useTutorialFocusStore.getState().clear();
  const business = createAcquiredBusiness(generateAcquisitionTargets(120, 1, 1)[0], { ...INITIAL_GAME_STATE, year: 7, week: 8, inflationMultiplier: 1 }, null, 10_000_000, 'cash', 0)!;
  business.id = 'company1';
  const commands = Object.fromEntries(commandNames.map(name => [name, jest.fn()]));
  useGameStore.setState({
    ...INITIAL_GAME_STATE, initialized: true, isLoading: false, activeSlot: 0, playerName: 'Test', generation: 1,
    showMainMenu: false, showSlotPicker: false, showNameModal: false, showTutorial: false, showEducationOnboarding: false,
    showContentUpdateModal: false, showSummary: false, showNegativeCashModal: false, showPeriodReport: false,
    showScheduledAd: false, showEducationCareerReminder: false, showRelationshipEventModal: false, showEventModal: false, showReviewPrompt: false,
    profile: { unlockedPrestige: [], gems: 0, prestigePoints: 0 }, relationshipState: { ...INITIAL_RELATIONSHIP_STATE },
    businesses: [business], holdingCompanies: [holding], competitors: { company1: [] }, getNetWorthValue: () => 100_000_000_000,
    getAdFreeSlotRewardUsage: () => ({ claimedToday: 0, remaining: 1, limit: 1, available: true }),
    ...commands,
  } as any);
});
afterEach(async () => { await act(async () => { await flushTutorialWrites(); }); });
function locate() {
  act(() => { const focus = useTutorialFocusStore.getState(); focus.report(focus.request, 'located'); });
}
function noCommands() { for (const name of commandNames) expect(useGameStore.getState()[name]).not.toHaveBeenCalled(); }
function startHolding() {
  mockPathname = '/business/holdings';
  useTutorialStore.getState().startChapter(tutorialSnapshot(), 'holding', 'holding1');
}

test('owned businesses offer guidance without auto-starting it', () => {
  const view = render(<><BusinessDetailScreen /><TutorialDock /></>);
  expect(view.queryByTestId('tutorial-dock')).toBeNull();
  expect(view.getByText('Start Business basics tour')).toBeTruthy();
  noCommands();
});
test('the three Business lessons reveal the real sections and never spend money', () => {
  const view = render(<><BusinessDetailScreen /><TutorialDock /></>);
  fireEvent.press(view.getByText('Start Business basics tour'));
  expect(view.getByTestId('tutorial-target-business.summary')).toBeTruthy();
  locate(); fireEvent.press(view.getByText('Got it'));
  expect(view.getByTestId('tutorial-target-business.team')).toBeTruthy();
  locate(); fireEvent.press(view.getByText('Got it'));
  expect(view.getByTestId('tutorial-target-business.cash')).toBeTruthy();
  locate(); fireEvent.press(view.getByText('Finish guide'));
  expect(view.queryByTestId('tutorial-dock')).toBeNull();
  noCommands();
});
test('Holdings handles an empty company list and still allows the tour to finish', () => {
  startHolding();
  const view = render(<><HoldingCompaniesScreen /><TutorialDock /></>);
  expect(view.getByTestId('tutorial-target-holding.reserve')).toBeTruthy();
  locate(); fireEvent.press(view.getByText('Got it'));
  expect(view.getByTestId('tutorial-target-holding.cashflows')).toBeTruthy();
  locate(); fireEvent.press(view.getByText('Got it'));
  expect(view.getByTestId('tutorial-target-holding.capital')).toBeTruthy();
  expect(view.getByText('No companies assigned yet')).toBeTruthy();
  locate(); fireEvent.press(view.getByText('Got it'));
  expect(view.getByTestId('tutorial-target-holding.services')).toBeTruthy();
  locate(); fireEvent.press(view.getByText('Finish guide'));
  noCommands();
});
test('capital lesson expands a real subsidiary preview without allocating money', () => {
  useGameStore.setState({ businesses: useGameStore.getState().businesses.map(b => ({ ...b, holdingCompanyId: 'holding1' })) });
  startHolding();
  const state = useTutorialStore.getState();
  useTutorialStore.setState({ chapters: [{ ...state.chapters[0], completed: ['holding_reserve', 'holding_cashflows'] }] });
  const view = render(<><HoldingCompaniesScreen /><TutorialDock /></>);
  expect(view.getByTestId('tutorial-target-holding.capital')).toBeTruthy();
  expect(view.getByText('Capital Allocation')).toBeTruthy();
  noCommands();
});
test('manual section navigation is respected, while Show me returns to the lesson', () => {
  useTutorialStore.getState().startChapter(tutorialSnapshot(), 'business', 'company1');
  const view = render(<><BusinessDetailScreen /><TutorialDock /></>);
  locate();
  fireEvent.press(view.getByRole('tab', { name: /Team/ }));
  expect(view.queryByTestId('tutorial-target-business.summary')).toBeNull();
  expect(view.getByRole('button', { name: 'Got it' }).props.accessibilityState.disabled).toBe(true);
  fireEvent.press(view.getByLabelText('Show tutorial control'));
  expect(view.getByTestId('tutorial-target-business.summary')).toBeTruthy();
});
test('switching holding selection pauses rather than pointing at a different treasury', () => {
  useGameStore.setState({ holdingCompanies: [holding, { ...holding, id: 'holding2', name: 'Second Group' }] });
  startHolding();
  const view = render(<><HoldingCompaniesScreen /><TutorialDock /></>);
  fireEvent.press(view.getByRole('tab', { name: 'Second Group' }));
  expect(view.queryByTestId('tutorial-dock')).toBeNull();
  expect(useTutorialStore.getState().activeChapterKey).toBeNull();
});
test('selling the subject or switching saves pauses stale guidance', () => {
  useTutorialStore.getState().startChapter(tutorialSnapshot(), 'business', 'company1');
  const view = render(<><BusinessDetailScreen /><TutorialDock /></>);
  act(() => useGameStore.setState({ businesses: [] }));
  expect(view.getByText('Business Not Found')).toBeTruthy();
  expect(view.queryByTestId('tutorial-dock')).toBeNull();
  expect(useTutorialStore.getState().activeChapterKey).toBeNull();
});
test('confirmation dialogs suspend guidance and closing them does not confirm an action', () => {
  useTutorialStore.getState().startChapter(tutorialSnapshot(), 'business', 'company1');
  const confirm = jest.fn();
  const view = render(<><BusinessDetailScreen /><TutorialDock /><GameDialog /></>);
  act(() => showGameDialog({ title: 'Check transaction', message: 'Test preview', onConfirm: confirm }));
  expect(view.queryByTestId('tutorial-dock')).toBeNull();
  fireEvent.press(view.getByText('Cancel'));
  expect(view.getByTestId('tutorial-dock')).toBeTruthy();
  expect(confirm).not.toHaveBeenCalled();
  noCommands();
});
function Blocker() { useTutorialScreenBlocker(true); return <View />; }
test('local modal blockers clean up after unmount', () => {
  useTutorialStore.getState().startChapter(tutorialSnapshot(), 'business', 'company1');
  const view = render(<><TutorialDock /><Blocker /></>);
  expect(view.queryByTestId('tutorial-dock')).toBeNull();
  view.rerender(<TutorialDock />);
  expect(view.getByTestId('tutorial-dock')).toBeTruthy();
});
test('missing subjects cannot start and unavailable controls remain skippable', () => {
  const launcher = render(<TutorialChapterLauncher chapter="business" subjectId="removed" />);
  fireEvent.press(launcher.getByText('Start Business basics tour'));
  expect(useTutorialStore.getState().activeChapterKey).toBeNull();
  launcher.unmount();
  useTutorialStore.getState().startChapter(tutorialSnapshot(), 'business', 'company1');
  const view = render(<TutorialDock />);
  act(() => { const focus = useTutorialFocusStore.getState(); focus.report(focus.request, 'unavailable'); });
  fireEvent.press(view.getByText('Do this later'));
  const state = useTutorialStore.getState();
  const chapter = state.chapters.find(entry => chapterSessionKey(entry.scope, entry.chapter) === state.activeChapterKey)!;
  expect(chapter.skipped).toEqual(['business_balance']);
  expect(getChapterStep(chapter)?.id).toBe('business_team');
});
