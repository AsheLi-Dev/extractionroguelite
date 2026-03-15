export const REST_ROOM_MAP_ID = -1;

export const REST_ROOM_MAP_DEF = Object.freeze({
  id: REST_ROOM_MAP_ID,
  name: "Rest Room",
  number: 0,
  floorColor: "#131722",
  floorPattern: "tiles",
  wallColor: "#2b3245",
  wallAccent: "#48516b",
  exits: [],
  enemyCount: 0,
  enemyScale: { hp: 0, attack: 0, speed: 0 },
  lootQuality: 0,
  isRestRoom: true
});

export const REST_ROOM_WORLD_PRESET = Object.freeze({
  W: 30,
  H: 20,
  config: {
    roomMinSize: 5,
    roomMaxSize: 9,
    roomAttempts: 8,
    extraConnectors: 0,
    windingPercent: 0
  }
});

export const REST_ROOM_LAYOUT = Object.freeze({
  stations: Object.freeze([
    Object.freeze({
      id: "restSnackFountain",
      type: "restSnackStand",
      x: 160,
      y: 250,
      w: 96,
      h: 96,
      interactive: true,
      consumeOnInteract: false,
      label: "Snack Fountain",
      labelOffsetY: -14,
      promptLabel: "Refill Snack",
      spriteSrc: "assets/images/snack stand.png",
      collisionRect: { x: 16, y: 48, w: 64, h: 48 }
    }),
    Object.freeze({
      id: "restUpgradeReforge",
      type: "restUpgradeReforge",
      x: 300,
      y: 250,
      w: 96,
      h: 96,
      interactive: true,
      consumeOnInteract: false,
      label: "Upgrade Reforge",
      labelOffsetY: -14,
      promptLabel: "Reforge Upgrade",
      spriteSrc: "assets/images/upgrade reforge.png",
      collisionRect: { x: 16, y: 48, w: 64, h: 48 }
    }),
    Object.freeze({
      id: "restAttributes",
      type: "restAttributes",
      x: 440,
      y: 250,
      w: 96,
      h: 96,
      interactive: true,
      consumeOnInteract: false,
      label: "Attributes",
      labelOffsetY: -14,
      promptLabel: "Gain Attribute",
      spriteSrc: "assets/images/attribute.png",
      collisionRect: { x: 16, y: 48, w: 64, h: 48 }
    }),
    Object.freeze({
      id: "restUpgradeVendor",
      type: "restUpgradeVendor",
      x: 580,
      y: 250,
      w: 96,
      h: 96,
      interactive: true,
      consumeOnInteract: false,
      label: "Upgrade Vendor",
      labelOffsetY: -14,
      promptLabel: "Browse Upgrades",
      spriteSrc: "assets/images/upgrade vendor.png",
      collisionRect: { x: 16, y: 48, w: 64, h: 48 }
    })
  ]),
  exit: Object.freeze({
    type: "restRoomExit",
    x: 860,
    y: 250,
    w: 96,
    h: 96,
    consumeOnInteract: false,
    continueLabel: "Continue Run"
  })
});

export const REST_ROOM_VENDOR_OFFER_COUNT = 4;
export const REST_ROOM_VENDOR_COSTS = Object.freeze({
  common: 50,
  uncommon: 90,
  rare: 150
});

export const REST_ROOM_REFORGE_COST = 80;

export function isRestRoomMapId(mapId) {
  return Number(mapId) === REST_ROOM_MAP_ID;
}
