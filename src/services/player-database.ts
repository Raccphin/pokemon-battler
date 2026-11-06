import * as SQLite from "expo-sqlite";

import { getRandomArea } from "@/services/area-progression";
import type {
  HealingItem,
  Inventory,
  PartyMember,
  PlayerProfile,
  RunStatus,
  RunSummary,
  StatusEffect,
} from "@/types/game";

const DATABASE_NAME = "pokemon-raid-battler.db";

interface SaveRow {
  starter_selected: number;
  active_slot: number;
  opponent_id: number;
  opponent_level: number;
  opponent_is_area_boss: number;
  opponent_cells: string;
  opponent_statuses: string;
  opponent_status_fresh: string;
  encounter_complete: number;
  area_id: string;
  area_number: number;
  encounter_index: number;
  used_special_boss_ids: string;
  money: number;
  shop_progress: number;
  run_status: string;
  run_summary: string;
  pending_catch: string;
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
  if (
    !Array.isArray(parsed) ||
    !parsed.every((cell) => typeof cell === "boolean")
  ) {
    throw new Error(
      "The saved boss grid is invalid. The save could not be loaded.",
    );
  }
  return parsed;
}

function isStatusEffect(value: unknown): value is StatusEffect {
  return (
    value === "burn" ||
    value === "poison" ||
    value === "freeze" ||
    value === "paralysis" ||
    value === "sleep"
  );
}

function parseStatuses(
  value: string,
  cellCount: number,
): (StatusEffect | null)[] {
  const parsed: unknown = JSON.parse(value);
  if (!Array.isArray(parsed)) {
    throw new Error(
      "The saved boss-grid status effects are invalid. The save could not be loaded.",
    );
  }
  if (parsed.length === 0) {
    return Array.from({ length: cellCount }, () => null);
  }
  if (
    parsed.length !== cellCount ||
    !parsed.every((status) => status === null || isStatusEffect(status))
  ) {
    throw new Error(
      "The saved boss-grid status effects are invalid. The save could not be loaded.",
    );
  }
  return parsed.map((status) => (isStatusEffect(status) ? status : null));
}

function parseStatusFresh(value: string, cellCount: number): boolean[] {
  const parsed: unknown = JSON.parse(value);
  if (!Array.isArray(parsed)) {
    throw new Error(
      "The saved boss-grid status timing is invalid. The save could not be loaded.",
    );
  }
  if (parsed.length === 0) {
    return Array.from({ length: cellCount }, () => false);
  }
  if (
    parsed.length !== cellCount ||
    !parsed.every((fresh) => typeof fresh === "boolean")
  ) {
    throw new Error(
      "The saved boss-grid status timing is invalid. The save could not be loaded.",
    );
  }
  return parsed;
}

