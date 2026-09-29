import React, { memo } from 'react';
import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { styles } from '@/styles/expiredBadge.styles';

// Overlay for a liked/matched listing the server sync reported as expired.
function ExpiredBadge() {
  return (
    <View style={styles.badge}>
      <Ionicons name="time-outline" size={11} color="#fff" />
      <Text style={styles.text}>Annonce expirée</Text>
    </View>
  );
}

export default memo(ExpiredBadge);
