// -------- Tutorial System --------

import { Enemy } from '../entities/enemy.js';
import { ENEMY_TYPES } from '../entities/enemy.js';

export const TUTORIAL_STEPS = [
  {
    id: 1,
    title: "Movement",
    message: "Use WASD or Arrow Keys to move",
    highlight: "player",
    action: "move",
    completed: false,
    requiredDistance: 600
  },
  {
    id: 2,
    title: "Dash",
    message: "Press SPACE to dash and avoid damage",
    highlight: "spaceKey",
    action: "dash",
    completed: false,
    requiredDashes: 3
  },
  {
    id: 3,
    title: "Basic Combat",
    message: "Click to attack enemies",
    highlight: "enemy",
    action: "killEnemy",
    completed: false
  },
  {
    id: 4,
    title: "Loot Collection",
    message: "Collect items that drop from enemies",
    highlight: "loot",
    action: "collectLoot",
    completed: false
  },
  {
    id: 5,
    title: "Inventory",
    message: "Press I to open inventory and equip items",
    highlight: "inventoryButton",
    action: "openInventory",
    completed: false
  },
  {
    id: 6,
    title: "Skills",
    message: "Press 1-4 to use skills",
    highlight: "skillSlots",
    action: "useSkill",
    completed: false
  },
  {
    id: 7,
    title: "Map Navigation",
    message: "Find the exit to move to the next map",
    highlight: "exit",
    action: "reachExit",
    completed: false
  },
  {
    id: 8,
    title: "Boss Battle",
    message: "Find and kill the boss",
    highlight: "boss",
    action: "killBoss",
    completed: false
  }
];

export class TutorialSystem {
  constructor(game) {
    this.game = game;
    this.currentStep = 0;
    this.steps = TUTORIAL_STEPS.map(s => ({ ...s, completed: false }));
    this.active = false;
    this.highlightElement = null;
    this.stepStartTime = 0;
    
    // Track actions for completion
    this.playerMoved = false;
    this.distanceMoved = 0;
    this.lastPlayerPosition = null;
    this.enemiesKilled = 0;
    this.dashUsed = false;
    this.dashCount = 0;
    this.lootCollected = false;
    this.inventoryOpened = false;
    this.skillUsed = false;
    this.reachedExit = false;
    this.bossKilled = false;
    
    // Store initial state
    this.initialEnemyCount = 0;
  }

  start() {
    this.active = true;
    this.currentStep = 0;
    this.stepStartTime = this.game.time;
    this.showTutorialOverlay();
    this.showCurrentStep();
  }

  showTutorialOverlay() {
    const overlay = document.getElementById("tutorial-overlay");
    if (overlay) {
      overlay.classList.remove("hidden");
    }
  }

  hideTutorialOverlay() {
    const overlay = document.getElementById("tutorial-overlay");
    if (overlay) {
      overlay.classList.add("hidden");
    }
  }

  showCurrentStep() {
    if (this.currentStep >= this.steps.length) {
      this.complete();
      return;
    }

    const step = this.steps[this.currentStep];
    const titleEl = document.getElementById("tutorial-title");
    const messageEl = document.getElementById("tutorial-message");
    const stepIndicatorEl = document.getElementById("tutorial-step-indicator");
    const skipBtn = document.getElementById("tutorial-skip");

    if (titleEl) titleEl.textContent = step.title;
    if (stepIndicatorEl) stepIndicatorEl.textContent = `Step ${step.id} of ${this.steps.length}`;
    
    // Reset action tracking for this step
    this.resetStepTracking();
    
    // Setup highlighting
    this.setupHighlight(step);
    
    // Store initial state for this step
    if (step.id === 1) {
      // Initialize position tracking for movement step
      if (this.game.player) {
        this.lastPlayerPosition = {
          x: this.game.player.position.x,
          y: this.game.player.position.y
        };
      }
    }
    if (step.id === 3) {
      // Count enemies for combat step
      this.initialEnemyCount = this.game.enemySystem?.enemies?.length || 0;
    }
    
    // Update message with progress (this will set the initial message)
    this.updateTutorialMessage();
  }
  
  updateTutorialMessage() {
    const step = this.steps[this.currentStep];
    if (!step) return;
    
    const messageEl = document.getElementById("tutorial-message");
    if (!messageEl) return;
    
    let message = step.message;
    
    // Add progress information
    if (step.action === "move" && step.requiredDistance) {
      const remaining = Math.max(0, step.requiredDistance - this.distanceMoved);
      message += ` (${Math.ceil(remaining)} distance left)`;
    } else if (step.action === "dash" && step.requiredDashes) {
      const remaining = Math.max(0, step.requiredDashes - this.dashCount);
      message += ` (${remaining} dash${remaining !== 1 ? 'es' : ''} left)`;
    }
    
    messageEl.textContent = message;
  }

