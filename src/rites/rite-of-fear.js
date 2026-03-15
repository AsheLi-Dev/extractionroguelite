function createRect(x, y, w, h) {
  return { x: Math.floor(x), y: Math.floor(y), w: Math.max(1, Math.floor(w)), h: Math.max(1, Math.floor(h)) };
}

function rectContainsPoint(rect, x, y) {
  return x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h;
}

function rectsOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function pushWallRect(list, x, y, w, h) {
  if (w <= 0 || h <= 0) return;
  list.push(createRect(x, y, w, h));
}

function buildSegmentWalls(list, fixedAxis, start, end, thickness, horizontal = true) {
  if (end <= start) return;
  if (horizontal) {
    pushWallRect(list, start, fixedAxis, end - start, thickness);
  } else {
    pushWallRect(list, fixedAxis, start, thickness, end - start);
  }
}

function splitSegments(baseStart, baseEnd, gaps) {
  const normalizedGaps = (Array.isArray(gaps) ? gaps : [])
    .map((gap) => ({
      start: Math.max(baseStart, Number(gap.start) || baseStart),
      end: Math.min(baseEnd, Number(gap.end) || baseEnd)
    }))
    .filter((gap) => gap.end > gap.start)
    .sort((a, b) => a.start - b.start);
  const segments = [];
  let cursor = baseStart;
  for (const gap of normalizedGaps) {
    if (gap.start > cursor) {
      segments.push({ start: cursor, end: gap.start });
    }
    cursor = Math.max(cursor, gap.end);
  }
  if (cursor < baseEnd) {
    segments.push({ start: cursor, end: baseEnd });
  }
  return segments;
}

function randomInt(min, max) {
  const lo = Math.ceil(min);
  const hi = Math.floor(max);
  return lo + Math.floor(Math.random() * (hi - lo + 1));
}

