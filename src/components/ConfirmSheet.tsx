import React, { useEffect } from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue, useAnimatedStyle, withTiming,
} from 'react-native-reanimated';

type Props = {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  confirmDestructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export default function ConfirmSheet({
  visible, title, message,
  confirmLabel = 'Confirmer', confirmDestructive = false,
  onConfirm, onCancel,
}: Props) {
  const insets = useSafeAreaInsets();
  const translateY = useSharedValue(300);

  useEffect(() => {
    translateY.value = withTiming(visible ? 0 : 300, { duration: 320 });
  }, [visible, translateY]);

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
      statusBarTranslucent
    >
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onCancel}>
        <Animated.View style={[styles.sheet, sheetStyle, { paddingBottom: insets.bottom + 20 }]}>
          <View style={styles.handle} />
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>
          <TouchableOpacity
            style={[styles.btn, confirmDestructive ? styles.btnDestructive : styles.btnPrimary]}
            onPress={onConfirm}
          >
            <Text style={[styles.btnText, confirmDestructive ? styles.btnTextDestructive : styles.btnTextPrimary]}>
              {confirmLabel}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.cancelBtn} onPress={onCancel}>
            <Text style={styles.cancelText}>Annuler</Text>
          </TouchableOpacity>
        </Animated.View>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: 20, paddingBottom: 36, paddingTop: 12,
    alignItems: 'center',
  },
  handle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: '#E0E0E0', marginBottom: 20,
  },
  title: {
    fontSize: 18, fontWeight: '800', color: '#1A1A2E', marginBottom: 8,
  },
  message: {
    fontSize: 14, color: '#666', textAlign: 'center', lineHeight: 20, marginBottom: 24,
  },
  btn: {
    width: '100%', paddingVertical: 16, borderRadius: 14, alignItems: 'center', marginBottom: 10,
  },
  btnPrimary: { backgroundColor: '#4A6CF7' },
  btnDestructive: { backgroundColor: '#FFF0F0', borderWidth: 1.5, borderColor: '#FF4444' },
  btnText: { fontSize: 15, fontWeight: '700' },
  btnTextPrimary: { color: '#fff' },
  btnTextDestructive: { color: '#FF4444' },
  cancelBtn: {
    width: '100%', paddingVertical: 14, alignItems: 'center',
  },
  cancelText: { fontSize: 15, color: '#888', fontWeight: '500' },
});
