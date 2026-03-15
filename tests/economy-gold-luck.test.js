const test = require('node:test');
const assert = require('node:assert/strict');

test('addGold uses character luck as a gold multiplier', async () => {
  const { addGold } = await import('../src/game/economy.js');

  const game = {
    gold: 0,
    runConfig: {
      selectedCharacter: {
        attributes: {
          luck: 10
        }
      }
    }
  };

  addGold(game, 100, 'test');
  assert.equal(game.gold, 110);
});

test('addGold prefers runtime character luck when present', async () => {
  const { addGold } = await import('../src/game/economy.js');

  const game = {
    gold: 5,
    runCharacterAttributes: { luck: 25 },
    runConfig: {
      selectedCharacter: {
        attributes: {
          luck: 2
        }
      }
    }
  };

  addGold(game, 40, 'test');
  assert.equal(game.gold, 55);
});

test('addGold keeps old behavior when luck is missing', async () => {
  const { addGold } = await import('../src/game/economy.js');

  const game = { gold: 7 };
  addGold(game, 13, 'test');
  assert.equal(game.gold, 20);
});

