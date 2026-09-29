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
import { useFeedLink } from '@/hooks/useFeedLink';
import { getListingsDataSource } from '@/services/listings';
import { useGroup } from '@/hooks/useGroup';
import { useNewListingsNotify } from '@/hooks/useNewListingsNotify';
import { useSwipeActions } from '@/hooks/useSwipeActions';
import { useNotes } from '@/hooks/useNotes';
import SwipeCard from '@/components/SwipeCard';
import FilterSheet from '@/components/FilterSheet';
import ListingDetailSheet from '@/components/ListingDetailSheet';
import NoteModal from '@/components/NoteModal';
import ConfettiOverlay from '@/components/ConfettiOverlay';
import MemberAvatars from '@/components/MemberAvatars';
import Toast, { ToastType } from '@/components/Toast';
import { GroupMember, Listing } from '@/types';
import { styles } from '@/styles/swipeScreen.styles';

const GRADIENT_START = { x: 0, y: 0 } as const;
const GRADIENT_END = { x: 1, y: 1 } as const;
const FILTER_GRADIENT = ['#F0F4FF', '#E8EDFF'] as const;
const ACTION_GRADIENT = ['#4A6CF7', '#A855F7'] as const;
const NOTE_GRADIENT = ['#5B4FE9', '#A855F7'] as const;
const SHARE_GRADIENT = ['#4A6CF7', '#6A8BFF'] as const;
const SAFE_EDGES = ['top'] as const;
// Feed (Jinka via Cloud Functions) needs a linked alert; the local mock doesn't.
const NEEDS_FEED_LINK = getListingsDataSource().kind === 'feed';

type ActiveModal =
  | { type: 'filter'; adding?: boolean }
  | { type: 'note' }
  | { type: 'detail'; listing: Listing };

