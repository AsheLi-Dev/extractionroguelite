// -------- Friends Data --------
// Friend definitions, gift parameters, companion buffs, and gift pools

export const FRIENDS_CATALOG = {
  fennec_fox: {
    id: "fennec_fox",
    displayName: "Fennec Fox",
    iconKey: "spr_friend_fennec_fox",
    spritePath: "assets/images/Fox-Sprite.png",
    colorTheme: "#f97316",
    theme: "Speed / Crit / Aggression"
  },
  sea_otter: {
    id: "sea_otter",
    displayName: "Sea Otter",
    iconKey: "spr_friend_sea_otter",
    spritePath: "assets/images/Sea-Otter-Sprite.png",
    colorTheme: "#3b82f6",
    theme: "Craft / Economy / Utility"
  },
  capybara_calm: {
    id: "capybara_calm",
    displayName: "Capybara (Calm)",
    iconKey: "spr_friend_capybara_calm",
    spritePath: "assets/images/CalmCapybara-Sprite.png",
    colorTheme: "#22c55e",
    theme: "Defense / Sustain / Stability"
  },
  axolotl: {
    id: "axolotl",
    displayName: "Axolotl",
    iconKey: "spr_friend_axolotl",
    spritePath: "assets/images/Axolotl-Sprite.png",
    colorTheme: "#e0e7ff",
    theme: "Skill Damage / Precision / Control"
  },
  capybara_wild: {
    id: "capybara_wild",
    displayName: "Capybara (Wild)",
    iconKey: "spr_friend_capybara_wild",
    spritePath: "assets/images/WildCapybara-Sprite.png",
    colorTheme: "#ef4444",
    theme: "Momentum / Melee / Lifesteal"
  },
  ferret: {
    id: "ferret",
    displayName: "Ferret",
    iconKey: "spr_friend_ferret",
    spritePath: "assets/images/Ferret-Sprite.png",
    colorTheme: "#a855f7",
    theme: "Luck / Chaos / Duplication"
  },
  red_panda: {
    id: "red_panda",
    displayName: "Red Panda",
    iconKey: "spr_friend_red_panda",
    spritePath: "assets/Hub;Base/Companions/Red Panda Sprite Sheet.png",
    spriteSheetJson: "assets/Hub;Base/Companions/Red Panda Sprite Sheet.json",
    spriteRect: { x: 0, y: 0, w: 32, h: 32 },
    spriteSheetSize: { w: 256, h: 224 },
    colorTheme: "#dc2626",
    theme: "Balance / Versatility / Charm"
  }
};

export const FRIEND_IDS = Object.keys(FRIENDS_CATALOG);

// Gift parameters by level
export function getGiftParamsForLevel(level) {
  if (level < 3) return null;
  if (level === 3) {
    return { intervalMs: 7200000, giftsPerInterval: 1, cap: 8 }; // 2 hours
  }
  if (level === 4) {
    return { intervalMs: 3600000, giftsPerInterval: 1, cap: 10 }; // 1 hour
  }
  if (level === 5) {
    return { intervalMs: 3600000, giftsPerInterval: 2, cap: 16 }; // 1 hour, 2 gifts
  }
  return null;
}

// Companion buff scaling by level (2-5)
export const COMPANION_BUFFS = {
  fennec_fox: {
    2: { critChance: 0.08 },
    3: { critChance: 0.12 },
    4: { critChance: 0.15, moveSpeed: 0.05 },
    5: { critChance: 0.20, moveSpeed: 0.10 }
  },
  sea_otter: {
    2: { cubeDropRate: 0.10 },
    3: { cubeDropRate: 0.15 },
    4: { cubeDropRate: 0.20, pickupRadius: 0.10 },
    5: { cubeDropRate: 0.25, pickupRadius: 0.15 }
  },
  capybara_calm: {
    2: { damageReduction: 0.05 },
    3: { damageReduction: 0.08 },
    4: { damageReduction: 0.10, hpRegen: 0.01 },
    5: { damageReduction: 0.12, hpRegen: 0.02 }
  },
  axolotl: {
    2: { skillDamage: 0.10 },
    3: { skillDamage: 0.15 },
    4: { skillDamage: 0.20, skillCooldownReduction: 0.05 },
    5: { skillDamage: 0.25, skillCooldownReduction: 0.10 }
  },
  capybara_wild: {
    2: { meleeDamage: 0.10 },
    3: { meleeDamage: 0.15 },
    4: { meleeDamage: 0.20, lifesteal: 0.01 },
    5: { meleeDamage: 0.25, lifesteal: 0.02 }
  },
  ferret: {
    2: { dropDuplicateChance: 0.05 },
    3: { dropDuplicateChance: 0.08 },
    4: { dropDuplicateChance: 0.10, shopDiscount: 0.05 },
    5: { dropDuplicateChance: 0.15, shopDiscount: 0.10 }
  },
  red_panda: {
    2: { critChance: 0.04, damageReduction: 0.03 },
    3: { critChance: 0.06, damageReduction: 0.05 },
    4: { critChance: 0.08, damageReduction: 0.06, moveSpeed: 0.05 },
    5: { critChance: 0.10, damageReduction: 0.08, moveSpeed: 0.08 }
  }
};

