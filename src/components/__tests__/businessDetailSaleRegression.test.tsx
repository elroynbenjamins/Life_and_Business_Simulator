import React from 'react';
import { render } from '@testing-library/react-native';
import BusinessDetailScreen from '../../../app/business/[id]';
import { INITIAL_GAME_STATE, INITIAL_RELATIONSHIP_STATE } from '../../types/game';
import { createAcquiredBusiness, generateAcquisitionTargets } from '../../engine/acquisitionEngine';

let mockState: any;
const mockRouterReplace = jest.fn();

jest.mock('../../store/gameStore', () => ({
  __esModule: true,
  default: (selector?: any) => selector ? selector(mockState) : mockState,
}));
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
jest.mock('expo-router', () => ({
  usePathname: () => '/business/acq-sale-regression',
  useRouter: () => ({ push: jest.fn(), replace: mockRouterReplace, back: jest.fn(), navigate: jest.fn() }),
  useLocalSearchParams: () => ({ id: 'acq-sale-regression' }),
}));
jest.mock('react-native-chart-kit', () => ({ PieChart: () => null }));
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: require('react-native').View }));

describe('business detail sale regression', () => {
  beforeEach(() => {
    jest.spyOn(Math, 'random').mockReturnValue(0.5);
    const target = generateAcquisitionTargets(120, 1, 1)[0];
    const business = createAcquiredBusiness(
      target,
      { ...INITIAL_GAME_STATE, week: 8, year: 7, inflationMultiplier: 1 },
      null,
      target.askingPrice,
      'cash',
      0,
    )!;
    business.id = 'acq-sale-regression';

    mockState = {
      ...INITIAL_GAME_STATE,
      profile: { unlockedPrestige: [], gems: 0, prestigePoints: 0 },
      relationshipState: { ...INITIAL_RELATIONSHIP_STATE },
      businesses: [business],
      competitors: { [business.id]: [] },
      sellBusiness: jest.fn(),
      designateFamilyBusiness: jest.fn(),
      toggleLongTermFamilyAsset: jest.fn(),
      setBusinessStrategicFocus: jest.fn(),
      resolveBusinessDecision: jest.fn(),
      setAcquisitionIntegrationStrategy: jest.fn(),
      appointChildToBusiness: jest.fn(),
      transferBusinessShares: jest.fn(),
      buyBackInvestorShares: jest.fn(),
      investFamilyTrustCashInBusiness: jest.fn(),
      openCandidatePool: jest.fn(),
      hireCandidate: jest.fn(),
      cancelCandidatePool: jest.fn(),
      fireEmployee: jest.fn(),
      setBusinessPricing: jest.fn(),
      setBusinessAdvertising: jest.fn(),
      buyBusinessUpgrade: jest.fn(),
      startBusinessExpansion: jest.fn(),
      takeBusinessLoan: jest.fn(),
      injectCashIntoBusiness: jest.fn(),
      withdrawFromBusiness: jest.fn(),
      applyMoraleActionToBusiness: jest.fn(),
      startEmployeeTraining: jest.fn(),
      startBusinessProject: jest.fn(),
      getAdFreeSlotRewardUsage: () => ({ claimedToday: 0, remaining: 1, limit: 1, available: true }),
      claimAdFreeBusinessSlotReward: jest.fn(),
      setBusinessDecisionAutomation: jest.fn(),
      resolveBusinessRetention: jest.fn(),
    };
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('removing the sold acquisition while its detail screen is mounted does not change hook order', () => {
    const view = render(<BusinessDetailScreen />);
    expect(view.getByText(mockState.businesses[0].name)).toBeTruthy();

    mockState = { ...mockState, businesses: [] };

    expect(() => view.rerender(<BusinessDetailScreen />)).not.toThrow();
    expect(view.getByText('Business Not Found')).toBeTruthy();
  });
});
