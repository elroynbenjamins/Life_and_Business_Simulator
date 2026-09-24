# Architecture

## Runtime flow

Expo Router mounts `app/_layout.tsx`, which loads the active save through the Zustand store and renders the navigation stack plus global modals. Screens read state and invoke commands through `src/store/gameStore.ts`.

The primary turn sequence is:

```text
Next Week button
  -> gameStore.advanceWeek()
  -> weeklyTick(current GameState)
  -> domain engines and JSON data
  -> new GameState + WeekSummary
  -> Zustand update and AsyncStorage save
  -> summary/event/report modal
```

`weeklyTick` is the orchestration boundary. Domain calculations should remain in `src/engine/`; screens should format and present results rather than reproduce game rules.

## State ownership

`GameState` in `src/types/game.ts` is the persisted state for one save slot. It includes player finances and progression as well as owned businesses, properties, investments, market state, and historical statistics.

The Zustand `GameStore` extends that persisted state with transient UI state and commands. `extractGameState()` is therefore an important persistence boundary: new persisted fields must be included there and given a fallback during load migration.

`PlayerProfile` is stored separately and shared across save slots. It contains XP, gems, prestige points, and unlocked prestige bonuses.

## Persistence and compatibility

`src/utils/storage.ts` stores three game slots, slot metadata, the active slot, and the shared profile in AsyncStorage. Load-time migrations currently live in `gameStore.ts` and merge saved data over `INITIAL_GAME_STATE`.

When changing persisted state:

1. Add or update the TypeScript type.
2. Update `INITIAL_GAME_STATE`.
3. Add an explicit load fallback or migration.
4. Confirm `extractGameState()` includes the field.
5. Add a migration test before release.

Avoid renaming IDs in JSON data without migrating existing references in saves.

## Engine boundaries

- `weeklyTick.ts`: sequences one game week and builds its summary.
- `financeEngine.ts`: income, expenses, loans, taxes, portfolio value, and net worth.
- `stockEngine.ts`: prices, dividends, market sentiment, and market events.
- `businessEngine.ts`: business creation and weekly operations.
- `careerEngine.ts`, `educationEngine.ts`, `skillEngine.ts`: player progression.
- `newsEngine.ts`, `achievementEngine.ts`: passive news and reward selection.
- `propertyEngine.ts`, `competitorEngine.ts`, `economyEngine.ts`, `happinessEngine.ts`, and `prestigeEngine.ts`: supporting domain rules.
- `holdingCompanyEngine.ts`: holding creation, treasury/fee rules, shared services, and consolidated holding summaries.
- `businessBudgetEngine.ts`: annual cash allocation and reserve policy.
- `businessManagementTargetsEngine.ts`: quarterly KPI targets and management-review history.

Randomized engines should accept or isolate randomness before extensive simulation tests are added. Pure calculations can be tested directly now.

## Navigation and UI

`app/tabs/` contains the five primary sections: Home, Career, Education, Market, and Finance. Stack routes cover stock details, portfolio, housing, profile, achievements, loans, businesses, skills, prestige, properties, statistics, news, support, and information.

Global save-slot, name-entry, weekly-summary, negative-cash, event, and period-report overlays are mounted once in the root layout.

## Known technical risks

- `gameStore.ts` combines persistence, migrations, UI flags, and every domain command.
- `businessEngine.ts` contains a large share of the simulation complexity.
- Save migrations are inline and not versioned.
- The repository previously lacked automated validation scripts and engine tests.
- Native advertising and AsyncStorage behavior require device-level verification.

Refactoring should be incremental and behavior-preserving: first protect calculations and migrations with tests, then extract store slices and engine modules.

## Business management policy hierarchy

Business management uses one primary direction plus supporting policies. Do not add another general-purpose company "mode" without fitting it into this hierarchy:

1. **Strategic Focus** is the primary competitive direction (`balanced`, `growth`, `margin`, `premium`, `automation`, `rd`). It affects operating economics and Auto Strategy choices.
2. **Annual Cash Plan** controls profit allocation only: dividends, debt paydown, reinvestment, growth reserves, and operating buffer. The legacy `standard` profile is a save-compatibility alias and normalizes to `balanced`; it is not player-facing.
3. **Quarterly Management Targets** are derived from Strategic Focus + Annual Cash Plan. They measure execution and should not become a separate competing strategy selector.
4. **Holding Delegation** controls who runs routine pricing, marketing, and staffing. The `balanced` storage key is presented as **Follow Strategy** and inherits Strategic Focus. Explicit Growth / Profit / Conservative delegation policies are deliberate overrides.
5. **Auto Strategy** automates routine strategic/HR choices using Strategic Focus and the current Economic Cycle. Crises remain manual.

Economic Cycle, Market Sentiment, Market Events, and Macro Crash remain separate layers: long-run macro regime, short-run financial mood, temporary asset/sector shock, and rare severe correction respectively.

## Removed legacy systems

The old random weekly Life Events engine and its JSON data were removed after the live weekly pipeline stopped using them. Business strategic/crisis choices are generated by the current business engine; the obsolete standalone business-choice JSON source was also removed.
