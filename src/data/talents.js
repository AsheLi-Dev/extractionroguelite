import { GLOBAL_PLAYER_PROFILE_KEY, TALENTS_KEY } from "./constants.js";

export const TALENT_TREE = {
  Brutality: [
    { id: "fierce", icon: "assets/images/Talent Tree/mighty-force.png", cost: 1, name: "Fierce", tier: 1, desc: "Gain +2% attack damage when you hit an enemy, stacking up to 10 times.", parentsAll: [], parentsAny: [] },
    { id: "rapid", icon: "assets/images/Talent Tree/double-shot.png", cost: 1, name: "Rapid", tier: 1, desc: "Gain +10% attack speed after dashing for a short duration.", parentsAll: [], parentsAny: [] },
    { id: "heavyHit", icon: "assets/images/Talent Tree/high-punch.png", cost: 2, name: "Heavy Hit", tier: 1, desc: "Gain +40% attack damage, but every 4th attack consumes one dash charge.", parentsAll: [], parentsAny: [] },
    { id: "dashingAttack", icon: "assets/images/Talent Tree/fire-dash.png", cost: 2, name: "Dashing Attack", tier: 1, desc: "Automatically fire a basic attack dealing 30% damage in the direction you dash.", parentsAll: [], parentsAny: [] },
    { id: "predator", icon: "assets/images/Talent Tree/skull-crossed-bones.png", cost: 1, name: "Predator", tier: 1, desc: "Enemies below 25% health take greatly increased damage.", parentsAll: [], parentsAny: [] },
    { id: "bloodthirst", icon: "assets/images/Talent Tree/vampire-cape.png", cost: 2, name: "Bloodthirst", tier: 1, desc: "Kills restore 3% of your max health.", parentsAll: [], parentsAny: [] },
    { id: "bloodRush", icon: "assets/images/Talent Tree/enrage.png", cost: 2, name: "Blood Rush", tier: 1, desc: "Killing an enemy grants +15% attack speed and +15% movement speed for 3 seconds.", parentsAll: [], parentsAny: [] },
    { id: "overkill", icon: "assets/images/Talent Tree/saber-slash.png", cost: 2, name: "Overkill", tier: 1, desc: "When you deal 50% more damage than an enemy's remaining health, the excess damage splashes to nearby enemies for 40% damage.", parentsAll: [], parentsAny: [] },
    { id: "frenzy", icon: "assets/images/Talent Tree/crossed-pistols.png", cost: 2, name: "Frenzy", tier: 1, desc: "Every 4th consecutive attack grants 3 seconds of +30% attack speed.", parentsAll: [], parentsAny: [] },
    { id: "battleScarred", icon: "assets/images/Talent Tree/diablo-skull.png", cost: 2, name: "Battle Scarred", tier: 1, desc: "Taking damage grants +10% attack damage for 5 seconds, stacking up to 3 times.", parentsAll: [], parentsAny: [] },
    { id: "brutalityRetaliation", icon: "assets/images/Talent Tree/dripping-knife.png", cost: 2, name: "Retaliation", tier: 1, desc: "Taking damage grants +5% attack speed for 4 seconds, stacking up to 5 times.", parentsAll: [], parentsAny: [] },
    { id: "executioner", icon: "assets/images/Talent Tree/executioner-hood.png", cost: 2, name: "Executioner", tier: 1, desc: "Skills deal 25% increased damage and deal more damage to low-health enemies.", parentsAll: [], parentsAny: [] },
    { id: "berserkerRage", icon: "assets/images/Talent Tree/brutal-helm.png", cost: 3, name: "Berserker's Rage", tier: 1, desc: "Below 40% health, gain +40% attack damage, +20% attack speed, and +15% movement speed.", parentsAll: [], parentsAny: [] },
    { id: "luckyShot", icon: "assets/images/Talent Tree/reticule.png", cost: 3, name: "Lucky Shot", tier: 1, desc: "Gain +10% damage for each Luck attribute you have.", parentsAll: [], parentsAny: [] },
    { id: "assassinStep", icon: "assets/images/Talent Tree/hooded-assassin.png", cost: 1, name: "Assassin Step", tier: 1, desc: "The first hit you make does not attract enemy detection.", parentsAll: [], parentsAny: [] },
    { id: "relentless", icon: "assets/images/Talent Tree/master-of-arms.png", cost: 3, name: "Relentless", tier: 1, desc: "Killing an enemy reduces dash cooldown by 0.5 seconds.", parentsAll: [], parentsAny: [] }
  ],
  Agility: [
    { id: "nimble", icon: "assets/images/Talent Tree/running-ninja.png", cost: 1, name: "Nimble", tier: 1, desc: "Gain +5% movement speed.", parentsAll: [], parentsAny: [] },
    { id: "reflexes", icon: "assets/images/Talent Tree/acrobatic.png", cost: 1, name: "Reflexes", tier: 1, desc: "Reduce dash cooldown by 0.15 seconds.", parentsAll: [], parentsAny: [] },
    { id: "fleetFooted", icon: "assets/images/Talent Tree/sprint.png", cost: 1, name: "Fleet Footed", tier: 1, desc: "When health is below 50%, gain +15% movement speed.", parentsAll: [], parentsAny: [] },
    { id: "agilitySwiftExtraction", icon: "assets/images/Talent Tree/pegasus.png", cost: 2, name: "Swift Extraction", tier: 1, desc: "Dash distance increased by 25%.", parentsAll: [], parentsAny: [] },
    { id: "evasion", icon: "assets/images/Talent Tree/distraction.png", cost: 2, name: "Evasion", tier: 1, desc: "Each dash has a 20% chance to leave a decoy that distracts enemies for 2 seconds.", parentsAll: [], parentsAny: [] },
    { id: "shadowStep", icon: "assets/images/Talent Tree/invisible.png", cost: 2, name: "Shadow Step", tier: 1, desc: "Leave a toxic trail during dash that damages enemies for 2 seconds.", parentsAll: [], parentsAny: [] },
    { id: "momentum", icon: "assets/images/Talent Tree/fluffy-wing.png", cost: 1, name: "Momentum", tier: 1, desc: "After dashing gain +20% movement speed for 2 seconds.", parentsAll: [], parentsAny: [] },
    { id: "slipstream", icon: "assets/images/Talent Tree/winged-sword.png", cost: 1, name: "Slipstream", tier: 1, desc: "Passing through enemies during dash slows them by 40% for 1.5 seconds.", parentsAll: [], parentsAny: [] },
    { id: "ghostForm", icon: "assets/images/Talent Tree/yin-yang.png", cost: 3, name: "Ghost Form", tier: 1, desc: "After taking damage become untargetable for 0.8 seconds (6s cooldown).", parentsAll: [], parentsAny: [] },
    { id: "untouchable", icon: "assets/images/Talent Tree/liberty-wing.png", cost: 3, name: "Untouchable", tier: 1, desc: "Each dash that avoids damage during i-frames permanently reduces incoming damage by 1%, stacking up to 20%.", parentsAll: [], parentsAny: [] },
    { id: "phantomDash", icon: "assets/images/Talent Tree/fire-dash.png", cost: 1, name: "Phantom Dash", tier: 1, desc: "After dashing you gain 0.1 seconds of invulnerability.", parentsAll: [], parentsAny: [] },
    { id: "quickRecovery", icon: "assets/images/Talent Tree/meditation.png", cost: 2, name: "Quick Recovery", tier: 1, desc: "Successfully dodging an attack reduces skill cooldowns by 0.5 seconds.", parentsAll: [], parentsAny: [] },
    { id: "windrunner", icon: "assets/images/Talent Tree/winged-scepter.png", cost: 2, name: "Windrunner", tier: 1, desc: "Movement speed bonuses are 50% more effective.", parentsAll: [], parentsAny: [] },
    { id: "danceOfBlades", icon: "assets/images/Talent Tree/saber-slash.png", cost: 2, name: "Dance of Blades", tier: 1, desc: "Attacking within 1 second after dashing deals +30% damage.", parentsAll: [], parentsAny: [] },
    { id: "blinkAssault", icon: "assets/images/Talent Tree/high-kick.png", cost: 2, name: "Blink Assault", tier: 1, desc: "Dashing through enemies deals 80% attack damage.", parentsAll: [], parentsAny: [] },
    { id: "perfectFlow", icon: "assets/images/Talent Tree/infinity.png", cost: 3, name: "Perfect Flow", tier: 1, desc: "Dashing two times in a row grants +10% attack speed for 2 seconds.", parentsAll: [], parentsAny: [] }
  ],
  Vitality: [
    { id: "fortitude", icon: "assets/images/Talent Tree/armor-blueprint.png", cost: 1, name: "Fortitude", tier: 1, desc: "Gain +15% max health.", parentsAll: [], parentsAny: [] },
    { id: "bulwark", icon: "assets/images/Talent Tree/bell-shield.png", cost: 1, name: "Bulwark", tier: 1, desc: "Gain +15% defense.", parentsAll: [], parentsAny: [] },
    { id: "thickSkin", icon: "assets/images/Talent Tree/gauntlet.png", cost: 1, name: "Thick Skin", tier: 1, desc: "Gain +10% max health and +10% defense.", parentsAll: [], parentsAny: [] },
    { id: "resilient", icon: "assets/images/Talent Tree/arm-bandage.png", cost: 1, name: "Resilient", tier: 1, desc: "Taking damage reduces incoming damage by 10% for 2 seconds.", parentsAll: [], parentsAny: [] },
    { id: "lifebloom", icon: "assets/images/Talent Tree/hearts.png", cost: 2, name: "Lifebloom", tier: 1, desc: "Heal 5% of the killed enemy's max health when you kill an enemy.", parentsAll: [], parentsAny: [] },
    { id: "vitality", icon: "assets/images/Talent Tree/hearts.png", cost: 1, name: "Vitality", tier: 1, desc: "Entering a new map restores 20% of your max health.", parentsAll: [], parentsAny: [] },
    { id: "secondBreath", icon: "assets/images/Talent Tree/meditation.png", cost: 2, name: "Second Breath", tier: 1, desc: "When health drops below 15%, instantly restore 25% of max health (once per map).", parentsAll: [], parentsAny: [] },
    { id: "bloodRitual", icon: "assets/images/Talent Tree/dripping-knife.png", cost: 2, name: "Blood Ritual", tier: 1, desc: "Gain a stack of Blood Ritual when you kill an enemy. At 10 stacks, your next hit heals you for 50% of the damage dealt and resets the stacks.", parentsAll: [], parentsAny: [] },
    { id: "toughness", icon: "assets/images/Talent Tree/metal-boot.png", cost: 2, name: "Toughness", tier: 1, desc: "The first three hits you take on each new map deal 40% reduced damage.", parentsAll: [], parentsAny: [] },
    { id: "endurance", icon: "assets/images/Talent Tree/greaves.png", cost: 2, name: "Endurance", tier: 1, desc: "At the start of dashing gain 30% damage reduction for 1 second.", parentsAll: [], parentsAny: [] },
    { id: "livingFortress", icon: "assets/images/Talent Tree/bell-shield.png", cost: 3, name: "Living Fortress", tier: 1, desc: "Every 8 seconds gain a shield equal to 5% of your max health. Maximum shield from Living Fortress is 30% of your max health.", parentsAll: [], parentsAny: [] },
    { id: "undyingResolve", icon: "assets/images/Talent Tree/yin-yang.png", cost: 2, name: "Undying Resolve", tier: 1, desc: "Defeating a mini-boss permanently increases your max health by 10% for the remainder of the run.", parentsAll: [], parentsAny: [] },
    { id: "secondWind", icon: "assets/images/Talent Tree/fluffy-wing.png", cost: 3, name: "Second Wind", tier: 1, desc: "Once per run, survive a lethal hit and restore 20% of your max health.", parentsAll: [], parentsAny: [] },
    { id: "immortal", icon: "assets/images/Talent Tree/infinity.png", cost: 3, name: "Immortal", tier: 1, desc: "Once per run, survive a lethal hit at 1 HP and gain brief damage immunity.", parentsAll: [], parentsAny: [] },
    { id: "stoneSkin", icon: "assets/images/Talent Tree/ice-golem (2).png", cost: 2, name: "Stone Skin", tier: 1, desc: "Damage greater than 20% of your max health is reduced by 30%.", parentsAll: [], parentsAny: [] },
    { id: "guardianPulse", icon: "assets/images/Talent Tree/aura.png", cost: 2, name: "Guardian Pulse", tier: 1, desc: "When your shield breaks, release a shockwave dealing 100% attack damage and stunning nearby enemies for 0.5 seconds.", parentsAll: [], parentsAny: [] }
  ],
  Luck: [
    { id: "arcaneEye", icon: "assets/images/Talent Tree/all-seeing-eye.png", cost: 2, name: "Arcane Eye", tier: 1, desc: "Get 20% more loot from searchable objects.", parentsAll: [], parentsAny: [] },
    { id: "keenEye", icon: "assets/images/Talent Tree/one-eyed.png", cost: 1, name: "Keen Eye", tier: 1, desc: "Equipment drop chance increases by 15% of its base value.", parentsAll: [], parentsAny: [] },
    { id: "treasureSense", icon: "assets/images/Talent Tree/treasure-map.png", cost: 1, name: "Treasure Sense", tier: 1, desc: "Faint arrows point toward nearby searchable objects.", parentsAll: [], parentsAny: [] },
    { id: "scavengersInstinct", icon: "assets/images/Talent Tree/spyglass.png", cost: 1, name: "Scavenger's Instinct", tier: 1, desc: "Elite enemy drop chance increases by 10% of its base value.", parentsAll: [], parentsAny: [] },
    { id: "lootHoarder", icon: "assets/images/Talent Tree/open-treasure-chest.png", cost: 2, name: "Loot Hoarder", tier: 1, desc: "After opening a searchable object, enemy drop chance increases by 20% of its base value for 10 seconds.", parentsAll: [], parentsAny: [] },
    { id: "itemSense", icon: "assets/images/Talent Tree/diamonds.png", cost: 1, name: "Item Sense", tier: 1, desc: "Picking up a Magic item slows nearby enemies by 20% for 2 seconds.", parentsAll: [], parentsAny: [] },
    { id: "cardSurge", icon: "assets/images/Talent Tree/transform.png", cost: 2, name: "Card Surge", tier: 1, desc: "Picking up any loot grants +20% movement speed and attack speed for 3 seconds.", parentsAll: [], parentsAny: [] },
    { id: "ghostLooter", icon: "assets/images/Talent Tree/invisible.png", cost: 2, name: "Ghost Looter", tier: 1, desc: "Picking up loot makes you untargetable for 0.5 seconds.", parentsAll: [], parentsAny: [] },
    { id: "cubeMagnet", icon: "assets/images/Talent Tree/cubeforce.png", cost: 1, name: "Cube Magnet", tier: 1, desc: "Crafting cube drop chance increases by 20% of its base value.", parentsAll: [], parentsAny: [] },
    { id: "cubeCascade", icon: "assets/images/Talent Tree/cubes.png", cost: 2, name: "Cube Cascade", tier: 1, desc: "When a cube drops, there is a 10% chance to duplicate that cube.", parentsAll: [], parentsAny: [] },
    { id: "transmutation", icon: "assets/images/Talent Tree/burning-book.png", cost: 2, name: "Transmutation", tier: 1, desc: "When you extract, each equipped Rare item has a 5% chance to gain a random T1 modifier as a base stat. Each item can gain only one modifier this way.", parentsAll: [], parentsAny: [] },
    { id: "curator", icon: "assets/images/Talent Tree/diamonds.png", cost: 2, name: "Curator", tier: 1, desc: "On extraction: T1 cubes have a 20% chance to upgrade to T2. T2 cubes have a 10% chance to upgrade to T3.", parentsAll: [], parentsAny: [] },
    { id: "lootTranscendence", icon: "assets/images/Talent Tree/treasure-map.png", cost: 3, name: "Loot Transcendence", tier: 1, desc: "On extraction: Normal items have a 20% chance to upgrade to Magic. Magic items have a 10% chance to upgrade to Rare.", parentsAll: [], parentsAny: [] },
    { id: "vaultMaster", icon: "assets/images/Talent Tree/overlord-helm.png", cost: 3, name: "Vault Master", tier: 1, desc: "Secure up to 3 items. Secured items are kept even if you die.", parentsAll: [], parentsAny: [] },
    { id: "livingItem", icon: "assets/images/Talent Tree/rune-sword.png", cost: 3, name: "Living Item", tier: 1, desc: "Before a run, choose one Legacy Vault item as your Living Item. It gains +1 random modifier per mini-boss and +2 per boss, up to a maximum of 6 modifiers.", parentsAll: [], parentsAny: [] },
    { id: "philosophersStone", icon: "assets/images/Talent Tree/warlock-eye.png", cost: 2, name: "Philosopher's Stone", tier: 1, desc: "Mini-bosses have a 5% chance to drop an additional rare item.", parentsAll: [], parentsAny: [] }
  ]
};

