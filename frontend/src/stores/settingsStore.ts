/**
 * Settings store using Zustand
 * Manages user preferences state
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { UserPreferences } from '@/types/models';

interface SettingsState {
  preferences: UserPreferences | null;
  isLoading: boolean;
  isOpen: boolean;

  // Actions
  setPreferences: (preferences: UserPreferences | null) => void;
  setLoading: (loading: boolean) => void;
  setOpen: (open: boolean) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      preferences: null,
      isLoading: false,
      isOpen: false,

      setPreferences: (preferences: UserPreferences | null) =>
        set({ preferences }),

      setLoading: (loading: boolean) =>
        set({ isLoading: loading }),

      setOpen: (open: boolean) =>
        set({ isOpen: open }),
    }),
    {
      name: 'kbase-settings',
      partialize: (state) => ({
        preferences: state.preferences,
      }),
    }
  )
);
