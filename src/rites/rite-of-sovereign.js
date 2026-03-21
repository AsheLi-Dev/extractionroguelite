function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function rand(min, max) {
  return min + Math.random() * (max - min);
}

function pickRandomExcluding(pool, exclude) {
  const filtered = pool.filter((id) => id !== exclude);
  if (!filtered.length) return pool[0] || null;
  return filtered[Math.floor(Math.random() * filtered.length)];
}

const STYLE_DEFS = Object.freeze([
  { id: 'the_deep', pillarName: 'The Deep', color: '#6366f1' },
  { id: 'havoc', pillarName: 'Havoc', color: '#ef4444' },
  { id: 'weapon_master', pillarName: 'Weapon Master', color: '#f59e0b' },
  { id: 'limitless', pillarName: 'Limitless', color: '#22c55e' },
  { id: 'void', pillarName: 'Void', color: '#8b5cf6' },
  { id: 'pacifier', pillarName: 'Pacifier', color: '#14b8a6' },
  { id: 'collector', pillarName: 'Collector', color: '#eab308' },
  { id: 'cascade', pillarName: 'Cascade', color: '#38bdf8' }
]);

const STYLE_IDS = STYLE_DEFS.map((style) => style.id);

function getStyleDef(styleId) {
  return STYLE_DEFS.find((entry) => entry.id === styleId) || STYLE_DEFS[0];
}

function createHud() {
  const hud = document.createElement('div');
  hud.id = 'rite-sovereign-hud';
  hud.className = 'rite-sovereign-hud';
  hud.innerHTML = `
    <div class="rite-sovereign-title">Rite of Sovereign</div>
    <div id="rite-sovereign-style" class="rite-sovereign-style"></div>
    <div id="rite-sovereign-objective" class="rite-sovereign-objective"></div>
    <div id="rite-sovereign-meta" class="rite-sovereign-meta"></div>
  `;
  document.body.appendChild(hud);
  return hud;
}

function createResultPanel() {
  const panel = document.createElement('div');
  panel.id = 'rite-sovereign-result';
  panel.className = 'rite-sovereign-result hidden';
  panel.innerHTML = `
    <div class="rite-sovereign-result-surface">
      <h2 id="rite-sovereign-result-title"></h2>
      <p id="rite-sovereign-result-body"></p>
      <button id="rite-sovereign-result-close" type="button">Return to Home Base</button>
    </div>
  `;
  document.body.appendChild(panel);
  return panel;
}

function getEntityCenter(entity) {
  return {
    x: entity.position.x + entity.size * 0.5,
    y: entity.position.y + entity.size * 0.5
  };
}

