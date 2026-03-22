"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");

const GROUND_PATCH_JSON_PATH = path.join(
  __dirname,
  "..",
  "assets",
  "Environments",
  "1. OpenWorld",
  "1.First Layer",
  "grassA_1.json"
);

function createMockWorld() {
  return {
    width: 32 * 30,
    height: 32 * 20,
    tileSize: 32,
    tileGrid: Array.from({ length: 20 }, (_, gy) => (
      Array.from({ length: 30 }, (_, gx) => (
        gy === 0 || gy === 19 || gx === 0 || gx === 29 || (gx >= 12 && gx <= 14 && gy >= 8 && gy <= 10)
          ? 1
          : 0
      ))
    )),
  };
}

test("parseOpenWorldGroundPatchDefs loads the 10 configured patch defs", async () => {
  const raw = await fs.readFile(GROUND_PATCH_JSON_PATH, "utf8");
  const { parseOpenWorldGroundPatchDefs } = await import("../src/data/openworld-ground.js");
  const patchDefs = parseOpenWorldGroundPatchDefs(raw);

  assert.equal(patchDefs.length, 10);
  assert.deepEqual(patchDefs[0], {
    id: "grass_small_1",
    x: 896,
    y: 1504,
    w: 416,
    h: 224,
    weight: 6,
  });
  assert.deepEqual(
    patchDefs.find((patchDef) => patchDef.id === "grass_medium_1"),
    {
      id: "grass_medium_1",
      x: 1088,
      y: 0,
      w: 352,
      h: 256,
      weight: 5,
    }
  );
});

test("grassA ground type uses the seamless 2x2 main ground sheet and the current overlay stack", async () => {
  const { getOpenWorldGroundType } = await import("../src/data/openworld-ground.js");
  const groundType = getOpenWorldGroundType("grassA");

  assert.equal(groundType.baseSheetSrc, "assets/Environments/1. OpenWorld/1.First Layer/mainGround1280px.png");
  assert.equal(groundType.baseTileWidth, 640);
  assert.equal(groundType.baseTileHeight, 640);
  assert.equal(groundType.baseColumns, 2);
  assert.equal(groundType.baseRows, 2);
  assert.equal(groundType.seamBreakup.layerId, "grassA_1");
  assert.equal(groundType.seamBreakup.alpha, 0.5);
  assert.equal(groundType.overlayLayers.length, 3);
  assert.deepEqual(
    groundType.overlayLayers.map((layer) => layer.id),
    ["grassA_1", "grassA_2", "rocksA"]
  );
  assert.equal(groundType.overlayLayers[0].patchSheetSrc, "assets/Environments/1. OpenWorld/1.First Layer/grassA_1.png");
  assert.equal(groundType.overlayLayers[1].patchSheetSrc, "assets/Environments/1. OpenWorld/2.Second Layer/grassA_2.png");
  assert.equal(groundType.overlayLayers[2].patchSheetSrc, "assets/Environments/1. OpenWorld/2.Second Layer/groundrocksA.png");
  assert.equal(groundType.flowerLayer.sheetSrc, "assets/Environments/1. OpenWorld/3.Third Layer/fourFlowers.png");
  assert.equal(groundType.shrubLayer.sheetSrc, "assets/Environments/1. OpenWorld/4.SingleObj/Shrubs/16 Shrubs.png");
  assert.equal(groundType.boulderLayer.sprites.length, 6);
});

test("parseOpenWorldGroundPatchDefs falls back malformed or missing weights to 1", async () => {
  const { parseOpenWorldGroundPatchDefs } = await import("../src/data/openworld-ground.js");
  const patchDefs = parseOpenWorldGroundPatchDefs({
    objects: [
      { id: "a", x: 0, y: 0, w: 64, h: 64 },
      { id: "b", x: 64, y: 0, w: 64, h: 64, weight: "bad" },
      { id: "c", x: 128, y: 0, w: 64, h: 64, weight: 3 },
    ],
  });

  assert.equal(patchDefs[0].weight, 1);
  assert.equal(patchDefs[1].weight, 1);
  assert.equal(patchDefs[2].weight, 3);
});

