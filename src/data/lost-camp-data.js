/**
 * Lost Camp stamp data extracted from Lost Camp1.tmj (Tiled map).
 * Used for LOST_CAMPS archetype cells: tile layer (20×20), collision objects (ifCollision/isCollision),
 * and chest spawn points (template lostcampChest.tx or isChest).
 */
export const LOST_CAMP_TILE_WIDTH = 20;
export const LOST_CAMP_TILE_HEIGHT = 20;
export const LOST_CAMP_TILE_SIZE = 32;

/** First tileset from TMJ: Desert Land decorative_props.png, 16 columns */
export const LOST_CAMP_TILESET = {
  firstgid: 1,
  columns: 16,
  image: "assets/Environments/Desert Land/decorative_props.png",
};

/** Tile layer data (row-major, 20×20). GID 0 = empty. */
export const LOST_CAMP_TILE_DATA = [
  548, 530, 567, 568, 35, 0, 0, 0, 0, 0, 0, 538, 570, 547, 566, 533, 534, 0, 553, 0,
  561, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 561, 537, 554, 563,
  0, 0, 19, 18, 0, 0, 0, 0, 20, 0, 0, 19, 0, 0, 3, 20, 0, 546, 0, 0,
  0, 4, 0, 0, 0, 0, 0, 36, 0, 0, 18, 36, 33, 18, 3, 0, 0, 546, 550, 0,
  0, 0, 0, 0, 145, 146, 147, 0, 0, 74, 0, 19, 17, 0, 0, 0, 0, 0, 529, 0,
  0, 151, 152, 0, 161, 162, 163, 0, 0, 90, 2, 4, 34, 58, 0, 0, 0, 0, 562, 0,
  0, 167, 168, 0, 177, 178, 179, 0, 3, 0, 0, 0, 17, 1, 0, 545, 538, 0, 0, 561,
  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 57, 0, 17, 0, 0, 548, 533, 0, 535,
  0, 183, 184, 0, 0, 0, 0, 0, 0, 0, 0, 73, 0, 0, 117, 0, 0, 566, 0, 538,
  0, 199, 200, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 133, 0, 0, 0, 0, 0,
  0, 0, 0, 0, 0, 97, 35, 0, 100, 0, 117, 0, 0, 33, 0, 0, 120, 0, 0, 554,
  0, 183, 184, 0, 0, 113, 114, 115, 116, 0, 133, 0, 34, 33, 0, 527, 136, 0, 0, 533,
  0, 199, 200, 0, 0, 129, 130, 131, 132, 0, 0, 35, 36, 120, 0, 543, 0, 532, 551, 533,
  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 136, 0, 0, 0, 566, 569, 569,
  0, 528, 0, 17, 0, 0, 0, 527, 0, 0, 20, 0, 0, 0, 0, 0, 565, 550, 532, 0,
  0, 544, 0, 0, 0, 18, 0, 543, 0, 0, 0, 0, 0, 533, 531, 550, 530, 554, 0, 0,
  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 538, 570, 529, 536, 0, 562, 0, 0, 0, 0,
  545, 537, 0, 0, 0, 0, 534, 550, 551, 552, 531, 567, 545, 563, 547, 569, 534, 545, 530, 0,
  552, 552, 567, 535, 549, 564, 567, 546, 0, 0, 532, 530, 529, 535, 531, 570, 0, 551, 562, 0,
  0, 0, 0, 0, 0, 0, 0, 553, 553, 545, 553, 535, 569, 0, 0, 0, 0, 0, 0, 0,
];

/** Object layer: collision (ifCollision/isCollision === "yes") and chest (template lostcampChest or isChest). */
export const LOST_CAMP_OBJECTS = [
  { x: 225, y: 314.5, template: "lostcampChest.tx" },
  { x: 157.5, y: 341.5, width: 130.5, height: 73, ifCollision: "yes" },
  { x: 329.5, y: 327, width: 23, height: 57, ifCollision: "yes" },
  { x: 463.5, y: 268, width: 12, height: 50.5, ifCollision: "yes" },
  { x: 162.5, y: 310.5, template: "lostcampChest.tx" },
  { x: 195.5, y: 274, template: "lostcampChest.tx" },
  { x: 257.5, y: 318, template: "lostcampChest.tx" },
  { x: 257, y: 251, template: "lostcampChest.tx" },
  { x: 135.5, y: 130.5, width: 78.5, height: 91.5, ifCollision: "yes" },
  { x: 362.5, y: 230.5, width: 14, height: 55, ifCollision: "yes" },
  { x: 300.5, y: 144, width: 9.5, height: 35, ifCollision: "yes" },
];
