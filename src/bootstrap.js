// -------- Application Bootstrap --------
// Entry point for the application

import { renderHallOfChampions } from './ui/hall-of-champions.js';
import {
  refreshMainMenuLP, openInstructions, closeInstructions,
  openOptions, closeOptions, applyResolutionPreset, initOptionsSettings
} from './ui/main-menu.js';
import {
  openLegacyVault, closeLegacyVault, getSelectedLegacyItems, deleteLegacySelectedItems
} from './ui/legacy-vault.js';
import {
  openSkillLibrary, closeSkillLibrary
} from './ui/skill-library.js';
import {
  openTalentTree, closeTalentTree
} from './ui/talent-tree-ui.js';
import {
  openFriends, closeFriends
} from './ui/friends-ui.js';
import {
  showPreRunScreen, setPreRunDifficulty, rerollPreRunConditions,
  acceptPreRunAndStart, confirmSkillSelectAndStart,
  setStartGameCallback
} from './ui/pre-run.js';
import { installPillarSystem } from './game/game-pillar.js';
import {
  initializePillarDebugTools,
  initializePillarUI,
  openPillarSystemOverlay
} from './ui/pillar-ui.js';
import { addLegacyPoints } from './data/constants.js';
import { Game } from './game/game.js';
import { initFriendsState } from './systems/friends-system.js';
import { setBgmVolume, startBgm, stopBgm } from './audio.js';

let currentGame = null;
let menuPillarGame = null;

function ensureMenuPillarGame() {
  if (menuPillarGame) {
    return menuPillarGame;
  }
  menuPillarGame = {};
  installPillarSystem(menuPillarGame);
  initializePillarUI(menuPillarGame, { showFloatingButton: false });
  return menuPillarGame;
}

function startGame(legacyItems = [], runConfig = {}) {
  const canvas = document.getElementById("game-canvas");
  if (!canvas) {
    console.error("Game canvas not found");
    return;
  }
  if (currentGame && typeof currentGame.destroy === "function") {
    currentGame.destroy();
  }
  canvas.width = 640;
  canvas.height = 360;
  currentGame = new Game(canvas, legacyItems, runConfig);
  installPillarSystem(currentGame);
  initializePillarUI(currentGame, { showFloatingButton: false });
  initializePillarDebugTools(currentGame);
  window.currentGame = currentGame;
  window.debugSkillTags = (skillId, modifier = null) => {
    if (!currentGame) return null;
    const extra = modifier ? [modifier] : [];
    return currentGame.debugLogSkillMultipliers(skillId, extra);
  };
  window.runSkillTagDebugHarness = () => currentGame?.runSkillTagDebugHarness();
  window.grantSpirit = (defId) => currentGame?.grantSpirit(defId);
  window.grantVesselCube = () => currentGame?.grantVesselCube();
  window.printActiveSpiritsAndClans = () => currentGame?.printActiveSpiritsAndClans();
  window.grantAllPillarProofs = () => currentGame?.grantAllPillarProofs();
  window.grantPillarTrialItem = (count = 1) => currentGame?.grantPillarTrialEntryItem(count);
  window.clearPillarAllocations = () => currentGame?.clearPillarAllocations();
  window.clearPillarProofs = () => currentGame?.clearPillarProofs();
  window.grantPillarProof = (proofId) => currentGame?.grantPillarProof(proofId);
  window.refreshPillarRuntime = () => currentGame?.refreshPillarRuntimeState('debug_window_refresh');
  window.printPillarRuntime = () => currentGame?.debugPrintPillarRuntimeSummary();
  window.simulatePillarTrialSuccess = (pillarId) => currentGame?.simulatePillarTrialSuccess(pillarId);
  window.simulatePillarTrialFailure = (pillarId) => currentGame?.simulatePillarTrialFailure(pillarId);
  setBgmVolume(0.15);
  startBgm();
}

