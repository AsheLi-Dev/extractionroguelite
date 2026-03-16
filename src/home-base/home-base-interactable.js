export class HomeBaseInteractable {
  constructor(config) {
    this.id = config.id;
    this.displayName = config.displayName;
    this.interactionType = config.interactionType;
    this.targetUI = config.targetUI || null;
    this.panelTitle = config.panelTitle || config.displayName;
    this.x = Number(config.x) || 0;
    this.y = Number(config.y) || 0;
    this.w = Math.max(16, Number(config.w) || 96);
    this.h = Math.max(16, Number(config.h) || 64);
    this.promptRadius = Math.max(32, Number(config.promptRadius) || 140);
    this.color = config.color || "#64748b";
    this.hideRect = config.hideRect === true;
  }

  getCenter() {
    return {
      x: this.x + this.w * 0.5,
      y: this.y + this.h * 0.5
    };
  }

  distanceToPoint(px, py) {
    const c = this.getCenter();
    const dx = c.x - px;
    const dy = c.y - py;
    return Math.hypot(dx, dy);
  }

  isInRange(px, py) {
    return this.distanceToPoint(px, py) <= this.promptRadius;
  }
}

/**
 * Hub-and-spoke layout: center = campfire (spawn). Stations in cardinal directions:
 * North = Skill Library (Cascade), West = Vault (Collector + Weapon Master),
 * East = Talent Tree (Limitless), South = Portal (Havoc), South of portal = Lure Altar (Deep),
 * Near center = Companion (Pacifier). Return menu for main menu.
 */
