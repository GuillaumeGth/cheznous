import React, { useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Share, ScrollView, Switch, Image, ActivityIndicator,
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
import { useFilterStore } from '@/stores/filterStore';
import { registerPushToken } from '@/lib/notifications';
import FilterSheet from '@/components/FilterSheet';
import AddMemberSheet from '@/components/AddMemberSheet';
import PendingInvitationBanner from '@/components/PendingInvitationBanner';
import Toast, { ToastType } from '@/components/Toast';
import ConfirmSheet from '@/components/ConfirmSheet';
import { GroupMember, NotificationPrefs, DEFAULT_NOTIFICATION_PREFS } from '@/types';

type ActiveModal = 'filter' | 'addMember' | 'logout' | null;

export default function ProfileScreen() {
  const firebaseUser = useAuthStore((s) => s.firebaseUser);
  const profile = useAuthStore((s) => s.profile);
  const filters = useFilterStore((s) => s.filters);
  const { group, memberProfiles } = useGroup();
  const pendingInvitations = useGroupInvitations();

  const [modal, setModal] = useState<ActiveModal>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);

  const members = useMemo<GroupMember[]>(() => {
    const result: GroupMember[] = [];
    if (firebaseUser && profile) {
      result.push({ uid: firebaseUser.uid, displayName: profile.display_name });
    }
    memberProfiles.forEach((mp) => result.push({ uid: mp.id, displayName: mp.display_name }));
    return result;
  }, [firebaseUser, profile, memberProfiles]);

  const notifPrefs: NotificationPrefs = profile?.notification_prefs ?? DEFAULT_NOTIFICATION_PREFS;

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
    setModal(null);
    await signOut(auth);
    useAuthStore.getState().reset();
    router.replace('/(auth)');
  };

  const shareInvite = () => {
    if (!group?.invite_code) return;
    Share.share({
      message: `Rejoins-moi sur Chez Nous pour chercher notre appart à Paris ! Code : ${group.invite_code}`,
    });
  };

  const filtersLabel = () => {
    const parts: string[] = [];
    if (filters.arrondissements.length > 0)
      parts.push(`${filters.arrondissements.length} arr.`);
    parts.push(`max ${filters.price_max.toLocaleString('fr-FR')} €`);
    parts.push(`+${filters.surface_min} m²`);
    if (filters.rooms_min > 0)
      parts.push(`${filters.rooms_min === 1 ? 'Studio' : `${filters.rooms_min}p`}+`);
    return parts.join(' · ');
  };

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

        {/* Groupe / colocs */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Notre groupe</Text>
          {group ? (
            <View style={styles.groupCard}>
              <View style={styles.groupRow}>
                <Text style={styles.groupLabel}>Colocs</Text>
                <Text style={styles.groupValue}>
                  {(group.member_ids?.length ?? 1)} personne{(group.member_ids?.length ?? 1) > 1 ? 's' : ''}
                </Text>
              </View>

              {memberProfiles.length > 0 && (
                <>
                  <View style={styles.divider} />
                  {memberProfiles.map((mp) => (
                    <View key={mp.id} style={styles.memberRow}>
                      <Ionicons name="person-circle-outline" size={18} color="#4A6CF7" />
                      <Text style={styles.memberName}>{mp.display_name}</Text>
                    </View>
                  ))}
                </>
              )}

              <View style={styles.divider} />
              <TouchableOpacity
                style={styles.shareBtn}
                onPress={() => setModal('addMember')}
              >
                <Ionicons name="person-add-outline" size={15} color="#4A6CF7" />
                <Text style={styles.shareBtnText}>Ajouter un coloc</Text>
              </TouchableOpacity>

              <View style={styles.divider} />
              <View style={styles.groupRow}>
                <Text style={styles.groupLabel}>Code d'invitation</Text>
                <Text style={styles.inviteCode}>{group.invite_code}</Text>
              </View>
              <TouchableOpacity style={[styles.shareBtn, styles.shareBtnSecondary]} onPress={shareInvite}>
                <Text style={styles.shareBtnText}>Partager le code</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.joinBtn}
              onPress={() => router.push('/(auth)/invite')}
            >
              <Text style={styles.joinBtnText}>Créer ou rejoindre un groupe</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Filters summary */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Critères de recherche</Text>
          <View style={styles.card}>
            <View style={styles.filterRow}>
              <Text style={styles.filterSummary}>{filtersLabel()}</Text>
              <TouchableOpacity onPress={() => setModal('filter')}>
                <Text style={styles.editLink}>Modifier</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.divider} />
            <View style={styles.filterGrid}>
              {filters.arrondissements.length > 0 && (
                <FilterDetail label="Arrondissements" value={filters.arrondissements.map(a => `${a}e`).join(', ')} />
              )}
              <FilterDetail label="Loyer max" value={`${filters.price_max.toLocaleString('fr-FR')} €/mois`} />
              <FilterDetail label="Surface min" value={`${filters.surface_min} m²`} />
              <FilterDetail
                label="Pièces"
                value={filters.rooms_min === 0 ? 'Tous' : filters.rooms_min === 1 ? 'Studio+' : `${filters.rooms_min} pièces+`}
              />
            </View>
            {group && (
              <Text style={styles.sharedNote}>
                Ces filtres sont partagés avec vos colocs
              </Text>
            )}
          </View>
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
          <TouchableOpacity style={styles.logoutBtn} onPress={() => setModal('logout')}>
            <Text style={styles.logoutText}>Se déconnecter</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 32 }} />
      </ScrollView>

      <FilterSheet visible={modal === 'filter'} onClose={() => setModal(null)} members={members} />
      {group && (
        <AddMemberSheet
          visible={modal === 'addMember'}
          groupId={group.id}
          currentMemberIds={group.member_ids ?? [group.user1_id, ...(group.user2_id ? [group.user2_id] : [])]}
          onClose={() => setModal(null)}
        />
      )}

      <ConfirmSheet
        visible={modal === 'logout'}
        title="Déconnexion"
        message="Voulez-vous vous déconnecter ?"
        confirmLabel="Se déconnecter"
        confirmDestructive
        onConfirm={confirmLogout}
        onCancel={() => setModal(null)}
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

