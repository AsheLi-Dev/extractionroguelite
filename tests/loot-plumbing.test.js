const test = require('node:test');
const assert = require('node:assert/strict');

global.Image = global.Image || class Image {
  constructor() {
    this.complete = true;
    this.naturalWidth = 64;
    this.naturalHeight = 64;
    this.width = 64;
    this.height = 64;
    this.src = '';
  }
};

test('LootSystem stores player luck for future equipment generation plumbing', async () => {
  const { LootSystem } = await import('../src/entities/loot.js');

  const world = {
    width: 800,
    height: 600,
    wallThickness: 16
  };

  const lootSystem = new LootSystem(world);
  lootSystem.setDifficulty(3);
  lootSystem.setPlayerLuck(12);

  assert.equal(lootSystem.playerLuck, 12);

  const def = lootSystem.getLootDefinition(0.2);
  assert.ok(def);
  assert.ok(typeof def.name === 'string');
  assert.ok(def.type);
});

