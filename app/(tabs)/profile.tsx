import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, Switch, Image, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { signOut } from 'firebase/auth';
import { router } from 'expo-router';
import { doc, updateDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import * as ImagePicker from 'expo-image-picker';
import { auth, db, storage } from '@/lib/firebase';
import { useAuthStore } from '@/stores/authStore';
import { useGroup } from '@/hooks/useGroup';
import { useGroupInvitations } from '@/hooks/useGroupInvitations';
import { registerPushToken } from '@/lib/notifications';
import PendingInvitationBanner from '@/components/PendingInvitationBanner';
import Toast, { ToastType } from '@/components/Toast';
import ConfirmSheet from '@/components/ConfirmSheet';
import { NotificationPrefs, DEFAULT_NOTIFICATION_PREFS } from '@/types';

export default function ProfileScreen() {
  const firebaseUser = useAuthStore((s) => s.firebaseUser);
  const profile = useAuthStore((s) => s.profile);
  const { group } = useGroup();
  const pendingInvitations = useGroupInvitations();

  const [logoutVisible, setLogoutVisible] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);

  const notifPrefs: NotificationPrefs = profile?.notification_prefs ?? DEFAULT_NOTIFICATION_PREFS;

  // Nombre de colocs = membres du groupe actif hors soi-même.
  const colocCount = Math.max(0, (group?.member_ids?.length ?? 1) - 1);

  const showToast = (message: string, type: ToastType = 'info') => setToast({ message, type });

  const changePhoto = async () => {
    if (!firebaseUser || !profile) return;

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      showToast("Autorise l'accès à ta galerie dans les réglages pour changer ta photo.", 'error');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });

    if (result.canceled) return;

    setUploadingPhoto(true);
    try {
      const uri = result.assets[0].uri;
      const blob = await new Promise<Blob>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.onload = () => resolve(xhr.response as Blob);
        xhr.onerror = () => reject(new Error('Lecture du fichier échouée'));
        xhr.responseType = 'blob';
        xhr.open('GET', uri, true);
        xhr.send(null);
      });
      const storageRef = ref(storage, `avatars/${firebaseUser.uid}.jpg`);
      await uploadBytes(storageRef, blob);
      const downloadURL = await getDownloadURL(storageRef);
      await updateDoc(doc(db, 'users', firebaseUser.uid), { photo_url: downloadURL });
      useAuthStore.getState().setProfile({ ...profile, photo_url: downloadURL });
      showToast('Photo mise à jour !', 'success');
    } catch (err) {
      console.error('[changePhoto]', err);
      showToast('Impossible de changer la photo. Réessaie.', 'error');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const toggleNotifPref = async (key: keyof NotificationPrefs) => {
    if (!firebaseUser || !profile) return;

    const updated: NotificationPrefs = {
      ...notifPrefs,
      [key]: !notifPrefs[key],
    };

    const { setProfile } = useAuthStore.getState();
    if (updated[key] && !profile.push_token) {
      const token = await registerPushToken(firebaseUser.uid);
      if (!token) {
        showToast("Autorise les notifications dans les réglages de ton téléphone pour activer cette option.", 'info');
        return;
      }
      setProfile({ ...profile, push_token: token, notification_prefs: updated });
    } else {
      setProfile({ ...profile, notification_prefs: updated });
    }

    await updateDoc(doc(db, 'users', firebaseUser.uid), {
      notification_prefs: updated,
    });
  };

  const confirmLogout = async () => {
    setLogoutVisible(false);
    await signOut(auth);
    useAuthStore.getState().reset();
    router.replace('/(auth)');
  };

  const openGroups = () => router.push('/groups');

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.title}>Profil</Text>
        </View>

        {/* User card */}
        <View style={styles.card}>
          <TouchableOpacity style={styles.avatarContainer} onPress={changePhoto} disabled={uploadingPhoto}>
            {profile?.photo_url ? (
              <Image source={{ uri: profile.photo_url }} style={styles.avatarImage} />
            ) : (
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {(profile?.display_name ?? firebaseUser?.email ?? '?')[0].toUpperCase()}
                </Text>
              </View>
            )}
            <View style={styles.avatarBadge}>
              {uploadingPhoto
                ? <ActivityIndicator size={10} color="#fff" />
                : <Ionicons name="camera" size={10} color="#fff" />
              }
            </View>
          </TouchableOpacity>
          <View style={styles.userInfo}>
            <Text style={styles.displayName}>{profile?.display_name ?? 'Mon profil'}</Text>
            <Text style={styles.email}>{firebaseUser?.email}</Text>
          </View>
        </View>

        {/* Invitations en attente */}
        {pendingInvitations.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Invitations</Text>
            <PendingInvitationBanner invitations={pendingInvitations} />
          </View>
        )}

        {/* Groupes — entrée vers l'écran dédié */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Groupes</Text>
          <TouchableOpacity style={styles.groupEntry} onPress={openGroups}>
            <View style={styles.groupEntryIcon}>
              <Ionicons name="people" size={22} color="#4A6CF7" />
            </View>
            <View style={styles.groupEntryTexts}>
              <Text style={styles.groupEntryName} numberOfLines={1}>
                {group ? (group.name ?? 'Notre coloc') : 'Mes groupes'}
              </Text>
              <Text style={styles.groupEntrySub}>
                {group
                  ? (colocCount === 0 ? 'Juste toi' : `${colocCount} coloc${colocCount > 1 ? 's' : ''}`)
                  : 'Créer ou rejoindre un groupe'}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#ccc" />
          </TouchableOpacity>
        </View>

        {/* Notifications */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Notifications</Text>
          <View style={styles.notifCard}>
            <NotifRow
              icon={<Ionicons name="home-outline" size={22} color="#555" />}
              title="Prévenir mes colocs"
              desc="Tes colocs reçoivent une notif quand tu likes un appart"
              value={notifPrefs.notify_on_partner_swipe}
              onToggle={() => toggleNotifPref('notify_on_partner_swipe')}
            />
            <View style={styles.divider} />
            <NotifRow
              icon={<Ionicons name="notifications-outline" size={22} color="#555" />}
              title="Nouvelles annonces"
              desc="Reçois une notif quand de nouveaux apparts correspondent à tes critères"
              value={notifPrefs.notify_on_new_listings}
              onToggle={() => toggleNotifPref('notify_on_new_listings')}
            />
          </View>
        </View>

        {/* Logout */}
        <View style={styles.section}>
          <TouchableOpacity style={styles.logoutBtn} onPress={() => setLogoutVisible(true)}>
            <Text style={styles.logoutText}>Se déconnecter</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 32 }} />
      </ScrollView>

      <ConfirmSheet
        visible={logoutVisible}
        title="Déconnexion"
        message="Voulez-vous vous déconnecter ?"
        confirmLabel="Se déconnecter"
        confirmDestructive
        onConfirm={confirmLogout}
        onCancel={() => setLogoutVisible(false)}
      />

      <Toast
        visible={!!toast}
        message={toast?.message ?? ''}
        type={toast?.type}
        onHide={() => setToast(null)}
      />
    </SafeAreaView>
  );
}

