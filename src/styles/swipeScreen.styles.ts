import { StyleSheet, Dimensions } from 'react-native';

const { width: SCREEN_W } = Dimensions.get('window');

export const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F8F9FA' },
  cardsArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centered: { alignItems: 'center', gap: 12 },
  loadingText: { color: '#888', fontSize: 15, marginTop: 8 },
  emptyTitle: { fontSize: 22, fontWeight: '700', color: '#1A1A2E' },
  emptyDesc: { fontSize: 14, color: '#888' },
  reloadBtn: {
    borderRadius: 14,
    paddingHorizontal: 28,
    paddingVertical: 13,
    marginTop: 8,
  },
  reloadText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  // Over the card's top-left corner: card = 16 from the sides, 8 from the top.
  floatingFilterBtn: {
    position: 'absolute',
    top: 20,
    left: 28,
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: 'rgba(255,255,255,0.92)',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2, shadowRadius: 6, elevation: 9,
  },
  floatingShareBtn: {
    position: 'absolute',
    left: 8,
    top: '50%',
    marginTop: -27,
    width: 54, height: 54, borderRadius: 27,
    shadowColor: '#4A6CF7', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35, shadowRadius: 8, elevation: 5,
  },
  floatingShareInner: {
    width: 54, height: 54, borderRadius: 27,
    alignItems: 'center', justifyContent: 'center',
  },
  matchTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  matchBanner: {
    position: 'absolute',
    top: 100,
    alignSelf: 'center',
    backgroundColor: '#1A1A2E',
    borderRadius: 16,
    paddingHorizontal: 24,
    paddingVertical: 14,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 10,
    maxWidth: SCREEN_W - 40,
  },
  matchText: { color: '#fff', fontSize: 18, fontWeight: '800' },
  matchSub: { color: '#aaa', fontSize: 12, marginTop: 2 },
});
