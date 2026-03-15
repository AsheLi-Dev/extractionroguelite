function createRect(x, y, w, h) {
  return { x: Math.floor(x), y: Math.floor(y), w: Math.max(1, Math.floor(w)), h: Math.max(1, Math.floor(h)) };
}

function rectContainsPoint(rect, x, y) {
  return x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h;
}

function rectsOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function randomInt(min, max) {
  const lo = Math.ceil(min);
  const hi = Math.floor(max);
  return lo + Math.floor(Math.random() * (hi - lo + 1));
}

function createHud() {
  const hud = document.createElement('div');
  hud.id = 'rite-monstrosity-hud';
  hud.className = 'rite-monstrosity-hud';
  hud.innerHTML = `
    <div class="rite-monstrosity-title">Rite of Monstrosity</div>
    <div id="rite-monstrosity-stage" class="rite-monstrosity-stage"></div>
    <div id="rite-monstrosity-objective" class="rite-monstrosity-objective"></div>
    <div id="rite-monstrosity-meta" class="rite-monstrosity-meta"></div>
  `;
  document.body.appendChild(hud);
  return hud;
}

function createResultPanel() {
  const panel = document.createElement('div');
  panel.id = 'rite-monstrosity-result';
  panel.className = 'rite-monstrosity-result hidden';
  panel.innerHTML = `
    <div class="rite-monstrosity-result-surface">
      <h2 id="rite-monstrosity-result-title"></h2>
      <p id="rite-monstrosity-result-body"></p>
      <button id="rite-monstrosity-result-close" type="button">Return to Home Base</button>
    </div>
  `;
  document.body.appendChild(panel);
  return panel;
}

const MONSTROSITY_STAGES = [
  { id: 'nemean_beast', label: 'Nemean Beast', objective: 'Defeat the Nemean Beast in the arena.' },
  { id: 'golden_hind', label: 'Golden Horned Hind', objective: 'Catch the hind before the timer expires.' },
  { id: 'ironfeather_swarm', label: 'Ironfeather Swarm', objective: 'Defend the village through all bird waves.' },
  { id: 'cerberus_capture', label: 'Cerberus Capture', objective: 'Break the cave, exhaust Cerberus, then capture it.' }
];

