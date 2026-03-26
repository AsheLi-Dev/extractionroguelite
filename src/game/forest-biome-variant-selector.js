import { NODE_TYPES } from './run-route-grid.js';
import {
  DEFAULT_FOREST_VARIANT_ID,
  FOREST_NODE_TIERS,
  FOREST_VARIANTS_BY_NODE_TIER,
  getForestVariantConfig,
} from '../data/forest-biome-variants.js';

export function resolveForestNodeTierFromNodeType(nodeType) {
  if (nodeType === NODE_TYPES.CALM || nodeType === NODE_TYPES.SAFE) return FOREST_NODE_TIERS.CALM;
  if (nodeType === NODE_TYPES.RISKY || nodeType === NODE_TYPES.ELITE) return FOREST_NODE_TIERS.RISKY;
  if (nodeType === NODE_TYPES.DEADLY || nodeType === NODE_TYPES.DANGER) return FOREST_NODE_TIERS.DEADLY;
  return null;
}

export function pickForestVariantForNodeTier(nodeTier, rng = Math.random) {
  const variants = FOREST_VARIANTS_BY_NODE_TIER[nodeTier];
  if (!Array.isArray(variants) || variants.length === 0) return DEFAULT_FOREST_VARIANT_ID;
  if (variants.length === 1) return variants[0];
  const roll = Math.max(0, Math.min(0.999999, Number(rng()) || 0));
  const index = Math.floor(roll * variants.length);
  return variants[index] || variants[0];
}

export function resolveForestVariantFromNodeType(nodeType, rng = Math.random) {
  const nodeTier = resolveForestNodeTierFromNodeType(nodeType) || FOREST_NODE_TIERS.CALM;
  const variantId = pickForestVariantForNodeTier(nodeTier, rng);
  return {
    nodeTier,
    variantId,
    variant: getForestVariantConfig(variantId),
  };
}