export default function SwipeScreen() {
  const uid = useAuthStore((s) => s.firebaseUser?.uid);
  const groupId = useAuthStore((s) => s.groupId);
  const displayName = useAuthStore((s) => s.profile?.display_name);
  const myPhoto = useAuthStore((s) => s.profile?.photo_url);
  const searchLists = useFilterStore((s) => s.searchLists);
  const activeListId = useFilterStore((s) => s.activeListId);
  const hasSearch = searchLists.length > 0;

  const { stack, isLoading, error, loadMore, refresh, pop, pushBack, queryKey } = useListings();
  const feedLink = useFeedLink(NEEDS_FEED_LINK ? groupId : null, NEEDS_FEED_LINK ? activeListId : null);
  const isUnlinked = NEEDS_FEED_LINK && feedLink === null;
  const canLoad = hasSearch && (!NEEDS_FEED_LINK || !!feedLink);
  // Reload when the list's source changes (a member links another alert) or its
  // first sync lands — not on every periodic sync, which would reset the stack.
  const feedKey = feedLink
    ? `${feedLink.owner_id}|${feedLink.alert_id}|${feedLink.last_sync_at ? 'synced' : 'pending'}`
    : '';
  const { group, memberProfiles } = useGroup();

  const groupRef = useRef(group);
  groupRef.current = group;
  const stackRef = useRef(stack);
  stackRef.current = stack;

  const { handleSwipe, handleUndo, matchState, lastSwipeRef, handleShareToChat } = useSwipeActions(
    groupRef, stackRef, pop, pushBack,
  );

  // Use the first coloc's notes for the top card (shows one coloc's note at a time)
  const firstColocId = memberProfiles[0]?.id ?? null;
  const firstColocName = memberProfiles[0]?.display_name ?? null;

  const { notes, saveNote } = useNotes(stack[0], firstColocId);

  const [modal, setModal] = useState<ActiveModal | null>(null);
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);

  useNewListingsNotify();

  useEffect(() => { if (canLoad) refresh(); }, [canLoad, refresh]);

  const queryMountedRef = useRef(false);
  useEffect(() => {
    if (!queryMountedRef.current) { queryMountedRef.current = true; return; }
    if (canLoad) refresh(true);
  }, [queryKey, feedKey, canLoad, refresh]);

  useEffect(() => {
    if (canLoad && stack.length <= 3 && !isLoading) loadMore();
  }, [canLoad, stack.length, isLoading, loadMore]);

  const activeList = useMemo(
    () => searchLists.find((l) => l.id === activeListId),
    [searchLists, activeListId],
  );
  const activeListCover = activeList?.cover_photo_url ?? null;

  const members = useMemo<GroupMember[]>(() => {
    const result: GroupMember[] = [];
    if (uid && displayName) result.push({ uid, displayName, photoUrl: myPhoto ?? null });
    memberProfiles.forEach((p) =>
      result.push({ uid: p.id, displayName: p.display_name, photoUrl: p.photo_url }),
    );
    return result;
  }, [uid, displayName, myPhoto, memberProfiles]);

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
  const handleSharePress = useCallback(async () => {
    const ok = await handleShareToChat();
    setToast(ok
      ? { message: 'Annonce partagée dans le chat', type: 'success' }
      : { message: "Le partage a échoué, réessaie", type: 'error' });
  }, [handleShareToChat]);
  const handleToastHide = useCallback(() => setToast(null), []);
  const handleNotePress = useCallback(() => setModal({ type: 'note' }), []);
  const handleFilterPress = useCallback(() => setModal({ type: 'filter' }), []);
  const handleCreateSearch = useCallback(() => setModal({ type: 'filter', adding: true }), []);
  const handleReload = useCallback(() => refresh(true), [refresh]);
  const handleModalClose = useCallback(() => setModal(null), []);

  const hasColocs = (group?.member_ids?.length ?? 0) > 1;

  return (
    <SafeAreaView style={styles.safe} edges={SAFE_EDGES}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTitles}>
          {activeListCover && (
            <View style={styles.groupAvatar}>
              <Image source={{ uri: activeListCover }} style={styles.groupAvatarImage} />
            </View>
          )}
          <View style={styles.headerText}>
            <View style={styles.titleRow}>
              <Text style={styles.appName} numberOfLines={1}>{group?.name ?? 'Chez Nous'}</Text>
              {hasColocs && <MemberAvatars members={members} />}
            </View>
            {group && !hasColocs && (
              <View style={styles.partnerStatusRow}>
                <Ionicons name="time-outline" size={12} color="#888" />
                <Text style={styles.partnerStatus}>En attente des colocs</Text>
              </View>
            )}
          </View>
        </View>
        <TouchableOpacity onPress={handleFilterPress}>
          <LinearGradient colors={FILTER_GRADIENT} start={GRADIENT_START} end={GRADIENT_END} style={styles.filterBtn}>
            <Ionicons name="options-outline" size={16} color="#4A6CF7" />
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
        ) : isUnlinked ? (
          <View style={styles.centered}>
            <Ionicons name="link-outline" size={64} color="#ccc" />
            <Text style={styles.emptyTitle}>Aucune alerte liée</Text>
            <Text style={styles.emptyDesc}>Lie une alerte Jinka à cette recherche pour voir ses annonces</Text>
            <TouchableOpacity onPress={handleFilterPress}>
              <LinearGradient colors={ACTION_GRADIENT} start={GRADIENT_START} end={GRADIENT_END} style={styles.reloadBtn}>
                <Text style={styles.reloadText}>Choisir une alerte</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        ) : error && stack.length === 0 ? (
          <View style={styles.centered}>
            <Ionicons name="cloud-offline-outline" size={64} color="#ccc" />
            <Text style={styles.emptyTitle}>Oups</Text>
            <Text style={styles.emptyDesc}>{error.message}</Text>
            <TouchableOpacity onPress={handleReload}>
              <LinearGradient colors={ACTION_GRADIENT} start={GRADIENT_START} end={GRADIENT_END} style={styles.reloadBtn}>
                <Text style={styles.reloadText}>Réessayer</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        ) : (isLoading || (NEEDS_FEED_LINK && feedLink === undefined)) && stack.length === 0 ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color="#4A6CF7" />
            <Text style={styles.loadingText}>Chargement des annonces…</Text>
          </View>
        ) : stack.length === 0 ? (
          <View style={styles.centered}>
            <Ionicons name="business-outline" size={64} color="#ccc" />
            <Text style={styles.emptyTitle}>Plus d'annonces</Text>
            <Text style={styles.emptyDesc}>
              {feedLink?.status === 'expired'
                ? "Le token Jinka de l'app a expiré : l'administrateur doit le remplacer"
                : "Élargis tes filtres ou attends la prochaine synchro Jinka"}
            </Text>
            <TouchableOpacity onPress={handleReload}>
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

      {/* Share button — left edge, vertically centred in cards area */}
      {stack.length > 0 && (
        <TouchableOpacity style={styles.floatingShareBtn} onPress={handleSharePress}>
          <LinearGradient colors={SHARE_GRADIENT} start={GRADIENT_START} end={GRADIENT_END} style={styles.floatingShareInner}>
            <Ionicons name="chatbubble-ellipses-outline" size={22} color="#fff" />
          </LinearGradient>
        </TouchableOpacity>
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
      <Toast
        message={toast?.message ?? ''}
        type={toast?.type}
        visible={!!toast}
        onHide={handleToastHide}
      />
    </SafeAreaView>
  );
}
