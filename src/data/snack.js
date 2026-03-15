export const SNACK_TYPES = [
  {
    id: "bread",
    name: "Bread",
    icon: "🍞",
    description: "A simple run snack. Restores a small amount when the full snack system is enabled.",
    maxUses: 3
  },
  {
    id: "espresso",
    name: "Espresso",
    icon: "☕",
    description: "A sharp boost in a cup. Will hook into temporary combat speed effects later.",
    maxUses: 2
  },
  {
    id: "herbal_tea",
    name: "Herbal Tea",
    icon: "🍵",
    description: "A calming brew reserved for future sustain-oriented effects.",
    maxUses: 2
  }
];

export const SNACK_IDS = SNACK_TYPES.map((entry) => entry.id);

export function getSnackById(snackId) {
  return SNACK_TYPES.find((entry) => entry.id === snackId) || null;
}
