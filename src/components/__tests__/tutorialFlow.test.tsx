import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import { BackHandler } from 'react-native';
import useGameStore from '../../store/gameStore';
import { flushTutorialWrites, useTutorialStore } from '../../store/tutorialStore';
import { getTutorialStep, newTutorialSession, TUTORIAL_STEPS } from '../../engine/tutorialEngine';
import { INITIAL_GAME_STATE } from '../../types/game';
import TutorialDock, { tutorialSnapshot } from '../TutorialDock';
import TutorialModal from '../TutorialModal';
import TutorialLauncher from '../TutorialLauncher';
import GameButton from '../GameButton';

let mockPathname = '/tabs';
const mockNavigate = jest.fn();
jest.mock('expo-router', () => ({
  usePathname: () => mockPathname,
  useRouter: () => ({ navigate: mockNavigate }),
}));
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: require('react-native').View,
  useSafeAreaInsets: () => ({ top: 0, bottom: 24, left: 0, right: 0 }),
}));
jest.mock('../../store/gameStore', () => ({
  __esModule: true,
  default: require('zustand').create(() => ({})),
}));

beforeAll(async () => { await useTutorialStore.getState().hydrate(); });
beforeEach(async () => {
  await act(async () => { await flushTutorialWrites(); });
  mockPathname = '/tabs';
  mockNavigate.mockClear();
  useTutorialStore.setState({ ready: true, storageWarning: false, sessions: [], activeScope: null, highlight: null });
  useGameStore.setState({
    ...INITIAL_GAME_STATE, initialized: true, activeSlot: 0, playerName: 'Test', generation: 1,
    isLoading: false, showMainMenu: false, showSlotPicker: false, showNameModal: false,
    showTutorial: false, showEducationOnboarding: false, showContentUpdateModal: false,
    showSummary: false, showNegativeCashModal: false, showPeriodReport: false,
    showScheduledAd: false, showEducationCareerReminder: false,
    showRelationshipEventModal: false, showEventModal: false, showReviewPrompt: false,
    advanceWeek: jest.fn(), enrollCourse: jest.fn(),
    dismissEducationOnboarding: jest.fn(() => useGameStore.setState({ showEducationOnboarding: false })),
    dismissTutorial: jest.fn(() => useGameStore.setState({ showTutorial: false })),
  });
});
afterEach(async () => { await act(async () => { await flushTutorialWrites(); }); });

const currentStep = () => getTutorialStep(useTutorialStore.getState().sessions.find((entry) => entry.scope === tutorialSnapshot().scope));

function startAtWeekStep() {
  const snapshot = tutorialSnapshot();
  useTutorialStore.setState({
    activeScope: snapshot.scope,
    sessions: [{ ...newTutorialSession(snapshot), completed: TUTORIAL_STEPS.slice(0, 4).map((step) => step.id) }],
  });
}

test('an existing save does not automatically get a tutorial or highlight', () => {
  const view = render(<TutorialDock />);
  expect(view.queryByTestId('tutorial-dock')).toBeNull();
  expect(useTutorialStore.getState().highlight).toBeNull();
});

test('guide navigates but never enrolls; rejected game actions do not advance lessons', () => {
  useTutorialStore.getState().start(tutorialSnapshot());
  const onEnroll = jest.fn();
  const ui = <><TutorialDock /><GameButton label="Enroll" onPress={onEnroll} /></>;
  const view = render(ui);
  fireEvent.press(view.getByText('Got it'));
  expect(currentStep()?.id).toBe('education');
  fireEvent.press(view.getByText('Open Education'));
  expect(mockNavigate).toHaveBeenCalledWith('/tabs/education');
  expect(onEnroll).not.toHaveBeenCalled();
  expect(useGameStore.getState().enrollCourse).not.toHaveBeenCalled();
  mockPathname = '/tabs/education';
  view.rerender(<><TutorialDock /><GameButton label="Enroll" onPress={onEnroll} /></>);
  expect(useTutorialStore.getState().highlight).toBe('education.enroll');
  fireEvent.press(view.getByText('Enroll'));
  expect(onEnroll).toHaveBeenCalledTimes(1);
  expect(currentStep()?.id).toBe('education');
  act(() => useGameStore.setState({ currentCourseId: 'sales_basics' }));
  expect(currentStep()?.id).toBe('study_progress');
});

