import { StyleSheet } from 'react-native';

export const styles = StyleSheet.create({
  section: {
    marginTop: 20,
    gap: 10,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1A1A2E',
  },
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F0F4FF',
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  editBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#4A6CF7',
  },
  empty: {
    fontSize: 13,
    color: '#aaa',
  },
  noteRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
  },
  avatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#E8ECFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#4A6CF7',
  },
  noteContent: { flex: 1 },
  noteName: {
    fontSize: 12,
    fontWeight: '700',
    color: '#555',
    marginBottom: 2,
  },
  noteText: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
  },
});
