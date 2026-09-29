import { ActivityIndicator, View } from 'react-native';
import { styles } from '@/styles/fullScreenLoader.styles';

export default function FullScreenLoader() {
  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#4A6CF7" />
    </View>
  );
}
