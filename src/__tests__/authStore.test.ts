import { useAuthStore } from '@/stores/authStore';
import type { User } from 'firebase/auth';
import type { UserProfile } from '@/types';

const snapshot = useAuthStore.getState();

beforeEach(() => {
  useAuthStore.setState(snapshot, true);
});

describe('authStore — initial state', () => {
  it('firebaseUser is null', () => {
    expect(useAuthStore.getState().firebaseUser).toBeNull();
  });

  it('profile is null', () => {
    expect(useAuthStore.getState().profile).toBeNull();
  });

  it('coupleId is null', () => {
    expect(useAuthStore.getState().coupleId).toBeNull();
  });

  it('isLoading is true', () => {
    expect(useAuthStore.getState().isLoading).toBe(true);
  });
});

describe('authStore — actions', () => {
  it('setFirebaseUser stores the user', () => {
    const user = { uid: 'uid-1', email: 'a@b.com' } as unknown as User;
    useAuthStore.getState().setFirebaseUser(user);
    expect(useAuthStore.getState().firebaseUser?.uid).toBe('uid-1');
  });

  it('setFirebaseUser accepts null', () => {
    useAuthStore.getState().setFirebaseUser({ uid: 'x' } as unknown as User);
    useAuthStore.getState().setFirebaseUser(null);
    expect(useAuthStore.getState().firebaseUser).toBeNull();
  });

  it('setProfile stores the profile', () => {
    const profile = { id: 'p-1', email: 'a@b.com', display_name: 'Alice' } as UserProfile;
    useAuthStore.getState().setProfile(profile);
    expect(useAuthStore.getState().profile?.id).toBe('p-1');
  });

  it('setCoupleId stores the coupleId', () => {
    useAuthStore.getState().setCoupleId('couple-42');
    expect(useAuthStore.getState().coupleId).toBe('couple-42');
  });

  it('setLoading updates isLoading', () => {
    useAuthStore.getState().setLoading(false);
    expect(useAuthStore.getState().isLoading).toBe(false);
  });

  it('reset clears user, profile and coupleId', () => {
    useAuthStore.getState().setFirebaseUser({ uid: 'x' } as unknown as User);
    useAuthStore.getState().setProfile({ id: 'p-1' } as UserProfile);
    useAuthStore.getState().setCoupleId('couple-1');

    useAuthStore.getState().reset();

    const { firebaseUser, profile, coupleId, isLoading } = useAuthStore.getState();
    expect(firebaseUser).toBeNull();
    expect(profile).toBeNull();
    expect(coupleId).toBeNull();
    expect(isLoading).toBe(false);
  });
});
