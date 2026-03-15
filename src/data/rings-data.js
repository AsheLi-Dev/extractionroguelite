export const RING_BALANCE = {
  TROPHY_HUNTER_BONUS: 0.30,
  TROPHY_HUNTER_DURATION: 15,
  DEMOLISHER_BREAKABLE_DAMAGE_MULT: 1.50,
  LOCKSMITH_CHEST_SPEED_MULT: 1.20,
  LEVELUP_HEAL_PCT: 0.10,
  LEVELUP_DAMAGE_BONUS: 0.05,
  LEVELUP_MS_BONUS: 0.40,
  LEVELUP_MS_DURATION: 10,
  ECHO_ENGINE_PROC_CHANCE: 0.10,
  ECHO_ENGINE_DAMAGE_MULT: 0.50,
  BATTLE_RHYTHM_PROC_CHANCE: 0.20,
  BATTLE_RHYTHM_AS_BONUS: 0.20,
  BATTLE_RHYTHM_DURATION: 5,
  RENEWAL_HEAL_PCT: 0.15,
  RENEWAL_INTERVAL: 20,
  GUARDIAN_THRESHOLD: 0.30,
  EXECUTE_THRESHOLD: 0.15,
  REAPER_THRESHOLD: 0.20,
  REAPER_DAMAGE_MULT: 3.00,
  FIRST_STRIKE_DAMAGE_MULT: 1.50,
  PROJECTILE_HOMING_LIFETIME: 3,
  SKILL_LIFESTEAL_PCT: 0.05,
  REFLECT_MULT: 1.00,
  STANDSTILL_TIME: 2,
  STANDSTILL_DMG_BONUS: 0.20,
  STANDSTILL_AS_BONUS: 0.20,
  FOCUS_EXTRA_CHARGE: 1,
  SHRAPNEL_COUNT: 10,
  SHRAPNEL_DAMAGE_MULT: 0.80,
  COOLDOWN_FEEDBACK_REDUCTION: 0.2,
  COOLDOWN_MEDIC_HEAL: 10,
  STONE_WARD_FLAT_DR: 1,
  MIRROR_FANG_PROC: 0.10,
  MOMENTUM_MS_BONUS: 0.20,
  MOMENTUM_DURATION: 1,
  CONQUEROR_KILLS_PER_DEF: 10,
  CONQUEROR_DEF_MAX: 20,
};

export const RING_RARITY_TO_ITEM = {
  Normal: "common",
  Magic: "magic",
  Rare: "rare",
  Legendary: "legendary",
};

const RING_SPRITE_TO_CELL = {
  gold_emerald_ring: { row: 17, col: 0 },
  gold_band_ring: { row: 17, col: 1 },
  green_signet_ring: { row: 17, col: 2 },
  ruby_ring: { row: 17, col: 3 },
  sapphire_ring: { row: 17, col: 4 },
  onyx_ring: { row: 17, col: 5 },
  gold_signet_ring: { row: 18, col: 0 },
  silver_signet_ring: { row: 18, col: 1 },
  jade_ring: { row: 18, col: 2 },
  silver_signet_ring_2: { row: 18, col: 3 },
  twisted_gold_ring: { row: 18, col: 4 },
  twisted_metal_ring: { row: 18, col: 5 },
};

export function getRingSpriteCell(spriteKey) {
  return RING_SPRITE_TO_CELL[spriteKey] || RING_SPRITE_TO_CELL.gold_band_ring;
}

