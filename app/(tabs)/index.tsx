import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import {
  View, Text, TouchableOpacity, ActivityIndicator, Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '@/stores/authStore';
import { useFilterStore } from '@/stores/filterStore';
import { useListings } from '@/hooks/useListings';
import { useGroup } from '@/hooks/useGroup';
import { useNewListingsNotify } from '@/hooks/useNewListingsNotify';
import { useSwipeActions } from '@/hooks/useSwipeActions';
import { useNotes } from '@/hooks/useNotes';
import SwipeCard from '@/components/SwipeCard';
import FilterSheet from '@/components/FilterSheet';
import ListingDetailSheet from '@/components/ListingDetailSheet';
import NoteModal from '@/components/NoteModal';
import ConfettiOverlay from '@/components/ConfettiOverlay';
import { GroupMember, Listing } from '@/types';
import { styles } from '@/styles/swipeScreen.styles';

const GRADIENT_START = { x: 0, y: 0 } as const;
const GRADIENT_END = { x: 1, y: 1 } as const;
const FILTER_GRADIENT = ['#F0F4FF', '#E8EDFF'] as const;
const ACTION_GRADIENT = ['#4A6CF7', '#A855F7'] as const;
const NOTE_GRADIENT = ['#5B4FE9', '#A855F7'] as const;
const SAFE_EDGES = ['top'] as const;

type ActiveModal =
  | { type: 'filter'; adding?: boolean }
  | { type: 'note' }
  | { type: 'detail'; listing: Listing };

export default function SwipeScreen() {
  const uid = useAuthStore((s) => s.firebaseUser?.uid);
  const displayName = useAuthStore((s) => s.profile?.display_name);
  const searchLists = useFilterStore((s) => s.searchLists);
  const activeListId = useFilterStore((s) => s.activeListId);
  const hasSearch = searchLists.length > 0;

  const { stack, isLoading, loadMore, refresh, pop, pushBack, filtersKey } = useListings();
  const { group, memberProfiles } = useGroup();

  const groupRef = useRef(group);
  groupRef.current = group;
  const stackRef = useRef(stack);
  stackRef.current = stack;

  const { handleSwipe, handleUndo, matchState, lastSwipeRef } = useSwipeActions(
    groupRef, stackRef, pop, pushBack,
  );

  // Use the first coloc's notes for the top card (shows one coloc's note at a time)
  const firstColocId = memberProfiles[0]?.id ?? null;
  const firstColocName = memberProfiles[0]?.display_name ?? null;

  const { notes, saveNote } = useNotes(stack[0], firstColocId);

  const [modal, setModal] = useState<ActiveModal | null>(null);

  useNewListingsNotify();

  useEffect(() => { if (hasSearch) refresh(); }, [hasSearch, refresh]);

  const filterMountedRef = useRef(false);
  useEffect(() => {
    if (!filterMountedRef.current) { filterMountedRef.current = true; return; }
    if (hasSearch) refresh(true);
  }, [filtersKey, hasSearch, refresh]);

  useEffect(() => {
    if (hasSearch && stack.length <= 3 && !isLoading) loadMore();
  }, [hasSearch, stack.length, isLoading, loadMore]);

  const activeList = useMemo(
    () => searchLists.find((l) => l.id === activeListId),
    [searchLists, activeListId],
  );
  const activeListName = activeList?.name;
  const activeListCover = activeList?.cover_photo_url ?? null;

  const members = useMemo<GroupMember[]>(() => {
    const result: GroupMember[] = [];
    if (uid && displayName) result.push({ uid, displayName });
    memberProfiles.forEach((p) => result.push({ uid: p.id, displayName: p.display_name }));
    return result;
  }, [uid, displayName, memberProfiles]);

  const visibleCards = useMemo(() => {
    const top = stack.slice(0, 3);
    return top
      .slice()
      .reverse()
      .map((listing, reversedIdx) => {
        const idx = Math.min(2, stack.length - 1) - reversedIdx;
        return { listing, idx, isTop: idx === 0 };
      });
  }, [stack]);

  const handleSwipeLeft = useCallback(() => handleSwipe('left'), [handleSwipe]);
  const handleSwipeRight = useCallback(() => handleSwipe('right'), [handleSwipe]);
  const handleInfoPress = useCallback(() => {
    const top = stackRef.current[0];
    if (top) setModal({ type: 'detail', listing: top });
  }, [stackRef]);
  const handleNotePress = useCallback(() => setModal({ type: 'note' }), []);
  const handleFilterPress = useCallback(() => setModal({ type: 'filter' }), []);
  const handleCreateSearch = useCallback(() => setModal({ type: 'filter', adding: true }), []);
  const handleModalClose = useCallback(() => setModal(null), []);

  const hasColocs = (group?.member_ids?.length ?? 0) > 1;

  return (
    <SafeAreaView style={styles.safe} edges={SAFE_EDGES}>
      {/* Cover banner (photo de couverture de la recherche active) */}
      {activeListCover && (
        <Image source={{ uri: activeListCover }} style={styles.coverBanner} />
      )}

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTitles}>
          <Text style={styles.appName} numberOfLines={1}>{group?.name ?? 'Chez Nous'}</Text>
          {group && (
            <View style={styles.partnerStatusRow}>
              <Ionicons
                name={hasColocs ? 'people' : 'time-outline'}
                size={12}
                color="#888"
              />
              <Text style={styles.partnerStatus}>
                {hasColocs
                  ? `En recherche à ${group.member_ids.length}`
                  : 'En attente des colocs'}
              </Text>
            </View>
          )}
        </View>
        <TouchableOpacity onPress={handleFilterPress}>
          <LinearGradient colors={FILTER_GRADIENT} start={GRADIENT_START} end={GRADIENT_END} style={styles.filterBtn}>
            <Ionicons name="options-outline" size={16} color="#4A6CF7" />
            <Text style={styles.filterLabel} numberOfLines={1}>
              {activeListName ?? 'Filtres'}
            </Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>

      {/* Cards area */}
      <View style={styles.cardsArea}>
        {!hasSearch ? (
          <View style={styles.centered}>
            <Ionicons name="search-outline" size={64} color="#ccc" />
            <Text style={styles.emptyTitle}>Aucune recherche</Text>
            <Text style={styles.emptyDesc}>Crée une recherche pour commencer à swiper</Text>
            <TouchableOpacity onPress={handleCreateSearch}>
              <LinearGradient colors={ACTION_GRADIENT} start={GRADIENT_START} end={GRADIENT_END} style={styles.reloadBtn}>
                <Text style={styles.reloadText}>Créer une recherche</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        ) : isLoading && stack.length === 0 ? (
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
              <LinearGradient colors={ACTION_GRADIENT} start={GRADIENT_START} end={GRADIENT_END} style={styles.reloadBtn}>
                <Text style={styles.reloadText}>Recharger</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        ) : (
          visibleCards.map(({ listing, idx, isTop }) => (
            <SwipeCard
              key={listing.id}
              listing={listing}
              isTop={isTop}
              index={idx}
              onSwipeLeft={handleSwipeLeft}
              onSwipeRight={handleSwipeRight}
              onUndo={isTop ? handleUndo : undefined}
              canUndo={isTop ? !!lastSwipeRef.current : undefined}
              onInfoPress={isTop ? handleInfoPress : undefined}
              partnerNote={isTop ? notes.partner : null}
              partnerName={isTop ? firstColocName : null}
            />
          ))
        )}
      </View>

      {/* Confetti + Match notification */}
      {matchState && <ConfettiOverlay key={matchState.id} />}
      {matchState && (
        <View style={styles.matchBanner}>
          <View style={styles.matchTitleRow}>
            <Ionicons name="star" size={16} color="#FFD700" />
            <Text style={styles.matchText}>C'est un match !</Text>
            <Ionicons name="star" size={16} color="#FFD700" />
          </View>
          <Text style={styles.matchSub} numberOfLines={1}>{matchState.title}</Text>
        </View>
      )}

      {/* Note button — right edge, vertically centred in cards area */}
      {stack.length > 0 && (
        <TouchableOpacity style={styles.floatingNoteBtn} onPress={handleNotePress}>
          <LinearGradient colors={NOTE_GRADIENT} start={GRADIENT_START} end={GRADIENT_END} style={styles.floatingNoteInner}>
            <Ionicons name={notes.mine ? 'chatbox' : 'chatbox-outline'} size={24} color="#fff" />
          </LinearGradient>
        </TouchableOpacity>
      )}

      <FilterSheet
        visible={modal?.type === 'filter'}
        onClose={handleModalClose}
        members={members}
        initialAdding={modal?.type === 'filter' ? modal.adding : false}
      />
      <ListingDetailSheet
        listing={modal?.type === 'detail' ? modal.listing : null}
        onClose={handleModalClose}
      />
      <NoteModal
        visible={modal?.type === 'note'}
        initialText={notes.mine}
        listingTitle={stack[0]?.title ?? ''}
        onSave={saveNote}
        onClose={handleModalClose}
      />
    </SafeAreaView>
  );
}
