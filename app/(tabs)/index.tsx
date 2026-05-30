import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ActivityIndicator, Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  collection, query, where, getDocs, doc, setDoc, getDoc, deleteDoc,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuthStore } from '@/stores/authStore';
import { useFilterStore } from '@/stores/filterStore';
import { useListings } from '@/hooks/useListings';
import { useCouple } from '@/hooks/useCouple';
import { useNewListingsNotify } from '@/hooks/useNewListingsNotify';
import SwipeCard from '@/components/SwipeCard';
import FilterSheet from '@/components/FilterSheet';
import ListingDetailSheet from '@/components/ListingDetailSheet';
import NoteModal from '@/components/NoteModal';
import { notifyPartnerOfSwipe } from '@/lib/notifications';
import { CoupleMember, Listing } from '@/types';

const { width: SCREEN_W } = Dimensions.get('window');

export default function SwipeScreen() {
  const { firebaseUser, coupleId, profile } = useAuthStore();
  const { filters, searchLists, activeListId } = useFilterStore();
  const activeListName = searchLists.find((l) => l.id === activeListId)?.name;
  const { stack, isLoading, loadMore, refresh, pop, pushBack, filtersKey } = useListings();
  const { couple, partnerProfile } = useCouple();
  const [filterVisible, setFilterVisible] = useState(false);
  const [matchAnim, setMatchAnim] = useState<string | null>(null);
  const [detailListing, setDetailListing] = useState<Listing | null>(null);
  const [noteModalVisible, setNoteModalVisible] = useState(false);
  const [myNote, setMyNote] = useState('');
  const [partnerNote, setPartnerNote] = useState<string | null>(null);
  const [lastSwipe, setLastSwipe] = useState<{ listing: Listing; direction: 'left' | 'right' } | null>(null);
  const topListingIdRef = useRef<string | null>(null);

  useNewListingsNotify();

  // Mount: initial load (respects 30-min throttle)
  useEffect(() => {
    refresh();
  }, [refresh]);

  // Filter change: force-refresh, skip the initial mount run
  const filterMountedRef = useRef(false);
  useEffect(() => {
    if (!filterMountedRef.current) { filterMountedRef.current = true; return; }
    refresh(true);
  }, [filtersKey, refresh]);

  // Pagination: pre-fetch when stack runs low
  useEffect(() => {
    if (stack.length <= 3 && !isLoading) {
      loadMore();
    }
  }, [stack.length, isLoading, loadMore]);

  const partnerId = couple
    ? (couple.user1_id === firebaseUser?.uid ? couple.user2_id : couple.user1_id)
    : null;

  const members = useMemo<CoupleMember[]>(() => {
    const result: CoupleMember[] = [];
    if (firebaseUser && profile) {
      result.push({ uid: firebaseUser.uid, displayName: profile.display_name });
    }
    if (partnerProfile) {
      result.push({ uid: partnerProfile.id, displayName: partnerProfile.display_name });
    }
    return result;
  }, [firebaseUser, profile, partnerProfile]);

  // Fetch own + partner notes whenever the top listing changes
  useEffect(() => {
    const topListing = stack[0];
    if (!topListing || !firebaseUser || !coupleId) return;
    if (topListingIdRef.current === topListing.id) return;
    topListingIdRef.current = topListing.id;

    setMyNote('');
    setPartnerNote(null);

    const myNoteId = `${firebaseUser.uid}_${topListing.id}`;
    const partnerNoteId = partnerId ? `${partnerId}_${topListing.id}` : null;

    Promise.all([
      getDoc(doc(db, 'notes', myNoteId)),
      partnerNoteId ? getDoc(doc(db, 'notes', partnerNoteId)) : Promise.resolve(null),
    ]).then(([mySnap, partnerSnap]) => {
      if (mySnap.exists()) setMyNote((mySnap.data() as { text: string }).text);
      if (partnerSnap?.exists()) setPartnerNote((partnerSnap.data() as { text: string }).text);
    }).catch(() => {});
  }, [stack[0]?.id, firebaseUser, coupleId, partnerId]);

  const saveNote = useCallback(async (text: string) => {
    const topListing = stack[0];
    if (!firebaseUser || !coupleId || !topListing) return;
    const noteId = `${firebaseUser.uid}_${topListing.id}`;
    await setDoc(doc(db, 'notes', noteId), {
      user_id: firebaseUser.uid,
      listing_id: topListing.id,
      couple_id: coupleId,
      text,
      created_at: new Date().toISOString(),
    });
    setMyNote(text);
  }, [firebaseUser, coupleId, stack]);

  const createMatch = useCallback(async (listing: Listing) => {
    if (!coupleId) return;
    const matchId = [coupleId, listing.id].join('_');
    await setDoc(doc(db, 'matches', matchId), {
      couple_id: coupleId,
      listing_id: listing.id,
      listing,
      matched_at: new Date().toISOString(),
      status: 'new',
    });
    setMatchAnim(listing.title);
    setTimeout(() => setMatchAnim(null), 3000);
  }, [coupleId]);

  const checkForMatch = useCallback(async (listing: Listing) => {
    if (!couple || !coupleId || !firebaseUser) return;

    const activeList = searchLists.find((l) => l.id === activeListId);
    const listMemberIds = activeList?.member_ids ?? [];

    // Solo list: only current user participates → match automatique
    if (listMemberIds.length === 1 && listMemberIds[0] === firebaseUser.uid) {
      await createMatch(listing);
      return;
    }

    // All other group members must have right-swiped
    const groupMemberIds = couple.member_ids?.length
      ? couple.member_ids
      : [couple.user1_id, ...(couple.user2_id ? [couple.user2_id] : [])];
    const otherMemberIds = groupMemberIds.filter((id) => id !== firebaseUser.uid);
    if (otherMemberIds.length === 0) return;

    const swipeChecks = await Promise.all(
      otherMemberIds.map((memberId) =>
        getDocs(query(
          collection(db, 'swipes'),
          where('user_id', '==', memberId),
          where('listing_id', '==', listing.id),
          where('direction', '==', 'right'),
        )),
      ),
    );

    if (swipeChecks.every((snap) => !snap.empty)) {
      await createMatch(listing);
    }
  }, [couple, coupleId, firebaseUser, searchLists, activeListId, createMatch]);

  const recordSwipe = useCallback(async (listing: Listing, direction: 'left' | 'right') => {
    if (!firebaseUser || !coupleId) return;

    const swipeId = `${firebaseUser.uid}_${listing.id}`;
    await setDoc(doc(db, 'swipes', swipeId), {
      user_id: firebaseUser.uid,
      listing_id: listing.id,
      couple_id: coupleId,
      direction,
      created_at: new Date().toISOString(),
    });

    if (direction === 'right') {
      await checkForMatch(listing);
      if (profile?.notification_prefs?.notify_partner_on_swipe) {
        notifyPartnerOfSwipe(
          listing,
          profile.display_name,
          coupleId,
          firebaseUser.uid,
        ).catch(() => {});
      }
    }
  }, [firebaseUser, coupleId, couple, profile, checkForMatch]);

  const handleSwipe = useCallback((direction: 'left' | 'right') => {
    const top = stack[0];
    if (!top) return;
    setLastSwipe({ listing: top, direction });
    pop();
    recordSwipe(top, direction);
  }, [stack, pop, recordSwipe]);

  const handleUndo = useCallback(async () => {
    if (!lastSwipe || !firebaseUser || !coupleId) return;
    const { listing, direction } = lastSwipe;
    setLastSwipe(null);
    pushBack(listing);
    const swipeId = `${firebaseUser.uid}_${listing.id}`;
    await deleteDoc(doc(db, 'swipes', swipeId)).catch(() => {});
    if (direction === 'right') {
      const matchId = `${coupleId}_${listing.id}`;
      await deleteDoc(doc(db, 'matches', matchId)).catch(() => {});
      setMatchAnim(null);
    }
  }, [lastSwipe, firebaseUser, coupleId, pushBack]);

  const partnerConnected = Boolean(couple?.user2_id);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.appName}>Chez Nous</Text>
          {couple && (
            <View style={styles.partnerStatusRow}>
              <Ionicons
                name={partnerConnected ? 'people' : 'time-outline'}
                size={12}
                color="#888"
              />
              <Text style={styles.partnerStatus}>
                {partnerConnected ? 'En recherche à deux' : 'En attente du partenaire'}
              </Text>
            </View>
          )}
        </View>
        <TouchableOpacity onPress={() => setFilterVisible(true)}>
          <LinearGradient colors={['#1A1A3E', '#2D2B55']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.filterBtn}>
            <Ionicons name="options-outline" size={16} color="#A78BFA" />
            <Text style={styles.filterLabel} numberOfLines={1}>
              {activeListName ?? 'Filtres'}
            </Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>

      {/* Cards area */}
      <View style={styles.cardsArea}>
        {isLoading && stack.length === 0 ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color="#4A6CF7" />
            <Text style={styles.loadingText}>Chargement des annonces…</Text>
          </View>
        ) : stack.length === 0 ? (
          <View style={styles.centered}>
            <Ionicons name="business-outline" size={64} color="#ccc" />
            <Text style={styles.emptyTitle}>Plus d'annonces</Text>
            <Text style={styles.emptyDesc}>Essaie d'élargir tes filtres</Text>
            <TouchableOpacity onPress={() => refresh(true)}>
              <LinearGradient colors={['#4A6CF7', '#A855F7']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.reloadBtn}>
                <Text style={styles.reloadText}>Recharger</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        ) : (
          [...stack].slice(0, 3).reverse().map((listing, reversedIdx) => {
            const idx = Math.min(2, stack.length - 1) - reversedIdx;
            return (
              <SwipeCard
                key={listing.id}
                listing={listing}
                isTop={idx === 0}
                index={idx}
                onSwipeLeft={() => handleSwipe('left')}
                onSwipeRight={() => handleSwipe('right')}
                onInfoPress={idx === 0 ? () => setDetailListing(listing) : undefined}
                partnerNote={idx === 0 ? partnerNote : null}
                partnerName={idx === 0 ? 'Ton partenaire' : null}
              />
            );
          })
        )}
      </View>

      {/* Action buttons */}
      {stack.length > 0 && (
        <View style={styles.actions}>
          <TouchableOpacity style={styles.passBtn} onPress={() => handleSwipe('left')}>
            <LinearGradient colors={['#FF0044', '#FF4D88']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.btnInner}>
              <Ionicons name="close" size={30} color="#fff" />
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.undoBtn}
            onPress={handleUndo}
            disabled={!lastSwipe}
          >
            <LinearGradient colors={['#4A6CF7', '#A855F7']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.btnInnerSm}>
              <Ionicons name="arrow-undo" size={20} color="#fff" />
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity style={styles.likeBtn} onPress={() => handleSwipe('right')}>
            <LinearGradient colors={['#00E676', '#00C853']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.btnInner}>
              <Ionicons name="heart" size={28} color="#fff" />
            </LinearGradient>
          </TouchableOpacity>
        </View>
      )}

      {/* Match notification */}
      {matchAnim && (
        <View style={styles.matchBanner}>
          <View style={styles.matchTitleRow}>
            <Ionicons name="star" size={16} color="#FFD700" />
            <Text style={styles.matchText}>C'est un match !</Text>
            <Ionicons name="star" size={16} color="#FFD700" />
          </View>
          <Text style={styles.matchSub} numberOfLines={1}>{matchAnim}</Text>
        </View>
      )}

      {/* Floating note button */}
      {stack.length > 0 && (
        <TouchableOpacity style={styles.floatingNoteBtn} onPress={() => setNoteModalVisible(true)}>
          <LinearGradient colors={['#5B4FE9', '#A855F7']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.floatingNoteInner}>
            <Ionicons name={myNote ? 'chatbox' : 'chatbox-outline'} size={24} color="#fff" />
          </LinearGradient>
        </TouchableOpacity>
      )}

      <FilterSheet
        visible={filterVisible}
        onClose={() => setFilterVisible(false)}
        members={members}
      />
      <ListingDetailSheet listing={detailListing} onClose={() => setDetailListing(null)} />
      <NoteModal
        visible={noteModalVisible}
        initialText={myNote}
        listingTitle={stack[0]?.title ?? ''}
        onSave={saveNote}
        onClose={() => setNoteModalVisible(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F8F9FA' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  appName: { fontSize: 24, fontWeight: '800', color: '#1A1A2E' },
  partnerStatusRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  partnerStatus: { fontSize: 12, color: '#888' },
  filterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  filterLabel: { fontSize: 13, color: '#D8B4FE', fontWeight: '700' },
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
  actions: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 28,
    paddingVertical: 20,
  },
  passBtn: {
    width: 68, height: 68, borderRadius: 34,
    shadowColor: '#FF0044', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35, shadowRadius: 8, elevation: 5,
  },
  undoBtn: {
    width: 52, height: 52, borderRadius: 26,
    shadowColor: '#4A6CF7', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35, shadowRadius: 8, elevation: 5,
  },
  likeBtn: {
    width: 68, height: 68, borderRadius: 34,
    shadowColor: '#00E676', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35, shadowRadius: 8, elevation: 5,
  },
  btnInner: {
    width: 68, height: 68, borderRadius: 34,
    alignItems: 'center', justifyContent: 'center',
  },
  btnInnerSm: {
    width: 52, height: 52, borderRadius: 26,
    alignItems: 'center', justifyContent: 'center',
  },
  floatingNoteBtn: {
    position: 'absolute',
    right: 16,
    bottom: 400,
    width: 54, height: 54, borderRadius: 27,
    shadowColor: '#A855F7', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35, shadowRadius: 8, elevation: 5,
  },
  floatingNoteInner: {
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
