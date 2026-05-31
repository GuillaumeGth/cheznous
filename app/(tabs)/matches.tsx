import React, { useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useMatches } from '@/hooks/useMatches';
import { useLikes } from '@/hooks/useLikes';
import { useGroup } from '@/hooks/useGroup';
import { useAuthStore } from '@/stores/authStore';
import MatchCard from '@/components/MatchCard';
import LikeCard from '@/components/LikeCard';
import { Match } from '@/types';

export default function MatchesScreen() {
  const { matches, isLoading: matchesLoading } = useMatches();
  const { likes, isLoading: likesLoading } = useLikes();
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

  const handleStatusChange = async (id: string, status: Match['status']) => {
    await updateDoc(doc(db, 'matches', id), { status });
  };

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
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Mes favoris</Text>
        <Text style={styles.count}>
          {matches.length + personalLikes.length} annonce{matches.length + personalLikes.length > 1 ? 's' : ''}
        </Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

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
                onStatusChange={handleStatusChange}
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

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F8F9FA' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  title: { fontSize: 24, fontWeight: '800', color: '#1A1A2E' },
  count: { fontSize: 13, color: '#888' },
  scroll: { paddingBottom: 32 },
  section: { marginBottom: 8 },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#1A1A2E', flex: 1 },
  pill: {
    backgroundColor: '#4A6CF722',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  pillPink: { backgroundColor: '#FF40811A' },
  pillText: { fontSize: 12, fontWeight: '600', color: '#555' },
  emptySection: {
    marginHorizontal: 16,
    marginBottom: 12,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  emptyText: { fontSize: 13, color: '#aaa', textAlign: 'center' },
});
