# Feature: Shop and encounter rewards

- Award the player money for completing encounters.
- After the configured number of encounters, automatically pause progression and open the shop.
- Let the player heal Pokémon and purchase items in the shop. Purchases are limited by affordability; there is no stock count.
- Provide a move-learning entry point in the shop. Let the player select a party Pokémon and choose a supported level-up move it can learn at or below its current level, excluding moves it already has equipped.
- Charge a uniform 100 money per learned move. Buying a move fills an empty move slot when available; otherwise require the player to choose an equipped move to replace. The replaced move is forgotten and can be learned again only by purchasing it.
- Require a continue action in the shop to advance to the next encounter. Persist money, purchases, inventory changes, healing, and shop/run progress in SQLite.
- Keep prices, reward amounts, and shop cadence as tunable design decisions; the move-learning price is 100 money, while other prices, reward amounts, and the shop cadence remain undecided.
