import { Redirect } from 'expo-router';
import { useAuthStore } from '@/stores/authStore';
import FullScreenLoader from '@/components/FullScreenLoader';

export default function Index() {
  // Atomic selectors: re-render only when the relevant boolean flips, not on
  // every profile/auth field change.
  const isLoading = useAuthStore((s) => s.isLoading);
  const hasUser = useAuthStore((s) => !!s.firebaseUser);
  const hasGroup = useAuthStore((s) => !!s.groupId);

  // No group yet: SharedGroupsSync joins every group / creates one and sets
  // the active group — there is no invite step anymore.
  if (isLoading || (hasUser && !hasGroup)) return <FullScreenLoader />;

  if (!hasUser) return <Redirect href="/(auth)" />;
  return <Redirect href="/(tabs)" />;
}
