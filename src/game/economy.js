// -------- Economy API: gold, pricing, shop --------
// First argument is always the run state holder (game) for stateful calls.

import {
  GOLD_DROP_TABLE,
  SHOP_REROLL,
  SELL_RATE,
  SOCKET_SELL_BONUS_RATE_PER_SOCKET,
  ITEM_PRICE_BASE_BY_RARITY,
  SLOT_PRICE_MULT,
  ARMOUR_WEIGHT_MULT,
  SOCKET_PRICE_PREMIUM,
  REROLL_MOD_SERVICE,
  SOCKET_DRILL_COST
} from '../data/economy-config.js';
import {
  MODIFIER_ROLL_BY_DIFFICULTY,
  LOCAL_STAT_SCALE_ROLL_BY_DIFFICULTY,
  LOCAL_STAT_SCALE_MOD_IDS
} from '../data/loot-data.js';

// -------- Helpers --------

const SLOT_KEY = { Helmet: 'helmet', 'Body Armour': 'body', Weapon: 'weapon', Boots: 'boots', Ring: 'ring' };

export function roundToNearest5(n) {
  return Math.max(0, Math.round(n / 5) * 5);
}

// -------- Gold --------

export function addGold(game, amount, reason, context = {}) {
  if (amount <= 0) return;
  const luckAttr = Math.max(
    0,
    Number(game?.runCharacterAttributes?.luck ?? game?.runConfig?.selectedCharacter?.attributes?.luck) || 0
  );
  const adjustedAmount = Math.max(0, Math.round(Number(amount) * (1 + luckAttr * 0.01)) || 0);
  if (adjustedAmount <= 0) return;
  game.gold = (game.gold ?? 0) + adjustedAmount;
}

export function getGold(game) {
  return game.gold ?? 0;
}

export function canSpendGold(game, amount) {
  return (game.gold ?? 0) >= amount;
}

export function spendGold(game, amount, reason, context = {}) {
  if (!canSpendGold(game, amount)) return false;
  game.gold -= amount;
  return true;
}

// -------- Pricing --------

export function computeEquipmentValue(item) {
  if (!item || !item.rarity) return 0;
  const base = ITEM_PRICE_BASE_BY_RARITY[item.rarity] ?? ITEM_PRICE_BASE_BY_RARITY.common;
  const slotKey = SLOT_KEY[item.type] ?? 'helmet';
  const multSlot = SLOT_PRICE_MULT[slotKey] ?? 1;
  const multWeight =
    item.type === 'Body Armour' && item.weight
      ? (ARMOUR_WEIGHT_MULT[item.weight] ?? 1)
      : 1;
  const socketPremium = (item.sockets ?? 0) * SOCKET_PRICE_PREMIUM;
  const value = base * multSlot * multWeight + socketPremium;
  return Math.max(0, Math.round(value));
}

export function computeSellValue(item) {
  const value = computeEquipmentValue(item);
  const sockets = item.sockets ?? 0;
  const mult = 1 + sockets * SOCKET_SELL_BONUS_RATE_PER_SOCKET;
  return Math.max(0, Math.round(value * SELL_RATE * mult));
}

// -------- Loot gold drops --------

export function rollGoldDrop(enemyType) {
  const band = GOLD_DROP_TABLE[enemyType] ?? GOLD_DROP_TABLE.mob;
  const min = band.min ?? 0;
  const max = band.max ?? min;
  return min + Math.floor(Math.random() * (max - min + 1));
}

// -------- Shop actions --------

export function getShopRerollCost(game, shopId) {
  const count = (game.shopRerollCountByShopId ?? {})[shopId] ?? 0;
  const cost = SHOP_REROLL.baseCost + count * SHOP_REROLL.increment;
  return Math.min(cost, SHOP_REROLL.cap);
}

export function rerollShop(game, shopId, shopInventoryGeneratorFn) {
  const cost = getShopRerollCost(game, shopId);
  if (!canSpendGold(game, cost)) return null;
  spendGold(game, cost, 'shop_reroll', { shopId });
  if (!game.shopRerollCountByShopId) game.shopRerollCountByShopId = {};
  game.shopRerollCountByShopId[shopId] = (game.shopRerollCountByShopId[shopId] ?? 0) + 1;
  return shopInventoryGeneratorFn();
}

export function buyShopItem(game, shopId, item) {
  const price = roundToNearest5(computeEquipmentValue(item));
  if (!canSpendGold(game, price)) return false;
  spendGold(game, price, 'shop_buy', { shopId, itemId: item.id });
  const newItem = { ...item, id: item.id ?? Date.now() + Math.random() };
  if (!game.inventory) game.inventory = [];
  game.inventory.push(newItem);
  return true;
}

export function sellInventoryItem(game, itemId) {
  const inv = game.inventory ?? [];
  const idx = inv.findIndex((i) => i.id === itemId);
  if (idx < 0) return false;
  const item = inv[idx];
  const gold = computeSellValue(item);
  inv.splice(idx, 1);
  addGold(game, gold, 'sell', { itemId });
  return true;
}

// -------- Services --------

export function getRerollModServiceCost(game, itemId) {
  const count = (game.itemServiceRerollCountByItemId ?? {})[itemId] ?? 0;
  const cost = REROLL_MOD_SERVICE.baseCost + count * REROLL_MOD_SERVICE.increment;
  return Math.min(cost, REROLL_MOD_SERVICE.cap);
}

export function rerollOneModifierService(game, itemId) {
  const cost = getRerollModServiceCost(game, itemId);
  if (!canSpendGold(game, cost)) return false;
  const item =
    game.inventory?.find((i) => i.id === itemId) ??
    Object.values(game.equipment ?? {}).find((i) => i && i.id === itemId);
  if (!item || !item.modifiers || item.modifiers.length === 0) return false;
  spendGold(game, cost, 'reroll_mod', { itemId });
  if (!game.itemServiceRerollCountByItemId) game.itemServiceRerollCountByItemId = {};
  game.itemServiceRerollCountByItemId[itemId] =
    (game.itemServiceRerollCountByItemId[itemId] ?? 0) + 1;

  const idx = Math.floor(Math.random() * item.modifiers.length);
  const mod = item.modifiers[idx];
  const difficulty = Math.min(5, Math.max(1, game.difficulty ?? 1));
  if (LOCAL_STAT_SCALE_MOD_IDS.includes(mod.id)) {
    const r = LOCAL_STAT_SCALE_ROLL_BY_DIFFICULTY[difficulty] ?? { min: 0.2, max: 1 };
    mod.value = r.min + Math.random() * (r.max - r.min);
  } else {
    const r = MODIFIER_ROLL_BY_DIFFICULTY[difficulty] ?? { min: 0.05, max: 0.5 };
    mod.value = r.min + Math.random() * (r.max - r.min);
  }
  if (game.rebuildItemStats) game.rebuildItemStats(item);
  if (game.recalculateStats) game.recalculateStats();
  return true;
}

export function socketDrillService(game, itemId) {
  if (!canSpendGold(game, SOCKET_DRILL_COST)) return false;
  const item =
    game.inventory?.find((i) => i.id === itemId) ??
    Object.values(game.equipment ?? {}).find((i) => i && i.id === itemId);
  if (!item) return false;
  const sockets = item.sockets ?? 0;
  if (sockets >= 2) return false;
  spendGold(game, SOCKET_DRILL_COST, 'socket_drill', { itemId });
  item.sockets = sockets + 1;
  return true;
}
