import { StyleSheet } from 'react-native';

export const styles = StyleSheet.create({
  container: { gap: 10 },
  linkedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#EEF1FF',
    borderRadius: 12,
    padding: 12,
  },
  linkedTexts: { flex: 1 },
  linkedTitle: { fontSize: 14, fontWeight: '700', color: '#1A1A2E' },
  linkedSub: { fontSize: 12, color: '#666', marginTop: 2 },
  linkedSubWarning: { fontSize: 12, color: '#B26A00', marginTop: 2 },
  unlinkText: { fontSize: 13, fontWeight: '700', color: '#FF4444' },
  hint: { fontSize: 13, color: '#888', lineHeight: 18 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    backgroundColor: '#fff',
  },
  chipActive: { borderColor: '#4A6CF7', backgroundColor: '#4A6CF7' },
  chipText: { fontSize: 13, fontWeight: '600', color: '#555' },
  chipTextActive: { color: '#fff' },
});
