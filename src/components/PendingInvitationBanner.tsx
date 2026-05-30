import React, { useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/stores/authStore';
import { acceptGroupInvitation, rejectGroupInvitation } from '@/services/userSearch';
import { GroupInvitation } from '@/types';

type Props = {
  invitations: GroupInvitation[];
};

export default function PendingInvitationBanner({ invitations }: Props) {
  const { firebaseUser, setCoupleId } = useAuthStore();

  const handleAccept = useCallback(async (inv: GroupInvitation) => {
    if (!firebaseUser) return;
    try {
      await acceptGroupInvitation(inv.id, inv.group_id, firebaseUser.uid);
      setCoupleId(inv.group_id);
    } catch {
      Alert.alert('Erreur', "Impossible d'accepter l'invitation");
    }
  }, [firebaseUser, setCoupleId]);

  const handleReject = useCallback(async (inv: GroupInvitation) => {
    try {
      await rejectGroupInvitation(inv.id);
    } catch {
      Alert.alert('Erreur', "Impossible de refuser l'invitation");
    }
  }, []);

  if (invitations.length === 0) return null;

  return (
    <View style={styles.container}>
      {invitations.map((inv) => (
        <View key={inv.id} style={styles.banner}>
          <View style={styles.iconWrap}>
            <Ionicons name="people" size={20} color="#4A6CF7" />
          </View>
          <View style={styles.texts}>
            <Text style={styles.title}>Invitation de {inv.inviter_name}</Text>
            <Text style={styles.sub}>Chercher un appart ensemble</Text>
          </View>
          <Pressable style={styles.rejectBtn} onPress={() => handleReject(inv)}>
            <Ionicons name="close" size={18} color="#888" />
          </Pressable>
          <Pressable style={styles.acceptBtn} onPress={() => handleAccept(inv)}>
            <Text style={styles.acceptText}>Accepter</Text>
          </Pressable>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginHorizontal: 16, gap: 10 },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EEF1FF',
    borderRadius: 14,
    padding: 14,
    gap: 10,
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  iconWrap: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#fff',
    alignItems: 'center', justifyContent: 'center',
  },
  texts: { flex: 1 },
  title: { fontSize: 14, fontWeight: '700', color: '#1A1A2E' },
  sub: { fontSize: 12, color: '#555', marginTop: 1 },
  rejectBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: '#fff',
    alignItems: 'center', justifyContent: 'center',
  },
  acceptBtn: {
    backgroundColor: '#4A6CF7',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  acceptText: { color: '#fff', fontSize: 13, fontWeight: '700' },
});
