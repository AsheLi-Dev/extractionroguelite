const LURE_SELECTION_STORAGE_KEY = "homeBase_selected_lure_ids_v1";
const LURE_MAX_SELECTED = 2;
let selectedLureIdsCache = null;

const AVAILABLE_LURES = [
  {
    id: "ember-scent",
    name: "Ember Scent",
    shortLabel: "Ember",
    description: "Monsters are drawn to volatile embers. Increases encounter pressure."
  },
  {
    id: "moon-thread",
    name: "Moon Thread",
    shortLabel: "Moon",
    description: "A silver thread that guides rare paths. Improves rare room odds."
  },
  {
    id: "iron-chime",
    name: "Iron Chime",
    shortLabel: "Iron",
    description: "A heavy chime calling hardened foes. Raises elite encounter chance."
  },
  {
    id: "tide-vial",
    name: "Tide Vial",
    shortLabel: "Tide",
    description: "A small vial that bends routes. Increases event/merchant encounters."
  },
  {
    id: "void-pollen",
    name: "Void Pollen",
    shortLabel: "Void",
    description: "Dust from a collapsed gate. Improves reward variance."
  }
];

function normalizeSelectedIds(candidateIds) {
  const availableIdSet = new Set(AVAILABLE_LURES.map((entry) => entry.id));
  if (!Array.isArray(candidateIds)) return [];
  const result = [];
  for (const rawId of candidateIds) {
    const id = String(rawId || "");
    if (!availableIdSet.has(id)) continue;
    if (result.includes(id)) continue;
    result.push(id);
    if (result.length >= LURE_MAX_SELECTED) break;
  }
  return result;
}

function loadFromStorage() {
  try {
    const raw = localStorage.getItem(LURE_SELECTION_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return normalizeSelectedIds(parsed);
  } catch {
    return [];
  }
}

function saveToStorage(ids) {
  const normalized = normalizeSelectedIds(ids);
  try {
    localStorage.setItem(LURE_SELECTION_STORAGE_KEY, JSON.stringify(normalized));
  } catch {}
  return normalized;
}

export function getAvailableLures() {
  return AVAILABLE_LURES.slice();
}

export function getMaxSelectedLures() {
  return LURE_MAX_SELECTED;
}

export function getSelectedLureIds() {
  if (!Array.isArray(selectedLureIdsCache)) {
    selectedLureIdsCache = loadFromStorage();
  }
  return selectedLureIdsCache.slice();
}

export function setSelectedLureIds(ids) {
  const saved = saveToStorage(ids);
  selectedLureIdsCache = saved.slice();
  return saved.slice();
}

export function getSelectedLures() {
  const selected = getSelectedLureIds();
  const selectedSet = new Set(selected);
  return AVAILABLE_LURES.filter((entry) => selectedSet.has(entry.id));
}

export function toggleLureSelection(lureId) {
  const id = String(lureId || "");
  const available = new Set(AVAILABLE_LURES.map((entry) => entry.id));
  if (!available.has(id)) {
    return {
      changed: false,
      reason: "unknown_lure",
      selectedLureIds: getSelectedLureIds()
    };
  }

  const selected = getSelectedLureIds();
  const index = selected.indexOf(id);
  if (index >= 0) {
    selected.splice(index, 1);
    const saved = setSelectedLureIds(selected);
    return {
      changed: true,
      reason: "removed",
      selectedLureIds: saved
    };
  }

  if (selected.length >= LURE_MAX_SELECTED) {
    return {
      changed: false,
      reason: "max_selected",
      selectedLureIds: selected
    };
  }

  selected.push(id);
  const saved = setSelectedLureIds(selected);
  return {
    changed: true,
    reason: "added",
    selectedLureIds: saved
  };
}

export function getSelectedLureSummaryText() {
  const selected = getSelectedLures();
  if (selected.length === 0) return "No lures equipped";
  return selected.map((entry) => entry.name).join(", ");
}