export const RING_DEFS = [
  { ringId: "ring_armorers_grace", name: "Armorer's Grace", rarity: "Normal", sprite: "gold_band_ring", description: "Ignore movement speed penalty from Medium helmet and Medium body armour." },
  { ringId: "ring_trophy_hunter", name: "Trophy Hunter's Ring", rarity: "Magic", sprite: "green_signet_ring", description: "Killing a mini-boss increases your drop rates by +30% for 15s." },
  { ringId: "ring_demolisher", name: "Demolisher Ring", rarity: "Normal", sprite: "twisted_metal_ring", description: "Deal +50% damage to breakable objects." },
  { ringId: "ring_locksmith", name: "Locksmith's Ring", rarity: "Normal", sprite: "twisted_gold_ring", description: "Open chests 20% faster." },
  { ringId: "ring_vitality", name: "Vitality Ring", rarity: "Magic", sprite: "jade_ring", description: "When you level up, restore 10% max health." },
  { ringId: "ring_ascendant", name: "Ascendant Ring", rarity: "Rare", sprite: "ruby_ring", description: "When you level up, gain +5% increased attack damage for this run." },
  { ringId: "ring_windstep", name: "Windstep Ring", rarity: "Magic", sprite: "gold_emerald_ring", description: "When you level up, gain +40% movement speed for 10s." },
  { ringId: "ring_echo_engine", name: "Echo Engine", rarity: "Legendary", sprite: "gold_signet_ring", description: "Attack hits have 10% chance to trigger Slot 1 skill at 50% damage (free cast)." },
  { ringId: "ring_battle_rhythm", name: "Battle Rhythm Ring", rarity: "Rare", sprite: "sapphire_ring", description: "Skill hits have 20% chance to grant +20% attack speed for 5s." },
  { ringId: "ring_renewal", name: "Heart of Renewal", rarity: "Rare", sprite: "jade_ring", description: "Restore 15% max health every 20s." },
  { ringId: "ring_guardian", name: "Guardian Ring", rarity: "Legendary", sprite: "ruby_ring", description: "Below 30% HP: restore to full and destroy this ring.", consumedOnTrigger: true },
  { ringId: "ring_heirloom", name: "Heirloom Ring", rarity: "Legendary", sprite: "onyx_ring", description: "On defeat: send equipped items to Legacy Vault and destroy this ring.", consumedOnTrigger: true },
  { ringId: "ring_titan", name: "Titan Ring", rarity: "Rare", sprite: "gold_signet_ring", description: "Gain +40% max health when only Heavy helmet/body/boots/weapon are equipped." },
  { ringId: "ring_featherstep", name: "Featherstep Ring", rarity: "Rare", sprite: "silver_signet_ring_2", description: "-0.2s dash cooldown when only Light helmet/body/boots/weapon are equipped." },
  { ringId: "ring_vanguard", name: "Vanguard Ring", rarity: "Rare", sprite: "sapphire_ring", description: "+20% move speed and +10% attack speed when only Medium helmet/body/boots/weapon are equipped." },
  { ringId: "ring_bastion", name: "Bastion Ring", rarity: "Legendary", sprite: "onyx_ring", description: "+1 flat attack damage per 3 defense (round down)." },
  { ringId: "ring_forgemaster", name: "Forgemaster's Ring", rarity: "Legendary", sprite: "gold_signet_ring", description: "Rolls four weapon-style modifiers and can be crafted like a weapon.", forgeLikeWeapon: true },
  { ringId: "ring_calming", name: "Calming Ring", rarity: "Magic", sprite: "silver_signet_ring", description: "Non-boss enemies around you deal 20% less damage." },
  { ringId: "ring_gambler", name: "Gambler's Ring", rarity: "Rare", sprite: "twisted_metal_ring", description: "Rolls 0-50% increased damage and 20-50% decreased max health.", gamblerRolls: true },
  { ringId: "ring_seeker", name: "Seeker's Ring", rarity: "Rare", sprite: "gold_emerald_ring", description: "Projectiles home to enemies and disappear after 3s." },
  { ringId: "ring_blood_channel", name: "Blood Channel Ring", rarity: "Rare", sprite: "ruby_ring", description: "Restore 5% of skill damage dealt as health." },
  { ringId: "ring_thornbound", name: "Thornbound Ring", rarity: "Rare", sprite: "onyx_ring", description: "When hit by an enemy, reflect 100% of your attack damage to that enemy." },
  { ringId: "ring_sentinel", name: "Sentinel Ring", rarity: "Rare", sprite: "silver_signet_ring", description: "Stand still for 2s to gain +20% damage and +20% attack speed until you move." },
  { ringId: "ring_executioner", name: "Executioner Ring", rarity: "Legendary", sprite: "ruby_ring", description: "Direct attacks instantly kill enemies below 15% max HP." },
  { ringId: "ring_focus", name: "Focus Ring", rarity: "Rare", sprite: "sapphire_ring", description: "Gain +1 charge for skill slot 1." },
  { ringId: "ring_shrapnel", name: "Shrapnel Ring", rarity: "Magic", sprite: "twisted_metal_ring", description: "Breaking an object fires 10 projectiles in a 360-degree burst for 80% attack damage each." },
  { ringId: "ring_reaper", name: "Reaper's Ring", rarity: "Rare", sprite: "onyx_ring", description: "Deal +200% damage to enemies below 20% HP." },
  { ringId: "ring_first_strike", name: "First Strike Ring", rarity: "Rare", sprite: "ruby_ring", description: "Deal +50% damage to enemies at full HP." },
  { ringId: "ring_arcane_feedback", name: "Arcane Feedback Ring", rarity: "Rare", sprite: "sapphire_ring", description: "When a skill cooldown is restored, reduce another random skill cooldown by 0.2s." },
  { ringId: "ring_medics", name: "Medic's Ring", rarity: "Magic", sprite: "jade_ring", description: "When a skill cooldown is restored, restore 10 HP." },
  { ringId: "ring_archivist", name: "Archivist Ring", rarity: "Legendary", sprite: "onyx_ring", description: "On extraction: destroy this ring and gain +5 Legacy Points.", consumedOnTrigger: true },
  { ringId: "ring_stone_ward", name: "Stone Ward Ring", rarity: "Magic", sprite: "gold_band_ring", description: "Reduce all incoming damage by 1 (flat, minimum 0)." },
  { ringId: "ring_mirror_fang", name: "Mirror Fang Ring", rarity: "Legendary", sprite: "sapphire_ring", description: "Basic attacks have 10% chance to repeat once at 100% damage." },
  { ringId: "ring_traveler", name: "Traveler's Ring", rarity: "Normal", sprite: "gold_band_ring", description: "After interacting with an NPC, restore 20 HP (once per NPC)." },
  { ringId: "ring_windrunner", name: "Windrunner Ring", rarity: "Rare", sprite: "gold_emerald_ring", description: "Gain an additional dash charge." },
  { ringId: "ring_momentum", name: "Momentum Ring", rarity: "Magic", sprite: "silver_signet_ring_2", description: "Gain +20% move speed for 1s after dashing." },
  { ringId: "ring_conqueror", name: "Conqueror's Ring", rarity: "Rare", sprite: "gold_signet_ring", description: "Every 10 kills grants +1 defense this run (up to +20)." },
];

const RING_DEF_BY_ID = new Map(RING_DEFS.map((d) => [d.ringId, d]));

export function getRingDefById(ringId) {
  return RING_DEF_BY_ID.get(String(ringId || "")) || null;
}

export function getRingDefsByItemRarity(itemRarity) {
  return RING_DEFS.filter((d) => RING_RARITY_TO_ITEM[d.rarity] === itemRarity);
}

export function getAllRingDefs() {
  return [...RING_DEFS];
}
