# Implementation explanation

## 1. Product choices in the code

- **Expo Router screens:** the root stack is in `src/app/_layout.tsx`; Battle, Party, and Bag tabs are in `src/components/app-tabs.tsx`.
- **PokeAPI and TanStack Query:** caching and retry defaults are in `src/providers/query-provider.tsx` (lines 4–17). Network parsing is in `src/services/pokeapi.ts` (lines 117–122) and `fetchPokemon` in `src/services/pokeapi.ts` (lines 337–359). Battle queries are in `src/hooks/use-battle-controller.ts` (lines 96–126).
- **SQLite save:** schema setup and profile loading are in `src/services/player-database.ts` (lines 382–417 and 490–510). Startup loads the profile in `src/providers/player-provider.tsx` (lines 113–132).
- **Separated layers and recoverable screen states:** API access is in `src/services/pokeapi.ts` (lines 99–117), persistence in `src/services/player-database.ts` (lines 382–417), battle rules in `src/services/battle-rules.ts` (lines 1–10), and presentation in `src/app/(tabs)/index.tsx` (lines 1–17). Loading/error/retry states appear in Battle (`src/app/(tabs)/index.tsx`, lines 115–176), Party (`src/app/(tabs)/party.tsx`, lines 18–55), and Bag (`src/app/(tabs)/bag.tsx`, lines 55–70).
- **Haptics and sprites:** damage feedback calls `rumble` in `src/hooks/use-battle-controller.ts` (lines 369–406), and each catch wobble does so in `src/hooks/use-battle-controller.ts` (lines 461–467). The haptic implementation is in `src/services/haptics.ts` (lines 1–7). `src/components/pokemon-sprite.tsx` (lines 14–43) uses registered local art first, then the PokeAPI URL; it mirrors the opponent in `src/components/pokemon-sprite.tsx` (lines 55–61). The local registry is currently empty: `src/services/sprite-registry.ts` (lines 1–3).
- **Battle rules:** grid sizing and move resolution are in `src/services/battle-rules.ts` (lines 45–80 and 170–238); grid layouts are in `src/services/opponent-grid-patterns.ts` (lines 25–60).

**What changed:** early grid sizing used a fixed six-column board; commit `08cded9` replaced it with area-, level-, and stat-scaled sizing. The apparent rationale is to scale board capacity with progression and boss bulk, rather than keep a fixed width. One mismatch remains: `specs/product.md` (line 30) calls the counterattack deterministic, but `src/services/battle-rules.ts` (lines 241–255) randomly selects the boss move. I found no recorded rationale for that difference.

## 2. Feature walkthrough: loading the battle

The battle screen uses `useBattleController` in `src/hooks/use-battle-controller.ts` (lines 96–126). TanStack Query calls `fetchPokemon`; `src/services/pokeapi.ts` (lines 337–359) fetches Pokémon, species, and move data and maps it into the app's `Pokemon` shape. The hook exposes pending/error state, and `src/app/(tabs)/index.tsx` (lines 156–176) shows a loading message or an error with retry. Once ready, the same screen renders the opposing sprite and grid (`src/app/(tabs)/index.tsx`, lines 300–367).

## 3. Agent suggestion

The agent suggested making the whole move footprint depend on power (for example, 40 power producing 2×2 and 90 power producing 3×3); see `chat-history/chat.md` (lines 324–326). I changed that after noting Attack/Special Attack should still matter: they set the maximum footprint, while power determines how many cells inside it are hit, capped at 3×3 (`chat-history/chat.md`, lines 332–359; `src/services/move-patterns.ts`, lines 134–163). This preserves stat relevance while letting move power affect coverage; low stats can still cap different-power moves to the same coverage, as the chat notes at `chat-history/chat.md` (line 375).
