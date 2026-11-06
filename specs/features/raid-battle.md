# Feature: Raid battle

## Battle screen

- Show the player's active Pokémon on the left and the raid boss on the right, facing one another.
- Represent boss health as a grid of breakable blocks. Grid dimensions vary with the boss's HP, Defense, and Special Defense; do not show a numeric boss health bar as its primary health display.
- Show the player's current and maximum HP using a regular health bar.
- Show up to four equipped moves for the active Pokémon. A move has a name, type, power, and a preview of its attack pattern.
- Tapping a move selects it and shows its attack pattern in a tooltip above that move. The player can drag the move to a target grid cell, or tap a target cell after selecting the move. Do not preview the pattern on the boss grid.
- Apply the pattern to the grid, removing blocks covered by it. Patterns may be non-square, must be connected by cardinal or diagonal neighbors, and may not exceed a 5×5 bounding box.
- Check PokeAPI accuracy once per move before resolving either a player attack or an opponent response. A null accuracy means the move always hits. A miss deals no damage and applies no grid pattern; it still consumes that move/response, so the opponent responds after a player miss and the player receives no damage after an opponent miss. For multi-hit player moves, a successful single accuracy check applies the pattern using the move's maximum hit count.
- Determine the pattern footprint from the attacking Pokémon's level-adjusted Attack or Special Attack, according to the move's PokeAPI damage class. Status-class moves use a 1×1 footprint.
- Determine the number of cells in the pattern from move power and PokeAPI's maximum hit count, applying the approved null-power overrides below. Do not infer numeric power by parsing effect-description text. Do not offer a null-power damaging move without an approved override.
- Use level-up moves from the latest available PokeAPI mainline game version group for each Pokémon; do not treat a larger numeric version-group ID as newer when it represents a side game or retro re-release. A party member can equip up to four supported moves learned at or below its level; an opponent can use only supported level-up moves learned at or below its encounter level.
- When a party member's level increases from `oldLevel` to `newLevel`, make available its supported level-up moves with `learned_at_level` in `(oldLevel, newLevel]` that it does not already have equipped. Pause before the next encounter and show all newly unlocked moves for the party in one move-learning modal. Show equipped moves above the newly unlocked moves. The player may select an equipped move and an unlocked move to enable a `Replace {old move} with {new move}` action; confirm the replacement in a second dialog that warns it is irreversible. The replaced move is forgotten and can be learned again only by purchasing it at the shop. Fill empty move slots before offering replacements. The player can make multiple replacements in this modal or skip an unlock; a skipped move is not learned for free, but may be purchased later if eligible at the shop.
- Initialize a starter or newly caught Pokémon with up to four supported level-up moves available at its current level, choosing the most recently learned moves. Preserve its equipped moves as it levels up; do not automatically replace them.
- Give each opponent a pool of up to four distinct, uniformly selected supported level-up moves available at its encounter level. Choose and persist the pool once per encounter. On each opponent response, select uniformly from that pool and damage the active Pokémon's regular health bar; opponent moves do not use player grid patterns. If fewer than four eligible moves exist, use only those moves.
- Center the pattern on the selected grid cell; for an even-sized footprint, the selected cell is the upper-left of the four central cells. Clip the pattern at the grid edges without shifting it inward; clipping may disconnect the applied cells.
- After a player attack that does not defeat or catch the boss, the boss responds with one of its PokeAPI moves and damages the active Pokémon.
- When all boss blocks are removed, mark the boss defeated and stop further attacks.
- Once the boss is defeated, show the continue action over the cleared grid instead of below the battle content. If the shop is due, the action continues to the shop.

## Move attack pattern rules