// Gift preferences for sending gifts (loves/likes)
export const FRIEND_GIFT_PREFERENCES = {
  fennec_fox: {
    loves: [
      { type: "Helmet", weight: "light" },
      { type: "Weapon" }
    ],
    likes: [
      { type: "Body Armour", weight: "light" },
      { type: "Boots" }
    ]
  },
  sea_otter: {
    loves: [
      { type: "Cube" } // All craft cubes
    ],
    likes: [
      { type: "Helmet", weight: "heavy" },
      { type: "Body Armour", weight: "medium" }
    ]
  },
  capybara_calm: {
    loves: [
      { type: "Body Armour", weight: "heavy" },
      { type: "Boots" }
    ],
    likes: [
      { type: "Helmet", weight: "heavy" },
      { type: "Cube" } // Craft cubes
    ]
  },
  axolotl: {
    loves: [
      { type: "Weapon" },
      { type: "Body Armour", weight: "light" }
    ],
    likes: [
      { type: "Helmet", weight: "light" },
      { type: "Helmet", weight: "medium" }
    ]
  },
  capybara_wild: {
    loves: [
      { type: "Weapon" },
      { type: "Body Armour", weight: "heavy" },
      { type: "Helmet", weight: "heavy" }
    ],
    likes: [
      { type: "Helmet", weight: "medium" },
      { type: "Boots" }
    ]
  },
  ferret: {
    loves: [
      { type: "Boots" },
      { type: "Body Armour", weight: "light" }
    ],
    likes: [
      { type: "Helmet", weight: "light" },
      { type: "Helmet", weight: "medium" }
    ]
  },
  red_panda: {
    loves: [
      { type: "Weapon" },
      { type: "Body Armour", weight: "medium" }
    ],
    likes: [
      { type: "Helmet", weight: "medium" },
      { type: "Boots" }
    ]
  }
};

// Gift pools per friend (common/uncommon/rare)
// Using placeholder item structures compatible with existing loot system
export const FRIEND_GIFT_POOLS = {
  fennec_fox: {
    common: [
      { type: "Boots", weight: "light", rarity: "common" },
      { type: "Boots", weight: "light", rarity: "magic" }
    ],
    uncommon: [
      { type: "Boots", weight: "light", rarity: "magic" },
      { type: "Weapon", rarity: "magic" }
    ],
    rare: [
      { type: "Boots", weight: "light", rarity: "rare" },
      { type: "Weapon", rarity: "rare" }
    ]
  },
  sea_otter: {
    common: [
      { type: "Cube", cubeKey: "attackCube" },
      { type: "Cube", cubeKey: "speedCube" }
    ],
    uncommon: [
      { type: "Cube", cubeKey: "healthCube" },
      { type: "Cube", cubeKey: "defenseCube" }
    ],
    rare: [
      { type: "Cube", cubeKey: "rareCube" },
      { type: "Cube", cubeKey: "vesselCube" }
    ]
  },
  capybara_calm: {
    common: [
      { type: "Body Armour", weight: "heavy", rarity: "common" },
      { type: "Helmet", weight: "heavy", rarity: "common" }
    ],
    uncommon: [
      { type: "Body Armour", weight: "heavy", rarity: "magic" },
      { type: "Helmet", weight: "heavy", rarity: "magic" }
    ],
    rare: [
      { type: "Body Armour", weight: "heavy", rarity: "rare" },
      { type: "Helmet", weight: "heavy", rarity: "rare" }
    ]
  },
  axolotl: {
    common: [
      { type: "Weapon", rarity: "common" },
      { type: "Weapon", rarity: "magic" }
    ],
    uncommon: [
      { type: "Weapon", rarity: "magic" },
      { type: "Cube", cubeKey: "powerCube" }
    ],
    rare: [
      { type: "Weapon", rarity: "rare" },
      { type: "Cube", cubeKey: "focusCube" }
    ]
  },
  capybara_wild: {
    common: [
      { type: "Weapon", rarity: "common" },
      { type: "Weapon", rarity: "magic" }
    ],
    uncommon: [
      { type: "Weapon", rarity: "magic" },
      { type: "Cube", cubeKey: "attackCube" }
    ],
    rare: [
      { type: "Weapon", rarity: "rare" },
      { type: "Cube", cubeKey: "rareCube" }
    ]
  },
  ferret: {
    common: [
      { type: "Cube", cubeKey: "reforgeCube" },
      { type: "Cube", cubeKey: "magicCube" }
    ],
    uncommon: [
      { type: "Cube", cubeKey: "reforgeCube" },
      { type: "Cube", cubeKey: "rareCube" }
    ],
    rare: [
      { type: "Cube", cubeKey: "reforgeCube" },
      { type: "Cube", cubeKey: "vesselCube" }
    ]
  },
  red_panda: {
    common: [
      { type: "Weapon", rarity: "common" },
      { type: "Boots", weight: "light", rarity: "common" }
    ],
    uncommon: [
      { type: "Weapon", rarity: "magic" },
      { type: "Body Armour", weight: "medium", rarity: "magic" }
    ],
    rare: [
      { type: "Weapon", rarity: "rare" },
      { type: "Cube", cubeKey: "rareCube" }
    ]
  }
};
