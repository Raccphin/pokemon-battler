# Feature: Progression and areas

- Show a progress bar at the top of the screen that communicates the player's current progress through the active area.
- Each area has a defined set of Pokémon types that appear more often. For example, a forest can favor Grass, Fairy, and Bug types.
- End each area with a stronger boss encounter.
- As the player advances through areas, increase the levels of the player's Pokémon and opponents.
- Persist area identity, progress within the area, encounter progress, and relevant run state in SQLite so progress survives app restarts.
- Keep encounter generation and progression rules in shared game logic, not in route components.
- The encounter count or pacing for each area, level scaling, and exact area contents are balance decisions; do not invent fixed formulas without direction.
