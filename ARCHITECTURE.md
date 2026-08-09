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
- `eventEngine.ts`, `newsEngine.ts`, `achievementEngine.ts`: event and reward selection.
- `propertyEngine.ts`, `competitorEngine.ts`, `economyEngine.ts`, `happinessEngine.ts`, and `prestigeEngine.ts`: supporting domain rules.

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
