import { useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { useBattleController } from '@/hooks/use-battle-controller';
import { usePlayer } from '@/providers/player-provider';
import {
  getPlayerMaxHp,
} from '@/services/battle-rules';
import {
  MOVE_LEARNING_PRICE,
  SHOP_CONFIG,
  getShopItemLabel,
} from '@/services/shop';
import {
  fetchPokemon,
  fetchPokemonEvolutions,
  fetchPokemonShopMoves,
} from '@/services/pokeapi';
import { getMovePattern } from '@/services/move-patterns';
import type { ShopItemKey } from '@/types/game';

const SHOP_ITEMS: ShopItemKey[] = [
  'potion',
  'revive',
  'pokeBall',
  'greatBall',
  'ultraBall',
];

export function useShopController() {
  const {
    state,
    operationError,
    retry,
    purchaseItem,
    learnMove,
    evolvePokemon,
    debugWipeSaveData,
  } = usePlayer();
  const queryClient = useQueryClient();
  const battle = useBattleController();
  const [selectedSlot, setSelectedSlot] = useState<number | null>(null);
  const [selectedMove, setSelectedMove] = useState<string | null>(null);
  const [replacedMove, setReplacedMove] = useState<string | null>(null);
  const [confirmMovePurchase, setConfirmMovePurchase] = useState(false);
  const [learning, setLearning] = useState(false);
  const [learningError, setLearningError] = useState<string | null>(null);
  const [purchaseError, setPurchaseError] = useState<string | null>(null);
  const [evolvingOption, setEvolvingOption] = useState<string | null>(null);
  const [evolutionError, setEvolutionError] = useState<string | null>(null);
  const profile = state.status === 'ready' ? state.profile : null;
  const selectedMember =
    profile?.party.find((member) => member.slot === selectedSlot) ??
    profile?.party[0];
  const partyPokemonQueries = useQueries({
    queries:
      profile?.party.map((member) => ({
        queryKey: ['pokemon', member.pokemonId, member.moves],
        queryFn: () => fetchPokemon(member.pokemonId, member.moves),
      })) ?? [],
  });
  const partyEvolutionQueries = useQueries({
    queries:
      profile?.party.map((member) => ({
        queryKey: ['pokemon-evolutions', member.pokemonId],
        queryFn: () => fetchPokemonEvolutions(member.pokemonId),
      })) ?? [],
  });
  const learnsetQuery = useQuery({
    queryKey: ['pokemon-shop-moves', selectedMember?.pokemonId, selectedMember?.level],
    queryFn: () => {
      if (!selectedMember) throw new Error('Choose a Pokémon first.');
      return fetchPokemonShopMoves(selectedMember.pokemonId, selectedMember.level);
    },
    enabled: selectedMember !== undefined,
  });
  const selectedMemberIndex = selectedMember
    ? profile?.party.findIndex((member) => member.slot === selectedMember.slot) ?? -1
    : -1;
  const selectedPokemon = partyPokemonQueries[selectedMemberIndex]?.data;
  const partyMembers =
    profile?.party.map((member, index) => ({
      ...member,
      pokemon: partyPokemonQueries[index]?.data,
    })) ?? [];
  const evolutionChoices =
    profile?.party.flatMap((member, index) => {
      const savedOffer = profile.pendingEvolutions.find(
        (evolution) =>
          evolution.slot === member.slot && evolution.pokemonId === member.pokemonId
      );
      const availableOptions =
        partyEvolutionQueries[index]?.data?.filter(
          (option) => option.minimumLevel <= member.level
        ) ?? [];
      const options = [
        ...(savedOffer?.options ?? []),
        ...availableOptions.filter(
          (option) =>
            !savedOffer?.options.some(
              (savedOption) => savedOption.pokemonId === option.pokemonId
            )
        ),
      ];
      return options.length > 0
        ? [{ member, options, pokemon: partyPokemonQueries[index]?.data }]
        : [];
    }) ?? [];
  const evolutionDataError = partyEvolutionQueries.some((query) => query.error);
  const learnableMoves =
    learnsetQuery.data?.filter((move) => !selectedMember?.moves.includes(move.name)) ?? [];
  const previewMove = learnsetQuery.data?.find((move) => move.name === selectedMove);
  const previewPattern =
    previewMove && selectedPokemon && selectedMember
      ? getMovePattern(previewMove, selectedPokemon.stats, {
          level: selectedMember.level,
          currentHp: selectedMember.currentHp,
          maxHp: selectedMember.maxHp,
          lastPhysicalDamageTaken: selectedMember.lastPhysicalDamageTaken,
        })
      : null;
  const shopDue = Boolean(
    profile &&
      profile.encounterComplete &&
      profile.shopProgress >= SHOP_CONFIG.encountersPerShop
  );
  const shopItems = SHOP_ITEMS.map((key) => ({
    key,
    price: SHOP_CONFIG.prices[key],
    label: getShopItemLabel(key),
    canAfford: Boolean(profile && profile.money >= SHOP_CONFIG.prices[key]),
  }));
  const partyPokemonError = partyPokemonQueries.some((query) => query.error);
  const partyEvolutionLoading = partyEvolutionQueries.some((query) => query.isPending);
  const canAffordMoveLearning = Boolean(
    profile && profile.money >= MOVE_LEARNING_PRICE
  );
  const canTeachSelectedMove = Boolean(
    selectedMember &&
      selectedMove &&
      canAffordMoveLearning &&
      (selectedMember.moves.length < 4 || replacedMove) &&
      !learning
  );

  function choosePartyMember(slot: number) {
    setSelectedSlot(slot);
    setSelectedMove(null);
    setReplacedMove(null);
    setLearningError(null);
  }

  function retryPartyPokemon() {
    void Promise.all(partyPokemonQueries.map((query) => query.refetch()));
  }

  function retryPartyEvolutions() {
    void Promise.all(partyEvolutionQueries.map((query) => query.refetch()));
  }

  function retryLearnset() {
    void learnsetQuery.refetch();
  }

  async function handlePurchase(item: ShopItemKey) {
    setPurchaseError(null);
    try {
      await purchaseItem(item);
    } catch (error) {
      setPurchaseError(
        error instanceof Error ? error.message : 'The item could not be purchased.'
      );
    }
  }

  async function handleLearnMove() {
    if (!selectedMember || !selectedMove) return;
    setLearning(true);
    setLearningError(null);
    try {
      await learnMove(
        selectedMember.slot,
        selectedMove,
        selectedMember.moves.length >= 4 ? replacedMove : null,
        'shop'
      );
      setSelectedMove(null);
      setReplacedMove(null);
      setConfirmMovePurchase(false);
    } catch (error) {
      setLearningError(
        error instanceof Error ? error.message : 'The move could not be learned.'
      );
    } finally {
      setLearning(false);
    }
  }

  async function handleEvolution(slot: number, pokemonId: number, minimumLevel: number) {
    const key = `${slot}:${pokemonId}`;
    setEvolvingOption(key);
    setEvolutionError(null);
    try {
      const pokemon = await queryClient.fetchQuery({
        queryKey: ['pokemon', pokemonId, []],
        queryFn: () => fetchPokemon(pokemonId),
      });
      await evolvePokemon(
        slot,
        pokemonId,
        getPlayerMaxHp(pokemon.stats.hp),
        minimumLevel,
        'shop'
      );
    } catch (error) {
      setEvolutionError(
        error instanceof Error ? error.message : 'The Pokémon could not evolve.'
      );
    } finally {
      setEvolvingOption(null);
    }
  }

  return {
    state,
    operationError,
    retry,
    debugWipeSaveData,
    battle,
    selectedMember,
    selectedPokemon,
    partyMembers,
    learnsetData: learnsetQuery.data,
    learnsetLoading: learnsetQuery.isPending,
    learnsetError: learnsetQuery.error,
    retryLearnset,
    evolutionChoices,
    evolutionDataError,
    learnableMoves,
    previewMove,
    previewPattern,
    shopDue,
    shopItems,
    moveLearningPrice: MOVE_LEARNING_PRICE,
    canAffordMoveLearning,
    canTeachSelectedMove,
    encountersPerShop: SHOP_CONFIG.encountersPerShop,
    partyPokemonError,
    partyEvolutionLoading,
    selectedMove,
    setSelectedMove,
    replacedMove,
    setReplacedMove,
    confirmMovePurchase,
    setConfirmMovePurchase,
    learning,
    learningError,
    setLearningError,
    purchaseError,
    evolvingOption,
    evolutionError,
    choosePartyMember,
    retryPartyPokemon,
    retryPartyEvolutions,
    handlePurchase,
    handleLearnMove,
    handleEvolution,
  };
}
