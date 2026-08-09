# Life & Business Simulator

Life & Business Simulator is a local-first management game built with React Native, Expo, Expo Router, TypeScript, and Zustand. The player advances one week at a time while managing education, employment, personal finances, investments, property, and businesses.

This `react_native_space` directory is the canonical and most complete application in this workspace. The copy under `github_repos/life-business-simulator` is an older snapshot and should not receive new development work unless the copies are deliberately reconciled.

## Requirements

- Node.js 20 or newer
- Corepack
- Yarn 4 (the repository declares the exact package-manager version)
- Expo Go or an Android/iOS development environment for native testing

## Setup

```sh
corepack enable
yarn install --immutable
yarn start
```

Use `yarn android`, `yarn ios`, or `yarn web` to target a platform directly.

## Validation

```sh
yarn typecheck
yarn test:ci
yarn doctor
```

`yarn validate` runs the TypeScript check and deterministic unit tests. Run Expo Doctor separately because it may inspect package compatibility and the local environment.

## Game systems

- Three local save slots and a cross-save player profile
- Weekly salary, living expenses, loans, progressive taxes, and inflation
- Education, skills, knowledge, careers, promotions, and performance events
- Stock trading, dividends, market sentiment, and market events
- Housing, cars, food tiers, house upgrades, and rental property
- Business founding, staffing, training, projects, upgrades, competitors, loans, and valuation
- Life events, happiness effects, achievements, gems, and prestige bonuses
- Weekly summaries, 20-week period reports, statistics, and news history

## Project map

```text
app/                 Expo Router screens and layouts
src/components/      Shared UI and global modals
src/data/            JSON game content and balancing values
src/engine/          Mostly pure simulation and calculation functions
src/services/        Advertising configuration and platform adapters
src/store/           Zustand state, commands, migrations, and autosave
src/theme/           Shared colors
src/types/           Domain and persisted-state types
src/utils/           Formatting and AsyncStorage persistence
```

See [ARCHITECTURE.md](./ARCHITECTURE.md) for state flow, save compatibility, and development guidance.

## Current maintenance priorities

1. Keep engine calculations deterministic and covered by unit tests.
2. Add migration tests before changing persisted `GameState` fields.
3. Gradually divide `gameStore.ts` into domain-oriented Zustand slices.
4. Break `businessEngine.ts` into smaller calculation and event modules without changing outcomes.
5. Test native advertising and persistence behavior on real Android/iOS builds.

## Data changes

Most content and balancing live in `src/data/*.json`. IDs are persisted in save files, so renaming or deleting an ID requires a save migration or a compatible fallback. Update the corresponding interfaces in `src/types/game.ts` when a JSON schema changes.
