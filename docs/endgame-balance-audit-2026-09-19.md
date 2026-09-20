# Endgame accounting and balance audit — 19 September 2026

## Scope and method

This is an audit, not a balancing patch. Gameplay coefficients and production save data were not changed.

- Real `weeklyTick`, market events, inflation, mortality, relationship engine, acquisitions, and `continueAsChild` were exercised. The older `scripts/simulate-stocks.cjs` was not used.
- Long-save batch: 50 deterministic seeds per cohort, four cohorts (200 runs), up to 2,000 weeks each. Checkpoints are 20, 50 and 100 elapsed game years (20 weeks/year).
- Cohorts: investor without prestige, investor with the entire prestige tree, moderately financed acquisition, highly leveraged acquisition.
- Deliberately artificial late-game starting fixture: age 40, world year 21, approximately EUR30m, consisting of EUR24m cash plus EUR6m investments (EUR3m GLBL and EUR1m each AURX/NEXA/MOJO). It starts with an adult child and a grandchild, no spouse or career. Market prices and inflation start at their baseline for a controlled comparison. This does not model organic early-game progression or time to unlock acquisitions.
- Acquisition cohorts purchase one random regional company at the quoted price, pay the specified down payment, select Integrate Operations and treat it as a family business. No further recruitment, capital injection, borrowing, reinvestment or event decisions are automated. The holding is pre-created as part of the fixture, without charging setup costs.
- At death the policy selects the first willing adult heir, designates that heir, retains stocks/properties and finances inheritance tax only when cash is insufficient. This deliberately stress-tests asset retention; it is not an optimal player strategy. No stocks are sold to cure later cash shortfalls and no parent-bond maintenance is automated. Runs stop when succession is unavailable.
- Checkpoint wealth and return statistics use only still-active runs. Ended runs are counted separately, not silently treated as 100-year survivors. P50 uses the lower middle observation for even sample counts; P10/P90 use ordered-sample selection.
- Acquisition quote calibration: 300 independently generated targets (100 regional, 100 national, 100 enterprise), cash-funded, 20 actual business-engine weeks, integration enabled, fixed inflation. This isolates operating profit from acquisition debt.
- Household check: every existing career position at levels 1–7, required minimum car/housing, zero versus five performance raises, inflation multipliers 1 and 3, one parent with three children aged 1/7/14. No spouse contribution, prestige, additional loans, investments or education expenses. Taxes are reserved weekly as annual salary tax divided by 20.

## Confirmed defects

1. **Wrong business successor when names match.** Succession compares `estate.successorName` with `child.name` rather than a stable child ID. In the fixture, the undesignated same-name child is shown EUR7,549,220 of inherited business value. This is incorrect eligibility, not a demonstration that two children can both claim the same estate simultaneously.
2. **Existing child-owned equity can disappear.** If the chosen child is not the designated business heir, `continueAsChild` discards all businesses when `inheritedBusinessValue` is zero, including a 20% stake the child already owned. A real store-action test reproduces this.
3. **Illiquid administration costs are not fully settled.** A business-only fixture distributes EUR7,049,220 despite a post-administration net estate of EUR6,908,236: EUR140,984 of administration costs has no effective deduction from the transferred value.
4. **Succession resets world-market trend age.** Stock trend anchoring and crypto scarcity use `statistics.weeksPlayed`, which is reset for the new generation. Identical market state and identical random draws change GLBL's next price from EUR160.36 to EUR159.50 solely by resetting personal statistics. A continuous world-market clock is needed before long-save market returns can be trusted as intentional balance.

The new targeted accounting suite has **8 passing checks and 4 failing checks**. The four failures above are deliberately retained as executable reproduction cases behind `ENDGAME_AUDIT=1`, not hidden by changing their expected results. The standard suite still passes 157 tests; it skips the opt-in audits and is not evidence that these defects are fixed.

## Accounting and persistence checks that passed

- Personal cash transferred to holding reserve conserves net worth.
- Holding-to-business capital allocations conserve wholly owned group equity immediately.
- Holding-funded debt repayments conserve wholly owned group equity.
- Normal, sufficiently liquid succession conserves inherited value for all four strategies: liquidate, keep stocks, keep properties, keep both. A real property and stock position are included.
- Those four successor states survive JSON save/load through the real storage implementation with mocked AsyncStorage.
- A pending multiweek crash survives succession and save/load, continues with its remaining waves, then clears without restarting.

These are not complete Android persistence/migration or minority-owner dilution tests.

## Mortality check

A separate deterministic test ran 10,000 lifetimes through `processLifecycle`: minimum observed death age 55, P10 age 70, median age 84, P90 age 94, maximum observed age 104. The configured absolute cutoff remains age 110; a sample maximum of 104 does not change that rule. Mortality itself is not gated by Personal Life mode, so economy-only players can also die but have no children unless their save already contains them. This deserves clear player-facing explanation; it is not classified here as an implementation defect.

## Acquisition balance

| Target tier | Samples | Actual first-year profit / advertised profit | First-year profit / price | First-year personal dividend / price |
|---|---:|---:|---:|---:|
| Regional | 100 | 4.65x | 105.9% | 53.9% |
| National | 100 | 5.50x | 128.3% | 66.8% |
| Enterprise | 100 | 5.73x | 131.2% | 70.2% |

All columns are sample medians. Profit yield is operating profit divided by purchase price, not total investment return or capital appreciation. These acquisitions are cash-funded for this comparison.

