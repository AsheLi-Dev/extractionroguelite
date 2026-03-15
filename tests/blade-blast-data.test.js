const test = require('node:test');
const assert = require('node:assert/strict');

test('Blade & Blast is present in attack picker data', async () => {
  const { ATTACK_TYPES } = await import('../src/data/conditions.js');
  const def = ATTACK_TYPES.find((entry) => entry.id === 'bladeBlast');
  assert.ok(def);
  assert.equal(def.name, 'Blade & Blast');
});

test('Blade & Blast has a dedicated build-upgrade pool', async () => {
  const { getBuildUpgradePoolForAttackType, getBuildUpgradeQuotaForAttack } = await import('../src/data/level-up-data.js');
  const pool = getBuildUpgradePoolForAttackType('bladeBlast');
  const quota = getBuildUpgradeQuotaForAttack('bladeBlast');
  assert.ok(pool.length >= 12);
  assert.equal(quota.common, 4);
  assert.equal(quota.uncommon, 2);
  assert.equal(quota.rare, 1);
});

test('Blade & Blast evolution helpers return valid tier options', async () => {
  const {
    BLADE_BLAST_BASE_WEAPON_ID,
    getBladeBlastTier1EvolutionOptions,
    getBladeBlastTier2EvolutionOptions
  } = await import('../src/data/attack-evolutions.js');
  const tier1 = getBladeBlastTier1EvolutionOptions(['damage', 'rhythm', 'control', 'onhit']);
  const tier2 = getBladeBlastTier2EvolutionOptions('BladeStorm', ['damage', 'rhythm', 'control', 'onhit']);
  assert.equal(tier1.length, 4);
  assert.equal(tier2.length, 4);
  assert.ok(tier1.every((entry) => entry.baseWeaponId === BLADE_BLAST_BASE_WEAPON_ID));
  assert.ok(tier2.every((entry) => entry.baseWeaponId === BLADE_BLAST_BASE_WEAPON_ID));
});
