export type MovePatternSize = 1 | 2 | 3;

export interface PokemonMove {
  name: string;
  type: string;
  power: number;
  patternSize: MovePatternSize;
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
    defense: number;
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
  activeSlot: number;
  opponentId: number;
  opponentLevel: number;
  opponentIsAreaBoss: boolean;
  opponentCells: boolean[];
  encounterComplete: boolean;
  areaId: string;
  areaNumber: number;
  encounterIndex: number;
  usedSpecialBossIds: number[];
  money: number;
  shopProgress: number;
  inventory: Inventory;
  party: PartyMember[];
}

export type BallType = 'pokeBall' | 'greatBall' | 'ultraBall';
export type HealingItem = 'potion' | 'revive';
