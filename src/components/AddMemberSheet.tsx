import React, { useState, useCallback, useMemo, memo } from 'react';
import {
  View, Text, TextInput, FlatList, Modal,
  StyleSheet, Pressable, ActivityIndicator,
  Image, Alert,
} from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/stores/authStore';
import { searchUsers, sendGroupInvitation } from '@/services/userSearch';
import { followUser } from '@/services/follows';
import { useFollowing } from '@/hooks/useFollowing';
import { UserSearchResult } from '@/types';

type Props = {
  visible: boolean;
  groupId: string;
  currentMemberIds: string[];
  onClose: () => void;
};

type RowAction = 'follow' | 'invite' | 'invited' | 'member';

type ResultItemProps = {
  item: UserSearchResult;
  action: RowAction;
  busy: boolean;
  onFollow: (item: UserSearchResult) => void;
  onInvite: (uid: string) => void;
};

const ACTION_LABEL: Record<RowAction, string> = {
  follow: 'Suivre',
  invite: 'Inviter',
  invited: 'Invité',
  member: 'Membre',
};

const ResultItem = memo(function ResultItem({
  item, action, busy, onFollow, onInvite,
}: ResultItemProps) {
  const handlePress = useCallback(() => {
    if (action === 'follow') onFollow(item);
    else if (action === 'invite') onInvite(item.uid);
  }, [action, item, onFollow, onInvite]);

  const disabled = action === 'invited' || action === 'member';
  const done = action === 'invited' || action === 'member';

  return (
    <View style={styles.resultRow}>
      {item.photo_url ? (
        <Image source={{ uri: item.photo_url }} style={styles.avatar} />
      ) : (
        <View style={styles.avatarPlaceholder}>
          <Text style={styles.avatarLetter}>{item.display_name[0].toUpperCase()}</Text>
        </View>
      )}
      <View style={styles.resultTexts}>
        <Text style={styles.resultName}>{item.display_name}</Text>
        <Text style={styles.resultEmail}>{item.email}</Text>
      </View>
      <Pressable
        style={[
          styles.actionBtn,
          action === 'follow' && styles.followBtn,
          done && styles.actionBtnDone,
        ]}
        onPress={handlePress}
        disabled={disabled || busy}
      >
        {busy ? (
          <ActivityIndicator size="small" color={action === 'follow' ? '#4A6CF7' : '#fff'} />
        ) : (
          <Text
            style={[
              styles.actionBtnText,
              action === 'follow' && styles.followBtnText,
              done && styles.actionBtnTextDone,
            ]}
          >
            {ACTION_LABEL[action]}
          </Text>
        )}
      </Pressable>
    </View>
  );
});

