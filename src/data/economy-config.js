// -------- Economy config: gold, shop, sell, LP conversion --------
// Tune these constants for balancing; keep grouped by feature.

/** Gold drop ranges by enemy type. enemyType: 'mob' | 'elite' | 'boss'. */
export const GOLD_DROP_TABLE = {
  mob: { min: 2, max: 8 },
  elite: { min: 12, max: 28 },
  boss: { min: 80, max: 160 }
};

/** Shop reroll: base cost, cost increase per reroll, max cost cap. */
export const SHOP_REROLL = {
  baseCost: 15,
  increment: 10,
  cap: 80
};

/** Sell price = round(equipmentValue * SELL_RATE * socketBonus). */
export const SELL_RATE = 0.30;

/** Extra sell multiplier per socket: (1 + sockets * SOCKET_SELL_BONUS_RATE_PER_SOCKET). */
export const SOCKET_SELL_BONUS_RATE_PER_SOCKET = 0.05;

/** Base price by rarity (before slot/weight/socket). */
export const ITEM_PRICE_BASE_BY_RARITY = {
  common: 40,
  magic: 90,
  rare: 180,
  legendary: 400
};

/** Slot multiplier for shop/sell value. Keys match equipment type (normalized). */
export const SLOT_PRICE_MULT = {
  helmet: 1.0,
  body: 1.2,
  weapon: 1.1,
  boots: 0.9,
  ring: 1.0
};

/** Armour weight multiplier (Body Armour only). */
export const ARMOUR_WEIGHT_MULT = {
  light: 0.9,
  medium: 1.0,
  heavy: 1.15
};

/** Extra gold per socket on buy price. */
export const SOCKET_PRICE_PREMIUM = 30;

/** Cost in gold for each LP purchase at extraction (index = legacyPointsEarnedThisRun). */
export const LP_CONVERSION_COSTS = [80, 140, 220, 320, 440];

/** Maximum LP that can be bought per run at extraction. */
export const LP_MAX_PER_RUN = 5;

/** Reroll one modifier service: base cost, increment per prior use on same item, cap. */
export const REROLL_MOD_SERVICE = { baseCost: 40, increment: 20, cap: 120 };

/** Cost to add one socket (socket drill). Fails if already 2 sockets. */
export const SOCKET_DRILL_COST = 250;
