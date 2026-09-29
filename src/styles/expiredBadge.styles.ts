import { StyleSheet } from 'react-native';

export const styles = StyleSheet.create({
  badge: {
    position: 'absolute',
    top: 10,
    left: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(26, 26, 46, 0.85)',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  text: { color: '#fff', fontSize: 11, fontWeight: '700' },
});