test("buildOpenWorldGroundPlacements is deterministic for the same seed and changes across seeds", async () => {
  const raw = await fs.readFile(GROUND_PATCH_JSON_PATH, "utf8");
  const { buildOpenWorldGroundPlacements, parseOpenWorldGroundPatchDefs } = await import("../src/data/openworld-ground.js");
  const patchDefs = parseOpenWorldGroundPatchDefs(raw);
  const world = createMockWorld();

  const placementsA = buildOpenWorldGroundPlacements(world, patchDefs, 1337, {
    targetCoverage: 0.08,
    maxPlacementAttempts: 3000,
  });
  const placementsB = buildOpenWorldGroundPlacements(world, patchDefs, 1337, {
    targetCoverage: 0.08,
    maxPlacementAttempts: 3000,
  });
  const placementsC = buildOpenWorldGroundPlacements(world, patchDefs, 7331, {
    targetCoverage: 0.08,
    maxPlacementAttempts: 3000,
  });

  assert.deepEqual(placementsA, placementsB);
  assert.notDeepEqual(placementsA, placementsC);
});

test("buildOpenWorldGroundPlacements keeps placements in bounds and off wall tiles", async () => {
  const raw = await fs.readFile(GROUND_PATCH_JSON_PATH, "utf8");
  const { buildOpenWorldGroundPlacements, parseOpenWorldGroundPatchDefs } = await import("../src/data/openworld-ground.js");
  const patchDefs = parseOpenWorldGroundPatchDefs(raw);
  const world = createMockWorld();

  const placements = buildOpenWorldGroundPlacements(world, patchDefs, 1337, {
    targetCoverage: 0.08,
    maxPlacementAttempts: 3000,
  });

  assert.ok(placements.length > 0);
  for (const placement of placements) {
    assert.ok(placement.x >= 0);
    assert.ok(placement.y >= 0);
    assert.ok(placement.x + placement.w <= world.width);
    assert.ok(placement.y + placement.h <= world.height);

    const centerX = Math.floor((placement.x + placement.w / 2) / world.tileSize);
    const centerY = Math.floor((placement.y + placement.h / 2) / world.tileSize);
    assert.notEqual(world.tileGrid[centerY][centerX], 1);
  }
});

test("buildOpenWorldGroundPlacements respects the overlap limiter", async () => {
  const raw = await fs.readFile(GROUND_PATCH_JSON_PATH, "utf8");
  const { buildOpenWorldGroundPlacements, parseOpenWorldGroundPatchDefs } = await import("../src/data/openworld-ground.js");
  const patchDefs = parseOpenWorldGroundPatchDefs(raw);
  const world = createMockWorld();
  const maxOverlapRatio = 0.18;

  const placements = buildOpenWorldGroundPlacements(world, patchDefs, 4242, {
    targetCoverage: 0.08,
    maxPlacementAttempts: 3000,
    maxOverlapRatio,
  });

  for (let i = 0; i < placements.length; i += 1) {
    for (let j = i + 1; j < placements.length; j += 1) {
      const a = placements[i];
      const b = placements[j];
      const x0 = Math.max(a.x, b.x);
      const y0 = Math.max(a.y, b.y);
      const x1 = Math.min(a.x + a.w, b.x + b.w);
      const y1 = Math.min(a.y + a.h, b.y + b.h);
      const overlapArea = x1 > x0 && y1 > y0 ? (x1 - x0) * (y1 - y0) : 0;
      if (!overlapArea) continue;
      const ratio = overlapArea / Math.min(a.w * a.h, b.w * b.h);
      assert.ok(ratio <= maxOverlapRatio);
    }
  }
});

test("drawOpenWorldGroundBase draws the visible slice of the prerendered floor canvas", async () => {
  const { drawOpenWorldGroundBase } = await import("../src/data/openworld-ground.js");
  const calls = [];
  const ctx = {
    save() {},
    restore() {},
    set imageSmoothingEnabled(_value) {},
    drawImage(...args) {
      calls.push(args);
    },
  };
  const camera = {
    position: { x: 32, y: 64 },
    viewWidth: 128,
    viewHeight: 96,
  };
  const baseCanvas = { width: 960, height: 640 };

  const drew = drawOpenWorldGroundBase(ctx, { baseCanvas }, -32, -64, camera);

  assert.equal(drew, true);
  assert.deepEqual(calls, [[baseCanvas, 32, 64, 128, 96, 0, 0, 128, 96]]);
});

