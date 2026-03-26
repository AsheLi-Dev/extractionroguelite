export const FOREST_NODE_TIERS = Object.freeze({
  CALM: "calm",
  RISKY: "risky",
  DEADLY: "deadly",
});

export const FOREST_VARIANTS = Object.freeze({
  WOODS: "woods",
  SWAMP: "swamp",
  MAGIC_FOREST: "magic_forest",
  SHALLOW_SPIDER_HABITAT: "shallow_spider_habitat",
  DEAD_FOREST: "dead_forest",
  DEEP_SPIDER_HABITAT: "deep_spider_habitat",
});

export const FOREST_VARIANTS_BY_NODE_TIER = Object.freeze({
  [FOREST_NODE_TIERS.CALM]: Object.freeze([
    FOREST_VARIANTS.WOODS,
    FOREST_VARIANTS.SWAMP,
  ]),
  [FOREST_NODE_TIERS.RISKY]: Object.freeze([
    FOREST_VARIANTS.MAGIC_FOREST,
    FOREST_VARIANTS.SHALLOW_SPIDER_HABITAT,
  ]),
  [FOREST_NODE_TIERS.DEADLY]: Object.freeze([
    FOREST_VARIANTS.DEAD_FOREST,
    FOREST_VARIANTS.DEEP_SPIDER_HABITAT,
  ]),
});

const DEFAULT_TREE_SPRITES = Object.freeze([
  "assets/Environments/1. OpenWorld/4.SingleObj/Trees/treeBB_01.png",
  "assets/Environments/1. OpenWorld/4.SingleObj/Trees/treeBB_02.png",
  "assets/Environments/1. OpenWorld/4.SingleObj/Trees/treeBB_03.png",
  "assets/Environments/1. OpenWorld/4.SingleObj/Trees/treeBB_04.png",
  "assets/Environments/1. OpenWorld/4.SingleObj/Trees/treeBB_05.png",
  "assets/Environments/1. OpenWorld/4.SingleObj/Trees/treeBB_06.png",
  "assets/Environments/1. OpenWorld/4.SingleObj/Trees/treeBB_07.png",
  "assets/Environments/1. OpenWorld/4.SingleObj/Trees/treeBB_08.png",
]);

const MAGIC_FOREST_TREE_SPRITES = Object.freeze([
  "assets/Environments/1. OpenWorld/4.SingleObj/Trees/treeAA_01.png",
  "assets/Environments/1. OpenWorld/4.SingleObj/Trees/treeAA_02.png",
  "assets/Environments/1. OpenWorld/4.SingleObj/Trees/treeAA_03.png",
  "assets/Environments/1. OpenWorld/4.SingleObj/Trees/treeAA_04.png",
  "assets/Environments/1. OpenWorld/4.SingleObj/Trees/treeAA_05.png",
  "assets/Environments/1. OpenWorld/4.SingleObj/Trees/treeAA_06.png",
  "assets/Environments/1. OpenWorld/4.SingleObj/Trees/treeAA_07.png",
]);

const SHALLOW_SPIDER_HABITAT_TREE_SPRITES = Object.freeze([
  "assets/Environments/1. OpenWorld/4.SingleObj/Trees/treeC_01.png",
  "assets/Environments/1. OpenWorld/4.SingleObj/Trees/treeC_02.png",
  "assets/Environments/1. OpenWorld/4.SingleObj/Trees/treeC_03.png",
  "assets/Environments/1. OpenWorld/4.SingleObj/Trees/treeC_04.png",
  "assets/Environments/1. OpenWorld/4.SingleObj/Trees/treeC_05.png",
  "assets/Environments/1. OpenWorld/4.SingleObj/Trees/treeC_06.png",
  "assets/Environments/1. OpenWorld/4.SingleObj/Trees/treeC_07.png",
  "assets/Environments/1. OpenWorld/4.SingleObj/Trees/treeC_08.png",
  "assets/Environments/1. OpenWorld/4.SingleObj/Trees/treeC_09.png",
  "assets/Environments/1. OpenWorld/4.SingleObj/Trees/treeC_10.png",
  "assets/Environments/1. OpenWorld/4.SingleObj/Trees/treeC_11.png",
]);

