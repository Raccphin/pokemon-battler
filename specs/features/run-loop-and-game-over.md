# Feature: Run loop and game over

- A run advances through areas and their encounters, including the stronger boss encounter at the end of each area.
- Increase the levels of both the player's Pokémon and opponents as the player progresses through areas.
- When all Pokémon on the player's team are unable to battle, end the run and show a game-over screen.
- The game-over screen reports how far the player progressed and shows the team used in that run.
- Provide an action to start a new run from the beginning.
- Provide a confirmed debug-menu action to wipe saved run and party data, reset progress and inventory, and return to starter selection. The wipe must also be available when an invalid save prevents the run screen from loading.
- Persist enough run and team state to restore an in-progress run after an app restart, while keeping a completed run's game-over summary available until a new run begins.
- Keep level scaling, run reset, and defeat conditions in shared game logic and persistence services rather than route components.
- Save a game-over snapshot containing the last area, encounter, opponent level, and team so the summary survives app restarts.
- When a successful catch happens with a full party, preserve the result and let the player choose an existing party member to release; persist the pending catch and block run progression until the choice is resolved.
