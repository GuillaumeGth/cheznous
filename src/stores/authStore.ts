import { create } from 'zustand';
import { User } from 'firebase/auth';
import { UserProfile } from '@/types';

type AuthState = {
  firebaseUser: User | null;
  profile: UserProfile | null;
  coupleId: string | null;
  isLoading: boolean;
  setFirebaseUser: (user: User | null) => void;
  setProfile: (profile: UserProfile | null) => void;
  setCoupleId: (id: string | null) => void;
  setLoading: (loading: boolean) => void;
  reset: () => void;
};

export const useAuthStore = create<AuthState>((set) => ({
  firebaseUser: null,
  profile: null,
  coupleId: null,
  isLoading: true,
  setFirebaseUser: (user) => set({ firebaseUser: user }),
  setProfile: (profile) => set({ profile }),
  setCoupleId: (id) => set({ coupleId: id }),
  setLoading: (isLoading) => set({ isLoading }),
  reset: () => set({ firebaseUser: null, profile: null, coupleId: null, isLoading: false }),
}));