function bootstrap() {
  stopBgm();
  const mainMenu = document.getElementById("main-menu");
  const gameRoot = document.querySelector(".game-root");

  if (mainMenu && gameRoot) {
    const initialPillarContext = ensureMenuPillarGame();
    initializePillarUI(initialPillarContext, { showFloatingButton: false });
    initOptionsSettings();
    mainMenu.classList.remove("hidden");
    gameRoot.classList.add("hidden");
    const pauseBtn = document.getElementById("pause-toggle");
    const devBtn = document.getElementById("dev-toggle");
    const invBtn = document.getElementById("inventory-button");
    if (pauseBtn) pauseBtn.classList.add("hidden");
    if (devBtn) devBtn.classList.add("hidden");
    if (invBtn) invBtn.classList.add("hidden");
    const bossBar = document.getElementById("boss-health-bar");
    if (bossBar) bossBar.classList.add("hidden");
    renderHallOfChampions();

    const newGameBtn = document.getElementById("main-menu-new-game");
    if (newGameBtn) {
      newGameBtn.addEventListener("click", () => showPreRunScreen([]));
    }

    const tutorialBtn = document.getElementById("main-menu-tutorial");
    if (tutorialBtn) {
      tutorialBtn.addEventListener("click", () => {
        document.getElementById("main-menu").classList.add("hidden");
        const gameRoot = document.querySelector(".game-root");
        if (gameRoot) gameRoot.classList.remove("hidden");
        document.getElementById("pause-toggle")?.classList.add("hidden");
        document.getElementById("dev-toggle")?.classList.add("hidden");
        startGame([], { 
          difficulty: 1, 
          conditions: [], 
          tutorial: true,
          skills: ["fireball", "rapidFire", "groundSlam", "healPulse"]
        });
      });
    }

    const devModeBtn = document.getElementById("main-menu-dev-mode");
    if (devModeBtn) {
      devModeBtn.addEventListener("click", () => {
        document.getElementById("main-menu").classList.add("hidden");
        const gameRoot = document.querySelector(".game-root");
        if (gameRoot) gameRoot.classList.remove("hidden");
        document.getElementById("pause-toggle")?.classList.remove("hidden");
        document.getElementById("dev-toggle")?.classList.remove("hidden");
        document.getElementById("inventory-button")?.classList.remove("hidden");
        startGame([], { difficulty: 1, conditions: [], devMode: true });
      });
    }

    const legacyVaultBtn = document.getElementById("main-menu-legacy-vault");
    if (legacyVaultBtn) {
      legacyVaultBtn.addEventListener("click", openLegacyVault);
    }

    const talentTreeBtn = document.getElementById("main-menu-talent-tree");
    if (talentTreeBtn) {
      talentTreeBtn.addEventListener("click", openTalentTree);
    }

    const devAddLpBtn = document.getElementById("main-menu-dev-add-lp");
    const devLpAmountEl = document.getElementById("main-menu-dev-lp-amount");
    if (devAddLpBtn && devLpAmountEl) {
      devAddLpBtn.addEventListener("click", () => {
        const amount = parseInt(devLpAmountEl.value, 10) || 0;
        if (amount > 0) {
          addLegacyPoints(amount);
          refreshMainMenuLP();
        }
      });
    }

    const talentTreeCloseBtn = document.getElementById("talent-tree-close");
    if (talentTreeCloseBtn) {
      talentTreeCloseBtn.addEventListener("click", closeTalentTree);
    }

    refreshMainMenuLP();

    const legacyCloseBtn = document.getElementById("legacy-vault-close");
    if (legacyCloseBtn) {
      legacyCloseBtn.addEventListener("click", closeLegacyVault);
    }

    const skillLibraryBtn = document.getElementById("main-menu-skill-library");
    if (skillLibraryBtn) {
      skillLibraryBtn.addEventListener("click", openSkillLibrary);
    }
    const skillLibraryCloseBtn = document.getElementById("skill-library-close");
    if (skillLibraryCloseBtn) {
      skillLibraryCloseBtn.addEventListener("click", closeSkillLibrary);
    }

    // Initialize friends system
    initFriendsState();
    
    // Set up inventory API for friends system (will be set when game starts)
    // The API will be provided by Game instance when it's created

    const friendsBtn = document.getElementById("main-menu-friends");
    if (friendsBtn) {
      friendsBtn.addEventListener("click", openFriends);
    }

    const pillarBtn = document.getElementById("main-menu-pillars");
    if (pillarBtn) {
      pillarBtn.addEventListener("click", () => {
        const contextGame = currentGame || ensureMenuPillarGame();
        initializePillarUI(contextGame, { showFloatingButton: false });
        openPillarSystemOverlay();
      });
    }

    const instructionsBtn = document.getElementById("main-menu-instructions");
    if (instructionsBtn) {
      instructionsBtn.addEventListener("click", openInstructions);
    }
    const instructionsCloseBtn = document.getElementById("instructions-close");
    if (instructionsCloseBtn) {
      instructionsCloseBtn.addEventListener("click", closeInstructions);
    }

    const optionsBtn = document.getElementById("main-menu-options");
    if (optionsBtn) {
      optionsBtn.addEventListener("click", openOptions);
    }
    const optionsCloseBtn = document.getElementById("options-close");
    if (optionsCloseBtn) {
      optionsCloseBtn.addEventListener("click", closeOptions);
    }
    document.querySelectorAll(".options-resolution-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const presetId = btn.dataset.resolution;
        if (presetId) applyResolutionPreset(presetId);
      });
    });

    const legacyDeleteBtn = document.getElementById("legacy-delete-selected");
    if (legacyDeleteBtn) {
      legacyDeleteBtn.addEventListener("click", deleteLegacySelectedItems);
    }

    const legacyStartBtn = document.getElementById("legacy-start-run");
    if (legacyStartBtn) {
      legacyStartBtn.addEventListener("click", () => {
        // Check if we're in gift mode - if so, don't proceed
        import('./ui/legacy-vault-gift.js').then(m => {
          if (m.isGiftMode && m.isGiftMode()) {
            return; // Don't open pre-run screen in gift mode
          }
          const items = getSelectedLegacyItems();
          closeLegacyVault(false);
          showPreRunScreen(items);
        }).catch(() => {
          // Fallback if gift module not available
          const items = getSelectedLegacyItems();
          closeLegacyVault(false);
          showPreRunScreen(items);
        });
      });
    }

    // Set up startGame callback for pre-run screen
    setStartGameCallback(startGame);

    document.querySelectorAll(".pre-run-diff-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        setPreRunDifficulty(Number(btn.dataset.diff));
      });
    });

    const preRunReroll = document.getElementById("pre-run-reroll");
    if (preRunReroll) {
      preRunReroll.addEventListener("click", () => {
        rerollPreRunConditions();
      });
    }

    const preRunAccept = document.getElementById("pre-run-accept");
    if (preRunAccept) {
      preRunAccept.addEventListener("click", acceptPreRunAndStart);
    }

    const skillSelectConfirm = document.getElementById("skill-select-confirm");
    if (skillSelectConfirm) {
      skillSelectConfirm.addEventListener("click", confirmSkillSelectAndStart);
    }
    const skillSelectBack = document.getElementById("skill-select-back");
    if (skillSelectBack) {
      skillSelectBack.addEventListener("click", () => {
        document.getElementById("skill-select-overlay").classList.add("hidden");
        document.getElementById("pre-run-overlay").classList.remove("hidden");
      });
    }

    const preRunBack = document.getElementById("pre-run-back");
    if (preRunBack) {
      preRunBack.addEventListener("click", () => {
        stopBgm();
        document.getElementById("pre-run-overlay").classList.add("hidden");
        document.getElementById("main-menu").classList.remove("hidden");
      });
    }
  } else {
    startGame([], { difficulty: 1, conditions: [] });
  }
}

window.addEventListener("DOMContentLoaded", bootstrap);

