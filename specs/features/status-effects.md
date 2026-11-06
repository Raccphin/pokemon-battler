# Feature: Status effects

- Read move ailments and ailment chances from PokeAPI. Support Burn, Poison, Freeze, Paralysis, and Sleep; ignore other ailments.
- Use PokeAPI move accuracy for one hit roll per move; a miss applies neither the attack pattern nor its status, and the opponent still gets its response. Treat a null accuracy as 100%.
- After a move hits, make one ailment-chance roll for the move. When it succeeds, apply the recognized ailment to every intact tile in its pattern and leave all those tiles intact. When it fails, the move damages every intact tile in its pattern normally. When PokeAPI reports zero ailment chance for a status-class move, apply its ailment to every intact pattern tile on hit. Moves without a supported ailment do not apply a status.
- Show the combined move status chance (accuracy multiplied by ailment chance) in the move preview.
- When a move successfully applies a status to an intact tile, keep that tile visible and do not remove it as part of the move's pattern damage. Status-marked tiles no longer count toward opponent grid HP. Keep them visible using a status-specific tile color and the matching icon from `assets/images/statusicons/`.
- On the first opponent response after Burn or Poison is applied or spread to a tile, leave that tile unchanged. On each subsequent opponent response, each intact Burn or Poison tile independently has a one-third chance to remain unchanged, a one-third chance to spread to one randomly selected orthogonally adjacent intact HP tile (which is broken and marked with the same status), and a one-third chance to disappear and break its own tile.
- If a Burn or Poison spread roll has no adjacent intact HP tile available, keep the source tile unchanged; do not reroll.
- Intact Freeze, Paralysis, and Sleep tiles do not spread and persist for the encounter. Each contributes an independent one-third chance for the opponent to skip its response; with `n` such tiles, the combined chance is `1 - (2/3)^n`.
- Resolve all status rolls and grid changes in shared battle logic before presentation or haptics. Persist status tiles and their first-response protection with grid progress so they survive app restarts.
