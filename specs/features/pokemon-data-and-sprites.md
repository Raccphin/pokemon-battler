# Feature: Pokémon data and sprites

- Fetch Pokémon species, base stats, types, move names/power/types, and capture rate from PokeAPI.
- Use TanStack Query for all remote Pokémon data, with useful loading, error, and retry UI.
- Cache requests by Pokédex ID so the battle and party screens share data.
- Prefer `assets/images/sprites/{id padded}.{png|jpg}` when that image exists. The local sprite is a right-facing image; mirror the opponent sprite on the right side of the battle arena.
- Fall back to the official-artwork sprite URL returned by PokeAPI if the local image is missing or fails to load.
- Do not assume every Pokémon has four damaging moves or a non-null power; normalize missing move power safely.
- Show a visible placeholder if neither a local nor remote sprite can be displayed.
