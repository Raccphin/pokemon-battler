# Feature: Quality and architecture

- Use TypeScript and keep ESLint and TypeScript checks free of errors.
- Keep route components focused on rendering and user interaction. Routes must not call TanStack Query hooks, PokeAPI/database services, or game-rule services directly.
- Put screen-specific query orchestration, data-to-view-model mapping, mutations, and game-rule derivations in hooks under `src/hooks/`. Keep reusable API access, SQLite persistence, deterministic rules, and presentation formatting in their respective service or utility modules.
- Controllers expose loading/error state and retry actions to routes; routes render those states without owning request or persistence behavior.
- TanStack Query owns remote/server data. SQLite owns persistent player data. Do not duplicate those responsibilities in component state.
- Every screen data load has explicit loading and error states, with a retry path for recoverable failures.
- Keep layout touch-friendly, responsive, and usable on iOS, Android, and web.
- Keep the implementation compatible with the Expo SDK declared in `package.json`; check that SDK's versioned documentation before using Expo or React Native APIs.
