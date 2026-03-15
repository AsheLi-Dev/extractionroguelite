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

test('snack data exposes the current staged snack loadout', async () => {
  const { SNACK_IDS, getSnackById } = await import('../src/data/snack.js');
  assert.deepEqual(SNACK_IDS, ['bread', 'espresso', 'herbal_tea']);
  assert.equal(getSnackById('bread')?.maxUses, 3);
  assert.equal(getSnackById('espresso')?.maxUses, 2);
  assert.equal(getSnackById('herbal_tea')?.maxUses, 2);
});

test('bread consumption spends a use and heals 10% max HP', async () => {
  const { applyGameUIMixin } = await import('../src/game/game-ui.js');

  class TestGame {}
  applyGameUIMixin(TestGame);

  const game = new TestGame();
  game.runSnackId = 'bread';
  game.snackUsesRemaining = 3;
  game.currentStats = { maxHealth: 120 };
  game.player = { position: { x: 10, y: 20 }, size: 30 };
  game.time = 42;

  let healed = 0;
  let mapUiUpdates = 0;
  game.healPlayer = (amount) => {
    healed = amount;
  };
  game.updateMapUI = () => {
    mapUiUpdates += 1;
  };

  const consumed = game.consumeSnack();
  assert.equal(consumed, true);
  assert.equal(game.snackUsesRemaining, 2);
  assert.equal(healed, 12);
  assert.equal(mapUiUpdates, 1);
});

test('espresso consumption activates the speed buff and floating text', async () => {
  const { applyGameUIMixin } = await import('../src/game/game-ui.js');

  class TestGame {}
  applyGameUIMixin(TestGame);

  const game = new TestGame();
  game.runSnackId = 'espresso';
  game.snackUsesRemaining = 2;
  game.player = { position: { x: 100, y: 200 }, size: 40 };
  game.time = 15;

  const floatingText = [];
  game.addFloatingText = (...args) => floatingText.push(args);
  game.updateMapUI = () => {};

  const consumed = game.consumeSnack();
  assert.equal(consumed, true);
  assert.equal(game.snackUsesRemaining, 1);
  assert.equal(game.snackEspressoUntil, 25);
  assert.deepEqual(floatingText, [[120, 220, 'Espresso!', 'skill']]);
});

test('herbal tea consumption activates the defense buff and floating text', async () => {
  const { applyGameUIMixin } = await import('../src/game/game-ui.js');

  class TestGame {}
  applyGameUIMixin(TestGame);

  const game = new TestGame();
  game.runSnackId = 'herbal_tea';
  game.snackUsesRemaining = 2;
  game.player = { position: { x: 5, y: 7 }, size: 18 };
  game.time = 30;

  const floatingText = [];
  game.addFloatingText = (...args) => floatingText.push(args);
  game.updateMapUI = () => {};

  const consumed = game.consumeSnack();
  assert.equal(consumed, true);
  assert.equal(game.snackUsesRemaining, 1);
  assert.equal(game.snackHerbalTeaUntil, 40);
  assert.deepEqual(floatingText, [[14, 16, 'Herbal Tea!', 'skill']]);
});
