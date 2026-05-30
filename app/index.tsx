import { Redirect } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { useAuthStore } from '@/stores/authStore';

export default function Index() {
  const { firebaseUser, coupleId, isLoading } = useAuthStore();

  if (isLoading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F8F9FA' }}>
        <ActivityIndicator size="large" color="#4A6CF7" />
      </View>
    );
  }

  if (!firebaseUser) return <Redirect href="/(auth)" />;
  if (!coupleId) return <Redirect href="/(auth)/couple" />;
  return <Redirect href="/(tabs)" />;
}
