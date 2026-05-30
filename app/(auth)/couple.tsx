import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, Share, Alert,
} from 'react-native';
import { router } from 'expo-router';
import {
  collection, doc, setDoc, updateDoc, query,
  where, getDocs, serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuthStore } from '@/stores/authStore';
import { DEFAULT_FILTERS } from '@/types';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

function generateCode(): string {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

export default function CoupleScreen() {
  const { firebaseUser, profile, setCoupleId } = useAuthStore();
  const [tab, setTab] = useState<'create' | 'join'>('create');
  const [inviteCode, setInviteCode] = useState('');
  const [myCode, setMyCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [created, setCreated] = useState(false);

  const createCouple = async () => {
    if (!firebaseUser) return;
    setLoading(true);
    try {
      const code = generateCode();
      const coupleRef = doc(collection(db, 'couples'));
      await setDoc(coupleRef, {
        id: coupleRef.id,
        user1_id: firebaseUser.uid,
        user2_id: null,
        member_ids: [firebaseUser.uid],
        invite_code: code,
        filters: DEFAULT_FILTERS,
        created_at: new Date().toISOString(),
      });
      await updateDoc(doc(db, 'users', firebaseUser.uid), { couple_id: coupleRef.id });
      setCoupleId(coupleRef.id);
      setMyCode(code);
      setCreated(true);
    } catch (e) {
      Alert.alert('Erreur', 'Impossible de créer le couple');
    } finally {
      setLoading(false);
    }
  };

  const joinCouple = async () => {
    if (!firebaseUser || !inviteCode.trim()) return;
    setLoading(true);
    try {
      const q = query(collection(db, 'couples'), where('invite_code', '==', inviteCode.trim().toUpperCase()));
      const snap = await getDocs(q);
      if (snap.empty) {
        Alert.alert('Code invalide', 'Aucun couple trouvé avec ce code');
        return;
      }
      const coupleDoc = snap.docs[0];
      const coupleData = coupleDoc.data();
      const existingMembers: string[] = coupleData.member_ids?.length
        ? coupleData.member_ids
        : [coupleData.user1_id, ...(coupleData.user2_id ? [coupleData.user2_id] : [])];
      if (existingMembers.includes(firebaseUser.uid)) {
        Alert.alert('Erreur', "C'est votre propre code !");
        return;
      }
      const { arrayUnion } = await import('firebase/firestore');
      await updateDoc(coupleDoc.ref, {
        user2_id: coupleData.user2_id ?? firebaseUser.uid,
        member_ids: arrayUnion(firebaseUser.uid),
      });
      await updateDoc(doc(db, 'users', firebaseUser.uid), { couple_id: coupleDoc.id });
      setCoupleId(coupleDoc.id);
      router.replace('/(tabs)');
    } catch (e) {
      Alert.alert('Erreur', 'Impossible de rejoindre le couple');
    } finally {
      setLoading(false);
    }
  };

  const shareCode = () => {
    Share.share({
      message: `Rejoins-moi sur Chez Nous pour chercher notre appart à Paris ! Code d'invitation : ${myCode}`,
    });
  };

  const goToApp = () => router.replace('/(tabs)');

  if (created) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.container}>
          <Ionicons name="checkmark-circle" size={64} color="#4A6CF7" style={styles.emoji} />
          <Text style={styles.title}>Couple créé !</Text>
          <Text style={styles.subtitle}>Partage ce code avec ton/ta partenaire</Text>

          <View style={styles.codeBox}>
            <Text style={styles.codeText}>{myCode}</Text>
          </View>

          <TouchableOpacity style={styles.shareBtn} onPress={shareCode}>
            <Text style={styles.shareBtnText}>Partager le code</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.skipBtn} onPress={goToApp}>
            <Text style={styles.skipText}>Commencer seul pour l'instant</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <Ionicons name="people-outline" size={64} color="#4A6CF7" style={styles.emoji} />
        <Text style={styles.title}>Créez votre duo</Text>
        <Text style={styles.subtitle}>Cherchez votre appart à deux</Text>

        <View style={styles.tabs}>
          <TouchableOpacity
            style={[styles.tabBtn, tab === 'create' && styles.tabActive]}
            onPress={() => setTab('create')}
          >
            <Text style={[styles.tabText, tab === 'create' && styles.tabTextActive]}>Créer</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabBtn, tab === 'join' && styles.tabActive]}
            onPress={() => setTab('join')}
          >
            <Text style={[styles.tabText, tab === 'join' && styles.tabTextActive]}>Rejoindre</Text>
          </TouchableOpacity>
        </View>

        {tab === 'create' ? (
          <View style={styles.section}>
            <Text style={styles.desc}>
              Créez votre espace commun et invitez votre partenaire avec un code.
            </Text>
            <TouchableOpacity style={styles.btn} onPress={createCouple} disabled={loading}>
              {loading
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.btnText}>Créer notre espace</Text>
              }
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.section}>
            <Text style={styles.desc}>
              Entrez le code d'invitation partagé par votre partenaire.
            </Text>
            <TextInput
              style={styles.input}
              placeholder="Code d'invitation (ex: AB12CD)"
              value={inviteCode}
              onChangeText={setInviteCode}
              autoCapitalize="characters"
              maxLength={6}
            />
            <TouchableOpacity style={styles.btn} onPress={joinCouple} disabled={loading || !inviteCode.trim()}>
              {loading
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.btnText}>Rejoindre</Text>
              }
            </TouchableOpacity>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F8F9FA' },
  container: {
    flex: 1, padding: 24, alignItems: 'center', justifyContent: 'center',
  },
  emoji: { marginBottom: 12 },
  title: { fontSize: 28, fontWeight: '800', color: '#1A1A2E', textAlign: 'center' },
  subtitle: { fontSize: 15, color: '#888', marginTop: 6, textAlign: 'center', marginBottom: 32 },
  tabs: {
    flexDirection: 'row',
    backgroundColor: '#eee',
    borderRadius: 12,
    padding: 3,
    marginBottom: 24,
    width: '100%',
  },
  tabBtn: {
    flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center',
  },
  tabActive: { backgroundColor: '#fff', shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 4, elevation: 2 },
  tabText: { fontSize: 15, color: '#888', fontWeight: '500' },
  tabTextActive: { color: '#1A1A2E', fontWeight: '700' },
  section: { width: '100%', gap: 12 },
  desc: { fontSize: 14, color: '#777', textAlign: 'center', lineHeight: 20 },
  input: {
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 20,
    borderWidth: 1.5,
    borderColor: '#eee',
    textAlign: 'center',
    letterSpacing: 6,
    fontWeight: '700',
  },
  btn: {
    backgroundColor: '#4A6CF7', borderRadius: 14, paddingVertical: 16, alignItems: 'center',
  },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  codeBox: {
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingHorizontal: 40,
    paddingVertical: 24,
    marginVertical: 24,
    borderWidth: 2,
    borderColor: '#4A6CF7',
    borderStyle: 'dashed',
  },
  codeText: { fontSize: 36, fontWeight: '800', letterSpacing: 10, color: '#4A6CF7' },
  shareBtn: {
    backgroundColor: '#4A6CF7', borderRadius: 14, paddingVertical: 16,
    paddingHorizontal: 40, alignItems: 'center', width: '100%',
  },
  shareBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  skipBtn: { marginTop: 16 },
  skipText: { color: '#888', fontSize: 14 },
});
