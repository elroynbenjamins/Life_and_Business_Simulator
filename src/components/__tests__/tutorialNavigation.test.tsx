import React from 'react';
import { act, cleanup, fireEvent, render } from '@testing-library/react-native';
import { ScrollView as NativeScrollView } from 'react-native';
import useGameStore from '../../store/gameStore';
import { useTutorialStore, flushTutorialWrites } from '../../store/tutorialStore';
import { useTutorialFocusStore } from '../../store/tutorialFocusStore';
import { INITIAL_GAME_STATE, INITIAL_PROFILE } from '../../types/game';
import EducationScreen from '../../../app/tabs/education';
import CareerScreen from '../../../app/tabs/career';
import LifestyleScreen from '../../../app/housing';
import TutorialScrollView from '../TutorialScrollView';
import TutorialDock, { tutorialSnapshot } from '../TutorialDock';
import GameButton from '../GameButton';

let mockSection: string | string[] | undefined;
let mockPathname = '/tabs';
const mockSetParams = jest.fn();
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ section: mockSection }),
  usePathname: () => mockPathname,
  useRouter: () => ({ setParams: mockSetParams, back: jest.fn(), navigate: jest.fn(), push: jest.fn() }),
}));
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: require('react-native').View,
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('../../store/gameStore', () => ({
  __esModule: true, default: require('zustand').create(() => ({})),
}));

beforeAll(async () => { await useTutorialStore.getState().hydrate(); });
beforeEach(() => {
  jest.useFakeTimers();
  mockSection = undefined;
  mockPathname = '/tabs';
  mockSetParams.mockClear();
  useTutorialFocusStore.getState().clear();
  useTutorialStore.setState({ ready: true, sessions: [], activeScope: null, highlight: null });
  useGameStore.setState({
    ...INITIAL_GAME_STATE, profile: { ...INITIAL_PROFILE }, initialized: true,
    activeSlot: 0, playerName: 'Navigation Test', generation: 1, cash: 10000,
    isLoading: false, showSummary: false, showMainMenu: false, showSlotPicker: false, showNameModal: false,
    showTutorial: false, showEducationOnboarding: false, showContentUpdateModal: false,
    showNegativeCashModal: false, showPeriodReport: false, showScheduledAd: false,
    showEducationCareerReminder: false, showRelationshipEventModal: false, showEventModal: false, showReviewPrompt: false,
    enrollCourse: jest.fn(), setStudentWorkTier: jest.fn(), changeCar: jest.fn(), changeHousing: jest.fn(),
    getAdFreeEducationRewardUsage: () => ({ available: true, claimedToday: 0, remaining: 1, limit: 1 }),
  });
});
afterEach(async () => {
  cleanup();
  await act(async () => { await flushTutorialWrites(); });
  jest.clearAllTimers();
  jest.useRealTimers();
});

test('the same display label alone no longer creates a tutorial target', () => {
  useTutorialStore.setState({ highlight: 'education.enroll' });
  const view = render(<GameButton label="Enroll" onPress={jest.fn()} />);
  expect(view.getByRole('button').props.accessibilityHint).toBeUndefined();
});

test('education identifies one actual eligible Enroll control without enrolling for the player', () => {
  useTutorialStore.setState({ highlight: 'education.enroll' });
  useTutorialFocusStore.getState().locate('education.enroll');
  const view = render(<EducationScreen />);
  expect(view.getAllByTestId('tutorial-target-education.enroll')).toHaveLength(1);
  expect(useGameStore.getState().enrollCourse).not.toHaveBeenCalled();
  fireEvent.press(view.getByTestId('tutorial-target-education.enroll'));
  expect(useGameStore.getState().enrollCourse).toHaveBeenCalledTimes(1);
});

