import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import {
  View, Text, TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '@/stores/authStore';
import { useFilterStore } from '@/stores/filterStore';
import { useListings } from '@/hooks/useListings';
import { useFeedLink } from '@/hooks/useFeedLink';
import { getListingsDataSource } from '@/services/listings';
import { APP_TOKEN_EXPIRED_MESSAGE } from '@/services/providerAccounts';
import { useGroup } from '@/hooks/useGroup';
import { useNewListingsNotify } from '@/hooks/useNewListingsNotify';
import { useSwipeActions } from '@/hooks/useSwipeActions';
import SwipeCard from '@/components/SwipeCard';
import FilterSheet from '@/components/FilterSheet';
import ListingDetailSheet from '@/components/ListingDetailSheet';
import ConfettiOverlay from '@/components/ConfettiOverlay';
import Toast, { ToastType } from '@/components/Toast';
import { Listing } from '@/types';
import { styles } from '@/styles/swipeScreen.styles';

const GRADIENT_START = { x: 0, y: 0 } as const;
const GRADIENT_END = { x: 1, y: 1 } as const;
const ACTION_GRADIENT = ['#4A6CF7', '#A855F7'] as const;
const SHARE_GRADIENT = ['#4A6CF7', '#6A8BFF'] as const;
const SAFE_EDGES = ['top'] as const;
// Feed (Jinka via Cloud Functions) needs a linked alert; the local mock doesn't.
const NEEDS_FEED_LINK = getListingsDataSource().kind === 'feed';

type ActiveModal =
  | { type: 'filter' }
  | { type: 'detail'; listing: Listing };

export default function SwipeScreen() {
  const uid = useAuthStore((s) => s.firebaseUser?.uid);
  const groupId = useAuthStore((s) => s.groupId);
  const displayName = useAuthStore((s) => s.profile?.display_name);
  const hasSearch = useFilterStore((s) => s.searchLists.length > 0);
  const activeListId = useFilterStore((s) => s.activeListId);

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

  // All members (self included) whose notes are shown in the detail sheet.
  const noteMembers = useMemo(() => {
    const others = memberProfiles.map((p) => ({ id: p.id, display_name: p.display_name }));
    return uid ? [{ id: uid, display_name: displayName ?? '' }, ...others] : others;
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
  const handleSharePress = useCallback(async () => {
    const ok = await handleShareToChat();
    setToast(ok
      ? { message: 'Annonce partagée dans le chat', type: 'success' }
      : { message: "Le partage a échoué, réessaie", type: 'error' });
  }, [handleShareToChat]);
  const handleToastHide = useCallback(() => setToast(null), []);
  const handleFilterPress = useCallback(() => setModal({ type: 'filter' }), []);
  const handleReload = useCallback(() => refresh(true), [refresh]);
  const handleModalClose = useCallback(() => setModal(null), []);

  return (
    <SafeAreaView style={styles.safe} edges={SAFE_EDGES}>
      {/* Cards area */}
      <View style={styles.cardsArea}>
        {!hasSearch ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color="#4A6CF7" />
          </View>
        ) : isUnlinked ? (
          <EmptyState
            icon="link-outline"
            title="Aucune alerte liée"
            desc="Lie une alerte Jinka à cette recherche pour voir ses annonces"
            actionLabel="Choisir une alerte"
            onAction={handleFilterPress}
          />
        ) : error && stack.length === 0 ? (
          <EmptyState
            icon="cloud-offline-outline"
            title="Oups"
            desc={error}
            actionLabel="Réessayer"
            onAction={handleReload}
          />
        ) : (isLoading || (NEEDS_FEED_LINK && feedLink === undefined)) && stack.length === 0 ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color="#4A6CF7" />
            <Text style={styles.loadingText}>Chargement des annonces…</Text>
          </View>
        ) : stack.length === 0 ? (
          <EmptyState
            icon="business-outline"
            title="Plus d'annonces"
            desc={feedLink?.status === 'expired'
              ? APP_TOKEN_EXPIRED_MESSAGE
              : 'Élargis tes filtres ou attends la prochaine synchro Jinka'}
            actionLabel="Recharger"
            onAction={handleReload}
          />
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
            />
          ))
        )}

        {/* Filter button — floats over the card's top-left corner */}
        <TouchableOpacity style={styles.floatingFilterBtn} onPress={handleFilterPress} hitSlop={8}>
          <Ionicons name="options-outline" size={20} color="#4A6CF7" />
        </TouchableOpacity>
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

      <FilterSheet
        visible={modal?.type === 'filter'}
        onClose={handleModalClose}
      />
      <ListingDetailSheet
        listing={modal?.type === 'detail' ? modal.listing : null}
        onClose={handleModalClose}
        members={noteMembers}
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

type EmptyStateProps = {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  title: string;
  desc: string;
  actionLabel: string;
  onAction: () => void;
};

// Centered placeholder of the cards area (no search, no alert, error, empty).
const EmptyState = React.memo(function EmptyState({ icon, title, desc, actionLabel, onAction }: EmptyStateProps) {
  return (
    <View style={styles.centered}>
      <Ionicons name={icon} size={64} color="#ccc" />
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyDesc}>{desc}</Text>
      <TouchableOpacity onPress={onAction}>
        <LinearGradient colors={ACTION_GRADIENT} start={GRADIENT_START} end={GRADIENT_END} style={styles.reloadBtn}>
          <Text style={styles.reloadText}>{actionLabel}</Text>
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );
});
