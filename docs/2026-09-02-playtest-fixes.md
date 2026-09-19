# September playtest fixes

## Included

- Theme-resolved stock charts, week/value labels, point selection, and readable native-text business market-share legends.
- Property values have their own row; long property names wrap.
- Confirmation dialog options reset between uses. Auction actions now say Bid, Inspect, Buy, Renovate or Sell.
- Business decision events offer the personal-cash injection needed for the cheapest choice and an option to skip.
- Clear funding buttons. A global warning appears below -€15,000, after other reports/events, with personal-cash injection or a €25,000 / 52-week business loan (10% total interest before prestige). Three-loan limit is respected; Not now postpones the warning until the next week.
- Competition now affects revenue before costs, tax, dividends, cash balance, profit history and valuation. Previous post-processing changed displayed profit without changing the business balance.
- Existing 25% annual loss refund and 70% positive-profit owner dividend remain unchanged. These also explain differences between net profit and cash movements.
- Each business receives +3% revenue and -5% employee payroll costs for its first 75 elapsed weeks, then normal rates resume. Employee contract salaries are unchanged.
- Career levels 1–2 receive +3% salary and 3 percentage points lower salary tax; level 3 +2% and 2 points; level 4 +1% and 1 point. Inflation and the five performance-raise cap remain.
- Promotions require completed matching Basic (L1–2), Advanced (L3–4), or Expert (L5+) education. Completion in the current weekly tick counts. Housing and car downgrades below current job requirements are rejected.
- All courses last one week less and cost €250 less upfront. Software courses cost an additional €1,750 less upfront. Weekly study fees are unchanged.
- Advanced/Expert completion notices no longer claim a new job can immediately be applied for.
- Fast Learner becomes Rental Growth: 2/4/6/8/10% total. Legacy upgrade IDs intentionally remain so existing purchases carry over. The separate Landlord Pro bonus is retained.
- All final prestige nodes require 5 gems plus their existing PP cost; existing unlocks are not retroactively charged.
- Education ads finish the course, not award gems; the UI now states this.
- Trade +/− buttons accelerate while held and stop on release, screen blur, backgrounding or unmount. Tapping changes one share; trade confirmation is still required.
- Quantity entry scrolls above the keyboard, provides Done, disables Android fullscreen input, and requests resize behavior.

## Verification

- TypeScript passes.
- 80 tests pass, including education gating, asset floors, tax adjustments, first-75-week startup support, competition cash reconciliation, rent rewards, gem costs, dialog reset and hold-to-repeat.
- Phone-width web property and trading layouts inspected. Quantity entry, Done and a one-share increment verified without trading. The preview caught an oversized input; its width is now constrained so Max remains visible. Web cannot verify Android keyboard or SVG rendering.

## Device testing before release

1. Check stock axes, point labels and rival names in light and dark mode.
2. Test long auction property names and bid confirmation after opening Sell All.
3. Test an unaffordable business event: inject, choose; repeat with Skip.
4. Test business warnings below -€15,000 from Dashboard, including insufficient personal cash and three existing loans.
5. Hold + and −, release, drag outside, switch screens and background the app. Ensure quantities stop and no trade happens automatically.
6. Enter quantity using Samsung/Gboard keyboards in portrait/landscape. Confirm Done dismisses the keyboard and trade buttons remain reachable.

A new Android build is needed for the keyboard resize configuration and closed-testing rollout. No AAB was built as part of this change.
