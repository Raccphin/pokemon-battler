# Feature: Shop and encounter rewards

- Award the player money for completing encounters.
- After every few encounters, pause progression and enter a shop.
- Let the player heal Pokémon and purchase items in the shop.
- Persist money, purchases, inventory changes, healing, and shop/run progress in SQLite. Validate affordability and item availability before applying changes.
- Keep prices, reward amounts, shop cadence, and available stock as tunable design decisions; their exact values are not defined by this feature.
