# Feature: Status effects

- Some moves apply a status effect to a subset of the move's attack-pattern tiles. The move preview identifies both the affected cells and the status effect.
- A tile with an active status effect is broken and no longer counts toward the opponent's remaining grid HP.
- Burn and Poison are damage-based effects and can spread to nearby tiles.
- Freeze, Paralysis, and Sleep are stalling effects that can cause the opponent to skip a turn and cannot spread.
- The specified tile outcome chances are 30% no effect, 30% spread to one adjacent tile, and 30% disappearance. The unassigned 10% chance must be clarified before implementation.
- Resolve status outcomes in shared battle logic and keep the result fixed before playing any visual feedback.
