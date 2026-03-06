export const ANCESTOR_SPIRIT_DEFS = {
  savage_brute_normal: {
    id: "savage_brute_normal",
    name: "Savage Brute",
    rarity: "normal",
    clans: ["savage"],
    description: "+15% melee damage while resonating.",
    effects: {
      staticMods: [
        {
          id: "meleeDamagePct",
          label: "Melee Damage",
          statKey: "skillDamage",
          value: 0.15,
          appliesTo: { tagsAny: ["melee"] }
        }
      ]
    }
  },
  savage_berserk_magic: {
    id: "savage_berserk_magic",
    name: "Savage Berserk",
    rarity: "magic",
    clans: ["savage"],
    description: "When damaged, gain +20% melee attack speed for 5s.",
    effects: {
      hooks: {
        onPlayerDamaged: "savage_berserk_on_player_damaged"
      }
    }
  },
  savage_warlord_rare: {
    id: "savage_warlord_rare",
    name: "Savage Warlord",
    rarity: "rare",
    clans: ["savage"],
    description: "+2 flat base damage to melee attacks.",
    effects: {
      staticMods: [
        {
          id: "meleeFlatDamage",
          label: "Melee Flat Damage",
          statKey: "flatDamage",
          value: 2,
          appliesTo: { tagsAny: ["melee"] }
        }
      ]
    }
  },
  savage_tyrant_legendary: {
    id: "savage_tyrant_legendary",
    name: "Savage Tyrant",
    rarity: "legendary",
    clans: ["savage"],
    description: "Gain +1% attack damage per +2% attack speed you have.",
    effects: {
      hooks: {
        onTick: "savage_tyrant_dynamic_attack_damage"
      }
    }
  },

  skirmisher_karg_normal: {
    id: "skirmisher_karg_normal",
    name: "Skirmisher Karg",
    rarity: "normal",
    clans: ["savage", "swift"],
    description: "Gain +20% melee damage for 2s after hitting an enemy with a ranged attack.",
    effects: {
      hooks: {
        onHit: "skirmisher_karg_ranged_hit_grants_melee_damage"
      }
    }
  },
  huntmaster_vel_normal: {
    id: "huntmaster_vel_normal",
    name: "Huntmaster Vel",
    rarity: "normal",
    clans: ["savage", "swift"],
    description: "Gain +20% ranged damage for 3s after hitting an enemy with a melee attack.",
    effects: {
      hooks: {
        onHit: "huntmaster_vel_melee_hit_grants_ranged_damage"
      }
    }
  },
  giant_slayer_rorn_magic: {
    id: "giant_slayer_rorn_magic",
    name: "Giant Slayer Rorn",
    rarity: "magic",
    clans: ["savage"],
    description: "Deal 20% increased damage to elites and mini-bosses.",
    effects: {
      hooks: {
        onHit: "giant_slayer_rorn_vs_elites"
      }
    }
  },
  scavenger_king_thalos_rare: {
    id: "scavenger_king_thalos_rare",
    name: "Scavenger King Thalos",
    rarity: "rare",
    clans: ["hoarder", "savage"],
    description: "Picking up loot creates a shockwave that deals 100% of your attack damage around you.",
    effects: {
      hooks: {
        onTick: "scavenger_king_thalos_loot_shockwave"
      }
    }
  },
  battle_shaman_gorr_magic: {
    id: "battle_shaman_gorr_magic",
    name: "Battle Shaman Gorr",
    rarity: "magic",
    clans: ["arcana", "savage"],
    description: "After using a skill, gain +10% melee damage for 5s. Stacks up to 3 times.",
    effects: {
      hooks: {
        onTick: "battle_shaman_gorr_skill_cast_melee_damage"
      }
    }
  },
  quartermaster_elra_normal: {
    id: "quartermaster_elra_normal",
    name: "Quartermaster Elra",
    rarity: "normal",
    clans: ["hoarder", "bulwark"],
    description: "Restore 2% of your maximum health when picking up loot.",
    effects: {
      hooks: {
        onTick: "quartermaster_elra_loot_heal"
      }
    }
  },
  conqueror_baelor_magic: {
    id: "conqueror_baelor_magic",
    name: "Conqueror Baelor",
    rarity: "magic",
    clans: ["bulwark"],
    description: "After killing a mini-boss, gain 20% reduced damage for a short duration.",
    effects: {
      hooks: {
        onTick: "conqueror_baelor_miniboss_kill_guard"
      }
    }
  },
  wrecker_drogan_magic: {
    id: "wrecker_drogan_magic",
    name: "Wrecker Drogan",
    rarity: "magic",
    clans: ["hoarder", "savage"],
    description: "Breaking an object grants +15% melee damage for 5s.",
    effects: {
      hooks: {
        onTick: "wrecker_drogan_break_melee_damage"
      }
    }
  },
  tomb_raider_myra_rare: {
    id: "tomb_raider_myra_rare",
    name: "Tomb Raider Myra",
    rarity: "rare",
    clans: ["hoarder", "swift"],
    description: "Breaking an object restores 5 health and refreshes your dash cooldown.",
    effects: {
      hooks: {
        onTick: "tomb_raider_myra_break_heal_dash"
      }
    }
  },
  arcane_treasurer_solon_rare: {
    id: "arcane_treasurer_solon_rare",
    name: "Arcane Treasurer Solon",
    rarity: "rare",
    clans: ["hoarder", "arcana"],
    description: "After opening a chest, reduce the cooldown of a random skill by 4s.",
    effects: {
      hooks: {
        onTick: "arcane_treasurer_solon_chest_cdr"
      }
    }
  },
  treasure_hunter_kest_magic: {
    id: "treasure_hunter_kest_magic",
    name: "Treasure Hunter Kest",
    rarity: "magic",
    clans: ["hoarder", "swift"],
    description: "After opening a chest, gain +15% ranged damage for 3s.",
    effects: {
      hooks: {
        onTick: "treasure_hunter_kest_chest_ranged_damage"
      }
    }
  },
  tinker_jack_magic: {
    id: "tinker_jack_magic",
    name: "Tinker Jack",
    rarity: "magic",
    clans: ["hoarder"],
    description: "Killing an enemy grants a stack of Handy (+1% chest opening speed for 10s), up to 20 stacks.",
    effects: {
      hooks: {
        onTick: "tinker_jack_handy_stacks"
      }
    }
  },
  frost_archer_lyra_rare: {
    id: "frost_archer_lyra_rare",
    name: "Frost Archer Lyra",
    rarity: "rare",
    clans: ["swift", "arcana"],
    description: "Ranged hits freeze enemies for 0.1s.",
    effects: {
      hooks: {
        onHit: "frost_archer_lyra_ranged_freeze"
      }
    }
  },
  warcaller_aresk_rare: {
    id: "warcaller_aresk_rare",
    name: "Warcaller Aresk",
    rarity: "rare",
    clans: ["savage", "swift"],
    description: "Ranged hits apply Vulnerability: +1% melee damage taken for 5s, up to 15 stacks.",
    effects: {
      hooks: {
        onHit: "warcaller_aresk_ranged_vulnerability"
      }
    }
  },
  spell_reaver_talion_magic: {
    id: "spell_reaver_talion_magic",
    name: "Spell Reaver Talion",
    rarity: "magic",
    clans: ["arcana", "swift"],
    description: "Killing an enemy reduces the cooldown of a random skill by 0.2s.",
    effects: {
      hooks: {
        onTick: "spell_reaver_talion_kill_cdr"
      }
    }
  },
  spirit_healer_alenya_magic: {
    id: "spirit_healer_alenya_magic",
    name: "Spirit Healer Alenya",
    rarity: "magic",
    clans: ["arcana", "bulwark"],
    description: "Restore 5% of your maximum health when you kill an enemy with a skill.",
    effects: {
      hooks: {
        onTick: "spirit_healer_alenya_skill_kill_heal"
      }
    }
  },
  martyr_saint_varkos_rare: {
    id: "martyr_saint_varkos_rare",
    name: "Martyr Saint Varkos",
    rarity: "rare",
    clans: ["bulwark", "savage"],
    description: "When a debuff is applied to you, gain +20% damage for 5s.",
    effects: {
      hooks: {
        onTick: "martyr_saint_varkos_on_debuff_gain_damage"
      }
    }
  },
  cursed_oracle_nyssa_legendary: {
    id: "cursed_oracle_nyssa_legendary",
    name: "Cursed Oracle Nyssa",
    rarity: "legendary",
    clans: ["arcana", "bulwark"],
    description: "Debuffs on you expire 50% faster, but debuffs you apply to enemies are also applied to you.",
    effects: {
      hooks: {
        onHit: "cursed_oracle_nyssa_reflect_debuffs",
        onTick: "cursed_oracle_nyssa_debuff_expiry"
      }
    }
  },
  untouched_champion_ardyn_legendary: {
    id: "untouched_champion_ardyn_legendary",
    name: "Untouched Champion Ardyn",
    rarity: "legendary",
    clans: ["bulwark"],
    description: "If you have not taken damage for 10s, gain +20% damage and 20% reduced damage taken.",
    effects: {
      hooks: {
        onTick: "untouched_champion_ardyn_no_hit_buff"
      }
    }
  },
  silent_thief_varro_magic: {
    id: "silent_thief_varro_magic",
    name: "Silent Thief Varro",
    rarity: "magic",
    clans: ["hoarder", "bulwark"],
    description: "If you have not taken damage for 10s, open chests 30% faster.",
    effects: {
      hooks: {
        onTick: "silent_thief_varro_no_hit_chest_speed"
      }
    }
  },
  windrunner_selis_rare: {
    id: "windrunner_selis_rare",
    name: "Windrunner Selis",
    rarity: "rare",
    clans: ["swift", "arcana"],
    description: "If you have not taken damage for 10s, gain +10% movement speed and +10% cooldown recovery.",
    effects: {
      hooks: {
        onTick: "windrunner_selis_no_hit_speed_cdr"
      }
    }
  },
  survivor_kade_magic: {
    id: "survivor_kade_magic",
    name: "Survivor Kade",
    rarity: "magic",
    clans: ["swift", "bulwark"],
    description: "After taking damage, gain +40% movement speed for 0.5s.",
    effects: {
      hooks: {
        onPlayerDamaged: "survivor_kade_on_damage_speed"
      }
    }
  },
  earthshaker_torv_rare: {
    id: "earthshaker_torv_rare",
    name: "Earthshaker Torv",
    rarity: "rare",
    clans: ["bulwark", "savage"],
    description: "After taking damage, create a shockwave that pushes nearby enemies away and stuns them for 0.2s.",
    effects: {
      hooks: {
        onPlayerDamaged: "earthshaker_torv_on_damage_shockwave"
      }
    }
  },
  thornlord_bram_rare: {
    id: "thornlord_bram_rare",
    name: "Thornlord Bram",
    rarity: "rare",
    clans: ["bulwark"],
    description: "When hit by an enemy, deal damage to that enemy equal to 5% of your maximum health.",
    effects: {
      hooks: {
        onPlayerDamaged: "thornlord_bram_reflect"
      }
    }
  },
  last_stand_warlord_draven_legendary: {
    id: "last_stand_warlord_draven_legendary",
    name: "Last Stand Warlord Draven",
    rarity: "legendary",
    clans: ["bulwark", "swift"],
    description: "When life drops below 50%, refresh dash and all skill cooldowns (40s internal cooldown).",
    effects: {
      hooks: {
        onPlayerDamaged: "last_stand_warlord_draven_low_life_refresh"
      }
    }
  },
  chronomancer_ishtar_legendary: {
    id: "chronomancer_ishtar_legendary",
    name: "Chronomancer Ishtar",
    rarity: "legendary",
    clans: ["arcana", "swift"],
    description: "Whenever you reduce a skill cooldown, reduce dash cooldown by the same amount (once per second).",
    effects: {
      hooks: {
        onTick: "chronomancer_ishtar_cdr_to_dash"
      }
    }
  }
};

