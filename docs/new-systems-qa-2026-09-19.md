# New systems QA — 19 September 2026

## Follow-up fixes

The five findings below have now been addressed in code: succession offers Start New Life when there are no willing heirs; the dashboard supplies relationship state to its expense calculator; active career history records promotions and is repaired before quitting; new prestige branches reuse existing artwork; and crypto controls/confirmations consistently use coin/coins. The original findings are retained below as audit history. Screen regression tests cover family expenses, empty/unwilling heir selections, and prestige artwork coverage; career tests cover promoted levels, missing history, and preserving closed entries. Existing higher-level employment can be recovered, but a level already lost by quitting in an older build cannot reliably be reconstructed.

## Results

- Existing Jest suite: 20 suites, 149 tests passed.
- TypeScript: `tsc --noEmit` passed.
- Browser testing used a separate localhost:8082 origin and a new QA Tester save, not an existing player save.
- No gameplay fixes or release builds were made in this audit.

## Findings

### High: succession can have no usable forward action

`app/succession.tsx:139-196` includes every adult child with a succession preview in `eligible`, including unwilling heirs. Unwilling cards are disabled, but Start New Life only appears when `eligible.length === 0`. If every adult child has a parent relationship below 30, the player cannot select an heir or start a new life from this screen. This is confirmed by the screen's conditions and the preview engine; it was not reproduced with a deceased browser save.

### Medium: dashboard excludes relationship household finances

`app/tabs/index.tsx:34-63` passes a partial state to `calculatePartnerContribution`, without `relationshipModeEnabled` or `relationshipState`. The calculator immediately returns zero when the missing mode flag is falsy. The dashboard's weekly expenses therefore omit partner-related household costs, child costs, and relationship obligations even when Personal Life is enabled. This is a display/calculation-input issue, not proof that the weekly engine fails to charge those costs.

### Medium: promoted career level is not retained for reapplication

`app/tabs/career.tsx:199` determines reapplication level from career history IDs. `applyForCareerJob` records the hired level; promotions do not update that history. `quitCareerJob` closes the history entry and resets the current career. A player hired at level 1 and promoted later can therefore still be offered level 1 after quitting. Verified by tracing the history writers and promotion path, not by playing through a full career in the browser.

### Low: new prestige branches have no artwork

Business Resilience, Family Leadership, Legacy Planning, and Crypto Risk Control have no entries in `src/assets/progressionImages.ts`. The prestige screen renders Image unconditionally without a fallback. All 16 upgrade cards across these four branches lack images. Confirmed in the browser accessibility tree and asset mapping.

### Low: crypto trade copy still says shares

The crypto screen correctly labels the position Coins Owned and confirmations use coins, but the quantity field accessibility label, stepper buttons, and hold instructions still say shares. Also, the confirmation says “1 coins”. Observed while buying and selling AURX.

## Browser checks completed

| Area | What was checked | Result |
|---|---|---|
| New game | Empty slot, name entry, Personal Life enabled | Passed |
| Tutorial | Skip introduction, education guidance, navigation | Passed |
| Education | Retail Basics enrollment | Passed; cash decreased from 10,000 to 5,950 |
| Personal Life | Initial preferences screen, generate profiles, first coffee date | Passed; date cost 25, connection increased, weekly action restriction shown |
| Family Tree | Navigation and first-generation player card | Passed |
| Acquisitions | Initial low-net-worth screen | Correct 10 million unlock requirement shown |
| Holding Companies | Initial low-net-worth screen | Correct locked state shown |
| Crypto | Filter, AURX detail, buy confirmation, position, sell-all confirmation | Passed; 420 purchase/sale accounting consistent |
| Prestige | New branch cards and requirements | Screen loads; missing-artwork issue above |

## Coverage limits and next checks

This is not an all-screens or release certification. Existing automated tests exercise engines, but do not establish complete UI or save-transition coverage. The browser used an early-game save, so unlocked acquisitions/holdings, family governance, death, inheritance choices, and multi-generation save/reload still need dedicated endgame fixtures and interaction tests. Economy-only mode has automated engine coverage but was not played through separately in this browser run. Native Android layout, keyboard behavior, theme switching, billing, and rewarded ads were not verified on a device.

Recommended order: fix the succession dead-end, dashboard household inputs, and career history; add regression tests; then exercise unlocked endgame screens with seeded test fixtures and perform an Android smoke test before producing another release.