  resetStepTracking() {
    this.playerMoved = false;
    this.distanceMoved = 0;
    this.lastPlayerPosition = null;
    this.enemiesKilled = 0;
    this.dashUsed = false;
    this.dashCount = 0;
    this.lootCollected = false;
    this.inventoryOpened = false;
    this.inventoryOpenedThisStep = false;
    this.skillUsed = false;
    this.reachedExit = false;
    this.bossKilled = false;
  }

  setupHighlight(step) {
    // Remove previous highlight
    if (this.highlightElement) {
      this.highlightElement.classList.remove("tutorial-highlight");
      this.highlightElement = null;
    }

    // Add highlight based on step type
    switch (step.highlight) {
      case "player":
        // Player is highlighted via canvas overlay
        break;
      case "enemy":
        // Enemy highlighting done in render
        break;
      case "spaceKey":
        // Show space key indicator
        const spaceIndicator = document.getElementById("tutorial-space-indicator");
        if (spaceIndicator) spaceIndicator.classList.remove("hidden");
        break;
      case "inventoryButton":
        const invBtn = document.getElementById("inventory-button");
        if (invBtn) {
          invBtn.classList.add("tutorial-highlight");
          this.highlightElement = invBtn;
        }
        break;
      case "xpBar":
        const xpBar = document.getElementById("xp-bar");
        if (xpBar) {
          xpBar.classList.add("tutorial-highlight");
          this.highlightElement = xpBar;
        }
        break;
      case "skillSlots":
        const skillBar = document.getElementById("skill-bar");
        if (skillBar) {
          skillBar.classList.add("tutorial-highlight");
          this.highlightElement = skillBar;
        }
        break;
      case "exit":
        // Exit highlighting done in render
        break;
      case "loot":
        // Loot highlighting done in render
        break;
      case "boss":
        // Boss highlighting done in render
        break;
    }
  }

  update(dt) {
    if (!this.active) return;

    const step = this.steps[this.currentStep];
    if (!step) return;

    // Track movement distance for step 1
    if (step.action === "move" && this.game.player && this.lastPlayerPosition) {
      const dx = this.game.player.position.x - this.lastPlayerPosition.x;
      const dy = this.game.player.position.y - this.lastPlayerPosition.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      this.distanceMoved += distance;
      this.lastPlayerPosition = {
        x: this.game.player.position.x,
        y: this.game.player.position.y
      };
      
      // Update message with progress
      this.updateTutorialMessage();
    }

    // Check if current step is completed
    if (this.checkStepComplete(step)) {
      this.completeCurrentStep();
    }
  }

  checkStepComplete(step) {
    switch (step.action) {
      case "move":
        if (step.requiredDistance) {
          return this.distanceMoved >= step.requiredDistance;
        }
        return this.playerMoved;
      case "killEnemy":
        const currentEnemyCount = this.game.enemySystem?.enemies?.length || 0;
        return currentEnemyCount < this.initialEnemyCount;
      case "dash":
        if (step.requiredDashes) {
          return this.dashCount >= step.requiredDashes;
        }
        return this.dashUsed;
      case "collectLoot":
        return this.lootCollected;
      case "openInventory":
        return this.inventoryOpened;
      case "useSkill":
        return this.skillUsed;
      case "reachExit":
        return this.reachedExit;
      case "killBoss":
        return this.bossKilled || (this.game.enemySystem?.boss?.isDead === true);
      default:
        return false;
    }
  }

  completeCurrentStep() {
    const step = this.steps[this.currentStep];
    step.completed = true;

    // Spawn enemy after step 2 (Dash) completes
    if (step.id === 2 && this.game.player && this.game.enemySystem) {
      const playerX = this.game.player.position.x;
      const playerY = this.game.player.position.y;
      const enemyX = playerX + 400;
      const enemyY = playerY;
      
      const baseEnemy = ENEMY_TYPES[0]; // Get first enemy type
      const tutorialEnemy = new Enemy(enemyX, enemyY, {
        ...baseEnemy,
        maxHealth: 20, // Weak enemy for tutorial
        attack: baseEnemy.attack * 0.5,
        speed: baseEnemy.speed * 0.7,
        size: baseEnemy.size
      });
      tutorialEnemy.worldBounds = { 
        width: this.game.world.width, 
        height: this.game.world.height 
      };
      tutorialEnemy.enemyTier = "minion";
      tutorialEnemy.tierXpMult = 0.7;
      tutorialEnemy.activated = true; // Start activated so player can fight it
      this.game.enemySystem.enemies.push(tutorialEnemy);
    }

    // Remove highlight
    if (this.highlightElement) {
      this.highlightElement.classList.remove("tutorial-highlight");
      this.highlightElement = null;
    }

    // Hide space indicator if it was shown
    const spaceIndicator = document.getElementById("tutorial-space-indicator");
    if (spaceIndicator) spaceIndicator.classList.add("hidden");

    // Move to next step
    this.currentStep++;
    if (this.currentStep < this.steps.length) {
      this.stepStartTime = this.game.time;
      this.showCurrentStep();
    } else {
      this.complete();
    }
  }

