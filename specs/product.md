# Product: Pokémon Raid Battler

## What the app is

A mobile-first Pokémon battle game with original raid-boss mechanics. It uses Pokémon and move data from [PokeAPI](https://pokeapi.co/), but does not aim to reproduce the official Pokémon battle system.

The player fights a raid boss by removing blocks from its health grid. The player has a conventional health bar, a party, a bag, and a persistent local save.

## Core experience

1. See the player's Pokémon on the left and the raid boss on the right, facing each other.
2. Select one of the player's equipped moves (up to four) to see its pattern in a tooltip above the move; drag it onto a grid cell or tap a target cell after selecting to attack.
3. After a successful player attack, the boss uses one of its moves and damages the active Pokémon's regular health bar. The boss faints when all of its grid blocks are removed.
4. Open the bag to heal or revive a selected party member, or use a Poké Ball to try to catch the boss.
5. Switch the active Pokémon from the party screen and preview each party member's moves.
6. As the party levels up, review newly unlocked moves and optionally replace equipped moves. Spend money in the shop to learn other eligible level-up moves.

## Product requirements

- Use Expo Router for distinct battle, party, and bag screens in the bottom navigation.
- Use TanStack Query for PokeAPI requests, caching, loading, error, and retry states.
- Use a local SQLite database for player progress so a later app launch restores the party, active Pokémon, inventory, and battle state.
- Keep presentation, API/database access, and battle rules in separate modules.
- Show an explicit loading state and a recoverable error state for each screen's data load.
- Provide haptic rumble on damage dealt, damage received, and each catch wobble.
- Prefer local Pokémon sprites in `assets/images/sprites/`, named with the zero-padded Pokédex ID and a `.png` or `.jpg` extension (for example `0001.png`). Flip the opponent's right-facing sprite so the Pokémon face each other. Use PokeAPI artwork as a fallback when a local sprite is not available.

## Current prototype rules

Some balancing and raid-boss behavior are undecided. The first playable prototype uses a clearly isolated, deterministic counterattack rule and a tunable HP/Defense-to-grid formula. Keep these rules in the battle-logic module; do not treat them as final design decisions.

See [features/](./features/) for behavior and implementation requirements by feature.
