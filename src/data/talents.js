import { LEGACY_POINTS_KEY, TALENTS_KEY, getLegacyPoints, addLegacyPoints } from './constants.js';

export const TALENT_TREE = {
  Warrior: [
    // Tier 1 roots
    { id: "fierce", cost: 1, name: "Fierce", tier: 1, desc: "+10% attack damage.", parentsAll: [], parentsAny: [] },
    { id: "rapid", cost: 1, name: "Rapid", tier: 1, desc: "+10% attack speed.", parentsAll: [], parentsAny: [] },
    { id: "resilient", cost: 1, name: "Resilient", tier: 1, desc: "+10% max health.", parentsAll: [], parentsAny: [] },
    // Tier 2
    { id: "bloodthirst", cost: 2, name: "Bloodthirst", tier: 2, desc: "Kills restore 3% of your max health.", parentsAll: ["fierce"], parentsAny: [] },
    { id: "predator", cost: 2, name: "Predator", tier: 2, desc: "Enemies below 25% health take greatly increased damage.", parentsAll: [], parentsAny: ["fierce", "rapid"] },
    { id: "reflexes", cost: 2, name: "Reflexes", tier: 2, desc: "Reduces dash cooldown by 0.1 seconds.", parentsAll: [], parentsAny: ["rapid", "resilient"] },
    { id: "ironWill", cost: 2, name: "Iron Will", tier: 2, desc: "Permanent 20 HP shield that regenerates 5s after breaking.", parentsAll: ["resilient"], parentsAny: [] },
    // Tier 3
    { id: "frenzy", cost: 3, name: "Frenzy", tier: 3, desc: "Every 4th consecutive attack grants 3s of 30% increased attack speed.", parentsAll: ["bloodthirst"], parentsAny: [] },
    { id: "executioner", cost: 3, name: "Executioner", tier: 3, desc: "Skills deal 25% increased damage and you deal more damage to low-health enemies.", parentsAll: [], parentsAny: ["bloodthirst", "predator"] },
    { id: "battleScarred", cost: 3, name: "Battle Scarred", tier: 3, desc: "Taking damage grants +10% attack damage for 5s, stacking up to 3 times.", parentsAll: [], parentsAny: ["predator", "reflexes"] },
    { id: "endurance", cost: 3, name: "Endurance", tier: 3, desc: "After dashing gain 15% damage reduction for 3 seconds.", parentsAll: [], parentsAny: ["reflexes", "ironWill"] },
    { id: "fortress", cost: 3, name: "Fortress", tier: 3, desc: "Each equipped armour piece grants +5% damage.", parentsAll: ["ironWill"], parentsAny: [] },
    // Tier 4 keystones
    { id: "berserkerRage", cost: 4, name: "Berserker's Rage", tier: 4, desc: "Below 40% health gain +40% attack damage, +20% attack speed and +15% movement speed.", parentsAll: [], parentsAny: ["frenzy", "executioner"] },
    { id: "warlord", cost: 4, name: "Warlord", tier: 4, desc: "Mini-bosses always drop one extra rare item and bosses grant a high-quality weapon.", parentsAll: [], parentsAny: ["executioner", "battleScarred"] },
    { id: "secondWind", cost: 4, name: "Second Wind", tier: 4, desc: "Once per run survive a killing blow and periodically refresh skill cooldowns.", parentsAll: [], parentsAny: ["battleScarred", "endurance"] },
    { id: "immortal", cost: 5, name: "Immortal", tier: 4, desc: "Once per run, survive a lethal hit at 1 HP and gain brief total damage reduction.", parentsAll: [], parentsAny: ["endurance", "fortress"] }
  ],
  Survivalist: [
    // Tier 1 roots
    { id: "fortitude", cost: 1, name: "Fortitude", tier: 1, desc: "+10% max health.", parentsAll: [], parentsAny: [] },
    { id: "bulwark", cost: 1, name: "Bulwark", tier: 1, desc: "+10% defense.", parentsAll: [], parentsAny: [] },
    { id: "nimble", cost: 1, name: "Nimble", tier: 1, desc: "+5% movement speed.", parentsAll: [], parentsAny: [] },
    // Tier 2
    { id: "vitality", cost: 2, name: "Vitality", tier: 2, desc: "Regenerate 20% max health after entering a new map.", parentsAll: ["fortitude"], parentsAny: [] },
    { id: "thickSkin", cost: 2, name: "Thick Skin", tier: 2, desc: "+15% max health and +10% defense.", parentsAll: [], parentsAny: ["fortitude", "bulwark"] },
    { id: "toughness", cost: 2, name: "Toughness", tier: 2, desc: "First three hits on each new map deal 40% reduced damage.", parentsAll: [], parentsAny: ["bulwark", "nimble"] },
    { id: "fleetFooted", cost: 2, name: "Fleet Footed", tier: 2, desc: "When health is below 50%, movement speed increased by an additional 10%.", parentsAll: ["nimble"], parentsAny: [] },
    // Tier 3
    { id: "lifebloom", cost: 3, name: "Lifebloom", tier: 3, desc: "Heal 5% of a killed enemy's max health on kill.", parentsAll: ["vitality"], parentsAny: [] },
    { id: "secondBreath", cost: 3, name: "Second Breath", tier: 3, desc: "Once per map when health drops below 15%, instantly regenerate 25% max health.", parentsAll: [], parentsAny: ["vitality", "thickSkin"] },
    { id: "retaliation", cost: 3, name: "Retaliation", tier: 3, desc: "Taking damage grants +8% attack damage for 4s, stacking up to 4 times.", parentsAll: [], parentsAny: ["thickSkin", "toughness"] },
    { id: "evasion", cost: 3, name: "Evasion", tier: 3, desc: "Each dash has 15% chance to leave a decoy that distracts nearby enemies for 2s.", parentsAll: [], parentsAny: ["toughness", "fleetFooted"] },
    { id: "shadowStep", cost: 3, name: "Shadow Step", tier: 3, desc: "Leave a toxic area along the dash path dealing 10% of your max health as damage per second for 2s.", parentsAll: ["fleetFooted"], parentsAny: [] },
    // Tier 4 keystones
    { id: "undyingResolve", cost: 4, name: "Undying Resolve", tier: 4, desc: "Permanently +10% max health each time a mini-boss is defeated during the run.", parentsAll: [], parentsAny: ["lifebloom", "secondBreath"] },
    { id: "livingFortress", cost: 4, name: "Living Fortress", tier: 4, desc: "Every 8s gain a shield equal to 15% max health; when broken releases a shockwave dealing 120% attack to nearby enemies.", parentsAll: [], parentsAny: ["secondBreath", "retaliation"] },
    { id: "ghostForm", cost: 4, name: "Ghost Form", tier: 4, desc: "After taking damage become untargetable for 0.8s, once every 6s max.", parentsAll: [], parentsAny: ["retaliation", "evasion"] },
    { id: "untouchable", cost: 5, name: "Untouchable", tier: 4, desc: "Each dash that avoids damage during i-frames permanently reduces incoming damage by 1% (stacking up to 20%, max 20% reduction).", parentsAll: [], parentsAny: ["evasion", "shadowStep"] }
  ],
  Scavenger: [
    // Tier 1
    { id: "arcaneEye", cost: 1, name: "Arcane Eye", tier: 1, desc: "+20% increased amount of loot from searchables.", parentsAll: [], parentsAny: [] },
    { id: "swiftExtraction", cost: 1, name: "Swift Extraction", tier: 1, desc: "Reduces dash cooldown by 0.1 seconds.", parentsAll: [], parentsAny: [] },
    { id: "keenEye", cost: 1, name: "Keen Eye", tier: 1, desc: "+15% increased drop rate of equipment items.", parentsAll: [], parentsAny: [] },
    // Tier 2
    { id: "cardHoarder", cost: 2, name: "Loot Hoarder", tier: 2, desc: "After finishing a searchable, enemy loot drop rate is increased by 20% for 10 seconds.", parentsAll: ["arcaneEye"], parentsAny: [] },
    { id: "socketMastery", cost: 2, name: "Vessel Mastery", tier: 2, desc: "Vessel Cubes found during a run have a 20% chance to add 2 vessels instead of 1.", parentsAll: ["swiftExtraction"], parentsAny: [] },
    { id: "secureFooting", cost: 2, name: "Secure Footing", tier: 2, desc: "Picking up a magic or rare item instantly refreshes dash cooldown.", parentsAll: [], parentsAny: ["swiftExtraction", "keenEye"] },
    { id: "itemSense", cost: 2, name: "Item Sense", tier: 2, desc: "Picking up a magic item slows nearby enemies for 0.5 seconds.", parentsAll: ["keenEye"], parentsAny: [] },
    // Tier 3
    { id: "synergyMaster", cost: 3, name: "Synergy Master", tier: 3, desc: "6% increased damage for each skill with at least one modification card socketed; 10% per skill when all active skill slots have at least one modification card socketed.", parentsAll: ["cardHoarder"], parentsAny: [] },
    { id: "cardSurge", cost: 3, name: "Loot Surge", tier: 3, desc: "Picking up any loot grants 20% increased movement speed and attack speed for 3 seconds.", parentsAll: [], parentsAny: ["cardHoarder"] },
    { id: "ghostLooter", cost: 3, name: "Ghost Looter", tier: 3, desc: "Player is untargetable for 0.5 seconds when picking up any loot item.", parentsAll: [], parentsAny: ["secureFooting"] },
    { id: "treasureSense", cost: 3, name: "Treasure Sense", tier: 3, desc: "Faint arrows point toward searchable objects on the map.", parentsAll: [], parentsAny: ["secureFooting", "itemSense"] },
    { id: "appraiser", cost: 3, name: "Appraiser", tier: 3, desc: "Blue and yellow items dropped by enemies always have at least one modifier rolled at 35% or higher.", parentsAll: ["itemSense"], parentsAny: [] },
    // Tier 4
    { id: "cardTranscendence", cost: 4, name: "Loot Transcendence", tier: 4, desc: "On extraction: normal items have 20% chance to become magic with +2 random modifiers; magic items have 10% chance to become rare with +2 random modifiers.", parentsAll: [], parentsAny: ["synergyMaster", "cardSurge"] },
    { id: "phantomExtractor", cost: 4, name: "Phantom Extractor", tier: 4, desc: "Player is fully invisible and invincible for 3 seconds after picking up a rare or higher quality item (once every 20 seconds maximum).", parentsAll: [], parentsAny: ["cardSurge", "ghostLooter"] },
    { id: "vaultMaster", cost: 4, name: "Vault Master", tier: 4, desc: "In inventory, secure up to 3 items; secured items are sent to Legacy Vault on death.", parentsAll: [], parentsAny: ["ghostLooter", "treasureSense"] },
    { id: "curator", cost: 5, name: "Curator", tier: 4, desc: "On extraction: T1 cubes in inventory have 20% chance to become T2; T2 cubes have 10% chance to become T3.", parentsAll: [], parentsAny: ["treasureSense", "appraiser"] }
  ],
  Tinkerer: [
    // Tier 1 roots
    { id: "cubeMagnet", cost: 1, name: "Cube Magnet", tier: 1, desc: "+20% increased drop rate of all modifier and upgrade cubes.", parentsAll: [], parentsAny: [] },
    { id: "socketSense", cost: 1, name: "Vessel Sense", tier: 1, desc: "+20% increased chance for dropped equipment to have at least one vessel.", parentsAll: [], parentsAny: [] },
    { id: "transmuter", cost: 1, name: "Transmuter", tier: 1, desc: "+20% increased drop rate of Magic and Rare upgrade cubes.", parentsAll: [], parentsAny: [] },
    // Tier 2
    { id: "cubeExpert", cost: 2, name: "Cube Expert", tier: 2, desc: "Automatically upgrades all Tier 1 modifier cubes found during a run to Tier 2.", parentsAll: ["cubeMagnet"], parentsAny: [] },
    { id: "tinkerersEye", cost: 2, name: "Tinkerer's Eye", tier: 2, desc: "15% chance to find one additional random cube of the same tier when picking up any cube or vessel cube.", parentsAll: [], parentsAny: ["cubeMagnet", "socketSense"] },
    { id: "socketFinder", cost: 2, name: "Vessel Finder", tier: 2, desc: "Chance for a Vessel Workshop to appear somewhere on the map; interact to add one vessel to any item.", parentsAll: [], parentsAny: ["socketSense", "transmuter"] },
    { id: "qualityEye", cost: 2, name: "Quality Eye", tier: 2, desc: "Blue items dropped by enemies always have at least one modifier rolled at 30% or higher.", parentsAll: ["transmuter"], parentsAny: [] },
    // Tier 3
    { id: "forgeMastery", cost: 3, name: "Forge Mastery", tier: 3, desc: "When the boss is defeated on Difficulty 5 there is a 10% chance for a Foresight Shrine to appear. Interacting adds a Foresight modifier to one item to preview the next craft before confirming.", parentsAll: ["cubeExpert"], parentsAny: [] },
    { id: "cubeCascade", cost: 3, name: "Cube Cascade", tier: 3, desc: "Every crafting cube has a 10% chance to not be consumed when used.", parentsAll: [], parentsAny: ["cubeExpert", "tinkerersEye"] },
    { id: "tinkererSocketMastery", cost: 3, name: "Vessel Mastery", tier: 3, desc: "When applying a Vessel Cube to a rare item that already has exactly 1 vessel there is a 5% chance to add 2 additional vessels instead of 1 (total 3 vessels).", parentsAll: [], parentsAny: ["tinkerersEye", "socketFinder"] },
    { id: "rarityRush", cost: 3, name: "Rarity Rush", tier: 3, desc: "When the player defeats a mini-boss on Difficulty 3 or higher there is a 5% chance for a random legendary cube to drop.", parentsAll: [], parentsAny: ["socketFinder", "qualityEye"] },
    { id: "transmutation", cost: 3, name: "Transmutation", tier: 3, desc: "When upgrading a magic item to rare using a Rare Cube there is a 5% chance to add 3 additional modifiers instead of 2 (max 5 modifiers on that item).", parentsAll: ["qualityEye"], parentsAny: [] },
    // Tier 4 keystones
    { id: "perfectCraft", cost: 4, name: "Perfect Craft", tier: 4, desc: "When the boss is defeated on Difficulty 5 there is a 5% chance for a Perfection Workshop to appear. Interact to choose one item and reroll one random modifier to 4550%.", parentsAll: [], parentsAny: ["forgeMastery", "cubeCascade"] },
    { id: "grandSocketeer", cost: 4, name: "Grand Socketeer", tier: 4, desc: "All modification cards socketed into skill slots have 50% increased effects.", parentsAll: [], parentsAny: ["cubeCascade", "tinkererSocketMastery"] },
    { id: "livingItem", cost: 4, name: "Living Item", tier: 4, desc: "Before starting a run select one white item from the Legacy Vault as Living Item. It gains one random modifier per mini-boss and two per boss (max 6). Cannot be modified by cubes.", parentsAll: [], parentsAny: ["tinkererSocketMastery", "rarityRush"] },
    { id: "philosophersStone", cost: 5, name: "Philosopher's Stone", tier: 4, desc: "Mini-bosses have a 5% chance to drop a legendary orange item with two legendary affixes and two random modifiers.", parentsAll: [], parentsAny: ["rarityRush", "transmutation"] }
  ]
};

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
  const lp = getLegacyPoints();
  if (lp < cost) return false;
  addLegacyPoints(-cost);
  purchased.push(id);
  localStorage.setItem(TALENTS_KEY, JSON.stringify(purchased));
  return true;
}

export function hasTalent(id) {
  return getPurchasedTalents().includes(id);
}

export function canRefundTalent(talentId, purchased) {
  if (!purchased.includes(talentId)) return false;
  for (const [branchName, nodes] of Object.entries(TALENT_TREE)) {
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
    for (let j = idx + 1; j < nodes.length; j++) {
      if (purchased.includes(nodes[j].id)) return false;
    }
    return true;
  }
  return false;
}

export function refundTalent(talentId) {
  const purchased = getPurchasedTalents();
  if (!purchased.includes(talentId)) return false;
  let cost = 0;
  for (const nodes of Object.values(TALENT_TREE)) {
    const node = nodes.find((n) => n.id === talentId);
    if (node) {
      cost = node.cost;
      break;
    }
  }
  if (cost === 0) return false;
  if (!canRefundTalent(talentId, purchased)) return false;
  addLegacyPoints(cost);
  const next = purchased.filter((id) => id !== talentId);
  localStorage.setItem(TALENTS_KEY, JSON.stringify(next));
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
        count++;
        refundedOne = true;
        break;
      }
    }
    if (!refundedOne) break;
  }
  return count;
}