test("buildOpenWorldGroundBaseCanvas stamps the base sheet across the floor canvas", async () => {
  const { buildOpenWorldGroundBaseCanvas } = await import("../src/data/openworld-ground.js");
  const operations = [];
  global.document = {
    createElement(tag) {
      assert.equal(tag, "canvas");
      return {
        width: 0,
        height: 0,
        getContext() {
          return {
            imageSmoothingEnabled: true,
            fillStyle: null,
            save() {},
            restore() {},
            fillRect(...args) {
              operations.push(["fillRect", ...args]);
            },
            drawImage(...args) {
              operations.push(["drawImage", ...args]);
            },
            clearRect() {},
            createLinearGradient() {
              return { addColorStop() {} };
            },
            set globalCompositeOperation(_value) {},
            set globalAlpha(_value) {},
          };
        },
      };
    },
  };

  try {
    const baseSheetImage = { complete: true, width: 1280, height: 1280 };
    const canvas = buildOpenWorldGroundBaseCanvas(
      { width: 640, height: 640 },
      baseSheetImage,
      1337,
      {
        baseSheetSrc: "assets/Environments/1. OpenWorld/1.First Layer/mainGround1280px.png",
        baseTileWidth: 640,
        baseTileHeight: 640,
        baseColumns: 2,
        baseRows: 2,
      }
    );

    assert.equal(canvas.width, 640);
    assert.equal(canvas.height, 640);
    assert.equal(operations.length, 1);
    assert.deepEqual(operations.map((entry) => entry[0]), ["drawImage"]);
    for (const operation of operations) {
      assert.equal(operation[1], baseSheetImage);
    }
  } finally {
    delete global.document;
  }
});

test("buildOpenWorldGroundDetailCanvas prerenders overlay patches and flowers into one static canvas", async () => {
  const { buildOpenWorldGroundDetailCanvas } = await import("../src/data/openworld-ground.js");
  const operations = [];
  global.document = {
    createElement(tag) {
      assert.equal(tag, "canvas");
      return {
        width: 0,
        height: 0,
        getContext() {
          return {
            imageSmoothingEnabled: true,
            drawImage(...args) {
              operations.push(["drawImage", ...args]);
            },
          };
        },
      };
    },
  };

  try {
    const patchSheetImage = { complete: true };
    const flowerSheetImage = { complete: true };
    const canvas = buildOpenWorldGroundDetailCanvas(
      { width: 320, height: 160 },
      {
        overlayLayers: [
          {
            patchSheetImage,
            placements: [
              { sx: 10, sy: 20, sw: 30, sh: 40, x: 50, y: 60, w: 70, h: 80 },
            ],
          },
        ],
        flowerLayer: {
          sheetImage: flowerSheetImage,
          placements: [
            { sx: 1, sy: 2, sw: 3, sh: 4, x: 5, y: 6, w: 7, h: 8 },
          ],
        },
      }
    );

    assert.equal(canvas.width, 320);
    assert.equal(canvas.height, 160);
    assert.deepEqual(operations, [
      ["drawImage", patchSheetImage, 10, 20, 30, 40, 50, 60, 70, 80],
      ["drawImage", flowerSheetImage, 1, 2, 3, 4, 5, 6, 7, 8],
    ]);
  } finally {
    delete global.document;
  }
});

test("parseOpenWorldGroundPatchDefs loads the configured grassA_2 second-layer defs", async () => {
  const raw = await fs.readFile(
    path.join(
      __dirname,
      "..",
      "assets",
      "Environments",
      "1. OpenWorld",
      "2.Second Layer",
      "grassA_2.json"
    ),
    "utf8"
  );
  const { parseOpenWorldGroundPatchDefs } = await import("../src/data/openworld-ground.js");
  const patchDefs = parseOpenWorldGroundPatchDefs(raw);

  assert.equal(patchDefs.length, 15);
  assert.deepEqual(patchDefs[0], {
    id: "grass2_large_1",
    x: 1296,
    y: 5,
    w: 425,
    h: 376,
    weight: 3,
  });
});

