This is an Expo/React Native mobile application. Prioritize mobile-first patterns, performance, and cross-platform compatibility.

## Game Design

- This is a Pokémon battler with custom mechanics, not a simulator of the canonical games. Follow the mechanics below rather than assuming standard Pokémon battle rules.
- Battles are raid-boss-style. Show the player's Pokémon on the left and the opponent on the right, facing each other. Pokémon sprites will come from a sprite folder when those assets are added; do not assume paths or assets that are not present.
- The opponent's health is a variable-size grid of blocks, not a numerical health bar. Grid size depends on HP and Defense, with stronger Pokémon receiving larger grids. The exact scaling formula is undecided; do not invent or hard-code a balance formula without direction.
- Show the player's four moves at the bottom of the battle screen. Tapping a move previews its attack pattern; dragging and dropping it onto the grid applies that pattern. Patterns are at most 3×3, and weaker moves use smaller patterns.
- After the player attacks, the opponent attacks using one of its moves. Its attack-selection and other raid behavior are not yet defined. Do not invent those mechanics; keep any implementation limited to specified behavior. For now, opponent attacks damage the player's regular health bar.
- The opponent faints when all grid blocks are removed.
- The player can open the bag to use healing or revival items on a selected Pokémon from a party list.
- Poké Ball catch success is calculated before its animation. Moving balls that teleport among grid squares are visual feedback only and must not reroll or change the result. A successful catch ends on an empty square; higher-level balls show more moving balls.
- The player can select a Pokémon and use a switch action to change the active Pokémon. The switch interface can preview that Pokémon's moves.
- Keep battle rules and outcomes separate from presentation and animation where practical, so visual effects cannot change gameplay results.

## Product Specifications

- Treat [specs/product.md](./specs/product.md) as the product overview and the files in [specs/features/](./specs/features/) as the detailed feature requirements. Update the relevant specification when behavior changes.
- Use PokeAPI for Pokémon and move data through TanStack Query. Give every screen's data load a visible loading state, a useful error state, and a retry path.
- Persist player progress in local SQLite so party, active Pokémon, inventory, and encounter progress survive app restarts.
- Keep screen presentation, API/database access, and battle rules in separate modules. Put game rules in shared logic rather than embedding them in route components.
- Use Expo Router for screens. The minimum product has distinct battle and party screens.
- Prefer `assets/images/sprites/{zero-padded-id}.png` or `.jpg` when present; mirror the right-side opponent sprite. Use PokeAPI artwork as a fallback until local art is available.
- Use haptic feedback for damage dealt, damage received, and every catch wobble. Haptics must never control game outcomes.
- Keep undecided raid-boss behavior and balance formulas isolated and clearly marked as prototype defaults.

## Expo has changed — do not trust your training data

Expo ships breaking changes every SDK release. APIs you remember are likely renamed, moved, or removed. Before writing any code that touches an Expo, EAS, or React Native API:

1. Read the major version of the `expo` package in `package.json`.
2. Fetch the matching versioned docs: `https://docs.expo.dev/versions/v<major>.0.0/`
3. For anything else, fetch https://docs.expo.dev/llms.txt — an index of all Expo docs with corrections to common LLM misconceptions. Follow its links to the specific page you need; never answer from memory.

## Commands

Use `bunx` instead of `npx` if the project uses bun (`bun.lock` present).

```bash
npx expo install <package>  # ALWAYS use instead of npm/yarn/pnpm/bun add — resolves SDK-compatible versions
npx expo start              # start the dev server
npx expo lint               # lint
npx tsc --noEmit            # typecheck
npx expo-doctor             # diagnose dependency and config issues
npx expo install --fix      # fix incompatible package versions
```

Run lint and typecheck before declaring any task done.

## Navigation & Routing

- Use **Expo Router** for all navigation. Routes live in `src/app/` — every file there is a screen, `_layout.tsx` files define navigators. Keep non-route code (components, hooks, utils) outside `src/app/`.
- Import `Link`, `router`, and `useLocalSearchParams` from `expo-router`.
- Docs: https://docs.expo.dev/router/introduction.md

## Building with EAS

Use EAS to build, sign, and submit the app in the cloud (`eas build`, `eas submit`) and to ship over-the-air updates (`eas update`) — no local Xcode or Android Studio required. Run EAS CLI as `bunx eas-cli <command>` in Bun projects, or `npx eas-cli@latest <command>` otherwise; substitute that for bare `eas` in docs examples.
Docs: https://docs.expo.dev/eas/index.md

## Folders

src/app/ # screens, Expo Router routes
src/components/ # reusable UI
src/hooks/ # data hooks, shared logic
src/services/ # API calls and SQLite

## Rules

- If `ios/` and `android/` directories do not exist, they are generated (Continuous Native Generation). Never create or edit them by hand — configure native behavior in `app.json` and config plugins.
- Expo Go only includes its bundled native modules. After adding a library with native code, the app needs a development build: `npx expo run:ios|android` locally, or `eas build --profile development`.
- Prefer recommended Expo modules over third-party libraries, and check your available skills before adding dependencies. Docs: https://docs.expo.dev/versions/latest/index.md
- Plan every issue before you start working on it. Make a task list in a `- [ ]` format. Make a comment on the github issue using `gh issue comment` with this task list. Do not follow the plan until approved.
