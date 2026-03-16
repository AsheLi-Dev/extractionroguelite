// -------- Application Bootstrap --------
// Entry point for the application

import {
  refreshMainMenuLP, openInstructions, closeInstructions,
  openOptions, closeOptions, applyResolutionPreset, initOptionsSettings,
  giveAllCharacters999Crystals
} from "./ui/main-menu.js";
import {
  APP_TITLE,
  APP_SUBTITLE,
  SHOW_DEV_CONTROLS,
  SHOW_DEV_MENU
} from "./data/constants.js";
import {
  openLegacyVault, closeLegacyVault, openLegacyVaultForIronsmith, getSelectedLegacyItems, deleteLegacySelectedItems
} from "./ui/legacy-vault.js";
import {
  openSkillLibrary, closeSkillLibrary
} from "./ui/skill-library.js";
import { closeTalentTree, openTalentTree } from "./ui/talent-tree-ui.js";
import {
  openFriends, closeFriends
} from "./ui/friends-ui.js";
import {
  showPreRunScreen, setPreRunDifficulty, rerollPreRunConditions,
  acceptPreRunAndStart, confirmSkillSelectAndStart, clearSkillSelectUpgrades,
  setStartGameCallback,
  setPendingDevMode, getSkillSelectBackTarget,
  setPreRunStateForDevMode, renderPreRunScreen
} from "./ui/pre-run.js";
import { showSelectHeroScreen, hideSelectHeroScreen, setSelectHeroBackTarget } from "./ui/select-hero.js";
import { installPillarSystem } from "./game/game-pillar.js";
import {
  initializePillarDebugTools,
  initializePillarUI,
  openPillarSystemOverlay,
  closePillarSystemOverlay
} from "./ui/pillar-ui.js";
import { Game } from "./game/game.js";
import { initFriendsState } from "./systems/friends-system.js";
import { setBgmVolume, startBgm, stopBgm } from "./audio.js";
import { HomeBaseScene } from "./home-base/home-base-scene.js";
import { getSelectedLureIds } from "./home-base/lure-state.js";
import { ScreenFade } from "./ui/screen-fade.js";
import { installRiteOfFear } from "./rites/rite-of-fear.js";
import { installRiteOfMonstrosity } from "./rites/rite-of-monstrosity.js";
import { installRiteOfTorment } from "./rites/rite-of-torment.js";
import { installRiteOfSovereign } from "./rites/rite-of-sovereign.js";
import { DEFAULT_PLAYABLE_CHARACTER_ID } from "./data/playable-characters.js";

let currentGame = null;
let menuPillarGame = null;
let homeBaseScene = null;
let preRunSource = "menu";
let screenFade = null;
let sceneTransitionQueue = Promise.resolve();

function ensureMenuPillarGame() {
  if (menuPillarGame) {
    return menuPillarGame;
  }
  menuPillarGame = {};
  installPillarSystem(menuPillarGame);
  menuPillarGame.requestStartRiteRun = (riteId) => {
    startRiteRun(riteId);
  };
  initializePillarUI(menuPillarGame, { showFloatingButton: false });
  return menuPillarGame;
}

function ensureScreenFade() {
  if (!screenFade) {
    screenFade = new ScreenFade();
  }
  return screenFade;
}

function queueSceneTransition(task, options = {}) {
  const fade = ensureScreenFade();
  const outDurationMs = Number(options.outDurationMs) || 130;
  const inDurationMs = Number(options.inDurationMs) || 170;
  sceneTransitionQueue = sceneTransitionQueue
    .catch(() => {})
    .then(() => fade.transition(task, { outDurationMs, inDurationMs }))
    .catch((error) => {
      console.error("Scene transition failed", error);
    });
  return sceneTransitionQueue;
}

function setRunHudVisibility(visible) {
  const ids = [
    "pause-toggle",
    "mod-screen-button",
    "inventory-button",
    "build-log-toggle"
  ];
  if (SHOW_DEV_CONTROLS) ids.push("dev-toggle");
  for (const id of ids) {
    const el = document.getElementById(id);
    if (!el) continue;
    el.classList.toggle("hidden", !visible);
  }
  if (!visible) {
    document.getElementById("build-log-panel")?.classList.add("hidden");
  }
}

