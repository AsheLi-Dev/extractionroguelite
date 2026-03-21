function createRect(x, y, w, h) {
  return { x: Math.floor(x), y: Math.floor(y), w: Math.max(1, Math.floor(w)), h: Math.max(1, Math.floor(h)) };
}

function rectContainsPoint(rect, x, y) {
  if (!rect) return false;
  return x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h;
}

function rand(min, max) {
  return min + Math.random() * (max - min);
}

const TORMENT_FLOORS = [
  {
    floor: 1,
    theme: 'Storm of Blades',
    enemyLabel: 'Torment Spirits',
    objective: 'Reach the lower gate while surviving Storm of Blades.',
    hazardTypes: ['shockingGround', 'weakeningGround', 'slowZone']
  },
  {
    floor: 2,
    theme: 'Infernal Fire',
    enemyLabel: 'Flame Wraiths',
    objective: 'Push through Infernal Fire and descend deeper.',
    hazardTypes: ['burningGround', 'toxicGround']
  },
  {
    floor: 3,
    theme: 'Frozen Torment',
    enemyLabel: 'Frost Shades',
    objective: 'Reach the bottom altar and endure the final descent.',
    hazardTypes: ['frozenGround', 'slowZone', 'weakeningGround']
  }
];

function getFloorDef(floor) {
  return TORMENT_FLOORS.find((entry) => entry.floor === floor) || TORMENT_FLOORS[0];
}

function createHud() {
  const hud = document.createElement('div');
  hud.id = 'rite-torment-hud';
  hud.className = 'rite-torment-hud';
  hud.innerHTML = `
    <div class="rite-torment-title">Rite of Torment</div>
    <div id="rite-torment-phase" class="rite-torment-phase"></div>
    <div id="rite-torment-floor" class="rite-torment-floor"></div>
    <div id="rite-torment-objective" class="rite-torment-objective"></div>
    <div id="rite-torment-meta" class="rite-torment-meta"></div>
  `;
  document.body.appendChild(hud);
  return hud;
}

function createResultPanel() {
  const panel = document.createElement('div');
  panel.id = 'rite-torment-result';
  panel.className = 'rite-torment-result hidden';
  panel.innerHTML = `
    <div class="rite-torment-result-surface">
      <h2 id="rite-torment-result-title"></h2>
      <p id="rite-torment-result-body"></p>
      <button id="rite-torment-result-close" type="button">Return to Home Base</button>
    </div>
  `;
  document.body.appendChild(panel);
  return panel;
}