The target generator advertises 9–21% margins and uses approximately 2–5 times annual profit for value. The acquired company's running engine then derives scale from revenue and separately applies employee productivity, reputation, upgrades, rent and salary costs. Advertised profit is not the calibrated result of that same operating model. Fix this mismatch before applying a blanket price increase or revenue nerf. Acquisition financing also charges a one-time 8% over 160 weeks or 10.5% over 200 weeks, not those percentages each year; this is a very forgiving source of leverage.

## Household and prestige observations

- With three children and no second income, level-1 weekly surplus ranges from -EUR323 to +EUR150 at base salary. At five performance raises it ranges from -EUR246 to +EUR294.
- Levels 2–3 still have negative outcomes in some careers; levels 4–7 are positive in all tested valid positions at baseline inflation. Only one career has a level-7 position, so nonexistent positions were excluded.
- At three times inflation the nominal surpluses/deficits roughly triple. This is not an independent inflation failure: salaries, tax thresholds and tested costs largely scale together.
- This difficult three-child scenario does not justify blanket salary increases. Clear family-budget previews and cash-buffer warnings would be more targeted changes.
- Maximum new prestige effects evaluate to 20% crisis chance reduction, +12 starting governance performance, 10% inheritance-tax reduction, and 16% crypto downside reduction. These branches use their highest level rather than adding all levels together. Crypto protection changes the return distribution by reducing losses without reducing gains; it needs special attention after the trend-clock fix.
- The full-tree investor comparison includes all prestige effects, not only crypto protection, and the unlock costs are not earned in the scenario. It measures a maximum-benefit envelope, not progression value-for-money.

## Long-save results

Amounts below are millions of euros in starting-price purchasing power (net worth divided by the inflation multiplier). The starting fixture has approximately EUR30m before acquisition down payments and immediate purchase-price/value differences.

| Cohort | 20-year P50 real net worth | 50-year P50 real net worth | 100-year P50 real net worth | Runs still active at 100 years |
|---|---:|---:|---:|---:|
| Investor, no prestige | 23.39 | 15.93 | 2.62 | 6/50 |
| Investor, maximum prestige | 26.98 | 24.54 | 2.37 | 6/50 |
| Moderate acquisition debt | 339.80 | 501.99 | 618.21 | 7/50 |
| High acquisition debt | 347.63 | 549.28 | 615.93 | 7/50 |

Every run in all four cohorts reached the 20- and 50-year checkpoints. The 100-year wealth statistics represent only 6–7 survivors each; do not interpret them as the expected result for all players. Most unattended dynasties ended after multiple deaths without an eligible continuation. Maintaining family relationships and deliberately planning the next generation are not automated here.

By 100 years, a negative personal cash balance had occurred in 26% of no-prestige investor runs, 48% of full-prestige investor runs, 4% of moderately financed acquisition runs and 6% of highly leveraged acquisition runs, including runs that later ended. These are cash-shortfall rates, not formally measured bankruptcy rates. The all-assets-retained inheritance policy can produce larger tax bills/loans for wealthier estates. The prestige comparison therefore does not establish that prestige makes a played game worse.

Neither acquisition cohort had any negative personal cash by year 50, and none of their companies developed a negative business balance at any simulated point. High leverage is not creating a meaningful cash-flow tradeoff under these fixtures. Revisit this after acquisition margins are calibrated rather than compensating solely with more random adverse events.

All 200 runs completed the harness successfully: no detected non-finite net worth, non-finite market prices or nonpositive prices. Runs that ended at death were stopped, not continued as dead players. The long-save batch took approximately 13.6 minutes. TypeScript and the standard 157-test suite passed separately; the dedicated accounting audit still has its four documented failures.

At 20 years, median price-only annualized returns in the no-prestige investor cohort were GLBL 1.48%, AURX 2.63%, NEXA 3.20%, and MOJO -5.81%. With the entire prestige tree they were 1.48%, 3.44%, 5.05%, and 2.46%, respectively. Dividends/staking enter personal cash in the simulation but are excluded from these price CAGR figures. The strong shift in speculative-crypto returns warrants review, but full-tree and long-generation comparisons are not isolated single-effect experiments.

At 50 years, median recession counts were six in these cohorts. Among 100-year survivors the median was 14–17. The persistence check confirms continuation of waves after succession/reload; it does not prove ideal crash frequency, recovery duration or overlapping-event balance. The weekly summary also currently describes the raw crash shock as the market's actual fall, although asset-specific sensitivity and other events change the final returns.

## Reproduction

From the app project directory in PowerShell:

```powershell
$env:ENDGAME_AUDIT = '1'
node node_modules/jest/bin/jest.js --runInBand endgameAudit
Remove-Item Env:ENDGAME_AUDIT

$env:BALANCE_DIAGNOSTICS = '1'
node node_modules/jest/bin/jest.js --runInBand balanceDiagnostics
Remove-Item Env:BALANCE_DIAGNOSTICS

$env:LONG_SAVE_AUDIT = '1'
$env:AUDIT_SEEDS = '50'
node node_modules/jest/bin/jest.js --runInBand --sandboxInjectedGlobals=Math --sandboxInjectedGlobals=Date --sandboxInjectedGlobals=JSON --runTestsByPath src/engine/__tests__/longSaveAudit.test.ts
Remove-Item Env:LONG_SAVE_AUDIT
Remove-Item Env:AUDIT_SEEDS
```

Recommended next order: repair the four accounting/world-clock defects, calibrate acquisition operating output to its quoted finances, rerun these seeds, then decide whether market growth, inheritance liquidity and family affordability require numerical tuning. No AAB or GitHub publication is part of this audit.
