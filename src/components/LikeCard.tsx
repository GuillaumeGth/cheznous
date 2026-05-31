import React from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Like } from '@/hooks/useLikes';
import NotesSection from '@/components/NotesSection';

type Member = { id: string; display_name: string };

type Props = {
  like: Like;
  members: Member[];
  myUid: string | undefined;
};

export default function LikeCard({ like, members, myUid }: Props) {
  const { listing, liked_at } = like;
  if (!listing) return null;

  const likeDate = new Date(liked_at).toLocaleDateString('fr-FR', {
    day: 'numeric', month: 'short',
  });

  return (
    <View style={styles.card}>
      <Image source={{ uri: listing.images[0] }} style={styles.image} resizeMode="cover" />
      <View style={styles.content}>
        <View style={styles.row}>
          <Text style={styles.price}>{listing.price.toLocaleString('fr-FR')} €/mois</Text>
          <View style={styles.badge}>
            <Ionicons name="heart" size={10} color="#FF4081" />
            <Text style={styles.badgeText}>Aimé</Text>
          </View>
        </View>
        <Text style={styles.title} numberOfLines={1}>{listing.title}</Text>
        <Text style={styles.address} numberOfLines={1}>{listing.address}</Text>
        <View style={styles.meta}>
          <View style={styles.metaItem}>
            <Ionicons name="resize-outline" size={12} color="#555" />
            <Text style={styles.metaText}>{listing.surface} m²</Text>
          </View>
          <View style={styles.metaItem}>
            <Ionicons name="bed-outline" size={12} color="#555" />
            <Text style={styles.metaText}>{listing.rooms === 1 ? 'Studio' : `${listing.rooms}p`}</Text>
          </View>
          <Text style={styles.metaDate}>Le {likeDate}</Text>
        </View>
        <TouchableOpacity style={styles.btn} onPress={() => Linking.openURL(listing.url)}>
          <Text style={styles.btnText}>Voir l'annonce</Text>
        </TouchableOpacity>
        <NotesSection listingId={like.listing_id} members={members} myUid={myUid} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    marginHorizontal: 16,
    marginBottom: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  image: { width: '100%', height: 160 },
  content: { padding: 14 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  price: { fontSize: 18, fontWeight: '700', color: '#1A1A2E' },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FF40811A',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  badgeText: { fontSize: 11, fontWeight: '600', color: '#FF4081' },
  title: { fontSize: 14, fontWeight: '600', color: '#333', marginTop: 4 },
  address: { fontSize: 12, color: '#888', marginTop: 2 },
  meta: { flexDirection: 'row', gap: 12, marginTop: 8, alignItems: 'center' },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  metaText: { fontSize: 12, color: '#555' },
  metaDate: { fontSize: 11, color: '#aaa', marginLeft: 'auto' },
  btn: {
    backgroundColor: '#4A6CF7',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    marginTop: 12,
  },
  btnText: { color: '#fff', fontSize: 13, fontWeight: '600' },
});
