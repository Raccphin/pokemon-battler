export type StatusEffect = 'burn' | 'poison' | 'freeze' | 'paralysis' | 'sleep';

export interface PokemonMove {
  name: string;
  type: string;
  power: number | null;
  damageClass: string;
  category: string | null;
  maxHits: number;
  accuracy: number | null;
  statusEffect: StatusEffect | null;
  statusChance: number;
}

export interface MovePatternCell {
  row: number;
  column: number;
}

export interface MovePattern {
  footprintSize: number;
  hitCells: MovePatternCell[];
  effectivePower: number | null;
}

export interface PendingMoveUnlock {
  slot: number;
  pokemonId: number;
  moves: string[];
}

export interface Pokemon {
  id: number;
  name: string;
  types: string[];
  isLegendary: boolean;
  isMythical: boolean;
  stats: {
    hp: number;
    attack: number;
    specialAttack: number;
    defense: number;
    speed: number;
  };
  captureRate: number;
  spriteUrl: string | null;
  moves: PokemonMove[];
}

export interface PartyMember {
  slot: number;
  pokemonId: number;
  currentHp: number;
  maxHp: number;
  level: number;
  moves: string[];
  movesInitialized: boolean;
  lastPhysicalDamageTaken: number;
}

export type RunStatus = 'active' | 'gameOver';

export interface RunSummary {
  areaId: string;
  areaNumber: number;
  encounterIndex: number;
  opponentLevel: number;
  opponentIsAreaBoss: boolean;
  party: PartyMember[];
}

export interface Inventory {
  pokeBall: number;
  greatBall: number;
  ultraBall: number;
  potion: number;
  revive: number;
}

export type ShopItemKey = keyof Inventory;

export interface PlayerProfile {
  starterSelected: boolean;
  activeSlot: number;
  opponentId: number;
  opponentLevel: number;
  opponentIsAreaBoss: boolean;
  opponentCells: boolean[];
  opponentStatuses: (StatusEffect | null)[];
  opponentStatusFresh: boolean[];
  opponentMoves: string[];
  opponentMovesInitialized: boolean;
  pendingMoveUnlocks: PendingMoveUnlock[];
  encounterComplete: boolean;
  areaId: string;
  areaNumber: number;
  encounterIndex: number;
  usedSpecialBossIds: number[];
  money: number;
  shopProgress: number;
  inventory: Inventory;
  party: PartyMember[];
  runStatus: RunStatus;
  runSummary: RunSummary | null;
  pendingCatch: Omit<PartyMember, 'slot'> | null;
}

export type BallType = 'pokeBall' | 'greatBall' | 'ultraBall';
export type HealingItem = 'potion' | 'revive';