test('Show me returns a manually changed education filter to Basics', () => {
  useTutorialStore.setState({ highlight: 'education.enroll' });
  const view = render(<EducationScreen />);
  fireEvent.press(view.getByText('Expert'));
  expect(view.queryByTestId('tutorial-target-education.enroll')).toBeNull();
  act(() => useTutorialFocusStore.getState().locate('education.enroll'));
  expect(view.getByTestId('tutorial-target-education.enroll')).toBeTruthy();
});

test('student work highlights real choices equally and keeps the normal command', () => {
  useTutorialStore.setState({ highlight: 'career.studentWork' });
  const view = render(<CareerScreen />);
  expect(view.getByTestId('tutorial-target-career.studentWork')).toBeTruthy();
  for (const tier of ['flexible', 'high_hours']) {
    const button = view.getByTestId(`student-work-${tier}`);
    expect(button.props.accessibilityHint).toMatch(/Optional student-work choice/);
    fireEvent.press(button);
    expect(useGameStore.getState().setStudentWorkTier).toHaveBeenLastCalledWith(tier);
  }
});

test('a full-time career does not expose a false student-work target', () => {
  useGameStore.setState({ currentJobId: 'legacy_job' });
  useTutorialStore.setState({ highlight: 'career.studentWork' });
  const view = render(<CareerScreen />);
  expect(view.queryByTestId('tutorial-target-career.studentWork')).toBeNull();
  fireEvent.press(view.getByTestId('student-work-flexible'));
  expect(useGameStore.getState().setStudentWorkTier).not.toHaveBeenCalled();
});

test('Transport deep link selects Transport while retaining manual tab switching', () => {
  mockSection = 'transport';
  const view = render(<LifestyleScreen />);
  expect(view.getByRole('tab', { name: 'Transport' }).props.accessibilityState.selected).toBe(true);
  fireEvent.press(view.getByRole('tab', { name: 'Housing' }));
  expect(mockSetParams).toHaveBeenLastCalledWith({ section: 'housing' });
  expect(view.getByRole('tab', { name: 'Housing' }).props.accessibilityState.selected).toBe(true);
  mockSection = 'housing';
  view.rerender(<LifestyleScreen />);
  mockSection = 'transport';
  view.rerender(<LifestyleScreen />);
  expect(view.getByRole('tab', { name: 'Transport' }).props.accessibilityState.selected).toBe(true);
  expect(useGameStore.getState().changeCar).not.toHaveBeenCalled();
});

test('scroll callback preservation and manual drag cancellation', () => {
  const onScroll = jest.fn(), onDrag = jest.fn(), onContent = jest.fn();
  const view = render(<TutorialScrollView testID="guided-scroll" onScroll={onScroll} onScrollBeginDrag={onDrag} onContentSizeChange={onContent} />);
  const scroll = view.UNSAFE_getByType(NativeScrollView);
  useTutorialFocusStore.getState().locate('home.advance');
  fireEvent(scroll, 'scroll', { nativeEvent: { contentOffset: { y: 100 } } });
  fireEvent(scroll, 'contentSizeChange', 320, 1000);
  fireEvent(scroll, 'scrollBeginDrag', { nativeEvent: {} });
  expect(onScroll).toHaveBeenCalledTimes(1);
  expect(onContent).toHaveBeenCalledWith(320, 1000);
  expect(onDrag).toHaveBeenCalledTimes(1);
  expect(useTutorialFocusStore.getState().status).toBe('cancelled');
});

test('missing controls time out without blocking skip or retry', () => {
  useTutorialStore.getState().start(tutorialSnapshot());
  const view = render(<TutorialDock />);
  act(() => jest.advanceTimersByTime(1300));
  expect(view.getByText(/This control could not be located/)).toBeTruthy();
  fireEvent.press(view.getByText('Show me'));
  expect(useTutorialFocusStore.getState().status).toBe('locating');
  fireEvent.press(view.getByText('Do this later'));
  expect(useTutorialFocusStore.getState().navigationRoute).toBe('/tabs/education');
});