const DEEP_SPIDER_HABITAT_TREE_SPRITES = Object.freeze([
  "assets/Environments/1. OpenWorld/4.SingleObj/Trees/treeCC_01.png",
  "assets/Environments/1. OpenWorld/4.SingleObj/Trees/treeCC_02.png",
  "assets/Environments/1. OpenWorld/4.SingleObj/Trees/treeCC_03.png",
  "assets/Environments/1. OpenWorld/4.SingleObj/Trees/treeCC_04.png",
  "assets/Environments/1. OpenWorld/4.SingleObj/Trees/treeCC_05.png",
  "assets/Environments/1. OpenWorld/4.SingleObj/Trees/treeCC_06.png",
  "assets/Environments/1. OpenWorld/4.SingleObj/Trees/treeCC_07.png",
  "assets/Environments/1. OpenWorld/4.SingleObj/Trees/treeCC_08.png",
  "assets/Environments/1. OpenWorld/4.SingleObj/Trees/treeCC_09.png",
  "assets/Environments/1. OpenWorld/4.SingleObj/Trees/treeCC_10.png",
  "assets/Environments/1. OpenWorld/4.SingleObj/Trees/treeCC_11.png",
]);

const SWAMP_TREE_SPRITES = Object.freeze([
  "assets/Environments/1. OpenWorld/4.SingleObj/Trees/treeAAAA_01.png",
  "assets/Environments/1. OpenWorld/4.SingleObj/Trees/treeAAAA_02.png",
  "assets/Environments/1. OpenWorld/4.SingleObj/Trees/treeAAAA_03.png",
  "assets/Environments/1. OpenWorld/4.SingleObj/Trees/treeAAAA_04.png",
  "assets/Environments/1. OpenWorld/4.SingleObj/Trees/treeAAAA_05.png",
  "assets/Environments/1. OpenWorld/4.SingleObj/Trees/treeAAAA_06.png",
  "assets/Environments/1. OpenWorld/4.SingleObj/Trees/treeAAAA_07.png",
  "assets/Environments/1. OpenWorld/4.SingleObj/Trees/treeAAAA_08.png",
  "assets/Environments/1. OpenWorld/4.SingleObj/Trees/treeAAAA_09.png",
]);

const WOODS_TREE_SPRITES = Object.freeze([
  "assets/Environments/1. OpenWorld/4.SingleObj/Trees/treeBB_01.png",
  "assets/Environments/1. OpenWorld/4.SingleObj/Trees/treeBB_02.png",
  "assets/Environments/1. OpenWorld/4.SingleObj/Trees/treeBB_03.png",
  "assets/Environments/1. OpenWorld/4.SingleObj/Trees/treeBB_04.png",
  "assets/Environments/1. OpenWorld/4.SingleObj/Trees/treeBB_05.png",
  "assets/Environments/1. OpenWorld/4.SingleObj/Trees/treeBB_06.png",
  "assets/Environments/1. OpenWorld/4.SingleObj/Trees/treeBB_07.png",
  "assets/Environments/1. OpenWorld/4.SingleObj/Trees/treeBB_08.png",
]);

const DEAD_FOREST_TREE_SPRITES = Object.freeze([
  "assets/Environments/1. OpenWorld/4.SingleObj/Trees/treeE_01.png",
  "assets/Environments/1. OpenWorld/4.SingleObj/Trees/treeE_02.png",
  "assets/Environments/1. OpenWorld/4.SingleObj/Trees/treeE_03.png",
  "assets/Environments/1. OpenWorld/4.SingleObj/Trees/treeE_04.png",
  "assets/Environments/1. OpenWorld/4.SingleObj/Trees/treeE_05.png",
  "assets/Environments/1. OpenWorld/4.SingleObj/Trees/treeE_06.png",
  "assets/Environments/1. OpenWorld/4.SingleObj/Trees/treeE_07.png",
]);

