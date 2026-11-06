# Feature: Party, navigation, and save data

- Provide separate Expo Router battle, party, and bag screens in the bottom navigation.
- Seed a new local save with a starter Pokémon, a raid-boss encounter, and initial bag items.
- Persist the party (including individual party slots, current/max HP, and level), active party slot, inventory, boss grid, and encounter completion in SQLite.
- Restore saved progress after closing and reopening the app. A failed database load must show an error with a retry action rather than silently starting a new save.
- Allow the player to choose a party member and confirm a switch. Show that member's HP and four move previews.
- A party can hold up to six Pokémon. A successful catch with a full party remains pending until the player chooses an existing party member to release; persist the catch so restarting cannot lose or reroll its result.
