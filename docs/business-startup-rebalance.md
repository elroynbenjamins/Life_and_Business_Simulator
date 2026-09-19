# Business startup rebalance — 4 September 2026

## Changes

- General overhead scales from 25% of its normal budget at reputation 0 to 100% at reputation 70. At reputation 25 it is approximately 52%.
- Premises rent scales from 65% to 100% over the same reputation range (approximately 78% at reputation 25).
- Contractual employee wages, advertising, business loans and expansion costs are not reduced by reputation. The existing first-75-week payroll subsidy remains.
- Starting local-customer revenue support no longer disappears at business level 1. It gradually fades between reputation 40 and 70.
- Small-capacity businesses receive a modest extra starting-customer adjustment. Larger companies still have larger revenue and cost budgets.
- Occasional weak-order weeks preserve downside risk. Low reputation does not guarantee profits.
- Owner dividends retain six weeks of operating expenses in business cash before paying out up to the existing 70% share of profit.
- Upgrade revenue and reputation effects are multiplied by 0.75. New upgrade durations are 25% shorter, rounded to whole weeks: 12–23 instead of 16–30. Existing in-progress timers are unchanged.
- Upgrade reputation rewards are now actually applied on completion. Valuation and level are recalculated using the final balance and reputation.

## Comparable before/after simulations

12 business types × 5 fixed random seeds × 3 durations = 180 runs for each model.
Each run starts with 3 randomized employees, reputation 25 and €15,000 operating cash **after business acquisition**. Rival CEOs are simulated. No upgrades, prestige, advertising, injections, loans or manual interventions; inflation is fixed at 1.

The simulator now includes optional real competition and deterministic business identities. It begins at the first elapsed week after founding, matching game week numbering. Both before and after reports use this same corrected harness.

| Elapsed weeks | Before: median cumulative profit | After: median cumulative profit | After: median profitable-week share | Before: runs reaching negative cash | After |
|---|---:|---:|---:|---:|---:|
| 20 | -€13,647 | €2,199 | 80% | 11/60 | 0/60 |
| 75 | -€46,918 | €9,872 | 83% | 60/60 | 0/60 |
| 150 | -€106,752 | €13,391 | 76% | 60/60 | 0/60 |

Median ending business cash after the rebalance: €15,517 at week 20; €16,459 at week 75; €14,787 at week 150. Profit is not identical to retained cash because owner dividends, events and annual refunds also affect balances.

## Week 75 by business type

Median across five seeds; three employees for every type, so these are startup results rather than maximum-capacity comparisons.

| Business | Cumulative profit | Profitable weeks | Ending business cash |
|---|---:|---:|---:|
| Coffee Shop | -€108 | 60% | €10,632 |
| Food Truck | €231 | 63% | €10,093 |
| Restaurant | €39,104 | 88% | €23,569 |
| Clothing Store | €8,953 | 79% | €16,530 |
| Software Company | €25,528 | 89% | €18,631 |
| Fitness Gym | €17,334 | 84% | €17,804 |
| Construction Company | €73,413 | 91% | €40,056 |
| Digital Agency | €8,835 | 84% | €13,488 |
| Pharmacy | €47,317 | 89% | €26,014 |
| Auto Repair Shop | €2,468 | 64% | €13,850 |
| Real Estate Agency | €9,680 | 84% | €15,692 |
| Bakery | €2,659 | 64% | €12,189 |

These results support a friendlier opening, not a guarantee of solvency. Coffee shops and food trucks still need management for meaningful profits. Larger companies require different acquisition investments; the table does not compare return on purchase price. Runs exclude human decisions, active reinvestment, growing staffing and inflation. Existing simulation tests also cover multiple employee qualities, upgrades, prestige and longer runs.

## Verification and reproduction

- TypeScript passes; all 85 tests pass.
- Run `node scripts/businessStartupAudit.cjs after` from the project directory.
- Machine-readable results: `business-startup-before.json` and `business-startup-after.json`.
- The before report is a historical snapshot taken before this engine change. Do not regenerate it using the new engine.
- No AAB was built or uploaded in this pass. A new build is required to deliver these changes to testers.
