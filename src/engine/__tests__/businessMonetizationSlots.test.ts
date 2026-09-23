import {
  BUSINESS_PROJECT_SLOT_2_GEM_COST,
  BUSINESS_UPGRADE_SLOT_2_GEM_COST,
  createBusiness,
  getBusinessProjectSlotLimit,
  getBusinessUpgradeSlotLimit,
  startProject,
} from '../businessEngine';

describe('business monetization slots', () => {
  function makeBusiness() {
    const business = createBusiness('coffee_shop', 'Slot Test Co', 1, 1, 1);
    if (!business) throw new Error('coffee_shop business type missing');
    return {
      ...business,
      balance: 1_000_000,
      employees: [
        { id: 'manager-1', roleId: 'manager', skill: 100 } as any,
        { id: 'specialist-1', roleId: 'specialist', skill: 100 } as any,
      ],
    };
  }

  test('permanent slot prices and limits are capped at two', () => {
    const business = makeBusiness();
    expect(BUSINESS_PROJECT_SLOT_2_GEM_COST).toBe(50);
    expect(BUSINESS_UPGRADE_SLOT_2_GEM_COST).toBe(75);
    expect(getBusinessProjectSlotLimit(business)).toBe(1);
    expect(getBusinessUpgradeSlotLimit(business)).toBe(1);
    expect(getBusinessProjectSlotLimit({ ...business, projectSlot2Unlocked: true })).toBe(2);
    expect(getBusinessUpgradeSlotLimit({ ...business, upgradeSlot2Unlocked: true })).toBe(2);
    expect(getBusinessProjectSlotLimit({ ...business, projectSlot2Unlocked: true, temporaryProjectSlot2: true })).toBe(2);
    expect(getBusinessUpgradeSlotLimit({ ...business, upgradeSlot2Unlocked: true, temporaryUpgradeSlot2: true })).toBe(2);
  });

  test('a rewarded ad grants exactly one second concurrent project slot', () => {
    const first = startProject(makeBusiness(), 'local_marketing', 1).updatedBusiness;
    expect(first).toBeTruthy();
    if (!first) return;

    expect(startProject(first, 'supplier_negotiation', 1).updatedBusiness).toBeNull();

    const adUnlocked = { ...first, temporaryProjectSlot2: true };
    const second = startProject(adUnlocked, 'supplier_negotiation', 1).updatedBusiness;
    expect(second).toBeTruthy();
    if (!second) return;

    const active = (second.activeProjects ?? []).filter((project) => !project.resolved);
    expect(active).toHaveLength(2);
    expect(active[1].usesTemporarySlot).toBe(true);
    expect(startProject(second, 'marketing_campaign', 1).updatedBusiness).toBeNull();
  });

  test('the same project cannot occupy both slots at once', () => {
    const first = startProject(
      { ...makeBusiness(), projectSlot2Unlocked: true },
      'local_marketing',
      1,
    ).updatedBusiness;
    expect(first).toBeTruthy();
    if (!first) return;
    expect(startProject(first, 'local_marketing', 1).updatedBusiness).toBeNull();
  });
});
