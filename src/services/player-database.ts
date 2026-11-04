import * as SQLite from 'expo-sqlite';

import type { HealingItem, Inventory, PartyMember, PlayerProfile } from '@/types/game';

const DATABASE_NAME = 'pokemon-raid-battler.db';
const STARTER_POKEMON_ID = 1;
const DEFAULT_BOSS_ID = 143;

interface SaveRow {
  active_slot: number;
  opponent_id: number;
  opponent_cells: string;
  encounter_complete: number;
  poke_balls: number;
  great_balls: number;
  ultra_balls: number;
  potions: number;
  revives: number;
}

interface PartyRow {
  slot: number;
  pokemon_id: number;
  current_hp: number;
  max_hp: number;
  level: number;
}

function parseCells(value: string): boolean[] {
  const parsed: unknown = JSON.parse(value);
  if (!Array.isArray(parsed) || !parsed.every((cell) => typeof cell === 'boolean')) {
    throw new Error('The saved boss grid is invalid. The save could not be loaded.');
  }
  return parsed;
}

function toProfile(save: SaveRow, party: PartyRow[]): PlayerProfile {
  return {
    activeSlot: save.active_slot,
    opponentId: save.opponent_id,
    opponentCells: parseCells(save.opponent_cells),
    encounterComplete: Boolean(save.encounter_complete),
    inventory: {
      pokeBall: save.poke_balls,
      greatBall: save.great_balls,
      ultraBall: save.ultra_balls,
      potion: save.potions,
      revive: save.revives,
    },
    party: party.map((member) => ({
      slot: member.slot,
      pokemonId: member.pokemon_id,
      currentHp: member.current_hp,
      maxHp: member.max_hp,
      level: member.level,
    })),
  };
}

export async function openPlayerDatabase(): Promise<{
  database: SQLite.SQLiteDatabase;
  profile: PlayerProfile;
}> {
  const database = await SQLite.openDatabaseAsync(DATABASE_NAME);
  await database.execAsync(`
    CREATE TABLE IF NOT EXISTS player_save (
      id INTEGER PRIMARY KEY NOT NULL CHECK (id = 1),
      active_slot INTEGER NOT NULL,
      opponent_id INTEGER NOT NULL,
      opponent_cells TEXT NOT NULL,
      encounter_complete INTEGER NOT NULL,
      poke_balls INTEGER NOT NULL,
      great_balls INTEGER NOT NULL,
      ultra_balls INTEGER NOT NULL,
      potions INTEGER NOT NULL,
      revives INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS party_member (
      slot INTEGER PRIMARY KEY NOT NULL,
      pokemon_id INTEGER NOT NULL,
      current_hp INTEGER NOT NULL,
      max_hp INTEGER NOT NULL,
      level INTEGER NOT NULL
    );
  `);
  await database.runAsync(
    `INSERT OR IGNORE INTO player_save
      (id, active_slot, opponent_id, opponent_cells, encounter_complete, poke_balls,
       great_balls, ultra_balls, potions, revives)
      VALUES (1, 0, ?, '[]', 0, 5, 2, 1, 3, 1)`,
    DEFAULT_BOSS_ID
  );
  await database.runAsync(
    `INSERT OR IGNORE INTO party_member (slot, pokemon_id, current_hp, max_hp, level)
     VALUES (0, ?, 100, 100, 5)`,
    STARTER_POKEMON_ID
  );

  const save = await database.getFirstAsync<SaveRow>('SELECT * FROM player_save WHERE id = 1');
  if (!save) {
    throw new Error('The player save could not be initialized.');
  }
  const party = await database.getAllAsync<PartyRow>(
    'SELECT * FROM party_member ORDER BY slot'
  );
  return { database, profile: toProfile(save, party) };
}

export async function persistPlayerProfile(
  database: SQLite.SQLiteDatabase,
  profile: PlayerProfile
): Promise<void> {
  await database.withTransactionAsync(async () => {
    await database.runAsync(
      `UPDATE player_save SET active_slot = ?, opponent_id = ?, opponent_cells = ?,
       encounter_complete = ?, poke_balls = ?, great_balls = ?, ultra_balls = ?,
       potions = ?, revives = ? WHERE id = 1`,
      profile.activeSlot,
      profile.opponentId,
      JSON.stringify(profile.opponentCells),
      Number(profile.encounterComplete),
      profile.inventory.pokeBall,
      profile.inventory.greatBall,
      profile.inventory.ultraBall,
      profile.inventory.potion,
      profile.inventory.revive
    );
    await database.runAsync('DELETE FROM party_member');
    for (const member of profile.party) {
      await database.runAsync(
        `INSERT INTO party_member (slot, pokemon_id, current_hp, max_hp, level)
         VALUES (?, ?, ?, ?, ?)`,
        member.slot,
        member.pokemonId,
        member.currentHp,
        member.maxHp,
        member.level
      );
    }
  });
}

export function consumeBall(inventory: Inventory, ball: keyof Pick<
  Inventory,
  'pokeBall' | 'greatBall' | 'ultraBall'
>): Inventory {
  if (inventory[ball] <= 0) {
    throw new Error('You are out of that kind of Poké Ball.');
  }
  return { ...inventory, [ball]: inventory[ball] - 1 };
}

export function applyHealingItem(
  member: PartyMember,
  inventory: Inventory,
  item: HealingItem
): { member: PartyMember; inventory: Inventory } {
  if (item === 'potion') {
    if (inventory.potion <= 0) throw new Error('You are out of Potions.');
    if (member.currentHp <= 0) throw new Error('Use a Revive on a fainted Pokémon.');
    if (member.currentHp >= member.maxHp) throw new Error('That Pokémon already has full HP.');
    return {
      member: { ...member, currentHp: Math.min(member.maxHp, member.currentHp + 30) },
      inventory: { ...inventory, potion: inventory.potion - 1 },
    };
  }
  if (inventory.revive <= 0) throw new Error('You are out of Revives.');
  if (member.currentHp > 0) throw new Error('Revives can only be used on a fainted Pokémon.');
  return {
    member: { ...member, currentHp: Math.ceil(member.maxHp / 2) },
    inventory: { ...inventory, revive: inventory.revive - 1 },
  };
}