function closeRunSetupOverlays() {
  document.getElementById("pre-run-overlay")?.classList.add("hidden");
  document.getElementById("skill-select-overlay")?.classList.add("hidden");
}

function hideRunOverlays() {
  document.getElementById("game-over")?.classList.add("hidden");
  document.getElementById("victory-overlay")?.classList.add("hidden");
  document.getElementById("level-up-overlay")?.classList.add("hidden");
  document.getElementById("event-overlay")?.classList.add("hidden");
  document.getElementById("shrine-overlay")?.classList.add("hidden");
  document.getElementById("notification-overlay")?.classList.add("hidden");
  document.getElementById("inventory-overlay")?.classList.add("hidden");
  document.getElementById("boss-health-bar")?.classList.add("hidden");
  document.getElementById("victory-portal-countdown")?.classList.add("hidden");
}

function openPreRunFrom(source, legacyItems = [], options = {}) {
  preRunSource = source;
  showPreRunScreen(legacyItems, {
    selectedLureIds: Array.isArray(options?.selectedLureIds) ? options.selectedLureIds : []
  });
}

function leaveHomeBaseForRun() {
  document.body.classList.remove("home-base-active");
  closePillarSystemOverlay();
  if (homeBaseScene) {
    homeBaseScene.stop();
  }
}

function openLegacyMenuFromHubImmediate() {
  stopBgm();
  closeRunSetupOverlays();
  hideRunOverlays();
  closePillarSystemOverlay();
  if (homeBaseScene) {
    homeBaseScene.stop();
  }
  document.body.classList.remove("home-base-active");
  setRunHudVisibility(false);
  document.getElementById("main-menu")?.classList.remove("hidden");
  document.querySelector(".game-root")?.classList.add("hidden");
  refreshMainMenuLP();
}

function openLegacyMenuFromHub() {
  void queueSceneTransition(() => {
    openLegacyMenuFromHubImmediate();
  }, { outDurationMs: 100, inDurationMs: 130 });
}

function enterHomeBaseImmediate() {
  stopBgm();
  closeRunSetupOverlays();
  hideRunOverlays();
  closePillarSystemOverlay();
  document.getElementById("main-menu")?.classList.add("hidden");
  document.querySelector(".game-root")?.classList.remove("hidden");
  document.body.classList.add("home-base-active");
  setRunHudVisibility(false);

  const canvas = document.getElementById("game-canvas");
  if (!canvas) {
    console.error("Game canvas not found");
    return;
  }

  if (!homeBaseScene) {
    homeBaseScene = new HomeBaseScene(canvas, {
      onStartExpedition: (selectedLureIds = []) => {
        openPreRunFrom("hub", [], { selectedLureIds });
      },
      onOpenPrepareForRun: () => {
        openPreRunFrom("hub", [], { selectedLureIds: getSelectedLureIds() });
      },
      onOpenSkillLibrary: () => {
        openSkillLibrary();
        return true;
      },
      onCloseSkillLibrary: () => closeSkillLibrary(),
      onOpenTalents: () => {
        openTalentTree();
        return true;
      },
      onCloseTalents: () => closeTalentTree(),
      onOpenPillars: () => {
        const contextGame = currentGame || ensureMenuPillarGame();
        initializePillarUI(contextGame, { showFloatingButton: false });
        openPillarSystemOverlay();
        return true;
      },
      onClosePillars: () => closePillarSystemOverlay(),
      onOpenLegacyVault: () => {
        openLegacyVault();
        return true;
      },
      onCloseLegacyVault: () => closeLegacyVault(false),
      onOpenIronsmith: () => {
        const contextGame = currentGame || ensureMenuPillarGame();
        openLegacyVaultForIronsmith(contextGame);
        return true;
      },
      onOpenFriends: () => {
        openFriends();
        return true;
      },
      onCloseFriends: () => closeFriends(),
      onOpenSelectHero: () => {
        setSelectHeroBackTarget("hub");
        showSelectHeroScreen("hub");
        return true;
      },
      onCancelRunSetup: () => {
        closeRunSetupOverlays();
      },
      onOpenLegacyMenu: () => openLegacyMenuFromHub()
    });
  }
  homeBaseScene.start();
}

