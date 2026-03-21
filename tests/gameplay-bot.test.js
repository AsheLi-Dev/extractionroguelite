"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert");
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const REPO_ROOT = path.resolve(__dirname, "..");
let playwright = null;
try {
  playwright = require("playwright");
} catch {
  playwright = null;
}

const MIME_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".woff": "font/woff",
  ".woff2": "font/woff2"
};

function createStaticServer(rootDir) {
  return http.createServer((req, res) => {
    const requestUrl = new URL(req.url || "/", "http://127.0.0.1");
    const relativePath = decodeURIComponent(requestUrl.pathname === "/" ? "/index.html" : requestUrl.pathname);
    const filePath = path.resolve(rootDir, `.${relativePath}`);
    if (!filePath.startsWith(rootDir)) {
      res.writeHead(403);
      res.end("Forbidden");
      return;
    }
    fs.readFile(filePath, (error, data) => {
      if (error) {
        res.writeHead(error.code === "ENOENT" ? 404 : 500);
        res.end(error.code === "ENOENT" ? "Not found" : "Server error");
        return;
      }
      const ext = path.extname(filePath).toLowerCase();
      res.writeHead(200, {
        "Content-Type": MIME_TYPES[ext] || "application/octet-stream",
        "Cache-Control": "no-store"
      });
      res.end(data);
    });
  });
}

async function wait(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function startBrowserGameSession(options = {}) {
  const { chromium } = playwright;
  const server = createStaticServer(REPO_ROOT);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port;
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const pageErrors = [];
  const consoleErrors = [];

  page.on("pageerror", (error) => {
    pageErrors.push(error?.stack || error?.message || String(error));
  });
  page.on("console", (message) => {
    if (message.type() === "error") {
      consoleErrors.push(message.text());
    }
  });

  await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: "domcontentloaded" });
  if (options.launch === "forestTestMap") {
    await page.waitForFunction(() => typeof window.startForestBiomeTestMap === "function", { timeout: 15000 });
    await page.evaluate(() => window.startForestBiomeTestMap());
    await page.waitForFunction(() => {
      const game = window.currentGame;
      return !!game && !!game.player && !!game.canvas && game.testMapId === "forest_biome_0";
    }, { timeout: 15000 });
  } else {
    await page.waitForSelector("#main-menu-tutorial");
    await page.click("#main-menu-tutorial");
    await page.waitForFunction(() => {
      const game = window.currentGame;
      return !!game && !!game.player && !!game.canvas;
    }, { timeout: 15000 });
  }

  return {
    page,
    server,
    browser,
    pageErrors,
    consoleErrors
  };
}

async function closeBrowserGameSession(session) {
  await session.page.close();
  await session.browser.close();
  await new Promise((resolve) => session.server.close(resolve));
}