test("parseOpenWorldGroundPatchDefs loads the configured rocksA second-layer defs", async () => {
  const raw = await fs.readFile(
    path.join(
      __dirname,
      "..",
      "assets",
      "Environments",
      "1. OpenWorld",
      "2.Second Layer",
      "rocksA.json"
    ),
    "utf8"
  );
  const { parseOpenWorldGroundPatchDefs } = await import("../src/data/openworld-ground.js");
  const patchDefs = parseOpenWorldGroundPatchDefs(raw);

  assert.equal(patchDefs.length, 8);
  assert.deepEqual(patchDefs[0], {
    id: "rock_1",
    x: 6,
    y: 323,
    w: 425,
    h: 440,
    weight: 2,
  });
});

test("parseOpenWorldFlowerFamilies loads the configured flower families", async () => {
  const raw = await fs.readFile(
    path.join(
      __dirname,
      "..",
      "assets",
      "Environments",
      "1. OpenWorld",
      "3.Third Layer",
      "fourFlowers.json"
    ),
    "utf8"
  );
  const { parseOpenWorldFlowerFamilies } = await import("../src/data/openworld-ground.js");
  const families = parseOpenWorldFlowerFamilies(raw);

  assert.equal(families.length, 4);
  assert.equal(families[0].id, "mint");
  assert.equal(families[0].tiles.length, 9);
  assert.deepEqual(families[1].tiles[0], {
    id: "blue_1",
    x: 96,
    y: 0,
    w: 32,
    h: 32,
    weight: 10,
  });
});

test("buildOpenWorldFlowerPlacements assigns 8 to 20 flowers per zone with family-based placements", async () => {
  const raw = await fs.readFile(
    path.join(
      __dirname,
      "..",
      "assets",
      "Environments",
      "1. OpenWorld",
      "3.Third Layer",
      "fourFlowers.json"
    ),
    "utf8"
  );
  const { buildOpenWorldFlowerPlacements, parseOpenWorldFlowerFamilies } = await import("../src/data/openworld-ground.js");
  const families = parseOpenWorldFlowerFamilies(raw);
  const world = {
    ...createMockWorld(),
    archetypeGrid: {
      grid: [
        ["a", "b"],
        ["c", "d"],
      ],
    },
  };

  const placements = buildOpenWorldFlowerPlacements(world, families, 1337, {
    minPerZone: 8,
    maxPerZone: 20,
    mixNeighborChance: 0.1,
  });
  const countsByZone = placements.reduce((acc, placement) => {
    acc[placement.zoneId] = (acc[placement.zoneId] || 0) + 1;
    return acc;
  }, {});

  assert.deepEqual(Object.keys(countsByZone).sort(), ["0_0", "0_1", "1_0", "1_1"]);
  for (const count of Object.values(countsByZone)) {
    assert.ok(count >= 8);
    assert.ok(count <= 20);
  }
});