function enterHomeBase(options = {}) {
  if (options.transition === false) {
    enterHomeBaseImmediate();
    return Promise.resolve();
  }
  return queueSceneTransition(() => {
    enterHomeBaseImmediate();
  });
}

function startGameImmediate(legacyItems = [], runConfig = {}) {
  const canvas = document.getElementById("game-canvas");
  if (!canvas) {
    console.error("Game canvas not found");
    return;
  }

  leaveHomeBaseForRun();
  if (currentGame && typeof currentGame.destroy === "function") {
    currentGame.destroy();
  }

  canvas.width = 640;
  canvas.height = 360;
  const resolvedRunConfig = {
    ...runConfig,
    onReturnToHomeBase: () => {
      currentGame = null;
      window.currentGame = null;
      enterHomeBase();
    }
  };
  currentGame = new Game(canvas, legacyItems, resolvedRunConfig);
  installPillarSystem(currentGame);
  if (resolvedRunConfig.riteId === "rite_of_fear") {
    installRiteOfFear(currentGame, { riteId: resolvedRunConfig.riteId });
  } else if (resolvedRunConfig.riteId === "rite_of_monstrosity") {
    installRiteOfMonstrosity(currentGame, { riteId: resolvedRunConfig.riteId });
  } else if (resolvedRunConfig.riteId === "rite_of_torment") {
    installRiteOfTorment(currentGame, { riteId: resolvedRunConfig.riteId });
  } else if (resolvedRunConfig.riteId === "rite_of_sovereign") {
    installRiteOfSovereign(currentGame, { riteId: resolvedRunConfig.riteId });
  }
  initializePillarUI(currentGame, { showFloatingButton: false });
  initializePillarDebugTools(currentGame);
  window.currentGame = currentGame;

  setRunHudVisibility(true);
  document.getElementById("main-menu")?.classList.add("hidden");
  document.querySelector(".game-root")?.classList.remove("hidden");
  if (runConfig.tutorial === true) {
    document.getElementById("pause-toggle")?.classList.add("hidden");
    document.getElementById("mod-screen-button")?.classList.add("hidden");
    document.getElementById("dev-toggle")?.classList.add("hidden");
    document.getElementById("inventory-button")?.classList.add("hidden");
  }

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
  window.refreshPillarRuntime = () => currentGame?.refreshPillarRuntimeState("debug_window_refresh");
  window.printPillarRuntime = () => currentGame?.debugPrintPillarRuntimeSummary();
  window.togglePillarTrace = () => currentGame?.setPillarTraceEnabled?.(!currentGame?.isPillarTraceEnabled?.());
  window.runPillarValidationSuite = () => currentGame?.debugRunPillarValidationSuite?.();
  window.simulatePillarTrialSuccess = (pillarId) => currentGame?.simulatePillarTrialSuccess(pillarId);
  window.simulatePillarTrialFailure = (pillarId) => currentGame?.simulatePillarTrialFailure(pillarId);
  window.grantRiteItem = (count = 1) => currentGame?.grantRiteEntryItem?.(count);
  window.removeRiteItem = (count = 1) => currentGame?.removeRiteEntryItem?.(count);
  window.unlockAllRites = () => currentGame?.unlockAllRites?.();
  window.jumpToRite = (riteId) => currentGame?.jumpToRite?.(riteId);
  window.forceRiteSuccess = (riteId) => currentGame?.forceRiteSuccess?.(riteId);
  window.forceRiteFailure = (riteId) => currentGame?.forceRiteFailure?.(riteId);
  window.markRiteCompleted = (riteId) => currentGame?.markRiteCompleted?.(riteId);
  window.clearRiteCompletion = (riteId) => currentGame?.clearRiteCompletion?.(riteId);
  window.logRiteRuntimeSummary = () => currentGame?.logRiteRuntimeSummary?.();
  window.inspectRiteProgress = () => currentGame?.getRiteDebugSummary?.();
  window.revealFearRiteKeyRoom = () => currentGame?.revealFearRiteKeyRoom?.();
  window.setFearRiteKeyRoom = (roomIndex) => currentGame?.setFearRiteKeyRoom?.(roomIndex);
  window.teleportToFearRiteExit = () => currentGame?.teleportToFearRiteExit?.();
  window.forceFearRiteSuccess = () => currentGame?.forceFearRiteSuccess?.();
  window.forceFearRiteFailure = () => currentGame?.forceFearRiteFailure?.();
  window.logFearRiteRuntimeSummary = () => currentGame?.logFearRiteRuntimeSummary?.();
  window.runFearRiteValidationSuite = () => currentGame?.debugRunFearRiteValidationSuite?.();
  window.jumpToMonstrosityStage = (stageId) => currentGame?.jumpToMonstrosityStage?.(stageId);
  window.forceMonstrosityStageSuccess = () => currentGame?.forceMonstrosityStageSuccess?.();
  window.forceMonstrosityStageFailure = () => currentGame?.forceMonstrosityStageFailure?.();
  window.logMonstrosityRuntimeSummary = () => currentGame?.logMonstrosityRuntimeSummary?.();
  window.runMonstrosityValidationSuite = () => currentGame?.debugRunMonstrosityValidationSuite?.();
  window.jumpToTormentFloor = (floorIndex) => currentGame?.jumpToTormentFloor?.(floorIndex);
  window.forceTormentDescent = () => currentGame?.forceDescent?.();
  window.forceTormentAscent = () => currentGame?.forceAscent?.();
  window.spawnTormentHealingOrb = () => currentGame?.spawnHealingOrb?.();
  window.logTormentHazardDamage = () => currentGame?.logHazardDamage?.();
  window.runTormentValidationSuite = () => currentGame?.debugRunTormentValidationSuite?.();
  window.jumpToSovereignStyle = (styleId) => currentGame?.jumpToSovereignStyle?.(styleId);
  window.forceStyleSwitch = () => currentGame?.forceStyleSwitch?.();
  window.logBossStyle = () => currentGame?.logBossStyle?.();
  window.setBossHP = (value) => currentGame?.setBossHP?.(value);
  window.forceSovereignStyleSwitch = () => currentGame?.forceStyleSwitch?.();
  window.logSovereignStyle = () => currentGame?.logBossStyle?.();
  window.setSovereignBossHP = (value) => currentGame?.setBossHP?.(value);
  window.runSovereignValidationSuite = () => currentGame?.debugRunSovereignValidationSuite?.();

  setBgmVolume(0.15);
  startBgm();
}

