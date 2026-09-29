import { StyleSheet } from 'react-native';

export const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F8F9FA' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  title: { fontSize: 24, fontWeight: '800', color: '#1A1A2E' },
  count: { fontSize: 13, color: '#888' },
  scroll: { paddingBottom: 32 },
  section: { marginBottom: 8 },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#1A1A2E', flex: 1 },
  pill: {
    backgroundColor: '#4A6CF722',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  pillPink: { backgroundColor: '#FF40811A' },
  pillText: { fontSize: 12, fontWeight: '600', color: '#555' },
  emptySection: {
    marginHorizontal: 16,
    marginBottom: 12,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  emptyText: { fontSize: 13, color: '#aaa', textAlign: 'center' },
});
