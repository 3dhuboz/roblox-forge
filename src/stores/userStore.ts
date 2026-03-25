import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { UserProfile } from "../types/user";
import { DEFAULT_PROFILE } from "../types/user";

interface UserStore {
  profile: UserProfile;
  updateProfile: (updates: Partial<UserProfile>) => void;
  completeOnboarding: () => void;
  resetProfile: () => void;
  isBeginner: () => boolean;
  isAdvanced: () => boolean;
}

export const useUserStore = create<UserStore>()(
  persist(
    (set, get) => ({
      profile: DEFAULT_PROFILE,

      updateProfile: (updates) => {
        set((state) => ({
          profile: { ...state.profile, ...updates },
        }));
      },

      completeOnboarding: () => {
        set((state) => ({
          profile: { ...state.profile, hasCompletedOnboarding: true },
        }));
      },

      resetProfile: () => {
        set({ profile: DEFAULT_PROFILE });
      },

      isBeginner: () => get().profile.experienceLevel === "beginner",
      isAdvanced: () => get().profile.experienceLevel === "advanced",
    }),
    {
      name: "roblox-forge-user",
    },
  ),
);