function parseIds(value: string): number[] {
  const parsed: unknown = JSON.parse(value);
  if (
    !Array.isArray(parsed) ||
    !parsed.every((id) => Number.isInteger(id) && id > 0)
  ) {
    throw new Error(
      "The saved special-boss history is invalid. The save could not be loaded.",
    );
  }
  return parsed;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isPositiveInteger(value: unknown): value is number {
  return Number.isInteger(value) && Number(value) > 0;
}

function isNonNegativeInteger(value: unknown): value is number {
  return Number.isInteger(value) && Number(value) >= 0;
}

function isPartyMember(value: unknown): value is PartyMember {
  return (
    isRecord(value) &&
    isNonNegativeInteger(value.slot) &&
    isPositiveInteger(value.pokemonId) &&
    isNonNegativeInteger(value.currentHp) &&
    isPositiveInteger(value.maxHp) &&
    value.currentHp <= value.maxHp &&
    isPositiveInteger(value.level)
  );
}

function parseRunStatus(value: string): RunStatus {
  if (value === "active" || value === "gameOver") return value;
  throw new Error("The saved run status is invalid. The save could not be loaded.");
}

function parseRunSummary(value: string): RunSummary | null {
  const parsed: unknown = JSON.parse(value);
  if (parsed === null) return null;
  if (!isRecord(parsed)) {
    throw new Error("The saved game-over summary is invalid. The save could not be loaded.");
  }
  const {
    areaId,
    areaNumber,
    encounterIndex,
    opponentLevel,
    opponentIsAreaBoss,
    party,
  } = parsed;
  if (
    typeof areaId !== "string" ||
    areaId.length === 0 ||
    !isPositiveInteger(areaNumber) ||
    !isNonNegativeInteger(encounterIndex) ||
    !isPositiveInteger(opponentLevel) ||
    typeof opponentIsAreaBoss !== "boolean" ||
    !Array.isArray(party) ||
    !party.every(isPartyMember)
  ) {
    throw new Error("The saved game-over summary is invalid. The save could not be loaded.");
  }
  return {
    areaId,
    areaNumber,
    encounterIndex,
    opponentLevel,
    opponentIsAreaBoss,
    party: party.map((member) => ({ ...member })),
  };
}

function parsePendingCatch(value: string): Omit<PartyMember, "slot"> | null {
  const parsed: unknown = JSON.parse(value);
  if (parsed === null) return null;
  if (!isRecord(parsed)) {
    throw new Error("The saved pending catch is invalid. The save could not be loaded.");
  }
  const { pokemonId, currentHp, maxHp, level } = parsed;
  if (
    !isPositiveInteger(pokemonId) ||
    !isNonNegativeInteger(currentHp) ||
    !isPositiveInteger(maxHp) ||
    currentHp > maxHp ||
    !isPositiveInteger(level)
  ) {
    throw new Error("The saved pending catch is invalid. The save could not be loaded.");
  }
  return {
    pokemonId,
    currentHp,
    maxHp,
    level,
  };
}

function toProfile(save: SaveRow, party: PartyRow[]): PlayerProfile {
  const opponentCells = parseCells(save.opponent_cells);
  const runStatus = parseRunStatus(save.run_status);
  const runSummary = parseRunSummary(save.run_summary);
  if ((runStatus === "gameOver") !== (runSummary !== null)) {
    throw new Error("The saved run summary does not match its status. The save could not be loaded.");
  }
  return {
    starterSelected: Boolean(save.starter_selected),
    activeSlot: save.active_slot,
    opponentId: save.opponent_id,
    opponentLevel: save.opponent_level,
    opponentIsAreaBoss: Boolean(save.opponent_is_area_boss),
    opponentCells,
    opponentStatuses: parseStatuses(
      save.opponent_statuses,
      opponentCells.length,
    ),
    opponentStatusFresh: parseStatusFresh(
      save.opponent_status_fresh,
      opponentCells.length,
    ),
    encounterComplete: Boolean(save.encounter_complete),
    areaId: save.area_id,
    areaNumber: save.area_number,
    encounterIndex: save.encounter_index,
    usedSpecialBossIds: parseIds(save.used_special_boss_ids),
    money: save.money,
    shopProgress: save.shop_progress,
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
    runStatus,
    runSummary,
    pendingCatch: parsePendingCatch(save.pending_catch),
  };
}

export async function openPlayerDatabaseConnection(): Promise<SQLite.SQLiteDatabase> {
  const database = await SQLite.openDatabaseAsync(DATABASE_NAME);
  await database.execAsync(`
    CREATE TABLE IF NOT EXISTS player_save (
      id INTEGER PRIMARY KEY NOT NULL CHECK (id = 1),
      starter_selected INTEGER NOT NULL DEFAULT 0,
      active_slot INTEGER NOT NULL,
      opponent_id INTEGER NOT NULL,
      opponent_level INTEGER NOT NULL DEFAULT 1,
      opponent_is_area_boss INTEGER NOT NULL DEFAULT 0,
      opponent_cells TEXT NOT NULL,
      opponent_statuses TEXT NOT NULL DEFAULT '[]',
      opponent_status_fresh TEXT NOT NULL DEFAULT '[]',
      encounter_complete INTEGER NOT NULL,
      area_id TEXT NOT NULL DEFAULT 'forest',
      area_number INTEGER NOT NULL DEFAULT 1,
      encounter_index INTEGER NOT NULL DEFAULT 0,
      used_special_boss_ids TEXT NOT NULL DEFAULT '[]',
      money INTEGER NOT NULL DEFAULT 0,
      shop_progress INTEGER NOT NULL DEFAULT 0,
      run_status TEXT NOT NULL DEFAULT 'active',
      run_summary TEXT NOT NULL DEFAULT 'null',
      pending_catch TEXT NOT NULL DEFAULT 'null',
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
  const columns = await database.getAllAsync<{ name: string }>(
    "PRAGMA table_info(player_save)",
  );
  const columnNames = new Set(columns.map((column) => column.name));
  const migrations: [string, string][] = [
    ["starter_selected", "INTEGER NOT NULL DEFAULT 1"],
    ["opponent_level", "INTEGER NOT NULL DEFAULT 1"],
    ["opponent_is_area_boss", "INTEGER NOT NULL DEFAULT 0"],
    ["opponent_statuses", "TEXT NOT NULL DEFAULT '[]'"],
    ["opponent_status_fresh", "TEXT NOT NULL DEFAULT '[]'"],
    ["area_id", "TEXT NOT NULL DEFAULT 'forest'"],
    ["area_number", "INTEGER NOT NULL DEFAULT 1"],
    ["encounter_index", "INTEGER NOT NULL DEFAULT 0"],
    ["used_special_boss_ids", "TEXT NOT NULL DEFAULT '[]'"],
    ["money", "INTEGER NOT NULL DEFAULT 0"],
    ["shop_progress", "INTEGER NOT NULL DEFAULT 0"],
    ["run_status", "TEXT NOT NULL DEFAULT 'active'"],
    ["run_summary", "TEXT NOT NULL DEFAULT 'null'"],
    ["pending_catch", "TEXT NOT NULL DEFAULT 'null'"],
  ];
  for (const [name, definition] of migrations) {
    if (!columnNames.has(name)) {
      await database.execAsync(
        `ALTER TABLE player_save ADD COLUMN ${name} ${definition}`,
      );
    }
  }
  const initialArea = getRandomArea();
  await database.runAsync(
    `INSERT OR IGNORE INTO player_save
      (id, starter_selected, active_slot, opponent_id, opponent_level, opponent_is_area_boss, opponent_cells,
       opponent_statuses, opponent_status_fresh, encounter_complete, area_id, area_number,
       encounter_index, used_special_boss_ids, money, shop_progress, poke_balls, great_balls,
       ultra_balls, potions, revives)
      VALUES (1, 0, 0, ?, 1, 0, '[]', '[]', '[]', 0, ?, 1, 0, '[]', 0, 0, 5, 2, 1, 3, 1)`,
    initialArea.startingPokemonId,
    initialArea.id,
  );
  return database;
}

export async function loadPlayerProfile(
  database: SQLite.SQLiteDatabase,
): Promise<PlayerProfile> {
  const save = await database.getFirstAsync<SaveRow>(
    "SELECT * FROM player_save WHERE id = 1",
  );
  if (!save) {
    throw new Error("The player save could not be initialized.");
  }
  const party = await database.getAllAsync<PartyRow>(
    "SELECT * FROM party_member ORDER BY slot",
  );
  return toProfile(save, party);
}

export async function openPlayerDatabase(): Promise<{
  database: SQLite.SQLiteDatabase;
  profile: PlayerProfile;
}> {
  const database = await openPlayerDatabaseConnection();
  const profile = await loadPlayerProfile(database);
  return { database, profile };
}

export async function persistPlayerProfile(
  database: SQLite.SQLiteDatabase,
  profile: PlayerProfile,
): Promise<void> {
  await database.withTransactionAsync(async () => {
    await database.runAsync(
      `UPDATE player_save SET active_slot = ?, opponent_id = ?, opponent_level = ?,
       starter_selected = ?, opponent_is_area_boss = ?, opponent_cells = ?, opponent_statuses = ?, opponent_status_fresh = ?,
       encounter_complete = ?, area_id = ?,
       area_number = ?, encounter_index = ?, used_special_boss_ids = ?, money = ?,
       shop_progress = ?, run_status = ?, run_summary = ?, pending_catch = ?,
       poke_balls = ?, great_balls = ?, ultra_balls = ?, potions = ?, revives = ? WHERE id = 1`,
      profile.activeSlot,
      profile.opponentId,
      profile.opponentLevel,
      Number(profile.starterSelected),
      Number(profile.opponentIsAreaBoss),
      JSON.stringify(profile.opponentCells),
      JSON.stringify(profile.opponentStatuses),
      JSON.stringify(profile.opponentStatusFresh),
      Number(profile.encounterComplete),
      profile.areaId,
      profile.areaNumber,
      profile.encounterIndex,
      JSON.stringify(profile.usedSpecialBossIds),
      profile.money,
      profile.shopProgress,
      profile.runStatus,
      JSON.stringify(profile.runSummary),
      JSON.stringify(profile.pendingCatch),
      profile.inventory.pokeBall,
      profile.inventory.greatBall,
      profile.inventory.ultraBall,
      profile.inventory.potion,
      profile.inventory.revive,
    );
    await database.runAsync("DELETE FROM party_member");
    for (const member of profile.party) {
      await database.runAsync(
        `INSERT INTO party_member (slot, pokemon_id, current_hp, max_hp, level)
         VALUES (?, ?, ?, ?, ?)`,
        member.slot,
        member.pokemonId,
        member.currentHp,
        member.maxHp,
        member.level,
      );
    }
  });
}

export async function resetPlayerSave(
  database: SQLite.SQLiteDatabase,
): Promise<PlayerProfile> {
  const initialArea = getRandomArea();
  await database.withTransactionAsync(async () => {
    const result = await database.runAsync(
      `UPDATE player_save SET starter_selected = 0, active_slot = 0, opponent_id = ?,
       opponent_level = 1, opponent_is_area_boss = 0, opponent_cells = '[]',
       opponent_statuses = '[]', opponent_status_fresh = '[]',
       encounter_complete = 0, area_id = ?, area_number = 1, encounter_index = 0,
       used_special_boss_ids = '[]', money = 0, shop_progress = 0,
       run_status = 'active', run_summary = 'null', pending_catch = 'null',
       poke_balls = 5, great_balls = 2, ultra_balls = 1, potions = 3, revives = 1
       WHERE id = 1`,
      initialArea.startingPokemonId,
      initialArea.id,
    );
    if (result.changes !== 1) {
      throw new Error("The player save could not be reset.");
    }
    await database.runAsync("DELETE FROM party_member");
  });

  const save = await database.getFirstAsync<SaveRow>(
    "SELECT * FROM player_save WHERE id = 1",
  );
  if (!save) {
    throw new Error("The reset player save could not be loaded.");
  }
  const party = await database.getAllAsync<PartyRow>(
    "SELECT * FROM party_member ORDER BY slot",
  );
  return toProfile(save, party);
}

export function consumeBall(
  inventory: Inventory,
  ball: keyof Pick<Inventory, "pokeBall" | "greatBall" | "ultraBall">,
): Inventory {
  if (inventory[ball] <= 0) {
    throw new Error("You are out of that kind of Poké Ball.");
  }
  return { ...inventory, [ball]: inventory[ball] - 1 };
}

export function applyHealingItem(
  member: PartyMember,
  inventory: Inventory,
  item: HealingItem,
): { member: PartyMember; inventory: Inventory } {
  if (item === "potion") {
    if (inventory.potion <= 0) throw new Error("You are out of Potions.");
    if (member.currentHp <= 0)
      throw new Error("Use a Revive on a fainted Pokémon.");
    if (member.currentHp >= member.maxHp)
      throw new Error("That Pokémon already has full HP.");
    return {
      member: {
        ...member,
        currentHp: Math.min(member.maxHp, member.currentHp + 30),
      },
      inventory: { ...inventory, potion: inventory.potion - 1 },
    };
  }
  if (inventory.revive <= 0) throw new Error("You are out of Revives.");
  if (member.currentHp > 0)
    throw new Error("Revives can only be used on a fainted Pokémon.");
  return {
    member: { ...member, currentHp: Math.ceil(member.maxHp / 2) },
    inventory: { ...inventory, revive: inventory.revive - 1 },
  };
}
