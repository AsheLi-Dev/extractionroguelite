export const CLAN_BONUSES = {
  savage: [
    { threshold: 2, id: "savage_bleed", desc: "Melee attacks apply Bleed (20% hit damage over 2s)." },
    { threshold: 4, id: "savage_bleed_stacks", desc: "Bleed can stack up to 100." }
  ],
  swift: [
    { threshold: 2, id: "swift_tempo", desc: "On hit: gain +2% attack speed for 2s, up to 10 stacks." },
    { threshold: 4, id: "swift_overclock", desc: "Tempo cap is 30 stacks; each stack also grants +0.5% move speed." }
  ],
  arcana: [
    { threshold: 2, id: "arcana_flow", desc: "On skill cast: reduce one other random skill cooldown by 0.3s." },
    { threshold: 4, id: "arcana_resonance", desc: "Flow reduces 0.6s and skill casts restore 5 health." }
  ],
  hoarder: [
    { threshold: 2, id: "hoarder_scavenge_instinct", desc: "Search chests 20% faster." },
    { threshold: 4, id: "hoarder_brutal_hoarding", desc: "Deal 100% increased damage to breakables." }
  ],
  bulwark: [
    { threshold: 2, id: "bulwark_second_wind", desc: "On damage (3s ICD): heal 10% of damage taken per second for 3s." },
    { threshold: 4, id: "bulwark_iron_skin", desc: "On damage: remove debuffs and heal 10% max HP per debuff removed." }
  ]
};