function startGame(legacyItems = [], runConfig = {}) {
  void queueSceneTransition(() => {
    startGameImmediate(legacyItems, runConfig);
  }, { outDurationMs: 120, inDurationMs: 160 });
}

function startForestBiomeTestMap() {
  startGame([], {
    difficulty: 1,
    conditions: [],
    devMode: true,
    testMapId: "forest_biome_0",
    attackType: "projectile",
    secondaryAttackType: "projectile",
    selectedUpgrades: [],
    playableCharacterId: DEFAULT_PLAYABLE_CHARACTER_ID
  });
}

function startRiteRun(riteId) {
  const id = String(riteId || "");
  if (!id) return;
  void queueSceneTransition(() => {
    startGameImmediate([], {
      difficulty: 1,
      conditions: [],
      riteId: id,
      isRiteRun: true
    });
  }, { outDurationMs: 130, inDurationMs: 170 });
}

function ensureMainMenuReturnButton() {
  const menuInner = document.querySelector("#main-menu .main-menu-inner");
  if (!menuInner) return;
  if (document.getElementById("main-menu-return-hub")) return;
  const button = document.createElement("button");
  button.id = "main-menu-return-hub";
  button.className = "main-menu-btn main-menu-btn-secondary";
  button.textContent = "Return to Hub";
  button.addEventListener("click", () => {
    enterHomeBase();
  });
  menuInner.appendChild(button);
}

