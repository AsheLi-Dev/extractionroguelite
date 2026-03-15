const ALLOWED_TAGS = new Set([
  "projectile",
  "area",
  "ranged",
  "melee",
  "crowd_control",
  "aura",
  "defense",
  "utility",
  "curse"
]);

export function normalizeTags(tags = []) {
  const out = new Set();
  for (const raw of tags || []) {
    if (typeof raw !== "string") continue;
    const tag = raw.trim().toLowerCase();
    if (!tag || !ALLOWED_TAGS.has(tag)) continue;
    out.add(tag);
  }
  return out;
}

export function matchesTagFilter(skillTags, appliesTo) {
  if (!appliesTo) return true;
  const tags = skillTags instanceof Set ? skillTags : normalizeTags(skillTags);
  const any = normalizeTags(appliesTo.tagsAny || []);
  const all = normalizeTags(appliesTo.tagsAll || []);
  const none = normalizeTags(appliesTo.tagsNone || []);

  if (any.size > 0) {
    let hasAny = false;
    for (const tag of any) {
      if (tags.has(tag)) {
        hasAny = true;
        break;
      }
    }
    if (!hasAny) return false;
  }

  if (all.size > 0) {
    for (const tag of all) {
      if (!tags.has(tag)) return false;
    }
  }

  if (none.size > 0) {
    for (const tag of none) {
      if (tags.has(tag)) return false;
    }
  }

  return true;
}