function FilterDetail({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.filterDetail}>
      <Text style={styles.filterDetailLabel}>{label}</Text>
      <Text style={styles.filterDetailValue}>{value}</Text>
    </View>
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
  groupCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 16,
  },
  groupRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  groupLabel: { fontSize: 14, color: '#888' },
  groupValue: { fontSize: 14, fontWeight: '600', color: '#1A1A2E' },
  inviteCode: { fontSize: 18, fontWeight: '800', letterSpacing: 4, color: '#4A6CF7' },
  divider: { height: 1, backgroundColor: '#f0f0f0', marginVertical: 8 },
  shareBtn: {
    backgroundColor: '#EEF1FF',
    borderRadius: 12, paddingVertical: 12, alignItems: 'center', marginTop: 8,
    flexDirection: 'row', gap: 6, justifyContent: 'center',
  },
  shareBtnSecondary: { marginTop: 4 },
  shareBtnText: { color: '#4A6CF7', fontWeight: '700', fontSize: 14 },
  memberRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6,
  },
  memberName: { fontSize: 14, color: '#1A1A2E', fontWeight: '500' },
  joinBtn: {
    backgroundColor: '#4A6CF7', borderRadius: 14,
    paddingVertical: 14, alignItems: 'center', marginHorizontal: 16,
  },
  joinBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  filterRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  filterSummary: { fontSize: 13, color: '#555', flex: 1 },
  editLink: { color: '#4A6CF7', fontSize: 14, fontWeight: '600' },
  filterGrid: { gap: 8, marginTop: 4 },
  filterDetail: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  filterDetailLabel: { fontSize: 14, color: '#888' },
  filterDetailValue: { fontSize: 14, fontWeight: '600', color: '#1A1A2E' },
  sharedNote: {
    fontSize: 11, color: '#aaa', textAlign: 'center', marginTop: 12,
  },
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
