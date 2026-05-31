import React from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Match } from '@/types';

const STATUS_LABELS: Record<Match['status'], string> = {
  new: 'Nouveau match',
  contacted: 'Contacté',
  visited: 'Visité',
  rejected: 'Écarté',
};

const STATUS_COLORS: Record<Match['status'], string> = {
  new: '#4A6CF7',
  contacted: '#FF9800',
  visited: '#00C851',
  rejected: '#999',
};

type Props = {
  match: Match;
  onStatusChange: (id: string, status: Match['status']) => void;
};

export default function MatchCard({ match, onStatusChange }: Props) {
  const { listing, status, matched_at } = match;
  if (!listing) return null;

  const matchDate = new Date(matched_at).toLocaleDateString('fr-FR', {
    day: 'numeric', month: 'short',
  });

  return (
    <View style={styles.card}>
      <Image
        source={{ uri: listing.images[0] }}
        style={styles.image}
        resizeMode="cover"
      />
      <View style={styles.content}>
        <View style={styles.row}>
          <Text style={styles.price}>{listing.price.toLocaleString('fr-FR')} €/mois</Text>
          <View style={[styles.statusBadge, { backgroundColor: STATUS_COLORS[status] + '22' }]}>
            <Text style={[styles.statusText, { color: STATUS_COLORS[status] }]}>
              {STATUS_LABELS[status]}
            </Text>
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
          <Text style={styles.metaDate}>Matché le {matchDate}</Text>
        </View>

        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.contactBtn}
            onPress={() => Linking.openURL(listing.url)}
          >
            <Text style={styles.contactText}>Voir l'annonce</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.chatBtn}
            onPress={() => router.push({
              pathname: `/chat/${match.id}`,
              params: { title: listing.title, address: listing.address },
            })}
          >
            <Ionicons name="chatbubble-outline" size={16} color="#4A6CF7" />
            <Text style={styles.chatBtnText}>Discuter</Text>
          </TouchableOpacity>
        </View>
        {status === 'new' && (
          <TouchableOpacity
            style={styles.statusBtn}
            onPress={() => onStatusChange(match.id, 'contacted')}
          >
            <Text style={styles.statusBtnText}>Marquer contacté</Text>
          </TouchableOpacity>
        )}
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
  image: {
    width: '100%',
    height: 160,
  },
  content: {
    padding: 14,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  price: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A2E',
  },
  statusBadge: {
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginTop: 4,
  },
  address: {
    fontSize: 12,
    color: '#888',
    marginTop: 2,
  },
  meta: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
    alignItems: 'center',
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  metaText: {
    fontSize: 12,
    color: '#555',
  },
  metaDate: {
    fontSize: 11,
    color: '#aaa',
    marginLeft: 'auto',
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  contactBtn: {
    flex: 1,
    backgroundColor: '#4A6CF7',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  contactText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  chatBtn: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#F0F4FF',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  chatBtnText: {
    color: '#4A6CF7',
    fontSize: 13,
    fontWeight: '600',
  },
  statusBtn: {
    backgroundColor: '#F0F4FF',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    marginTop: 8,
  },
  statusBtnText: {
    color: '#4A6CF7',
    fontSize: 13,
    fontWeight: '600',
  },
});
