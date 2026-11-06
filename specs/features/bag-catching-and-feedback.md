# Feature: Bag, catching, and feedback

## Bag

- Healing items target a selected party member and cannot heal a fainted Pokémon.
- Revives target a selected fainted party member.
- Show party Pokémon by name in the healing-item picker. Keep the selected item and picker open after use so the player can use multiple items; refresh HP and eligibility after each use.
- Validate item availability and target eligibility before consuming an item; persist inventory and HP changes together.
- Provide the bag as a bottom-navigation screen alongside battle and party.
- Selecting a Poké Ball navigates to battle and closes the bag before showing the catch animation.

## Catching

- Catch success is calculated once, before the catch animation, using the boss's PokeAPI capture rate, current grid health, and ball tier.
- The ball animation is visual feedback only. Its random movement and wobble must never reroll or alter the saved result.
- Animate one, two, or three balls for Poké, Great, or Ultra Balls respectively. Provide haptic feedback on every wobble.
- A successful animation ends on an empty boss-grid cell. A failed animation ends on an occupied cell.
- Persist a successful catch to the party and complete the encounter. Do not allow catching when there is no empty grid cell or no available party slot.

## Haptics

- Trigger rumble when the player damages the boss, when the player takes damage, and once for each catch wobble.
- Haptics are optional device feedback; an unavailable haptics API must not block or change a game action.
