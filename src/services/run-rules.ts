import type {
  PartyMember,
  PlayerProfile,
  RunSummary,
} from '@/types/game';

export function isPartyUnableToBattle(party: readonly PartyMember[]): boolean {
  return party.length > 0 && party.every((member) => member.currentHp <= 0);
}

export function createRunSummary(profile: PlayerProfile): RunSummary {
  return {
    areaId: profile.areaId,
    areaNumber: profile.areaNumber,
    encounterIndex: profile.encounterIndex,
    opponentLevel: profile.opponentLevel,
    opponentIsAreaBoss: profile.opponentIsAreaBoss,
    party: profile.party.map((member) => ({ ...member })),
  };
}

export function finishRunIfDefeated(profile: PlayerProfile): PlayerProfile {
  if (profile.runStatus === 'gameOver' || !isPartyUnableToBattle(profile.party)) {
    return profile;
  }
  return {
    ...profile,
    runStatus: 'gameOver',
    runSummary: createRunSummary(profile),
  };
}

export function replacePartyMemberWithCatch(
  party: readonly PartyMember[],
  pendingCatch: Omit<PartyMember, 'slot'> | null,
  slot: number,
): { party: PartyMember[]; pendingCatch: null } {
  if (!pendingCatch) throw new Error('There is no pending Pokémon to add.');
  if (!party.some((member) => member.slot === slot)) {
    throw new Error('That Pokémon is not in your party.');
  }
  return {
    party: party.map((member) =>
      member.slot === slot ? { ...pendingCatch, slot } : member,
    ),
    pendingCatch: null,
  };
}
