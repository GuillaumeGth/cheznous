import { Redirect } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { useAuthStore } from '@/stores/authStore';

export default function Index() {
  // Atomic selectors: re-render only when the relevant boolean flips, not on
  // every profile/auth field change.
  const isLoading = useAuthStore((s) => s.isLoading);
  const hasUser = useAuthStore((s) => !!s.firebaseUser);
  const hasGroup = useAuthStore((s) => !!s.groupId);

  // No group yet: SharedGroupsSync joins every group / creates one and sets
  // the active group — there is no invite step anymore.
  if (isLoading || (hasUser && !hasGroup)) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F8F9FA' }}>
        <ActivityIndicator size="large" color="#4A6CF7" />
      </View>
    );
  }

  if (!hasUser) return <Redirect href="/(auth)" />;
  return <Redirect href="/(tabs)" />;
}