const DEFAULT_TREE_VAULT_SPRITES = Object.freeze([
  "assets/Environments/1. OpenWorld/4.SingleObj/Trees/treeB_01.png",
  "assets/Environments/1. OpenWorld/4.SingleObj/Trees/treeB_02.png",
  "assets/Environments/1. OpenWorld/4.SingleObj/Trees/treeB_03.png",
  "assets/Environments/1. OpenWorld/4.SingleObj/Trees/treeB_04.png",
]);

const DEFAULT_ROCK_SPRITES = Object.freeze([
  "assets/Environments/1. OpenWorld/4.SingleObj/Decorative/Rocks/rockAA_01.png",
  "assets/Environments/1. OpenWorld/4.SingleObj/Decorative/Rocks/rockAA_02.png",
  "assets/Environments/1. OpenWorld/4.SingleObj/Decorative/Rocks/rockAA_03.png",
  "assets/Environments/1. OpenWorld/4.SingleObj/Decorative/Rocks/rockAA_04.png",
  "assets/Environments/1. OpenWorld/4.SingleObj/Decorative/Rocks/rockAA_05.png",
  "assets/Environments/1. OpenWorld/4.SingleObj/Decorative/Rocks/rockAA_06.png",
  "assets/Environments/1. OpenWorld/4.SingleObj/Decorative/Rocks/rockAA_07.png",
  "assets/Environments/1. OpenWorld/4.SingleObj/Decorative/Rocks/rockAA_08.png",
]);

const DEFAULT_VAULT_ROCK_SPRITES = Object.freeze([
  "assets/Environments/1. OpenWorld/4.SingleObj/Special/monC_01.png",
  "assets/Environments/1. OpenWorld/4.SingleObj/Special/monC_02.png",
]);

