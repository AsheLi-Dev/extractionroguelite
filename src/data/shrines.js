export const SHRINE_DEFS = [
  {
    id: "purification",
    name: "Shrine of Purification",
    description: "Disabled while permanent basic attack trees are active.",
    icon: "spr_shrine_purification",
    color: "#ffffff",
    auraColor: "#e0e7ff",
    disabled: true
  },
  {
    id: "chaos",
    name: "Shrine of Chaos",
    description: "Disabled while permanent basic attack trees are active.",
    icon: "spr_shrine_chaos",
    color: "#f59e0b",
    auraColor: "#fef3c7",
    disabled: true
  },
  {
    id: "frenzy",
    name: "Shrine of Frenzy",
    description: "Disabled while permanent basic attack trees are active.",
    icon: "spr_shrine_frenzy",
    color: "#ef4444",
    auraColor: "#fee2e2",
    disabled: true
  },
  {
    id: "ascension",
    name: "Shrine of Ascension",
    description: "Disabled while permanent basic attack trees are active.",
    icon: "spr_shrine_ascension",
    color: "#fbbf24",
    auraColor: "#fef3c7",
    disabled: true
  },
  {
    id: "restoration",
    name: "Shrine of Restoration",
    description: "Disabled while permanent basic attack trees are active.",
    icon: "spr_shrine_restoration",
    color: "#22c55e",
    auraColor: "#dcfce7",
    disabled: true
  },
  {
    id: "trial",
    name: "Shrine of Trial",
    description: "Disabled while permanent basic attack trees are active.",
    icon: "spr_shrine_trial",
    color: "#7f1d1d",
    auraColor: "#fee2e2",
    disabled: true
  }
];

export const EVENT_DEFS = [
  {
    id: "stranger",
    name: "The Stranger",
    desc: "A hooded figure emerges from the shadows. \"Please... I need to return home. Will you escort me to the Dungeon?\"",
    choices: [
      { id: "help", label: "Help them" },
      { id: "refuse", label: "Refuse" }
    ]
  },
  {
    id: "merchant",
    name: "The Merchant",
    desc: "A well-dressed merchant approaches. \"Invest an item with me. I shall repay you handsomely... after you defeat the Tyrant.\"",
    choices: [
      { id: "invest", label: "Invest an item" },
      { id: "decline", label: "Decline" }
    ]
  },
  {
    id: "shrine",
    name: "The Shrine",
    desc: "An ancient shrine hums with forgotten magic. It offers a tradeor destruction.",
    choices: [
      { id: "offerXp", label: "Offer 30% XP" },
      { id: "destroy", label: "Destroy all equipment, double LP reward" }
    ]
  },
  {
    id: "cursedChest",
    name: "The Cursed Chest",
    desc: "A chest radiates dark energy. Opening it may grant great poweror awaken something terrible.",
    choices: [
      { id: "open", label: "Open it" },
      { id: "leave", label: "Leave it" }
    ]
  },
  {
    id: "fiery",
    name: "The Fiery",
    desc: "A golden fiery materializes and darts across the room! Defeat it within 30 seconds to claim its treasures.",
    choices: []
  }
];
