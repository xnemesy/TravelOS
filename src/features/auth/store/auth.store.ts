import { create } from 'zustand';
import { User } from 'firebase/auth';

interface AuthState {
  user: User | null;
  isLoading: boolean;
  isInitialized: boolean; // Diventa true dopo il primo check di Firebase
  
  // Actions
  setUser: (user: User | null) => void;
  setLoading: (isLoading: boolean) => void;
  setInitialized: (isInitialized: boolean) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoading: false,
  isInitialized: false,
  
  setUser: (user) => set({ user }),
  setLoading: (isLoading) => set({ isLoading }),
  setInitialized: (isInitialized) => set({ isInitialized }),
}));
