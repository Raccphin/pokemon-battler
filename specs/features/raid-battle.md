# Feature: Raid battle

## Battle screen

- Show the player's active Pokémon on the left and the raid boss on the right, facing one another.
- Represent boss health as a grid of breakable blocks. Grid dimensions vary with the boss's base HP and Defense; do not show a numeric boss health bar as its primary health display.
- Show the player's current and maximum HP using a regular health bar.
- Show exactly four moves for the active Pokémon. A move has a name, type, power, and a square pattern of one to three cells.
- Tapping a move selects it and shows its attack pattern in a tooltip above that move. The player can drag the move to a target grid cell, or tap a target cell after selecting the move. Do not preview the pattern on the boss grid.
- Apply the pattern to the grid, removing blocks covered by it. A move cannot exceed a 3×3 pattern.
- After a player attack that does not defeat or catch the boss, the boss responds with one of its PokeAPI moves and damages the active Pokémon.
- When all boss blocks are removed, mark the boss defeated and stop further attacks.

## Prototype constraints

- Keep grid sizing, pattern sizing, damage, and boss move selection in `src/services/battle-rules.ts`.
- The current grid formula and counterattack selection are prototype defaults, not settled balance or AI behavior.
- Do not let animations or haptic feedback decide battle outcomes.
- Persist grid progress and encounter completion in SQLite.