test('the week result waits for real advancement and yields to its modal', () => {
  startAtWeekStep();
  const view = render(<TutorialDock />);
  expect(currentStep()?.id).toBe('advance_week');
  expect(useGameStore.getState().advanceWeek).not.toHaveBeenCalled();
  act(() => useGameStore.setState({ showSummary: true, week: 2 }));
  expect(view.queryByTestId('tutorial-dock')).toBeNull();
  expect(useTutorialStore.getState().highlight).toBeNull();
  act(() => useGameStore.setState({ showSummary: false }));
  expect(currentStep()?.id).toBe('weekly_result');
  fireEvent.press(view.getByText('Finish guide'));
  expect(view.queryByTestId('tutorial-dock')).toBeNull();
  expect(useTutorialStore.getState().activeScope).toBeNull();
});

test.each(['showNegativeCashModal', 'showPeriodReport', 'showScheduledAd', 'showEventModal', 'showRelationshipEventModal', 'showEducationCareerReminder', 'showReviewPrompt', 'showContentUpdateModal'] as const)('suspends around %s without losing progress', (flag) => {
  useTutorialStore.getState().start(tutorialSnapshot());
  const view = render(<TutorialDock />);
  act(() => useGameStore.setState({ [flag]: true }));
  expect(view.queryByTestId('tutorial-dock')).toBeNull();
  expect(useTutorialStore.getState().highlight).toBeNull();
  act(() => useGameStore.setState({ [flag]: false }));
  expect(view.getByTestId('tutorial-dock')).toBeTruthy();
  expect(currentStep()?.id).toBe('cash_flow');
});

test('changing save scope pauses instead of teaching the wrong character', () => {
  useTutorialStore.getState().start(tutorialSnapshot());
  const view = render(<TutorialDock />);
  act(() => useGameStore.setState({ activeSlot: 1 }));
  expect(view.queryByTestId('tutorial-dock')).toBeNull();
  expect(useTutorialStore.getState().activeScope).toBeNull();
});

test('Android Back pauses the guide and removes its highlight', () => {
  const listener = jest.spyOn(BackHandler, 'addEventListener');
  useTutorialStore.getState().start(tutorialSnapshot());
  const view = render(<TutorialDock />);
  const call = listener.mock.calls.find(([event]) => event === 'hardwareBackPress');
  expect(call).toBeDefined();
  act(() => { (call![1] as () => boolean)(); });
  expect(view.queryByTestId('tutorial-dock')).toBeNull();
  expect(useTutorialStore.getState().highlight).toBeNull();
  listener.mockRestore();
});

test('disabled real controls never look like actionable tutorial targets', () => {
  useTutorialStore.setState({ highlight: 'education.enroll' });
  const onPress = jest.fn();
  const view = render(<GameButton label="Enroll" disabled onPress={onPress} />);
  fireEvent.press(view.getByText('Enroll'));
  expect(onPress).not.toHaveBeenCalled();
  expect(view.getByRole('button').props.accessibilityHint).toBeUndefined();
});

test('Guide me starts guidance and clears both introduction flags', () => {
  useGameStore.setState({ showTutorial: true, showEducationOnboarding: true });
  const view = render(<TutorialModal />);
  fireEvent.press(view.getByText('Guide me'));
  expect(useGameStore.getState().showTutorial).toBe(false);
  expect(useGameStore.getState().showEducationOnboarding).toBe(false);
  expect(useTutorialStore.getState().activeScope).toBe(tutorialSnapshot().scope);
  expect(mockNavigate).toHaveBeenCalledWith('/tabs');
  expect(useGameStore.getState().advanceWeek).not.toHaveBeenCalled();
});

test('Explore freely clears a reused new-life tutorial without touching gameplay', async () => {
  useTutorialStore.getState().start({ ...tutorialSnapshot(), globalWeek: 100 });
  useGameStore.setState({ showTutorial: true, showEducationOnboarding: true });
  const cash = useGameStore.getState().cash;
  const view = render(<TutorialModal />);
  await act(async () => { fireEvent.press(view.getByText('Explore freely')); });
  expect(useTutorialStore.getState().sessions).toEqual([]);
  expect(useTutorialStore.getState().activeScope).toBeNull();
  expect(useGameStore.getState().showEducationOnboarding).toBe(false);
  expect(useGameStore.getState().cash).toBe(cash);
  expect(mockNavigate).not.toHaveBeenCalled();
});

test('unfinished lessons remain resumable after Year 1', () => {
  useTutorialStore.getState().start(tutorialSnapshot());
  useTutorialStore.getState().pause();
  useGameStore.setState({ year: 2, week: 5 });
  const view = render(<TutorialLauncher resumeOnly />);
  fireEvent.press(view.getByText('Resume guided introduction'));
  expect(useTutorialStore.getState().activeScope).toBe(tutorialSnapshot().scope);
  expect(mockNavigate).toHaveBeenCalledWith('/tabs');
});