export const FOREST_VARIANT_ENEMY_POOLS = Object.freeze({
  /** Universal enemy-category ratios for forest variants. */
  __categoryWeights: Object.freeze({
    common: 0.65,
    support: 0.20,
    threat: 0.10,
    rare: 0.05,
  }),
  default_forest_pool: Object.freeze({
    id: "default_forest_pool",
    categories: Object.freeze({
      common: Object.freeze({ weight: 0.65, enemies: Object.freeze([]) }),
      support: Object.freeze({ weight: 0.20, enemies: Object.freeze([]) }),
      threat: Object.freeze({ weight: 0.10, enemies: Object.freeze([]) }),
      rare: Object.freeze({ weight: 0.05, enemies: Object.freeze([]) }),
    }),
    enemies: Object.freeze([]),
  }),
  woods_pool: Object.freeze({
    id: "woods_pool",
    /**
     * Structured pool for future spawn routing.
     * Categories are tuned to total ~100% for woods (weights are relative, not yet used by runtime).
     */
    categories: Object.freeze({
      common: Object.freeze({
        weight: 0.65,
        enemies: Object.freeze([
          Object.freeze({ enemyTypeId: "m_1c_goblin", name: "Goblin" }),
          Object.freeze({ enemyTypeId: "m_1a_orc", name: "Orc" }),
          Object.freeze({ enemyTypeId: "m_3e_medium_slime", name: "Medium Slime" }),
          Object.freeze({ enemyTypeId: "m_5s_small_frog", name: "Small Frog" }),
        ]),
      }),
      support: Object.freeze({
        weight: 0.20,
        enemies: Object.freeze([
          Object.freeze({ enemyTypeId: "m_1f_goblin_archer", name: "Goblin Archer" }),
          Object.freeze({ enemyTypeId: "m_1g_goblin_mage", name: "Goblin Mage" }),
          Object.freeze({ enemyTypeId: "m_3a_small_slime", name: "Small Slime" }),
        ]),
      }),
      threat: Object.freeze({
        weight: 0.10,
        enemies: Object.freeze([
          Object.freeze({ enemyTypeId: "m_3b_big_slime", name: "Big Slime" }),
          Object.freeze({ enemyTypeId: "m_2c_troll", name: "Troll" }),
        ]),
      }),
      rare: Object.freeze({
        weight: 0.05,
        enemies: Object.freeze([
          Object.freeze({ enemyTypeId: "m_6d_cultist", name: "Cultist" }),
          Object.freeze({ enemyTypeId: "m_5u_cyclop_archer", name: "Cyclop Archer" }),
        ]),
      }),
    }),
    /** Convenience flattening (safe fallback for older consumers). */
    enemies: Object.freeze([
      "m_1c_goblin",
      "m_1a_orc",
      "m_3e_medium_slime",
      "m_5s_small_frog",
      "m_1f_goblin_archer",
      "m_1g_goblin_mage",
      "m_3a_small_slime",
      "m_3b_big_slime",
      "m_2c_troll",
      "m_6d_cultist",
      "m_5u_cyclop_archer",
    ]),
  }),
  swamp_pool: Object.freeze({
    id: "swamp_pool",
    categories: Object.freeze({
      common: Object.freeze({
        weight: 0.65,
        enemies: Object.freeze([
          Object.freeze({ enemyTypeId: "m_5s_small_frog", name: "Small Frog" }),
          Object.freeze({ enemyTypeId: "m_3a_small_slime", name: "Small Slime" }),
          Object.freeze({ enemyTypeId: "m_1c_goblin", name: "Goblin" }),
        ]),
      }),
      support: Object.freeze({
        weight: 0.20,
        enemies: Object.freeze([
          Object.freeze({ enemyTypeId: "m_3e_medium_slime", name: "Medium Slime" }),
          Object.freeze({ enemyTypeId: "m_1f_goblin_archer", name: "Goblin Archer" }),
          Object.freeze({ enemyTypeId: "m_1a_orc", name: "Orc" }),
        ]),
      }),
      threat: Object.freeze({
        weight: 0.10,
        enemies: Object.freeze([
          Object.freeze({ enemyTypeId: "m_3b_big_slime", name: "Big Slime" }),
          Object.freeze({ enemyTypeId: "m_2c_troll", name: "Troll" }),
        ]),
      }),
      rare: Object.freeze({
        weight: 0.05,
        enemies: Object.freeze([
          Object.freeze({ enemyTypeId: "m_7i_giant_spider", name: "Giant Spider" }),
          Object.freeze({ enemyTypeId: "m_8c_rock_golem", name: "Rock Golem" }),
        ]),
      }),
    }),
    /** Convenience flattening (safe fallback for older consumers). */
    enemies: Object.freeze([
      "m_5s_small_frog",
      "m_3a_small_slime",
      "m_1c_goblin",
      "m_3e_medium_slime",
      "m_1f_goblin_archer",
      "m_1a_orc",
      "m_3b_big_slime",
      "m_2c_troll",
      "m_7i_giant_spider",
      "m_8c_rock_golem",
    ]),
  }),
  magic_forest_pool: Object.freeze({
    id: "magic_forest_pool",
    categories: Object.freeze({
      common: Object.freeze({ weight: 0.65, enemies: Object.freeze([]) }),
      support: Object.freeze({ weight: 0.20, enemies: Object.freeze([]) }),
      threat: Object.freeze({ weight: 0.10, enemies: Object.freeze([]) }),
      rare: Object.freeze({ weight: 0.05, enemies: Object.freeze([]) }),
    }),
    enemies: Object.freeze([]),
  }),
  shallow_spider_pool: Object.freeze({
    id: "shallow_spider_pool",
    categories: Object.freeze({
      common: Object.freeze({ weight: 0.65, enemies: Object.freeze([]) }),
      support: Object.freeze({ weight: 0.20, enemies: Object.freeze([]) }),
      threat: Object.freeze({ weight: 0.10, enemies: Object.freeze([]) }),
      rare: Object.freeze({ weight: 0.05, enemies: Object.freeze([]) }),
    }),
    enemies: Object.freeze([]),
  }),
  dead_forest_pool: Object.freeze({
    id: "dead_forest_pool",
    categories: Object.freeze({
      common: Object.freeze({ weight: 0.65, enemies: Object.freeze([]) }),
      support: Object.freeze({ weight: 0.20, enemies: Object.freeze([]) }),
      threat: Object.freeze({ weight: 0.10, enemies: Object.freeze([]) }),
      rare: Object.freeze({ weight: 0.05, enemies: Object.freeze([]) }),
    }),
    enemies: Object.freeze([]),
  }),
  deep_spider_pool: Object.freeze({
    id: "deep_spider_pool",
    categories: Object.freeze({
      common: Object.freeze({ weight: 0.65, enemies: Object.freeze([]) }),
      support: Object.freeze({ weight: 0.20, enemies: Object.freeze([]) }),
      threat: Object.freeze({ weight: 0.10, enemies: Object.freeze([]) }),
      rare: Object.freeze({ weight: 0.05, enemies: Object.freeze([]) }),
    }),
    enemies: Object.freeze([]),
  }),
});