test("buildOpenWorldShrubPlacements prefers gaps but can still place shrubs on first-layer grass tiles", async () => {
  const { buildOpenWorldShrubPlacements } = await import("../src/data/openworld-ground.js");
  const world = createMockWorld();
  const firstLayerPlacements = [
    { x: 32, y: 32, w: 416, h: 224 },
    { x: 512, y: 256, w: 352, h: 256 },
  ];

  const placements = buildOpenWorldShrubPlacements(world, 1337, firstLayerPlacements, {
    minCount: 8,
    maxCount: 12,
    gapTilePadding: 1,
    preferredGapRatio: 0.8,
  });

  assert.ok(placements.length >= 24);
  assert.ok(placements.length <= 36);
  assert.equal(placements.length % 3, 0);
  assert.ok(placements.every((placement) => placement.w === 33 || placement.w === 38));
  assert.ok(placements.every((placement) => placement.h === 34 || placement.h === 39));
  let placementsInGaps = 0;
  let placementsOnGrass = 0;
  const countsByCluster = new Map();
  let leadCount = 0;
  for (const placement of placements) {
    countsByCluster.set(placement.clusterKey, (countsByCluster.get(placement.clusterKey) || 0) + 1);
    if (placement.clusterSlot === "top") {
      leadCount += 1;
      assert.equal(placement.w, 38);
      assert.equal(placement.h, 39);
    } else {
      assert.equal(placement.w, 33);
      assert.equal(placement.h, 34);
    }
    let overlapsFirstLayer = false;
    for (const excluded of firstLayerPlacements) {
      const x0 = Math.max(placement.x, excluded.x);
      const y0 = Math.max(placement.y, excluded.y);
      const x1 = Math.min(placement.x + placement.w, excluded.x + excluded.w);
      const y1 = Math.min(placement.y + placement.h, excluded.y + excluded.h);
      const overlapArea = x1 > x0 && y1 > y0 ? (x1 - x0) * (y1 - y0) : 0;
      if (overlapArea > 0) overlapsFirstLayer = true;
    }
    if (overlapsFirstLayer) placementsOnGrass += 1;
    else placementsInGaps += 1;
  }
  assert.equal(leadCount, countsByCluster.size);
  assert.ok(placementsInGaps >= placementsOnGrass);
});

test("buildOpenWorldBoulderPlacements spawns grouped boulder clusters that stay gap-biased", async () => {
  const { buildOpenWorldBoulderPlacements } = await import("../src/data/openworld-ground.js");
  const world = createMockWorld();
  const firstLayerPlacements = [
    { x: 32, y: 32, w: 416, h: 224 },
    { x: 512, y: 256, w: 352, h: 256 },
  ];
  const sprites = [
    { id: "lead_1", role: "lead", weight: 4, image: { complete: true }, w: 96, h: 84, sx: 0, sy: 0, sw: 96, sh: 84 },
    { id: "lead_2", role: "lead", weight: 3, image: { complete: true }, w: 78, h: 72, sx: 0, sy: 0, sw: 78, sh: 72 },
    { id: "support_1", role: "support", weight: 4, image: { complete: true }, w: 52, h: 40, sx: 0, sy: 0, sw: 52, sh: 40 },
    { id: "chip_1", role: "chip", weight: 6, image: { complete: true }, w: 20, h: 18, sx: 0, sy: 0, sw: 20, sh: 18 },
  ];

  const placements = buildOpenWorldBoulderPlacements(world, sprites, 1337, firstLayerPlacements, {
    minClusters: 6,
    maxClusters: 8,
    minClusterSize: 2,
    maxClusterSize: 4,
    minAnchorSpacing: 128,
    maxClusterRadius: 64,
    maxOverlapRatio: 0.12,
    gapTilePadding: 1,
    preferredGapRatio: 0.85,
  });

  assert.ok(placements.length >= 12);
  const countsByCluster = placements.reduce((acc, placement) => {
    acc[placement.clusterId] = (acc[placement.clusterId] || 0) + 1;
    return acc;
  }, {});
  assert.ok(Object.keys(countsByCluster).length >= 6);
  assert.ok(Object.values(countsByCluster).every((count) => count >= 2));

  let placementsInGaps = 0;
  let placementsOnGrass = 0;
  for (const placement of placements) {
    let overlapsFirstLayer = false;
    for (const excluded of firstLayerPlacements) {
      const x0 = Math.max(placement.x, excluded.x);
      const y0 = Math.max(placement.y, excluded.y);
      const x1 = Math.min(placement.x + placement.w, excluded.x + excluded.w);
      const y1 = Math.min(placement.y + placement.h, excluded.y + excluded.h);
      const overlapArea = x1 > x0 && y1 > y0 ? (x1 - x0) * (y1 - y0) : 0;
      if (overlapArea > 0) overlapsFirstLayer = true;
    }
    if (overlapsFirstLayer) placementsOnGrass += 1;
    else placementsInGaps += 1;
  }
  for (const count of Object.values(countsByCluster)) {
    assert.ok(count >= 2);
  }
  assert.ok(placementsInGaps >= placementsOnGrass);
});
