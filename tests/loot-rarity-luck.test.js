const test = require('node:test');
const assert = require('node:assert/strict');

test('per-call luck can push rarity rolls upward', async () => {
  const loot = await import('../src/data/loot-data.js');
  const originalRandom = Math.random;
  Math.random = () => 0.17;
  try {
    assert.equal(loot.getRarityRoll(0, 0, 0), 'common');
    assert.equal(loot.getRarityRoll(0, 0, 10), 'magic');
  } finally {
    Math.random = originalRandom;
  }
});

test('generateEquipmentItem reads luck from options', async () => {
  const loot = await import('../src/data/loot-data.js');
  const originalRandom = Math.random;
  Math.random = () => 0.17;
  try {
    const common = loot.generateEquipmentItem('Weapon', 0, 0, null, { luck: 0 });
    const magic = loot.generateEquipmentItem('Weapon', 0, 0, null, { luck: 10 });
    assert.equal(common.rarity, 'common');
    assert.equal(magic.rarity, 'magic');
  } finally {
    Math.random = originalRandom;
  }
});