export default function AddMemberSheet({ visible, groupId, currentMemberIds, onClose }: Props) {
  const [term, setTerm] = useState('');
  const [results, setResults] = useState<UserSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [invitedUids, setInvitedUids] = useState<Set<string>>(new Set());
  const [busyUids, setBusyUids] = useState<Set<string>>(new Set());
  const insets = useSafeAreaInsets();

  const { following, loading: followingLoading } = useFollowing();

  const followingIds = useMemo(
    () => new Set(following.map((u) => u.uid)),
    [following],
  );
  const memberIdSet = useMemo(
    () => new Set(currentMemberIds),
    [currentMemberIds],
  );

  const translateY = useSharedValue(400);

  React.useEffect(() => {
    translateY.value = withTiming(visible ? 0 : 400, { duration: 320 });
    if (!visible) {
      setTerm('');
      setResults([]);
      setInvitedUids(new Set());
      setBusyUids(new Set());
    }
  }, [visible, translateY]);

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const handleSearch = useCallback(async (text: string) => {
    setTerm(text);
    if (text.trim().length < 2) { setResults([]); return; }
    setSearching(true);
    try {
      const { firebaseUser } = useAuthStore.getState();
      const found = await searchUsers(text, firebaseUser ? [firebaseUser.uid] : []);
      setResults(found);
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
    }
  }, []);

  const withBusy = useCallback(async (uid: string, fn: () => Promise<void>) => {
    setBusyUids((prev) => new Set(prev).add(uid));
    try {
      await fn();
    } finally {
      setBusyUids((prev) => {
        const next = new Set(prev);
        next.delete(uid);
        return next;
      });
    }
  }, []);

  const handleFollow = useCallback((item: UserSearchResult) => {
    const { firebaseUser } = useAuthStore.getState();
    if (!firebaseUser) return;
    withBusy(item.uid, async () => {
      try {
        await followUser(firebaseUser.uid, item);
      } catch {
        Alert.alert('Erreur', "Impossible de suivre cet utilisateur");
      }
    });
  }, [withBusy]);

  const handleInvite = useCallback((inviteeId: string) => {
    const { firebaseUser, profile } = useAuthStore.getState();
    if (!firebaseUser || !profile) return;
    withBusy(inviteeId, async () => {
      try {
        await sendGroupInvitation(groupId, firebaseUser.uid, profile.display_name, inviteeId);
        setInvitedUids((prev) => new Set(prev).add(inviteeId));
      } catch {
        Alert.alert('Erreur', "Impossible d'envoyer l'invitation");
      }
    });
  }, [groupId, withBusy]);

  const resolveAction = useCallback((uid: string): RowAction => {
    if (memberIdSet.has(uid)) return 'member';
    if (invitedUids.has(uid)) return 'invited';
    if (followingIds.has(uid)) return 'invite';
    return 'follow';
  }, [memberIdSet, invitedUids, followingIds]);

  const isSearchMode = term.trim().length >= 2;

  // En mode "abonnements", on masque les membres déjà dans le groupe.
  const followingData = useMemo(
    () => following.filter((u) => !memberIdSet.has(u.uid)),
    [following, memberIdSet],
  );

  const data = isSearchMode ? results : followingData;

  const renderItem = useCallback(({ item }: { item: UserSearchResult }) => (
    <ResultItem
      item={item}
      action={resolveAction(item.uid)}
      busy={busyUids.has(item.uid)}
      onFollow={handleFollow}
      onInvite={handleInvite}
    />
  ), [resolveAction, busyUids, handleFollow, handleInvite]);

  const keyExtractor = useCallback((item: UserSearchResult) => item.uid, []);

  const showEmpty = isSearchMode
    ? results.length === 0 && !searching
    : !followingLoading && followingData.length === 0;

  const emptyText = isSearchMode
    ? 'Aucun utilisateur trouvé'
    : 'Tu ne suis personne pour l\'instant. Recherche un nom ou un email pour suivre quelqu\'un.';

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Animated.View style={[styles.sheet, sheetStyle, { paddingBottom: insets.bottom + 24 }]}>
          <View style={styles.handle} />
          <Text style={styles.title}>Ajouter un coloc</Text>

          <View style={styles.searchRow}>
            <Ionicons name="search" size={16} color="#888" style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Nom ou email..."
              value={term}
              onChangeText={handleSearch}
              autoCapitalize="none"
              autoCorrect={false}
              placeholderTextColor="#aaa"
            />
            {searching && <ActivityIndicator size="small" color="#4A6CF7" />}
          </View>

          {!isSearchMode && (
            <Text style={styles.sectionLabel}>Mes abonnements</Text>
          )}

          {showEmpty ? (
            <Text style={styles.empty}>{emptyText}</Text>
          ) : (
            <FlatList
              data={data}
              keyExtractor={keyExtractor}
              renderItem={renderItem}
              style={styles.list}
              keyboardShouldPersistTaps="handled"
            />
          )}
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingBottom: 40,
    paddingTop: 12,
    maxHeight: '80%',
  },
  handle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: '#E0E0E0', alignSelf: 'center', marginBottom: 16,
  },
  title: { fontSize: 18, fontWeight: '800', color: '#1A1A2E', marginBottom: 16 },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
    gap: 8,
  },
  searchIcon: {},
  searchInput: { flex: 1, fontSize: 15, color: '#1A1A2E' },
  sectionLabel: {
    fontSize: 12, color: '#888', fontWeight: '600',
    textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4,
  },
  list: { flexGrow: 0 },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  avatar: { width: 40, height: 40, borderRadius: 20 },
  avatarPlaceholder: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#4A6CF7',
    alignItems: 'center', justifyContent: 'center',
  },
  avatarLetter: { color: '#fff', fontSize: 16, fontWeight: '700' },
  resultTexts: { flex: 1 },
  resultName: { fontSize: 14, fontWeight: '600', color: '#1A1A2E' },
  resultEmail: { fontSize: 12, color: '#888', marginTop: 1 },
  actionBtn: {
    backgroundColor: '#4A6CF7',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
    minWidth: 78,
    alignItems: 'center',
  },
  actionBtnDone: { backgroundColor: '#E8F0FF' },
  actionBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  actionBtnTextDone: { color: '#4A6CF7' },
  followBtn: {
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: '#4A6CF7',
  },
  followBtnText: { color: '#4A6CF7' },
  empty: { color: '#aaa', fontSize: 14, textAlign: 'center', marginTop: 20, lineHeight: 20 },
});
