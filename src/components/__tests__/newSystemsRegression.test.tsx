import React from 'react';
import { act, render, fireEvent } from '@testing-library/react-native';
import DashboardScreen from '../../../app/tabs/index';
import SuccessionScreen from '../../../app/succession';
import StatisticsScreen from '../../../app/statistics';
import FinanceScreen from '../../../app/tabs/finance';
import ReviewPromptModal from '../ReviewPromptModal';
import { INITIAL_GAME_STATE, INITIAL_RELATIONSHIP_STATE } from '../../types/game';
import { calculatePartnerContribution } from '../../engine/relationshipEngine';
import { getWeeklyRent, getWeeklyUtilityCost, getWeeklyCarCost, getWeeklyFoodCost } from '../../engine/financeEngine';
import { formatCurrency } from '../../utils/format';
import { prestigeImages, prestigeImageKey } from '../../assets/progressionImages';
import { getPrestigeBonuses } from '../../engine/prestigeEngine';
import { useTutorialStore } from '../../store/tutorialStore';

let mockState: any;
jest.mock('../../store/gameStore', () => ({
  __esModule: true,
  default: (selector?: any) => selector ? selector(mockState) : mockState,
}));
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn(), replace: jest.fn() }) }));
jest.mock('../StatusBar', () => () => null);
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: require('react-native').View }));

beforeAll(async () => {
  // Resolve real guidance hydration before mounting Home's resume launcher.
  await act(async () => { await useTutorialStore.getState().hydrate(); });
});

beforeEach(() => {
  mockState = {
    ...INITIAL_GAME_STATE,
    profile: { unlockedPrestige: [], gems: 0, prestigePoints: 0 },
    getDailyLoginStatus: () => ({ available: false }),
    getPortfolioValueTotal: () => 0,
    beginNewGame: jest.fn(),
  };
});

test('dashboard includes dependent children and relationship obligations', () => {
  mockState.relationshipModeEnabled = true;
  mockState.relationshipState = {
    ...INITIAL_RELATIONSHIP_STATE,
    children: [{ id: 'child', birthGlobalWeek: 1, age: 0 }],
    financialObligations: [{ weeklyPayment: 50, remainingAmount: 500 }],
  };
  const household = calculatePartnerContribution(null, mockState);
  expect(household.familyCost).toBeGreaterThan(0);
  expect(household.obligationCost).toBe(50);
  const expected = getWeeklyRent(mockState) + getWeeklyUtilityCost(mockState)
    + getWeeklyCarCost(mockState) + getWeeklyFoodCost(mockState)
    + household.familyCost + household.obligationCost;
  const view = render(<DashboardScreen />);
  expect(view.getByText(formatCurrency(expected))).toBeTruthy();
});

test('review prompt appears after a review milestone and can be dismissed', () => {
  mockState = {
    ...mockState,
    showReviewPrompt: true,
    showSummary: false,
    showEventModal: false,
    showRelationshipEventModal: false,
    showPeriodReport: false,
    showScheduledAd: false,
    showEducationCareerReminder: false,
    showNegativeCashModal: false,
    showMainMenu: false,
    showTutorial: false,
    showContentUpdateModal: false,
    reviewPromptedWeeks: [200],
    dismissReviewPrompt: jest.fn(),
  };
  const view = render(<ReviewPromptModal />);
  expect(view.getByText('200 weeks played')).toBeTruthy();
  fireEvent.press(view.getByText('Maybe later'));
  expect(mockState.dismissReviewPrompt).toHaveBeenCalledTimes(1);
});

test.each([['Statistics', StatisticsScreen], ['Finance', FinanceScreen]] as const)('%s includes family costs and responds to a child aging', (_name, Screen) => {
  mockState.relationshipModeEnabled = true;
  mockState.relationshipState = {
    ...INITIAL_RELATIONSHIP_STATE,
    children: [{ id: 'child', birthGlobalWeek: 1, age: 0 }],
  };
  const view = render(<Screen />);
  if (_name === 'Statistics') {
    fireEvent.press(view.getByText('Weekly Cash Flow'));
  }
  expect(view.getAllByText(new RegExp(String(calculatePartnerContribution(null, mockState).familyCost))).length).toBeGreaterThan(0);
  expect(view.getAllByText(/Childcare support/i).length).toBeGreaterThan(0);
  mockState = { ...mockState, year: 4 };
  view.rerender(<Screen />);
  expect(view.getAllByText(new RegExp(String(calculatePartnerContribution(null, mockState).familyCost))).length).toBeGreaterThan(0);
});

test.each([{ bonds: [] }, { bonds: [10] }, { bonds: [10, 20] }])('succession offers a new life when no heir is willing: $bonds', ({ bonds }) => {
  mockState.year = 31;
  mockState.lifecycle = { ...mockState.lifecycle, isDead: true };
  mockState.relationshipState = {
    ...INITIAL_RELATIONSHIP_STATE,
    children: bonds.map((bond, i) => ({ id: String(i), name: 'Heir ' + i, birthGlobalWeek: 1, age: 30, parentRelationship: bond, savings: 0 })),
    estateSettlement: { grossEstate: 0, netEstate: 0, administrationCost: 0, outstandingRelationshipObligations: 0, beneficiaries: [], businessValue: 0 },
  };
  const view = render(<SuccessionScreen />);
  fireEvent.press(view.getByText('Choose Heir →'));
  fireEvent.press(view.getByText('Start New Life'));
  expect(mockState.beginNewGame).toHaveBeenCalledTimes(1);
});

test('every prestige upgrade has artwork', () => {
  for (const bonus of getPrestigeBonuses()) {
    expect(prestigeImages[prestigeImageKey(bonus.id)]).toBeDefined();
  }
});
