# Feature: Shop and encounter rewards

- Award the player money for completing encounters.
- After the configured number of encounters, automatically pause progression and open the shop.
- Let the player heal Pokémon and purchase items in the shop. Purchases are limited by affordability; there is no stock count.
- Require a continue action in the shop to advance to the next encounter. Persist money, purchases, inventory changes, healing, and shop/run progress in SQLite.
- Keep the shop continue action visible in a fixed footer while the player scrolls through available items.
- Keep prices, reward amounts, and shop cadence as tunable design decisions; their exact values are not defined by this feature.
