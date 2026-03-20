export const GRID_SIZE = 4;

export const NODE_TYPES = {
  SAFE: "white",
  ELITE: "blue",
  DANGER: "yellow",
  BOSS: "red",
};

export const NODE_TAGS = {
  TREASURE: "treasure",
  ELITE_RICH: "eliteRich",
  CAMPFIRE: "campfire",
  ATTRACTION: "attraction",
  EXTRACTION: "extraction",
};

function rollNodeTag(x, y, type) {
  if (x === 0 && y === 0) return null;
  if (type === NODE_TYPES.BOSS) return NODE_TAGS.EXTRACTION;
  const r = Math.random();
  if (r < 0.11) return NODE_TAGS.TREASURE;
  if (r < 0.19) return NODE_TAGS.ELITE_RICH;
  if (r < 0.24) return NODE_TAGS.CAMPFIRE;
  if (r < 0.30) return NODE_TAGS.ATTRACTION;
  if (r < 0.35) return NODE_TAGS.EXTRACTION;
  return null;
}

export function generateRunMap() {
  const nodes = [];

  for (let y = 0; y < GRID_SIZE; y++) {
    nodes[y] = [];

    for (let x = 0; x < GRID_SIZE; x++) {
      const depth = x + y;

      let type;

      if (x === GRID_SIZE - 1 && y === GRID_SIZE - 1) {
        type = NODE_TYPES.BOSS;
      } else if (depth <= 1) {
        type = NODE_TYPES.SAFE;
      } else if (depth <= 3) {
        type = Math.random() < 0.7 ? NODE_TYPES.SAFE : NODE_TYPES.ELITE;
      } else if (depth <= 5) {
        type = Math.random() < 0.8 ? NODE_TYPES.ELITE : NODE_TYPES.DANGER;
      } else {
        type = Math.random() < 0.5 ? NODE_TYPES.ELITE : NODE_TYPES.DANGER;
      }

      nodes[y][x] = {
        x,
        y,
        type,
        tag: rollNodeTag(x, y, type),
        visited: false,
      };
    }
  }

  return nodes;
}
