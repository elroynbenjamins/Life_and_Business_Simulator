# Endgame fixes and acquisition rebalance — 19 September 2026

## Fixed

- Estate successors are identified by a persisted person ID, not their display name. Legacy name-only settlements use the saved designation, or an unambiguous name match.
- Continuing as a child retains that child's existing business shares even when another person inherits the parent's shares. The other owner's shares are retained, and the child does not receive the parent's holding-company cash by mistake.
- Unpaid estate settlement costs reduce the successor's net inherited equity. The underlying assets remain intact, with a visible, interest-free liability repaid over 80 weeks. Preview and actual net worth are covered by a regression test.
- Market trend and crypto scarcity clocks use world year/week rather than the current generation's resettable statistics.
- The weekly crash summary now describes recession pressure rather than claiming every stock actually fell by the raw shock percentage.

## Acquisitions

New acquisitions retain the seller's quoted weekly revenue and profit, purchase inflation, employee cost baseline, employee expense-buff baseline and revenue capacity. The normal operating engine still applies changing productivity, reputation, upgrades, seasons, market share, events, integration, advertising, family salaries, locations and financing.

Operating overhead is calibrated to the seller's after-corporate-tax, before-acquisition-financing profit. It has a 60% fixed / 40% volume-sensitive component. Acquisitions no longer receive startup demand or wage subsidies. Actual employees remain paid separately. Existing acquisitions reconstruct a baseline once from purchase valuation and a 15% assumed net margin because old saves do not contain the original seller quote. Existing loans and accumulated balances are not rewritten.

### Seeded first-year comparison

300 cash-funded acquisitions, 100 per tier, integrate strategy, 20 actual operating weeks, fixed inflation. These are operating profits, not investment guarantees or personal cash payouts.

| Tier | Previous median profit / purchase price | New median profit / purchase price | New actual / quoted profit |
| --- | ---: | ---: | ---: |
| Regional | 106% | 26.99% | 1.14x |
| National | 128% | 18.50% | 0.81x |
| Enterprise | 131% | 15.37% | 0.71x |

First-year median cash dividends are zero in all three cohorts: the existing reserve policy retains profits for operating liquidity. This is distinct from the positive operating returns above. Integration and seasonal effects still make realized results differ from seller estimates.

## Verification

- TypeScript: `node node_modules/typescript/bin/tsc --noEmit`.
- Standard regression suite: **172 passed**, four opt-in diagnostic tests skipped.
- Endgame accounting tests now run in the standard suite, including same-name heirs, minority holdings, illiquid settlement debt, succession asset choices, save/load and crash continuation.
- Acquisition tests cover seller-scale income, detailed expense totals, preserved purchase baselines, and legacy-save baseline persistence.
- Acquisition diagnostic: `$env:BALANCE_DIAGNOSTICS='1'; node node_modules/jest/bin/jest.js --runInBand balanceDiagnostics -t 'acquisition quote'`.

## Long-save interpretation

A 40-run stress batch (10 seeds each: investor, full-prestige investor, balanced acquisition debt, high acquisition debt) covers checkpoints at 20, 50 and 100 game years. The harness starts wealthy, keeps inherited financial assets and does not actively manage companies or descendants. This is a stress test, not a simulation of an attentive player.

The final batch passed with zero detected non-finite net-worth values or invalid stock prices. All 40 runs reached 50 years. Inflation-adjusted median net worth at 50 years was EUR 31.22m for investors, EUR 51.07m with full prestige, EUR 24.96m with balanced acquisition debt and EUR 29.91m with high acquisition debt. Only 2/10, 2/10, 0/10 and 3/10 respectively remained active at 100 years. These small samples are not a like-for-like replacement for the earlier 200-run baseline.

The recalibration removes the former automatic multi-hundred-million acquisition windfall. Unmanaged acquired companies can exhaust their cash; the initial rerun recorded this in every acquisition scenario by 20 years. Inheritance taxes can also produce personal cash shortages later. Runs can end at death without a willing heir; 100-year survivor medians are not representative of all starting players.

The changes fix the confirmed accounting bugs and excessive acquisition income. They do **not** establish perfect late-game balance. Further tuning should distinguish attentive management from abandonment, test actual inheritance liquidity choices, and use larger paired seed sets before changing taxes, dividends or market returns again.

No AAB, GitHub push or production publication was requested or performed for these changes.
