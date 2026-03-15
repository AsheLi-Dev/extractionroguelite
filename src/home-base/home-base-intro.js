const HUB_INTRO_SEEN_KEY = "homeBase_intro_seen_v1";

const DEFAULT_STEPS = [
  {
    title: "Home Base",
    description: "Move with WASD or Arrow keys.",
    duration: 4.2
  },
  {
    title: "Interactions",
    description: "Walk near a marker and press E to interact.",
    duration: 4.6
  },
  {
    title: "Where To Start",
    description: "Portal Gate starts expeditions. Vault handles gear and blessings. Walk to each station to interact.",
    duration: 5.1
  }
];

export function shouldShowHomeBaseIntro() {
  try {
    return localStorage.getItem(HUB_INTRO_SEEN_KEY) !== "1";
  } catch {
    return true;
  }
}

export function markHomeBaseIntroSeen() {
  try {
    localStorage.setItem(HUB_INTRO_SEEN_KEY, "1");
  } catch {}
}

export function getHomeBaseIntroSteps() {
  return DEFAULT_STEPS.map((entry) => ({ ...entry }));
}
