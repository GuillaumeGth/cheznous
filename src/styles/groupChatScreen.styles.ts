import { StyleSheet, Dimensions } from 'react-native';

const { width: SCREEN_W } = Dimensions.get('window');
const BUBBLE_MAX = SCREEN_W * 0.72;

export const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F8F9FA' },

  // Header
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
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerInfo: { flex: 1 },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#1A1A2E' },
  headerSubtitle: { fontSize: 12, color: '#888', marginTop: 1 },

  // List
  messageList: { paddingHorizontal: 16, paddingVertical: 8 },

  // System message
  systemRow: { alignItems: 'center', marginVertical: 8 },
  systemBubble: {
    backgroundColor: '#EDEDF5',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  systemText: { fontSize: 12, color: '#666', fontStyle: 'italic', textAlign: 'center' },

  // Text message
  messageGroup: { marginVertical: 3 },
  authorLabel: { fontSize: 11, color: '#888', marginBottom: 2, marginHorizontal: 4 },
  messageRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 6 },
  messageRowMine: { justifyContent: 'flex-end' },
  messageRowTheirs: { justifyContent: 'flex-start' },
  bubble: {
    maxWidth: BUBBLE_MAX,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  bubbleMine: {
    backgroundColor: '#4A6CF7',
    borderBottomRightRadius: 4,
  },
  bubbleTheirs: {
    backgroundColor: '#fff',
    borderBottomLeftRadius: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 1,
  },
  bubbleTextMine: { color: '#fff', fontSize: 15, lineHeight: 21 },
  bubbleTextTheirs: { color: '#1A1A2E', fontSize: 15, lineHeight: 21 },
  bubbleTime: { fontSize: 10, marginTop: 3, opacity: 0.6 },
  bubbleTimeMine: { color: '#fff', textAlign: 'right' },
  bubbleTimeTheirs: { color: '#666' },

  // Listing share card
  shareGroup: { marginVertical: 6 },
  shareAuthor: { fontSize: 11, color: '#888', marginBottom: 4, marginHorizontal: 4 },
  shareCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    overflow: 'hidden',
    width: SCREEN_W * 0.86,
    maxWidth: SCREEN_W * 0.86,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  shareCardMine: { alignSelf: 'flex-end' },
  shareCardTheirs: { alignSelf: 'flex-start' },
  shareCaption: {
    fontSize: 14,
    color: '#555',
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 6,
    fontStyle: 'italic',
  },
  listingRow: { flexDirection: 'row', padding: 14, gap: 12, alignItems: 'center' },
  listingThumb: {
    width: 92,
    height: 92,
    borderRadius: 12,
    backgroundColor: '#E8EDFF',
  },
  listingInfo: { flex: 1, gap: 4 },
  listingTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1A1A2E',
    lineHeight: 20,
  },
  listingPriceRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  listingPrice: { fontSize: 16, fontWeight: '800', color: '#4A6CF7' },
  listingMeta: { fontSize: 12, color: '#888' },
  shareTime: {
    fontSize: 10,
    color: '#aaa',
    paddingHorizontal: 12,
    paddingBottom: 8,
    textAlign: 'right',
  },

  // Reactions
  reactionsRow: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingBottom: 4,
    gap: 8,
  },
  reactionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1.5,
  },
  reactionBtnLike: { borderColor: '#34C759', backgroundColor: '#F0FFF4' },
  reactionBtnDislike: { borderColor: '#FF3B30', backgroundColor: '#FFF0F0' },
  reactionBtnNeutral: { borderColor: '#ddd', backgroundColor: '#fafafa' },
  reactionBtnLikeActive: { borderColor: '#34C759', backgroundColor: '#34C759' },
  reactionBtnDislikeActive: { borderColor: '#FF3B30', backgroundColor: '#FF3B30' },
  reactionCount: { fontSize: 13, fontWeight: '600' },
  reactionCountLike: { color: '#34C759' },
  reactionCountDislike: { color: '#FF3B30' },
  reactionCountNeutral: { color: '#aaa' },
  reactionCountActive: { color: '#fff' },

  // Input
  inputArea: {
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  textInput: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: '#E0E0F0',
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 10,
    fontSize: 15,
    color: '#1A1A2E',
    maxHeight: 120,
    backgroundColor: '#F8F9FA',
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#4A6CF7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: { backgroundColor: '#D0D8FF' },

  // Loading
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  loadingText: { color: '#888', fontSize: 14 },
});
