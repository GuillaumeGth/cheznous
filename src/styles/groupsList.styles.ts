import { StyleSheet } from 'react-native';

export const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F8F9FA' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
  },
  title: { fontSize: 24, fontWeight: '800', color: '#1A1A2E' },
  scroll: { paddingHorizontal: 16, paddingBottom: 32 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  cardIcon: {
    width: 46, height: 46, borderRadius: 23,
    backgroundColor: '#EEF1FF',
    alignItems: 'center', justifyContent: 'center',
  },
  cardTexts: { flex: 1 },
  cardNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardName: { fontSize: 16, fontWeight: '700', color: '#1A1A2E' },
  cardSub: { fontSize: 13, color: '#888', marginTop: 2 },
  activeBadge: {
    backgroundColor: '#E6F7EE',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  activeBadgeText: { fontSize: 11, fontWeight: '700', color: '#16A34A' },
  addBtn: {
    backgroundColor: '#4A6CF7',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginTop: 4,
  },
  addBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  empty: {
    color: '#888', fontSize: 14, textAlign: 'center',
    marginTop: 40, marginBottom: 24, lineHeight: 20, paddingHorizontal: 24,
  },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