describe("Gameplay bot smoke", () => {
  const botIt = playwright ? it : it.skip;

  botIt("boots a live run and survives a short scripted play session without runtime failures", async () => {
    const session = await startBrowserGameSession();
    const { page, pageErrors, consoleErrors } = session;

    try {
      const canvasBox = await page.locator("#game-canvas").boundingBox();
      assert.ok(canvasBox, "game canvas should be visible");

      const aimPoints = [
        { x: canvasBox.x + canvasBox.width * 0.75, y: canvasBox.y + canvasBox.height * 0.35 },
        { x: canvasBox.x + canvasBox.width * 0.25, y: canvasBox.y + canvasBox.height * 0.5 },
        { x: canvasBox.x + canvasBox.width * 0.65, y: canvasBox.y + canvasBox.height * 0.7 }
      ];
      const moveKeys = ["w", "d", "s", "a"];

      for (let i = 0; i < 8; i++) {
        const aim = aimPoints[i % aimPoints.length];
        await page.mouse.move(aim.x, aim.y);
        await page.keyboard.down(moveKeys[i % moveKeys.length]);
        await page.mouse.down();
        await wait(350);
        await page.mouse.up();
        await page.keyboard.up(moveKeys[i % moveKeys.length]);
        if (i % 2 === 0) {
          await page.keyboard.press(String((i % 4) + 1));
        }
        await wait(200);
      }

      await wait(1200);

      const snapshot = await page.evaluate(() => {
        const game = window.currentGame;
        return {
          exists: !!game,
          time: Number(game?.time) || 0,
          gameOver: !!game?.gameOver,
          playerHealth: Number(game?.currentHealth),
          playerMaxHealth: Number(game?.currentStats?.maxHealth),
          playerX: Number(game?.player?.position?.x),
          playerY: Number(game?.player?.position?.y),
          enemyCount: Array.isArray(game?.enemySystem?.enemies) ? game.enemySystem.enemies.length : 0
        };
      });

      assert.strictEqual(snapshot.exists, true, "game instance should still exist");
      assert.ok(snapshot.time > 2, "game clock should advance during bot session");
      assert.ok(Number.isFinite(snapshot.playerHealth), "player health should remain finite");
      assert.ok(snapshot.playerHealth > 0, "player should still be alive after the smoke session");
      assert.ok(snapshot.playerMaxHealth > 0, "player max health should be valid");
      assert.ok(Number.isFinite(snapshot.playerX) && Number.isFinite(snapshot.playerY), "player position should stay finite");
      assert.ok(snapshot.enemyCount >= 0, "enemy count should remain readable");
      assert.strictEqual(snapshot.gameOver, false, "bot smoke session should not immediately end the run");
      assert.deepStrictEqual(pageErrors, [], `page errors detected:\n${pageErrors.join("\n\n")}`);
      assert.deepStrictEqual(consoleErrors, [], `console errors detected:\n${consoleErrors.join("\n\n")}`);
    } finally {
      await closeBrowserGameSession(session);
    }
  }, 60000);

  botIt("handles combat damage, collision-safe knockback movement, and death flow", async () => {
    const session = await startBrowserGameSession({ launch: "forestTestMap" });
    const { page, pageErrors, consoleErrors } = session;

    try {
      await page.evaluate(() => {
        const game = window.currentGame;
        if (!game) return;
        game.enemySystem.enemies = [];
        const px = game.player.position.x + game.player.size / 2 + 90;
        const py = game.player.position.y + game.player.size / 2;
        const dummy = game.enemySystem.spawnOne("minion", null, { x: px, y: py }, game, "m_5h_medium_dummy", false);
        if (dummy) {
          dummy.maxHealth = 999;
          dummy.health = 999;
          dummy._devCreateDummy = true;
        }
      });

      const combatSnapshot = await page.evaluate(() => {
        const game = window.currentGame;
        const enemy = (game?.enemySystem?.enemies || []).find((entry) => entry && !entry.isDead && entry._devCreateDummy);
        if (!game || !enemy) return null;
        const playerCenterX = game.player.position.x + game.player.size / 2;
        const playerCenterY = game.player.position.y + game.player.size / 2;
        const enemyCenterX = enemy.position.x + enemy.size / 2;
        const enemyCenterY = enemy.position.y + enemy.size / 2;
        const dx = enemyCenterX - playerCenterX;
        const dy = enemyCenterY - playerCenterY;
        const distance = Math.sqrt(dx * dx + dy * dy) || 1;
        return {
          enemyId: enemy.id,
          enemyHealthBefore: Number(enemy.health),
          enemyWorldX: enemyCenterX,
          enemyWorldY: enemyCenterY,
          playerHealthBefore: Number(game.currentHealth),
          moveTarget: {
            x: Math.sign(dx) === 0 ? 1 : Math.sign(dx),
            y: Math.sign(dy) === 0 ? 1 : Math.sign(dy),
            durationMs: Math.min(2200, Math.max(700, Math.round(distance * 3)))
          }
        };
      });
      assert.ok(combatSnapshot, "expected a live enemy to target");

      const horizontalKey = combatSnapshot.moveTarget.x > 0 ? "d" : "a";
      const verticalKey = combatSnapshot.moveTarget.y > 0 ? "s" : "w";
      await page.keyboard.down(horizontalKey);
      await page.keyboard.down(verticalKey);
      await wait(combatSnapshot.moveTarget.durationMs);
      await page.keyboard.up(verticalKey);
      await page.keyboard.up(horizontalKey);

      await page.evaluate(({ x, y }) => {
        const game = window.currentGame;
        if (!game || typeof game.firePlayerProjectile !== "function") return;
        game.firePlayerProjectile(x, y, 1, {
          attackTypeOverride: game.attackType
        });
      }, { x: combatSnapshot.enemyWorldX, y: combatSnapshot.enemyWorldY });

      await page.waitForFunction(({ enemyId, beforeHealth }) => {
        const game = window.currentGame;
        const enemy = (game?.enemySystem?.enemies || []).find((entry) => entry.id === enemyId);
        return Number(enemy?.health) < Number(beforeHealth);
      }, { enemyId: combatSnapshot.enemyId, beforeHealth: combatSnapshot.enemyHealthBefore }, { timeout: 5000 });

      const postAttack = await page.evaluate(({ enemyId }) => {
        const game = window.currentGame;
        const enemy = (game?.enemySystem?.enemies || []).find((entry) => entry.id === enemyId);
        return {
          enemyHealthAfter: Number(enemy?.health),
          playerHealthAfterCombat: Number(game?.currentHealth)
        };
      }, { enemyId: combatSnapshot.enemyId });

      assert.ok(
        postAttack.enemyHealthAfter < combatSnapshot.enemyHealthBefore,
        `expected enemy health to drop, before=${combatSnapshot.enemyHealthBefore}, after=${postAttack.enemyHealthAfter}`
      );
      assert.ok(
        postAttack.playerHealthAfterCombat <= combatSnapshot.playerHealthBefore,
        "combat should leave player health readable and not above the starting value"
      );

      const knockbackResult = await page.evaluate(() => {
        const game = window.currentGame;
        const walls = game?.world?.tileWallRects || [];
        const wall = walls[0];
        if (!game || !wall || typeof game.movePlayerByWithCollision !== "function") return null;
        const findValidStart = () => {
          const offsets = [12, 24, 36, 48, 64, 80];
          for (const dx of offsets) {
            for (const dy of offsets) {
              const candidates = [
                { x: wall.x + wall.w + dx, y: wall.y + dy },
                { x: wall.x + wall.w + dx, y: wall.y + wall.h - dy - game.player.size },
                { x: wall.x - dx - game.player.size, y: wall.y + dy },
                { x: wall.x - dx - game.player.size, y: wall.y + wall.h - dy - game.player.size }
              ];
              for (const candidate of candidates) {
                if (!game.playerPositionHasBlockingCollision(candidate.x, candidate.y)) {
                  return candidate;
                }
              }
            }
          }
          return null;
        };
        const start = findValidStart();
        if (!start) return null;
        const startX = start.x;
        const startY = start.y;
        game.player.position.x = startX;
        game.player.position.y = startY;
        const before = { x: game.player.position.x, y: game.player.position.y };
        const towardWall = wall.x > startX ? (wall.x - startX) + wall.w + 40 : -((startX - wall.x) + wall.w + 40);
        game.movePlayerByWithCollision(towardWall, 0);
        return {
          before,
          after: { x: game.player.position.x, y: game.player.position.y },
          collides: game.playerPositionHasBlockingCollision(game.player.position.x, game.player.position.y)
        };
      });

      assert.ok(knockbackResult, "expected a wall and collision helper for knockback test");
      assert.strictEqual(knockbackResult.collides, false, "player should not end inside a blocking volume after knockback-like movement");
      assert.ok(Number.isFinite(knockbackResult.after.x) && Number.isFinite(knockbackResult.after.y), "player position should stay finite after knockback-like movement");

      const controlledMoveResult = await page.evaluate(() => {
        const game = window.currentGame;
        const wall = game?.world?.tileWallRects?.[0];
        if (!game || !wall || typeof game.moveEntityByWithCollision !== "function" || typeof game.placeEntityAtWithCollision !== "function") {
          return null;
        }

        const enemy = game.enemySystem.spawnOne(
          "minion",
          null,
          {
            x: game.player.position.x + game.player.size + 120,
            y: game.player.position.y
          },
          game,
          "m_5h_medium_dummy",
          false
        );
        if (!enemy) return null;

        const findValidStart = (entity) => {
          const offsets = [12, 24, 36, 48, 64, 80];
          for (const dx of offsets) {
            for (const dy of offsets) {
              const candidates = [
                { x: wall.x + wall.w + dx, y: wall.y + dy },
                { x: wall.x + wall.w + dx, y: wall.y + wall.h - dy - entity.size },
                { x: wall.x - dx - entity.size, y: wall.y + dy },
                { x: wall.x - dx - entity.size, y: wall.y + wall.h - dy - entity.size }
              ];
              for (const candidate of candidates) {
                const normalized = game.clampEntityPosition(entity, candidate.x, candidate.y);
                if (!game.entityPositionHasBlockingCollision(entity, normalized.x, normalized.y)) {
                  return normalized;
                }
              }
            }
          }
          return null;
        };

        const start = findValidStart(enemy);
        if (!start) return null;

        enemy.position.x = start.x;
        enemy.position.y = start.y;
        const towardWall = wall.x > start.x
          ? (wall.x - start.x) + wall.w + 40
          : -((start.x - wall.x) + wall.w + 40);
        game.moveEntityByWithCollision(enemy, towardWall, 0);

        const findValidPlayerStart = () => {
          const offsets = [12, 24, 36, 48, 64, 80];
          for (const dx of offsets) {
            for (const dy of offsets) {
              const candidates = [
                { x: wall.x + wall.w + dx, y: wall.y + dy },
                { x: wall.x + wall.w + dx, y: wall.y + wall.h - dy - game.player.size },
                { x: wall.x - dx - game.player.size, y: wall.y + dy },
                { x: wall.x - dx - game.player.size, y: wall.y + wall.h - dy - game.player.size }
              ];
              for (const candidate of candidates) {
                const normalized = game.clampEntityPosition(game.player, candidate.x, candidate.y);
                if (!game.playerPositionHasBlockingCollision(normalized.x, normalized.y)) {
                  return normalized;
                }
              }
            }
          }
          return null;
        };

        const playerStart = findValidPlayerStart();
        if (!playerStart) return null;
        game.player.position.x = playerStart.x;
        game.player.position.y = playerStart.y;
        const blockedPlayerX = wall.x + wall.w * 0.5 - game.player.size * 0.5;
        const blockedPlayerY = playerStart.y;
        const placed = game.placeEntityAtWithCollision(game.player, blockedPlayerX, blockedPlayerY, {
          maxSearchRadius: 160,
          searchStep: 8
        });

        return {
          enemyAfter: { x: enemy.position.x, y: enemy.position.y },
          enemyCollides: game.entityPositionHasBlockingCollision(enemy, enemy.position.x, enemy.position.y),
          playerAfter: { x: game.player.position.x, y: game.player.position.y },
          playerCollides: game.playerPositionHasBlockingCollision(game.player.position.x, game.player.position.y),
          placed
        };
      });

      assert.ok(controlledMoveResult, "expected collision-safe controlled movement helpers to be available");
      assert.strictEqual(controlledMoveResult.enemyCollides, false, "controlled enemy movement should stop before entering a blocking volume");
      assert.strictEqual(controlledMoveResult.playerCollides, false, "collision-safe placement should not leave the player inside a blocking volume");
      assert.strictEqual(typeof controlledMoveResult.placed, "boolean", "collision-safe placement should report whether it found a new valid position");
      assert.ok(Number.isFinite(controlledMoveResult.enemyAfter.x) && Number.isFinite(controlledMoveResult.enemyAfter.y), "enemy controlled movement should keep finite coordinates");
      assert.ok(Number.isFinite(controlledMoveResult.playerAfter.x) && Number.isFinite(controlledMoveResult.playerAfter.y), "player placement should keep finite coordinates");

      const deathState = await page.evaluate(() => {
        const game = window.currentGame;
        if (!game) return null;
        game.onPlayerDamaged((game.currentHealth || 0) + 9999, true, {
          sourceType: "bot_test",
          reason: "bot_forced_death"
        });
        const gameOverEl = document.getElementById("game-over");
        return {
          gameOver: !!game.gameOver,
          playerHealth: Number(game.currentHealth),
          overlayVisible: !!gameOverEl && !gameOverEl.classList.contains("hidden")
        };
      });

      assert.ok(deathState, "expected death state snapshot");
      assert.strictEqual(deathState.gameOver, true, "forced lethal damage should trigger game over");
      assert.ok(deathState.playerHealth <= 0, "player health should be depleted by forced lethal damage");
      assert.strictEqual(deathState.overlayVisible, true, "game over overlay should become visible");
      assert.deepStrictEqual(pageErrors, [], `page errors detected:\n${pageErrors.join("\n\n")}`);
      assert.deepStrictEqual(consoleErrors, [], `console errors detected:\n${consoleErrors.join("\n\n")}`);
    } finally {
      await closeBrowserGameSession(session);
    }
  }, 60000);

  botIt("forest biome test map exposes stable loot fixtures and gold economy pickup", async () => {
    const session = await startBrowserGameSession({ launch: "forestTestMap" });
    const { page, pageErrors, consoleErrors } = session;

    try {
      const fixtureSummary = await page.evaluate(() => {
        const game = window.currentGame;
        const grid = game?.world?.archetypeGrid?.grid || [];
        return {
          testMapId: game?.testMapId || null,
          currentMapId: game?.currentMapId || null,
          searchableProps: (game?.searchableProps || []).length,
          breakables: (game?.breakables || []).length,
          vaults: (game?.mapInteractables || []).filter((entry) => entry.type === "vault").length,
          archetypes: grid.flat().filter(Boolean)
        };
      });

      assert.strictEqual(fixtureSummary.testMapId, "forest_biome_0");
      assert.strictEqual(fixtureSummary.currentMapId, "forest_biome_test");
      assert.ok(fixtureSummary.searchableProps > 0, "test map should spawn searchable props");
      assert.ok(fixtureSummary.breakables > 0, "test map should spawn breakables");
      assert.ok(fixtureSummary.vaults > 0, "test map should include a vault fixture");

      const economyResult = await page.evaluate(() => {
        const game = window.currentGame;
        const player = game?.player;
        if (!game || !player || !game.lootSystem) return null;
        const centerX = player.position.x + player.size / 2;
        const centerY = player.position.y + player.size / 2;
        const beforeGold = Number(game.gold) || 0;
        game.lootSystem.spawnGoldAt(centerX, centerY, 25);
        for (const item of game.lootSystem.items) {
          item.age = Math.max(item.age || 0, item.pickupDelay || 1);
          item.burstProgress = 1;
          item.burstFrom = null;
        }
        game.lootSystem.update(0.016, player, (item) => game.handleLootPickup(item), game.getLootPickupRadiusMult());
        return {
          beforeGold,
          afterGold: Number(game.gold) || 0,
          remainingGoldItems: game.lootSystem.items.filter((item) => item.type === "Gold").length
        };
      });

      assert.ok(economyResult, "expected economy result from test map");
      assert.strictEqual(economyResult.afterGold - economyResult.beforeGold, 25, "gold pickup should increase run gold by the dropped amount");
      assert.strictEqual(economyResult.remainingGoldItems, 0, "picked up gold should be removed from the floor");
      assert.deepStrictEqual(pageErrors, [], `page errors detected:\n${pageErrors.join("\n\n")}`);
      assert.deepStrictEqual(consoleErrors, [], `console errors detected:\n${consoleErrors.join("\n\n")}`);
    } finally {
      await closeBrowserGameSession(session);
    }
  }, 60000);

  botIt("forest biome test map validates live status application, duration updates, and read helpers", async () => {
    const session = await startBrowserGameSession({ launch: "forestTestMap" });
    const { page, pageErrors, consoleErrors } = session;

    try {
      const statusResult = await page.evaluate(() => {
        const game = window.currentGame;
        if (!game?.statusManager || !game?.enemySystem?.spawnOne) return null;
        const px = game.player.position.x + game.player.size / 2 + 120;
        const py = game.player.position.y + game.player.size / 2;
        const enemy = game.enemySystem.spawnOne("minion", null, { x: px, y: py }, game, "m_5h_medium_dummy", false);
        if (!enemy) return null;
        enemy.maxHealth = 999;
        enemy.health = 999;
        const poisonApplyResult = game.applyStatusToEntity(enemy.id, "poison", {
          duration: 3,
          magnitude: 6,
          stacks: 2,
          maxStacks: 3,
          sourceId: "bot",
          sourceType: "bot_test"
        });
        const slowApplyResult = game.applyStatusToEntity("player", "slow", {
          duration: 2,
          magnitude: 0.8,
          sourceId: "bot",
          sourceType: "bot_test"
        });
        const poisonBefore = game.statusManager.getStatus(enemy.id, "poison");
        const beforeHealth = enemy.health;
        game.time += 0.5;
        game.statusManager.updateStatuses(0.5, game);
        game.syncAllStatusCompatibility?.();
        const poisonAfter = game.statusManager.getStatus(enemy.id, "poison");
        return {
          enemyHealthBefore: beforeHealth,
          enemyHealthAfter: enemy.health,
          playerSlowMultiplier: game.statusManager.getMoveSpeedMultiplier("player"),
          poisonStacks: game.statusManager.getStatusStacks(enemy.id, "poison"),
          poisonActive: game.statusManager.hasStatus(enemy.id, "poison"),
          poisonApplyResult,
          slowApplyResult,
          poisonBeforeStacks: Number(poisonBefore?.stacks) || 0,
          poisonRemainingBefore: Number(poisonBefore?.remaining) || 0,
          poisonRemainingAfter: Number(poisonAfter?.remaining) || 0
        };
      });

      assert.ok(statusResult, "expected live status result from test map");
      assert.ok(statusResult.poisonApplyResult, "wrapper should return the applied poison status");
      assert.ok(statusResult.slowApplyResult, "wrapper should return the applied slow status");
      assert.strictEqual(statusResult.poisonBeforeStacks, 2, "wrapper should make poison immediately visible in the manager");
      assert.ok(Math.abs(statusResult.playerSlowMultiplier - 0.8) < 1e-9, "player slow read helper should report the active slow multiplier");
      assert.strictEqual(statusResult.poisonStacks, 2, "poison stack count should remain readable on the target");
      assert.strictEqual(statusResult.poisonActive, true, "poison should remain active after one tick");
      assert.ok(statusResult.poisonRemainingAfter < statusResult.poisonRemainingBefore, "status manager should centrally reduce remaining duration over time");
      assert.ok(statusResult.enemyHealthAfter <= statusResult.enemyHealthBefore, "status update should not corrupt enemy health state");
      assert.deepStrictEqual(pageErrors, [], `page errors detected:\n${pageErrors.join("\n\n")}`);
      assert.deepStrictEqual(consoleErrors, [], `console errors detected:\n${consoleErrors.join("\n\n")}`);
    } finally {
      await closeBrowserGameSession(session);
    }
  }, 60000);

  botIt("forest biome test map validates stun application and expiry for player, hazard, and support sources", async () => {
    const session = await startBrowserGameSession({ launch: "forestTestMap" });
    const { page, pageErrors, consoleErrors } = session;

    try {
      const stunResult = await page.evaluate(() => {
        const game = window.currentGame;
        if (!game?.statusManager || !game?.enemySystem?.spawnOne) return null;

        const advanceStatuses = (dt) => {
          game.time += dt;
          game.statusManager.updateStatuses(dt, game);
          game.syncAllStatusCompatibility?.();
        };

        const enemy = game.enemySystem.spawnOne(
          "minion",
          null,
          {
            x: game.player.position.x + game.player.size + 40,
            y: game.player.position.y
          },
          game,
          "m_5h_medium_dummy",
          false
        );
        if (!enemy) return null;

        game.skillEffects.push({
          type: "chainFrost",
          t: 0.2,
          freezeDuration: 0.25,
          skillId: "chainFrost",
          skillMults: null
        });
        game.updateSkillEffects(0.016);
        const playerSkillApplied = game.statusManager.hasStatus(enemy.id, "stun");
        const playerSkillRemaining = Number(game.statusManager.getStatus(enemy.id, "stun")?.remaining) || 0;
        advanceStatuses(0.4);
        const playerSkillExpired = !game.statusManager.hasStatus(enemy.id, "stun");

        const originalPatch = game.hazardSystem?.playerInPatch?.bind(game.hazardSystem);
        if (game.hazardSystem) {
          game.hazardSystem.playerInPatch = () => ({ type: "shockingGround" });
        }
        const originalRandom = Math.random;
        Math.random = () => 0;
        const beforeHazardTime = game.time;
        game.update(0.016);
        Math.random = originalRandom;
        if (game.hazardSystem && originalPatch) {
          game.hazardSystem.playerInPatch = originalPatch;
        }
        const hazardApplied = game.statusManager.hasStatus("player", "stun");
        const hazardRemaining = Number(game.statusManager.getStatus("player", "stun")?.remaining) || 0;
        if (game.time === beforeHazardTime) {
          advanceStatuses(0.016);
        }
        advanceStatuses(0.7);
        const hazardExpired = !game.statusManager.hasStatus("player", "stun");

        const px = game.player.position.x + game.player.size / 2;
        const py = game.player.position.y + game.player.size / 2;
        game.createEnemyProjectileAttack(
          {
            x: px,
            y: py,
            vx: 0,
            vy: 0,
            damage: 0,
            size: 16,
            color: "#a78bfa"
          },
          {
            lifetime: 0.2,
            onHitStun: true,
            stunDuration: 0.2
          },
          { id: "bot_support_totem" }
        );
        game.update(0.016);
        const supportApplied = game.statusManager.hasStatus("player", "stun");
        const supportRemaining = Number(game.statusManager.getStatus("player", "stun")?.remaining) || 0;
        advanceStatuses(0.35);
        const supportExpired = !game.statusManager.hasStatus("player", "stun");

        return {
          playerSkillApplied,
          playerSkillRemaining,
          playerSkillExpired,
          hazardApplied,
          hazardRemaining,
          hazardExpired,
          supportApplied,
          supportRemaining,
          supportExpired
        };
      });

      assert.ok(stunResult, "expected stun regression result");
      assert.strictEqual(stunResult.playerSkillApplied, true, "player skill stun should apply");
      assert.ok(stunResult.playerSkillRemaining > 0, "player skill stun should have positive remaining duration");
      assert.strictEqual(stunResult.playerSkillExpired, true, "player skill stun should expire");
      assert.strictEqual(stunResult.hazardApplied, true, "hazard stun should apply");
      assert.ok(stunResult.hazardRemaining > 0, "hazard stun should have positive remaining duration");
      assert.strictEqual(stunResult.hazardExpired, true, "hazard stun should expire");
      assert.strictEqual(stunResult.supportApplied, true, "support projectile stun should apply");
      assert.ok(stunResult.supportRemaining > 0, "support projectile stun should have positive remaining duration");
      assert.strictEqual(stunResult.supportExpired, true, "support projectile stun should expire");
      assert.deepStrictEqual(pageErrors, [], `page errors detected:\n${pageErrors.join("\n\n")}`);
      assert.deepStrictEqual(consoleErrors, [], `console errors detected:\n${consoleErrors.join("\n\n")}`);
    } finally {
      await closeBrowserGameSession(session);
    }
  }, 60000);

  botIt("forest biome test map can be fully cleared and reports loot economy totals", async () => {
    const session = await startBrowserGameSession({ launch: "forestTestMap" });
    const { page, pageErrors, consoleErrors } = session;

    try {
      const report = await page.evaluate(() => {
        const game = window.currentGame;
        if (!game?.enemySystem || !game?.lootSystem) return null;

        const beforeXp = Number(game.xp) || 0;
        const beforeGold = Number(game.gold) || 0;
        const sourceStats = {
          enemy: { gold: 0, normal: 0, magic: 0, rare: 0, t1: 0, t2: 0, xpDropped: 0, directXp: 0 },
          searchable: { gold: 0, normal: 0, magic: 0, rare: 0, t1: 0, t2: 0, xpDropped: 0, directXp: 0 },
          breakable: { gold: 0, normal: 0, magic: 0, rare: 0, t1: 0, t2: 0, xpDropped: 0, directXp: 0 },
          chest_open: { gold: 0, normal: 0, magic: 0, rare: 0, t1: 0, t2: 0, xpDropped: 0, directXp: 0 }
        };
        const countedEnemyIds = new Set();
        let currentSource = "enemy";
        let isCollectingLoot = false;

        const classifyLootItem = (item, stats) => {
          if (!item || !stats) return;
          if (item.type === "Gold") {
            stats.gold += Number(item.goldAmount) || 0;
            return;
          }
          if (item.type === "XpOrb") {
            stats.xpDropped += Number(item.xpAmount) || 0;
            return;
          }
          if (item.type === "Cube") {
            if (/T1$/i.test(String(item.cubeKey || ""))) stats.t1 += 1;
            if (/T2$/i.test(String(item.cubeKey || ""))) stats.t2 += 1;
            return;
          }
          const rarity = String(item.rarity || "").toLowerCase();
          if (rarity === "rare") stats.rare += 1;
          else if (rarity === "magic") stats.magic += 1;
          else if (rarity === "common") stats.normal += 1;
        };

        const lootSystem = game.lootSystem;
        const wrapSpawn = (methodName) => {
          const original = lootSystem[methodName]?.bind(lootSystem);
          if (typeof original !== "function") return;
          lootSystem[methodName] = (...args) => {
            const beforeCount = lootSystem.items.length;
            const result = original(...args);
            const newItems = lootSystem.items.slice(beforeCount);
            for (const item of newItems) {
              item._botSource = currentSource;
            }
            return result;
          };
        };
        wrapSpawn("spawnGoldAt");
        wrapSpawn("spawnCubeAt");
        wrapSpawn("spawnEquipmentAt");
        wrapSpawn("spawnXpOrbAt");
        wrapSpawn("spawnAncestorSpiritAt");

        const originalGrantXp = typeof game.grantXP === "function" ? game.grantXP.bind(game) : null;
        if (originalGrantXp) {
          game.grantXP = (amount, ...args) => {
            if (!isCollectingLoot) {
              sourceStats[currentSource].directXp += Math.max(0, Number(amount) || 0);
            }
            return originalGrantXp(amount, ...args);
          };
        }

        const flushLoot = () => {
          const items = [...(game.lootSystem.items || [])];
          isCollectingLoot = true;
          for (const item of items) {
            const sourceKey = item?._botSource || currentSource;
            classifyLootItem(item, sourceStats[sourceKey]);
            game.handleLootPickup(item);
          }
          isCollectingLoot = false;
          game.lootSystem.items = [];
        };

        const recordEnemyKills = () => {
          const enemies = (game.enemySystem.enemies || []).filter((enemy) => enemy && !enemy.isDead && !countedEnemyIds.has(enemy.id));
          for (const enemy of enemies) {
            countedEnemyIds.add(enemy.id);
          }
          return enemies;
        };

        const killAllEnemies = () => {
          currentSource = "enemy";
          for (let cycle = 0; cycle < 12; cycle += 1) {
            for (let pass = 0; pass < 25; pass += 1) {
              const alive = recordEnemyKills();
              for (const enemy of alive) {
                const tier = String(enemy?.enemyTier || "").toLowerCase();
                if (tier === "miniboss") report.miniBossesKilled += 1;
                else if (tier === "elite") report.elitesKilled += 1;
                else report.minionsKilled += 1;
                if (enemy?.name === "GoblinKing" || enemy?.isSpecial || enemy?.enemyTier === "special" || enemy?.isUndeadHero) {
                  report.rareEnemiesKilled += 1;
                }
                game.dealDamageToEnemy(enemy, Math.max(99999, Number(enemy.health) + 9999), {
                  isSkill: true,
                  sourceType: "bot_test",
                  reason: "bot_map_clear",
                  skipModDebuffs: true,
                  noRingProcs: true
                });
              }
              const remaining = (game.enemySystem.enemies || []).filter((enemy) => enemy && !enemy.isDead).length;
              if (remaining === 0) break;
            }
            for (let step = 0; step < 30; step += 1) {
              game.update(0.016);
              if ((game.enemySystem.enemies || []).filter((enemy) => enemy && !enemy.isDead).length === 0) break;
            }
            currentSource = "enemy";
            const remaining = (game.enemySystem.enemies || []).filter((enemy) => enemy && !enemy.isDead).length;
            if (remaining === 0) break;
          }
          const survivors = (game.enemySystem.enemies || []).filter((enemy) => enemy && !enemy.isDead);
          for (const enemy of survivors) {
            enemy._undyingUsed = true;
            enemy.health = Math.min(Number(enemy.health) || 1, 1);
            game.dealDamageToEnemy(enemy, 99999, {
              isSkill: true,
              sourceType: "bot_test",
              reason: "bot_map_force_clear",
              skipModDebuffs: true,
              noRingProcs: true
            });
          }
          for (let step = 0; step < 10; step += 1) {
            game.update(0.016);
          }
        };

        const report = {
          remainingAlive: 0,
          minionsKilled: 0,
          elitesKilled: 0,
          miniBossesKilled: 0,
          rareEnemiesKilled: 0,
          searchablesSearched: 0,
          breakablesBroken: 0,
          enemyGoldDropped: 0,
          enemyNormalItemsDropped: 0,
          enemyMagicItemsDropped: 0,
          enemyRareItemsDropped: 0,
          enemyT1CubesDropped: 0,
          enemyT2CubesDropped: 0,
          enemyExperienceDropped: 0,
          chestOpenExperience: 0,
          searchableGoldDropped: 0,
          searchableNormalItemsDropped: 0,
          searchableMagicItemsDropped: 0,
          searchableRareItemsDropped: 0,
          searchableT1CubesDropped: 0,
          searchableT2CubesDropped: 0,
          searchableExperienceDropped: 0,
          searchableDirectExperience: 0,
          breakableGoldDropped: 0,
          breakableNormalItemsDropped: 0,
          breakableMagicItemsDropped: 0,
          breakableRareItemsDropped: 0,
          breakableT1CubesDropped: 0,
          breakableT2CubesDropped: 0,
          breakableExperienceDropped: 0,
          breakableDirectExperience: 0,
          experienceGained: 0,
          goldGained: 0
        };

        killAllEnemies();
        flushLoot();

        currentSource = "searchable";
        const unopenedSearchables = (game.searchableProps || []).filter((prop) => prop && !prop.isSearched);
        report.searchablesSearched = unopenedSearchables.length;
        for (const prop of unopenedSearchables) {
          if (typeof prop.finishSearch === "function") {
            prop.finishSearch(game);
          } else if (typeof prop.spawnLoot === "function") {
            prop.isSearched = true;
            prop.spawnLoot(game);
          }
        }
        flushLoot();
        killAllEnemies();
        flushLoot();

        currentSource = "breakable";
        const breakables = (game.breakables || []).filter((breakable) => breakable && !breakable.isDead);
        report.breakablesBroken = breakables.length;
        for (const breakable of breakables) {
          game.dealDamageToBreakable(breakable, 99999, {
            sourceType: "bot_test",
            reason: "bot_breakables_clear"
          });
        }
        for (let step = 0; step < 10; step += 1) {
          game.update(0.016);
        }
        flushLoot();
        killAllEnemies();
        flushLoot();

        report.remainingAlive = (game.enemySystem.enemies || []).filter((enemy) => enemy && !enemy.isDead).length;
        report.remainingAliveDetails = (game.enemySystem.enemies || [])
          .filter((enemy) => enemy && !enemy.isDead)
          .map((enemy) => ({
            id: enemy.id,
            name: enemy.name,
            tier: enemy.enemyTier,
            health: enemy.health
          }));
        report.enemyGoldDropped = sourceStats.enemy.gold;
        report.enemyNormalItemsDropped = sourceStats.enemy.normal;
        report.enemyMagicItemsDropped = sourceStats.enemy.magic;
        report.enemyRareItemsDropped = sourceStats.enemy.rare;
        report.enemyT1CubesDropped = sourceStats.enemy.t1;
        report.enemyT2CubesDropped = sourceStats.enemy.t2;
        report.enemyExperienceDropped = sourceStats.enemy.xpDropped;
        report.chestOpenExperience = sourceStats.chest_open.directXp + sourceStats.chest_open.xpDropped;
        report.searchableGoldDropped = sourceStats.searchable.gold;
        report.searchableNormalItemsDropped = sourceStats.searchable.normal;
        report.searchableMagicItemsDropped = sourceStats.searchable.magic;
        report.searchableRareItemsDropped = sourceStats.searchable.rare;
        report.searchableT1CubesDropped = sourceStats.searchable.t1;
        report.searchableT2CubesDropped = sourceStats.searchable.t2;
        report.searchableExperienceDropped = sourceStats.searchable.xpDropped;
        report.searchableDirectExperience = sourceStats.searchable.directXp;
        report.breakableGoldDropped = sourceStats.breakable.gold;
        report.breakableNormalItemsDropped = sourceStats.breakable.normal;
        report.breakableMagicItemsDropped = sourceStats.breakable.magic;
        report.breakableRareItemsDropped = sourceStats.breakable.rare;
        report.breakableT1CubesDropped = sourceStats.breakable.t1;
        report.breakableT2CubesDropped = sourceStats.breakable.t2;
        report.breakableExperienceDropped = sourceStats.breakable.xpDropped;
        report.breakableDirectExperience = sourceStats.breakable.directXp;

        report.totalGoldDropped = sourceStats.enemy.gold + sourceStats.searchable.gold + sourceStats.breakable.gold + sourceStats.chest_open.gold;
        report.totalExperienceDropped = sourceStats.enemy.xpDropped + sourceStats.searchable.xpDropped + sourceStats.breakable.xpDropped + sourceStats.chest_open.xpDropped;
        report.totalNormalItemsDropped = sourceStats.enemy.normal + sourceStats.searchable.normal + sourceStats.breakable.normal + sourceStats.chest_open.normal;
        report.totalMagicItemsDropped = sourceStats.enemy.magic + sourceStats.searchable.magic + sourceStats.breakable.magic + sourceStats.chest_open.magic;
        report.totalRareItemsDropped = sourceStats.enemy.rare + sourceStats.searchable.rare + sourceStats.breakable.rare + sourceStats.chest_open.rare;
        report.totalT1CubesDropped = sourceStats.enemy.t1 + sourceStats.searchable.t1 + sourceStats.breakable.t1 + sourceStats.chest_open.t1;
        report.totalT2CubesDropped = sourceStats.enemy.t2 + sourceStats.searchable.t2 + sourceStats.breakable.t2 + sourceStats.chest_open.t2;
        report.experienceGained = (Number(game.xp) || 0) - beforeXp;
        report.goldGained = (Number(game.gold) || 0) - beforeGold;
        return report;
      });

      assert.ok(report, "expected a map clear report");
      console.log("[Forest Test Map Clear Report]", JSON.stringify(report));
      assert.strictEqual(report.remainingAlive, 0, "map-clear bot should kill all enemies on the forest test map");
      assert.strictEqual(report.goldGained, report.totalGoldDropped, "gold gained should match total dropped gold after collection");
      assert.strictEqual(
        report.experienceGained,
        report.totalExperienceDropped + report.chestOpenExperience + report.searchableDirectExperience + report.breakableDirectExperience,
        "xp gained should match dropped xp plus direct searchable/breakable/chest xp after collection"
      );
      assert.deepStrictEqual(pageErrors, [], `page errors detected:\n${pageErrors.join("\n\n")}`);
      assert.deepStrictEqual(consoleErrors, [], `console errors detected:\n${consoleErrors.join("\n\n")}`);
    } finally {
      await closeBrowserGameSession(session);
    }
  }, 60000);
});