export function createHomeBaseInteractables(world) {
  const cx = world.width * 0.5;
  const cy = world.height * 0.5;
  const size = {
    campfire: { w: 170, h: 110 },
    building: { w: 180, h: 120 },
    altar: { w: 150, h: 88 },
    small: { w: 114, h: 72 }
  };

  // Offsets from center (cx, cy) for a compact hub
  const north = 220;
  const southPortal = 200;
  const eastWest = 280;
  const westIronsmith = eastWest + 200; // left of Vault (Collector)
  // Lure altar: down-right of portal, aligned vertically with Talent Tree (same x as east)
  const lureRightOfCenter = eastWest;
  const lureDownFromPortal = 90;
  const companionOffsetX = 80;
  const companionOffsetY = -100;

  return [
    // CENTER: Peace pillar — spawn point, hub anchor; visual is The Peace image (no rectangle)
    new HomeBaseInteractable({
      id: "campfire",
      displayName: "Campfire",
      interactionType: "center",
      targetUI: null,
      panelTitle: "Campfire",
      x: cx - size.campfire.w * 0.5,
      y: cy - size.campfire.h * 0.5,
      w: size.campfire.w,
      h: size.campfire.h,
      promptRadius: 120,
      color: "#f97316",
      hideRect: true
    }),
    // NORTH: Cascade Pillar (Skill Library) — visual is the Cascade image; no rectangle
    new HomeBaseInteractable({
      id: "skill-library",
      displayName: "Skill Library",
      interactionType: "skill-library",
      targetUI: "skill_library_overlay",
      panelTitle: "Skill Library",
      x: cx - size.building.w * 0.5,
      y: cy - north - size.building.h * 0.5,
      w: size.building.w,
      h: size.building.h,
      promptRadius: 150,
      color: "#a78bfa",
      hideRect: true
    }),
    // WEST (left of Vault): Ironsmith (Arsenal) — visual is The Arsenal image; no rectangle
    new HomeBaseInteractable({
      id: "ironsmith",
      displayName: "Ironsmith",
      interactionType: "ironsmith",
      targetUI: "ironsmith_overlay",
      panelTitle: "Ironsmith",
      x: cx - westIronsmith - size.building.w * 0.5,
      y: cy - size.building.h * 0.5,
      w: size.building.w,
      h: size.building.h,
      promptRadius: 150,
      color: "#78716c",
      hideRect: true
    }),
    // WEST: Vault (Collector) — visual is The Collector image; no rectangle
    new HomeBaseInteractable({
      id: "vault",
      displayName: "Vault",
      interactionType: "vault",
      targetUI: "pillar_overlay",
      panelTitle: "Vault",
      x: cx - eastWest - size.building.w * 0.5,
      y: cy - size.building.h * 0.5,
      w: size.building.w,
      h: size.building.h,
      promptRadius: 150,
      color: "#eab308",
      hideRect: true
    }),
    // WEST, BELOW VAULT: Rites & Pillars — blessings / pillar system
    new HomeBaseInteractable({
      id: "rites-pillars",
      displayName: "Rites & Pillars",
      interactionType: "pillars",
      targetUI: "pillar_overlay",
      panelTitle: "Rites & Pillars",
      x: cx - eastWest - size.small.w * 0.5,
      y: cy + 140 - size.small.h * 0.5,
      w: size.small.w,
      h: size.small.h,
      promptRadius: 118,
      color: "#8b5cf6"
    }),
    // EAST: Talent Tree (Limitless Pillar) — glowing tree / evolution monument
    new HomeBaseInteractable({
      id: "talent-tree",
      displayName: "Talent Tree",
      interactionType: "talents",
      targetUI: "talent_tree_overlay",
      panelTitle: "Talent Tree",
      x: cx + eastWest - size.building.w * 0.5,
      y: cy - size.building.h * 0.5,
      w: size.building.w,
      h: size.building.h,
      promptRadius: 150,
      color: "#22c55e"
    }),
    // SOUTH: Void Pillar — start run (portal function); visual is The Void image; no rectangle
    new HomeBaseInteractable({
      id: "portal-gate",
      displayName: "Portal Gate",
      interactionType: "portal",
      targetUI: "run_start",
      panelTitle: "Portal Gate",
      x: cx - size.building.w * 0.5,
      y: cy + southPortal - size.building.h * 0.5,
      w: size.building.w,
      h: size.building.h,
      promptRadius: 175,
      color: "#3b82f6",
      hideRect: true
    }),
    // DOWN-RIGHT OF PORTAL: Lure Altar (Deep Pillar) — ritual / abyss
    new HomeBaseInteractable({
      id: "lure-altar",
      displayName: "Lure Altar",
      interactionType: "lures",
      targetUI: "lure_ui",
      panelTitle: "Lure Altar",
      x: cx + lureRightOfCenter - size.altar.w * 0.5,
      y: cy + southPortal + lureDownFromPortal - size.altar.h * 0.5,
      w: size.altar.w,
      h: size.altar.h,
      promptRadius: 140,
      color: "#22d3ee"
    }),
    // NEAR CENTER (offset): Companion (Pacifier Pillar) — calm, friendly
    new HomeBaseInteractable({
      id: "companion",
      displayName: "Companions",
      interactionType: "companion",
      targetUI: "friends_overlay",
      panelTitle: "Companions",
      x: cx + companionOffsetX - size.small.w * 0.5,
      y: cy + companionOffsetY - size.small.h * 0.5,
      w: size.small.w,
      h: size.small.h,
      promptRadius: 118,
      color: "#f472b6"
    }),
    // PEACH PILLAR: Select Hero — choose which hero to walk the hub and start runs with
    new HomeBaseInteractable({
      id: "peach-pillar",
      displayName: "Peach Pillar",
      interactionType: "select-hero",
      targetUI: "select_hero_overlay",
      panelTitle: "Select Hero",
      x: cx - companionOffsetX - size.small.w * 0.5,
      y: cy + companionOffsetY - size.small.h * 0.5,
      w: size.small.w,
      h: size.small.h,
      promptRadius: 118,
      color: "#f59e0b"
    }),
    // Return to main menu (compact, out of main flow)
    new HomeBaseInteractable({
      id: "return-menu",
      displayName: "Return Shrine",
      interactionType: "menu-return",
      targetUI: "main_menu_return",
      panelTitle: "Return to Main Menu",
      x: cx - 260,
      y: cy - 220,
      w: size.small.w,
      h: size.small.h,
      promptRadius: 118,
      color: "#94a3b8"
    })
  ];
}
