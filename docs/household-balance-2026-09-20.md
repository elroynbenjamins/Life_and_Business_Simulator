# Household costs and balance — 20 September 2026

## Changes

Child costs now have five age bands and explicit food, care/school, clothes/health, transport/activities and utility components. All components scale with inflation. Housing remains a separate bill; gifts, education funds and family events remain separate discretionary/one-off costs. No additional blanket family surcharge was added.

| Age | Food | Care/school | Clothes/health | Transport/activities | Utilities | Total/week | Previous total |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 0–2 | 45 | 75 | 30 | 10 | 15 | 175 | 130 |
| 3–5 | 45 | 55 | 25 | 15 | 15 | 155 | 95 |
| 6–11 | 50 | 25 | 20 | 20 | 15 | 130 | 95 |
| 12–15 | 65 | 30 | 25 | 25 | 20 | 165 | 140 |
| 16–17 | 75 | 35 | 30 | 30 | 20 | 190 | 140 |
| 18+ | 0 | 0 | 0 | 0 | 0 | 0 | 0 |

Amounts are game euros before inflation. Regular automatic support ends at adulthood, matching the existing independence mechanic. A complete 18-year childhood costs EUR 56,200 at constant prices, versus EUR 41,700 before this change (+34.8%). There are 20 weeks per game year.

Statistics and Finance now include household expenses and partner contributions in their totals; their previous selectors omitted relationship state. Family cards show each child's cost breakdown. The existing dashboard and weekly-summary calculation already charged family costs; a new real-engine regression verifies they are deducted exactly once.

Partner shared-cost calculations now use the actual rent, utility and job-level food helpers. Contributions remain limited to the chosen split and 55% of partner income. They do not reimburse personal car costs, education or debt. Unemployed partners contribute zero but still add household costs. A partner's career check now runs once per 20-week interval even when the result is no event; previously it could reroll every week after the cooldown until an event occurred.

## Budget matrix

21,960 deterministic budget cases cover every existing career/level, zero or five performance raises, 0–3 children, no partner or income of EUR 0/450/900/2,500, all three household splits, and inflation multipliers 1/2/3. Additional housing comparisons choose a home with enough capacity for the household. These are budget snapshots, not 21,960 randomly played lives.

Income comparisons below use no performance raises, no prestige, no investments, no personal loans and no course costs. Salary tax is reserved weekly using the actual 20-week tax formula. Medians are across available careers at each level; low-paying careers can be considerably worse. Partner income is EUR 900/week with an equal split. Children are age 1 (one child), ages 7 and 16 (two), or ages 1, 7 and 16 (three).

| Job level | Single, no children | Single parent, one child | Partner + one child, minimum job home | Partner + one child, family-sized home | Partner + three children, family-sized home |
| --- | ---: | ---: | ---: | ---: | ---: |
| 1 | +221 | +46 | +294 | -254 | -1,174 |
| 2 | +490 | +315 | +575 | +15 | -905 |
| 3 | +537 | +362 | +745 | +292 | -628 |
| 4 | +993 | +818 | +1,213 | +748 | -172 |
| 5 | +1,029 | +854 | +1,244 | +1,244 | +324 |
| 6 | +1,215 | +1,040 | +1,405 | +1,405 | +1,085 |
| 7 | +1,430 | +1,255 | +1,540 | +1,540 | +1,220 |

All figures are weekly surplus after reserved tax. The single-parent column uses the minimum job home, not necessarily sufficient family space. The family-sized comparison is a planning scenario, not a new automatic housing purchase or mandatory deduction.

## Interpretation and limitations

- Partners help but do not turn their entire salary into free player income. The EUR 900 partner's maximum contribution is EUR 495/week, with extra food/utilities offsetting part of that benefit.
- A family can be very difficult at levels 1–2, especially in the lower-paying careers or after upgrading housing. A single parent in the lowest-paid level-1 career is already EUR 133/week short with one baby even before moving to a larger home.
- Level 3 generally supports one child with an employed partner; larger families and suitable housing normally need higher earnings, raises, savings or investment income. There is no case for another large flat household fee.
- The inflation invariants index both incomes to compare real purchasing power. They do not imply that a partner is guaranteed matching pay rises in actual play. Unemployment, promotions, family events and interest add uncertainty beyond the table.
- School-age costs fall after early childcare; teen costs rise again. The full childhood and birthday tests use the world clock, so succession or stale displayed ages do not restart the cost bands.
- No blanket salary, rent, tax, partner contribution cap or inheritance changes were made in this pass.

## Reproduction

From the app directory:

```powershell
node node_modules/jest/bin/jest.js --runInBand householdBalance
node node_modules/jest/bin/jest.js --runInBand --silent
node node_modules/typescript/bin/tsc --noEmit
```

Coverage includes age boundaries, inflation, no-partner households, disabled relationship mode, a complete 360-week childhood with JSON round trips, actual weekly cash debits, partner career-event cooldowns and UI updates as children age. No AAB or publication is included.