  complete() {
    this.active = false;
    this.hideTutorialOverlay();
    
    // Remove all highlights
    if (this.highlightElement) {
      this.highlightElement.classList.remove("tutorial-highlight");
    }
    
    const spaceIndicator = document.getElementById("tutorial-space-indicator");
    if (spaceIndicator) spaceIndicator.classList.add("hidden");

    // Show completion message
    this.game.showNotification(
      "Tutorial Complete!",
      "You've learned the basics. Good luck on your adventure!"
    );
  }

  skip() {
    this.complete();
  }

  // Called from game to track player actions
  onPlayerMove() {
    if (this.active && this.steps[this.currentStep]?.action === "move") {
      this.playerMoved = true;
      // Distance tracking is handled in update() method
    }
  }

  onEnemyKilled() {
    if (this.active && this.steps[this.currentStep]?.action === "killEnemy") {
      // Step will complete when enemy count decreases
    }
  }

  onDash() {
    if (this.active && this.steps[this.currentStep]?.action === "dash") {
      this.dashUsed = true;
      this.dashCount++;
      // Update message with progress
      this.updateTutorialMessage();
    }
  }

  onLootCollected() {
    if (this.active && this.steps[this.currentStep]?.action === "collectLoot") {
      this.lootCollected = true;
    }
  }

  onInventoryOpened() {
    if (this.active && this.steps[this.currentStep]?.action === "openInventory") {
      this.inventoryOpened = true;
    }
  }


  onSkillUsed() {
    if (this.active && this.steps[this.currentStep]?.action === "useSkill") {
      this.skillUsed = true;
    }
  }

  onReachExit() {
    if (this.active && this.steps[this.currentStep]?.action === "reachExit") {
      this.reachedExit = true;
    }
  }

  onBossKilled() {
    if (this.active && this.steps[this.currentStep]?.action === "killBoss") {
      this.bossKilled = true;
    }
  }

  render(ctx, camera) {
    if (!this.active) return;

    const step = this.steps[this.currentStep];
    if (!step) return;

    // Draw highlight effects on canvas
    ctx.save();
    
    if (step.highlight === "player" && this.game.player) {
      // Highlight player with pulsing circle
      const px = this.game.player.position.x - camera.position.x;
      const py = this.game.player.position.y - camera.position.y;
      const pulse = 0.5 + Math.sin(this.game.time * 4) * 0.3;
      
      ctx.strokeStyle = `rgba(251, 191, 36, ${pulse})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(px + this.game.player.size / 2, py + this.game.player.size / 2, this.game.player.size * 0.8, 0, Math.PI * 2);
      ctx.stroke();
    }

    if (step.highlight === "enemy" && this.game.enemySystem?.enemies?.length > 0) {
      // Highlight nearest enemy
      const enemy = this.game.enemySystem.enemies[0];
      const ex = enemy.position.x - camera.position.x;
      const ey = enemy.position.y - camera.position.y;
      const pulse = 0.5 + Math.sin(this.game.time * 4) * 0.3;
      
      ctx.strokeStyle = `rgba(239, 68, 68, ${pulse})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(ex + enemy.size / 2, ey + enemy.size / 2, enemy.size * 0.8, 0, Math.PI * 2);
      ctx.stroke();
    }

    if (step.highlight === "loot" && this.game.lootSystem?.items?.length > 0) {
      // Highlight nearest loot
      const loot = this.game.lootSystem.items[0];
      const lx = loot.position.x - camera.position.x;
      const ly = loot.position.y - camera.position.y;
      const pulse = 0.5 + Math.sin(this.game.time * 4) * 0.3;
      
      ctx.strokeStyle = `rgba(34, 197, 94, ${pulse})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(lx + loot.size / 2, ly + loot.size / 2, loot.size * 0.8, 0, Math.PI * 2);
      ctx.stroke();
    }

    if (step.highlight === "exit" && this.game.currentMap?.exits) {
      // Highlight exit
      const exit = this.game.currentMap.exits[0];
      const ex = exit.x - camera.position.x;
      const ey = exit.y - camera.position.y;
      const pulse = 0.5 + Math.sin(this.game.time * 4) * 0.3;
      
      ctx.strokeStyle = `rgba(139, 92, 246, ${pulse})`;
      ctx.lineWidth = 4;
      ctx.strokeRect(ex, ey, exit.w, exit.h);
    }

    if (step.highlight === "boss" && this.game.enemySystem?.boss && !this.game.enemySystem.boss.isDead) {
      // Highlight boss
      const boss = this.game.enemySystem.boss;
      const bx = boss.position.x - camera.position.x;
      const by = boss.position.y - camera.position.y;
      const pulse = 0.5 + Math.sin(this.game.time * 4) * 0.3;
      
      ctx.strokeStyle = `rgba(220, 38, 38, ${pulse})`;
      ctx.lineWidth = 5;
      ctx.strokeRect(bx - 10, by - 10, boss.size + 20, boss.size + 20);
    }

    ctx.restore();
  }
}