function NotifRow({
  icon, title, desc, value, onToggle,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
  value: boolean;
  onToggle: () => void;
}) {
  return (
    <View style={styles.notifRow}>
      <View style={styles.notifIcon}>{icon}</View>
      <View style={styles.notifTexts}>
        <Text style={styles.notifTitle}>{title}</Text>
        <Text style={styles.notifDesc}>{desc}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onToggle}
        trackColor={{ false: '#ddd', true: '#4A6CF7' }}
        thumbColor="#fff"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F8F9FA' },
  header: { paddingHorizontal: 20, paddingVertical: 16 },
  title: { fontSize: 24, fontWeight: '800', color: '#1A1A2E' },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  avatarContainer: { position: 'relative' },
  avatar: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: '#4A6CF7',
    alignItems: 'center', justifyContent: 'center',
  },
  avatarImage: { width: 52, height: 52, borderRadius: 26 },
  avatarText: { color: '#fff', fontSize: 22, fontWeight: '700' },
  avatarBadge: {
    position: 'absolute', bottom: 0, right: 0,
    width: 18, height: 18, borderRadius: 9,
    backgroundColor: '#1A1A2E',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: '#fff',
  },
  userInfo: { flex: 1 },
  displayName: { fontSize: 17, fontWeight: '700', color: '#1A1A2E' },
  email: { fontSize: 13, color: '#888', marginTop: 2 },
  section: { marginTop: 20 },
  sectionTitle: {
    fontSize: 13, fontWeight: '600', color: '#888',
    textTransform: 'uppercase', letterSpacing: 0.5,
    marginHorizontal: 20, marginBottom: 10,
  },
  groupEntry: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  groupEntryIcon: {
    width: 46, height: 46, borderRadius: 23,
    backgroundColor: '#EEF1FF',
    alignItems: 'center', justifyContent: 'center',
  },
  groupEntryTexts: { flex: 1 },
  groupEntryName: { fontSize: 16, fontWeight: '700', color: '#1A1A2E' },
  groupEntrySub: { fontSize: 13, color: '#888', marginTop: 2 },
  divider: { height: 1, backgroundColor: '#f0f0f0', marginVertical: 8 },
  notifCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    marginHorizontal: 16,
    paddingHorizontal: 16,
    paddingVertical: 4,
  },
  notifRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    gap: 12,
  },
  notifIcon: { width: 28, alignItems: 'center' },
  notifTexts: { flex: 1 },
  notifTitle: { fontSize: 14, fontWeight: '600', color: '#1A1A2E' },
  notifDesc: { fontSize: 12, color: '#888', marginTop: 2, lineHeight: 16 },
  logoutBtn: {
    marginHorizontal: 16, backgroundColor: '#fff', borderRadius: 14,
    paddingVertical: 16, alignItems: 'center',
    borderWidth: 1.5, borderColor: '#FF4444',
  },
  logoutText: { color: '#FF4444', fontSize: 15, fontWeight: '700' },
});