- Read the attacking Pokémon's base stats and level, the move's damage class and power, and the move's maximum hit count from PokeAPI. PokeAPI provides base stats, not level-adjusted stats.
- Calculate a non-HP stat as `floor(2 × baseStat × level / 100) + 5`, using IV 0, EV 0, and a neutral nature. Use Attack for physical moves and Special Attack for special moves. Apply the same tier cutoffs to the calculated stat: below 40 gives a 1×1 footprint; 40–69 gives 2×2; 70–99 gives 3×3; 100–129 gives 4×4; 130 or higher gives 5×5.
- For damaging moves, use `move.power` or an individually approved null-power override. Do not offer a null-power damaging move without an approved override. Multiply the selected power by PokeAPI's `max_hits` (use 1 when it is absent), then calculate the target cell count as `ceil(effectivePower / 10)`, with a minimum of 1 and a maximum equal to the footprint area. This is an approved prototype rule; keep it isolated for future balance changes.
- Generate a deterministic move-identity-specific shape by hashing the move name into a stable candidate order, starting at the selected cell's relative position in the footprint, then repeatedly adding the highest-priority unselected cell adjacent by cardinal or diagonal direction to the existing shape. Prefer additions that keep the shape's bounding box non-square when feasible. Shape generation is connected before grid-edge clipping; clipping does not shift or reconnect the remaining cells.
- Pattern selection and battle outcomes must not depend on animation or random shape selection.
- Check move accuracy once before resolving its effects; a null PokeAPI accuracy is treated as always hitting. This applies to player grid attacks and opponent HP-bar attacks. A successful player check applies the whole pattern, including the `max_hits` multiplier for multi-hit moves; an opponent miss deals no HP damage. Accuracy is independent of the pattern-power override.
- Moves with null power can have different effects in PokeAPI data. The following overrides use PokeAPI structured metadata or effect descriptions as individually reviewed inputs; descriptions must not be parsed as a universal numeric-power formula. “In prototype inventory” means the move appeared among the first four unfiltered PokeAPI moves for at least one of the 1,025 Pokémon IDs in the area-type encounter pool before level-appropriate filtering was specified. That prototype inventory contained 122 distinct moves and these six null-power damaging moves; it does not define availability under the level-appropriate learnset rules above.

| Move | Approved pattern-power override | In prototype inventory |
|---|---|---|
| Counter | Twice the HP damage actually lost from the most recent opposing physical move. If no qualifying physical hit has been recorded, Counter fails without changing the grid; the boss still responds. | Yes |
| Flail | Let `x = floor(64 × current HP / maximum HP)`: `x` 0–1 → 200; 2–5 → 150; 6–12 → 100; 13–21 → 80; 22–42 → 40; 43–64 → 20. | Yes |
| Guillotine | 250 for OHKO-category moves. | Yes |
| Horn Drill | 250 for OHKO-category moves. | Yes |
| Night Shade | The user's level. | Yes |
| Sonic Boom | 20. | Yes |
| Seismic Toss | The user's level. | No |
| Dragon Rage | 40. | No |
| Super Fang | 50. | No |
| Psywave | The user's level, as the deterministic midpoint of its level-based range. | No |
| Gyro Ball | 20 until an individually reviewed override is approved. | No |
| Fissure | 250 as an OHKO-category move. | No |

- Apply pattern power 250 to every null-power move whose PokeAPI `meta.category` is OHKO, including moves not currently in the pool. Check each move's PokeAPI accuracy normally; for example, Guillotine and Horn Drill have 30 accuracy.
- Sonic Boom, Night Shade, Counter, and Flail have 90, 100, 100, and 100 PokeAPI accuracy respectively. The move's accuracy check still applies to every override; a miss makes no grid changes, and the boss still responds.
- Moves with null power and status damage class use a 1×1 footprint. Do not offer any other null-power damaging move until it has an approved override. Skip unsupported moves when building a player's available move choices or an opponent's move pool; a Pokémon may have fewer than four supported moves.

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
- The level-adjusted stat formula, footprint thresholds, accuracy behavior, multi-hit handling, null-power overrides, level-up move learning, opponent move-pool selection, power-to-cell formula, deterministic shape generation, even-footprint alignment, and edge clipping are specified above.
- Type-specific grid rules remain undecided and must not be implemented until separately specified and approved.
- Do not let animations or haptic feedback decide battle outcomes.
- Persist grid progress and encounter completion in SQLite.