export function installRiteOfTorment(game, options = {}) {
  if (!game || game.__tormentInstalled) return null;
  const riteId = String(options.riteId || 'rite_of_torment');
  if (riteId !== 'rite_of_torment') return null;

  const hud = createHud();
  const resultPanel = createResultPanel();
  const phaseEl = hud.querySelector('#rite-torment-phase');
  const floorEl = hud.querySelector('#rite-torment-floor');
  const objectiveEl = hud.querySelector('#rite-torment-objective');
  const metaEl = hud.querySelector('#rite-torment-meta');
  const resultTitleEl = resultPanel.querySelector('#rite-torment-result-title');
  const resultBodyEl = resultPanel.querySelector('#rite-torment-result-body');
  const resultCloseBtn = resultPanel.querySelector('#rite-torment-result-close');

  const state = {
    riteId,
    startedAt: Number(game.time) || 0,
    phase: 'descent',
    currentFloor: 1,
    floorTheme: getFloorDef(1).theme,
    floorObjective: getFloorDef(1).objective,
    completed: false,
    failed: false,
    gateRect: null,
    altarRect: null,
    exitPortalRect: null,
    exitPortalActive: false,
    floorKills: 0,
    floorKillTarget: 8,
    gateUnlocked: false,
    ascentLootGrantedByFloor: {},
    enemySpawnTimer: 0,
    hazardPulseTimer: 0,
    validationHistory: []
  };

  const baseUpdate = game.update.bind(game);
  const baseRender = game.render.bind(game);
  const baseShowGameOver = game.showGameOver?.bind(game);
  const baseDestroy = game.destroy?.bind(game);

  function getPlayerCenter() {
    return {
      x: game.player.position.x + game.player.size * 0.5,
      y: game.player.position.y + game.player.size * 0.5
    };
  }

  function setObjective(text) {
    state.floorObjective = String(text || '');
    game.setRiteObjective?.(state.floorObjective);
    game.setRiteFloorObjective?.(state.floorObjective);
    if (objectiveEl) objectiveEl.textContent = state.floorObjective;
  }

  function clearRuntimeWorld(width, height, spawn, mapSuffix) {
    game.world.width = width;
    game.world.height = height;
    game.world.wallThickness = 52;
    game.world.tileWallRects = [];
    game.world.proceduralExitZones = [];
    game.currentMap = {
      ...(game.currentMap || {}),
      exits: [],
      id: `rite_torment_${mapSuffix}`
    };
    game.obstacles = [];
    game.breakables = [];
    game.searchableProps = [];
    game.mapInteractables = [];
    game.enemySystem.enemies = [];
    game.enemySystem.projectiles = [];
    game.enemySystem.boss = null;
    if (game.hazardSystem) {
      game.hazardSystem.patches = [];
      game.hazardSystem.movingBoulders = [];
    }
    game.placeEntityAtWithCollision?.(game.player, spawn.x - game.player.size * 0.5, spawn.y - game.player.size * 0.5);
    game.camera.snapTo(game.player, game.world.width, game.world.height);
  }

  function applyFloorHazards(floorDef, phase) {
    if (!game.hazardSystem) return;
    const hazardCount = phase === 'descent' ? 10 : 5;
    const margin = game.world.wallThickness + 140;
    for (const hazardType of floorDef.hazardTypes || []) {
      for (let i = 0; i < hazardCount; i += 1) {
        const x = rand(margin, game.world.width - margin);
        const y = rand(margin, game.world.height - margin);
        const radius = hazardType === 'slowZone' ? 70 : 90;
        game.hazardSystem.patches.push({
          type: hazardType,
          x,
          y,
          radius,
          id: game.hazardSystem.patches.length + 1,
          temp: false,
          slowMult: hazardType === 'slowZone' ? (phase === 'descent' ? 0.56 : 0.7) : undefined
        });
      }
    }
    if (floorDef.floor === 2 && phase === 'descent') {
      for (let i = 0; i < 4; i += 1) {
        game.hazardSystem.movingBoulders.push({
          x: game.world.width + 80 + i * 40,
          y: rand(120, game.world.height - 120),
          vx: -rand(160, 240),
          vy: rand(-30, 30),
          r: rand(16, 24),
          hitCooldown: 0
        });
      }
    }
  }

  function pickKillTarget(floor, phase) {
    if (phase === 'ascent') {
      return floor === 1 ? 0 : 3;
    }
    return floor === 1 ? 8 : floor === 2 ? 10 : 12;
  }

  function setupFloor(floor, phase) {
    const nextFloor = Math.max(1, Math.min(3, Math.floor(Number(floor) || 1)));
    const nextPhase = phase === 'ascent' ? 'ascent' : 'descent';
    state.currentFloor = nextFloor;
    state.phase = nextPhase;
    state.floorKills = 0;
    state.floorKillTarget = pickKillTarget(nextFloor, nextPhase);
    state.gateUnlocked = state.floorKillTarget <= 0;
    state.exitPortalActive = false;
    state.exitPortalRect = null;
    state.hazardPulseTimer = 0;
    state.enemySpawnTimer = 0;
    const floorDef = getFloorDef(nextFloor);
    state.floorTheme = floorDef.theme;
    const spawnLeft = nextPhase === 'descent';
    clearRuntimeWorld(
      2300,
      1180,
      { x: spawnLeft ? 160 : 2160, y: 590 },
      `${nextPhase}_f${nextFloor}`
    );
    state.gateRect = createRect(spawnLeft ? 2100 : 95, 500, 85, 180);
    state.altarRect = nextFloor === 3 && nextPhase === 'descent'
      ? createRect(2060, 480, 130, 220)
      : null;
    applyFloorHazards(floorDef, nextPhase);
    game.setRiteFloor?.(nextFloor, nextPhase, floorDef.theme);
    if (nextPhase === 'descent') {
      game.beginRiteDescent?.(nextFloor);
    } else {
      game.beginRiteAscent?.(nextFloor);
    }
    if (nextPhase === 'ascent' && !state.ascentLootGrantedByFloor[nextFloor]) {
      state.ascentLootGrantedByFloor[nextFloor] = true;
      game.lootSystem?.spawnBurstAt(game.world.width * 0.5, game.world.height * 0.5, 3 + nextFloor, 0.9);
    }
    setObjective(nextPhase === 'descent' ? floorDef.objective : `Ascend through Floor ${nextFloor} and return to the surface.`);
  }

  function tuneEnemy(enemy, phase) {
    if (!enemy) return;
    const descent = phase === 'descent';
    enemy.affixes = [];
    enemy.isElite = false;
    enemy.maxHealth = descent ? 55 + state.currentFloor * 12 : 30 + state.currentFloor * 8;
    enemy.health = enemy.maxHealth;
    enemy.attack = descent ? 6 + state.currentFloor * 2 : 4 + state.currentFloor;
    enemy.speed = descent ? 125 + state.currentFloor * 18 : 110 + state.currentFloor * 10;
    enemy.__tormentEnemy = true;
    enemy.__tormentFloor = state.currentFloor;
  }

  function spawnTormentEnemy() {
    const active = (game.enemySystem?.enemies || []).filter((enemy) => enemy.__tormentEnemy && !enemy.isDead).length;
    const maxActive = state.phase === 'descent' ? 6 : 3;
    if (active >= maxActive) return;
    const spawnOnRight = state.phase === 'descent';
    const x = spawnOnRight ? rand(game.world.width - 260, game.world.width - 110) : rand(120, 300);
    const y = rand(160, game.world.height - 160);
    const before = game.enemySystem.enemies.length;
    game.enemySystem.spawnOne('minion', [], { x, y }, game, null);
    const enemy = game.enemySystem.enemies.slice(before)[0] || null;
    tuneEnemy(enemy, state.phase);
  }

  function processTormentEnemyDeaths() {
    for (const enemy of game.enemySystem?.enemies || []) {
      if (!enemy || !enemy.__tormentEnemy || !enemy.isDead || enemy.__tormentDeathHandled) continue;
      enemy.__tormentDeathHandled = true;
      state.floorKills += 1;
      if (Math.random() < 0.05) {
        const cx = enemy.position.x + enemy.size * 0.5;
        const cy = enemy.position.y + enemy.size * 0.5;
        game.spawnHealingOrbAt?.(cx, cy, 0.1);
      }
    }
  }

  function maybeUnlockGate() {
    if (state.gateUnlocked) return;
    if (state.floorKills >= state.floorKillTarget) {
      state.gateUnlocked = true;
      if (state.phase === 'descent' && state.currentFloor === 3) {
        setObjective('Reach the bottom altar to begin ascent.');
      } else if (state.phase === 'descent') {
        setObjective('Gate opened. Descend to the next floor.');
      } else {
        setObjective('Path opened. Continue ascending.');
      }
    }
  }

  function triggerAscent() {
    state.phase = 'ascent';
    setObjective('Descent complete. Ascend back to the surface.');
    setupFloor(3, 'ascent');
  }

  function completeRiteSuccessFlow() {
    if (state.completed || state.failed) return;
    state.completed = true;
    game.completeRiteSuccess?.(riteId);
    game.gameOver = true;
    resultTitleEl.textContent = 'Rite of Torment Completed';
    resultBodyEl.textContent = 'You endured the descent and returned alive. Proof of Resilience has been granted.';
    resultPanel.classList.remove('hidden');
  }

  function completeRiteFailureFlow(reason = 'player_defeat') {
    if (state.completed || state.failed) return;
    state.failed = true;
    game.completeRiteFailure?.(riteId, reason);
    game.gameOver = true;
    resultTitleEl.textContent = 'Rite of Torment Failed';
    resultBodyEl.textContent = 'The endurance trial was not completed. Retry is available and entry item was not consumed.';
    resultPanel.classList.remove('hidden');
  }

  function updateFloorTravel() {
    const player = getPlayerCenter();
    const touchingGate = rectContainsPoint(state.gateRect, player.x, player.y);
    const touchingAltar = rectContainsPoint(state.altarRect, player.x, player.y);
    const touchingExitPortal = rectContainsPoint(state.exitPortalRect, player.x, player.y);

    if (state.phase === 'descent') {
      if (state.currentFloor === 3) {
        if (state.gateUnlocked && touchingAltar) {
          triggerAscent();
        }
      } else if (state.gateUnlocked && touchingGate) {
        setupFloor(state.currentFloor + 1, 'descent');
      }
      return;
    }

    if (state.currentFloor > 1) {
      if (touchingGate) {
        setupFloor(state.currentFloor - 1, 'ascent');
      }
      return;
    }

    if (!state.exitPortalActive) {
      state.exitPortalActive = true;
      state.exitPortalRect = createRect(95, 500, 95, 180);
      setObjective('Surface reached. Enter the exit portal.');
    }
    if (touchingExitPortal) {
      completeRiteSuccessFlow();
    }
  }

  function updateTorment(dt) {
    if (state.completed || state.failed || game.gameOver) return;
    state.enemySpawnTimer -= dt;
    if (state.enemySpawnTimer <= 0) {
      state.enemySpawnTimer = state.phase === 'descent' ? 1.4 : 2.1;
      spawnTormentEnemy();
    }
    processTormentEnemyDeaths();
    maybeUnlockGate();
    updateFloorTravel();
  }

  function renderTormentWorldOverlay(ctx) {
    if (!ctx || state.completed || state.failed) return;
    const cam = game.camera?.position || { x: 0, y: 0 };

    const drawMarker = (rect, fill, stroke) => {
      if (!rect) return;
      const x = rect.x - cam.x;
      const y = rect.y - cam.y;
      ctx.save();
      ctx.fillStyle = fill;
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 2;
      ctx.fillRect(x, y, rect.w, rect.h);
      ctx.strokeRect(x + 0.5, y + 0.5, rect.w - 1, rect.h - 1);
      ctx.restore();
    };

    drawMarker(state.gateRect, state.gateUnlocked ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)', state.gateUnlocked ? 'rgba(16, 185, 129, 0.85)' : 'rgba(248, 113, 113, 0.85)');
    if (state.altarRect) {
      drawMarker(state.altarRect, 'rgba(96, 165, 250, 0.22)', 'rgba(147, 197, 253, 0.9)');
    }
    if (state.exitPortalRect) {
      drawMarker(state.exitPortalRect, 'rgba(59, 130, 246, 0.25)', 'rgba(96, 165, 250, 0.92)');
    }
  }

  function updateHud() {
    if (phaseEl) {
      phaseEl.textContent = state.phase === 'descent' ? 'Phase: Descent' : 'Phase: Ascent';
    }
    if (floorEl) {
      floorEl.textContent = `Floor ${state.currentFloor} - ${state.floorTheme}`;
    }
    if (metaEl) {
      const activeHazards = (game.hazardSystem?.patches?.length || 0) + (game.hazardSystem?.movingBoulders?.length || 0);
      const activeEnemies = (game.enemySystem?.enemies || []).filter((enemy) => enemy.__tormentEnemy && !enemy.isDead).length;
      const targetText = state.floorKillTarget > 0 ? `${state.floorKills}/${state.floorKillTarget}` : `${state.floorKills}`;
      metaEl.textContent = `Kills ${targetText} | Hazards ${activeHazards} | Active Enemies ${activeEnemies}`;
    }
  }

  function runValidationSuite() {
    const checks = [];
    const push = (id, passed, detail = '') => checks.push({ id, passed: !!passed, detail });
    const prevHealth = Number(game.currentHealth) || 0;
    const originalReduction = Number(game.currentStats?.hazardDamageReduction) || 0;
    game.currentStats.hazardDamageReduction = Math.max(0, Math.min(0.75, originalReduction || 0.35));
    game.applyDamage?.({
      targetType: 'player',
      sourceType: 'hazard_validation',
      amount: 1,
      reason: 'hazard_validation_tick',
      damageClass: 'hazard',
      canKill: false,
      bypassMitigation: false
    });
    const hazardRow = (game.getHazardDamageEventLog?.() || []).slice(-1)[0] || null;
    game.currentHealth = prevHealth;
    game.currentStats.hazardDamageReduction = originalReduction;
    game.updateHealthBar?.();
    push('floor_in_range', state.currentFloor >= 1 && state.currentFloor <= 3, `floor=${state.currentFloor}`);
    push('phase_valid', state.phase === 'descent' || state.phase === 'ascent', `phase=${state.phase}`);
    push('runtime_floor_synced', Number(game.getActiveRiteSummary?.()?.currentFloor) === state.currentFloor, `runtime=${game.getActiveRiteSummary?.()?.currentFloor}`);
    push('runtime_direction_synced', String(game.getActiveRiteSummary?.()?.floorDirection) === state.phase, `runtime=${game.getActiveRiteSummary?.()?.floorDirection}`);
    push('hazard_classification_visible', !!hazardRow, hazardRow ? `source=${hazardRow.sourceType}` : 'no_hazard_events');
    push(
      'hazard_reduction_capped',
      Number(hazardRow?.reduction ?? 0) >= 0 && Number(hazardRow?.reduction ?? 0) <= 0.75,
      hazardRow ? `reduction=${hazardRow.reduction}` : 'missing_row'
    );
    push('entry_portal_requires_ascent', !(state.phase === 'descent' && state.exitPortalActive), `phase=${state.phase} portal=${state.exitPortalActive}`);
    return {
      passed: checks.every((row) => row.passed),
      results: checks
    };
  }

  game.registerRiteRuntimeHandler?.('torment_dungeon', {
    update(_dt, controller) {
      if (!controller || !controller.state || controller.state.activeRiteId !== riteId) return;
      controller.state.currentFloor = state.currentFloor;
      controller.state.floorDirection = state.phase;
      controller.state.floorTheme = state.floorTheme;
      controller.state.floorObjective = state.floorObjective;
      controller.state.metadata = {
        ...(controller.state.metadata || {}),
        activeHazards: (game.hazardSystem?.patches?.length || 0) + (game.hazardSystem?.movingBoulders?.length || 0),
        kills: state.floorKills,
        killTarget: state.floorKillTarget,
        gateUnlocked: state.gateUnlocked,
        exitPortalActive: state.exitPortalActive
      };
    }
  });

  const activeRite = game.getActiveRiteSummary?.();
  if (activeRite?.activeRiteId !== riteId) {
    const begin = game.beginRite?.(riteId);
    if (!begin?.success) {
      console.warn('[RiteOfTorment] beginRite failed:', begin?.reason || 'unknown');
    }
  }

  game.__tormentInstalled = true;
  game.__tormentState = state;
  setupFloor(1, 'descent');
  updateHud();

  game.jumpToTormentFloor = function jumpToTormentFloor(floorIndex) {
    const targetFloor = Math.max(1, Math.min(3, Math.floor(Number(floorIndex) || 1)));
    setupFloor(targetFloor, state.phase);
    return { success: true, floor: targetFloor, phase: state.phase };
  };

  game.forceDescent = function forceDescent() {
    setupFloor(Math.max(1, Math.min(3, state.currentFloor)), 'descent');
    return { success: true, phase: state.phase, floor: state.currentFloor };
  };

  game.forceAscent = function forceAscent() {
    setupFloor(Math.max(1, Math.min(3, state.currentFloor)), 'ascent');
    return { success: true, phase: state.phase, floor: state.currentFloor };
  };

  game.spawnHealingOrb = function spawnHealingOrb() {
    const player = getPlayerCenter();
    game.spawnHealingOrbAt?.(player.x + 24, player.y, 0.1);
    return { success: true };
  };

  game.logHazardDamage = function logHazardDamage() {
    const rows = game.getHazardDamageEventLog?.() || [];
    const tail = rows.slice(-20);
    console.log('[RiteOfTorment] Hazard damage events:', tail);
    return tail;
  };

  game.getTormentDebugSummary = function getTormentDebugSummary() {
    const hazardRows = game.getHazardDamageEventLog?.() || [];
    const tail = hazardRows.slice(-10);
    return {
      riteId,
      phase: state.phase,
      currentFloor: state.currentFloor,
      floorTheme: state.floorTheme,
      floorObjective: state.floorObjective,
      floorKills: state.floorKills,
      floorKillTarget: state.floorKillTarget,
      gateUnlocked: state.gateUnlocked,
      activeHazards: (game.hazardSystem?.patches?.length || 0) + (game.hazardSystem?.movingBoulders?.length || 0),
      activeTormentEnemies: (game.enemySystem?.enemies || []).filter((enemy) => enemy.__tormentEnemy && !enemy.isDead).length,
      hazardDamageReduction: Number(game.currentStats?.hazardDamageReduction) || 0,
      recentHazardDamage: tail
    };
  };

  game.debugRunTormentValidationSuite = function debugRunTormentValidationSuite() {
    const result = runValidationSuite();
    state.validationHistory.push({
      at: Number(game.time) || 0,
      passed: result.passed
    });
    if (state.validationHistory.length > 20) {
      state.validationHistory.splice(0, state.validationHistory.length - 20);
    }
    return result;
  };

  game.update = function updateTormentWrapped(dt) {
    baseUpdate(dt);
    if (state.completed || state.failed || game.gameOver) return;
    updateTorment(dt);
    updateHud();
  };

  game.render = function renderTormentWrapped() {
    baseRender();
    renderTormentWorldOverlay(game.ctx);
  };

  game.showGameOver = function showGameOverTormentWrapped() {
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

  game.destroy = function destroyTormentWrapped() {
    if (hud?.parentElement) hud.remove();
    if (resultPanel?.parentElement) resultPanel.remove();
    game.__tormentInstalled = false;
    game.__tormentState = null;
    game.update = baseUpdate;
    game.render = baseRender;
    if (baseShowGameOver) {
      game.showGameOver = baseShowGameOver;
    }
    game.destroy = baseDestroy;
    return baseDestroy();
  };

  return {
    riteId,
    floors: TORMENT_FLOORS.map((floor) => floor.floor)
  };
}
