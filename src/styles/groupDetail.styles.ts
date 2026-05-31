import { StyleSheet } from 'react-native';

export const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F8F9FA' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#1A1A2E', flex: 1 },
  scroll: { paddingBottom: 40 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  centeredText: { color: '#888', fontSize: 14 },

  section: { marginTop: 20 },
  sectionTitle: {
    fontSize: 13, fontWeight: '600', color: '#888',
    textTransform: 'uppercase', letterSpacing: 0.5,
    marginHorizontal: 20, marginBottom: 10,
  },

  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 16,
  },
  nameRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 2,
  },
  name: { fontSize: 20, fontWeight: '800', color: '#1A1A2E' },
  nameEditRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 2,
  },
  nameEditInput: {
    flex: 1, fontSize: 18, fontWeight: '700', color: '#1A1A2E',
    borderBottomWidth: 1.5, borderBottomColor: '#4A6CF7', paddingVertical: 4,
  },
  divider: { height: 1, backgroundColor: '#f0f0f0', marginVertical: 8 },
  row: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', paddingVertical: 6,
  },
  label: { fontSize: 14, color: '#888' },
  value: { fontSize: 14, fontWeight: '600', color: '#1A1A2E' },
  inviteCode: { fontSize: 18, fontWeight: '800', letterSpacing: 4, color: '#4A6CF7' },
  memberRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6,
  },
  memberName: { fontSize: 14, color: '#1A1A2E', fontWeight: '500' },

  btn: {
    backgroundColor: '#EEF1FF',
    borderRadius: 12, paddingVertical: 12, alignItems: 'center', marginTop: 8,
    flexDirection: 'row', gap: 6, justifyContent: 'center',
  },
  btnSecondary: { marginTop: 4 },
  btnText: { color: '#4A6CF7', fontWeight: '700', fontSize: 14 },

  activeBtn: {
    backgroundColor: '#4A6CF7', borderRadius: 14,
    paddingVertical: 14, alignItems: 'center', marginHorizontal: 16,
    flexDirection: 'row', gap: 8, justifyContent: 'center',
  },
  activeBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  activeChip: {
    backgroundColor: '#E6F7EE', borderRadius: 12,
    paddingVertical: 12, alignItems: 'center', marginHorizontal: 16,
    flexDirection: 'row', gap: 6, justifyContent: 'center',
  },
  activeChipText: { color: '#16A34A', fontWeight: '700', fontSize: 14 },

  leaveBtn: {
    marginHorizontal: 16, backgroundColor: '#fff', borderRadius: 14,
    paddingVertical: 16, alignItems: 'center',
    borderWidth: 1.5, borderColor: '#FF4444',
  },
  leaveText: { color: '#FF4444', fontSize: 15, fontWeight: '700' },
});
