// -------- Economy validation: lightweight assertions for tuning --------
// Run from dev console: import('./game/economy-validation.js').then(m => m.runEconomyValidation())

import {
  computeEquipmentValue,
  computeSellValue,
  roundToNearest5,
  getShopRerollCost
} from './economy.js';
import { SHOP_REROLL } from '../data/economy-config.js';

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

  if (errors.length > 0) {
    console.error('Economy validation failed:', errors);
    return { ok: false, errors };
  }
  console.log('Economy validation passed.');
  return { ok: true, errors: [] };
}