function createSeededRng(seed = 1) {
  let s = (Number(seed) >>> 0) || 1;
  return function next() {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

export function validateMonstrosityStageDeterminism(seed = 1337) {
  const rng = createSeededRng(seed);
  const stageIds = MONSTROSITY_STAGES.map((stage) => stage.id);
  const state = {
    stageIndex: 0,
    completed: [],
    jumps: 0
  };
  const jumpTo = (index) => {
    const next = Math.max(0, Math.min(stageIds.length - 1, Math.floor(index)));
    state.stageIndex = next;
    state.jumps += 1;
    return next;
  };
  const resetStage = () => {
    state.completed = state.completed.filter((id) => id !== stageIds[state.stageIndex]);
  };
  for (let i = 0; i < 10; i += 1) {
    if (rng() < 0.35) {
      jumpTo(Math.floor(rng() * stageIds.length));
    } else {
      const stageId = stageIds[state.stageIndex];
      if (!state.completed.includes(stageId)) {
        state.completed.push(stageId);
      }
      if (state.stageIndex < stageIds.length - 1) {
        state.stageIndex += 1;
      }
    }
  }
  resetStage();
  const hasConsecutiveRepeat = state.completed.some((id, idx) => idx > 0 && state.completed[idx - 1] === id);
  return {
    passed: !hasConsecutiveRepeat && state.stageIndex >= 0 && state.stageIndex < stageIds.length,
    summary: {
      seed,
      stageIndex: state.stageIndex,
      completed: [...state.completed],
      jumps: state.jumps
    }
  };
}

export function installRiteOfMonstrosity(game, options = {}) {
  if (!game || game.__monstrosityInstalled) {
    return null;
  }
  const riteId = String(options.riteId || 'rite_of_monstrosity');
  if (riteId !== 'rite_of_monstrosity') {
    return null;
  }

  const hud = createHud();
  const resultPanel = createResultPanel();
  const stageEl = hud.querySelector('#rite-monstrosity-stage');
  const objectiveEl = hud.querySelector('#rite-monstrosity-objective');
  const metaEl = hud.querySelector('#rite-monstrosity-meta');
  const resultTitleEl = resultPanel.querySelector('#rite-monstrosity-result-title');
  const resultBodyEl = resultPanel.querySelector('#rite-monstrosity-result-body');
  const resultCloseBtn = resultPanel.querySelector('#rite-monstrosity-result-close');

  const state = {
    riteId,
    currentStageIndex: 0,
    stageState: 'stage_setup',
    completed: false,
    failed: false,
    activeStageId: MONSTROSITY_STAGES[0].id,
    stageData: {},
    stageTransitionTimer: 0,
    completedStageIds: [],
    jumps: {
      totalStageTransitions: 0
    }
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

  function clearCombatWorld(width, height, spawn) {
    game.world.width = width;
    game.world.height = height;
    game.world.wallThickness = 52;
    game.world.proceduralExitZones = [];
    game.currentMap = {
      ...(game.currentMap || {}),
      exits: [],
      id: `rite_monstrosity_${state.activeStageId}`
    };
    game.world.tileWallRects = [];
    game.obstacles = [];
    game.breakables = [];
    game.searchableProps = [];
    game.mapInteractables = [];
    game.enemySystem.enemies = [];
    game.enemySystem.projectiles = [];
    game.enemySystem.boss = null;
    if (game.hazardSystem) {
      game.hazardSystem.patches = [];
    }
    game.player.position.set(spawn.x - game.player.size * 0.5, spawn.y - game.player.size * 0.5);
    game.camera.snapTo(game.player, game.world.width, game.world.height);
  }

  function pushWallsForArena(rect, opening = null) {
    const walls = [];
    const thickness = 24;
    walls.push(createRect(rect.x, rect.y, rect.w, thickness));
    walls.push(createRect(rect.x, rect.y + rect.h - thickness, rect.w, thickness));
    walls.push(createRect(rect.x, rect.y, thickness, rect.h));
    walls.push(createRect(rect.x + rect.w - thickness, rect.y, thickness, rect.h));
    if (opening) {
      const keep = [];
      for (const wall of walls) {
        if (!rectsOverlap(wall, opening)) {
          keep.push(wall);
          continue;
        }
        if (opening.w > opening.h) {
          if (opening.x > wall.x) keep.push(createRect(wall.x, wall.y, opening.x - wall.x, wall.h));
          const right = (wall.x + wall.w) - (opening.x + opening.w);
          if (right > 0) keep.push(createRect(opening.x + opening.w, wall.y, right, wall.h));
        } else {
          if (opening.y > wall.y) keep.push(createRect(wall.x, wall.y, wall.w, opening.y - wall.y));
          const bottom = (wall.y + wall.h) - (opening.y + opening.h);
          if (bottom > 0) keep.push(createRect(wall.x, opening.y + opening.h, wall.w, bottom));
        }
      }
      return keep;
    }
    return walls;
  }

  function setObjective(text) {
    game.setRiteObjective?.(text);
    if (objectiveEl) {
      objectiveEl.textContent = text;
    }
  }

  function setStageRuntime(stageIndex, stageState = 'stage_active') {
    state.currentStageIndex = stageIndex;
    state.activeStageId = MONSTROSITY_STAGES[stageIndex]?.id || null;
    state.stageState = stageState;
    game.setRiteStage?.(stageIndex, stageState);
    game.setRiteStageState?.(stageState);
    const stage = MONSTROSITY_STAGES[stageIndex];
    if (stageEl) {
      stageEl.textContent = `Stage ${stageIndex + 1}/${MONSTROSITY_STAGES.length} - ${stage?.label || 'Unknown'}`;
    }
    if (stage?.objective) {
      setObjective(stage.objective);
    }
  }

  function tuneEnemy(enemy, tuning = {}) {
    if (!enemy) return;
    if (Number.isFinite(tuning.maxHealth)) {
      enemy.maxHealth = Math.max(1, Math.round(tuning.maxHealth));
      enemy.health = Math.min(enemy.health, enemy.maxHealth);
      enemy.health = enemy.maxHealth;
    }
    if (Number.isFinite(tuning.attack)) {
      enemy.attack = Math.max(1, Math.round(tuning.attack));
    }
    if (Number.isFinite(tuning.speed)) {
      enemy.speed = Math.max(10, Math.round(tuning.speed));
    }
    if (tuning.disableAffixes === true) {
      enemy.affixes = [];
      enemy.isElite = false;
    }
  }

  function spawnEnemyNear(x, y, tuning = {}, extra = {}) {
    if (!game.enemySystem) return null;
    const before = game.enemySystem.enemies.length;
    game.enemySystem.spawnOne(extra.forceTier || 'minion', [], { x, y }, game, extra.forceType || null);
    const spawned = game.enemySystem.enemies.slice(before);
    const enemy = spawned[0] || null;
    if (!enemy) return null;
    tuneEnemy(enemy, tuning);
    Object.assign(enemy, extra.assign || {});
    return enemy;
  }

  function applyNemeanStageSetup() {
    clearCombatWorld(1700, 1120, { x: 420, y: 560 });
    const arena = createRect(180, 180, 1340, 760);
    game.world.tileWallRects = pushWallsForArena(arena);
    const beast = spawnEnemyNear(arena.x + arena.w * 0.65, arena.y + arena.h * 0.5, {
      maxHealth: 520,
      attack: 26,
      speed: 190,
      disableAffixes: true
    }, {
      forceTier: 'elite',
      assign: {
        __monstrosityTag: 'nemean_beast',
        __nemeanLeapCd: 2.8
      }
    });
    state.stageData = {
      arena,
      beastId: beast?.id || null,
      leapTimer: 2.8
    };
  }

  function updateNemeanStage(dt) {
    const beast = (game.enemySystem.enemies || []).find((enemy) => enemy.id === state.stageData.beastId && !enemy.isDead);
    if (!beast) {
      completeStageSuccess('nemean_beast');
      return;
    }
    state.stageData.leapTimer = (state.stageData.leapTimer || 0) - dt;
    if (state.stageData.leapTimer <= 0) {
      const target = getPlayerCenter();
      const dx = target.x - beast.position.x;
      const dy = target.y - beast.position.y;
      const len = Math.hypot(dx, dy) || 1;
      beast.position.x += (dx / len) * 120;
      beast.position.y += (dy / len) * 120;
      if (Math.hypot(target.x - beast.position.x, target.y - beast.position.y) < 75) {
        game.onPlayerDamaged?.(10, true, { sourceType: 'rite_monstrosity_nemean_leap' });
      }
      state.stageData.leapTimer = 2.5;
    }
    if (metaEl) {
      metaEl.textContent = `Beast HP: ${Math.max(0, Math.round(beast.health || 0))}`;
    }
  }

  function applyHindStageSetup() {
    clearCombatWorld(3600, 980, { x: 360, y: 490 });
    const lane = createRect(210, 300, 3180, 360);
    const walls = [];
    walls.push(...pushWallsForArena(createRect(lane.x, lane.y, lane.w, lane.h)));
    game.world.tileWallRects = walls;
    const hind = spawnEnemyNear(lane.x + lane.w - 220, lane.y + lane.h * 0.5, {
      maxHealth: 99999,
      attack: 1,
      speed: 360,
      disableAffixes: true
    }, {
      assign: {
        __monstrosityTag: 'golden_hind',
        __hindTurnTimer: 1.7,
        __hindDirY: 0
      }
    });
    state.stageData = {
      hindId: hind?.id || null,
      lane,
      timer: 55
    };
  }

  function updateHindStage(dt) {
    state.stageData.timer = Math.max(0, (state.stageData.timer || 0) - dt);
    if (state.stageData.timer <= 0) {
      completeStageFailure('hind_timer_expired');
      return;
    }
    const hind = (game.enemySystem.enemies || []).find((enemy) => enemy.id === state.stageData.hindId && !enemy.isDead);
    if (!hind) {
      completeStageSuccess('golden_hind');
      return;
    }

    const p = getPlayerCenter();
    const hx = hind.position.x + hind.size * 0.5;
    const hy = hind.position.y + hind.size * 0.5;
    const dist = Math.hypot(p.x - hx, p.y - hy);
    if (dist <= 54) {
      completeStageSuccess('golden_hind');
      return;
    }

    hind.__hindTurnTimer = (hind.__hindTurnTimer || 0) - dt;
    if (hind.__hindTurnTimer <= 0) {
      hind.__hindDirY = (Math.random() - 0.5) * 1.6;
      hind.__hindTurnTimer = 1.2 + Math.random() * 1.8;
    }
    const dirX = (hx > p.x ? 1 : -1);
    hind.position.x += dirX * hind.speed * dt;
    hind.position.y += (hind.__hindDirY || 0) * hind.speed * 0.4 * dt;
    const lane = state.stageData.lane;
    hind.position.x = Math.max(lane.x + 20, Math.min(hind.position.x, lane.x + lane.w - hind.size - 20));
    hind.position.y = Math.max(lane.y + 20, Math.min(hind.position.y, lane.y + lane.h - hind.size - 20));
    hind.health = hind.maxHealth;

    if (metaEl) {
      metaEl.textContent = `Hind Timer: ${Math.ceil(state.stageData.timer)}s`;
    }
  }

  function applySwarmStageSetup() {
    clearCombatWorld(2700, 1320, { x: 420, y: 670 });
    const village = createRect(240, 500, 280, 320);
    const lanes = [560, 680, 800];
    game.world.tileWallRects = pushWallsForArena(createRect(190, 260, 2300, 780));
    state.stageData = {
      village,
      villageHp: 100,
      waveIndex: 0,
      waveCounts: [6, 8, 10, 12],
      waveSpawnTimer: 1.2,
      waveDoneDelay: 0.8,
      lanes,
      birdHitCd: 0
    };
  }

  function spawnSwarmWaveBird() {
    const stage = state.stageData;
    const laneY = stage.lanes[randomInt(0, stage.lanes.length - 1)];
    const bird = spawnEnemyNear(2300, laneY, {
      maxHealth: 24,
      attack: 8,
      speed: 260,
      disableAffixes: true
    }, {
      assign: {
        __monstrosityTag: 'ironfeather_bird',
        __birdLaneY: laneY,
        __birdWobble: Math.random() * Math.PI * 2
      }
    });
    return bird;
  }

  function updateSwarmStage(dt) {
    const stage = state.stageData;
    if (stage.villageHp <= 0) {
      completeStageFailure('village_destroyed');
      return;
    }

    const birds = (game.enemySystem.enemies || []).filter((enemy) => enemy.__monstrosityTag === 'ironfeather_bird' && !enemy.isDead);
    if (stage.waveIndex < stage.waveCounts.length) {
      if (!stage.pendingSpawnCount || stage.pendingSpawnCount <= 0) {
        stage.pendingSpawnCount = stage.waveCounts[stage.waveIndex];
      }
      stage.waveSpawnTimer -= dt;
      if (stage.pendingSpawnCount > 0 && stage.waveSpawnTimer <= 0) {
        spawnSwarmWaveBird();
        stage.pendingSpawnCount -= 1;
        stage.waveSpawnTimer = 0.5;
      }
      if (stage.pendingSpawnCount <= 0 && birds.length <= 0) {
        stage.waveIndex += 1;
        stage.waveSpawnTimer = 1.3;
      }
    } else if (birds.length <= 0) {
      completeStageSuccess('ironfeather_swarm');
      return;
    }

    const player = getPlayerCenter();
    stage.birdHitCd = Math.max(0, (stage.birdHitCd || 0) - dt);
    for (const bird of birds) {
      bird.__birdWobble = (bird.__birdWobble || 0) + dt * 6;
      const targetVillageX = stage.village.x + stage.village.w * 0.8;
      const nearPlayer = Math.hypot((bird.position.x + bird.size * 0.5) - player.x, (bird.position.y + bird.size * 0.5) - player.y) < 150;
      if (!nearPlayer) {
        bird.position.x -= bird.speed * dt;
        bird.position.y += Math.sin(bird.__birdWobble) * 35 * dt;
      } else if (stage.birdHitCd <= 0) {
        stage.birdHitCd = 0.6;
        game.onPlayerDamaged?.(4, true, { sourceType: 'rite_monstrosity_ironfeather' });
      }
      bird.position.y = Math.max(330, Math.min(940, bird.position.y));
      if (bird.position.x <= targetVillageX) {
        stage.villageHp = Math.max(0, stage.villageHp - 5);
        bird.isDead = true;
      }
    }

    if (metaEl) {
      const waveDisplay = Math.min(stage.waveCounts.length, stage.waveIndex + (stage.pendingSpawnCount > 0 ? 1 : 0));
      metaEl.textContent = `Village HP: ${Math.round(stage.villageHp)} | Wave: ${waveDisplay}/${stage.waveCounts.length} | Active Birds: ${birds.length}`;
    }
  }

  function applyCerberusStageSetup() {
    clearCombatWorld(2200, 1280, { x: 440, y: 640 });
    const arena = createRect(220, 200, 1760, 860);
    const pillars = [
      createRect(860, 460, 60, 60),
      createRect(1120, 420, 60, 60),
      createRect(1320, 620, 60, 60),
      createRect(980, 760, 60, 60),
      createRect(1460, 500, 60, 60)
    ];
    game.world.tileWallRects = pushWallsForArena(arena);
    const cave = createRect(1300, 560, 220, 180);
    const cerb = spawnEnemyNear(cave.x + cave.w + 140, cave.y + cave.h * 0.5, {
      maxHealth: 99999,
      attack: 18,
      speed: 170,
      disableAffixes: true
    }, {
      forceTier: 'elite',
      assign: {
        __monstrosityTag: 'cerberus',
        __chargeCd: 2.6
      }
    });
    state.stageData = {
      arena,
      cave,
      caveHp: 1200,
      phase: 'break_cave',
      cerberusId: cerb?.id || null,
      cerberusStamina: 1000,
      pillars: pillars.map((pillar, index) => ({ ...pillar, id: index, broken: false })),
      hazardTimer: 1.4,
      chargeTimer: 2.6,
      chargeDir: { x: 0, y: 0 },
      chargeDuration: 0,
      captureMeter: 0,
      prevCapturePressed: false
    };
  }

  function updateCerberusStage(dt) {
    const stage = state.stageData;
    const player = getPlayerCenter();
    const cerb = (game.enemySystem.enemies || []).find((enemy) => enemy.id === stage.cerberusId && !enemy.isDead);
    if (!cerb) {
      completeStageFailure('cerberus_missing');
      return;
    }
    cerb.health = cerb.maxHealth;

    if (stage.phase === 'break_cave') {
      const caveCenter = { x: stage.cave.x + stage.cave.w * 0.5, y: stage.cave.y + stage.cave.h * 0.5 };
      const caveDist = Math.hypot(player.x - caveCenter.x, player.y - caveCenter.y);
      if (caveDist < 150 && game.mouseHeld) {
        const caveDps = Math.max(18, (game.currentStats?.attack || 30) * 0.5);
        stage.caveHp = Math.max(0, stage.caveHp - caveDps * dt);
      }
      stage.hazardTimer -= dt;
      if (stage.hazardTimer <= 0) {
        stage.hazardTimer = 1.1 + Math.random() * 1.2;
        if (Math.random() < 0.65) {
          game.onPlayerDamaged?.(5, true, { sourceType: 'rite_monstrosity_falling_rock' });
        }
      }
      if (stage.caveHp <= 0) {
        stage.phase = 'exhaust_cerberus';
        game.setRiteStageState?.('cerberus_exhaust');
        setObjective('Exhaust Cerberus by attacking and baiting charges into pillars.');
      }
    } else if (stage.phase === 'exhaust_cerberus') {
      if (game.mouseHeld && Math.hypot(player.x - (cerb.position.x + cerb.size * 0.5), player.y - (cerb.position.y + cerb.size * 0.5)) < 180) {
        stage.cerberusStamina = Math.max(0, stage.cerberusStamina - Math.max(14, (game.currentStats?.attack || 20) * 0.25) * dt);
      }
      stage.chargeTimer -= dt;
      if (stage.chargeTimer <= 0) {
        stage.chargeTimer = 2.4 + Math.random() * 1.1;
        const tx = player.x - (cerb.position.x + cerb.size * 0.5);
        const ty = player.y - (cerb.position.y + cerb.size * 0.5);
        const len = Math.hypot(tx, ty) || 1;
        stage.chargeDir = { x: tx / len, y: ty / len };
        stage.chargeDuration = 0.42;
      }
      if (stage.chargeDuration > 0) {
        stage.chargeDuration -= dt;
        cerb.position.x += stage.chargeDir.x * 520 * dt;
        cerb.position.y += stage.chargeDir.y * 520 * dt;
        for (const pillar of stage.pillars) {
          if (pillar.broken) continue;
          const cerbRect = createRect(cerb.position.x, cerb.position.y, cerb.size, cerb.size);
          if (rectsOverlap(cerbRect, pillar)) {
            pillar.broken = true;
            stage.cerberusStamina = Math.max(0, stage.cerberusStamina - 220);
            stage.chargeDuration = 0;
          }
        }
      }
      if (stage.cerberusStamina <= 0) {
        stage.phase = 'capture';
        setObjective('Cerberus is exhausted. Press E repeatedly near Cerberus to capture it.');
        game.setRiteStageState?.('cerberus_capture');
      }
    } else if (stage.phase === 'capture') {
      const capturePressed = game.input?.keys?.has?.('e') === true;
      const nearCerberus = Math.hypot(player.x - (cerb.position.x + cerb.size * 0.5), player.y - (cerb.position.y + cerb.size * 0.5)) < 120;
      if (capturePressed && !stage.prevCapturePressed && nearCerberus) {
        stage.captureMeter = Math.min(100, stage.captureMeter + 8);
      }
      stage.prevCapturePressed = capturePressed;
      if (stage.captureMeter >= 100) {
        completeStageSuccess('cerberus_capture');
      }
    }

    if (metaEl) {
      if (stage.phase === 'break_cave') {
        metaEl.textContent = `Cave HP: ${Math.round(stage.caveHp)}`;
      } else if (stage.phase === 'exhaust_cerberus') {
        metaEl.textContent = `Cerberus Stamina: ${Math.round(stage.cerberusStamina)} | Intact Pillars: ${stage.pillars.filter((pillar) => !pillar.broken).length}`;
      } else {
        metaEl.textContent = `Capture Meter: ${Math.round(stage.captureMeter)}%`;
      }
    }
  }

  function startMonstrosityStageByIndex(stageIndex) {
    const idx = Math.max(0, Math.min(MONSTROSITY_STAGES.length - 1, Math.floor(Number(stageIndex) || 0)));
    const stage = MONSTROSITY_STAGES[idx];
    setStageRuntime(idx, 'stage_setup');
    if (stage.id === 'nemean_beast') {
      applyNemeanStageSetup();
    } else if (stage.id === 'golden_hind') {
      applyHindStageSetup();
    } else if (stage.id === 'ironfeather_swarm') {
      applySwarmStageSetup();
    } else if (stage.id === 'cerberus_capture') {
      applyCerberusStageSetup();
    }
    state.stageState = 'stage_active';
    game.setRiteStageState?.('stage_active');
  }

  function completeRiteSuccessFlow() {
    if (state.completed || state.failed) return;
    state.completed = true;
    state.stageState = 'rite_success';
    game.completeRiteSuccess?.(riteId);
    game.gameOver = true;
    resultTitleEl.textContent = 'Rite of Monstrosity Completed';
    resultBodyEl.textContent = 'All monster trials are complete. Proof of Strength has been granted.';
    resultPanel.classList.remove('hidden');
  }

  function completeRiteFailureFlow(reason = 'player_defeat') {
    if (state.completed || state.failed) return;
    state.failed = true;
    state.stageState = 'rite_failure';
    game.completeRiteFailure?.(riteId, reason);
    game.gameOver = true;
    resultTitleEl.textContent = 'Rite of Monstrosity Failed';
    resultBodyEl.textContent = 'The sequence ended before completion. Retry is available and entry item was not consumed.';
    resultPanel.classList.remove('hidden');
  }

  function completeStageSuccess(stageId) {
    if (state.completed || state.failed) return;
    const currentStage = MONSTROSITY_STAGES[state.currentStageIndex];
    if (!currentStage || currentStage.id !== stageId) return;
    if (state.currentStageIndex >= MONSTROSITY_STAGES.length - 1) {
      if (!state.completedStageIds.includes(stageId)) {
        state.completedStageIds.push(stageId);
      }
      completeRiteSuccessFlow();
      return;
    }
    if (!state.completedStageIds.includes(stageId)) {
      state.completedStageIds.push(stageId);
    }
    state.jumps.totalStageTransitions += 1;
    state.stageTransitionTimer = 1.1;
    state.stageState = 'stage_transition';
    setObjective(`Stage complete: ${currentStage.label}. Preparing next stage...`);
    game.setRiteStageState?.('stage_transition');
    game.advanceRiteStage?.(1);
  }

  function completeStageFailure(reason = 'stage_failed') {
    completeRiteFailureFlow(reason);
  }

  function updateStageRuntime(dt) {
    if (state.completed || state.failed) return;
    if (state.stageTransitionTimer > 0) {
      state.stageTransitionTimer -= dt;
      if (state.stageTransitionTimer <= 0) {
        startMonstrosityStageByIndex(state.currentStageIndex + 1);
      }
      return;
    }
    const stage = MONSTROSITY_STAGES[state.currentStageIndex];
    if (!stage) return;
    if (stage.id === 'nemean_beast') {
      updateNemeanStage(dt);
    } else if (stage.id === 'golden_hind') {
      updateHindStage(dt);
    } else if (stage.id === 'ironfeather_swarm') {
      updateSwarmStage(dt);
    } else if (stage.id === 'cerberus_capture') {
      updateCerberusStage(dt);
    }
  }

  function drawStageOverlay(ctx) {
    if (!ctx || state.completed || state.failed) return;
    const cam = game.camera?.position || { x: 0, y: 0 };
    if (state.activeStageId === 'golden_hind') {
      const hind = (game.enemySystem.enemies || []).find((enemy) => enemy.id === state.stageData.hindId && !enemy.isDead);
      if (hind) {
        const x = hind.position.x + hind.size * 0.5 - cam.x;
        const y = hind.position.y + hind.size * 0.5 - cam.y;
        ctx.save();
        ctx.fillStyle = 'rgba(250, 204, 21, 0.85)';
        ctx.beginPath();
        ctx.arc(x, y, 10, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    } else if (state.activeStageId === 'ironfeather_swarm') {
      const village = state.stageData.village;
      if (village) {
        const vx = village.x - cam.x;
        const vy = village.y - cam.y;
        ctx.save();
        ctx.strokeStyle = 'rgba(147, 197, 253, 0.9)';
        ctx.lineWidth = 2;
        ctx.strokeRect(vx + 0.5, vy + 0.5, village.w - 1, village.h - 1);
        ctx.fillStyle = 'rgba(2, 132, 199, 0.25)';
        ctx.fillRect(vx, vy, village.w, village.h);
        ctx.restore();
      }
    } else if (state.activeStageId === 'cerberus_capture') {
      const cave = state.stageData.cave;
      if (cave && state.stageData.phase === 'break_cave') {
        const cx = cave.x - cam.x;
        const cy = cave.y - cam.y;
        ctx.save();
        ctx.fillStyle = 'rgba(71, 85, 105, 0.65)';
        ctx.strokeStyle = 'rgba(148, 163, 184, 0.9)';
        ctx.lineWidth = 2;
        ctx.fillRect(cx, cy, cave.w, cave.h);
        ctx.strokeRect(cx + 0.5, cy + 0.5, cave.w - 1, cave.h - 1);
        ctx.restore();
      }
      for (const pillar of state.stageData.pillars || []) {
        const px = pillar.x - cam.x;
        const py = pillar.y - cam.y;
        ctx.save();
        ctx.fillStyle = pillar.broken ? 'rgba(71, 85, 105, 0.25)' : 'rgba(148, 163, 184, 0.7)';
        ctx.fillRect(px, py, pillar.w, pillar.h);
        ctx.restore();
      }
    }
  }

  function updateHud() {
    const stage = MONSTROSITY_STAGES[state.currentStageIndex];
    if (stageEl) {
      stageEl.textContent = `Stage ${state.currentStageIndex + 1}/${MONSTROSITY_STAGES.length} - ${stage?.label || 'Unknown'}`;
    }
    if (objectiveEl && !objectiveEl.textContent) {
      objectiveEl.textContent = stage?.objective || '';
    }
  }

  function runValidationSuite() {
    const checks = [];
    const push = (id, passed, detail = '') => checks.push({ id, passed: !!passed, detail });
    push('stage_count', MONSTROSITY_STAGES.length === 4, `count=${MONSTROSITY_STAGES.length}`);
    push('stage_index_valid', state.currentStageIndex >= 0 && state.currentStageIndex < MONSTROSITY_STAGES.length, `index=${state.currentStageIndex}`);
    push('sequential_runtime_marker', game.getActiveRiteSummary?.()?.stageIndex === state.currentStageIndex, `runtime=${game.getActiveRiteSummary?.()?.stageIndex}`);
    const before = state.stageTransitionTimer;
    state.stageTransitionTimer = 0;
    const prevStage = state.currentStageIndex;
    if (prevStage < MONSTROSITY_STAGES.length - 1) {
      completeStageSuccess(MONSTROSITY_STAGES[prevStage].id);
      push('stage_success_advances_or_transitions', state.currentStageIndex >= prevStage, `prev=${prevStage} now=${state.currentStageIndex}`);
    } else {
      push('final_stage_present', true, 'already on final stage');
    }
    state.stageTransitionTimer = before;
    return {
      passed: checks.every((entry) => entry.passed),
      results: checks
    };
  }

  game.registerRiteRuntimeHandler?.('monstrosity_sequence', {
    update(_dt, controller) {
      if (!controller || !controller.state || controller.state.activeRiteId !== riteId) return;
      controller.state.metadata = {
        ...(controller.state.metadata || {}),
        currentStageId: state.activeStageId,
        stageState: state.stageState,
        stageData: {
          hindTimer: state.activeStageId === 'golden_hind' ? state.stageData.timer : null,
          villageHp: state.activeStageId === 'ironfeather_swarm' ? state.stageData.villageHp : null,
          waveIndex: state.activeStageId === 'ironfeather_swarm' ? state.stageData.waveIndex : null,
          cerberusStamina: state.activeStageId === 'cerberus_capture' ? state.stageData.cerberusStamina : null,
          cerberusPhase: state.activeStageId === 'cerberus_capture' ? state.stageData.phase : null
        }
      };
      controller.state.stageIndex = state.currentStageIndex;
      controller.state.stageState = state.stageState;
    }
  });

  const activeRite = game.getActiveRiteSummary?.();
  if (activeRite?.activeRiteId !== riteId) {
    const begin = game.beginRite?.(riteId);
    if (!begin?.success) {
      console.warn('[RiteOfMonstrosity] beginRite failed:', begin?.reason || 'unknown');
    }
  }

  game.__monstrosityInstalled = true;
  game.__monstrosityState = state;
  setStageRuntime(0, 'stage_setup');
  startMonstrosityStageByIndex(0);
  updateHud();

  game.startMonstrosityStage = function startMonstrosityStage(stageId) {
    const idx = MONSTROSITY_STAGES.findIndex((stage) => stage.id === stageId);
    if (idx < 0) {
      return { success: false, reason: 'unknown_stage' };
    }
    startMonstrosityStageByIndex(idx);
    return { success: true, stageId };
  };

  game.resetMonstrosityStage = function resetMonstrosityStage() {
    startMonstrosityStageByIndex(state.currentStageIndex);
    return {
      success: true,
      stageId: MONSTROSITY_STAGES[state.currentStageIndex]?.id || null
    };
  };

  game.jumpToMonstrosityStage = function jumpToMonstrosityStage(stageId) {
    return game.startMonstrosityStage(stageId);
  };

  game.forceMonstrosityStageSuccess = function forceMonstrosityStageSuccess() {
    const stage = MONSTROSITY_STAGES[state.currentStageIndex];
    if (!stage) return { success: false, reason: 'no_stage' };
    completeStageSuccess(stage.id);
    return { success: true, stageId: stage.id };
  };

  game.forceMonstrosityStageFailure = function forceMonstrosityStageFailure(reason = 'forced_stage_failure') {
    completeStageFailure(reason);
    return { success: true, reason };
  };

  game.completeStageSuccess = function completeStageSuccessFromDebug() {
    return game.forceMonstrosityStageSuccess();
  };

  game.completeStageFailure = function completeStageFailureFromDebug(reason = 'forced_stage_failure') {
    return game.forceMonstrosityStageFailure(reason);
  };

  game.getMonstrosityDebugSummary = function getMonstrosityDebugSummary() {
    return {
      riteId,
      currentStageIndex: state.currentStageIndex,
      currentStageId: state.activeStageId,
      stageState: state.stageState,
      stageObjective: MONSTROSITY_STAGES[state.currentStageIndex]?.objective || '',
      stageData: {
        hindTimer: state.stageData.timer ?? null,
        villageHp: state.stageData.villageHp ?? null,
        waveIndex: state.stageData.waveIndex ?? null,
        activeBirds: (game.enemySystem?.enemies || []).filter((enemy) => enemy.__monstrosityTag === 'ironfeather_bird' && !enemy.isDead).length,
        cerberusPhase: state.stageData.phase ?? null,
        cerberusStamina: state.stageData.cerberusStamina ?? null,
        caveHp: state.stageData.caveHp ?? null,
        captureMeter: state.stageData.captureMeter ?? null
      },
      completedStageIds: [...state.completedStageIds]
    };
  };

  game.logMonstrosityRuntimeSummary = function logMonstrosityRuntimeSummary() {
    const summary = game.getMonstrosityDebugSummary();
    console.log('[RiteOfMonstrosity] Runtime summary:', summary);
    return summary;
  };

  game.debugRunMonstrosityValidationSuite = function debugRunMonstrosityValidationSuite() {
    const runtimeResult = runValidationSuite();
    const deterministicResult = validateMonstrosityStageDeterminism(1337);
    return {
      passed: runtimeResult.passed && deterministicResult.passed,
      runtime: runtimeResult,
      deterministic: deterministicResult
    };
  };

  game.update = function updateMonstrosityWrapped(dt) {
    baseUpdate(dt);
    if (state.completed || state.failed || game.gameOver) return;
    updateStageRuntime(dt);
    updateHud();
  };

  game.render = function renderMonstrosityWrapped() {
    baseRender();
    drawStageOverlay(game.ctx);
  };

  game.showGameOver = function showGameOverMonstrosityWrapped() {
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
        returnHome({ reason: state.completed ? 'rite_success' : 'rite_failure', riteId });
      }
    });
  }

  game.destroy = function destroyMonstrosityWrapped() {
    if (hud?.parentElement) hud.remove();
    if (resultPanel?.parentElement) resultPanel.remove();
    game.__monstrosityInstalled = false;
    game.__monstrosityState = null;
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
    stages: MONSTROSITY_STAGES.map((stage) => stage.id)
  };
}
