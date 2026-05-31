import React, { useState, useCallback, memo } from 'react';
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
import { UserSearchResult } from '@/types';

type Props = {
  visible: boolean;
  groupId: string;
  currentMemberIds: string[];
  onClose: () => void;
};

type ResultItemProps = {
  item: UserSearchResult;
  onInvite: (uid: string) => void;
  invited: boolean;
};

const ResultItem = memo(function ResultItem({ item, onInvite, invited }: ResultItemProps) {
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
        style={[styles.inviteBtn, invited && styles.inviteBtnDone]}
        onPress={() => onInvite(item.uid)}
        disabled={invited}
      >
        <Text style={[styles.inviteBtnText, invited && styles.inviteBtnTextDone]}>
          {invited ? 'Invité' : 'Inviter'}
        </Text>
      </Pressable>
    </View>
  );
});

export default function AddMemberSheet({ visible, groupId, currentMemberIds, onClose }: Props) {
  const [term, setTerm] = useState('');
  const [results, setResults] = useState<UserSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [invitedUids, setInvitedUids] = useState<Set<string>>(new Set());
  const insets = useSafeAreaInsets();

  const translateY = useSharedValue(400);

  React.useEffect(() => {
    translateY.value = withTiming(visible ? 0 : 400, { duration: 320 });
    if (!visible) {
      setTerm('');
      setResults([]);
      setInvitedUids(new Set());
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
      const found = await searchUsers(text, [
        ...(firebaseUser ? [firebaseUser.uid] : []),
        ...currentMemberIds,
      ]);
      setResults(found);
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
    }
  }, [currentMemberIds]);

  const handleInvite = useCallback(async (inviteeId: string) => {
    const { firebaseUser, profile } = useAuthStore.getState();
    if (!firebaseUser || !profile) return;
    try {
      await sendGroupInvitation(groupId, firebaseUser.uid, profile.display_name, inviteeId);
      setInvitedUids((prev) => new Set(prev).add(inviteeId));
    } catch {
      Alert.alert('Erreur', "Impossible d'envoyer l'invitation");
    }
  }, [groupId]);

  const renderItem = useCallback(({ item }: { item: UserSearchResult }) => (
    <ResultItem
      item={item}
      onInvite={handleInvite}
      invited={invitedUids.has(item.uid)}
    />
  ), [handleInvite, invitedUids]);

  const keyExtractor = useCallback((item: UserSearchResult) => item.uid, []);

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

          {results.length === 0 && term.length >= 2 && !searching ? (
            <Text style={styles.empty}>Aucun utilisateur trouvé</Text>
          ) : (
            <FlatList
              data={results}
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
  inviteBtn: {
    backgroundColor: '#4A6CF7',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  inviteBtnDone: { backgroundColor: '#E8F0FF' },
  inviteBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  inviteBtnTextDone: { color: '#4A6CF7' },
  empty: { color: '#aaa', fontSize: 14, textAlign: 'center', marginTop: 20 },
});