function generateFearMapLayout() {
  const world = {
    width: 3200,
    height: 1500,
    wallThickness: 52
  };
  const hall = createRect(220, 650, world.width - 440, 190);
  const roomCount = randomInt(8, 12);
  const rooms = [];
  const wallRects = [];
  const hallTopGaps = [];
  const hallBottomGaps = [];
  const roomDoorWidth = 90;
  const roomWallThickness = 22;
  const connectorThickness = 16;

  const step = hall.w / (roomCount + 1);
  for (let i = 0; i < roomCount; i += 1) {
    const centerX = hall.x + step * (i + 1);
    const roomW = randomInt(230, 320);
    const roomH = randomInt(190, 260);
    const topSide = i % 2 === 0;
    const roomX = Math.max(world.wallThickness + 20, Math.min(centerX - roomW * 0.5, world.width - world.wallThickness - roomW - 20));
    const roomY = topSide
      ? hall.y - roomH - randomInt(120, 170)
      : hall.y + hall.h + randomInt(120, 170);
    const roomRect = createRect(roomX, roomY, roomW, roomH);
    const doorCenterX = Math.max(roomRect.x + 55, Math.min(centerX, roomRect.x + roomRect.w - 55));
    const doorLeft = doorCenterX - roomDoorWidth * 0.5;
    const doorRight = doorCenterX + roomDoorWidth * 0.5;

    // Room shell with opening on side facing hallway.
    pushWallRect(wallRects, roomRect.x, roomRect.y, roomWallThickness, roomRect.h);
    pushWallRect(wallRects, roomRect.x + roomRect.w - roomWallThickness, roomRect.y, roomWallThickness, roomRect.h);
    if (topSide) {
      pushWallRect(wallRects, roomRect.x, roomRect.y, roomRect.w, roomWallThickness);
      pushWallRect(wallRects, roomRect.x, roomRect.y + roomRect.h - roomWallThickness, doorLeft - roomRect.x, roomWallThickness);
      pushWallRect(wallRects, doorRight, roomRect.y + roomRect.h - roomWallThickness, (roomRect.x + roomRect.w) - doorRight, roomWallThickness);
      const connectorTop = roomRect.y + roomRect.h;
      const connectorBottom = hall.y;
      pushWallRect(wallRects, doorLeft - connectorThickness, connectorTop, connectorThickness, connectorBottom - connectorTop);
      pushWallRect(wallRects, doorRight, connectorTop, connectorThickness, connectorBottom - connectorTop);
      hallTopGaps.push({ start: doorLeft - 8, end: doorRight + 8 });
    } else {
      pushWallRect(wallRects, roomRect.x, roomRect.y, doorLeft - roomRect.x, roomWallThickness);
      pushWallRect(wallRects, doorRight, roomRect.y, (roomRect.x + roomRect.w) - doorRight, roomWallThickness);
      pushWallRect(wallRects, roomRect.x, roomRect.y + roomRect.h - roomWallThickness, roomRect.w, roomWallThickness);
      const connectorTop = hall.y + hall.h;
      const connectorBottom = roomRect.y;
      pushWallRect(wallRects, doorLeft - connectorThickness, connectorTop, connectorThickness, connectorBottom - connectorTop);
      pushWallRect(wallRects, doorRight, connectorTop, connectorThickness, connectorBottom - connectorTop);
      hallBottomGaps.push({ start: doorLeft - 8, end: doorRight + 8 });
    }

    rooms.push({
      index: i,
      rect: roomRect,
      topSide,
      door: createRect(doorLeft, topSide ? roomRect.y + roomRect.h - roomWallThickness : roomRect.y, roomDoorWidth, roomWallThickness)
    });
  }

  // Hall perimeter with room connector gaps.
  for (const seg of splitSegments(hall.x, hall.x + hall.w, hallTopGaps)) {
    buildSegmentWalls(wallRects, hall.y, seg.start, seg.end, roomWallThickness, true);
  }
  for (const seg of splitSegments(hall.x, hall.x + hall.w, hallBottomGaps)) {
    buildSegmentWalls(wallRects, hall.y + hall.h - roomWallThickness, seg.start, seg.end, roomWallThickness, true);
  }
  pushWallRect(wallRects, hall.x, hall.y, roomWallThickness, hall.h);
  pushWallRect(wallRects, hall.x + hall.w - roomWallThickness, hall.y, roomWallThickness, hall.h);

  // Exit is at the far east side of hall, blocked until key is found.
  const exitZone = createRect(hall.x + hall.w - 104, hall.y + 48, 74, hall.h - 96);
  const exitBarrier = createRect(exitZone.x - 28, hall.y + 18, 20, hall.h - 36);

  const keyRoomIndex = randomInt(0, rooms.length - 1);
  const keyRoom = rooms[keyRoomIndex];
  const keyPosition = {
    x: keyRoom.rect.x + keyRoom.rect.w * 0.5,
    y: keyRoom.rect.y + keyRoom.rect.h * 0.5
  };
  const spawn = {
    x: hall.x + 72,
    y: hall.y + hall.h * 0.5
  };

  return {
    world,
    hall,
    rooms,
    roomCount: rooms.length,
    keyRoomIndex,
    keyPosition,
    exitZone,
    exitBarrier,
    wallRects,
    spawn
  };
}

function createFearHud() {
  const hud = document.createElement('div');
  hud.id = 'rite-fear-hud';
  hud.className = 'rite-fear-hud';
  hud.innerHTML = `
    <div class="rite-fear-hud-title">Rite of Fear</div>
    <div id="rite-fear-hud-objective" class="rite-fear-hud-objective"></div>
    <div id="rite-fear-hud-key" class="rite-fear-hud-key"></div>
  `;
  document.body.appendChild(hud);
  return hud;
}

function createFearResultPanel() {
  const panel = document.createElement('div');
  panel.id = 'rite-fear-result';
  panel.className = 'rite-fear-result hidden';
  panel.innerHTML = `
    <div class="rite-fear-result-surface">
      <h2 id="rite-fear-result-title"></h2>
      <p id="rite-fear-result-body"></p>
      <button id="rite-fear-result-close" type="button">Return to Home Base</button>
    </div>
  `;
  document.body.appendChild(panel);
  return panel;
}

