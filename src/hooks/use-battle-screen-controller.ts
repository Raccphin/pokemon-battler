import { useQueries, useQuery } from '@tanstack/react-query';

import { AREA_PROGRESSION_CONFIG } from '@/services/area-progression';
import { getPlayerMaxHp } from '@/services/battle-rules';
import { getMovePattern } from '@/services/move-patterns';
import { SHOP_CONFIG } from '@/services/shop';
import { fetchPokemon, fetchPokemonMoves } from '@/services/pokeapi';
import type { PlayerProfile, Pokemon } from '@/types/game';

interface BattleScreenControllerOptions {
  profile: PlayerProfile | null;
  selectedUnlockSlot: number | null;
  selectedUnlockedMove: string | null;
  previewMoveName: string | null;
  evolvePokemon: (
    slot: number,
    targetPokemonId: number,
    maxHp: number,
    minimumLevel: number,
    source: 'level-up' | 'shop'
  ) => Promise<void>;
}

export function useBattleScreenController({
  profile,
  selectedUnlockSlot,
  selectedUnlockedMove,
  previewMoveName,
  evolvePokemon,
}: BattleScreenControllerOptions) {
  const partyPokemonQueries = useQueries({
    queries:
      profile?.party.map((member) => ({
        queryKey: ['pokemon', member.pokemonId, member.moves],
        queryFn: () => fetchPokemon(member.pokemonId, member.moves),
        enabled: Boolean(profile.pendingCatch || profile.pendingMoveUnlocks.length),
      })) ?? [],
  });
  const partyMembers =
    profile?.party.map((member, index) => ({
      ...member,
      pokemon: partyPokemonQueries[index]?.data,
      pokemonError: partyPokemonQueries[index]?.error,
    })) ?? [];
  const activeMember = profile?.party.find((member) => member.slot === profile.activeSlot);
  const selectedUnlock =
    profile?.pendingMoveUnlocks.find((unlock) => unlock.slot === selectedUnlockSlot) ??
    profile?.pendingMoveUnlocks[0];
  const unlockMember = selectedUnlock
    ? profile?.party.find(
        (member) =>
          member.slot === selectedUnlock.slot && member.pokemonId === selectedUnlock.pokemonId
      )
    : undefined;
  const unlockMemberIndex = unlockMember
    ? profile?.party.findIndex((member) => member.slot === unlockMember.slot) ?? -1
    : -1;
  const unlockPokemon = partyPokemonQueries[unlockMemberIndex]?.data;
  const movePreviewNames = [
    ...new Set([
      ...(unlockMember?.moves ?? []),
      ...(selectedUnlock?.moves ?? []),
    ]),
  ].sort();
  const movePreviewQuery = useQuery({
    queryKey: ['pokemon-moves', movePreviewNames],
    queryFn: () => fetchPokemonMoves(movePreviewNames),
    enabled: movePreviewNames.length > 0,
  });
  const moveUnlockMembers =
    profile?.pendingMoveUnlocks.map((unlock) => ({
      unlock,
      member: profile.party.find(
        (candidate) =>
          candidate.slot === unlock.slot && candidate.pokemonId === unlock.pokemonId
      ),
      pokemon:
        partyPokemonQueries[
          profile.party.findIndex((candidate) => candidate.slot === unlock.slot)
        ]?.data,
    })) ?? [];
  const pendingEvolution = profile?.pendingEvolutions.find(
    (evolution) => !evolution.prompted
  );
  const evolutionPokemonQueries = useQueries({
    queries:
      pendingEvolution?.options.map((option) => ({
        queryKey: ['pokemon', option.pokemonId, []],
        queryFn: () => fetchPokemon(option.pokemonId),
      })) ?? [],
  });
  const evolutionOptions =
    pendingEvolution?.options.map((option, index) => ({
      option,
      pokemon: evolutionPokemonQueries[index]?.data,
      isPending: evolutionPokemonQueries[index]?.isPending ?? false,
    })) ?? [];
  const activePreviewMoveName = selectedUnlockedMove ?? previewMoveName;
  const previewMove = movePreviewQuery.data?.find(
    (move) => move.name === activePreviewMoveName
  );
  const previewPattern =
    previewMove && unlockPokemon && unlockMember
      ? getMovePattern(previewMove, unlockPokemon.stats, getMovePatternContext(unlockMember))
      : null;
  const encounterNumber = (profile?.encounterIndex ?? 0) + 1;
  const areaProgress =
    (encounterNumber / AREA_PROGRESSION_CONFIG.encountersPerArea) * 100;
  const shopDue = Boolean(
    profile &&
      profile.encounterComplete &&
      !profile.pendingCatch &&
      profile.shopProgress >= SHOP_CONFIG.encountersPerShop
  );
  const shopProgressReached = Boolean(
    profile && profile.shopProgress >= SHOP_CONFIG.encountersPerShop
  );

  function getMovePreview(moveName: string, pokemon?: Pokemon, member = unlockMember) {
    const move = movePreviewQuery.data?.find((candidate) => candidate.name === moveName);
    const subjectPokemon = pokemon ?? unlockPokemon;
    if (!move || !subjectPokemon || !member) return null;
    return {
      move,
      pattern: getMovePattern(move, subjectPokemon.stats, getMovePatternContext(member)),
    };
  }

  function retryPartyPokemon() {
    void Promise.all(partyPokemonQueries.map((query) => query.refetch()));
  }

  function retryEvolutionPokemon() {
    void Promise.all(evolutionPokemonQueries.map((query) => query.refetch()));
  }

  function retryMovePreviews() {
    void movePreviewQuery.refetch();
  }

  return {
    activeMember,
    selectedUnlock,
    unlockMember,
    unlockPokemon,
    partyMembers,
    moveUnlockMembers,
    partyPokemonQueryError: partyPokemonQueries.find((query) => query.error)?.error,
    partyPokemonQueryLoading: partyPokemonQueries.some((query) => query.isPending),
    retryPartyPokemon,
    movePreviewNames,
    movePreviewError: movePreviewQuery.error,
    movePreviewLoading: movePreviewQuery.isPending,
    getMovePreview,
    retryMovePreviews,
    previewMove,
    previewPattern,
    pendingEvolution,
    evolutionOptions,
    evolutionPokemonError: evolutionPokemonQueries.some((query) => query.error),
    retryEvolutionPokemon,
    encounterNumber,
    encountersPerArea: AREA_PROGRESSION_CONFIG.encountersPerArea,
    areaProgress,
    shopDue,
    shopProgressReached,
    async evolveFromBaseHp(
      slot: number,
      targetPokemonId: number,
      baseHp: number,
      minimumLevel: number
    ) {
      return evolvePokemon(
        slot,
        targetPokemonId,
        getPlayerMaxHp(baseHp),
        minimumLevel,
        'level-up'
      );
    },
  };
}

function getMovePatternContext(member: {
  level: number;
  currentHp: number;
  maxHp: number;
  lastPhysicalDamageTaken: number;
}) {
  return {
    level: member.level,
    currentHp: member.currentHp,
    maxHp: member.maxHp,
    lastPhysicalDamageTaken: member.lastPhysicalDamageTaken,
  };
}
