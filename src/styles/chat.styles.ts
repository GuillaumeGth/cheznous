import { StyleSheet } from 'react-native';

export const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F8F9FA' },
  flex: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  emptyText: { fontSize: 14, color: '#aaa', textAlign: 'center', paddingHorizontal: 32 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    gap: 12,
  },
  backBtn: { padding: 4 },
  headerMeta: { flex: 1 },
  headerTitle: { fontSize: 15, fontWeight: '700', color: '#1A1A2E' },
  headerSub: { fontSize: 12, color: '#888', marginTop: 1 },

  messageList: { paddingVertical: 16, paddingHorizontal: 12 },

  msgRow: { marginBottom: 12 },
  msgRowMe: { alignItems: 'flex-end' },
  msgRowThem: { alignItems: 'flex-start' },

  senderName: { fontSize: 11, color: '#888', marginBottom: 3, marginLeft: 4 },

  bubble: {
    maxWidth: '78%',
    borderRadius: 18,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  bubbleMe: {
    backgroundColor: '#4A6CF7',
    borderBottomRightRadius: 4,
  },
  bubbleThem: {
    backgroundColor: '#fff',
    borderBottomLeftRadius: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  bubbleText: { fontSize: 14, lineHeight: 20 },
  bubbleTextMe: { color: '#fff' },
  bubbleTextThem: { color: '#1A1A2E' },

  // Attachment bubbles (no horizontal padding — image/file fills the bubble)
  bubbleAttachment: { paddingVertical: 0, paddingHorizontal: 0, overflow: 'hidden' },

  attachmentImage: { width: 220, height: 160, borderRadius: 18 },

  fileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  fileName: { fontSize: 13, fontWeight: '500', flex: 1 },
  fileNameMe: { color: '#fff' },
  fileNameThem: { color: '#1A1A2E' },

  time: { fontSize: 10, color: '#bbb', marginTop: 3, marginHorizontal: 4 },
  timeMe: { textAlign: 'right' },
  timeThem: { textAlign: 'left' },

  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 8,
    paddingVertical: 8,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    gap: 4,
  },
  attachBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    flex: 1,
    backgroundColor: '#F0F4FF',
    borderRadius: 22,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: '#1A1A2E',
    maxHeight: 120,
  },
  sendBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#4A6CF7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: { backgroundColor: '#ccc' },
});
