# Feature: Quality and architecture

- Use TypeScript and keep ESLint and TypeScript checks free of errors.
- Keep route components focused on presentation and interaction; place PokeAPI access, SQLite persistence, and game rules in separate modules.
- TanStack Query owns remote/server data. SQLite owns persistent player data. Do not duplicate those responsibilities in component state.
- Every screen data load has explicit loading and error states, with a retry path for recoverable failures.
- Keep layout touch-friendly, responsive, and usable on iOS, Android, and web.
- Keep the implementation compatible with the Expo SDK declared in `package.json`; check that SDK's versioned documentation before using Expo or React Native APIs.
