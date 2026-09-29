import React, { useCallback, useMemo, useState } from 'react';
import {
  View, Text, ScrollView, ActivityIndicator, RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useMatches } from '@/hooks/useMatches';
import { useLikes } from '@/hooks/useLikes';
import { useGroup } from '@/hooks/useGroup';
import { useAuthStore } from '@/stores/authStore';
import MatchCard from '@/components/MatchCard';
import LikeCard from '@/components/LikeCard';
import { styles } from '@/styles/matchesScreen.styles';

const SAFE_EDGES = ['top'] as const;
const REFRESH_COLORS = ['#4A6CF7'];

export default function MatchesScreen() {
  const { matches, isLoading: matchesLoading, refresh: refreshMatches } = useMatches();
  const { likes, isLoading: likesLoading, refresh: refreshLikes } = useLikes();
  const { memberProfiles } = useGroup();
  const myUid = useAuthStore((s) => s.firebaseUser?.uid);
  const myProfile = useAuthStore((s) => s.profile);

  // All members (self + others) — stable reference, used by NotesSection in each card.
  const allMembers = useMemo(() => {
    const others = memberProfiles.map((p) => ({ id: p.id, display_name: p.display_name }));
    if (myProfile) return [{ id: myProfile.id, display_name: myProfile.display_name }, ...others];
    return others;
  }, [memberProfiles, myProfile]);

  const matchedIds = useMemo(() => new Set(matches.map((m) => m.listing_id)), [matches]);
  const personalLikes = useMemo(
    () => likes.filter((l) => !matchedIds.has(l.listing_id)),
    [likes, matchedIds],
  );

  const [refreshing, setRefreshing] = useState(false);
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([refreshMatches(), refreshLikes()]);
    } catch {
      // Offline or transient error: the live listeners keep the current data.
    } finally {
      setRefreshing(false);
    }
  }, [refreshMatches, refreshLikes]);

  if (matchesLoading || likesLoading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#4A6CF7" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={SAFE_EDGES}>
      <View style={styles.header}>
        <Text style={styles.title}>Mes favoris</Text>
        <Text style={styles.count}>
          {matches.length + personalLikes.length} annonce{matches.length + personalLikes.length > 1 ? 's' : ''}
        </Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
        refreshControl={(
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor="#4A6CF7"
            colors={REFRESH_COLORS}
          />
        )}
      >

        {/* Mutual matches */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="star" size={15} color="#FFD700" />
            <Text style={styles.sectionTitle}>Nos coups de cœur</Text>
            <View style={styles.pill}><Text style={styles.pillText}>{matches.length}</Text></View>
          </View>
          {matches.length === 0 ? (
            <View style={styles.emptySection}>
              <Text style={styles.emptyText}>Aucun match — swipez ensemble !</Text>
            </View>
          ) : (
            matches.map((match) => (
              <MatchCard
                key={match.id}
                match={match}
                members={allMembers}
                myUid={myUid}
              />
            ))
          )}
        </View>

        {/* Personal likes */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="heart" size={15} color="#FF4081" />
            <Text style={styles.sectionTitle}>Mes likes</Text>
            <View style={[styles.pill, styles.pillPink]}><Text style={styles.pillText}>{personalLikes.length}</Text></View>
          </View>
          {personalLikes.length === 0 ? (
            <View style={styles.emptySection}>
              <Text style={styles.emptyText}>Les annonces que tu aimes apparaîtront ici.</Text>
            </View>
          ) : (
            personalLikes.map((like) => (
              <LikeCard key={like.id} like={like} members={allMembers} myUid={myUid} />
            ))
          )}
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}
