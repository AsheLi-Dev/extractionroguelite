// -------- Economy validation: lightweight assertions for tuning --------
// Run from dev console: import('./game/economy-validation.js').then(m => m.runEconomyValidation())

import {
  computeEquipmentValue,
  computeSellValue,
  roundToNearest5,
  getShopRerollCost,
  getNextLPConversionCost,
  canBuyLegacyPointAtExtraction
} from './economy.js';
import { SHOP_REROLL, LP_CONVERSION_COSTS, LP_MAX_PER_RUN } from '../data/economy-config.js';

export function runEconomyValidation() {
  const errors = [];

  // computeEquipmentValue: stable and non-negative
  const testItems = [
    { type: 'Weapon', rarity: 'common', weight: null, sockets: 0 },
    { type: 'Body Armour', rarity: 'magic', weight: 'heavy', sockets: 1 },
    { type: 'Helmet', rarity: 'legendary', sockets: 2 }
  ];
  for (const item of testItems) {
    const v = computeEquipmentValue(item);
    if (v < 0) errors.push(`computeEquipmentValue negative for ${JSON.stringify(item)}: ${v}`);
    const v2 = computeEquipmentValue(item);
    if (v !== v2) errors.push(`computeEquipmentValue unstable for ${JSON.stringify(item)}`);
  }

  // sell value <= buy value (with current config)
  for (const item of testItems) {
    const buy = roundToNearest5(computeEquipmentValue(item));
    const sell = computeSellValue(item);
    if (sell > buy) errors.push(`Sell (${sell}) > buy (${buy}) for ${item.rarity} ${item.type}`);
  }

  // reroll cost caps correctly
  const fakeGame = { shopRerollCountByShopId: {} };
  for (let i = 0; i < 20; i++) {
    const cost = getShopRerollCost(fakeGame, 'test');
    if (cost > SHOP_REROLL.cap) errors.push(`Reroll cost ${cost} exceeds cap ${SHOP_REROLL.cap}`);
    fakeGame.shopRerollCountByShopId['test'] = i + 1;
  }

  // LP purchase respects cap and costs
  if (LP_CONVERSION_COSTS.length < LP_MAX_PER_RUN) {
    errors.push(`LP_CONVERSION_COSTS length (${LP_CONVERSION_COSTS.length}) < LP_MAX_PER_RUN (${LP_MAX_PER_RUN})`);
  }
  const gameFull = {
    gold: 10000,
    legacyPointsEarnedThisRun: LP_MAX_PER_RUN
  };
  if (canBuyLegacyPointAtExtraction(gameFull)) {
    errors.push('canBuyLegacyPointAtExtraction should be false when at LP cap');
  }
  const gameNoGold = { gold: 0, legacyPointsEarnedThisRun: 0 };
  if (canBuyLegacyPointAtExtraction(gameNoGold)) {
    errors.push('canBuyLegacyPointAtExtraction should be false when gold < first cost');
  }
  const firstCost = LP_CONVERSION_COSTS[0];
  const gameOk = { gold: firstCost, legacyPointsEarnedThisRun: 0 };
  if (!canBuyLegacyPointAtExtraction(gameOk)) {
    errors.push(`canBuyLegacyPointAtExtraction should be true when gold=${firstCost} and earned=0`);
  }
  const nextCost = getNextLPConversionCost(gameOk);
  if (nextCost !== firstCost) {
    errors.push(`getNextLPConversionCost expected ${firstCost}, got ${nextCost}`);
  }

  if (errors.length > 0) {
    console.error('Economy validation failed:', errors);
    return { ok: false, errors };
  }
  console.log('Economy validation passed.');
  return { ok: true, errors: [] };
}