function bootstrap() {
  stopBgm();
  const mainMenu = document.getElementById("main-menu");
  const gameRoot = document.querySelector(".game-root");
  const titleEl = document.querySelector(".main-menu-title");
  const subtitleEl = document.querySelector(".main-menu-subtitle");

  if (titleEl) titleEl.textContent = APP_TITLE;
  if (subtitleEl) subtitleEl.textContent = APP_SUBTITLE;
  document.title = APP_TITLE;

  if (!SHOW_DEV_MENU) {
    document.getElementById("main-menu-dev-mode")?.remove();
    document.getElementById("main-menu-dev-panel")?.remove();
  }
  if (!SHOW_DEV_CONTROLS) {
    document.getElementById("dev-toggle")?.classList.add("hidden");
    document.getElementById("dev-panel")?.classList.add("hidden");
  }

  if (mainMenu && gameRoot) {
    const initialPillarContext = ensureMenuPillarGame();
    initializePillarUI(initialPillarContext, { showFloatingButton: false });
    initOptionsSettings();
    ensureMainMenuReturnButton();
    mainMenu.classList.remove("hidden");
    gameRoot.classList.add("hidden");
    setRunHudVisibility(false);

    const newGameBtn = document.getElementById("main-menu-new-game");
    if (newGameBtn) {
      newGameBtn.addEventListener("click", () => openPreRunFrom("menu", []));
    }
    const selectHeroBtn = document.getElementById("main-menu-select-hero");
    if (selectHeroBtn) {
      selectHeroBtn.addEventListener("click", showSelectHeroScreen);
    }
    const selectHeroBackBtn = document.getElementById("select-hero-back");
    if (selectHeroBackBtn) {
      selectHeroBackBtn.addEventListener("click", hideSelectHeroScreen);
    }
    window.addEventListener("keydown", (event) => {
      if (event.repeat) return;
      if (String(event.key || "").toLowerCase() !== "n") return;

      const targetTag = String(event.target?.tagName || "").toUpperCase();
      const isTextEntry = targetTag === "INPUT" || targetTag === "TEXTAREA" || targetTag === "SELECT" || event.target?.isContentEditable;
      if (isTextEntry) return;

      const mainMenuVisible = !document.getElementById("main-menu")?.classList.contains("hidden");
      if (!mainMenuVisible) return;

      const blockingOverlayIds = [
        "instructions-overlay",
        "options-overlay",
        "legacy-vault-overlay",
        "talent-tree-overlay",
        "skill-library-overlay",
        "friends-overlay",
        "pre-run-overlay",
        "select-hero-overlay",
        "skill-select-overlay",
        "pillar-overlay"
      ];
      const hasBlockingOverlay = blockingOverlayIds.some((id) => !document.getElementById(id)?.classList.contains("hidden"));
      if (hasBlockingOverlay) return;

      event.preventDefault();
      openPreRunFrom("menu", []);
    });

    const tutorialBtn = document.getElementById("main-menu-tutorial");
    if (tutorialBtn) {
      tutorialBtn.addEventListener("click", () => {
        document.getElementById("main-menu")?.classList.add("hidden");
        document.querySelector(".game-root")?.classList.remove("hidden");
        document.getElementById("pause-toggle")?.classList.add("hidden");
        document.getElementById("mod-screen-button")?.classList.add("hidden");
        if (SHOW_DEV_CONTROLS) {
          document.getElementById("dev-toggle")?.classList.add("hidden");
        }
        startGame([], {
          difficulty: 1,
          conditions: [],
          tutorial: true,
          skills: ["fireball", "rapidFire", "groundSlam", "healPulse"]
        });
      });
    }

    const dev999CrystalsBtn = document.getElementById("main-menu-dev-999-crystals");
    if (SHOW_DEV_MENU && dev999CrystalsBtn) {
      dev999CrystalsBtn.addEventListener("click", () => {
        const { total, updated } = giveAllCharacters999Crystals();
        const msg = total === 0
          ? "No saved characters. Save a character from a run first."
          : `Set 999 of all crystals for ${updated} character(s).`;
        if (typeof window.alert === "function") window.alert(msg);
        renderHallOfChampions();
      });
    }

    const devModeBtn = document.getElementById("main-menu-dev-mode");
    if (SHOW_DEV_MENU && devModeBtn) {
      devModeBtn.addEventListener("click", () => {
        setPendingDevMode(true);
        openPreRunFrom("menu", []);
        setPreRunStateForDevMode();
        renderPreRunScreen();
      });
    }

    window.startForestBiomeTestMap = () => startForestBiomeTestMap();

    const legacyVaultBtn = document.getElementById("main-menu-legacy-vault");
    if (legacyVaultBtn) {
      legacyVaultBtn.addEventListener("click", openLegacyVault);
    }
    const talentsBtn = document.getElementById("main-menu-talents");
    if (talentsBtn) {
      talentsBtn.addEventListener("click", openTalentTree);
    }

    const talentTreeCloseBtn = document.getElementById("talent-tree-close");
    if (talentTreeCloseBtn) {
      talentTreeCloseBtn.addEventListener("click", closeTalentTree);
    }

    refreshMainMenuLP();

    const legacyCloseBtn = document.getElementById("legacy-vault-close");
    if (legacyCloseBtn) {
      legacyCloseBtn.addEventListener("click", () => {
        const returnToHub = document.body.classList.contains("home-base-active");
        closeLegacyVault(!returnToHub);
      });
    }

    const skillLibraryBtn = document.getElementById("main-menu-skill-library");
    if (skillLibraryBtn) {
      skillLibraryBtn.addEventListener("click", openSkillLibrary);
    }
    const skillLibraryCloseBtn = document.getElementById("skill-library-close");
    if (skillLibraryCloseBtn) {
      skillLibraryCloseBtn.addEventListener("click", closeSkillLibrary);
    }

    initFriendsState();

    const friendsBtn = document.getElementById("main-menu-friends");
    if (friendsBtn) {
      friendsBtn.addEventListener("click", openFriends);
    }
    const friendsCloseBtn = document.getElementById("friends-close-btn");
    if (friendsCloseBtn) {
      friendsCloseBtn.addEventListener("click", closeFriends);
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
        import("./ui/legacy-vault-gift.js").then((m) => {
          if (m.isGiftMode && m.isGiftMode()) {
            return;
          }
          const items = getSelectedLegacyItems();
          closeLegacyVault(false);
          openPreRunFrom("menu", items);
        }).catch(() => {
          const items = getSelectedLegacyItems();
          closeLegacyVault(false);
          openPreRunFrom("menu", items);
        });
      });
    }

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
    const skillSelectClearUpgrades = document.getElementById("skill-select-clear-upgrades");
    if (skillSelectClearUpgrades) {
      skillSelectClearUpgrades.addEventListener("click", clearSkillSelectUpgrades);
    }
    const skillSelectBack = document.getElementById("skill-select-back");
    if (skillSelectBack) {
      skillSelectBack.addEventListener("click", () => {
        document.getElementById("skill-select-overlay")?.classList.add("hidden");
        if (getSkillSelectBackTarget() === "menu") {
          document.getElementById("main-menu")?.classList.remove("hidden");
          document.querySelector(".game-root")?.classList.add("hidden");
        } else {
          document.getElementById("pre-run-overlay")?.classList.remove("hidden");
        }
      });
    }

    const preRunBack = document.getElementById("pre-run-back");
    if (preRunBack) {
      preRunBack.addEventListener("click", () => {
        stopBgm();
        closeRunSetupOverlays();
        if (preRunSource === "hub") {
          enterHomeBase();
        } else {
          document.getElementById("main-menu")?.classList.remove("hidden");
          document.querySelector(".game-root")?.classList.add("hidden");
        }
      });
    }

    const fade = ensureScreenFade();
    fade.setOpacity(1);
    void fade.fadeIn(220);
  } else {
    startGame([], { difficulty: 1, conditions: [] });
  }
}

window.addEventListener("DOMContentLoaded", bootstrap);
