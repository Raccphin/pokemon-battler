# Feature: Pokémon data and sprites

- Fetch Pokémon species, base stats, types, move names/power/types, accuracy, damage class, maximum hit count, level-up and machine learnsets, and capture rate from PokeAPI.
- Use level-up moves from the latest available PokeAPI mainline game version group for each Pokémon, excluding side games and retro re-releases even if their numeric group ID is higher. Keep learned-at-level and learn-method data so player and opponent move sets can be filtered by level.
- Use TanStack Query for all remote Pokémon data, with useful loading, error, and retry UI.
- Cache requests by Pokédex ID so the battle and party screens share data.
- Prefer `assets/images/sprites/{id padded}.{png|jpg}` when that image exists. The local sprite is a right-facing image; mirror the opponent sprite on the right side of the battle arena.
- Fall back to the official-artwork sprite URL returned by PokeAPI if the local image is missing or fails to load.
- Pokémon may have fewer than four eligible moves. Do not assume every Pokémon has four damaging moves or a non-null power. Only use null-power damaging moves with individually approved pattern-power overrides; do not infer numeric power by parsing effect descriptions.
- Show a visible placeholder if neither a local nor remote sprite can be displayed.

## Asset overhaul

- Replace placeholder or otherwise unsuitable in-game art with actual Pokémon and game artwork.
- Convert animation sheets used for individual Pokémon or game images into singular-frame assets suitable for the relevant UI.
- Keep static asset selection and rendering separate from animation behavior. Do not assume new asset paths or that assets exist until they are added.
- Use local Pokémon sprites from `assets/images/sprites/` when available and retain the PokeAPI artwork fallback for missing Pokémon art.
- Confirm asset provenance and usage rights before including externally sourced artwork.
