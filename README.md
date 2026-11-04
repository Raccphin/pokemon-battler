# Pokémon Raid Battler

A mobile-first Pokémon battle game with original raid-boss mechanics. Pokémon species and move data come from [PokeAPI](https://pokeapi.co/); the opponent's health is a breakable grid, while the player's Pokémon use a regular HP bar.

## Run locally

```bash
npm install
npx expo start
```

Use the Expo Go app or a development build to open the project. The first launch initializes a local SQLite save with Bulbasaur, a Snorlax encounter, and starter bag items. Internet access is needed to load Pokémon data; the save itself is stored locally.

## Checks

```bash
npm run lint
npx tsc --noEmit
```

## Project layout

- `src/app/` — Expo Router battle and party screens.
- `src/components/` — reusable presentation and touch interactions.
- `src/hooks/` — screen controllers and query orchestration.
- `src/services/` — PokeAPI, SQLite persistence, haptics, and battle rules.
- `src/providers/` — TanStack Query and player-save state.
- `specs/product.md` — product overview; `specs/features/` contains feature requirements.

Pokémon sprites belong in `assets/images/sprites/` as `{zero-padded-id}.png` or `.jpg`. Metro scans that folder and generates static asset imports when it loads. The app uses a matching local sprite when present and falls back to the official artwork URL from PokeAPI.

The raid grid formula and boss counterattack behavior are prototype rules, isolated in `src/services/battle-rules.ts` until game balance and boss AI are decided.
