import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const useAuthStore = create(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,
      token: null,
      role: null,

      setAuth: (user, token, role) => set({ user, token, role, isAuthenticated: true }),
      clearAuth: () => set({ user: null, token: null, role: null, isAuthenticated: false }),
    }),
    {
      name: 'auth-storage',
    }
  )
);
