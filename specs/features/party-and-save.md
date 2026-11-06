# Feature: Party, navigation, and save data

- Provide separate Expo Router battle, party, and bag screens in the bottom navigation.
- Seed a new local save with a starter Pokémon, a raid-boss encounter, and initial bag items.
- Persist the party (including individual party slots, current/max HP, level, and up to four currently equipped moves per Pokémon), active party slot, inventory, boss grid, and encounter completion in SQLite.
- Persist pending level-up move unlocks and the opponent's selected move pool so app restarts do not discard pending choices or reroll a saved encounter.
- Restore saved progress after closing and reopening the app. A failed database load must show an error with a retry action rather than silently starting a new save.
- Allow the player to choose a party member and confirm a switch. Show that member's HP and up to four move previews.
- A party can hold up to six Pokémon. Do not lose a successful catch when the party is full; report the capacity issue and keep the encounter outcome explicit.
