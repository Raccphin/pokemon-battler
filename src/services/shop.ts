import type { Inventory, PlayerProfile, ShopItemKey } from '@/types/game';

export const SHOP_CONFIG = {
  rewardPerEncounter: 25,
  encountersPerShop: 3,
  prices: {
    potion: 18,
    revive: 30,
    pokeBall: 12,
    greatBall: 25,
    ultraBall: 45,
  } as const,
} as const;

export function getShopItemLabel(item: ShopItemKey): string {
  switch (item) {
    case 'potion':
      return 'Potion';
    case 'revive':
      return 'Revive';
    case 'pokeBall':
      return 'Poké Ball';
    case 'greatBall':
      return 'Great Ball';
    case 'ultraBall':
      return 'Ultra Ball';
    default:
      return 'Item';
  }
}

export function buyShopItem(
  profile: PlayerProfile,
  item: ShopItemKey
): PlayerProfile {
  const price = SHOP_CONFIG.prices[item];
  if (profile.money < price) {
    throw new Error(`You need ${price - profile.money} more coins for ${getShopItemLabel(item)}.`);
  }

  const inventory: Inventory = {
    ...profile.inventory,
    [item]: profile.inventory[item] + 1,
  };

  return {
    ...profile,
    money: profile.money - price,
    inventory,
  };
}

export function awardEncounterReward(profile: PlayerProfile): PlayerProfile {
  return {
    ...profile,
    money: profile.money + SHOP_CONFIG.rewardPerEncounter,
    shopProgress: Math.min(profile.shopProgress + 1, SHOP_CONFIG.encountersPerShop),
  };
}
