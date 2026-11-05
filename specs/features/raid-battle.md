# Feature: Raid battle

## Battle screen

- Show the player's active Pokémon on the left and the raid boss on the right, facing one another.
- Represent boss health as a grid of breakable blocks. Grid dimensions vary with the boss's HP, Defense, and Special Defense; do not show a numeric boss health bar as its primary health display.
- Show the player's current and maximum HP using a regular health bar.
- Show exactly four moves for the active Pokémon. A move has a name, type, power, and a preview of its attack pattern.
- Tapping a move selects it and shows its attack pattern in a tooltip above that move. The player can drag the move to a target grid cell, or tap a target cell after selecting the move. Do not preview the pattern on the boss grid.
- Apply the pattern to the grid, removing blocks covered by it. Attack patterns may use varied shapes and may not exceed 5×5 cells.
- Determine attack size from the attacking Pokémon's Attack or Special Attack stat, as appropriate for that Pokémon. Determine the pattern shape from move power. The exact mapping is undecided and must not be hard-coded as a balance rule without direction.
- After a player attack that does not defeat or catch the boss, the boss responds with one of its PokeAPI moves and damages the active Pokémon.
- When all boss blocks are removed, mark the boss defeated and stop further attacks.

## Status effects

- Moves may designate some of their pattern cells to apply a status effect; show those cells and the effect in the move preview before the attack.
- A tile with an active status effect is considered broken and does not count toward the boss's remaining HP.
- Burn and Poison are damage-based effects that can spread to nearby tiles. Freeze, Paralysis, and Sleep are stalling effects that can cause the opponent to skip a turn and cannot spread.
- For an affected tile, the specified outcomes are: 30% chance to do nothing, 30% chance to spread to one adjacent tile, and 30% chance to disappear. Do not let presentation or animation reroll gameplay outcomes.
- The specified outcome chances total 90%; define the remaining 10% outcome before implementation rather than assigning it implicitly.
- Keep status-effect rules and randomness in shared battle logic, separate from presentation.

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
