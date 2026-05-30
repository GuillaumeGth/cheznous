import React, { useEffect, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle, withTiming, withDelay, runOnJS,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export type ToastType = 'error' | 'info' | 'success';

type Props = {
  message: string;
  type?: ToastType;
  visible: boolean;
  onHide: () => void;
  duration?: number;
};

const ICON: Record<ToastType, keyof typeof Ionicons.glyphMap> = {
  error: 'alert-circle',
  info: 'information-circle',
  success: 'checkmark-circle',
};

const BG: Record<ToastType, string> = {
  error: '#FF4444',
  info: '#4A6CF7',
  success: '#22C55E',
};

export default function Toast({
  message, type = 'info', visible, onHide, duration = 3000,
}: Props) {
  const insets = useSafeAreaInsets();
  const translateY = useSharedValue(100);
  const opacity = useSharedValue(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hide = () => {
    opacity.value = withTiming(0, { duration: 200 });
    translateY.value = withTiming(100, { duration: 200 }, (done) => {
      if (done) runOnJS(onHide)();
    });
  };

  useEffect(() => {
    if (!visible) return;
    translateY.value = withTiming(0, { duration: 280 });
    opacity.value = withTiming(1, { duration: 280 });
    timerRef.current = setTimeout(hide, duration);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: opacity.value,
  }));

  if (!visible) return null;

  return (
    <Animated.View
      style={[
        styles.container,
        { bottom: insets.bottom + 16, backgroundColor: BG[type] },
        animatedStyle,
      ]}
    >
      <Ionicons name={ICON[type]} size={20} color="#fff" />
      <Text style={styles.message}>{message}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 16, right: 16,
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 16, paddingVertical: 14,
    borderRadius: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 10,
    elevation: 8,
    zIndex: 999,
  },
  message: { color: '#fff', fontSize: 14, fontWeight: '600', flex: 1, lineHeight: 20 },
});
