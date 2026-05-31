import React, { useState, useMemo, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, Share, Alert, ScrollView,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useAuthStore } from '@/stores/authStore';
import { useFilterStore, DEFAULT_LIST } from '@/stores/filterStore';
import {
  renameGroup, createGroup, joinGroupByCode, DEFAULT_GROUP_NAME,
} from '@/services/groups';
import { GroupMember } from '@/types';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AddMemberSheet from '@/components/AddMemberSheet';
import FilterSheet from '@/components/FilterSheet';

type OnboardingModal = 'invite' | 'configure' | null;

export default function GroupScreen() {
  const uid = useAuthStore((s) => s.firebaseUser?.uid);
  const displayName = useAuthStore((s) => s.profile?.display_name);
  const params = useLocalSearchParams<{ from?: string }>();
  // Depuis l'app (gestion des groupes) on revient sur /groups ; sinon onboarding → tabs.
  const doneHref = params.from === 'groups' ? '/groups' : '/(tabs)';

  const [tab, setTab] = useState<'create' | 'join'>('create');
  const [inviteCode, setInviteCode] = useState('');
  // null = form view ; string = onboarding view for the freshly created group
  const [createdCode, setCreatedCode] = useState<string | null>(null);
  const [createdGroupId, setCreatedGroupId] = useState<string | null>(null);
  const [groupName, setGroupName] = useState(DEFAULT_GROUP_NAME);
  const [onboardingModal, setOnboardingModal] = useState<OnboardingModal>(null);
  const [loading, setLoading] = useState(false);

  const members = useMemo<GroupMember[]>(
    () => (uid ? [{ uid, displayName: displayName ?? 'Moi' }] : []),
    [uid, displayName],
  );

  const handleCreate = async () => {
    const { firebaseUser, setGroupId } = useAuthStore.getState();
    if (!firebaseUser) return;
    setLoading(true);
    try {
      const { id, code } = await createGroup(firebaseUser.uid);
      setGroupId(id);
      // Amorce le filterStore pour que FilterSheet édite la bonne liste.
      useFilterStore.getState().setSearchLists([DEFAULT_LIST], DEFAULT_LIST.id);
      setCreatedGroupId(id);
      setGroupName(DEFAULT_GROUP_NAME);
      setCreatedCode(code);
    } catch (e: any) {
      console.error('[createGroup] error:', e?.code, e?.message, e);
      Alert.alert('Erreur', `Impossible de créer le groupe${e?.code ? `\n(${e.code})` : ''}`);
    } finally {
      setLoading(false);
    }
  };

  const joinGroup = async () => {
    const { firebaseUser, setGroupId } = useAuthStore.getState();
    if (!firebaseUser || !inviteCode.trim()) return;
    setLoading(true);
    try {
      const groupId = await joinGroupByCode(firebaseUser.uid, inviteCode);
      setGroupId(groupId);
      router.replace(doneHref);
    } catch (e: any) {
      if (e?.message === 'CODE_INVALID') {
        Alert.alert('Code invalide', 'Aucun groupe trouvé avec ce code');
      } else if (e?.message === 'ALREADY_MEMBER') {
        Alert.alert('Erreur', 'Tu fais déjà partie de ce groupe !');
      } else {
        console.error('[joinGroup] error:', e?.code, e?.message, e);
        Alert.alert('Erreur', `Impossible de rejoindre le groupe${e?.code ? `\n(${e.code})` : ''}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const shareCode = () => {
    Share.share({
      message: `Rejoins-moi sur Chez Nous pour chercher notre appart à Paris ! Code d'invitation : ${createdCode}`,
    });
  };

  const saveGroupName = useCallback(() => {
    if (!createdGroupId) return;
    const name = groupName.trim();
    if (!name) { setGroupName(DEFAULT_GROUP_NAME); return; }
    renameGroup(createdGroupId, name).catch(() => {});
  }, [createdGroupId, groupName]);

  const openInvite = useCallback(() => setOnboardingModal('invite'), []);
  const openConfigure = useCallback(() => setOnboardingModal('configure'), []);
  const closeOnboardingModal = useCallback(() => setOnboardingModal(null), []);

  const goToApp = () => router.replace(doneHref);

  if (createdCode) {
    return (
      <SafeAreaView style={styles.safe}>
        <ScrollView contentContainerStyle={styles.onboardingScroll} showsVerticalScrollIndicator={false}>
          <Ionicons name="checkmark-circle" size={56} color="#4A6CF7" style={styles.emoji} />
          <Text style={styles.title}>Groupe créé !</Text>
          <Text style={styles.subtitle}>Configure ta recherche puis lance-toi</Text>

          {/* Titre du groupe (éditable) */}
          <View style={styles.fieldBlock}>
            <Text style={styles.fieldLabel}>Nom du groupe</Text>
            <View style={styles.nameInputRow}>
              <Ionicons name="home-outline" size={18} color="#4A6CF7" />
              <TextInput
                style={styles.nameInput}
                value={groupName}
                onChangeText={setGroupName}
                onBlur={saveGroupName}
                onSubmitEditing={saveGroupName}
                returnKeyType="done"
                placeholder="Nom du groupe"
                placeholderTextColor="#aaa"
                maxLength={40}
              />
            </View>
          </View>

          {/* Code d'invitation */}
          <View style={styles.codeBox}>
            <Text style={styles.codeLabel}>Code d'invitation</Text>
            <Text style={styles.codeText}>{createdCode}</Text>
          </View>

          {/* Étapes */}
          <TouchableOpacity style={styles.stepCard} onPress={openInvite}>
            <View style={styles.stepIcon}>
              <Ionicons name="people-outline" size={22} color="#4A6CF7" />
            </View>
            <View style={styles.stepTexts}>
              <Text style={styles.stepTitle}>Inviter mes colocs</Text>
              <Text style={styles.stepDesc}>Cherche parmi les gens que tu suis</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#ccc" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.stepCard} onPress={openConfigure}>
            <View style={styles.stepIcon}>
              <Ionicons name="options-outline" size={22} color="#4A6CF7" />
            </View>
            <View style={styles.stepTexts}>
              <Text style={styles.stepTitle}>Configurer la recherche</Text>
              <Text style={styles.stepDesc}>Filtres, photo de couverture…</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#ccc" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.secondaryBtn} onPress={shareCode}>
            <Ionicons name="share-outline" size={18} color="#4A6CF7" />
            <Text style={styles.secondaryBtnText}>Partager le code</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.startBtn} onPress={goToApp}>
            <Text style={styles.startBtnText}>Commencer</Text>
          </TouchableOpacity>
        </ScrollView>

        {createdGroupId && uid && (
          <AddMemberSheet
            visible={onboardingModal === 'invite'}
            groupId={createdGroupId}
            currentMemberIds={[uid]}
            onClose={closeOnboardingModal}
          />
        )}
        <FilterSheet
          visible={onboardingModal === 'configure'}
          onClose={closeOnboardingModal}
          members={members}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      {router.canGoBack() && (
        <TouchableOpacity
          style={styles.backFab}
          onPress={() => router.back()}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="chevron-back" size={26} color="#1A1A2E" />
        </TouchableOpacity>
      )}
      <View style={styles.container}>
        <Ionicons name="people-outline" size={64} color="#4A6CF7" style={styles.emoji} />
        <Text style={styles.title}>Créez votre groupe</Text>
        <Text style={styles.subtitle}>Cherchez votre appart ensemble</Text>

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
              Créez votre espace commun et invitez vos colocs avec un code.
            </Text>
            <TouchableOpacity style={styles.btn} onPress={handleCreate} disabled={loading}>
              {loading
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.btnText}>Créer notre espace</Text>
              }
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.section}>
            <Text style={styles.desc}>
              Entrez le code d'invitation partagé par un coloc.
            </Text>
            <TextInput
              style={styles.input}
              placeholder="Code d'invitation (ex: AB12CD)"
              value={inviteCode}
              onChangeText={setInviteCode}
              autoCapitalize="characters"
              maxLength={6}
            />
            <TouchableOpacity style={styles.btn} onPress={joinGroup} disabled={loading || !inviteCode.trim()}>
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
  backFab: {
    position: 'absolute', top: 8, left: 8, zIndex: 10,
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
  },
  container: {
    flex: 1, padding: 24, alignItems: 'center', justifyContent: 'center',
  },
  onboardingScroll: {
    padding: 24, alignItems: 'center', paddingBottom: 40,
  },
  emoji: { marginBottom: 12 },
  title: { fontSize: 28, fontWeight: '800', color: '#1A1A2E', textAlign: 'center' },
  subtitle: { fontSize: 15, color: '#888', marginTop: 6, textAlign: 'center', marginBottom: 28 },
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
  fieldBlock: { width: '100%', marginBottom: 16 },
  fieldLabel: {
    fontSize: 12, color: '#888', fontWeight: '600',
    textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8,
  },
  nameInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1.5,
    borderColor: '#eee',
  },
  nameInput: { flex: 1, fontSize: 16, fontWeight: '600', color: '#1A1A2E' },
  codeBox: {
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingHorizontal: 40,
    paddingVertical: 18,
    marginBottom: 20,
    borderWidth: 2,
    borderColor: '#4A6CF7',
    borderStyle: 'dashed',
    alignItems: 'center',
    width: '100%',
  },
  codeLabel: {
    fontSize: 11, color: '#888', fontWeight: '600',
    textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6,
  },
  codeText: { fontSize: 34, fontWeight: '800', letterSpacing: 10, color: '#4A6CF7' },
  stepCard: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  stepIcon: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: '#EEF1FF',
    alignItems: 'center', justifyContent: 'center',
  },
  stepTexts: { flex: 1 },
  stepTitle: { fontSize: 15, fontWeight: '700', color: '#1A1A2E' },
  stepDesc: { fontSize: 13, color: '#888', marginTop: 2 },
  secondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    marginTop: 4,
  },
  secondaryBtnText: { color: '#4A6CF7', fontSize: 15, fontWeight: '700' },
  startBtn: {
    width: '100%',
    backgroundColor: '#4A6CF7',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  startBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