const PRIMARY_ATTRIBUTE_BY_BRANCH = Object.freeze({
  Brutality: "brutality",
  Agility: "agility",
  Vitality: "vitality",
  Luck: "luck"
});

const DEFAULT_REQUIREMENT_BY_COST = Object.freeze({
  1: 2,
  2: 5,
  3: 8
});

const TALENT_REQUIREMENT_OVERRIDES = Object.freeze({
  bloodthirst: { brutality: 7, vitality: 3 },
  executioner: { brutality: 5, luck: 3 },
  luckyShot: { brutality: 6, luck: 6 },
  relentless: { brutality: 5, agility: 3 },
  dashingAttack: { brutality: 5, agility: 4 },
  shadowStep: { agility: 5, luck: 3 },
  quickRecovery: { agility: 6, vitality: 2 },
  danceOfBlades: { agility: 5, brutality: 3 },
  blinkAssault: { agility: 5, brutality: 4 },
  untouchable: { agility: 7, vitality: 4 },
  bloodRitual: { vitality: 5, brutality: 3 },
  endurance: { vitality: 5, agility: 3 },
  undyingResolve: { vitality: 5, brutality: 3 },
  immortal: { vitality: 8, luck: 4 },
  guardianPulse: { vitality: 6, brutality: 3 },
  cardSurge: { luck: 5, agility: 3 },
  transmutation: { luck: 5, vitality: 3 },
  livingItem: { luck: 8, vitality: 4 },
  philosophersStone: { luck: 6, brutality: 3 }
});