function createSovereignBoss(x, y) {
  return {
    id: 'sovereign_guardian',
    name: 'Sovereign Guardian',
    isBoss: true,
    position: { x, y },
    size: 180,
    color: '#a78bfa',
    maxHealth: 3200,
    health: 3200,
    attack: 22,
    speed: 140,
    defense: 8,
    hitFlashTimer: 0,
    healthBarShakeTimer: 0,
    invulnUntil: 0,
    takeDamage(amount) {
      if (this.invulnUntil > (this.__time || 0)) {
        return;
      }
      const dmg = Math.max(0, Number(amount) || 0);
      this.health = Math.max(0, this.health - dmg);
      this.hitFlashTimer = 0.1;
      this.healthBarShakeTimer = 0.28;
    },
    get isDead() {
      return this.health <= 0;
    },
    intersects(other) {
      const a = { x: this.position.x, y: this.position.y, w: this.size, h: this.size };
      const b = { x: other.position.x, y: other.position.y, w: other.size, h: other.size };
      return (
        a.x < b.x + b.w &&
        a.x + a.w > b.x &&
        a.y < b.y + b.h &&
        a.y + a.h > b.y
      );
    },
    draw(ctx, camera, gameTime = 0) {
      const sx = this.position.x - camera.position.x;
      const sy = this.position.y - camera.position.y;
      const cx = sx + this.size * 0.5;
      const cy = sy + this.size * 0.5;
      const pulse = 0.7 + 0.3 * Math.sin(gameTime * 3.5);
      ctx.save();
      ctx.globalAlpha = this.hitFlashTimer > 0 ? 0.96 : 1;
      ctx.fillStyle = `rgba(99, 102, 241, ${0.25 + 0.2 * pulse})`;
      ctx.beginPath();
      ctx.arc(cx, cy, this.size * 0.62, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#c4b5fd';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(cx, cy, this.size * 0.42, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = '#312e81';
      ctx.beginPath();
      ctx.arc(cx, cy, this.size * 0.3, 0, Math.PI * 2);
      ctx.fill();
      if (this.invulnUntil > gameTime) {
        ctx.strokeStyle = 'rgba(147, 197, 253, 0.95)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(cx, cy, this.size * 0.5, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
    }
  };
}

export function installRiteOfSovereign(game, options = {}) {
  if (!game || game.__sovereignInstalled) return null;
  const riteId = String(options.riteId || 'rite_of_sovereign');
  if (riteId !== 'rite_of_sovereign') return null;

  const hud = createHud();
  const resultPanel = createResultPanel();
  const styleEl = hud.querySelector('#rite-sovereign-style');
  const objectiveEl = hud.querySelector('#rite-sovereign-objective');
  const metaEl = hud.querySelector('#rite-sovereign-meta');
  const resultTitleEl = resultPanel.querySelector('#rite-sovereign-result-title');
  const resultBodyEl = resultPanel.querySelector('#rite-sovereign-result-body');
  const resultCloseBtn = resultPanel.querySelector('#rite-sovereign-result-close');

  const state = {
    riteId,
    completed: false,
    failed: false,
    phase: 'phase_1',
    currentStyle: STYLE_IDS[0],
    previousStyle: null,
    styleTimer: 22,
    styleDuration: 22,
    styleSwitchCount: 0,
    styleHistory: [],
    thresholdSwitches: new Set(),
    arena: {
      centerX: 1280,
      centerY: 760,
      radius: 560
    },
    effects: [],
    styleData: {},
    validations: []
  };

  const baseUpdate = game.update.bind(game);
  const baseRender = game.render.bind(game);
  const baseShowGameOver = game.showGameOver?.bind(game);
  const baseDestroy = game.destroy?.bind(game);
  const baseUpdateBoss = game.updateBoss?.bind(game);

  const activeRite = game.getActiveRiteSummary?.();
  if (activeRite?.activeRiteId !== riteId) {
    const begin = game.beginRite?.(riteId);
    if (!begin?.success) {
      console.warn('[RiteOfSovereign] beginRite failed:', begin?.reason || 'unknown');
    }
  }

  game.world.width = 2560;
  game.world.height = 1520;
  game.world.wallThickness = 56;
  game.world.tileWallRects = [];
  game.world.proceduralExitZones = [];
  game.currentMap = {
    ...(game.currentMap || {}),
    id: 'rite_sovereign_arena',
    exits: []
  };
  game.obstacles = [];
  game.breakables = [];
  game.searchableProps = [];
  game.mapInteractables = [];
  game.enemySystem.enemies = [];
  game.enemySystem.projectiles = [];
  if (game.hazardSystem) {
    game.hazardSystem.patches = [];
    game.hazardSystem.movingBoulders = [];
  }

  const boss = createSovereignBoss(state.arena.centerX - 90, state.arena.centerY - 90);
  game.enemySystem.boss = boss;
  game.placeEntityAtWithCollision?.(game.player, state.arena.centerX - 340, state.arena.centerY - 24);
  game.camera.snapTo(game.player, game.world.width, game.world.height);

  function setObjective(text) {
    game.setRiteObjective?.(String(text || 'Defeat the Sovereign Guardian.'));
    if (objectiveEl) objectiveEl.textContent = String(text || 'Defeat the Sovereign Guardian.');
  }

  function clampToArena(entity) {
    const center = getEntityCenter(entity);
    const dx = center.x - state.arena.centerX;
    const dy = center.y - state.arena.centerY;
    const dist = Math.hypot(dx, dy) || 1;
    const radius = state.arena.radius - entity.size * 0.52;
    if (dist <= radius) return;
    const nx = dx / dist;
    const ny = dy / dist;
    const targetX = state.arena.centerX + nx * radius;
    const targetY = state.arena.centerY + ny * radius;
    entity.position.x = targetX - entity.size * 0.5;
    entity.position.y = targetY - entity.size * 0.5;
  }

  function addEffect(effect) {
    state.effects.push(effect);
    return effect;
  }

  function updateEffects(dt) {
    const playerCenter = getEntityCenter(game.player);
    const next = [];
    for (const effect of state.effects) {
      effect.t = (effect.t || 0) + dt;
      const duration = Number(effect.duration) || 0;
      if (effect.type === 'ground_burst') {
        if (!effect.fired && effect.t >= effect.delay) {
          effect.fired = true;
          const dx = playerCenter.x - effect.x;
          const dy = playerCenter.y - effect.y;
          if (dx * dx + dy * dy <= effect.radius * effect.radius) {
            game.applyDamage?.({
              targetType: 'player',
              sourceEntity: boss,
              sourceType: effect.sourceType || 'sovereign_ground_burst',
              amount: effect.damage || 12,
              reason: effect.reason || 'sovereign_ground_burst',
              damageClass: effect.damageClass || 'hazard',
              fromEnemy: true,
              bypassMitigation: false,
              canKill: true
            });
          }
        }
      } else if (effect.type === 'ring_damage') {
        const elapsed = effect.t;
        const ringRadius = (effect.startRadius || 40) + (effect.growth || 220) * (elapsed / Math.max(0.1, duration));
        const width = effect.width || 34;
        const d = Math.hypot(playerCenter.x - effect.x, playerCenter.y - effect.y);
        if (!effect.fired && Math.abs(d - ringRadius) <= width) {
          effect.fired = true;
          game.applyDamage?.({
            targetType: 'player',
            sourceEntity: boss,
            sourceType: effect.sourceType || 'sovereign_ring',
            amount: effect.damage || 14,
            reason: effect.reason || 'sovereign_ring_hit',
            damageClass: effect.damageClass || 'hazard',
            fromEnemy: true,
            bypassMitigation: false,
            canKill: true
          });
        }
      }
      if (effect.t < duration) next.push(effect);
    }
    state.effects = next;
  }

  function fireBossProjectileAtPlayer(damage = 12, speed = 300, spread = 0, count = 1, color = '#60a5fa') {
    const playerCenter = getEntityCenter(game.player);
    const bossCenter = getEntityCenter(boss);
    const baseAngle = Math.atan2(playerCenter.y - bossCenter.y, playerCenter.x - bossCenter.x);
    for (let i = 0; i < count; i += 1) {
      const offset = count > 1 ? (i - (count - 1) / 2) * spread : 0;
      const angle = baseAngle + offset;
      game.spawnEnemyProjectile?.(
        bossCenter.x,
        bossCenter.y,
        Math.cos(angle) * speed,
        Math.sin(angle) * speed,
        damage,
        12,
        color,
        {},
        boss
      );
    }
  }

  function damagePlayerIfBossContact(mult = 1) {
    if (!boss.intersects(game.player)) return;
    game.applyDamage?.({
      targetType: 'player',
      sourceEntity: boss,
      sourceType: 'sovereign_contact',
      amount: Math.max(6, Math.round((boss.attack || 18) * mult)),
      reason: 'sovereign_contact',
      damageClass: 'contact',
      fromEnemy: true,
      bypassMitigation: false,
      canKill: true
    });
  }

  function clearAuxByTag(tag) {
    game.enemySystem.enemies = (game.enemySystem.enemies || []).filter((enemy) => enemy?.[tag] !== true);
  }

  function beginStyle(styleId) {
    const id = STYLE_IDS.includes(styleId) ? styleId : STYLE_IDS[0];
    clearAuxByTag('__sovereignVoidClone');
    clearAuxByTag('__sovereignArtifact');
    state.previousStyle = state.currentStyle;
    state.currentStyle = id;
    state.styleDuration = rand(20, 30);
    state.styleTimer = state.styleDuration;
    state.styleSwitchCount += 1;
    state.styleHistory.push(id);
    if (state.styleHistory.length > 24) {
      state.styleHistory.splice(0, state.styleHistory.length - 24);
    }
    const style = getStyleDef(id);
    state.styleData = {
      timerA: 0,
      timerB: 0,
      timerC: 0,
      stackCount: 0,
      pacifierDamageTaken: 0,
      lastBossHp: boss.health
    };
    setObjective(`Survive style: ${style.pillarName}. Defeat the Sovereign Guardian.`);
  }

  function chooseNextStyle() {
    return pickRandomExcluding(STYLE_IDS, state.currentStyle);
  }

  function forceStyleSwitch(nextStyle = null) {
    const target = nextStyle && STYLE_IDS.includes(nextStyle) ? nextStyle : chooseNextStyle();
    if (!target) return;
    beginStyle(target);
  }

  function maybeSwitchOnThreshold() {
    const hpPct = boss.maxHealth > 0 ? boss.health / boss.maxHealth : 0;
    const thresholds = [0.75, 0.5, 0.3];
    for (const threshold of thresholds) {
      const key = String(threshold);
      if (!state.thresholdSwitches.has(key) && hpPct <= threshold) {
        state.thresholdSwitches.add(key);
        forceStyleSwitch();
        break;
      }
    }
    if (hpPct <= 0.25 && state.phase !== 'final_phase') {
      state.phase = 'final_phase';
      boss.attack = Math.round(boss.attack * 1.25);
      setObjective('Final Phase: Sovereign combines pillar styles. End it now.');
      forceStyleSwitch();
    }
  }

  function stepBossMovementTowardPlayer(dt, speedMult = 1) {
    const playerCenter = getEntityCenter(game.player);
    const bossCenter = getEntityCenter(boss);
    const dx = playerCenter.x - bossCenter.x;
    const dy = playerCenter.y - bossCenter.y;
    const dist = Math.hypot(dx, dy) || 1;
    const speed = (boss.speed || 120) * speedMult;
    game.moveEntityByWithCollision?.(boss, (dx / dist) * speed * dt, (dy / dist) * speed * dt);
  }

  function spawnAuxEnemy(tag, hp, atk, speed) {
    const angle = rand(0, Math.PI * 2);
    const radius = rand(180, 320);
    const x = state.arena.centerX + Math.cos(angle) * radius;
    const y = state.arena.centerY + Math.sin(angle) * radius;
    const before = game.enemySystem.enemies.length;
    game.enemySystem.spawnOne('minion', [], { x, y }, game, null);
    const spawned = game.enemySystem.enemies.slice(before)[0];
    if (!spawned) return null;
    spawned.maxHealth = hp;
    spawned.health = hp;
    spawned.attack = atk;
    spawned.speed = speed;
    spawned.isAffixMinion = true;
    spawned.affixes = [];
    spawned.isElite = false;
    spawned[tag] = true;
    return spawned;
  }

  function updateStyle(dt, styleId) {
    const data = state.styleData;
    data.timerA -= dt;
    data.timerB -= dt;
    data.timerC -= dt;

    if (styleId === 'the_deep') {
      stepBossMovementTowardPlayer(dt, 0.85);
      if (data.timerA <= 0) {
        data.timerA = 2.15;
        const playerCenter = getEntityCenter(game.player);
        addEffect({
          type: 'ground_burst',
          x: playerCenter.x + rand(-70, 70),
          y: playerCenter.y + rand(-70, 70),
          delay: 0.62,
          duration: 1.05,
          radius: 74,
          damage: 14,
          sourceType: 'sovereign_deep_tentacle',
          reason: 'sovereign_deep_tentacle',
          damageClass: 'hazard'
        });
      }
      if (data.timerB <= 0) {
        data.timerB = 2.9;
        fireBossProjectileAtPlayer(12, 320, 0.16, 3, '#6366f1');
      }
    } else if (styleId === 'havoc') {
      stepBossMovementTowardPlayer(dt, 0.95);
      if (data.timerA <= 0) {
        data.timerA = 3.1;
        const center = getEntityCenter(boss);
        addEffect({
          type: 'ring_damage',
          x: center.x,
          y: center.y,
          duration: 0.8,
          startRadius: 40,
          growth: 280,
          width: 38,
          damage: 18,
          sourceType: 'sovereign_havoc_shockwave',
          reason: 'sovereign_havoc_shockwave',
          damageClass: 'hazard'
        });
      }
    } else if (styleId === 'weapon_master') {
      stepBossMovementTowardPlayer(dt, 1.1);
      if (data.timerA <= 0) {
        data.timerA = 1.15;
        damagePlayerIfBossContact(1.15);
      }
      if (data.timerB <= 0) {
        data.timerB = 2.45;
        fireBossProjectileAtPlayer(13, 370, 0.22, 3, '#f59e0b');
      }
    } else if (styleId === 'limitless') {
      data.stackCount = clamp((data.stackCount || 0) + dt * 0.45, 0, 8);
      const stack = data.stackCount;
      stepBossMovementTowardPlayer(dt, 0.9 + stack * 0.03);
      if (data.timerA <= 0) {
        data.timerA = Math.max(0.6, 1.7 - stack * 0.1);
        const projectileCount = clamp(2 + Math.floor(stack * 0.5), 2, 6);
        fireBossProjectileAtPlayer(11 + Math.floor(stack), 320 + stack * 12, 0.16, projectileCount, '#22c55e');
      }
    } else if (styleId === 'void') {
      if (data.timerA <= 0) {
        data.timerA = 2.6;
        const playerCenter = getEntityCenter(game.player);
        const angle = rand(0, Math.PI * 2);
        game.placeEntityAtWithCollision?.(boss, playerCenter.x + Math.cos(angle) * 140 - boss.size * 0.5, playerCenter.y + Math.sin(angle) * 140 - boss.size * 0.5, { maxSearchRadius: 0 });
        boss.invulnUntil = game.time + 0.45;
      }
      if (data.timerB <= 0) {
        data.timerB = 5.4;
        spawnAuxEnemy('__sovereignVoidClone', 40, 7, 170);
        spawnAuxEnemy('__sovereignVoidClone', 40, 7, 170);
      }
      if (game.time >= boss.invulnUntil) {
        stepBossMovementTowardPlayer(dt, 1.0);
      }
    } else if (styleId === 'pacifier') {
      stepBossMovementTowardPlayer(dt, 0.35);
      const hpDelta = Math.max(0, (data.lastBossHp || boss.health) - boss.health);
      data.pacifierDamageTaken += hpDelta;
      data.lastBossHp = boss.health;
      if (data.timerA <= 0) {
        data.timerA = 4.8;
        data.pacifierDamageTaken = 0;
      }
      if (data.pacifierDamageTaken >= 120 && data.timerB <= 0) {
        data.timerB = 2.4;
        const center = getEntityCenter(boss);
        addEffect({
          type: 'ring_damage',
          x: center.x,
          y: center.y,
          duration: 0.7,
          startRadius: 44,
          growth: 260,
          width: 36,
          damage: 24,
          sourceType: 'sovereign_pacifier_counter',
          reason: 'sovereign_pacifier_counter',
          damageClass: 'hazard'
        });
        data.pacifierDamageTaken = 0;
      }
    } else if (styleId === 'collector') {
      stepBossMovementTowardPlayer(dt, 0.75);
      if (data.timerA <= 0) {
        data.timerA = 5.2;
        const artifacts = (game.enemySystem.enemies || []).filter((enemy) => enemy.__sovereignArtifact && !enemy.isDead).length;
        if (artifacts < 3) {
          spawnAuxEnemy('__sovereignArtifact', 70, 4, 45);
        }
      }
      if (data.timerB <= 0) {
        data.timerB = 2.5;
        const artifacts = (game.enemySystem.enemies || []).filter((enemy) => enemy.__sovereignArtifact && !enemy.isDead).length;
        fireBossProjectileAtPlayer(10 + artifacts * 2, 300, 0.12, 2 + artifacts, '#eab308');
      }
    } else if (styleId === 'cascade') {
      stepBossMovementTowardPlayer(dt, 0.9);
      if (data.timerA <= 0) {
        data.timerA = 3.25;
        const playerCenter = getEntityCenter(game.player);
        fireBossProjectileAtPlayer(11, 350, 0.08, 3, '#38bdf8');
        addEffect({
          type: 'ground_burst',
          x: playerCenter.x + rand(-90, 90),
          y: playerCenter.y + rand(-90, 90),
          delay: 0.55,
          duration: 1.0,
          radius: 82,
          damage: 14,
          sourceType: 'sovereign_cascade_chain_2',
          reason: 'sovereign_cascade_chain_2',
          damageClass: 'hazard'
        });
        addEffect({
          type: 'ring_damage',
          x: playerCenter.x,
          y: playerCenter.y,
          duration: 0.95,
          startRadius: 26,
          growth: 210,
          width: 26,
          damage: 12,
          sourceType: 'sovereign_cascade_chain_3',
          reason: 'sovereign_cascade_chain_3',
          damageClass: 'hazard'
        });
      }
    }

    if (state.phase === 'final_phase' && data.timerC <= 0) {
      data.timerC = 5.8;
      const center = getEntityCenter(boss);
      addEffect({
        type: 'ring_damage',
        x: center.x,
        y: center.y,
        duration: 0.7,
        startRadius: 40,
        growth: 300,
        width: 38,
        damage: 22,
        sourceType: 'sovereign_final_phase_burst',
        reason: 'sovereign_final_phase_burst',
        damageClass: 'hazard'
      });
      fireBossProjectileAtPlayer(16, 380, 0.14, 5, '#f97316');
    }
  }

  function updateCustomBoss(dt) {
    if (!game.enemySystem.boss || state.completed || state.failed || game.gameOver) return;
    boss.__time = game.time;
    if (boss.hitFlashTimer > 0) {
      boss.hitFlashTimer = Math.max(0, boss.hitFlashTimer - dt);
    }
    if (boss.healthBarShakeTimer > 0) {
      boss.healthBarShakeTimer = Math.max(0, boss.healthBarShakeTimer - dt);
    }

    game.processEnemyDebuffs?.(dt, boss);
    state.styleTimer -= dt;
    maybeSwitchOnThreshold();
    if (state.styleTimer <= 0) {
      forceStyleSwitch();
    }
    updateStyle(dt, state.currentStyle);
    updateEffects(dt);
    clampToArena(game.player);
    clampToArena(boss);
    damagePlayerIfBossContact(state.phase === 'final_phase' ? 1.35 : 1);

    if (boss.isDead) {
      completeRiteSuccessFlow();
    }
  }

  function drawArenaOverlay(ctx) {
    const cx = state.arena.centerX - game.camera.position.x;
    const cy = state.arena.centerY - game.camera.position.y;
    const radius = state.arena.radius;
    ctx.save();
    ctx.strokeStyle = 'rgba(196, 181, 253, 0.55)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.stroke();
    for (let i = 0; i < 8; i += 1) {
      const angle = (i / 8) * Math.PI * 2 + game.time * 0.05;
      const rx = cx + Math.cos(angle) * (radius - 38);
      const ry = cy + Math.sin(angle) * (radius - 38);
      ctx.fillStyle = 'rgba(148, 163, 184, 0.45)';
      ctx.beginPath();
      ctx.arc(rx, ry, 7, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const effect of state.effects) {
      if (effect.type === 'ground_burst') {
        const sx = effect.x - game.camera.position.x;
        const sy = effect.y - game.camera.position.y;
        const alpha = effect.fired ? 0.2 : 0.45;
        ctx.fillStyle = `rgba(239, 68, 68, ${alpha})`;
        ctx.beginPath();
        ctx.arc(sx, sy, effect.radius, 0, Math.PI * 2);
        ctx.fill();
      } else if (effect.type === 'ring_damage') {
        const sx = effect.x - game.camera.position.x;
        const sy = effect.y - game.camera.position.y;
        const progress = clamp(effect.t / Math.max(0.1, effect.duration), 0, 1);
        const rr = (effect.startRadius || 40) + (effect.growth || 220) * progress;
        ctx.strokeStyle = 'rgba(251, 191, 36, 0.65)';
        ctx.lineWidth = effect.width || 18;
        ctx.beginPath();
        ctx.arc(sx, sy, rr, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  function updateHud() {
    const style = getStyleDef(state.currentStyle);
    if (styleEl) styleEl.textContent = `Style: ${style.pillarName}`;
    if (!objectiveEl?.textContent) {
      setObjective('Defeat the Sovereign Guardian.');
    }
    if (metaEl) {
      const hpPct = boss.maxHealth > 0 ? Math.round((boss.health / boss.maxHealth) * 100) : 0;
      metaEl.textContent = `HP ${Math.max(0, Math.round(boss.health))}/${boss.maxHealth} (${hpPct}%) | Timer ${Math.max(0, state.styleTimer).toFixed(1)}s | ${state.phase === 'final_phase' ? 'Final Phase' : 'Phase 1'}`;
    }
  }

  function completeRiteSuccessFlow() {
    if (state.completed || state.failed) return;
    state.completed = true;
    game.completeRiteSuccess?.(riteId);
    game.gameOver = true;
    game.enemySystem.boss = null;
    resultTitleEl.textContent = 'Rite of Sovereign Completed';
    resultBodyEl.textContent = 'The Sovereign Guardian has fallen. Proof of Dominance has been granted.';
    resultPanel.classList.remove('hidden');
  }

  function completeRiteFailureFlow(reason = 'player_defeat') {
    if (state.completed || state.failed) return;
    state.failed = true;
    game.completeRiteFailure?.(riteId, reason);
    game.gameOver = true;
    resultTitleEl.textContent = 'Rite of Sovereign Failed';
    resultBodyEl.textContent = 'The final rite was failed. Retry is available and entry item was not consumed.';
    resultPanel.classList.remove('hidden');
  }

  function runValidationSuite() {
    const checks = [];
    const push = (id, passed, detail = '') => checks.push({ id, passed: !!passed, detail });
    const hasConsecutiveRepeat = state.styleHistory.some((id, idx) => idx > 0 && state.styleHistory[idx - 1] === id);
    const hpPct = boss.maxHealth > 0 ? boss.health / boss.maxHealth : 0;
    push('style_valid', STYLE_IDS.includes(state.currentStyle), `style=${state.currentStyle}`);
    push('no_consecutive_repeat', !hasConsecutiveRepeat, `history=${state.styleHistory.join(',')}`);
    push('timer_positive', state.styleDuration >= 20 && state.styleDuration <= 30, `duration=${state.styleDuration.toFixed(2)}`);
    push('final_phase_threshold', hpPct > 0.25 || state.phase === 'final_phase', `hpPct=${hpPct.toFixed(2)} phase=${state.phase}`);
    push('runtime_controller_key', String(game.getActiveRiteSummary?.()?.controllerKey || '') === 'sovereign_boss', `key=${game.getActiveRiteSummary?.()?.controllerKey}`);
    return {
      passed: checks.every((row) => row.passed),
      results: checks
    };
  }

  game.registerRiteRuntimeHandler?.('sovereign_boss', {
    update(_dt, controller) {
      if (!controller || !controller.state || controller.state.activeRiteId !== riteId) return;
      controller.state.metadata = {
        ...(controller.state.metadata || {}),
        bossHp: boss.health,
        bossMaxHp: boss.maxHealth,
        currentStyle: state.currentStyle,
        styleTimer: state.styleTimer,
        styleDuration: state.styleDuration,
        phase: state.phase
      };
      controller.state.stageIndex = state.phase === 'final_phase' ? 1 : 0;
      controller.state.stageState = state.currentStyle;
    }
  });

  beginStyle('the_deep');
  updateHud();

  game.jumpToSovereignStyle = function jumpToSovereignStyle(styleId) {
    const id = String(styleId || '');
    if (!STYLE_IDS.includes(id)) {
      return { success: false, reason: 'unknown_style', styles: [...STYLE_IDS] };
    }
    forceStyleSwitch(id);
    return { success: true, style: id };
  };

  game.forceStyleSwitch = function forceStyleSwitchDebug() {
    forceStyleSwitch();
    return { success: true, style: state.currentStyle };
  };

  game.logBossStyle = function logBossStyle() {
    const summary = {
      currentStyle: state.currentStyle,
      styleTimer: state.styleTimer,
      styleDuration: state.styleDuration,
      bossHp: boss.health,
      phase: state.phase
    };
    console.log('[RiteOfSovereign] Boss style:', summary);
    return summary;
  };

  game.setBossHP = function setBossHP(value) {
    const next = clamp(Number(value) || 0, 0, boss.maxHealth);
    boss.health = next;
    if (boss.health <= 0) {
      completeRiteSuccessFlow();
    }
    return { success: true, hp: boss.health, maxHp: boss.maxHealth };
  };

  game.getSovereignDebugSummary = function getSovereignDebugSummary() {
    return {
      riteId,
      bossHp: boss.health,
      bossMaxHp: boss.maxHealth,
      phase: state.phase,
      currentStyle: state.currentStyle,
      previousStyle: state.previousStyle,
      styleTimer: state.styleTimer,
      styleDuration: state.styleDuration,
      styleSwitchCount: state.styleSwitchCount,
      styleHistory: [...state.styleHistory],
      activeEffects: state.effects.length
    };
  };

  game.debugRunSovereignValidationSuite = function debugRunSovereignValidationSuite() {
    const result = runValidationSuite();
    state.validations.push({ at: game.time, passed: result.passed });
    if (state.validations.length > 32) {
      state.validations.splice(0, state.validations.length - 32);
    }
    return result;
  };

  game.updateBoss = function updateSovereignBoss(dt) {
    updateCustomBoss(dt);
  };

  game.update = function updateSovereignWrapped(dt) {
    baseUpdate(dt);
    if (state.completed || state.failed || game.gameOver) return;
    updateHud();
  };

  game.render = function renderSovereignWrapped() {
    baseRender();
    drawArenaOverlay(game.ctx);
  };

  game.showGameOver = function showGameOverSovereignWrapped() {
    if (!state.completed && !state.failed) {
      completeRiteFailureFlow('player_defeat');
      return;
    }
    if (typeof baseShowGameOver === 'function') {
      baseShowGameOver();
    }
  };

  if (resultCloseBtn) {
    resultCloseBtn.addEventListener('click', () => {
      resultPanel.classList.add('hidden');
      const returnHome = game.runConfig?.onReturnToHomeBase;
      if (typeof returnHome === 'function') {
        game.destroy();
        returnHome({
          reason: state.completed ? 'rite_success' : 'rite_failure',
          riteId
        });
      }
    });
  }

  game.__sovereignInstalled = true;
  game.__sovereignState = state;

  game.destroy = function destroySovereignWrapped() {
    if (hud?.parentElement) hud.remove();
    if (resultPanel?.parentElement) resultPanel.remove();
    game.__sovereignInstalled = false;
    game.__sovereignState = null;
    game.update = baseUpdate;
    game.render = baseRender;
    game.updateBoss = baseUpdateBoss;
    if (baseShowGameOver) {
      game.showGameOver = baseShowGameOver;
    }
    game.destroy = baseDestroy;
    return baseDestroy();
  };

  return {
    riteId,
    bossId: boss.id,
    styles: [...STYLE_IDS]
  };
}
