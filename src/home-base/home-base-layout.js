import { createHomeBaseInteractables } from "./home-base-interactable.js";
import { getFirstGidForRegion } from "./mainlevbuild-atlas-map.js";

function getInteractableMap(interactables) {
  const map = new Map();
  for (const interactable of interactables) {
    map.set(interactable.id, interactable);
  }
  return map;
}

function around(interactable, padX, padY) {
  if (!interactable) {
    return { x: 0, y: 0, w: 1, h: 1 };
  }
  return {
    x: interactable.x - padX,
    y: interactable.y - padY,
    w: interactable.w + padX * 2,
    h: interactable.h + padY * 2
  };
}

function getCenter(interactable, fallback) {
  if (!interactable) return fallback;
  return interactable.getCenter();
}

function makeStructure(id, x, y, w, h, style, collides = false, extra = {}) {
  return {
    id,
    x,
    y,
    w,
    h,
    style,
    collides,
    ...extra
  };
}

function makeWeightedTile(row, col, weight = 1) {
  return { row, col, weight };
}

export function createHomeBaseLayout(world) {
  const interactables = createHomeBaseInteractables(world);
  const byId = getInteractableMap(interactables);

  const campfire = byId.get("campfire");
  const skillLibrary = byId.get("skill-library");
  const vault = byId.get("vault");
  const ironsmith = byId.get("ironsmith");
  const ritesPillars = byId.get("rites-pillars");
  const talentTree = byId.get("talent-tree");
  const portal = byId.get("portal-gate");
  const lure = byId.get("lure-altar");
  const companion = byId.get("companion");
  const peachPillar = byId.get("peach-pillar");
  const returnMenu = byId.get("return-menu");

  const fallbackCenter = { x: world.width * 0.5, y: world.height * 0.5 };
  const campfireCenter = getCenter(campfire, fallbackCenter);
  const skillLibCenter = getCenter(skillLibrary, fallbackCenter);
  const vaultCenter = getCenter(vault, fallbackCenter);
  const ironsmithCenter = getCenter(ironsmith, fallbackCenter);
  const ritesPillarsCenter = getCenter(ritesPillars, fallbackCenter);
  const talentCenter = getCenter(talentTree, fallbackCenter);
  const portalCenter = getCenter(portal, fallbackCenter);
  const lureCenter = getCenter(lure, fallbackCenter);
  const companionCenter = getCenter(companion, fallbackCenter);
  const peachPillarCenter = getCenter(peachPillar, fallbackCenter);

  const areas = [
    { id: "campfire-area", interactableId: "campfire", padX: 200, padY: 150, label: "Campfire Grounds", shortLabel: "Campfire", color: "rgba(249, 115, 22, 0.14)", borderColor: "rgba(251, 146, 60, 0.26)", priority: 3, ...around(campfire, 200, 150) },
    { id: "skill-library-area", interactableId: "skill-library", padX: 140, padY: 100, label: "Skill Library", shortLabel: "Skill Library", color: "rgba(167, 139, 250, 0.12)", borderColor: "rgba(196, 181, 253, 0.3)", priority: 5, ...around(skillLibrary, 140, 100) },
    { id: "vault-area", interactableId: "vault", padX: 140, padY: 100, label: "Vault", shortLabel: "Vault", color: "rgba(250, 204, 21, 0.11)", borderColor: "rgba(250, 204, 21, 0.26)", priority: 4, ...around(vault, 140, 100) },
    { id: "ironsmith-area", interactableId: "ironsmith", padX: 140, padY: 100, label: "Ironsmith", shortLabel: "Ironsmith", color: "rgba(120, 113, 108, 0.12)", borderColor: "rgba(120, 113, 108, 0.28)", priority: 4, ...around(ironsmith, 140, 100) },
    { id: "rites-pillars-area", interactableId: "rites-pillars", padX: 80, padY: 60, label: "Rites & Pillars", shortLabel: "Rites & Pillars", color: "rgba(139, 92, 246, 0.12)", borderColor: "rgba(167, 139, 250, 0.3)", priority: 4, ...around(ritesPillars, 80, 60) },
    { id: "talent-tree-area", interactableId: "talent-tree", padX: 140, padY: 100, label: "Talent Tree", shortLabel: "Talent Tree", color: "rgba(34, 197, 94, 0.12)", borderColor: "rgba(74, 222, 128, 0.3)", priority: 4, ...around(talentTree, 140, 100) },
    { id: "portal-area", interactableId: "portal-gate", padX: 150, padY: 120, label: "Portal Gate", shortLabel: "Portal Gate", color: "rgba(59, 130, 246, 0.13)", borderColor: "rgba(96, 165, 250, 0.31)", priority: 6, ...around(portal, 150, 120) },
    { id: "altar-area", interactableId: "lure-altar", padX: 120, padY: 90, label: "Lure Altar", shortLabel: "Lure Altar", color: "rgba(34, 211, 238, 0.12)", borderColor: "rgba(103, 232, 249, 0.3)", priority: 5, ...around(lure, 120, 90) },
    { id: "companion-area", interactableId: "companion", padX: 80, padY: 60, label: "Companions", shortLabel: "Companions", color: "rgba(244, 114, 182, 0.12)", borderColor: "rgba(251, 113, 133, 0.3)", priority: 4, ...around(companion, 80, 60) },
    { id: "peach-pillar-area", interactableId: "peach-pillar", padX: 80, padY: 60, label: "Peach Pillar", shortLabel: "Select Hero", color: "rgba(245, 158, 11, 0.12)", borderColor: "rgba(251, 191, 36, 0.3)", priority: 4, ...around(peachPillar, 80, 60) },
    { id: "return-menu-area", interactableId: "return-menu", padX: 45, padY: 35, label: "Return Shrine", shortLabel: "Return Shrine", color: "rgba(148, 163, 184, 0.08)", borderColor: "rgba(148, 163, 184, 0.24)", priority: 2, ...around(returnMenu, 45, 35) }
  ];

  const locationZones = areas.map((area) => ({
    id: area.id,
    label: area.shortLabel || area.label,
    x: area.x,
    y: area.y,
    w: area.w,
    h: area.h,
    priority: area.priority || 1
  }));

  // No walls: all blockers removed so the player can walk freely through the hub
  const blockers = [];

  const props = [
    // North: Skill Library — bookshelves / archive placeholder
    makeStructure("skill-library-shelf", skillLibCenter.x - 70, skillLibCenter.y - 40, 140, 30, "wood"),
    makeStructure("skill-library-rune", skillLibCenter.x - 40, skillLibCenter.y + 10, 80, 24, "rune"),

    // West: Vault — treasure + armory placeholder
    makeStructure("vault-treasure", vaultCenter.x - 70, vaultCenter.y - 30, 60, 40, "metal"),
    makeStructure("vault-rack", vaultCenter.x + 10, vaultCenter.y - 40, 70, 20, "wood"),

    // West, below Vault: Rites & Pillars — shrine placeholder
    makeStructure("rites-pillars-shrine", ritesPillarsCenter.x - 35, ritesPillarsCenter.y - 18, 70, 36, "altar"),
    makeStructure("rites-pillars-rune", ritesPillarsCenter.x - 28, ritesPillarsCenter.y + 4, 56, 16, "rune"),

    // East: Talent Tree — glowing tree / shrine placeholder
    makeStructure("talent-tree-shrine", talentCenter.x - 50, talentCenter.y - 50, 100, 60, "altar"),
    makeStructure("talent-tree-glow", talentCenter.x - 20, talentCenter.y - 20, 40, 40, "energy", false, { shape: "circle" }),

    // South: Portal — visual is Void pillar image (old platform/arch/core hidden)
    makeStructure("portal-platform", portalCenter.x - 104, portalCenter.y + 12, 208, 38, "stone", false, { invisible: true }),
    makeStructure("portal-core", portalCenter.x - 18, portalCenter.y - 12, 36, 36, "energy", false, { shape: "circle", invisible: true }),
    makeStructure("portal-arch-top", portalCenter.x - 64, portalCenter.y - 42, 128, 20, "pillar", false, { invisible: true }),

    // South of portal: Lure Altar
    makeStructure("lure-pedestal", lureCenter.x - 24, lureCenter.y - 22, 50, 26, "altar"),
    makeStructure("lure-rune-ring", lureCenter.x - 68, lureCenter.y - 48, 136, 96, "rune", false, { shape: "ring" }),

    // Companion area — calm shrine placeholder
    makeStructure("companion-shrine", companionCenter.x - 30, companionCenter.y - 20, 60, 40, "altar"),

    // Peach Pillar — Select Hero
    makeStructure("peach-pillar-shrine", peachPillarCenter.x - 30, peachPillarCenter.y - 20, 60, 40, "altar")
  ];

  const markerById = {
    campfire: { icon: "C", subtitle: "Center" },
    "skill-library": { icon: "S", subtitle: "Skills" },
    vault: { icon: "V", subtitle: "Vault" },
    ironsmith: { icon: "I", subtitle: "Ironsmith" },
    "rites-pillars": { icon: "P", subtitle: "Rites & Pillars" },
    "talent-tree": { icon: "T", subtitle: "Talents" },
    "portal-gate": { icon: "R", subtitle: "Expedition" },
    "lure-altar": { icon: "L", subtitle: "Lures" },
    companion: { icon: "F", subtitle: "Companions" },
    "peach-pillar": { icon: "H", subtitle: "Select Hero" },
    "return-menu": { icon: "M", subtitle: "Main Menu" }
  };

  const ambientAnchors = [
    {
      id: "skill-library-runes",
      type: "sacred",
      x: skillLibCenter.x,
      y: skillLibCenter.y - 8,
      radius: 40,
      particleCount: 6,
      particleColor: "rgba(196, 181, 253, 0.82)"
    },
    {
      id: "lure-runes",
      type: "ritual",
      x: lureCenter.x,
      y: lureCenter.y,
      radius: 44,
      particleCount: 8,
      particleColor: "rgba(103, 232, 249, 0.85)"
    },
    {
      id: "portal-core",
      type: "portal",
      x: portalCenter.x,
      y: portalCenter.y,
      radius: 48,
      particleCount: 10,
      particleColor: "rgba(147, 197, 253, 0.88)"
    },
    {
      id: "collector-pillar-golden",
      type: "golden",
      x: vaultCenter.x - 15,
      y: vaultCenter.y - 100,
      radius: 55,
      particleCount: 14,
      particleColor: "rgba(255, 215, 0, 0.92)",
      particleColorAlt: "rgba(255, 193, 37, 0.88)"
    }
  ];

  const floorTileZones = [
    { id: "campfire-floor", label: "Campfire Grounds", ...around(campfire, 220, 170), baseTiles: [makeWeightedTile(8, "b", 3), makeWeightedTile(8, "c", 2), makeWeightedTile(9, "c", 2)], accentTiles: [makeWeightedTile(9, "d", 2)], accentChance: 0.2 },
    { id: "skill-library-floor", label: "Skill Library", ...around(skillLibrary, 160, 110), baseTiles: [makeWeightedTile(10, "b", 3), makeWeightedTile(10, "c", 2)], accentTiles: [makeWeightedTile(13, "b", 1)], accentChance: 0.08 },
    { id: "vault-floor", label: "Vault", ...around(vault, 160, 120), baseTiles: [makeWeightedTile(9, "b", 3), makeWeightedTile(9, "c", 2)], accentTiles: [makeWeightedTile(10, "e", 1)], accentChance: 0.12 },
    { id: "ironsmith-floor", label: "Ironsmith", ...around(ironsmith, 160, 120), baseTiles: [makeWeightedTile(9, "b", 2), makeWeightedTile(9, "c", 3)], accentTiles: [makeWeightedTile(10, "e", 1)], accentChance: 0.1 },
    { id: "rites-pillars-floor", label: "Rites & Pillars", ...around(ritesPillars, 100, 80), baseTiles: [makeWeightedTile(10, "b", 2), makeWeightedTile(10, "c", 2)], accentTiles: [makeWeightedTile(13, "b", 1)], accentChance: 0.08 },
    { id: "talent-tree-floor", label: "Talent Tree", ...around(talentTree, 160, 120), baseTiles: [makeWeightedTile(7, "a", 2), makeWeightedTile(7, "b", 3)], accentTiles: [makeWeightedTile(12, "b", 1)], accentChance: 0.09 },
    { id: "portal-floor", label: "Portal Gate", ...around(portal, 170, 130), baseTiles: [makeWeightedTile(10, "b", 2), makeWeightedTile(10, "c", 2)], accentTiles: [makeWeightedTile(17, "o", 1)], accentChance: 0.11 },
    { id: "lure-floor", label: "Lure Altar", ...around(lure, 130, 100), baseTiles: [makeWeightedTile(8, "a", 2), makeWeightedTile(13, "a", 2)], accentTiles: [makeWeightedTile(11, "d", 2)], accentChance: 0.14 },
    { id: "companion-floor", label: "Companions", ...around(companion, 100, 80), baseTiles: [makeWeightedTile(9, "b", 2), makeWeightedTile(9, "c", 2)], accentTiles: [], accentChance: 0.1 }
  ];

  const atlasProps = [
    { id: "rites-pillars-rune-atlas", atlas: "tiles", row: 11, col: "e", x: ritesPillarsCenter.x - 20, y: ritesPillarsCenter.y - 8, w: 40, h: 40 },
    { id: "lure-vial", atlas: "items", row: 20, col: "a", x: lureCenter.x - 80, y: lureCenter.y - 4, w: 22, h: 22 },
    { id: "menu-shrine-base", atlas: "tiles", row: 10, col: "e", x: returnMenu.x + 38, y: returnMenu.y + 20, w: 40, h: 40 }
  ];

  const imageProps = [
    { id: "peace-pillar", src: "assets/Hub;Base/The Peace.png", x: campfireCenter.x - 115, y: campfireCenter.y - 172, w: 230, aspectRatio: 1024 / 1536, layer: "back" },
    { id: "arsenal-pillar", src: "assets/Hub;Base/The Arsenal.png", x: ironsmithCenter.x - 115, y: ironsmithCenter.y - 272, w: 230, aspectRatio: 1024 / 1536, layer: "back" },
    { id: "cascade-pillar", src: "assets/Hub;Base/The Cascade.png", x: skillLibCenter.x - 115, y: skillLibCenter.y - 332, w: 230, aspectRatio: 1024 / 1536, layer: "back" },
    { id: "collector-pillar", src: "assets/Hub;Base/The Collector.png", x: vaultCenter.x - 115, y: vaultCenter.y - 272, w: 230, aspectRatio: 1024 / 1536, layer: "back" },
    { id: "void-pillar", src: "assets/Hub;Base/The Void.png", x: portalCenter.x - 115, y: portalCenter.y - 272, w: 230, aspectRatio: 1024 / 1536, layer: "back" }
  ];

  // Peace pillar: 3 floating clouds from "The Peace Floating" assets.
  const peaceFloatingClouds = {
    centerX: campfireCenter.x,
    centerY: campfireCenter.y - 80,
    orbitSpeed: 0.035,
    bobAmplitude: 10,
    bobSpeed: 0.5,
    alpha: 0.65,
    clouds: [
      { id: "peace-cloud-1", src: "assets/Hub;Base/The Peace Floating/cloud1.png", radius: 85, radiusY: 42, angleOffset: 0, bobPhase: 0, w: 72, h: 36 },
      { id: "peace-cloud-2", src: "assets/Hub;Base/The Peace Floating/cloud2.png", radius: 105, radiusY: 52, angleOffset: 2.09, bobPhase: 1.2, w: 80, h: 40 },
      { id: "peace-cloud-3", src: "assets/Hub;Base/The Peace Floating/cloud3.png", radius: 72, radiusY: 36, angleOffset: 4.19, bobPhase: 2.4, w: 64, h: 32 }
    ]
  };

  // Orbiting equipment sprites (items atlas) around the Collector pillar. Center = upper-middle of pillar.
  const orbitConfigs = [
    {
      id: "collector-pillar",
      centerX: vaultCenter.x - 15,
      centerY: vaultCenter.y - 100,
      orbitSpeed: 0.12,
      bobAmplitude: 5,
      bobSpeed: 1.0,
      spriteSize: 24,
      pillarImageId: "collector-pillar",
      items: [
        { row: 1, col: "d", radius: 68, radiusY: 34, angleOffset: 0, bobPhase: 0 },
        { row: 12, col: "b", radius: 72, radiusY: 36, angleOffset: 1.05, bobPhase: 0.4 },
        { row: 16, col: "e", radius: 65, radiusY: 32, angleOffset: 2.1, bobPhase: 0.8 },
        { row: 15, col: "c", radius: 70, radiusY: 35, angleOffset: 3.14, bobPhase: 1.2 },
        { row: 13, col: "f", radius: 66, radiusY: 33, angleOffset: 4.2, bobPhase: 1.6 },
        { row: 17, col: "a", radius: 64, radiusY: 34, angleOffset: 5.25, bobPhase: 2.0 }
      ]
    },
    {
      id: "collector-pillar-outer",
      centerX: vaultCenter.x - 15,
      centerY: vaultCenter.y - 180,
      orbitSpeed: 0.12,
      bobAmplitude: 5,
      bobSpeed: 1.0,
      spriteSize: 24,
      pillarImageId: "collector-pillar",
      items: [
        { row: 1, col: "e", radius: 88, radiusY: 29, angleOffset: 0.5, bobPhase: 0.2 },
        { row: 12, col: "c", radius: 94, radiusY: 32, angleOffset: 1.55, bobPhase: 0.6 },
        { row: 16, col: "g", radius: 85, radiusY: 27, angleOffset: 2.6, bobPhase: 1.0 },
        { row: 15, col: "d", radius: 91, radiusY: 31, angleOffset: 3.64, bobPhase: 1.4 },
        { row: 13, col: "e", radius: 86, radiusY: 28, angleOffset: 4.7, bobPhase: 1.8 },
        { row: 17, col: "b", radius: 83, radiusY: 29, angleOffset: 5.75, bobPhase: 2.2 }
      ]
    }
  ];

  // Cascade pillar: magic projectiles rain down from top to bottom of the sprite (mix of all 4 types).
  // Bounds are derived at runtime from the cascade-pillar image prop so rain always stays with the pillar.
  const cascadePillarRain = {
    pillarImageId: "cascade-pillar",
    count: 11,
    fallSpeed: 200,
    acceleration: 90,
    trailLength: 8,
    size: 12
  };

  const arrival = {
    spawn: {
      x: campfireCenter.x - 22,
      y: campfireCenter.y - 116
    },
    facing: { x: 0, y: 1 }
  };

  const redPandaRoam = {
    centerX: companionCenter.x,
    centerY: companionCenter.y,
    radiusX: 100,
    radiusY: 70,
    spriteSheet: "assets/Hub;Base/Companions/Red Panda Sprite Sheet.png",
    spriteJson: "assets/Hub;Base/Companions/Red Panda Sprite Sheet.json",
    walkSpeed: 28,
    idleMinDuration: 1.5,
    idleMaxDuration: 4,
    walkMinDuration: 2,
    walkMaxDuration: 5,
    sleepIdleThreshold: 7,
    sleepChancePerSec: 0.2,
    sleepMinDuration: 4,
    sleepMaxDuration: 8,
    attackPlayerRadius: 55,
    attackDuration: 0.9,
    attackCooldownAfter: 6
  };

  const axolotlRoam = {
    centerX: companionCenter.x,
    centerY: companionCenter.y,
    radiusX: 90,
    radiusY: 55,
    basePath: "assets/Hub;Base/Companions/Axolotl/Axolotl_Albino_",
    animations: [
      { name: "Resting_Idle", file: "Resting_Idle.png", cols: 4, rows: 4, frameCount: 12 },
      { name: "Resting", file: "Resting.png", cols: 4, rows: 2, frameCount: 6 },
      { name: "Floating_Idle", file: "Floating_Idle.png", cols: 4, rows: 4, frameCount: 8 },
      { name: "Floating", file: "Floating.png", cols: 2, rows: 2 },
      { name: "Preparing_To_Swim", file: "Preparing_To_Swim.png", cols: 4, rows: 3, frameCount: 7 },
      { name: "Swimming", file: "Swimming.png", cols: 4, rows: 4, frameCount: 12 },
      { name: "Getting_Down", file: "Getting_Down.png", cols: 4, rows: 4, frameCount: 12 }
    ],
    frameDuration: 0.12,
    swimSpeed: 22,
    restIdleMin: 2,
    restIdleMax: 5,
    swimMin: 2,
    swimMax: 4,
    floatMin: 2,
    floatMax: 4,
    transitionDuration: 0.8
  };

  const blobfishRoam = {
    centerX: companionCenter.x,
    centerY: companionCenter.y,
    radiusX: 85,
    radiusY: 50,
    spriteSheet: "assets/Hub;Base/Companions/Blobfish Spritesheet.png",
    frameWidth: 32,
    frameHeight: 32,
    columns: [
      { name: "Walking", col: 0, frames: 8 },
      { name: "Idle", col: 1, frames: 3 },
      { name: "Jumping", col: 2, frames: 6 },
      { name: "Crying", col: 3, frames: 1 }
    ],
    frameDuration: 0.1,
    walkSpeed: 24,
    idleMinDuration: 1.5,
    idleMaxDuration: 4,
    walkMinDuration: 2,
    walkMaxDuration: 5,
    jumpDuration: 0.7,
    cryMinDuration: 2,
    cryMaxDuration: 4,
    cryChance: 0.15,
    jumpChance: 0.25
  };

  const collisionWalls = blockers.filter((entry) => entry.collides);

  // Dirt paths connecting center to each section (mainlevbuild region names)
  const pathWidth = 96;
  const pathHalf = pathWidth / 2;
  const floorConnectorZones = [
    // North: center → Skill Library
    {
      x: campfireCenter.x - pathHalf,
      y: skillLibCenter.y - 60,
      w: pathWidth,
      h: campfireCenter.y - (skillLibCenter.y - 60) + 80,
      region: "dirtPadRoundedA"
    },
    // South: center → Portal
    {
      x: campfireCenter.x - pathHalf,
      y: campfireCenter.y + 60,
      w: pathWidth,
      h: (portalCenter.y + 80) - (campfireCenter.y + 60),
      region: "dirtPadRoundedA"
    },
    // East: center → Talent Tree
    {
      x: campfireCenter.x + 60,
      y: campfireCenter.y - pathHalf,
      w: talentCenter.x - (campfireCenter.x + 60) + 60,
      h: pathWidth,
      region: "dirtPadRoundedA"
    },
    // West: center → Vault / Ironsmith
    {
      x: vaultCenter.x - 40,
      y: campfireCenter.y - pathHalf,
      w: campfireCenter.x - vaultCenter.x + 40,
      h: pathWidth,
      region: "dirtPadRoundedA"
    },
    // Short branch: center → Companion
    {
      x: campfireCenter.x + 40,
      y: companionCenter.y - 40,
      w: companionCenter.x - (campfireCenter.x + 40) + 50,
      h: 80,
      region: "dirtPadTanA"
    },
    // South-east: Portal → Lure Altar
    {
      x: portalCenter.x + 40,
      y: portalCenter.y + 50,
      w: lureCenter.x - (portalCenter.x + 40) + 40,
      h: 70,
      region: "dirtPadTanA"
    }
  ];

  // Terrain tilemap: grid of raw GIDs (32px tiles), one tile per cell. Default from grass + connector zones.
  const TERRAIN_TILE = 32;
  const terrainCols = Math.ceil(world.width / TERRAIN_TILE);
  const terrainRows = Math.ceil(world.height / TERRAIN_TILE);
  const terrainGrid = [];
  for (let gy = 0; gy < terrainRows; gy++) {
    const row = [];
    for (let gx = 0; gx < terrainCols; gx++) {
      const tileCenterX = gx * TERRAIN_TILE + TERRAIN_TILE / 2;
      const tileCenterY = gy * TERRAIN_TILE + TERRAIN_TILE / 2;
      let region = "grassFieldA";
      for (const zone of floorConnectorZones) {
        if (
          tileCenterX >= zone.x &&
          tileCenterX < zone.x + zone.w &&
          tileCenterY >= zone.y &&
          tileCenterY < zone.y + zone.h
        ) {
          region = zone.region;
          break;
        }
      }
      row.push(getFirstGidForRegion(region));
    }
    terrainGrid.push(row);
  }

  // User-placed sprites from mainlevbuild atlas (populated by hub layout editor)
  const mainlevbuildProps = [];

  // User-editable collision boxes (see/add/move/delete in hub layout editor)
  const collisionBoxes = [];

  return {
    interactables,
    areas,
    locationZones,
    blockers,
    props,
    floorTileZones,
    floorConnectorZones,
    terrainGrid,
    atlasProps,
    imageProps,
    mainlevbuildProps,
    peaceFloatingClouds,
    orbitConfigs,
    cascadePillarRain,
    redPandaRoam,
    axolotlRoam,
    markerById,
    ambientAnchors,
    arrival,
    collisionWalls,
    collisionBoxes
  };
}