let _cachedTalentIdSet = null;
let _cachedTalentNodeMap = null;

function loadTalentProfile() {
  try {
    const raw = localStorage.getItem(GLOBAL_PLAYER_PROFILE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveTalentProfile(nextProfile) {
  const current = loadTalentProfile();
  const currentAttributes = current?.attributes && typeof current.attributes === "object" ? current.attributes : {};
  const sourceAttributes = nextProfile?.attributes && typeof nextProfile.attributes === "object"
    ? nextProfile.attributes
    : currentAttributes;
  const sanitized = {
    ...current,
    ...nextProfile,
    level: Math.max(1, Math.floor(Number(nextProfile?.level ?? current?.level ?? 1) || 1)),
    xp: Math.max(0, Math.floor(Number(nextProfile?.xp ?? current?.xp ?? 0) || 0)),
    unspentAttributePoints: Math.max(
      0,
      Math.floor(Number(nextProfile?.unspentAttributePoints ?? current?.unspentAttributePoints ?? 0) || 0)
    ),
    unspentTalentPoints: Math.max(
      0,
      Math.floor(Number(nextProfile?.unspentTalentPoints ?? current?.unspentTalentPoints ?? 0) || 0)
    ),
    attributes: {
      brutality: Math.max(0, Math.floor(Number(sourceAttributes.brutality) || 0)),
      agility: Math.max(0, Math.floor(Number(sourceAttributes.agility) || 0)),
      vitality: Math.max(0, Math.floor(Number(sourceAttributes.vitality) || 0)),
      luck: Math.max(0, Math.floor(Number(sourceAttributes.luck) || 0))
    }
  };
  localStorage.setItem(GLOBAL_PLAYER_PROFILE_KEY, JSON.stringify(sanitized));
  return sanitized;
}

function synthesizeAttributeRequirements(node, branchName) {
  const explicit = TALENT_REQUIREMENT_OVERRIDES[node.id];
  if (explicit) return { ...explicit };
  const primary = PRIMARY_ATTRIBUTE_BY_BRANCH[branchName];
  const requirement = DEFAULT_REQUIREMENT_BY_COST[Math.max(1, Math.min(3, Number(node.cost) || 1))] || 0;
  return primary ? { [primary]: requirement } : {};
}

function getProfileAttributes(profile = null) {
  const source = profile || loadTalentProfile();
  const attrs = source?.attributes && typeof source.attributes === "object" ? source.attributes : {};
  return {
    brutality: Math.max(0, Math.floor(Number(attrs.brutality) || 0)),
    agility: Math.max(0, Math.floor(Number(attrs.agility) || 0)),
    vitality: Math.max(0, Math.floor(Number(attrs.vitality) || 0)),
    luck: Math.max(0, Math.floor(Number(attrs.luck) || 0))
  };
}

export function getTalentPointBalance(profile = null) {
  const source = profile || loadTalentProfile();
  return Math.max(0, Math.floor(Number(source?.unspentTalentPoints) || 0));
}

export function getAllTalentIdSet() {
  if (_cachedTalentIdSet) return _cachedTalentIdSet;
  const set = new Set();
  for (const nodes of Object.values(TALENT_TREE)) {
    for (const n of nodes) set.add(n.id);
  }
  _cachedTalentIdSet = set;
  return set;
}

export function getTalentNodeById(talentId) {
  if (_cachedTalentNodeMap) return _cachedTalentNodeMap.get(talentId) || null;
  const map = new Map();
  for (const [branchName, nodes] of Object.entries(TALENT_TREE)) {
    for (const node of nodes) {
      map.set(node.id, {
        ...node,
        branchName,
        attributeRequirements: { ...synthesizeAttributeRequirements(node, branchName) }
      });
    }
  }
  _cachedTalentNodeMap = map;
  return _cachedTalentNodeMap.get(talentId) || null;
}

export function getTalentBranchName(talentId) {
  return getTalentNodeById(talentId)?.branchName || null;
}

export function getTalentAttributeRequirements(talentId) {
  return { ...(getTalentNodeById(talentId)?.attributeRequirements || {}) };
}

export function getTalentRequirementFailures(talentId, attributes = null) {
  const reqs = getTalentAttributeRequirements(talentId);
  const attrs = attributes ? getProfileAttributes({ attributes }) : getProfileAttributes();
  const out = [];
  for (const [attributeId, requiredValue] of Object.entries(reqs)) {
    const have = Math.max(0, Number(attrs[attributeId]) || 0);
    const need = Math.max(0, Number(requiredValue) || 0);
    if (have < need) {
      out.push({ attributeId, required: need, current: have });
    }
  }
  return out;
}

export function meetsTalentAttributeRequirements(talentId, attributes = null) {
  return getTalentRequirementFailures(talentId, attributes).length === 0;
}

export function canPurchaseTalent(id, profile = null, purchasedOverride = null) {
  const purchased = purchasedOverride || getPurchasedTalents();
  if (purchased.includes(id)) return false;
  const node = getTalentNodeById(id);
  if (!node) return false;
  const talentPoints = getTalentPointBalance(profile);
  if (talentPoints < Math.max(0, Number(node.cost) || 0)) return false;
  if (!meetsTalentAttributeRequirements(id, profile?.attributes)) return false;
  const hasAll = (node.parentsAll || []).every((parentId) => purchased.includes(parentId));
  const hasAny = (node.parentsAny || []).length === 0 || (node.parentsAny || []).some((parentId) => purchased.includes(parentId));
  return hasAll && hasAny;
}

export function getPurchasedTalents() {
  try {
    const raw = localStorage.getItem(TALENTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function purchaseTalent(id, cost) {
  const purchased = getPurchasedTalents();
  if (purchased.includes(id)) return false;
  const node = getTalentNodeById(id);
  const finalCost = Math.max(0, Number(cost ?? node?.cost) || 0);
  const profile = loadTalentProfile();
  if (!canPurchaseTalent(id, profile, purchased)) return false;
  saveTalentProfile({
    ...profile,
    unspentTalentPoints: Math.max(0, getTalentPointBalance(profile) - finalCost)
  });
  purchased.push(id);
  localStorage.setItem(TALENTS_KEY, JSON.stringify(purchased));
  return true;
}

export function hasTalent(id, purchased) {
  if (purchased !== undefined) return Array.isArray(purchased) && purchased.includes(id);
  return getPurchasedTalents().includes(id);
}

export function canRefundTalent(talentId, purchased) {
  if (!purchased.includes(talentId)) return false;
  for (const nodes of Object.values(TALENT_TREE)) {
    const idx = nodes.findIndex((n) => n.id === talentId);
    if (idx === -1) continue;
    const isBranching = nodes.length > 0 && (nodes[0].parentsAll !== undefined || nodes[0].parentsAny !== undefined);
    if (isBranching) {
      for (const node of nodes) {
        if (node.id === talentId) continue;
        if (!purchased.includes(node.id)) continue;
        const parents = [...(node.parentsAll || []), ...(node.parentsAny || [])];
        if (parents.includes(talentId)) return false;
      }
      return true;
    }
    for (let j = idx + 1; j < nodes.length; j += 1) {
      if (purchased.includes(nodes[j].id)) return false;
    }
    return true;
  }
  return false;
}

export function refundTalent(talentId) {
  const purchased = getPurchasedTalents();
  if (!purchased.includes(talentId)) return false;
  const node = getTalentNodeById(talentId);
  const cost = Math.max(0, Number(node?.cost) || 0);
  if (!canRefundTalent(talentId, purchased)) return false;
  const next = purchased.filter((id) => id !== talentId);
  localStorage.setItem(TALENTS_KEY, JSON.stringify(next));
  const profile = loadTalentProfile();
  saveTalentProfile({
    ...profile,
    unspentTalentPoints: getTalentPointBalance(profile) + cost
  });
  return true;
}

export function refundBranch(branchName) {
  const nodes = TALENT_TREE[branchName];
  if (!nodes || !Array.isArray(nodes)) return 0;
  const branchIds = new Set(nodes.map((n) => n.id));
  let count = 0;
  let purchased = getPurchasedTalents();
  let inBranch = purchased.filter((id) => branchIds.has(id));
  while (inBranch.length > 0) {
    let refundedOne = false;
    for (const id of inBranch) {
      if (canRefundTalent(id, purchased)) {
        refundTalent(id);
        purchased = getPurchasedTalents();
        inBranch = purchased.filter((pid) => branchIds.has(pid));
        count += 1;
        refundedOne = true;
        break;
      }
    }
    if (!refundedOne) break;
  }
  return count;
}

export function getTalentRequirementSupportFailures(attributes, purchasedTalents = null) {
  const purchased = purchasedTalents || getPurchasedTalents();
  const out = [];
  for (const talentId of purchased) {
    const failures = getTalentRequirementFailures(talentId, attributes);
    if (failures.length > 0) {
      out.push({
        talentId,
        talentName: getTalentNodeById(talentId)?.name || talentId,
        failures
      });
    }
  }
  return out;
}

export function canSupportPurchasedTalents(attributes, purchasedTalents = null) {
  return getTalentRequirementSupportFailures(attributes, purchasedTalents).length === 0;
}