export const FOREST_VARIANT_OBSTACLE_POOLS = Object.freeze({
  default_forest_obstacle_pool: Object.freeze({
    id: "default_forest_obstacle_pool",
    /** Array of { obstacleTypeId, w } entries (weights). */
    obstacles: Object.freeze([
      Object.freeze({ obstacleTypeId: "giantRock", w: 55 }),
      Object.freeze({ obstacleTypeId: "smallPonds", w: 15 }),
      Object.freeze({ obstacleTypeId: "largePond", w: 10 }),
    ]),
  }),
  woods_obstacle_pool: Object.freeze({
    id: "woods_obstacle_pool",
    obstacles: Object.freeze([
      Object.freeze({ obstacleTypeId: "giantRock", w: 60 }),
      Object.freeze({ obstacleTypeId: "smallPonds", w: 15 }),
    ]),
  }),
  swamp_obstacle_pool: Object.freeze({
    id: "swamp_obstacle_pool",
    obstacles: Object.freeze([
      Object.freeze({ obstacleTypeId: "largePond", w: 45 }),
      Object.freeze({ obstacleTypeId: "smallPonds", w: 35 }),
      Object.freeze({ obstacleTypeId: "giantRock", w: 10 }),
    ]),
  }),
  magic_forest_obstacle_pool: Object.freeze({
    id: "magic_forest_obstacle_pool",
    obstacles: Object.freeze([
      Object.freeze({ obstacleTypeId: "magicPillarSmall", w: 35 }),
      Object.freeze({ obstacleTypeId: "magicPillarMedium", w: 25 }),
      Object.freeze({ obstacleTypeId: "magicPillarLarge", w: 15 }),
      Object.freeze({ obstacleTypeId: "magicAltar", w: 10 }),
      Object.freeze({ obstacleTypeId: "giantRock", w: 10 }),
      Object.freeze({ obstacleTypeId: "smallPonds", w: 5 }),
    ]),
  }),
  shallow_spider_obstacle_pool: Object.freeze({
    id: "shallow_spider_obstacle_pool",
    obstacles: Object.freeze([
      Object.freeze({ obstacleTypeId: "giantRock", w: 55 }),
      Object.freeze({ obstacleTypeId: "smallPonds", w: 15 }),
      Object.freeze({ obstacleTypeId: "largePond", w: 5 }),
    ]),
  }),
  dead_forest_obstacle_pool: Object.freeze({
    id: "dead_forest_obstacle_pool",
    obstacles: Object.freeze([
      Object.freeze({ obstacleTypeId: "darkPillarSmall", w: 35 }),
      Object.freeze({ obstacleTypeId: "darkPillarMedium", w: 25 }),
      Object.freeze({ obstacleTypeId: "darkPillarLarge", w: 15 }),
      Object.freeze({ obstacleTypeId: "darkAltar", w: 10 }),
      Object.freeze({ obstacleTypeId: "giantRock", w: 10 }),
    ]),
  }),
  deep_spider_obstacle_pool: Object.freeze({
    id: "deep_spider_obstacle_pool",
    obstacles: Object.freeze([
      Object.freeze({ obstacleTypeId: "giantRock", w: 60 }),
      Object.freeze({ obstacleTypeId: "largePond", w: 10 }),
      Object.freeze({ obstacleTypeId: "smallPonds", w: 10 }),
    ]),
  }),
});

