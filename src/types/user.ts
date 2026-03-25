export type ExperienceLevel = "beginner" | "intermediate" | "advanced";
export type AgeRange = "14-17" | "18-25" | "26-40" | "40+";

export interface UserProfile {
  displayName: string;
  experienceLevel: ExperienceLevel;
  ageRange: AgeRange;
  hasCompletedOnboarding: boolean;
  favoriteGenres: string[];
  goals: string[];
  gamesCreated: number;
  showTooltips: boolean;
  preferGuidedMode: boolean;
}

export const DEFAULT_PROFILE: UserProfile = {
  displayName: "",
  experienceLevel: "beginner",
  ageRange: "14-17",
  hasCompletedOnboarding: false,
  favoriteGenres: [],
  goals: [],
  gamesCreated: 0,
  showTooltips: true,
  preferGuidedMode: true,
};

export const EXPERIENCE_DESCRIPTIONS: Record<ExperienceLevel, { title: string; subtitle: string; detail: string }> = {
  beginner: {
    title: "Just Getting Started",
    subtitle: "I've never made a game before",
    detail: "We'll guide you through everything step by step. No coding knowledge needed!",
  },
  intermediate: {
    title: "I Know Some Basics",
    subtitle: "I've played around in Roblox Studio or coded a little",
    detail: "We'll give you more control while still helping when you need it.",
  },
  advanced: {
    title: "Experienced Builder",
    subtitle: "I've made games before and know Luau/scripting",
    detail: "Full control with AI as your co-pilot. Direct access to scripts and properties.",
  },
};

export const GOAL_OPTIONS = [
  { id: "fun", label: "Make games for fun", icon: "sparkles" },
  { id: "friends", label: "Build games with friends", icon: "users" },
  { id: "monetize", label: "Earn Robux from my games", icon: "coins" },
  { id: "learn", label: "Learn game development", icon: "book" },
  { id: "portfolio", label: "Build a portfolio", icon: "briefcase" },
  { id: "popular", label: "Make a popular game", icon: "trending" },
];