const RARITY_DROP_WEIGHTS = {
  normal: 24,
  magic: 14,
  rare: 8,
  legendary: 3
};

export const ANCESTOR_SPIRIT_DROP_TABLE = Object.values(ANCESTOR_SPIRIT_DEFS).map((def) => ({
  defId: def.id,
  weight: RARITY_DROP_WEIGHTS[String(def.rarity || "normal").toLowerCase()] ?? 1
}));

const SPIRIT_IDS_BY_RARITY = {
  normal: [],
  magic: [],
  rare: [],
  legendary: []
};
for (const def of Object.values(ANCESTOR_SPIRIT_DEFS)) {
  const rarity = String(def.rarity || "normal").toLowerCase();
  if (!SPIRIT_IDS_BY_RARITY[rarity]) SPIRIT_IDS_BY_RARITY[rarity] = [];
  SPIRIT_IDS_BY_RARITY[rarity].push(def.id);
}

export function getAncestorSpiritDef(defId) {
  return ANCESTOR_SPIRIT_DEFS[defId] || null;
}

export function pickRandomAncestorSpiritDefId(rng = Math.random) {
  let total = 0;
  for (const row of ANCESTOR_SPIRIT_DROP_TABLE) total += row.weight;
  if (total <= 0) return null;
  let roll = rng() * total;
  for (const row of ANCESTOR_SPIRIT_DROP_TABLE) {
    roll -= row.weight;
    if (roll <= 0) return row.defId;
  }
  return ANCESTOR_SPIRIT_DROP_TABLE[0]?.defId || null;
}

export function pickRandomAncestorSpiritDefIdByRarity(rarity, rng = Math.random) {
  const key = String(rarity || "normal").toLowerCase();
  const pool = SPIRIT_IDS_BY_RARITY[key] || [];
  if (!pool.length) return null;
  const idx = Math.floor(rng() * pool.length);
  return pool[idx] || null;
}
