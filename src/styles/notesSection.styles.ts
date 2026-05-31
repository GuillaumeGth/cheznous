import { StyleSheet } from 'react-native';

export const styles = StyleSheet.create({
  container: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    gap: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  headerText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#aaa',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  noteRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-start',
  },
  avatar: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#E8ECFF',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  avatarText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#4A6CF7',
  },
  noteContent: { flex: 1 },
  noteName: {
    fontSize: 11,
    fontWeight: '700',
    color: '#555',
    marginBottom: 2,
  },
  noteText: {
    fontSize: 12,
    color: '#666',
    lineHeight: 17,
  },
});