export const FOREST_VARIANT_CONFIG = Object.freeze({
  [FOREST_VARIANTS.WOODS]: Object.freeze({
    id: FOREST_VARIANTS.WOODS,
    displayName: "Woods",
    nodeTier: FOREST_NODE_TIERS.CALM,
    treeSpriteSet: Object.freeze({ spriteSources: WOODS_TREE_SPRITES, vaultSpriteSources: DEFAULT_TREE_VAULT_SPRITES }),
    grassPatchSpriteSet: Object.freeze({ groundTypeId: "grass_woods" }),
    obstacleSpriteSet: Object.freeze({ giantRockSpriteSources: DEFAULT_ROCK_SPRITES, vaultRockSpriteSources: DEFAULT_VAULT_ROCK_SPRITES }),
    obstaclePoolId: "woods_obstacle_pool",
    enemyPoolId: "woods_pool",
    ambience: null,
    tint: null,
    decorativeProps: null,
    musicKey: null,
    fogProfile: null,
  }),
  [FOREST_VARIANTS.SWAMP]: Object.freeze({
    id: FOREST_VARIANTS.SWAMP,
    displayName: "Swamp",
    nodeTier: FOREST_NODE_TIERS.CALM,
    treeSpriteSet: Object.freeze({ spriteSources: SWAMP_TREE_SPRITES, vaultSpriteSources: DEFAULT_TREE_VAULT_SPRITES }),
    grassPatchSpriteSet: Object.freeze({ groundTypeId: "grass_swamp" }),
    obstacleSpriteSet: Object.freeze({ giantRockSpriteSources: DEFAULT_ROCK_SPRITES, vaultRockSpriteSources: DEFAULT_VAULT_ROCK_SPRITES }),
    obstaclePoolId: "swamp_obstacle_pool",
    enemyPoolId: "swamp_pool",
    ambience: null,
    tint: null,
    decorativeProps: null,
    musicKey: null,
    fogProfile: null,
  }),
  [FOREST_VARIANTS.MAGIC_FOREST]: Object.freeze({
    id: FOREST_VARIANTS.MAGIC_FOREST,
    displayName: "Magic Forest",
    nodeTier: FOREST_NODE_TIERS.RISKY,
    treeSpriteSet: Object.freeze({ spriteSources: MAGIC_FOREST_TREE_SPRITES, vaultSpriteSources: DEFAULT_TREE_VAULT_SPRITES }),
    grassPatchSpriteSet: Object.freeze({ groundTypeId: "grass_magic" }),
    obstacleSpriteSet: Object.freeze({ giantRockSpriteSources: DEFAULT_ROCK_SPRITES, vaultRockSpriteSources: DEFAULT_VAULT_ROCK_SPRITES }),
    obstaclePoolId: "magic_forest_obstacle_pool",
    enemyPoolId: "magic_forest_pool",
    ambience: null,
    tint: null,
    decorativeProps: null,
    musicKey: null,
    fogProfile: null,
  }),
  [FOREST_VARIANTS.SHALLOW_SPIDER_HABITAT]: Object.freeze({
    id: FOREST_VARIANTS.SHALLOW_SPIDER_HABITAT,
    displayName: "Shallow Spider Habitat",
    nodeTier: FOREST_NODE_TIERS.RISKY,
    treeSpriteSet: Object.freeze({ spriteSources: SHALLOW_SPIDER_HABITAT_TREE_SPRITES, vaultSpriteSources: DEFAULT_TREE_VAULT_SPRITES }),
    grassPatchSpriteSet: Object.freeze({ groundTypeId: "grass_shallow_spider" }),
    obstacleSpriteSet: Object.freeze({ giantRockSpriteSources: DEFAULT_ROCK_SPRITES, vaultRockSpriteSources: DEFAULT_VAULT_ROCK_SPRITES }),
    obstaclePoolId: "shallow_spider_obstacle_pool",
    enemyPoolId: "shallow_spider_pool",
    ambience: null,
    tint: null,
    decorativeProps: null,
    musicKey: null,
    fogProfile: null,
  }),
  [FOREST_VARIANTS.DEAD_FOREST]: Object.freeze({
    id: FOREST_VARIANTS.DEAD_FOREST,
    displayName: "Dead Forest",
    nodeTier: FOREST_NODE_TIERS.DEADLY,
    treeSpriteSet: Object.freeze({ spriteSources: DEAD_FOREST_TREE_SPRITES, vaultSpriteSources: DEFAULT_TREE_VAULT_SPRITES }),
    grassPatchSpriteSet: Object.freeze({ groundTypeId: "grass_dead" }),
    obstacleSpriteSet: Object.freeze({ giantRockSpriteSources: DEFAULT_ROCK_SPRITES, vaultRockSpriteSources: DEFAULT_VAULT_ROCK_SPRITES }),
    obstaclePoolId: "dead_forest_obstacle_pool",
    enemyPoolId: "dead_forest_pool",
    ambience: null,
    tint: null,
    decorativeProps: null,
    musicKey: null,
    fogProfile: null,
  }),
  [FOREST_VARIANTS.DEEP_SPIDER_HABITAT]: Object.freeze({
    id: FOREST_VARIANTS.DEEP_SPIDER_HABITAT,
    displayName: "Deep Spider Habitat",
    nodeTier: FOREST_NODE_TIERS.DEADLY,
    treeSpriteSet: Object.freeze({ spriteSources: DEEP_SPIDER_HABITAT_TREE_SPRITES, vaultSpriteSources: DEFAULT_TREE_VAULT_SPRITES }),
    grassPatchSpriteSet: Object.freeze({ groundTypeId: "grass_deep_spider" }),
    obstacleSpriteSet: Object.freeze({ giantRockSpriteSources: DEFAULT_ROCK_SPRITES, vaultRockSpriteSources: DEFAULT_VAULT_ROCK_SPRITES }),
    obstaclePoolId: "deep_spider_obstacle_pool",
    enemyPoolId: "deep_spider_pool",
    ambience: null,
    tint: null,
    decorativeProps: null,
    musicKey: null,
    fogProfile: null,
  }),
});

export const DEFAULT_FOREST_VARIANT_ID = FOREST_VARIANTS.WOODS;

export function getForestVariantConfig(variantId) {
  return FOREST_VARIANT_CONFIG[variantId] || FOREST_VARIANT_CONFIG[DEFAULT_FOREST_VARIANT_ID];
}

export function getForestVariantEnemyPool(enemyPoolId) {
  if (enemyPoolId && FOREST_VARIANT_ENEMY_POOLS[enemyPoolId]) return FOREST_VARIANT_ENEMY_POOLS[enemyPoolId];
  return FOREST_VARIANT_ENEMY_POOLS.default_forest_pool;
}

export function getForestVariantObstaclePool(obstaclePoolId) {
  if (obstaclePoolId && FOREST_VARIANT_OBSTACLE_POOLS[obstaclePoolId]) return FOREST_VARIANT_OBSTACLE_POOLS[obstaclePoolId];
  return FOREST_VARIANT_OBSTACLE_POOLS.default_forest_obstacle_pool;
}