export function installRiteOfFear(game, options = {}) {
  if (!game || game.__fearRiteInstalled) {
    return null;
  }

  const riteId = String(options.riteId || 'rite_of_fear');
  if (riteId !== 'rite_of_fear') {
    return null;
  }

  const layout = generateFearMapLayout();
  const hud = createFearHud();
  const resultPanel = createFearResultPanel();
  const objectiveEl = hud.querySelector('#rite-fear-hud-objective');
  const keyEl = hud.querySelector('#rite-fear-hud-key');
  const resultTitleEl = resultPanel.querySelector('#rite-fear-result-title');
  const resultBodyEl = resultPanel.querySelector('#rite-fear-result-body');
  const resultCloseBtn = resultPanel.querySelector('#rite-fear-result-close');

  const state = {
    riteId,
    layout,
    roomEntered: new Set(),
    hasKey: false,
    keyDiscovered: false,
    completed: false,
    failed: false,
    currentRoomIndex: null,
    jumpscareCooldown: 0,
    jumpscareCooldownMax: 5.5,
    maxActiveFearEnemies: 4,
    lastSpawnReason: null,
    totalSpawns: 0,
    revealedKeyRoom: false,
    darknessProfile: {
      hallwayAlpha: 0.58,
      roomAlpha: 0.84,
      hallwayVisionRadius: 186,
      roomVisionRadius: 106
    },
    forcedKeyRoomIndex: null
  };

  game.registerRiteRuntimeHandler?.('fear_hallway', {
    update(_dt, controller) {
      if (!controller || !controller.state || controller.state.activeRiteId !== riteId) return;
      controller.state.metadata = {
        ...(controller.state.metadata || {}),
        roomCount: layout.roomCount,
        keyRoomIndex: layout.keyRoomIndex,
        hasKey: state.hasKey,
        currentRoomIndex: state.currentRoomIndex,
        exitUnlocked: state.hasKey,
        lastSpawnReason: state.lastSpawnReason,
        totalSpawns: state.totalSpawns
      };
      controller.state.stageIndex = state.hasKey ? 1 : 0;
    }
  });

  function updateObjectiveText() {
    if (state.completed) {
      if (objectiveEl) objectiveEl.textContent = 'Rite Complete';
      if (keyEl) keyEl.textContent = 'Key: Acquired';
      return;
    }
    if (state.failed) {
      if (objectiveEl) objectiveEl.textContent = 'Rite Failed';
      if (keyEl) keyEl.textContent = 'Key: Lost';
      return;
    }
    if (state.hasKey) {
      if (objectiveEl) objectiveEl.textContent = 'Return to the exit door.';
      if (keyEl) keyEl.textContent = 'Key: Acquired';
      game.setRiteObjective?.('Return to the exit door');
      return;
    }
    if (objectiveEl) objectiveEl.textContent = 'Search the rooms for the exit key.';
    if (keyEl) keyEl.textContent = 'Key: Missing';
    game.setRiteObjective?.('Search the rooms for the exit key');
  }

  function getPlayerCenter() {
    return {
      x: game.player.position.x + game.player.size * 0.5,
      y: game.player.position.y + game.player.size * 0.5
    };
  }

  function getCurrentRoomIndex() {
    const p = getPlayerCenter();
    for (const room of layout.rooms) {
      if (rectContainsPoint(room.rect, p.x, p.y)) return room.index;
    }
    return null;
  }

  function getActiveFearEnemies() {
    return (game.enemySystem?.enemies || []).filter((enemy) => enemy && !enemy.isDead && enemy.__fearRiteEnemy === true);
  }

  function applyFearEnemyTuning(enemy) {
    if (!enemy) return;
    enemy.__fearRiteEnemy = true;
    enemy.maxHealth = Math.max(6, Math.min(18, Math.round((enemy.maxHealth || 14) * 0.34)));
    enemy.health = enemy.maxHealth;
    enemy.attack = Math.max(1, Math.min(4, Math.round((enemy.attack || 4) * 0.28)));
    enemy.speed = Math.max(70, Math.round((enemy.speed || 140) * 0.8));
    enemy.enemyTier = 'minion';
    enemy.isElite = false;
    enemy.affixes = [];
  }

  function spawnFearEnemyNearPosition(x, y, reason = 'unknown') {
    if (!game.enemySystem || state.jumpscareCooldown > 0) return false;
    if (getActiveFearEnemies().length >= state.maxActiveFearEnemies) return false;

    const before = game.enemySystem.enemies.length;
    game.enemySystem.spawnOne('minion', [], { x, y }, game);
    const spawned = game.enemySystem.enemies.slice(before);
    for (const enemy of spawned) {
      applyFearEnemyTuning(enemy);
    }
    if (spawned.length > 0) {
      state.jumpscareCooldown = state.jumpscareCooldownMax;
      state.lastSpawnReason = reason;
      state.totalSpawns += spawned.length;
      return true;
    }
    return false;
  }

  function updateJumpscareController(dt) {
    if (state.jumpscareCooldown > 0) {
      state.jumpscareCooldown = Math.max(0, state.jumpscareCooldown - dt);
    }

    const roomIndex = getCurrentRoomIndex();
    state.currentRoomIndex = roomIndex;
    if (roomIndex != null && !state.roomEntered.has(roomIndex)) {
      state.roomEntered.add(roomIndex);
      const room = layout.rooms[roomIndex];
      spawnFearEnemyNearPosition(room.rect.x + room.rect.w * 0.5, room.rect.y + room.rect.h * 0.5, 'enter_room');
    }
  }

  function refreshWorldWallRects() {
    const baseWalls = layout.wallRects.slice();
    if (!state.hasKey) {
      baseWalls.push(layout.exitBarrier);
    }
    game.world.tileWallRects = baseWalls;
  }

  function setupFearWorldState() {
    game.world.width = layout.world.width;
    game.world.height = layout.world.height;
    game.world.wallThickness = layout.world.wallThickness;
    game.world.proceduralExitZones = [];
    game.currentMap = {
      ...(game.currentMap || {}),
      exits: [],
      id: 'rite_fear_map'
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
    }
    refreshWorldWallRects();
    game.player.position.set(layout.spawn.x - game.player.size * 0.5, layout.spawn.y - game.player.size * 0.5);
    game.camera.snapTo(game.player, game.world.width, game.world.height);
  }

  function drawFearMarkers(ctx) {
    if (!ctx) return;
    const cam = game.camera?.position || { x: 0, y: 0 };
    const roomIndex = state.currentRoomIndex;
    const inRoom = roomIndex != null;

    // Key marker remains subtle and easier once discovered.
    if (!state.hasKey) {
      const keyVisible = state.revealedKeyRoom || roomIndex === layout.keyRoomIndex;
      if (keyVisible) {
        const sx = layout.keyPosition.x - cam.x;
        const sy = layout.keyPosition.y - cam.y;
        ctx.save();
        ctx.fillStyle = 'rgba(186, 230, 253, 0.9)';
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.95)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(sx, sy, 10, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }
    }

    // Exit door marker.
    const exit = layout.exitZone;
    const ex = exit.x - cam.x;
    const ey = exit.y - cam.y;
    ctx.save();
    ctx.strokeStyle = state.hasKey ? 'rgba(74, 222, 128, 0.95)' : 'rgba(251, 191, 36, 0.95)';
    ctx.fillStyle = state.hasKey ? 'rgba(21, 128, 61, 0.35)' : 'rgba(146, 64, 14, 0.38)';
    ctx.lineWidth = 2;
    ctx.fillRect(ex, ey, exit.w, exit.h);
    ctx.strokeRect(ex + 0.5, ey + 0.5, exit.w - 1, exit.h - 1);
    ctx.font = '11px system-ui, sans-serif';
    ctx.fillStyle = 'rgba(241, 245, 249, 0.95)';
    ctx.fillText(state.hasKey ? 'Exit Unlocked' : 'Exit Locked', ex - 8, ey - 8);
    if (inRoom && !state.hasKey) {
      const room = layout.rooms[roomIndex];
      const rx = room.rect.x - cam.x;
      const ry = room.rect.y - cam.y;
      ctx.strokeStyle = 'rgba(96, 165, 250, 0.28)';
      ctx.strokeRect(rx + 0.5, ry + 0.5, room.rect.w - 1, room.rect.h - 1);
    }
    ctx.restore();
  }

  function drawFearDarkness(ctx) {
    if (!ctx) return;
    const p = getPlayerCenter();
    const roomIndex = state.currentRoomIndex;
    const inRoom = roomIndex != null;
    const alpha = inRoom ? state.darknessProfile.roomAlpha : state.darknessProfile.hallwayAlpha;
    const radius = inRoom ? state.darknessProfile.roomVisionRadius : state.darknessProfile.hallwayVisionRadius;
    const sx = p.x - game.camera.position.x;
    const sy = p.y - game.camera.position.y;

    ctx.save();
    ctx.fillStyle = `rgba(0, 0, 0, ${Math.max(0, Math.min(0.95, alpha))})`;
    ctx.fillRect(0, 0, game.canvas.width, game.canvas.height);
    ctx.globalCompositeOperation = 'destination-out';
    const light = ctx.createRadialGradient(sx, sy, radius * 0.12, sx, sy, radius);
    light.addColorStop(0, 'rgba(0,0,0,0.96)');
    light.addColorStop(0.5, 'rgba(0,0,0,0.52)');
    light.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = light;
    ctx.beginPath();
    ctx.arc(sx, sy, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
    ctx.restore();
  }

  function showResult(success) {
    if (!resultPanel || !resultTitleEl || !resultBodyEl) return;
    resultTitleEl.textContent = success ? 'Rite of Fear Completed' : 'Rite of Fear Failed';
    resultBodyEl.textContent = success
      ? 'You found the key, escaped the hallway, and earned Proof of Courage.'
      : 'You were overcome before escaping. The Rite entry item was not consumed.';
    resultPanel.classList.remove('hidden');
  }

  function completeSuccess() {
    if (state.completed || state.failed) return;
    state.completed = true;
    game.completeRiteSuccess?.(riteId);
    game.gameOver = true;
    updateObjectiveText();
    showResult(true);
  }

  function completeFailure(reason = 'player_defeat') {
    if (state.completed || state.failed) return;
    state.failed = true;
    game.completeRiteFailure?.(riteId, reason);
    game.gameOver = true;
    updateObjectiveText();
    showResult(false);
  }

  function updateKeyAndExit() {
    if (state.completed || state.failed) return;
    const p = getPlayerCenter();
    const keyDist = Math.hypot(p.x - layout.keyPosition.x, p.y - layout.keyPosition.y);
    if (!state.hasKey && keyDist <= 30) {
      state.hasKey = true;
      state.keyDiscovered = true;
      game.advanceRiteStage?.(1);
      refreshWorldWallRects();
      updateObjectiveText();
    }
    if (state.hasKey && rectContainsPoint(layout.exitZone, p.x, p.y)) {
      completeSuccess();
    }
  }

  function runValidationSuite() {
    const checks = [];
    const push = (id, passed, detail = '') => checks.push({ id, passed: !!passed, detail });
    push('room_count_range', layout.roomCount >= 8 && layout.roomCount <= 12, `roomCount=${layout.roomCount}`);
    push('single_key_room', Number.isInteger(layout.keyRoomIndex) && layout.keyRoomIndex >= 0 && layout.keyRoomIndex < layout.rooms.length, `keyRoomIndex=${layout.keyRoomIndex}`);
    push('exit_locked_initially', state.hasKey === false, `hasKey=${state.hasKey}`);
    push('exit_barrier_present', (game.world.tileWallRects || []).some((rect) => rectsOverlap(rect, layout.exitBarrier)), 'exit barrier not found');
    // Cooldown guard check.
    const prevCooldown = state.jumpscareCooldown;
    state.jumpscareCooldown = state.jumpscareCooldownMax;
    const spawnedOnCooldown = spawnFearEnemyNearPosition(layout.spawn.x + 100, layout.spawn.y, 'validation_cooldown');
    push('jumpscare_cooldown_guard', spawnedOnCooldown === false, `spawnedOnCooldown=${spawnedOnCooldown}`);
    state.jumpscareCooldown = prevCooldown;
    return {
      passed: checks.every((entry) => entry.passed),
      results: checks
    };
  }

  // Ensure active rite state exists for this run.
  const activeRite = game.getActiveRiteSummary?.();
  if (activeRite?.activeRiteId !== riteId) {
    const begin = game.beginRite?.(riteId);
    if (!begin?.success) {
      console.warn('[RiteOfFear] Failed to begin rite:', begin?.reason || 'unknown');
    }
  }

  setupFearWorldState();
  updateObjectiveText();
  state.currentRoomIndex = getCurrentRoomIndex();
  state.revealedKeyRoom = false;

  const baseUpdate = game.update.bind(game);
  const baseRender = game.render.bind(game);
  const baseShowGameOver = game.showGameOver?.bind(game);
  const baseDestroy = game.destroy?.bind(game);

  game.__fearRiteInstalled = true;
  game.__fearRiteState = state;

  game.update = function updateFearWrapped(dt) {
    baseUpdate(dt);
    if (state.completed || state.failed || game.gameOver) {
      return;
    }
    updateJumpscareController(dt);
    updateKeyAndExit();
  };

  game.render = function renderFearWrapped() {
    baseRender();
    if (!game.__fearRiteInstalled) return;
    const ctx = game.ctx;
    drawFearMarkers(ctx);
    drawFearDarkness(ctx);
  };

  game.showGameOver = function showGameOverFearWrapped() {
    if (state.completed || state.failed) {
      return;
    }
    completeFailure('player_defeat');
  };

  game.revealFearRiteKeyRoom = function revealFearRiteKeyRoom() {
    state.revealedKeyRoom = true;
    return { success: true, keyRoomIndex: layout.keyRoomIndex };
  };

  game.setFearRiteKeyRoom = function setFearRiteKeyRoom(roomIndex) {
    const idx = Math.max(0, Math.min(layout.rooms.length - 1, Math.floor(Number(roomIndex) || 0)));
    state.forcedKeyRoomIndex = idx;
    layout.keyRoomIndex = idx;
    const room = layout.rooms[idx];
    layout.keyPosition = {
      x: room.rect.x + room.rect.w * 0.5,
      y: room.rect.y + room.rect.h * 0.5
    };
    state.hasKey = false;
    state.keyDiscovered = false;
    refreshWorldWallRects();
    updateObjectiveText();
    return { success: true, keyRoomIndex: idx };
  };

  game.teleportToFearRiteExit = function teleportToFearRiteExit() {
    game.player.position.set(layout.exitZone.x - game.player.size - 6, layout.exitZone.y + layout.exitZone.h * 0.5 - game.player.size * 0.5);
    return { success: true };
  };

  game.forceFearRiteSuccess = function forceFearRiteSuccess() {
    state.hasKey = true;
    refreshWorldWallRects();
    completeSuccess();
    return { success: true };
  };

  game.forceFearRiteFailure = function forceFearRiteFailure() {
    completeFailure('forced_failure');
    return { success: true };
  };

  game.getFearRiteDebugSummary = function getFearRiteDebugSummary() {
    return {
      riteId,
      roomCount: layout.roomCount,
      keyRoomIndex: layout.keyRoomIndex,
      exitDoor: { ...layout.exitZone },
      hasKey: state.hasKey,
      keyDiscovered: state.keyDiscovered,
      exitUnlocked: state.hasKey,
      currentRoomIndex: state.currentRoomIndex,
      jumpscareCooldown: state.jumpscareCooldown,
      maxActiveFearEnemies: state.maxActiveFearEnemies,
      activeFearEnemies: getActiveFearEnemies().length,
      lastSpawnReason: state.lastSpawnReason,
      totalSpawns: state.totalSpawns,
      darknessProfile: { ...state.darknessProfile }
    };
  };

  game.setFearRiteHorrorIntensity = function setFearRiteHorrorIntensity(mode = 'full') {
    const normalized = String(mode || 'full').toLowerCase();
    if (normalized === 'off') {
      state.darknessProfile = {
        hallwayAlpha: 0.2,
        roomAlpha: 0.28,
        hallwayVisionRadius: 260,
        roomVisionRadius: 220
      };
    } else if (normalized === 'reduced') {
      state.darknessProfile = {
        hallwayAlpha: 0.44,
        roomAlpha: 0.62,
        hallwayVisionRadius: 220,
        roomVisionRadius: 158
      };
    } else {
      state.darknessProfile = {
        hallwayAlpha: 0.58,
        roomAlpha: 0.84,
        hallwayVisionRadius: 186,
        roomVisionRadius: 106
      };
    }
    return { success: true, mode: normalized, darknessProfile: { ...state.darknessProfile } };
  };

  game.logFearRiteRuntimeSummary = function logFearRiteRuntimeSummary() {
    const summary = game.getFearRiteDebugSummary();
    console.log('[RiteOfFear] Runtime summary:', summary);
    return summary;
  };

  game.debugRunFearRiteValidationSuite = function debugRunFearRiteValidationSuite() {
    return runValidationSuite();
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

  game.destroy = function destroyFearWrapped() {
    if (hud?.parentElement) hud.remove();
    if (resultPanel?.parentElement) resultPanel.remove();
    game.__fearRiteInstalled = false;
    game.__fearRiteState = null;
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
    layout
  };
}
