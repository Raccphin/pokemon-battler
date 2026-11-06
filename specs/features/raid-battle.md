# Feature: Raid battle

## Battle screen

- Show the player's active Pokémon on the left and the raid boss on the right, facing one another.
- Represent boss health as a grid of breakable blocks. Grid dimensions vary with the boss's HP, Defense, and Special Defense; do not show a numeric boss health bar as its primary health display.
- Show the player's current and maximum HP using a regular health bar.
- Show exactly four moves for the active Pokémon. A move has a name, type, power, and a preview of its attack pattern.
- Tapping a move selects it and shows its attack pattern in a tooltip above that move. The player can drag the move to a target grid cell, or tap a target cell after selecting the move. Do not preview the pattern on the boss grid.
- Apply the pattern to the grid, removing blocks covered by it. Attack patterns may use varied shapes and may not exceed 5×5 cells.
- Use the move's PokeAPI accuracy for a hit roll. A miss does not apply the pattern, but the boss still gets its response.
- Determine attack size from the attacking Pokémon's Attack or Special Attack stat, as appropriate for that Pokémon. Determine the pattern shape from move power. The exact mapping is undecided and must not be hard-coded as a balance rule without direction.
- After a player attack that does not defeat or catch the boss, the boss responds with one of its PokeAPI moves and damages the active Pokémon.
- When all boss blocks are removed, mark the boss defeated and stop further attacks.

## Status effects

- Read supported move ailments and their chances from PokeAPI, and show status-applying cells and the effect in the move preview.
- A successfully status-inflicted tile stays intact and counts toward the boss's remaining HP until a later effect breaks it. Show status tiles with an effect-specific color and icon.
- Newly applied or spread Burn/Poison tiles get one opponent response with no effect before spread or disappearance can occur; persist this protection across app restarts.
- Burn, Poison, Freeze, Paralysis, and Sleep behavior, probabilities, and persistence are specified in `specs/features/status-effects.md`.
- Resolve all status effects and random outcomes in shared battle logic before presentation or animation.

## Type-specific boss grid patterns

- Boss HP grid size continues to be derived from HP, Defense, and Special Defense.
- The opponent's type or types may also change the grid layout or apply a type-specific grid rule.
- The per-type rules are not defined. Propose a rule for each type and get user clarification/approval before implementing any of them. Do not infer rules from canonical Pokémon type mechanics.

## Prototype constraints

- Keep grid sizing, pattern sizing, damage, and boss move selection in `src/services/battle-rules.ts`.
- The current grid formula and counterattack selection are prototype defaults, not settled balance or AI behavior.
- Attack-size scaling, move-power-to-pattern mapping, and type-specific grid rules are undecided and must remain unimplemented until specified or approved.
- Do not let animations or haptic feedback decide battle outcomes.
- Persist grid progress and encounter completion in SQLite.
